# Agentic Patterns — Agent Contract

## Project Description

Reference library of patterns and working examples for building agentic AI-friendly projects. Progressive capability pyramid (L0-L4) that teams adopt incrementally.

## Repository Structure

```
agentic-patterns/
├── README.md                    # Overview + pyramid visualization
├── AGENTS.md                    # Agent contract + master index (this file)
├── CLAUDE.md                    # Imports AGENTS.md; Claude Code-specific lines
├── docs/
│   ├── L0-foundation.md         # Deep modules, progressive disclosure
│   ├── L1-feedback-loops.md     # Closed loop design and verification (overview)
│   ├── L1-patterns/             # Individual L1 patterns (1.1-1.6 + testing infra)
│   ├── L2-behavioral-guardrails.md  # Skills, hooks, constitutional rules
│   ├── L3-optimization.md       # Token efficiency, smart routing
│   ├── L4-standards-measurement.md # Evidence, drift detection, metrics
│   ├── cross-cutting/
│   │   ├── anti-patterns.md
│   │   ├── adoption-guide.md
│   │   └── glossary.md
│   ├── references/
│   │   ├── reference-telegram-trading-bot-case-study.md
│   │   ├── further-reading.md
│   │   └── sources.md
│   └── refresh/                 # Working material for the current revision
├── examples/                    # Working code (TS + Python)
└── docs/diagrams/               # Diagrams for L1-L4
```

See [README.md](README.md) for detailed project overview.

## Writing Rules for This Repository

**When writing docs:**

- Language must be precise. No filler ("basically", "just", "simply").
- No vague requirements ("make it fast", "clean it up").
- Every claim must be specific and verifiable.

**When writing examples:**

- Working code only. No TODOs, no placeholders.
- All examples must run as-is.
- TypeScript and Python versions for each core pattern (L0-L2, L4); examples for the optional L3 may be single-language.

**Doc freshness:**

- If you modify code in `examples/`, update the corresponding `docs/` file in the same session.
- Code changes without doc updates are incomplete work.

**Master index requirement:**

- Every doc in this repo must be reachable from AGENTS.md (this file), which CLAUDE.md imports.
- This is the entry point — agents discover all project docs from here.

## Markdown Conventions

- Headers: `#` for page title, `##` for main sections, `###` for subsections
- Code blocks: Specify language (\`\`\`typescript, \`\`\`python)
- Links: Relative paths for internal docs (`../docs/L0-foundation.md`)
- Lists: Use `-` for bullet points, numbered lists for sequences
- No emoji in code files or docs (exception: README.md may use sparingly for visual impact)
- Line length: Prefer 80-100 chars, hard limit 120

## Level Documentation

**Foundation:**

- [docs/L0-foundation.md](docs/L0-foundation.md) — Deep modules, progressive disclosure, agent instruction file patterns

**Closed Loop Design and Verification:**

- [docs/L1-feedback-loops.md](docs/L1-feedback-loops.md) — REPL fractal loop concept, context harvesting, pattern index
- [docs/L1-patterns/1.1-stack-tests.md](docs/L1-patterns/1.1-stack-tests.md) — Stack tests
- [docs/L1-patterns/1.2-full-loop-assertions.md](docs/L1-patterns/1.2-full-loop-assertions.md) — Full-loop assertion layering
- [docs/L1-patterns/1.3-sequential-design.md](docs/L1-patterns/1.3-sequential-design.md) — Sequential / additive test design
- [docs/L1-patterns/1.4-container-isolation.md](docs/L1-patterns/1.4-container-isolation.md) — Container isolation
- [docs/L1-patterns/1.5-no-mock-philosophy.md](docs/L1-patterns/1.5-no-mock-philosophy.md) — Real dependencies in stack/E2E tests
- [docs/L1-patterns/1.6-test-integrity.md](docs/L1-patterns/1.6-test-integrity.md) — Test integrity rules
- [docs/L1-patterns/testing-infrastructure.md](docs/L1-patterns/testing-infrastructure.md) — Testing infrastructure is production code

**Behavioral Guardrails:**

- [docs/L2-behavioral-guardrails.md](docs/L2-behavioral-guardrails.md) — Skills, hooks, constitutional rules

**Optimization:**

- [docs/L3-optimization.md](docs/L3-optimization.md) — Token efficiency, smart routing, guardrail middleware

**Standards & Measurement:**

- [docs/L4-standards-measurement.md](docs/L4-standards-measurement.md) — Evidence-based claims, drift detection, metrics

## Cross-Cutting Guides

- [docs/cross-cutting/anti-patterns.md](docs/cross-cutting/anti-patterns.md) — Pattern diagnostic catalog
- [docs/cross-cutting/adoption-guide.md](docs/cross-cutting/adoption-guide.md) — Suggested adoption paths for agentic practices
- [docs/cross-cutting/faq.md](docs/cross-cutting/faq.md) — Deployment, operations, and SDLC concerns beyond the patterns
- [docs/cross-cutting/glossary.md](docs/cross-cutting/glossary.md) — Shared terminology

## References

- [docs/references/reference-telegram-trading-bot-case-study.md](docs/references/reference-telegram-trading-bot-case-study.md) — Production reference implementation
- [docs/references/further-reading.md](docs/references/further-reading.md) — External resources
- [docs/references/sources.md](docs/references/sources.md) — Citation bibliography for reference IDs

## Active Work

- [docs/refresh/README.md](docs/refresh/README.md) — Nov 2026 refresh: critical review, decisions and phased plans.
  Plain link, not an `@` import, so the review corpus does not load into every session.

## Constitutional Rules (Never Violate)

1. **Real dependencies in E2E/integration and stack tests** — Use real databases, services, and caches; mocks are appropriate in unit tests
2. **Evidence-based claims only** — "Tests pass" must show test output
3. **Zero-defect tolerance** — Every error/warning must be addressed
4. **Doc freshness mandatory** — Code changes require doc updates in same session
5. **No conditional test assertions** — Tests that can silently pass are forbidden
6. **Short, owned, tested, re-baselined** — This file has a named owner and a reviewed date, CI checks it (a warning above about 200 lines), and it is pruned against the current model at each model upgrade. Link to docs for anything longer.

---

**Owner**: franklywatson
**Last reviewed**: 2026-11-19
