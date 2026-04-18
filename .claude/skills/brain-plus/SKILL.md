---
name: brain+
description: "Invoke BEFORE any design or feature work. Wraps superpowers:brainstorming with scout agent context harvesting, stack-first design considerations, and constitutional rule awareness. Asks questions one at a time to refine the design."
argument-hint: "[feature description]"
user-invocable: true
---

<!-- rig-generated -->

# brain+ — Context-Aware Design

Wraps `superpowers:brainstorming`. Requires superpowers to be installed.

## Before You Begin

Invoke this skill BEFORE starting any design work. It adds three capabilities on top of the base brainstorming skill:

1. **Scout context** — automatically harvests codebase context
2. **Stack-first design** — considers Docker, test infrastructure, and full-loop verification
3. **Constitutional awareness** — loads active enforcement rules from session context

## Procedure

### Phase A: Harvest Context

1. Invoke the scout agent to map the current codebase:

   ```
   Agent(subagent_type="scout", prompt="Map the codebase structure for [feature area]. Focus on: existing patterns, related modules, test infrastructure, and entry points relevant to [feature].")
   ```

2. Read the project's CLAUDE.md for project-specific rules.

3. Identify:
   - Existing patterns this feature should follow
   - Test infrastructure available (vitest, pytest, stack tests)
   - Modules that will be affected
   - Active enforcement rules from session context (see session-start output; real dependencies in stack/E2E tests by default)

### Phase B: Design (delegate to superpowers:brainstorming)

1. Invoke `superpowers:brainstorming` with the enriched context.

2. During brainstorming, add these stack-first considerations:
   - What Docker services does this feature need?
   - What are the full-loop assertions? (primary + second-order + third-order effects)
   - What test utilities need to exist before implementation?
   - Which components are protected from mocking (see active enforcement rules)?

3. Use positive framing in all design guidance:
   - "Use real database connections in tests" (not "don't mock the database")
   - "Write assertions that verify observable behavior" (not "don't test implementation details")
   - "Show command output before claiming done" (not "don't say tests pass without evidence")

### Phase C: Validate

1. Confirm the design addresses:
   - [ ] Feature purpose and scope
   - [ ] Affected modules identified
   - [ ] Testing strategy defined
   - [ ] Active enforcement rules acknowledged (see session-start output)
   - [ ] Protected components identified per enforcement rules (real dependencies in stack/E2E tests; mocks appropriate in unit tests)
   - [ ] Stack test user journey defined (if applicable)

## Output

Return the validated design with testing strategy to feed into `plan+`.

## Skill Chain

After completing brain+, the next step is:

- Invoke `/plan+` to create the implementation plan from this design

## Completion

Report one of these states when the skill finishes:

- **DONE** — Design validated, ready for `/plan+`. All checklist items in Phase C confirmed.
- **DONE_WITH_CONCERNS** — Design complete but has open questions or risks to address in planning.
- **BLOCKED** — Cannot proceed (missing context, unclear requirements, external dependency).
- **NEEDS_CONTEXT** — Need user input to resolve an ambiguity or make a design decision.
