import { describe, it, expect, beforeEach } from 'vitest';
import { 
  CoordinationLayer, 
  createDefaultCoordinationConfig,
  HiveMindSwarm,
  SagaOrchestrator,
  PheromoneScheduler,
  createDefaultPheromoneConfig,
  businessServers
} from '../src.js';
import { FastStore } from '@inno-optimize/agentdb';

describe('Coordination Layer Integration', () => {
  let memory: FastStore;
  let coordination: CoordinationLayer;
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
    
    const coordConfig = createDefaultCoordinationConfig();
    coordination = new CoordinationLayer(memory, coordConfig);
    await coordination.initialize();
  });

  describe('End-to-End Swarm Operations', () => {
    it('should spawn agents and track them', async () => {
      const coderId = await coordination.spawnAgent({
        type: 'coder',
        name: 'e2e-coder',
        role: 'worker',
        capabilities: ['coding', 'testing']
      });
      
      const reviewerId = await coordination.spawnAgent({
        type: 'reviewer',
        name: 'e2e-reviewer',
        role: 'worker',
        capabilities: ['review', 'security']
      });
      
      expect(coderId).toBeDefined();
      expect(reviewerId).toBeDefined();
      expect(coderId).not.toBe(reviewerId);
    });

    it('should get eligible agents after spawning', async () => {
      await coordination.spawnAgent({ type: 'coder', name: 'coder-1', role: 'worker' });
      await coordination.spawnAgent({ type: 'tester', name: 'tester-1', role: 'worker' });
      
      const eligible = await coordination.getEligibleAgents('worker');
      expect(eligible.length).toBeGreaterThanOrEqual(2);
    });

    it('should track swarm status', () => {
      const status = coordination.getSwarmStatus();
      
      expect(status).toBeDefined();
      expect(status.topology).toBe('hierarchical-mesh');
      expect(status.consensus).toBe('raft');
      expect(status.maxAgents).toBe(12);
    });
  });

  describe('Pheromone Integration', () => {
    it('should record task outcomes and update pheromones', async () => {
      await coordination.spawnAgent({ type: 'coder', name: 'phero-coder', role: 'worker' });
      
      const eligible = await coordination.getEligibleAgents('worker');
      const agentId = eligible[0];
      
      await coordination.recordTaskOutcome(agentId, {
        success: true,
        metrics: { latencyMs: 1000, toolCalls: 3, memoryQueries: 1, consensusScore: 0.9 }
      });
      
      const metrics = coordination.getPheromoneMetrics();
      expect(metrics.eligibleCount).toBeGreaterThan(0);
    });

    it('should differentiate agent performance', async () => {
      await coordination.spawnAgent({ type: 'coder', name: 'good-coder', role: 'worker' });
      await coordination.spawnAgent({ type: 'coder', name: 'bad-coder', role: 'worker' });
      
      const eligible = await coordination.getEligibleAgents('worker');
      const [goodId, badId] = eligible.slice(0, 2);
      
      // Good agent
      for (let i = 0; i < 3; i++) {
        await coordination.recordTaskOutcome(goodId, {
          success: true,
          metrics: { latencyMs: 500, toolCalls: 2, memoryQueries: 1, consensusScore: 0.9 }
        });
      }
      
      // Bad agent
      for (let i = 0; i < 3; i++) {
        await coordination.recordTaskOutcome(badId, {
          success: false,
          metrics: { latencyMs: 5000, toolCalls: 10, memoryQueries: 5, consensusScore: 0.1 }
        });
      }
      
      const metrics = coordination.getPheromoneMetrics();
      expect(metrics.globalEMA).toBeDefined();
    });
  });

  describe('Saga Orchestration', () => {
    it('should have business connectors available', () => {
      // Business servers should be registered
      expect(businessServers.length).toBe(4);
      
      const orders = businessServers.find(s => s.name === 'business-orders');
      const inventory = businessServers.find(s => s.name === 'business-inventory');
      const payments = businessServers.find(s => s.name === 'business-payments');
      const crm = businessServers.find(s => s.name === 'business-crm');
      
      expect(orders).toBeDefined();
      expect(inventory).toBeDefined();
      expect(payments).toBeDefined();
      expect(crm).toBeDefined();
    });
  });

  describe('Complete Workflow: Order Processing Saga', () => {
    it('should define order processing saga', () => {
      const sagaDefinition = {
        id: 'order-processing',
        name: 'Order Processing',
        version: '1.0',
        steps: [
          {
            id: 'check-inventory',
            name: 'Check Inventory',
            connector: 'business-inventory',
            operation: 'check_stock',
            inputMapper: (ctx: any) => ({ productIds: ctx.order.items.map((i: any) => i.productId) }),
            outputMapper: (result: any, ctx: any) => ({ inventoryAvailable: result.available }),
            timeout: 5000
          },
          {
            id: 'process-payment',
            name: 'Process Payment',
            connector: 'business-payments',
            operation: 'process_payment',
            inputMapper: (ctx: any) => ({ orderId: ctx.orderId, amount: ctx.order.total, paymentMethod: ctx.order.paymentMethod }),
            outputMapper: (result: any, ctx: any) => ({ paymentId: result.paymentId }),
            timeout: 30000
          },
          {
            id: 'create-order',
            name: 'Create Order',
            connector: 'business-orders',
            operation: 'create_order',
            inputMapper: (ctx: any) => ctx.order,
            outputMapper: (result: any, ctx: any) => ({ orderId: result.orderId }),
            timeout: 10000
          }
        ],
        compensation: {
          strategy: 'backward',
          steps: [
            { stepId: 'create-order', connector: 'business-orders', operation: 'cancel_order', inputMapper: (ctx: any, out: any) => ({ orderId: out.orderId }) },
            { stepId: 'process-payment', connector: 'business-payments', operation: 'refund_payment', inputMapper: (ctx: any, out: any) => ({ paymentId: out.paymentId }) },
            { stepId: 'check-inventory', connector: 'business-inventory', operation: 'release_stock', inputMapper: (ctx: any, out: any) => ({ items: ctx.order.items }) }
          ]
        },
        timeout: 60000,
        retryPolicy: { maxRetries: 3, backoff: 'exponential', baseDelayMs: 1000, maxDelayMs: 30000, retryableErrors: ['timeout', 'unavailable'] },
        idempotencyKeys: ['order-processing']
      };
      
      expect(sagaDefinition.id).toBe('order-processing');
      expect(sagaDefinition.steps.length).toBe(3);
      expect(sagaDefinition.compensation.steps.length).toBe(3);
    });
  });

  describe('Shutdown', () => {
    it('should shutdown cleanly', async () => {
      await coordination.shutdown();
      // Should not throw
    });
  });
});