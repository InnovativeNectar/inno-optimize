# ADR-001: Dedicated `inno-mcp` package for the stdio MCP server

- **Status**: Accepted
- **Date**: 2026-10-09
- **Deciders**: inno-optimize maintainers
- **Tags**: mcp, packaging, architecture

## Context

The platform needed a runnable MCP server so external systems (Claude Code, opencode, Cursor, custom agents) can consume inno-optimize's capabilities directly. Constraints discovered during planning:

1. The server must depend on **all eight** existing packages (memory, analysis, intelligence, coordination, business agents, ADR, optimization, registry).
2. `mcp-framework` is a dependency of `business-agent-factory`; therefore the server **cannot live inside `mcp-framework`** without creating a dependency cycle (`mcp-framework → business-agent-factory → mcp-framework`).
3. Nothing in the ecosystem depends on the server itself, so a leaf package is possible.
4. The server ships a `bin` (`inno-optimize-mcp`) and must be installable standalone (`npx -y inno-optimize-mcp`).

## Decision

Create a new **leaf workspace package** `packages/inno-mcp` (npm name `inno-optimize-mcp`, unscoped so the bin name is short) that depends on the eight platform packages plus `@modelcontextprotocol/sdk` and `zod`, and exposes:

- `createInnoOptimizeServer(options)` / `startStdioServer(server)` for embedding;
- `dist/bin/inno-mcp.js` as the CLI entry;
- 12 tools: `memory_store`, `memory_search`, `memory_stats`, `intelligence_process_task`, `ast_analyze`, `ast_diff`, `adr_generate`, `business_agent_list_templates`, `business_agent_create`, `business_agent_execute`, `coordination_servers`, `optimization_templates`.

## Alternatives considered

| Option | Why rejected |
|--------|--------------|
| Put the server in `mcp-framework` | Dependency cycle with `business-agent-factory` |
| Put the server in the root workspace | Root is `private: true`, has no `bin`, cannot be published cleanly |
| HTTP/SSE transport first | stdio is the universal baseline for desktop MCP clients; transports can be added later behind the same server factory |

## Consequences

- Dependency graph stays acyclic: `inno-mcp → {8 packages}`; nothing imports `inno-mcp`.
- The server can be versioned/published independently (unscoped `inno-optimize-mcp`).
- Adding a ninth package requires updating: root `tsconfig.json` references, vitest aliases (for any newly imported packages), `package-lock.json`, and the README package table.
- Zod schemas must be JSON-Serialisable (`z.custom()` is rejected by the MCP SDK at `tools/list` time); input shapes are validated with `z.record`/`z.unknown` and cast in handlers.
- Large payloads (LoRA weight matrices, ADR anchor embeddings, raw tree-sitter `ast`) are summarised or stripped before being returned over MCP.

## References

- [OPERATIONS.md — Run the MCP server](../../../OPERATIONS.md#3-run-the-mcp-server)
- `packages/inno-mcp/src/server.ts`, `packages/inno-mcp/src/tools.ts`
- MCP SDK `McpServer.registerTool` (v1.32.1)
