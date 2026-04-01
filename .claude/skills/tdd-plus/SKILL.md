---
name: tdd+
description: "Invoke AFTER plan+ is approved. Wraps superpowers:test-driven-development with full-loop assertions, no-mock enforcement, zero-defect, stale test detection, and scoped test runs. Implements plan tasks with RED-GREEN-REFACTOR discipline."
argument-hint: "[plan file path or task range]"
user-invocable: true
---

# tdd+ — Disciplined Implementation

Wraps `superpowers:test-driven-development`. Requires superpowers to be installed.

**This skill activates tdd+ phase in the enforcement layer.** During this phase:

- Full test suite runs are redirected (use scoped tests only)
- Stale test warnings fire when source edits lack test updates
- Constitutional no-mock rules are enforced

## Procedure

### Phase A: Setup

1. Announce phase entry:

   ```
   Now using tdd+ skill. Enforcement layer active:
   - Test scope: scoped runs only (full suite reserved for verify+)
   - Stale tests: warnings when source edited without test updates
   - Zero-defect: every failure must be fixed before proceeding
   ```

2. Load the plan from `docs/plans/`.

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
   - Run the scoped test: `npx vitest run tests/path/to/specific.test.ts`
   - Show the passing output

   **REFACTOR — Clean up while tests pass:**
   - Improve code structure without changing behavior
   - Run scoped tests after each refactoring step
   - Commit after each completed task

2. After each source file edit, check:
   - Was the corresponding test file also updated?
   - If not, the enforcement layer will emit a stale test warning
   - Address it before proceeding to the next task

### Phase C: Task Completion

1. After each task, verify:
   - [ ] Test was written first and shown to fail
   - [ ] Implementation makes the test pass
   - [ ] Scoped test run passes (not full suite)
   - [ ] No constitutional rules violated
   - [ ] Commit made with descriptive message

2. Proceed to next task or exit tdd+ phase when all plan tasks complete.

## Test Scope Rules

During tdd+ phase, the enforcement layer redirects:

- `npx vitest run` (full suite) → advise to run scoped tests only
- `pytest` (full suite) → advise to run specific test file

Use scoped commands:

```
npx vitest run tests/router/resolver.test.ts
pytest tests/test_config.py::test_load_config
```

Full suite runs happen during `verify+` phase, not here.

## Skill Chain

After completing all plan tasks with tdd+:

- Invoke `/verify+` to run full suite and verify against plan acceptance criteria
