# Adoption Guide — Paths to Agentic Development

Suggested approaches for teams adopting agentic development patterns incrementally. Not a rigid plan — a set of paths teams have found useful.

**Core principle:** Each pattern level delivers value independently. L0 Foundation alone dramatically improves agent navigation. You don't need L4 to benefit from L0. Start where your gaps are, adopt what helps.

---

## Assessment: Where Are You Now?

Before choosing a path, assess your current state. Run through this checklist to identify gaps.

### Entry Points

- [ ] CLAUDE.md exists and is under 150 lines
- [ ] README.md clearly explains what the project does
- [ ] CLAUDE.md links to all relevant documentation
- [ ] File structure is grouped by domain, not layer

### Testing

- [ ] Stack tests and E2E/integration tests use real components (no mocks for owned services)
- [ ] Tests run in isolated environments (no shared state)
- [ ] Test failures provide clear diagnostic signals
- [ ] Tests assert on side effects, not just responses

### Documentation

- [ ] Every pattern is documented with examples
- [ ] Code examples in docs match current codebase
- [ ] Documentation is linked from CLAUDE.md
- [ ] No orphaned docs (all reachable from master index)

### Tooling

- [ ] Git worktrees are used for feature branches
- [ ] Linting/formatting is automated
- [ ] Pre-commit hooks enforce basic rules
- [ ] CI runs tests in isolated environments

### The New Starter Test

The ultimate assessment: give someone (or an agent) with zero context your CLAUDE.md + README + file structure. Can they answer these questions without asking for help?

1. What does this project do?
2. How do I run it locally?
3. Where do I add a new feature?
4. What patterns should I follow?
5. How do I test my changes?
6. What must I never do?

Document every assumption they had to make. Each assumption is a gap.

### Gap Identification by Pyramid Level

| Level | Focus | Common Gaps | Quick Win |
|-------|-------|-------------|-----------|
| **L0 Foundation** | Structure, CLAUDE.md, doc freshness, cleanup | No CLAUDE.md, layer-based organization, stale docs | Write CLAUDE.md, restructure by domain |
| **L1 Closed Loop Design** | Design-led verification with stack tests | Mock-heavy stack/E2E tests, shallow assertions | Add app-startup stack test |
| **L2 Guardrails** | Skills, hooks, behavioral rules | No enforcement, agents make common errors | Add test-integrity skill |
| **L3 Optimization** | Smart routing, structured search | Raw grep/cat commands, token waste | Set up jcodemunch indexing |
| **L4 Standards & Measurement** | Evidence, drift detection, metrics | Claims without evidence, spec drift | Establish evidence standard |

---

## Adoption Paths

Three paths teams have used. Choose based on your situation.

### Path A: Foundation-First (Most Teams)

Start with L0, the highest-impact, lowest-effort starting point. Then build upward.

1. **L0 Foundation** — Restructure by domain, write CLAUDE.md, establish doc freshness and cleanup practices. See [L0-foundation.md](../L0-foundation.md).
2. **L1 Closed Loop Design** — Add stack tests for your most critical user journeys. See [L1-feedback-loops.md](../L1-feedback-loops.md) and the working examples in [examples/stack-test/](../../examples/stack-test/).
3. **L2 Guardrails** — Add skills and hooks for your project's most common errors. See [L2-behavioral-guardrails.md](../L2-behavioral-guardrails.md).
4. **L3 Optimization** — Set up structured search and routing. See [L3-optimization.md](../L3-optimization.md) and the working example in [examples/guardrails/](../../examples/guardrails/).
5. **L4 Standards & Measurement** — Add drift detection and metrics when the earlier levels are stable. See [L4-standards-measurement.md](../L4-standards-measurement.md).

### Path B: Testing-First (Teams with Mock Pain)

If your integration tests are the biggest pain point, start at L1.

1. **L1** — Add stack tests for your most brittle integration test areas. Remove mocks for owned services in stack tests (mocks are fine in unit tests). See [Pattern 1.1 — Stack Tests](../L1-feedback-loops.md#pattern-11--stack-tests) and [examples/stack-test/](../../examples/stack-test/).
2. **L0** — Once stack tests are working, structure the project to make them maintainable. Deep modules, CLAUDE.md, progressive disclosure.
3. **L2-L4** — Continue upward as in Path A.

### Path C: Guardrails-First (Teams with Agent Errors)

If agents are making consistent errors (wrong mocking in stack tests, missing tests, ignoring rules), start at L2.

1. **L2** — Add skills for your most violated rules, hooks to block destructive patterns. See [L2-behavioral-guardrails.md](../L2-behavioral-guardrails.md).
2. **L0** — Structure the project so agents have clear context to work with.
3. **L1, L3-L4** — Fill in remaining levels as capacity allows.

---

## What to Read for Each Level

The pattern docs contain the detailed guidance. This guide links to them rather than duplicating content.

| Level | Start With | Working Example |
|-------|-----------|-----------------|
| L0 | [L0-foundation.md](../L0-foundation.md) — Deep modules, CLAUDE.md, progressive disclosure | [examples/project-structure/](../../examples/project-structure/) |
| L1 | [L1-feedback-loops.md](../L1-feedback-loops.md) — Context harvesting, stack tests, full-loop assertions | [examples/stack-test/typescript/](../../examples/stack-test/typescript/) or [examples/stack-test/python/](../../examples/stack-test/python/) |
| L2 | [L2-behavioral-guardrails.md](../L2-behavioral-guardrails.md) — Skills, hooks, constitutional rules | [superpowers](https://github.com/obra/superpowers) or [rig](https://github.com/franklywatson/claude-rig) |
| L3 | [L3-optimization.md](../L3-optimization.md) — Smart routing, structured search, scout pattern | [examples/guardrails/](../../examples/guardrails/) |
| L4 | [L4-standards-measurement.md](../L4-standards-measurement.md) — Evidence, drift detection, metrics | — |

### Reference Implementations

| System | What it implements | Language |
|--------|-------------------|----------|
| [rig](https://github.com/franklywatson/claude-rig) | L2 enforcement pipeline, L3 tool routing + scout agent, skill chain with phase transitions, CLI installer | TypeScript |
| [gstack](https://github.com/garrytan/gstack) | L2 skill framework with resolver pipeline, preamble system | TypeScript |
| [superpowers](https://github.com/obra/superpowers) | L2 base skills (brainstorming, TDD, verification, review), worktree management | Markdown/JS |

---

## Key Success Factors

1. **Incremental adoption** — Each level delivers value independently. Don't try to implement everything at once.
2. **Start with L0 if unsure** — Structure and CLAUDE.md have the highest ROI for the least effort.
3. **Update docs in the same task as code** — Deferred documentation is stale documentation. See [Pattern 0.7 — Documentation as System Map](../L0-foundation.md#pattern-07--documentation-as-system-map).
4. **Remove dead code as you find it** — Cleanup is continuous, not periodic. See [Pattern 0.8 — Aggressive Cleanup](../L0-foundation.md#pattern-08--aggressive-cleanup).
5. **Use the New Starter Test regularly** — It catches gaps that code review misses. See [Pattern 4.3 — New Starter Standard](../L4-standards-measurement.md#pattern-43--new-starter-standard).

### Common Pitfalls

- **Skipping assessment** — Without understanding your gaps, you may optimize the wrong things.
- **Deferring documentation** — "I'll update the docs later" means the docs stay stale.
- **Allowing constitutional rule exceptions** — Rules that bend become suggestions, and suggestions erode.
- **Treating cleanup as a quarterly sprint** — Dead code is noise. Remove it as you encounter it.

---

## Further Reading

- [L0 Foundation](../L0-foundation.md) — Project structure patterns
- [L1 Closed Loop Design](../L1-feedback-loops.md) — Design-led verification
- [L2 Behavioral Guardrails](../L2-behavioral-guardrails.md) — Skills and hooks
- [L3 Optimization](../L3-optimization.md) — Token efficiency
- [L4 Standards & Measurement](../L4-standards-measurement.md) — Evidence, drift detection, metrics
- [Anti-Patterns](./anti-patterns.md) — Common mistakes to avoid
- [Reference Implementation Case Study](../references/reference-telegram-trading-bot-case-study.md) — Production validation
