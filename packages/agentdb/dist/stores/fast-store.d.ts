import { MemoryEntry, SearchQuery, FastStoreConfig } from '../types.js';
export declare class WorkingMemoryCache {
    private cache;
    private accessOrder;
    private maxSize;
    private ttlMs;
    constructor(config: {
        maxSize: number;
        ttlMs: number;
    });
    get(key: string): MemoryEntry | null;
    set(key: string, entry: MemoryEntry): void;
    delete(key: string): void;
    clear(): void;
    size(): number;
}
export declare class FastStore {
    private db;
    private hnsw;
    private quantizer;
    private cache;
    private config;
    constructor(config: FastStoreConfig);
    initialize(): Promise<void>;
    private serializeMetadata;
    private deserializeMetadata;
    private toNumberArray;
    private toFloat32Array;
    insert(entries: MemoryEntry[]): Promise<void>;
    search(query: SearchQuery): Promise<MemoryEntry[]>;
    private hybridRerank;
    private mmrRerank;
    private bm25Score;
    private hashVector;
    getById(id: string): Promise<MemoryEntry | null>;
    update(id: string, updates: Partial<MemoryEntry>): Promise<void>;
    delete(id: string): Promise<void>;
    close(): Promise<void>;
}
//# sourceMappingURL=fast-store.d.ts.map