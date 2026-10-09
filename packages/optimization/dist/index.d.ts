export * from './types.js';
export { OAPELEngine, createDefaultOAPELConfig } from './oapel/engine.js';
export { ABTestingFramework, AgenticowClient, createDefaultABTestConfig } from './abtesting/framework.js';
export { RegressionDetector, createDefaultRegressionConfig } from './regression/detector.js';
export { FlywheelEvaluator, createDefaultFlywheelConfig } from './flywheel/evaluator.js';
export { TemplateManager } from './templates/manager.js';
import { FastStore } from '@inno-optimize/agentdb';
import { IntelligenceLayer } from '@inno-optimize/intelligence';
import { CoordinationLayer } from '@inno-optimize/coordination';
import { ArchitectureScorer } from '@inno-optimize/ast-analysis';
import { OAPELConfig, ABTestConfig, RegressionConfig, FlywheelConfig } from './types.js';
export interface OptimizationLayerConfig {
    oapel: OAPELConfig;
    abtest: ABTestConfig;
    regression: RegressionConfig;
    flywheel: FlywheelConfig;
}
export declare class OptimizationLayer {
    private memory;
    private intelligence;
    private coordination;
    private scorer;
    private oapel;
    private abtest;
    private regression;
    private flywheel;
    private templates;
    constructor(memory: FastStore, intelligence: IntelligenceLayer, coordination: CoordinationLayer, scorer: ArchitectureScorer, config?: Partial<OptimizationLayerConfig>);
    start(): Promise<void>;
    stop(): Promise<void>;
    runOAPELCycle(): Promise<import("./types.js").OAPELCycle>;
    createABTest(name: string, hypothesis: string, variants: any[], metrics: any[]): Promise<import("./types.js").ABTest>;
    recordMetric(metric: any): Promise<void>;
    submitCandidate(candidate: any): Promise<string>;
    promoteCandidate(evaluationId: string, promotedBy: string): Promise<import("./types.js").FlywheelReceipt | null>;
    instantiateTemplate(templateId: string, values: Record<string, any>): import("./types.js").TemplateInstance;
    renderTemplate(templateId: string, values: Record<string, any>): string;
    listTemplates(category?: string): import("./types.js").Template[];
    getStatus(): {
        oapel: string;
        regression: string;
        flywheel: string;
        templates: number;
    };
    shutdown(): Promise<void>;
}
export declare function createOptimizationLayer(memory: FastStore, intelligence: IntelligenceLayer, coordination: CoordinationLayer, scorer: ArchitectureScorer, config?: Partial<OptimizationLayerConfig>): OptimizationLayer;
export declare function createDefaultOptimizationConfig(): OptimizationLayerConfig;
//# sourceMappingURL=index.d.ts.map