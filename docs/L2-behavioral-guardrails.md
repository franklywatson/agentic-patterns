# L2: Behavioral Guardrails

Prose instructions are insufficient for agentic development. Skills and hooks enforce discipline through the tool layer, making correct behavior the path of least resistance.

## Overview

L1 established testing discipline. L2 automates enforcement of that discipline through behavioral guardrails. These guardrails operate at the tool layer rather than the instruction layer, ensuring consistent behavior regardless of context or prompt complexity.

The guardrail framework consists of:
- **Skills**: Overlay patterns that extend base agent capabilities with project-specific rules
- **Hooks**: Automated triggers that block, advise, or transform operations
- **Constitutional rules**: Hard constraints that never relax
- **Zero-defect tolerance**: The discipline that makes agentic development work at scale

---

## Pattern 2.1 — Skill Overlay Architecture

### Problem

Claude Code provides base capabilities through superpowers like `brainstorming` and `test-driven-development`. However, production projects need project-specific constraints layered on top of these generic capabilities. Writing all constraints inline in prompts is verbose and inconsistent.

### Solution

Skills extend base capabilities through an overlay architecture:

```
base capability (e.g., superpowers:test-driven-development)
    + project-specific rules (constitutional rules, conventions)
    + hook activations (when to fire which guards)
    + integration points (how this skill connects to others)
    = skill overlay
```

A skill is a markdown file that declares:
- **Frontmatter**: name, description, base reference
- **Purpose**: what this skill achieves
- **Rules**: project-specific constraints this skill enforces
- **Hook activations**: what guards this skill triggers
- **Integration points**: what other skills compose with this
- **Checklist**: steps the agent follows when using the skill

Skills are the mechanism by which a project's constitution (@L0-foundation.md#pattern-04-claude-md-as-project-constitution) becomes executable. CLAUDE.md declares the rules; skills enforce them.

### In Practice

A TDD skill for an ecommerce project might extend `superpowers:test-driven-development` and add:
- No mocking database drivers (constitutional rule)
- No mocking payment processor libraries (Stripe, PayPal) (constitutional rule)
- Full-loop assertion requirements (project convention)
- Hook to track test file changes (integration with workflow)

When the agent invokes this skill, it inherits the base TDD workflow plus all project-specific constraints automatically.

### Anti-Pattern

Copying the same rules into every prompt. This creates drift—prompts get updated inconsistently, and some code paths miss critical constraints.

### Cross-References

- @L0-foundation.md#pattern-04-claude-md-as-project-constitution — CLAUDE.md as rule source
- @docs/examples/skills/SKILL-TEMPLATE.md — Skill template format
- @docs/examples/skills/example-tdd-skill.md — Concrete TDD skill example

---

## Pattern 2.2 — The Skill Chain

### Problem

Individual skills are useful, but development requires a complete lifecycle. Isolated skills miss dependencies between phases—code written without tests, tests written without verification, changes submitted without review.

### Solution

Skills compose into a workflow pipeline where each skill's output becomes the next skill's input:

```
brain+ (design with stack-first considerations)
      +-> plan+ (create plan with testing strategy)
              +-> tdd+ (RED-GREEN-REFACTOR with full-loop)
                      +-> verify+ (evidence before claims)
                              +-> review+ (checklist-based compliance review)
```

The chain enforces a complete development lifecycle. Each skill validates its input and produces structured output for the next skill. Skipping a link means losing a guardrail.

**Chain phases:**

1. **brain+**: Design with stack testing in mind. What needs Docker? What are the full-loop assertions?
2. **plan+**: Create implementation plan with explicit testing strategy. Which tests cover which requirements?
3. **tdd+**: RED-GREEN-REFACTOR with full-loop assertions. (@L1-feedback-loops.md#pattern-12-full-loop-assertion-layering)
4. **verify+**: Evidence-based claims. Run commands, show output, then claim done.
5. **review+**: Checklist-based compliance review. Tests pass, docs updated, constitutional rules followed.

### In Practice

A typical workflow session:
1. Agent activates `brain+` skill, designs feature with stack testing considerations
2. Agent activates `plan+` skill, produces plan with test coverage matrix
3. Agent activates `tdd+` skill, implements following RED-GREEN-REFACTOR
4. Agent activates `verify+` skill, runs tests and shows output before claiming success
5. Agent activates `review+` skill, confirms all checklist items complete

The `review+` skill also integrates `test-integrity` for test file review, ensuring tests follow @L1-feedback-loops.md#pattern-16-test-integrity-rules.

**Superpowers framework integration:** The [obra/superpowers](https://github.com/obra/superpowers) library provides the base skills that the chain builds on:

| Skill | Role in Chain |
|-------|--------------|
| [brainstorming](https://github.com/obra/superpowers) | Design and requirements exploration — feeds into planning |
| [writing-plans](https://github.com/obra/superpowers) | Creates bite-sized implementation plans with testing strategy |
| [executing-plans](https://github.com/obra/superpowers) | Task-by-task execution with review checkpoints |
| [test-driven-development](https://github.com/obra/superpowers) | RED-GREEN-REFACTOR with full-loop assertions |
| [verification-before-completion](https://github.com/obra/superpowers) | Evidence-based claims — commands run, output shown, then claim |
| [requesting-code-review](https://github.com/obra/superpowers) | Checklist-based review against plan requirements |
| [finishing-a-development-branch](https://github.com/obra/superpowers) | Integration decisions (merge, PR, cleanup) when work is complete |

Project-specific skill overlays (like `tdd+`, `verify+`, `review+`) wrap these base skills with project constraints such as constitutional rules, mock policies, and full-loop assertion requirements.

### Anti-Pattern

Jumping directly to implementation without planning or testing. This produces code that may work but cannot be verified systematically. The chain only works if all links are present.

### Cross-References

- @L1-feedback-loops.md#pattern-11-stack-tests — Stack testing foundation
- @L1-feedback-loops.md#pattern-12-full-loop-assertion-layering — Assertion requirements
- @docs/cross-cutting/glossary.md — Skill chain terminology

---

## Pattern 2.3 — Hook Automation

### Problem

Agents forget rules. Instructions written in prose are unreliable enforcement mechanisms. When context shifts or prompts get complex, rules get dropped.

### Solution

Hooks are automated triggers that fire before or after tool operations. They enforce rules through the tool layer, independent of prompt content.

**Three hook types:**

**PostToolUse hooks**: Fire after a tool completes. Examples:
- Track source file edits in `pending-tests.json`
- Emit "TEST TASK REQUIRED" when code changes without corresponding test changes
- Add modified files to a change-set for review

**PreToolUse hooks**: Fire before a tool executes. Examples:
- Block `sed -i` (always redirect to Edit tool)
- Block `docker system prune` in shared environments
- Require confirmation before deleting files matching a pattern

**Context-aware hooks**: Detect environment state and adjust behavior. Examples:
- If `./test-logs/` has files modified within 5 minutes, block `docker logs` and redirect to log files
- If pending tests exist, block implementation tasks until test task is created
- If working in a git worktree, ensure commands respect worktree boundaries

**The automation pattern:**
```
hook fires
    +-> check state (what files changed? what's on disk? what's the context?)
            +-> allow (operation proceeds)
            +-> advise (warn but allow, with explanation)
            +-> block (stop operation, require different approach)
```

### In Practice

A PostToolUse hook tracking test coverage:
```typescript
// Simplified pseudocode
hook.on('PostToolUse', (tool, args) => {
  if (tool === 'Edit' && isSourceFile(args.file_path)) {
    pendingTests.add(args.file_path);
    console.warn('TEST TASK REQUIRED: Source file modified');
  }
  if (tool === 'Edit' && isTestFile(args.file_path)) {
    pendingTests.remove(sourceFileFor(args.file_path));
  }
});
```

A PreToolUse hook blocking destructive operations:
```typescript
hook.on('PreToolUse', (tool, args) => {
  if (tool === 'Bash' && args.command.includes('sed -i')) {
    throw new Error('Use Edit tool instead of sed -i');
  }
});
```

A context-aware hook:
```typescript
hook.on('PreToolUse', (tool, args) => {
  if (tool === 'Bash' && args.command.startsWith('docker logs')) {
    const recentLogs = findRecentTestLogs(5 * 60 * 1000); // 5 minutes
    if (recentLogs.length > 0) {
      console.warn(`Recent test logs available: ${recentLogs.join(', ')}`);
      console.warn('Use test logs instead of docker logs');
      return; // block the docker logs command
    }
  }
});
```

### Anti-Pattern

Writing hooks that are too permissive or too restrictive. Permissive hooks fail to catch problems; restrictive hooks block legitimate work. Hooks should have clear, narrow purposes with documented behavior.

### Cross-References

- @L3-optimization.md#pattern-31-smart-routing--tool-selection — Command routing patterns
- @docs/examples/guardrails/ — Hook implementation examples

---

## Pattern 2.4 — Constitutional Rules

### Problem

Projects have rules that should never be violated—core constraints that define the project's approach. When these rules are scattered across documentation or written as soft suggestions, they get forgotten or worked around.

### Solution

Constitutional rules are hard constraints declared in CLAUDE.md that never relax. They are the foundation of the project's guardrail system.

**Example constitutional rules from a production ecommerce platform:**

- **Never mock core system components** — logger, payment processor libraries (Stripe, PayPal), database drivers, HTTP clients for first-party services. Use real components in stack tests.
- **Full accounting for every state change** — every inventory change, every order, every transaction fee must be logged and queryable.
- **Evidence-based claims only** — show command output before claiming done. "Tests pass" is not evidence; show the test output.
- **Docker-first development** — no local OS execution. Everything runs in containers.
- **No conditional test assertions** — tests must be able to fail. (@L1-feedback-loops.md#pattern-16-test-integrity-rules)

**The rules flow:**
```
CLAUDE.md declares constitutional rules
    +-> plan+ includes rules in plan template (what must this plan respect?)
            +-> tdd+ rejects mocked components in test generation
                    +-> review+ checks constitutional compliance (did this violate any rules?)
```

### In Practice

Constitutional rule enforcement in the skill chain:
1. **plan+** reads CLAUDE.md and adds a "Constitutional compliance" section to each plan
2. **tdd+** checks that proposed tests don't mock protected components
3. **review+** runs a checklist that includes "No constitutional rules violated"

When the agent attempts to mock a database driver, the tdd+ skill blocks it with a reference to the constitutional rule.

### Anti-Pattern

Writing "soft" rules with exceptions. Constitutional rules must have no escape hatches. If a rule needs exceptions, it is not constitutional—it is a guideline, not a constraint.

### Cross-References

- @L0-foundation.md#pattern-04-claude-md-as-project-constitution — CLAUDE.md format
- @L1-feedback-loops.md#pattern-15-no-mock-philosophy — Mock avoidance rationale

---

## Pattern 2.5 — Zero-Defect Tolerance

### Problem

Agents don't have intuition to work around known issues. When developers tolerate "unrelated" failures or "pre-existing" warnings, agents lose the ability to self-diagnose systematically. A tolerated defect becomes an undiagnosed regression later.

### Solution

Zero-defect tolerance: every error, warning, and failure must be addressed. Not just "relevant" errors—ALL of them.

**What zero-defect means:**
- "This failure is unrelated" is never acceptable
- "This warning was pre-existing" means fix it now
- Tests that fail for any reason must either pass or be explicitly skipped with documentation
- Compiler warnings must be resolved, not suppressed
- Linter errors must be fixed, not waived

**Why this matters for agents:**
Agents process feedback systematically. When output contains errors, agents must be able to assume those errors are relevant. If some errors are "okay to ignore," the agent cannot distinguish which errors require action and which do not. This ambiguity breaks the feedback loop.

### In Practice

A test run produces output:
```
FAIL test/ecommerce/order.test.ts
  Order processing
    + should process order
PASS test/ecommerce/order.test.ts
  Order processing
    + should calculate fees

Error: Cannot find module './utils/config.ts'
```

Zero-defect response:
1. Fix the missing module import first
2. Re-run tests
3. If the order processing test still fails, investigate that
4. Only when ALL errors and warnings are resolved is the task complete

Not zero-defect (wrong approach):
1. "The module error is unrelated to the order test"
2. Focus only on the order test failure
3. Leave the module error unfixed

### Anti-Pattern

Classifying errors as "relevant" or "irrelevant" without evidence. Unless you can prove an error is truly unrelated (different subsystem, proven isolation), assume it is relevant.

### Cross-References

- @L1-feedback-loops.md#pattern-13-sequential--additive-test-design — Sequential test ordering
- @L4-culture.md#pattern-42-evidence-based-claims — Evidence standards

---

## Summary

L2 behavioral guardrails automate enforcement of the discipline established in L1. Skills extend base capabilities with project-specific rules. Hooks enforce rules through the tool layer. Constitutional rules declare hard constraints. Zero-defect tolerance ensures systematic self-diagnosis.

Together, these patterns make correct behavior the path of least resistance for agentic development.

---

**Previous:** [L1: Feedback Loops — Closed-Loop Testing](L1-feedback-loops.md) | **Next:** [L3: Optimization — Token Efficiency & Agent Performance](L3-optimization.md) | [Back to Overview](../README.md)
