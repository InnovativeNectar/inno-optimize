export * from './types';
export { HiveMindSwarm } from './swarm/hive-mind';
export { SagaOrchestrator } from './saga/orchestrator';
export { PheromoneScheduler, createDefaultPheromoneConfig } from './pheromone/scheduler';
export { businessServers, getServerByName, getServersByCapability, getServersByTier } from './mcp-business/servers';
export { ConnectorRegistry, connectorRegistry, MockOrdersConnector, MockInventoryConnector, MockPaymentsConnector, MockCRMConnector } from './mcp-business/connectors';
import { FastStore } from '@inno-optimize/agentdb';
import { SwarmConfig, SagaDefinition, SagaContext, TaskOutcome, PheromoneConfig } from './types';
export interface CoordinationLayerConfig {
    swarm: SwarmConfig;
    pheromone: PheromoneConfig;
    saga: {
        maxConcurrent: number;
        defaultRetryPolicy: any;
    };
}
export declare class CoordinationLayer {
    private swarm;
    private sagaOrchestrator;
    private pheromoneScheduler;
    private memory;
    constructor(memory: FastStore, config: CoordinationLayerConfig);
    initialize(): Promise<void>;
    spawnAgent(agentConfig: any): Promise<string>;
    executeSaga(definition: SagaDefinition, initialContext?: Partial<SagaContext>): Promise<import("./types").SagaResult>;
    recordTaskOutcome(agentId: string, outcome: TaskOutcome): Promise<void>;
    getEligibleAgents(role?: string): Promise<string[]>;
    getSwarmStatus(): SwarmStatus;
    getPheromoneMetrics(): import("./types").PheromoneMetrics;
    shutdown(): Promise<void>;
    private getBusinessConnector;
}
export declare function createCoordinationLayer(memory: FastStore, config: CoordinationLayerConfig): CoordinationLayer;
export declare function createDefaultCoordinationConfig(): CoordinationLayerConfig;
//# sourceMappingURL=index.d.ts.map