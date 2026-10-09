# @inno-optimize/coordination

Multi-agent coordination — Hive-Mind swarm (queen-led mesh, Raft/Byzantine consensus), saga orchestrator with compensation, pheromone scheduler, and the business MCP server registry.

Part of [inno-optimize](https://github.com/InnovativeNectar/inno-optimize): proactive architecture & intelligence optimization for business systems, agents, and automation.

## Install

```bash
npm install @inno-optimize/coordination
```

## Quick start

```ts
import { businessServers, getServerByName, getServersByCapability } from '@inno-optimize/coordination';

const orders = getServerByName('business-orders');
// orders.tools, orders.tier, orders.capabilities, orders.destructive
```

## Documentation

Full operation manual: [OPERATIONS.md](https://github.com/InnovativeNectar/inno-optimize/blob/main/OPERATIONS.md)

## License

Apache-2.0
