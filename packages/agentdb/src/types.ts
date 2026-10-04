export interface MemoryEntry {
  id: string;
  type: 'working' | 'episodic' | 'semantic';
  tier: 1 | 2 | 3;
  
  content: string;
  embedding: number[];
  metadata: {
    domain: string;
    taskType: string;
    mode: string;
    context: string;
    tags: string[];
  };
  
  provenance: {
    agentId: string;
    sessionId: string;
    trajectoryId?: string;
    source: 'human' | 'agent' | 'distillation' | 'transfer';
    timestamp: Date;
    mergedFrom?: string[];
  };
  
  reward: number;
  verdict?: 'success' | 'failure';
  loraWeights?: LoRAWeights;
  ewcImportance?: number[];
  consolidated: boolean;
  consolidatedAt?: Date;
  
  accessCount: number;
  lastAccessed: Date;
  createdAt: Date;
}

export interface LoRAWeights {
  rank: number;
  alpha: number;
  weightsA: number[][];
  weightsB: number[][];
  scales: number[];
}

export interface SearchQuery {
  vector: number[];
  textQuery?: string;
  k?: number;
  filter?: Record<string, any>;
  useCache?: boolean;
  vectorHash?: string;
}

export interface SearchResult {
  entry: MemoryEntry;
  score: number;
  source: 'cache' | 'hnsw' | 'agentdb';
}

export interface FastStoreConfig {
  path: string;
  dimensions: number;
  hnsw: {
    M: number;
    efConstruction: number;
    efSearch: number;
  };
  quantization: {
    defaultLevel: 'none' | 'pq8' | 'pq4' | 'binary' | 'rabitq';
  };
  cache: {
    maxSize: number;
    ttlMs: number;
  };
}

export interface ArchitecturalChange {
  id: string;
  type: 'refactor' | 'new_module' | 'dependency_change' | 'pattern_introduction';
  description: string;
  affectedFiles: string[];
  lineRanges: Record<string, { start: number; end: number }>;
  impact: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
}

export interface ADR {
  id: string;
  title: string;
  status: 'proposed' | 'accepted' | 'superseded' | 'deprecated';
  context: string;
  decision: string;
  consequences: Consequence[];
  semanticAnchors: SemanticAnchor[];
  createdAt: Date;
  updatedAt: Date;
  authors: string[];
}

export interface Consequence {
  type: 'positive' | 'negative' | 'neutral';
  description: string;
  impact: 'low' | 'medium' | 'high';
}

export interface SemanticAnchor {
  adrId: string;
  codeLocation: {
    file: string;
    lines: { start: number; end: number };
  };
  embedding: number[];
  relevance: number;
}

export interface TaskContext {
  id: string;
  type: string;
  description: string;
  codeContext?: string;
  constraints: string[];
  acceptanceCriteria: string[];
  mode: 'convergent' | 'divergent' | 'lateral' | 'systems' | 'critical';
}

export interface Trajectory {
  id: string;
  agentId: string;
  sessionId: string;
  task: TaskContext;
  steps: TrajectoryStep[];
  outcome: TaskOutcome;
  reward: number;
  mode: string;
  startedAt: Date;
  endedAt: Date;
}

export interface TrajectoryStep {
  action: string;
  result: string;
  reward: number;
  timestamp: Date;
}

export interface TaskOutcome {
  success: boolean;
  output: any;
  metrics: {
    latencyMs: number;
    toolCalls: number;
    memoryQueries: number;
  };
}

export interface ReasoningPattern {
  id: string;
  title: string;
  description: string;
  content: string;
  reward: number;
  mode: string;
  verdict: 'success' | 'failure';
  loraWeights: LoRAWeights;
  consolidated: boolean;
  createdAt: Date;
}