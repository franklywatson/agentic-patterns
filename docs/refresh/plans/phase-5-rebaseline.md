# Ongoing: Prune and Re-baseline

- **Status:** Not started
- **Depends on:** Phase 1 (evidence labels and pruning in place)
- **Gated by decisions:** D4 (rule 6 replaced by "short, owned, tested, re-baselined")
- **Cadence:** each model generation, and at least quarterly

## Goal

Stop the library, and repositories that adopt it, from accumulating context that no longer helps.

The repository went seven months without a change while models moved a generation. The research
finds that most committed AI configuration is never changed after it is added (MC-11).

This plan adds the pattern and applies it to the library itself.

## Context to read first

- [../synthesis.md](../synthesis.md): section 7
- [../reviews/review-adopter.md](../reviews/review-adopter.md): section 4 (pattern spec and cut list)

## Tasks

### T1. Pattern doc

Add "Prune and re-baseline context" as an L0 or L4 pattern; decide which during Phase 1 numbering.
It covers:

- An owner, a `reviewed:` date and an expiry for every context artefact: instruction file, skill,
  hook, rule.
- A fixed task bank of 10-30 representative tasks, run against a pinned model.
- Delete-first re-baselining at each model upgrade. Run the bank without the artefact, and add it
  back only on a regression, recording which task justified it.
- Classifying each rule as guidance (prunable prose) or invariant (hook, deny rule or CI).
- Measuring maintained configuration: last changed, invocation counts, rules with a justifying task.
  CI fails on any artefact past its expiry.
- Anti-patterns:
  - "we added it, so it must help"
  - line caps used as a proxy for signal

Evidence: Partial (MC-11; AN-7 for Anthropic removing over 80% of a system prompt with no eval loss).

### T2. Front-matter on this repo's patterns

Add `last-validated-model:` and `reviewed:` to every pattern doc. Add a CI check that warns at 90
days and fails at 180.

### T3. Task bank for this repo

Create `docs/refresh/task-bank.md` with 10-20 tasks an agent should be able to complete using this
library. For example:

- add a stack test for a new journey
- classify a change's reversibility
- place a fixture repo on the curve

Record the model and the result each time the bank runs.

### T4. First re-baseline run

Run the task bank against the current model with each L2/L3 artefact removed in turn. That covers
the skill chain, the phase tracker and the routing notes. Record the results, delete what no task
needs, and write the outcome up as a short case study in `docs/references/`.

## Acceptance checks

- Every pattern doc carries `last-validated-model:` and `reviewed:`, and the CI check is present.
- `docs/refresh/task-bank.md` exists with at least one recorded run.
- The case study is linked from CLAUDE.md.
