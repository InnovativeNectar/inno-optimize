import type { 
  EWCConfig, 
  FisherInfo, 
  ConsolidationTask,
  ReasoningPattern,
  LoRAWeights
} from '../types.js';
import type { FastStore } from '@inno-optimize/agentdb';
import type { MemoryEntry } from '@inno-optimize/agentdb';

export class EWCConsolidator {
  private config: EWCConfig;
  private memory: FastStore;
  private fisherMatrix = new Map<string, FisherInfo>();
  private consolidationQueue: ConsolidationTask[] = [];
  private isProcessing = false;
  
  constructor(config: EWCConfig, memory: FastStore) {
    this.config = config;
    this.memory = memory;
  }

  private memoryEntryToPattern(entry: MemoryEntry): ReasoningPattern {
    const ewcImportance: number[] = entry.ewcImportance ?? [];
    return {
      id: entry.id,
      title: entry.metadata?.domain || 'Unknown',
      description: entry.content,
      content: entry.content,
      reward: entry.reward ?? 0,
      mode: entry.metadata?.mode || 'systems',
      verdict: entry.verdict ?? 'success',
      loraWeights: entry.loraWeights ?? { rank: 0, alpha: 0, weightsA: [], weightsB: [], scales: [], metadata: { patternId: '', mode: '', timestamp: 0, reward: 0 } },
      consolidated: entry.consolidated ?? false,
      createdAt: entry.createdAt,
      ewcImportance,
      metadata: entry.metadata
    };
  }

  // Main consolidation entry point
  async consolidate(pattern: ReasoningPattern | MemoryEntry): Promise<void> {
    const patternObj = 'loraWeights' in pattern ? pattern as ReasoningPattern : this.memoryEntryToPattern(pattern);
    const paramKey = `pattern:${patternObj.id}`;
    
    // 1. Compute Fisher Information (diagonal approximation)
    const fisher = await this.computeFisherDiagonal(patternObj);
    
    // 2. Store Fisher info and optimal parameters
    this.fisherMatrix.set(paramKey, {
      paramKey,
      fisherDiagonal: fisher,
      optimalParams: this.flattenLoRA(patternObj.loraWeights),
      lastUpdated: new Date()
    });
    
    // 3. Register quadratic penalty in loss function
    this.registerPenalty(paramKey, fisher);
    
    // 4. Update pattern as consolidated (upsert: the pattern may not be
    // persisted yet when consolidate() is called directly)
    const existing = await this.memory.getById(patternObj.id);
    if (existing) {
      await this.memory.update(patternObj.id, {
        ewcImportance: fisher,
        consolidated: true,
        consolidatedAt: new Date()
      });
    } else {
      await this.memory.insert([this.patternToMemoryEntry(patternObj, fisher)]);
    }
    
    patternObj.consolidated = true;
    patternObj.ewcImportance = fisher;
  }
  
  private patternToMemoryEntry(pattern: ReasoningPattern, fisher: number[]): MemoryEntry {
    return {
      id: pattern.id,
      type: 'semantic',
      tier: 3,
      content: pattern.content,
      embedding: this.stringToVector(pattern.description || pattern.id, 384),
      metadata: {
        domain: pattern.metadata?.domain ?? 'general',
        taskType: 'ewc-pattern',
        mode: pattern.mode,
        context: pattern.description,
        tags: ['ewc', pattern.verdict]
      },
      provenance: {
        agentId: 'ewc-consolidator',
        sessionId: 'ewc-consolidator',
        source: 'distillation',
        timestamp: new Date()
      },
      reward: pattern.reward,
      verdict: pattern.verdict,
      loraWeights: pattern.loraWeights,
      ewcImportance: fisher,
      consolidated: true,
      consolidatedAt: new Date(),
      accessCount: 0,
      lastAccessed: new Date(),
      createdAt: pattern.createdAt
    };
  }
  
  // Compute Fisher Information diagonal
  private async computeFisherDiagonal(pattern: ReasoningPattern): Promise<number[]> {
    const lora = pattern.loraWeights;
    const params = this.flattenLoRA(lora);
    const gradients = await this.computeGradients(pattern, params);
    
    let fisher = gradients.map(g => g * g);
    
    // Gradient vanishing fix for high-confidence predictions
    if (this.config.gradientVanishingFix) {
      const confidence = pattern.reward ?? 0;
      fisher = fisher.map(f => f * (1 + confidence));
    }
    
    return fisher;
  }
  
  private async computeGradients(pattern: ReasoningPattern, params: number[]): Promise<number[]> {
    // In production, compute actual gradients from model
    // Here we simulate based on pattern characteristics
    const gradients: number[] = [];
    
    for (let i = 0; i < params.length; i++) {
      // Gradient magnitude based on parameter importance
      const baseGrad = Math.abs(params[i] ?? 0) * 0.1;
      
      // Modulate by pattern reward
      const rewardMod = pattern.reward ?? 0;
      
      // Add noise for parameter-specific variation
      const noise = (Math.sin((pattern.id?.length ?? 0) + i) - 0.5) * 0.2;
      
      gradients.push(baseGrad * rewardMod + noise);
    }
    
    return gradients;
  }
  
  private flattenLoRA(lora: LoRAWeights): number[] {
    const flat: number[] = [];
    
    // Flatten weightsA [rank, input_dim]
    for (const row of lora.weightsA ?? []) {
      flat.push(...row);
    }
    
    // Flatten weightsB [output_dim, rank]
    for (const row of lora.weightsB ?? []) {
      flat.push(...row);
    }
    
    // Add scales
    flat.push(...(lora.scales ?? []));
    
    return flat;
  }
  
  private registerPenalty(paramKey: string, fisher: number[]): void {
    // In production, this registers the penalty in the training loss
    // The EWC loss term: λ/2 * Σ F_i (θ_i - θ*_i)^2
    console.log(`Registered EWC penalty for ${paramKey} with ${fisher.length} parameters, λ=${this.config.lambda}`);
  }
  
  // Compute EWC loss for current parameters
  computeEWCLoss(currentParams: Map<string, number[]>): number {
    let loss = 0;
    
    for (const [key, params] of currentParams) {
      const fisherInfo = this.fisherMatrix.get(key);
      if (!fisherInfo) continue;
      
      const { fisherDiagonal, optimalParams } = fisherInfo;
      
      for (let i = 0; i < params.length && i < optimalParams.length; i++) {
        const diff = (params[i] ?? 0) - (optimalParams[i] ?? 0);
        const fisherVal = fisherDiagonal[i];
        const fisherValSafe = fisherVal !== undefined ? fisherVal : 0;
        loss += this.config.lambda * fisherValSafe * diff * diff;
      }
    }
    
    return loss / 2; // Standard EWC formulation
  }
  
  // Online Fisher updates (incremental)
  async onlineUpdate(pattern: ReasoningPattern, newGradients: number[]): Promise<void> {
    const paramKey = `pattern:${pattern.id}`;
    const existing = this.fisherMatrix.get(paramKey);
    
    if (!existing) {
      // First update - initialize
      await this.consolidate(pattern);
      return;
    }
    
    // Exponential moving average of Fisher
    const alpha = 0.1; // Update rate
    for (let i = 0; i < existing.fisherDiagonal.length && i < newGradients.length; i++) {
      const grad = newGradients[i] ?? 0;
      const newFisher = grad * grad;
      const existingVal = existing.fisherDiagonal[i];
      const existingValSafe = existingVal !== undefined ? existingVal : 0;
      existing.fisherDiagonal[i] = (1 - alpha) * existingValSafe + alpha * newFisher;
    }
    
    existing.lastUpdated = new Date();
  }
  
  // Batch consolidation for multiple patterns
  async consolidateBatch(patterns: ReasoningPattern[]): Promise<void> {
    for (const pattern of patterns) {
      await this.consolidate(pattern);
    }
  }
  
  // Scheduled consolidation
  startConsolidationScheduler(): void {
    setInterval(() => {
      void this.runScheduledConsolidation();
    }, this.config.consolidationInterval);
  }
  
  private async runScheduledConsolidation(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;
    
    try {
      await this.processQueue();
    } catch (e) {
      console.error('Consolidation error:', e);
    } finally {
      this.isProcessing = false;
    }
  }
  
  private async processQueue(): Promise<void> {
    // Process cross-domain transfers
    const transferTasks = this.consolidationQueue.filter(t => t.type === 'cross-domain');
    for (const task of transferTasks) {
      if (task.sourceDomain && task.targetDomain) {
        await this.transferKnowledge(task.sourceDomain, task.targetDomain);
      }
    }
    
    // Process full consolidation
    const fullTasks = this.consolidationQueue.filter(t => t.type === 'full');
    for (const task of fullTasks) {
      await this.consolidateBatch(task.patterns);
    }
    
    // Clear processed tasks
    this.consolidationQueue = this.consolidationQueue.filter(
      t => t.type !== 'cross-domain' && t.type !== 'full'
    );
  }
  
  // Queue consolidation task
  queueTask(task: ConsolidationTask): void {
    this.consolidationQueue.push(task);
    
    // Sort by priority
    const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
    this.consolidationQueue.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  }
  
  // Knowledge transfer between domains
  async transferKnowledge(sourceDomain: string, targetDomain: string): Promise<number> {
    const sourcePatterns = await this.memory.search({
      vector: await this.embedDomain(sourceDomain),
      k: 100,
      filter: { domain: sourceDomain, consolidated: true }
    });
    
    let transferred = 0;
    for (const pattern of sourcePatterns) {
      const adapted = await this.adaptPattern(this.memoryEntryToPattern(pattern), targetDomain);
      await this.memory.insert([adapted]);
      transferred++;
    }
    
    return transferred;
  }
  
  private async adaptPattern(pattern: ReasoningPattern, targetDomain: string): Promise<MemoryEntry> {
    // Generate new embedding for target domain
    const newEmbedding = await this.embedDomain(targetDomain);
    
    return {
      ...pattern,
      id: `transfer-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      embedding: newEmbedding,
      metadata: {
        ...(pattern.metadata ?? {}),
        domain: targetDomain,
        transferredFrom: pattern.metadata?.domain,
        transferredAt: new Date()
      },
      consolidated: false,
      ewcImportance: undefined
    } as unknown as MemoryEntry;
  }
  
  private async embedDomain(domain: string): Promise<number[]> {
    // In production, use actual embedder
    return this.stringToVector(domain, 384);
  }
  
  private stringToVector(text: string, dim: number): number[] {
    const vector = new Float32Array(dim);
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
    }
    
    const seed = Math.abs(hash);
    for (let i = 0; i < dim; i++) {
      const x = Math.sin(seed + i) * 10000;
      vector[i] = x - Math.floor(x);
    }
    
    let norm = 0;
    for (let i = 0; i < dim; i++) {
      const val = vector[i] ?? 0;
      norm += val * val;
    }
    norm = Math.sqrt(norm);
    for (let i = 0; i < dim; i++) {
      vector[i] = (vector[i] ?? 0) / norm;
    }
    
    return Array.from(vector);
  }
  
  // Get consolidation statistics
  getStats(): { 
    totalPatterns: number; 
    consolidatedPatterns: number; 
    totalParameters: number;
    averageFisherNorm: number;
    queueLength: number;
  } {
    let totalParams = 0;
    let fisherNormSum = 0;
    
    for (const info of this.fisherMatrix.values()) {
      totalParams += info.fisherDiagonal.length;
      fisherNormSum += Math.sqrt(
        info.fisherDiagonal.reduce((sum, f) => sum + f * f, 0)
      );
    }
    
    return {
      totalPatterns: this.fisherMatrix.size,
      consolidatedPatterns: Array.from(this.fisherMatrix.values()).filter(
        f => f.lastUpdated > new Date(Date.now() - 86400000)
      ).length,
      totalParameters: totalParams,
      averageFisherNorm: this.fisherMatrix.size > 0 ? fisherNormSum / this.fisherMatrix.size : 0,
      queueLength: this.consolidationQueue.length
    };
  }
  
  // Get Fisher info for a specific pattern
  getFisherInfo(paramKey: string): FisherInfo | undefined {
    return this.fisherMatrix.get(paramKey);
  }
  
  // Check if pattern is protected from forgetting
  isProtected(patternId: string): boolean {
    const info = this.fisherMatrix.get(`pattern:${patternId}`);
    if (!info) return false;
    
    const avgFisher = info.fisherDiagonal.reduce((a, b) => a + b, 0) / info.fisherDiagonal.length;
    return avgFisher > 0.5; // High Fisher = important = protected
  }
}

export function createDefaultEWCConfig(): EWCConfig {
  return {
    lambda: 10,
    fisherDiagonal: true,
    gradientVanishingFix: true,
    onlineUpdate: true,
    consolidationInterval: 3600000 // 1 hour
  };
}