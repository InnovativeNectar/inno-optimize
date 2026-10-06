import { ParseResult, AntiPattern, AntiPatternType, DetectionRule, RefactoringSuggestion, Issue } from './types.js';

export class AntiPatternDetector {
  private patterns: AntiPattern[] = this.initializePatterns();
  
  detect(parseResult: ParseResult): Issue[] {
    const issues: Issue[] = [];
    
    for (const pattern of this.patterns) {
      const detected = this.checkPattern(parseResult, pattern);
      if (detected) {
        issues.push(...detected);
      }
    }
    
    return issues;
  }
  
  detectAll(parseResults: ParseResult[]): Map<string, Issue[]> {
    const results = new Map<string, Issue[]>();
    for (const result of parseResults) {
      results.set(result.file, this.detect(result));
    }
    return results;
  }
  
  getPatterns(): AntiPattern[] {
    return [...this.patterns];
  }
  
  addPattern(pattern: AntiPattern): void {
    this.patterns.push(pattern);
  }
  
  private initializePatterns(): AntiPattern[] {
    return [
      // God Class
      {
        type: 'god_class',
        name: 'God Class',
        description: 'Class with too many responsibilities, methods, or properties',
        severity: 'high',
        detection: {
          threshold: { methods: 20, properties: 15, lines: 500 },
          custom: (result) => result.classes.some(c => 
            c.methods.length > 20 || c.properties.length > 15 || (c.endLine - c.line) > 500
          )
        },
        refactoring: {
          pattern: 'Extract Class',
          description: 'Split the class into multiple cohesive classes',
          steps: [
            'Identify cohesive groups of methods/properties',
            'Create new classes for each group',
            'Move related methods/properties',
            'Update dependencies',
            'Add delegation or composition'
          ],
          automated: false
        }
      },
      
      // God Method
      {
        type: 'god_method',
        name: 'God Method / Long Method',
        description: 'Method with excessive complexity or length',
        severity: 'high',
        detection: {
          threshold: { complexity: 15, lines: 50, params: 5 },
          custom: (result) => 
            result.functions.some(f => f.complexity > 15) ||
            result.classes.some(c => c.methods.some(m => m.complexity > 15))
        },
        refactoring: {
          pattern: 'Extract Method',
          description: 'Break down the method into smaller, focused methods',
          steps: [
            'Identify logical sections within the method',
            'Extract each section into a private method',
            'Replace inline code with method calls',
            'Ensure extracted methods have single responsibilities'
          ],
          automated: true,
          codemodId: 'extract-method'
        }
      },
      
      // Circular Dependency
      {
        type: 'circular_dependency',
        name: 'Circular Dependency',
        description: 'Two or more modules depend on each other directly or indirectly',
        severity: 'critical',
        detection: {
          custom: (result) => false // Detected at project level via dependency graph
        },
        refactoring: {
          pattern: 'Break Circular Dependency',
          description: 'Introduce interface, mediator, or shared module',
          steps: [
            'Identify the cycle in dependency graph',
            'Extract common dependencies to shared module',
            'Introduce interfaces to break direct dependencies',
            'Use dependency injection',
            'Consider event-driven architecture'
          ],
          automated: false
        }
      },
      
      // Layer Violation
      {
        type: 'layer_violation',
        name: 'Layer Violation',
        description: 'Code bypasses architectural layers (e.g., controller accessing database directly)',
        severity: 'high',
        detection: {
          threshold: { layerCount: 4 },
          custom: (result) => this.detectLayerViolation(result)
        },
        refactoring: {
          pattern: 'Enforce Layer Boundaries',
          description: 'Route calls through proper layer hierarchy',
          steps: [
            'Identify the violating call path',
            'Create missing service/repository layer',
            'Move logic to appropriate layer',
            'Add architectural tests to prevent regression'
          ],
          automated: false
        }
      },
      
      // Shotgun Surgery
      {
        type: 'shotgun_surgery',
        name: 'Shotgun Surgery',
        description: 'Single change requires modifications across many files',
        severity: 'medium',
        detection: {
          threshold: { filesPerChange: 5 },
          custom: (result) => false // Requires change history analysis
        },
        refactoring: {
          pattern: 'Consolidate Related Logic',
          description: 'Group related functionality that changes together',
          steps: [
            'Analyze change history for co-modified files',
            'Identify common abstractions',
            'Create shared modules/services',
            'Consolidate duplicated logic'
          ],
          automated: false
        }
      },
      
      // Feature Envy
      {
        type: 'feature_envy',
        name: 'Feature Envy',
        description: 'Method uses more features of another class than its own',
        severity: 'medium',
        detection: {
          custom: (result) => this.detectFeatureEnvy(result)
        },
        refactoring: {
          pattern: 'Move Method',
          description: 'Move method to the class it envies',
          steps: [
            'Identify the target class',
            'Move method to target class',
            'Update callers to use target class',
            'Consider if original class still needs delegation'
          ],
          automated: true,
          codemodId: 'move-method'
        }
      },
      
      // Data Clump
      {
        type: 'data_clump',
        name: 'Data Clump',
        description: 'Same group of parameters passed together repeatedly',
        severity: 'medium',
        detection: {
          threshold: { parameterGroups: 3, occurrences: 3 },
          custom: (result) => this.detectDataClumps(result)
        },
        refactoring: {
          pattern: 'Extract Parameter Object',
          description: 'Group related parameters into a single object',
          steps: [
            'Identify the clumped parameters',
            'Create a class/struct for the group',
            'Replace parameter lists with the object',
            'Add validation/business logic to the object'
          ],
          automated: true,
          codemodId: 'extract-parameter-object'
        }
      },
      
      // Long Parameter List
      {
        type: 'long_parameter_list',
        name: 'Long Parameter List',
        description: 'Function with too many parameters',
        severity: 'medium',
        detection: {
          threshold: { params: 5 },
          custom: (result) => 
            result.functions.some(f => f.params.length > 5) ||
            result.classes.some(c => c.methods.some(m => m.params.length > 5))
        },
        refactoring: {
          pattern: 'Introduce Parameter Object / Builder',
          description: 'Replace parameter list with object or builder pattern',
          steps: [
            'Group related parameters',
            'Create parameter object or builder',
            'Update function signature',
            'Migrate callers'
          ],
          automated: true,
          codemodId: 'parameter-object'
        }
      },
      
      // Dead Code
      {
        type: 'dead_code',
        name: 'Dead Code',
        description: 'Code that is never executed or has no effect',
        severity: 'low',
        detection: {
          custom: (result) => this.detectDeadCode(result)
        },
        refactoring: {
          pattern: 'Remove Dead Code',
          description: 'Safely remove unreachable/unused code',
          steps: [
            'Verify code is truly unreachable',
            'Check for reflection/dynamic usage',
            'Remove code',
            'Run tests to confirm'
          ],
          automated: true,
          codemodId: 'remove-dead-code'
        }
      },
      
      // Duplicate Code
      {
        type: 'duplicate_code',
        name: 'Duplicate Code',
        description: 'Identical or similar code appears in multiple places',
        severity: 'medium',
        detection: {
          threshold: { similarity: 0.8, minLines: 6 },
          custom: (result) => false // Requires cross-file comparison
        },
        refactoring: {
          pattern: 'Extract Common Code',
          description: 'Extract duplicated code into shared function/module',
          steps: [
            'Identify duplicate blocks',
            'Extract into common utility/function',
            'Replace duplicates with calls',
            'Add tests for shared code'
          ],
          automated: true,
          codemodId: 'extract-duplicate'
        }
      },
      
      // Inappropriate Intimacy
      {
        type: 'inappropriate_intimacy',
        name: 'Inappropriate Intimacy',
        description: 'Classes that are too tightly coupled, accessing private members',
        severity: 'medium',
        detection: {
          custom: (result) => this.detectInappropriateIntimacy(result)
        },
        refactoring: {
          pattern: 'Reduce Coupling',
          description: 'Use interfaces and dependency injection',
          steps: [
            'Identify tight coupling points',
            'Introduce interfaces',
            'Use dependency injection',
            'Apply Law of Demeter'
          ],
          automated: false
        }
      },
      
      // Refused Bequest
      {
        type: 'refused_bequest',
        name: 'Refused Bequest',
        description: 'Subclass uses only a small portion of inherited interface',
        severity: 'low',
        detection: {
          custom: (result) => this.detectRefusedBequest(result)
        },
        refactoring: {
          pattern: 'Replace Inheritance with Composition',
          description: 'Use composition instead of inheritance',
          steps: [
            'Identify unused inherited members',
            'Extract used functionality to interface',
            'Implement interface in new class',
            'Use composition in subclass'
          ],
          automated: false
        }
      },
      
      // Speculative Generality
      {
        type: 'speculative_generality',
        name: 'Speculative Generality',
        description: 'Code designed for future needs that never materialize',
        severity: 'low',
        detection: {
          custom: (result) => this.detectSpeculativeGenerality(result)
        },
        refactoring: {
          pattern: 'YAGNI - Remove Unused Abstraction',
          description: 'Remove unnecessary abstraction layers',
          steps: [
            'Identify unused generic parameters',
            'Remove unused abstract methods',
            'Inline single-implementation interfaces',
            'Simplify to concrete types'
          ],
          automated: false
        }
      },
      
      // Temporary Field
      {
        type: 'temporary_field',
        name: 'Temporary Field',
        description: 'Field set only in certain circumstances, not part of object essence',
        severity: 'low',
        detection: {
          custom: (result) => this.detectTemporaryField(result)
        },
        refactoring: {
          pattern: 'Extract Class / Introduce Null Object',
          description: 'Move temporary fields to separate object or use null object',
          steps: [
            'Identify conditional fields',
            'Extract to separate class',
            'Use null object pattern for optional state',
            'Ensure object is always in valid state'
          ],
          automated: false
        }
      },
      
      // Switch Statements / Complex Conditionals
      {
        type: 'switch_statements',
        name: 'Complex Switch/Conditional',
        description: 'Repeated switch statements on same type, violating Open/Closed principle',
        severity: 'medium',
        detection: {
          custom: (result) => this.detectSwitchStatements(result)
        },
        refactoring: {
          pattern: 'Replace Conditional with Polymorphism',
          description: 'Use polymorphism instead of type-based conditionals',
          steps: [
            'Identify the type being switched on',
            'Create interface/base class',
            'Implement subtypes for each case',
            'Replace switch with polymorphic call'
          ],
          automated: false
        }
      }
    ];
  }
  
  private checkPattern(result: ParseResult, pattern: AntiPattern): Issue[] {
    const issues: Issue[] = [];
    
    if (pattern.detection.custom) {
      if (pattern.detection.custom(result)) {
        issues.push(this.createIssue(result, pattern));
      }
    }
    
    if (pattern.detection.threshold) {
      const thresholdIssues = this.checkThresholds(result, pattern);
      issues.push(...thresholdIssues);
    }
    
    return issues;
  }
  
  private checkThresholds(result: ParseResult, pattern: AntiPattern): Issue[] {
    const issues: Issue[] = [];
    const thresholds = pattern.detection.threshold!;
    
    switch (pattern.type) {
      case 'god_class':
        for (const cls of result.classes) {
          if (thresholds.methods && cls.methods.length > thresholds.methods) {
            issues.push(this.createClassIssue(result, cls, pattern, 
              `Class has ${cls.methods.length} methods (threshold: ${thresholds.methods})`));
          }
          if (thresholds.properties && cls.properties.length > thresholds.properties) {
            issues.push(this.createClassIssue(result, cls, pattern,
              `Class has ${cls.properties.length} properties (threshold: ${thresholds.properties})`));
          }
        }
        break;
        
      case 'god_method':
        for (const func of result.functions) {
          if (thresholds.complexity && func.complexity > thresholds.complexity) {
            issues.push(this.createFunctionIssue(result, func, pattern,
              `Function complexity ${func.complexity} (threshold: ${thresholds.complexity})`));
          }
        }
        for (const cls of result.classes) {
          for (const method of cls.methods) {
            if (thresholds.complexity && method.complexity > thresholds.complexity) {
              issues.push(this.createMethodIssue(result, cls, method, pattern,
                `Method complexity ${method.complexity} (threshold: ${thresholds.complexity})`));
            }
          }
        }
        break;
        
      case 'long_parameter_list':
        for (const func of result.functions) {
          if (thresholds.params && func.params.length > thresholds.params) {
            issues.push(this.createFunctionIssue(result, func, pattern,
              `Function has ${func.params.length} parameters (threshold: ${thresholds.params})`));
          }
        }
        break;
    }
    
    return issues;
  }
  
  private createIssue(result: ParseResult, pattern: AntiPattern): Issue {
    return {
      type: 'anti_pattern',
      severity: pattern.severity,
      message: `${pattern.name}: ${pattern.description}`,
      location: { file: result.file, line: 1, column: 1 },
      suggestion: pattern.refactoring.description,
      ruleId: `AP-${pattern.type.toUpperCase()}`
    };
  }
  
  private createClassIssue(result: ParseResult, cls: any, pattern: AntiPattern, message: string): Issue {
    return {
      type: 'anti_pattern',
      severity: pattern.severity,
      message: `${pattern.name} (${cls.name}): ${message}`,
      location: { file: result.file, line: cls.line, column: 1 },
      suggestion: pattern.refactoring.description,
      ruleId: `AP-${pattern.type.toUpperCase()}`
    };
  }
  
  private createFunctionIssue(result: ParseResult, func: any, pattern: AntiPattern, message: string): Issue {
    return {
      type: 'anti_pattern',
      severity: pattern.severity,
      message: `${pattern.name} (${func.name}): ${message}`,
      location: { file: result.file, line: func.line, column: 1 },
      suggestion: pattern.refactoring.description,
      ruleId: `AP-${pattern.type.toUpperCase()}`
    };
  }
  
  private createMethodIssue(result: ParseResult, cls: any, method: any, pattern: AntiPattern, message: string): Issue {
    return {
      type: 'anti_pattern',
      severity: pattern.severity,
      message: `${pattern.name} (${cls.name}.${method.name}): ${message}`,
      location: { file: result.file, line: method.line, column: 1 },
      suggestion: pattern.refactoring.description,
      ruleId: `AP-${pattern.type.toUpperCase()}`
    };
  }
  
  // Detection implementations
  private detectLayerViolation(result: ParseResult): boolean {
    // Check for direct database access in controllers, etc.
    const content = this.getContent(result);
    const layerPatterns = {
      controller: ['Repository', 'DAO', 'Database', 'EntityManager', 'Session'],
      service: ['Controller', 'HttpRequest', 'Response'],
      domain: ['Repository', 'DAO', 'Controller']
    };
    
    const fileName = result.file.toLowerCase();
    for (const [layer, forbidden] of Object.entries(layerPatterns)) {
      if (fileName.includes(layer)) {
        for (const f of forbidden) {
          if (content.includes(f)) return true;
        }
      }
    }
    return false;
  }
  
  private detectFeatureEnvy(result: ParseResult): boolean {
    // Simplified: check if method calls more methods on other objects than its own
    for (const cls of result.classes) {
      for (const method of cls.methods) {
        const externalCalls = method.complexity; // Placeholder
        const internalCalls = 1; // Placeholder
        if (externalCalls > internalCalls * 2) return true;
      }
    }
    return false;
  }
  
  private detectDataClumps(result: ParseResult): boolean {
    // Look for repeated parameter groups
    const paramGroups = new Map<string, number>();
    
    for (const func of result.functions) {
      if (func.params.length >= 3) {
        const key = func.params.map(p => p.type || p.name).join(',');
        paramGroups.set(key, (paramGroups.get(key) || 0) + 1);
      }
    }
    
    for (const [, count] of paramGroups) {
      if (count >= 3) return true;
    }
    return false;
  }
  
  private detectDeadCode(result: ParseResult): boolean {
    // Check for unused private methods, unreachable code after return/throw
    for (const cls of result.classes) {
      for (const method of cls.methods) {
        if (method.isPrivate && method.name.startsWith('_')) {
          // Could be dead - would need call graph analysis
        }
      }
    }
    return false;
  }
  
  private detectInappropriateIntimacy(result: ParseResult): boolean {
    // Check for direct access to private fields of other classes
    return false; // Requires cross-class analysis
  }
  
  private detectRefusedBequest(result: ParseResult): boolean {
    for (const cls of result.classes) {
      if (cls.extends) {
        // Check how many parent methods are overridden vs used
        const overridden = cls.methods.filter(m => 
          // Would need parent class info
          false
        ).length;
        if (overridden < 2 && cls.methods.length > 5) return true;
      }
    }
    return false;
  }
  
  private detectSpeculativeGenerality(result: ParseResult): boolean {
    // Look for unused generic parameters, single-implementation interfaces
    for (const iface of result.interfaces) {
      // Would need project-wide analysis
    }
    return false;
  }
  
  private detectTemporaryField(result: ParseResult): boolean {
    // Fields only set in some methods, not in constructor
    for (const cls of result.classes) {
      const initializedInConstructor = cls.properties.filter(p => 
        // Would need constructor analysis
        false
      ).length;
      if (cls.properties.length > initializedInConstructor && initializedInConstructor > 0) {
        return true;
      }
    }
    return false;
  }
  
  private detectSwitchStatements(result: ParseResult): boolean {
    const content = this.getContent(result);
    // Count switch statements on same variable/type
    const switchMatches = content.match(/switch\s*\([^)]+\)/g) || [];
    return switchMatches.length > 2;
  }
  
  private getContent(result: ParseResult): string {
    // In production, read from file
    return '';
  }
}