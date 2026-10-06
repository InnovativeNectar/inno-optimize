"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HiveMindSwarm = void 0;
const events_1 = require("events");
class HiveMindSwarm extends events_1.EventEmitter {
    config;
    swarmId;
    agents = new Map();
    pheromones = new Map();
    taskAssignments = new Map();
    memory;
    consensus;
    messageBus;
    isRunning = false;
    healthCheckInterval;
    constructor(config, memory) {
        super();
        this.config = config;
        this.swarmId = `swarm-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        this.memory = memory;
        this.consensus = new ConsensusEngine(config.consensus);
        this.messageBus = new MessageBus();
    }
    async initialize() {
        // Initialize consensus engine
        await this.consensus.initialize(this.swarmId, this.config.maxAgents);
        // Initialize message bus
        await this.messageBus.initialize();
        // Load persisted state if exists
        await this.loadState();
        // Start health checks
        this.startHealthChecks();
        this.isRunning = true;
        this.emit('initialized', { swarmId: this.swarmId });
    }
    async spawnAgent(agentConfig) {
        const agentId = agentConfig.id || `agent-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        if (this.agents.size >= this.config.maxAgents) {
            throw new Error(`Swarm at max capacity (${this.config.maxAgents})`);
        }
        const agent = {
            id: agentId,
            type: agentConfig.type,
            name: agentConfig.name,
            role: agentConfig.role || 'worker',
            capabilities: agentConfig.capabilities || [],
            model: agentConfig.model || 'sonnet',
            status: 'idle',
            spawnedAt: new Date(),
            currentTask: null
        };
        this.agents.set(agentId, agent);
        // Initialize pheromone for new agent
        this.initPheromone(agentId, agent.role);
        // Join consensus
        await this.consensus.join(agentId);
        this.emit('agentSpawned', { agentId, agent });
        await this.persistState();
        return agentId;
    }
    async terminateAgent(agentId) {
        const agent = this.agents.get(agentId);
        if (!agent)
            return;
        // Leave consensus
        await this.consensus.leave(agentId);
        // Clean up pheromone
        this.pheromones.delete(agentId);
        // Reassign any assigned tasks
        await this.reassignTasks(agentId);
        this.agents.delete(agentId);
        this.emit('agentTerminated', { agentId });
        await this.persistState();
    }
    async assignTask(taskId, agentId) {
        const agent = this.agents.get(agentId);
        if (!agent)
            return false;
        if (agent.status !== 'idle')
            return false;
        // Check pheromone eligibility
        const pheromone = this.pheromones.get(agentId);
        if (pheromone && !pheromone.eligible) {
            return false; // Agent suspended
        }
        const assignment = {
            taskId,
            agentId,
            assignedAt: new Date(),
            status: 'assigned'
        };
        this.taskAssignments.set(taskId, assignment);
        agent.status = 'running';
        agent.currentTask = taskId;
        this.emit('taskAssigned', { taskId, agentId });
        return true;
    }
    async completeTask(taskId, outcome) {
        const assignment = this.taskAssignments.get(taskId);
        if (!assignment)
            return;
        const agent = this.agents.get(assignment.agentId);
        if (agent) {
            agent.status = 'idle';
            agent.currentTask = null;
        }
        assignment.status = outcome.success ? 'completed' : 'failed';
        assignment.completedAt = new Date();
        assignment.outcome = outcome;
        // Update pheromone
        await this.updatePheromone(assignment.agentId, outcome);
        this.emit('taskCompleted', { taskId, outcome });
        await this.persistState();
    }
    async updatePheromone(agentId, outcome) {
        let pheromone = this.pheromones.get(agentId);
        if (!pheromone) {
            pheromone = this.initPheromone(agentId, 'worker');
        }
        // Calculate task success score (0-1)
        const taskSuccess = outcome.success ? 1 : 0;
        const latencyScore = Math.max(0, 1 - outcome.metrics.latencyMs / 60000); // Normalize to 60s budget
        const toolEfficiency = Math.max(0, 1 - outcome.metrics.toolCalls / 20); // Normalize to 20 calls
        const combinedScore = (taskSuccess * 0.5) + (latencyScore * 0.25) + (toolEfficiency * 0.25);
        // Update EMA
        const alpha = this.config.pheromoneConfig?.alpha || 0.3;
        pheromone.emaScore = alpha * combinedScore + (1 - alpha) * pheromone.emaScore;
        pheromone.sampleCount++;
        pheromone.lastUpdated = new Date();
        // Check eligibility
        await this.recalculateEligibility(agentId);
        await this.persistPheromone(agentId);
    }
    async recalculateEligibility(agentId) {
        const pheromone = this.pheromones.get(agentId);
        if (!pheromone)
            return;
        const protectedRoles = this.config.pheromoneConfig?.protectedRoles || ['coordinator', 'queen', 'security'];
        if (protectedRoles.includes(pheromone.role)) {
            pheromone.eligible = true;
            return;
        }
        // Need minimum samples before making eligibility decisions
        const warmupSamples = this.config.pheromoneConfig?.warmupSamples || 3;
        if (pheromone.sampleCount < warmupSamples) {
            pheromone.eligible = true; // Grace period
            return;
        }
        // Calculate global EMA
        const allScores = Array.from(this.pheromones.values())
            .filter(p => p.sampleCount >= warmupSamples)
            .map(p => p.emaScore);
        if (allScores.length === 0) {
            pheromone.eligible = true;
            return;
        }
        const globalEMA = allScores.reduce((a, b) => a + b, 0) / allScores.length;
        const thetaMultiplier = this.config.pheromoneConfig?.thetaMultiplier || 0.6;
        const threshold = globalEMA * thetaMultiplier;
        const wasEligible = pheromone.eligible;
        pheromone.eligible = pheromone.emaScore >= threshold;
        if (wasEligible && !pheromone.eligible) {
            pheromone.suspensionCount++;
            this.emit('agentSuspended', { agentId, score: pheromone.emaScore, threshold });
        }
        else if (!wasEligible && pheromone.eligible) {
            pheromone.recoveryAttempts++;
            this.emit('agentRecovered', { agentId, score: pheromone.emaScore });
        }
        await this.persistPheromone(agentId);
    }
    initPheromone(agentId, role) {
        const pheromone = {
            agentId,
            role,
            emaScore: 0.5, // Start neutral
            sampleCount: 0,
            eligible: true,
            lastUpdated: new Date(),
            suspensionCount: 0,
            recoveryAttempts: 0
        };
        this.pheromones.set(agentId, pheromone);
        return pheromone;
    }
    async getEligibleAgents(role) {
        const eligible = [];
        for (const [agentId, pheromone] of this.pheromones) {
            if (pheromone.eligible && (!role || pheromone.role === role)) {
                const agent = this.agents.get(agentId);
                if (agent && agent.status === 'idle') {
                    eligible.push(agentId);
                }
            }
        }
        return eligible;
    }
    getSwarmStatus() {
        const eligibleAgents = Array.from(this.pheromones.values()).filter(p => p.eligible).length;
        const suspendedAgents = Array.from(this.pheromones.values()).filter(p => !p.eligible).length;
        const allScores = Array.from(this.pheromones.values())
            .filter(p => p.sampleCount >= (this.config.pheromoneConfig?.warmupSamples || 3))
            .map(p => p.emaScore);
        const globalEMA = allScores.length > 0
            ? allScores.reduce((a, b) => a + b, 0) / allScores.length
            : 0.5;
        const threshold = globalEMA * (this.config.pheromoneConfig?.thetaMultiplier || 0.6);
        return {
            swarmId: this.swarmId,
            topology: this.config.topology,
            consensus: this.config.consensus,
            agentCount: this.agents.size,
            maxAgents: this.config.maxAgents,
            eligibleAgents,
            suspendedAgents,
            queenId: this.config.queenId,
            pheromoneStats: {
                globalEMA,
                threshold,
                avgEligibility: eligibleAgents / Math.max(1, this.pheromones.size)
            },
            consensusMetrics: this.consensus.getMetrics(),
            createdAt: new Date(), // Would be stored
            updatedAt: new Date()
        };
    }
    // Consensus operations
    async propose(proposal) {
        return this.consensus.propose(proposal);
    }
    async vote(proposalId, agentId, vote) {
        await this.consensus.vote(proposalId, agentId, vote);
    }
    // State persistence
    async loadState() {
        // Load from AgentDB
        const state = await this.memory.getById(`${this.swarmId}:state`);
        if (state) {
            // Restore agents, pheromones, tasks
        }
    }
    async persistState() {
        const state = {
            swarmId: this.swarmId,
            agents: Array.from(this.agents.entries()),
            pheromones: Array.from(this.pheromones.entries()),
            tasks: Array.from(this.taskAssignments.entries()),
            timestamp: new Date()
        };
        await this.memory.insert([{
                id: `${this.swarmId}:state`,
                type: 'semantic',
                tier: 3,
                content: JSON.stringify(state),
                embedding: new Array(384).fill(0.1),
                metadata: { domain: 'swarm', taskType: 'state' },
                provenance: { agentId: 'hive-mind', sessionId: this.swarmId, source: 'system', timestamp: new Date() },
                reward: 1,
                consolidated: true,
                accessCount: 0,
                lastAccessed: new Date(),
                createdAt: new Date()
            }]);
    }
    async persistPheromone(agentId) {
        const pheromone = this.pheromones.get(agentId);
        if (!pheromone)
            return;
        await this.memory.insert([{
                id: `${this.swarmId}:pheromone:${agentId}`,
                type: 'episodic',
                tier: 2,
                content: JSON.stringify(pheromone),
                embedding: new Array(384).fill(0.1),
                metadata: { domain: 'swarm', taskType: 'pheromone' },
                provenance: { agentId: 'hive-mind', sessionId: this.swarmId, source: 'system', timestamp: new Date() },
                reward: pheromone.emaScore,
                consolidated: false,
                accessCount: 0,
                lastAccessed: new Date(),
                createdAt: new Date()
            }]);
    }
    async reassignTasks(agentId) {
        for (const [taskId, assignment] of this.taskAssignments) {
            if (assignment.agentId === agentId && assignment.status === 'running') {
                assignment.status = 'assigned';
                assignment.agentId = '';
                agentId = '';
                this.emit('taskReassigned', { taskId });
            }
        }
    }
    startHealthChecks() {
        this.healthCheckInterval = setInterval(() => {
            this.performHealthCheck();
        }, 30000); // Every 30 seconds
    }
    performHealthCheck() {
        const status = this.getSwarmStatus();
        // Check for stuck agents
        for (const [agentId, agent] of this.agents) {
            if (agent.status === 'running' && agent.currentTask) {
                const assignment = this.taskAssignments.get(agent.currentTask);
                if (assignment && Date.now() - assignment.assignedAt.getTime() > 300000) { // 5 min timeout
                    this.emit('agentStuck', { agentId, taskId: agent.currentTask });
                }
            }
        }
        // Check consensus health
        const consensusHealth = this.consensus.getHealth();
        if (!consensusHealth.healthy) {
            this.emit('consensusUnhealthy', consensusHealth);
        }
        this.emit('healthCheck', status);
    }
    async shutdown() {
        this.isRunning = false;
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }
        // Terminate all agents
        for (const agentId of this.agents.keys()) {
            await this.terminateAgent(agentId);
        }
        await this.consensus.shutdown();
        await this.messageBus.shutdown();
        await this.persistState();
        this.emit('shutdown', { swarmId: this.swarmId });
    }
}
exports.HiveMindSwarm = HiveMindSwarm;
class ConsensusEngine extends events_1.EventEmitter {
    strategy;
    maxNodes;
    nodes = new Map();
    proposals = new Map();
    currentTerm = 0;
    votedFor;
    commitIndex = 0;
    lastApplied = 0;
    constructor(strategy) {
        super();
        this.strategy = strategy;
    }
    async initialize(swarmId, maxNodes) {
        this.maxNodes = maxNodes;
        // Initialize based on strategy
    }
    async join(nodeId) {
        this.nodes.set(nodeId, {
            id: nodeId,
            joinedAt: new Date(),
            lastHeartbeat: new Date(),
            status: 'active'
        });
    }
    async leave(nodeId) {
        this.nodes.delete(nodeId);
    }
    async propose(proposal) {
        const proposalId = `prop-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        this.proposals.set(proposalId, {
            ...proposal,
            id: proposalId,
            status: 'pending',
            votes: new Map(),
            createdAt: new Date()
        });
        // Broadcast to all nodes
        for (const nodeId of this.nodes.keys()) {
            if (nodeId !== proposal.proposer) {
                this.emit('proposal', { nodeId, proposal: this.proposals.get(proposalId) });
            }
        }
        return proposalId;
    }
    async vote(proposalId, voterId, vote) {
        const proposal = this.proposals.get(proposalId);
        if (!proposal)
            return;
        proposal.votes.set(voterId, vote);
        // Check for majority
        const votes = Array.from(proposal.votes.values());
        const yesVotes = votes.filter(v => v).length;
        const totalNodes = this.nodes.size;
        if (yesVotes > totalNodes / 2) {
            proposal.status = 'accepted';
            this.emit('proposalAccepted', { proposalId, proposal });
        }
        else if (votes.length - yesVotes > totalNodes / 2) {
            proposal.status = 'rejected';
            this.emit('proposalRejected', { proposalId, proposal });
        }
    }
    getMetrics() {
        return {
            lastTerm: this.currentTerm,
            committedEntries: this.commitIndex,
            leaderId: undefined, // Would track in Raft
            activeProposals: Array.from(this.proposals.values()).filter(p => p.status === 'pending').length
        };
    }
    getHealth() {
        return {
            healthy: this.nodes.size >= Math.ceil(this.maxNodes / 2),
            nodeCount: this.nodes.size,
            quorum: Math.ceil(this.maxNodes / 2)
        };
    }
    async shutdown() {
        this.nodes.clear();
        this.proposals.clear();
    }
}
class MessageBus extends events_1.EventEmitter {
    async initialize() {
        // Initialize message transport
    }
    async shutdown() {
        // Close connections
    }
}
//# sourceMappingURL=hive-mind.js.map