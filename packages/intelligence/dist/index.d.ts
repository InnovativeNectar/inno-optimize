export * from './types.js';
export { SONAAdapter, createDefaultSONAConfig } from './sona/adapter.js';
export { ReasoningBank, createDefaultReasoningBankConfig } from './reasoningbank/pipeline.js';
export { MoERouter, createDefaultMoEConfig } from './moe/router.js';
export { EWCConsolidator, createDefaultEWCConfig } from './ewc/consolidator.js';
import { createDefaultSONAConfig } from './sona/adapter.js';
import { createDefaultReasoningBankConfig } from './reasoningbank/pipeline.js';
import { createDefaultMoEConfig } from './moe/router.js';
import { createDefaultEWCConfig } from './ewc/consolidator.js';
import { FastStore } from '@inno-optimize/agentdb';
import { Trajectory, TaskContext, ReasoningPattern } from './types.js';
export interface IntelligenceLayerConfig {
    sona: ReturnType<typeof createDefaultSONAConfig>;
    reasoningBank: ReturnType<typeof createDefaultReasoningBankConfig>;
    moe: ReturnType<typeof createDefaultMoEConfig>;
    ewc: ReturnType<typeof createDefaultEWCConfig>;
}
export declare class IntelligenceLayer {
    private sona;
    private reasoningBank;
    private moe;
    private ewc;
    private memory;
    constructor(memory: FastStore, config?: Partial<IntelligenceLayerConfig>);
    processTask(taskContext: TaskContext): Promise<{
        sonaAdaptation: any;
        routing: any;
        pattern: ReasoningPattern | undefined;
    }>;
    private createTrajectory;
    processTrajectories(trajectories: Trajectory[]): Promise<ReasoningPattern[]>;
    transferKnowledge(sourceDomain: string, targetDomain: string): Promise<number>;
    getStats(): {
        sona: any;
        reasoningBank: any;
        moe: any;
        ewc: any;
    };
    private stringToVector;
}
export declare function createIntelligenceLayer(memory: FastStore, config?: Partial<IntelligenceLayerConfig>): IntelligenceLayer;
//# sourceMappingURL=index.d.ts.map