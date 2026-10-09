import { ToolDescriptor } from '../server.js';
export interface TaskContext {
    id: string;
    type: string;
    description: string;
    codeContext?: string;
    constraints: string[];
    acceptanceCriteria: string[];
    mode: 'convergent' | 'divergent' | 'lateral' | 'systems' | 'critical';
}
export interface ToolRoute {
    selectedTool: ToolDescriptor;
    modelTier: 1 | 2 | 3;
    fallbackTools: ToolDescriptor[];
    reasoning: string;
}
export declare class CodemodRegistry {
    private codemods;
    register(pattern: CodemodPattern): void;
    get(id: string): CodemodPattern | undefined;
    findMatching(codeContext: string): CodemodPattern | null;
}
export interface CodemodPattern {
    id: string;
    name: string;
    description: string;
    pattern: RegExp | ((code: string) => boolean);
    transform: (code: string) => string;
    tier: 1;
    toolDescriptor: ToolDescriptor;
}
export declare class PatternMemory {
    private patterns;
    store(pattern: ReasoningPattern): void;
    get(id: string): ReasoningPattern | undefined;
    findSimilar(task: TaskContext, topK?: number): Promise<ReasoningPattern[]>;
    private computeSimilarity;
}
export interface ReasoningPattern {
    id: string;
    title: string;
    description: string;
    content: string;
    reward: number;
    mode: string;
    verdict: 'success' | 'failure';
    loraWeights: any;
    consolidated: boolean;
    createdAt: Date;
}
export declare class ToolRouter {
    private codemodRegistry;
    private patternMemory;
    constructor(codemodRegistry: CodemodRegistry, patternMemory: PatternMemory);
    route(task: TaskContext, availableTools: ToolDescriptor[]): Promise<ToolRoute>;
    private selectToolForPattern;
    private selectBestTool;
    private scoreToolForTask;
    private inferCapabilities;
    private getFallbacks;
}
export declare function createBuiltinCodemods(): CodemodPattern[];
//# sourceMappingURL=router.d.ts.map