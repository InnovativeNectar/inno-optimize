import type { PheromoneConfig, AgentPheromone, PheromoneMetrics, TaskOutcome, PheromoneUpdate } from '../types.js';
import type { FastStore } from '@inno-optimize/agentdb';

export class PheromoneScheduler {
  private config: PheromoneConfig;
  private pheromones = new Map<string, AgentPheromone>();
  private memory: FastStore;
  private updateQueue: PheromoneUpdate[] = [];
  private processing = false;
  
  constructor(config: PheromoneConfig, memory: FastStore) {
    this.config = config;
    this.memory = memory;
  }
  
  // Initialize pheromone for agent
  initialize(agentId: string, role: string): AgentPheromone {
    const pheromone: AgentPheromone = {
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
  async recordOutcome(agentId: string, outcome: TaskOutcome): Promise<void> {
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
      void this.processUpdates();
    }
  }
  
  private async processUpdates(): Promise<void> {
    this.processing = true;
    
    try {
      while (this.updateQueue.length > 0) {
        const update = this.updateQueue.shift()!;
        try {
          await this.applyUpdate(update);
        } catch (err) {
          console.error('Pheromone update failed:', err);
        }
      }
    } finally {
      this.processing = false;
    }
  }
  
  private async applyUpdate(update: PheromoneUpdate): Promise<void> {
    const pheromone = this.pheromones.get(update.agentId);
    if (!pheromone) return;
    
    const outcome = update.outcome;
    
    // Calculate combined score
    const taskSuccess = outcome.success ? 1 : 0;
    const latencyScore = Math.max(0, 1 - outcome.metrics.latencyMs / 60000);
    const toolEfficiency = Math.max(0, 1 - outcome.metrics.toolCalls / 20);
    const consensusScore = outcome.metrics.consensusScore ?? 0.5;
    
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
  
  private async recalculateEligibility(agentId: string): Promise<void> {
    const pheromone = this.pheromones.get(agentId);
    if (!pheromone) return;
    
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
    } else if (!wasEligible && pheromone.eligible) {
      pheromone.recoveryAttempts++;
    }
  }
  
  // Get eligible agents for task assignment
  getEligibleAgents(role?: string, excludeSuspended = true): string[] {
    const eligible: string[] = [];
    
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
  getRankedAgents(role?: string): Array<{ agentId: string; score: number }> {
    const ranked = Array.from(this.pheromones.entries())
      .filter(([_, p]) => !role || p.role === role)
      .filter(([_, p]) => p.eligible)
      .map(([id, p]) => ({ agentId: id, score: p.emaScore }))
      .sort((a, b) => b.score - a.score);
    
    return ranked;
  }
  
  // Get pheromone for specific agent
  getPheromone(agentId: string): AgentPheromone | undefined {
    return this.pheromones.get(agentId);
  }
  
  // Get all pheromones
  getAllPheromones(): Map<string, AgentPheromone> {
    return new Map(this.pheromones);
  }
  
  // Get metrics
  getMetrics(): PheromoneMetrics {
    const allScores = Array.from(this.pheromones.values()).map(p => p.emaScore);
    const eligible = Array.from(this.pheromones.values()).filter(p => p.eligible);
    const suspended = Array.from(this.pheromones.values()).filter(p => !p.eligible);
    
    const globalEMA = allScores.length > 0 
      ? allScores.reduce((a, b) => a + b, 0) / allScores.length 
      : 0.5;
    const threshold = globalEMA * this.config.thetaMultiplier;
    
    // Score distribution (buckets)
    const buckets = 10;
    const distribution = new Array<number>(buckets).fill(0);
    for (const score of allScores) {
      const bucket = Math.min(Math.floor(score * buckets), buckets - 1);
      distribution[bucket] = (distribution[bucket] ?? 0) + 1;
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
  async recoverAgent(agentId: string): Promise<boolean> {
    const pheromone = this.pheromones.get(agentId);
    if (!pheromone) return false;
    
    // Boost score slightly to encourage recovery
    pheromone.emaScore = Math.min(1, pheromone.emaScore + 0.1);
    await this.recalculateEligibility(agentId);
    await this.persistPheromone(agentId);
    
    return pheromone.eligible;
  }
  
  // Suspend agent manually
  async suspendAgent(agentId: string): Promise<boolean> {
    const pheromone = this.pheromones.get(agentId);
    if (!pheromone) return false;
    
    pheromone.eligible = false;
    pheromone.suspensionCount++;
    await this.persistPheromone(agentId);
    
    return true;
  }
  
  // Load persisted pheromones
  async loadPersisted(): Promise<void> {
    // In production, load from AgentDB
  }
  
  private async persistPheromone(agentId: string): Promise<void> {
    const pheromone = this.pheromones.get(agentId);
    if (!pheromone) return;
    
    // Persist to AgentDB
  }
  
  // Reset all pheromones (for testing or major reconfiguration)
  reset(): void {
    this.pheromones.clear();
  }
  
  // Get config
  getConfig(): PheromoneConfig {
    return { ...this.config };
  }
  
  // Update config
  updateConfig(updates: Partial<PheromoneConfig>): void {
    this.config = { ...this.config, ...updates };
  }
}

export function createDefaultPheromoneConfig(): PheromoneConfig {
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