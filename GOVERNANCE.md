# GOVERNANCE.md — inno-optimize Development Governance

> **Authority**: This document governs all development practices for inno-optimize.
> **Enforcement**: Automated via CI/CD + agent enforcement. Violations block merge.

---

## 1. Development Workflow

### Branch Strategy
- `main` — Protected, only via PR
- `feature/*` — Feature branches from `main`
- `fix/*` — Bug fixes from `main`
- `refactor/*` — Refactoring from `main`

### PR Requirements
- [ ] ADR linked for any architectural change
- [ ] TypeScript compiles (`tsc --noEmit`)
- [ ] Lint passes (`eslint`)
- [ ] Tests pass (`vitest run`)
- [ ] Coverage > 80% (`vitest run --coverage`)
- [ ] No regression >5% (`npm run benchmark`)
- [ ] Security audit passes (`npm audit`)
- [ ] ADR linked in PR description
- [ ] Decision logged in AgentDB (post-merge)

### Commit Message Format
```
<type>(<scope>): <subject>

<body>

ADR: <adr-number>
```

Types: `feat`, `fix`, `refactor`, `perf`, `docs`, `test`, `chore`, `build`, `ci`

---

## 2. Architecture Governance

### ADR Process
1. **Trigger**: Any structural change, new dependency, breaking change, data model change
2. **Create**: ADR in `docs/adr/NNN-title.md` using template
3. **Review**: `architect` agent + `reviewer` agent + human
4. **Merge**: ADR committed with code
5. **Log**: Decision recorded in AgentDB

### ADR Template
```markdown
# ADR NNN: Title

## Status
Proposed | Accepted | Superseded

## Context
Problem statement, constraints, assumptions

## Decision
Chosen approach with rationale

## Alternatives Considered
- Option A: pros/cons
- Option B: pros/cons

## Consequences
- Positive:
- Negative:
- Risks:

## References
- Links to related ADRs, issues, docs
```

---

## 3. Code Quality Standards

### TypeScript Configuration
- **Strict mode**: Enabled
- **No `any`**: Without explicit justification comment
- **Strict null checks**: Enabled
- **No implicit any**: Enabled
- **Unused variables**: Error

### Code Style
- **Format**: Prettier (via ESLint)
- **Imports**: Sorted, grouped (external → internal → relative)
- **Naming**: `camelCase` vars/functions, `PascalCase` types/classes, `UPPER_SNAKE` constants
- **Async**: Always `async/await`, no bare promises
- **Errors**: Custom error classes, never throw primitives

### Testing Standards
- **Unit**: >80% line coverage
- **Integration**: Critical paths covered
- **Property-based**: For algorithms, parsers, serializers
- **Mutation**: Stryker for critical paths
- **Benchmarks**: Required for performance claims

---

## 4. Dependency Management

### Adding Dependencies
1. Check: Is it in top 1000 npm packages? Actively maintained?
2. Check: License compatible (MIT, Apache-2.0, BSD-3)?
3. Check: No duplicate functionality already in codebase
4. Check: Bundle size impact < 50KB gzipped
5. Approve: `security` agent + `reviewer`

### Dependency Updates
- **Patch**: Auto-merge if tests pass (Dependabot)
- **Minor**: Manual review, test run required
- **Major**: ADR required, full test suite + benchmark

### Prohibited
- `any` without justification comment
- `@ts-ignore` without justification comment
- `eval`, `Function` constructor
- `with` statement
- Circular dependencies

---

## 5. Security Governance

### Secrets Management
- **Never** commit secrets (`.env*`, `*.key`, `*.pem`, `*.p12`)
- Use `.env.example` for templates
- Runtime secrets: Vault / AWS Secrets Manager / GitHub Secrets
- Pre-commit: `git-secrets` + `truffleHog`

### Code Security
- Input validation: Zod schemas on all inputs
- SQL: Parameterized queries only (no string concat)
- XSS: CSP headers, output encoding
- CSRF: SameSite cookies, CSRF tokens
- Rate limiting: All public endpoints

### Supply Chain
- `npm audit` on every CI run
- `snyk test` weekly
- Lockfile pinned (`package-lock.json` committed)
- SBOM generated on release (`npm sbom`)

---

## 5. Performance Governance

### Benchmarks Required For
- New algorithms / data structures
- Database queries (EXPLAIN ANALYZE)
- Hot paths (>1000 req/s)
- Memory allocation patterns

### Regression Thresholds
- Latency: +5% p99
- Throughput: -5%
- Memory: +10%
- Bundle size: +10%

### Profiling
- `clinic doctor` on startup
- `0x` flamegraphs for CPU
- `memwatch-next` for leaks

---

## 6. Documentation Standards

### Required Documentation
- **README**: Project purpose, quick start, config
- **API**: OpenAPI/Swagger for all HTTP/gRPC
- **ADRs**: All architectural decisions
- **Runbooks**: Operational procedures
- **Onboarding**: `docs/UA_ONBOARDING.md`

### Code Comments
- **Public APIs**: JSDoc with `@param`, `@returns`, `@throws`
- **Complex logic**: Why, not what
- **TODOs**: Must have issue link (`// TODO(#123): reason`)

---

## 7. Release & Deployment

### Versioning
- **Semantic Versioning**: MAJOR.MINOR.PATCH
- **Breaking**: MAJOR + ADR + migration guide
- **Features**: MINOR + ADR if architectural
- **Fixes**: PATCH

### Release Process
1. `npm version <type>` — updates package.json, creates tag
2. `npm run build` — clean build
3. `npm run test` — full test suite
4. `npm run benchmark` — no regression
5. `npm publish` — to npm registry
6. GitHub Release with changelog

---

## 8. Operational Standards

### Observability
- **Metrics**: Prometheus format, `/metrics` endpoint
- **Logs**: Structured JSON, correlation IDs
- **Traces**: OpenTelemetry, W3C TraceContext
- **Alerts**: PagerDuty / OpsGenie integration

### Incident Response
- Runbooks in `docs/runbooks/`
- Postmortem template in `docs/templates/`
- Blameless postmortems within 48h

---

## 9. Enforcement Matrix

| Violation | Detection | Action |
|-----------|-----------|--------|
| No ADR for arch change | CI check | Block merge |
| TypeScript errors | `tsc --noEmit` | Block merge |
| Lint warnings | ESLint | Block merge |
| Test failures | Vitest | Block merge |
| Coverage <80% | Vitest coverage | Block merge |
| Benchmark regression | CI benchmark | Block merge |
| Critical vuln | npm audit | Block merge |
| Secret detected | git-secrets | Block commit |
| Circular deps | Madge | Block merge |

---

## 10. Continuous Improvement

### Retrospectives
- **Sprint**: Every 2 weeks
- **Architecture**: Quarterly
- **Security**: Monthly
- **Performance**: Per release

### Metrics Tracked
- Lead time (commit → deploy)
- Change failure rate
- MTTR (mean time to recovery)
- Deployment frequency
- Customer-reported bugs

---

## Appendix: Useful Commands

```bash
# Full quality gate
npm run build && npm run lint && npm run test && npm run benchmark

# Quick check
npm run typecheck && npm run lint

# Security audit
npm audit && npx snyk test

# Benchmark
npm run benchmark

# Generate ADR template
npx inno-optimize adr:template

# Query AgentDB
npx inno-optimize memory query "pattern"

# Update dependencies
npx npm-check-updates -u && npm install
```

---

**Last Updated**: 2026-10-05
**Version**: 1.0.0
**Owner**: Architecture Team