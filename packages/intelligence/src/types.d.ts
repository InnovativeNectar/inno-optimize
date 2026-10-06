export interface SONAConfig {
    learningRate: number;
    adaptiveLR: boolean;
    maxPatterns: number;
    loraRank: number;
    loraAlpha: number;
    extractionTimeBudget: number;
    modes: {
        convergent: ModeConfig;
        divergent: ModeConfig;
        lateral: ModeConfig;
        systems: ModeConfig;
        critical: ModeConfig;
    };
    trajectoryTracking: boolean;
    verdictJudgment: boolean;
    distillationEnabled: boolean;
    ewcConsolidation: boolean;
}
export interface ModeConfig {
    weight: number;
    description: string;
    temperature?: number;
    topP?: number;
}
export interface LoRAWeights {
    rank: number;
    alpha: number;
    weightsA: number[][];
    weightsB: number[][];
    scales: number[];
    metadata: {
        patternId: string;
        mode: string;
        timestamp: number;
        reward: number;
    };
}
export interface SONAAdaptation {
    adaptedWeights: LoRAWeights;
    confidence: number;
    patternId: string;
    mode: string;
    extractionTimeMs: number;
}
export interface Trajectory {
    id: string;
    agentId: string;
    sessionId: string;
    task: TaskContext;
    steps: TrajectoryStep[];
    outcome: TaskOutcome;
    reward: number;
    mode: string;
    startedAt: Date;
    endedAt: Date;
}
export interface TaskContext {
    id: string;
    type: string;
    description: string;
    codeContext?: string;
    constraints: string[];
    acceptanceCriteria: string[];
    mode: 'convergent' | 'divergent' | 'lateral' | 'systems' | 'critical';
}
export interface TrajectoryStep {
    action: string;
    result: string;
    reward: number;
    timestamp: Date;
}
export interface TaskOutcome {
    success: boolean;
    output: any;
    metrics: {
        latencyMs: number;
        toolCalls: number;
        memoryQueries: number;
    };
}
export interface ReasoningPattern {
    id: string;
    title: string;
    description: string;
    content: string;
    reward: number;
    mode: string;
    verdict: 'success' | 'failure';
    loraWeights: LoRAWeights;
    consolidated: boolean;
    createdAt: Date;
    ewcImportance?: number[];
}
export interface Verdict {
    success: boolean;
    reward: number;
    similarity: number;
    reasoning: string;
}
export interface ReasoningBankConfig {
    retrieveK: number;
    judgeThreshold: number;
    distillTimeout: number;
    consolidateInterval: number;
    rerankEnabled: boolean;
    hybridSearch: boolean;
}
export interface RetrieveResult {
    patterns: ReasoningPattern[];
    scores: number[];
    queryEmbedding: number[];
}
export interface DistillResult {
    pattern: ReasoningPattern;
    extractionTimeMs: number;
}
export interface ConsolidateResult {
    patternId: string;
    ewcImportance: number[];
    consolidatedAt: Date;
}
export interface MoEConfig {
    numExperts: number;
    expertCapacity: number;
    routingStrategy: 'maxscore' | 'sr-moe' | 'mose' | 'perft';
    spectralRegularization: boolean;
    spectralLambda: number;
    loadBalancing: boolean;
    adaptiveWidth: boolean;
}
export interface Expert {
    id: string;
    name: string;
    domain: string;
    capacity: number;
    currentLoad: number;
    specialization: string[];
    weights: LoRAWeights;
}
export interface RoutingDecision {
    expertId: string;
    confidence: number;
    loadFactor: number;
    routingScores: number[];
}
export interface EWCConfig {
    lambda: number;
    fisherDiagonal: boolean;
    gradientVanishingFix: boolean;
    onlineUpdate: boolean;
    consolidationInterval: number;
}
export interface FisherInfo {
    paramKey: string;
    fisherDiagonal: number[];
    optimalParams: number[];
    lastUpdated: Date;
}
export interface ConsolidationTask {
    type: 'trajectory' | 'batch' | 'full' | 'cross-domain';
    patterns: ReasoningPattern[];
    sourceDomain?: string;
    targetDomain?: string;
    priority: 'low' | 'normal' | 'high' | 'critical';
}
//# sourceMappingURL=types.d.ts.map