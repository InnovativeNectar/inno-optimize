import { 
  SONAConfig, 
  LoRAWeights, 
  SONAAdaptation, 
  Trajectory, 
  TaskContext,
  ModeConfig 
} from '../types.js';
import { FastStore } from '@inno-optimize/agentdb';

export class SONAAdapter {
  private config: SONAConfig;
  private memory: FastStore;
  private patternCache = new Map<string, LoRAWeights>();
  private modeWeights = new Map<string, ModeConfig>();
  
  constructor(config: SONAConfig, memory: FastStore) {
    this.config = config;
    this.memory = memory;
    this.initializeModes();
  }
  
  private initializeModes(): void {
    for (const [mode, config] of Object.entries(this.config.modes)) {
      this.modeWeights.set(mode, config);
    }
  }
  
  async adapt(taskContext: TaskContext): Promise<SONAAdaptation> {
    const startTime = performance.now();
    
    // 1. Retrieve similar patterns from memory
    const patterns = await this.retrievePatterns(taskContext);
    
    if (patterns.length === 0) {
      const defaultAdaptation = this.createDefaultAdaptation(taskContext);
      defaultAdaptation.extractionTimeMs = performance.now() - startTime;
      
      if (this.config.trajectoryTracking) {
        await this.trackTrajectory(taskContext, defaultAdaptation, patterns);
      }
      
      return defaultAdaptation;
    }
    
    // 2. Select best matching pattern
    const bestPattern = patterns[0];
    
    // 3. Extract LoRA weights from pattern
    const loraWeights = await this.extractLoRA(bestPattern, taskContext);
    
    // 4. Apply mode-specific adaptation
    const adapted = this.applyModeAdaptation(loraWeights, taskContext.mode);
    
    const extractionTime = performance.now() - startTime;
    
    const adaptation: SONAAdaptation = {
      adaptedWeights: adapted,
      confidence: bestPattern.reward,
      patternId: bestPattern.id,
      mode: taskContext.mode,
      extractionTimeMs: extractionTime
    };
    
    // 5. Track trajectory
    if (this.config.trajectoryTracking) {
      await this.trackTrajectory(taskContext, adaptation, patterns);
    }
    
    return adaptation;
  }
  
  private async retrievePatterns(taskContext: TaskContext): Promise<any[]> {
    const queryVector = await this.embedTaskContext(taskContext);
    
    const results = await this.memory.search({
      vector: queryVector,
      k: 10,
      filter: { 
        mode: taskContext.mode,
        consolidated: true 
      },
      useCache: true
    });
    
    return results;
  }
  
  private async embedTaskContext(context: TaskContext): Promise<number[]> {
    // In production, use actual embedder
    // This creates a deterministic embedding from task description
    const text = `${context.type}:${context.description}:${context.mode}`;
    return this.stringToVector(text, 384);
  }
  
  private stringToVector(text: string, dim: number): number[] {
    const vector = new Float32Array(dim);
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
    }
    
    // Use hash to seed pseudo-random but deterministic values
    const seed = Math.abs(hash);
    for (let i = 0; i < dim; i++) {
      const x = Math.sin(seed + i) * 10000;
      vector[i] = x - Math.floor(x);
    }
    
    // Normalize
    let norm = 0;
    for (let i = 0; i < dim; i++) norm += (vector[i] ?? 0) * (vector[i] ?? 0);
    norm = Math.sqrt(norm);
    for (let i = 0; i < dim; i++) vector[i] = (vector[i] ?? 0) / norm;
    
    return Array.from(vector);
  }
  
  private async extractLoRA(pattern: any, taskContext: TaskContext): Promise<LoRAWeights> {
    // Check cache first
    const cacheKey = `${pattern.id}:${taskContext.mode}`;
    if (this.patternCache.has(cacheKey)) {
      return this.patternCache.get(cacheKey)!;
    }
    
    // In production, extract actual LoRA from pattern
    // Here we generate deterministic LoRA based on pattern
    const lora = this.generateLoRA(pattern, taskContext);
    
    this.patternCache.set(cacheKey, lora);
    return lora;
  }
  
  private generateLoRA(pattern: any, taskContext: TaskContext): LoRAWeights {
    const rank = this.config.loraRank;
    const alpha = this.config.loraAlpha;
    const inputDim = 384;  // embedding dimension
    const outputDim = 384;
    
    // Generate deterministic weights based on pattern
    const seed = this.hashString(pattern.id + taskContext.mode);
    
    const weightsA = this.generateMatrix(rank, inputDim, seed);
    const weightsB = this.generateMatrix(outputDim, rank, seed + 1000);
    const scales = this.generateScales(outputDim, seed + 2000);
    
    return {
      rank,
      alpha,
      weightsA,
      weightsB,
      scales,
      metadata: {
        patternId: pattern.id,
        mode: taskContext.mode,
        timestamp: Date.now(),
        reward: pattern.reward
      }
    };
  }
  
  private generateMatrix(rows: number, cols: number, seed: number): number[][] {
    const matrix: number[][] = [];
    let hash = seed;
    
    for (let i = 0; i < rows; i++) {
      const row: number[] = [];
      for (let j = 0; j < cols; j++) {
        hash = ((hash * 1664525) + 1013904223) | 0;
        const val = (hash / 0xffffffff) * 2 - 1;
        row.push(val * 0.01);  // Small initialization
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
      const val = (hash / 0xffffffff) * 0.5 + 0.75;  // 0.75-1.25
      scales.push(val);
    }
    
    return scales;
  }
  
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
  }
  
  private applyModeAdaptation(lora: LoRAWeights, mode: string): LoRAWeights {
    const modeConfig = this.modeWeights.get(mode);
    if (!modeConfig) return lora;
    
    // Scale weights by mode weight
    const scale = modeConfig.weight;
    
    return {
      ...lora,
      weightsA: lora.weightsA.map(row => row.map(v => v * scale)),
      weightsB: lora.weightsB.map(row => row.map(v => v * scale)),
      scales: lora.scales.map(s => s * scale)
    };
  }
  
  private createDefaultAdaptation(taskContext: TaskContext): SONAAdaptation {
    return {
      adaptedWeights: this.generateLoRA({ id: 'default', reward: 0.5 }, taskContext),
      confidence: 0.5,
      patternId: 'default',
      mode: taskContext.mode,
      extractionTimeMs: 0
    };
  }
  
  private async trackTrajectory(
    taskContext: TaskContext, 
    adaptation: SONAAdaptation, 
    patterns: any[]
  ): Promise<void> {
    const trajectory: Trajectory = {
      id: `traj-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      agentId: 'sona-adapter',
      sessionId: 'current',
      task: taskContext,
      steps: [
        {
          action: 'pattern_retrieval',
          result: `Retrieved ${patterns.length} patterns`,
          reward: 0.1,
          timestamp: new Date()
        },
        {
          action: 'lora_extraction',
          result: `Extracted LoRA from ${adaptation.patternId}`,
          reward: 0.2,
          timestamp: new Date()
        },
        {
          action: 'mode_adaptation',
          result: `Applied ${adaptation.mode} mode`,
          reward: 0.2,
          timestamp: new Date()
        }
      ],
      outcome: {
        success: true,
        output: adaptation,
        metrics: { latencyMs: adaptation.extractionTimeMs, toolCalls: 0, memoryQueries: patterns.length }
      },
      reward: adaptation.confidence,
      mode: taskContext.mode,
      startedAt: new Date(Date.now() - adaptation.extractionTimeMs),
      endedAt: new Date()
    };
    
    // Store trajectory for ReasoningBank
    await this.memory.insert([{
      id: trajectory.id,
      type: 'episodic',
      tier: 2,
      content: JSON.stringify(trajectory),
      embedding: await this.embedTaskContext(taskContext),
      metadata: {
        domain: 'intelligence',
        taskType: 'sona-adaptation',
        mode: taskContext.mode,
        context: taskContext.description,
        tags: ['trajectory', 'sona']
      },
      provenance: {
        agentId: 'sona-adapter',
        sessionId: 'current',
        source: 'agent',
        timestamp: new Date()
      },
      reward: adaptation.confidence,
      verdict: 'success',
      loraWeights: adaptation.adaptedWeights,
      consolidated: false,
      accessCount: 0,
      lastAccessed: new Date(),
      createdAt: new Date()
    }]);
  }
  
  // Apply LoRA to model (placeholder for actual model integration)
  applyLoRAToModel(baseWeights: number[][], lora: LoRAWeights): number[][] {
    const result: number[][] = [];
    
    for (let i = 0; i < baseWeights.length; i++) {
      const row: number[] = [];
      const baseRow = baseWeights[i] ?? [];
      for (let j = 0; j < baseRow.length; j++) {
        let loraContribution = 0;
        
        // LoRA: B @ A @ x
        for (let r = 0; r < lora.rank; r++) {
          const bRow = lora.weightsB[i];
          const aRow = lora.weightsA[r];
          if (bRow && aRow && r < bRow.length && j < aRow.length) {
            loraContribution += (bRow[r] ?? 0) * (aRow[j] ?? 0) * (lora.scales[i] ?? 0);
          }
        }
        
        row.push((baseRow[j] ?? 0) + (lora.alpha / lora.rank) * loraContribution);
      }
      result.push(row);
    }
    
    return result;
  }
  
  getConfig(): SONAConfig {
    return { ...this.config };
  }
  
  updateConfig(updates: Partial<SONAConfig>): void {
    this.config = { ...this.config, ...updates };
    this.initializeModes();
  }
}

export function createDefaultSONAConfig(): SONAConfig {
  return {
    learningRate: 0.01,
    adaptiveLR: true,
    maxPatterns: 10000,
    loraRank: 64,
    loraAlpha: 16,
    extractionTimeBudget: 0.05,
    modes: {
      convergent: { weight: 1.0, description: 'Focused, analytical', temperature: 0.3 },
      divergent: { weight: 1.2, description: 'Creative, exploratory', temperature: 0.9 },
      lateral: { weight: 1.1, description: 'Cross-domain connection', temperature: 0.7 },
      systems: { weight: 1.3, description: 'Holistic, architectural', temperature: 0.5 },
      critical: { weight: 0.9, description: 'Security, verification', temperature: 0.2 }
    },
    trajectoryTracking: true,
    verdictJudgment: true,
    distillationEnabled: true,
    ewcConsolidation: true
  };
}