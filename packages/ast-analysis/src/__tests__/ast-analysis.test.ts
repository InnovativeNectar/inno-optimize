import { describe, it, expect, beforeEach } from 'vitest';
import { 
  MultiLanguageParser, 
  ArchitectureScorer, 
  AntiPatternDetector,
  IncrementalAnalyzer,
  ParseResult,
  IncrementalChange 
} from '../src';

describe('AST Analysis', () => {
  let parser: MultiLanguageParser;
  let scorer: ArchitectureScorer;
  let detector: AntiPatternDetector;
  let analyzer: IncrementalAnalyzer;

  beforeEach(() => {
    parser = new MultiLanguageParser();
    scorer = new ArchitectureScorer();
    detector = new AntiPatternDetector();
    analyzer = new IncrementalAnalyzer();
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
          { name: 'GodClass', methods: Array(25).fill({}), properties: Array(20).fill({}) }
        ])
      ];

      const score = scorer.scoreProject(mockResults, 'test-project');
      expect(score.overall).toBeLessThan(70);
    });
  });

  describe('AntiPatternDetector', () => {
    it('should detect god class', () => {
      const result = createMockResult('test.ts', 'typescript', 100, 5, 70, [
        { name: 'BigClass', methods: Array(25).fill({}), properties: [] }
      ]);

      const issues = detector.detect(result);
      const godClassIssues = issues.filter(i => i.ruleId === 'AP-GOD_CLASS');
      
      expect(godClassIssues.length).toBeGreaterThan(0);
      expect(godClassIssues[0].severity).toBe('high');
    });

    it('should detect long parameter list', () => {
      const result = createMockResult('test.ts', 'typescript', 50, 5, 80, [], [
        { name: 'func', params: Array(7).fill({ name: 'p', type: 'string', optional: false }) }
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
      
      const change = analyzer['computeDiff']?.(oldContent, newContent) || 
        require('../src/incremental').computeDiff(oldContent, newContent);
      
      expect(change.type).toBe('modified');
      expect(change.affectedLines.start).toBeGreaterThan(0);
    });

    it('should detect added file', () => {
      const change = require('../src/incremental').computeDiff('', 'new content');
      expect(change.type).toBe('added');
    });

    it('should detect deleted file', () => {
      const change = require('../src/incremental').computeDiff('old content', '');
      expect(change.type).toBe('deleted');
    });
  });
});

function createMockResult(
  file: string, 
  language: string, 
  loc: number, 
  complexity: number, 
  mi: number,
  classes: any[] = [],
  functions: any[] = []
): ParseResult {
  return {
    file,
    language,
    ast: null,
    imports: [],
    exports: [],
    classes: classes.map(c => ({
      name: c.name,
      extends: undefined,
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
      returnType: undefined,
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