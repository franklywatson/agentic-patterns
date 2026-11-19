---
name: review+
description: "Invoke AFTER verify+ passes. Wraps superpowers:requesting-code-review with constitutional compliance checklist, stale test validation, and reviewer agent invocation. Two-stage review: spec compliance + code quality."
argument-hint: "[plan file path]"
user-invocable: true
metadata:
  owner: franklywatson
  reviewed: 2026-11-19
---

<!-- rig-generated -->

# review+ — Compliance Review

Wraps `superpowers:requesting-code-review`. Requires superpowers to be installed.

## Procedure

### Phase A: Gather Review Context

1. Load the plan from the path given in the argument, or from the current session.

2. Get the list of files changed since the plan was created:

   ```text
   git diff --name-only [plan-commit]..HEAD
   ```

3. Invoke the Explore agent to get current codebase state for comparison:

   ```text
   Agent(subagent_type="Explore", prompt="Get current state of these files: [changed files list]. For each file, report: key exports and whether a test file exists.")
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

3. Check compliance with the Constitutional Rules in AGENTS.md:
   - [ ] Constitutional Rules followed in all test and source files (real dependencies in stack/E2E tests; mocks appropriate in unit tests)
   - [ ] All claims of success are backed by command output
   - [ ] Full-loop assertions present where applicable
   - [ ] No conditional test assertions (`if (condition) assert(...)`)
   - [ ] No empty test bodies
   - [ ] No `.skip` without documented reason

4. Name the change's review tier from the [risk model](../../../docs/L1-patterns/1.8-reversibility-blast-radius.md#risk-model) and list the approvals it needs ([Pattern 2.13](../../../docs/L2-behavioral-guardrails.md#pattern-213--risk-tiered-review)): below A4 every tier needs approval from someone other than the requester. This review is an agent's finding and never counts as one of them.

### Phase C: Code Quality Review (delegate to superpowers:requesting-code-review)

1. Invoke `superpowers:requesting-code-review` with the gathered context.

2. Check code quality:
   - Each changed file has one responsibility, named in its first comment or docstring
   - Each new exported function or class has a caller in this change or a test
   - No abstraction with a single implementation and no stated second use
   - Positive framing in code comments and error messages

### Phase D: Review Report

1. Produce a two-stage review report:

   ```text
   ## Review Report

   ### Stage 1: Spec Compliance
   - [ ] All plan tasks implemented
   - [ ] Implementation matches plan specification
   - [ ] No stale test violations
   - [ ] Constitutional Rules in AGENTS.md followed

   ### Stage 2: Code Quality
   - [ ] Each changed file has one responsibility
   - [ ] No unused exports or single-use abstractions
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

## Completion

Report one of these states when the skill finishes:

- **DONE** — Review passed (PASS verdict). All spec compliance and code quality checks confirmed.
- **DONE_WITH_CONCERNS** — Review passed; the only open items are style or naming comments, each listed with its file and line.
- **BLOCKED** — Review failed (FAIL verdict). Items must be fixed before proceeding.
- **NEEDS_CONTEXT** — Need user input to resolve a review question or accept a deviation.
