# Agentic Patterns — Project Constitution

## Project Description

Reference library of patterns and working examples for building agentic AI-friendly projects. Progressive capability pyramid (L0-L4) that teams adopt incrementally.

## Repository Structure

```
agentic-patterns/
├── README.md                    # Overview + pyramid visualization
├── CLAUDE.md                    # This file — agent contract + master index
├── docs/
│   ├── L0-foundation.md         # Deep modules, progressive disclosure
│   ├── L1-feedback-loops.md     # Stack tests, full-loop assertions
│   ├── L2-behavioral-guardrails.md  # Skills, hooks, constitutional rules
│   ├── L3-optimization.md       # Token efficiency, smart routing
│   ├── L4-culture.md            # Rigor, docs, cleanup
│   ├── cross-cutting/
│   │   ├── anti-patterns.md
│   │   ├── migration-guide.md
│   │   └── glossary.md
│   └── references/
│       ├── reference-telegram-trading-bot-case-study.md
│       └── further-reading.md
├── examples/                    # Working code (TS + Python)
├── docs/diagrams/               # Excalidraw diagrams for L1-L4
├── docs/specs/                  # Design specifications
└── docs/plans/                  # Implementation plans
```

See @README.md for detailed project overview.

## Writing Rules for This Repository

**When writing docs:**
- Language must be precise. No filler ("basically", "just", "simply").
- No vague requirements ("make it fast", "clean it up").
- Every claim must be specific and verifiable.

**When writing examples:**
- Working code only. No TODOs, no placeholders.
- All examples must run as-is.
- TypeScript and Python versions for each pattern.

**Doc freshness:**
- If you modify code in `examples/`, update the corresponding `docs/` file in the same session.
- Code changes without doc updates are incomplete work.

**Master index requirement:**
- Every doc in this repo must be reachable from CLAUDE.md (this file).
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
- @docs/L0-foundation.md — Deep modules, progressive disclosure, CLAUDE.md patterns

**Feedback Loops:**
- @docs/L1-feedback-loops.md — Stack tests, full-loop assertions, sequential design

**Behavioral Guardrails:**
- @docs/L2-behavioral-guardrails.md — Skills, hooks, constitutional rules

**Optimization:**
- @docs/L3-optimization.md — Token efficiency, smart routing, guardrail middleware

**Culture:**
- @docs/L4-culture.md — Rigor, documentation maintenance, cleanup standards

## Cross-Cutting Guides

- @docs/cross-cutting/anti-patterns.md — Common mistakes to avoid
- @docs/cross-cutting/migration-guide.md — Adopting agentic practices incrementally
- @docs/cross-cutting/glossary.md — Shared terminology

## References

- @docs/references/reference-telegram-trading-bot-case-study.md — Production reference implementation
- @docs/references/further-reading.md — External resources

## Constitutional Rules (Never Violate)

1. **No mocking core system components** — Use real databases, real services, real blockchains
2. **Evidence-based claims only** — "Tests pass" must show test output
3. **Zero-defect tolerance** — Every error/warning must be addressed
4. **Doc freshness mandatory** — Code changes require doc updates in same session
5. **No conditional test assertions** — Tests that can silently pass are forbidden
6. **CLAUDE.md line limit** — Hard maximum 150 lines. Link to external docs beyond that.

---

**Last updated**: 2026-03-26
**Status**: Initial constitution — v0.1.0
