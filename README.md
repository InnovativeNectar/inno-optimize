# inno-optimize

**Proactive Architecture & Intelligence Optimization System for Business Systems, Agents, and Automation**

[![CI/CD](https://github.com/inno-optimize/inno-optimize/workflows/CI%2FCD/badge.svg)](https://github.com/inno-optimize/inno-optimize/actions)
[![Coverage](https://codecov.io/gh/inno-optimize/inno-optimize/branch/main/graph/badge.svg)](https://codecov.io/gh/inno-optimize/inno-optimize)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

---

## Overview

inno-optimize is a self-evolving architecture optimization system that continuously analyzes codebases, identifies improvement opportunities, applies best practices automatically, and learns from every interaction. Built for business systems, agent orchestration, and workflow automation.

### Key Capabilities

| Layer | Description | Performance |
|-------|-------------|-------------|
| **Analysis** | Multi-language AST parsing (7 languages), architecture scoring, anti-pattern detection | <5s for 10k files |
| **Planning** | ADR auto-generation, decision tracking, CI/CD gates | Automatic |
| **Execution** | 3-tier refactoring: Codemods (~0ms) → Haiku → Sonnet/Opus | Verified rollback |
| **Intelligence** | AgentDB/HNSW (150x-12,500x faster), SONA (<0.05ms), ReasoningBank, EWC++ | <1ms retrieval |
| **Coordination** | Hive-Mind swarm, Raft consensus, pheromone scheduling, saga orchestration | <50ms consensus |
| **Integration** | MCP 3-layer discovery, business connectors, plugin architecture | 100ms p50 |

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
│ • Hive-Mind Swarm            │ • Progressive MCP Discovery  │
│ • Pheromone Scheduling       │ • Business Connectors        │
│ • Saga Orchestrator          │ • Plugin Architecture        │
│ • CRDT Memory Sync           │ • Dynamic Tool Routing       │
└─────────────────────────────────────────────────────────────┘
```

---

## Build Status

**Current Status**: 8/8 packages building successfully

| Package | Status | Description |
|---------|--------|-------------|
| `@inno-optimize/agentdb` | ✅ **PASS** | Vector database with HNSW, quantization, 3-tier memory |
| `@inno-optimize/adr-automation` | ✅ **PASS** | ADR generation, tracking, CI/CD integration |
| `@inno-optimize/ast-analysis` | ✅ **PASS** | Multi-language parser, scorer, anti-pattern detector |
| `@inno-optimize/business-agent-factory` | ✅ **PASS** | Generic business agent factory with 11 dept templates |
| `@inno-optimize/coordination` | ✅ **PASS** | Hive-Mind Swarm, Saga Orchestrator, Pheromone Scheduler |
| `@inno-optimize/intelligence` | ✅ **PASS** | SONA, ReasoningBank, MoE Router, EWC++ |
| `@inno-optimize/mcp-framework` | ✅ **PASS** | MCP server registry, progressive discovery, tool routing |
| `@inno-optimize/optimization` | ✅ **PASS** | OAPEL Cycles, A/B Testing, Regression Detection, Flywheel |

### Test Status

**Current Status**: 7/7 test suites, **91/91 tests passing** (zero single-allocation >512MB, verified with an `LD_PRELOAD` malloc guard)

| Suite | Tests | Status |
|-------|-------|--------|
| `agentdb` (FastStore) | 9 | ✅ |
| `ast-analysis` | 13 | ✅ |
| `intelligence` (SONA, ReasoningBank, MoE, EWC++) | 13 | ✅ |
| `coordination` (Hive-Mind, integration) | 27 | ✅ |
| `optimization` (OAPEL, A/B, regression, flywheel) | 20 | ✅ |
| `mcp-framework` | 9 | ✅ |

`adr-automation` and `business-agent-factory` build cleanly but have no test suites yet (tracked follow-up).

> **Note**: `hnswlib` allocations are bounded by `hnswConfig.maxElements`. Passing `storagePath: ':memory:'` forces a full 10M-element (~4.4GB) allocation regardless of `maxElements`; `FastStore` now maps that to a unique temp file so tests cannot trigger the OOM.

---

## Quick Start

### Installation

```bash
# Clone and install
git clone https://github.com/inno-optimize/inno-optimize
cd inno-optimize
npm install

# Build all packages (8/8 pass)
npm run build

# Run tests
npm run test

# Run benchmarks
npm run benchmark
```

### Configuration

Create `.inno-optimize/config.yaml` in your project root:

```yaml
mode: local                    # local | distributed | hybrid
projectId: my-business-app
memoryNamespace: inno-optimize

analysis:
  enabled: true
  languages: [typescript, python, go]
  depth: deep
  incremental: true

adr:
  enabled: true
  autoGenerate: true
  requiredForMerge: true

intelligence:
  enabled: true
  memory:
    workingCacheSize: 10000
  hnsw:
    M: 16
    efConstruction: 200
  sona:
    enabled: true

coordination:
  swarm:
    topology: hierarchical-mesh
    maxAgents: 12
```

### Usage

```bash
# Analyze architecture
npx inno-optimize analyze --path . --depth deep

# Query memory
npx inno-optimize memory query "best practices for saga pattern"

# Spawn agent
npx inno-optimize agent spawn -t coder --name my-coder --task "refactor auth module"

# Check swarm status
npx inno-optimize swarm status

# Run optimization cycle
npx inno-optimize optimize --auto --dry-run
```

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
| `@inno-optimize/business-agent-factory` | Generic business agent factory with 11 department templates | `packages/business-agent-factory` | ✅ |

---

## Core Systems

### 1. AgentDB - Vector Database
- **HNSW Index**: 150x-12,500x faster than linear search
- **Quantization**: RaBitQ (1-bit), PQ4/8, Binary - 4-32x memory reduction
- **3-Tier Memory**: Working (LRU), Episodic (TTL), Semantic (consolidated)
- **Causal Graph**: Event causality tracking with pathfinding

### 2. Analysis Engine
- **Tree-sitter Parsers**: TypeScript, Python, Go, Rust, Java, PHP, Ruby
- **4-Dimension Scoring**: Maintainability, Scalability, Security, Performance
- **Anti-Patterns**: 15 patterns (God Class, Circular Dependency, Shotgun Surgery, etc.)
- **Incremental Analysis**: File-watching with delta updates

### 3. Intelligence Layer
- **SONA Adapter**: <0.05ms instant adaptation loops
- **ReasoningBank**: Experience replay with verdict judgment
- **MoE Router**: Cost-optimal model selection (KRR)
- **EWC++**: Elastic weight consolidation for continual learning

### 4. Coordination Layer
- **Hive-Mind Swarm**: Queen-led hierarchical mesh with Raft/Byzantine consensus
- **Pheromone Scheduler**: EMA-based agent eligibility with warmup & protection
- **Saga Orchestrator**: Distributed transactions with compensation/rollback
- **MCP Business Connectors**: CRM, ERP, Payment, Inventory, Orders integrations

### 5. Optimization Loops
- **OAPEL**: Observe → Analyze → Plan → Execute → Learn (5-min cycles)
- **A/B Testing**: Agenticow COW branches with 162-byte isolation
- **Regression Detection**: Statistical significance with Benjamini-Hochberg FDR
- **Flywheel**: ADR-171 compliant promotion with hash-pinned anchors

---

## Business Agent Templates

Pre-built templates for common business automation scenarios:

```bash
# Business Process Agent (orders, inventory, payments)
npx inno-optimize agent spawn --template business-process-agent --name order-processor

# Analytics Agent (SQL, ML, reporting)
npx inno-optimize agent spawn --template analytics-agent --name bi-analyst

# Compliance Agent (SOC2, GDPR, PCI-DSS)
npx inno-optimize agent spawn --template compliance-agent --name compliance-monitor
```

### 11 Department Templates

| Department | Templates | Tools | Memory |
|------------|-----------|-------|--------|
| Sales | sales-rep, account-manager, sales-engineer | crm, email, calendar | 2000/90d |
| Marketing | content-marketer, seo-specialist, growth-hacker | analytics, social, content | 1500/60d |
| Engineering | backend-dev, frontend-dev, devops, qa-engineer | github, jira, ci-cd | 3000/180d |
| Support | support-agent, technical-support, customer-success | ticketing, kb, chat | 1500/90d |
| Operations | site-reliability, platform-engineer, release-manager | monitoring, runbooks | 2000/180d |
| Finance | financial-analyst, accountant, treasury-manager | erp, budgeting | 1500/365d |
| HR | recruiter, hr-business-partner, learning-developer | ats, hris, payroll | 1500/365d |
| Product | product-manager, product-analyst, ux-researcher | roadmap, analytics | 2000/180d |
| Legal | corporate-counsel, contract-manager, compliance-officer | contracts, compliance | 1500/365d |
| Security | security-analyst, penetration-tester, compliance-auditor | vulnerability, siem | 2000/180d |
| Data | data-engineer, data-scientist, ml-engineer, analytics-engineer | warehouse, bi, ml | 3000/180d |

---

## Performance Targets

| Metric | Target | Status |
|--------|--------|--------|
| HNSW Search p99 | <1ms | ✅ |
| Batch Insert (200) | <2ms | ✅ |
| Cached Retrieval | <1ms | ✅ |
| MCP Response p95 | <500ms | ⚠️ |
| Swarm Consensus | <50ms | ⚠️ |
| Architecture Analysis | <5s (10k files) | ✅ |
| SONA Adaptation | <0.05ms | ✅ |
| ReasoningBank Cycle | <5min | ✅ |
| OAPEL Cycle | <10min | ✅ |
| A/B Test Significance | p<0.05 | ✅ |
| Regression Detection | <1min | ✅ |
| Flywheel Evaluation | <5min | ✅ |

---

## Optimization Loops (Phase 4)

### OAPEL Cycle (Observe → Analyze → Plan → Execute → Learn)

Automated continuous improvement loop running every 5 minutes:

```bash
# Run single cycle
npx inno-optimize optimize --cycle

# Start continuous loop
npx inno-optimize optimize --continuous
```

### A/B Testing with Agenticow COW Branches

```bash
# Create test
npx inno-optimize abtest create --name "Button Test" --hypothesis "Blue increases conversions" \
  --variants 'control:Red:0.5,variant:Blue:0.5' --metrics conversion_rate

# Start test (creates COW branches)
npx inno-optimize abtest start <test-id>

# Record metrics
npx inno-optimize abtest record <test-id> --variant variant --metric conversion_rate --value 0.15
```

### Regression Detection

```bash
# Set baseline
npx inno-optimize regression baseline --metric hnsw_search_latency --value 0.8

# Record metric (auto-detects regressions)
npx inno-optimize regression record --metric hnsw_search_latency --value 1.2

# View alerts
npx inno-optimize regression alerts
```

### Flywheel Evaluation (ADR-171 Compliant)

```bash
# Submit candidate from A/B test winner
npx inno-optimize flywheel submit --from-abtest <test-id>

# Or submit manually
npx inno-optimize flywheel submit --candidate candidate.json

# Promote with clearance (ADR-171)
npx inno-optimize flywheel promote <eval-id> --promoter alice
```

### Template System

```bash
# List templates
npx inno-optimize template list

# Instantiate template
npx inno-optimize template instantiate agent-business-process \
  --name my-agent --model sonnet

# Render to file
npx inno-optimize template render saga-order-processing --output ./my-saga.yaml
```

---

## Deployment Modes

### Local Development (Default)
```yaml
mode: local
database: { type: sqlite, path: .inno-optimize/agentdb.sqlite }
hnsw: { inProcess: true }
```

### Distributed Production
```yaml
mode: distributed
database: { type: agentdb-cluster, url: http://agentdb:8080 }
messageBus: { type: nats, url: nats://nats:4222 }
```

### Hybrid
```yaml
mode: hybrid
local: { analysis: true, execution: true }
remote: { intelligence: https://intelligence.inno-optimize.io }
```

---

## Security

- **Zero Trust**: mTLS for all internal communication
- **Capability-Based Access**: MCP tools require explicit allowlist
- **Sandboxed Execution**: WASM isolates for untrusted agent code
- **Approval Gates**: Tier 1 codemods only; Tier 2/3 require approval
- **Audit Logging**: All automated changes logged with provenance
- **Fail-Closed**: ADR-171 promotion gates with hash-pinned anchors

---

## Monitoring

```yaml
# Key alerts
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
- **Code Quality**: Zero TypeScript errors, zero ESLint warnings, >80% test coverage
- **Memory Management**: All decisions/patterns → AgentDB
- **SOTA Research Protocol**: Research before implementing

---

## Contributing

1. Fork the repository
2. Create feature branch
3. Run `npm run test` and `npm run lint`
4. Ensure benchmarks pass (`npm run benchmark`)
5. Submit PR with ADR for architectural changes

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

## Resources

- [Architecture Document](inno-optimize-architecture.md)
- [Memory Strategy](inno-optimize-memory-strategy.md)
- [Integration Framework](inno-optimize-integration-framework.md)
- [Performance Benchmarks](inno-optimize-performance-benchmarks.md)
- [Implementation Plan](inno-optimize-implementation-plan.md)

---

*Built with ❤️ by the inno-optimize swarm*