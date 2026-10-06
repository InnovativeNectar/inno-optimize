import { ParseResult, ArchitectureScore } from './types.js';
export declare class ArchitectureScorer {
    private weights;
    private dimensionWeights;
    scoreProject(parseResults: ParseResult[], projectId: string): ArchitectureScore;
    private scoreFiles;
    private scoreFileMaintainability;
    private scoreFileScalability;
    private scoreFileSecurity;
    private scoreFilePerformance;
    private scoreMaintainability;
    private scoreScalability;
    private scoreSecurity;
    private scorePerformance;
    private computeOverall;
    private computeWeightedScore;
    private buildDependencyGraph;
    private detectCycles;
    private computeLayers;
    private resolveImport;
    private computeModuleCoupling;
    private computeMaxDependencyDepth;
    private detectCachingPatterns;
    private detectAuthCoverage;
    private detectInputValidation;
    private detectSecretsManagement;
    private detectCryptoUsage;
    private detectHotPaths;
    private detectAsyncPatterns;
    private detectMemoryPatterns;
    private detectDBQueryPatterns;
    private getFileContent;
    private hasSyncIO;
    private computeMaxCallDepth;
    private computeTrends;
    private generateRecommendations;
    private detectFileIssues;
}
//# sourceMappingURL=scorer.d.ts.map