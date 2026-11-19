# Agentic Patterns — Agent Contract

## Project Description

Reference library of patterns and runnable examples for AI coding agents. Five layers, L0 to L4, say what to build;
teams adopt them where their gaps are. Earned Autonomy says how far one workflow may run without a person. People
start at [README.md](README.md); agents use the index below, from which every doc is reachable.

## Constitutional Rules (Never Violate)

1. **Real dependencies in E2E/integration and stack tests** — Use real databases, services, and caches; mocks are appropriate in unit tests
2. **Evidence-based claims only** — "Tests pass" shows the test output, and the reviewer reads the CI run; output
   the agent pastes with no CI run behind it is a claim, not evidence
   ([Pattern 4.1](docs/L4-standards-measurement.md#pattern-41--evidence-based-claims))
3. **Zero-defect tolerance** — Every error/warning must be addressed
4. **Doc freshness mandatory** — Code changes require doc updates in same session
5. **No conditional test assertions** — Tests that can silently pass are forbidden
6. **Short, owned, tested, re-baselined** — This file has a named owner and a reviewed date, CI checks it (a warning
   above about 200 lines), and it is pruned against the current model at each model upgrade by running the [task
   bank](docs/references/task-bank.md) without each rule ([Pattern
   0.10](docs/L0-foundation.md#pattern-010--prune-and-re-baseline-context)). Link to docs for anything longer.

## Index

Pattern numbers are stable identifiers and are not contiguous.

**Start here:**

- [README.md](README.md) — Overview, scales and reading path by role
- [docs/cross-cutting/adoption-guide.md](docs/cross-cutting/adoption-guide.md) — Assessment and adoption paths
- [docs/cross-cutting/glossary.md](docs/cross-cutting/glossary.md) — Shared terminology
- [docs/cross-cutting/faq.md](docs/cross-cutting/faq.md) — Deployment, operations and SDLC concerns beyond the patterns

**L0 Foundation:**

- [docs/L0-foundation.md](docs/L0-foundation.md) — Deep modules, progressive disclosure, agent instruction file,
  prune and re-baseline context (Patterns 0.1, 0.2, 0.4 to 0.10)
- [examples/project-structure/README.md](examples/project-structure/README.md) — Before and after directory layouts

**L1 Closed Loop Design and Verification:**

- [docs/L1-feedback-loops.md](docs/L1-feedback-loops.md) — REPL fractal loop, context harvesting, pattern index
- [docs/L1-patterns/1.1-stack-tests.md](docs/L1-patterns/1.1-stack-tests.md) — Stack tests, including testing infrastructure as production code
- [docs/L1-patterns/1.2-full-loop-assertions.md](docs/L1-patterns/1.2-full-loop-assertions.md) — Full-loop assertion layering
- [docs/L1-patterns/1.3-sequential-design.md](docs/L1-patterns/1.3-sequential-design.md) — Sequential / additive test design
- [docs/L1-patterns/1.4-container-isolation.md](docs/L1-patterns/1.4-container-isolation.md) — Container isolation
- [docs/L1-patterns/1.5-real-dependencies.md](docs/L1-patterns/1.5-real-dependencies.md) — Real dependencies in stack/E2E tests
- [docs/L1-patterns/1.6-test-integrity.md](docs/L1-patterns/1.6-test-integrity.md) — Test integrity rules
- [docs/L1-patterns/1.7-incident-to-stack-test.md](docs/L1-patterns/1.7-incident-to-stack-test.md) — Incident-to-stack-test
- [docs/L1-patterns/1.8-reversibility-blast-radius.md](docs/L1-patterns/1.8-reversibility-blast-radius.md) — Reversibility and blast-radius classes
- [docs/L1-patterns/1.9-repair-loop-frozen-oracle.md](docs/L1-patterns/1.9-repair-loop-frozen-oracle.md) — Repair loop with a frozen oracle
- [docs/L1-patterns/1.10-production-gate-progressive-confirmation.md](docs/L1-patterns/1.10-production-gate-progressive-confirmation.md) — Production gate and progressive confirmation
- [docs/L1-patterns/1.11-repair-budget-circuit-breaker-stop.md](docs/L1-patterns/1.11-repair-budget-circuit-breaker-stop.md) — Repair budget, circuit breaker, stop authority
- [docs/L1-patterns/1.12-self-healing-tests-vs-systems.md](docs/L1-patterns/1.12-self-healing-tests-vs-systems.md) — Self-healing tests vs self-healing systems
- [examples/stack-test/typescript/README.md](examples/stack-test/typescript/README.md) — Stack tests with Playwright
- [examples/stack-test/python/README.md](examples/stack-test/python/README.md) — Stack tests with pytest
- [examples/repair-loop/README.md](examples/repair-loop/README.md) — Runnable repair loop with a deterministic gate

**L2 Behavioral Guardrails:**

- [docs/L2-behavioral-guardrails.md](docs/L2-behavioral-guardrails.md) — Skills, hooks, constitutional rules, zero-defect
  tolerance, compound engineering (2.1, 2.3 to 2.5, 2.8); containment, least agency, identity, supply chain,
  risk-tiered review (2.9 to 2.13)
- [examples/containment/README.md](examples/containment/README.md) — Runnable policy layer against a container boundary
  (TypeScript and Python)

**L3 Optimization (optional):**

- [docs/L3-optimization.md](docs/L3-optimization.md) — Token efficiency, tool routing, context isolation (3.1, 3.2)
- [examples/guardrails/README.md](examples/guardrails/README.md) — Token-optimization middleware (TypeScript)

**L4 Standards and Measurement:**

- [docs/L4-standards-measurement.md](docs/L4-standards-measurement.md) — Evidence-based claims, metrics, CI
  guardrails, context eval (4.1, 4.4 to 4.6); author of record, deliberate practice (4.7, 4.9)
- [docs/references/task-bank.md](docs/references/task-bank.md) — 15 tasks and a run log for re-baselining context
  artefacts

**Earned Autonomy:**

- [docs/earned-autonomy.md](docs/earned-autonomy.md) — The curve and the cap, autonomy grants A1-A5, register,
  evidence ledger, promotion and demotion, census, tested stop, hooks (A.1 to A.6)
- [examples/autonomy/README.md](examples/autonomy/README.md) — Runnable register check, census, ledger, stop drill and hook
  (TypeScript and Python)

**Security and diagnosis:**

- [docs/cross-cutting/threat-model.md](docs/cross-cutting/threat-model.md) — Assets, untrusted entry points,
  agent capabilities and the pattern that mitigates each
- [docs/cross-cutting/anti-patterns.md](docs/cross-cutting/anti-patterns.md) — Pattern diagnostic catalog

**References:**

- [docs/references/reference-telegram-trading-bot-case-study.md](docs/references/reference-telegram-trading-bot-case-study.md) — The reference project the patterns came from, with what it shows and what it does not
- [docs/references/further-reading.md](docs/references/further-reading.md) — External resources
- [docs/references/sources.md](docs/references/sources.md) — Citation bibliography for reference IDs

## Repository Structure

```
agentic-patterns/
├── README.md                    # Overview, scales, reading path by role
├── AGENTS.md                    # Agent contract + master index (this file)
├── CLAUDE.md                    # Imports AGENTS.md; Claude Code-specific lines
├── docs/
│   ├── L0-foundation.md         # Deep modules, progressive disclosure
│   ├── L1-feedback-loops.md     # Closed loop design and verification (overview)
│   ├── L1-patterns/             # Individual L1 patterns (1.1-1.12)
│   ├── L2-behavioral-guardrails.md  # Skills, hooks, constitutional rules, containment
│   ├── L3-optimization.md       # Token efficiency, tool routing (optional)
│   ├── L4-standards-measurement.md # Evidence, metrics, CI guardrails, context eval
│   ├── earned-autonomy.md       # Curve, cap, grants, register, ledger, census
│   ├── diagrams/                # Diagrams for the README and layer docs
│   ├── cross-cutting/           # Adoption guide, anti-patterns, threat model, FAQ, glossary
│   └── references/              # Case study, further reading, sources, task bank
├── examples/                    # Working code (TS + Python)
└── scripts/                     # Doc checks: links, reachability, freshness, sources
```

## Writing Rules for This Repository

**When writing docs:**

- Language must be precise. No filler ("basically", "just", "simply").
- No vague requirements ("make it fast", "clean it up").
- Every claim must be specific and verifiable.

**When writing examples:**

- Working code only. No TODOs, no placeholders.
- All examples must run as-is.
- Examples require Node 22 or later.
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
- Line length: target 100 characters for prose; no hard limit for tables, links and code

---

**Owner**: franklywatson
**Last reviewed**: 2026-11-19
