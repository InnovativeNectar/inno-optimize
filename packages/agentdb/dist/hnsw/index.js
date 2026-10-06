import { HierarchicalNSW as HNSWLib } from 'hnswlib-node';
export class HNSWIndex {
    index;
    config;
    quantizer;
    idMap = new Map();
    reverseIdMap = new Map();
    nextInternalId = 0;
    constructor(config, quantizer) {
        this.config = config;
        this.quantizer = quantizer;
        this.index = new HNSWLib(config.space || 'cosine', config.dimensions);
        this.index.initIndex({
            maxElements: 1000000,
            m: config.M,
            efConstruction: config.efConstruction
        });
        this.index.setEf(config.efSearch);
    }
    add(externalId, vector) {
        const internalId = this.nextInternalId++;
        this.idMap.set(internalId, externalId);
        this.reverseIdMap.set(externalId, internalId);
        const quantized = this.quantizer.quantizeSync(vector, 'pq8');
        this.index.addPoint(Array.from(quantized), internalId);
    }
    search(vector, k = 10) {
        const quantized = this.quantizer.quantizeSync(vector, 'pq8');
        const result = this.index.searchKnn(Array.from(quantized), k);
        const mapped = result.neighbors.map((neighbor, i) => {
            const id = this.idMap.get(neighbor);
            const distance = result.distances[i];
            return {
                id: id ?? '',
                distance: distance ?? 0
            };
        });
        return mapped.filter((r) => r.id !== '');
    }
    remove(externalId) {
        const internalId = this.reverseIdMap.get(externalId);
        if (internalId === undefined)
            return false;
        this.index.markDelete(internalId);
        this.idMap.delete(internalId);
        this.reverseIdMap.delete(externalId);
        return true;
    }
    getSize() {
        return this.index.getCurrentCount();
    }
    save(path) {
        this.index.writeIndexSync(path);
    }
    load(path) {
        this.index.readIndexSync(path);
    }
}
export class Quantizer {
    config;
    codebooks = new Map();
    constructor(config) {
        this.config = config;
    }
    quantizeSync(vector, level) {
        const quantized = new Float32Array(vector.length);
        switch (level) {
            case 'none':
                return new Float32Array(vector);
            case 'pq8':
                return this.quantizePQ(vector, 8, this.config.levels.pq8.subvectors ?? 16);
            case 'pq4':
                return this.quantizePQ(vector, 4, this.config.levels.pq4.subvectors ?? 16);
            case 'binary':
                return this.quantizeBinary(vector);
            case 'rabitq':
                return this.quantizeRaBitQ(vector);
            default:
                return new Float32Array(vector);
        }
    }
    async quantize(vector, level) {
        return this.quantizeSync(vector, level);
    }
    quantizePQ(vector, bits, subvectors) {
        const dimPerSubvector = Math.ceil(vector.length / subvectors);
        const quantized = new Float32Array(vector.length);
        for (let i = 0; i < subvectors; i++) {
            const start = i * dimPerSubvector;
            const end = Math.min(start + dimPerSubvector, vector.length);
            const subvector = vector.slice(start, end);
            const centroids = this.getOrCreateCodebook(`pq${bits}-${i}`, subvector.length, 1 << bits);
            const quantizedSubvector = this.quantizeSubvector(subvector, centroids);
            quantized.set(quantizedSubvector, start);
        }
        return quantized;
    }
    quantizeSubvector(subvector, centroids) {
        const quantized = new Float32Array(subvector.length);
        for (let i = 0; i < subvector.length; i++) {
            let bestIdx = 0;
            let bestDist = Infinity;
            const subVecVal = subvector[i] ?? 0;
            for (let j = 0; j < centroids.length; j++) {
                const centroid = centroids[j];
                if (!centroid)
                    continue;
                const centroidLen = centroid.length;
                const idx = i % centroidLen;
                const centroidVal = centroid[idx];
                const cVal = centroidVal !== undefined ? +centroidVal : 0;
                const dist = Math.abs(subVecVal - cVal);
                if (dist < bestDist) {
                    bestDist = dist;
                    bestIdx = j;
                }
            }
            const bestCentroid = centroids[bestIdx];
            if (!bestCentroid)
                continue;
            const centroidLen = bestCentroid.length;
            const idx = i % centroidLen;
            const bestVal = bestCentroid[idx] !== undefined ? +bestCentroid[idx] : 0;
            quantized[i] = bestVal;
        }
        return quantized;
    }
    quantizeBinary(vector) {
        const quantized = new Float32Array(vector.length);
        for (let i = 0; i < vector.length; i++) {
            const val = vector[i] ?? 0;
            quantized[i] = val >= 0 ? 1 : -1;
        }
        return quantized;
    }
    quantizeRaBitQ(vector) {
        const rotated = this.applyRotation(vector);
        return this.quantizeBinary(rotated);
    }
    applyRotation(vector) {
        return vector;
    }
    getOrCreateCodebook(key, dim, k) {
        if (!this.codebooks.has(key)) {
            const centroids = [];
            for (let i = 0; i < k; i++) {
                const centroid = new Float32Array(dim);
                for (let j = 0; j < dim; j++) {
                    centroid[j] = (Math.random() - 0.5) * 2;
                }
                centroids.push(centroid);
            }
            this.codebooks.set(key, centroids);
        }
        const result = this.codebooks.get(key);
        if (!result)
            throw new Error(`Codebook ${key} not found after creation`);
        return result;
    }
}
export function cosineSimilarity(a, b) {
    if (!a || !b || a.length !== b.length)
        return 0;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
        const av = a[i] ?? 0;
        const bv = b[i] ?? 0;
        dot += av * bv;
        normA += av * av;
        normB += bv * bv;
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
}
//# sourceMappingURL=index.js.map