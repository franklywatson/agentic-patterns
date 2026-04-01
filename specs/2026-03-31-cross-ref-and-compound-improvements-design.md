# Cross-Reference and Compound Utility — Design Spec

**Date**: 2026-03-31
**Status**: Draft — pending user review

---

## Summary

Three categories of improvement to the agentic-patterns repo, driven by the completion of [claude-stack-utils](https://github.com/franklywatson/claude-stack-utils) — a working implementation of the L2 and L3 patterns:

1. **Cross-reference working systems** — link to claude-stack-utils, gstack, and superpowers as reference implementations from the relevant pattern docs
2. **Fill pattern gaps** — add enforcement pipeline composition, phase transition validation, session lifecycle, and CI guardrails as new patterns where the existing docs describe concepts but not mechanisms
3. **Upgrade examples/guardrails** — bring the example closer to the working system, adding enforcement pipeline, config loading, and session start

---

## Why Now

claude-stack-utils was built directly from the agentic-patterns L2 and L3 pattern docs. It now has:

- 26 source files, 108 symbols, 240+ tests
- Working implementations of: tool router, enforcement pipeline, skill chain, scout agent, CLI installer, CI guardrails
- 7 phase retrospectives comparing against gstack

This creates a bidirectional opportunity:

- **agentic-patterns → claude-stack-utils**: The patterns guided the implementation. This already happened.
- **claude-stack-utils → agentic-patterns**: The working system validates and extends the patterns. This hasn't happened yet.

The gaps are concrete. The existing L2 Pattern 2.3 (Hook Automation) shows pseudocode but no composable pipeline. Pattern 2.2 (The Skill Chain) describes the chain conceptually but has no transition enforcement. Pattern 3.4 (Scout Pattern) describes structured exploration but has no `CodebaseMap` type or cross-repo indexing. These are real patterns that deserve real documentation.

---

## Change 1: Reference Implementations Section

### Where

Add a new section to `README.md` (after "What's in This Repo", before "Contributing") and a matching section to `CLAUDE.md` (after "References").

### Content

A table of working systems that implement patterns from this repo:

| System | What it implements | Language | Status |
|--------|-------------------|----------|--------|
| [claude-stack-utils](https://github.com/franklywatson/claude-stack-utils) | L2 enforcement pipeline, L3 tool routing + scout agent, skill chain with phase transitions, CLI installer | TypeScript | Production (240+ tests) |
| [gstack](https://github.com/garrytan/gstack) | L2 skill framework with resolver pipeline, preamble system, Review Army multi-agent pattern | TypeScript | Production |
| [superpowers](https://github.com/obra/superpowers) | L2 base skills (brainstorming, TDD, verification, review) that claude-stack-utils wraps | Markdown/JS | Production |

Each entry links to the repo and identifies which pattern levels it covers. This makes the repo more credible — the patterns aren't theoretical, they're in daily use.

---

## Change 2: New Patterns

### Pattern 2.6 — Enforcement Pipeline Composition

**Problem:** Individual enforcement checks (stale tests, zero-defect, constitutional rules) are useful in isolation, but a production guardrail system needs to compose multiple checks into a single hook response. Without a composition pattern, each check runs independently with no unified severity resolution.

**Solution:** A composable enforcement pipeline where each check is an independent function returning `{ level, message }`. The pipeline runs all checks and resolves to the most severe level (block > advise > silent). Checks are configurable per-rule via a config file (`.harness.yaml`).

**Key concepts:**

- Each check has one responsibility (stale test detection, scope control, mock detection, failure parsing)
- Checks compose through a single orchestrator (`handlePostToolUse`)
- Severity resolution: most severe level wins
- Configurable: each rule can be block/advise/silent independently

**Reference:** [claude-stack-utils enforcement pipeline](https://github.com/franklywatson/claude-stack-utils/tree/main/src/enforcement)

### Pattern 2.7 — Phase Transition Validation

**Problem:** The skill chain (brain+ → plan+ → tdd+ → verify+ → review+) is described as a conceptual pipeline, but without enforcement agents can skip phases. Skipping plan+ before tdd+ means unstructured implementation. Skipping tdd+ before verify+ means unverified code.

**Solution:** A state machine that tracks which phases the agent has visited and validates transitions. Each phase records its visit with a timestamp. Transition validation checks that prerequisites are met before allowing entry to the next phase.

**Key concepts:**

- Phase history with timestamps
- Transition validation: `tdd+` requires prior `plan+` visit, `verify+` requires prior `tdd+` visit
- Query methods: `isTddPhase()`, `isVerifyPhase()` for conditional behavior
- Reset capability for new workflows

**Reference:** [claude-stack-utils phase tracker](https://github.com/franklywatson/claude-stack-utils/blob/main/src/skills/phase-tracker.ts)

### Pattern 3.8 — Session Lifecycle

**Problem:** L3 Pattern 3.3 describes environment detection (RTK, jcodemunch) but doesn't address when detection happens or how long results are valid. In practice, detection should happen once at session start and cache for the session's duration.

**Solution:** A session start hook that detects the environment, auto-indexes the project, and caches results with a TTL. The cache prevents redundant detection on every tool call while allowing refresh if the session is long-running.

**Key concepts:**

- Session start hook fires once when Claude Code starts
- `detectEnvironment()` checks for rtk, jcodemunch, stack-test via injectable `ExecFn`
- `SessionCache` with 30-minute TTL
- Auto-indexing: if jcodemunch is available and the project isn't indexed, index it
- Injectable `ExecFn` for testability (don't call `execSync` directly)

**Reference:** [claude-stack-utils session module](https://github.com/franklywatson/claude-stack-utils/tree/main/src/session)

### Pattern 4.x — CI Guardrails

**Problem:** L4 describes standards and measurement but doesn't address CI enforcement. Enforcement in hooks is session-scoped — it only works when the agent is running. CI provides non-negotiable enforcement that runs regardless of whether hooks are active.

**Solution:** GitHub Actions workflows for docs quality and test coverage, paired with project config for threshold definitions.

**Key concepts:**

- Coverage gate: vitest coverage thresholds (80% statements, 75% branches) defined in `vitest.config.ts`
- Docs lint: markdownlint-cli2 with permissive rules + link checking
- Separate workflows: `docs.yml` for documentation, `coverage.yml` for test coverage
- Thresholds in project config, not CI workflow — anyone can see and adjust them

**Reference:** [claude-stack-utils CI workflows](https://github.com/franklywatson/claude-stack-utils/tree/main/.github/workflows)

---

## Change 3: Upgrade examples/guardrails

The current `examples/guardrails/` has intent classification, environment detection, and routing. It's a good starting point but stops short of a complete system.

### Additions

1. **Enforcement pipeline** — `src/enforcement/` with composable checks (stale-test, constitutional, zero-defect) and a `handlePostToolUse` orchestrator
2. **Config loading** — `src/config.ts` that reads a YAML config file with enforcement levels per rule
3. **Session start** — `src/session/start.ts` with auto-indexing and environment caching

### Scope boundary

The upgraded example should be *illustrative*, not a full copy of claude-stack-utils. Purpose: show how the patterns compose into a working system. Keep it to ~15-20 files max. The full system lives in claude-stack-utils itself.

---

## Change 4: Cross-references from existing patterns

Add "Reference Implementation" subsections to existing pattern docs:

| Doc | Pattern | Add cross-reference to |
|-----|---------|----------------------|
| L2-behavioral-guardrails.md | Pattern 2.2 (Skill Chain) | claude-stack-utils `SkillPhaseTracker` + skill templates |
| L2-behavioral-guardrails.md | Pattern 2.3 (Hook Automation) | claude-stack-utils enforcement pipeline + hook protocol |
| L2-behavioral-guardrails.md | Pattern 2.4 (Constitutional Rules) | claude-stack-utils `checkConstitutional()` regex detection |
| L2-behavioral-guardrails.md | Pattern 2.5 (Zero-Defect) | claude-stack-utils `checkZeroDefect()` output parsing |
| L3-optimization.md | Pattern 3.1 (Smart Routing) | claude-stack-utils resolver with priority chain |
| L3-optimization.md | Pattern 3.2 (Intent Classification) | claude-stack-utils `classifyIntent()` with bash patterns + Claude tool mapping |
| L3-optimization.md | Pattern 3.3 (Environment-Aware Routing) | claude-stack-utils `detectEnvironment()` with injectable `ExecFn` |
| L3-optimization.md | Pattern 3.4 (Scout Pattern) | claude-stack-utils scout agent + `CodebaseMap` type |

Format for each cross-reference:

```markdown
### Reference Implementation

The [claude-stack-utils](https://github.com/franklywatson/claude-stack-utils) repo implements this pattern in
[`src/router/intent.ts`](https://github.com/franklywatson/claude-stack-utils/blob/main/src/router/intent.ts)
with bash pattern matching and Claude Code tool mapping. Tests are in
[`tests/router/`](https://github.com/franklywatson/claude-stack-utils/tree/main/tests/router).
```

Short, specific, points to exact files.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `README.md` | Modify | Add "Reference Implementations" section |
| `CLAUDE.md` | Modify | Add "Reference Implementations" section, update line count |
| `docs/L2-behavioral-guardrails.md` | Modify | Add Pattern 2.6, Pattern 2.7, cross-references to Patterns 2.2-2.5 |
| `docs/L3-optimization.md` | Modify | Add Pattern 3.8, cross-references to Patterns 3.1-3.4 |
| `docs/L4-standards-measurement.md` | Modify | Add CI Guardrails pattern |
| `examples/guardrails/` | Modify | Add enforcement, config, session modules |
| `docs/cross-cutting/glossary.md` | Modify | Add new terms (enforcement pipeline, phase transition, session lifecycle) |
