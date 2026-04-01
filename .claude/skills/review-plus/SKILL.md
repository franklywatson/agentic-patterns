---
name: review+
description: "Invoke AFTER verify+ passes. Wraps superpowers:requesting-code-review with constitutional compliance checklist, stale test validation, and reviewer agent invocation. Two-stage review: spec compliance + code quality."
argument-hint: "[plan file path]"
user-invocable: true
---

# review+ — Compliance Review

Wraps `superpowers:requesting-code-review`. Requires superpowers to be installed.

## Procedure

### Phase A: Gather Review Context

1. Load the plan from `docs/plans/`.

2. Get the list of files changed since the plan was created:

   ```
   git diff --name-only [plan-commit]..HEAD
   ```

3. Invoke the scout agent to get current codebase state for comparison:

   ```
   Agent(subagent_type="scout", prompt="Get current state of these files: [changed files list]. For each file, report: symbol count, key exports, test coverage status.")
   ```

### Phase B: Spec Compliance Review

1. For each task in the plan:
   - Check: was the task implemented? (file exists, code present)
   - Check: does the implementation match the plan's specification?
   - Check: are the specified tests present and passing?
   - Check: were any plan tasks skipped or significantly changed?

2. Check stale test status:
   - For each changed source file, verify a corresponding test file was also changed
   - Flag any source edits without test updates as stale test violations

3. Check constitutional compliance:
   - [ ] No protected components are mocked in any test file
   - [ ] All claims of success are backed by command output
   - [ ] Full-loop assertions present where applicable
   - [ ] No conditional test assertions (`if (condition) assert(...)`)
   - [ ] No empty test bodies
   - No `.skip` without documented reason

### Phase C: Code Quality Review (delegate to superpowers:requesting-code-review)

1. Invoke `superpowers:requesting-code-review` with the gathered context.

2. Check code quality:
   - Files are focused (one clear responsibility per file)
   - Interfaces are well-defined
   - No unnecessary abstractions
   - No speculative generalization
   - Positive framing in code comments and error messages

### Phase D: Review Report

1. Produce a two-stage review report:

   ```
   ## Review Report

   ### Stage 1: Spec Compliance
   - [ ] All plan tasks implemented
   - [ ] Implementation matches plan specification
   - [ ] No stale test violations
   - [ ] Constitutional rules followed

   ### Stage 2: Code Quality
   - [ ] Files are focused and well-structured
   - [ ] Interfaces are clean
   - [ ] No unnecessary complexity
   - [ ] Positive framing throughout

   ### Verdict
   PASS / FAIL with specific items to address
   ```

2. If PASS: the implementation is complete. Proceed to integration.
    If FAIL: list specific items, return to tdd+ to fix, then re-run verify+ and review+.

## Skill Chain

After review+ passes:

- The implementation is complete
- Proceed to merge/PR decision (superpowers:finishing-a-development-branch)
