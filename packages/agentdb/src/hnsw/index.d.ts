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
        none: {
            bits: 32;
            compression: 1;
        };
        pq8: {
            bits: 8;
            compression: 4;
            subvectors: number;
        };
        pq4: {
            bits: 4;
            compression: 8;
            subvectors: number;
        };
        binary: {
            bits: 1;
            compression: 32;
        };
        rabitq: {
            bits: 1;
            compression: 32;
            codebookSize: number;
        };
    };
}
export declare class HNSWIndex {
    private index;
    private config;
    private quantizer;
    private idMap;
    private reverseIdMap;
    private nextInternalId;
    constructor(config: HNSWConfig, quantizer: Quantizer);
    add(externalId: string, vector: number[]): void;
    search(vector: number[], k?: number): Array<{
        id: string;
        distance: number;
    }>;
    remove(externalId: string): boolean;
    getSize(): number;
    save(path: string): void;
    load(path: string): void;
}
export declare class Quantizer {
    private config;
    private codebooks;
    constructor(config: QuantizationConfig);
    quantizeSync(vector: number[], level: keyof QuantizationConfig['levels']): Float32Array;
    quantize(vector: number[], level: keyof QuantizationConfig['levels']): Promise<Float32Array>;
    private quantizePQ;
    private quantizeBinary;
    private quantizeRaBitQ;
    private applyRotation;
    private getOrCreateCodebook;
    private quantizeSubvector;
}
export declare function cosineSimilarity(a: number[], b: number[]): number;
//# sourceMappingURL=index.d.ts.map