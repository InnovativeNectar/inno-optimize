import { ADR, ArchitecturalChange, SemanticAnchor, Consequence, ImpactAnalysis } from '@inno-optimize/agentdb';

export interface ADRTrackerConfig {
  storagePath: string;
  autoGenerate: boolean;
  ciIntegration: boolean;
  requiredForMerge: boolean;
}

export class ADRTracker {
  private adrs = new Map<string, ADR>();
  private config: ADRTrackerConfig;
  
  constructor(config: ADRTrackerConfig) {
    this.config = config;
  }
  
  async initialize(): Promise<void> {
    // Load existing ADRs from storage
    // In production, read from filesystem
  }
  
  createADR(adr: Omit<ADR, 'id' | 'createdAt' | 'updatedAt'>): ADR {
    const id = this.generateId();
    const now = new Date();
    
    const newADR: ADR = {
      ...adr,
      id,
      createdAt: now,
      updatedAt: now
    };
    
    this.adrs.set(id, newADR);
    return newADR;
  }
  
  updateADR(id: string, updates: Partial<ADR>): ADR | null {
    const adr = this.adrs.get(id);
    if (!adr) return null;
    
    const updated = { ...adr, ...updates, updatedAt: new Date() };
    this.adrs.set(id, updated);
    return updated;
  }
  
  updateStatus(id: string, status: ADR['status']): ADR | null {
    return this.updateADR(id, { status });
  }
  
  getADR(id: string): ADR | undefined {
    return this.adrs.get(id);
  }
  
  listADRs(filter?: { status?: ADR['status']; author?: string }): ADR[] {
    let results = Array.from(this.adrs.values());
    
    if (filter?.status) {
      results = results.filter(a => a.status === filter.status);
    }
    if (filter?.author) {
      results = results.filter(a => a.authors.includes(filter.author!));
    }
    
    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  
  getProposedADRs(): ADR[] {
    return this.listADRs({ status: 'proposed' });
  }
  
  getAcceptedADRs(): ADR[] {
    return this.listADRs({ status: 'accepted' });
  }
  
  supersedeADR(oldId: string, newADR: Omit<ADR, 'id' | 'createdAt' | 'updatedAt'>): ADR {
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
  
  linkADRs(fromId: string, toId: string, relation: 'supersedes' | 'related' | 'depends-on'): void {
    const from = this.adrs.get(fromId);
    const to = this.adrs.get(toId);
    if (!from || !to) return;
    
    // Add cross-reference in consequences
    from.consequences.push({
      type: 'neutral',
      description: `${relation} ${toId}: ${to.title}`,
      impact: 'low'
    });
    this.adrs.set(fromId, from);
  }
  
  private generateId(): string {
    const count = this.adrs.size + 1;
    return `ADR-${String(count).padStart(3, '0')}`;
  }
  
  async persist(): Promise<void> {
    // In production, write to filesystem
  }
}

export class CIIntegration {
  private tracker: ADRTracker;
  private generator: ADRGenerator;
  
  constructor(tracker: ADRTracker, generator: ADRGenerator) {
    this.tracker = tracker;
    this.generator = generator;
  }
  
  async checkPR(pr: PullRequest): Promise<CICheckResult> {
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
  
  async generateADRsForPR(pr: PullRequest): Promise<ADR[]> {
    const changes = await this.analyzePRChanges(pr);
    const architecturalChanges = this.filterArchitecturalChanges(changes);
    const adrs: ADR[] = [];
    
    for (const change of architecturalChanges) {
      const adr = await this.generator.generateFromChange(change);
      this.tracker.createADR(adr);
      adrs.push(adr);
    }
    
    return adrs;
  }
  
  private async analyzePRChanges(pr: PullRequest): Promise<ArchitecturalChange[]> {
    // In production, analyze actual PR diff
    return [];
  }
  
  private filterArchitecturalChanges(changes: ArchitecturalChange[]): ArchitecturalChange[] {
    return changes.filter(c => 
      c.impact === 'high' || c.impact === 'critical' ||
      c.type === 'new_module' || c.type === 'pattern_introduction'
    );
  }
  
  private hasADRForChange(change: ArchitecturalChange): boolean {
    const adrs = this.tracker.listADRs();
    return adrs.some(adr => 
      adr.semanticAnchors.some((anchor: SemanticAnchor) => 
        change.affectedFiles.includes(anchor.codeLocation.file)
      )
    );
  }
  
  private generateADRSuggestion(change: ArchitecturalChange): string {
    return `Consider creating ADR for ${change.type} in ${change.affectedFiles.join(', ')}`;
  }
}

export interface PullRequest {
  id: string;
  title: string;
  description: string;
  files: PRFile[];
  author: string;
  baseBranch: string;
  headBranch: string;
}

export interface PRFile {
  filename: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  patch?: string;
}

export interface CICheckResult {
  passed: boolean;
  message: string;
  missingADRs?: Array<{ file: string; suggestion: string }>;
}

export class SemanticAnchors {
  private embedder: Embedder;
  
  constructor(embedder: Embedder) {
    this.embedder = embedder;
  }
  
  async createAnchors(adr: ADR, changes: ArchitecturalChange[]): Promise<SemanticAnchor[]> {
    const anchors: SemanticAnchor[] = [];
    
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
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn(`Failed to create anchor for ${file}:`, e);
        }
      }
    }
    
    return anchors;
  }
  
  async searchByCode(query: string, topK: number = 5): Promise<Array<{ adr: ADR; anchor: SemanticAnchor; score: number }>> {
    const queryEmbedding = await this.embedder.embed(query);
    const results: Array<{ adr: ADR; anchor: SemanticAnchor; score: number }> = [];
    
    // In production, query vector database
    // This is a placeholder
    
    return results.slice(0, topK);
  }
  
  async findRelatedADRs(codeLocation: string): Promise<ADR[]> {
    // Search ADRs anchored to this file
    return [];
  }
  
  private async computeRelevance(decision: string, snippet: string): Promise<number> {
    const decisionEmbedding = await this.embedder.embed(decision);
    const snippetEmbedding = await this.embedder.embed(snippet);
    return cosineSimilarity(decisionEmbedding, snippetEmbedding);
  }
  
  private async readFile(file: string): Promise<string> {
    // In production, read from filesystem
    return '';
  }
}

interface Embedder {
  embed(text: string): Promise<number[]>;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 0;
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
  async generateFromChange(change: ArchitecturalChange): Promise<ADR> {
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