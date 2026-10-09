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
import type { FastStore } from '@inno-optimize/agentdb';
import type { SwarmConfig, SagaDefinition, SagaContext, TaskOutcome, PheromoneConfig } from './types.js';

export interface CoordinationLayerConfig {
  swarm: SwarmConfig;
  pheromone: PheromoneConfig;
  saga: {
    maxConcurrent: number;
    defaultRetryPolicy: any;
  };
}

export class CoordinationLayer {
  private swarm: HiveMindSwarm;
  private sagaOrchestrator: SagaOrchestrator;
  private pheromoneScheduler: PheromoneScheduler;
  private memory: FastStore;
  
  constructor(memory: FastStore, config: CoordinationLayerConfig) {
    this.memory = memory;
    
    this.swarm = new HiveMindSwarm(config.swarm, memory);
    this.pheromoneScheduler = new PheromoneScheduler(config.pheromone, memory);
    this.sagaOrchestrator = new SagaOrchestrator(memory, {
      getConnector: (id: string) => this.getBusinessConnector(id)
    } as any);
    
    // Register business MCP servers
    for (const server of businessServers) {
      // Register with MCP framework
    }
  }
  
  // Initialize all components
  async initialize(): Promise<void> {
    await this.swarm.initialize();
    await this.pheromoneScheduler.loadPersisted();
  }
  
  // Spawn agent in swarm
  async spawnAgent(agentConfig: any): Promise<string> {
    const agentId = await this.swarm.spawnAgent(agentConfig);
    // Keep the layer's pheromone scheduler in sync with the swarm so
    // getEligibleAgents() sees newly spawned agents.
    this.pheromoneScheduler.initialize(agentId, agentConfig.role || 'worker');
    return agentId;
  }
  
  // Execute saga
  async executeSaga(definition: SagaDefinition, initialContext: Partial<SagaContext> = {}) {
    return this.sagaOrchestrator.execute(definition, initialContext);
  }
  
  // Record task outcome for pheromone updates
  async recordTaskOutcome(agentId: string, outcome: TaskOutcome): Promise<void> {
    await this.pheromoneScheduler.recordOutcome(agentId, outcome);
    // Also update swarm pheromones
    await this.swarm.completeTask('', outcome);
  }
  
  // Get eligible agents for task
  async getEligibleAgents(role?: string): Promise<string[]> {
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
  async shutdown(): Promise<void> {
    await this.swarm.shutdown();
  }
  
  private getBusinessConnector(id: string) {
    // Return business connector by ID
    return null;
  }
}

export function createCoordinationLayer(
  memory: FastStore, 
  config: CoordinationLayerConfig
): CoordinationLayer {
  return new CoordinationLayer(memory, config);
}

export function createDefaultCoordinationConfig(): CoordinationLayerConfig {
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