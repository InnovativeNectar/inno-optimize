import { EventEmitter } from 'events';
import { SwarmConfig, SwarmStatus, TaskOutcome, AgentSpawnConfig } from './types.js';
import { FastStore } from '@inno-optimize/agentdb';
export declare class HiveMindSwarm extends EventEmitter {
    private config;
    private swarmId;
    private agents;
    private pheromones;
    private taskAssignments;
    private memory;
    private consensus;
    private messageBus;
    private isRunning;
    private healthCheckInterval?;
    constructor(config: SwarmConfig, memory: FastStore);
    initialize(): Promise<void>;
    spawnAgent(agentConfig: AgentSpawnConfig): Promise<string>;
    terminateAgent(agentId: string): Promise<void>;
    assignTask(taskId: string, agentId: string): Promise<boolean>;
    completeTask(taskId: string, outcome: TaskOutcome): Promise<void>;
    private updatePheromone;
    private recalculateEligibility;
    private initPheromone;
    getEligibleAgents(role?: string): Promise<string[]>;
    getSwarmStatus(): SwarmStatus;
    propose(proposal: ConsensusProposal): Promise<string>;
    vote(proposalId: string, agentId: string, vote: boolean): Promise<void>;
    private loadState;
    private persistState;
    private persistPheromone;
    private reassignTasks;
    private startHealthChecks;
    private performHealthCheck;
    shutdown(): Promise<void>;
}
//# sourceMappingURL=hive-mind.d.ts.map