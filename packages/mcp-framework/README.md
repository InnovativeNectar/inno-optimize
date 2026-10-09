# @inno-optimize/mcp-framework

MCP server registry & tool routing — MCP server registry with progressive 3-layer discovery, capability matching, and dynamic tool routing for multi-agent systems.

Part of [inno-optimize](https://github.com/InnovativeNectar/inno-optimize): proactive architecture & intelligence optimization for business systems, agents, and automation.

## Install

```bash
npm install @inno-optimize/mcp-framework
```

## Quick start

```ts
import {
  MCPServerRegistry, ToolRouter, CodemodRegistry, PatternMemory,
  createBuiltinCodemods,
} from '@inno-optimize/mcp-framework';

// Registry of MCP servers with capability discovery
const registry = new MCPServerRegistry();

// 3-tier task routing: codemods -> pattern memory -> LLM fallback
const codemods = new CodemodRegistry();
for (const pattern of createBuiltinCodemods()) codemods.register(pattern);
const router = new ToolRouter(codemods, new PatternMemory());
```

## Documentation

Full operation manual: [OPERATIONS.md](https://github.com/InnovativeNectar/inno-optimize/blob/main/OPERATIONS.md)

## License

Apache-2.0
