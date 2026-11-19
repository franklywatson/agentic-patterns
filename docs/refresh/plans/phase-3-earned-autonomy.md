# Phase 3: Earned Autonomy

- **Status:** Not started
- **Depends on:** Phase 2 (identity, register as a concept, risk-tiered review)
- **Gated by decisions:** D2 (autonomy axis adopted), D7 (tooling ships as an example in this repo)
- **Suggested branch:** `refresh/phase-3-earned-autonomy`

## Goal

Make "software that ladders itself up to autonomy" concrete. A workflow holds an explicit grant
(A1-A5). The grant rises only on evidence that CI records, and with human sign-off. It falls
automatically. It can never exceed the cap that the repository's own artefacts support. When this
phase is done, the repo places itself on the curve with its own tooling.

## Context to read first

- [../synthesis.md](../synthesis.md): sections 3 and 4
- [../reviews/review-autonomy.md](../reviews/review-autonomy.md): sections 2.2, 3 (A.1-A.7, the spec
  for this phase) and 4 (prerequisites by grant)
- Research baseline sections 3.5-3.7 (curve, placement, defensible top) and 4.5 (ownership)

## Tasks

### T1. Pattern doc

Write `docs/earned-autonomy.md` and link it from CLAUDE.md.

It covers:

- the grant table (A1-A5) and its relation to the curve and the cap rule
- A.1 Autonomy register
- A.2 Evidence ledger
- A.3 Promotion, demotion and the cap gate
- A.4 Census
- A.5 Tested stop
- A.6 Enforcement through hooks
- A.7 Portfolio review

Each pattern carries an evidence label. The upper grants are Thin, and the doc must say so.

It must state outright:

- Stack tests are what earn autonomy. A4's `verification: mechanical` holds only where L1 covers the
  workflow's journey.
- A table of prerequisite patterns for each grant (autonomy review, section 4).

### T2. Register schema

- Add `examples/autonomy/schema/autonomy.schema.json`, a JSON Schema for `.autonomy.yaml`, using the
  example and the schema rules in the autonomy review A.1.
- Schema rules enforced by the check:
  - `granted_level >= 4` requires `stop.last_tested`, `review_date` and `limits`, a non-person
    `identity`, `risk.reversible: true` and `risk.verification: mechanical`.
  - Level 5 additionally requires `stop_rule`, a baseline and a target.
  - A full trifecta at level 3 or above is rejected unless a deterministic gate is named.

### T3. `autonomy check` and `autonomy census`

Build `examples/autonomy/typescript/` and `examples/autonomy/python/`, each implementing:

- **`check`**: validates the register against the schema. Computes the effective level for each
  workflow:
  `min(granted, cap(profile), freshness_gate, harness_gate, demotion_override)`
  It fails when any grant exceeds the cap, when the profile is older than 30 days, or when an agent
  identity changed a governance file. There is no exception field.
- **`census`**: probes a repository for each dimension's artefacts, checking presence and practice
  (last changed, run by CI). It writes `.autonomy/profile.json`. Unknown counts as C2. The probe
  table is in autonomy review A.4. Dimensions that cannot be read from files emit a worksheet, with
  a date, for the human steps.
- **A ledger reader**: computes promotion evidence from an `.autonomy/ledger/<workflow>.jsonl`
  fixture, using Wilson lower and upper bounds as A.3 specifies. It prints an evidence report a
  promotion PR can attach.

Tests:

- Unit tests cover the schema rules, the effective-level calculation, the bounds and demotion
  hysteresis.
- A stack-style test runs `census` against a fixture repository and asserts the profile and the cap.

### T4. Tested stop drill

Add a drill script to the example. It runs a canary workflow (a loop that writes a heartbeat file),
triggers the documented stop mechanism, asserts the canary halted within a bound, and writes
`stop.last_tested`. A test asserts that a failed drill demotes the workflow.

### T5. Hook binding

- Add a Claude Code hook binding to the example. It reads the effective level at session start and,
  before each tool call, denies:
  - actions outside `permitted_actions`
  - writes to `.autonomy*`, `CODEOWNERS` and `.github/workflows/*`
- Extend context eval (Pattern 4.6) with an `autonomy` scenario suite. Scenarios cover A2, A3, A4, a
  cap below the grant, a stale stop and a trifecta session. Score exactly (pass^k), not on the
  graduated 0.5 scale.

### T6. Dogfood

- Add `.autonomy.yaml` to this repository with its real workflows. At minimum, `interactive` and any
  scheduled agents the maintainer runs.
- Run `census` on this repo.
- Add `autonomy check` to this repo's CI as a required check.
- Record the profile result in `docs/refresh/README.md`.

### T7. Case study update

Rewrite the trust-tier section of `docs/references/reference-my-claw-case-study.md` as a runtime
analogue of A.3. Use the comparison table in synthesis section 4.

## Acceptance checks

- Both language implementations pass their unit and stack tests, with the output in the PR.
- `autonomy check` runs in this repo's CI and passes on the committed `.autonomy.yaml`.
- `autonomy check` fails on a fixture where a grant exceeds the cap. This is shown in a test, not by
  running it manually.
- The autonomy eval suite passes.
- `npm run lint:md` and `python3 docs/refresh/tools/linkcheck.py .` both report 0 issues.

## Out of scope

- Repair workflows and production gates (Phase 4)
- Integration with any specific CI vendor beyond GitHub Actions
