import { ParseResult, IncrementalChange, DeltaAnalysis, Issue, AntiPattern } from './types.js';
import { MultiLanguageParser } from './parser.js';
import { ArchitectureScorer } from './scorer.js';
import { AntiPatternDetector } from './patterns.js';

export class IncrementalAnalyzer {
  private parser: MultiLanguageParser;
  private scorer: ArchitectureScorer;
  private detector: AntiPatternDetector;
  private previousResults = new Map<string, ParseResult>();
  private previousScore = 0;
  
  constructor() {
    this.parser = new MultiLanguageParser();
    this.scorer = new ArchitectureScorer();
    this.detector = new AntiPatternDetector();
  }
  
  async analyzeChanges(changes: IncrementalChange[]): Promise<DeltaAnalysis> {
    const changedFiles: ParseResult[] = [];
    const affectedFiles: ParseResult[] = [];
    
    // 1. Re-parse changed files
    for (const change of changes) {
      if (change.type === 'deleted') {
        this.previousResults.delete(change.file);
        continue;
      }
      
      const result = await this.parser.parseFile(change.file, change.newContent);
      changedFiles.push(result);
      this.previousResults.set(change.file, result);
    }
    
    // 2. Find affected files (dependents)
    const allResults = Array.from(this.previousResults.values());
    const dependencyGraph = this.buildDependencyGraph(allResults);
    
    for (const change of changes) {
      if (change.type !== 'deleted') {
        const dependents = this.findDependents(change.file, dependencyGraph);
        for (const dep of dependents) {
          const cached = this.previousResults.get(dep);
          if (cached) {
            // Re-parse to get fresh analysis
            // In production, would read from file system
            affectedFiles.push(cached);
          }
        }
      }
    }
    
    // 3. Compute score delta
    const newScore = this.scorer.scoreProject(allResults, 'project').overall;
    const scoreDelta = newScore - this.previousScore;
    this.previousScore = newScore;
    
    // 4. Detect new/resolved issues
    const newIssues = this.findNewIssues(changedFiles, affectedFiles);
    const resolvedIssues = this.findResolvedIssues(changedFiles);
    
    // 5. Detect new patterns
    const newPatterns = this.findNewPatterns(changedFiles);
    
    return {
      changedFiles,
      affectedFiles,
      scoreDelta,
      newIssues,
      resolvedIssues,
      newPatterns
    };
  }
  
  async fullAnalysis(files: Map<string, string>): Promise<{
    results: ParseResult[];
    score: number;
    issues: Issue[];
    patterns: AntiPattern[];
  }> {
    const results = await this.parser.parseFiles(files);
    
    // Update cache
    for (const result of results) {
      this.previousResults.set(result.file, result);
    }
    
    const scoreResult = this.scorer.scoreProject(results, 'project');
    this.previousScore = scoreResult.overall;
    
    const allIssues = this.detector.detectAll(results);
    const flatIssues = Array.from(allIssues.values()).flat();
    
    const allPatterns = this.detector.getPatterns();
    
    return {
      results,
      score: scoreResult.overall,
      issues: flatIssues,
      patterns: allPatterns
    };
  }
  
  getPreviousResults(): ParseResult[] {
    return Array.from(this.previousResults.values());
  }
  
  getPreviousScore(): number {
    return this.previousScore;
  }
  
  clearCache(): void {
    this.previousResults.clear();
    this.previousScore = 0;
  }
  
  private buildDependencyGraph(results: ParseResult[]): Map<string, string[]> {
    const graph = new Map<string, string[]>();
    
    for (const result of results) {
      graph.set(result.file, []);
    }
    
    for (const result of results) {
      for (const imp of result.imports) {
        const target = this.resolveImport(result.file, imp.source, results);
        if (target) {
          const deps = graph.get(target) || [];
          deps.push(result.file);
          graph.set(target, deps);
        }
      }
    }
    
    return graph;
  }
  
  private findDependents(file: string, graph: Map<string, string[]>): string[] {
    const dependents: string[] = [];
    const visited = new Set<string>();
    
    const dfs = (node: string) => {
      if (visited.has(node)) return;
      visited.add(node);
      
      const deps = graph.get(node) || [];
      for (const dep of deps) {
        dependents.push(dep);
        dfs(dep);
      }
    };
    
    dfs(file);
    return dependents;
  }
  
  private resolveImport(fromFile: string, importPath: string, results: ParseResult[]): string | null {
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
  
  private findNewIssues(changed: ParseResult[], affected: ParseResult[]): Issue[] {
    const newIssues: Issue[] = [];
    
    for (const result of [...changed, ...affected]) {
      const issues = this.detector.detect(result);
      newIssues.push(...issues);
    }
    
    return newIssues;
  }
  
  private findResolvedIssues(changed: ParseResult[]): Issue[] {
    // In production, would compare with previous issues
    return [];
  }
  
  private findNewPatterns(changed: ParseResult[]): AntiPattern[] {
    const patterns: AntiPattern[] = [];
    
    for (const result of changed) {
      const issues = this.detector.detect(result);
      for (const issue of issues) {
        if (issue.type === 'anti_pattern') {
          const pattern = this.detector.getPatterns().find(p => 
            issue.ruleId === `AP-${p.type.toUpperCase()}`
          );
          if (pattern) patterns.push(pattern);
        }
      }
    }
    
    return patterns;
  }
}

// File watcher for real-time incremental analysis
export class FileWatcher {
  private analyzer: IncrementalAnalyzer;
  private watchers = new Map<string, any>();
  private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  
  constructor(analyzer: IncrementalAnalyzer) {
    this.analyzer = analyzer;
  }
  
  watch(directory: string, callback: (analysis: DeltaAnalysis) => void): void {
    // In production, use chokidar or fs.watch
    // eslint-disable-next-line no-console
    console.log(`Watching ${directory} for changes...`);
  }
  
  unwatch(directory: string): void {
    const watcher = this.watchers.get(directory);
    if (watcher) {
      watcher.close();
      this.watchers.delete(directory);
    }
  }
  
  private debounce(file: string, callback: () => void, ms: number = 300): void {
    const existing = this.debounceTimers.get(file);
    if (existing) clearTimeout(existing);
    
    const timer = setTimeout(() => {
      this.debounceTimers.delete(file);
      callback();
    }, ms);
    
    this.debounceTimers.set(file, timer);
  }
}

// Utility for computing file diffs
export function computeDiff(oldContent: string, newContent: string): IncrementalChange {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');
  
  // Simple line-based diff
  let start = 0;
  while (start < oldLines.length && start < newLines.length && oldLines[start] === newLines[start]) {
    start++;
  }
  
  let endOld = oldLines.length - 1;
  let endNew = newLines.length - 1;
  while (endOld >= start && endNew >= start && oldLines[endOld] === newLines[endNew]) {
    endOld--;
    endNew--;
  }
  
  return {
    file: '', // Set by caller
    type: oldLines.length === 0 ? 'added' : newLines.length === 0 ? 'deleted' : 'modified',
    oldContent: oldLines.slice(start, endOld + 1).join('\n'),
    newContent: newLines.slice(start, endNew + 1).join('\n'),
    affectedLines: { start: start + 1, end: endOld + 1 }
  };
}