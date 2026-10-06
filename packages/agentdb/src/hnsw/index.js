"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Quantizer = exports.HNSWIndex = void 0;
exports.cosineSimilarity = cosineSimilarity;
const hnswlib_node_1 = require("hnswlib-node");
class HNSWIndex {
    index;
    config;
    quantizer;
    idMap = new Map(); // internal ID -> external ID
    reverseIdMap = new Map(); // external ID -> internal ID
    nextInternalId = 0;
    constructor(config, quantizer) {
        this.config = config;
        this.quantizer = quantizer;
        this.index = new hnswlib_node_1.HNSWLib(config.space || 'cosine', config.dimensions);
        this.index.initIndex({
            maxElements: 1000000,
            M: config.M,
            efConstruction: config.efConstruction
        });
        this.index.setEf(config.efSearch);
    }
    add(externalId, vector) {
        const internalId = this.nextInternalId++;
        this.idMap.set(internalId, externalId);
        this.reverseIdMap.set(externalId, internalId);
        // Quantize before adding to index
        const quantized = this.quantizer.quantizeSync(vector, 'pq8');
        this.index.addPoint(quantized, internalId);
    }
    search(vector, k = 10) {
        const quantized = this.quantizer.quantizeSync(vector, 'pq8');
        const result = this.index.searchKnn(quantized, k);
        return result.neighbors.map((neighbor, i) => ({
            id: this.idMap.get(neighbor) || '',
            distance: result.distances[i]
        })).filter(r => r.id);
    }
    remove(externalId) {
        const internalId = this.reverseIdMap.get(externalId);
        if (internalId === undefined)
            return false;
        // Mark as deleted (hnswlib doesn't support true deletion)
        this.index.markDelete(internalId);
        this.idMap.delete(internalId);
        this.reverseIdMap.delete(externalId);
        return true;
    }
    getSize() {
        return this.index.getCurrentCount();
    }
    save(path) {
        this.index.writeIndex(path);
        // Save id maps separately
    }
    load(path) {
        this.index.readIndex(path);
        // Load id maps separately
    }
}
exports.HNSWIndex = HNSWIndex;
class Quantizer {
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
            // Simple k-means quantization (in production, use trained codebooks)
            const centroids = this.getOrCreateCodebook(`pq${bits}-${i}`, subvector.length, 1 << bits);
            const quantizedSubvector = this.quantizeSubvector(subvector, centroids);
            quantized.set(quantizedSubvector, start);
        }
        return quantized;
    }
    quantizeBinary(vector) {
        const quantized = new Float32Array(vector.length);
        for (let i = 0; i < vector.length; i++) {
            quantized[i] = vector[i] >= 0 ? 1 : -1;
        }
        return quantized;
    }
    quantizeRaBitQ(vector) {
        // RaBitQ: 1-bit quantization with rotation
        // Simplified implementation - production uses learned rotation matrix
        const rotated = this.applyRotation(vector);
        return this.quantizeBinary(rotated);
    }
    applyRotation(vector) {
        // Placeholder for learned rotation matrix
        // In production: R @ vector where R is orthogonal matrix
        return vector;
    }
    getOrCreateCodebook(key, dim, k) {
        if (!this.codebooks.has(key)) {
            // Initialize with random centroids (in production, train on data)
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
        return this.codebooks.get(key);
    }
    quantizeSubvector(subvector, centroids) {
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
exports.Quantizer = Quantizer;
function cosineSimilarity(a, b) {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
//# sourceMappingURL=index.js.map