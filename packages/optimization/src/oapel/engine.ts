import type { 
  OAPELCycle, 
  Observation, 
  AnalysisResult, 
  ExecutionPlan, 
  ExecutionResult, 
  LearningResult,
  OAPELConfig,
  Bottleneck,
  DebtItem,
  DiscoveredPattern,
  Anomaly,
  Recommendation,
  PlanTask,
  TaskDependency,
  RollbackStep,
  TaskResult,
  ExecutionError,
  ExecutionMetrics,
  Insight
} from '../types.js';
import type { FastStore } from '@inno-optimize/agentdb';
import type { ArchitectureScorer } from '@inno-optimize/ast-analysis';
import type { IntelligenceLayer } from '@inno-optimize/intelligence';
import type { CoordinationLayer } from '@inno-optimize/coordination';

interface ArchitectureMetrics {
  overall: number;
  dimensions: { maintainability: number; scalability: number; security: number; performance: number };
  fileCount: number;
  totalLines: number;
}

interface PerformanceMetrics {
  hnwsSearchP99: number;
  batchInsert: number;
  mcpResponseP95: number;
  swarmConsensus: number;
  sonaAdaptation: number;
}

interface SwarmMetrics {
  agentCount: number;
  eligibleAgents: number;
  globalEMA: number;
  threshold: number;
  consensusLatency: number;
}

interface IntelligenceMetrics {
  sona: unknown;
  reasoningBank: unknown;
  moe: unknown;
  ewc: unknown;
}

interface LearningTrajectory {
  id: string;
  agentId: string;
  sessionId: string;
  task: { id: string; type: string; description: string; constraints: string[]; acceptanceCriteria: string[]; mode: string };
  steps: Array<{ action: string; result: string; reward: number; timestamp: Date }>;
  outcome: { success: boolean; output: unknown; metrics: ExecutionMetrics };
  reward: number;
  mode: string;
  startedAt: Date;
  endedAt: Date;
}

export class OAPELEngine {
  private memory: FastStore;
  private intelligence: IntelligenceLayer;
  private coordination: CoordinationLayer;
  private scorer: ArchitectureScorer;
  private config: OAPELConfig;
  private currentCycle: OAPELCycle | null = null;
  private cycleHistory: OAPELCycle[] = [];
  private running = false;
  private intervalId: ReturnType<typeof setInterval> | undefined;
  
  constructor(
    memory: FastStore,
    intelligence: IntelligenceLayer,
    coordination: CoordinationLayer,
    scorer: ArchitectureScorer,
    config: OAPELConfig
  ) {
    this.memory = memory;
    this.intelligence = intelligence;
    this.coordination = coordination;
    this.scorer = scorer;
    this.config = config;
  }
  
  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    
    // Run initial cycle
    await this.runCycle();
    
    // Schedule recurring cycles
    this.intervalId = setInterval(() => {
      this.runCycle().catch(console.error);
    }, this.config.observeInterval);
  }
  
  async stop(): Promise<void> {
    this.running = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }
  
  async runCycle(): Promise<OAPELCycle> {
    const cycleId = `cycle-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    
    this.currentCycle = {
      id: cycleId,
      status: 'observing',
      startedAt: new Date(),
      currentPhase: 'observe',
      observations: [],
      analysis: null,
      plan: null,
      execution: null,
      learning: null
    };
    
    try {
      // PHASE 1: OBSERVE
      this.currentCycle.status = 'observing';
      this.currentCycle.currentPhase = 'observe';
      const observations = await this.observe();
      this.currentCycle.observations = observations;
      
      // PHASE 2: ANALYZE
      this.currentCycle.status = 'analyzing';
      this.currentCycle.currentPhase = 'analyze';
      const analysis = await this.analyze(observations);
      this.currentCycle.analysis = analysis;
      
      // Check if analysis meets threshold
      if (analysis.confidence < this.config.analyzeThreshold) {
        this.currentCycle.status = 'completed';
        this.currentCycle.completedAt = new Date();
        return this.finalizeCycle();
      }
      
      // PHASE 3: PLAN
      this.currentCycle.status = 'planning';
      this.currentCycle.currentPhase = 'plan';
      const plan = await this.plan(analysis);
      this.currentCycle.plan = plan;
      
      // PHASE 4: EXECUTE
      this.currentCycle.status = 'executing';
      this.currentCycle.currentPhase = 'execute';
      const execution = await this.execute(plan);
      this.currentCycle.execution = execution;
      
      // PHASE 5: LEARN
      this.currentCycle.status = 'learning';
      this.currentCycle.currentPhase = 'learn';
      const learning = await this.learn(observations, analysis, plan, execution);
      this.currentCycle.learning = learning;
      
      this.currentCycle.status = 'completed';
      this.currentCycle.completedAt = new Date();
      
    } catch (error) {
      this.currentCycle.status = 'failed';
      this.currentCycle.completedAt = new Date();
      console.error('OAPEL cycle failed:', error);
    }
    
    return this.finalizeCycle();
  }
  
  private finalizeCycle(): OAPELCycle {
    const cycle = this.currentCycle!;
    this.cycleHistory.push(cycle);
    
    // Keep history bounded
    if (this.cycleHistory.length > 100) {
      this.cycleHistory = this.cycleHistory.slice(-50);
    }
    
    this.currentCycle = null;
    
    // Persist cycle (fire-and-forget; failures must not fail the cycle)
    void this.persistCycle(cycle).catch((err: unknown) => {
      console.error('Failed to persist OAPEL cycle:', err);
    });
    
    return cycle;
  }
  
  // PHASE 1: OBSERVE
  private async observe(): Promise<Observation[]> {
    const observations: Observation[] = [];
    
    // 1. Collect architecture metrics
    const archMetrics = await this.collectArchitectureMetrics();
    observations.push({
      id: `obs-arch-${Date.now()}`,
      type: 'metric',
      source: 'architecture_scorer',
      timestamp: new Date(),
      data: archMetrics,
      severity: this.determineSeverity(archMetrics)
    });
    
    // 2. Collect performance metrics
    const perfMetrics = await this.collectPerformanceMetrics();
    observations.push({
      id: `obs-perf-${Date.now()}`,
      type: 'metric',
      source: 'performance_monitor',
      timestamp: new Date(),
      data: perfMetrics,
      severity: this.determineSeverity(perfMetrics)
    });
    
    // 3. Collect swarm/coordination metrics
    const swarmMetrics = await this.collectSwarmMetrics();
    observations.push({
      id: `obs-swarm-${Date.now()}`,
      type: 'metric',
      source: 'coordination_layer',
      timestamp: new Date(),
      data: swarmMetrics,
      severity: this.determineSeverity(swarmMetrics)
    });
    
    // 4. Collect intelligence metrics
    const intelMetrics = await this.collectIntelligenceMetrics();
    observations.push({
      id: `obs-intel-${Date.now()}`,
      type: 'metric',
      source: 'intelligence_layer',
      timestamp: new Date(),
      data: intelMetrics,
      severity: this.determineSeverity(intelMetrics)
    });
    
    // 5. Detect anomalies
    const anomalies = await this.detectAnomalies();
    for (const anomaly of anomalies) {
      observations.push({
        id: `obs-anomaly-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        type: 'anomaly',
        source: 'anomaly_detector',
        timestamp: new Date(),
        data: anomaly,
        severity: anomaly.deviation > 0.5 ? 'critical' : 'warning'
      });
    }
    
    // 6. Detect patterns
    const patterns = await this.detectPatterns();
    for (const pattern of patterns) {
      observations.push({
        id: `obs-pattern-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        type: 'pattern',
        source: 'pattern_detector',
        timestamp: new Date(),
        data: pattern,
        severity: pattern.category === 'anti-pattern' ? 'warning' : 'info'
      });
    }
    
    return observations;
  }
  
  // PHASE 2: ANALYZE
  private async analyze(observations: Observation[]): Promise<AnalysisResult> {
    const bottlenecks = this.identifyBottlenecks(observations);
    const debtItems = this.identifyDebt(observations);
    const patterns = this.extractPatterns(observations);
    const anomalies = this.filterAnomalies(observations);
    const recommendations = this.generateRecommendations(bottlenecks, debtItems, patterns, anomalies);
    
    const confidence = this.calculateAnalysisConfidence(observations);
    
    return {
      id: `analysis-${Date.now()}`,
      bottlenecks,
      debtItems,
      patterns,
      anomalies,
      recommendations,
      confidence
    };
  }
  
  // PHASE 3: PLAN
  private async plan(analysis: AnalysisResult): Promise<ExecutionPlan> {
    const tasks = this.createPlanTasks(analysis.recommendations);
    const dependencies = this.resolveDependencies(tasks);
    const rollbackPlan = this.createRollbackPlan(tasks);
    
    return {
      id: `plan-${Date.now()}`,
      tasks,
      dependencies,
      estimatedDuration: tasks.reduce((sum, t) => sum + t.estimatedDuration, 0),
      requiredAgents: [...new Set(tasks.map(t => t.agentType))],
      rollbackPlan
    };
  }
  
  // PHASE 4: EXECUTE
  private async execute(plan: ExecutionPlan): Promise<ExecutionResult> {
    const taskResults: TaskResult[] = [];
    const errors: ExecutionError[] = [];
    let success = true;
    
    // Execute tasks with concurrency control
    const semaphore = new Semaphore(this.config.executeMaxConcurrent);
    
    for (const task of plan.tasks) {
      await semaphore.acquire();
      
      try {
        const result = await this.executeTask(task);
        taskResults.push(result);
        
        if (!result.success) {
          success = false;
          errors.push({
            taskId: task.id,
            error: result.output?.error || 'Unknown error',
            recoverable: false
          });
        }
      } catch (error) {
        taskResults.push({
          taskId: task.id,
          success: false,
          output: { error: (error as Error).message },
          durationMs: 0,
          agentId: 'unknown',
          artifacts: []
        });
        success = false;
        errors.push({
          taskId: task.id,
          error: (error as Error).message,
          recoverable: false
        });
      } finally {
        semaphore.release();
      }
    }
    
    return {
      taskResults,
      success,
      durationMs: taskResults.reduce((sum, r) => sum + r.durationMs, 0),
      errors,
      metrics: {
        tasksCompleted: taskResults.filter(r => r.success).length,
        tasksFailed: taskResults.filter(r => !r.success).length,
        totalDurationMs: taskResults.reduce((sum, r) => sum + r.durationMs, 0),
        agentsUsed: new Set(taskResults.map(r => r.agentId)).size,
        memoryQueries: 0,
        toolCalls: 0
      }
    };
  }
  
  // PHASE 5: LEARN
  private async learn(
    observations: Observation[],
    analysis: AnalysisResult,
    plan: ExecutionPlan,
    execution: ExecutionResult
  ): Promise<LearningResult> {
    // Create trajectory for intelligence layer
    const _trajectory = await this.createLearningTrajectory(observations, analysis, plan, execution);
    
    // Process through intelligence layer
    const pattern = await this.intelligence.processTask({
      id: `learn-${Date.now()}`,
      type: 'learning',
      description: `Learn from OAPEL cycle`,
      constraints: [],
      acceptanceCriteria: [],
      mode: 'systems'
    });
    
    // Extract insights
    const insights = this.extractInsights(observations, analysis, execution);
    
    return {
      patternsLearned: pattern.pattern ? 1 : 0,
      patternsValidated: 0,
      patternsRejected: 0,
      knowledgeTransferred: 0,
      ewcConsolidations: pattern.pattern?.consolidated ? 1 : 0,
      sonaAdaptations: 0,
      moeRoutingUpdates: 0,
      insights
    };
  }
  
  // Helper methods
  private async collectArchitectureMetrics(): Promise<ArchitectureMetrics> {
    // Would analyze codebase using ArchitectureScorer
    return {
      overall: 75,
      dimensions: {
        maintainability: 70,
        scalability: 80,
        security: 85,
        performance: 65
      },
      fileCount: 150,
      totalLines: 45000
    };
  }
  
  private async collectPerformanceMetrics(): Promise<PerformanceMetrics> {
    return {
      hnwsSearchP99: 0.8, // ms
      batchInsert: 1.2,   // ms
      mcpResponseP95: 250, // ms
      swarmConsensus: 30,  // ms
      sonaAdaptation: 0.04 // ms
    };
  }
  
  private async collectSwarmMetrics(): Promise<SwarmMetrics> {
    const status = this.coordination.getSwarmStatus();
    const pheromoneMetrics = this.coordination.getPheromoneMetrics();
    
    return {
      agentCount: status.agentCount,
      eligibleAgents: status.eligibleAgents,
      globalEMA: pheromoneMetrics.globalEMA,
      threshold: pheromoneMetrics.threshold,
      consensusLatency: 30
    };
  }
  
  private async collectIntelligenceMetrics(): Promise<IntelligenceMetrics> {
    return this.intelligence.getStats();
  }
  
  private determineSeverity(_data: unknown): 'info' | 'warning' | 'critical' {
    // Determine severity based on data
    return 'info';
  }
  
  private async detectAnomalies(): Promise<Anomaly[]> {
    // Statistical anomaly detection
    return [];
  }
  
  private async detectPatterns(): Promise<DiscoveredPattern[]> {
    // Pattern detection from observations
    return [];
  }
  
  private identifyBottlenecks(_observations: Observation[]): Bottleneck[] {
    return [];
  }
  
  private identifyDebt(_observations: Observation[]): DebtItem[] {
    return [];
  }
  
  private extractPatterns(_observations: Observation[]): DiscoveredPattern[] {
    return [];
  }
  
  private filterAnomalies(observations: Observation[]): Anomaly[] {
    return observations
      .filter(o => o.type === 'anomaly')
      .map(o => o.data as Anomaly);
  }
  
  private generateRecommendations(
    _bottlenecks: Bottleneck[],
    _debtItems: DebtItem[],
    _patterns: DiscoveredPattern[],
    _anomalies: Anomaly[]
  ): Recommendation[] {
    return [];
  }
  
  private calculateAnalysisConfidence(_observations: Observation[]): number {
    return 0.8;
  }
  
  private createPlanTasks(recommendations: Recommendation[]): PlanTask[] {
    return recommendations.slice(0, this.config.planMaxTasks).map((rec, i) => ({
      id: `task-${i}`,
      type: rec.type,
      description: rec.description,
      targetFiles: rec.affectedFiles,
      agentType: this.mapRecommendationToAgent(rec.type),
      estimatedDuration: this.estimateDuration(rec.type),
      acceptanceCriteria: rec.estimatedImpact ? [`Performance gain: ${rec.estimatedImpact.performanceGain}%`] : [],
      rollbackAction: `Revert changes to ${rec.affectedFiles.join(', ')}`
    }));
  }
  
  private mapRecommendationToAgent(type: string): string {
    const mapping: Record<string, string> = {
      refactor: 'coder',
      optimize: 'performance-analyzer',
      secure: 'security-manager',
      test: 'tester',
      document: 'documenter'
    };
    return mapping[type] || 'coder';
  }
  
  private estimateDuration(type: string): number {
    const durations: Record<string, number> = {
      refactor: 300000,
      optimize: 180000,
      secure: 240000,
      test: 120000,
      document: 60000
    };
    return durations[type] || 180000;
  }
  
  private resolveDependencies(_tasks: PlanTask[]): TaskDependency[] {
    return [];
  }
  
  private createRollbackPlan(tasks: PlanTask[]): RollbackStep[] {
    return tasks.map(t => ({
      taskId: t.id,
      action: t.rollbackAction || `Revert ${t.targetFiles.join(', ')}`,
      verification: `Verify ${t.targetFiles.join(', ')} restored`
    }));
  }
  
  private async executeTask(task: PlanTask): Promise<TaskResult> {
    const startTime = Date.now();
    
    // Spawn agent and execute
    const agentId = await this.coordination.spawnAgent({
      type: task.agentType,
      name: `${task.agentType}-${task.id}`,
      role: 'worker'
    });
    
    // Execute task (simplified)
    const success = true; // Would actually execute
    
    return {
      taskId: task.id,
      success,
      output: { message: `Executed ${task.type} on ${task.targetFiles.join(', ')}` },
      durationMs: Date.now() - startTime,
      agentId,
      artifacts: task.targetFiles
    };
  }
  
  private async createLearningTrajectory(
    observations: Observation[],
    analysis: AnalysisResult,
    plan: ExecutionPlan,
    execution: ExecutionResult
  ): Promise<LearningTrajectory> {
    return {
      id: `traj-learn-${Date.now()}`,
      agentId: 'oapel-engine',
      sessionId: 'oapel',
      task: {
        id: 'learn-oapel',
        type: 'learning',
        description: 'Learn from OAPEL cycle',
        constraints: [],
        acceptanceCriteria: [],
        mode: 'systems'
      },
      steps: [
        { action: 'observe', result: `Collected ${observations.length} observations`, reward: 0.1, timestamp: new Date() },
        { action: 'analyze', result: `Generated ${analysis.recommendations.length} recommendations`, reward: 0.2, timestamp: new Date() },
        { action: 'plan', result: `Created plan with ${plan.tasks.length} tasks`, reward: 0.2, timestamp: new Date() },
        { action: 'execute', result: `Completed ${execution.taskResults.filter(r => r.success).length}/${execution.taskResults.length} tasks`, reward: 0.3, timestamp: new Date() }
      ],
      outcome: {
        success: execution.success,
        output: { observations, analysis, plan, execution },
        metrics: execution.metrics
      },
      reward: execution.success ? 0.8 : 0.3,
      mode: 'systems',
      startedAt: new Date(),
      endedAt: new Date()
    };
  }
  
  private extractInsights(
    _observations: Observation[],
    _analysis: AnalysisResult,
    _execution: ExecutionResult
  ): Insight[] {
    return [];
  }
  
  private async persistCycle(cycle: OAPELCycle): Promise<void> {
    await this.memory.insert([{
      id: `oapel:${cycle.id}`,
      type: 'episodic',
      tier: 2,
      content: JSON.stringify(cycle),
      embedding: new Array(384).fill(0.1),
      metadata: { domain: 'optimization', taskType: 'oapel-cycle', mode: 'systems', context: 'oapel-persistence', tags: ['oapel', 'optimization'] },
      provenance: { agentId: 'oapel-engine', sessionId: 'oapel', source: 'agent', timestamp: new Date() },
      reward: cycle.status === 'completed' ? 1 : 0,
      consolidated: false,
      accessCount: 0,
      lastAccessed: new Date(),
      createdAt: new Date()
    }]);
  }
  
  getCurrentCycle(): OAPELCycle | null {
    return this.currentCycle;
  }
  
  getCycleHistory(): OAPELCycle[] {
    return [...this.cycleHistory];
  }
  
  getConfig(): OAPELConfig {
    return { ...this.config };
  }
  
  updateConfig(updates: Partial<OAPELConfig>): void {
    this.config = { ...this.config, ...updates };
  }
}

class Semaphore {
  private permits: number;
  private waiting: Array<() => void> = [];
  
  constructor(permits: number) {
    this.permits = permits;
  }
  
  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }
    
    return new Promise(resolve => {
      this.waiting.push(resolve);
    });
  }
  
  release(): void {
    this.permits++;
    if (this.waiting.length > 0) {
      this.permits--;
      const resolve = this.waiting.shift()!;
      resolve();
    }
  }
}

export function createDefaultOAPELConfig(): OAPELConfig {
  return {
    observeInterval: 300000,      // 5 minutes
    analyzeThreshold: 0.7,
    planMaxTasks: 10,
    executeMaxConcurrent: 3,
    learnMinConfidence: 0.75,
    cycleTimeout: 600000          // 10 minutes
  };
}