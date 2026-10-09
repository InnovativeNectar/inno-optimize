import { tmpdir } from 'os';
import { VectorDb } from 'ruvector';
import { HNSWIndex, Quantizer, cosineSimilarity } from '../hnsw/index.js';
import type { MemoryEntry, SearchQuery, FastStoreConfig } from '../types.js';

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
  
  delete(key: string): void {
    this.cache.delete(key);
    this.accessOrder.delete(key);
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
  private db: InstanceType<typeof VectorDb>;
  private hnsw: HNSWIndex;
  private quantizer: Quantizer;
  private cache: WorkingMemoryCache;
  private config: FastStoreConfig;
  
  constructor(config: FastStoreConfig) {
    this.config = config;
    
    // Initialize VectorDb.
    // The native binding treats storagePath=':memory:' as a literal file name
    // AND ignores hnswConfig for it, pre-allocating a fixed 10M-element index
    // (4.44 GB of virtual allocations per instance — measured, see AGENTS.md
    // session notes). Map ':memory:' to a unique temp file and always pass an
    // explicit hnswConfig so capacity scales with config.hnsw.maxElements.
    const storagePath = config.path && config.path !== ':memory:'
      ? config.path
      : `${tmpdir()}/inno-faststore-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.db`;
    this.db = new VectorDb({
      path: storagePath,
      dimensions: config.dimensions,
      distanceMetric: 'cosine',
      hnswConfig: {
        m: config.hnsw.M,
        efConstruction: config.hnsw.efConstruction,
        efSearch: config.hnsw.efSearch,
        maxElements: config.hnsw.maxElements ?? 1000000
      }
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
      dimensions: config.dimensions,
      maxElements: config.hnsw.maxElements
    }, this.quantizer);
    
    // Initialize cache
    this.cache = new WorkingMemoryCache({
      maxSize: config.cache.maxSize,
      ttlMs: config.cache.ttlMs
    });
  }
  
  async initialize(): Promise<void> {
    // VectorDb doesn't need explicit open
    // Load existing vectors into HNSW
    // Note: VectorDb doesn't have getAll, we'd need to track entries separately
    // For now, skip loading existing vectors into HNSW
  }
  
  private serializeMetadata(entry: MemoryEntry): Record<string, any> {
    return {
      content: entry.content,
      metadata: entry.metadata,
      provenance: entry.provenance,
      reward: entry.reward,
      verdict: entry.verdict,
      loraWeights: entry.loraWeights,
      ewcImportance: entry.ewcImportance,
      consolidated: entry.consolidated,
      type: entry.type,
      tier: entry.tier,
      accessCount: entry.accessCount,
      lastAccessed: entry.lastAccessed.toISOString(),
      createdAt: entry.createdAt.toISOString()
    };
  }
  
  private deserializeMetadata(id: string, metadata: Record<string, any>): MemoryEntry {
    const data = metadata;
    return {
      id,
      type: data.type || 'working',
      tier: data.tier || 1,
      content: data.content || '',
      embedding: new Float32Array(0), // Will be filled from vector
      metadata: data.metadata || {},
      provenance: data.provenance || { agentId: '', sessionId: '', source: 'system', timestamp: new Date() },
      reward: data.reward ?? 0,
      verdict: data.verdict,
      loraWeights: data.loraWeights,
      ewcImportance: data.ewcImportance,
      consolidated: data.consolidated ?? false,
      accessCount: data.accessCount ?? 0,
      lastAccessed: data.lastAccessed ? new Date(data.lastAccessed) : new Date(),
      createdAt: data.createdAt ? new Date(data.createdAt) : new Date()
    };
  }
  
  private toNumberArray(arr: Float32Array | number[]): number[] {
    return Array.isArray(arr) ? arr : Array.from(arr);
  }
  
  private toFloat32Array(arr: Float32Array | number[]): Float32Array {
    return arr instanceof Float32Array ? arr : new Float32Array(arr);
  }
  
  async insert(entries: MemoryEntry[]): Promise<void> {
    if (entries.length === 0) return;
    
    // Quantize embeddings
    const quantized: Float32Array[] = await Promise.all(
      entries.map(e => this.quantizer.quantize(this.toNumberArray(e.embedding), this.config.quantization.defaultLevel))
    );
    
    // Store in VectorDb - metadata is auto-converted to JSON
    const dbEntries = entries.map((e, i) => {
      const q = quantized[i]!;
      return {
        id: e.id,
        vector: this.toFloat32Array(q),
        metadata: this.serializeMetadata(e)
      };
    });
    await this.db.insertBatch(dbEntries);
    
    // Add to HNSW index
    for (let i = 0; i < entries.length; i++) {
      const q = quantized[i]!;
      const vec: number[] = this.toNumberArray(q);
      const entry = entries[i];
      if (entry) {
        this.hnsw.add(entry.id, vec);
      }
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
    
    // 3. Fetch full entries from VectorDb using search (not get) for better performance
    const searchOptions: { vector: number[] | Float32Array; k: number; filter?: Record<string, any>; efSearch?: number } = {
      vector: query.vector,
      k: query.k || 10
    };
    if (query.filter) {
      searchOptions.filter = query.filter;
    }
    const dbResults = await this.db.search(searchOptions);
    
    if (dbResults.length === 0) return [];
    
    // 4. Deserialize metadata from JSON
    const entries = dbResults.map(e => {
      const entry = this.deserializeMetadata(e.id, e.metadata || {});
      const vec = e.vector;
      entry.embedding = vec instanceof Float32Array ? vec : (vec ? new Float32Array(vec) : new Float32Array(0));
      return entry;
    });
    
    // 5. Hybrid re-ranking
    const reranked = await this.hybridRerank(query, entries, hnswResults);
    
    // 6. Update cache
    if (reranked.length > 0) {
      const first = reranked[0];
      if (first) {
        this.cache.set(vectorHash, first);
      }
    }
    
    return reranked;
  }
  
  private async hybridRerank(
    query: SearchQuery,
    entries: MemoryEntry[],
    hnswResults: Array<{ id: string; distance: number }>
  ): Promise<MemoryEntry[]> {
    // Create distance map from HNSW results (distance = lower is better)
    const distanceMap = new Map(hnswResults.map(r => [r.id, r.distance]));
    
    // Score each entry
    const scored = entries.map(entry => {
      const hnswDistance = distanceMap.get(entry.id) ?? 1;
      // HNSW cosine distance: 0 = identical, 2 = opposite
      // Convert to similarity: 1 - distance (since cosine distance = 1 - cosine similarity for normalized vectors)
      const cosineScore = 1 - hnswDistance;
      
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
    const first = remaining.shift();
    if (!first) return [];
    selected.push(first);
    remainingScores.shift();
    
    while (remaining.length > 0) {
      let bestIdx = -1;
      let bestScore = -Infinity;
      
      for (let i = 0; i < remaining.length; i++) {
        const remEntry = remaining[i];
        if (!remEntry) continue;
        // Compute max similarity to already selected
        let maxSim = 0;
        for (const sel of selected) {
          const sim = cosineSimilarity(this.toNumberArray(remEntry.embedding), this.toNumberArray(sel.embedding));
          maxSim = Math.max(maxSim, sim);
        }
        
        // MMR score: alpha * relevance - lambda * max_similarity
        const score = remainingScores[i] ?? 0;
        const mmrScore = params.alpha * score - params.lambda * maxSim;
        
        if (mmrScore > bestScore) {
          bestScore = mmrScore;
          bestIdx = i;
        }
      }
      
      if (bestIdx >= 0) {
        const selectedItem = remaining.splice(bestIdx, 1)[0];
        if (selectedItem) {
          selected.push(selectedItem);
          remainingScores.splice(bestIdx, 1);
        }
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
      const val = vector[i] ?? 0;
      hash = ((hash << 5) - hash + Math.round(val * 1000)) | 0;
    }
    return hash.toString(36);
  }
  
  async getById(id: string): Promise<MemoryEntry | null> {
    // Check cache first
    const cached = this.cache.get(id);
    if (cached) return cached;
    
    const entry = await this.db.get(id);
    if (!entry) return null;
    
    const entryId = entry.id ?? id;
    const result = this.deserializeMetadata(entryId, entry.metadata || {});
    const vec = entry.vector;
    result.embedding = vec instanceof Float32Array ? vec : (vec ? new Float32Array(vec) : new Float32Array(0));
    return result;
  }
  
  async update(id: string, updates: Partial<MemoryEntry>): Promise<void> {
    const entry = await this.getById(id);
    if (!entry) throw new Error(`Entry not found: ${id}`);
    
    const updated = { ...entry, ...updates };
    await this.insert([updated]);
  }
  
  async delete(id: string): Promise<void> {
    this.hnsw.remove(id);
    await this.db.delete(id);
    this.cache.delete(id);
  }
  
  async close(): Promise<void> {
    // VectorDb doesn't have explicit close
  }
}