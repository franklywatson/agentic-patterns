# Phase 4: Self-Repair

- **Status:** Not started
- **Depends on:** Phase 3 for A.1-A.3 (register, ledger, promotion and the cap gate). Phase 0 T4 for
  the real minimal app.
- **Gated by decisions:** D1 (scope: bring in the seam and the repair patterns); decided 2026-11-19
- **Suggested branch:** `refresh/phase-4-self-repair`. 1.7 can ship ahead of the rest.

## Goal

Extend the closed loop from development into production for one narrow case: an incident in owned
code, repaired by a reversible change that a machine can verify. The repair loop must not mask
defects, must not grade its own work, and must be stoppable. When this phase is done, a runnable
example shows the gate accepting a real fix, routing a masking "fix" to a human, and blocking a fix
that edits its own test.

## Context to read first

- [../synthesis.md](../synthesis.md): section 5
- [../reviews/review-selfrepair.md](../reviews/review-selfrepair.md): the whole report. Section 2 is
  the pattern spec, section 3 the risks and section 4 the example design.
- Research baseline sections 3.7 (defensible top), 4.3 (incidents, loops) and 4.5 (ownership)

## Tasks

### T1. Pattern docs

Create `docs/L1-patterns/1.7-incident-to-stack-test.md` through `1.12-self-healing-tests-vs-systems.md`.
Add a short "Closing the loop in production" overview section to `docs/L1-feedback-loops.md`,
indexed from CLAUDE.md with one line.

| Pattern | Key requirement | Evidence label |
|---------|-----------------|----------------|
| 1.7 Incident-to-stack-test | No repair is proposed until a reproduction is red on the current production commit. "Cannot reproduce" routes to a human. Incidents in agent config become eval cases. | Strong (human practice), Partial (agent) |
| 1.8 Reversibility and blast-radius classes | R0-R4 by B0-B3, classified deterministically from the diff. Unknown is treated as the highest class. | Partial; the taxonomy is new |
| 1.9 Repair loop with a frozen oracle | The reproduction is byte-identical to the version frozen before the fix. The fix touches no existing test. The anti-masking scan applies the 1.6 rules to production diffs; a hit reclassifies the change as a mitigation, which routes to a human. | Strong (principle); the separation is new |
| 1.10 Production gate and progressive confirmation | Deterministic gate outside the agent. Flag or canary rollout. A pre-declared confirmation rule with a minimum sample. Automatic, rehearsed rollback. | Partial, Thin |
| 1.11 Repair budget, circuit breaker, stop authority | Per-fingerprint attempt budget, cooldown, grant drop on revert or recurrence (with hysteresis), and a named on-call stop | Partial; none found in practice |
| 1.12 Self-healing tests vs self-healing systems | Tests never heal themselves. Three depths of healing. Recovery without a repair ticket is a masked defect. | Definitional |

The grant table must state that unattended R3/R4 repair is not supported at any grant on current
evidence, and why. The trading-bot domain is mostly R4.

### T2. Constitution and existing-pattern updates

- **1.5, real dependencies.** Add a carve-out: network-level fault injection in front of a real
  dependency (a proxy that delays or drops traffic) is not a mock; replacing the client is.
- **2.5, zero-defect.** In production, zero-defect governs what must be addressed (triaged,
  fingerprinted, owned), not what is auto-repaired.
- **4.1, evidence.** Accept graded production evidence under a pre-declared rule that code decides,
  and only for gates on reversible actions.
- **2.8, compound engineering.** A learning from a repair is promoted only after the confirmation
  window and the recurrence check pass.
- **`docs/cross-cutting/faq.md`.** Write the application-to-ops contract:
  - incident record schema in: fingerprint, journey, PII-free request, observed vs expected,
    dependency states
  - reproduction test and evidence bundle out
- **Health endpoint (1.1).** Define a production mode with status, per-dependency state and version.

### T3. Working example

Build `examples/repair-loop/` in TypeScript and Python, with no LLM. Follow the layout in the self-repair review, section 4:

- `app/`: reuse or extend the minimal app from Phase 0
- `incidents/INC-001.json`
- `patches/INC-001.fix.patch`, `INC-001.mask.patch` and `INC-001.test-edit.patch`
- `config/`: data-driven reversibility rules and repair policy
- `src/`: `incident`, `reproduce`, `classify`, `antimask`, `gate` (a pure function), `breaker` and
  `loop` (a state machine)
- Stack tests:
  - `02-repair-INC-001`: red, then green, then gate returns `auto`
  - `03-repair-masking-rejected`: gate returns `human`, and a ticket lands in the outbox
  - `04-repair-test-edit-blocked`: the reproduction hash changed, so the gate blocks
  - `05-breaker-trips`: a recurrence drops the grant, and the stop is exercised
- `tests/eval/gate-eval`: exact scoring with pass^k
- Optional: an INC-002 Redis timeout reproduced with a TCP proxy in front of real Redis. It
  demonstrates the 1.5 carve-out.
- The README states that production confirmation is simulated, not proven.
- Register the repair workflow in the example's `.autonomy.yaml` at A3, using Phase 3's tooling. The
  example shows the gate. It does not grant A4.

### T4. Repair metrics

Add repair metrics to Pattern 4.4, or to a 4.x repair register section:

- time to reproduce
- time to confirmed repair
- repair revert rate
- recurrence rate per fingerprint
- mitigation-to-fix ratio
- masked-defect rate
- cost per confirmed repair

The number of auto-repairs is never a target.

## Acceptance checks

- All stack tests in `examples/repair-loop/` pass in both languages, with the output in the PR.
- Every assertion is unconditional, per Pattern 1.6.
- The gate eval suite passes at pass^k with k ≥ 5.
- `npm run lint:md` and `python3 docs/refresh/tools/linkcheck.py .` both report 0 issues.
- Every new pattern carries an evidence label. Patterns labelled Thin or "none found" say so in
  their first paragraph.

## Out of scope

- Real deployment pipelines, feature-flag services or production telemetry
- Unattended R3/R4 repair
- LLM-driven fix generation. The example uses fixed patches so the loop is reproducible.
