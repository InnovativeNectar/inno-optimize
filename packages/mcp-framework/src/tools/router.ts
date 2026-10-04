import { ToolDescriptor, ToolResult, ToolRoute } from './server';
import { TaskContext } from '../agentdb/src/types';

export class CodemodRegistry {
  private codemods = new Map<string, CodemodPattern>();
  
  register(pattern: CodemodPattern): void {
    this.codemods.set(pattern.id, pattern);
  }
  
  get(id: string): CodemodPattern | undefined {
    return this.codemods.get(id);
  }
  
  findMatching(codeContext: string): CodemodPattern | null {
    for (const pattern of this.codemods.values()) {
      if (pattern.matches(codeContext)) {
        return pattern;
      }
    }
    return null;
  }
}

export interface CodemodPattern {
  id: string;
  name: string;
  description: string;
  pattern: RegExp | ((code: string) => boolean);
  transform: (code: string) => string;
  tier: 1;
  toolDescriptor: ToolDescriptor;
}

export class PatternMemory {
  private patterns = new Map<string, ReasoningPattern>();
  
  store(pattern: ReasoningPattern): void {
    this.patterns.set(pattern.id, pattern);
  }
  
  get(id: string): ReasoningPattern | undefined {
    return this.patterns.get(id);
  }
  
  async findSimilar(task: TaskContext, topK: number = 5): Promise<ReasoningPattern[]> {
    // In production, this would use HNSW search
    // For now, simple text matching
    const results: Array<{ pattern: ReasoningPattern; score: number }> = [];
    
    for (const pattern of this.patterns.values()) {
      const score = this.computeSimilarity(task, pattern);
      if (score > 0.5) {
        results.push({ pattern, score });
      }
    }
    
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK).map(r => r.pattern);
  }
  
  private computeSimilarity(task: TaskContext, pattern: ReasoningPattern): number {
    // Simple text similarity
    const taskWords = new Set(task.description.toLowerCase().split(/\s+/));
    const patternWords = new Set(pattern.description.toLowerCase().split(/\s+/));
    
    let intersection = 0;
    for (const w of taskWords) {
      if (patternWords.has(w)) intersection++;
    }
    
    return intersection / Math.max(taskWords.size, patternWords.size);
  }
}

export interface ReasoningPattern {
  id: string;
  title: string;
  description: string;
  content: string;
  reward: number;
  mode: string;
  verdict: 'success' | 'failure';
  loraWeights: any;
  consolidated: boolean;
  createdAt: Date;
}

export class ToolRouter {
  private codemodRegistry: CodemodRegistry;
  private patternMemory: PatternMemory;
  
  constructor(codemodRegistry: CodemodRegistry, patternMemory: PatternMemory) {
    this.codemodRegistry = codemodRegistry;
    this.patternMemory = patternMemory;
  }
  
  async route(task: TaskContext, availableTools: ToolDescriptor[]): Promise<ToolRoute> {
    // Tier 1: Check for deterministic codemod
    if (task.codeContext) {
      const codemod = this.codemodRegistry.findMatching(task.codeContext);
      if (codemod) {
        return {
          selectedTool: codemod.toolDescriptor,
          modelTier: 1,
          fallbackTools: [],
          reasoning: `Deterministic codemod matched: ${codemod.name}`
        };
      }
    }
    
    // Tier 2: Check for high-confidence pattern match
    const patterns = await this.patternMemory.findSimilar(task, 3);
    if (patterns.length > 0 && patterns[0].reward > 0.85) {
      const tool = this.selectToolForPattern(patterns[0], availableTools);
      if (tool) {
        return {
          selectedTool: tool,
          modelTier: 2,
          fallbackTools: this.getFallbacks(tool, availableTools),
          reasoning: `High-confidence pattern match: ${patterns[0].title} (reward: ${patterns[0].reward})`
        };
      }
    }
    
    // Tier 3: Complex reasoning required
    const tool = this.selectBestTool(task, availableTools);
    return {
      selectedTool: tool,
      modelTier: 3,
      fallbackTools: this.getFallbacks(tool, availableTools),
      reasoning: `Complex task requiring reasoning: ${task.description}`
    };
  }
  
  private selectToolForPattern(
    pattern: ReasoningPattern, 
    availableTools: ToolDescriptor[]
  ): ToolDescriptor | null {
    // Match pattern to tool by capabilities
    const requiredCaps = this.inferCapabilities(pattern);
    
    for (const tool of availableTools) {
      if (requiredCaps.every(c => tool.capabilities.includes(c))) {
        return tool;
      }
    }
    
    return availableTools[0] || null;
  }
  
  private selectBestTool(task: TaskContext, availableTools: ToolDescriptor[]): ToolDescriptor {
    // Score tools by relevance
    const scored = availableTools.map(tool => ({
      tool,
      score: this.scoreToolForTask(tool, task)
    }));
    
    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.tool || availableTools[0];
  }
  
  private scoreToolForTask(tool: ToolDescriptor, task: TaskContext): number {
    let score = 0;
    
    // Match by description keywords
    const taskWords = task.description.toLowerCase().split(/\s+/);
    const toolWords = tool.description.toLowerCase().split(/\s+/);
    
    for (const w of taskWords) {
      if (toolWords.includes(w)) score += 1;
    }
    
    // Prefer lower tier (cheaper/faster)
    score += (4 - tool.tier) * 0.5;
    
    // Prefer non-destructive
    if (!tool.destructive) score += 1;
    
    return score;
  }
  
  private inferCapabilities(pattern: ReasoningPattern): string[] {
    const caps: string[] = [];
    const content = pattern.content.toLowerCase();
    
    if (content.includes('refactor') || content.includes('rewrite')) caps.push('write');
    if (content.includes('analyze') || content.includes('review')) caps.push('read');
    if (content.includes('test')) caps.push('execute');
    if (content.includes('deploy')) caps.push('deploy');
    
    return caps.length > 0 ? caps : ['read'];
  }
  
  private getFallbacks(primary: ToolDescriptor, available: ToolDescriptor[]): ToolDescriptor[] {
    return available
      .filter(t => t.id !== primary.id)
      .slice(0, 3);
  }
}

// Pre-built codemod patterns
export function createBuiltinCodemods(): CodemodPattern[] {
  return [
    {
      id: 'const-conversion',
      name: 'Convert var to const',
      description: 'Convert var declarations to const where possible',
      pattern: /\bvar\s+(\w+)\s*=/g,
      transform: (code) => code.replace(/\bvar\s+(\w+)\s*=/g, 'const $1 ='),
      tier: 1,
      toolDescriptor: {
        id: 'codemod-const-conversion',
        name: 'const-conversion',
        description: 'Convert var to const',
        inputSchema: { type: 'object', properties: { code: { type: 'string' } } },
        outputSchema: { type: 'object', properties: { code: { type: 'string' } } },
        serverId: 'codemod-registry',
        tier: 1,
        capabilities: ['write'],
        destructive: false
      }
    },
    {
      id: 'remove-console',
      name: 'Remove console statements',
      description: 'Remove console.log/warn/error statements',
      pattern: /console\.(log|warn|error|info|debug)\([^)]*\);?/g,
      transform: (code) => code.replace(/console\.(log|warn|error|info|debug)\([^)]*\);?\n?/g, ''),
      tier: 1,
      toolDescriptor: {
        id: 'codemod-remove-console',
        name: 'remove-console',
        description: 'Remove console statements',
        inputSchema: { type: 'object', properties: { code: { type: 'string' } } },
        outputSchema: { type: 'object', properties: { code: { type: 'string' } } },
        serverId: 'codemod-registry',
        tier: 1,
        capabilities: ['write'],
        destructive: false
      }
    },
    {
      id: 'organize-imports',
      name: 'Organize imports',
      description: 'Sort and deduplicate import statements',
      pattern: /^import\s+.*\s+from\s+['"][^'"]+['"];?$/gm,
      transform: (code) => {
        const lines = code.split('\n');
        const imports = lines.filter(l => l.trim().startsWith('import '));
        const others = lines.filter(l => !l.trim().startsWith('import '));
        const sorted = [...new Set(imports)].sort();
        return [...sorted, '', ...others].join('\n');
      },
      tier: 1,
      toolDescriptor: {
        id: 'codemod-organize-imports',
        name: 'organize-imports',
        description: 'Organize import statements',
        inputSchema: { type: 'object', properties: { code: { type: 'string' } } },
        outputSchema: { type: 'object', properties: { code: { type: 'string' } } },
        serverId: 'codemod-registry',
        tier: 1,
        capabilities: ['write'],
        destructive: false
      }
    },
    {
      id: 'add-tracking-ticket',
      name: 'Add tracking ticket to TODO',
      description: 'Add JIRA/GitHub ticket reference to TODO comments',
      pattern: /\/\/\s*(TODO|FIXME):\s*(.+)$/gm,
      transform: (code) => code.replace(
        /\/\/\s*(TODO|FIXME):\s*(.+)$/gm,
        '// $1: [AUTO-TICKET] $2'
      ),
      tier: 1,
      toolDescriptor: {
        id: 'codemod-add-ticket',
        name: 'add-tracking-ticket',
        description: 'Add tracking ticket to TODO/FIXME',
        inputSchema: { type: 'object', properties: { code: { type: 'string' } } },
        outputSchema: { type: 'object', properties: { code: { type: 'string' } } },
        serverId: 'codemod-registry',
        tier: 1,
        capabilities: ['write'],
        destructive: false
      }
    }
  ];
}