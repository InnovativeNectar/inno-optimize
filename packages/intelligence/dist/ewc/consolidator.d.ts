import { EWCConfig, FisherInfo, ConsolidationTask, ReasoningPattern } from '../types.js';
import { FastStore } from '@inno-optimize/agentdb';
import { MemoryEntry } from '@inno-optimize/agentdb';
export declare class EWCConsolidator {
    private config;
    private memory;
    private fisherMatrix;
    private consolidationQueue;
    private isProcessing;
    constructor(config: EWCConfig, memory: FastStore);
    private memoryEntryToPattern;
    consolidate(pattern: ReasoningPattern | MemoryEntry): Promise<void>;
    private patternToMemoryEntry;
    private computeFisherDiagonal;
    private computeGradients;
    private flattenLoRA;
    private registerPenalty;
    computeEWCLoss(currentParams: Map<string, number[]>): number;
    onlineUpdate(pattern: ReasoningPattern, newGradients: number[]): Promise<void>;
    consolidateBatch(patterns: ReasoningPattern[]): Promise<void>;
    startConsolidationScheduler(): void;
    private processQueue;
    queueTask(task: ConsolidationTask): void;
    transferKnowledge(sourceDomain: string, targetDomain: string): Promise<number>;
    private adaptPattern;
    private embedDomain;
    private stringToVector;
    getStats(): {
        totalPatterns: number;
        consolidatedPatterns: number;
        totalParameters: number;
        averageFisherNorm: number;
        queueLength: number;
    };
    getFisherInfo(paramKey: string): FisherInfo | undefined;
    isProtected(patternId: string): boolean;
}
export declare function createDefaultEWCConfig(): EWCConfig;
//# sourceMappingURL=consolidator.d.ts.map