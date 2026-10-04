export * from './types';
export { SONAAdapter, createDefaultSONAConfig } from './sona/adapter';
export { ReasoningBank, createDefaultReasoningBankConfig } from './reasoningbank/pipeline';
export { MoERouter, createDefaultMoEConfig } from './moe/router';
export { EWCConsolidator, createDefaultEWCConfig } from './ewc/consolidator';

// Integrated Intelligence Layer
import { SONAAdapter, createDefaultSONAConfig } from './sona/adapter';
import { ReasoningBank, createDefaultReasoningBankConfig } from './reasoningbank/pipeline';
import { MoERouter, createDefaultMoEConfig } from './moe/router';
import { EWCConsolidator, createDefaultEWCConfig } from './ewc/consolidator';
import { FastStore } from '@inno-optimize/agentdb';
import { Trajectory, TaskContext, ReasoningPattern } from './types';

export interface IntelligenceLayerConfig {
  sona: ReturnType<typeof createDefaultSONAConfig>;
  reasoningBank: ReturnType<typeof createDefaultReasoningBankConfig>;
  moe: ReturnType<typeof createDefaultMoEConfig>;
  ewc: ReturnType<typeof createDefaultEWCConfig>;
}

export class IntelligenceLayer {
  private sona: SONAAdapter;
  private reasoningBank: ReasoningBank;
  private moe: MoERouter;
  private ewc: EWCConsolidator;
  private memory: FastStore;
  
  constructor(memory: FastStore, config?: Partial<IntelligenceLayerConfig>) {
    this.memory = memory;
    
    const defaultConfig: IntelligenceLayerConfig = {
      sona: createDefaultSONAConfig(),
      reasoningBank: createDefaultReasoningBankConfig(),
      moe: createDefaultMoEConfig(),
      ewc: createDefaultEWCConfig()
    };
    
    const finalConfig = { ...defaultConfig, ...config };
    
    this.sona = new SONAAdapter(finalConfig.sona, memory);
    this.reasoningBank = new ReasoningBank(finalConfig.reasoningBank, memory, {
      embed: async (text: string) => this.stringToVector(text, 384)
    });
    this.moe = new MoERouter(finalConfig.moe);
    this.ewc = new EWCConsolidator(finalConfig.ewc, memory);
    
    // Start EWC scheduler
    this.ewc.startConsolidationScheduler();
  }
  
  // Complete intelligence pipeline for a task
  async processTask(taskContext: TaskContext): Promise<{
    sonaAdaptation: any;
    routing: any;
    pattern?: ReasoningPattern;
  }> {
    // 1. SONA instant adaptation
    const sonaAdaptation = await this.sona.adapt(taskContext);
    
    // 2. MoE routing for specialized handling
    const routing = await this.moe.route(taskContext);
    
    // 3. If we have a trajectory, process through ReasoningBank
    let pattern: ReasoningPattern | undefined;
    if (taskContext.id) {
      const trajectory = await this.createTrajectory(taskContext, sonaAdaptation, routing);
      pattern = await this.reasoningBank.processTrajectory(trajectory);
      
      // 4. EWC++ consolidation (async, non-blocking)
      this.ewc.consolidate(pattern).catch(console.error);
    }
    
    return { sonaAdaptation, routing, pattern };
  }
  
  private async createTrajectory(
    taskContext: TaskContext, 
    sonaAdaptation: any, 
    routing: any
  ): Promise<Trajectory> {
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
  async processTrajectories(trajectories: Trajectory[]): Promise<ReasoningPattern[]> {
    const patterns: ReasoningPattern[] = [];
    
    for (const trajectory of trajectories) {
      const pattern = await this.reasoningBank.processTrajectory(trajectory);
      patterns.push(pattern);
    }
    
    // Batch consolidate
    await this.ewc.consolidateBatch(patterns);
    
    return patterns;
  }
  
  // Cross-domain knowledge transfer
  async transferKnowledge(sourceDomain: string, targetDomain: string): Promise<number> {
    return this.ewc.transferKnowledge(sourceDomain, targetDomain);
  }
  
  // Get system statistics
  getStats(): {
    sona: any;
    reasoningBank: any;
    moe: any;
    ewc: any;
  } {
    return {
      sona: { patternCacheSize: 0 }, // Would expose from SONA
      reasoningBank: { config: 'configured' },
      moe: this.moe.getExpertStats(),
      ewc: this.ewc.getStats()
    };
  }
  
  private stringToVector(text: string, dim: number): number[] {
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
    for (let i = 0; i < dim; i++) norm += vector[i] * vector[i];
    norm = Math.sqrt(norm);
    for (let i = 0; i < dim; i++) vector[i] /= norm;
    
    return Array.from(vector);
  }
}

export function createIntelligenceLayer(
  memory: FastStore, 
  config?: Partial<IntelligenceLayerConfig>
): IntelligenceLayer {
  return new IntelligenceLayer(memory, config);
}