"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MultiLanguageParser = void 0;
const tree_sitter_1 = require("tree-sitter");
const tree_sitter_typescript_1 = __importDefault(require("tree-sitter-typescript"));
const tree_sitter_python_1 = __importDefault(require("tree-sitter-python"));
const tree_sitter_go_1 = __importDefault(require("tree-sitter-go"));
const tree_sitter_java_1 = __importDefault(require("tree-sitter-java"));
const tree_sitter_rust_1 = __importDefault(require("tree-sitter-rust"));
const tree_sitter_ruby_1 = __importDefault(require("tree-sitter-ruby"));
const tree_sitter_php_1 = __importDefault(require("tree-sitter-php"));
class MultiLanguageParser {
    parsers = new Map();
    languageConfigs = new Map();
    constructor() {
        this.initializeParsers();
    }
    initializeParsers() {
        // TypeScript/JavaScript
        const tsParser = new tree_sitter_1.Parser();
        tsParser.setLanguage(tree_sitter_typescript_1.default.typescript);
        this.parsers.set('typescript', tsParser);
        this.parsers.set('javascript', tsParser);
        this.parsers.set('tsx', tsParser);
        this.parsers.set('jsx', tsParser);
        this.languageConfigs.set('typescript', {
            name: 'TypeScript',
            extensions: ['.ts', '.tsx', '.js', '.jsx'],
            parser: tsParser,
            queries: this.getTSQueries()
        });
        // Python
        const pyParser = new tree_sitter_1.Parser();
        pyParser.setLanguage(tree_sitter_python_1.default);
        this.parsers.set('python', pyParser);
        this.languageConfigs.set('python', {
            name: 'Python',
            extensions: ['.py'],
            parser: pyParser,
            queries: this.getPythonQueries()
        });
        // Go
        const goParser = new tree_sitter_1.Parser();
        goParser.setLanguage(tree_sitter_go_1.default);
        this.parsers.set('go', goParser);
        this.languageConfigs.set('go', {
            name: 'Go',
            extensions: ['.go'],
            parser: goParser,
            queries: this.getGoQueries()
        });
        // Java
        const javaParser = new tree_sitter_1.Parser();
        javaParser.setLanguage(tree_sitter_java_1.default);
        this.parsers.set('java', javaParser);
        this.languageConfigs.set('java', {
            name: 'Java',
            extensions: ['.java'],
            parser: javaParser,
            queries: this.getJavaQueries()
        });
        // Rust
        const rustParser = new tree_sitter_1.Parser();
        rustParser.setLanguage(tree_sitter_rust_1.default);
        this.parsers.set('rust', rustParser);
        this.languageConfigs.set('rust', {
            name: 'Rust',
            extensions: ['.rs'],
            parser: rustParser,
            queries: this.getRustQueries()
        });
        // Ruby
        const rubyParser = new tree_sitter_1.Parser();
        rubyParser.setLanguage(tree_sitter_ruby_1.default);
        this.parsers.set('ruby', rubyParser);
        this.languageConfigs.set('ruby', {
            name: 'Ruby',
            extensions: ['.rb'],
            parser: rubyParser,
            queries: this.getRubyQueries()
        });
        // PHP
        const phpParser = new tree_sitter_1.Parser();
        phpParser.setLanguage(tree_sitter_php_1.default.php);
        this.parsers.set('php', phpParser);
        this.languageConfigs.set('php', {
            name: 'PHP',
            extensions: ['.php'],
            parser: phpParser,
            queries: this.getPHPQueries()
        });
    }
    getSupportedLanguages() {
        return Array.from(this.parsers.keys());
    }
    detectLanguage(filePath) {
        const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
        for (const [lang, config] of this.languageConfigs) {
            if (config.extensions.includes(ext)) {
                return lang;
            }
        }
        return null;
    }
    async parseFile(filePath, content) {
        const language = this.detectLanguage(filePath);
        if (!language) {
            throw new Error(`Unsupported language for file: ${filePath}`);
        }
        const config = this.languageConfigs.get(language);
        const parser = this.parsers.get(language);
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
    async parseFiles(files) {
        const results = [];
        for (const [file, content] of files) {
            try {
                const result = await this.parseFile(file, content);
                results.push(result);
            }
            catch (e) {
                console.error(`Failed to parse ${file}:`, e);
            }
        }
        return results;
    }
    extractImports(tree, content, config) {
        const imports = [];
        const query = config.parser.query(config.queries.imports);
        const captures = query.captures(tree.rootNode);
        for (const capture of captures) {
            const node = capture.node;
            const text = node.text();
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
    extractExports(tree, content, config) {
        const exports = [];
        const query = config.parser.query(config.queries.exports);
        const captures = query.captures(tree.rootNode);
        for (const capture of captures) {
            const node = capture.node;
            exports.push({
                name: this.extractExportName(node, content),
                type: this.inferExportType(node),
                line: node.startPosition.row + 1,
                isDefault: node.text().includes('default')
            });
        }
        return exports;
    }
    extractClasses(tree, content, config) {
        const classes = [];
        const query = config.parser.query(config.queries.classes);
        const captures = query.captures(tree.rootNode);
        for (const capture of captures) {
            const node = capture.node;
            classes.push({
                name: this.extractClassName(node, content),
                extends: this.extractExtends(node, content),
                implements: this.extractImplements(node, content),
                methods: this.extractMethods(node, content, config),
                properties: this.extractProperties(node, content, config),
                line: node.startPosition.row + 1,
                endLine: node.endPosition.row + 1,
                complexity: this.computeClassComplexity(node, config)
            });
        }
        return classes;
    }
    extractFunctions(tree, content, config) {
        const functions = [];
        const query = config.parser.query(config.queries.functions);
        const captures = query.captures(tree.rootNode);
        for (const capture of captures) {
            const node = capture.node;
            functions.push({
                name: this.extractFunctionName(node, content),
                params: this.extractParameters(node, content, config),
                returnType: this.extractReturnType(node, content),
                isAsync: this.isAsync(node, content),
                isGenerator: this.isGenerator(node, content),
                line: node.startPosition.row + 1,
                endLine: node.endPosition.row + 1,
                complexity: this.computeFunctionComplexity(node, config)
            });
        }
        return functions;
    }
    extractInterfaces(tree, content, config) {
        const interfaces = [];
        const query = config.parser.query(config.queries.interfaces);
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
    extractTypes(tree, content, config) {
        const types = [];
        const query = config.parser.query(config.queries.types);
        const captures = query.captures(tree.rootNode);
        for (const capture of captures) {
            const node = capture.node;
            types.push({
                name: this.extractTypeName(node, content),
                kind: this.inferTypeKind(node),
                definition: node.text(),
                line: node.startPosition.row + 1
            });
        }
        return types;
    }
    extractCalls(tree, content, config) {
        const calls = [];
        const query = config.parser.query(config.queries.calls);
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
    computeMetrics(tree, content, config) {
        const lines = content.split('\n');
        const linesOfCode = lines.filter(l => l.trim() && !l.trim().startsWith('//') && !l.trim().startsWith('/*')).length;
        const linesOfComments = lines.filter(l => l.trim().startsWith('//') || l.trim().startsWith('/*')).length;
        const blankLines = lines.filter(l => !l.trim()).length;
        const cyclomaticComplexity = this.computeCyclomaticComplexity(tree, config);
        const cognitiveComplexity = this.computeCognitiveComplexity(tree, config);
        const nestingDepth = this.computeNestingDepth(tree);
        const halsteadVolume = this.computeHalsteadVolume(tree, content);
        const maintainabilityIndex = this.computeMaintainabilityIndex(linesOfCode, cyclomaticComplexity, halsteadVolume);
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
    extractErrors(tree, content) {
        const errors = [];
        this.traverseForErrors(tree.rootNode, errors, content);
        return errors;
    }
    traverseForErrors(node, errors, content) {
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
    extractImportSource(node, content) { return node.text(); }
    extractImportSpecifiers(node, content) { return []; }
    extractExportName(node, content) { return 'export'; }
    inferExportType(node) { return 'function'; }
    extractClassName(node, content) { return 'Class'; }
    extractExtends(node, content) { return undefined; }
    extractImplements(node, content) { return []; }
    extractMethods(node, content, config) { return []; }
    extractProperties(node, content, config) { return []; }
    computeClassComplexity(node, config) { return 1; }
    extractFunctionName(node, content) { return 'function'; }
    extractParameters(node, content, config) { return []; }
    extractReturnType(node, content) { return undefined; }
    isAsync(node, content) { return false; }
    isGenerator(node, content) { return false; }
    computeFunctionComplexity(node, config) { return 1; }
    extractInterfaceName(node, content) { return 'Interface'; }
    extractInterfaceExtends(node, content) { return []; }
    extractInterfaceProperties(node, content, config) { return []; }
    extractInterfaceMethods(node, content, config) { return []; }
    extractTypeName(node, content) { return 'Type'; }
    inferTypeKind(node) { return 'type'; }
    extractCallee(node, content) { return 'callee'; }
    extractCaller(node, content) { return 'caller'; }
    isMethodCall(node) { return false; }
    countArguments(node) { return 0; }
    computeCyclomaticComplexity(tree, config) { return 1; }
    computeCognitiveComplexity(tree, config) { return 1; }
    computeNestingDepth(tree) { return 1; }
    computeHalsteadVolume(tree, content) { return 0; }
    computeMaintainabilityIndex(loc, cc, hv) {
        return Math.max(0, 171 - 5.2 * Math.log(hv) - 0.23 * cc - 16.2 * Math.log(loc));
    }
    // Language-specific queries
    getTSQueries() {
        return {
            imports: `(import_statement) @import`,
            exports: `(export_statement) @export`,
            classes: `(class_declaration) @class`,
            functions: `(function_declaration) @function`,
            interfaces: `(interface_declaration) @interface`,
            types: `(type_alias_declaration) @type`,
            calls: `(call_expression) @call`,
            complexity: `(if_statement) (for_statement) (while_statement) (catch_clause) @complexity`
        };
    }
    getPythonQueries() {
        return {
            imports: `(import_statement) (import_from_statement) @import`,
            exports: `(expression_statement (assignment (left (identifier) @export)))`,
            classes: `(class_definition) @class`,
            functions: `(function_definition) @function`,
            interfaces: `() @interface`, // Python uses abstract base classes
            types: `(type_alias) @type`,
            calls: `(call) @call`,
            complexity: `(if_statement) (for_statement) (while_statement) (except_clause) @complexity`
        };
    }
    getGoQueries() {
        return {
            imports: `(import_declaration) @import`,
            exports: `(func_declaration (receiver) @export)`,
            classes: `(type_declaration (type_spec (type_identifier) @class))`,
            functions: `(func_declaration) @function`,
            interfaces: `(interface_type) @interface`,
            types: `(type_declaration) @type`,
            calls: `(call_expression) @call`,
            complexity: `(if_statement) (for_statement) (switch_statement) @complexity`
        };
    }
    getJavaQueries() {
        return {
            imports: `(import_declaration) @import`,
            exports: `(class_declaration (modifiers (modifier) @export))`,
            classes: `(class_declaration) @class`,
            functions: `(method_declaration) @function`,
            interfaces: `(interface_declaration) @interface`,
            types: `(type_declaration) @type`,
            calls: `(method_invocation) @call`,
            complexity: `(if_statement) (for_statement) (while_statement) (catch_clause) @complexity`
        };
    }
    getRustQueries() {
        return {
            imports: `(use_declaration) @import`,
            exports: `(pub_mod) (pub_fn) @export`,
            classes: `(struct_expression) (enum_expression) @class`,
            functions: `(function_item) @function`,
            interfaces: `(trait_declaration) @interface`,
            types: `(type_item) @type`,
            calls: `(call_expression) @call`,
            complexity: `(if_expression) (loop_expression) (match_expression) @complexity`
        };
    }
    getRubyQueries() {
        return {
            imports: `(require) (require_relative) @import`,
            exports: `(method_definition (identifier) @export)`,
            classes: `(class_definition) @class`,
            functions: `(method_definition) @function`,
            interfaces: `() @interface`, // Ruby uses modules
            types: `(constant) @type`,
            calls: `(call) @call`,
            complexity: `(if) (while) (until) (for) (rescue) @complexity`
        };
    }
    getPHPQueries() {
        return {
            imports: `(use_declaration) @import`,
            exports: `(function_definition (modifiers (visibility_modifier) @export))`,
            classes: `(class_declaration) @class`,
            functions: `(function_definition) @function`,
            interfaces: `(interface_declaration) @interface`,
            types: `(type_declaration) @type`,
            calls: `(function_call_expression) @call`,
            complexity: `(if_statement) (for_statement) (while_statement) (catch_clause) @complexity`
        };
    }
}
exports.MultiLanguageParser = MultiLanguageParser;
//# sourceMappingURL=parser.js.map