# AGENTS.md — inno-optimize Governance

> **Rule**: Every architectural decision, code change, or system design must follow this governance. If a specialized skill/agent exists for the task, you MUST use it. If not, research SOTA and propose for approval.

---

## Core Principles

1. **Specialization over Generalization** — Use the right specialized agent/skill for each task
2. **Research Before Implement** — No code until SOTA patterns are understood
3. **Architecture First** — ADR required for any structural change
3. **Test-Driven** — Tests before implementation, benchmarks for performance claims
4. **Memory Persistence** — All decisions, patterns, decisions stored in AgentDB
5. **Observability** — Metrics, traces, logs for every component

---

## Specialized Agent Registry

### Core Agents (Always Available)

| Agent | Purpose | When to Use |
|-------|---------|-------------|
| `architect` | System architecture, ADRs, design patterns | Any structural change, new module, API design |
| `coder` | Implementation, refactoring, bug fixes | Writing/fixing code |
| `researcher` | SOTA research, pattern discovery, feasibility | Before any new feature/architecture |
| `tester` | Test strategy, unit/integration/e2e, property testing | Before/after implementation |
| `reviewer` | Code review, security audit, quality gates | Every PR, pre-merge |
| `security` | Threat modeling, vulnerability scan, compliance | Auth, data handling, external integrations |
| `performance` | Benchmarking, profiling, optimization | Performance claims, bottlenecks |
| `reviewer` | Code quality, patterns, best practices | Every PR |

### Specialized Agents (Use When Applicable)

| Agent | Purpose | Trigger |
|-------|---------|---------|
| `mcp-framework` | MCP server, tool routing, codemods | MCP integration, tool creation |
| `agentdb` | Vector memory, HNSW, quantization | Memory, search, embeddings |
| `ast-analysis` | Code parsing, scoring, anti-patterns | Code analysis, refactoring |
| `adr-automation` | ADR generation, CI gates | Architecture decisions |
| `coordination` | HiveMind, saga, pheromone | Multi-agent orchestration |
| `intelligence` | SONA, ReasoningBank, MoE, EWC++ | Learning, adaptation, MoE |
| `optimization` | OAPEL, A/B, regression, flywheel | Continuous improvement |

---

## Skill Registry

### Always Use These Skills When Applicable

| Skill | Purpose | Use When |
|-------|---------|----------|
| `ruflo` | Multi-agent orchestration, MCP, memory | Any multi-agent work |
| `ruvector` | Vector memory, HNSW, embeddings | Memory, search, similarity |
| `understand` | Codebase analysis, knowledge graph | Codebase exploration |
| `understand-chat` | Q&A about codebase | Questions about code |
| `understand-domain` | Business domain extraction | Business logic analysis |
| `understand-diff` | Change analysis, risk assessment | PR review, change analysis |
| `understand-onboard` | Onboarding guides | New team members |
| `mcp-framework` | MCP server, tool routing | MCP integration |
| `agentdb` | Vector DB, HNSW, quantization | Persistent memory |
| `ast-analysis` | Tree-sitter parsing, scoring | Code analysis |
| `adr-automation` | ADR generation, CI gates | Architecture decisions |
| `intelligence` | SONA, ReasoningBank, MoE, EWC++ | Adaptive intelligence |
| `coordination` | HiveMind, saga, pheromone | Multi-agent coordination |

---

## Mandatory Workflows

### 1. Architecture Change (Any Structural Change)

```
1. researcher → SOTA patterns for the problem
2. architect → ADR with alternatives, trade-offs
3. coder → Implementation with tests
4. tester → Test strategy + benchmarks
5. reviewer → Code review + security scan
6. ADR committed + decision logged in AgentDB
```

### 2. New Feature Development

```
1. researcher → SOTA patterns + feasibility
2. architect → API design + ADR
3. coder → Implementation (TDD)
4. tester → Unit + integration + property tests
5. performance → Benchmarks if perf-sensitive
6. reviewer → Review + security audit
7. ADR + decision logged in AgentDB
```

### 3. Bug Fix / Refactor

```
1. understand-chat → Analyze root cause
2. ast-analysis → Complexity + anti-patterns
5. coder → Fix with tests
6. tester → Regression tests
6. reviewer → Review
```

### 6. Research / SOTA Analysis

```
1. researcher → SOTA papers, implementations, benchmarks
2. Document findings in AgentDB
3. Propose approach with trade-offs
```

---

## Decision Gates

| Gate | Required | Tool/Agent |
|------|----------|------------|
| Architecture Change | ADR + reviewer approval | `architect` + `reviewer` |
| New Dependency | Security scan + license check | `security` + `reviewer` |
| Performance Claim | Benchmark evidence | `performance` agent |
| Breaking Change | ADR + migration plan | `architect` + `coder` |
| Security Change | Threat model + audit | `security` agent |
| Data Schema Change | Migration plan + backward compat | `architect` + `coder` |

---

## Code Quality Standards

| Standard | Tool | Threshold |
|----------|------|-----------|
| TypeScript | `tsc --noEmit` | Zero errors |
| Linting | `eslint` | Zero warnings |
| Tests | `vitest` | >80% coverage |
| Benchmarks | Custom | No regression >5% |
| Security | `npm audit` + custom | Zero critical |
| Types | Strict mode | No `any` without justification |

---

## Memory & Knowledge Management

| What | Where | Tool |
|------|-------|------|
| Architecture decisions | AgentDB (ADR collection) | `agentdb` |
| Code patterns | AgentDB (pattern collection) | `agentdb` |
| Research findings | AgentDB (research collection) | `researcher` + `agentdb` |
| Bug patterns | AgentDB (bug collection) | `agentdb` |
| Performance baselines | AgentDB (benchmark collection) | `performance` |

**Rule**: Every decision, pattern, finding → AgentDB. Query before implementing.

---

## SOTA Research Protocol

When no specialized agent/skill exists:

```
1. Search: GitHub Trending, Papers with Code, ArXiv, HuggingFace, GitHub Topics
2. Evaluate: Stars, forks, recency, maintenance, benchmarks, license
3. Document: Findings → AgentDB (research collection)
3. Propose: Top 3 options with trade-offs
4. Approve: Get explicit approval before implementing
```

**Sources to Check**: GitHub Topics, ArXiv (cs.AI, cs.LG, cs.SE), Papers with Code, HuggingFace Models, Awesome Lists, CNCF Landscape.

---

## Agent/skill Selection Matrix

| Task Category | Primary Agent | Supporting Skills |
|---------------|---------------|-------------------|
| Architecture | `architect` | `adr-automation`, `ast-analysis` |
| Implementation | `coder` | `ast-analysis`, `mcp-framework` |
| Code Analysis | `ast-analysis` | `understand`, `understand-chat` |
| Memory/Search | `agentdb` | `ruvector`, `embeddings` |
| Multi-agent | `coordination` | `ruflo`, `hive-mind` |
| Learning/Adaptation | `intelligence` | `sona`, `reasoningbank` |
| Optimization | `optimization` | `flywheel`, `abtesting` |
| Research | `researcher` | `understand`, `websearch` |
| Testing | `tester` | `vitest`, `property-testing` |
| Review | `reviewer` | `security`, `ast-analysis` |

---

## Enforcement

- **Pre-commit**: TypeScript + lint + tests
- **CI/CD**: All gates must pass
- **PR Template**: Requires ADR link, test evidence, benchmark evidence
- **Code Review**: Mandatory `reviewer` agent + human
- **Post-merge**: Decision logged in AgentDB

---

## Emergency Override

If no agent/skill fits and research reveals no SOTA:

1. Document the gap in AgentDB (research collection)
2. Propose minimal viable implementation
3. Get explicit approval from architecture owner
4. Implement with maximum observability
5. Document as technical debt with remediation plan

---

**Remember**: The best code is the code you don't write. Use existing agents, skills, libraries first. Build only when SOTA doesn't exist.