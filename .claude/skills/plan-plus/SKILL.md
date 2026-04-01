---
name: plan+
description: "Invoke AFTER brain+ design is approved. Wraps superpowers:writing-plans with constitutional rules, testing strategy per task, and mock policy. Creates bite-sized implementation plans."
argument-hint: "[plan description]"
user-invocable: true
---

# plan+ — Disciplined Planning

Wraps `superpowers:writing-plans`. Requires superpowers to be installed.

## Before You Begin

This skill runs after `brain+` has produced a validated design. It creates the implementation plan with testing discipline baked into every task.

## Procedure

### Phase A: Load Context

1. Read the design output from `brain+` (from the current session or saved spec).

2. Load constitutional rules from CLAUDE.md. Add a **Constitutional Compliance** section to the plan:

   ```
   ## Constitutional Rules for This Plan
   - Use real [database/payment/logger] connections — never mock protected components
   - Show command output before claiming done
   - Every source file change requires corresponding test changes
   - Full-loop assertions: verify primary + second-order + third-order effects
   ```

3. Identify the mock policy for this plan:

   ```
   ## Mock Policy
   Protected (never mock): [list from constitutional rules]
   Allowed: [external third-party services not yet containerized]
   ```

### Phase B: Create Plan (delegate to superpowers:writing-plans)

1. Invoke `superpowers:writing-plans` with the enriched context.

2. For each task in the plan, ensure it includes:
   - **Test strategy**: which tests cover this task's requirements
   - **Mock check**: does this task need to interact with protected components?
   - **Evidence criteria**: what output proves this task is done

3. Every task must follow the pattern:

   ```
   ### Task N: [Name]
   **Files:** [exact paths]
   **Test strategy:** [which tests, scoped to this task]
   **Mock check:** [are protected components involved?]
   - [ ] Step 1: Write failing test
   - [ ] Step 2: Verify it fails
   - [ ] Step 3: Write minimal implementation
   - [ ] Step 4: Verify it passes
   - [ ] Step 5: Commit
   ```

### Phase C: Validate Plan

1. Confirm the plan:
   - [ ] Every task has a test strategy
   - [ ] No task mocks a protected component
   - [ ] Plan references exact file paths (no TBDs)
   - [ ] Evidence criteria defined for each task
   - [ ] Constitutional rules section present

## Output

Save the plan to `docs/plans/` and feed into `tdd+` for implementation.

## Skill Chain

After completing plan+, the next step is:

- Invoke `/tdd+` to implement the plan task-by-task with RED-GREEN-REFACTOR
