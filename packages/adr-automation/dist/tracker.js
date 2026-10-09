export class ADRTracker {
    adrs = new Map();
    config;
    constructor(config) {
        this.config = config;
    }
    async initialize() {
        // Load existing ADRs from storage
        // In production, read from filesystem
    }
    createADR(adr) {
        const id = this.generateId();
        const now = new Date();
        const newADR = {
            ...adr,
            id,
            createdAt: now,
            updatedAt: now
        };
        this.adrs.set(id, newADR);
        return newADR;
    }
    updateADR(id, updates) {
        const adr = this.adrs.get(id);
        if (!adr)
            return null;
        const updated = { ...adr, ...updates, updatedAt: new Date() };
        this.adrs.set(id, updated);
        return updated;
    }
    updateStatus(id, status) {
        return this.updateADR(id, { status });
    }
    getADR(id) {
        return this.adrs.get(id);
    }
    listADRs(filter) {
        let results = Array.from(this.adrs.values());
        if (filter?.status) {
            results = results.filter(a => a.status === filter.status);
        }
        if (filter?.author) {
            results = results.filter(a => a.authors.includes(filter.author));
        }
        return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    getProposedADRs() {
        return this.listADRs({ status: 'proposed' });
    }
    getAcceptedADRs() {
        return this.listADRs({ status: 'accepted' });
    }
    supersedeADR(oldId, newADR) {
        const oldADR = this.adrs.get(oldId);
        if (oldADR) {
            this.updateADR(oldId, { status: 'superseded' });
            newADR.consequences.push({
                type: 'neutral',
                description: `Supersedes ${oldId}: ${oldADR.title}`,
                impact: 'low'
            });
        }
        return this.createADR(newADR);
    }
    linkADRs(fromId, toId, relation) {
        const from = this.adrs.get(fromId);
        const to = this.adrs.get(toId);
        if (!from || !to)
            return;
        // Add cross-reference in consequences
        from.consequences.push({
            type: 'neutral',
            description: `${relation} ${toId}: ${to.title}`,
            impact: 'low'
        });
        this.adrs.set(fromId, from);
    }
    generateId() {
        const count = this.adrs.size + 1;
        return `ADR-${String(count).padStart(3, '0')}`;
    }
    async persist() {
        // In production, write to filesystem
    }
}
export class CIIntegration {
    tracker;
    generator;
    constructor(tracker, generator) {
        this.tracker = tracker;
        this.generator = generator;
    }
    async checkPR(pr) {
        const changes = await this.analyzePRChanges(pr);
        const architecturalChanges = this.filterArchitecturalChanges(changes);
        if (architecturalChanges.length === 0) {
            return { passed: true, message: 'No architectural changes detected' };
        }
        const missingADRs = architecturalChanges.filter(c => !this.hasADRForChange(c));
        if (missingADRs.length > 0) {
            return {
                passed: false,
                message: `Missing ADRs for ${missingADRs.length} architectural changes`,
                missingADRs: missingADRs.map(c => ({
                    file: c.affectedFiles[0] ?? 'unknown',
                    suggestion: this.generateADRSuggestion(c)
                }))
            };
        }
        return { passed: true, message: 'All architectural changes have ADRs' };
    }
    async generateADRsForPR(pr) {
        const changes = await this.analyzePRChanges(pr);
        const architecturalChanges = this.filterArchitecturalChanges(changes);
        const adrs = [];
        for (const change of architecturalChanges) {
            const adr = await this.generator.generateFromChange(change);
            this.tracker.createADR(adr);
            adrs.push(adr);
        }
        return adrs;
    }
    async analyzePRChanges(pr) {
        // In production, analyze actual PR diff
        return [];
    }
    filterArchitecturalChanges(changes) {
        return changes.filter(c => c.impact === 'high' || c.impact === 'critical' ||
            c.type === 'new_module' || c.type === 'pattern_introduction');
    }
    hasADRForChange(change) {
        const adrs = this.tracker.listADRs();
        return adrs.some(adr => adr.semanticAnchors.some((anchor) => change.affectedFiles.includes(anchor.codeLocation.file)));
    }
    generateADRSuggestion(change) {
        return `Consider creating ADR for ${change.type} in ${change.affectedFiles.join(', ')}`;
    }
}
export class SemanticAnchors {
    embedder;
    constructor(embedder) {
        this.embedder = embedder;
    }
    async createAnchors(adr, changes) {
        const anchors = [];
        for (const change of changes) {
            for (const file of change.affectedFiles) {
                try {
                    const content = await this.readFile(file);
                    const lines = change.lineRanges[file] || { start: 1, end: 100 };
                    const snippet = content.split('\n').slice(lines.start - 1, lines.end).join('\n');
                    const embedding = await this.embedder.embed(snippet);
                    anchors.push({
                        adrId: adr.id,
                        codeLocation: { file, lines },
                        embedding,
                        relevance: await this.computeRelevance(adr.decision, snippet)
                    });
                }
                catch (e) {
                    // eslint-disable-next-line no-console
                    console.warn(`Failed to create anchor for ${file}:`, e);
                }
            }
        }
        return anchors;
    }
    async searchByCode(query, topK = 5) {
        const queryEmbedding = await this.embedder.embed(query);
        const results = [];
        // In production, query vector database
        // This is a placeholder
        return results.slice(0, topK);
    }
    async findRelatedADRs(codeLocation) {
        // Search ADRs anchored to this file
        return [];
    }
    async computeRelevance(decision, snippet) {
        const decisionEmbedding = await this.embedder.embed(decision);
        const snippetEmbedding = await this.embedder.embed(snippet);
        return cosineSimilarity(decisionEmbedding, snippetEmbedding);
    }
    async readFile(file) {
        // In production, read from filesystem
        return '';
    }
}
function cosineSimilarity(a, b) {
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
// Placeholder for ADRGenerator import
class ADRGenerator {
    async generateFromChange(change) {
        return {
            id: '',
            title: '',
            status: 'proposed',
            context: '',
            decision: '',
            consequences: [],
            semanticAnchors: [],
            createdAt: new Date(),
            updatedAt: new Date(),
            authors: []
        };
    }
}
//# sourceMappingURL=tracker.js.map