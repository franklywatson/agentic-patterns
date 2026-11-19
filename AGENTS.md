# Agentic Patterns — Agent Contract

## Project Description

Reference library of patterns and working examples for building agentic AI-friendly projects. Five capability layers (L0-L4) that teams adopt where their gaps are.

## Repository Structure

```
agentic-patterns/
├── README.md                    # Overview + layer dependencies
├── AGENTS.md                    # Agent contract + master index (this file)
├── CLAUDE.md                    # Imports AGENTS.md; Claude Code-specific lines
├── docs/
│   ├── L0-foundation.md         # Deep modules, progressive disclosure
│   ├── L1-feedback-loops.md     # Closed loop design and verification (overview)
│   ├── L1-patterns/             # Individual L1 patterns (1.1-1.12 + testing infra)
│   ├── L2-behavioral-guardrails.md  # Skills, hooks, constitutional rules
│   ├── L3-optimization.md       # Token efficiency, tool routing
│   ├── L4-standards-measurement.md # Evidence, metrics, CI guardrails, context eval
│   ├── cross-cutting/
│   │   ├── anti-patterns.md
│   │   ├── adoption-guide.md
│   │   ├── threat-model.md
│   │   ├── faq.md
│   │   └── glossary.md
│   ├── references/
│   │   ├── reference-telegram-trading-bot-case-study.md
│   │   ├── further-reading.md
│   │   ├── sources.md
│   │   └── task-bank.md
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
- Examples that exist: stack tests (Pattern 1.1, TypeScript and Python), containment (Pattern 2.9, TypeScript and
  Python), repair loop (Patterns 1.7 to 1.11, TypeScript and Python), earned autonomy (Patterns A.1-A.6, TypeScript
  and Python), guardrail middleware (Pattern 3.1, TypeScript only) and project structure (L0, documentation only).
- A new example for a core pattern (L0-L2, L4 and the A-series) ships in TypeScript and Python; examples for the
  optional L3 may be single-language.

**Doc freshness:**

- If you modify code in `examples/`, update the corresponding `docs/` file in the same session.
- Code changes without doc updates are incomplete work.

**Front matter on pattern docs:**

- Every pattern doc (`docs/L0` to `docs/L4`, `docs/L1-patterns/`, `docs/earned-autonomy.md`, the cross-cutting
  guides except glossary and FAQ) starts with YAML front matter holding `last-validated-model:` (the model id the
  content was last checked against) and `reviewed:` (`YYYY-MM-DD`).
- Quoted dates and a trailing `# comment` are accepted. A future date fails, and an optional `expires:` key fails
  once it has passed. Tests: `python3 -m unittest discover -s scripts/tests`.
- Update both keys when you review or change a doc. `scripts/check-doc-freshness.py` warns at 90 days and fails at 180
  days or when a key is missing ([Pattern 0.10](docs/L0-foundation.md#pattern-010--prune-and-re-baseline-context)).

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

## Layer Documentation

**Foundation:**

- [docs/L0-foundation.md](docs/L0-foundation.md) — Deep modules, progressive disclosure, agent instruction file
  patterns, prune and re-baseline context (Pattern 0.10)

**Closed Loop Design and Verification:**

- [docs/L1-feedback-loops.md](docs/L1-feedback-loops.md) — REPL fractal loop concept, context harvesting, pattern index
- [docs/L1-patterns/1.1-stack-tests.md](docs/L1-patterns/1.1-stack-tests.md) — Stack tests
- [docs/L1-patterns/1.2-full-loop-assertions.md](docs/L1-patterns/1.2-full-loop-assertions.md) — Full-loop assertion layering
- [docs/L1-patterns/1.3-sequential-design.md](docs/L1-patterns/1.3-sequential-design.md) — Sequential / additive test design
- [docs/L1-patterns/1.4-container-isolation.md](docs/L1-patterns/1.4-container-isolation.md) — Container isolation
- [docs/L1-patterns/1.5-no-mock-philosophy.md](docs/L1-patterns/1.5-no-mock-philosophy.md) — Real dependencies in stack/E2E tests
- [docs/L1-patterns/1.6-test-integrity.md](docs/L1-patterns/1.6-test-integrity.md) — Test integrity rules
- [docs/L1-patterns/1.7-incident-to-stack-test.md](docs/L1-patterns/1.7-incident-to-stack-test.md) — Incident-to-stack-test
- [docs/L1-patterns/1.8-reversibility-blast-radius.md](docs/L1-patterns/1.8-reversibility-blast-radius.md) — Reversibility and blast-radius classes
- [docs/L1-patterns/1.9-repair-loop-frozen-oracle.md](docs/L1-patterns/1.9-repair-loop-frozen-oracle.md) — Repair loop with a frozen oracle
- [docs/L1-patterns/1.10-production-gate-progressive-confirmation.md](docs/L1-patterns/1.10-production-gate-progressive-confirmation.md) — Production gate and progressive confirmation
- [docs/L1-patterns/1.11-repair-budget-circuit-breaker-stop.md](docs/L1-patterns/1.11-repair-budget-circuit-breaker-stop.md) — Repair budget, circuit breaker, stop authority
- [docs/L1-patterns/1.12-self-healing-tests-vs-systems.md](docs/L1-patterns/1.12-self-healing-tests-vs-systems.md) — Self-healing tests vs self-healing systems
- [examples/repair-loop/README.md](examples/repair-loop/README.md) — Runnable repair loop with a deterministic gate
- [docs/L1-patterns/testing-infrastructure.md](docs/L1-patterns/testing-infrastructure.md) — Testing infrastructure is production code

**Behavioral Guardrails:**

- [docs/L2-behavioral-guardrails.md](docs/L2-behavioral-guardrails.md) — Skills, hooks, constitutional rules

**Optimization:**

- [docs/L3-optimization.md](docs/L3-optimization.md) — Token efficiency, tool routing, context isolation

**Standards & Measurement:**

- [docs/L4-standards-measurement.md](docs/L4-standards-measurement.md) — Evidence-based claims, metrics, CI guardrails, context eval

## Earned Autonomy

- [docs/earned-autonomy.md](docs/earned-autonomy.md) — Autonomy grants A1-A5, register, evidence ledger, promotion and demotion, census, tested stop
- [examples/autonomy/README.md](examples/autonomy/README.md) — Runnable register check, census, ledger, stop drill and hook (TypeScript and Python)

## Cross-Cutting Guides

- [docs/cross-cutting/anti-patterns.md](docs/cross-cutting/anti-patterns.md) — Pattern diagnostic catalog
- [docs/cross-cutting/adoption-guide.md](docs/cross-cutting/adoption-guide.md) — Suggested adoption paths for agentic practices
- [docs/cross-cutting/faq.md](docs/cross-cutting/faq.md) — Deployment, operations, and SDLC concerns beyond the patterns
- [docs/cross-cutting/threat-model.md](docs/cross-cutting/threat-model.md) — Assets, untrusted entry points,
  agent capabilities and the pattern that mitigates each
- [docs/cross-cutting/glossary.md](docs/cross-cutting/glossary.md) — Shared terminology

## References

- [docs/references/reference-telegram-trading-bot-case-study.md](docs/references/reference-telegram-trading-bot-case-study.md) — Production reference implementation
- [docs/references/further-reading.md](docs/references/further-reading.md) — External resources
- [docs/references/sources.md](docs/references/sources.md) — Citation bibliography for reference IDs
- [docs/references/task-bank.md](docs/references/task-bank.md) — 15 tasks and a run log for re-baselining context
  artefacts

## Constitutional Rules (Never Violate)

1. **Real dependencies in E2E/integration and stack tests** — Use real databases, services, and caches; mocks are appropriate in unit tests
2. **Evidence-based claims only** — "Tests pass" must show test output
3. **Zero-defect tolerance** — Every error/warning must be addressed
4. **Doc freshness mandatory** — Code changes require doc updates in same session
5. **No conditional test assertions** — Tests that can silently pass are forbidden
6. **Short, owned, tested, re-baselined** — This file has a named owner and a reviewed date, CI checks it (a warning
   above about 200 lines), and it is pruned against the current model at each model upgrade by running the [task
   bank](docs/references/task-bank.md) without each rule ([Pattern
   0.10](docs/L0-foundation.md#pattern-010--prune-and-re-baseline-context)). Link to docs for anything longer.

---

**Owner**: franklywatson
**Last reviewed**: 2026-11-19
