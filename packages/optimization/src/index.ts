export * from './types.js';
export { OAPELEngine, createDefaultOAPELConfig } from './oapel/engine.js';
export { ABTestingFramework, AgenticowClient, createDefaultABTestConfig } from './abtesting/framework.js';
export { RegressionDetector, createDefaultRegressionConfig } from './regression/detector.js';
export { FlywheelEvaluator, createDefaultFlywheelConfig } from './flywheel/evaluator.js';
export { TemplateManager } from './templates/manager.js';

// Integrated Optimization Layer
import { OAPELEngine, createDefaultOAPELConfig } from './oapel/engine.js';
import { ABTestingFramework, AgenticowClient, createDefaultABTestConfig } from './abtesting/framework.js';
import { RegressionDetector, createDefaultRegressionConfig } from './regression/detector.js';
import { FlywheelEvaluator, createDefaultFlywheelConfig } from './flywheel/evaluator.js';
import { TemplateManager } from './templates/manager.js';
import type { FastStore } from '@inno-optimize/agentdb';
import type { IntelligenceLayer } from '@inno-optimize/intelligence';
import type { CoordinationLayer } from '@inno-optimize/coordination';
import type { ArchitectureScorer } from '@inno-optimize/ast-analysis';
import type {
  OAPELConfig,
  ABTestConfig,
  RegressionConfig,
  FlywheelConfig,
  ABVariantConfig,
  ABMetric,
  RegressionMetric,
  FlywheelCandidate
} from './types.js';

export interface OptimizationLayerConfig {
  oapel: OAPELConfig;
  abtest: ABTestConfig;
  regression: RegressionConfig;
  flywheel: FlywheelConfig;
}

export class OptimizationLayer {
  private memory: FastStore;
  private intelligence: IntelligenceLayer;
  private coordination: CoordinationLayer;
  private scorer: ArchitectureScorer;
  
  private oapel: OAPELEngine;
  private abtest: ABTestingFramework;
  private regression: RegressionDetector;
  private flywheel: FlywheelEvaluator;
  private templates: TemplateManager;
  
  constructor(
    memory: FastStore,
    intelligence: IntelligenceLayer,
    coordination: CoordinationLayer,
    scorer: ArchitectureScorer,
    config?: Partial<OptimizationLayerConfig>
  ) {
    this.memory = memory;
    this.intelligence = intelligence;
    this.coordination = coordination;
    this.scorer = scorer;
    
    const defaultConfig: OptimizationLayerConfig = {
      oapel: createDefaultOAPELConfig(),
      abtest: createDefaultABTestConfig(),
      regression: createDefaultRegressionConfig(),
      flywheel: createDefaultFlywheelConfig()
    };
    
    const finalConfig = { ...defaultConfig, ...config };
    
    // Initialize components
    this.oapel = new OAPELEngine(memory, intelligence, coordination, scorer, finalConfig.oapel);
    this.abtest = new ABTestingFramework(memory, new AgenticowClient(), finalConfig.abtest);
    this.regression = new RegressionDetector(memory, finalConfig.regression);
    this.flywheel = new FlywheelEvaluator(memory, this.oapel, this.regression, this.abtest, finalConfig.flywheel);
    this.templates = new TemplateManager(memory);
  }
  
  // Start all optimization loops
  async start(): Promise<void> {
    await this.oapel.start();
    await this.regression.start();
    await this.flywheel.startFlywheel();
  }
  
  // Stop all optimization loops
  async stop(): Promise<void> {
    await this.oapel.stop();
    await this.regression.stop();
  }
  
  // Run single OAPEL cycle
  async runOAPELCycle() {
    return this.oapel.runCycle();
  }
  
  // Create A/B test
  async createABTest(
    name: string,
    hypothesis: string,
    variants: ABVariantConfig[],
    metrics: ABMetric[]
  ) {
    return this.abtest.createTest(name, hypothesis, variants, metrics);
  }
  
  // Record metric for regression detection
  async recordMetric(metric: RegressionMetric) {
    return this.regression.recordMetric(metric);
  }
  
  // Submit candidate for flywheel evaluation
  async submitCandidate(candidate: FlywheelCandidate) {
    return this.flywheel.submitCandidate(candidate);
  }
  
  // Promote candidate
  async promoteCandidate(evaluationId: string, promotedBy: string) {
    return this.flywheel.promoteCandidate(evaluationId, promotedBy);
  }
  
  // Instantiate template
  instantiateTemplate(templateId: string, values: Record<string, unknown>) {
    return this.templates.instantiateTemplate(templateId, values);
  }
  
  // Render template
  renderTemplate(templateId: string, values: Record<string, unknown>) {
    return this.templates.renderTemplate(templateId, values);
  }
  
  // List available templates
  listTemplates(category?: string) {
    return this.templates.listTemplates(category);
  }
  
  // Get optimization status
  getStatus() {
    return {
      oapel: this.oapel.getCurrentCycle() ? 'running' : 'idle',
      regression: this.regression.getBaselines().length > 0 ? 'monitoring' : 'idle',
      flywheel: this.flywheel.getAllEvaluations().length > 0 ? 'active' : 'idle',
      templates: this.templates.getTemplateCount()
    };
  }
  
  // Shutdown
  async shutdown(): Promise<void> {
    await this.stop();
  }
}

export function createOptimizationLayer(
  memory: FastStore,
  intelligence: IntelligenceLayer,
  coordination: CoordinationLayer,
  scorer: ArchitectureScorer,
  config?: Partial<OptimizationLayerConfig>
): OptimizationLayer {
  return new OptimizationLayer(memory, intelligence, coordination, scorer, config);
}

export function createDefaultOptimizationConfig(): OptimizationLayerConfig {
  return {
    oapel: createDefaultOAPELConfig(),
    abtest: createDefaultABTestConfig(),
    regression: createDefaultRegressionConfig(),
    flywheel: createDefaultFlywheelConfig()
  };
}