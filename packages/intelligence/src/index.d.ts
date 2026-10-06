export * from './types';
export { SONAAdapter, createDefaultSONAConfig } from './sona/adapter';
export { ReasoningBank, createDefaultReasoningBankConfig } from './reasoningbank/pipeline';
export { MoERouter, createDefaultMoEConfig } from './moe/router';
export { EWCConsolidator, createDefaultEWCConfig } from './ewc/consolidator';
import { createDefaultSONAConfig } from './sona/adapter';
import { createDefaultReasoningBankConfig } from './reasoningbank/pipeline';
import { createDefaultMoEConfig } from './moe/router';
import { createDefaultEWCConfig } from './ewc/consolidator';
import { FastStore } from '@inno-optimize/agentdb';
import { Trajectory, TaskContext, ReasoningPattern } from './types';
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
        pattern?: ReasoningPattern;
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