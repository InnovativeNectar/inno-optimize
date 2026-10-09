import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  SONAAdapter, 
  createDefaultSONAConfig,
  ReasoningBank,
  createDefaultReasoningBankConfig,
  MoERouter,
  createDefaultMoEConfig,
  EWCConsolidator,
  createDefaultEWCConfig,
  IntelligenceLayer,
  createIntelligenceLayer
} from '../index.js';
import { FastStore } from '@inno-optimize/agentdb';

describe('Intelligence Layer', () => {
  let memory: FastStore;
  const config = {
    path: ':memory:',
    dimensions: 384,
    hnsw: { M: 16, efConstruction: 200, efSearch: 100, maxElements: 10000 },
    quantization: { defaultLevel: 'pq8' as const },
    cache: { maxSize: 100, ttlMs: 60000 }
  };

  beforeEach(async () => {
    memory = new FastStore(config);
    await memory.initialize();
  });

  describe('SONAAdapter', () => {
    let sona: SONAAdapter;

    beforeEach(() => {
      sona = new SONAAdapter(createDefaultSONAConfig(), memory);
    });

    it('should adapt to task context', async () => {
      const taskContext = {
        id: 'task-1',
        type: 'refactor',
        description: 'Extract method from large function',
        constraints: ['preserve behavior'],
        acceptanceCriteria: ['tests pass'],
        mode: 'convergent' as const
      };

      const adaptation = await sona.adapt(taskContext);
      
      expect(adaptation).toBeDefined();
      expect(adaptation.adaptedWeights).toBeDefined();
      expect(adaptation.confidence).toBeGreaterThan(0);
      expect(adaptation.patternId).toBeDefined();
      expect(adaptation.mode).toBe('convergent');
      expect(adaptation.extractionTimeMs).toBeLessThan(100); // <0.05ms target
    });

    it('should use different modes', async () => {
      const modes = ['convergent', 'divergent', 'lateral', 'systems', 'critical'] as const;
      
      for (const mode of modes) {
        const taskContext = {
          id: `task-${mode}`,
          type: 'test',
          description: 'Test task',
          constraints: [],
          acceptanceCriteria: [],
          mode
        };

        const adaptation = await sona.adapt(taskContext);
        expect(adaptation.mode).toBe(mode);
      }
    });

    it('should track trajectories', async () => {
      const taskContext = {
        id: 'task-traj',
        type: 'test',
        description: 'Test trajectory tracking',
        constraints: [],
        acceptanceCriteria: [],
        mode: 'convergent' as const
      };

      await sona.adapt(taskContext);
      
      // Trajectory should be stored in memory
      const results = await memory.search({
        vector: new Array(384).fill(0.1),
        k: 10,
        filter: { type: 'episodic' }
      });
      
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('ReasoningBank', () => {
    let reasoningBank: ReasoningBank;

    beforeEach(() => {
      reasoningBank = new ReasoningBank(
        createDefaultReasoningBankConfig(),
        memory,
        { embed: async (text: string) => new Array(384).fill(0.1) }
      );
    });

    it('should process trajectory through 4 stages', async () => {
      const trajectory = {
        id: 'traj-1',
        agentId: 'test-agent',
        sessionId: 'session-1',
        task: {
          id: 'task-1',
          type: 'refactor',
          description: 'Extract method pattern',
          constraints: [],
          acceptanceCriteria: [],
          mode: 'convergent' as const
        },
        steps: [
          { action: 'analyze', result: 'Found long method', reward: 0.2, timestamp: new Date() },
          { action: 'extract', result: 'Created new method', reward: 0.3, timestamp: new Date() },
          { action: 'test', result: 'All tests pass', reward: 0.5, timestamp: new Date() }
        ],
        outcome: {
          success: true,
          output: {},
          metrics: { latencyMs: 100, toolCalls: 3, memoryQueries: 1 }
        },
        reward: 0.85,
        mode: 'convergent',
        startedAt: new Date(),
        endedAt: new Date()
      };

      const pattern = await reasoningBank.processTrajectory(trajectory);
      
      expect(pattern).toBeDefined();
      expect(pattern.id).toContain('pattern-');
      expect(pattern.title).toBeDefined();
      expect(pattern.content).toBeDefined();
      expect(pattern.reward).toBe(0.85);
      expect(pattern.mode).toBe('convergent');
      expect(pattern.verdict).toBe('success');
      expect(pattern.loraWeights).toBeDefined();
      expect(pattern.consolidated).toBe(true);
    });

    it('should assign failure verdict for low reward', async () => {
      const trajectory = {
        id: 'traj-fail',
        agentId: 'test-agent',
        sessionId: 'session-1',
        task: {
          id: 'task-fail',
          type: 'refactor',
          description: 'Failed refactoring',
          constraints: [],
          acceptanceCriteria: [],
          mode: 'convergent' as const
        },
        steps: [
          { action: 'attempt', result: 'Error occurred', reward: 0.1, timestamp: new Date() }
        ],
        outcome: {
          success: false,
          output: {},
          metrics: { latencyMs: 50, toolCalls: 1, memoryQueries: 0 }
        },
        reward: 0.3,
        mode: 'convergent',
        startedAt: new Date(),
        endedAt: new Date()
      };

      const pattern = await reasoningBank.processTrajectory(trajectory);
      
      expect(pattern.verdict).toBe('failure');
      expect(pattern.reward).toBe(0.3);
    });
  });

  describe('MoERouter', () => {
    let router: MoERouter;

    beforeEach(() => {
      router = new MoERouter(createDefaultMoEConfig());
    });

    it('should route task to appropriate expert', async () => {
      const task = {
        id: 'task-route',
        type: 'security',
        description: 'Audit authentication module for vulnerabilities',
        constraints: ['OWASP compliance'],
        acceptanceCriteria: ['No critical findings'],
        mode: 'critical' as const
      };

      const decision = await router.route(task);
      
      expect(decision).toBeDefined();
      expect(decision.expertId).toBeDefined();
      expect(decision.confidence).toBeGreaterThan(0);
      expect(decision.loadFactor).toBeGreaterThanOrEqual(0);
      expect(decision.routingScores.length).toBe(12); // 12 experts
    });

    it('should balance load across experts', async () => {
      const task = {
        id: 'task-load',
        type: 'general',
        description: 'General coding task',
        constraints: [],
        acceptanceCriteria: [],
        mode: 'convergent' as const
      };

      // Route multiple tasks
      for (let i = 0; i < 20; i++) {
        await router.route({ ...task, id: `task-${i}` });
      }
      
      const stats = router.getExpertStats();
      const loads = stats.map(s => s.expert.currentLoad);
      const maxLoad = Math.max(...loads);
      const minLoad = Math.min(...loads);
      
      // Load should be reasonably balanced
      expect(maxLoad - minLoad).toBeLessThan(5);
    });

    it('should detect expert collapse', () => {
      const collapse = router.detectCollapse();
      expect(collapse).toHaveProperty('collapsed');
      expect(collapse).toHaveProperty('expertIds');
    });
  });

  describe('EWCConsolidator', () => {
    let ewc: EWCConsolidator;

    beforeEach(() => {
      ewc = new EWCConsolidator(createDefaultEWCConfig(), memory);
    });

    it('should consolidate pattern with Fisher information', async () => {
      // First store a pattern
      const pattern = {
        id: 'pattern-ewc-1',
        title: 'Test Pattern',
        description: 'Test pattern for EWC',
        content: '{"steps": []}',
        reward: 0.9,
        mode: 'convergent',
        verdict: 'success' as const,
        loraWeights: {
          rank: 64,
          alpha: 16,
          weightsA: Array(64).fill(Array(384).fill(0.01)),
          weightsB: Array(384).fill(Array(64).fill(0.01)),
          scales: Array(384).fill(1.0),
          metadata: { patternId: 'test', mode: 'convergent', timestamp: Date.now(), reward: 0.9 }
        },
        consolidated: false,
        createdAt: new Date()
      };

      await ewc.consolidate(pattern as any);
      
      // Check Fisher info was stored
      const stats = ewc.getStats();
      expect(stats.totalPatterns).toBe(1);
      expect(stats.totalParameters).toBeGreaterThan(0);
    });

    it('should compute EWC loss', async () => {
      const pattern = {
        id: 'pattern-ewc-2',
        title: 'Test Pattern 2',
        description: 'Test pattern for EWC loss',
        content: '{"steps": []}',
        reward: 0.8,
        mode: 'convergent',
        verdict: 'success' as const,
        loraWeights: {
          rank: 4,
          alpha: 16,
          weightsA: Array(4).fill(Array(10).fill(0.01)),
          weightsB: Array(10).fill(Array(4).fill(0.01)),
          scales: Array(10).fill(1.0),
          metadata: { patternId: 'test', mode: 'convergent', timestamp: Date.now(), reward: 0.8 }
        },
        consolidated: false,
        createdAt: new Date()
      };

      await ewc.consolidate(pattern as any);
      
      const currentParams = new Map();
      currentParams.set('pattern:pattern-ewc-2', 
        Array(4 * 10 + 10 * 4 + 10).fill(0.01));
      
      const loss = ewc.computeEWCLoss(currentParams);
      expect(loss).toBeGreaterThanOrEqual(0);
    });

    it('should track consolidation stats', async () => {
      const stats = ewc.getStats();
      expect(stats).toHaveProperty('totalPatterns');
      expect(stats).toHaveProperty('consolidatedPatterns');
      expect(stats).toHaveProperty('totalParameters');
      expect(stats).toHaveProperty('averageFisherNorm');
      expect(stats).toHaveProperty('queueLength');
    });
  });

  describe('IntelligenceLayer (Integrated)', () => {
    it('should process task through full pipeline', async () => {
      const layer = createIntelligenceLayer(memory);
      
      const taskContext = {
        id: 'task-integrated',
        type: 'refactor',
        description: 'Extract method from god class',
        constraints: ['preserve behavior', 'add tests'],
        acceptanceCriteria: ['tests pass', 'complexity reduced'],
        mode: 'systems' as const
      };

      const result = await layer.processTask(taskContext);
      
      expect(result.sonaAdaptation).toBeDefined();
      expect(result.routing).toBeDefined();
      expect(result.pattern).toBeDefined();
      
      if (result.pattern) {
        expect(result.pattern.consolidated).toBe(true);
        expect(result.pattern.ewcImportance).toBeDefined();
      }
    });

    it('should provide system stats', async () => {
      const layer = createIntelligenceLayer(memory);
      const stats = layer.getStats();
      
      expect(stats).toHaveProperty('sona');
      expect(stats).toHaveProperty('reasoningBank');
      expect(stats).toHaveProperty('moe');
      expect(stats).toHaveProperty('ewc');
    });
  });
});