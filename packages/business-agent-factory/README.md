# @inno-optimize/business-agent-factory

Business agent factory — 35 ready-to-run business agent templates across 11 departments (sales, marketing, engineering, support, operations, finance, HR, product, legal, security, data) with configurable memory and tools.

Part of [inno-optimize](https://github.com/InnovativeNectar/inno-optimize): proactive architecture & intelligence optimization for business systems, agents, and automation.

## Install

```bash
npm install @inno-optimize/business-agent-factory
```

## Quick start

```ts
import { AgentFactory, createDefaultTemplateManager } from '@inno-optimize/business-agent-factory';

const templates = createDefaultTemplateManager(); // 35 templates
const factory = new AgentFactory(templates);
const agent = await factory.createAgent({ templateId: 'sales-rep' });
const result = await agent.execute('Qualify lead Acme Corp');
```

## Documentation

Full operation manual: [OPERATIONS.md](https://github.com/InnovativeNectar/inno-optimize/blob/main/OPERATIONS.md)

## License

Apache-2.0
