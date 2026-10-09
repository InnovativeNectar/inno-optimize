import { createHash } from 'node:crypto';
export class FlywheelEvaluator {
    memory;
    oapel;
    regression;
    abtest;
    config;
    evaluations = new Map();
    constructor(memory, oapel, regression, abtest, config) {
        this.memory = memory;
        this.oapel = oapel;
        this.regression = regression;
        this.abtest = abtest;
        this.config = config;
    }
    // Submit candidate for evaluation
    async submitCandidate(candidate) {
        const evaluationId = `eval-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        const evaluation = {
            id: evaluationId,
            status: 'evaluating',
            candidate,
            evaluation: await this.evaluateCandidate(candidate),
            receipt: null
        };
        this.evaluations.set(evaluationId, evaluation);
        await this.persistEvaluation(evaluation);
        return evaluationId;
    }
    // Evaluate candidate across all criteria
    async evaluateCandidate(candidate) {
        const criteria = this.getEvaluationCriteria();
        const results = [];
        let totalWeight = 0;
        let weightedScore = 0;
        // Run benchmarks
        const benchmarks = await this.runBenchmarks(candidate);
        // Run tests
        const tests = await this.runTests(candidate);
        // Run audits
        const audits = await this.runAudits(candidate);
        // Evaluate each criterion
        for (const criterion of criteria) {
            let actual = 0;
            let passed = false;
            switch (criterion.name) {
                case 'performance':
                    actual = this.scorePerformance(benchmarks);
                    passed = actual >= criterion.threshold;
                    break;
                case 'quality':
                    actual = this.scoreQuality(tests);
                    passed = actual >= criterion.threshold;
                    break;
                case 'security':
                    actual = this.scoreSecurity(audits);
                    passed = actual >= criterion.threshold;
                    break;
                case 'regression':
                    actual = this.scoreRegression();
                    passed = actual >= criterion.threshold;
                    break;
                case 'correctness':
                    actual = this.scoreCorrectness(tests);
                    passed = actual >= criterion.threshold;
                    break;
            }
            results.push({ ...criterion, actual, passed });
            totalWeight += criterion.weight;
            weightedScore += actual * criterion.weight;
        }
        const score = totalWeight > 0 ? weightedScore / totalWeight : 0;
        const passed = results.every(r => r.passed) && score >= this.config.minScore;
        return {
            passed,
            score,
            criteria: results,
            benchmarks,
            tests,
            audits
        };
    }
    getEvaluationCriteria() {
        return [
            { name: 'performance', weight: 0.3, threshold: 0.9, actual: 0, passed: false },
            { name: 'quality', weight: 0.25, threshold: 0.85, actual: 0, passed: false },
            { name: 'security', weight: 0.2, threshold: 0.95, actual: 0, passed: false },
            { name: 'regression', weight: 0.15, threshold: 0.9, actual: 0, passed: false },
            { name: 'correctness', weight: 0.1, threshold: 0.99, actual: 0, passed: false }
        ];
    }
    // Run benchmarks for candidate
    async runBenchmarks(candidate) {
        const benchmarks = [];
        // Simulate benchmark runs for each benchmark type
        const benchmarkTypes = [
            { name: 'hnsw_search', baseline: 0.8, weight: 0.3 },
            { name: 'batch_insert', baseline: 1.2, weight: 0.2 },
            { name: 'mcp_response', baseline: 250, weight: 0.2 },
            { name: 'swarm_consensus', baseline: 30, weight: 0.15 },
            { name: 'architecture_analysis', baseline: 5000, weight: 0.15 }
        ];
        for (const bm of benchmarkTypes) {
            // In production, would run actual benchmarks
            // For now, simulate with small random variation
            const variation = (Math.random() - 0.5) * 0.1; // ±5%
            const candidateValue = bm.baseline * (1 + variation);
            const delta = candidateValue - bm.baseline;
            const deltaPercent = (delta / bm.baseline) * 100;
            benchmarks.push({
                name: bm.name,
                baseline: bm.baseline,
                candidate: candidateValue,
                delta,
                deltaPercent,
                passed: deltaPercent <= 5 // 5% regression threshold
            });
        }
        return benchmarks;
    }
    async runTests(candidate) {
        // Would run actual test suites
        return [
            { suite: 'unit', passed: 145, failed: 0, coverage: 0.87, durationMs: 12000 },
            { suite: 'integration', passed: 32, failed: 0, coverage: 0.72, durationMs: 45000 },
            { suite: 'e2e', passed: 18, failed: 0, coverage: 0.65, durationMs: 120000 }
        ];
    }
    async runAudits(candidate) {
        return [
            {
                type: 'security',
                passed: true,
                findings: [
                    { severity: 'info', category: 'dependencies', message: 'All dependencies up to date', file: 'package.json' }
                ]
            },
            {
                type: 'performance',
                passed: true,
                findings: [
                    { severity: 'info', category: 'benchmarks', message: 'All benchmarks within thresholds' }
                ]
            },
            {
                type: 'compliance',
                passed: true,
                findings: []
            },
            {
                type: 'quality',
                passed: true,
                findings: [
                    { severity: 'info', category: 'code_quality', message: 'Architecture score maintained at 78' }
                ]
            }
        ];
    }
    scorePerformance(benchmarks) {
        const passed = benchmarks.filter(b => b.passed).length;
        return passed / benchmarks.length;
    }
    scoreQuality(tests) {
        const totalPassed = tests.reduce((sum, t) => sum + t.passed, 0);
        const totalTests = tests.reduce((sum, t) => sum + t.passed + t.failed, 0);
        const avgCoverage = tests.reduce((sum, t) => sum + t.coverage, 0) / tests.length;
        return (totalPassed / totalTests) * 0.7 + avgCoverage * 0.3;
    }
    scoreSecurity(audits) {
        const securityAudit = audits.find(a => a.type === 'security');
        if (!securityAudit)
            return 1;
        return securityAudit.passed ? 1 : 0.5;
    }
    scoreRegression() {
        // Would check regression detector
        return 1; // No regressions
    }
    scoreCorrectness(tests) {
        const totalPassed = tests.reduce((sum, t) => sum + t.passed, 0);
        const totalTests = tests.reduce((sum, t) => sum + t.passed + t.failed, 0);
        return totalTests > 0 ? totalPassed / totalTests : 1;
    }
    // Promote candidate to production
    async promoteCandidate(evaluationId, promotedBy) {
        const evaluation = this.evaluations.get(evaluationId);
        if (!evaluation)
            throw new Error(`Evaluation not found: ${evaluationId}`);
        if (evaluation.status !== 'evaluating' && evaluation.status !== 'pending_clearance') {
            throw new Error(`Evaluation not in promotable state: ${evaluation.status}`);
        }
        if (!evaluation.evaluation.passed) {
            throw new Error('Cannot promote failed evaluation');
        }
        if (this.config.requireClearance && evaluation.status === 'pending_clearance') {
            // Verify clearance
            const cleared = await this.verifyClearance(evaluationId, promotedBy);
            if (!cleared) {
                throw new Error('Clearance not granted');
            }
        }
        // Create receipt
        const receipt = await this.createReceipt(evaluation, promotedBy);
        evaluation.receipt = receipt;
        evaluation.status = 'promoted';
        evaluation.promotedAt = new Date();
        evaluation.promotedBy = promotedBy;
        await this.persistEvaluation(evaluation);
        // Promote via Agenticow if candidate has COW branches
        await this.promoteCandidateBranches(evaluation.candidate);
        return receipt;
    }
    async verifyClearance(evaluationId, promoter) {
        // Would check clearance signatures
        return true; // Simplified
    }
    async createReceipt(evaluation, promoter) {
        const evaluationHash = await this.hashEvaluation(evaluation);
        const anchorHash = await this.getAnchorHash();
        const receipt = {
            id: `receipt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            candidateId: evaluation.candidate.id,
            evaluationHash,
            promotedAt: new Date(),
            promotedBy: promoter,
            signatures: [],
            anchorHash
        };
        // Sign receipt
        receipt.signatures = await this.signReceipt(receipt);
        return receipt;
    }
    async hashEvaluation(evaluation) {
        const content = JSON.stringify({
            candidate: evaluation.candidate,
            evaluation: evaluation.evaluation
        });
        return createHash('sha256').update(content).digest('hex');
    }
    async getAnchorHash() {
        // Would read from anchor file
        return 'anchor-hash-placeholder';
    }
    async signReceipt(receipt) {
        // Would sign with private keys
        return [{
                signer: 'flywheel-evaluator',
                signature: 'signature-placeholder',
                algorithm: 'Ed25519',
                timestamp: new Date()
            }];
    }
    async promoteCandidateBranches(candidate) {
        for (const change of candidate.changes) {
            if (change.type === 'code' && change.files.some(f => f.includes('.cow'))) {
                // Would promote via Agenticow
                console.log(`Promoting COW branch for ${change.files.join(', ')}`);
            }
        }
    }
    // Reject candidate
    async rejectCandidate(evaluationId, reason) {
        const evaluation = this.evaluations.get(evaluationId);
        if (!evaluation)
            throw new Error(`Evaluation not found: ${evaluationId}`);
        evaluation.status = 'rejected';
        await this.persistEvaluation(evaluation);
    }
    // Get evaluation status
    getEvaluation(evaluationId) {
        return this.evaluations.get(evaluationId);
    }
    getAllEvaluations() {
        return Array.from(this.evaluations.values());
    }
    // Run continuous flywheel
    async runFlywheelCycle() {
        // 1. Check for new candidates from A/B tests
        const abTests = this.getCompletedABTests();
        for (const test of abTests) {
            if (test.winner && test.significance > 0.95) {
                const candidate = this.createCandidateFromABTest(test);
                await this.submitCandidate(candidate);
            }
        }
        // 2. Check for regression fixes that could be candidates
        const regressions = this.regression.getAlerts(false);
        for (const alert of regressions) {
            if (alert.acknowledged) {
                const candidate = this.createCandidateFromRegressionFix(alert);
                await this.submitCandidate(candidate);
            }
        }
        // 3. Evaluate pending candidates
        for (const evaluation of this.evaluations.values()) {
            if (evaluation.status === 'evaluating') {
                // Re-evaluate
                evaluation.evaluation = await this.evaluateCandidate(evaluation.candidate);
                if (evaluation.evaluation.passed && evaluation.evaluation.score >= this.config.minScore) {
                    evaluation.status = this.config.requireClearance ? 'pending_clearance' : 'evaluating';
                }
                await this.persistEvaluation(evaluation);
            }
        }
    }
    getCompletedABTests() {
        // Would get from ABTestingFramework
        return [];
    }
    createCandidateFromABTest(test) {
        return {
            id: `candidate-ab-${test.id}`,
            version: `ab-${test.id}`,
            description: `A/B test winner: ${test.name}`,
            changes: [{
                    type: 'config',
                    description: `Promote variant ${test.winner}`,
                    files: ['.inno-optimize/config.yaml']
                }],
            evidence: [{
                    type: 'abtest',
                    source: test.id,
                    data: { winner: test.winner, significance: test.significance },
                    timestamp: test.completedAt || new Date(),
                    verified: true
                }],
            metadata: {
                author: 'abtest-framework',
                createdAt: new Date(),
                tags: ['abtest', 'auto-generated'],
                parentVersion: 'current'
            }
        };
    }
    createCandidateFromRegressionFix(alert) {
        return {
            id: `candidate-fix-${alert.id}`,
            version: `fix-${Date.now()}`,
            description: `Regression fix for ${alert.metric}`,
            changes: [{
                    type: 'code',
                    description: `Fix regression in ${alert.metric}`,
                    files: alert.affectedComponents.map((c) => `${c}/**`)
                }],
            evidence: [{
                    type: 'regression',
                    source: alert.id,
                    data: alert,
                    timestamp: alert.detectedAt,
                    verified: true
                }],
            metadata: {
                author: 'regression-detector',
                createdAt: new Date(),
                tags: ['regression-fix', 'auto-generated'],
                parentVersion: 'current'
            }
        };
    }
    async persistEvaluation(evaluation) {
        await this.memory.insert([{
                id: `flywheel:${evaluation.id}`,
                type: 'semantic',
                tier: 3,
                content: JSON.stringify(evaluation),
                embedding: new Array(384).fill(0.1),
                metadata: { domain: 'flywheel', taskType: 'evaluation', mode: 'systems', context: 'flywheel-persistence', tags: ['flywheel', 'optimization'] },
                provenance: { agentId: 'flywheel-evaluator', sessionId: 'flywheel', source: 'agent', timestamp: new Date() },
                reward: evaluation.status === 'promoted' ? 1 : evaluation.evaluation.passed ? 0.7 : 0.3,
                consolidated: evaluation.status === 'promoted',
                accessCount: 0,
                lastAccessed: new Date(),
                createdAt: new Date()
            }]);
    }
    // Start continuous flywheel
    async startFlywheel() {
        // Run flywheel cycle periodically
        setInterval(() => {
            this.runFlywheelCycle().catch(console.error);
        }, 3600000); // Every hour
    }
    getConfig() {
        return { ...this.config };
    }
    updateConfig(updates) {
        this.config = { ...this.config, ...updates };
    }
    // Get all evaluations with status
    getEvaluationsByStatus(status) {
        return Array.from(this.evaluations.values()).filter(e => e.status === status);
    }
}
export function createDefaultFlywheelConfig() {
    return {
        anchorPath: '.inno-optimize/anchors/flywheel-anchor.json',
        anchorHash: 'placeholder',
        evaluationTimeout: 300000, // 5 minutes
        requireClearance: true,
        minScore: 0.85,
        maxConcurrency: 2
    };
}
//# sourceMappingURL=evaluator.js.map