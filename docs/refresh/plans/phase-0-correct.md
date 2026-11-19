# Phase 0: Correct Defects

- **Status:** Not started
- **Depends on:** none
- **Gated by decisions:** none
- **Suggested branch:** `refresh/phase-0-correct`

## Goal

Fix every defect that breaks the repository's own constitution, before any structural change. When
this phase is done, the repo's claims are arithmetically correct, its links resolve, and its examples
run as-is.

## Context to read first

- [../synthesis.md](../synthesis.md), section 8
- [../reviews/review-evidence.md](../reviews/review-evidence.md): P0, P1.2 and P3
- [../reviews/review-adopter.md](../reviews/review-adopter.md): section 2 (inconsistencies)
- [../reviews/review-governance.md](../reviews/review-governance.md): section 1.1 (enforcement examples)

Line numbers in the reviews refer to commit `a07ad93`. Re-locate each item with a search before
editing.

## Tasks

### T1. Correct the TOON example and savings table

- **File:** `docs/L3-optimization.md`, Pattern 3.7.
- Recount the JSON and TOON strings in the worked example. The review measured 117 and 79
  characters, about 32%.
- Fix the "46 characters" example, which is 38.
- Either remove the "typical savings" table or label it as an estimate. Note that it counts
  characters, not tokens.
- Make the record separator consistent between prose and example (pipes vs newlines).
- If decision D3 later moves TOON out of the repo, this fix still applies to wherever it moves.

### T2. Remove or attribute unsourced figures

- **The 60-90%, 60-80% and "80% more" token-savings figures**, in `README.md`,
  `docs/L3-optimization.md`, `docs/cross-cutting/glossary.md` and
  `docs/cross-cutting/anti-patterns.md`. Remove them, or attribute each to a named source and label
  it Thin. Make the repo state one consistent position.
- **"~80% of agent failures come from context" and "90.2% better"**, in L3 Pattern 3.4 and
  `docs/references/further-reading.md`. Attribute both to the WISC video and label them Thin.

### T3. Fix enforcement examples that do not enforce

- **The context-aware hook in L2 Pattern 2.3.** It comments `// block` but returns. Make it block,
  or relabel it as advisory.
- **The `sed -i` examples in L2 and L3.** State that string matching is an ergonomic nudge that
  `/usr/bin/sed -i`, `perl -pi` and `$(...)` bypass, not a security control. Point forward to the
  containment pattern (Phase 2).
- **`examples/guardrails`.** The router allows every `docker` command (`src/core/router.ts`,
  `src/config/routing.config.ts`). Document this as default-allow, and note that Docker socket
  access is root-equivalent. Do not redesign the router here.
- **The trading-bot case study.** It says PostToolUse hooks "redirect" commands. Correct it:
  PostToolUse fires after the command has run, and redirection needs PreToolUse.

### T4. Make the examples run as-is

- Both `examples/stack-test/typescript/docker-compose.test.yml` and
  `examples/stack-test/python/docker-compose.test.yml` mount `./mock-app`, which does not exist.
- Add a real minimal app to each example: Node/Express and Python/FastAPI, each with PostgreSQL and
  Redis. Each app needs `/health?mode=test` as Pattern 1.1 describes, and the endpoints the existing
  stack tests call.
- Name the directory `app/`, not `mock-app/`, because the repo's first constitutional rule is about
  mocks. Update the compose files.
- Add unit tests and a `tsconfig.json` to `examples/guardrails`, so it has a test command that runs.
- Update each example's README with the exact commands, and record their output in the PR
  description as evidence (CLAUDE.md rule 2).

### T5. Resolve contradictory testing rules

- **1.1's claim that stack-test failures "always indicate real bugs".** Soften it to "almost always,
  once isolation (1.4) holds". The doc's own brittleness section contradicts the absolute.
- **The 1.1 comparison table.** It rates unit tests "Low" confidence, which conflicts with L0.5.
  Reword it to the scope each test type proves.
- **The my-claw case study's "unit tests use no mocks".** Reconcile it with 1.5, or say plainly that
  this is my-claw's choice and not the pattern.
- **The my-claw integration tests that auto-skip without `.env`.** This is a silent pass under 1.6.
  Note it as a deviation in the case study.

### T6. Links, anchors and the master index

- Run `python3 docs/refresh/tools/linkcheck.py .` and fix every `MISSING` and `ANCHOR` result. The
  reviewers counted 13 and 27 broken anchors with different checkers, so fix whatever the current
  run reports.
- Extend `.github/workflows/` so CI fails on broken anchors. Today it strips anchors before checking
  links. Either commit the checker as `scripts/check-doc-links.py` or reuse
  `docs/refresh/tools/linkcheck.py`.
- L4 Pattern 4.5 references `./scripts/check-*.sh`, which does not exist. Either add the scripts or
  change the example so it names only checks that exist.
- jcodemunch is linked to two different GitHub owners (L3, `further-reading.md`,
  trading-bot study). Verify the correct repository and use one URL. If it cannot be verified,
  remove the link.
- The my-claw case study gives two different test counts. Pick the correct one or remove both.
- Fix the wrong cross-references:
  - L4.1 cites "L2.3 Full-Loop" for what is Pattern 1.2.
  - The anti-patterns catalogue cites 3.2 for "read only what you need".

### T7. Stop CLAUDE.md loading the whole library

- `CLAUDE.md` uses `@docs/...` references. Claude Code expands `@` imports into context at load
  time.
- Replace them with plain relative markdown links, keeping the master index intact.
- Bump the "Last updated" line.

### T8. Prompt-injection note on design rinsing

- In `docs/L1-feedback-loops.md`, design rinsing section, add a short warning. External sources are
  untrusted input, so rinse in a read-only session without network egress beyond the source.
- Link forward to the Phase 2 least-agency pattern once it exists. Until then, link to the
  synthesis.

## Acceptance checks

```bash
npm run lint:md                                  # 0 issues
python3 docs/refresh/tools/linkcheck.py .        # total issues 0
grep -rn "60-90%\|60-80%" README.md docs/ | grep -v docs/refresh   # no unsourced savings figures
grep -rn "mock-app" examples/                    # no matches
cd examples/stack-test/typescript && <documented test command>     # passes, output in PR
cd examples/stack-test/python && <documented test command>         # passes, output in PR
cd examples/guardrails && npm test               # passes
```

## Out of scope

- Structural changes, renames and pruning (Phase 1)
- New patterns (Phases 2-4)
