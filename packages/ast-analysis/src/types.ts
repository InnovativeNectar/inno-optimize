import type Parser from 'tree-sitter';

export interface TreeSitterLanguage {
  name: string;
  language: unknown;
  nodeTypeInfo: unknown[];
}

export interface LanguageConfig {
  name: string;
  extensions: string[];
  parser: Parser; // Tree-sitter parser
  language: TreeSitterLanguage; // Tree-sitter language (query target)
  queries: {
    imports: string;
    exports: string;
    classes: string;
    functions: string;
    interfaces: string;
    types: string;
    calls: string;
    complexity: string;
  };
}

export interface ParseResult {
  file: string;
  language: string;
  ast: Parser.Tree; // Tree-sitter Tree
  imports: ImportInfo[];
  exports: ExportInfo[];
  classes: ClassInfo[];
  functions: FunctionInfo[];
  interfaces: InterfaceInfo[];
  types: TypeInfo[];
  calls: CallInfo[];
  metrics: FileMetrics;
  errors: ParseError[];
}

export interface ImportInfo {
  source: string;
  specifiers: string[];
  isDefault: boolean;
  isNamespace: boolean;
  line: number;
}

export interface ExportInfo {
  name: string;
  type: 'function' | 'class' | 'interface' | 'type' | 'const' | 'default';
  line: number;
  isDefault: boolean;
}

export interface ClassInfo {
  name: string;
  extends?: string;
  implements: string[];
  methods: MethodInfo[];
  properties: PropertyInfo[];
  line: number;
  endLine: number;
  complexity: number;
}

export interface MethodInfo {
  name: string;
  params: ParameterInfo[];
  returnType?: string;
  isAsync: boolean;
  isStatic: boolean;
  isPrivate: boolean;
  line: number;
  endLine: number;
  complexity: number;
}

export interface PropertyInfo {
  name: string;
  type?: string;
  isStatic: boolean;
  isPrivate: boolean;
  isReadonly: boolean;
  line: number;
}

export interface ParameterInfo {
  name: string;
  type?: string;
  optional: boolean;
  defaultValue?: string;
}

export interface FunctionInfo {
  name: string;
  params: ParameterInfo[];
  returnType?: string;
  isAsync: boolean;
  isGenerator: boolean;
  line: number;
  endLine: number;
  complexity: number;
}

export interface InterfaceInfo {
  name: string;
  extends: string[];
  properties: PropertyInfo[];
  methods: MethodInfo[];
  line: number;
}

export interface TypeInfo {
  name: string;
  kind: 'type' | 'interface' | 'enum';
  definition: string;
  line: number;
}

export interface CallInfo {
  callee: string;
  caller: string;
  line: number;
  isMethodCall: boolean;
  argsCount: number;
}

export interface FileMetrics {
  linesOfCode: number;
  linesOfComments: number;
  blankLines: number;
  cyclomaticComplexity: number;
  cognitiveComplexity: number;
  nestingDepth: number;
  halsteadVolume: number;
  maintainabilityIndex: number;
}

export interface ParseError {
  message: string;
  line: number;
  column: number;
  severity: 'error' | 'warning';
}

export interface ArchitectureScore {
  projectId: string;
  timestamp: Date;
  overall: number;
  dimensions: {
    maintainability: DimensionScore;
    scalability: DimensionScore;
    security: DimensionScore;
    performance: DimensionScore;
  };
  trends: ScoreTrend[];
  fileScores: FileScore[];
  recommendations: Recommendation[];
}

export interface DimensionScore {
  score: number;
  weight: number;
  factors: FactorScore[];
}

export interface FactorScore {
  name: string;
  score: number;
  weight: number;
  description: string;
}

export interface ScoreTrend {
  dimension: string;
  values: number[];
  timestamps: Date[];
  trend: 'improving' | 'stable' | 'degrading';
  forecast: number;
}

export interface FileScore {
  file: string;
  language: string;
  score: number;
  dimensionScores: Record<string, number>;
  issues: Issue[];
}

export interface Issue {
  type: 'anti_pattern' | 'complexity' | 'coupling' | 'security' | 'performance';
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  location: { file: string; line: number; column: number };
  suggestion: string;
  ruleId: string;
}

export interface Recommendation {
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  title: string;
  description: string;
  affectedFiles: string[];
  estimatedEffort: string;
  impact: string;
}

export interface AntiPattern {
  type: AntiPatternType;
  name: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  detection: DetectionRule;
  refactoring: RefactoringSuggestion;
}

export type AntiPatternType = 
  | 'god_class'
  | 'god_method'
  | 'circular_dependency'
  | 'layer_violation'
  | 'shotgun_surgery'
  | 'feature_envy'
  | 'data_clump'
  | 'long_parameter_list'
  | 'dead_code'
  | 'duplicate_code'
  | 'inappropriate_intimacy'
  | 'refused_bequest'
  | 'speculative_generality'
  | 'temporary_field'
  | 'switch_statements';

export interface DetectionRule {
  query?: string; // Tree-sitter query
  threshold?: Record<string, number>;
  custom?: (parseResult: ParseResult) => boolean;
}

export interface RefactoringSuggestion {
  pattern: string;
  description: string;
  steps: string[];
  automated: boolean;
  codemodId?: string;
}

export interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  cycles: string[][];
  layers: Map<string, number>;
}

export interface DependencyNode {
  id: string;
  name: string;
  type: 'file' | 'module' | 'package';
  language: string;
  metrics: FileMetrics;
}

export interface DependencyEdge {
  from: string;
  to: string;
  type: 'import' | 'require' | 'dynamic_import';
  weight: number;
}

export interface IncrementalChange {
  file: string;
  type: 'added' | 'modified' | 'deleted';
  oldContent?: string;
  newContent: string;
  affectedLines: { start: number; end: number };
}

export interface DeltaAnalysis {
  changedFiles: ParseResult[];
  affectedFiles: ParseResult[]; // Files that depend on changed files
  scoreDelta: number;
  newIssues: Issue[];
  resolvedIssues: Issue[];
  newPatterns: AntiPattern[];
}