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
      expect(result.functions).toHaveLength(1);
      expect(result.classes).toHaveLength(1);
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