import { ABTest, ABMetric, ABTestConfig, ABVariantConfig } from '../types.js';
import { FastStore } from '@inno-optimize/agentdb';
import { AgenticowClient } from './agenticow.js';
export declare class ABTestingFramework {
    private memory;
    private agenticow;
    private config;
    private tests;
    private runningTests;
    constructor(memory: FastStore, agenticow: AgenticowClient, config: ABTestConfig);
    createTest(name: string, hypothesis: string, variants: ABVariantConfig[], metrics: ABMetric[], customConfig?: Partial<ABTestConfig>): Promise<ABTest>;
    startTest(testId: string): Promise<void>;
    recordMetric(testId: string, variantId: string, metricName: string, value: number): Promise<void>;
    private checkSignificance;
    private calculatePValue;
    private normalCDF;
    private calculateConfidenceInterval;
    private checkGuardrails;
    private promoteWinner;
    private requestClearance;
    completeTest(testId: string, promoteWinner: boolean): Promise<void>;
    getTest(testId: string): ABTest | undefined;
    getRunningTests(): ABTest[];
    getAllTests(): ABTest[];
    private monitorTest;
    private persistTest;
    getConfig(): ABTestConfig;
    updateConfig(updates: Partial<ABTestConfig>): void;
}
export { AgenticowClient } from './agenticow.js';
export declare function createDefaultABTestConfig(): ABTestConfig;
//# sourceMappingURL=framework.d.ts.map