# @inno-optimize/agentdb

Vector database for agents — FastStore: SQLite-backed vector store with HNSW indexing, product quantization (pq4/pq8/binary/RaBitQ), hybrid search, 3-tier memory, and provenance-tracked entries.

Part of [inno-optimize](https://github.com/InnovativeNectar/inno-optimize): proactive architecture & intelligence optimization for business systems, agents, and automation.

## Install

```bash
npm install @inno-optimize/agentdb
```

## Quick start

```ts
import { FastStore } from '@inno-optimize/agentdb';

const store = new FastStore({
  path: './memory.db',
  dimensions: 384,
  hnsw: { M: 16, efConstruction: 200, efSearch: 100, maxElements: 100000 },
  quantization: { defaultLevel: 'pq8' },
});
await store.initialize();
// await store.insert(entries);
// const hits = await store.search({ vector, textQuery: 'query', k: 5 });
await store.close();
```

## Documentation

Full operation manual: [OPERATIONS.md](https://github.com/InnovativeNectar/inno-optimize/blob/main/OPERATIONS.md)

## License

Apache-2.0
