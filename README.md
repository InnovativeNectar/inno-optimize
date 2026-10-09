# inno-optimize

**Proactive Architecture & Intelligence Optimization System for Business Systems, Agents, and Automation**

[![CI/CD](https://github.com/InnovativeNectar/inno-optimize/workflows/CI%2FCD/badge.svg)](https://github.com/InnovativeNectar/inno-optimize/actions)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-135%2F135%20passing-brightgreen.svg)](#test-status)

> **New here?** See **[OPERATIONS.md](OPERATIONS.md)** for the full operation manual: install, configure, run, test, benchmark, and release.

---

## Overview

inno-optimize is a self-evolving architecture optimization system that continuously analyzes codebases, identifies improvement opportunities, applies best practices automatically, and learns from every interaction. Built for business systems, agent orchestration, and workflow automation.

It ships as **9 npm packages** plus a ready-to-run **stdio MCP server** (`inno-optimize-mcp`) that any MCP-compatible client (Claude Code, opencode, Cursor, …) can use out of the box.

### Key Capabilities

| Layer | Description | Performance |
|-------|-------------|-------------|
| **Analysis** | Multi-language AST parsing (7 languages), architecture scoring, anti-pattern detection | <5s for 10k files |
| **Planning** | ADR auto-generation, decision tracking, CI/CD gates | Automatic |
| **Intelligence** | AgentDB/HNSW vector memory, SONA adapter, ReasoningBank, EWC++ | HNSW p99 0.31ms measured |
| **Coordination** | Hive-Mind swarm, saga orchestration, pheromone scheduling, business MCP server registry | In-process |
| **Integration** | stdio MCP server with 12 tools, MCP server registry, plugin architecture | Roundtrip verified |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    INNO-OPTIMIZE CORE                       │
├─────────────────────────────────────────────────────────────┤
│  Analysis  │  Planning  │  Execution  │  Intelligence      │
│  Engine    │  Engine    │  Engine     │  Layer             │
│            │            │             │                    │
│ • Tree-    │ • ADR      │ • Tier 1:   │ • AgentDB + HNSW   │
│   sitter   │   Auto-gen │   Codemods  │ • SONA Adapter     │
│ • 4-dim    │ • Semantic │ • Tier 2/3: │ • MoE Router       │
│   scoring  │   anchors  │   LLM       │ • ReasoningBank    │
│ • 15 anti- │ • CI/CD    │ • Verify/   │ • EWC++            │
│   patterns │   gates    │   Rollback  │                    │
├─────────────────────────────────────────────────────────────┤
│  Coordination Layer          │  Integration Layer           │
│                              │                              │
│ • Hive-Mind Swarm            │ • stdio MCP Server (12 tools)│
│ • Pheromone Scheduling       │ • Business Connectors        │
│ • Saga Orchestrator          │ • Plugin Architecture        │
│ • CRDT Memory Sync           │ • Dynamic Tool Routing       │
└─────────────────────────────────────────────────────────────┘
```

---

## Build Status

**Current Status**: 9/9 packages building successfully (`tsc --build --force` clean, `tsc --noEmit` clean)

| Package | Status | Description |
|---------|--------|-------------|
| `@inno-optimize/agentdb` | ✅ **PASS** | Vector database with HNSW, quantization, 3-tier memory |
| `@inno-optimize/adr-automation` | ✅ **PASS** | ADR generation, tracking, CI/CD integration |
| `@inno-optimize/ast-analysis` | ✅ **PASS** | Multi-language parser, scorer, anti-pattern detector |
| `@inno-optimize/business-agent-factory` | ✅ **PASS** | Business agent factory with 35 templates / 11 departments |
| `@inno-optimize/coordination` | ✅ **PASS** | Hive-Mind Swarm, Saga Orchestrator, Pheromone Scheduler |
| `@inno-optimize/intelligence` | ✅ **PASS** | SONA, ReasoningBank, MoE Router, EWC++ |
| `@inno-optimize/mcp-framework` | ✅ **PASS** | MCP server registry, progressive discovery, tool routing |
| `@inno-optimize/optimization` | ✅ **PASS** | OAPEL Cycles, A/B Testing, Regression Detection, Flywheel |
| `inno-optimize-mcp` | ✅ **PASS** | Stdio MCP server exposing the platform as 12 tools |

### Test Status

**Current Status**: 135/135 tests passing across 10 test files (verified with an `LD_PRELOAD` malloc guard; no single allocation >512MB)

| Suite | Tests | Status |
|-------|-------|--------|
| `agentdb` (FastStore, HNSW, quantization) | 9 | ✅ |
| `adr-automation` (generator, tracker, CI gate) | 13 | ✅ |
| `ast-analysis` (parser ×7 languages, scorer, diff) | 17 | ✅ |
| `business-agent-factory` (templates, factory, execution) | 15 | ✅ |
| `coordination` (swarm, saga, pheromone + integration) | 27 | ✅ |
| `intelligence` (SONA, ReasoningBank, MoE, EWC++) | 13 | ✅ |
| `mcp-framework` (server registry, routing) | 9 | ✅ |
| `optimization` (OAPEL, A/B, regression, flywheel) | 20 | ✅ |
| `inno-mcp` (MCP server end-to-end over InMemoryTransport) | 12 | ✅ |

Lint: `eslint` runs with **0 errors** (warnings tracked as cleanup debt). Type check: zero errors under `strict` + `exactOptionalPropertyTypes`.

> **Note**: `hnswlib` allocations are bounded by `hnswConfig.maxElements`. Passing `path: ':memory:'` forces a full 10M-element (~4.4GB) allocation regardless of `maxElements`; `FastStore` now maps that to a unique temp file so tests cannot trigger the OOM.

---

## Quick Start

### Installation

```bash
# Clone and install
git clone https://github.com/InnovativeNectar/inno-optimize.git
cd inno-optimize
npm install

# Build all packages (9/9 pass)
npm run build

# Run tests (135/135)
npm run test

# Run benchmarks (writes benchmark-results.json)
npm run benchmark

# Lint + typecheck
npm run lint && npm run typecheck
```

### Run the MCP server

The fastest way to use inno-optimize from any AI coding agent is the stdio MCP server:

```bash
# One-shot (no install required)
npx -y inno-optimize-mcp

# Or from a local build
node packages/inno-mcp/dist/bin/inno-mcp.js
```

**Claude Code**

```bash
claude mcp add inno-optimize -- npx -y inno-optimize-mcp
```

**opencode** (`.config/opencode/opencode.json` or project `opencode.json`)

```json
{
  "mcp": {
    "inno-optimize": {
      "type": "local",
      "command": ["npx", "-y", "inno-optimize-mcp"],
      "environment": { "INNO_MEMORY_PATH": "./.inno-optimize/memory.db" }
    }
  }
}
```

**Any other MCP client** (generic stdio config)

```json
{
  "mcpServers": {
    "inno-optimize": {
      "command": "npx",
      "args": ["-y", "inno-optimize-mcp"],
      "env": { "INNO_MEMORY_PATH": "./.inno-optimize/memory.db" }
    }
  }
}
```

### MCP tools (12)

| Tool | Purpose |
|------|---------|
| `memory_store` | Store a text entry in persistent vector memory |
| `memory_search` | Semantic search over stored entries |
| `memory_stats` | Memory store path, dimensions, session writes |
| `intelligence_process_task` | Run SONA adaptation + MoE routing pipeline |
| `ast_analyze` | Parse source (file or inline), metrics + anti-patterns |
| `ast_diff` | Line-level diff of two file versions |
| `adr_generate` | Generate an ADR from an architectural change |
| `business_agent_list_templates` | List the 35 business agent templates |
| `business_agent_create` | Instantiate an agent from a template |
| `business_agent_execute` | Execute a task with a created agent |
| `coordination_servers` | Business MCP server registry (orders, payments, CRM, …) |
| `optimization_templates` | Search built-in optimization templates |

Server options are environment-driven — see [OPERATIONS.md](OPERATIONS.md) for `INNO_MEMORY_PATH`, `INNO_MEMORY_MAX_ELEMENTS`, and `INNO_QUIET`.

---

## Usage (library API)

Every package is usable standalone:

```ts
// Vector memory (AgentDB)
import { FastStore } from '@inno-optimize/agentdb';
const store = new FastStore({ path: ':memory:', dimensions: 384 });
await store.initialize();

// Source analysis (AST)
import { MultiLanguageParser, AntiPatternDetector } from '@inno-optimize/ast-analysis';
const parser = new MultiLanguageParser();
const result = await parser.parseFile('src/app.ts', source);
const issues = new AntiPatternDetector().detect(result);

// Intelligence layer (SONA + MoE + ReasoningBank)
import { IntelligenceLayer } from '@inno-optimize/intelligence';
const intel = new IntelligenceLayer(store);
const { sonaAdaptation, routing } = await intel.processTask({
  id: 'task-1', type: 'refactor', description: 'Extract payment saga',
  constraints: [], acceptanceCriteria: [], mode: 'convergent',
});

// Business agents (35 templates)
import { AgentFactory, createDefaultTemplateManager } from '@inno-optimize/business-agent-factory';
const factory = new AgentFactory(createDefaultTemplateManager());
const agent = await factory.createAgent({ templateId: 'sales-rep' });
const out = await agent.execute('Qualify lead Acme Corp');

// Optimization loops
import { createOptimizationLayer, createDefaultOptimizationConfig } from '@inno-optimize/optimization';
const layer = createOptimizationLayer(createDefaultOptimizationConfig());
```

See [OPERATIONS.md](OPERATIONS.md) for per-package recipes (ADR generation, swarm coordination, MCP registry).

---

## Packages

| Package | Description | Entry Point | Build |
|---------|-------------|-------------|-------|
| `@inno-optimize/agentdb` | Vector database with HNSW, quantization, 3-tier memory | `packages/agentdb` | ✅ |
| `@inno-optimize/mcp-framework` | MCP server registry, progressive discovery, tool routing | `packages/mcp-framework` | ✅ |
| `@inno-optimize/adr-automation` | ADR generation, tracking, CI/CD integration | `packages/adr-automation` | ✅ |
| `@inno-optimize/ast-analysis` | Multi-language parser, scorer, anti-pattern detector | `packages/ast-analysis` | ✅ |
| `@inno-optimize/intelligence` | SONA, ReasoningBank, MoE Router, EWC++ | `packages/intelligence` | ✅ |
| `@inno-optimize/coordination` | Hive-Mind Swarm, Saga Orchestrator, Pheromone Scheduler | `packages/coordination` | ✅ |
| `@inno-optimize/optimization` | OAPEL Cycles, A/B Testing, Regression Detection, Flywheel | `packages/optimization` | ✅ |
| `@inno-optimize/business-agent-factory` | Business agent factory with 35 templates | `packages/business-agent-factory` | ✅ |
| `inno-optimize-mcp` | **Stdio MCP server** (bin: `inno-optimize-mcp`) | `packages/inno-mcp` | ✅ |

All packages are published under Apache-2.0; scoped packages require `--access public` on first publish (see [OPERATIONS.md](OPERATIONS.md#publishing)).

---

## Core Systems

### 1. AgentDB - Vector Database
- **HNSW Index**: 150x-12,500x faster than linear search
- **Quantization**: RaBitQ (1-bit), PQ4/8, Binary - 4-32x memory reduction (recall ~0.92-0.98 measured)
- **3-Tier Memory**: Working (LRU), Episodic (TTL), Semantic (consolidated)
- **Causal Graph**: Event causality tracking with pathfinding

### 2. Analysis Engine
- **Tree-sitter Parsers**: TypeScript, JavaScript, Python, Go, Rust, Java, PHP, Ruby (7 grammars, all parse-verified in CI)
- **4-Dimension Scoring**: Maintainability, Scalability, Security, Performance
- **Anti-Patterns**: 15 patterns (God Class, Circular Dependency, Shotgun Surgery, etc.)
- **Incremental Analysis**: File-watching with delta updates

### 3. Intelligence Layer
- **SONA Adapter**: Fast in-process adaptation loops
- **ReasoningBank**: Experience replay with verdict judgment
- **MoE Router**: Cost-optimal model selection (KRR)
- **EWC++**: Elastic weight consolidation for continual learning

### 4. Coordination Layer
- **Hive-Mind Swarm**: Queen-led hierarchical mesh with Raft/Byzantine consensus
- **Pheromone Scheduler**: EMA-based agent eligibility with warmup & protection
- **Saga Orchestrator**: Distributed transactions with compensation/rollback
- **MCP Business Connectors**: Orders, inventory, payments, CRM registry

### 5. Optimization Loops
- **OAPEL**: Observe → Analyze → Plan → Execute → Learn
- **A/B Testing**: Agenticow COW branches with isolation
- **Regression Detection**: Statistical significance with Benjamini-Hochberg FDR
- **Flywheel**: Promotion gates with hash-pinned anchors

---

## Business Agent Templates

35 pre-built templates across 11 departments:

```ts
import { AgentFactory, createDefaultTemplateManager } from '@inno-optimize/business-agent-factory';

const factory = new AgentFactory(createDefaultTemplateManager());

// List what's available
const templates = createDefaultTemplateManager().list(); // 35 templates

// Create + execute
const agent = await factory.createAgent({ templateId: 'account-manager' });
const result = await agent.execute('Draft renewal email for Acme');
```

| Department | Templates |
|------------|-----------|
| Sales | sales-rep, account-manager, sales-engineer |
| Marketing | content-marketer, seo-specialist, growth-hacker |
| Engineering | backend-dev, frontend-dev, devops, qa-engineer |
| Support | support-agent, technical-support, customer-success |
| Operations | site-reliability, platform-engineer, release-manager |
| Finance | financial-analyst, accountant, treasury-manager |
| HR | recruiter, hr-business-partner, learning-developer |
| Product | product-manager, product-analyst, ux-researcher |
| Legal | corporate-counsel, contract-manager, compliance-officer |
| Security | security-analyst, penetration-tester, compliance-auditor |
| Data | data-engineer, data-scientist, ml-engineer, analytics-engineer |

---

## Benchmarks (measured)

Run `npm run benchmark` — results are written to `benchmark-results.json`:

| Benchmark | Ops/sec | Avg Latency | p99 | Target | Status |
|-----------|---------|-------------|-----|--------|--------|
| Batch Insert (200) | 83 | 12.02ms/entry | — | <2ms total | ❌ |
| HNSW Search (10k vectors) | 8,784 | 0.11ms | 0.31ms | p99 <1ms | ✅ |
| Cached Retrieval | 43,185 | 0.02ms | 0.07ms | <1ms | ✅ |
| Hybrid Search (cosine+BM25+MMR) | 17 | 58.77ms | 188ms | — | measured |
| Quantization recall (pq8 / pq4 / binary) | — | ~0.98 / ~0.96 / ~0.92 | — | ≥0.9 | ✅ |

> Insert throughput is quantization+HNSW-write bound on ARM builds; search-side targets are met with large margin. Numbers from the development box (Linux arm64, Node 24).

---

## Optimization Loops (library)

```ts
// OAPEL cycle engine
import { OAPELEngine, createDefaultOAPELConfig } from '@inno-optimize/optimization';
const oapel = new OAPELEngine(createDefaultOAPELConfig());

// A/B testing framework
import { ABTestingFramework, createDefaultABTestConfig } from '@inno-optimize/optimization';
const ab = new ABTestingFramework(createDefaultABTestConfig());

// Regression detection
import { RegressionDetector, createDefaultRegressionConfig } from '@inno-optimize/optimization';
const reg = new RegressionDetector(createDefaultRegressionConfig());

// Flywheel promotion
import { FlywheelEvaluator, createDefaultFlywheelConfig } from '@inno-optimize/optimization';
const flywheel = new FlywheelEvaluator(createDefaultFlywheelConfig());

// Optimization template search
import { TemplateManager } from '@inno-optimize/optimization';
```

---

## Security

- **Zero Trust**: mTLS for all internal communication (distributed mode)
- **Capability-Based Access**: MCP tools require explicit allowlist
- **Approval Gates**: destructive operations flagged in the coordination registry
- **Audit Logging**: memory entries carry provenance (agent, session, source, timestamp)
- **Fail-Closed**: promotion gates with hash-pinned anchors

---

## Monitoring

Suggested alert thresholds:

```yaml
- ArchitectureScoreDegraded (<70)
- HNSWLatencyHigh (p99 >1ms)
- PheromoneEligibilityLow (<50% agents)
- RegressionDetected (>10% delta)
```

---

## Governance

See [GOVERNANCE.md](GOVERNANCE.md) for ecosystem-wide rules including:

- **Mandatory Workflows**: Architecture changes → ADR → Implementation → Tests → Review
- **Decision Gates**: All structural changes require ADR + reviewer approval
- **Code Quality**: Zero TypeScript errors, lint errors = 0, >80% test coverage target
- **Memory Management**: All decisions/patterns → AgentDB
- **SOTA Research Protocol**: Research before implementing

---

## Contributing

1. Fork the repository
2. Create feature branch
3. Run `npm run test` and `npm run lint` (0 errors required)
4. Ensure `npm run typecheck` and `npm run benchmark` pass
5. Submit PR with ADR for architectural changes

See [AGENTS.md](AGENTS.md) for agent/skill workflows.

---

## License

Apache License 2.0 — see [LICENSE](LICENSE) for details.

---

## Resources

- **[OPERATIONS.md](OPERATIONS.md)** — operation manual (install, run, configure, release)
- [AGENTS.md](AGENTS.md) — agent/skill workflows and quality gates
- [GOVERNANCE.md](GOVERNANCE.md) — ecosystem governance rules

---

*Built with ❤️ by the inno-optimize swarm*
