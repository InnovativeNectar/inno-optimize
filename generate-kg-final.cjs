#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = '/root/projects/inno-optimize';
const INTERMEDIATE_DIR = path.join(PROJECT_ROOT, '.ua', 'intermediate');

// Load the scan results
const scanResult = JSON.parse(fs.readFileSync(path.join(INTERMEDIATE_DIR, 'scan-result.json'), 'utf8'));
const batches = JSON.parse(fs.readFileSync(path.join(INTERMEDIATE_DIR, 'batches.json'), 'utf8'));

console.log('Generating knowledge graph from scan results...');
console.log(`Scanned ${scanResult.files.length} files`);
console.log(`Created ${batches.batches.length} batches`);

// Generate basic nodes from scan results
const nodes = [];
const edges = [];

// Track file nodes for edge creation - map by path and also by basename
const fileNodes = new Map();
const fileNodesByBase = new Map();

scanResult.files.forEach(file => {
  const nodeId = `file:${file.path}`;
  fileNodes.set(file.path, nodeId);
  
  // Also index by basename without extension for matching
  const base = path.basename(file.path, path.extname(file.path));
  if (!fileNodesByBase.has(base)) {
    fileNodesByBase.set(base, []);
  }
  fileNodesByBase.get(base).push(nodeId);
  
  const node = {
    id: nodeId,
    type: file.fileCategory === 'code' ? 'file' : file.fileCategory,
    name: path.basename(file.path),
    filePath: file.path,
    summary: `${file.language} file, ${file.sizeLines} lines`,
    tags: [file.language, file.fileCategory],
    language: file.language,
    sizeLines: file.sizeLines
  };
  
  nodes.push(node);
});

// Helper to resolve import path to target file
function resolveImport(sourceFile, importPath) {
  // Skip external imports
  if (!importPath.startsWith('.')) {
    return null;
  }
  
  const sourceDir = path.dirname(sourceFile);
  let resolvedPath;
  
  try {
    // Resolve the relative import
    resolvedPath = path.resolve(sourceDir, importPath);
    
    // Try with various extensions
    const extensions = ['.ts', '.js', '.mjs', '.cjs', '/index.ts', '/index.js'];
    for (const ext of extensions) {
      const fullPath = resolvedPath + ext;
      const relPath = path.relative(PROJECT_ROOT, fullPath);
      if (fileNodes.has(relPath)) {
        return fileNodes.get(relPath);
      }
    }
    
    // Try without extension
    const relPath = path.relative(PROJECT_ROOT, resolvedPath);
    if (fileNodes.has(relPath)) {
      return fileNodes.get(relPath);
    }
    
    // Try with .ts extension on the resolved path
    const withTs = resolvedPath + '.ts';
    const relWithTs = path.relative(PROJECT_ROOT, withTs);
    if (fileNodes.has(relWithTs)) {
      return fileNodes.get(relWithTs);
    }
    
  } catch (e) {
    // Ignore resolution errors
  }
  
  // Fallback: try to match by basename
  const importBase = path.basename(importPath);
  if (fileNodesByBase.has(importBase)) {
    const candidates = fileNodesByBase.get(importBase);
    // Prefer files in the same package
    const sourcePkg = sourceFile.split('/')[1]; // packages/xxx/
    for (const cand of candidates) {
      if (cand.includes(sourcePkg)) {
        return cand;
      }
    }
    return candidates[0];
  }
  
  return null;
}

// Add import edges from batches
let importEdges = 0;
batches.batches.forEach(batch => {
  batch.files.forEach(file => {
    const sourceId = `file:${file.path}`;
    const imports = batch.batchImportData[file.path] || [];
    
    imports.forEach(imp => {
      const targetId = resolveImport(file.path, imp);
      
      if (targetId && targetId !== sourceId) {
        edges.push({
          source: sourceId,
          target: targetId,
          type: 'imports',
          weight: 0.7
        });
        importEdges++;
      }
    });
  });
});

console.log(`Resolved ${importEdges} import edges`);

// Add exports edges (from exportsByPath in batches)
let exportEdges = 0;
Object.entries(batches.exportsByPath).forEach(([filePath, exports]) => {
  const sourceId = `file:${filePath}`;
  exports.forEach(exp => {
    // Create a module/concept node for each export
    const exportId = `module:${exp}`;
    nodes.push({
      id: exportId,
      type: 'module',
      name: exp,
      summary: `Exported from ${filePath}`,
      tags: ['export', 'typescript']
    });
    
    edges.push({
      source: sourceId,
      target: exportId,
      type: 'exports',
      weight: 0.8
    });
    exportEdges++;
  });
});

console.log(`Created ${exportEdges} export edges`);

// Create basic layers
const layers = [
  {
    id: 'layer:core',
    name: 'Core',
    description: 'Core business logic and domain models',
    nodeIds: []
  },
  {
    id: 'layer:infrastructure',
    name: 'Infrastructure',
    description: 'Infrastructure, configuration, and deployment',
    nodeIds: []
  },
  {
    id: 'layer:interface',
    name: 'Interface',
    description: 'API endpoints, UI components, and external interfaces',
    nodeIds: []
  },
  {
    id: 'layer:testing',
    name: 'Testing',
    description: 'Test files and test utilities',
    nodeIds: []
  },
  {
    id: 'layer:documentation',
    name: 'Documentation',
    description: 'Documentation and guides',
    nodeIds: []
  }
];

// Assign nodes to layers based on fileCategory
nodes.forEach(node => {
  switch (node.type) {
    case 'code':
    case 'file':
      if (node.filePath.includes('__tests__') || node.filePath.includes('.test.')) {
        layers[3].nodeIds.push(node.id);
      } else if (node.filePath.includes('packages/') && (node.filePath.includes('types.ts') || node.filePath.includes('index.ts'))) {
        layers[0].nodeIds.push(node.id);
      } else {
        layers[0].nodeIds.push(node.id);
      }
      break;
    case 'config':
      layers[1].nodeIds.push(node.id);
      break;
    case 'infra':
      layers[1].nodeIds.push(node.id);
      break;
    case 'docs':
      layers[4].nodeIds.push(node.id);
      break;
    case 'test':
      layers[3].nodeIds.push(node.id);
      break;
    default:
      layers[0].nodeIds.push(node.id);
  }
});

// Create a simple tour
const tour = [
  {
    order: 1,
    title: 'Project Overview',
    description: 'inno-optimize is a proactive architecture & intelligence optimization system for business systems, agents, and automation.',
    nodeIds: ['file:README.md']
  },
  {
    order: 2,
    title: 'Core Packages',
    description: 'The core packages provide the foundation: agentdb, mcp-framework, adr-automation, ast-analysis.',
    nodeIds: [
      'file:packages/agentdb/src/index.ts',
      'file:packages/mcp-framework/src/index.ts',
      'file:packages/adr-automation/src/index.ts',
      'file:packages/ast-analysis/src/index.ts'
    ]
  },
  {
    order: 3,
    title: 'Intelligence Layer',
    description: 'The intelligence layer provides SONA, ReasoningBank, MoE Router, and EWC++ consolidation.',
    nodeIds: [
      'file:packages/intelligence/src/index.ts',
      'file:packages/intelligence/src/sona/adapter.ts',
      'file:packages/intelligence/src/reasoningbank/pipeline.ts',
      'file:packages/intelligence/src/moe/router.ts',
      'file:packages/intelligence/src/ewc/consolidator.ts'
    ]
  },
  {
    order: 4,
    title: 'Coordination Layer',
    description: 'The coordination layer provides HiveMind Swarm, Saga Orchestrator, Pheromone Scheduler, and Business MCP Servers.',
    nodeIds: [
      'file:packages/coordination/src/index.ts',
      'file:packages/coordination/src/swarm/hive-mind.ts',
      'file:packages/coordination/src/saga/orchestrator.ts',
      'file:packages/coordination/src/pheromone/scheduler.ts',
      'file:packages/coordination/src/mcp-business/servers.ts'
    ]
  },
  {
    order: 5,
    title: 'Optimization Layer',
    description: 'The optimization layer provides OAPEL cycles, A/B Testing, Regression Detection, Flywheel Evaluation, and Templates.',
    nodeIds: [
      'file:packages/optimization/src/index.ts',
      'file:packages/optimization/src/oapel/engine.ts',
      'file:packages/optimization/src/abtesting/framework.ts',
      'file:packages/optimization/src/regression/detector.ts',
      'file:packages/optimization/src/flywheel/evaluator.ts',
      'file:packages/optimization/src/templates/manager.ts'
    ]
  }
];

// Build the final knowledge graph
const knowledgeGraph = {
  version: '1.0.0',
  project: {
    name: 'inno-optimize',
    languages: ['typescript', 'yaml', 'json', 'markdown'],
    frameworks: ['node.js', 'pnpm', 'vitest'],
    description: 'Proactive Architecture & Intelligence Optimization System for Business Systems, Agents, and Automation',
    analyzedAt: new Date().toISOString(),
    gitCommitHash: 'f9b72f9'
  },
  nodes,
  edges,
  layers,
  tour
};

// Write the knowledge graph
const outputPath = path.join(PROJECT_ROOT, '.ua', 'knowledge-graph.json');
fs.writeFileSync(outputPath, JSON.stringify(knowledgeGraph, null, 2));
console.log(`Knowledge graph written to ${outputPath}`);
console.log(`Nodes: ${nodes.length}`);
console.log(`Edges: ${edges.length} (imports: ${importEdges}, exports: ${exportEdges})`);
console.log(`Layers: ${layers.length}`);
console.log(`Tour steps: ${tour.length}`);
