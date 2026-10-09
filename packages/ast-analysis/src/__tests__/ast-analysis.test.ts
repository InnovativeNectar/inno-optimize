import { describe, it, expect, beforeEach } from 'vitest';
import type Parser from 'tree-sitter';
import type {
  ParseResult,
  ClassInfo,
  FunctionInfo,
  MethodInfo,
  ParameterInfo,
  PropertyInfo
} from '../index.js';
import { 
  MultiLanguageParser, 
  ArchitectureScorer, 
  AntiPatternDetector,
  computeDiff 
} from '../index.js';

describe('AST Analysis', () => {
  let parser: MultiLanguageParser;
  let scorer: ArchitectureScorer;
  let detector: AntiPatternDetector;

  beforeEach(() => {
    parser = new MultiLanguageParser();
    scorer = new ArchitectureScorer();
    detector = new AntiPatternDetector();
  });

  describe('MultiLanguageParser', () => {
    it('should detect TypeScript language', () => {
      expect(parser.detectLanguage('test.ts')).toBe('typescript');
      expect(parser.detectLanguage('test.tsx')).toBe('typescript');
      expect(parser.detectLanguage('test.js')).toBe('typescript');
    });

    it('should detect Python language', () => {
      expect(parser.detectLanguage('test.py')).toBe('python');
    });

    it('should detect Go language', () => {
      expect(parser.detectLanguage('test.go')).toBe('go');
    });

    it('should return null for unsupported language', () => {
      expect(parser.detectLanguage('test.xyz')).toBeNull();
    });

    it('should list supported languages', () => {
      const langs = parser.getSupportedLanguages();
      expect(langs).toContain('typescript');
      expect(langs).toContain('python');
      expect(langs).toContain('go');
      expect(langs).toContain('java');
      expect(langs).toContain('rust');
      expect(langs).toContain('ruby');
      expect(langs).toContain('php');
    });

    it('should parse a TypeScript file with imports, exports, functions and classes', async () => {
      const content = [
        "import fs from 'fs';",
        'export function add(a: number, b: number): number { return a + b; }',
        "export class Greeter { greet(n: string): string { return 'hi ' + n; } }",
        'interface Shape { area(): number; }',
        'type Num = number;',
        '',
      ].join('\n');

      const result = await parser.parseFile('src/example.ts', content);

      expect(result.language).toBe('typescript');
      expect(result.errors).toHaveLength(0);
      expect(result.imports).toHaveLength(1);
      expect(result.imports[0]?.source).toBe('fs');
      expect(result.exports.length).toBeGreaterThanOrEqual(2);
      expect(result.functions).toHaveLength(2);
      expect(result.functions.map(f => f.name).sort()).toEqual(['add', 'greet']);
      expect(result.classes).toHaveLength(1);
      expect(result.classes[0]!.methods.map(m => m.name)).toContain('greet');
      expect(result.classes[0]!.methods[0]!.params.map(p => p.name)).toEqual(['n']);
      expect(result.interfaces).toHaveLength(1);
      expect(result.types).toHaveLength(1);
      expect(result.metrics.linesOfCode).toBeGreaterThan(0);
      expect(result.metrics.linesOfComments + result.metrics.blankLines).toBeGreaterThanOrEqual(0);
    });

    it('should parse files in every supported language without errors', async () => {
      const samples: Record<string, string> = {
        'a.ts': "import fs from 'fs';\nexport function add() {}\n",
        'b.py': 'import os\ndef hello():\n    pass\n',
        'c.go': 'package main\nimport "fmt"\nfunc Run() {}\n',
        'd.java': 'import java.util.List;\nclass Main { void run() {} }\n',
        'e.rs': 'use std::io;\nfn main() {}\n',
        'f.rb': "require 'json'\ndef bar\nend\n",
        'g.php': "<?php\nuse Foo\\Bar;\nfunction hi() { return 1; }\n",
      };

      for (const [file, content] of Object.entries(samples)) {
        const result = await parser.parseFile(file, content);
        expect(result.errors, `parse errors in ${file}`).toHaveLength(0);
        expect(result.functions.length, `no functions found in ${file}`).toBeGreaterThanOrEqual(1);
        expect(result.imports.length, `no imports found in ${file}`).toBeGreaterThanOrEqual(1);
      }
    });

    it('should throw for unsupported file extensions', async () => {
      await expect(parser.parseFile('file.xyz', 'some content')).rejects.toThrow(
        'Unsupported language for file: file.xyz'
      );
    });

    it('should parse TSX files with the tsx dialect and no parse errors', async () => {
      const content = [
        "import React from 'react';",
        'export const Card: React.FC<{title: string}> = ({ title }) => {',
        '  if (title) { return <div className="c">{title}</div>; }',
        '  return <span />;',
        '};',
        'export function App() { return <Card title="x" />; }',
        '',
      ].join('\n');

      const result = await parser.parseFile('src/Card.tsx', content);

      expect(result.errors).toHaveLength(0);
      const names = result.functions.map(f => f.name);
      expect(names).toContain('Card');
      expect(names).toContain('App');
    });

    it('should extract arrow function names and parameter details', async () => {
      const content = [
        'const calc = (a: number, b = 2, ...rest: number[]): number => {',
        '  return a + b + rest.length;',
        '};',
        'export function uses(): number { return calc(1); }',
        '',
      ].join('\n');

      const result = await parser.parseFile('src/arrow.ts', content);

      expect(result.errors).toHaveLength(0);
      const calc = result.functions.find(f => f.name === 'calc');
      expect(calc).toBeDefined();
      expect(calc!.params.map(p => p.name)).toEqual(['a', 'b', 'rest']);
      expect(calc!.params[1]!.optional).toBe(true);
      expect(calc!.params[1]!.defaultValue).toBe('2');
      expect(calc!.returnType).toBe('number');
    });

    it('should compute real complexity metrics', async () => {
      const content = [
        'function branchy(a: number, b: number): number {',
        '  if (a && b) {',
        '    for (let i = 0; i < 10; i++) {',
        '      if (i > a || i < b) { return i; }',
        '    }',
        '  } else if (a) {',
        '    while (b > 0) { b--; }',
        '  }',
        '  try { throw new Error(); } catch (e) { return -1; }',
        '  return a ? a : b;',
        '}',
        '',
      ].join('\n');

      const result = await parser.parseFile('src/branchy.ts', content);
      const m = result.metrics;

      expect(m.cyclomaticComplexity).toBeGreaterThanOrEqual(6);
      expect(m.cognitiveComplexity).toBeGreaterThanOrEqual(m.cyclomaticComplexity);
      expect(m.nestingDepth).toBeGreaterThanOrEqual(3);
      expect(m.halsteadVolume).toBeGreaterThan(0);
      expect(m.maintainabilityIndex).toBeGreaterThanOrEqual(0);
      expect(m.maintainabilityIndex).toBeLessThanOrEqual(100);

      const branchFunc = result.functions.find(f => f.name === 'branchy');
      expect(branchFunc).toBeDefined();
      expect(branchFunc!.complexity).toBeGreaterThanOrEqual(6);
    });

    it('should parse Python with real metrics, hash comments and lambdas', async () => {
      const content = [
        '# leading comment',
        'import os',
        '',
        'class Worker:',
        '    def run(self, data, retries=3, *args, **kwargs):',
        '        if data and retries:',
        '            for x in data:',
        '                if x > 1:',
        '                    return x',
        '        return None',
        '',
        'handler = lambda rows: sum(rows)',
        '',
      ].join('\n');

      const result = await parser.parseFile('src/worker.py', content);

      expect(result.errors).toHaveLength(0);
      expect(result.metrics.linesOfComments).toBe(1);
      expect(result.functions.map(f => f.name)).toContain('handler');
      const cls = result.classes.find(c => c.name === 'Worker');
      expect(cls).toBeDefined();
      const run = cls!.methods.find(m => m.name === 'run');
      expect(run).toBeDefined();
      expect(run!.params.map(p => p.name)).toEqual(['self', 'data', 'retries', 'args', 'kwargs']);
      expect(run!.params[2]!.optional).toBe(true);
      expect(run!.params[2]!.defaultValue).toBe('3');
      expect(result.metrics.cyclomaticComplexity).toBeGreaterThanOrEqual(4);
      expect(result.metrics.maintainabilityIndex).toBeGreaterThan(0);
      expect(result.metrics.halsteadVolume).toBeGreaterThan(0);
    });

    it('should detect dead private methods on real parses', async () => {
      const content = [
        'export class Service {',
        '  private _legacy(): void { return; }',
        '  run(): void { console.log("x"); }',
        '}',
        '',
      ].join('\n');

      const result = await parser.parseFile('src/service.ts', content);
      const issues = detector.detect(result);
      const dead = issues.filter(i => i.ruleId === 'AP-DEAD_CODE');

      expect(dead.length).toBeGreaterThan(0);
    });

    it('should detect feature envy on real parses', async () => {
      const content = [
        'export class Controller {',
        '  handle(repo: Repo, logger: Logger): void {',
        '    repo.find();',
        '    repo.filter();',
        '    repo.persist();',
        '    logger.info("ok");',
        '    repo.count();',
        '  }',
        '}',
        '',
      ].join('\n');

      const result = await parser.parseFile('src/controller.ts', content);
      const issues = detector.detect(result);
      const envy = issues.filter(i => i.ruleId === 'AP-FEATURE_ENVY');

      expect(envy.length).toBeGreaterThan(0);
    });

    it('should run the anti-pattern detector on parsed output', async () => {
      const content = [
        'function process() {',
        '  var unused = 1;',
        '  var unused2 = 2;',
        '  console.log(unused);',
        '}',
        '',
      ].join('\n');

      const result = await parser.parseFile('src/process.ts', content);
      const issues = detector.detect(result);

      expect(Array.isArray(issues)).toBe(true);
      for (const issue of issues) {
        expect(issue.type).toBeTruthy();
        expect(['low', 'medium', 'high', 'critical']).toContain(issue.severity);
        expect(issue.location.file).toBe('src/process.ts');
      }
    });
  });

  describe('ArchitectureScorer', () => {
    it('should score a simple project', () => {
      const mockResults: ParseResult[] = [
        createMockResult('src/main.ts', 'typescript', 50, 5, 80),
        createMockResult('src/utils.ts', 'typescript', 30, 3, 85),
        createMockResult('src/api.ts', 'typescript', 100, 20, 60)
      ];

      const score = scorer.scoreProject(mockResults, 'test-project');
      
      expect(score.projectId).toBe('test-project');
      expect(score.overall).toBeGreaterThan(0);
      expect(score.overall).toBeLessThanOrEqual(100);
      expect(score.dimensions.maintainability).toBeDefined();
      expect(score.dimensions.scalability).toBeDefined();
      expect(score.dimensions.security).toBeDefined();
      expect(score.dimensions.performance).toBeDefined();
    });

    it('should detect god class', () => {
      const mockResults: ParseResult[] = [
        createMockResult('src/GodClass.ts', 'typescript', 200, 10, 50, [
          { name: 'GodClass', methods: Array.from({ length: 25 }, createMockMethod), properties: Array.from({ length: 20 }, createMockProperty) }
        ])
      ];

      const score = scorer.scoreProject(mockResults, 'test-project');
      expect(score.overall).toBeLessThan(70);
    });
  });

  describe('AntiPatternDetector', () => {
    it('should detect god class', () => {
      const result = createMockResult('test.ts', 'typescript', 100, 5, 70, [
        { name: 'BigClass', methods: Array.from({ length: 25 }, createMockMethod), properties: [] }
      ]);

      const issues = detector.detect(result);
      const godClassIssues = issues.filter(i => i.ruleId === 'AP-GOD_CLASS');
      
      expect(godClassIssues.length).toBeGreaterThan(0);
      expect(godClassIssues[0]!.severity).toBe('high');
    });

    it('should detect long parameter list', () => {
      const result = createMockResult('test.ts', 'typescript', 50, 5, 80, [], [
        { name: 'func', params: Array.from({ length: 7 }, createMockParameter) }
      ]);

      const issues = detector.detect(result);
      const paramIssues = issues.filter(i => i.ruleId === 'AP-LONG_PARAMETER_LIST');
      
      expect(paramIssues.length).toBeGreaterThan(0);
    });

    it('should return all registered patterns', () => {
      const patterns = detector.getPatterns();
      expect(patterns.length).toBe(15);
      
      const types = patterns.map(p => p.type);
      expect(types).toContain('god_class');
      expect(types).toContain('circular_dependency');
      expect(types).toContain('layer_violation');
    });
  });

  describe('IncrementalAnalyzer', () => {
    it('should compute diff between versions', () => {
      const oldContent = 'line1\nline2\nline3\nline4';
      const newContent = 'line1\nline2\nmodified\nline4';
      
      const change = computeDiff(oldContent, newContent);
      
      expect(change.type).toBe('modified');
      expect(change.affectedLines.start).toBeGreaterThan(0);
    });

    it('should detect added file', () => {
      const change = computeDiff('', 'new content');
      expect(change.type).toBe('added');
    });

    it('should detect deleted file', () => {
      const change = computeDiff('old content', '');
      expect(change.type).toBe('deleted');
    });
  });
});

function createMockMethod(): MethodInfo {
  return { name: 'method', params: [], isAsync: false, isStatic: false, isPrivate: false, line: 1, endLine: 2, complexity: 0 };
}

function createMockProperty(): PropertyInfo {
  return { name: 'property', isStatic: false, isPrivate: false, isReadonly: false, line: 1 };
}

function createMockParameter(): ParameterInfo {
  return { name: 'p', type: 'string', optional: false };
}

function createMockResult(
  file: string, 
  language: string, 
  loc: number, 
  complexity: number, 
  mi: number,
  classes: Array<Pick<ClassInfo, 'name' | 'methods' | 'properties'>> = [],
  functions: Array<Pick<FunctionInfo, 'name' | 'params'>> = []
): ParseResult {
  return {
    file,
    language,
    ast: null as unknown as Parser.Tree,
    imports: [],
    exports: [],
    classes: classes.map(c => ({
      name: c.name,
      implements: [],
      methods: c.methods || [],
      properties: c.properties || [],
      line: 1,
      endLine: 100,
      complexity: 5
    })),
    functions: functions.map(f => ({
      name: f.name,
      params: f.params || [],
      isAsync: false,
      isGenerator: false,
      line: 1,
      endLine: 20,
      complexity
    })),
    interfaces: [],
    types: [],
    calls: [],
    metrics: {
      linesOfCode: loc,
      linesOfComments: 10,
      blankLines: 5,
      cyclomaticComplexity: complexity,
      cognitiveComplexity: complexity * 1.2,
      nestingDepth: 2,
      halsteadVolume: 1000,
      maintainabilityIndex: mi
    },
    errors: []
  };
}