export class CodemodRegistry {
    codemods = new Map();
    register(pattern) {
        this.codemods.set(pattern.id, pattern);
    }
    get(id) {
        return this.codemods.get(id);
    }
    findMatching(codeContext) {
        for (const pattern of this.codemods.values()) {
            const matched = typeof pattern.pattern === 'function'
                ? pattern.pattern(codeContext)
                : new RegExp(pattern.pattern.source, pattern.pattern.flags).test(codeContext);
            if (matched) {
                return pattern;
            }
        }
        return null;
    }
}
export class PatternMemory {
    patterns = new Map();
    store(pattern) {
        this.patterns.set(pattern.id, pattern);
    }
    get(id) {
        return this.patterns.get(id);
    }
    async findSimilar(task, topK = 5) {
        // In production, this would use HNSW search
        // For now, simple text matching
        const results = [];
        for (const pattern of this.patterns.values()) {
            const score = this.computeSimilarity(task, pattern);
            if (score > 0.5) {
                results.push({ pattern, score });
            }
        }
        results.sort((a, b) => b.score - a.score);
        return results.slice(0, topK).map(r => r.pattern);
    }
    computeSimilarity(task, pattern) {
        // Simple text similarity
        const taskWords = new Set(task.description.toLowerCase().split(/\s+/));
        const patternWords = new Set(pattern.description.toLowerCase().split(/\s+/));
        let intersection = 0;
        for (const w of taskWords) {
            if (patternWords.has(w))
                intersection++;
        }
        return intersection / Math.max(taskWords.size, patternWords.size);
    }
}
export class ToolRouter {
    codemodRegistry;
    patternMemory;
    constructor(codemodRegistry, patternMemory) {
        this.codemodRegistry = codemodRegistry;
        this.patternMemory = patternMemory;
    }
    async route(task, availableTools) {
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
        const topPattern = patterns[0];
        if (topPattern && topPattern.reward > 0.85) {
            const tool = this.selectToolForPattern(topPattern, availableTools);
            if (tool) {
                return {
                    selectedTool: tool,
                    modelTier: 2,
                    fallbackTools: this.getFallbacks(tool, availableTools),
                    reasoning: `High-confidence pattern match: ${topPattern.title} (reward: ${topPattern.reward})`
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
    selectToolForPattern(pattern, availableTools) {
        // Match pattern to tool by capabilities
        const requiredCaps = this.inferCapabilities(pattern);
        for (const tool of availableTools) {
            if (requiredCaps.every(c => tool.capabilities.includes(c))) {
                return tool;
            }
        }
        return availableTools[0] || null;
    }
    selectBestTool(task, availableTools) {
        // Score tools by relevance
        const scored = availableTools.map(tool => ({
            tool,
            score: this.scoreToolForTask(tool, task)
        }));
        scored.sort((a, b) => b.score - a.score);
        const best = scored[0]?.tool ?? availableTools[0];
        if (!best)
            throw new Error('No tools available for task');
        return best;
    }
    scoreToolForTask(tool, task) {
        let score = 0;
        // Match by description keywords
        const taskWords = task.description.toLowerCase().split(/\s+/);
        const toolWords = tool.description.toLowerCase().split(/\s+/);
        for (const w of taskWords) {
            if (toolWords.includes(w))
                score += 1;
        }
        // Prefer lower tier (cheaper/faster)
        score += (4 - tool.tier) * 0.5;
        // Prefer non-destructive
        if (!tool.destructive)
            score += 1;
        return score;
    }
    inferCapabilities(pattern) {
        const caps = [];
        const content = pattern.content.toLowerCase();
        if (content.includes('refactor') || content.includes('rewrite'))
            caps.push('write');
        if (content.includes('analyze') || content.includes('review'))
            caps.push('read');
        if (content.includes('test'))
            caps.push('execute');
        if (content.includes('deploy'))
            caps.push('deploy');
        return caps.length > 0 ? caps : ['read'];
    }
    getFallbacks(primary, available) {
        return available
            .filter(t => t.id !== primary.id)
            .slice(0, 3);
    }
}
// Pre-built codemod patterns
export function createBuiltinCodemods() {
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
            transform: (code) => code.replace(/\/\/\s*(TODO|FIXME):\s*(.+)$/gm, '// $1: [AUTO-TICKET] $2'),
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
//# sourceMappingURL=router.js.map