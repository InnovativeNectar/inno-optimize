import { describe, it, expect, beforeEach, vi } from 'vitest';
import type {
  MemoryEntry 
} from '../index.js';
import { 
  FastStore, 
  WorkingMemoryCache, 
  HNSWIndex, 
  Quantizer,
  cosineSimilarity 
} from '../index.js';

describe('AgentDB - FastStore', () => {
  let store: FastStore;
  const config = {
    path: ':memory:',
    dimensions: 384,
    hnsw: { M: 16, efConstruction: 200, efSearch: 100, maxElements: 10000 },
    quantization: { defaultLevel: 'pq8' as const },
    cache: { maxSize: 100, ttlMs: 60000 }
  };

  beforeEach(() => {
    store = new FastStore(config);
  });

  describe('WorkingMemoryCache', () => {
    it('should store and retrieve entries', () => {
      const cache = new WorkingMemoryCache({ maxSize: 10, ttlMs: 60000 });
      const entry: MemoryEntry = createTestEntry('test-1');
      
      cache.set('test-1', entry);
      const retrieved = cache.get('test-1');
      
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe('test-1');
    });

    it('should evict LRU entries when at capacity', () => {
      const cache = new WorkingMemoryCache({ maxSize: 2, ttlMs: 60000 });
      
      cache.set('a', createTestEntry('a'));
      cache.set('b', createTestEntry('b'));
      cache.set('c', createTestEntry('c')); // Should evict 'a'
      
      expect(cache.get('a')).toBeNull();
      expect(cache.get('b')).toBeDefined();
      expect(cache.get('c')).toBeDefined();
    });

    it('should respect TTL', () => {
      const cache = new WorkingMemoryCache({ maxSize: 10, ttlMs: 10 });
      const entry = createTestEntry('test');
      
      cache.set('test', entry);
      expect(cache.get('test')).toBeDefined();
      
      // Wait for TTL to expire
      return new Promise(resolve => setTimeout(resolve, 20))
        .then(() => {
          expect(cache.get('test')).toBeNull();
        });
    });
  });

  describe('HNSWIndex', () => {
    let index: HNSWIndex;
    let quantizer: Quantizer;

    beforeEach(() => {
      quantizer = new Quantizer({
        defaultLevel: 'pq8',
        levels: {
          none: { bits: 32, compression: 1 },
          pq8: { bits: 8, compression: 4, subvectors: 16 },
          pq4: { bits: 4, compression: 8, subvectors: 16 },
          binary: { bits: 1, compression: 32 },
          rabitq: { bits: 1, compression: 32, codebookSize: 256 }
        }
      });
      
      index = new HNSWIndex({
        M: 16,
        efConstruction: 200,
        efSearch: 100,
        dimensions: 384,
        maxElements: 10000
      }, quantizer);
    });

    it('should add and search vectors', () => {
      const vector = createRandomVector(384);
      index.add('vec-1', vector);
      
      const results = index.search(vector, 5);
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].id).toBe('vec-1');
      expect(results[0].distance).toBeLessThan(0.1);
    });

    it('should remove vectors', () => {
      const vector = createRandomVector(384);
      index.add('vec-1', vector);
      
      const removed = index.remove('vec-1');
      expect(removed).toBe(true);
      
      const results = index.search(vector, 5);
      expect(results.length).toBe(0);
    });
  });

  describe('Quantizer', () => {
    let quantizer: Quantizer;

    beforeEach(() => {
      quantizer = new Quantizer({
        defaultLevel: 'pq8',
        levels: {
          none: { bits: 32, compression: 1 },
          pq8: { bits: 8, compression: 4, subvectors: 16 },
          pq4: { bits: 4, compression: 8, subvectors: 16 },
          binary: { bits: 1, compression: 32 },
          rabitq: { bits: 1, compression: 32, codebookSize: 256 }
        }
      });
    });

    it('should quantize with different levels', () => {
      const vector = createRandomVector(384);
      
      const fp32 = quantizer.quantizeSync(vector, 'none');
      const pq8 = quantizer.quantizeSync(vector, 'pq8');
      const binary = quantizer.quantizeSync(vector, 'binary');
      
      expect(fp32.length).toBe(384);
      expect(pq8.length).toBe(384);
      expect(binary.length).toBe(384);
      
      // Binary should only have -1 and 1
      for (const v of binary) {
        expect([-1, 1]).toContain(v);
      }
    });
  });

  describe('cosineSimilarity', () => {
    it('should return 1 for identical vectors', () => {
      const v = createRandomVector(10);
      const sim = cosineSimilarity(v, v);
      expect(sim).toBeCloseTo(1, 5);
    });

    it('should return 0 for orthogonal vectors', () => {
      const v1 = [1, 0, 0, 0, 0];
      const v2 = [0, 1, 0, 0, 0];
      const sim = cosineSimilarity(v1, v2);
      expect(sim).toBeCloseTo(0, 5);
    });

    it('should return -1 for opposite vectors', () => {
      const v1 = [1, 1, 1];
      const v2 = [-1, -1, -1];
      const sim = cosineSimilarity(v1, v2);
      expect(sim).toBeCloseTo(-1, 5);
    });
  });
});

function createTestEntry(id: string): MemoryEntry {
  return {
    id,
    type: 'semantic',
    tier: 3,
    content: `Test content for ${id}`,
    embedding: createRandomVector(384),
    metadata: { domain: 'test', taskType: 'test', mode: 'convergent', context: '', tags: [] },
    provenance: { agentId: 'test-agent', sessionId: 'test-session', source: 'agent', timestamp: new Date() },
    reward: 0.8,
    verdict: 'success',
    loraWeights: undefined,
    ewcImportance: undefined,
    consolidated: true,
    consolidatedAt: new Date(),
    accessCount: 0,
    lastAccessed: new Date(),
    createdAt: new Date()
  };
}

function createRandomVector(dim: number): number[] {
  return Array.from({ length: dim }, () => Math.random() * 2 - 1);
}