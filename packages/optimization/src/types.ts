export interface OAPELCycle {
  id: string;
  status: 'observing' | 'analyzing' | 'planning' | 'executing' | 'learning' | 'completed' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  currentPhase: 'observe' | 'analyze' | 'plan' | 'execute' | 'learn';
  
  // Phase data
  observations: Observation[];
  analysis: AnalysisResult | null;
  plan: ExecutionPlan | null;
  execution: ExecutionResult | null;
  learning: LearningResult | null;
}

export interface Observation {
  id: string;
  type: 'metric' | 'log' | 'event' | 'pattern' | 'anomaly';
  source: string;
  timestamp: Date;
  data: unknown;
  severity: 'info' | 'warning' | 'critical';
}

export interface AnalysisResult {
  id: string;
  bottlenecks: Bottleneck[];
  debtItems: DebtItem[];
  patterns: DiscoveredPattern[];
  anomalies: Anomaly[];
  recommendations: Recommendation[];
  confidence: number;
}

export interface Bottleneck {
  component: string;
  metric: string;
  currentValue: number;
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  suggestedAction: string;
}

export interface DebtItem {
  file: string;
  type: 'complexity' | 'duplication' | 'coupling' | 'outdated' | 'security';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  estimatedEffort: string;
  affectedFiles: string[];
}

export interface DiscoveredPattern {
  pattern: string;
  frequency: number;
  locations: string[];
  category: 'anti-pattern' | 'best-practice' | 'optimization';
  confidence: number;
}

export interface Anomaly {
  metric: string;
  expectedRange: [number, number];
  actualValue: number;
  deviation: number;
  possibleCauses: string[];
}

export interface Recommendation {
  id: string;
  type: 'refactor' | 'optimize' | 'secure' | 'test' | 'document';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  affectedFiles: string[];
  estimatedImpact: ImpactEstimate;
  estimatedEffort: string;
  prerequisites: string[];
}

export interface ImpactEstimate {
  performanceGain: number;    // percentage
  memoryReduction: number;    // percentage
  securityImprovement: number; // 0-1
  maintainabilityGain: number; // 0-1
}

export interface ExecutionPlan {
  id: string;
  tasks: PlanTask[];
  dependencies: TaskDependency[];
  estimatedDuration: number; // ms
  requiredAgents: string[];
  rollbackPlan: RollbackStep[];
}

export interface PlanTask {
  id: string;
  type: 'refactor' | 'optimize' | 'test' | 'deploy' | 'verify' | 'secure' | 'document';
  description: string;
  targetFiles: string[];
  agentType: string;
  estimatedDuration: number;
  acceptanceCriteria: string[];
  rollbackAction?: string;
}

export interface TaskDependency {
  from: string;
  to: string;
  type: 'blocks' | 'requires' | 'enables';
}

export interface RollbackStep {
  taskId: string;
  action: string;
  verification: string;
}

export interface ExecutionResult {
  taskResults: TaskResult[];
  success: boolean;
  durationMs: number;
  errors: ExecutionError[];
  metrics: ExecutionMetrics;
}

export interface TaskResult {
  taskId: string;
  success: boolean;
  output: { error?: string; [key: string]: unknown };
  durationMs: number;
  agentId: string;
  artifacts: string[];
}

export interface ExecutionError {
  taskId: string;
  error: string;
  recoverable: boolean;
  recoveryAction?: string;
}

export interface ExecutionMetrics {
  tasksCompleted: number;
  tasksFailed: number;
  totalDurationMs: number;
  agentsUsed: number;
  memoryQueries: number;
  toolCalls: number;
}

export interface LearningResult {
  patternsLearned: number;
  patternsValidated: number;
  patternsRejected: number;
  knowledgeTransferred: number;
  ewcConsolidations: number;
  sonaAdaptations: number;
  moeRoutingUpdates: number;
  insights: Insight[];
}

export interface Insight {
  type: 'pattern' | 'causal' | 'predictive' | 'counterfactual';
  description: string;
  confidence: number;
  evidence: string[];
  applicableContexts: string[];
}

export interface OAPELConfig {
  observeInterval: number;        // ms
  analyzeThreshold: number;       // confidence threshold
  planMaxTasks: number;
  executeMaxConcurrent: number;
  learnMinConfidence: number;     // min confidence to persist
  cycleTimeout: number;           // max cycle duration
}

export type ABTestStatus = 'pending' | 'running' | 'completed' | 'failed' | 'pending_clearance';

export interface ABVariantConfig {
  id: string;
  name: string;
  description: string;
  config: unknown;
  weight?: number;
  cowBranch?: string;
  parameters?: Record<string, unknown>;
}

export interface ABTest {
  id: string;
  name: string;
  status: ABTestStatus;
  hypothesis: string;
  variants: ABVariant[];
  metrics: ABMetric[];
  startedAt?: Date;
  completedAt?: Date;
  winner?: string;
  significance: number;
  sampleSize: number;
}

export interface ABVariant {
  id: string;
  name: string;
  description: string;
  config: unknown;       // Variant-specific configuration
  weight: number;        // Traffic allocation (0-1)
  cowBranch?: string | undefined;   // Agenticow COW branch path
  parameters: Record<string, unknown>;
}

export interface ABMetric {
  name: string;
  type: 'primary' | 'secondary' | 'guardrail';
  target: 'increase' | 'decrease';
  threshold: number;
  currentA: number;
  currentB: number;
  pValue?: number;
  confidenceInterval?: [number, number];
}

export interface ABTestConfig {
  minSampleSize: number;
  maxDuration: number;      // ms
  significanceLevel: number; // 0.05
  power: number;            // 0.8
  guardrailMetrics: string[];
  autoPromote: boolean;
  requireClearance: boolean; // ADR-171
}

export interface RegressionAlert {
  id: string;
  metric: string;
  baseline: number;
  current: number;
  delta: number;
  deltaPercent: number;
  severity: 'info' | 'warning' | 'critical';
  detectedAt: Date;
  commitRange: string;
  affectedComponents: string[];
  suggestedAction: string;
  acknowledged: boolean;
}

export interface RegressionConfig {
  metrics: RegressionMetric[];
  thresholds: {
    warning: number;    // 5%
    critical: number;   // 10%
  };
  lookbackWindow: number;     // commits
  statisticalTest: 'mann-whitney' | 'welch-t' | 'bootstrap';
  minSamples: number;
  autoAlert: boolean;
}

export interface RegressionMetric {
  name: string;
  baseline: number;
  current: number;
  unit: string;
  higherIsBetter: boolean;
  category: 'latency' | 'throughput' | 'memory' | 'quality' | 'cost';
}

export interface FlywheelEvaluation {
  id: string;
  status: 'evaluating' | 'promoted' | 'rejected' | 'pending_clearance';
  candidate: FlywheelCandidate;
  evaluation: EvaluationResult;
  receipt: FlywheelReceipt | null;
  promotedAt?: Date;
  promotedBy?: string;
}

export interface FlywheelCandidate {
  id: string;
  version: string;
  description: string;
  changes: CandidateChange[];
  evidence: Evidence[];
  metadata: CandidateMetadata;
}

export interface CandidateChange {
  type: 'code' | 'config' | 'prompt' | 'pattern' | 'template';
  description: string;
  files: string[];
  diff?: string;
}

export interface Evidence {
  type: 'benchmark' | 'test' | 'simulation' | 'production' | 'audit' | 'abtest' | 'regression';
  source: string;
  data: unknown;
  timestamp: Date;
  verified: boolean;
}

export interface CandidateMetadata {
  author: string;
  createdAt: Date;
  tags: string[];
  parentVersion: string;
}

export interface EvaluationResult {
  passed: boolean;
  score: number;
  criteria: EvaluationCriterion[];
  benchmarks: BenchmarkResult[];
  tests: TestResult[];
  audits: AuditResult[];
}

export interface EvaluationCriterion {
  name: string;
  weight: number;
  threshold: number;
  actual: number;
  passed: boolean;
}

export interface BenchmarkResult {
  name: string;
  baseline: number;
  candidate: number;
  delta: number;
  deltaPercent: number;
  passed: boolean;
}

export interface TestResult {
  suite: string;
  passed: number;
  failed: number;
  coverage: number;
  durationMs: number;
}

export interface AuditResult {
  type: 'security' | 'performance' | 'compliance' | 'quality';
  passed: boolean;
  findings: AuditFinding[];
}

export interface AuditFinding {
  severity: 'info' | 'warning' | 'error' | 'critical';
  category: string;
  message: string;
  file?: string;
  line?: number;
}

export interface FlywheelReceipt {
  id: string;
  candidateId: string;
  evaluationHash: string;
  promotedAt: Date;
  promotedBy: string;
  signatures: ReceiptSignature[];
  anchorHash: string;
}

export interface ReceiptSignature {
  signer: string;
  signature: string;
  algorithm: string;
  timestamp: Date;
}

export interface FlywheelConfig {
  anchorPath: string;
  anchorHash: string;
  evaluationTimeout: number;
  requireClearance: boolean;
  minScore: number;
  maxConcurrency: number;
}

export interface Template {
  id: string;
  name: string;
  version: string;
  description: string;
  category: 'agent' | 'saga' | 'mcp' | 'pattern' | 'workflow' | 'configuration';
  tags: string[];
  content: string;
  variables: TemplateVariable[];
  metadata: TemplateMetadata;
}

export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required: boolean;
  default?: unknown;
  validation?: string;
}

export interface TemplateMetadata {
  author: string;
  createdAt: Date;
  updatedAt: Date;
  version: string;
  downloads: number;
  rating: number;
  tags: string[];
  compatibleVersions: string[];
}

export interface TemplateInstance {
  id: string;
  templateId: string;
  values: Record<string, unknown>;
  generatedAt: Date;
  outputPath: string;
  status: 'generated' | 'validated' | 'deployed';
}