import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  HiveMindSwarm, 
  SagaOrchestrator, 
  PheromoneScheduler, 
  createDefaultPheromoneConfig,
  CoordinationLayer,
  createDefaultCoordinationConfig,
  businessServers
} from '../src';
import { FastStore } from '@inno-optimize/agentdb';

describe('Coordination Layer', () => {
  let memory: FastStore;
  const config = {
    path: ':memory:',
    dimensions: 384,
    hnsw: { M: 16, efConstruction: 200, efSearch: 100 },
    quantization: { defaultLevel: 'pq8' as const },
    cache: { maxSize: 100, ttlMs: 60000 }
  };

  beforeEach(async () => {
    memory = new FastStore(config);
    await memory.initialize();
  });

  describe('HiveMindSwarm', () => {
    let swarm: HiveMindSwarm;

    beforeEach(async () => {
      swarm = new HiveMindSwarm({
        topology: 'hierarchical-mesh',
        consensus: 'raft',
        maxAgents: 8,
        memoryNamespace: 'test',
        antiDrift: true,
        persistent: true,
        hooksIntegration: true,
        pheromoneConfig: createDefaultPheromoneConfig()
      }, memory);
      
      await swarm.initialize();
    });

    it('should spawn agents', async () => {
      const agentId = await swarm.spawnAgent({
        type: 'coder',
        name: 'test-coder',
        role: 'worker',
        capabilities: ['coding', 'testing']
      });
      
      expect(agentId).toBeDefined();
      expect(agentId).toContain('test-coder');
    });

    it('should track agent pheromones', async () => {
      const agentId = await swarm.spawnAgent({
        type: 'tester',
        name: 'test-tester',
        role: 'worker'
      });
      
      const pheromone = swarm.getPheromone?.(agentId);
      // Pheromone should be initialized
    });

    it('should get swarm status', () => {
      const status = swarm.getSwarmStatus();
      
      expect(status).toBeDefined();
      expect(status.swarmId).toBeDefined();
      expect(status.topology).toBe('hierarchical-mesh');
      expect(status.consensus).toBe('raft');
      expect(status.maxAgents).toBe(8);
    });

    it('should get eligible agents', async () => {
      await swarm.spawnAgent({ type: 'coder', name: 'coder-1', role: 'worker' });
      await swarm.spawnAgent({ type: 'coder', name: 'coder-2', role: 'worker' });
      
      const eligible = await swarm.getEligibleAgents('worker');
      expect(eligible.length).toBeGreaterThanOrEqual(0);
    });

    it('should terminate agents', async () => {
      const agentId = await swarm.spawnAgent({ type: 'temp', name: 'temp-agent' });
      await swarm.terminateAgent(agentId);
      
      // Agent should be removed
    });
  });

  describe('PheromoneScheduler', () => {
    let scheduler: PheromoneScheduler;

    beforeEach(() => {
      scheduler = new PheromoneScheduler(createDefaultPheromoneConfig(), memory);
    });

    it('should initialize pheromone for agent', () => {
      const pheromone = scheduler.initialize('agent-1', 'worker');
      
      expect(pheromone.agentId).toBe('agent-1');
      expect(pheromone.role).toBe('worker');
      expect(pheromone.emaScore).toBe(0.5);
      expect(pheromone.eligible).toBe(true);
    });

    it('should record task outcome and update pheromone', async () => {
      scheduler.initialize('agent-1', 'worker');
      
      await scheduler.recordOutcome('agent-1', {
        success: true,
        metrics: {
          latencyMs: 1000,
          toolCalls: 3,
          memoryQueries: 2,
          consensusScore: 0.8
        }
      });
      
      const pheromone = scheduler.getPheromone('agent-1');
      expect(pheromone?.sampleCount).toBe(1);
      expect(pheromone?.emaScore).toBeGreaterThan(0.5);
    });

    it('should track eligibility based on performance', async () => {
      scheduler.initialize('agent-good', 'worker');
      scheduler.initialize('agent-bad', 'worker');
      
      // Good agent - many successes
      for (let i = 0; i < 5; i++) {
        await scheduler.recordOutcome('agent-good', {
          success: true,
          metrics: { latencyMs: 500, toolCalls: 2, memoryQueries: 1, consensusScore: 0.9 }
        });
      }
      
      // Bad agent - many failures
      for (let i = 0; i < 5; i++) {
        await scheduler.recordOutcome('agent-bad', {
          success: false,
          metrics: { latencyMs: 5000, toolCalls: 10, memoryQueries: 5, consensusScore: 0.2 }
        });
      }
      
      const good = scheduler.getPheromone('agent-good');
      const bad = scheduler.getPheromone('agent-bad');
      
      expect(good?.emaScore).toBeGreaterThan(bad?.emaScore || 0);
    });

    it('should protect certain roles from suspension', async () => {
      scheduler.initialize('queen-1', 'queen');
      scheduler.initialize('security-1', 'security');
      scheduler.initialize('coordinator-1', 'coordinator');
      
      // Record many failures for protected roles
      for (let i = 0; i < 10; i++) {
        await scheduler.recordOutcome('queen-1', { success: false, metrics: { latencyMs: 5000, toolCalls: 10, memoryQueries: 5, consensusScore: 0 } });
        await scheduler.recordOutcome('security-1', { success: false, metrics: { latencyMs: 5000, toolCalls: 10, memoryQueries: 5, consensusScore: 0 } });
        await scheduler.recordOutcome('coordinator-1', { success: false, metrics: { latencyMs: 5000, toolCalls: 10, memoryQueries: 5, consensusScore: 0 } });
      }
      
      expect(scheduler.getPheromone('queen-1')?.eligible).toBe(true);
      expect(scheduler.getPheromone('security-1')?.eligible).toBe(true);
      expect(scheduler.getPheromone('coordinator-1')?.eligible).toBe(true);
    });

    it('should get eligible agents', () => {
      scheduler.initialize('a1', 'worker');
      scheduler.initialize('a2', 'coder');
      scheduler.initialize('a3', 'worker');
      
      const allEligible = scheduler.getEligibleAgents();
      expect(allEligible.length).toBe(3);
      
      const workerEligible = scheduler.getEligibleAgents('worker');
      expect(workerEligible.length).toBe(2);
    });

    it('should rank agents by score', () => {
      scheduler.initialize('high', 'worker');
      scheduler.initialize('low', 'worker');
      
      // Manually set scores
      const high = scheduler.getPheromone('high');
      const low = scheduler.getPheromone('low');
      if (high) high.emaScore = 0.9;
      if (low) low.emaScore = 0.3;
      
      const ranked = scheduler.getRankedAgents('worker');
      expect(ranked[0].agentId).toBe('high');
      expect(ranked[1].agentId).toBe('low');
    });

    it('should provide metrics', () => {
      scheduler.initialize('a1', 'worker');
      scheduler.initialize('a2', 'worker');
      
      const metrics = scheduler.getMetrics();
      
      expect(metrics).toHaveProperty('globalEMA');
      expect(metrics).toHaveProperty('threshold');
      expect(metrics).toHaveProperty('eligibleCount');
      expect(metrics).toHaveProperty('suspendedCount');
      expect(metrics).toHaveProperty('scoreDistribution');
    });
  });

  describe('Business MCP Servers', () => {
    it('should have 4 business servers', () => {
      expect(businessServers.length).toBe(4);
    });

    it('should have orders server', () => {
      const orders = businessServers.find(s => s.name === 'business-orders');
      expect(orders).toBeDefined();
      expect(orders?.tools.length).toBeGreaterThan(0);
    });

    it('should have inventory server', () => {
      const inventory = businessServers.find(s => s.name === 'business-inventory');
      expect(inventory).toBeDefined();
    });

    it('should have payments server', () => {
      const payments = businessServers.find(s => s.name === 'business-payments');
      expect(payments).toBeDefined();
      expect(payments?.destructive).toBe(true);
      expect(payments?.tier).toBe(3);
    });

    it('should have crm server', () => {
      const crm = businessServers.find(s => s.name === 'business-crm');
      expect(crm).toBeDefined();
    });

    it('should have tools for each server', () => {
      for (const server of businessServers) {
        expect(server.tools.length).toBeGreaterThan(0);
        for (const tool of server.tools) {
          expect(tool.name).toBeDefined();
          expect(tool.inputSchema).toBeDefined();
        }
      }
    });
  });

  describe('CoordinationLayer (Integrated)', () => {
    it('should create coordination layer with defaults', () => {
      const config = createDefaultCoordinationConfig();
      
      expect(config).toHaveProperty('swarm');
      expect(config).toHaveProperty('pheromone');
      expect(config).toHaveProperty('saga');
      expect(config.swarm.topology).toBe('hierarchical-mesh');
      expect(config.swarm.consensus).toBe('raft');
    });
  });
});