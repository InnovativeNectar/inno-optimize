"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntelligenceLayer = exports.createDefaultEWCConfig = exports.EWCConsolidator = exports.createDefaultMoEConfig = exports.MoERouter = exports.createDefaultReasoningBankConfig = exports.ReasoningBank = exports.createDefaultSONAConfig = exports.SONAAdapter = void 0;
exports.createIntelligenceLayer = createIntelligenceLayer;
__exportStar(require("./types"), exports);
var adapter_1 = require("./sona/adapter");
Object.defineProperty(exports, "SONAAdapter", { enumerable: true, get: function () { return adapter_1.SONAAdapter; } });
Object.defineProperty(exports, "createDefaultSONAConfig", { enumerable: true, get: function () { return adapter_1.createDefaultSONAConfig; } });
var pipeline_1 = require("./reasoningbank/pipeline");
Object.defineProperty(exports, "ReasoningBank", { enumerable: true, get: function () { return pipeline_1.ReasoningBank; } });
Object.defineProperty(exports, "createDefaultReasoningBankConfig", { enumerable: true, get: function () { return pipeline_1.createDefaultReasoningBankConfig; } });
var router_1 = require("./moe/router");
Object.defineProperty(exports, "MoERouter", { enumerable: true, get: function () { return router_1.MoERouter; } });
Object.defineProperty(exports, "createDefaultMoEConfig", { enumerable: true, get: function () { return router_1.createDefaultMoEConfig; } });
var consolidator_1 = require("./ewc/consolidator");
Object.defineProperty(exports, "EWCConsolidator", { enumerable: true, get: function () { return consolidator_1.EWCConsolidator; } });
Object.defineProperty(exports, "createDefaultEWCConfig", { enumerable: true, get: function () { return consolidator_1.createDefaultEWCConfig; } });
// Integrated Intelligence Layer
const adapter_2 = require("./sona/adapter");
const pipeline_2 = require("./reasoningbank/pipeline");
const router_2 = require("./moe/router");
const consolidator_2 = require("./ewc/consolidator");
class IntelligenceLayer {
    sona;
    reasoningBank;
    moe;
    ewc;
    memory;
    constructor(memory, config) {
        this.memory = memory;
        const defaultConfig = {
            sona: (0, adapter_2.createDefaultSONAConfig)(),
            reasoningBank: (0, pipeline_2.createDefaultReasoningBankConfig)(),
            moe: (0, router_2.createDefaultMoEConfig)(),
            ewc: (0, consolidator_2.createDefaultEWCConfig)()
        };
        const finalConfig = { ...defaultConfig, ...config };
        this.sona = new adapter_2.SONAAdapter(finalConfig.sona, memory);
        this.reasoningBank = new pipeline_2.ReasoningBank(finalConfig.reasoningBank, memory, {
            embed: async (text) => this.stringToVector(text, 384)
        });
        this.moe = new router_2.MoERouter(finalConfig.moe);
        this.ewc = new consolidator_2.EWCConsolidator(finalConfig.ewc, memory);
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
            this.ewc.consolidate(pattern).catch(console.error);
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
        for (let i = 0; i < dim; i++)
            norm += vector[i] * vector[i];
        norm = Math.sqrt(norm);
        for (let i = 0; i < dim; i++)
            vector[i] /= norm;
        return Array.from(vector);
    }
}
exports.IntelligenceLayer = IntelligenceLayer;
function createIntelligenceLayer(memory, config) {
    return new IntelligenceLayer(memory, config);
}
//# sourceMappingURL=index.js.map