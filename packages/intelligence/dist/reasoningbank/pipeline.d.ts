import { ReasoningBankConfig, ReasoningPattern, Trajectory, Verdict, RetrieveResult, DistillResult, ConsolidateResult } from '../types.js';
import { FastStore } from '@inno-optimize/agentdb';
export declare class ReasoningBank {
    private config;
    private memory;
    private embedder;
    constructor(config: ReasoningBankConfig, memory: FastStore, embedder: Embedder);
    processTrajectory(trajectory: Trajectory): Promise<ReasoningPattern>;
    retrieve(trajectory: Trajectory): Promise<RetrieveResult>;
    private memoryEntryToPattern;
    judge(trajectory: Trajectory, patterns: ReasoningPattern[]): Promise<Verdict>;
    private generateReasoning;
    distill(trajectory: Trajectory, verdict: Verdict, patterns: ReasoningPattern[]): Promise<DistillResult>;
    private extractSteps;
    private extractLoRAFromTrajectory;
    private generateTitle;
    private generateDescription;
    consolidate(pattern: ReasoningPattern): Promise<ConsolidateResult>;
    private patternToMemoryEntry;
    private computeFisherImportance;
    consolidateBatch(patterns: ReasoningPattern[]): Promise<ConsolidateResult[]>;
    transferKnowledge(sourceDomain: string, targetDomain: string): Promise<number>;
    private adaptPattern;
    private cosineSimilarity;
    private hashString;
    private generateMatrix;
    private generateScales;
}
export interface Embedder {
    embed(text: string): Promise<number[]>;
}
export declare function createDefaultReasoningBankConfig(): ReasoningBankConfig;
//# sourceMappingURL=pipeline.d.ts.map