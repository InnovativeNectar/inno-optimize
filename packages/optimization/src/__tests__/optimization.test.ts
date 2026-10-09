import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  OAPELEngine, 
  createDefaultOAPELConfig,
  ABTestingFramework,
  AgenticowClient,
  createDefaultABTestConfig,
  RegressionDetector,
  createDefaultRegressionConfig,
  FlywheelEvaluator,
  createDefaultFlywheelConfig,
  TemplateManager,
  OptimizationLayer,
  createDefaultOptimizationConfig
} from '../index.js';
import { FastStore } from '@inno-optimize/agentdb';

describe('Optimization Layer', () => {
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

  describe('OAPEL Engine', () => {
    let oapel: OAPELEngine;

    beforeEach(() => {
      const mockIntelligence = {
        processTask: vi.fn().mockResolvedValue({ consolidated: true }),
        getStats: vi.fn().mockReturnValue({})
      };
      const mockCoordination = {
        getSwarmStatus: vi.fn().mockReturnValue({ agentCount: 8, eligibleAgents: 6, globalEMA: 0.7 }),
        getPheromoneMetrics: vi.fn().mockReturnValue({ globalEMA: 0.7, threshold: 0.42 }),
        spawnAgent: vi.fn().mockResolvedValue('agent-1'),
        recordTaskOutcome: vi.fn().mockResolvedValue(undefined)
      };
      const mockScorer = {
        scoreProject: vi.fn().mockReturnValue({ overall: 75, dimensions: {} })
      };
      
      oapel = new OAPELEngine(
        memory,
        mockIntelligence as any,
        mockCoordination as any,
        mockScorer as any,
        createDefaultOAPELConfig()
      );
    });

    it('should run OAPEL cycle', async () => {
      const cycle = await oapel.runCycle();
      
      expect(cycle).toBeDefined();
      expect(cycle.id).toContain('cycle-');
      expect(cycle.status).toBe('completed');
      expect(cycle.observations.length).toBeGreaterThan(0);
      expect(cycle.analysis).toBeDefined();
      expect(cycle.plan).toBeDefined();
      expect(cycle.execution).toBeDefined();
      expect(cycle.learning).toBeDefined();
    });

    it('should have 5 phases in cycle', async () => {
      const cycle = await oapel.runCycle();
      
      expect(cycle.currentPhase).toBe('learn'); // Final phase
      expect(cycle.observations.length).toBeGreaterThan(0);
      expect(cycle.analysis).not.toBeNull();
      expect(cycle.plan).not.toBeNull();
      expect(cycle.execution).not.toBeNull();
      expect(cycle.learning).not.toBeNull();
    });
  });

  describe('AB Testing Framework', () => {
    let abtest: ABTestingFramework;
    let agenticow: AgenticowClient;

    beforeEach(() => {
      agenticow = new AgenticowClient();
      abtest = new ABTestingFramework(memory, agenticow, createDefaultABTestConfig());
    });

    it('should create A/B test', async () => {
      const test = await abtest.createTest(
        'Button Color Test',
        'Blue button increases conversions',
        [
          { id: 'control', name: 'Red Button', description: 'Current red button', weight: 0.5 },
          { id: 'variant', name: 'Blue Button', description: 'New blue button', weight: 0.5 }
        ],
        [
          { name: 'conversion_rate', type: 'primary', target: 'increase', threshold: 0.05, currentA: 0, currentB: 0 },
          { name: 'error_rate', type: 'guardrail', target: 'decrease', threshold: 0.01, currentA: 0, currentB: 0 }
        ]
      );
      
      expect(test).toBeDefined();
      expect(test.id).toContain('abtest-');
      expect(test.name).toBe('Button Color Test');
      expect(test.variants.length).toBe(2);
      expect(test.metrics.length).toBe(2);
      expect(test.status).toBe('pending');
    });

    it('should start test and record metrics', async () => {
      const test = await abtest.createTest(
        'Test',
        'Hypothesis',
        [
          { id: 'a', name: 'A', description: 'Control', weight: 0.5 },
          { id: 'b', name: 'B', description: 'Variant', weight: 0.5 }
        ],
        [
          { name: 'conversion', type: 'primary', target: 'increase', threshold: 0.05, currentA: 0, currentB: 0 }
        ]
      );
      
      await abtest.startTest(test.id);
      expect(test.status).toBe('running');
      
      await abtest.recordMetric(test.id, 'b', 'conversion', 0.15);
      await abtest.recordMetric(test.id, 'a', 'conversion', 0.10);
      
      const updated = abtest.getTest(test.id);
      expect(updated?.metrics[0].currentB).toBeGreaterThan(0);
    });
  });

  describe('Regression Detector', () => {
    let regression: RegressionDetector;

    beforeEach(() => {
      regression = new RegressionDetector(memory, createDefaultRegressionConfig());
    });

    it('should set baseline and detect regression', async () => {
      await regression.setBaseline({
        name: 'test_metric',
        baseline: 100,
        current: 100,
        unit: 'ms',
        higherIsBetter: false,
        category: 'latency'
      });
      
      const baselines = regression.getBaselines();
      expect(baselines.length).toBe(1);
      expect(baselines[0].baseline).toBe(100);
    });

    it('should detect regression when metric exceeds threshold', async () => {
      await regression.setBaseline({
        name: 'latency_test',
        baseline: 100,
        current: 100,
        unit: 'ms',
        higherIsBetter: false,
        category: 'latency'
      });
      
      // Record regression (>5% increase for higherIsBetter=false)
      await regression.recordMetric({
        name: 'latency_test',
        baseline: 100,
        current: 110, // 10% increase
        unit: 'ms',
        higherIsBetter: false,
        category: 'latency'
      });
      
      const alerts = regression.getAlerts(false);
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].metric).toBe('latency_test');
      expect(alerts[0].deltaPercent).toBeCloseTo(10);
    });

    it('should not alert for improvements', async () => {
      await regression.setBaseline({
        name: 'improvement_test',
        baseline: 100,
        current: 100,
        unit: 'ms',
        higherIsBetter: false,
        category: 'latency'
      });
      
      // Record improvement (decrease for higherIsBetter=false)
      await regression.recordMetric({
        name: 'improvement_test',
        baseline: 100,
        current: 90, // 10% decrease = improvement
        unit: 'ms',
        higherIsBetter: false,
        category: 'latency'
      });
      
      const alerts = regression.getAlerts(false);
      const relevantAlerts = alerts.filter(a => a.metric === 'improvement_test');
      expect(relevantAlerts.length).toBe(0);
    });
  });

  describe('Flywheel Evaluator', () => {
    let flywheel: FlywheelEvaluator;
    let mockOapel: any;
    let mockRegression: any;
    let mockAbtest: any;

    beforeEach(() => {
      mockOapel = { runCycle: vi.fn() };
      mockRegression = { getAlerts: vi.fn().mockReturnValue([]) };
      mockAbtest = { getCompletedABTests: vi.fn().mockReturnValue([]) };
      
      flywheel = new FlywheelEvaluator(
        memory,
        mockOapel,
        mockRegression,
        mockAbtest,
        createDefaultFlywheelConfig()
      );
    });

    it('should submit and evaluate candidate', async () => {
      const candidate = {
        id: 'candidate-1',
        version: 'v1.1.0',
        description: 'Test candidate',
        changes: [{ type: 'code', description: 'Optimization', files: ['src/test.ts'] }],
        evidence: [{
          type: 'benchmark',
          source: 'internal',
          data: { improvement: 0.15 },
          timestamp: new Date(),
          verified: true
        }],
        metadata: {
          author: 'test',
          createdAt: new Date(),
          tags: ['test'],
          parentVersion: 'v1.0.0'
        }
      };
      
      const evalId = await flywheel.submitCandidate(candidate);
      expect(evalId).toContain('eval-');
      
      const evaluation = flywheel.getEvaluation(evalId);
      expect(evaluation).toBeDefined();
      expect(evaluation?.status).toBe('evaluating');
      expect(evaluation?.evaluation).toBeDefined();
    });
  });

  describe('Template Manager', () => {
    let templates: TemplateManager;

    beforeEach(() => {
      templates = new TemplateManager(memory);
    });

    it('should have built-in templates', () => {
      const all = templates.listTemplates();
      expect(all.length).toBeGreaterThanOrEqual(4); // 4 built-in templates
      
      const categories = templates.getTemplatesByCategory();
      expect(categories.has('agent')).toBe(true);
      expect(categories.has('saga')).toBe(true);
    });

    it('should instantiate template with values', () => {
      const instance = templates.instantiateTemplate('agent-business-process', {
        name: 'my-order-agent',
        description: 'Processes orders',
        model: 'sonnet',
        ordersDbUrl: 'postgresql://...',
        eventsDbUrl: 'clickhouse://...'
      });
      
      expect(instance).toBeDefined();
      expect(instance.templateId).toBe('agent-business-process');
      expect(instance.values.name).toBe('my-order-agent');
    });

    it('should render template with values', () => {
      const rendered = templates.renderTemplate('saga-order-processing', {
        sagaId: 'my-order-saga',
        timeout: 120000
      });
      
      expect(rendered).toContain('my-order-saga');
      expect(rendered).toContain('120000');
    });

    it('should apply defaults for missing optional variables', () => {
      const instance = templates.instantiateTemplate('agent-analytics', {
        name: 'analytics-agent',
        description: 'Analytics agent',
        model: 'sonnet',
        ordersDbUrl: 'postgresql://...',
        eventsDbUrl: 'clickhouse://...',
        inventoryDbUrl: 'mysql://...'
      });
      
      expect(instance.values.retentionDays).toBe(365); // default
      expect(instance.values.cacheSize).toBe(10000); // default
    });
  });

  describe('Optimization Layer (Integrated)', () => {
    let optimization: OptimizationLayer;
    let mockIntelligence: any;
    let mockCoordination: any;
    let mockScorer: any;

    beforeEach(() => {
      mockIntelligence = {
        processTask: vi.fn().mockResolvedValue({ consolidated: true }),
        getStats: vi.fn().mockReturnValue({})
      };
      mockCoordination = {
        getSwarmStatus: vi.fn().mockReturnValue({ agentCount: 8, eligibleAgents: 6 }),
        getPheromoneMetrics: vi.fn().mockReturnValue({ globalEMA: 0.7, threshold: 0.42 }),
        spawnAgent: vi.fn().mockResolvedValue('agent-1'),
        recordTaskOutcome: vi.fn().mockResolvedValue(undefined)
      };
      mockScorer = {
        scoreProject: vi.fn().mockReturnValue({ overall: 75, dimensions: {} })
      };
      
      optimization = new OptimizationLayer(
        memory,
        mockIntelligence,
        mockCoordination,
        mockScorer,
        createDefaultOptimizationConfig()
      );
    });

    it('should initialize all sub-components', () => {
      const status = optimization.getStatus();
      
      expect(status).toHaveProperty('oapel');
      expect(status).toHaveProperty('regression');
      expect(status).toHaveProperty('flywheel');
      expect(status).toHaveProperty('templates');
    });

    it('should run OAPEL cycle', async () => {
      const cycle = await optimization.runOAPELCycle();
      expect(cycle).toBeDefined();
      expect(cycle.status).toBe('completed');
    });

    it('should create A/B test', async () => {
      const test = await optimization.createABTest(
        'Test',
        'Hypothesis',
        [
          { id: 'a', name: 'A', description: 'Control', weight: 0.5 },
          { id: 'b', name: 'B', description: 'Variant', weight: 0.5 }
        ],
        [
          { name: 'metric', type: 'primary', target: 'increase', threshold: 0.05, currentA: 0, currentB: 0 }
        ]
      );
      
      expect(test).toBeDefined();
      expect(test.id).toContain('abtest-');
    });

    it('should record metric for regression detection', async () => {
      await optimization.recordMetric({
        name: 'test_metric',
        baseline: 100,
        current: 100,
        unit: 'ms',
        higherIsBetter: false,
        category: 'latency'
      });
      
      // Should not throw
    });

    it('should submit candidate for flywheel', async () => {
      const candidate = {
        id: 'candidate-1',
        version: 'v1.1.0',
        description: 'Test',
        changes: [],
        evidence: [],
        metadata: { author: 'test', createdAt: new Date(), tags: [], parentVersion: 'v1.0.0' }
      };
      
      const evalId = await optimization.submitCandidate(candidate);
      expect(evalId).toContain('eval-');
    });

    it('should list templates', () => {
      const templates = optimization.listTemplates();
      expect(templates.length).toBeGreaterThanOrEqual(4);
    });

    it('should instantiate template', () => {
      const instance = optimization.instantiateTemplate('agent-business-process', {
        name: 'test-agent',
        description: 'Test agent',
        model: 'sonnet'
      });
      
      expect(instance).toBeDefined();
      expect(instance.templateId).toBe('agent-business-process');
    });

    it('should render template', () => {
      const rendered = optimization.renderTemplate('saga-order-processing', {
        sagaId: 'test-saga',
        timeout: 60000
      });
      
      expect(rendered).toContain('test-saga');
    });
  });
});