import { ParseResult, AntiPattern, Issue } from './types.js';
export declare class AntiPatternDetector {
    private patterns;
    detect(parseResult: ParseResult): Issue[];
    detectAll(parseResults: ParseResult[]): Map<string, Issue[]>;
    getPatterns(): AntiPattern[];
    addPattern(pattern: AntiPattern): void;
    private initializePatterns;
    private checkPattern;
    private checkThresholds;
    private createIssue;
    private createClassIssue;
    private createFunctionIssue;
    private createMethodIssue;
    private detectLayerViolation;
    private detectFeatureEnvy;
    private detectDataClumps;
    private detectDeadCode;
    private detectInappropriateIntimacy;
    private detectRefusedBequest;
    private detectSpeculativeGenerality;
    private detectTemporaryField;
    private detectSwitchStatements;
    private getContent;
}
//# sourceMappingURL=patterns.d.ts.map