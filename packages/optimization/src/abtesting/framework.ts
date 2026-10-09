import { 
  ABTest, 
  ABVariant, 
  ABMetric, 
  ABTestConfig,
  ABTestStatus,
  ABVariantConfig
} from '../types.js';
import { FastStore } from '@inno-optimize/agentdb';
import { AgenticowClient } from './agenticow.js';

export class ABTestingFramework {
  private memory: FastStore;
  private agenticow: AgenticowClient;
  private config: ABTestConfig;
  private tests = new Map<string, ABTest>();
  private runningTests = new Set<string>();
  
  constructor(memory: FastStore, agenticow: AgenticowClient, config: ABTestConfig) {
    this.memory = memory;
    this.agenticow = agenticow;
    this.config = config;
  }
  
  // Create new A/B test
  async createTest(
    name: string,
    hypothesis: string,
    variants: ABVariantConfig[],
    metrics: ABMetric[],
    customConfig?: Partial<ABTestConfig>
  ): Promise<ABTest> {
    const testId = `abtest-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    
    const test: ABTest = {
      id: testId,
      name,
      status: 'pending',
      hypothesis,
      variants: variants.map((v, i) => ({
        id: v.id || `variant-${i}`,
        name: v.name,
        description: v.description,
        config: v.config,
        weight: v.weight || 1 / variants.length,
        cowBranch: v.cowBranch,
        parameters: v.parameters || {}
      })),
      metrics: metrics.map(m => ({ ...m, currentA: 0, currentB: 0 })),
      significance: 0,
      sampleSize: 0
    };
    
    this.tests.set(testId, test);
    await this.persistTest(test);
    
    return test;
  }
  
  // Start A/B test with Agenticow COW branches
  async startTest(testId: string): Promise<void> {
    const test = this.tests.get(testId);
    if (!test) throw new Error(`Test not found: ${testId}`);
    if (test.status !== 'pending') throw new Error(`Test not in pending state`);
    
    // Create COW branches for each variant
    for (const variant of test.variants) {
      if (variant.cowBranch) {
        await this.agenticow.createBranch(variant.cowBranch, {
          label: `abtest-${test.id}-${variant.id}`,
          basePath: variant.cowBranch,
          dimension: 384
        });
      }
    }
    
    test.status = 'running';
    test.startedAt = new Date();
    this.runningTests.add(test.id);
    await this.persistTest(test);
    
    // Start monitoring
    this.monitorTest(test.id);
  }
  
  // Record metric for variant
  async recordMetric(testId: string, variantId: string, metricName: string, value: number): Promise<void> {
    const test = this.tests.get(testId);
    if (!test || test.status !== 'running') return;
    
    const variant = test.variants.find(v => v.id === variantId);
    if (!variant) return;
    
    const metric = test.metrics.find(m => m.name === metricName);
    if (!metric) return;
    
    // Update running average
    const count = test.sampleSize + 1;
    const firstVariantId = test.variants[0]?.id;
    if (variant.id === firstVariantId) {
      metric.currentA = (metric.currentA * test.sampleSize + value) / count;
    } else {
      metric.currentB = (metric.currentB * test.sampleSize + value) / count;
    }
    
    test.sampleSize = count;
    
    // Check for significance
    await this.checkSignificance(test);
    
    await this.persistTest(test);
  }
  
  // Check statistical significance
  private async checkSignificance(test: ABTest): Promise<void> {
    if (test.sampleSize < this.config.minSampleSize) return;
    
    for (const metric of test.metrics) {
      if (metric.type !== 'primary') continue;
      
      const pValue = this.calculatePValue(
        metric.currentA,
        metric.currentB,
        test.sampleSize
      );
      
      metric.pValue = pValue;
      metric.confidenceInterval = this.calculateConfidenceInterval(
        metric.currentA,
        metric.currentB,
        test.sampleSize
      );
      
      // Check if significant
      if (pValue < this.config.significanceLevel) {
        // Determine winner
        const target = metric.target;
        const winnerId = (target === 'increase' && metric.currentB > metric.currentA) ||
                         (target === 'decrease' && metric.currentB < metric.currentA)
          ? test.variants[1]?.id ?? test.variants[0]?.id ?? ''
          : test.variants[0]?.id ?? '';
        
        test.winner = winnerId;
        test.significance = 1 - pValue;
        
        // Check guardrails
        const guardrailsPass = this.checkGuardrails(test);
        
        if (guardrailsPass && this.config.autoPromote) {
          await this.promoteWinner(test);
        }
        
        // Check max duration
        if (test.startedAt && Date.now() - test.startedAt.getTime() > this.config.maxDuration) {
          await this.completeTest(test.id, false);
        }
      }
    }
  }
  
  private calculatePValue(a: number, b: number, n: number): number {
    // Two-proportion z-test
    const p1 = a;
    const p2 = b;
    const p = (p1 + p2) / 2;
    const se = Math.sqrt(p * (1 - p) * (2 / n));
    const z = Math.abs(p1 - p2) / se;
    
    // Approximate p-value from z-score
    return 2 * (1 - this.normalCDF(Math.abs(z)));
  }
  
  private normalCDF(x: number): number {
    // Approximation of standard normal CDF
    const t = 1 / (1 + 0.2316419 * x);
    const d = 0.3989423 * Math.exp(-x * x / 2);
    const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return x > 0 ? 1 - prob : prob;
  }
  
  private calculateConfidenceInterval(a: number, b: number, n: number): [number, number] {
    const p1 = a;
    const p2 = b;
    const diff = p2 - p1;
    const se = Math.sqrt(p1 * (1 - p1) / n + p2 * (1 - p2) / n);
    const z = 1.96; // 95% CI
    return [diff - z * se, diff + z * se];
  }
  
  private checkGuardrails(test: ABTest): boolean {
    for (const metric of test.metrics) {
      if (metric.type === 'guardrail') {
        // Guardrail should not regress
        if (metric.target === 'increase' && metric.currentB < metric.currentA * 0.95) {
          return false;
        }
        if (metric.target === 'decrease' && metric.currentB > metric.currentA * 1.05) {
          return false;
        }
      }
    }
    return true;
  }
  
  // Promote winning variant
  private async promoteWinner(test: ABTest): Promise<void> {
    if (!test.winner) return;
    
    const winner = test.variants.find(v => v.id === test.winner);
    if (!winner) return;
    
    if (this.config.requireClearance) {
      // ADR-171: Require clearance before promotion
      test.status = 'pending_clearance';
      await this.requestClearance(test);
      return;
    }
    
    // Promote via Agenticow
    if (winner.cowBranch) {
      await this.agenticow.promoteBranch(winner.cowBranch, {
        basePath: winner.cowBranch,
        requireClearance: false
      });
    }
    
    test.status = 'completed';
    test.completedAt = new Date();
    await this.persistTest(test);
  }
  
  private async requestClearance(test: ABTest): Promise<void> {
    // Would integrate with approval system
    console.log(`Clearance requested for test ${test.id}, winner: ${test.winner}`);
  }
  
  // Complete test manually
  async completeTest(testId: string, promoteWinner: boolean): Promise<void> {
    const test = this.tests.get(testId);
    if (!test) throw new Error(`Test not found: ${testId}`);
    
    if (promoteWinner && test.winner) {
      const winner = test.variants.find(v => v.id === test.winner);
      if (winner && winner.cowBranch) {
        await this.agenticow.promoteBranch(winner.cowBranch, {
          basePath: winner.cowBranch,
          requireClearance: this.config.requireClearance
        });
      }
    }
    
    test.status = 'completed';
    test.completedAt = new Date();
    this.runningTests.delete(testId);
    await this.persistTest(test);
  }
  
  // Get test status
  getTest(testId: string): ABTest | undefined {
    return this.tests.get(testId);
  }
  
  getRunningTests(): ABTest[] {
    return Array.from(this.runningTests).map(id => this.tests.get(id)!).filter(Boolean);
  }
  
  getAllTests(): ABTest[] {
    return Array.from(this.tests.values());
  }
  
  // Monitor running test
  private monitorTest(testId: string): void {
    // Would set up periodic checks
  }
  
  private async persistTest(test: ABTest): Promise<void> {
    await this.memory.insert([{
      id: `abtest:${test.id}`,
      type: 'episodic',
      tier: 2,
      content: JSON.stringify(test),
      embedding: new Array(384).fill(0.1),
      metadata: { domain: 'optimization', taskType: 'abtest', mode: 'systems', context: 'abtest-persistence', tags: ['abtest', 'optimization'] },
      provenance: { agentId: 'abtest-framework', sessionId: 'abtest', source: 'agent', timestamp: new Date() },
      reward: test.status === 'completed' ? 1 : 0.5,
      consolidated: false,
      accessCount: 0,
      lastAccessed: new Date(),
      createdAt: test.startedAt || new Date()
    }]);
  }
  
  getConfig(): ABTestConfig {
    return { ...this.config };
  }
  
  updateConfig(updates: Partial<ABTestConfig>): void {
    this.config = { ...this.config, ...updates };
  }
}

export { AgenticowClient } from './agenticow.js';

export function createDefaultABTestConfig(): ABTestConfig {
  return {
    minSampleSize: 100,
    maxDuration: 86400000,      // 24 hours
    significanceLevel: 0.05,
    power: 0.8,
    guardrailMetrics: ['error_rate', 'latency_p99'],
    autoPromote: true,
    requireClearance: true
  };
}