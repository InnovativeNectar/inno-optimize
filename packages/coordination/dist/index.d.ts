export * from './types.js';
export { HiveMindSwarm } from './swarm/hive-mind.js';
export { SagaOrchestrator } from './saga/orchestrator.js';
export { PheromoneScheduler, createDefaultPheromoneConfig } from './pheromone/scheduler.js';
export { businessServers, getServerByName, getServersByCapability, getServersByTier } from './mcp-business/servers.js';
export { ConnectorRegistry, connectorRegistry, MockOrdersConnector, MockInventoryConnector, MockPaymentsConnector, MockCRMConnector } from './mcp-business/connectors.js';
import { FastStore } from '@inno-optimize/agentdb';
import { SwarmConfig, SagaDefinition, SagaContext, TaskOutcome, PheromoneConfig } from './types.js';
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
    executeSaga(definition: SagaDefinition, initialContext?: Partial<SagaContext>): Promise<import("./types.js").SagaResult>;
    recordTaskOutcome(agentId: string, outcome: TaskOutcome): Promise<void>;
    getEligibleAgents(role?: string): Promise<string[]>;
    getSwarmStatus(): SwarmStatus;
    getPheromoneMetrics(): import("./types.js").PheromoneMetrics;
    shutdown(): Promise<void>;
    private getBusinessConnector;
}
export declare function createCoordinationLayer(memory: FastStore, config: CoordinationLayerConfig): CoordinationLayer;
export declare function createDefaultCoordinationConfig(): CoordinationLayerConfig;
//# sourceMappingURL=index.d.ts.map