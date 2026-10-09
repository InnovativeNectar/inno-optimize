import Parser from 'tree-sitter';
import TypeScript from 'tree-sitter-typescript';
import Python from 'tree-sitter-python';
import Go from 'tree-sitter-go';
import Java from 'tree-sitter-java';
import Rust from 'tree-sitter-rust';
import Ruby from 'tree-sitter-ruby';
import PHP from 'tree-sitter-php';

import type { 
  LanguageConfig, 
  ParseResult, 
  ImportInfo, 
  ExportInfo, 
  ClassInfo, 
  FunctionInfo, 
  InterfaceInfo, 
  TypeInfo, 
  CallInfo, 
  FileMetrics, 
  ParseError,
  MethodInfo,
  PropertyInfo,
  ParameterInfo
} from './types.js';

export class MultiLanguageParser {
  private parsers = new Map<string, Parser>();
  private languageConfigs = new Map<string, LanguageConfig>();
  
  constructor() {
    this.initializeParsers();
  }
  
  private initializeParsers(): void {
    // TypeScript/JavaScript
    const tsParser = new Parser();
    tsParser.setLanguage(TypeScript.typescript);
    this.parsers.set('typescript', tsParser);
    this.parsers.set('javascript', tsParser);
    this.parsers.set('tsx', tsParser);
    this.parsers.set('jsx', tsParser);
    
    this.languageConfigs.set('typescript', {
      name: 'TypeScript',
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
      parser: tsParser,
      language: TypeScript.typescript,
      queries: this.getTSQueries()
    });
    
    // Python
    const pyParser = new Parser();
    pyParser.setLanguage(Python);
    this.parsers.set('python', pyParser);
    this.languageConfigs.set('python', {
      name: 'Python',
      extensions: ['.py'],
      parser: pyParser,
      language: Python,
      queries: this.getPythonQueries()
    });
    
    // Go
    const goParser = new Parser();
    goParser.setLanguage(Go);
    this.parsers.set('go', goParser);
    this.languageConfigs.set('go', {
      name: 'Go',
      extensions: ['.go'],
      parser: goParser,
      language: Go,
      queries: this.getGoQueries()
    });
    
    // Java
    const javaParser = new Parser();
    javaParser.setLanguage(Java);
    this.parsers.set('java', javaParser);
    this.languageConfigs.set('java', {
      name: 'Java',
      extensions: ['.java'],
      parser: javaParser,
      language: Java,
      queries: this.getJavaQueries()
    });
    
    // Rust
    const rustParser = new Parser();
    rustParser.setLanguage(Rust);
    this.parsers.set('rust', rustParser);
    this.languageConfigs.set('rust', {
      name: 'Rust',
      extensions: ['.rs'],
      parser: rustParser,
      language: Rust,
      queries: this.getRustQueries()
    });
    
    // Ruby
    const rubyParser = new Parser();
    rubyParser.setLanguage(Ruby);
    this.parsers.set('ruby', rubyParser);
    this.languageConfigs.set('ruby', {
      name: 'Ruby',
      extensions: ['.rb'],
      parser: rubyParser,
      language: Ruby,
      queries: this.getRubyQueries()
    });
    
    // PHP
    const phpParser = new Parser();
    phpParser.setLanguage(PHP.php);
    this.parsers.set('php', phpParser);
    this.languageConfigs.set('php', {
      name: 'PHP',
      extensions: ['.php'],
      parser: phpParser,
      language: PHP.php,
      queries: this.getPHPQueries()
    });
  }
  
  getSupportedLanguages(): string[] {
    return Array.from(this.parsers.keys());
  }
  
  detectLanguage(filePath: string): string | null {
    const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
    for (const [lang, config] of this.languageConfigs) {
      if (config.extensions.includes(ext)) {
        return lang;
      }
    }
    return null;
  }
  
  async parseFile(filePath: string, content: string): Promise<ParseResult> {
    const language = this.detectLanguage(filePath);
    if (!language) {
      throw new Error(`Unsupported language for file: ${filePath}`);
    }
    
    const config = this.languageConfigs.get(language)!;
    const parser = this.parsers.get(language)!;
    
    const tree = parser.parse(content);
    const errors = this.extractErrors(tree, content);
    
    return {
      file: filePath,
      language,
      ast: tree,
      imports: this.extractImports(tree, content, config),
      exports: this.extractExports(tree, content, config),
      classes: this.extractClasses(tree, content, config),
      functions: this.extractFunctions(tree, content, config),
      interfaces: this.extractInterfaces(tree, content, config),
      types: this.extractTypes(tree, content, config),
      calls: this.extractCalls(tree, content, config),
      metrics: this.computeMetrics(tree, content, config),
      errors
    };
  }
  
  async parseFiles(files: Map<string, string>): Promise<ParseResult[]> {
    const results: ParseResult[] = [];
    for (const [file, content] of files) {
      try {
        const result = await this.parseFile(file, content);
        results.push(result);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(`Failed to parse ${file}:`, e);
      }
    }
    return results;
  }
  
  private extractImports(tree: Parser.Tree, content: string, config: LanguageConfig): ImportInfo[] {
    const imports: ImportInfo[] = [];
    const query = new Parser.Query(config.language, config.queries.imports);
    const captures = query.captures(tree.rootNode);
    
    for (const capture of captures) {
      const node = capture.node;
      const text = node.text;
      
      // Simplified extraction - in production, parse each language specifically
      imports.push({
        source: this.extractImportSource(node, content),
        specifiers: this.extractImportSpecifiers(node, content),
        isDefault: text.includes('default'),
        isNamespace: text.includes('* as'),
        line: node.startPosition.row + 1
      });
    }
    
    return imports;
  }
  
  private extractExports(tree: Parser.Tree, content: string, config: LanguageConfig): ExportInfo[] {
    const exports: ExportInfo[] = [];
    const query = new Parser.Query(config.language, config.queries.exports);
    const captures = query.captures(tree.rootNode);
    
    for (const capture of captures) {
      const node = capture.node;
      exports.push({
        name: this.extractExportName(node, content),
        type: this.inferExportType(node),
        line: node.startPosition.row + 1,
        isDefault: node.text.includes('default')
      });
    }
    
    return exports;
  }
  
  private extractClasses(tree: Parser.Tree, content: string, config: LanguageConfig): ClassInfo[] {
    const classes: ClassInfo[] = [];
    const query = new Parser.Query(config.language, config.queries.classes);
    const captures = query.captures(tree.rootNode);
    
    for (const capture of captures) {
      const node = capture.node;
      const className = this.extractClassName(node, content);
      const classExtends = this.extractExtends(node, content);
      const classImplements = this.extractImplements(node, content);
      const classMethods = this.extractMethods(node, content, config);
      const classProperties = this.extractProperties(node, content, config);
      const classLine = node.startPosition.row + 1;
      const classEndLine = node.endPosition.row + 1;
      const classComplexity = this.computeClassComplexity(node, config);
      
      const classInfo: ClassInfo = {
        name: className,
        implements: classImplements,
        methods: classMethods,
        properties: classProperties,
        line: classLine,
        endLine: classEndLine,
        complexity: classComplexity
      };
      
      if (classExtends !== undefined) {
        classInfo.extends = classExtends;
      }
      
      classes.push(classInfo);
    }
    
    return classes;
  }
  
  private extractFunctions(tree: Parser.Tree, content: string, config: LanguageConfig): FunctionInfo[] {
    const functions: FunctionInfo[] = [];
    const query = new Parser.Query(config.language, config.queries.functions);
    const captures = query.captures(tree.rootNode);
    
    for (const capture of captures) {
      const node = capture.node;
      const funcName = this.extractFunctionName(node, content);
      const funcParams = this.extractParameters(node, content, config);
      const funcReturnType = this.extractReturnType(node, content);
      const funcIsAsync = this.isAsync(node, content);
      const funcIsGenerator = this.isGenerator(node, content);
      const funcLine = node.startPosition.row + 1;
      const funcEndLine = node.endPosition.row + 1;
      const funcComplexity = this.computeFunctionComplexity(node, config);
      
      const funcInfo: FunctionInfo = {
        name: funcName,
        params: funcParams,
        isAsync: funcIsAsync,
        isGenerator: funcIsGenerator,
        line: funcLine,
        endLine: funcEndLine,
        complexity: funcComplexity
      };
      
      if (funcReturnType !== undefined) {
        funcInfo.returnType = funcReturnType;
      }
      
      functions.push(funcInfo);
    }
    
    return functions;
  }
  
  private extractInterfaces(tree: Parser.Tree, content: string, config: LanguageConfig): InterfaceInfo[] {
    const interfaces: InterfaceInfo[] = [];
    const query = new Parser.Query(config.language, config.queries.interfaces);
    const captures = query.captures(tree.rootNode);
    
    for (const capture of captures) {
      const node = capture.node;
      interfaces.push({
        name: this.extractInterfaceName(node, content),
        extends: this.extractInterfaceExtends(node, content),
        properties: this.extractInterfaceProperties(node, content, config),
        methods: this.extractInterfaceMethods(node, content, config),
        line: node.startPosition.row + 1
      });
    }
    
    return interfaces;
  }
  
  private extractTypes(tree: Parser.Tree, content: string, config: LanguageConfig): TypeInfo[] {
    const types: TypeInfo[] = [];
    const query = new Parser.Query(config.language, config.queries.types);
    const captures = query.captures(tree.rootNode);
    
    for (const capture of captures) {
      const node = capture.node;
      types.push({
        name: this.extractTypeName(node, content),
        kind: this.inferTypeKind(node),
        definition: node.text,
        line: node.startPosition.row + 1
      });
    }
    
    return types;
  }
  
  private extractCalls(tree: Parser.Tree, content: string, config: LanguageConfig): CallInfo[] {
    const calls: CallInfo[] = [];
    const query = new Parser.Query(config.language, config.queries.calls);
    const captures = query.captures(tree.rootNode);
    
    for (const capture of captures) {
      const node = capture.node;
      calls.push({
        callee: this.extractCallee(node, content),
        caller: this.extractCaller(node, content),
        line: node.startPosition.row + 1,
        isMethodCall: this.isMethodCall(node),
        argsCount: this.countArguments(node)
      });
    }
    
    return calls;
  }
  
  private computeMetrics(tree: Parser.Tree, content: string, config: LanguageConfig): FileMetrics {
    const lines = content.split('\n');
    const linesOfCode = lines.filter(l => l.trim() && !l.trim().startsWith('//') && !l.trim().startsWith('/*')).length;
    const linesOfComments = lines.filter(l => l.trim().startsWith('//') || l.trim().startsWith('/*')).length;
    const blankLines = lines.filter(l => !l.trim()).length;
    
    const cyclomaticComplexity = this.computeCyclomaticComplexity(tree, config);
    const cognitiveComplexity = this.computeCognitiveComplexity(tree, config);
    const nestingDepth = this.computeNestingDepth(tree);
    const halsteadVolume = this.computeHalsteadVolume(tree, content);
    const maintainabilityIndex = this.computeMaintainabilityIndex(
      linesOfCode, 
      cyclomaticComplexity, 
      halsteadVolume
    );
    
    return {
      linesOfCode,
      linesOfComments,
      blankLines,
      cyclomaticComplexity,
      cognitiveComplexity,
      nestingDepth,
      halsteadVolume,
      maintainabilityIndex
    };
  }
  
  private extractErrors(tree: Parser.Tree, content: string): ParseError[] {
    const errors: ParseError[] = [];
    this.traverseForErrors(tree.rootNode, errors, content);
    return errors;
  }
  
  private traverseForErrors(node: Parser.SyntaxNode, errors: ParseError[], content: string): void {
    if (node.type === 'ERROR' || node.type === 'MISSING') {
      errors.push({
        message: `Parse error at ${node.type}`,
        line: node.startPosition.row + 1,
        column: node.startPosition.column + 1,
        severity: node.type === 'ERROR' ? 'error' : 'warning'
      });
    }
    for (const child of node.children || []) {
      this.traverseForErrors(child, errors, content);
    }
  }
  
  // Helper methods (simplified - production would be language-specific)
  private extractImportSource(node: Parser.SyntaxNode, _content: string): string {
    if (typeof node.descendantsOfType === 'function') {
      const strings = node.descendantsOfType(['string']);
      if (strings.length > 0) {
        return String(strings[0]!.text).replace(/^['"]|['"]$/g, '');
      }
    }
    return String(node.text).split('\n')[0] ?? '';
  }
  private extractImportSpecifiers(_node: Parser.SyntaxNode, _content: string): string[] { return []; }
  private extractExportName(_node: Parser.SyntaxNode, _content: string): string { return 'export'; }
  private inferExportType(_node: Parser.SyntaxNode): ExportInfo['type'] { return 'function'; }
  private extractClassName(_node: Parser.SyntaxNode, _content: string): string { return 'Class'; }
  private extractExtends(_node: Parser.SyntaxNode, _content: string): string | undefined { return undefined; }
  private extractImplements(_node: Parser.SyntaxNode, _content: string): string[] { return []; }
  private extractMethods(_node: Parser.SyntaxNode, _content: string, _config: LanguageConfig): MethodInfo[] { return []; }
  private extractProperties(_node: Parser.SyntaxNode, _content: string, _config: LanguageConfig): PropertyInfo[] { return []; }
  private computeClassComplexity(_node: Parser.SyntaxNode, _config: LanguageConfig): number { return 1; }
  private extractFunctionName(_node: Parser.SyntaxNode, _content: string): string { return 'function'; }
  private extractParameters(_node: Parser.SyntaxNode, _content: string, _config: LanguageConfig): ParameterInfo[] { return []; }
  private extractReturnType(_node: Parser.SyntaxNode, _content: string): string | undefined { return undefined; }
  private isAsync(_node: Parser.SyntaxNode, _content: string): boolean { return false; }
  private isGenerator(_node: Parser.SyntaxNode, _content: string): boolean { return false; }
  private computeFunctionComplexity(_node: Parser.SyntaxNode, _config: LanguageConfig): number { return 1; }
  private extractInterfaceName(_node: Parser.SyntaxNode, _content: string): string { return 'Interface'; }
  private extractInterfaceExtends(_node: Parser.SyntaxNode, _content: string): string[] { return []; }
  private extractInterfaceProperties(_node: Parser.SyntaxNode, _content: string, _config: LanguageConfig): PropertyInfo[] { return []; }
  private extractInterfaceMethods(_node: Parser.SyntaxNode, _content: string, _config: LanguageConfig): MethodInfo[] { return []; }
  private extractTypeName(_node: Parser.SyntaxNode, _content: string): string { return 'Type'; }
  private inferTypeKind(_node: Parser.SyntaxNode): TypeInfo['kind'] { return 'type'; }
  private extractCallee(_node: Parser.SyntaxNode, _content: string): string { return 'callee'; }
  private extractCaller(_node: Parser.SyntaxNode, _content: string): string { return 'caller'; }
  private isMethodCall(_node: Parser.SyntaxNode): boolean { return false; }
  private countArguments(_node: Parser.SyntaxNode): number { return 0; }
  private computeCyclomaticComplexity(_tree: Parser.Tree, _config: LanguageConfig): number { return 1; }
  private computeCognitiveComplexity(_tree: Parser.Tree, _config: LanguageConfig): number { return 1; }
  private computeNestingDepth(_tree: Parser.Tree): number { return 1; }
  private computeHalsteadVolume(_tree: Parser.Tree, _content: string): number { return 0; }
  private computeMaintainabilityIndex(loc: number, cc: number, hv: number): number {
    return Math.max(0, 171 - 5.2 * Math.log(hv) - 0.23 * cc - 16.2 * Math.log(loc));
  }
  
  // Language-specific queries
  private getTSQueries() {
    return {
      imports: `(import_statement) @import`,
      exports: `(export_statement) @export`,
      classes: `(class_declaration) @class`,
      functions: `(function_declaration) @function`,
      interfaces: `(interface_declaration) @interface`,
      types: `(type_alias_declaration) @type`,
      calls: `(call_expression) @call`,
      complexity: `(if_statement) @complexity (for_statement) @complexity (while_statement) @complexity (catch_clause) @complexity`
    };
  }

  private getPythonQueries() {
    return {
      imports: `(import_statement) @import (import_from_statement) @import`,
      exports: `(module (expression_statement (assignment left: (identifier) @export)))`,
      classes: `(class_definition) @class`,
      functions: `(function_definition) @function`,
      interfaces: ``, // Python has no interfaces (abstract base classes are runtime constructs)
      types: `(type) @type`,
      calls: `(call) @call`,
      complexity: `(if_statement) @complexity (for_statement) @complexity (while_statement) @complexity (except_clause) @complexity`
    };
  }

  private getGoQueries() {
    return {
      imports: `(import_declaration) @import`,
      exports: `(function_declaration name: (identifier) @export)`,
      classes: `(type_declaration (type_spec (type_identifier) @class))`,
      functions: `(function_declaration) @function`,
      interfaces: `(interface_type) @interface`,
      types: `(type_declaration) @type`,
      calls: `(call_expression) @call`,
      complexity: `(if_statement) @complexity (for_statement) @complexity (expression_switch_statement) @complexity (type_switch_statement) @complexity`
    };
  }

  private getJavaQueries() {
    return {
      imports: `(import_declaration) @import`,
      exports: `(class_declaration (modifiers) @export)`,
      classes: `(class_declaration) @class`,
      functions: `(method_declaration) @function (constructor_declaration) @function`,
      interfaces: `(interface_declaration) @interface`,
      types: `(enum_declaration) @type (record_declaration) @type (annotation_type_declaration) @type`,
      calls: `(method_invocation) @call`,
      complexity: `(if_statement) @complexity (for_statement) @complexity (while_statement) @complexity (catch_clause) @complexity`
    };
  }

  private getRustQueries() {
    return {
      imports: `(use_declaration) @import`,
      exports: `(function_item (visibility_modifier) @export) (struct_item (visibility_modifier) @export) (enum_item (visibility_modifier) @export) (mod_item (visibility_modifier) @export)`,
      classes: `(struct_item) @class (enum_item) @class`,
      functions: `(function_item) @function`,
      interfaces: `(trait_item) @interface`,
      types: `(type_item) @type`,
      calls: `(call_expression) @call`,
      complexity: `(if_expression) @complexity (loop_expression) @complexity (match_expression) @complexity`
    };
  }

  private getRubyQueries() {
    return {
      imports: `(call method: (identifier) @import)`,
      exports: ``, // Ruby has no module-level exports
      classes: `(class) @class`,
      functions: `(method) @function`,
      interfaces: ``, // Ruby uses modules instead of interfaces
      types: `(constant) @type`,
      calls: `(call) @call`,
      complexity: `(if) @complexity (while) @complexity (until) @complexity (for) @complexity`
    };
  }

  private getPHPQueries() {
    return {
      imports: `(namespace_use_declaration) @import`,
      exports: `(method_declaration (visibility_modifier) @export)`,
      classes: `(class_declaration) @class`,
      functions: `(function_definition) @function`,
      interfaces: `(interface_declaration) @interface`,
      types: ``, // PHP has no type declaration nodes
      calls: `(function_call_expression) @call`,
      complexity: `(if_statement) @complexity (for_statement) @complexity (while_statement) @complexity (catch_clause) @complexity`
    };
  }
}
