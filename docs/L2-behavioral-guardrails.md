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
([AN-9, SG-10](references/sources.md)). [Pattern 2.9](#pattern-29--contain-before-you-relax) covers sandbox
and credential setup.

The mechanisms in this document:

- **Skills**: overlay patterns that extend base agent capabilities with project-specific rules (prompt layer)
- **Hooks**: scripts that fire around tool calls (hook layer)
- **Constitutional rules**: the hard rules, each with a named enforcement point
- **Zero-defect tolerance**: the discipline that keeps feedback unambiguous
- **Containment, least agency, identity, supply chain and tiered review** (Patterns 2.9 to 2.13): the boundary
  and the controls around it
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

**Superpowers framework integration:** The [obra/superpowers](https://github.com/obra/superpowers) library
provides base skills the chain builds on. Skills are instructions the agent follows, so read them before you
install them ([Pattern 2.12](#pattern-212--skill-plugin-and-mcp-supply-chain)):

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

The same decision can be returned as JSON on stdout with exit code 0. A `deny` carries a reason that
Claude sees. Exit code 2 always blocks, even if the JSON says `allow`; any other non-zero exit code is a
non-blocking error and the call proceeds:

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "Protected path: ask a human to change it."
  }
}
```

Register the script in `.claude/settings.json` with an event, a tool-name matcher and a handler
([hooks reference](https://code.claude.com/docs/en/hooks)):

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [{ "type": "command", "command": ".claude/hooks/protect-paths.sh" }]
      }
    ]
  }
}
```

A project hook file is editable by the agent. To make hooks the policy of record, put them in managed settings
and set `allowManagedHooksOnly`, which blocks user, project, local and plugin hooks. Hooks themselves run outside the
Claude Code sandbox, with the user's full access, so review a hook script as you would any code that runs on
the machine.

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
- [L3: Optimization](L3-optimization.md#pattern-31--prefer-native-structured-tools-block-destructive-edits) — hooks used as ergonomic routing nudges
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

**An agent-written learning is untrusted input.** The agent may have written it after reading an issue, a web
page or a tool result that an outsider controls ([Pattern 2.10](#pattern-210--least-agency-and-session-composition)).
A planted instruction that becomes a learning is read by every later session. Use a review step:

1. The agent writes the learning to a draft location that sessions do not load automatically.
2. A person reads it, checks the claim against the code or a test, and checks that it contains no instruction
   aimed at the agent ("always run", "ignore", "send").
3. The person promotes it by moving it to the loaded location, with the date and the reviewer's name.
4. After a repair or fix, promote only after the confirmation window for that change has passed without a regression.
5. Learnings carry a review date and an owner. Prune on a schedule ([Pattern
   0.8](L0-foundation.md#pattern-08--aggressive-cleanup)).

### In Practice

The [compound-engineering](https://github.com/EveryInc/compound-engineering-plugin) plugin implements this with `/ce:compound`, which captures solved problems into structured documentation (`docs/solutions/`) with YAML frontmatter for searchability. The vendor describes a split of 80% planning and review to 20% execution; that ratio is a vendor claim, not a measured result in this library.

**Compounding across the layers:**

| Layer | What Compounds | Mechanism |
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
- **Unreviewed, unpruned learnings** — agent-written entries promoted to shared context without review, and
  never removed. Auto-loading the agent's own notes into every session turns one injected instruction into a
  standing one.
- **Premature abstraction** — compounding knowledge is not building frameworks. Document the why; let patterns emerge before promoting them.

### Cross-References

- [Pattern 2.4 — Constitutional Rules](#pattern-24--constitutional-rules) — rules that grow through compounding
- [Pattern 4.1 — Evidence-Based Claims](L4-standards-measurement.md#pattern-41--evidence-based-claims) — compounding requires evidence
- [Pattern 2.10 — Least Agency and Session Composition](#pattern-210--least-agency-and-session-composition) —
  learnings are untrusted until reviewed
- [Pattern 2.12 — Skill, Plugin and MCP Supply Chain](#pattern-212--skill-plugin-and-mcp-supply-chain) — review
  the plugin that writes them

### Reference Implementation

The [compound-engineering](https://github.com/EveryInc/compound-engineering-plugin) plugin provides
`/ce:compound`. It is a dependency that writes to files later sessions read: review it before install
([Pattern 2.12](#pattern-212--skill-plugin-and-mcp-supply-chain)). The
[rig](https://github.com/franklywatson/claude-rig) framework implements the brainstorm, plan, work and review
portion of the loop.

---

## Pattern 2.9 — Contain Before You Relax

### Problem

Agents run on the developer's machine with the developer's shell, keys, network and Docker socket. Teams then
try to make that safe with approval prompts and hooks. Prompts wear out ([Pattern
2.13](#pattern-213--risk-tiered-review)). Hooks run inside the agent's environment and match strings, so a
permitted tool can do what the hook forbids by another route.

The [containment example](../examples/containment/) shows the gap. A policy function with a deny rule for `sed
-i` blocks `sed -i`. It allows `/usr/bin/sed -i`, `sed --in-place`, `perl -pi`, `bash -c "echo new > file"`
and a command built from `$(echo sed)`. It also allows two network fetches to a host outside the allowlist.
Eight of nine write commands and both network commands pass. A container with a read-only mount and no network
stops all of them without parsing a command.

This pattern is **Partial** on evidence: the vendors and one company's engineering report agree, and none of
it compares containment designs independently.

### Solution

Start every agent session inside a boundary the agent cannot change. Relax approvals only inside it.

**Contract.** A boundary has five properties:

1. **Writes are confined.** The agent can write to the working tree and a scratch directory, and nowhere else.
2. **Reads are bounded.** Credential files, home-directory secrets and other projects are unreadable.
3. **Network is allowlisted.** Egress goes to named hosts only. Everything else fails.
4. **Secrets live outside.** Credentials are not in the agent's environment or files. A component outside the
   boundary injects a scoped credential when a call needs one ([Pattern
   2.11](#pattern-211--agent-identity-and-delegation)).
5. **Failure closes.** If the boundary cannot start, the session does not start. The agent never runs unconfined
   as a fallback.

The agent cannot edit the boundary's configuration. Put it in a layer the agent has no write access to:
managed settings, a launcher script, a container definition outside the mounted tree.

**Stack tests need Docker.** Mounting the host Docker socket into the boundary hands the agent root on the
host. Give the session its own Docker daemon instead: a rootless daemon, a daemon inside the session's
container or virtual machine, or a per-session remote daemon. [Pattern
1.4](L1-patterns/1.4-container-isolation.md) isolates test runs from each other. This pattern isolates the
agent from the host.

**Order of work.** Contain first, then loosen prompts. A boundary makes "block `docker system prune`" and
"block `sed -i`" unnecessary as safety controls. They stay as ergonomic nudges ([Pattern
2.3](#pattern-23--hook-automation)).

### In Practice

1. Pick the boundary: the harness sandbox, a container, or a virtual machine.
2. Set the five properties. Keep credentials out of the mounted tree, because the boundary does not hide files
   inside what it mounts.
3. Test the boundary. Run a command that must fail (a write outside the tree, a fetch to an unlisted host) and
   check that it fails. The containment example runs each command twice, once in a permissive container to prove
   it works and once in the boundary to prove it is stopped.
4. Allow auto-approval of tool calls inside the boundary. Keep approval for actions that leave it ([Pattern
   2.13](#pattern-213--risk-tiered-review)).

### Bindings

**Claude Code.**
[`examples/containment/claude-code/settings.json`](../examples/containment/claude-code/settings.json) sets
each property with keys documented at <https://code.claude.com/docs/en/settings> and
<https://code.claude.com/docs/en/sandboxing>:

| Property | Setting |
|----------|---------|
| Writes confined | `sandbox.enabled`, `sandbox.filesystem.denyWrite`; `permissions.blockWritesOutsideWorkingDirectories` for the file tools (Claude Code v2.1.314 or later) |
| Reads bounded | `sandbox.filesystem.denyRead`; `permissions.deny` rules such as `Read(./.env)` for the Read tool |
| Network allowlisted | `sandbox.network.allowedDomains` |
| Secrets outside | `sandbox.credentials.files` and `sandbox.credentials.envVars` with mode `deny` |
| Failure closes | `sandbox.failIfUnavailable: true`, `sandbox.allowUnsandboxedCommands: false` |
| Agent cannot edit it | Put the keys above in managed settings, which take precedence over user, project and command-line settings ([SG-12](references/sources.md)) |

Know what the sandbox does not cover. The sandboxing page states that it wraps shell commands and their child
processes only. Claude's file tools, WebFetch, local MCP servers and hooks run outside it, so permission rules
and managed settings govern those. `docker` does not run inside the sandbox. The documented fix is an
`excludedCommands` entry, which runs the command with full access. For Docker stack tests, run the whole
Claude Code session inside a container or virtual machine with its own daemon instead.

For unattended sessions, `permissions.denyInsteadOfPrompting` (user or managed settings; Claude Code v2.1.319
or later) turns permission prompts into denials, so a session without a person present stops instead of
waiting.

**Another harness.** Look for these capabilities in any other agent harness: an operating-system-level sandbox
or container mode that confines writes and network; a way to lock that configuration so the user and the agent
cannot change it; a fail-closed option; and per-session credential injection. If the harness lacks them, run
it inside a container or virtual machine you control and apply the five properties there.

**No harness: CI only.** An agent that cannot be confined on the developer machine can still be contained at
the merge path. Run it only in an ephemeral CI job or container with no secrets beyond a scoped token, push to
a branch that cannot merge itself, and require checks and a human review before merge. This holds the outcome.
It does not stop what the agent does on the machine before then.

### Anti-Pattern

- Treating a hook or deny rule as the boundary. It is a nudge with the same limits as a regex.
- Mounting the host Docker socket so stack tests work.
- Running with the sandbox on but `allowUnsandboxedCommands` left open, so the agent retries blocked commands
  outside it.
- Storing the boundary's configuration in a file the agent can edit.
- Skipping the negative test. A boundary nobody has tried to cross is an assumption.

### Cross-References

- [Pattern 2.3 — Hook Automation](#pattern-23--hook-automation) — what hooks cannot hold
- [Pattern 2.10 — Least Agency and Session Composition](#pattern-210--least-agency-and-session-composition) —
  what a session holds inside the boundary
- [Pattern 2.11 — Agent Identity and Delegation](#pattern-211--agent-identity-and-delegation) — credentials
  outside the boundary
- [Pattern 1.4 — Container Isolation](L1-patterns/1.4-container-isolation.md) — isolating test runs from each other
- [Threat model](cross-cutting/threat-model.md) — what the boundary protects

**Evidence:** Partial — consistent first-party guidance and one company report, no independent comparison
([PL-14, PL-15, PL-17, SG-10, SG-12, AN-9, AN-11](references/sources.md))

---

## Pattern 2.10 — Least Agency and Session Composition

### Problem

An agent session becomes dangerous when it combines three things: untrusted input (a web page, an issue, a
source read during [design rinsing](L1-feedback-loops.md), tool output), access to private data or
credentials, and a way to act outside (send a request, push, post). With all three, text an attacker plants in
the input can steer the agent to leak the data or take the action. Simon Willison named the combination the
lethal trifecta ([SG-1](references/sources.md)). Meta's Agents Rule of Two says a session should hold at most
two of the three unless a gate sits between them ([SG-2](references/sources.md)). OWASP lists excessive agency
(too much functionality, permission or autonomy) among the top risks for LLM applications
([SG-16](references/sources.md)). A research design from Google DeepMind and ETH Zurich separates untrusted
data from control flow by construction ([SG-3](references/sources.md)).

This pattern is **Strong** as a design rule. Independent sources agree. No study measures teams that apply it.

### Solution

Give each session type the least agency it needs, and declare which of the three properties it holds.

**Contract.** For every session type (rinse, implement, review, triage, release), write down:

| Property | Question |
|----------|----------|
| Untrusted input | Does the session read content an outsider can write? |
| Sensitive access | Can it read secrets, private code or customer data? |
| External action | Can it send, push, publish or change a system outside the boundary? |

A session may hold two. A session that holds all three needs a deterministic gate or a human approval between
the input and the action, and the gate sits outside the model.

**Defaults.**

- Tools are read-only until a task needs a write.
- A session that reads untrusted input gets no credentials and no external action.
- Output of an untrusted-input session passes to the next session as reviewed text, not as live context.

**Apply it to design rinsing.** [Rinsing](L1-feedback-loops.md) reads outside sources: repositories,
transcripts, articles. Run it as a session with untrusted input and nothing else. It has read access to the
source, no write access to the target project, no credentials and no network beyond the source. A person
reviews the distilled notes before the design session reads them.

**Apply it to Pattern 2.8.** A learning an agent writes is untrusted until reviewed. See [Pattern
2.8](#pattern-28--compound-engineering).

### In Practice

A session register for a small team:

| Session | Untrusted input | Sensitive access | External action | Gate |
|---------|:---:|:---:|:---:|------|
| Rinse an external repo | yes | no | no | None needed; notes reviewed before use |
| Implement a feature | no (own repo only) | no | no | Boundary from [2.9](#pattern-29--contain-before-you-relax); CI before merge |
| Triage public issues | yes | no | draft comment only | A person posts the comment |
| Release | no | yes | yes | Human approval, scoped token ([2.11](#pattern-211--agent-identity-and-delegation)) |

If a session needs all three, split it: one session reads the input and writes a plain summary; a second
session, with the credentials, reads only the summary.

### Bindings

**Claude Code.** Compose the session from documented settings:

- Read-only rinse session: `permissions.deny` entries for `Edit` (which also covers `Write`) and `Bash`. If you
  allow `Bash` for read-only commands, limit `sandbox.network.allowedDomains` to the source host. That allowlist
  covers shell commands only, so in either case deny `WebFetch` or restrict it to the source domain with a
  permission rule such as `WebFetch(domain:example.com)`.
- No credentials: do not set them in the environment; use `sandbox.credentials` entries with mode `deny`
  ([Pattern 2.9](#pattern-29--contain-before-you-relax)).
- MCP servers are session inputs and capabilities. Restrict them with `allowedMcpServers` and
  `deniedMcpServers`, and make the managed list the only one with `allowManagedMcpServersOnly` ([Pattern
  2.12](#pattern-212--skill-plugin-and-mcp-supply-chain)).
- Unattended sessions: `permissions.denyInsteadOfPrompting`.

**Another harness.** Look for per-session tool allowlists, a read-only or plan mode that is enforced and not
advisory, and per-session network policy. If a harness cannot enforce them, run that session type in a
separate container with only the access the row of the register allows.

**No harness: CI only.** Run untrusted-input sessions in a CI job with no secrets and a read-only checkout
token. Run the credentialed job as a separate job that consumes only the first job's reviewed output.

### Anti-Pattern

- One long-lived session that reads the issue tracker, holds a deploy token and can push.
- Giving a session every tool "in case". Each tool is capability an injected instruction can use.
- Asking the model to refuse injected instructions, as the only control. A deterministic gate holds; a prompt
  reduces risk.
- Letting a rinse session read from or write into the target project.

### Cross-References

- [Pattern 2.9 — Contain Before You Relax](#pattern-29--contain-before-you-relax) — the boundary the session runs in
- [Pattern 2.12 — Skill, Plugin and MCP Supply Chain](#pattern-212--skill-plugin-and-mcp-supply-chain) — tool
  inputs that carry untrusted content
- [Design rinsing](L1-feedback-loops.md) — the read-only rinse session
- [Threat model](cross-cutting/threat-model.md) — untrusted entry points

**Evidence:** Strong — independent sources agree on the design rule; no study of its use by teams ([SG-1,
SG-2, SG-3, SG-16](references/sources.md))

---

## Pattern 2.11 — Agent Identity and Delegation

### Problem

Agents usually act with the developer's own keys. Logs then show the developer, and nobody can tell which
commits, API calls or deploys came from an agent. A leaked key grants everything the developer can do, for as
long as the key lives.

This pattern is **Partial**. The direction (short-lived, narrowly scoped, audience-bound credentials) is well
supported by standards drafts and vendor guidance. Agent-specific identity is still being drafted ([PL-5,
PL-6](references/sources.md)), and no source evaluates it in coding-agent teams.

### Solution

Give each agent, or each agent session, its own identity and its own credentials. Record who the agent acted for.

**Contract.**

1. **Own identity.** An agent has an identifier distinct from any person. Its actions appear under that identifier.
2. **Short-lived credentials.** Tokens expire in minutes or hours and are issued per session or per task.
3. **Narrow scope and audience.** A token names the one service it works for and the actions it allows. A token
   for service A is rejected by service B.
4. **Delegation is visible.** Each action records "agent X for person Y": the agent identifier, the requesting
   person, and the task. Prefer exchanging a person's token for a narrower agent token over reusing the person's
   token. OAuth token exchange defines this pattern ([PL-7](references/sources.md)).
5. **No passthrough.** A tool or server never forwards a token it received to another service. The MCP
   authorization specification and security guidance forbid this ([PL-8, SG-14](references/sources.md)).
6. **Credentials stay outside the boundary** ([Pattern 2.9](#pattern-29--contain-before-you-relax)). An issuer
   outside the agent's reach mints them.

Microsoft's agent identity guidance adds a **sponsor**: a named person accountable for each agent identity,
who answers for it and renews or retires it ([PO-10, PO-11](references/sources.md)). [Pattern
4.7](L4-standards-measurement.md#pattern-47--author-of-record-and-agent-register) records sponsors.

### In Practice

A coding agent that opens pull requests:

- The CI or launcher mints a token valid for one hour, scoped to one repository, with permission to push to
  branches and open pull requests, and no permission to merge or change settings.
- Commits carry a trailer naming the agent and the requester. Pull requests are opened by the agent identity,
  and the requester is the author of record ([Pattern
  4.7](L4-standards-measurement.md#pattern-47--author-of-record-and-agent-register)).
- Branch protection stops the agent identity from merging. A person other than the requester approves ([Pattern
  2.13](#pattern-213--risk-tiered-review)).

### Bindings

**Claude Code.** Claude Code does not issue identities. Supply them from outside: a launcher script or CI job
that mints the short-lived token, passes it to the session at start, and keeps long-lived keys out of the
environment. Mark `sandbox.credentials` entries for long-lived files and variables with mode `deny` ([Pattern
2.9](#pattern-29--contain-before-you-relax)). Put the "agent for person" trailer in the instruction file as a
rule and check it in CI, because the model may omit it.

**Another harness.** Look for a way to inject credentials per session from a secret manager, and a trace or
log that records the session and the requesting user. If the harness cannot, wrap the launch in a script that
does both.

**No harness: CI only.** Use the CI platform's workload identity (OIDC tokens issued per job) to get
short-lived cloud credentials. Run agent jobs under a dedicated service account, separate from any person.

### Anti-Pattern

- The developer's personal access token in the agent's environment.
- One shared long-lived service key for every agent and job.
- Logs that record "deploy by service account" with no link to the requesting person.
- Forwarding a user's token through an MCP server to a downstream API.

### Cross-References

- [Pattern 2.9 — Contain Before You Relax](#pattern-29--contain-before-you-relax) — credentials outside the boundary
- [Pattern 2.13 — Risk-Tiered Review](#pattern-213--risk-tiered-review) — who may approve
- [Pattern 4.7 — Author of Record and Agent
  Register](L4-standards-measurement.md#pattern-47--author-of-record-and-agent-register) — owner and sponsor per
  agent
- [Threat model](cross-cutting/threat-model.md) — secrets

**Evidence:** Partial — strong direction in standards drafts and vendor guidance; no evaluation in
coding-agent teams ([PL-5, PL-6, PL-7, PL-8, PO-10, PO-11, SG-14, SG-20](references/sources.md))

---

## Pattern 2.12 — Skill, Plugin and MCP Supply Chain

### Problem

Skills, plugins, hooks and MCP servers run with the agent's privileges. A skill is instructions the model
follows. A plugin can bundle skills, hooks and servers. An MCP server is code that runs on the machine and
returns text the model reads. Installing one is adding a dependency that can read files, run commands and
steer the agent.

The threat is documented. Snyk scanned public skills and reported that 13.4% of 3,984 had a critical issue
([SG-28](references/sources.md)). That is a vendor's own scan. An MCP email server was taken over in an update
and began copying mail to an attacker ([SG-29](references/sources.md)). The Thoughtworks Technology Radar has
entries on agent plugin marketplaces and on agent skills ([IS-13](references/sources.md)).

This pattern is **Strong** as a statement of the threat. The inspection practice below has less evidence behind it.

### Solution

Treat every skill, plugin, hook pack and MCP server as a third-party dependency.

**Contract.**

1. **Allowlist.** A written list of approved sources and items. Anything else is not installed.
2. **Pin.** Install a specific version or commit hash, not a moving branch or `latest`.
3. **Read before install.** A person reads the instruction text and the code or scripts. Skills are prose that
   steers the model, so read them as you would a shell script.
4. **Review updates as diffs.** An update is a new change. Read the diff before accepting it.
5. **Treat fetched content as untrusted.** What a server returns is input ([Pattern
   2.10](#pattern-210--least-agency-and-session-composition)).
6. **Record owner and provenance.** Each item has a named owner, a source and a review date in the register
   ([Pattern 4.7](L4-standards-measurement.md#pattern-47--author-of-record-and-agent-register)).
7. **Enforce outside the agent.** The list lives where the agent cannot edit it.

### In Practice

Apply the contract to this library's own recommendations. The documents here point to rig, superpowers, the
compound-engineering plugin, RTK and jcodemunch. Each is a dependency for your project:

| Item | Runs as | Review before install | Note |
|------|---------|----------------------|------|
| rig | Hooks, skills, agents | Hook scripts and settings it writes | Written by this library's author |
| superpowers | Skills and plugin | Skill text; any hook or script it adds | |
| compound-engineering plugin | Skills, commands, agents | Skill text; where `/ce:compound` writes | Its output feeds later prompts ([Pattern 2.8](#pattern-28--compound-engineering)) |
| RTK | A command proxy on your shell commands | Source and what it rewrites | Sees every command it proxies |
| jcodemunch | An MCP server that indexes your repository | Source; what it stores and sends | Licensed for non-commercial use; commercial use needs a paid licence ([README at github.com/jgravelle/jcodemunch-mcp](https://github.com/jgravelle/jcodemunch-mcp)). Read the licence before using it at work |

Where this library tells you to install any of these, the instruction assumes you have done this review.

### Bindings

**Claude Code.** Documented settings that enforce the list:

- `strictKnownMarketplaces` (managed settings only) allowlists the marketplace sources users can add.
- `enabledPlugins` turns plugins on or off per scope; `extraKnownMarketplaces` registers marketplaces for a
  repository or organization.
- `allowedMcpServers` and `deniedMcpServers` allow or block servers by URL, command or name.
  `allowManagedMcpServersOnly` (managed settings only) makes the managed list the only one.
- `allowManagedHooksOnly` (managed settings) blocks user, project, local and plugin hooks, except plugins
  force-enabled in managed `enabledPlugins`.
- `allowManagedPermissionRulesOnly` limits permission rules to managed ones.

Project `.claude/settings.json` is a file the agent can edit. A repository can therefore propose a plugin or
server, and the managed layer decides whether it installs. Pin by naming a commit or version in the source you
install from.

**Another harness.** Look for an allowlist of tool servers and skill sources that an administrator controls, a
way to disable user-installed extensions, and version pinning in the install source. Where these are missing,
install through a package manager or vendored directory that CI checks.

**No harness: CI only.** Vendor skills and plugins into the repository at a pinned commit, so every update is
a pull request diff. Add a CODEOWNERS entry for the vendored directory and a CI job that fails if installed
versions differ from the pinned list.

### Anti-Pattern

- Installing from a README one-liner without reading what it adds.
- Following a moving branch, so an update arrives unreviewed.
- Letting the agent install its own skills and servers.
- A marketplace allowlist set in a file the agent can edit.
- No record of who owns each installed item.

### Cross-References

- [Pattern 2.10 — Least Agency and Session Composition](#pattern-210--least-agency-and-session-composition) —
  what a server's output can do
- [Pattern 2.8 — Compound Engineering](#pattern-28--compound-engineering) — learnings as an untrusted source
- [Pattern 4.7 — Author of Record and Agent
  Register](L4-standards-measurement.md#pattern-47--author-of-record-and-agent-register) — owner and provenance
  per item
- [Threat model](cross-cutting/threat-model.md) — dependencies and MCP output

**Evidence:** Partial — the threat is Strong (vendor scan and a reported incident), prevalence is Partial, and
the inspection practice is Thin (no study of review practice) ([SG-28, SG-29, IS-13](references/sources.md))

---

## Pattern 2.13 — Risk-Tiered Review

### Problem

Uniform approval produces approval fatigue. When every command asks for confirmation, people approve without
reading, and the prompt stops being a control. Thoughtworks calls review that exists without real oversight
"human-in-the-loop theater" ([OM-18](references/sources.md)). Analyst commentary reported by ITPro says one
governance setting for all agents fails in practice ([SG-26](references/sources.md)). Anthropic describes an
auto mode that uses a classifier to reduce prompts ([SG-9](references/sources.md)). A model's approval is not
a person's approval, and a requester who approves their own change adds nothing.

This pattern is **Partial**: one vendor's telemetry, one company's review design and analyst corroboration
([AN-29](references/sources.md)).

### Solution

Tier changes and actions by reversibility and blast radius. Spend human attention where mistakes are costly.

**Contract.**

| Tier | Examples | Control |
|------|----------|---------|
| Low | Reversible, local, covered by tests: a docs edit, a refactor behind passing stack tests | Automated checks only |
| Medium | Reversible but shared: a normal feature change | One human reviewer who is not the requester, plus checks |
| High | Irreversible or externally visible: migrations, permission changes, payments, deploys, publishing | A second human approver, a scoped credential, and a downstream control |

Rules that hold at every tier:

1. **The requester cannot approve.** Approval comes from someone other than the person who asked the agent for
   the change.
2. **An agent's approval never counts as human approval.** A review agent can add findings. It cannot satisfy a
   rule that needs a person.
3. **Human approval is for a short named list.** Name the irreversible and externally visible actions that need a
   person. Everything else is checked by machines.
4. **Measure the approve rate.** If people approve nearly every prompt, the prompt is not a control. Remove it or
   move the rule to a boundary.
5. **Review depth follows test coverage.** A change covered by a [stack test](L1-patterns/1.1-stack-tests.md) of
   the journey it touches needs less reading than one that is not.

### In Practice

- Write the high-tier list in the instruction file: "migrations, `.github/workflows/`, permission or role
  changes, release publishing".
- Map the list to paths and commands, so the tier is decided by rule, not by judgement in the moment.
- Review the approve rate for each prompt monthly. A prompt that people approve almost every time is a candidate
  for removal or for a boundary.

### Bindings

**Claude Code.** Use `permissions.ask` for the named actions (`Bash(git push *)`, `Bash(npm publish *)`),
`permissions.deny` for actions nobody should do, and `permissions.denyInsteadOfPrompting` (user or managed
settings; Claude Code v2.1.319 or later) for unattended sessions. Auto mode uses a model-based classifier to
reduce prompts ([SG-9](references/sources.md)). Treat its decisions as automation, not as human approval.
Because these rules match strings, put the real control for high-tier actions downstream: protected branches
and scoped tokens ([Pattern 2.11](#pattern-211--agent-identity-and-delegation)).

**Another harness.** Look for an approval policy that is configurable per tool or action, a way to run without
prompts inside a sandbox, and a log of approvals. Keep the tier list in the instruction file so it is
harness-independent.

**No harness: CI only.** Branch protection holds the tiers: required status checks for low, one required
non-author review for medium, CODEOWNERS plus two approvals for high-tier paths. Enable "Require approval of
the most recent reviewable push", so that someone other than the pusher approves the last commit. Add "Dismiss
stale pull request approvals when new commits are pushed", so that each new commit needs fresh approval.

### Anti-Pattern

- A confirmation prompt on every command, approved by habit.
- A review agent's "approved" counted toward required human reviews.
- The requester merging their own agent-written change.
- A high-tier list that lives only in someone's head.
- Never measuring how often prompts are approved.

### Cross-References

- [Pattern 2.2 — The Skill Chain](#pattern-22--the-skill-chain) — the scaling-by-risk table uses the same tiers
- [Pattern 2.9 — Contain Before You Relax](#pattern-29--contain-before-you-relax) — approvals inside a boundary
- [Pattern 2.11 — Agent Identity and Delegation](#pattern-211--agent-identity-and-delegation) — downstream controls
- [Pattern 4.7 — Author of Record and Agent
  Register](L4-standards-measurement.md#pattern-47--author-of-record-and-agent-register) — who answers for the
  change

**Evidence:** Partial — vendor telemetry and design, analyst corroboration ([SG-9, SG-26, OM-18,
AN-29](references/sources.md))

---

## Summary

Put each rule at the lowest layer that can hold it. Prose carries guidance. Hooks apply deterministic policy
inside the harness: PreToolUse can prevent a structured violation, PostToolUse detects after the fact. CI holds
invariants on the merge path. The sandbox, credential scope and downstream authorisation hold what must never
happen. Skills overlay project rules on base capabilities; the skill chain and phase tracker are optional and
scale with risk. Zero-defect tolerance keeps feedback unambiguous, and compound engineering feeds reviewed
learnings back into context. Containment comes first: start the agent inside a boundary and relax approvals only
inside it. Each session holds at most two of untrusted input, sensitive access and external action. Agents get their
own short-lived credentials, skills and servers are vetted dependencies, and human review is tiered by risk.

## Practitioner Insight

> "Spend a lot of time planning out the work the agent will do."
> — Peter Steinberger, creator of OpenClaw

Planning is worth its cost when the change is large or risky. The plan becomes the contract that verification and review check against; for small reversible changes, a short plan or none is proportionate.

---

**Previous:** [L1: Closed Loop Design and Verification](L1-feedback-loops.md) | **Next:** [L3: Optimization (Optional)](L3-optimization.md) | [Back to Overview](../README.md)
