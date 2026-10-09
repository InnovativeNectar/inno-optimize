import { ADR, ArchitecturalChange, SemanticAnchor } from '@inno-optimize/agentdb';
export interface ADRTrackerConfig {
    storagePath: string;
    autoGenerate: boolean;
    ciIntegration: boolean;
    requiredForMerge: boolean;
}
export declare class ADRTracker {
    private adrs;
    private config;
    constructor(config: ADRTrackerConfig);
    initialize(): Promise<void>;
    createADR(adr: Omit<ADR, 'id' | 'createdAt' | 'updatedAt'>): ADR;
    updateADR(id: string, updates: Partial<ADR>): ADR | null;
    updateStatus(id: string, status: ADR['status']): ADR | null;
    getADR(id: string): ADR | undefined;
    listADRs(filter?: {
        status?: ADR['status'];
        author?: string;
    }): ADR[];
    getProposedADRs(): ADR[];
    getAcceptedADRs(): ADR[];
    supersedeADR(oldId: string, newADR: Omit<ADR, 'id' | 'createdAt' | 'updatedAt'>): ADR;
    linkADRs(fromId: string, toId: string, relation: 'supersedes' | 'related' | 'depends-on'): void;
    private generateId;
    persist(): Promise<void>;
}
export declare class CIIntegration {
    private tracker;
    private generator;
    constructor(tracker: ADRTracker, generator: ADRGenerator);
    checkPR(pr: PullRequest): Promise<CICheckResult>;
    generateADRsForPR(pr: PullRequest): Promise<ADR[]>;
    private analyzePRChanges;
    private filterArchitecturalChanges;
    private hasADRForChange;
    private generateADRSuggestion;
}
export interface PullRequest {
    id: string;
    title: string;
    description: string;
    files: PRFile[];
    author: string;
    baseBranch: string;
    headBranch: string;
}
export interface PRFile {
    filename: string;
    status: 'added' | 'modified' | 'deleted' | 'renamed';
    additions: number;
    deletions: number;
    patch?: string;
}
export interface CICheckResult {
    passed: boolean;
    message: string;
    missingADRs?: Array<{
        file: string;
        suggestion: string;
    }>;
}
export declare class SemanticAnchors {
    private embedder;
    constructor(embedder: Embedder);
    createAnchors(adr: ADR, changes: ArchitecturalChange[]): Promise<SemanticAnchor[]>;
    searchByCode(query: string, topK?: number): Promise<Array<{
        adr: ADR;
        anchor: SemanticAnchor;
        score: number;
    }>>;
    findRelatedADRs(codeLocation: string): Promise<ADR[]>;
    private computeRelevance;
    private readFile;
}
interface Embedder {
    embed(text: string): Promise<number[]>;
}
declare class ADRGenerator {
    generateFromChange(change: ArchitecturalChange): Promise<ADR>;
}
export {};
//# sourceMappingURL=tracker.d.ts.map