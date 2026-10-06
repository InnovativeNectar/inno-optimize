#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = '/root/projects/inno-optimize';
const PACKAGES_DIR = path.join(PROJECT_ROOT, 'packages');
const INTERMEDIATE_DIR = path.join(PROJECT_ROOT, '.ua', 'intermediate');

// File categories
function getFileCategory(filePath) {
  const relPath = path.relative(PROJECT_ROOT, filePath);
  if (relPath.includes('__tests__') || relPath.includes('.test.') || relPath.includes('.spec.')) {
    return 'test';
  }
  if (relPath.endsWith('.json') || relPath.endsWith('.yaml') || relPath.endsWith('.yml') || 
      relPath.endsWith('.tsconfig') || relPath.includes('tsconfig.') || relPath === 'package.json' || relPath.endsWith('.js.map') || relPath.endsWith('.d.ts') || relPath.endsWith('.d.ts.map')) {
    return 'config';
  }
  if (relPath.includes('.github/') || relPath.includes('docker') || relPath.includes('Dockerfile') ||
      relPath.includes('.yml') && relPath.includes('workflow')) {
    return 'infra';
  }
  if (relPath.endsWith('.md') || relPath.endsWith('.txt') || relPath.includes('README') || relPath.includes('LICENSE')) {
    return 'docs';
  }
  if (relPath.endsWith('.ts') || relPath.endsWith('.js') || relPath.endsWith('.mjs') || relPath.endsWith('.cjs')) {
    return 'code';
  }
  return 'other';
}

function getLanguage(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.ts': return 'typescript';
    case '.js': return 'javascript';
    case '.mjs': return 'javascript';
    case '.cjs': return 'javascript';
    case '.json': return 'json';
    case '.yaml':
    case '.yml': return 'yaml';
    case '.md': return 'markdown';
    case '.txt': return 'text';
    default: return 'unknown';
  }
}

// Get all source files (excluding node_modules, dist, .git, etc.)
function getSourceFiles(dir) {
  const files = [];
  const ignoreDirs = ['node_modules', 'dist', '.git', '.turbo', 'coverage', '.ua'];
  
  function walk(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (ignoreDirs.includes(entry.name)) continue;
      
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  }
  
  walk(dir);
  return files;
}

// Extract imports and exports using regex (fast but less accurate than AST)
function extractImportsExports(content, filePath) {
  const imports = [];
  const exports = [];
  const lines = content.split('\n');
  
  // Simple regex patterns for imports
  const importPatterns = [
    /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g,
    /import\s+['"]([^'"]+)['"]/g,
    /require\(['"]([^'"]+)['"]\)/g,
    /import\(['"]([^'"]+)['"]\)/g,
  ];
  
  // Simple regex patterns for exports
  const exportPatterns = [
    /export\s+(?:const|let|var|function|class|interface|type|enum)\s+(\w+)/g,
    /export\s+default\s+(\w+)/g,
    /export\s+\{([^}]+)\}/g,
    /export\s+\*\s+from\s+['"]([^'"]+)['"]/g,
  ];
  
  for (const line of lines) {
    // Extract imports
    for (const pattern of importPatterns) {
      let match;
      while ((match = pattern.exec(line)) !== null) {
        const imp = match[1];
        // Only include relative imports (internal)
        if (imp.startsWith('.') || imp.startsWith('/')) {
          imports.push(imp);
        }
      }
    }
    
    // Extract exports
    for (const pattern of exportPatterns) {
      let match;
      while ((match = pattern.exec(line)) !== null) {
        if (match[1]) {
          // Handle multiple exports in braces
          const expList = match[1].split(',').map(e => e.trim()).filter(e => e);
          exports.push(...expList);
        } else if (match[0].includes('default')) {
          const defaultMatch = line.match(/export\s+default\s+(\w+)/);
          if (defaultMatch) exports.push(defaultMatch[1]);
        }
      }
    }
  }
  
  // Also get default export from export default ...
  const defaultExportMatch = content.match(/export\s+default\s+(?:class|function|const|let|var)?\s*(\w+)/);
  if (defaultExportMatch && defaultExportMatch[1]) {
    exports.push(defaultExportMatch[1]);
  }
  
  return { imports: [...new Set(imports)], exports: [...new Set(exports)] };
}

// Main scanning function
function scanCodebase() {
  console.log('Scanning codebase (fast mode)...');
  const sourceFiles = getSourceFiles(PACKAGES_DIR);
  console.log(`Found ${sourceFiles.length} source files`);
  
  const scanResults = {
    files: [],
    totalFiles: sourceFiles.length,
    scannedAt: new Date().toISOString()
  };
  
  const batches = {
    batches: [],
    exportsByPath: {}
  };
  
  // Process files in batches of 50
  const BATCH_SIZE = 50;
  for (let i = 0; i < sourceFiles.length; i += BATCH_SIZE) {
    const batchFiles = sourceFiles.slice(i, i + BATCH_SIZE);
    const batch = {
      files: [],
      batchImportData: {}
    };
    
    console.log(`Processing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(sourceFiles.length/BATCH_SIZE)} (${batchFiles.length} files)`);
    
    for (const filePath of batchFiles) {
      const relPath = path.relative(PROJECT_ROOT, filePath);
      const stats = fs.statSync(filePath);
      const category = getFileCategory(filePath);
      const language = getLanguage(filePath);
      
      const content = fs.readFileSync(filePath, 'utf8');
      const sizeLines = content.split('\n').length;
      
      const fileInfo = {
        path: relPath,
        absolutePath: filePath,
        fileCategory: category,
        language: language,
        sizeLines: sizeLines,
        sizeBytes: stats.size,
        lastModified: stats.mtime.toISOString()
      };
      
      // Only analyze code files for imports/exports
      if (category === 'code' && (language === 'typescript' || language === 'javascript')) {
        const { imports, exports } = extractImportsExports(content, filePath);
        
        batch.files.push({
          path: relPath,
          imports: imports,
          exports: exports,
          symbols: [], // Not extracting symbols in fast mode
          complexity: 0
        });
        
        batch.batchImportData[relPath] = imports;
        
        if (exports.length > 0) {
          batches.exportsByPath[relPath] = exports;
        }
      } else {
        batch.files.push({
          path: relPath,
          imports: [],
          exports: [],
          symbols: [],
          complexity: 0
        });
        batch.batchImportData[relPath] = [];
      }
      
      scanResults.files.push(fileInfo);
    }
    
    batches.batches.push(batch);
  }
  
  // Write intermediate files
  fs.writeFileSync(
    path.join(INTERMEDIATE_DIR, 'scan-result.json'),
    JSON.stringify(scanResults, null, 2)
  );
  
  fs.writeFileSync(
    path.join(INTERMEDIATE_DIR, 'batches.json'),
    JSON.stringify(batches, null, 2)
  );
  
  console.log(`Scan complete!`);
  console.log(`  Files scanned: ${scanResults.files.length}`);
  console.log(`  Batches created: ${batches.batches.length}`);
  console.log(`  Export entries: ${Object.keys(batches.exportsByPath).length}`);
  console.log(`  Intermediate files written to ${INTERMEDIATE_DIR}`);
}

scanCodebase();
