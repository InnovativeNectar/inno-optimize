import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { FastStore, type MemoryEntry } from '@inno-optimize/agentdb';
import { EMBEDDING_DIMENSIONS, hashEmbedding, hashEmbedder, type Embedder } from './embedder.js';

export interface MemoryServiceOptions {
  path?: string | undefined;
  maxElements?: number | undefined;
  dimensions?: number | undefined;
}

export interface StoreInput {
  content: string;
  domain?: string | undefined;
  taskType?: string | undefined;
  mode?: string | undefined;
  context?: string | undefined;
  tags?: string[] | undefined;
  type?: 'working' | 'episodic' | 'semantic' | undefined;
}

export function defaultMemoryPath(): string {
  const fromEnv = process.env['INNO_MEMORY_PATH'];
  if (fromEnv && fromEnv.length > 0) {
    return fromEnv;
  }
  return path.join(homedir(), '.inno-optimize', 'memory.db');
}

function defaultMaxElements(): number {
  const fromEnv = process.env['INNO_MEMORY_MAX_ELEMENTS'];
  if (fromEnv && fromEnv.length > 0) {
    const parsed = Number.parseInt(fromEnv, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return 100_000;
}

function tierFor(type: 'working' | 'episodic' | 'semantic'): 1 | 2 | 3 {
  if (type === 'working') return 1;
  if (type === 'semantic') return 3;
  return 2;
}

export class MemoryService {
  readonly store: FastStore;
  readonly embedder: Embedder;
  readonly path: string;
  readonly dimensions: number;
  private storedInSession = 0;
  private counter = 0;

  constructor(options: MemoryServiceOptions = {}) {
    this.path = options.path ?? defaultMemoryPath();
    this.dimensions = options.dimensions ?? EMBEDDING_DIMENSIONS;
    this.embedder = hashEmbedder;

    if (this.path !== ':memory:') {
      mkdirSync(path.dirname(path.resolve(this.path)), { recursive: true });
    }

    this.store = new FastStore({
      path: this.path,
      dimensions: this.dimensions,
      hnsw: {
        M: 16,
        efConstruction: 200,
        efSearch: 100,
        maxElements: options.maxElements ?? defaultMaxElements(),
      },
      quantization: { defaultLevel: 'pq8' },
      cache: { maxSize: 10_000, ttlMs: 300_000 },
    });
  }

  async initialize(): Promise<void> {
    await this.store.initialize();
  }

  async add(input: StoreInput): Promise<{ id: string; type: 'working' | 'episodic' | 'semantic' }> {
    this.counter += 1;
    const id = `mem-${Date.now().toString(36)}-${this.counter.toString(36)}`;
    const type = input.type ?? 'episodic';
    const now = new Date();

    const entry: MemoryEntry = {
      id,
      type,
      tier: tierFor(type),
      content: input.content,
      embedding: await this.embedder.embed(input.content),
      metadata: {
        domain: input.domain ?? 'general',
        taskType: input.taskType ?? 'general',
        mode: input.mode ?? 'convergent',
        context: input.context ?? '',
        tags: input.tags ?? [],
      },
      provenance: {
        agentId: 'inno-optimize-mcp',
        sessionId: 'inno-optimize-mcp',
        source: 'agent',
        timestamp: now,
      },
      reward: 0,
      consolidated: false,
      accessCount: 0,
      lastAccessed: now,
      createdAt: now,
    };

    await this.store.insert([entry]);
    this.storedInSession += 1;
    return { id, type };
  }

  async search(query: string, k = 5): Promise<MemoryEntry[]> {
    return this.store.search({
      vector: hashEmbedding(query),
      textQuery: query,
      k,
    });
  }

  stats(): { path: string; dimensions: number; storedInSession: number } {
    return {
      path: this.path,
      dimensions: this.dimensions,
      storedInSession: this.storedInSession,
    };
  }
}
