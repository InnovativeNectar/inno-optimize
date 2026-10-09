import type { 
  ParseResult, 
  ArchitectureScore, 
  DimensionScore, 
  FactorScore, 
  FileScore, 
  Issue,
  ScoreTrend,
  Recommendation,
  DependencyGraph,
  DependencyNode,
  DependencyEdge
} from './types.js';
import {
  AntiPattern
} from './types.js';

export class ArchitectureScorer {
  private weights = {
    maintainability: 0.35,
    scalability: 0.25,
    security: 0.25,
    performance: 0.15
  };
  
  private dimensionWeights = {
    maintainability: {
      cyclomaticComplexity: 0.25,
      cognitiveComplexity: 0.20,
      maintainabilityIndex: 0.25,
      coupling: 0.15,
      cohesion: 0.15
    },
    scalability: {
      moduleCoupling: 0.30,
      dependencyDepth: 0.25,
      layerViolations: 0.20,
      asyncPatterns: 0.15,
      caching: 0.10
    },
    security: {
      authCoverage: 0.25,
      inputValidation: 0.20,
      secretsManagement: 0.20,
      cryptoUsage: 0.20,
      vulnerabilitySurface: 0.15
    },
    performance: {
      hotPaths: 0.30,
      asyncAwait: 0.20,
      memoryPatterns: 0.20,
      dbQueries: 0.15,
      caching: 0.15
    }
  };
  
  scoreProject(parseResults: ParseResult[], projectId: string): ArchitectureScore {
    const fileScores = this.scoreFiles(parseResults);
    const dependencyGraph = this.buildDependencyGraph(parseResults);
    
    const dimensions = {
      maintainability: this.scoreMaintainability(parseResults, fileScores, dependencyGraph),
      scalability: this.scoreScalability(parseResults, fileScores, dependencyGraph),
      security: this.scoreSecurity(parseResults, fileScores, dependencyGraph),
      performance: this.scorePerformance(parseResults, fileScores, dependencyGraph)
    };
    
    const overall = this.computeOverall(dimensions);
    const trends = this.computeTrends(projectId, dimensions);
    const recommendations = this.generateRecommendations(dimensions, fileScores, parseResults);
    
    return {
      projectId,
      timestamp: new Date(),
      overall,
      dimensions,
      trends,
      fileScores,
      recommendations
    };
  }
  
  private scoreFiles(parseResults: ParseResult[]): FileScore[] {
    return parseResults.map(result => {
      const dimensionScores = {
        maintainability: this.scoreFileMaintainability(result),
        scalability: this.scoreFileScalability(result),
        security: this.scoreFileSecurity(result),
        performance: this.scoreFilePerformance(result)
      };
      
      const overall = Object.entries(dimensionScores).reduce(
        (sum, [dim, score]) => sum + score * this.weights[dim as keyof typeof this.weights], 0
      );
      
      const issues = this.detectFileIssues(result, dimensionScores);
      
      return {
        file: result.file,
        language: result.language,
        score: Math.round(overall),
        dimensionScores,
        issues
      };
    });
  }
  
  private scoreFileMaintainability(result: ParseResult): number {
    const { metrics } = result;
    let score = 100;
    
    // Cyclomatic complexity penalty
    if (metrics.cyclomaticComplexity > 10) {
      score -= Math.min(30, (metrics.cyclomaticComplexity - 10) * 2);
    }
    
    // Cognitive complexity penalty
    if (metrics.cognitiveComplexity > 15) {
      score -= Math.min(25, (metrics.cognitiveComplexity - 15) * 1.5);
    }
    
    // Maintainability index bonus/penalty
    if (metrics.maintainabilityIndex < 65) {
      score -= (65 - metrics.maintainabilityIndex) * 0.5;
    } else if (metrics.maintainabilityIndex > 85) {
      score += Math.min(10, (metrics.maintainabilityIndex - 85) * 0.3);
    }
    
    // Nesting depth penalty
    if (metrics.nestingDepth > 4) {
      score -= Math.min(15, (metrics.nestingDepth - 4) * 3);
    }
    
    return Math.max(0, Math.min(100, score));
  }
  
  private scoreFileScalability(result: ParseResult): number {
    let score = 100;
    
    // Check for async patterns
    const hasAsync = result.functions.some(f => f.isAsync);
    if (!hasAsync && result.language !== 'go') {
      score -= 10; // Penalty for no async in languages that support it
    }
    
    // Check for deep call chains
    const maxCallDepth = this.computeMaxCallDepth(result);
    if (maxCallDepth > 10) {
      score -= Math.min(20, (maxCallDepth - 10) * 2);
    }
    
    // Check for god classes
    const godClasses = result.classes.filter(c => c.methods.length > 20 || c.properties.length > 15);
    score -= godClasses.length * 15;
    
    return Math.max(0, Math.min(100, score));
  }
  
  private scoreFileSecurity(result: ParseResult): number {
    let score = 100;
    
    // Check for hardcoded secrets patterns
    const content = this.getFileContent(result);
    const secretPatterns = [
      /api[_-]?key\s*[:=]\s*['"][^'"]+['"]/i,
      /password\s*[:=]\s*['"][^'"]+['"]/i,
      /secret\s*[:=]\s*['"][^'"]+['"]/i,
      /token\s*[:=]\s*['"][^'"]+['"]/i
    ];
    
    for (const pattern of secretPatterns) {
      if (pattern.test(content)) {
        score -= 30;
      }
    }
    
    // Check for SQL injection risks
    const sqlInjectionPatterns = [
      /query\s*\(\s*['"].*\$\{.*\}.*['"]/,
      /execute\s*\(\s*['"].*\$\{.*\}.*['"]/
    ];
    
    for (const pattern of sqlInjectionPatterns) {
      if (pattern.test(content)) {
        score -= 20;
      }
    }
    
    // Check for XSS risks (innerHTML, dangerouslySetInnerHTML)
    const xssPatterns = [
      /innerHTML\s*=/,
      /dangerouslySetInnerHTML/
    ];
    
    for (const pattern of xssPatterns) {
      if (pattern.test(content)) {
        score -= 15;
      }
    }
    
    return Math.max(0, Math.min(100, score));
  }
  
  private scoreFilePerformance(result: ParseResult): number {
    let score = 100;
    
    // Check for N+1 query patterns
    const n1Patterns = result.calls.filter(c => 
      c.callee.includes('query') || c.callee.includes('find') || c.callee.includes('get')
    );
    if (n1Patterns.length > 5) {
      score -= Math.min(20, (n1Patterns.length - 5) * 2);
    }
    
    // Check for synchronous I/O in async contexts
    const syncInAsync = result.functions
      .filter(f => f.isAsync)
      .some(f => this.hasSyncIO(f));
    if (syncInAsync) {
      score -= 15;
    }
    
    // Check for missing caching patterns
    const hasCaching = result.calls.some(c => 
      c.callee.includes('cache') || c.callee.includes('memoize')
    );
    if (!hasCaching && result.functions.length > 10) {
      score -= 10;
    }
    
    return Math.max(0, Math.min(100, score));
  }
  
  private scoreMaintainability(
    results: ParseResult[], 
    fileScores: FileScore[], 
    graph: DependencyGraph
  ): DimensionScore {
    const factors: FactorScore[] = [];
    
    // Cyclomatic complexity factor
    const avgCC = results.reduce((sum, r) => sum + r.metrics.cyclomaticComplexity, 0) / results.length;
    factors.push({
      name: 'cyclomaticComplexity',
      score: Math.max(0, 100 - avgCC * 5),
      weight: this.dimensionWeights.maintainability.cyclomaticComplexity,
      description: `Average cyclomatic complexity: ${avgCC.toFixed(1)}`
    });
    
    // Cognitive complexity factor
    const avgCogC = results.reduce((sum, r) => sum + r.metrics.cognitiveComplexity, 0) / results.length;
    factors.push({
      name: 'cognitiveComplexity',
      score: Math.max(0, 100 - avgCogC * 3),
      weight: this.dimensionWeights.maintainability.cognitiveComplexity,
      description: `Average cognitive complexity: ${avgCogC.toFixed(1)}`
    });
    
    // Maintainability index factor
    const avgMI = results.reduce((sum, r) => sum + r.metrics.maintainabilityIndex, 0) / results.length;
    factors.push({
      name: 'maintainabilityIndex',
      score: avgMI,
      weight: this.dimensionWeights.maintainability.maintainabilityIndex,
      description: `Average maintainability index: ${avgMI.toFixed(1)}`
    });
    
    // Coupling factor (from dependency graph)
    const avgCoupling = graph.edges.length / Math.max(1, graph.nodes.length);
    factors.push({
      name: 'coupling',
      score: Math.max(0, 100 - avgCoupling * 10),
      weight: this.dimensionWeights.maintainability.coupling,
      description: `Average coupling: ${avgCoupling.toFixed(2)}`
    });
    
    // Cohesion factor (simplified)
    factors.push({
      name: 'cohesion',
      score: 75, // Would compute from class/method relationships
      weight: this.dimensionWeights.maintainability.cohesion,
      description: 'Class/method cohesion (placeholder)'
    });
    
    const score = this.computeWeightedScore(factors);
    
    return { score, weight: this.weights.maintainability, factors };
  }
  
  private scoreScalability(
    results: ParseResult[], 
    fileScores: FileScore[], 
    graph: DependencyGraph
  ): DimensionScore {
    const factors: FactorScore[] = [];
    
    // Module coupling
    const moduleCoupling = this.computeModuleCoupling(graph);
    factors.push({
      name: 'moduleCoupling',
      score: Math.max(0, 100 - moduleCoupling * 5),
      weight: this.dimensionWeights.scalability.moduleCoupling,
      description: `Module coupling index: ${moduleCoupling.toFixed(2)}`
    });
    
    // Dependency depth
    const maxDepth = this.computeMaxDependencyDepth(graph);
    factors.push({
      name: 'dependencyDepth',
      score: Math.max(0, 100 - maxDepth * 8),
      weight: this.dimensionWeights.scalability.dependencyDepth,
      description: `Max dependency depth: ${maxDepth}`
    });
    
    // Layer violations
    const layerViolations = graph.cycles.length;
    factors.push({
      name: 'layerViolations',
      score: Math.max(0, 100 - layerViolations * 10),
      weight: this.dimensionWeights.scalability.layerViolations,
      description: `Layer violations (cycles): ${layerViolations}`
    });
    
    // Async patterns
    const asyncRatio = results.filter(r => r.functions.some(f => f.isAsync)).length / results.length;
    factors.push({
      name: 'asyncPatterns',
      score: asyncRatio * 100,
      weight: this.dimensionWeights.scalability.asyncPatterns,
      description: `Async function ratio: ${(asyncRatio * 100).toFixed(1)}%`
    });
    
    // Caching
    const cachingScore = this.detectCachingPatterns(results);
    factors.push({
      name: 'caching',
      score: cachingScore,
      weight: this.dimensionWeights.scalability.caching,
      description: 'Caching pattern adoption'
    });
    
    const score = this.computeWeightedScore(factors);
    
    return { score, weight: this.weights.scalability, factors };
  }
  
  private scoreSecurity(
    results: ParseResult[], 
    fileScores: FileScore[], 
    graph: DependencyGraph
  ): DimensionScore {
    const factors: FactorScore[] = [];
    
    // Auth coverage
    const authCoverage = this.detectAuthCoverage(results);
    factors.push({
      name: 'authCoverage',
      score: authCoverage * 100,
      weight: this.dimensionWeights.security.authCoverage,
      description: `Auth coverage: ${(authCoverage * 100).toFixed(1)}%`
    });
    
    // Input validation
    const validationScore = this.detectInputValidation(results);
    factors.push({
      name: 'inputValidation',
      score: validationScore,
      weight: this.dimensionWeights.security.inputValidation,
      description: 'Input validation patterns'
    });
    
    // Secrets management
    const secretsScore = this.detectSecretsManagement(results);
    factors.push({
      name: 'secretsManagement',
      score: secretsScore,
      weight: this.dimensionWeights.security.secretsManagement,
      description: 'Secrets management practices'
    });
    
    // Crypto usage
    const cryptoScore = this.detectCryptoUsage(results);
    factors.push({
      name: 'cryptoUsage',
      score: cryptoScore,
      weight: this.dimensionWeights.security.cryptoUsage,
      description: 'Cryptographic best practices'
    });
    
    // Vulnerability surface
    const vulnScore = 100 - fileScores.reduce((sum, f) => sum + f.issues.filter(i => i.type === 'security').length * 5, 0);
    factors.push({
      name: 'vulnerabilitySurface',
      score: Math.max(0, vulnScore),
      weight: this.dimensionWeights.security.vulnerabilitySurface,
      description: 'Known vulnerability patterns'
    });
    
    const score = this.computeWeightedScore(factors);
    
    return { score, weight: this.weights.security, factors };
  }
  
  private scorePerformance(
    results: ParseResult[], 
    fileScores: FileScore[], 
    graph: DependencyGraph
  ): DimensionScore {
    const factors: FactorScore[] = [];
    
    // Hot paths
    const hotPathScore = this.detectHotPaths(results);
    factors.push({
      name: 'hotPaths',
      score: hotPathScore,
      weight: this.dimensionWeights.performance.hotPaths,
      description: 'Hot path optimization'
    });
    
    // Async/await usage
    const asyncScore = this.detectAsyncPatterns(results);
    factors.push({
      name: 'asyncAwait',
      score: asyncScore,
      weight: this.dimensionWeights.performance.asyncAwait,
      description: 'Async/await adoption'
    });
    
    // Memory patterns
    const memoryScore = this.detectMemoryPatterns(results);
    factors.push({
      name: 'memoryPatterns',
      score: memoryScore,
      weight: this.dimensionWeights.performance.memoryPatterns,
      description: 'Memory efficiency patterns'
    });
    
    // DB queries
    const dbScore = this.detectDBQueryPatterns(results);
    factors.push({
      name: 'dbQueries',
      score: dbScore,
      weight: this.dimensionWeights.performance.dbQueries,
      description: 'Database query optimization'
    });
    
    // Caching
    const cachingScore = this.detectCachingPatterns(results);
    factors.push({
      name: 'caching',
      score: cachingScore,
      weight: this.dimensionWeights.performance.caching,
      description: 'Caching strategies'
    });
    
    const score = this.computeWeightedScore(factors);
    
    return { score, weight: this.weights.performance, factors };
  }
  
  private computeOverall(dimensions: Record<string, DimensionScore>): number {
    return Math.round(
      Object.entries(dimensions).reduce(
        (sum, [dim, d]) => sum + d.score * this.weights[dim as keyof typeof this.weights], 0
      )
    );
  }
  
  private computeWeightedScore(factors: FactorScore[]): number {
    const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
    const weightedSum = factors.reduce((sum, f) => sum + f.score * f.weight, 0);
    return Math.round(weightedSum / totalWeight);
  }
  
  private buildDependencyGraph(results: ParseResult[]): DependencyGraph {
    const nodes: DependencyNode[] = [];
    const edges: DependencyEdge[] = [];
    const fileMap = new Map<string, ParseResult>();
    
    for (const result of results) {
      fileMap.set(result.file, result);
      nodes.push({
        id: result.file,
        name: result.file.split('/').pop() || result.file,
        type: 'file',
        language: result.language,
        metrics: result.metrics
      });
    }
    
    for (const result of results) {
      for (const imp of result.imports) {
        // Try to resolve import to a file in the project
        const targetFile = this.resolveImport(result.file, imp.source, results);
        if (targetFile) {
          edges.push({
            from: result.file,
            to: targetFile,
            type: 'import',
            weight: 1
          });
        }
      }
    }
    
    // Detect cycles using Tarjan's algorithm
    const cycles = this.detectCycles(nodes, edges);
    
    // Compute layers (topological sort with cycle handling)
    const layers = this.computeLayers(nodes, edges);
    
    return { nodes, edges, cycles, layers };
  }
  
  private detectCycles(nodes: DependencyNode[], edges: DependencyEdge[]): string[][] {
    const adj = new Map<string, string[]>();
    for (const node of nodes) adj.set(node.id, []);
    for (const edge of edges) {
      const targets = adj.get(edge.from) || [];
      targets.push(edge.to);
      adj.set(edge.from, targets);
    }
    
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const path: string[] = [];
    
    const dfs = (node: string) => {
      visited.add(node);
      recStack.add(node);
      path.push(node);
      
      for (const neighbor of adj.get(node) || []) {
        if (!visited.has(neighbor)) {
          dfs(neighbor);
        } else if (recStack.has(neighbor)) {
          // Found cycle
          const cycleStart = path.indexOf(neighbor);
          cycles.push(path.slice(cycleStart));
        }
      }
      
      recStack.delete(node);
      path.pop();
    };
    
    for (const node of nodes) {
      if (!visited.has(node.id)) {
        dfs(node.id);
      }
    }
    
    return cycles;
  }
  
  private computeLayers(nodes: DependencyNode[], edges: DependencyEdge[]): Map<string, number> {
    const layers = new Map<string, number>();
    const adj = new Map<string, string[]>();
    const inDegree = new Map<string, number>();
    
    for (const node of nodes) {
      adj.set(node.id, []);
      inDegree.set(node.id, 0);
    }
    
    for (const edge of edges) {
      const targets = adj.get(edge.from) || [];
      targets.push(edge.to);
      adj.set(edge.from, targets);
      inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
    }
    
    // Kahn's algorithm for topological sort
    const queue: string[] = [];
    for (const [node, degree] of inDegree) {
      if (degree === 0) queue.push(node);
    }
    
    let layer = 0;
    while (queue.length > 0) {
      const nextQueue: string[] = [];
      for (const node of queue) {
        layers.set(node, layer);
        for (const neighbor of adj.get(node) || []) {
          const newDegree = (inDegree.get(neighbor) || 0) - 1;
          inDegree.set(neighbor, newDegree);
          if (newDegree === 0) {
            nextQueue.push(neighbor);
          }
        }
      }
      queue.length = 0;
      queue.push(...nextQueue);
      layer++;
    }
    
    // Nodes in cycles get layer -1
    for (const node of nodes) {
      if (!layers.has(node.id)) {
        layers.set(node.id, -1);
      }
    }
    
    return layers;
  }
  
  private resolveImport(fromFile: string, importPath: string, results: ParseResult[]): string | null {
    // Simplified resolution - in production, use proper module resolution
    if (importPath.startsWith('.')) {
      const baseDir = fromFile.substring(0, fromFile.lastIndexOf('/'));
      const resolved = baseDir + '/' + importPath;
      for (const result of results) {
        if (result.file.startsWith(resolved) || 
            result.file === resolved + '.ts' ||
            result.file === resolved + '/index.ts') {
          return result.file;
        }
      }
    }
    return null;
  }
  
  private computeModuleCoupling(graph: DependencyGraph): number {
    if (graph.nodes.length === 0) return 0;
    return graph.edges.length / graph.nodes.length;
  }
  
  private computeMaxDependencyDepth(graph: DependencyGraph): number {
    let maxDepth = 0;
    for (const depth of graph.layers.values()) {
      if (depth > maxDepth) maxDepth = depth;
    }
    return maxDepth;
  }
  
  private detectCachingPatterns(results: ParseResult[]): number {
    let score = 0;
    for (const result of results) {
      const content = this.getFileContent(result);
      if (content.includes('cache') || content.includes('memoize') || 
          content.includes('Redis') || content.includes('Memcached')) {
        score += 20;
      }
    }
    return Math.min(100, score);
  }
  
  private detectAuthCoverage(results: ParseResult[]): number {
    // Placeholder - would check for auth middleware, guards, decorators
    return 0.7;
  }
  
  private detectInputValidation(results: ParseResult[]): number {
    let score = 0;
    for (const result of results) {
      const content = this.getFileContent(result);
      if (content.includes('validate') || content.includes('schema') || 
          content.includes('joi') || content.includes('zod') ||
          content.includes('class-validator')) {
        score += 25;
      }
    }
    return Math.min(100, score);
  }
  
  private detectSecretsManagement(results: ParseResult[]): number {
    let score = 100;
    for (const result of results) {
      const content = this.getFileContent(result);
      // Check for hardcoded secrets
      if (/api[_-]?key\s*[:=]\s*['"][^'"]+['"]/i.test(content)) score -= 30;
      if (/password\s*[:=]\s*['"][^'"]+['"]/i.test(content)) score -= 30;
      if (content.includes('process.env') || content.includes('config.get')) score += 10;
    }
    return Math.max(0, Math.min(100, score));
  }
  
  private detectCryptoUsage(results: ParseResult[]): number {
    let score = 50; // Base score
    for (const result of results) {
      const content = this.getFileContent(result);
      if (content.includes('crypto.createHash') || content.includes('bcrypt') ||
          content.includes('scrypt') || content.includes('argon2')) {
        score += 20;
      }
      if (content.includes('md5') || content.includes('sha1')) {
        score -= 20;
      }
    }
    return Math.max(0, Math.min(100, score));
  }
  
  private detectHotPaths(results: ParseResult[]): number {
    // Placeholder - would use profiling data
    return 70;
  }
  
  private detectAsyncPatterns(results: ParseResult[]): number {
    const total = results.reduce((sum, r) => sum + r.functions.length, 0);
    const async = results.reduce((sum, r) => sum + r.functions.filter(f => f.isAsync).length, 0);
    return total > 0 ? (async / total) * 100 : 0;
  }
  
  private detectMemoryPatterns(results: ParseResult[]): number {
    let score = 70; // Base
    for (const result of results) {
      const content = this.getFileContent(result);
      if (content.includes('WeakMap') || content.includes('WeakSet') ||
          content.includes('global.gc') || content.includes('stream')) {
        score += 10;
      }
    }
    return Math.min(100, score);
  }
  
  private detectDBQueryPatterns(results: ParseResult[]): number {
    let score = 70; // Base
    for (const result of results) {
      const content = this.getFileContent(result);
      if (content.includes('N+1') || content.includes('eager') || 
          content.includes('join') || content.includes('batch')) {
        score += 10;
      }
    }
    return Math.min(100, score);
  }
  
  private getFileContent(result: ParseResult): string {
    // In production, would read from file system or cache
    return '';
  }
  
  private hasSyncIO(func: any): boolean {
    // Check for synchronous I/O operations
    return false; // Placeholder
  }
  
  private computeMaxCallDepth(result: ParseResult): number {
    // Build call graph and find max depth
    return 5; // Placeholder
  }
  
  private computeTrends(projectId: string, dimensions: Record<string, DimensionScore>): ScoreTrend[] {
    // In production, would fetch historical data
    const trends: ScoreTrend[] = [];
    for (const dim of Object.keys(dimensions)) {
      const dimScore = dimensions[dim];
      if (dimScore) {
        trends.push({
          dimension: dim,
          values: [dimScore.score],
          timestamps: [new Date()],
          trend: 'stable' as const,
          forecast: dimScore.score
        });
      }
    }
    return trends;
  }
  
  private generateRecommendations(
    dimensions: Record<string, DimensionScore>, 
    fileScores: FileScore[],
    results: ParseResult[]
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];
    
    // Find worst dimension
    const sortedDims = Object.entries(dimensions).sort((a, b) => a[1].score - b[1].score);
    const worstDim = sortedDims[0];
    if (worstDim && worstDim[1].score < 70) {
      const dimName = worstDim[0];
      const dimScore = worstDim[1];
      recommendations.push({
        priority: 'high',
        category: dimName,
        title: `Improve ${dimName} (score: ${dimScore.score})`,
        description: `The ${dimName} dimension is below threshold. Focus on ${dimScore.factors.filter(f => f.score < 60).map(f => f.name).join(', ')}.`,
        affectedFiles: fileScores.filter(f => (f.dimensionScores[dimName] ?? 100) < 60).map(f => f.file),
        estimatedEffort: '1-2 weeks',
        impact: 'High'
      });
    }
    
    // Critical issues
    const criticalIssues = fileScores.flatMap(f => f.issues.filter(i => i.severity === 'critical'));
    if (criticalIssues.length > 0) {
      recommendations.push({
        priority: 'critical',
        category: 'issues',
        title: `Fix ${criticalIssues.length} critical issues`,
        description: criticalIssues.map(i => `${i.message} in ${i.location.file}:${i.location.line}`).join('; '),
        affectedFiles: [...new Set(criticalIssues.map(i => i.location.file))],
        estimatedEffort: 'Immediate',
        impact: 'Critical'
      });
    }
    
    return recommendations;
  }
  
  private detectFileIssues(result: ParseResult, dimensionScores: Record<string, number>): Issue[] {
    const issues: Issue[] = [];
    
    // Complexity issues
    if (result.metrics.cyclomaticComplexity > 20) {
      issues.push({
        type: 'complexity',
        severity: 'high',
        message: `High cyclomatic complexity: ${result.metrics.cyclomaticComplexity}`,
        location: { file: result.file, line: 1, column: 1 },
        suggestion: 'Refactor into smaller functions',
        ruleId: 'CC001'
      });
    }
    
    // God class detection
    for (const cls of result.classes) {
      if (cls.methods.length > 20) {
        issues.push({
          type: 'anti_pattern',
          severity: 'high',
          message: `God class detected: ${cls.name} has ${cls.methods.length} methods`,
          location: { file: result.file, line: cls.line, column: 1 },
          suggestion: 'Extract responsibilities into separate classes',
          ruleId: 'AP001'
        });
      }
    }
    
    // Security issues
    const content = this.getFileContent(result);
    if (/api[_-]?key\s*[:=]\s*['"][^'"]+['"]/i.test(content)) {
      issues.push({
        type: 'security',
        severity: 'critical',
        message: 'Hardcoded API key detected',
        location: { file: result.file, line: 1, column: 1 },
        suggestion: 'Move to environment variables or secret manager',
        ruleId: 'SEC001'
      });
    }
    
    return issues;
  }
}