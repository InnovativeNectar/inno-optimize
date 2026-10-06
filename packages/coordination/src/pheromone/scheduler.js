"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PheromoneScheduler = void 0;
exports.createDefaultPheromoneConfig = createDefaultPheromoneConfig;
class PheromoneScheduler {
    config;
    pheromones = new Map();
    memory;
    updateQueue = [];
    processing = false;
    constructor(config, memory) {
        this.config = config;
        this.memory = memory;
    }
    // Initialize pheromone for agent
    initialize(agentId, role) {
        const pheromone = {
            agentId,
            role,
            emaScore: 0.5,
            sampleCount: 0,
            eligible: true,
            lastUpdated: new Date(),
            suspensionCount: 0,
            recoveryAttempts: 0
        };
        this.pheromones.set(agentId, pheromone);
        return pheromone;
    }
    // Record task outcome and update pheromone
    async recordOutcome(agentId, outcome) {
        let pheromone = this.pheromones.get(agentId);
        if (!pheromone) {
            pheromone = this.initialize(agentId, 'worker');
        }
        // Queue update for batch processing
        this.updateQueue.push({
            agentId,
            outcome,
            timestamp: Date.now()
        });
        if (!this.processing) {
            this.processUpdates();
        }
    }
    async processUpdates() {
        this.processing = true;
        while (this.updateQueue.length > 0) {
            const update = this.updateQueue.shift();
            await this.applyUpdate(update);
        }
        this.processing = false;
    }
    async applyUpdate(update) {
        const pheromone = this.pheromones.get(update.agentId);
        if (!pheromone)
            return;
        const outcome = update.outcome;
        // Calculate combined score
        const taskSuccess = outcome.success ? 1 : 0;
        const latencyScore = Math.max(0, 1 - outcome.metrics.latencyMs / 60000);
        const toolEfficiency = Math.max(0, 1 - outcome.metrics.toolCalls / 20);
        const consensusScore = outcome.metrics.consensusScore || 0.5;
        const combinedScore = (taskSuccess * 0.4) + (latencyScore * 0.2) + (toolEfficiency * 0.2) + (consensusScore * 0.2);
        // Update EMA
        const alpha = this.config.alpha;
        pheromone.emaScore = alpha * combinedScore + (1 - alpha) * pheromone.emaScore;
        pheromone.sampleCount++;
        pheromone.lastUpdated = new Date();
        // Recalculate eligibility
        await this.recalculateEligibility(update.agentId);
        // Persist
        await this.persistPheromone(update.agentId);
    }
    async recalculateEligibility(agentId) {
        const pheromone = this.pheromones.get(agentId);
        if (!pheromone)
            return;
        // Protected roles never suspended
        if (this.config.protectedRoles.includes(pheromone.role)) {
            pheromone.eligible = true;
            return;
        }
        // Warmup period
        if (pheromone.sampleCount < this.config.warmupSamples) {
            pheromone.eligible = true;
            return;
        }
        // Calculate global EMA
        const allScores = Array.from(this.pheromones.values())
            .filter(p => p.sampleCount >= this.config.warmupSamples)
            .map(p => p.emaScore);
        if (allScores.length === 0) {
            pheromone.eligible = true;
            return;
        }
        const globalEMA = allScores.reduce((a, b) => a + b, 0) / allScores.length;
        const threshold = globalEMA * this.config.thetaMultiplier;
        const wasEligible = pheromone.eligible;
        pheromone.eligible = pheromone.emaScore >= threshold;
        if (wasEligible && !pheromone.eligible) {
            pheromone.suspensionCount++;
        }
        else if (!wasEligible && pheromone.eligible) {
            pheromone.recoveryAttempts++;
        }
    }
    // Get eligible agents for task assignment
    getEligibleAgents(role, excludeSuspended = true) {
        const eligible = [];
        for (const [agentId, pheromone] of this.pheromones) {
            if (pheromone.eligible && (!role || pheromone.role === role)) {
                if (excludeSuspended && pheromone.suspensionCount > 0 && pheromone.recoveryAttempts === 0) {
                    continue; // Skip suspended agents that haven't recovered
                }
                eligible.push(agentId);
            }
        }
        return eligible;
    }
    // Get agents sorted by pheromone score (best first)
    getRankedAgents(role) {
        const ranked = Array.from(this.pheromones.entries())
            .filter(([_, p]) => !role || p.role === role)
            .filter(([_, p]) => p.eligible)
            .map(([id, p]) => ({ agentId: id, score: p.emaScore }))
            .sort((a, b) => b.score - a.score);
        return ranked;
    }
    // Get pheromone for specific agent
    getPheromone(agentId) {
        return this.pheromones.get(agentId);
    }
    // Get all pheromones
    getAllPheromones() {
        return new Map(this.pheromones);
    }
    // Get metrics
    getMetrics() {
        const allScores = Array.from(this.pheromones.values()).map(p => p.emaScore);
        const eligible = Array.from(this.pheromones.values()).filter(p => p.eligible);
        const suspended = Array.from(this.pheromones.values()).filter(p => !p.eligible);
        const globalEMA = allScores.length > 0
            ? allScores.reduce((a, b) => a + b, 0) / allScores.length
            : 0.5;
        const threshold = globalEMA * this.config.thetaMultiplier;
        // Score distribution (buckets)
        const buckets = 10;
        const distribution = new Array(buckets).fill(0);
        for (const score of allScores) {
            const bucket = Math.min(Math.floor(score * buckets), buckets - 1);
            distribution[bucket]++;
        }
        return {
            globalEMA,
            threshold,
            eligibleCount: eligible.length,
            suspendedCount: suspended.length,
            avgScore: globalEMA,
            scoreDistribution: distribution
        };
    }
    // Recovery: manually make agent eligible again
    async recoverAgent(agentId) {
        const pheromone = this.pheromones.get(agentId);
        if (!pheromone)
            return false;
        // Boost score slightly to encourage recovery
        pheromone.emaScore = Math.min(1, pheromone.emaScore + 0.1);
        await this.recalculateEligibility(agentId);
        await this.persistPheromone(agentId);
        return pheromone.eligible;
    }
    // Suspend agent manually
    async suspendAgent(agentId) {
        const pheromone = this.pheromones.get(agentId);
        if (!pheromone)
            return false;
        pheromone.eligible = false;
        pheromone.suspensionCount++;
        await this.persistPheromone(agentId);
        return true;
    }
    // Load persisted pheromones
    async loadPersisted() {
        // In production, load from AgentDB
    }
    async persistPheromone(agentId) {
        const pheromone = this.pheromones.get(agentId);
        if (!pheromone)
            return;
        // Persist to AgentDB
    }
    // Reset all pheromones (for testing or major reconfiguration)
    reset() {
        this.pheromones.clear();
    }
    // Get config
    getConfig() {
        return { ...this.config };
    }
    // Update config
    updateConfig(updates) {
        this.config = { ...this.config, ...updates };
    }
}
exports.PheromoneScheduler = PheromoneScheduler;
function createDefaultPheromoneConfig() {
    return {
        alpha: 0.3,
        thetaMultiplier: 0.6,
        warmupSamples: 3,
        protectedRoles: ['coordinator', 'queen', 'security'],
        minActiveAgents: 3,
        recoveryRate: 0.1,
        explorationRate: 0.05
    };
}
//# sourceMappingURL=scheduler.js.map