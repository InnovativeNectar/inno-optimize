export * from './types.js';
export { SONAAdapter, createDefaultSONAConfig } from './sona/adapter.js';
export { ReasoningBank, createDefaultReasoningBankConfig } from './reasoningbank/pipeline.js';
export { MoERouter, createDefaultMoEConfig } from './moe/router.js';
export { EWCConsolidator, createDefaultEWCConfig } from './ewc/consolidator.js';
// Integrated Intelligence Layer
import { SONAAdapter, createDefaultSONAConfig } from './sona/adapter.js';
import { ReasoningBank, createDefaultReasoningBankConfig } from './reasoningbank/pipeline.js';
import { MoERouter, createDefaultMoEConfig } from './moe/router.js';
import { EWCConsolidator, createDefaultEWCConfig } from './ewc/consolidator.js';
export class IntelligenceLayer {
    sona;
    reasoningBank;
    moe;
    ewc;
    memory;
    constructor(memory, config) {
        this.memory = memory;
        const defaultConfig = {
            sona: createDefaultSONAConfig(),
            reasoningBank: createDefaultReasoningBankConfig(),
            moe: createDefaultMoEConfig(),
            ewc: createDefaultEWCConfig()
        };
        const finalConfig = { ...defaultConfig, ...config };
        this.sona = new SONAAdapter(finalConfig.sona, memory);
        this.reasoningBank = new ReasoningBank(finalConfig.reasoningBank, memory, {
            embed: async (text) => this.stringToVector(text, 384)
        });
        this.moe = new MoERouter(finalConfig.moe);
        this.ewc = new EWCConsolidator(finalConfig.ewc, memory);
        // Start EWC scheduler
        this.ewc.startConsolidationScheduler();
    }
    // Complete intelligence pipeline for a task
    async processTask(taskContext) {
        // 1. SONA instant adaptation
        const sonaAdaptation = await this.sona.adapt(taskContext);
        // 2. MoE routing for specialized handling
        const routing = await this.moe.route(taskContext);
        // 3. If we have a trajectory, process through ReasoningBank
        let pattern;
        if (taskContext.id) {
            const trajectory = await this.createTrajectory(taskContext, sonaAdaptation, routing);
            pattern = await this.reasoningBank.processTrajectory(trajectory);
            // 4. EWC++ consolidation (async, non-blocking)
            if (pattern) {
                this.ewc.consolidate(pattern).catch(console.error);
            }
        }
        return { sonaAdaptation, routing, pattern };
    }
    async createTrajectory(taskContext, sonaAdaptation, routing) {
        return {
            id: `traj-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            agentId: 'intelligence-layer',
            sessionId: 'current',
            task: taskContext,
            steps: [
                { action: 'sona_adaptation', result: `Adapted via ${sonaAdaptation.patternId}`, reward: 0.2, timestamp: new Date() },
                { action: 'moe_routing', result: `Routed to ${routing.expertId}`, reward: 0.2, timestamp: new Date() }
            ],
            outcome: {
                success: true,
                output: { sonaAdaptation, routing },
                metrics: { latencyMs: sonaAdaptation.extractionTimeMs, toolCalls: 0, memoryQueries: 1 }
            },
            reward: sonaAdaptation.confidence,
            mode: taskContext.mode,
            startedAt: new Date(),
            endedAt: new Date()
        };
    }
    // Batch process multiple trajectories
    async processTrajectories(trajectories) {
        const patterns = [];
        for (const trajectory of trajectories) {
            const pattern = await this.reasoningBank.processTrajectory(trajectory);
            patterns.push(pattern);
        }
        // Batch consolidate
        await this.ewc.consolidateBatch(patterns);
        return patterns;
    }
    // Cross-domain knowledge transfer
    async transferKnowledge(sourceDomain, targetDomain) {
        return this.ewc.transferKnowledge(sourceDomain, targetDomain);
    }
    // Get system statistics
    getStats() {
        return {
            sona: { patternCacheSize: 0 }, // Would expose from SONA
            reasoningBank: { config: 'configured' },
            moe: this.moe.getExpertStats(),
            ewc: this.ewc.getStats()
        };
    }
    stringToVector(text, dim) {
        const vector = new Float32Array(dim);
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
        }
        const seed = Math.abs(hash);
        for (let i = 0; i < dim; i++) {
            const x = Math.sin(seed + i) * 10000;
            vector[i] = x - Math.floor(x);
        }
        let norm = 0;
        for (let i = 0; i < dim; i++) {
            const val = vector[i] ?? 0;
            norm += val * val;
        }
        norm = Math.sqrt(norm);
        for (let i = 0; i < dim; i++) {
            vector[i] = (vector[i] ?? 0) / norm;
        }
        return Array.from(vector);
    }
}
export function createIntelligenceLayer(memory, config) {
    return new IntelligenceLayer(memory, config);
}
//# sourceMappingURL=index.js.map