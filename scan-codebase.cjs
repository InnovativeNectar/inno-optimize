#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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
      relPath.endsWith('.tsconfig') || relPath.includes('tsconfig.') || relPath === 'package.json') {
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

// Analyze a single file for imports/exports using ruvector hooks ast-analyze
function analyzeFile(filePath) {
  try {
    const result = execSync(`node /root/projects/inno-optimize/node_modules/ruvector/bin/cli.js hooks ast-analyze "${filePath}" --json`, {
      encoding: 'utf8',
      timeout: 10000,
      maxBuffer: 1024 * 1024
    });
    return JSON.parse(result);
  } catch (e) {
    // If analysis fails, return basic info
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').length;
    return {
      symbols: [],
      imports: [],
      exports: [],
      complexity: 0,
      lines
    };
  }
}

// Main scanning function
async function scanCodebase() {
  console.log('Scanning codebase...');
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
      
      const fileInfo = {
        path: relPath,
        absolutePath: filePath,
        fileCategory: category,
        language: language,
        sizeLines: 0,
        sizeBytes: stats.size,
        lastModified: stats.mtime.toISOString()
      };
      
      // Only analyze code files for imports/exports
      if (category === 'code' && (language === 'typescript' || language === 'javascript')) {
        try {
          const analysis = analyzeFile(filePath);
          fileInfo.sizeLines = analysis.lines || 0;
          
          batch.files.push({
            path: relPath,
            imports: analysis.imports || [],
            exports: analysis.exports || [],
            symbols: analysis.symbols || [],
            complexity: analysis.complexity || 0
          });
          
          batch.batchImportData[relPath] = analysis.imports || [];
          
          if (analysis.exports && analysis.exports.length > 0) {
            batches.exportsByPath[relPath] = analysis.exports;
          }
        } catch (e) {
          const content = fs.readFileSync(filePath, 'utf8');
          fileInfo.sizeLines = content.split('\n').length;
          batch.files.push({
            path: relPath,
            imports: [],
            exports: [],
            symbols: [],
            complexity: 0
          });
          batch.batchImportData[relPath] = [];
        }
      } else {
        const content = fs.readFileSync(filePath, 'utf8');
        fileInfo.sizeLines = content.split('\n').length;
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

scanCodebase().catch(console.error);
