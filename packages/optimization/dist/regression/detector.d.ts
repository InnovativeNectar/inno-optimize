import { RegressionAlert, RegressionConfig, RegressionMetric } from '../types.js';
import { FastStore } from '@inno-optimize/agentdb';
export declare class RegressionDetector {
    private memory;
    private config;
    private baselines;
    private alerts;
    private monitoring;
    private intervalId;
    constructor(memory: FastStore, config: RegressionConfig);
    start(): Promise<void>;
    stop(): Promise<void>;
    recordMetric(metric: RegressionMetric): Promise<void>;
    setBaseline(metric: RegressionMetric): Promise<void>;
    getBaselines(): RegressionMetric[];
    getAlerts(acknowledged?: boolean): RegressionAlert[];
    acknowledgeAlert(alertId: string): Promise<void>;
    getReport(): Promise<{
        summary: {
            totalMetrics: number;
            regressed: number;
            improved: number;
            stable: number;
        };
        alerts: RegressionAlert[];
        trends: Array<{
            metric: string;
            trend: 'improving' | 'stable' | 'degrading';
            data: number[];
        }>;
    }>;
    private checkRegressions;
    private checkMetricRegression;
    private getRecentCommitRange;
    private getAffectedComponents;
    private generateSuggestedAction;
    private loadBaselines;
    private persistBaseline;
    private persistAlert;
    private sendAlert;
    getConfig(): RegressionConfig;
    updateConfig(updates: Partial<RegressionConfig>): void;
}
export declare function createDefaultRegressionConfig(): RegressionConfig;
//# sourceMappingURL=detector.d.ts.map