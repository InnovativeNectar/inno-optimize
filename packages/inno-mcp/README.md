# inno-optimize-mcp

inno-optimize MCP server (stdio) — Ready-to-run MCP stdio server exposing inno-optimize as 12 tools: vector memory, intelligence routing, AST analysis, ADR generation, business agents, coordination registry, and optimization templates.

Part of [inno-optimize](https://github.com/InnovativeNectar/inno-optimize): proactive architecture & intelligence optimization for business systems, agents, and automation.

## Install

```bash
npm install inno-optimize-mcp
```

## Quick start

```bash
# Run it
npx -y inno-optimize-mcp

# Claude Code
claude mcp add inno-optimize -- npx -y inno-optimize-mcp

# Environment
#   INNO_MEMORY_PATH        memory file (default ~/.inno-optimize/memory.db, :memory: for ephemeral)
#   INNO_MEMORY_MAX_ELEMENTS  HNSW capacity (default 100000)
#   INNO_QUIET=1            suppress startup banner

# Embed in your own server
import { createInnoOptimizeServer, startStdioServer } from 'inno-optimize-mcp';
const server = await createInnoOptimizeServer({ memoryPath: './memory.db' });
await startStdioServer(server);
```

## Documentation

Full operation manual: [OPERATIONS.md](https://github.com/InnovativeNectar/inno-optimize/blob/main/OPERATIONS.md)

## License

Apache-2.0
