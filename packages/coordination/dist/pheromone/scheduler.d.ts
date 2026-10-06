import { PheromoneConfig, AgentPheromone, PheromoneMetrics, TaskOutcome } from '../types.js';
import { FastStore } from '@inno-optimize/agentdb';
export declare class PheromoneScheduler {
    private config;
    private pheromones;
    private memory;
    private updateQueue;
    private processing;
    constructor(config: PheromoneConfig, memory: FastStore);
    initialize(agentId: string, role: string): AgentPheromone;
    recordOutcome(agentId: string, outcome: TaskOutcome): Promise<void>;
    private processUpdates;
    private applyUpdate;
    private recalculateEligibility;
    getEligibleAgents(role?: string, excludeSuspended?: boolean): string[];
    getRankedAgents(role?: string): Array<{
        agentId: string;
        score: number;
    }>;
    getPheromone(agentId: string): AgentPheromone | undefined;
    getAllPheromones(): Map<string, AgentPheromone>;
    getMetrics(): PheromoneMetrics;
    recoverAgent(agentId: string): Promise<boolean>;
    suspendAgent(agentId: string): Promise<boolean>;
    loadPersisted(): Promise<void>;
    private persistPheromone;
    reset(): void;
    getConfig(): PheromoneConfig;
    updateConfig(updates: Partial<PheromoneConfig>): void;
}
export declare function createDefaultPheromoneConfig(): PheromoneConfig;
//# sourceMappingURL=scheduler.d.ts.map