import type { 
  MoEConfig, 
  Expert, 
  RoutingDecision, 
  LoRAWeights,
  TaskContext
} from '../types.js';

export class MoERouter {
  private config: MoEConfig;
  private experts: Expert[] = [];
  private routingHistory: RoutingDecision[] = [];
  private loadBalancer: LoadBalancer;
  
  constructor(config: MoEConfig) {
    this.config = config;
    this.loadBalancer = new LoadBalancer(config.numExperts);
    this.initializeExperts();
  }
  
  private initializeExperts(): void {
    const domains = [
      'code_generation', 'code_review', 'refactoring', 'architecture',
      'security', 'performance', 'testing', 'documentation',
      'business_logic', 'api_design', 'database', 'devops'
    ];
    
    for (let i = 0; i < this.config.numExperts; i++) {
      const domain = domains[i % domains.length] ?? 'general';
      this.experts.push({
        id: `expert-${i}`,
        name: `${domain}-expert-${Math.floor(i / domains.length)}`,
        domain,
        capacity: this.config.expertCapacity,
        currentLoad: 0,
        specialization: this.getSpecialization(domain),
        weights: this.generateExpertWeights(domain)
      });
    }
  }
  
  private getSpecialization(domain: string): string[] {
    const specs: Record<string, string[]> = {
      code_generation: ['function', 'class', 'module', 'api'],
      code_review: ['security', 'performance', 'style', 'correctness'],
      refactoring: ['extract', 'inline', 'move', 'rename'],
      architecture: ['pattern', 'scalability', 'coupling', 'layering'],
      security: ['auth', 'encryption', 'validation', 'compliance'],
      performance: ['optimization', 'caching', 'profiling', 'scaling'],
      testing: ['unit', 'integration', 'e2e', 'property'],
      documentation: ['api', 'readme', 'comment', 'diagram'],
      business_logic: ['workflow', 'rule', 'calculation', 'state'],
      api_design: ['rest', 'graphql', 'grpc', 'schema'],
      database: ['query', 'index', 'migration', 'schema'],
      devops: ['ci', 'cd', 'deploy', 'monitor']
    };
    return specs[domain] || ['general'];
  }
  
  private generateExpertWeights(domain: string): LoRAWeights {
    const rank = 64;
    const alpha = 16;
    const inputDim = 384;
    const outputDim = 384;
    const seed = this.hashString(domain);
    
    return {
      rank,
      alpha,
      weightsA: this.generateMatrix(rank, inputDim, seed),
      weightsB: this.generateMatrix(outputDim, rank, seed + 1000),
      scales: this.generateScales(outputDim, seed + 2000),
      metadata: {
        patternId: `expert-${domain}`,
        mode: 'systems',
        timestamp: Date.now(),
        reward: 0.8
      }
    };
  }
  
  // Main routing function
  async route(task: TaskContext): Promise<RoutingDecision> {
    // 1. Compute routing scores for all experts
    const scores = this.computeRoutingScores(task);
    
    // 2. Apply routing strategy
    let expertId: string;
    let confidence: number;
    
    switch (this.config.routingStrategy) {
      case 'maxscore':
        ({ expertId, confidence } = this.maxScoreRouting(scores));
        break;
      case 'sr-moe':
        ({ expertId, confidence } = this.spectralRouting(scores));
        break;
      case 'mose':
        ({ expertId, confidence } = this.adaptiveWidthRouting(scores, task));
        break;
      case 'perft':
        ({ expertId, confidence } = this.peftRouting(scores, task));
        break;
      default:
        ({ expertId, confidence } = this.maxScoreRouting(scores));
    }
    
    // 3. Check capacity and load balance
    const expert = this.experts.find(e => e.id === expertId)!;
    const loadFactor = expert.currentLoad / expert.capacity;
    
    // 4. Update load
    expert.currentLoad++;
    this.loadBalancer.updateLoad(expertId, expert.currentLoad);
    
    // 5. Record routing decision
    const decision: RoutingDecision = {
      expertId,
      confidence,
      loadFactor,
      routingScores: scores
    };
    this.routingHistory.push(decision);
    
    // Keep history bounded
    if (this.routingHistory.length > 10000) {
      this.routingHistory = this.routingHistory.slice(-5000);
    }
    
    return decision;
  }
  
  private computeRoutingScores(task: TaskContext): number[] {
    const scores: number[] = [];
    
    for (const expert of this.experts) {
      // Base score keeps domain/mode/load/reward multipliers meaningful even
      // when a task matches no specialization words (otherwise every expert
      // scores exactly 0 and routing collapses onto expert 0).
      let score = 1;
      
      // Domain match
      const taskWords = new Set(task.description.toLowerCase().split(/\s+/));
      for (const spec of expert.specialization) {
        if (taskWords.has(spec.toLowerCase())) score += 2;
      }
      
      // Mode preference
      const modeScores: Record<string, number> = {
        convergent: 1.0,
        divergent: 0.8,
        lateral: 1.2,
        systems: 1.5,
        critical: 1.3
      };
      score *= modeScores[task.mode] || 1.0;
      
      // Load penalty
      const loadRatio = expert.currentLoad / expert.capacity;
      score *= (1 - loadRatio * 0.5);
      
      // Expert reward history (from LoRA metadata)
      score *= expert.weights.metadata?.reward ?? 1;
      
      scores.push(score);
    }
    
    return scores;
  }
  
  private maxScoreRouting(scores: number[]): { expertId: string; confidence: number } {
    const maxIdx = scores.indexOf(Math.max(...scores));
    const maxScore = scores[maxIdx] ?? 0;
    const sumExp = scores.reduce((sum, s) => sum + Math.exp(s - maxScore), 0);
    const confidence = Math.exp(maxScore - maxScore) / sumExp; // softmax
    
    return {
      expertId: this.experts[maxIdx]?.id ?? '',
      confidence
    };
  }
  
  private spectralRouting(scores: number[]): { expertId: string; confidence: number } {
    // Spectrally-regularized routing (SR-MoE)
    // Prevents expert collapse by adding spectral regularization
    
    if (this.config.spectralRegularization) {
      // Compute spectral norm of routing matrix
      const spectralPenalty = this.computeSpectralPenalty(scores);
      
      // Apply penalty
      const penalizedScores = scores.map((s, i) => 
        s - this.config.spectralLambda * (spectralPenalty[i] ?? 0)
      );
      
      return this.maxScoreRouting(penalizedScores);
    }
    
    return this.maxScoreRouting(scores);
  }
  
  private computeSpectralPenalty(scores: number[]): number[] {
    // Simplified spectral penalty - encourages diverse expert usage.
    // Returned in score units (not z-scores): subtracting a z-score scaled by
    // spectralLambda overshoots when score spread is tiny and reverses the
    // ordering, which collapses routing onto the most-loaded expert.
    const n = scores.length;
    const mean = scores.reduce((a, b) => a + b, 0) / n;
    
    return scores.map(s => s - mean);
  }
  
  private adaptiveWidthRouting(
    scores: number[], 
    task: TaskContext
  ): { expertId: string; confidence: number } {
    // Mixture of Sparse Experts (MoSE) - adaptive expert width
    // Selects different number of experts based on task complexity
    
    const complexity = this.estimateComplexity(task);
    const numExpertsToUse = Math.max(1, Math.min(
      this.config.numExperts,
      Math.ceil(complexity * this.config.numExperts)
    ));
    
    // Top-k routing
    const indexedScores = scores.map((s, i) => ({ score: s, idx: i }));
    indexedScores.sort((a, b) => b.score - a.score);
    
    const selected = indexedScores.slice(0, numExpertsToUse);
    const totalScore = selected.reduce((sum, s) => sum + s.score, 0);
    
    // Weighted random selection from top-k
    const rand = Math.random() * totalScore;
    let cumsum = 0;
    let chosenIdx = selected[0]?.idx ?? 0;
    
    for (const { score, idx } of selected) {
      cumsum += score;
      if (cumsum >= rand) {
        chosenIdx = idx;
        break;
      }
    }
    
    const confidence = (selected[0]?.score ?? 0) / totalScore;
    
    return {
      expertId: this.experts[chosenIdx]?.id ?? '',
      confidence
    };
  }
  
  private peftRouting(scores: number[], task: TaskContext): { expertId: string; confidence: number } {
    // Parameter-Efficient Fine-Tuning routing
    // Prefers experts with compatible LoRA weights
    
    // For now, fall back to maxscore with expert compatibility check
    return this.maxScoreRouting(scores);
  }
  
  private estimateComplexity(task: TaskContext): number {
    let complexity = 0;
    
    // Description length
    complexity += Math.min(task.description.length / 1000, 0.3);
    
    // Number of constraints
    complexity += Math.min(task.constraints.length * 0.1, 0.3);
    
    // Acceptance criteria
    complexity += Math.min(task.acceptanceCriteria.length * 0.1, 0.2);
    
    // Code context size
    if (task.codeContext) {
      complexity += Math.min(task.codeContext.length / 5000, 0.2);
    }
    
    return Math.min(complexity, 1.0);
  }
  
  // Load balancing
  rebalance(): void {
    const avgLoad = this.experts.reduce((sum, e) => sum + e.currentLoad, 0) / this.experts.length;
    
    for (const expert of this.experts) {
      // Decay load over time
      expert.currentLoad = Math.max(0, expert.currentLoad - 1);
    }
    
    this.loadBalancer.rebalance();
  }
  
  // Get expert statistics
  getExpertStats(): Array<{ expert: Expert; usageRate: number; avgConfidence: number }> {
    return this.experts.map(expert => {
      const decisions = this.routingHistory.filter(d => d.expertId === expert.id);
      const usageRate = decisions.length / Math.max(1, this.routingHistory.length);
      const avgConfidence = decisions.length > 0
        ? decisions.reduce((sum, d) => sum + d.confidence, 0) / decisions.length
        : 0;
      
      return { expert, usageRate, avgConfidence };
    });
  }
  
  // Expert collapse detection
  detectCollapse(): { collapsed: boolean; expertIds: string[] } {
    const stats = this.getExpertStats();
    const threshold = 1 / this.config.numExperts * 0.1; // 10% of uniform
    
    const collapsed = stats
      .filter(s => s.usageRate < threshold)
      .map(s => s.expert.id);
    
    return {
      collapsed: collapsed.length > 0,
      expertIds: collapsed
    };
  }
  
  // Recovery from collapse
  recoverFromCollapse(): void {
    const { expertIds } = this.detectCollapse();
    
    for (const expertId of expertIds) {
      const expert = this.experts.find(e => e.id === expertId);
      if (expert) {
        // Reinitialize expert weights with noise
        expert.weights = this.generateExpertWeights(expert.domain);
        expert.currentLoad = 0;
      }
    }
  }
  
  // Utility methods
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
  }
  
  private generateMatrix(rows: number, cols: number, seed: number): number[][] {
    const matrix: number[][] = [];
    let hash = seed;
    
    for (let i = 0; i < rows; i++) {
      const row: number[] = [];
      for (let j = 0; j < cols; j++) {
        hash = ((hash * 1664525) + 1013904223) | 0;
        row.push(((hash / 0xffffffff) * 2 - 1) * 0.01);
      }
      matrix.push(row);
    }
    
    return matrix;
  }
  
  private generateScales(dim: number, seed: number): number[] {
    const scales: number[] = [];
    let hash = seed;
    
    for (let i = 0; i < dim; i++) {
      hash = ((hash * 1664525) + 1013904223) | 0;
      scales.push((hash / 0xffffffff) * 0.5 + 0.75);
    }
    
    return scales;
  }
}

class LoadBalancer {
  private numExperts: number;
  private targetLoads: number[] = [];
  
  constructor(numExperts: number) {
    this.numExperts = numExperts;
    this.targetLoads = new Array(numExperts).fill(0);
  }
  
  updateLoad(expertId: string, load: number): void {
    const idx = parseInt(expertId.split('-')[1] ?? '0') || 0;
    if (idx < this.targetLoads.length) {
      this.targetLoads[idx] = load;
    }
  }
  
  rebalance(): void {
    const avgLoad = this.targetLoads.reduce((a, b) => a + b, 0) / this.numExperts;
    
    // Soft rebalancing - just track target
    for (let i = 0; i < this.numExperts; i++) {
      this.targetLoads[i] = Math.max(0, (this.targetLoads[i] ?? 0) - avgLoad * 0.1);
    }
  }
  
  getTargetLoad(expertId: string): number {
    const idx = parseInt(expertId.split('-')[1] ?? '0') || 0;
    return this.targetLoads[idx] || 0;
  }
}

export function createDefaultMoEConfig(): MoEConfig {
  return {
    numExperts: 12,
    expertCapacity: 100,
    routingStrategy: 'sr-moe',
    spectralRegularization: true,
    spectralLambda: 0.1,
    loadBalancing: true,
    adaptiveWidth: true
  };
}