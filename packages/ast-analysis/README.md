# @inno-optimize/ast-analysis

Multi-language AST analysis — Tree-sitter parsing for TypeScript, JavaScript, Python, Go, Java, Rust, Ruby, and PHP — plus architecture scoring, 15 anti-pattern detectors, incremental diffs, and complexity metrics.

Part of [inno-optimize](https://github.com/InnovativeNectar/inno-optimize): proactive architecture & intelligence optimization for business systems, agents, and automation.

## Install

```bash
npm install @inno-optimize/ast-analysis
```

## Quick start

```ts
import { MultiLanguageParser, AntiPatternDetector } from '@inno-optimize/ast-analysis';

const parser = new MultiLanguageParser();
const result = await parser.parseFile('src/app.ts', source);
const issues = new AntiPatternDetector().detect(result);
```

## Documentation

Full operation manual: [OPERATIONS.md](https://github.com/InnovativeNectar/inno-optimize/blob/main/OPERATIONS.md)

## License

Apache-2.0
