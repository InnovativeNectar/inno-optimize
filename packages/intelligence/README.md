# @inno-optimize/intelligence

Adaptive agent intelligence — SONA adapter, ReasoningBank experience replay, MoE expert routing, and EWC++ consolidation — unified behind IntelligenceLayer for task processing.

Part of [inno-optimize](https://github.com/InnovativeNectar/inno-optimize): proactive architecture & intelligence optimization for business systems, agents, and automation.

## Install

```bash
npm install @inno-optimize/intelligence
```

## Quick start

```ts
import { IntelligenceLayer } from '@inno-optimize/intelligence';

const intel = new IntelligenceLayer(store); // FastStore instance
const { sonaAdaptation, routing, pattern } = await intel.processTask({
  id: 'task-1', type: 'refactor', description: 'Extract payment saga',
  constraints: [], acceptanceCriteria: [], mode: 'convergent',
});
```

## Documentation

Full operation manual: [OPERATIONS.md](https://github.com/InnovativeNectar/inno-optimize/blob/main/OPERATIONS.md)

## License

Apache-2.0
