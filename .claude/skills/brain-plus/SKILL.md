---
name: brain+
description: "Invoke BEFORE any design or feature work. Wraps superpowers:brainstorming with scout agent context harvesting, stack-first design considerations, and constitutional rule awareness. Asks questions one at a time to refine the design."
argument-hint: "[feature description]"
user-invocable: true
---

# brain+ — Context-Aware Design

Wraps `superpowers:brainstorming`. Requires superpowers to be installed.

## Before You Begin

Invoke this skill BEFORE starting any design work. It adds three capabilities on top of the base brainstorming skill:

1. **Scout context** — automatically harvests codebase context
2. **Stack-first design** — considers Docker, test infrastructure, and full-loop verification
3. **Constitutional awareness** — loads project rules from CLAUDE.md

## Procedure

### Phase A: Harvest Context

1. Invoke the scout agent to map the current codebase:

   ```
   Agent(subagent_type="scout", prompt="Map the codebase structure for [feature area]. Focus on: existing patterns, related modules, test infrastructure, and entry points relevant to [feature].")
   ```

2. Read the project's CLAUDE.md for constitutional rules.

3. Identify:
   - Existing patterns this feature should follow
   - Test infrastructure available (vitest, pytest, stack tests)
   - Modules that will be affected
   - Components that must NOT be mocked (constitutional rules)

### Phase B: Design (delegate to superpowers:brainstorming)

1. Invoke `superpowers:brainstorming` with the enriched context.

2. During brainstorming, add these stack-first considerations:
   - What Docker services does this feature need?
   - What are the full-loop assertions? (primary + second-order + third-order effects)
   - What test utilities need to exist before implementation?
   - Which components are protected from mocking?

3. Use positive framing in all design guidance:
   - "Use real database connections in tests" (not "don't mock the database")
   - "Write assertions that verify observable behavior" (not "don't test implementation details")
   - "Show command output before claiming done" (not "don't say tests pass without evidence")

### Phase C: Validate

1. Confirm the design addresses:
   - [ ] Feature purpose and scope
   - [ ] Affected modules identified
   - [ ] Testing strategy defined
   - [ ] Constitutional rules acknowledged
   - [ ] No mocks for protected components
   - [ ] Stack test user journey defined (if applicable)

## Output

Return the validated design with testing strategy to feed into `plan+`.

## Skill Chain

After completing brain+, the next step is:

- Invoke `/plan+` to create the implementation plan from this design
