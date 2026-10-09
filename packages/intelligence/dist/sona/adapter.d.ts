import { SONAConfig, LoRAWeights, SONAAdaptation, TaskContext } from '../types.js';
import { FastStore } from '@inno-optimize/agentdb';
export declare class SONAAdapter {
    private config;
    private memory;
    private patternCache;
    private modeWeights;
    constructor(config: SONAConfig, memory: FastStore);
    private initializeModes;
    adapt(taskContext: TaskContext): Promise<SONAAdaptation>;
    private retrievePatterns;
    private embedTaskContext;
    private stringToVector;
    private extractLoRA;
    private generateLoRA;
    private generateMatrix;
    private generateScales;
    private hashString;
    private applyModeAdaptation;
    private createDefaultAdaptation;
    private trackTrajectory;
    applyLoRAToModel(baseWeights: number[][], lora: LoRAWeights): number[][];
    getConfig(): SONAConfig;
    updateConfig(updates: Partial<SONAConfig>): void;
}
export declare function createDefaultSONAConfig(): SONAConfig;
//# sourceMappingURL=adapter.d.ts.map