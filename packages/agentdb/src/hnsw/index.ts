import { HNSWLib } from 'hnswlib-node';

export interface HNSWConfig {
  M: number;
  efConstruction: number;
  efSearch: number;
  dimensions: number;
  space?: 'cosine' | 'l2' | 'ip';
}

export interface QuantizationConfig {
  defaultLevel: 'none' | 'pq8' | 'pq4' | 'binary' | 'rabitq';
  levels: {
    none: { bits: 32; compression: 1 };
    pq8: { bits: 8; compression: 4; subvectors: number };
    pq4: { bits: 4; compression: 8; subvectors: number };
    binary: { bits: 1; compression: 32 };
    rabitq: { bits: 1; compression: 32; codebookSize: number };
  };
}

export class HNSWIndex {
  private index: HNSWLib;
  private config: HNSWConfig;
  private quantizer: Quantizer;
  private idMap = new Map<number, string>(); // internal ID -> external ID
  private reverseIdMap = new Map<string, number>(); // external ID -> internal ID
  private nextInternalId = 0;
  
  constructor(config: HNSWConfig, quantizer: Quantizer) {
    this.config = config;
    this.quantizer = quantizer;
    
    this.index = new HNSWLib(config.space || 'cosine', config.dimensions);
    this.index.initIndex({
      maxElements: 1000000,
      M: config.M,
      efConstruction: config.efConstruction
    });
    this.index.setEf(config.efSearch);
  }
  
  add(externalId: string, vector: number[]): void {
    const internalId = this.nextInternalId++;
    this.idMap.set(internalId, externalId);
    this.reverseIdMap.set(externalId, internalId);
    
    // Quantize before adding to index
    const quantized = this.quantizer.quantizeSync(vector, 'pq8');
    this.index.addPoint(quantized, internalId);
  }
  
  search(vector: number[], k: number = 10): Array<{ id: string; distance: number }> {
    const quantized = this.quantizer.quantizeSync(vector, 'pq8');
    const result = this.index.searchKnn(quantized, k);
    
    return result.neighbors.map((neighbor, i) => ({
      id: this.idMap.get(neighbor) || '',
      distance: result.distances[i]
    })).filter(r => r.id);
  }
  
  remove(externalId: string): boolean {
    const internalId = this.reverseIdMap.get(externalId);
    if (internalId === undefined) return false;
    
    // Mark as deleted (hnswlib doesn't support true deletion)
    this.index.markDelete(internalId);
    this.idMap.delete(internalId);
    this.reverseIdMap.delete(externalId);
    return true;
  }
  
  getSize(): number {
    return this.index.getCurrentCount();
  }
  
  save(path: string): void {
    this.index.writeIndex(path);
    // Save id maps separately
  }
  
  load(path: string): void {
    this.index.readIndex(path);
    // Load id maps separately
  }
}

export class Quantizer {
  private config: QuantizationConfig;
  private codebooks = new Map<string, Float32Array[]>();
  
  constructor(config: QuantizationConfig) {
    this.config = config;
  }
  
  quantizeSync(vector: number[], level: keyof QuantizationConfig['levels']): Float32Array {
    const quantized = new Float32Array(vector.length);
    
    switch (level) {
      case 'none':
        return new Float32Array(vector);
      
      case 'pq8':
        return this.quantizePQ(vector, 8, this.config.levels.pq8.subvectors);
      
      case 'pq4':
        return this.quantizePQ(vector, 4, this.config.levels.pq4.subvectors);
      
      case 'binary':
        return this.quantizeBinary(vector);
      
      case 'rabitq':
        return this.quantizeRaBitQ(vector);
      
      default:
        return new Float32Array(vector);
    }
  }
  
  async quantize(vector: number[], level: keyof QuantizationConfig['levels']): Promise<Float32Array> {
    return this.quantizeSync(vector, level);
  }
  
  private quantizePQ(vector: number[], bits: number, subvectors: number): Float32Array {
    const dimPerSubvector = Math.ceil(vector.length / subvectors);
    const quantized = new Float32Array(vector.length);
    
    for (let i = 0; i < subvectors; i++) {
      const start = i * dimPerSubvector;
      const end = Math.min(start + dimPerSubvector, vector.length);
      const subvector = vector.slice(start, end);
      
      // Simple k-means quantization (in production, use trained codebooks)
      const centroids = this.getOrCreateCodebook(`pq${bits}-${i}`, subvector.length, 1 << bits);
      const quantizedSubvector = this.quantizeSubvector(subvector, centroids);
      
      quantized.set(quantizedSubvector, start);
    }
    
    return quantized;
  }
  
  private quantizeBinary(vector: number[]): Float32Array {
    const quantized = new Float32Array(vector.length);
    for (let i = 0; i < vector.length; i++) {
      quantized[i] = vector[i] >= 0 ? 1 : -1;
    }
    return quantized;
  }
  
  private quantizeRaBitQ(vector: number[]): Float32Array {
    // RaBitQ: 1-bit quantization with rotation
    // Simplified implementation - production uses learned rotation matrix
    const rotated = this.applyRotation(vector);
    return this.quantizeBinary(rotated);
  }
  
  private applyRotation(vector: number[]): number[] {
    // Placeholder for learned rotation matrix
    // In production: R @ vector where R is orthogonal matrix
    return vector;
  }
  
  private getOrCreateCodebook(key: string, dim: size, k: number): Float32Array[] {
    if (!this.codebooks.has(key)) {
      // Initialize with random centroids (in production, train on data)
      const centroids: Float32Array[] = [];
      for (let i = 0; i < k; i++) {
        const centroid = new Float32Array(dim);
        for (let j = 0; j < dim; j++) {
          centroid[j] = (Math.random() - 0.5) * 2;
        }
        centroids.push(centroid);
      }
      this.codebooks.set(key, centroids);
    }
    return this.codebooks.get(key)!;
  }
  
  private quantizeSubvector(subvector: number[], centroids: Float32Array[]): Float32Array {
    const quantized = new Float32Array(subvector.length);
    
    for (let i = 0; i < subvector.length; i++) {
      let bestIdx = 0;
      let bestDist = Infinity;
      
      for (let j = 0; j < centroids.length; j++) {
        const dist = Math.abs(subvector[i] - centroids[j][i % centroids[j].length]);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = j;
        }
      }
      
      quantized[i] = centroids[bestIdx][i % centroids[bestIdx].length];
    }
    
    return quantized;
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}