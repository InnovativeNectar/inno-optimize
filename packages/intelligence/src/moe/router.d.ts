import { MoEConfig, Expert, RoutingDecision, TaskContext } from '../types';
export declare class MoERouter {
    private config;
    private experts;
    private routingHistory;
    private loadBalancer;
    constructor(config: MoEConfig);
    private initializeExperts;
    private getSpecialization;
    private generateExpertWeights;
    route(task: TaskContext): Promise<RoutingDecision>;
    private computeRoutingScores;
    private maxScoreRouting;
    private spectralRouting;
    private computeSpectralPenalty;
    private adaptiveWidthRouting;
    private peftRouting;
    private estimateComplexity;
    rebalance(): void;
    getExpertStats(): Array<{
        expert: Expert;
        usageRate: number;
        avgConfidence: number;
    }>;
    detectCollapse(): {
        collapsed: boolean;
        expertIds: string[];
    };
    recoverFromCollapse(): void;
    private hashString;
    private generateMatrix;
    private generateScales;
}
export declare function createDefaultMoEConfig(): MoEConfig;
//# sourceMappingURL=router.d.ts.map