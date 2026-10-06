import { ParseResult, IncrementalChange, DeltaAnalysis, Issue, AntiPattern } from './types.js';
export declare class IncrementalAnalyzer {
    private parser;
    private scorer;
    private detector;
    private previousResults;
    private previousScore;
    constructor();
    analyzeChanges(changes: IncrementalChange[]): Promise<DeltaAnalysis>;
    fullAnalysis(files: Map<string, string>): Promise<{
        results: ParseResult[];
        score: number;
        issues: Issue[];
        patterns: AntiPattern[];
    }>;
    getPreviousResults(): ParseResult[];
    getPreviousScore(): number;
    clearCache(): void;
    private buildDependencyGraph;
    private findDependents;
    private resolveImport;
    private findNewIssues;
    private findResolvedIssues;
    private findNewPatterns;
}
export declare class FileWatcher {
    private analyzer;
    private watchers;
    private debounceTimers;
    constructor(analyzer: IncrementalAnalyzer);
    watch(directory: string, callback: (analysis: DeltaAnalysis) => void): void;
    unwatch(directory: string): void;
    private debounce;
}
export declare function computeDiff(oldContent: string, newContent: string): IncrementalChange;
//# sourceMappingURL=incremental.d.ts.map