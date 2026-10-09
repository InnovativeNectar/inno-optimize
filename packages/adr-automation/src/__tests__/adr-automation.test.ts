import { describe, it, expect, beforeEach } from 'vitest';
import { ADRGenerator, ADRTracker, CIIntegration, SemanticAnchors } from '../index.js';
import type { MemoryInterface, Embedder } from '../index.js';
import type { ArchitecturalChange, ADR } from '@inno-optimize/agentdb';

const DIMS = 384;

const testEmbedder: Embedder = {
  async embed(text: string): Promise<number[]> {
    const v: number[] = new Array<number>(DIMS).fill(0);
    for (const tok of text.toLowerCase().split(/\W+/).filter(Boolean)) {
      let h = 0;
      for (let i = 0; i < tok.length; i++) h = (h * 31 + tok.charCodeAt(i)) >>> 0;
      const idx = h % DIMS;
      v[idx] = (v[idx] ?? 0) + 1;
    }
    const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    if (norm === 0) {
      v[0] = 1;
      return v;
    }
    return v.map(x => x / norm);
  }
};

const emptyMemory: MemoryInterface = {
  async query() {
    return [];
  }
};

function makeChange(overrides: Partial<ArchitecturalChange> = {}): ArchitecturalChange {
  return {
    id: 'change-1',
    type: 'new_module',
    description: 'Introduce a vector store module for semantic memory',
    affectedFiles: ['src/stores/vector-store.ts'],
    lineRanges: { 'src/stores/vector-store.ts': { start: 1, end: 50 } },
    impact: 'high',
    timestamp: new Date('2026-10-09T00:00:00Z'),
    ...overrides
  };
}

describe('adr-automation', () => {
  describe('ADRGenerator', () => {
    let generator: ADRGenerator;

    beforeEach(() => {
      generator = new ADRGenerator(emptyMemory, testEmbedder);
    });

    it('generates a numbered ADR from an architectural change', async () => {
      const adr = await generator.generateFromChange(makeChange());

      expect(adr.id).toBe('ADR-001');
      expect(adr.status).toBe('proposed');
      expect(adr.title).toContain('Introduce');
      expect(adr.context).toContain('Introduce a vector store module');
      expect(adr.decision).toContain('## Decision');
      expect(adr.authors).toEqual(['inno-optimize']);
      expect(adr.createdAt).toBeInstanceOf(Date);
      expect(adr.updatedAt).toBeInstanceOf(Date);
    });

    it('increments the ADR counter across generations', async () => {
      const first = await generator.generateFromChange(makeChange());
      const second = await generator.generateFromChange(
        makeChange({ id: 'change-2', type: 'refactor' })
      );

      expect(first.id).toBe('ADR-001');
      expect(second.id).toBe('ADR-002');
      expect(second.title).toContain('Refactor');
    });

    it('produces positive and neutral consequences', async () => {
      const adr = await generator.generateFromChange(makeChange());

      expect(adr.consequences.length).toBeGreaterThanOrEqual(2);
      expect(adr.consequences.map(c => c.type)).toContain('positive');
      expect(adr.consequences.map(c => c.type)).toContain('neutral');
      expect(adr.consequences.find(c => c.type === 'positive')?.description).toContain(
        'modularity'
      );
    });

    it('adds a negative consequence for critical impact', async () => {
      const adr = await generator.generateFromChange(
        makeChange({ impact: 'critical', type: 'dependency_change' })
      );

      expect(adr.consequences.map(c => c.type)).toContain('negative');
    });

    it('creates one semantic anchor per affected file', async () => {
      const adr = await generator.generateFromChange(
        makeChange({
          affectedFiles: ['src/a.ts', 'src/b.ts'],
          lineRanges: {
            'src/a.ts': { start: 1, end: 10 },
            'src/b.ts': { start: 5, end: 20 }
          }
        })
      );

      expect(adr.semanticAnchors).toHaveLength(2);
      const files = adr.semanticAnchors.map(a => a.codeLocation.file).sort();
      expect(files).toEqual(['src/a.ts', 'src/b.ts']);
      expect(adr.semanticAnchors.every(a => a.embedding.length === DIMS)).toBe(true);
    });

    it('passes retrieved patterns into the decision', async () => {
      const memory: MemoryInterface = {
        async query() {
          return [{ title: 'Layered storage pattern' }];
        }
      };
      const adr = await new ADRGenerator(memory, testEmbedder).generateFromChange(
        makeChange()
      );

      expect(adr.decision).toContain('Layered storage pattern');
    });
  });

  describe('ADRTracker', () => {
    let tracker: ADRTracker;

    beforeEach(async () => {
      tracker = new ADRTracker({
        storagePath: '.test-adrs',
        autoGenerate: false,
        ciIntegration: true,
        requiredForMerge: false
      });
      await tracker.initialize();
      await tracker.persist();
    });

    const adrBody = {
      title: 'Adopt FastStore',
      status: 'proposed' as const,
      context: 'We need memory',
      decision: 'Use FastStore',
      consequences: [{ type: 'positive' as const, description: 'faster', impact: 'high' as const }],
      semanticAnchors: [],
      authors: ['tester']
    };

    it('creates and retrieves ADRs', () => {
      const adr = tracker.createADR(adrBody);

      expect(adr.id).toBe('ADR-001');
      expect(tracker.getADR(adr.id)?.title).toBe('Adopt FastStore');
      expect(tracker.listADRs()).toHaveLength(1);
      expect(tracker.getProposedADRs()).toHaveLength(1);
      expect(tracker.getAcceptedADRs()).toHaveLength(0);
    });

    it('updates status and filters by it', () => {
      const adr = tracker.createADR(adrBody);
      const updated = tracker.updateStatus(adr.id, 'accepted');

      expect(updated?.status).toBe('accepted');
      expect(tracker.listADRs({ status: 'accepted' })).toHaveLength(1);
      expect(tracker.getProposedADRs()).toHaveLength(0);
      expect(tracker.updateStatus('ADR-999', 'accepted')).toBeNull();
    });

    it('supersedes an existing ADR and annotates the new one', () => {
      const oldAdr = tracker.createADR(adrBody);
      const newAdr = tracker.supersedeADR(oldAdr.id, {
        ...adrBody,
        title: 'Adopt Redis'
      });

      expect(tracker.getADR(oldAdr.id)?.status).toBe('superseded');
      expect(newAdr.consequences.some(c => c.description.includes(`Supersedes ${oldAdr.id}`))).toBe(
        true
      );
    });

    it('links ADRs with a relation note', () => {
      const from = tracker.createADR(adrBody);
      const to = tracker.createADR({ ...adrBody, title: 'Use HNSW' });

      tracker.linkADRs(from.id, to.id, 'related');

      expect(
        tracker.getADR(from.id)?.consequences.some(c => c.description.includes(`related ${to.id}`))
      ).toBe(true);
      tracker.linkADRs('ADR-000', to.id, 'related');
      expect(tracker.getADR('ADR-000')).toBeUndefined();
    });
  });

  describe('CIIntegration', () => {
    it('passes when no architectural changes are detected', async () => {
      const tracker = new ADRTracker({
        storagePath: '.test-adrs',
        autoGenerate: false,
        ciIntegration: true,
        requiredForMerge: true
      });
      const ci = new CIIntegration(tracker, new ADRGenerator(emptyMemory, testEmbedder));

      const pr = {
        id: 'pr-1',
        title: 'Add feature',
        description: 'Adds a feature',
        author: 'tester',
        baseBranch: 'main',
        headBranch: 'feature/x',
        files: [
          { filename: 'src/app.ts', additions: 10, deletions: 2, status: 'modified' as const }
        ]
      };

      const result = await ci.checkPR(pr);

      expect(result.passed).toBe(true);
      expect(result.message).toBe('No architectural changes detected');

      const generated = await ci.generateADRsForPR({ ...pr, files: [] });
      expect(generated).toEqual([]);
    });
  });

  describe('SemanticAnchors', () => {
    let anchors: SemanticAnchors;
    let adr: ADR;

    beforeEach(() => {
      anchors = new SemanticAnchors(testEmbedder);
      adr = {
        id: 'ADR-010',
        title: 'Introduce caching layer',
        status: 'accepted',
        context: 'ctx',
        decision: 'Use a read-through cache in front of the database',
        consequences: [],
        semanticAnchors: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        authors: ['tester']
      };
    });

    it('creates anchors bound to the ADR id and code locations', async () => {
      const created = await anchors.createAnchors(adr, [makeChange()]);

      expect(created).toHaveLength(1);
      expect(created[0]?.adrId).toBe('ADR-010');
      expect(created[0]?.codeLocation.file).toBe('src/stores/vector-store.ts');
      expect(created[0]?.embedding).toHaveLength(DIMS);
      expect(created[0]?.relevance).toBeGreaterThanOrEqual(0);
      expect(created[0]?.relevance).toBeLessThanOrEqual(1);
    });

    it('returns ranked (placeholder) results bounded by topK', async () => {
      const results = await anchors.searchByCode('vector store', 3);
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeLessThanOrEqual(3);
      expect(await anchors.findRelatedADRs('src/stores/vector-store.ts')).toEqual([]);
    });
  });
});
