"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SONAAdapter = void 0;
exports.createDefaultSONAConfig = createDefaultSONAConfig;
class SONAAdapter {
    config;
    memory;
    patternCache = new Map();
    modeWeights = new Map();
    constructor(config, memory) {
        this.config = config;
        this.memory = memory;
        this.initializeModes();
    }
    initializeModes() {
        for (const [mode, config] of Object.entries(this.config.modes)) {
            this.modeWeights.set(mode, config);
        }
    }
    async adapt(taskContext) {
        const startTime = performance.now();
        // 1. Retrieve similar patterns from memory
        const patterns = await this.retrievePatterns(taskContext);
        if (patterns.length === 0) {
            return this.createDefaultAdaptation(taskContext);
        }
        // 2. Select best matching pattern
        const bestPattern = patterns[0];
        // 3. Extract LoRA weights from pattern
        const loraWeights = await this.extractLoRA(bestPattern, taskContext);
        // 4. Apply mode-specific adaptation
        const adapted = this.applyModeAdaptation(loraWeights, taskContext.mode);
        // 5. Track trajectory
        if (this.config.trajectoryTracking) {
            await this.trackTrajectory(taskContext, adapted, patterns);
        }
        const extractionTime = performance.now() - startTime;
        return {
            adaptedWeights: adapted,
            confidence: bestPattern.reward,
            patternId: bestPattern.id,
            mode: taskContext.mode,
            extractionTimeMs: extractionTime
        };
    }
    async retrievePatterns(taskContext) {
        const queryVector = await this.embedTaskContext(taskContext);
        const results = await this.memory.search({
            vector: queryVector,
            k: 10,
            filter: {
                mode: taskContext.mode,
                consolidated: true
            },
            useCache: true
        });
        return results;
    }
    async embedTaskContext(context) {
        // In production, use actual embedder
        // This creates a deterministic embedding from task description
        const text = `${context.type}:${context.description}:${context.mode}`;
        return this.stringToVector(text, 384);
    }
    stringToVector(text, dim) {
        const vector = new Float32Array(dim);
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
        }
        // Use hash to seed pseudo-random but deterministic values
        const seed = Math.abs(hash);
        for (let i = 0; i < dim; i++) {
            const x = Math.sin(seed + i) * 10000;
            vector[i] = x - Math.floor(x);
        }
        // Normalize
        let norm = 0;
        for (let i = 0; i < dim; i++)
            norm += vector[i] * vector[i];
        norm = Math.sqrt(norm);
        for (let i = 0; i < dim; i++)
            vector[i] /= norm;
        return Array.from(vector);
    }
    async extractLoRA(pattern, taskContext) {
        // Check cache first
        const cacheKey = `${pattern.id}:${taskContext.mode}`;
        if (this.patternCache.has(cacheKey)) {
            return this.patternCache.get(cacheKey);
        }
        // In production, extract actual LoRA from pattern
        // Here we generate deterministic LoRA based on pattern
        const lora = this.generateLoRA(pattern, taskContext);
        this.patternCache.set(cacheKey, lora);
        return lora;
    }
    generateLoRA(pattern, taskContext) {
        const rank = this.config.loraRank;
        const alpha = this.config.loraAlpha;
        const inputDim = 384; // embedding dimension
        const outputDim = 384;
        // Generate deterministic weights based on pattern
        const seed = this.hashString(pattern.id + taskContext.mode);
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
                patternId: pattern.id,
                mode: taskContext.mode,
                timestamp: Date.now(),
                reward: pattern.reward
            }
        };
    }
    generateMatrix(rows, cols, seed) {
        const matrix = [];
        let hash = seed;
        for (let i = 0; i < rows; i++) {
            const row = [];
            for (let j = 0; j < cols; j++) {
                hash = ((hash * 1664525) + 1013904223) | 0;
                const val = (hash / 0xffffffff) * 2 - 1;
                row.push(val * 0.01); // Small initialization
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
            const val = (hash / 0xffffffff) * 0.5 + 0.75; // 0.75-1.25
            scales.push(val);
        }
        return scales;
    }
    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
        }
        return Math.abs(hash);
    }
    applyModeAdaptation(lora, mode) {
        const modeConfig = this.modeWeights.get(mode);
        if (!modeConfig)
            return lora;
        // Scale weights by mode weight
        const scale = modeConfig.weight;
        return {
            ...lora,
            weightsA: lora.weightsA.map(row => row.map(v => v * scale)),
            weightsB: lora.weightsB.map(row => row.map(v => v * scale)),
            scales: lora.scales.map(s => s * scale)
        };
    }
    createDefaultAdaptation(taskContext) {
        return {
            adaptedWeights: this.generateLoRA({ id: 'default', reward: 0.5 }, taskContext),
            confidence: 0.5,
            patternId: 'default',
            mode: taskContext.mode,
            extractionTimeMs: 0
        };
    }
    async trackTrajectory(taskContext, adaptation, patterns) {
        const trajectory = {
            id: `traj-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            agentId: 'sona-adapter',
            sessionId: 'current',
            task: taskContext,
            steps: [
                {
                    action: 'pattern_retrieval',
                    result: `Retrieved ${patterns.length} patterns`,
                    reward: 0.1,
                    timestamp: new Date()
                },
                {
                    action: 'lora_extraction',
                    result: `Extracted LoRA from ${adaptation.patternId}`,
                    reward: 0.2,
                    timestamp: new Date()
                },
                {
                    action: 'mode_adaptation',
                    result: `Applied ${adaptation.mode} mode`,
                    reward: 0.2,
                    timestamp: new Date()
                }
            ],
            outcome: {
                success: true,
                output: adaptation,
                metrics: { latencyMs: adaptation.extractionTimeMs, toolCalls: 0, memoryQueries: patterns.length }
            },
            reward: adaptation.confidence,
            mode: taskContext.mode,
            startedAt: new Date(Date.now() - adaptation.extractionTimeMs),
            endedAt: new Date()
        };
        // Store trajectory for ReasoningBank
        await this.memory.insert([{
                id: trajectory.id,
                type: 'episodic',
                tier: 2,
                content: JSON.stringify(trajectory),
                embedding: await this.embedTaskContext(taskContext),
                metadata: {
                    domain: 'intelligence',
                    taskType: 'sona-adaptation',
                    mode: taskContext.mode,
                    context: taskContext.description,
                    tags: ['trajectory', 'sona']
                },
                provenance: {
                    agentId: 'sona-adapter',
                    sessionId: 'current',
                    source: 'agent',
                    timestamp: new Date()
                },
                reward: adaptation.confidence,
                verdict: 'success',
                loraWeights: adaptation.adaptedWeights,
                consolidated: false,
                accessCount: 0,
                lastAccessed: new Date(),
                createdAt: new Date()
            }]);
    }
    // Apply LoRA to model (placeholder for actual model integration)
    applyLoRAToModel(baseWeights, lora) {
        const result = [];
        for (let i = 0; i < baseWeights.length; i++) {
            const row = [];
            for (let j = 0; j < baseWeights[i].length; j++) {
                let loraContribution = 0;
                // LoRA: B @ A @ x
                for (let r = 0; r < lora.rank; r++) {
                    if (i < lora.weightsB.length && r < lora.weightsB[i].length &&
                        r < lora.weightsA.length && j < lora.weightsA[r].length) {
                        loraContribution += lora.weightsB[i][r] * lora.weightsA[r][j] * lora.scales[i];
                    }
                }
                row.push(baseWeights[i][j] + (lora.alpha / lora.rank) * loraContribution);
            }
            result.push(row);
        }
        return result;
    }
    getConfig() {
        return { ...this.config };
    }
    updateConfig(updates) {
        this.config = { ...this.config, ...updates };
        this.initializeModes();
    }
}
exports.SONAAdapter = SONAAdapter;
function createDefaultSONAConfig() {
    return {
        learningRate: 0.01,
        adaptiveLR: true,
        maxPatterns: 10000,
        loraRank: 64,
        loraAlpha: 16,
        extractionTimeBudget: 0.05,
        modes: {
            convergent: { weight: 1.0, description: 'Focused, analytical', temperature: 0.3 },
            divergent: { weight: 1.2, description: 'Creative, exploratory', temperature: 0.9 },
            lateral: { weight: 1.1, description: 'Cross-domain connection', temperature: 0.7 },
            systems: { weight: 1.3, description: 'Holistic, architectural', temperature: 0.5 },
            critical: { weight: 0.9, description: 'Security, verification', temperature: 0.2 }
        },
        trajectoryTracking: true,
        verdictJudgment: true,
        distillationEnabled: true,
        ewcConsolidation: true
    };
}
//# sourceMappingURL=adapter.js.map