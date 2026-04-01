# Implementation Plan — Session 2026-03-31

**Status**: In progress — session restart required. Resume from Task #2 (partially complete).

---

## Task Summary

7 tasks, ordered by dependency. Task #2 is partially complete (README reframed).

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Add L4 disclaimer | pending | Small — add disclaimer to L4 doc |
| 2 | Reframe README | **in progress** | README reframed. Need to rename migration-guide → adoption-guide |
| 3 | Break down L1 + add REPL concept | pending | Split L1-feedback-loops.md, integrate REPL fractal loop concept |
| 4 | Revise/remove migration-guide | **merged into #2** | User said "remove or revise to be less prescriptive" — rename to adoption-guide.md, slim down |
| 5 | Extend TS stack-test with Playwright | pending | Add browser-driven tests to examples/stack-test/typescript/ |
| 6 | Implement cross-ref spec | pending | New patterns (2.6, 2.7, 3.8, 4.x), reference implementations table, upgrade examples/guardrails, cross-refs |
| 7 | Run CI lint checks | pending | Final — markdownlint, CLAUDE.md line limit, link integrity, doc reachability, writing conventions |

---

## Task #1: Add L4 Disclaimer

**File**: `docs/L4-standards-measurement.md`

Add a disclaimer near the top (after the intro paragraph, before Pattern 4.1):

> **Scope note:** The reference project that these patterns were extracted from did not implement formal L4 practices. The production system operated successfully at L0-L3 — constitutional rules, stack tests, skills, and optimization were in daily use. The L4 patterns here (evidence-based claims, spec drift detection, development metrics) describe the maturity layer that enterprise adopters or larger teams would add. They are informed by the reference project's informal practices and by industry standards for measurement and governance, but they have not been validated in that project's production context.

---

## Task #2: Reframe README (PARTIALLY COMPLETE)

**Status**: README.md has been edited with:

- Opening reframed as "toolkit" not "prescription"
- Added "shoulders of giants" attribution (Ousterhout, Pocock, testing discipline)
- Added "Reference Implementations" table (claude-stack-utils, gstack, superpowers)
- Lineage story documented
- Example differences now visible in "What's in This Repo" section (TS has Playwright, Python doesn't)
- Adoption path language softened ("suggested approaches, not a rigid plan")
- Removed "better than" framing

**Remaining**:

- Rename `docs/cross-cutting/migration-guide.md` → `docs/cross-cutting/adoption-guide.md`
- Slim it down significantly (currently 1500 lines, 43.7k chars)
- Update CLAUDE.md link from migration-guide to adoption-guide
- Update any other references to migration-guide throughout the repo

---

## Task #3: Break Down L1 + Add REPL Concept

**File**: `docs/L1-feedback-loops.md` (719 lines, 43.6k chars)

### REPL Fractal Loop Concept

The Read-Eval-Print Loop exists at every abstraction layer. At the kernel level, it's the fundamental interaction pattern. L1's closed-loop design is a higher-order REPL:

- **Read** = Context harvesting (gather evidence, read docs/code/tests/logs)
- **Eval** = Design + implement (agent acts on harvested context)
- **Print** = Stack test output (verify the result)
- **Loop** = Iterate based on feedback (adjust design, re-verify)

This REPL exists at multiple scales:

- **Line-level**: Agent reads code, evaluates syntax, prints result
- **Function-level**: Agent reads contract, implements, runs unit test
- **Journey-level**: Agent reads requirements, implements feature, runs stack test
- **System-level**: Agent reads architecture, makes cross-cutting change, runs full suite

Each higher-level REPL absorbs but doesn't replace the lower ones. Unit tests don't go away when you add stack tests — they become the contract that stack tests verify against.

### Splits

Current file structure:

```
L1-feedback-loops.md
├── Context Harvesting section
├── Pattern 1.1 — Stack Tests (large)
├── Pattern 1.2 — Full-Loop Assertion Layering
├── Pattern 1.3 — Sequential/Additive Test Design
├── Pattern 1.4 — Container Isolation
├── Pattern 1.5 — No-Mock Philosophy
├── Pattern 1.6 — Test Integrity Rules
└── Testing Infrastructure Is Production Code
```

Proposed split:

```
L1-feedback-loops.md              # Overview + Context Harvesting + REPL concept (~200 lines)
                                    # Links to sub-docs for each pattern
docs/L1-patterns/                 # New directory
├── 1.1-stack-tests.md            # Pattern 1.1 (the largest pattern)
├── 1.2-full-loop-assertions.md   # Pattern 1.2
├── 1.3-sequential-design.md      # Pattern 1.3
├── 1.4-container-isolation.md    # Pattern 1.4
├── 1.5-no-mock-philosophy.md     # Pattern 1.5
├── 1.6-test-integrity.md         # Pattern 1.6
└── testing-infrastructure.md     # Testing Infrastructure Is Production Code
```

The main L1 doc becomes a concise overview with:

- REPL fractal loop concept as the unifying mental model
- Context harvesting workflow
- Brief summaries of each pattern with links
- Cross-references to L0 and L2

---

## Task #4: Migration Guide → Adoption Guide

**Merged into Task #2 remaining work.**

Rename `docs/cross-cutting/migration-guide.md` → `docs/cross-cutting/adoption-guide.md`.

Replace the 1500-line prescriptive guide with a much shorter (~200-300 line) document that:

- Offers suggested adoption paths (not mandated steps)
- Links to the relevant pattern docs rather than duplicating content
- Removes the detailed code examples (those belong in the pattern docs and examples/)
- Removes the prescriptive timeline
- Keeps the assessment checklist (useful) and the new starter test procedure

---

## Task #5: Extend TS Stack-Test with Playwright

**Directory**: `examples/stack-test/typescript/`

Current state: Jest-based stack tests with API-level verification via HTTP calls.

Add:

1. `playwright.config.ts` — Playwright configuration pointing at the Docker stack
2. `tests/stack/browser/01-app-startup.browser.stack.test.ts` — Browser-based startup verification
3. `tests/stack/browser/02-checkout.browser.stack.test.ts` — Browser-driven checkout flow
4. Update `package.json` with Playwright dependencies
5. Update README in examples/stack-test/typescript/ explaining both test modes

The Playwright tests demonstrate L1's "Beyond API Testing" section — same pattern, browser entry point instead of HTTP.

Python example stays as-is (API-level only).

---

## Task #6: Implement Cross-Ref Spec

**Spec**: `specs/2026-03-31-cross-ref-and-compound-improvements-design.md`

### Change 1: Reference Implementations (DONE — in README)

### Change 2: New Patterns

- Pattern 2.6 — Enforcement Pipeline Composition → add to L2 doc
- Pattern 2.7 — Phase Transition Validation → add to L2 doc
- Pattern 3.8 — Session Lifecycle → add to L3 doc
- Pattern 4.x — CI Guardrails → add to L4 doc

### Change 3: Upgrade examples/guardrails/

Add enforcement pipeline, config loading, session start (~15-20 files, illustrative not full copy)

### Change 4: Cross-references

Add "Reference Implementation" subsections to patterns 2.2-2.5 and 3.1-3.4 pointing to claude-stack-utils files

### Glossary Updates

Add: enforcement pipeline, phase transition, session lifecycle, CI guardrails

---

## Task #7: Run CI Lint Checks (FINAL)

Run the same checks as `.github/workflows/docs.yml`:

```bash
npm run lint:md           # markdownlint-cli2
# Check CLAUDE.md under 150 lines
# Check internal markdown link integrity
# Check all docs reachable from CLAUDE.md
# Check writing conventions (no filler words)
```

Fix any failures before committing.

---

## Key Constraints (from user)

1. **README reframing**: Subtle, careful, thoughtful. Toolkit not prescription. Shoulders of giants.
2. **REPL concept**: Use only the metaphors from the Unblocked blog post — don't promote the product.
3. **File splits**: Thoughtful, lossless. Optimize for token use without losing content.
4. **Playwright**: TypeScript only. Python stays as-is.
5. **Migration guide**: Remove or revise to be less prescriptive. Renamed to adoption-guide.
6. **Example differences**: Visible in higher-level doc tree (README, CLAUDE.md).
7. **Final task**: Run CI lint checks before committing.
8. **Lineage**: reference project → patterns repo → rig. Rig then used to improve both.

## Files Modified So Far

- `README.md` — reframed (complete)
