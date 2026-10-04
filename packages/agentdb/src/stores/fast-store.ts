import { AgentDB } from '@ruvector/agentdb';
import { HNSWIndex, Quantizer, cosineSimilarity } from '../hnsw/index';
import { MemoryEntry, SearchQuery, SearchResult, FastStoreConfig } from '../types';

export class WorkingMemoryCache {
  private cache = new Map<string, MemoryEntry>();
  private accessOrder = new Set<string>();
  private maxSize: number;
  private ttlMs: number;
  
  constructor(config: { maxSize: number; ttlMs: number }) {
    this.maxSize = config.maxSize;
    this.ttlMs = config.ttlMs;
  }
  
  get(key: string): MemoryEntry | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    // Check TTL
    if (Date.now() - entry.lastAccessed.getTime() > this.ttlMs) {
      this.cache.delete(key);
      this.accessOrder.delete(key);
      return null;
    }
    
    // Update access order (LRU)
    this.accessOrder.delete(key);
    this.accessOrder.add(key);
    entry.lastAccessed = new Date();
    entry.accessCount++;
    
    return entry;
  }
  
  set(key: string, entry: MemoryEntry): void {
    // Evict if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const oldest = this.accessOrder.values().next().value;
      if (oldest) {
        this.accessOrder.delete(oldest);
        this.cache.delete(oldest);
      }
    }
    
    this.cache.set(key, entry);
    this.accessOrder.add(key);
  }
  
  clear(): void {
    this.cache.clear();
    this.accessOrder.clear();
  }
  
  size(): number {
    return this.cache.size;
  }
}

export class FastStore {
  private db: AgentDB;
  private hnsw: HNSWIndex;
  private quantizer: Quantizer;
  private cache: WorkingMemoryCache;
  private config: FastStoreConfig;
  
  constructor(config: FastStoreConfig) {
    this.config = config;
    
    // Initialize AgentDB
    this.db = new AgentDB({
      path: config.path,
      dimensions: config.dimensions,
      metric: 'cosine'
    });
    
    // Initialize HNSW
    this.quantizer = new Quantizer({
      defaultLevel: config.quantization.defaultLevel,
      levels: {
        none: { bits: 32, compression: 1 },
        pq8: { bits: 8, compression: 4, subvectors: 16 },
        pq4: { bits: 4, compression: 8, subvectors: 16 },
        binary: { bits: 1, compression: 32 },
        rabitq: { bits: 1, compression: 32, codebookSize: 256 }
      }
    });
    
    this.hnsw = new HNSWIndex({
      M: config.hnsw.M,
      efConstruction: config.hnsw.efConstruction,
      efSearch: config.hnsw.efSearch,
      dimensions: config.dimensions
    }, this.quantizer);
    
    // Initialize cache
    this.cache = new WorkingMemoryCache({
      maxSize: config.cache.maxSize,
      ttlMs: config.cache.ttlMs
    });
  }
  
  async initialize(): Promise<void> {
    await this.db.open();
    // Load existing vectors into HNSW
    const allEntries = await this.db.getAll();
    for (const entry of allEntries) {
      this.hnsw.add(entry.id, entry.embedding);
    }
  }
  
  async insert(entries: MemoryEntry[]): Promise<void> {
    if (entries.length === 0) return;
    
    // Quantize embeddings
    const quantized = await Promise.all(
      entries.map(e => this.quantizer.quantize(e.embedding, this.config.quantization.defaultLevel))
    );
    
    // Store in AgentDB
    const dbEntries = entries.map((e, i) => ({
      ...e,
      embedding: Array.from(quantized[i])
    }));
    await this.db.insert(dbEntries);
    
    // Add to HNSW index
    for (let i = 0; i < entries.length; i++) {
      this.hnsw.add(entries[i].id, Array.from(quantized[i]));
    }
    
    // Update cache
    for (const entry of entries) {
      this.cache.set(entry.id, entry);
    }
  }
  
  async search(query: SearchQuery): Promise<MemoryEntry[]> {
    const vectorHash = query.vectorHash || this.hashVector(query.vector);
    
    // 1. Check cache first
    if (query.useCache !== false) {
      const cached = this.cache.get(vectorHash);
      if (cached) return [cached];
    }
    
    // 2. HNSW search
    const hnswResults = this.hnsw.search(query.vector, query.k || 10);
    
    if (hnswResults.length === 0) return [];
    
    // 3. Fetch full entries from AgentDB
    const ids = hnswResults.map(r => r.id);
    const entries = await this.db.getByIds(ids);
    
    // 4. Hybrid re-ranking
    const reranked = await this.hybridRerank(query, entries, hnswResults);
    
    // 5. Update cache
    if (reranked.length > 0) {
      this.cache.set(vectorHash, reranked[0]);
    }
    
    return reranked;
  }
  
  private async hybridRerank(
    query: SearchQuery,
    entries: MemoryEntry[],
    hnswResults: Array<{ id: string; distance: number }>
  ): Promise<MemoryEntry[]> {
    // Create distance map
    const distanceMap = new Map(hnswResults.map(r => [r.id, r.distance]));
    
    // Score each entry
    const scored = entries.map(entry => {
      const hnswDistance = distanceMap.get(entry.id) || 1;
      const cosineScore = 1 - hnswDistance; // Convert distance to similarity
      
      let combinedScore = cosineScore;
      
      // Add BM25 if text query provided
      if (query.textQuery) {
        const bm25Score = this.bm25Score(query.textQuery, entry.content);
        combinedScore = 0.7 * cosineScore + 0.3 * bm25Score;
      }
      
      // Apply reward weighting
      combinedScore *= (0.5 + 0.5 * entry.reward);
      
      return { entry, score: combinedScore };
    });
    
    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);
    
    // Apply MMR for diversity
    return this.mmrRerank(scored.map(s => s.entry), scored.map(s => s.score), {
      alpha: 0.7,
      lambda: 0.7
    });
  }
  
  private mmrRerank(
    entries: MemoryEntry[],
    scores: number[],
    params: { alpha: number; lambda: number }
  ): MemoryEntry[] {
    if (entries.length <= 1) return entries;
    
    const selected: MemoryEntry[] = [];
    const remaining = [...entries];
    const remainingScores = [...scores];
    
    // Select first (highest score)
    selected.push(remaining.shift()!);
    remainingScores.shift();
    
    while (remaining.length > 0) {
      let bestIdx = -1;
      let bestScore = -Infinity;
      
      for (let i = 0; i < remaining.length; i++) {
        // Compute max similarity to already selected
        let maxSim = 0;
        for (const sel of selected) {
          const sim = cosineSimilarity(remaining[i].embedding, sel.embedding);
          maxSim = Math.max(maxSim, sim);
        }
        
        // MMR score: alpha * relevance - lambda * max_similarity
        const mmrScore = params.alpha * remainingScores[i] - params.lambda * maxSim;
        
        if (mmrScore > bestScore) {
          bestScore = mmrScore;
          bestIdx = i;
        }
      }
      
      if (bestIdx >= 0) {
        selected.push(remaining.splice(bestIdx, 1)[0]);
        remainingScores.splice(bestIdx, 1);
      } else {
        break;
      }
    }
    
    return selected;
  }
  
  private bm25Score(query: string, document: string): number {
    const k1 = 1.2;
    const b = 0.75;
    
    const queryTerms = query.toLowerCase().split(/\s+/);
    const docTerms = document.toLowerCase().split(/\s+/);
    const docLength = docTerms.length;
    const avgDocLength = 100; // Approximate
    
    // Build term frequency
    const tf = new Map<string, number>();
    for (const term of docTerms) {
      tf.set(term, (tf.get(term) || 0) + 1);
    }
    
    let score = 0;
    for (const term of queryTerms) {
      const freq = tf.get(term) || 0;
      if (freq === 0) continue;
      
      // IDF approximation
      const idf = Math.log((1 + 0.5) / (0.5 + 0.5)); // Simplified
      
      const numerator = freq * (k1 + 1);
      const denominator = freq + k1 * (1 - b + b * docLength / avgDocLength);
      score += idf * numerator / denominator;
    }
    
    return score;
  }
  
  private hashVector(vector: number[]): string {
    // Simple hash for cache key
    let hash = 0;
    for (let i = 0; i < Math.min(vector.length, 100); i++) {
      hash = ((hash << 5) - hash + Math.round(vector[i] * 1000)) | 0;
    }
    return hash.toString(36);
  }
  
  async getById(id: string): Promise<MemoryEntry | null> {
    // Check cache first
    const cached = this.cache.get(id);
    if (cached) return cached;
    
    const entries = await this.db.getByIds([id]);
    return entries[0] || null;
  }
  
  async update(id: string, updates: Partial<MemoryEntry>): Promise<void> {
    const entry = await this.getById(id);
    if (!entry) throw new Error(`Entry not found: ${id}`);
    
    const updated = { ...entry, ...updates };
    await this.insert([updated]);
  }
  
  async delete(id: string): Promise<void> {
    this.hnsw.remove(id);
    await this.db.delete([id]);
    this.cache.clear(); // Simplified - in production, just remove key
  }
  
  async close(): Promise<void> {
    await this.db.close();
  }
}