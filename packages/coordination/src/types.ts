export interface SwarmConfig {
  topology: 'hierarchical' | 'hierarchical-mesh' | 'mesh' | 'star' | 'ring';
  consensus: 'raft' | 'byzantine' | 'gossip' | 'crdt' | 'quorum';
  maxAgents: number;
  memoryNamespace: string;
  antiDrift: boolean;
  persistent: boolean;
  hooksIntegration: boolean;
  queenId?: string;
  pheromoneConfig?: PheromoneConfig;
}

export interface PheromoneConfig {
  alpha: number;                 // EMA decay (default 0.3)
  thetaMultiplier: number;       // Threshold = globalEMA * multiplier (default 0.6)
  warmupSamples: number;         // Min samples before eligibility (default 3)
  protectedRoles: string[];      // Never pruned: ['coordinator', 'queen', 'security']
  minActiveAgents: number;       // Hard floor for quorum
  recoveryRate: number;          // Suspended agent recovery probability
  explorationRate: number;       // Random exploration probability
}

export interface AgentPheromone {
  agentId: string;
  role: string;
  emaScore: number;
  sampleCount: number;
  eligible: boolean;
  lastUpdated: Date;
  suspensionCount: number;
  recoveryAttempts: number;
}

export interface SwarmStatus {
  swarmId: string;
  topology: string;
  consensus: string;
  agentCount: number;
  maxAgents: number;
  eligibleAgents: number;
  suspendedAgents: number;
  queenId?: string;
  pheromoneStats: {
    globalEMA: number;
    threshold: number;
    avgEligibility: number;
  };
  consensusMetrics: {
    lastTerm: number;
    committedEntries: number;
    leaderId?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskAssignment {
  taskId: string;
  agentId: string;
  assignedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  status: 'assigned' | 'running' | 'completed' | 'failed';
  outcome?: TaskOutcome;
}

export interface TaskOutcome {
  success: boolean;
  output: any;
  metrics: {
    latencyMs: number;
    toolCalls: number;
    memoryQueries: number;
    pheromoneUpdate: number;
    consensusScore?: number;
  };
}

export interface SagaDefinition {
  id: string;
  name: string;
  version: string;
  steps: SagaStep[];
  compensation: CompensationPlan;
  timeout: number;
  retryPolicy: RetryPolicy;
  idempotencyKeys: string[];
}

export interface SagaStep<TInput = any, TOutput = any> {
  id: string;
  name: string;
  connector: string;
  operation: string;
  inputMapper: (context: SagaContext) => TInput;
  outputMapper: (result: TOutput, context: SagaContext) => Partial<SagaContext>;
  compensation?: CompensationAction;
  timeout: number;
  retryPolicy?: RetryPolicy;
  idempotencyKey?: string;
}

export interface CompensationAction {
  stepId: string;
  connector: string;
  operation: string;
  inputMapper: (context: SagaContext, stepOutput: any) => any;
}

export interface CompensationPlan {
  strategy: 'backward' | 'forward' | 'custom';
  steps: CompensationAction[];
}

export interface RetryPolicy {
  maxRetries: number;
  backoff: 'fixed' | 'exponential' | 'linear';
  baseDelayMs: number;
  maxDelayMs: number;
  retryableErrors: string[];
}

export interface SagaContext {
  sagaId: string;
  executionId: string;
  stepOutputs: Map<string, any>;
  compensationData: Map<string, any>;
  startedAt: Date;
  currentStep?: string;
  status: 'running' | 'completed' | 'compensating' | 'failed';
  error?: Error;
}

export interface SagaResult {
  success: boolean;
  context: SagaContext;
  completedSteps: CompletedStep[];
  durationMs: number;
}

export interface CompletedStep {
  step: SagaStep;
  result: any;
  timestamp: Date;
  durationMs: number;
}

export interface SagaExecution {
  id: string;
  definition: SagaDefinition;
  context: SagaContext;
  status: 'running' | 'completed' | 'compensating' | 'failed';
  startedAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface BusinessConnector {
  id: string;
  name: string;
  type: 'crm' | 'erp' | 'payment' | 'messaging' | 'analytics' | 'inventory' | 'orders' | 'custom';
  auth: ConnectorAuth;
  operations: ConnectorOperation[];
  syncConfig?: SyncConfig;
  webhooks?: WebhookConfig[];
  execute(operation: string, input: any): Promise<any>;
}

export interface ConnectorAuth {
  type: 'oauth2' | 'api_key' | 'basic' | 'jwt' | 'mtls';
  config: Record<string, any>;
  tokenRefresh?: TokenRefreshConfig;
}

export interface TokenRefreshConfig {
  refreshUrl: string;
  clientId: string;
  clientSecret: string;
  scopes: string[];
}

export interface ConnectorOperation {
  name: string;
  description: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  parameters: JSONSchema;
  response: JSONSchema;
  idempotent: boolean;
  rateLimit?: RateLimit;
}

export interface RateLimit {
  requestsPerSecond: number;
  burst?: number;
}

export interface SyncConfig {
  interval: number;
  mode: 'incremental' | 'full';
  cursorField: string;
  batchSize: number;
}

export interface WebhookConfig {
  url: string;
  events: string[];
  secret: string;
  retryPolicy: RetryPolicy;
}

export interface JSONSchema {
  type: string;
  description?: string;
  properties?: Record<string, JSONSchema>;
  items?: JSONSchema;
  required?: string[];
  enum?: any[];
  default?: any;
  minimum?: number;
  maximum?: number;
  format?: string;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
}

export interface BusinessMCPServer {
  name: string;
  transport: 'stdio' | 'http' | 'sse';
  command?: string;
  args?: string[];
  url?: string;
  headers?: Record<string, string>;
  tools: ToolDescriptor[];
  resources: ResourceDescriptor[];
  prompts: PromptDescriptor[];
  tier: 1 | 2 | 3;
  tags: string[];
  capabilities: string[];
  destructive: boolean;
  rateLimits: RateLimitConfig;
}

export interface ToolDescriptor {
  id: string;
  name: string;
  description: string;
  inputSchema: JSONSchema;
  outputSchema: JSONSchema;
  serverId: string;
  tier: 1 | 2 | 3;
  capabilities: string[];
  destructive: boolean;
}

export interface ResourceDescriptor {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

export interface PromptDescriptor {
  name: string;
  description: string;
  arguments: JSONSchema;
}

export interface RateLimitConfig {
  requestsPerMinute: number;
  burst?: number;
}

export interface CoordinationMetrics {
  swarmHealth: SwarmHealthMetrics;
  sagaMetrics: SagaMetrics;
  pheromoneMetrics: PheromoneMetrics;
  connectorMetrics: ConnectorMetrics;
}

export interface SwarmHealthMetrics {
  agentCount: number;
  eligibleRatio: number;
  consensusLatencyMs: number;
  messageThroughput: number;
  errorRate: number;
}

export interface SagaMetrics {
  executionsTotal: number;
  executionsSuccessful: number;
  executionsCompensated: number;
  executionsFailed: number;
  avgDurationMs: number;
  compensationRate: number;
}

export interface PheromoneMetrics {
  globalEMA: number;
  threshold: number;
  eligibleCount: number;
  suspendedCount: number;
  avgScore: number;
  scoreDistribution: number[];
}

export interface ConnectorMetrics {
  callsTotal: number;
  callsSuccessful: number;
  callsFailed: number;
  avgLatencyMs: number;
  rateLimitHits: number;
}

export interface ConnectorRegistry {
  getConnector(id: string): BusinessConnector | undefined;
  register(connector: BusinessConnector): void;
}

export interface PheromoneUpdate {
  agentId: string;
  outcome: TaskOutcome;
  timestamp: number;
}

export interface AgentInfo {
  id: string;
  type: string;
  name: string;
  role: string;
  capabilities: string[];
  model: string;
  status: 'idle' | 'running' | 'stopped';
  spawnedAt: Date;
  currentTask: string | null;
}

export interface AgentSpawnConfig {
  id?: string;
  type: string;
  name: string;
  role?: string;
  capabilities?: string[];
  model?: string;
}

export interface NodeInfo {
  id: string;
  joinedAt: Date;
  lastHeartbeat: Date;
  status: 'active' | 'suspected' | 'down';
}

export interface ConsensusProposal {
  id: string;
  type: string;
  data: any;
  proposer: string;
  timestamp: Date;
}

export interface ConsensusProposal {
  id: string;
  type: string;
  data: any;
  proposer: string;
  timestamp: Date;
}

export interface ProposalInfo {
  id: string;
  type: string;
  data: any;
  proposer: string;
  status: 'pending' | 'accepted' | 'rejected';
  votes: Map<string, boolean>;
  createdAt: Date;
}

export interface MessageBus {
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
}

export interface ConsensusEngine {
  initialize(swarmId: string, maxNodes: number): Promise<void>;
  join(nodeId: string): Promise<void>;
  leave(nodeId: string): Promise<void>;
  propose(proposal: ConsensusProposal): Promise<string>;
  vote(proposalId: string, voterId: string, vote: boolean): Promise<void>;
  getMetrics(): any;
  getHealth(): any;
  shutdown(): Promise<void>;
}