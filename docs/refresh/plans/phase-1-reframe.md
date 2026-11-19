# Phase 1: Reframe and Prune

- **Status:** Not started
- **Depends on:** Phase 0
- **Gated by decisions:** D2, D3, D4, D5, D6 (see [../decisions.md](../decisions.md)). Confirm each
  with the maintainer first. The tasks below assume the recommended option, and each task names the
  decision it depends on.
- **Suggested branch:** `refresh/phase-1-reframe`, split into one PR per task group if the diff
  grows large

## Goal

Turn the library from a single maturity ladder into a set of capability layers with an explicit
statement of what it does not cover. Label every pattern with its evidence. Remove or demote content
that has aged, so the core of the library is verification.

## Context to read first

- [../synthesis.md](../synthesis.md): sections 1-3 and 7
- [../reviews/review-autonomy.md](../reviews/review-autonomy.md): sections 1-2
- [../reviews/review-adopter.md](../reviews/review-adopter.md): sections 1, 3 and 4
- [../reviews/review-evidence.md](../reviews/review-evidence.md): P1.3 (label table) and P2
- [../reviews/review-governance.md](../reviews/review-governance.md): section 2 (L2 thesis) and section 4
  (vendor neutrality)

## Tasks

### T1. Levels become layers (D2)

- Rename "level" to "layer" for L0-L4 in `README.md`, `CLAUDE.md`, all `docs/L*.md`, the glossary
  and the adoption guide. File names stay the same, to avoid breaking links.
- Rewrite the README "Pattern Pyramid" section:
  - The layers are capability dependencies, not a maturity scale.
  - Adoption starts where the gaps are.
  - Introduce the curve (C1-C5) and the autonomy grant (A1-A5) in one paragraph each, linking to
    the baseline and to the future `docs/earned-autonomy.md`.
- Add a new diagram, `docs/diagrams/dimension-grid.excalidraw` plus a `.png` export: seven
  dimensions as columns with the cap line. Keep the pyramid as "layer dependencies".

### T2. State what the library does not cover

Add a README section, "What this library does not cover yet". It names:

- production ownership
- security and governance
- measuring value against a baseline

It also states the consequence: a team adopting every pattern is capped at C1-C2 for unattended
work until those dimensions are filled.

Link the section to Phases 2-4 while they are in progress, and update it as they land.

### T3. Replace the 4.4 stage table (D2)

In `docs/L4-standards-measurement.md` Pattern 4.4:

- Remove the Foundational/Orchestrated/Self-optimizing/Autonomous table and its gate criteria.
- Keep the metric categories.
- Reframe "human intervention rate" as one input, never a target.
- Point to the autonomy axis.

### T4. Evidence labels on every pattern

- Add a one-line footer to every pattern: `**Evidence:** Strong | Partial | Thin — basis (source
  IDs)`. Use the table in the evidence review (P1.3) as the starting set.
- Label the case studies "first-party, n=1".
- Add a disclosure in the README:
  - rig and my-claw were built from these patterns, so they demonstrate the patterns without
    independently validating them.
  - State the author's relationship to rig (D5).
- Cite the independent sources the research gives where they strengthen existing claims (evidence
  review P2.4). For example, L2's thesis can cite OM-7, OM-18, SG-11 and SC-8, and 4.1 can cite
  IS-6. Add these sources to `docs/references/further-reading.md`.

### T5. Rewrite the L2 thesis as layered enforcement

- Replace the L2 opening claim with the paragraph proposed in section 2 of the governance review:
  - Prose is guidance.
  - Hooks are deterministic policy within the harness.
  - Containment and credentials are the boundary.
- Each constitutional rule in Pattern 2.4 must name its enforcement point: prompt, hook, CI,
  sandbox or downstream.
- Mark PostToolUse checks as detective, not preventive (2.6).

### T6. Prune, merge and demote (D3, D4)

Apply the lists in synthesis section 7.

**Cut:**

- Move TOON (3.7) and Session Lifecycle (3.8) to rig's docs (D3), or delete them. Leave a one-line
  pointer.
- Remove the rig-internal TypeScript from 2.6 and 2.7, keeping the concept and a link.

**Merge:**

- 0.9 with 4.3
- 3.1, 3.2 and 3.5 into one note: "prefer native structured tools; block destructive edits"
- 3.4 Scout into a context-isolation note
- 0.7 with 4.2

**Demote:**

- 2.2 and 2.7 become optional. Replace "phase enforcement must be blocking" with "scale ceremony to
  risk; verification and review stay outcome gates".
- The "3-5 exports" rule becomes a heuristic.
- 3.6 is marked as opinion.

**Rule 6 (D4):**

- Change CLAUDE.md constitutional rule 6 and L0 Pattern 0.4 to "short, owned, tested, re-baselined".
- Change the CI check to warn at about 200 lines.
- Make the adoption-guide checklist consistent with the new rule.

**Renumber with care:**

- Keep the old pattern numbers as anchors, or add a "moved to" line, so external links keep working.
- Update the glossary and the anti-patterns catalogue for every pattern moved.

### T7. AGENTS.md as the shared source (D5)

- Rename Pattern 0.4 to "Agent instruction file as project constitution".
- Recommend AGENTS.md as the shared source, with CLAUDE.md importing it. Claude Code reads only
  CLAUDE.md when both exist, unless configured otherwise.
- Apply this to the repo itself: move the agent contract into `AGENTS.md` and keep `CLAUDE.md` as a
  thin importer. The master-index rule then applies to AGENTS.md.

### T8. Old planning folders (D6)

Delete `specs/` and `docs/plans/` if D6 is decided as (a). Otherwise link both from the master index.

## Acceptance checks

- `npm run lint:md` and `python3 docs/refresh/tools/linkcheck.py .` both report 0 issues.
- Every `## Pattern` heading in `docs/` has an `**Evidence:**` line. Check with a grep comparing
  the count of pattern headings and the count of evidence lines per file.
- `grep -rn "Autonomous" docs/L4-standards-measurement.md` shows no stage table.
- The README contains "What this library does not cover yet".
- CLAUDE.md (or AGENTS.md) meets the new rule-6 check in CI.

## Out of scope

- New containment or ownership patterns (Phase 2)
- Autonomy and repair patterns (Phases 3-4)
