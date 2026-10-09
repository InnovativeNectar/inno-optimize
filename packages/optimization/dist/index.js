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
export class OptimizationLayer {
    memory;
    intelligence;
    coordination;
    scorer;
    oapel;
    abtest;
    regression;
    flywheel;
    templates;
    constructor(memory, intelligence, coordination, scorer, config) {
        this.memory = memory;
        this.intelligence = intelligence;
        this.coordination = coordination;
        this.scorer = scorer;
        const defaultConfig = {
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
    async start() {
        await this.oapel.start();
        await this.regression.start();
        await this.flywheel.startFlywheel();
    }
    // Stop all optimization loops
    async stop() {
        await this.oapel.stop();
        await this.regression.stop();
    }
    // Run single OAPEL cycle
    async runOAPELCycle() {
        return this.oapel.runCycle();
    }
    // Create A/B test
    async createABTest(name, hypothesis, variants, metrics) {
        return this.abtest.createTest(name, hypothesis, variants, metrics);
    }
    // Record metric for regression detection
    async recordMetric(metric) {
        return this.regression.recordMetric(metric);
    }
    // Submit candidate for flywheel evaluation
    async submitCandidate(candidate) {
        return this.flywheel.submitCandidate(candidate);
    }
    // Promote candidate
    async promoteCandidate(evaluationId, promotedBy) {
        return this.flywheel.promoteCandidate(evaluationId, promotedBy);
    }
    // Instantiate template
    instantiateTemplate(templateId, values) {
        return this.templates.instantiateTemplate(templateId, values);
    }
    // Render template
    renderTemplate(templateId, values) {
        return this.templates.renderTemplate(templateId, values);
    }
    // List available templates
    listTemplates(category) {
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
    async shutdown() {
        await this.stop();
    }
}
export function createOptimizationLayer(memory, intelligence, coordination, scorer, config) {
    return new OptimizationLayer(memory, intelligence, coordination, scorer, config);
}
export function createDefaultOptimizationConfig() {
    return {
        oapel: createDefaultOAPELConfig(),
        abtest: createDefaultABTestConfig(),
        regression: createDefaultRegressionConfig(),
        flywheel: createDefaultFlywheelConfig()
    };
}
//# sourceMappingURL=index.js.map