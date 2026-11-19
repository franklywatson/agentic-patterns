---
name: verify+
description: "Invoke AFTER tdd+ implementation is complete. Wraps superpowers:verification-before-completion with evidence standards, spec drift check, and full-suite test run. This is the ONLY phase where full test suite runs are appropriate."
argument-hint: "[plan file path]"
user-invocable: true
metadata:
  owner: franklywatson
  reviewed: 2026-11-19
---

<!-- rig-generated -->

# verify+ — Evidence-Based Verification

Wraps `superpowers:verification-before-completion`. Requires superpowers to be installed.

This skill is prompt-level guidance. It guarantees nothing by itself. If hooks that track phases are installed
(for example by `rig init`), the skill also switches the hook phase to verify+; without hooks, the agent follows
the same rules from this text. During this phase:

- Full test suite runs are allowed (this is the verification phase)
- Every failure, error and warning is fixed before done
- Evidence is shown before claiming done

## Procedure

### Phase A: Preparation

1. Announce phase entry:

   ```
   Now using verify+ skill. Rules for this phase:
   - Test scope: full suite runs allowed (this is verification phase)
   - Zero-defect: every failure is fixed
   - Evidence: show command output before claiming done
   ```

2. Load the plan from the path given in the argument, or from the current session.

3. List all acceptance criteria from the plan.

### Phase B: Full Verification (delegate to superpowers:verification-before-completion)

1. Invoke `superpowers:verification-before-completion` with the plan context.

2. Run the full test suite with the project's test command (listed in AGENTS.md; for this repository's
   docs, the checks in `.github/workflows/docs.yml` and `npm run lint:md`). Show the output and link the CI run (the required checks on this commit) for the same commit; pasted output alone is a claim ([Pattern 4.1](../../../docs/L4-standards-measurement.md)), and the reviewer reads the CI run. Every test must pass. Zero failures. Zero errors.

3. For each acceptance criterion in the plan:
   - Show evidence that it is met (command output, file contents, test results)
   - Use positive framing: "Criterion X is met: [evidence]"
   - Do NOT say "tests pass" — show the actual test output

4. Check for spec drift:
   - Compare the plan's task list against actual implementation
   - Were any tasks skipped? Added? Changed?
   - Document any deviations with reasons

### Phase C: Evidence Report

1. Produce a verification report:

   ```
   ## Verification Report

   ### Test Suite
   [Full test output; all tests pass]

   ### CI Run
   [Link to the required checks on this commit]

   ### Acceptance Criteria
   - [ ] Criterion 1: [evidence]
   - [ ] Criterion 2: [evidence]
   - [ ] ...

   ### Spec Drift
   - [No deviations / List deviations with reasons]

   ### Compliance
   - [ ] Constitutional Rules in AGENTS.md followed (real dependencies in stack/E2E tests; mocks only in unit tests)
   - [ ] Evidence shown for all claims
   - [ ] All source changes have test coverage
   ```

2. If ALL checks pass, verification is complete.
   If ANY check fails, return to tdd+ phase to fix.

## Skill Chain

After verify+ passes:

- Invoke `/review+` for the compliance review

## Completion

Report one of these states when the skill finishes:

- **DONE** — Full test suite passes, all acceptance criteria met with evidence, no spec drift.
- **DONE_WITH_CONCERNS** — All tests pass but minor spec deviations exist (documented).
- **BLOCKED** — Tests failing, cannot proceed without fixing regressions.
- **NEEDS_CONTEXT** — Need user input to resolve an acceptance criterion or spec drift question.
