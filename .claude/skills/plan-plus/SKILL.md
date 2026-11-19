---
name: plan+
description: "Invoke AFTER brain+ design is approved. Wraps superpowers:writing-plans with constitutional rules, testing strategy per task, and mock policy. Creates bite-sized implementation plans."
argument-hint: "[plan description]"
user-invocable: true
owner: franklywatson
reviewed: 2026-11-19
---

<!-- rig-generated -->

# plan+ — Disciplined Planning

Wraps `superpowers:writing-plans`. Requires superpowers to be installed.

## Before You Begin

This skill runs after `brain+` has produced a validated design. It creates the implementation plan with testing discipline baked into every task.

## Procedure

### Phase A: Load Context

1. Read the design output from `brain+` (from the current session or a saved design file the user names).

2. Load the Constitutional Rules in AGENTS.md. Add a **Constitutional Compliance** section to the plan:

   ```
   ## Constitutional Rules for This Plan
   [List the Constitutional Rules from AGENTS.md that apply to this plan]
   - Use real [database/payment/logger] connections in stack/E2E tests — mocks are appropriate in unit tests
   - Show command output before claiming done
   - Every source file change requires corresponding test changes
   - Full-loop assertions: verify primary + second-order + third-order effects
   ```

3. Identify the mock policy for this plan based on the Constitutional Rules:

   ```
   ## Mock Policy
   Stack/E2E (real deps): [list from the Constitutional Rules]
   Unit tests (mocks ok): [all components] / External without sandbox: [third-party services]
   ```

### Phase B: Create Plan (delegate to superpowers:writing-plans)

1. Invoke `superpowers:writing-plans` with the enriched context.

2. For each task in the plan, ensure it includes:
   - **Test strategy**: which tests cover this task's requirements
   - **Mock check**: does this task need to interact with protected components (per the Constitutional Rules)?
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
   - [ ] Constitutional Compliance section present

## Output

Save the plan where the user directs, or at the location `superpowers:writing-plans` proposes, and feed it into `tdd+`. Keep working plans outside `docs/`: every doc under `docs/` must be linked from AGENTS.md (`scripts/check-doc-reachability.py`).

## Skill Chain

After completing plan+, the next step is:

- Invoke `/tdd+` to implement the plan task-by-task with RED-GREEN-REFACTOR

## Completion

Report one of these states when the skill finishes:

- **DONE** — Plan saved, all validation checklist items in Phase C confirmed.
- **DONE_WITH_CONCERNS** — Plan complete but has open questions or tasks needing refinement.
- **BLOCKED** — Cannot proceed (missing design from brain+, unclear requirements).
- **NEEDS_CONTEXT** — Need user input to resolve a task scope or dependency question.
