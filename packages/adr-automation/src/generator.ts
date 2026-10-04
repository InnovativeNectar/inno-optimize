import { ArchitecturalChange, ADR, SemanticAnchor, Consequence } from '../agentdb/src/types';

export class ADRGenerator {
  private memory: MemoryInterface;
  private embedder: Embedder;
  private adrCounter = 0;
  
  constructor(memory: MemoryInterface, embedder: Embedder) {
    this.memory = memory;
    this.embedder = embedder;
  }
  
  async generateFromChange(change: ArchitecturalChange): Promise<ADR> {
    // 1. Analyze change impact
    const impact = await this.analyzeImpact(change);
    
    // 2. Retrieve relevant patterns
    const patterns = await this.memory.query({
      query: change.description,
      type: 'pattern',
      topK: 5
    });
    
    // 3. Generate ADR content
    this.adrCounter++;
    const adr: ADR = {
      id: `ADR-${String(this.adrCounter).padStart(3, '0')}`,
      title: this.generateTitle(change),
      status: 'proposed',
      context: this.generateContext(change, impact),
      decision: this.generateDecision(change, patterns),
      consequences: this.generateConsequences(change, impact),
      semanticAnchors: await this.createAnchors(change),
      createdAt: new Date(),
      updatedAt: new Date(),
      authors: ['inno-optimize']
    };
    
    return adr;
  }
  
  private async analyzeImpact(change: ArchitecturalChange): Promise<ImpactAnalysis> {
    const affectedModules = new Set<string>();
    const dependencies = new Map<string, string[]>();
    
    for (const file of change.affectedFiles) {
      const module = this.extractModule(file);
      affectedModules.add(module);
      
      // In production, parse actual dependencies
      const deps = await this.extractDependencies(file);
      dependencies.set(file, deps);
    }
    
    return {
      affectedModules: Array.from(affectedModules),
      dependencies,
      riskLevel: this.assessRisk(change),
      estimatedEffort: this.estimateEffort(change)
    };
  }
  
  private generateTitle(change: ArchitecturalChange): string {
    const prefixes = {
      refactor: 'Refactor',
      new_module: 'Introduce',
      dependency_change: 'Update dependency',
      pattern_introduction: 'Adopt pattern'
    };
    
    const prefix = prefixes[change.type] || 'Change';
    const target = change.affectedFiles[0]?.split('/').pop() || 'system';
    
    return `${prefix} ${target}: ${change.description.substring(0, 50)}`;
  }
  
  private generateContext(change: ArchitecturalChange, impact: ImpactAnalysis): string {
    return `
## Context

**Trigger:** ${change.description}

**Change Type:** ${change.type}
**Impact Level:** ${change.impact}
**Risk Level:** ${impact.riskLevel}

**Affected Files:** ${change.affectedFiles.length}
**Affected Modules:** ${impact.affectedModules.join(', ')}

**Estimated Effort:** ${impact.estimatedEffort}

**Dependencies:** ${Array.from(impact.dependencies.entries()).map(([f, d]) => `${f}: ${d.join(', ')}`).join('; ')}

**Timestamp:** ${change.timestamp.toISOString()}
    `.trim();
  }
  
  private generateDecision(change: ArchitecturalChange, patterns: any[]): string {
    const patternRefs = patterns.length > 0 
      ? `\n\n**Based on patterns:** ${patterns.map(p => p.title).join(', ')}`
      : '';
    
    return `
## Decision

${this.getDecisionTemplate(change.type)}

${patternRefs}

**Implementation Approach:**
${this.getImplementationApproach(change)}
    `.trim();
  }
  
  private getDecisionTemplate(type: string): string {
    const templates = {
      refactor: 'Refactor the identified code to improve maintainability and reduce technical debt.',
      new_module: 'Create a new module with clear boundaries and well-defined interfaces.',
      dependency_change: 'Update the dependency to the specified version with compatibility checks.',
      pattern_introduction: 'Adopt the specified architectural pattern for the identified use case.'
    };
    return templates[type as keyof typeof templates] || 'Apply the necessary changes.';
  }
  
  private getImplementationApproach(change: ArchitecturalChange): string {
    return `
1. Create feature branch
2. Implement changes incrementally
3. Run existing tests
4. Add new tests for changed behavior
5. Update documentation
6. Submit PR for review
    `.trim();
  }
  
  private generateConsequences(change: ArchitecturalChange, impact: ImpactAnalysis): Consequence[] {
    const consequences: Consequence[] = [];
    
    // Positive
    consequences.push({
      type: 'positive',
      description: `Improves ${this.getQualityAttribute(change.type)}`,
      impact: 'high'
    });
    
    // Negative (risk)
    if (impact.riskLevel === 'high' || impact.riskLevel === 'critical') {
      consequences.push({
        type: 'negative',
        description: 'Risk of introducing regressions during refactoring',
        impact: 'medium'
      });
    }
    
    // Neutral
    consequences.push({
      type: 'neutral',
      description: 'Requires test updates and documentation changes',
      impact: 'low'
    });
    
    return consequences;
  }
  
  private getQualityAttribute(type: string): string {
    const attrs = {
      refactor: 'maintainability',
      new_module: 'modularity',
      dependency_change: 'security/compatibility',
      pattern_introduction: 'architectural consistency'
    };
    return attrs[type as keyof typeof attrs] || 'quality';
  }
  
  private async createAnchors(change: ArchitecturalChange): Promise<SemanticAnchor[]> {
    const anchors: SemanticAnchor[] = [];
    
    for (const file of change.affectedFiles) {
      try {
        const content = await this.readFile(file);
        const lines = change.lineRanges[file] || { start: 1, end: 100 };
        const snippet = content.split('\n').slice(lines.start - 1, lines.end).join('\n');
        const embedding = await this.embedder.embed(snippet);
        
        anchors.push({
          adrId: '', // Will be filled after ADR creation
          codeLocation: { file, lines },
          embedding,
          relevance: await this.computeRelevance(change, snippet)
        });
      } catch (e) {
        console.warn(`Failed to create anchor for ${file}:`, e);
      }
    }
    
    return anchors;
  }
  
  private async computeRelevance(change: ArchitecturalChange, snippet: string): Promise<number> {
    const changeEmbedding = await this.embedder.embed(change.description);
    const snippetEmbedding = await this.embedder.embed(snippet);
    return cosineSimilarity(changeEmbedding, snippetEmbedding);
  }
  
  private assessRisk(change: ArchitecturalChange): 'low' | 'medium' | 'high' | 'critical' {
    if (change.impact === 'critical') return 'critical';
    if (change.affectedFiles.length > 10) return 'high';
    if (change.type === 'dependency_change') return 'medium';
    return 'low';
  }
  
  private estimateEffort(change: ArchitecturalChange): string {
    const baseHours = change.affectedFiles.length * 2;
    const multiplier = { low: 1, medium: 2, high: 3, critical: 5 }[change.impact];
    const hours = baseHours * multiplier;
    
    if (hours < 8) return `${hours} hours`;
    if (hours < 40) return `${Math.ceil(hours / 8)} days`;
    return `${Math.ceil(hours / 40)} weeks`;
  }
  
  private extractModule(file: string): string {
    const parts = file.split('/');
    return parts[parts.length - 2] || 'root';
  }
  
  private async extractDependencies(file: string): Promise<string[]> {
    // In production, parse actual imports
    return [];
  }
  
  private async readFile(file: string): Promise<string> {
    // In production, read from filesystem
    return '';
  }
}

export interface ImpactAnalysis {
  affectedModules: string[];
  dependencies: Map<string, string[]>;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  estimatedEffort: string;
}

export interface MemoryInterface {
  query(query: any): Promise<any[]>;
}

export interface Embedder {
  embed(text: string): Promise<number[]>;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}