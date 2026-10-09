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

const CONTROL_TYPES = new Set([
  'if_statement', 'if_expression', 'if', 'if_modifier', 'elsif', 'else_if_clause',
  'unless', 'unless_modifier',
  'for_statement', 'for_in_statement', 'for', 'for_expression', 'foreach_statement',
  'while_statement', 'while', 'while_modifier', 'while_expression',
  'until', 'until_modifier',
  'do_statement', 'loop_expression',
  'switch_statement', 'expression_switch_statement', 'type_switch_statement', 'switch_expression',
  'case', 'match_expression',
  'catch_clause', 'except_clause', 'rescue', 'rescue_clause'
]);

const HALSTEAD_DELIMITERS = new Set([';', '{', '}', '(', ')', '[', ']', ',', ':']);

const HALSTEAD_OPERAND_TYPES = new Set([
  'identifier', 'field_identifier', 'property_identifier', 'type_identifier',
  'constant', 'primitive_type', 'generic_type', 'named_type', 'type_parameter',
  'integer', 'float', 'number', 'decimal_integer_literal', 'float_literal',
  'string', 'string_fragment', 'string_content', 'template_string', 'string_literal',
  'interpreted_string_literal', 'raw_string_literal', 'character',
  'true', 'false', 'null', 'nil', 'undefined', 'none', 'self', 'this', 'super'
]);

const FUNCTION_TYPES = new Set([
  'function_declaration', 'generator_function_declaration', 'function_expression',
  'arrow_function', 'method_definition', 'function_definition', 'method',
  'singleton_method', 'function_item', 'method_declaration', 'lambda', 'constructor_declaration'
]);

const CLASS_TYPES = new Set(['class', 'class_declaration', 'class_definition']);

const IDENTIFIER_TYPES = new Set([
  'identifier', 'constant', 'field_identifier', 'property_identifier', 'type_identifier'
]);

const MEMBER_TYPES = new Set([
  'member_expression', 'field_access', 'attribute', 'dereferencing', 'property_access'
]);


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
    const tsxParser = new Parser();
    tsxParser.setLanguage(TypeScript.tsx);
    this.parsers.set('typescript', tsParser);
    this.parsers.set('javascript', tsParser);
    this.parsers.set('tsx', tsxParser);
    this.parsers.set('jsx', tsxParser);
    
    this.languageConfigs.set('typescript', {
      name: 'TypeScript',
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
      parser: tsParser,
      language: TypeScript.typescript,
      queries: this.getTSQueries()
    });
    this.languageConfigs.set('tsx', {
      name: 'TypeScript (TSX)',
      extensions: ['.tsx', '.jsx'],
      parser: tsxParser,
      language: TypeScript.tsx,
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
    
    const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
    const configKey = ext === '.tsx' || ext === '.jsx' ? 'tsx' : language;
    const config = this.languageConfigs.get(configKey)!;
    const parser = this.parsers.get(configKey)!;
    
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
    const hashComments = config.name === 'Python' || config.name === 'Ruby' || config.name === 'PHP';
    const isCommentLine = (line: string): boolean => {
      const t = line.trim();
      if (t.startsWith('//') || t.startsWith('/*') || t.startsWith('*') || t.startsWith('#!')) return true;
      return hashComments && t.startsWith('#');
    };
    const lines = content.split('\n');
    const linesOfCode = lines.filter(l => l.trim() && !isCommentLine(l)).length;
    const linesOfComments = lines.filter(l => isCommentLine(l)).length;
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
  private extractImportSpecifiers(node: Parser.SyntaxNode, _content: string): string[] {
    const specifiers: string[] = [];
    const found = node.descendantsOfType(['named_imports', 'import_specifier', 'use_as_clause']);
    for (const block of found) {
      if (block.type === 'named_imports') {
        for (const child of block.namedChildren) {
          specifiers.push(child.childForFieldName('name')?.text ?? child.text);
        }
      } else if (block.type === 'use_as_clause') {
        specifiers.push(block.text);
      } else {
        specifiers.push(block.childForFieldName('name')?.text ?? block.text);
      }
    }
    if (specifiers.length === 0) {
      const clause = node.childForFieldName('clause');
      if (clause) {
        for (const child of clause.namedChildren) specifiers.push(child.text);
      }
    }
    return specifiers;
  }
  private extractExportName(node: Parser.SyntaxNode, _content: string): string {
    const decl = node.childForFieldName('declaration');
    const target = decl ?? node;
    const nameNode = target.childForFieldName('name');
    if (nameNode) return nameNode.text;
    if (IDENTIFIER_TYPES.has(target.type)) return target.text;
    const left = target.childForFieldName('left');
    if (left && IDENTIFIER_TYPES.has(left.type)) return left.text;
    const first = target.children.find(c => IDENTIFIER_TYPES.has(c.type));
    if (first) return first.text;
    const m = target.text.match(/(?:function|class|const|let|var|def|fn|func|type|interface|enum|struct|trait|async)\s+([A-Za-z_$][\w$]*)/);
    return m && m[1] ? m[1] : 'export';
  }
  private inferExportType(node: Parser.SyntaxNode): ExportInfo['type'] {
    const head = node.text.slice(0, 160);
    if (/\binterface\b/.test(head)) return 'interface';
    if (/\bclass\b|\bstruct\b|\btrait\b|\brecord\b/.test(head)) return 'class';
    if (/\benum\b/.test(head)) return 'type';
    if (/\btype\b/.test(head)) return 'type';
    if (/\bfunction\b|\bdef\b|\bfn\b|\bfunc\b/.test(head)) return 'function';
    return 'const';
  }
  private extractClassName(node: Parser.SyntaxNode, _content: string): string {
    const nameNode = node.childForFieldName('name');
    if (nameNode) return nameNode.text;
    const first = node.children.find(c => IDENTIFIER_TYPES.has(c.type));
    if (first) return first.text;
    const m = node.text.match(/\b(?:class|struct|interface|enum|trait|record)\s+([A-Za-z_][\w]*)/);
    return m && m[1] ? m[1] : 'anonymous';
  }
  private extractExtends(node: Parser.SyntaxNode, _content: string): string | undefined {
    const sup = node.childForFieldName('superclasses') ?? node.childForFieldName('superclass');
    if (sup) return sup.text.replace(/^[\s(]+/, '').replace(/[)\s]+$/, '');
    const extendsClause = node.descendantsOfType(['extends_type_clause'])[0];
    if (extendsClause) return extendsClause.text.replace(/^extends\s+/, '').trim();
    const m = node.text.match(/\bextends\s+([^{]+?)(?:\s+implements\s|\s*\{|$)/);
    if (m && m[1]) return m[1].trim();
    const embeds = node.descendantsOfType(['superclass'])[0];
    if (embeds) return embeds.text.replace(/^[\s(]+/, '').replace(/[)\s]+$/, '');
    return undefined;
  }
  private extractImplements(node: Parser.SyntaxNode, _content: string): string[] {
    const implClause = node.descendantsOfType(['implements_type_clause'])[0];
    if (implClause) {
      return implClause.text.replace(/^implements\s+/, '').split(',').map(s => s.trim()).filter(Boolean);
    }
    const m = node.text.match(/\bimplements\s+([^{]+?)\{/);
    if (m && m[1]) return m[1].split(',').map(s => s.trim()).filter(Boolean);
    const interfaces = node.childForFieldName('interfaces');
    if (interfaces) return interfaces.namedChildren.map(c => c.text);
    return [];
  }
  private extractMethods(node: Parser.SyntaxNode, content: string, config: LanguageConfig): MethodInfo[] {
    const methods: MethodInfo[] = [];
    const query = new Parser.Query(config.language, config.queries.functions);
    for (const capture of query.captures(node)) {
      const fn = capture.node;
      if (fn === node || FUNCTION_TYPES.has(fn.type) === false) continue;
      if (this.nearestClassAncestor(fn) !== node) continue;
      const methodInfo: MethodInfo = {
        name: this.extractFunctionName(fn, content),
        params: this.extractParameters(fn, content, config),
        isAsync: this.isAsync(fn, content),
        isStatic: /\bstatic\b/.test(fn.text.slice(0, 160)),
        isPrivate: /\bprivate\b/.test(fn.text.slice(0, 160)) || /^[_#]/.test(this.extractFunctionName(fn, content)),
        line: fn.startPosition.row + 1,
        endLine: fn.endPosition.row + 1,
        complexity: this.computeFunctionComplexity(fn, config)
      };
      const ret = this.extractReturnType(fn, content);
      if (ret !== undefined) methodInfo.returnType = ret;
      methods.push(methodInfo);
    }
    return methods;
  }
  private nearestClassAncestor(node: Parser.SyntaxNode): Parser.SyntaxNode | null {
    let p = node.parent;
    while (p) {
      if (CLASS_TYPES.has(p.type)) return p;
      p = p.parent;
    }
    return null;
  }
  private extractProperties(node: Parser.SyntaxNode, _content: string, _config: LanguageConfig): PropertyInfo[] {
    const props: PropertyInfo[] = [];
    const push = (name: string, n: Parser.SyntaxNode, isStatic: boolean, isPrivate: boolean, isReadonly: boolean): void => {
      props.push({ name, isStatic, isPrivate, isReadonly, line: n.startPosition.row + 1 });
    };
    const walk = (n: Parser.SyntaxNode): void => {
      if (n !== node && (FUNCTION_TYPES.has(n.type) || CLASS_TYPES.has(n.type))) return;
      if ((n.type === 'field_definition' || n.type === 'public_field_definition') && n.parent) {
        const nameNode = n.childForFieldName('name') ?? n.children.find(c => IDENTIFIER_TYPES.has(c.type));
        const text = n.text;
        if (nameNode) {
          push(nameNode.text, n, /\bstatic\b/.test(text), /\bprivate\b|\bprotected\b/.test(text), /\breadonly\b/.test(text));
        }
        return;
      }
      if (n.type === 'field_declaration' && n.parent && ['field_declaration_list', 'class_body', 'record_body'].includes(n.parent.type)) {
        const declarators = n.descendantsOfType(['variable_declarator']);
        if (declarators.length > 0) {
          for (const d of declarators) {
            const nameNode = d.childForFieldName('name');
            if (nameNode) push(nameNode.text, n, /\bstatic\b/.test(n.text), /\bprivate\b|\bprotected\b/.test(n.text), /\bfinal\b|\breadonly\b/.test(n.text));
          }
        } else {
          const nameNode = n.childForFieldName('name') ?? n.children.find(c => IDENTIFIER_TYPES.has(c.type));
          if (nameNode) push(nameNode.text, n, false, /\bprivate\b/.test(n.text), /\breadonly\b/.test(n.text));
        }
        return;
      }
      if (
        n.type === 'assignment' &&
        n.parent?.type === 'expression_statement' &&
        n.parent.parent?.type === 'block' &&
        n.parent.parent.parent?.type === 'class_definition'
      ) {
        const left = n.childForFieldName('left');
        if (left && IDENTIFIER_TYPES.has(left.type)) push(left.text, n, false, left.text.startsWith('_'), false);
        return;
      }
      for (const child of n.children) {
        if (child.isNamed) walk(child);
      }
    };
    walk(node);
    return props;
  }
  private computeClassComplexity(node: Parser.SyntaxNode, config: LanguageConfig): number {
    const query = new Parser.Query(config.language, config.queries.functions);
    const fns = query.captures(node).map(c => c.node).filter(n => n !== node);
    if (fns.length > 0) {
      let sum = 0;
      for (const fn of fns) sum += this.computeFunctionComplexity(fn, config);
      return sum;
    }
    const complexity = new Parser.Query(config.language, config.queries.complexity);
    return Math.max(1, complexity.captures(node).length);
  }
  private extractFunctionName(node: Parser.SyntaxNode, _content: string): string {
    const nameNode = node.childForFieldName('name');
    if (nameNode) return nameNode.text;
    const parent = node.parent;
    if (parent) {
      if (parent.type === 'variable_declarator' || parent.type === 'assignment' || parent.type === 'pair' || parent.type === 'property') {
        const parentName = parent.childForFieldName('name') ?? parent.childForFieldName('left') ?? parent.childForFieldName('key');
        if (parentName) return parentName.text;
      }
      if (parent.type === 'export_statement') {
        const decl = parent.childForFieldName('declaration');
        if (decl) {
          const declName = decl.childForFieldName('name') ?? decl.children.find(c => IDENTIFIER_TYPES.has(c.type));
          if (declName) return declName.text;
        }
      }
    }
    const first = node.children.find(c => IDENTIFIER_TYPES.has(c.type));
    if (first) return first.text;
    const m = node.text.match(/(?:def|function|func|fn|fun|sub)\s+([A-Za-z_][\w!?=]*)/);
    if (m && m[1]) return m[1];
    if (node.text.trimStart().startsWith('constructor')) return 'constructor';
    return 'anonymous';
  }
  private extractParameters(node: Parser.SyntaxNode, _content: string, _config: LanguageConfig): ParameterInfo[] {
    let params = node.childForFieldName('parameters');
    if (!params) {
      const body = node.childForFieldName('body');
      const limit = body ? body.startIndex : node.endIndex;
      const candidates = node.descendantsOfType(['formal_parameters', 'parameters', 'method_parameters', 'parameter_list', 'lambda_parameters', 'lambda_formal_parameters']);
      params = candidates.find(c => c.endIndex <= limit) ?? null;
    }
    if (!params) {
      if (node.type === 'arrow_function') {
        const first = node.children[0];
        if (first && first.isNamed && first.type !== '=>') {
          return [{ name: first.text, optional: false }];
        }
      }
      return [];
    }
    const items = params.childCount === 0 ? [params] : params.namedChildren;
    const result: ParameterInfo[] = [];
    for (const item of items) {
      if (!item.isNamed) continue;
      const raw = item.text;
      if (raw === ')' || raw === '(' || raw === ',' || raw === ';' || raw === ':') continue;
      const nameNode = item.childForFieldName('name');
      let name = nameNode ? nameNode.text : '';
      if (!name) {
        if (IDENTIFIER_TYPES.has(item.type)) {
          name = item.text;
        } else {
          const firstNamed = item.children.find(c => c.isNamed && c.type !== 'type_annotation' && c.type !== 'type' && c.type !== 'optional_type');
          name = firstNamed ? firstNamed.text : item.text;
        }
      }
      const optional = item.type.includes('optional') || /\?/.test(name) || /=/.test(raw);
      name = name.replace(/^\.{3}/, '').replace(/^\$/, '').replace(/\?$/, '');
      const info: ParameterInfo = { name, optional };
      const typeNode = item.childForFieldName('type') ?? (item.type === 'required_parameter' || item.type === 'optional_parameter' ? item.children.find(c => c.type === 'type_annotation') : null);
      if (typeNode) info.type = typeNode.text.replace(/^:\s*/, '');
      const eq = raw.indexOf('=');
      if (eq !== -1 && !raw.slice(eq).includes('==')) info.defaultValue = raw.slice(eq + 1).trim();
      result.push(info);
    }
    return result;
  }
  private extractReturnType(node: Parser.SyntaxNode, _content: string): string | undefined {
    const direct = node.childForFieldName('return_type');
    if (direct) return direct.text.replace(/^:\s*/, '').trim();
    const body = node.childForFieldName('body');
    const params = node.childForFieldName('parameters');
    const limit = body ? body.startIndex : node.endIndex;
    const annotations = node.descendantsOfType(['type_annotation', 'type']);
    for (const ann of annotations) {
      if (ann.endIndex > limit) continue;
      if (params && ann.startIndex >= params.startIndex && ann.endIndex <= params.endIndex) continue;
      if (node.type === 'function_definition' && ann.parent !== node) continue;
      return ann.text.replace(/^:\s*/, '').trim();
    }
    return undefined;
  }
  private isAsync(node: Parser.SyntaxNode, content: string): boolean {
    void content;
    if (node.children.some(c => c.type === 'async')) return true;
    const body = node.childForFieldName('body');
    const sig = body ? node.text.slice(0, body.startIndex - node.startIndex) : node.text.slice(0, 160);
    return /\basync\b/.test(sig);
  }
  private isGenerator(node: Parser.SyntaxNode, content: string): boolean {
    void content;
    if (node.children.some(c => c.type === '*')) return true;
    const body = node.childForFieldName('body');
    const sig = body ? node.text.slice(0, body.startIndex - node.startIndex) : node.text.slice(0, 160);
    if (/\bfunction\s*\*/.test(sig)) return true;
    if (body && /\byield\b/.test(body.text)) return true;
    return false;
  }
  private computeFunctionComplexity(node: Parser.SyntaxNode, config: LanguageConfig): number {
    try {
      const query = new Parser.Query(config.language, config.queries.complexity);
      return 1 + query.captures(node).length;
    } catch {
      return 1;
    }
  }
  private extractInterfaceName(node: Parser.SyntaxNode, _content: string): string {
    const nameNode = node.childForFieldName('name');
    if (nameNode) return nameNode.text;
    const first = node.children.find(c => IDENTIFIER_TYPES.has(c.type));
    if (first) return first.text;
    const m = node.text.match(/interface\s+([A-Za-z_][\w]*)/);
    return m && m[1] ? m[1] : 'anonymous';
  }
  private extractInterfaceExtends(node: Parser.SyntaxNode, _content: string): string[] {
    const extendsClause = node.descendantsOfType(['extends_type_clause'])[0];
    if (extendsClause) {
      return extendsClause.text.replace(/^extends\s+/, '').split(',').map(s => s.trim()).filter(Boolean);
    }
    const m = node.text.match(/\bextends\s+([^{]+?)(?:\{|$)/);
    if (m && m[1]) return m[1].split(',').map(s => s.trim()).filter(Boolean);
    return [];
  }
  private extractInterfaceProperties(node: Parser.SyntaxNode, _content: string, _config: LanguageConfig): PropertyInfo[] {
    const props: PropertyInfo[] = [];
    for (const sig of node.descendantsOfType(['property_signature', 'index_signature'])) {
      const nameNode = sig.childForFieldName('name');
      const name = nameNode ? nameNode.text : sig.text.split(/[:{]/)[0]?.trim() ?? 'unknown';
      props.push({
        name,
        isStatic: false,
        isPrivate: false,
        isReadonly: /\breadonly\b/.test(sig.text),
        line: sig.startPosition.row + 1
      });
    }
    return props;
  }
  private extractInterfaceMethods(node: Parser.SyntaxNode, content: string, config: LanguageConfig): MethodInfo[] {
    const methods: MethodInfo[] = [];
    for (const sig of node.descendantsOfType(['method_signature', 'method_declaration'])) {
      const info: MethodInfo = {
        name: this.extractFunctionName(sig, content),
        params: this.extractParameters(sig, content, config),
        isAsync: this.isAsync(sig, content),
        isStatic: false,
        isPrivate: false,
        line: sig.startPosition.row + 1,
        endLine: sig.endPosition.row + 1,
        complexity: 1
      };
      const ret = this.extractReturnType(sig, content);
      if (ret !== undefined) info.returnType = ret;
      methods.push(info);
    }
    return methods;
  }
  private extractTypeName(node: Parser.SyntaxNode, _content: string): string {
    const nameNode = node.childForFieldName('name');
    if (nameNode) return nameNode.text;
    if (IDENTIFIER_TYPES.has(node.type)) return node.text;
    const first = node.children.find(c => IDENTIFIER_TYPES.has(c.type));
    if (first) return first.text;
    const m = node.text.match(/(?:type|enum|struct)\s+([A-Za-z_][\w]*)/);
    return m && m[1] ? m[1] : node.text.split(/[={;]/)[0]?.trim() || 'anonymous';
  }
  private inferTypeKind(node: Parser.SyntaxNode): TypeInfo['kind'] {
    if (node.type.includes('enum') || /\benum\b/.test(node.text.slice(0, 60))) return 'enum';
    if (node.type.includes('interface') || /\binterface\b/.test(node.text.slice(0, 60))) return 'interface';
    return 'type';
  }
  private extractCallee(node: Parser.SyntaxNode, _content: string): string {
    if (node.type === 'method_invocation') {
      const obj = node.childForFieldName('object');
      const name = node.childForFieldName('name');
      if (obj && name) return `${obj.text}.${name.text}`;
    }
    const target = node.childForFieldName('function') ?? node.childForFieldName('method') ?? node.childForFieldName('name');
    const text = target ? target.text : node.text;
    return text.split('(')[0]?.trim() ?? text;
  }
  private extractCaller(node: Parser.SyntaxNode, _content: string): string {
    const target = node.childForFieldName('function') ?? node.childForFieldName('method');
    const receiver = node.childForFieldName('receiver') ?? node.childForFieldName('object') ?? node.childForFieldName('value');
    if (receiver) return receiver.text;
    if (target && MEMBER_TYPES.has(target.type)) {
      const obj = target.childForFieldName('object') ?? target.childForFieldName('value') ?? target.childForFieldName('scope');
      if (obj) return obj.text;
      const first = target.children[0];
      if (first && first.text !== target.text) return first.text;
    }
    if (node.type === 'call' && node.childForFieldName('method')) {
      const recv = node.children.find(c => c.isNamed && c !== node.childForFieldName('method'));
      if (recv && !IDENTIFIER_TYPES.has(recv.type)) return recv.text;
    }
    return '';
  }
  private isMethodCall(node: Parser.SyntaxNode): boolean {
    const target = node.childForFieldName('function') ?? node.childForFieldName('method') ?? node.childForFieldName('name');
    if (target && MEMBER_TYPES.has(target.type)) return true;
    if (node.childForFieldName('object') || node.childForFieldName('receiver')) return true;
    if (node.type === 'call' && node.childForFieldName('method')) return true;
    return false;
  }
  private countArguments(node: Parser.SyntaxNode): number {
    const args = node.childForFieldName('arguments') ?? node.childForFieldName('args');
    if (args) return args.namedChildren.filter(c => c.isNamed && c.type !== ',' && c.type !== ')').length;
    const list = node.descendantsOfType(['arguments', 'argument_list'])[0];
    if (list) return list.namedChildren.filter(c => c.type !== ',' && c.type !== ')').length;
    return 0;
  }
  private controlAncestorCount(node: Parser.SyntaxNode): number {
    let count = 0;
    let p = node.parent;
    while (p) {
      if (CONTROL_TYPES.has(p.type)) count++;
      p = p.parent;
    }
    return count;
  }
  private computeCyclomaticComplexity(tree: Parser.Tree, config: LanguageConfig): number {
    try {
      const query = new Parser.Query(config.language, config.queries.complexity);
      return 1 + query.captures(tree.rootNode).length;
    } catch {
      return 1;
    }
  }
  private computeCognitiveComplexity(tree: Parser.Tree, config: LanguageConfig): number {
    try {
      const query = new Parser.Query(config.language, config.queries.complexity);
      let total = 0;
      for (const capture of query.captures(tree.rootNode)) {
        total += 1 + this.controlAncestorCount(capture.node);
      }
      return total;
    } catch {
      return 1;
    }
  }
  private computeNestingDepth(tree: Parser.Tree): number {
    let max = 0;
    const walk = (node: Parser.SyntaxNode, depth: number): void => {
      const d = CONTROL_TYPES.has(node.type) ? depth + 1 : depth;
      if (d > max) max = d;
      for (const child of node.children) walk(child, d);
    };
    walk(tree.rootNode, 0);
    return max;
  }
  private computeHalsteadVolume(tree: Parser.Tree, _content: string): number {
    const operatorCounts = new Map<string, number>();
    const operandCounts = new Map<string, number>();
    const bump = (map: Map<string, number>, key: string): void => {
      map.set(key, (map.get(key) ?? 0) + 1);
    };
    const walk = (node: Parser.SyntaxNode): void => {
      if (node.type === 'comment' || node.type.endsWith('_comment')) return;
      if (HALSTEAD_OPERAND_TYPES.has(node.type)) {
        bump(operandCounts, node.type);
        return;
      }
      if (!node.isNamed) {
        if (!HALSTEAD_DELIMITERS.has(node.type) && node.type !== '=>' && node.type !== '->' && node.type !== '=>') {
          bump(operatorCounts, node.type);
        }
        return;
      }
      for (const child of node.children) walk(child);
    };
    walk(tree.rootNode);
    const n = [...operatorCounts.values()].reduce((a, b) => a + b, 0) + [...operandCounts.values()].reduce((a, b) => a + b, 0);
    const t = operatorCounts.size + operandCounts.size;
    if (n === 0 || t <= 1) return 0;
    return n * Math.log2(t);
  }
  private computeMaintainabilityIndex(loc: number, cc: number, hv: number): number {
    const raw = 171 - 5.2 * Math.log(Math.max(hv, 1)) - 0.23 * cc - 16.2 * Math.log(Math.max(loc, 1));
    return Math.min(100, Math.max(0, raw));
  }
  
  private getTSQueries() {
    return {
      imports: `(import_statement) @import`,
      exports: `(export_statement) @export`,
      classes: `(class_declaration) @class`,
      functions: `(function_declaration) @function (method_definition) @function (lexical_declaration (variable_declarator name: (identifier) value: (arrow_function) @function))`,
      interfaces: `(interface_declaration) @interface`,
      types: `(type_alias_declaration) @type`,
      calls: `(call_expression) @call`,
      complexity: `(if_statement) @complexity (for_statement) @complexity (for_in_statement) @complexity (while_statement) @complexity (do_statement) @complexity (catch_clause) @complexity (switch_case) @complexity (ternary_expression) @complexity (binary_expression operator: "||") @complexity (binary_expression operator: "&&") @complexity`
    };
  }

  private getPythonQueries() {
    return {
      imports: `(import_statement) @import (import_from_statement) @import`,
      exports: `(module (expression_statement (assignment left: (identifier) @export)))`,
      classes: `(class_definition) @class`,
      functions: `(function_definition) @function (assignment right: (lambda) @function)`,
      interfaces: ``,
      types: `(type) @type`,
      calls: `(call) @call`,
      complexity: `(if_statement) @complexity (elif_clause) @complexity (for_statement) @complexity (while_statement) @complexity (except_clause) @complexity (boolean_operator) @complexity (conditional_expression) @complexity`
    };
  }

  private getGoQueries() {
    return {
      imports: `(import_declaration) @import`,
      exports: `(function_declaration name: (identifier) @export)`,
      classes: `(type_declaration (type_spec (type_identifier) @class))`,
      functions: `(function_declaration) @function (method_declaration) @function`,
      interfaces: `(interface_type) @interface`,
      types: `(type_declaration) @type`,
      calls: `(call_expression) @call`,
      complexity: `(if_statement) @complexity (for_statement) @complexity (expression_case) @complexity (type_case) @complexity (communication_case) @complexity (binary_expression operator: "||") @complexity (binary_expression operator: "&&") @complexity`
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
      complexity: `(if_statement) @complexity (for_statement) @complexity (while_statement) @complexity (do_statement) @complexity (catch_clause) @complexity (switch_label) @complexity (ternary_expression) @complexity (binary_expression operator: "&&") @complexity (binary_expression operator: "||") @complexity`
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
      complexity: `(if_expression) @complexity (loop_expression) @complexity (while_expression) @complexity (for_expression) @complexity (match_arm) @complexity (binary_expression operator: "&&") @complexity (binary_expression operator: "||") @complexity`
    };
  }

  private getRubyQueries() {
    return {
      imports: `(call method: (identifier) @import)`,
      exports: ``,
      classes: `(class) @class`,
      functions: `(method) @function (singleton_method) @function`,
      interfaces: ``,
      types: `(constant) @type`,
      calls: `(call) @call`,
      complexity: `(if) @complexity (if_modifier) @complexity (elsif) @complexity (unless) @complexity (unless_modifier) @complexity (when) @complexity (while) @complexity (while_modifier) @complexity (until) @complexity (until_modifier) @complexity (for) @complexity (rescue) @complexity (binary operator: "&&") @complexity (binary operator: "||") @complexity (binary operator: "and") @complexity (binary operator: "or") @complexity`
    };
  }

  private getPHPQueries() {
    return {
      imports: `(namespace_use_declaration) @import`,
      exports: `(method_declaration (visibility_modifier) @export)`,
      classes: `(class_declaration) @class`,
      functions: `(function_definition) @function (method_declaration) @function`,
      interfaces: `(interface_declaration) @interface`,
      types: ``,
      calls: `(function_call_expression) @call`,
      complexity: `(if_statement) @complexity (else_if_clause) @complexity (for_statement) @complexity (foreach_statement) @complexity (while_statement) @complexity (do_statement) @complexity (catch_clause) @complexity (case_statement) @complexity (conditional_expression) @complexity (binary_expression operator: "&&") @complexity (binary_expression operator: "and") @complexity`
    };
  }
}
