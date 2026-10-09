# @inno-optimize/adr-automation

Architecture Decision Record automation — Generate ADRs from architectural changes with semantic code anchors, track decisions, and enforce ADR compliance in CI.

Part of [inno-optimize](https://github.com/InnovativeNectar/inno-optimize): proactive architecture & intelligence optimization for business systems, agents, and automation.

## Install

```bash
npm install @inno-optimize/adr-automation
```

## Quick start

```ts
import { ADRGenerator } from '@inno-optimize/adr-automation';

const generator = new ADRGenerator(memoryAdapter, embedder);
const adr = await generator.generateFromChange({
  id: 'change-1', type: 'new_module',
  description: 'Introduce vector store module',
  affectedFiles: ['src/stores/vector-store.ts'],
  lineRanges: {}, impact: 'high', timestamp: new Date(),
});
```

## Documentation

Full operation manual: [OPERATIONS.md](https://github.com/InnovativeNectar/inno-optimize/blob/main/OPERATIONS.md)

## License

Apache-2.0
