# Refresh Decisions

These decisions gate the refresh plans. Each one is **Open** until the maintainer confirms it. A
session taking over must ask the maintainer about any Open decision before starting a plan it
gates, and must not treat a recommendation as approval.

When a decision is made, change its status to **Decided (date)**, record the choice and who made
it, and update the affected plans.

## D1. Scope: development library or full lifecycle?

- **Status:** Open
- **Gates:** Phase 4
- **Question:** The FAQ (`docs/cross-cutting/faq.md`) keeps production out of scope. Self-repair
  needs production signals.
- **Options:**
  - (a) Keep production out of scope.
  - (b) Bring in the seam (incident record in, reproduction and evidence bundle out) and the repair
    patterns, and keep deployment tooling out.
  - (c) Cover the full lifecycle, deployment included.
- **Recommendation:** (b). Repair is the closed loop extended, so it belongs in L1.

## D2. Restructure depth

- **Status:** Decided (2026-11-19): (a) full reframe
- **Gates:** Phases 1 and 3
- **Options:**
  - (a) Rename levels to layers, add the autonomy axis and cap line, replace the pyramid as the
    primary diagram, and replace the 4.4 stage table.
  - (b) Keep L0-L4 as they are and add the autonomy axis as a separate doc.
- **Recommendation:** (a). The 4.4 stage table contradicts the research.

## D3. What happens to L3

- **Status:** Decided (2026-11-19): (b) — TOON cut in Phase 0; 3.8 and routing internals removed from this repo with a pointer to rig's code (no edits to the rig repo)
- **Gates:** Phase 1
- **Options:**
  - (a) Keep L3 as written.
  - (b) Keep a short, explicitly optional efficiency layer, and move TOON, session lifecycle and the
    routing internals to rig's docs.
  - (c) Remove L3.
- **Recommendation:** (b).

## D4. Constitutional rule 6 (CLAUDE.md 150-line limit)

- **Status:** Decided (2026-11-19): (b) "short, owned, tested, re-baselined", with a CI warning at about 200 lines
- **Gates:** Phase 1 and the ongoing re-baseline
- **Options:**
  - (a) Keep the 150-line limit.
  - (b) Replace it with "short, owned, tested, re-baselined", with a CI warning at about 200 lines.
- **Recommendation:** (b). This changes the repo's own constitution, so it needs explicit approval.

## D5. Vendor posture

- **Status:** Decided (2026-11-19): (a) neutral contracts with bindings, AGENTS.md as the shared instruction file, rig disclosure line
- **Gates:** Phases 1 and 2
- **Options:**
  - (a) Neutral contracts, with Claude Code as the first binding and a disclosure line about rig.
  - (b) Lean on Claude openly.
- **Recommendation:** (a). Vendor-specific guidance then lives in bindings, and the patterns stay portable.

## D6. `specs/` and `docs/plans/`

- **Status:** Decided (2026-11-19): (a) delete both folders
- **Gates:** Phase 1
- **Context:**
  - Both folders hold completed March-April 2026 plans, and neither is linked from CLAUDE.md.
  - PR #4 edits two files in `specs/` to remove gstack mentions.
  - `docs/refresh/` (this directory) is the active plan set and is linked from CLAUDE.md.
  - The repo's rig-generated skills (`.claude/skills/plan-plus`, `review-plus`, `tdd-plus`, `verify-plus`) still read and write `docs/plans/`. Running them recreates an unindexed folder. Handling is deferred to Phase 1: repoint the skills through rig configuration, or index the folder.
- **Options:**
  - (a) Delete both folders, following the repo's "git is the archive" rule.
  - (b) Link both from CLAUDE.md.
- **Recommendation:** (a). Make the decision on PR #4 first.

## D7. Where the autonomy tooling lives

- **Status:** Open
- **Gates:** Phase 3
- **Options:**
  - (a) A minimal runnable example in `examples/autonomy/`, with rig as the fuller implementation.
  - (b) rig only, with this repo linking to it.
- **Recommendation:** (a), so the pattern stands without rig.

## Decision log

| Date | Decision | Choice | By |
|------|----------|--------|----|
| 2026-11-19 | Publish the analysis corpus in this public repo in vendor-neutral form, with no organisation-specific material | Yes | Maintainer |
| 2026-11-19 | Ship the refresh analysis as a PR separate from PR #4 | Yes | Maintainer |
| 2026-11-19 | Make the corpus self-contained: commit `sources.md` with public URLs, rename Anthropic sources to AN-n, and cite Anthropic sources in place of the companion's own positions and stances | Yes | Maintainer |
| 2026-11-19 | Remove the former design-rinsing case study and all references to it | Yes | Maintainer |
| 2026-11-19 | Cut TOON (L3 Pattern 3.7) | Yes | Maintainer |
| 2026-11-19 | D6: delete `docs/plans/` and `specs/` | (a) | Maintainer |
| 2026-11-19 | Replace Excalidraw with the archify skill for all diagrams (JSON source, rendered HTML, PNG export); separate PR after Phase 0 — timing superseded: after all phases | Yes | Maintainer |
| 2026-11-19 | D2: restructure depth | (a) full reframe | Maintainer |
| 2026-11-19 | D3: what happens to L3 | (b) completed: TOON cut in Phase 0; 3.8 and routing internals removed with a pointer to rig's code | Maintainer |
| 2026-11-19 | D4: constitutional rule 6 | (b) short, owned, tested, re-baselined; CI warning at about 200 lines | Maintainer |
| 2026-11-19 | D5: vendor posture | (a) neutral contracts with bindings; AGENTS.md as shared instruction file; rig disclosure line | Maintainer |
| 2026-11-19 | T10: `examples/guardrails` TypeScript-only | Keep examples/guardrails; amend the writing rule for optional L3 | Maintainer |
| 2026-11-19 | Diagram work | Deferred until all phases complete (supersedes "separate PR after Phase 0") | Maintainer |
