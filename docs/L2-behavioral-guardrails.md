# L2: Behavioral Guardrails

Prose instructions are insufficient for agentic development. Skills and hooks enforce discipline through the tool layer, making correct behavior the path of least resistance.

**A note on skills frameworks:** The skills referenced throughout this document (brainstorming, test-driven-development, verification-before-completion, etc.) are primarily drawn from the [superpowers](https://github.com/obra/superpowers) framework by Jesse Vincent (obra). However, the patterns described here are framework-agnostic. Equivalent skill sets exist in [gstack](https://github.com/garrytan/gstack), [OpenSpec](https://github.com/openspec-dev/openspec), and other agent skill frameworks. The important thing is the pattern — overlaying project-specific constraints on base agent capabilities — not which specific framework provides the skills.

## Overview

L1 established testing discipline. L2 automates enforcement of that discipline through behavioral guardrails. These guardrails operate at the tool layer rather than the instruction layer, ensuring consistent behavior regardless of context or prompt complexity.

The guardrail framework consists of:

- **Skills**: Overlay patterns that extend base agent capabilities with project-specific rules
- **Hooks**: Automated triggers that block, advise, or transform operations
- **Constitutional rules**: Hard constraints that never relax
- **Zero-defect tolerance**: The discipline that makes agentic development work at scale

---

## Pattern 2.1 — Skill Overlay Architecture

![Skill Overlay Architecture](diagrams/2.1-skill-overlay-architecture.png)

### Problem

Claude Code provides base capabilities through skills like `brainstorming` and `test-driven-development`. However, production projects need project-specific constraints layered on top of these generic capabilities. Writing all constraints inline in prompts is verbose and inconsistent.

### Solution

Skills extend base capabilities through an overlay architecture:

```
base capability (e.g., superpowers:test-driven-development)
    + project-specific rules (constitutional rules, conventions)
    + hook activations (when to fire which guards)
    + integration points (how this skill connects to others)
    = skill overlay
```

The overlay architecture works with **any structured skill set**, not just Claude Code's built-in capabilities. OpenSpec, custom agent frameworks, or any system that drives agent behavior through declarative configuration can be wrapped and extended with project-specific rules. The examples in this repo reference superpowers because it's the framework in active use, but the pattern is universal: identify the base skill, then overlay project constraints.

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

- Real dependencies in E2E/integration and stack tests — no mocking database drivers in stack tests (constitutional rule)
- Real dependencies in E2E/integration and stack tests — no mocking payment processor libraries in stack tests (constitutional rule)
- Full-loop assertion requirements (project convention)
- Hook to track test file changes (integration with workflow)

When the agent invokes this skill, it inherits the base TDD workflow plus all project-specific constraints automatically.

### Anti-Pattern

Copying the same rules into every prompt. This creates drift—prompts get updated inconsistently, and some code paths miss critical constraints.

### Cross-References

- @L0-foundation.md#pattern-04-claude-md-as-project-constitution — CLAUDE.md as rule source

---

## Pattern 2.2 — The Skill Chain

![Skill Chain Pipeline](diagrams/2.2-skill-chain-pipeline.png)

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

### Reference Implementation

The [rig](https://github.com/franklywatson/claude-rig) repo implements this pattern with [`SkillPhaseTracker`](https://github.com/franklywatson/claude-rig/blob/main/src/skills/phase-tracker.ts) for tracking which phases the agent has visited and validating transitions between skill phases.

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

### Reference Implementation

The [rig](https://github.com/franklywatson/claude-rig) repo implements composable hooks in [`src/enforcement/`](https://github.com/franklywatson/claude-rig/tree/main/src/enforcement) with a `handlePostToolUse` orchestrator that runs multiple checks and resolves to the most severe enforcement level.

---

## Pattern 2.4 — Constitutional Rules

### Problem

Projects have rules that should never be violated—core constraints that define the project's approach. When these rules are scattered across documentation or written as soft suggestions, they get forgotten or worked around.

### Solution

Constitutional rules are hard constraints declared in CLAUDE.md that never relax. They are the foundation of the project's guardrail system.

**Example constitutional rules from a production ecommerce platform:**

- **Real dependencies in E2E/integration and stack tests** — logger, payment processor libraries (Stripe, PayPal), database drivers, HTTP clients for first-party services. Use real components in stack tests. Mocks are appropriate in unit tests.
- **Full accounting for every state change** — every inventory change, every order, every transaction fee must be logged and queryable.
- **Evidence-based claims only** — show command output before claiming done. "Tests pass" is not evidence; show the test output.
- **Docker-first development** — no local OS execution. Everything runs in containers.
- **No conditional test assertions** — tests must be able to fail. (@L1-feedback-loops.md#pattern-16-test-integrity-rules)

**The rules flow:**

```
CLAUDE.md declares constitutional rules
    +-> plan+ includes rules in plan template (what must this plan respect?)
            +-> tdd+ rejects mocked components in stack test generation
                    +-> review+ checks constitutional compliance (did this violate any rules?)
```

### In Practice

Constitutional rule enforcement in the skill chain:

1. **plan+** reads CLAUDE.md and adds a "Constitutional compliance" section to each plan
2. **tdd+** checks that proposed stack tests don't mock protected components
3. **review+** runs a checklist that includes "No constitutional rules violated"

When the agent attempts to mock a database driver in a stack test, the tdd+ skill blocks it with a reference to the constitutional rule.

### Anti-Pattern

Writing "soft" rules with exceptions. Constitutional rules must have no escape hatches. If a rule needs exceptions, it is not constitutional—it is a guideline, not a constraint.

### Cross-References

- @L0-foundation.md#pattern-04-claude-md-as-project-constitution — CLAUDE.md format
- @L1-patterns/1.5-no-mock-philosophy.md — Real dependencies in E2E/integration and stack tests

### Reference Implementation

The [rig](https://github.com/franklywatson/claude-rig) repo implements constitutional rule checking with [`checkConstitutional()`](https://github.com/franklywatson/claude-rig/blob/main/src/enforcement/checks/constitutional.ts) which uses regex detection to identify mock patterns in edited files and blocks violations.

---

## Pattern 2.5 — Zero-Defect Tolerance

### Problem

Agents don't have intuition to work around known issues. When developers tolerate "unrelated" failures or "pre-existing" warnings, agents lose the ability to self-diagnose systematically. A tolerated defect becomes an undiagnosed regression later.

### Solution

Zero-defect tolerance: every error, warning, and failure must be addressed. Not just "relevant" errors—ALL of them. This applies to both unit tests and stack tests — dismissing a unit test failure while trusting stack test results means relying on partial feedback.

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
- @L4-standards-measurement.md#pattern-41--evidence-based-claims — Evidence standards

### Reference Implementation

The [rig](https://github.com/franklywatson/claude-rig) repo implements zero-defect enforcement with [`checkZeroDefect()`](https://github.com/franklywatson/claude-rig/blob/main/src/enforcement/checks/zero-defect.ts) which parses test runner output for failures, errors, and warnings and surfaces them as enforcement results.

---

## Pattern 2.6 — Enforcement Pipeline Composition

### Problem

Individual enforcement checks (stale tests, zero-defect, constitutional rules) are useful in isolation, but a production guardrail system needs to compose multiple checks into a single hook response. Without a composition pattern, each check runs independently with no unified severity resolution.

### Solution

A composable enforcement pipeline where each check is an independent function returning `{ level, message }`. The pipeline runs all checks and resolves to the most severe level (block > advise > silent). Checks are configurable per-rule via a config file (`.harness.yaml`).

**Key concepts:**

- Each check has one responsibility (stale test detection, scope control, mock detection, failure parsing)
- Checks compose through a single orchestrator (`handlePostToolUse`)
- Severity resolution: most severe level wins
- Configurable: each rule can be block/advise/silent independently

### In Practice

```typescript
// Each check returns a result with severity level
type CheckResult = { level: 'block' | 'advise' | 'silent'; message: string };

// The pipeline runs all checks and resolves to the most severe
async function handlePostToolUse(tool: string, args: unknown): Promise<EnforcementResponse> {
  const checks = [
    checkStaleTests(tool, args),
    checkConstitutional(tool, args),
    checkZeroDefect(tool, args),
    checkScope(tool, args),
  ];

  const results = await Promise.all(checks);
  const maxSeverity = results.reduce((max, r) =>
    severityOrder(r.level) > severityOrder(max.level) ? r : max
  );

  return { level: maxSeverity.level, messages: results.map(r => r.message) };
}
```

### Reference Implementation

The [rig](https://github.com/franklywatson/claude-rig) repo implements this in [`src/enforcement/`](https://github.com/franklywatson/claude-rig/tree/main/src/enforcement) with composable checks and a `handlePostToolUse` orchestrator that resolves severity.

### Anti-Pattern

Running checks independently without severity resolution. If one check returns "block" and another returns "advise," the agent needs a single clear signal, not conflicting messages.

### Cross-References

- [Pattern 2.3 — Hook Automation](#pattern-23--hook-automation) — Hooks fire checks; the pipeline composes them
- [Pattern 2.7 — Phase Transition Validation](#pattern-27--phase-transition-validation) — Phase-aware checks change behavior by skill phase

---

## Pattern 2.7 — Phase Transition Validation

### Problem

The skill chain (brain+ → plan+ → tdd+ → verify+ → review+) is described as a conceptual pipeline, but without enforcement agents can skip phases. Skipping plan+ before tdd+ means unstructured implementation. Skipping tdd+ before verify+ means unverified code.

### Solution

A state machine that tracks which phases the agent has visited and validates transitions. Each phase records its visit with a timestamp. Transition validation checks that prerequisites are met before allowing entry to the next phase.

**Key concepts:**

- Phase history with timestamps
- Transition validation: `tdd+` requires prior `plan+` visit, `verify+` requires prior `tdd+` visit
- Query methods: `isTddPhase()`, `isVerifyPhase()` for conditional behavior
- Reset capability for new workflows

### In Practice

```typescript
class PhaseTracker {
  private history = new Map<string, Date>();

  enter(phase: string): void {
    this.validateTransition(phase);
    this.history.set(phase, new Date());
  }

  private validateTransition(phase: string): void {
    if (phase === 'tdd+' && !this.history.has('plan+')) {
      throw new Error('Cannot enter tdd+ without prior plan+ visit');
    }
    if (phase === 'verify+' && !this.history.has('tdd+')) {
      throw new Error('Cannot enter verify+ without prior tdd+ visit');
    }
  }
}
```

### Reference Implementation

The [rig](https://github.com/franklywatson/claude-rig) repo implements this in [`src/skills/phase-tracker.ts`](https://github.com/franklywatson/claude-rig/blob/main/src/skills/phase-tracker.ts) with transition validation, query methods, and reset capability.

### Anti-Pattern

Treating phase tracking as advisory. If the tracker warns but allows invalid transitions, agents learn to ignore it. Phase enforcement must be blocking.

### Cross-References

- [Pattern 2.2 — The Skill Chain](#pattern-22--the-skill-chain) — The chain that phase validation enforces
- [Pattern 2.3 — Hook Automation](#pattern-23--hook-automation) — Hooks can check phase state before allowing operations

---

## Pattern 2.8 — Compound Engineering

### Problem

Traditional development accumulates complexity. Each feature adds surface area, each bugfix patches over a gap, and each session starts from roughly the same knowledge baseline as the one before. Agents compound this problem: without persistent memory, every session re-derives the same lessons. The first time an agent solves an N+1 query problem, it takes research. The next session facing the same problem starts from zero.

### Solution

**Each unit of engineering work should make subsequent units easier, not harder.** Compound engineering extends the skill chain ([Pattern 2.2](#pattern-22--the-skill-chain)) with a feedback loop: after each cycle of brainstorm → plan → work → review, explicitly capture learnings back into the system so future sessions — by the same agent or different ones — start from a higher knowledge baseline.

The core cycle:

```
brainstorm → plan → work → review → compound → repeat
    ^                                     |
    └─── knowledge feeds back ────────────┘
```

**The compounding principle:** 80% planning and review, 20% execution. Thorough planning prevents wasted implementation. Review catches issues while context is fresh. Codified learnings prevent re-deriving solutions. Quality is not a separate phase — it is the mechanism that makes future work easier.

**What compounds:**

- **Documented solutions** — When a bug is fixed, document the symptoms, root cause, and prevention strategy. Next time the same symptom appears, the lookup takes minutes instead of research.
- **Refined plans** — Plans that survived review become templates for similar features. Each planning cycle sharpens the next.
- **Captured patterns** — Architecture decisions, trade-off analyses, and failure modes recorded during review become reference material for future design sessions.
- **Constitutional amendments** — When a review catches a novel violation, the constitutional rules ([Pattern 2.4](#pattern-24--constitutional-rules)) expand to cover it.

**What does NOT compound:**

- Undocumented fixes that live only in conversation history
- Plans that are discarded after implementation without extracting lessons
- Reviews that approve or reject without recording *why*
- Errors dismissed as "unrelated" rather than investigated and catalogued

### In Practice

The [compound-engineering](https://github.com/EveryInc/compound-engineering-plugin) plugin implements this pattern with `/ce:compound` — a skill that captures solved problems into structured documentation (`docs/solutions/`) with YAML frontmatter for searchability. Each documented solution reduces the cost of the next occurrence from research to lookup.

The my-claw project's design rinsing lineage ([my-claw case study](../references/reference-my-claw-case-study.md)) demonstrates compounding across sessions: each rinsing phase extracted patterns that the next phase built on, producing more value because it started from a richer foundation.

**Compounding across the pattern pyramid:**

| Level | What Compounds | Mechanism |
|-------|---------------|-----------|
| L0 | Clean structure, current docs | [Pattern 0.8 — Aggressive Cleanup](L0-foundation.md#pattern-08--aggressive-cleanup) removes noise each session |
| L1 | Test coverage, verification infrastructure | Stack tests accumulate; each new test catches regressions permanently |
| L2 | Constitutional rules, skills, learnings | Each review that catches a novel violation strengthens the guardrail system |
| L3 | Codebase index, routing rules | Session caching ([Pattern 3.8](L3-optimization.md#pattern-38--session-lifecycle)) carries detection forward |
| L4 | Metrics, drift corrections | Measurement creates a tightening feedback loop |

### Anti-Pattern

- **Disposable sessions** — Work that produces code but no learnings. The feature ships, the bug is fixed, but nothing is captured for next time.
- **Knowledge silos** — Learnings stored in conversation history, personal notes, or tribal memory instead of discoverable documentation.
- **Review without extraction** — Code reviews that approve or reject without recording the reasoning, missing the opportunity to compound the architectural insight.
- **Premature abstraction** — Compounding knowledge is not the same as building frameworks. Document the *why*, not just the *what*. Let patterns emerge from documented solutions before promoting them into abstractions.

### Cross-References

- [Pattern 2.2 — The Skill Chain](#pattern-22--the-skill-chain) — The workflow pipeline that compound engineering extends
- [Pattern 2.4 — Constitutional Rules](#pattern-24--constitutional-rules) — Rules that grow through compounding
- [Pattern 4.1 — Evidence-Based Claims](L4-standards-measurement.md#pattern-41--evidence-based-claims) — Compounding requires evidence, not assumptions
- [Reference my-claw Case Study](../references/reference-my-claw-case-study.md) — Design rinsing lineage demonstrates compounding across three phases

### Reference Implementation

The [compound-engineering](https://github.com/EveryInc/compound-engineering-plugin) plugin provides the `/ce:compound` skill for capturing solved problems into structured, searchable documentation. The [rig](https://github.com/franklywatson/claude-rig) framework's skill chain implements the brainstorm → plan → work → review portion; compound engineering closes the loop by feeding learnings back.

---

## Summary

L2 behavioral guardrails automate enforcement of the discipline established in L1. Skills extend base capabilities with project-specific rules. Hooks enforce rules through the tool layer. Constitutional rules declare hard constraints. Zero-defect tolerance ensures systematic self-diagnosis. Compound engineering closes the loop — each cycle of work feeds learnings back into the system, making subsequent cycles more effective.

Together, these patterns make correct behavior the path of least resistance for agentic development.

## Practitioner Insight

> "Spend a lot of time planning out the work the agent will do."
> — Peter Steinberger, creator of OpenClaw

The skill chain's brain+ → plan+ phase operationalizes this insight. Fleshing out a plan — challenging the agent, tweaking scope, pushing back on assumptions — before implementation begins prevents wasted tokens on wrong paths. The plan becomes the contract that tdd+, verify+, and review+ enforce.

---

**Previous:** [L1: Closed Loop Design and Verification](L1-feedback-loops.md) | **Next:** [L3: Optimization — Token Efficiency & Agent Performance](L3-optimization.md) | [Back to Overview](../README.md)
