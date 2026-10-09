import { ArchitecturalChange, ADR } from '@inno-optimize/agentdb';
export declare class ADRGenerator {
    private memory;
    private embedder;
    private adrCounter;
    constructor(memory: MemoryInterface, embedder: Embedder);
    generateFromChange(change: ArchitecturalChange): Promise<ADR>;
    private analyzeImpact;
    private generateTitle;
    private generateContext;
    private generateDecision;
    private getDecisionTemplate;
    private getImplementationApproach;
    private generateConsequences;
    private getQualityAttribute;
    private createAnchors;
    private computeRelevance;
    private assessRisk;
    private estimateEffort;
    private extractModule;
    private extractDependencies;
    private readFile;
}
export interface ImpactAnalysis {
    affectedModules: string[];
    dependencies: Map<string, string[]>;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    estimatedEffort: string;
}
export interface MemoryInterface {
    query(query: any): Promise<any[]>;
}
export interface Embedder {
    embed(text: string): Promise<number[]>;
}
//# sourceMappingURL=generator.d.ts.map