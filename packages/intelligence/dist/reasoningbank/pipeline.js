export class ReasoningBank {
    config;
    memory;
    embedder;
    constructor(config, memory, embedder) {
        this.config = config;
        this.memory = memory;
        this.embedder = embedder;
    }
    // Main pipeline: RETRIEVE → JUDGE → DISTILL → CONSOLIDATE
    async processTrajectory(trajectory) {
        // STAGE 1: RETRIEVE (<4ms)
        const retrieved = await this.retrieve(trajectory);
        // STAGE 2: JUDGE (<10ms)
        const verdict = await this.judge(trajectory, retrieved.patterns);
        // STAGE 3: DISTILL (<100ms)
        const distilled = await this.distill(trajectory, verdict, retrieved.patterns);
        // STAGE 4: CONSOLIDATE (<500ms)
        await this.consolidate(distilled.pattern);
        return distilled.pattern;
    }
    // STAGE 1: RETRIEVE - HNSW search for similar patterns
    async retrieve(trajectory) {
        const queryVector = await this.embedder.embed(trajectory.task.description);
        const results = await this.memory.search({
            vector: queryVector,
            k: this.config.retrieveK,
            filter: {
                type: 'semantic',
                consolidated: true
            },
            rerank: this.config.rerankEnabled
        });
        const patterns = results.map(r => this.memoryEntryToPattern(r));
        return {
            patterns,
            scores: results.map(r => r.reward),
            queryEmbedding: queryVector
        };
    }
    memoryEntryToPattern(entry) {
        return {
            id: entry.id,
            title: entry.metadata?.domain || 'Unknown',
            description: entry.content,
            content: entry.content,
            reward: entry.reward ?? 0,
            mode: entry.metadata?.mode || 'systems',
            verdict: entry.verdict ?? 'success',
            loraWeights: entry.loraWeights ?? { rank: 0, alpha: 0, weightsA: [], weightsB: [], scales: [], metadata: { patternId: '', mode: '', timestamp: 0, reward: 0 } },
            consolidated: entry.consolidated ?? false,
            createdAt: entry.createdAt,
            ewcImportance: entry.ewcImportance,
            metadata: entry.metadata
        };
    }
    // STAGE 2: JUDGE - Assign verdict to trajectory
    async judge(trajectory, patterns) {
        // Compute similarity to retrieved patterns
        let maxSimilarity = 0;
        for (const pattern of patterns) {
            const similarity = this.cosineSimilarity(trajectory.task.description, // Would use embeddings in production
            pattern.description);
            maxSimilarity = Math.max(maxSimilarity, similarity);
        }
        // Determine success based on reward and similarity
        const reward = trajectory.reward;
        const success = reward >= this.config.judgeThreshold;
        // Generate reasoning
        const reasoning = this.generateReasoning(trajectory, patterns, maxSimilarity, success);
        return {
            success,
            reward,
            similarity: maxSimilarity,
            reasoning
        };
    }
    generateReasoning(trajectory, patterns, similarity, success) {
        if (patterns.length === 0) {
            return success
                ? 'No similar patterns found. Novel approach succeeded.'
                : 'No similar patterns found. Novel approach failed.';
        }
        const topPattern = patterns[0];
        if (!topPattern) {
            return success
                ? 'No similar patterns found. Novel approach succeeded.'
                : 'No similar patterns found. Novel approach failed.';
        }
        return success
            ? `Similar to "${topPattern.title}" (similarity: ${similarity.toFixed(2)}). Applied learned pattern successfully.`
            : `Similar to "${topPattern.title}" (similarity: ${similarity.toFixed(2)}). Pattern application failed - may need adaptation.`;
    }
    // STAGE 3: DISTILL - Extract structured pattern from trajectory
    async distill(trajectory, verdict, patterns) {
        const startTime = performance.now();
        // Extract structured steps from trajectory
        const steps = this.extractSteps(trajectory);
        // Generate pattern content
        const content = JSON.stringify({
            steps,
            context: trajectory.task.description,
            constraints: trajectory.task.constraints,
            mode: trajectory.mode
        });
        // Extract LoRA weights from trajectory
        const loraWeights = await this.extractLoRAFromTrajectory(trajectory);
        // Generate title and description
        const title = this.generateTitle(trajectory);
        const description = this.generateDescription(trajectory, steps);
        const pattern = {
            id: `pattern-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            title,
            description,
            content,
            reward: verdict.reward,
            mode: trajectory.mode,
            verdict: verdict.success ? 'success' : 'failure',
            loraWeights,
            consolidated: false,
            createdAt: new Date()
        };
        const extractionTime = performance.now() - startTime;
        return { pattern, extractionTimeMs: extractionTime };
    }
    extractSteps(trajectory) {
        return trajectory.steps.map(step => ({
            action: step.action,
            result: step.result,
            reward: step.reward
        }));
    }
    async extractLoRAFromTrajectory(trajectory) {
        // In production, this would extract actual LoRA from model deltas
        // For now, generate deterministic LoRA based on trajectory
        const seed = this.hashString(trajectory.id);
        const rank = 64;
        const alpha = 16;
        const inputDim = 384;
        const outputDim = 384;
        const weightsA = this.generateMatrix(rank, inputDim, seed);
        const weightsB = this.generateMatrix(outputDim, rank, seed + 1000);
        const scales = this.generateScales(outputDim, seed + 2000);
        return {
            rank,
            alpha,
            weightsA,
            weightsB,
            scales,
            metadata: {
                patternId: trajectory.id,
                mode: trajectory.mode,
                timestamp: Date.now(),
                reward: trajectory.reward
            }
        };
    }
    generateTitle(trajectory) {
        const actionWords = trajectory.steps.map(s => s.action.split('_')[0]);
        const uniqueActions = [...new Set(actionWords)];
        return `${uniqueActions.join(' + ')} Strategy`;
    }
    generateDescription(trajectory, steps) {
        return `When ${trajectory.task.description.toLowerCase()}, ` +
            `follow these steps: ${steps.map(s => s.action).join(' → ')}. ` +
            `Mode: ${trajectory.mode}. Expected reward: ${trajectory.reward.toFixed(2)}.`;
    }
    // STAGE 4: CONSOLIDATE - Integrate pattern with EWC++
    async consolidate(pattern) {
        // Compute Fisher Information for EWC++
        const importance = await this.computeFisherImportance(pattern);
        const consolidatedAt = new Date();
        // Store in memory with EWC++ metadata (upsert: distill creates the pattern
        // object but may not have persisted it yet)
        const existing = await this.memory.getById(pattern.id);
        if (existing) {
            await this.memory.update(pattern.id, {
                ewcImportance: importance,
                consolidated: true,
                consolidatedAt
            });
        }
        else {
            await this.memory.insert([await this.patternToMemoryEntry(pattern, importance)]);
        }
        pattern.consolidated = true;
        pattern.ewcImportance = importance;
        return {
            patternId: pattern.id,
            ewcImportance: importance,
            consolidatedAt
        };
    }
    async patternToMemoryEntry(pattern, importance) {
        const embedding = await this.embedder.embed(pattern.content);
        return {
            id: pattern.id,
            type: 'semantic',
            tier: 3,
            content: pattern.content,
            embedding,
            metadata: {
                domain: pattern.metadata?.domain ?? 'general',
                taskType: 'reasoning-pattern',
                mode: pattern.mode,
                context: pattern.description,
                tags: ['reasoning-bank', pattern.verdict]
            },
            provenance: {
                agentId: 'reasoning-bank',
                sessionId: 'reasoning-bank',
                source: 'distillation',
                timestamp: new Date()
            },
            reward: pattern.reward,
            verdict: pattern.verdict,
            loraWeights: pattern.loraWeights,
            ewcImportance: importance,
            consolidated: true,
            consolidatedAt: new Date(),
            accessCount: 0,
            lastAccessed: new Date(),
            createdAt: pattern.createdAt
        };
    }
    async computeFisherImportance(pattern) {
        // Fisher Information diagonal approximation
        // Based on gradient of loss w.r.t parameters
        const lora = pattern.loraWeights;
        const paramCount = lora.weightsA.length * (lora.weightsA[0]?.length ?? 0) +
            lora.weightsB.length * (lora.weightsB[0]?.length ?? 0);
        const importance = new Array(paramCount).fill(0);
        // In production, compute actual gradients
        // Here we approximate based on pattern reward and usage
        const baseImportance = pattern.reward * 0.5 + 0.5;
        for (let i = 0; i < importance.length; i++) {
            // Add noise for parameter-specific importance
            const noise = Math.sin(pattern.id.length + i) * 0.1;
            importance[i] = Math.max(0, baseImportance + noise);
        }
        return importance;
    }
    // Batch consolidation for multiple patterns
    async consolidateBatch(patterns) {
        const results = [];
        for (const pattern of patterns) {
            const result = await this.consolidate(pattern);
            results.push(result);
        }
        return results;
    }
    // Cross-domain knowledge transfer
    async transferKnowledge(sourceDomain, targetDomain) {
        const sourcePatterns = await this.memory.search({
            vector: await this.embedder.embed(sourceDomain),
            k: 50,
            filter: { domain: sourceDomain, consolidated: true }
        });
        let transferred = 0;
        for (const entry of sourcePatterns) {
            const pattern = this.memoryEntryToPattern(entry);
            const adapted = await this.adaptPattern(pattern, targetDomain);
            await this.memory.insert([adapted]);
            transferred++;
        }
        return transferred;
    }
    async adaptPattern(pattern, targetDomain) {
        // Adapt pattern to target domain
        return {
            ...pattern,
            id: `transfer-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            metadata: {
                ...pattern.metadata,
                domain: targetDomain,
                transferredFrom: pattern.metadata?.domain,
                transferredAt: new Date()
            },
            consolidated: false
        };
    }
    // Utility methods
    cosineSimilarity(a, b) {
        // Simple text similarity
        const wordsA = new Set(a.toLowerCase().split(/\s+/));
        const wordsB = new Set(b.toLowerCase().split(/\s+/));
        let intersection = 0;
        for (const w of wordsA) {
            if (wordsB.has(w))
                intersection++;
        }
        return intersection / Math.max(wordsA.size, wordsB.size);
    }
    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
        }
        return Math.abs(hash);
    }
    generateMatrix(rows, cols, seed) {
        const matrix = [];
        let hash = seed;
        for (let i = 0; i < rows; i++) {
            const row = [];
            for (let j = 0; j < cols; j++) {
                hash = ((hash * 1664525) + 1013904223) | 0;
                row.push(((hash / 0xffffffff) * 2 - 1) * 0.01);
            }
            matrix.push(row);
        }
        return matrix;
    }
    generateScales(dim, seed) {
        const scales = [];
        let hash = seed;
        for (let i = 0; i < dim; i++) {
            hash = ((hash * 1664525) + 1013904223) | 0;
            scales.push((hash / 0xffffffff) * 0.5 + 0.75);
        }
        return scales;
    }
}
export function createDefaultReasoningBankConfig() {
    return {
        retrieveK: 10,
        judgeThreshold: 0.7,
        distillTimeout: 100,
        consolidateInterval: 3600000,
        rerankEnabled: true,
        hybridSearch: true
    };
}
//# sourceMappingURL=pipeline.js.map