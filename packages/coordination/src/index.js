"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoordinationLayer = exports.MockCRMConnector = exports.MockPaymentsConnector = exports.MockInventoryConnector = exports.MockOrdersConnector = exports.connectorRegistry = exports.ConnectorRegistry = exports.getServersByTier = exports.getServersByCapability = exports.getServerByName = exports.businessServers = exports.createDefaultPheromoneConfig = exports.PheromoneScheduler = exports.SagaOrchestrator = exports.HiveMindSwarm = void 0;
exports.createCoordinationLayer = createCoordinationLayer;
exports.createDefaultCoordinationConfig = createDefaultCoordinationConfig;
__exportStar(require("./types"), exports);
var hive_mind_1 = require("./swarm/hive-mind");
Object.defineProperty(exports, "HiveMindSwarm", { enumerable: true, get: function () { return hive_mind_1.HiveMindSwarm; } });
var orchestrator_1 = require("./saga/orchestrator");
Object.defineProperty(exports, "SagaOrchestrator", { enumerable: true, get: function () { return orchestrator_1.SagaOrchestrator; } });
var scheduler_1 = require("./pheromone/scheduler");
Object.defineProperty(exports, "PheromoneScheduler", { enumerable: true, get: function () { return scheduler_1.PheromoneScheduler; } });
Object.defineProperty(exports, "createDefaultPheromoneConfig", { enumerable: true, get: function () { return scheduler_1.createDefaultPheromoneConfig; } });
var servers_1 = require("./mcp-business/servers");
Object.defineProperty(exports, "businessServers", { enumerable: true, get: function () { return servers_1.businessServers; } });
Object.defineProperty(exports, "getServerByName", { enumerable: true, get: function () { return servers_1.getServerByName; } });
Object.defineProperty(exports, "getServersByCapability", { enumerable: true, get: function () { return servers_1.getServersByCapability; } });
Object.defineProperty(exports, "getServersByTier", { enumerable: true, get: function () { return servers_1.getServersByTier; } });
var connectors_1 = require("./mcp-business/connectors");
Object.defineProperty(exports, "ConnectorRegistry", { enumerable: true, get: function () { return connectors_1.ConnectorRegistry; } });
Object.defineProperty(exports, "connectorRegistry", { enumerable: true, get: function () { return connectors_1.connectorRegistry; } });
Object.defineProperty(exports, "MockOrdersConnector", { enumerable: true, get: function () { return connectors_1.MockOrdersConnector; } });
Object.defineProperty(exports, "MockInventoryConnector", { enumerable: true, get: function () { return connectors_1.MockInventoryConnector; } });
Object.defineProperty(exports, "MockPaymentsConnector", { enumerable: true, get: function () { return connectors_1.MockPaymentsConnector; } });
Object.defineProperty(exports, "MockCRMConnector", { enumerable: true, get: function () { return connectors_1.MockCRMConnector; } });
// Integrated Coordination Layer
const hive_mind_2 = require("./swarm/hive-mind");
const orchestrator_2 = require("./saga/orchestrator");
const scheduler_2 = require("./pheromone/scheduler");
const servers_2 = require("./mcp-business/servers");
class CoordinationLayer {
    swarm;
    sagaOrchestrator;
    pheromoneScheduler;
    memory;
    constructor(memory, config) {
        this.memory = memory;
        this.swarm = new hive_mind_2.HiveMindSwarm(config.swarm, memory);
        this.pheromoneScheduler = new scheduler_2.PheromoneScheduler(config.pheromone, memory);
        this.sagaOrchestrator = new orchestrator_2.SagaOrchestrator(memory, {
            getConnector: (id) => this.getBusinessConnector(id)
        });
        // Register business MCP servers
        for (const server of servers_2.businessServers) {
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
        return this.swarm.spawnAgent(agentConfig);
    }
    // Execute saga
    async executeSaga(definition, initialContext) {
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
exports.CoordinationLayer = CoordinationLayer;
function createCoordinationLayer(memory, config) {
    return new CoordinationLayer(memory, config);
}
function createDefaultCoordinationConfig() {
    return {
        swarm: {
            topology: 'hierarchical-mesh',
            consensus: 'raft',
            maxAgents: 12,
            memoryNamespace: 'inno-optimize',
            antiDrift: true,
            persistent: true,
            hooksIntegration: true,
            pheromoneConfig: (0, scheduler_2.createDefaultPheromoneConfig)()
        },
        pheromone: (0, scheduler_2.createDefaultPheromoneConfig)(),
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