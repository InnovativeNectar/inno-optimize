// Codemod: Extract Method
// Usage: npx inno-optimize codemod extract-method --file src/utils.ts --function processData --lines 10-50

import { createCodemod } from '@inno-optimize/mcp-framework';

export const extractMethodCodemod = createCodemod({
  name: 'extract-method',
  description: 'Extract a code block into a new method',
  pattern: /\/\/ EXTRACT_START([\s\S]*?)\/\/ EXTRACT_END/,
  transform: (code, matches) => {
    const extracted = matches[1].trim();
    const methodName = 'extractedMethod';
    
    const method = `
  private ${methodName}(): void {
${extracted.split('\n').map(l => '    ' + l).join('\n')}
  }
`;
    
    // Replace the extracted code with method call
    const replacement = `this.${methodName}();`;
    let result = code.replace(/\/\/ EXTRACT_START[\s\S]*?\/\/ EXTRACT_END/, replacement);
    
    // Insert method before the closing brace of the class
    result = result.replace(/(\s+)(\})/g, (match, indent, brace) => {
      return method + '\n' + match;
    });
    
    return result;
  },
  tier: 2,
  capabilities: ['write']
});

// Codemod: Introduce Parameter Object
export const introduceParameterObjectCodemod = createCodemod({
  name: 'introduce-parameter-object',
  description: 'Replace long parameter list with parameter object',
  pattern: /function\s+(\w+)\s*\(([^)]{80,})\)/,
  transform: (code, matches) => {
    const funcName = matches[1];
    const params = matches[2].split(',').map(p => p.trim());
    
    if (params.length <= 4) return code; // Only for long parameter lists
    
    const paramObjectName = `${funcName}Params`;
    const properties = params.map(p => {
      const [name, type] = p.split(':').map(s => s.trim());
      return `  ${name}: ${type || 'any'};`;
    }).join('\n');
    
    const interfaceDef = `
interface ${paramObjectName} {
${properties}
}
`;
    
    // Replace function signature
    const newSignature = `function ${funcName}(params: ${paramObjectName})`;
    let result = code.replace(
      new RegExp(`function\\s+${funcName}\\s*\\([^)]*\\)`),
      newSignature
    );
    
    // Prepend interface definition
    result = interfaceDef + '\n' + result;
    
    return result;
  },
  tier: 2,
  capabilities: ['write']
});

// Codemod: Replace Conditional with Polymorphism
export const replaceConditionalWithPolymorphismCodemod = createCodemod({
  name: 'replace-conditional-polymorphism',
  description: 'Replace switch/type checks with polymorphic methods',
  pattern: /switch\s*\(\s*(\w+)\s*\)\s*\{([\s\S]*?)\}/g,
  transform: (code, matches) => {
    const variable = matches[1];
    const cases = matches[2];
    
    // Extract case values and bodies
    const casePattern = /case\s+(['"]?)(\w+)\1\s*:([\s\S]*?)(?=case|default|$)/g;
    const extractedCases: Array<{value: string, body: string}> = [];
    let match;
    while ((match = casePattern.exec(cases)) !== null) {
      extractedCases.push({
        value: match[2],
        body: match[3].trim()
      });
    }
    
    if (extractedCases.length === 0) return code;
    
    // Generate interface
    const interfaceName = `${variable.charAt(0).toUpperCase() + variable.slice(1)}Handler`;
    const methods = extractedCases.map(c => 
      `  handle${c.value.charAt(0).toUpperCase() + c.value.slice(1)}(): void;`
    ).join('\n');
    
    const interfaceDef = `
interface ${interfaceName} {
${methods}
}
`;
    
    // Generate implementations
    const implementations = extractedCases.map(c => `
class ${c.value.charAt(0).toUpperCase() + c.value.slice(1)}Handler implements ${interfaceName} {
  handle${c.value.charAt(0).toUpperCase() + c.value.slice(1)}(): void {
${c.body.split('\n').map(l => '    ' + l).join('\n')}
  }
  
  // Other methods with default/no-op implementations
  ${extractedCases.filter(x => x.value !== c.value).map(x => 
    `handle${x.value.charAt(0).toUpperCase() + x.value.slice(1)}(): void { /* no-op */ }`
  ).join('\n  ')}
}
`).join('\n');
    
    // Replace switch with polymorphic call
    const replacement = `
const handler = getHandler(${variable});
handler.${extractedCases[0].value.charAt(0).toUpperCase() + extractedCases[0].value.slice(1)}();
`;
    
    let result = code.replace(
      new RegExp(`switch\\s*\\(\\s*${variable}\\s*\\)\\s*\\{[\\s\\S]*?\\}`),
      replacement
    );
    
    return interfaceDef + '\n' + implementations + '\n' + result;
  },
  tier: 3,
  capabilities: ['write']
});

export default [
  extractMethodCodemod,
  introduceParameterObjectCodemod,
  replaceConditionalWithPolymorphismCodemod
];