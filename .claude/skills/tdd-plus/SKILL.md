---
name: tdd+
description: "Invoke AFTER plan+ is approved. Wraps superpowers:test-driven-development with full-loop assertions, real-dependency rules for stack tests, zero-defect, stale test detection, and scoped test runs. Implements plan tasks with RED-GREEN-REFACTOR discipline."
argument-hint: "[plan file path or task range]"
user-invocable: true
metadata:
  owner: franklywatson
  reviewed: 2026-11-19
---

<!-- rig-generated -->

# tdd+ — Disciplined Implementation

Wraps `superpowers:test-driven-development`. Requires superpowers to be installed.

This skill is prompt-level guidance. It guarantees nothing by itself. If hooks that track phases are installed
(for example by `rig init`), the skill also switches the hook phase to tdd+ and the hooks can redirect full-suite
runs and warn about stale tests; without hooks, the agent follows the same rules from this text. During this phase:

- Run scoped tests only; the full suite is reserved for verify+
- Check that every source edit has a matching test update
- The Constitutional Rules in AGENTS.md apply (real dependencies in stack/E2E tests; mocks only in unit tests)

## Procedure

### Phase A: Setup

1. Announce phase entry:

   ```text
   Now using tdd+ skill. Rules for this phase:
   - Test scope: scoped runs only (full suite reserved for verify+)
   - Stale tests: update the test when a source file changes
   - Zero-defect: every failure is fixed before proceeding
   ```

2. Load the plan from the path given in the argument, or from the current session.

3. Identify the task(s) to implement.

### Phase B: Implement Each Task (delegate to superpowers:test-driven-development)

1. For each task in the plan, follow RED-GREEN-REFACTOR:

   **RED — Write the failing test first:**
   - Write a test that captures the task's requirement
   - Use full-loop assertions where applicable:
     - Primary: does the function return the expected value?
     - Second-order: did the side effect occur? (state change, log entry, event)
     - Third-order: is the system still consistent? (no orphan records, no leaked connections)
   - Run the test: it MUST fail (if it passes immediately, the test is wrong)
   - Show the failure output

   **GREEN — Write minimal code to make the test pass:**
   - Write the smallest possible implementation
   - Do not add features not in the plan
   - Run the scoped test with the project's test command (see the README of the example you are changing), limited to the test file or case
   - Show the passing output

   **REFACTOR — Clean up while tests pass:**
   - Improve code structure without changing behavior
   - Run scoped tests after each refactoring step
   - Commit after each completed task

2. After each source file edit, check:
   - Was the corresponding test file also updated?
   - If not, update it before proceeding to the next task (installed hooks emit a stale test warning here)

### Phase C: Task Completion

1. After each task, verify:
   - [ ] Test was written first and shown to fail
   - [ ] Implementation makes the test pass
   - [ ] Scoped test run passes (not full suite)
   - [ ] Constitutional Rules in AGENTS.md followed
   - [ ] Commit made; the message names the task id and the behavior changed

2. Proceed to next task or exit tdd+ phase when all plan tasks complete.

## Test Scope Rules

During tdd+ phase, run the project's test command (see the README of the example you are changing) on one test file or case, not on the
whole suite. Examples of scoped commands, depending on the project's runner:

```text
npm test -- tests/unit/gate.test.ts
uv run pytest tests/unit/test_gate.py::test_the_masking_patch_routes_to_a_human
```

Full suite runs happen during `verify+` phase, not here. Installed hooks can redirect a full-suite command
during this phase.

## Skill Chain

After completing all plan tasks with tdd+:

- Invoke `/verify+` to run full suite and verify against plan acceptance criteria

## Completion

Report one of these states when the skill finishes:

- **DONE** — All plan tasks implemented with passing scoped tests. No constitutional violations.
- **DONE_WITH_CONCERNS** — All tasks implemented but some tests need attention or the code deviates from the plan in a way that does not change behavior (each deviation listed).
- **BLOCKED** — Tests failing, cannot proceed without fixing. Return to RED phase.
- **NEEDS_CONTEXT** — Need user input to resolve an implementation ambiguity or design question.
