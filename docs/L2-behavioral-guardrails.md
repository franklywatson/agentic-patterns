# L2: Behavioral Guardrails

Prose is guidance. Hooks are deterministic policy within the harness. Containment and credentials are the boundary. Put each rule at the lowest layer that can hold it:

- What must never happen is prevented by the sandbox, credential scope, or downstream authorisation.
- What must always happen runs as a hook and a required CI check.
- Prompts and skills carry everything else.

A hook runs inside the agent's operating environment, so it is not a security boundary. Anthropic's guidance
says that a rule the model keeps missing despite emphasis belongs in a hook rather than in more prose
([OM-7](references/sources.md)). Independent sources reach the same split between instructions, policy
checks and boundaries ([SG-7, SG-11, SG-16, OM-18](references/sources.md)).

**A note on skills frameworks:** The skills referenced in this document (brainstorming,
test-driven-development, verification-before-completion) are drawn from the
[superpowers](https://github.com/obra/superpowers) framework by Jesse Vincent (obra). The patterns are
framework-agnostic; equivalent skill sets exist in [gstack](https://github.com/garrytan/gstack),
[OpenSpec](https://github.com/openspec-dev/openspec) and other frameworks. **Disclosure:** the author of this
library also wrote [rig](https://github.com/franklywatson/claude-rig), which this document links to as a
reference implementation. Hook syntax in this document follows Claude Code; each pattern states the contract
(what runs, when, with what authority), so other harnesses can bind it.

## Overview

L2 decides where each rule is held. A rule is as strong as its weakest enforcement point and no stronger. The layers, from weakest to strongest:

| Layer | Mechanism | Holds | Can the agent bypass it? |
|-------|-----------|-------|--------------------------|
| Prompt | CLAUDE.md / AGENTS.md, skills | Conventions, preferences, procedure | Yes. The model may not follow it |
| Hook | PreToolUse and PostToolUse scripts | Policy that matches structured tool arguments | Often. Hooks match tool calls, not what a permitted tool does once running, and project hook files are usually editable by the agent |
| CI | Required checks on the merge path | Invariants that must hold for every change | No, if the check is required and the agent cannot edit the workflow or branch protection |
| Sandbox | Filesystem and network isolation, credentials absent from the environment | What must never happen | No, if the sandbox is locked and fails closed |
| Downstream | Authorisation in the system being called (scoped token, protected branch, approval) | Irreversible or external actions | No |

A sandbox with credentials kept outside it makes hooks such as "block `sed -i`" or "block `docker system
prune`" unnecessary as safety controls. They remain useful as ergonomic nudges
([AN-9, SG-10](references/sources.md)). Sandbox and credential setup is outside the scope of this document.

The mechanisms in this document:

- **Skills**: overlay patterns that extend base agent capabilities with project-specific rules (prompt layer)
- **Hooks**: scripts that fire around tool calls (hook layer)
- **Constitutional rules**: the hard rules, each with a named enforcement point
- **Zero-defect tolerance**: the discipline that keeps feedback unambiguous
- **Skill chain and phase tracking**: optional workflow ceremony, scaled to risk

---

## Pattern 2.1 — Skill Overlay Architecture

![Skill Overlay Architecture](diagrams/2.1-skill-overlay-architecture.png)

### Problem

Claude Code provides base capabilities through skills like `brainstorming` and `test-driven-development`. Production projects need project-specific constraints layered on top of these generic capabilities. Writing all constraints inline in prompts is verbose and inconsistent.

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
- **Rules**: project-specific constraints this skill carries
- **Hook activations**: what guards this skill relies on
- **Integration points**: what other skills compose with this
- **Checklist**: steps the agent follows when using the skill

A skill is prompt-layer material. It raises the probability that the agent follows a rule; it does not
guarantee it. A rule that must hold on every change needs a hook or CI check behind it, and the skill states
which one. Keep skills short: a skill that restates rules already enforced elsewhere adds context cost without
adding enforcement.

The overlay architecture works with any structured skill set (superpowers, OpenSpec, custom frameworks): identify the base skill, then overlay project constraints.

### In Practice

A TDD skill for an ecommerce project might extend `superpowers:test-driven-development` and add:

- No mocking of database drivers in stack tests (enforced by a hook on test-file edits and a CI check)
- No mocking of payment processor libraries in stack tests (same enforcement)
- Full-loop assertion requirements (project convention, carried by the skill)

When the agent invokes this skill, it inherits the base TDD workflow plus the project-specific constraints.

### Anti-Pattern

Copying the same rules into every prompt. This creates drift: prompts get updated inconsistently, and some code paths miss constraints. The opposite failure is carrying non-negotiable rules only as skill prose, with no hook or CI check behind them.

### Cross-References

- [Pattern 0.4 — Agent instruction file as project constitution](L0-foundation.md#pattern-04--agent-instruction-file-as-project-constitution) — instruction file as rule source
- [Pattern 2.4 — Constitutional Rules](#pattern-24--constitutional-rules) — enforcement point per rule

---

## Pattern 2.2 — The Skill Chain

![Skill chain pipeline (optional)](diagrams/2.2-skill-chain-pipeline.png)

**Status: optional.** Scale ceremony to risk. A one-line fix does not need five phases. Verification and
review stay outcome gates for every change: evidence before claiming done, and review before merge, at a
depth set by reversibility and blast radius.

### Problem

A fixed five-phase chain applied to every change adds ceremony to small changes, and people learn to skip
phases in bulk. The gates that matter (tests run, evidence shown, review done) are outcomes that CI and the
merge process can hold directly, whichever phases the agent visited.

### Solution

Compose skills into a workflow pipeline when the change is large or risky enough to justify it:

```
brain+ (design with stack-first considerations)
      +-> plan+ (create plan with testing strategy)
              +-> tdd+ (RED-GREEN-REFACTOR with full-loop)
                      +-> verify+ (evidence before claims)
                              +-> review+ (checklist-based compliance review)
```

**Chain phases:**

1. **brain+**: Design with stack testing in mind. What needs Docker? What are the full-loop assertions?
2. **plan+**: Create implementation plan with explicit testing strategy. Which tests cover which requirements?
3. **tdd+**: RED-GREEN-REFACTOR with full-loop assertions ([Pattern 1.2](L1-patterns/1.2-full-loop-assertions.md)).
4. **verify+**: Evidence-based claims. Run commands, show output, then claim done.
5. **review+**: Checklist-based compliance review. Tests pass, docs updated, constitutional rules followed.

**Scaling by risk:**

| Change | Suggested path | Gates that always apply |
|--------|---------------|-------------------------|
| Typo, comment, docs wording | Edit, run link and lint checks | CI checks, review at the team's normal depth |
| Small, reversible code change | tdd+, verify+ | Tests and evidence; review before merge |
| New feature or cross-module change | Full chain | All of the above plus plan review |
| Irreversible or external effect (migration, payment path, permissions) | Full chain plus a human approver who is not the requester | All of the above plus downstream authorisation |

The phases are a means. The outcome gates (verification evidence, review) are the point, and they are held
by CI and the merge process, not by whether the agent visited a phase.

**Superpowers framework integration:** The [obra/superpowers](https://github.com/obra/superpowers) library provides base skills the chain builds on:

| Skill | Role in Chain |
|-------|--------------|
| [brainstorming](https://github.com/obra/superpowers) | Design and requirements exploration — feeds into planning |
| [writing-plans](https://github.com/obra/superpowers) | Creates bite-sized implementation plans with testing strategy |
| [executing-plans](https://github.com/obra/superpowers) | Task-by-task execution with review checkpoints |
| [test-driven-development](https://github.com/obra/superpowers) | RED-GREEN-REFACTOR with full-loop assertions |
| [verification-before-completion](https://github.com/obra/superpowers) | Evidence-based claims — commands run, output shown, then claim |
| [requesting-code-review](https://github.com/obra/superpowers) | Checklist-based review against plan requirements |
| [finishing-a-development-branch](https://github.com/obra/superpowers) | Integration decisions (merge, PR, cleanup) when work is complete |

### Anti-Pattern

Running the full chain on every change regardless of risk, so that agents and reviewers learn to skip phases
in bulk. The opposite failure is shipping without verification evidence or review because the change "looked small".

### Cross-References

- [Pattern 1.1 — Stack Tests](L1-patterns/1.1-stack-tests.md) — stack testing foundation
- [Pattern 1.2 — Full-Loop Assertion Layering](L1-patterns/1.2-full-loop-assertions.md) — assertion requirements
- [Glossary](cross-cutting/glossary.md) — skill chain terminology

### Reference Implementation

The [rig](https://github.com/franklywatson/claude-rig) repo implements the chain as skills, with a phase tracker; see its `src/skills/` directory.

---

## Pattern 2.3 — Hook Automation

### Problem

Agents drop rules when context shifts or prompts get complex. Instructions written in prose are not an enforcement mechanism for rules that must always hold.

### Solution

Hooks are scripts the harness runs before or after a tool call. They apply policy through the tool layer, independent of prompt content. Claude Code documents the hook events and their exit-code contract ([SG-11](references/sources.md)).

**Contract:** a hook receives the tool name and arguments, and returns allow, advise or block. Two timing
classes differ in what they can do:

**PreToolUse hooks** run before the tool call and can block it. Use them for policy that matches structured
arguments:

- Refuse an Edit whose `file_path` is a protected path (CI workflow, hook configuration, lockfile)
- Refuse an Edit that adds a mock import to a stack-test file
- Rewrite or redirect a call to a better tool (ergonomic nudge)

**PostToolUse hooks** run after the tool call. They are detective: they can report, record and advise, but
they cannot prevent a call that has already run ([Pattern 2.6](#pattern-26--enforcement-pipeline-composition)). Use them for:

- Track source file edits in `pending-tests.json`
- Emit "TEST TASK REQUIRED" when code changes without corresponding test changes
- Append an audit record (tool, arguments, time)

**What hooks cannot hold:**

- Hooks gate the agent's tool calls. They do not constrain what a permitted tool does once running. Any
  allowed `bash`, `python`, `node`, `docker` or `make` is a general-purpose computer.
- A regex over a free-text shell string is bypassable (quoting, variables, a script that does the work).
  Hooks are strongest when they match structured arguments such as an Edit call's file path.
- Project-level hook configuration is usually a file the agent can edit. Where the harness supports
  managed settings that the agent cannot edit, put policy hooks there ([SG-12](references/sources.md)).

Use hooks for what must always happen in the workflow and for ergonomics. Use the sandbox, credential scope
and downstream authorisation for what must never happen.

**Hook decision flow:**

```
hook fires
    +-> check state (which file? which arguments? what is on disk?)
            +-> allow (operation proceeds)
            +-> advise (operation proceeds; a message explains the better path)
            +-> block (PreToolUse only: the call does not run)
```

### In Practice

A PreToolUse hook that blocks an Edit to a protected path (Claude Code binding, shell hook reading JSON on
stdin and exiting with code 2 to block):

```bash
#!/usr/bin/env bash
# PreToolUse hook for the Edit and Write tools.
path=$(python3 -c 'import json,sys; print(json.load(sys.stdin)["tool_input"]["file_path"])')
case "$path" in
  .github/workflows/*|.claude/settings*.json)
    echo "Blocked: $path is protected policy. Ask a human to change it." >&2
    exit 2 ;;
esac
exit 0
```

A PostToolUse hook is a record, not a gate:

```bash
#!/usr/bin/env bash
# PostToolUse hook: append an audit line after every Edit or Write.
python3 -c 'import json,sys,time; d=json.load(sys.stdin); print(json.dumps({"t":time.time(),"tool":d["tool_name"],"input":d["tool_input"]}))' \
  >> .audit/tool-calls.jsonl
exit 0
```

### Anti-Pattern

- Using a hook as the only control for something that must never happen (a destructive command, credential
  access). The sandbox and credential scope hold that rule; the hook is defence in depth.
- Advisory hooks for rules that must hold. Agents treat repeated warnings as noise; a rule that must hold needs
  a block (PreToolUse) or a required CI check.
- Blocking hooks that match too broadly and stop legitimate work. Keep each hook narrow, with documented behavior.

### Cross-References

- [Pattern 2.4 — Constitutional Rules](#pattern-24--constitutional-rules) — which layer holds which rule
- [Pattern 2.6 — Enforcement Pipeline Composition](#pattern-26--enforcement-pipeline-composition) — composing checks
- [L3: Optimization](L3-optimization.md#pattern-31--smart-routing--tool-selection) — hooks used as ergonomic routing nudges
- [examples/guardrails](../examples/guardrails/) — hook-adjacent middleware example

### Reference Implementation

The [rig](https://github.com/franklywatson/claude-rig) repo implements composable hooks in `src/enforcement/`.

---

## Pattern 2.4 — Constitutional Rules

### Problem

Projects have rules that define their approach. When these rules are scattered across documentation or written as soft suggestions, they get forgotten or worked around. A rule declared in prose and enforced by nothing is only as strong as the model's attention on that turn.

### Solution

Constitutional rules are the hard rules declared in the instruction file (CLAUDE.md or AGENTS.md). **Each rule
names its enforcement point**, and a rule is only as absolute as its weakest enforcement point. The points,
from [the layers above](#overview): prompt, hook, CI, sandbox, downstream.

**Example rules and their enforcement points:**

| Rule | Enforcement point | What holds it |
|------|-------------------|---------------|
| Real dependencies in E2E/integration and stack tests | Prompt, hook (best effort), CI | Skill carries the rule; PreToolUse hook (best effort, since a regex on imports is bypassable) blocks mock imports in stack-test files; CI check greps stack-test directories for mock libraries |
| No conditional test assertions | CI | Lint rule or test-integrity check in the required CI job ([Pattern 1.6](L1-patterns/1.6-test-integrity.md)) |
| Evidence-based claims only | Prompt, CI | Verification skill requires output; CI result is the evidence the reviewer reads |
| Zero-defect tolerance | CI | Required check fails on any test failure, lint error or warning |
| Docs updated with code | CI | Required check fails when `examples/` changes without a `docs/` change |
| No production credentials in the agent's environment | Sandbox, downstream | Credentials injected outside the sandbox; scoped, short-lived tokens; the production system authorises independently |
| No writes outside the working tree, no unapproved network egress | Sandbox | Filesystem and network policy, locked and failing closed |
| Docker-first development, never prune shared Docker state | Prompt, sandbox | Skill states the rule; the sandbox denies access to the host Docker socket |
| Requester cannot approve their own change | Downstream | Branch protection requiring a non-author review |

**The rules flow:**

```
Instruction file declares the rule and its enforcement point
    +-> skill carries the procedure (prompt)
            +-> PreToolUse hook blocks the structured violation (hook)
                    +-> required CI check catches what slipped past (CI)
                            +-> sandbox, credentials and downstream authorisation hold what must never happen
```

If a rule has only a prompt entry, say so in the table. That marks it as guidance that may be missed, and
tells a reviewer where to look.

### In Practice

1. The plan step reads the constitutional rules and lists, per rule, which enforcement points the change touches.
2. The TDD step rejects mocked components in stack-test generation; the PreToolUse hook blocks the edit if it does not.
3. The review step checks that each rule's CI check ran and passed, rather than re-reading the code for the rule.

### Anti-Pattern

- Rules with an enforcement-point column of "prompt" only, presented as absolute. Regex-based checks and
  prose are not absolute; state what holds the rule.
- Declaring a safety rule ("never touch production") and enforcing it with a hook alone. A permitted tool can
  do what the hook forbids by another route. Hold it in the sandbox or downstream.

### Cross-References

- [Pattern 0.4 — Agent instruction file as project constitution](L0-foundation.md#pattern-04--agent-instruction-file-as-project-constitution) — instruction file format
- [Pattern 1.5 — Real Dependencies](L1-patterns/1.5-no-mock-philosophy.md) — the rule behind the first example

### Reference Implementation

The [rig](https://github.com/franklywatson/claude-rig) repo implements a constitutional check in `src/enforcement/checks/constitutional.ts`; it detects mock patterns in edited files by regex, so it is a hook-layer check and inherits the limits listed in [Pattern 2.3](#pattern-23--hook-automation).

---

## Pattern 2.5 — Zero-Defect Tolerance

### Problem

Agents do not have the intuition to work around known issues. When developers tolerate "unrelated" failures or "pre-existing" warnings, agents lose the ability to self-diagnose systematically. A tolerated defect becomes an undiagnosed regression later.

### Solution

Every error, warning and failure is addressed, not only the relevant ones. This applies to unit tests and stack tests alike: dismissing a unit test failure while trusting stack test results relies on partial feedback.

**What zero-defect means:**

- "This failure is unrelated" is not accepted without evidence of isolation (different subsystem, proven by a run)
- "This warning was pre-existing" means fix it now
- A test that fails for any reason either passes or is explicitly skipped with documentation
- Compiler warnings are resolved, not suppressed
- Linter errors are fixed, not waived

**Enforcement point:** CI. A required check that fails on any test failure, lint error or warning holds
this rule. The agent's prompt and the verification skill state it; they do not hold it.

**Why this matters for agents:** Agents process feedback systematically. When output contains errors, agents must be able to assume those errors are relevant. If some errors are "okay to ignore," the agent cannot distinguish which require action, and the feedback loop breaks.

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
4. The task is complete only when all errors and warnings are resolved

Not zero-defect:

1. "The module error is unrelated to the order test"
2. Focus only on the order test failure
3. Leave the module error unfixed

### Anti-Pattern

Classifying errors as "relevant" or "irrelevant" without evidence. Unless you can prove an error is unrelated, assume it is relevant.

### Cross-References

- [Pattern 1.3 — Sequential / Additive Test Design](L1-patterns/1.3-sequential-design.md) — sequential test ordering
- [Pattern 4.1 — Evidence-Based Claims](L4-standards-measurement.md#pattern-41--evidence-based-claims) — evidence standards

### Reference Implementation

The [rig](https://github.com/franklywatson/claude-rig) repo parses test-runner output for failures and warnings in `src/enforcement/checks/zero-defect.ts`.

---

## Pattern 2.6 — Enforcement Pipeline Composition

### Problem

Individual checks (stale tests, zero-defect, constitutional rules) are useful alone, but several checks firing on one tool call produce conflicting messages unless one severity is resolved.

### Solution

A pipeline in which each check is an independent function returning a level (block, advise or silent) and a message. The pipeline runs all checks and resolves to the most severe level (block > advise > silent). Checks are configurable per rule in a project config file.

**PostToolUse checks are detective, not preventive.** A PostToolUse hook runs after the tool call has
completed. It can report a violation, record it and tell the agent to repair it, but it cannot prevent the call
that already ran. A "block" level returned from a PostToolUse pipeline means "stop and repair before
continuing", delivered as feedback to the agent. Prevention needs a PreToolUse hook (for structured
arguments) or a boundary outside the agent (sandbox, credentials, a required CI check).

| Check timing | Can prevent the call? | Use for |
|--------------|----------------------|---------|
| PreToolUse | Yes | Protected paths, mock imports in stack-test files |
| PostToolUse | No (detective) | Stale-test tracking, failure parsing, audit records |
| Required CI check | Yes, for merge | Invariants on every change |
| Sandbox / credential scope | Yes, for the whole session | What must never happen |

**Key concepts:**

- Each check has one responsibility (stale-test detection, scope control, mock detection, failure parsing)
- Checks compose through a single orchestrator
- Severity resolution: the most severe level wins, so the agent gets one clear signal
- Each rule is configurable as block, advise or silent

### In Practice

A pipeline contract in prose:

1. The orchestrator receives the tool name, arguments and (for PostToolUse) the tool result.
2. It runs every enabled check; each returns a level and a message.
3. It returns the highest level and the messages of every check at that level.
4. The harness delivers the result: a PreToolUse "block" stops the call; a PostToolUse result is feedback.

For the implementation, see the reference below.

### Anti-Pattern

- Running checks independently without severity resolution, so the agent receives a "block" and an "advise" and has to guess which governs.
- Describing a PostToolUse check as a guardrail that stops a violation. It reports the violation after the fact.

### Cross-References

- [Pattern 2.3 — Hook Automation](#pattern-23--hook-automation) — hooks fire checks; the pipeline composes them
- [Pattern 2.7 — Phase Transition Validation](#pattern-27--phase-transition-validation) — optional phase-aware checks

### Reference Implementation

The [rig](https://github.com/franklywatson/claude-rig) repo implements the pipeline in `src/enforcement/` with an orchestrator, `handlePostToolUse`, that resolves severity. Its code is not reproduced here.

---

## Pattern 2.7 — Phase Transition Validation

**Status: optional.** Scale ceremony to risk; verification and review stay outcome gates. Use phase tracking
when a team wants an audit trail of which workflow phases ran on large or risky changes. It is not a
precondition for good work, and it does not replace CI evidence.

### Problem

Where a team uses the skill chain ([Pattern 2.2](#pattern-22--the-skill-chain)), agents can skip phases:
implementing without a plan, or claiming completion without verification. Teams that want a record of which
phases ran, or a warning when a phase was skipped on a high-risk change, need state to check.

### Solution

A small state machine that records each phase visit with a timestamp and checks declared prerequisites on
entry (for example, `verify+` after `tdd+`). Query methods let other checks vary behavior by phase.

**Key concepts:**

- Phase history with timestamps
- Declared prerequisites per phase, configurable per risk tier (for example, required for irreversible changes, advisory for small ones)
- Query methods such as "is the agent in the TDD phase?"
- A reset for new workflows

A phase tracker is state inside the harness. It records that the agent visited a phase, not that the phase
did its job. The gates that confirm the job (tests ran, evidence shown, review done) are held by CI and the
merge process.

### In Practice

The contract, in prose:

1. On entering a phase, the tracker checks the declared prerequisites for the current risk tier.
2. A missing prerequisite on a high-risk change returns a block (PreToolUse) or an advisory message (low-risk change).
3. The tracker records the phase and timestamp.

For the implementation, see the reference below.

### Anti-Pattern

- Treating phase visits as proof of quality. Visiting `verify+` does not show that verification evidence exists.
- Applying one blocking policy to every change. A required five-phase path on a typo fix teaches agents and reviewers to bypass the tracker.

### Cross-References

- [Pattern 2.2 — The Skill Chain](#pattern-22--the-skill-chain) — the optional chain this tracks
- [Pattern 2.3 — Hook Automation](#pattern-23--hook-automation) — hooks can consult phase state

### Reference Implementation

The [rig](https://github.com/franklywatson/claude-rig) repo implements a phase tracker in `src/skills/phase-tracker.ts` with transition validation, query methods and reset. Its code is not reproduced here.

---

## Pattern 2.8 — Compound Engineering

### Problem

Traditional development accumulates complexity. Agents compound this: without persistent memory, every session re-derives the same lessons. The first time an agent solves an N+1 query problem, it takes research. The next session facing the same problem starts from zero.

### Solution

**Each unit of engineering work should make subsequent units easier, not harder.** Compound engineering extends the workflow with a feedback loop: after each cycle of brainstorm, plan, work and review, capture learnings back into the system so future sessions start from a higher baseline.

The core cycle:

```
brainstorm → plan → work → review → compound → repeat
    ^                                     |
    └─── knowledge feeds back ────────────┘
```

**What compounds:**

- **Documented solutions** — symptoms, root cause and prevention for each fixed bug, so a recurrence is a lookup
- **Refined plans** — plans that survived review become templates for similar features
- **Captured patterns** — architecture decisions and failure modes recorded during review
- **Constitutional amendments** — when a review catches a novel violation, the rules ([Pattern 2.4](#pattern-24--constitutional-rules)) expand to cover it, with an enforcement point

**What does not compound:**

- Undocumented fixes that live only in conversation history
- Plans discarded after implementation without extracting lessons
- Reviews that approve or reject without recording why
- Errors dismissed as "unrelated" rather than investigated and catalogued

**Learnings are context, so they need review and pruning.** Agent-written learnings feed future prompts. A
wrong or stale learning degrades every later session, and the flywheel has to remove entries as well as add them
([IS-13](references/sources.md)). Promote a learning into shared context only after a human has reviewed it, and
prune learnings that no longer hold.

### In Practice

The [compound-engineering](https://github.com/EveryInc/compound-engineering-plugin) plugin implements this with `/ce:compound`, which captures solved problems into structured documentation (`docs/solutions/`) with YAML frontmatter for searchability. The vendor describes a split of 80% planning and review to 20% execution; that ratio is a vendor claim, not a measured result in this library.

**Compounding across the pattern pyramid:**

| Level | What Compounds | Mechanism |
|-------|---------------|-----------|
| L0 | Clean structure, current docs | [Pattern 0.8 — Aggressive Cleanup](L0-foundation.md#pattern-08--aggressive-cleanup) removes noise each session |
| L1 | Test coverage, verification infrastructure | Stack tests accumulate; each new test catches regressions permanently |
| L2 | Constitutional rules, skills, learnings | Each review that catches a novel violation adds a rule with an enforcement point |
| L3 | Codebase index, routing rules | Session caching carries detection forward |
| L4 | Metrics, drift corrections | Measurement creates a tightening feedback loop |

### Anti-Pattern

- **Disposable sessions** — work that produces code but no learnings.
- **Knowledge silos** — learnings stored in conversation history or personal notes instead of discoverable documentation.
- **Review without extraction** — approving or rejecting without recording the reasoning.
- **Unreviewed, unpruned learnings** — agent-written entries promoted to shared context without review, and never removed.
- **Premature abstraction** — compounding knowledge is not building frameworks. Document the why; let patterns emerge before promoting them.

### Cross-References

- [Pattern 2.4 — Constitutional Rules](#pattern-24--constitutional-rules) — rules that grow through compounding
- [Pattern 4.1 — Evidence-Based Claims](L4-standards-measurement.md#pattern-41--evidence-based-claims) — compounding requires evidence

### Reference Implementation

The [compound-engineering](https://github.com/EveryInc/compound-engineering-plugin) plugin provides `/ce:compound`. The [rig](https://github.com/franklywatson/claude-rig) framework implements the brainstorm, plan, work and review portion of the loop.

---

## Summary

Put each rule at the lowest layer that can hold it. Prose carries guidance. Hooks apply deterministic policy
inside the harness: PreToolUse can prevent a structured violation, PostToolUse detects after the fact. CI holds
invariants on the merge path. The sandbox, credential scope and downstream authorisation hold what must never
happen. Skills overlay project rules on base capabilities; the skill chain and phase tracker are optional and
scale with risk. Zero-defect tolerance keeps feedback unambiguous, and compound engineering feeds reviewed
learnings back into context.

## Practitioner Insight

> "Spend a lot of time planning out the work the agent will do."
> — Peter Steinberger, creator of OpenClaw

Planning is worth its cost when the change is large or risky. The plan becomes the contract that verification and review check against; for small reversible changes, a short plan or none is proportionate.

---

**Previous:** [L1: Closed Loop Design and Verification](L1-feedback-loops.md) | **Next:** [L3: Optimization — Token Efficiency & Agent Performance](L3-optimization.md) | [Back to Overview](../README.md)
