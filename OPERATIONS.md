# inno-optimize — Operations Manual

Everything needed to install, run, verify, publish, and troubleshoot inno-optimize in production or as a dependency of other systems.

- **Repository**: https://github.com/InnovativeNectar/inno-optimize
- **License**: Apache-2.0 (see [LICENSE](LICENSE))
- **Node**: >= 20 (developed/verified on Node 24, Linux arm64 & x64)

---

## 1. Contents

| Section | What you'll find |
|---------|------------------|
| [Install](#2-install) | Source install, package install, one-shot MCP |
| [Run the MCP server](#3-run-the-mcp-server) | stdio server, env vars, client configs |
| [Library usage](#4-library-usage) | Per-package recipes |
| [Build & verify](#5-build--verify) | build, typecheck, lint, tests, benchmarks |
| [CI pipeline](#6-ci-pipeline) | What runs on every push/PR |
| [Publishing](#7-publishing) | npm release process for all 9 packages |
| [Configuration reference](#8-configuration-reference) | All environment variables |
| [Troubleshooting](#9-troubleshooting) | OOM, native builds, hangs, common errors |

---

## 2. Install

### From source

```bash
git clone https://github.com/InnovativeNectar/inno-optimize.git
cd inno-optimize
npm install          # installs workspace deps + native tree-sitter/hnswlib builds
npm run build        # tsc across all 9 packages
npm run test         # 135 tests, 10 files
```

### As a dependency

```bash
# The MCP server (unscoped, has a bin)
npm install inno-optimize-mcp

# Individual libraries (scoped — always require --access public when publishing,
# but install normally as a consumer)
npm install @inno-optimize/agentdb
npm install @inno-optimize/intelligence
```

### One-shot (no install)

```bash
npx -y inno-optimize-mcp
```

The server speaks MCP over stdio — it stays silent on stdout (logs go to stderr) so it is safe to launch from any MCP client.

---

## 3. Run the MCP server

### Command

```bash
npx -y inno-optimize-mcp            # from npm
node packages/inno-mcp/dist/bin/inno-mcp.js   # from a source checkout
```

### Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `INNO_MEMORY_PATH` | `~/.inno-optimize/memory.db` | Vector memory file. Use `:memory:` for ephemeral/test mode. Parent directories are created automatically. |
| `INNO_MEMORY_MAX_ELEMENTS` | `100000` | HNSW capacity bound — **directly controls peak allocation**. Lower it on small machines. |
| `INNO_QUIET` | unset | Set to `1` to suppress the stderr startup banner. |

Embeddings are computed with a deterministic local 384-dim hash embedder (no network, no API keys).

### Client configuration

**Claude Code**

```bash
claude mcp add inno-optimize -- npx -y inno-optimize-mcp
```

**opencode** (`opencode.json`)

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

**Generic stdio client**

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

### The 12 tools

| Tool | Input highlights | Returns |
|------|------------------|---------|
| `memory_store` | `content` (required), `domain`, `taskType`, `mode`, `tags`, `type` | `{ id, type }` |
| `memory_search` | `query` (required), `k` (1-50) | ranked entries (id, content, domain, tags) |
| `memory_stats` | — | path, dimensions, entries stored this session |
| `intelligence_process_task` | `description` (required), `type`, `mode`, `constraints` | SONA adaptation summary, routing decision, pattern (LoRA weights summarized, never dumped) |
| `ast_analyze` | `filePath` (required), `content` (optional inline), `maxIssues` | language, metrics, counts, anti-pattern issues |
| `ast_diff` | `oldContent`, `newContent`, `file` | change type, affected lines, added/removed counts |
| `adr_generate` | `description`, `affectedFiles[]`, `type`, `impact`, `lineRanges?` | full ADR (anchors stripped of embeddings) |
| `business_agent_list_templates` | `domain?`, `department?` | template summaries (35 total) |
| `business_agent_create` | `templateId`, `customizations?`, `memoryOverrides?` | `agentId` (session-scoped) |
| `business_agent_execute` | `agentId`, `task`, `context?` | agent execution result |
| `coordination_servers` | `name?`, `capability?`, `tier?` | business MCP server registry |
| `optimization_templates` | `query?`, `category?`, `limit?` | optimization template list |

Errors are returned as MCP tool results with `isError: true` and a `Error: …` message — they do not crash the server.

### Graceful shutdown

The server exits `0` on `SIGINT`/`SIGTERM`. Unexpected failures exit `1` with a `[inno-optimize-mcp] fatal:` stack on stderr.

---

## 4. Library usage

### Vector memory (agentdb)

```ts
import { FastStore, type MemoryEntry } from '@inno-optimize/agentdb';

const store = new FastStore({
  path: process.env.INNO_MEMORY_PATH ?? './memory.db',
  dimensions: 384,
  hnsw: { M: 16, efConstruction: 200, efSearch: 100, maxElements: 100_000 },
  quantization: { defaultLevel: 'pq8' },
  cache: { maxSize: 10_000, ttlMs: 300_000 },
});
await store.initialize();
// store.insert(entries), store.search({ vector, textQuery, k }), store.close()
```

> `path: ':memory:'` maps to a unique temp file (not a literal in-memory buffer) — hnswlib's in-memory allocation at 10M elements is ~4.4 GB. Always bound `hnsw.maxElements`.

### Source analysis (ast-analysis)

```ts
import { MultiLanguageParser, AntiPatternDetector, ArchitectureScorer, computeDiff }
  from '@inno-optimize/ast-analysis';

const parser = new MultiLanguageParser();
const result = await parser.parseFile('src/app.ts', sourceCode);
// result: { language, imports, exports, classes, functions, interfaces, types, calls, metrics, errors, ast }
const issues = new AntiPatternDetector().detect(result);
const score = new ArchitectureScorer().scoreProject([result], 'my-project');
const change = computeDiff(oldSource, newSource); // { type, affectedLines, oldContent, newContent }
```

Supported extensions: `.ts .tsx .js .jsx .py .go .java .rs .rb .php` (7 grammars). Unknown extensions throw `Unsupported language for file: …`.

> `result.ast` is a live tree-sitter `Tree` — never `JSON.stringify` it. The MCP `ast_analyze` tool omits it by design.

### Intelligence layer (intelligence)

```ts
import { IntelligenceLayer } from '@inno-optimize/intelligence';

const intelligence = new IntelligenceLayer(store);
const { sonaAdaptation, routing, pattern } = await intelligence.processTask({
  id: 'task-1', type: 'refactor', description: 'Extract payment saga',
  constraints: [], acceptanceCriteria: [], mode: 'convergent',
});
```

Note: the constructor starts an EWC consolidation scheduler (`setInterval`). In short-lived scripts/tests this is fine — vitest exits cleanly — but long-running tools should be aware a timer is active.

### Business agents (business-agent-factory)

```ts
import { AgentFactory, createDefaultTemplateManager } from '@inno-optimize/business-agent-factory';

const templates = createDefaultTemplateManager(); // 35 templates, 11 departments
const factory = new AgentFactory(templates);
const agent = await factory.createAgent({
  templateId: 'sales-rep',
  customizations: { name: 'Acme rep' },          // partial template override
  memoryOverrides: { workingMemorySize: 2000 },
});
const result = await agent.execute('Qualify lead', { source: 'web' });
```

Unknown template ids throw `Template not found: …`.

### ADR generation (adr-automation)

```ts
import { ADRGenerator } from '@inno-optimize/adr-automation';
import { hashEmbedder } from 'inno-optimize-mcp';

// memory adapter must expose query({ query, type?, topK }) → [{ title, ... }]
const generator = new ADRGenerator(memoryAdapter, hashEmbedder);
const adr = await generator.generateFromChange({
  id: 'change-1', type: 'new_module',
  description: 'Introduce vector store module',
  affectedFiles: ['src/stores/vector-store.ts'],
  lineRanges: {}, impact: 'high', timestamp: new Date(),
});
```

ADRs are numbered sequentially (`ADR-001`, …) per generator instance. Anchors contain 384-dim embeddings — strip `semanticAnchors[].embedding` before serializing to clients (the MCP tool does this).

### Coordination registry (coordination)

```ts
import { businessServers, getServerByName, getServersByCapability } from '@inno-optimize/coordination';

const orders = getServerByName('business-orders');
// each server: { name, transport, command/url, tools[], capabilities[], tier, destructive, tags }
```

### Optimization (optimization)

```ts
import {
  OAPELEngine, ABTestingFramework, RegressionDetector, FlywheelEvaluator,
  TemplateManager, createDefaultOAPELConfig, createDefaultABTestConfig,
  createDefaultRegressionConfig, createDefaultFlywheelConfig,
} from '@inno-optimize/optimization';
```

---

## 5. Build & verify

| Command | Purpose | Pass criteria |
|---------|---------|---------------|
| `npm run build` | Compile all 9 packages (`tsc` per workspace) | exit 0 |
| `npm run typecheck` | Root `tsc --noEmit` (strict + exactOptionalPropertyTypes) | zero errors |
| `npm run lint` | ESLint (type-aware, `tsconfig.eslint.json`) | **0 errors** (warnings allowed) |
| `npm run test` | vitest, 135 tests / 10 files | 135/135 |
| `npm run benchmark` | HNSW/quantization/hybrid benchmarks | exit 0, writes `benchmark-results.json` |

### Test execution notes

- Native modules (tree-sitter, hnswlib) run fine under plain vitest.
- On memory-constrained machines use the malloc guard:

  ```bash
  LD_PRELOAD=/path/to/malloc_hook.so node node_modules/vitest/vitest.mjs run
  ```

- Individual suite: `node node_modules/vitest/vitest.mjs run packages/inno-mcp`

### Type-aware lint

ESLint uses a single project file, `tsconfig.eslint.json`, which includes tests and benchmarks (excluded from package builds). If you add a new top-level TS directory, add it to that file's `include`.

Rules that are **errors** (CI-blocking): `consistent-type-imports`, `await-thenable`, `prefer-const`, `no-var`. The `no-unsafe-*` family and `no-explicit-any` are warnings — cleanup debt, tracked via `npm run lint` output.

### Benchmarks

`npm run benchmark` compiles `packages/agentdb/benchmarks` and runs it against a 10k-vector store. Output:

- stdout summary table + target verification
- `benchmark-results.json` at the repo root (consumed by the CI benchmark job artifact)

Expected on a typical dev box (arm64): HNSW search p99 < 1 ms, cached retrieval < 1 ms, quantization recall 0.92-0.98. Insert throughput (~12 ms/entry with pq8) is quantization/HNSW-write bound and currently misses the aspirational `<2ms total` target — see the README benchmark table.

---

## 6. CI pipeline

`.github/workflows/ci-cd.yml`:

| Job | Trigger | Steps |
|-----|---------|-------|
| `lint` | push (main/develop) + PR | `npm ci` → `npm run lint` → `npm run typecheck` |
| `test` | push + PR | `npm ci` → `npm run build` → `npm run test` |
| `adr-check` | PR only, non-blocking | `adr-automation` check-pr + PR comment on failure |
| `benchmark` | push to main | build → `npm run benchmark` → uploads `benchmark-results.json` artifact |
| `security` | push + PR | `npm audit --audit-level=high`, optional Snyk when `SNYK_TOKEN` set |
| `build` | push to main | artifact tarball of all dist/ |
| `deploy-staging` / `release` | push to main | staging deploy hook + GitHub release with changelog |

The repo tracks `package-lock.json` — CI uses `npm ci`, so any dependency change must commit the regenerated lockfile (`npm install`).

---

## 7. Publishing

### Preconditions

```bash
npm login                      # or NPM_TOKEN env for CI
npm whoami                     # must be an owner of the @inno-optimize scope
```

Scoped packages (`@inno-optimize/*`) already carry `"publishConfig": { "access": "public" }`; first-time publishes would otherwise be blocked for non-paid scopes.

### Release checklist

1. **Verify**: `npm run build && npm run typecheck && npm run lint && npm run test` — all green.
2. **Version**: bump versions consistently (all packages are currently `0.1.0`):

   ```bash
   npm version 0.2.0 --workspaces --no-git-tag-version
   npm version 0.2.0 --no-git-tag-version   # root (private, not published)
   ```

3. **Lockfile**: `npm install` → commit `package-lock.json`.
4. **Pack sanity**:

   ```bash
   (cd packages/agentdb && npm pack --dry-run)
   (cd packages/inno-mcp && npm pack --dry-run)
   ```

   Expected contents: `dist/**`, `package.json` (+ `README.md` if present). Nothing else.
5. **Publish** (dependency order matters only if consumers install by version; registry resolves all at once):

   ```bash
   npm publish --workspaces
   # or individually:
   npm publish packages/agentdb
   npm publish packages/inno-mcp        # the unscoped MCP server with bin
   ```

6. **Tag + push**: `git tag v0.2.0 && git push --follow-tags`.

### What gets published

| Package | npm name | bin |
|---------|----------|-----|
| agentdb | `@inno-optimize/agentdb` | — |
| mcp-framework | `@inno-optimize/mcp-framework` | — |
| adr-automation | `@inno-optimize/adr-automation` | — |
| ast-analysis | `@inno-optimize/ast-analysis` | — |
| intelligence | `@inno-optimize/intelligence` | — |
| coordination | `@inno-optimize/coordination` | — |
| optimization | `@inno-optimize/optimization` | — |
| business-agent-factory | `@inno-optimize/business-agent-factory` | — |
| inno-mcp | **`inno-optimize-mcp`** | `inno-optimize-mcp` |

The root workspace package is `private: true` and is never published.

> **Licensing note**: everything is Apache-2.0. If you intend to ship a closed-source commercial build, switching the license is a one-file change (`LICENSE` + `license` fields in 10 `package.json`s) **before** first publish — Apache-2.0 grants can't be retroactively revoked.

---

## 8. Configuration reference

### Environment variables

| Variable | Default | Used by |
|----------|---------|---------|
| `INNO_MEMORY_PATH` | `~/.inno-optimize/memory.db` | MCP server memory store |
| `INNO_MEMORY_MAX_ELEMENTS` | `100000` | HNSW capacity/allocation bound |
| `INNO_QUIET` | unset | `1` = suppress startup banner |
| `PI` | — | rUv edge identity (ruflo/ruvector ecosystem only) |

### Programmatic options

`createInnoOptimizeServer({ memoryPath?, maxElements?, dimensions? })` mirrors the env vars for embedded use (the test suite uses `{ memoryPath: ':memory:' }`).

### Memory file management

- **Location**: default `~/.inno-optimize/memory.db` (created on first run).
- **Backup**: copy the `.db` file while the server is stopped (SQLite + companion HNSW files).
- **Reset**: stop the server, delete the file — it is recreated empty.
- **Stats**: call the `memory_stats` tool (path, 384 dims, session writes).

---

## 9. Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `FATAL ERROR: ... allocation failed` / OOM at startup | hnswlib default 10M-element index (~4.4 GB) | Pass `hnsw.maxElements` (MCP: `INNO_MEMORY_MAX_ELEMENTS`, e.g. `20000`) or avoid unbounded `:memory:` on old builds (current `FastStore` maps `:memory:` to a temp file with bounded config) |
| `Cannot find name 'process'` / `node:fs` type errors | package tsconfig missing `"types": ["node"]` | add `"types": ["node"]` to that package's `tsconfig.json` |
| `npx tsc` hangs, but `/usr/bin/tsc` works | broken npx resolution in some environments | invoke the compiler directly: `/usr/bin/tsc --build` or `node_modules/.bin/tsc` |
| `config.parser.query is not a function` | tree-sitter >= 0.21 removed `Parser#query` | use `new Parser.Query(language, source)` (fixed in `ast-analysis`) |
| `Query error of type TSQueryErrorNodeType` | grammar-specific node names differ | verify against `node_modules/tree-sitter-<lang>/src/node-types.json` |
| `Custom types cannot be represented in JSON Schema` | `z.custom()` in an MCP `inputSchema` | use `z.record(z.string(), z.unknown())` / `z.unknown()` and cast in the handler |
| Native module build fails (`node-gyp rebuild`) | missing build toolchain | install `python3`, `make`, `g++` (Debian/Ubuntu: `build-essential python3`), or use a Node version with prebuilt binaries |
| ESLint: "file not included in project" | new TS file outside `tsconfig.eslint.json` | add the path to `include` |
| `npm ci` fails: lockfile out of sync | edited package.json deps | run `npm install` and commit `package-lock.json` |
| MCP client shows no tools | server crashed on startup | run `node packages/inno-mcp/dist/bin/inno-mcp.js` manually; check stderr `[inno-optimize-mcp]` lines |
| Two tools raced (search before store) | client issued concurrent `tools/call`s | serialize calls; MCP servers dispatch concurrently — await each result before the next dependent call |

### Getting help

- Issues: https://github.com/InnovativeNectar/inno-optimize/issues
- Governance/workflows: [GOVERNANCE.md](GOVERNANCE.md), [AGENTS.md](AGENTS.md)
