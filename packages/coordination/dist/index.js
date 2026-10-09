export * from './types.js';
export { HiveMindSwarm } from './swarm/hive-mind.js';
export { SagaOrchestrator } from './saga/orchestrator.js';
export { PheromoneScheduler, createDefaultPheromoneConfig } from './pheromone/scheduler.js';
export { businessServers, getServerByName, getServersByCapability, getServersByTier } from './mcp-business/servers.js';
export { ConnectorRegistry, connectorRegistry, MockOrdersConnector, MockInventoryConnector, MockPaymentsConnector, MockCRMConnector } from './mcp-business/connectors.js';
// Integrated Coordination Layer
import { HiveMindSwarm } from './swarm/hive-mind.js';
import { SagaOrchestrator } from './saga/orchestrator.js';
import { PheromoneScheduler, createDefaultPheromoneConfig } from './pheromone/scheduler.js';
import { businessServers } from './mcp-business/servers.js';
export class CoordinationLayer {
    swarm;
    sagaOrchestrator;
    pheromoneScheduler;
    memory;
    constructor(memory, config) {
        this.memory = memory;
        this.swarm = new HiveMindSwarm(config.swarm, memory);
        this.pheromoneScheduler = new PheromoneScheduler(config.pheromone, memory);
        this.sagaOrchestrator = new SagaOrchestrator(memory, {
            getConnector: (id) => this.getBusinessConnector(id)
        });
        // Register business MCP servers
        for (const server of businessServers) {
            // Register with MCP framework
        }
    }
    // Initialize all components
    async initialize() {
        await this.swarm.initialize();
        await this.pheromoneScheduler.loadPersisted();
    }
    // Spawn agent in swarm
    async spawnAgent(agentConfig) {
        const agentId = await this.swarm.spawnAgent(agentConfig);
        // Keep the layer's pheromone scheduler in sync with the swarm so
        // getEligibleAgents() sees newly spawned agents.
        this.pheromoneScheduler.initialize(agentId, agentConfig.role || 'worker');
        return agentId;
    }
    // Execute saga
    async executeSaga(definition, initialContext = {}) {
        return this.sagaOrchestrator.execute(definition, initialContext);
    }
    // Record task outcome for pheromone updates
    async recordTaskOutcome(agentId, outcome) {
        await this.pheromoneScheduler.recordOutcome(agentId, outcome);
        // Also update swarm pheromones
        await this.swarm.completeTask('', outcome);
    }
    // Get eligible agents for task
    async getEligibleAgents(role) {
        return this.pheromoneScheduler.getEligibleAgents(role);
    }
    // Get swarm status
    getSwarmStatus() {
        return this.swarm.getSwarmStatus();
    }
    // Get pheromone metrics
    getPheromoneMetrics() {
        return this.pheromoneScheduler.getMetrics();
    }
    // Shutdown all components
    async shutdown() {
        await this.swarm.shutdown();
    }
    getBusinessConnector(id) {
        // Return business connector by ID
        return null;
    }
}
export function createCoordinationLayer(memory, config) {
    return new CoordinationLayer(memory, config);
}
export function createDefaultCoordinationConfig() {
    return {
        swarm: {
            topology: 'hierarchical-mesh',
            consensus: 'raft',
            maxAgents: 12,
            memoryNamespace: 'inno-optimize',
            antiDrift: true,
            persistent: true,
            hooksIntegration: true,
            pheromoneConfig: createDefaultPheromoneConfig()
        },
        pheromone: createDefaultPheromoneConfig(),
        saga: {
            maxConcurrent: 10,
            defaultRetryPolicy: {
                maxRetries: 3,
                backoff: 'exponential',
                baseDelayMs: 1000,
                maxDelayMs: 30000
            }
        }
    };
}
//# sourceMappingURL=index.js.map