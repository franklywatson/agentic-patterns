---
last-validated-model: claude-opus-5-5
reviewed: 2026-11-19
---

# L2: Behavioral Guardrails

L2 decides where each rule is held. Prose is guidance. Command hooks are deterministic policy inside the
harness. Containment and credentials are the boundary. Read this layer before relaxing any approval prompt, and
start with [Pattern 2.9](#pattern-29--contain-before-you-relax). Anthropic's guidance puts a rule the model keeps
missing into a hook rather than more prose ([OM-7](references/sources.md)); other sources draw the same line
between instructions, policy checks and boundaries ([SG-7, SG-16, OM-18](references/sources.md)).

## Overview

Enforcement points stack: a violation has to get past every point that holds the rule, so adding a CI check to a
rule a prompt carries makes it stronger. Put each rule at the cheapest point that can hold it, and add stronger
points for rules that must hold.

| Enforcement point | Mechanism | Holds | Can the agent get past it? |
|-------|-----------|-------|--------------------------|
| Prompt | CLAUDE.md / AGENTS.md, skills | Conventions, preferences, procedure | Yes. The model may not follow it |
| Hook | PreToolUse and PostToolUse handlers | Policy that matches structured tool arguments | Often. Hooks match tool calls, not what a permitted tool does once running, and project hook files are usually editable by the agent |
| CI | Required checks on the merge path | Invariants that must hold for every change | No, if the check is required and the agent cannot edit the workflow or branch protection |
| Sandbox | Filesystem and network isolation, credentials absent from the environment | What must never happen | No, if the sandbox is locked and fails closed |
| Downstream | Authorization in the system being called (scoped token, protected branch, approval) | Irreversible or external actions | No |

What must never happen is prevented by the sandbox, credential scope or downstream authorization. What must always
happen runs as a hook and a required CI check. Prompts and skills carry everything else; a skill guarantees
nothing. A sandbox with credentials kept outside it holds what hooks such as "block `sed -i`" try to hold, so
those hooks remain as ergonomic nudges and one more layer. Anthropic treats the sandbox as the hard boundary and
keeps other defenses around it ([AN-9, PL-15](references/sources.md)).

**Bindings.** Syntax here follows Claude Code; each pattern states the contract so another harness can bind it.
In another harness, look for: an operating-system sandbox or container mode for writes and network; a lock so
neither user nor agent can change it; a fail-closed option; per-session credential injection; per-session tool
allowlists; an administrator-controlled extension allowlist; a per-action approval policy with a log. Where one is
missing, run the harness inside a container or virtual machine you control and apply the property there.

**Disclosure.** Skill names come from [superpowers](https://github.com/obra/superpowers) by Jesse Vincent. The
author of this library also wrote [rig](https://github.com/franklywatson/claude-rig) ([Reference
Implementations](#reference-implementations)).

---

## Pattern 2.1 — Skill Overlay Architecture

### Problem

Skill frameworks such as superpowers provide generic skills like `test-driven-development`; Claude Code provides
the skill mechanism, not those skills. A project needs its own constraints on top. Copying them into every prompt
is verbose and drifts.

### Solution

A skill overlay is a short skill that names a base skill and adds the project's rules, each with the hook or CI
check that holds it. Example: a TDD overlay extends `superpowers:test-driven-development` with "no mocks of
database drivers or payment libraries in stack tests" (held by a PreToolUse hook on test-file edits and a CI
check) and "full-loop assertions" (a convention the skill carries).

A skill is prompt-level material. It raises the probability that the agent follows a rule; it does not guarantee
it. A skill that restates rules held elsewhere adds context cost without adding enforcement.

### The Optional Skill Chain

For large or risky changes, skills can be chained: design, plan, test-driven implementation, verify, review (rig:
`brain+`, `plan+`, `tdd+`, `verify+`, `review+`; superpowers: `brainstorming`, `writing-plans`,
`test-driven-development`, `verification-before-completion`, `requesting-code-review`).

The chain is optional. Scale it to the tier in [Pattern 2.13](#pattern-213--risk-tiered-review): a low-tier edit
runs its checks; a medium-tier change runs the test-driven and verify steps; a high-tier change runs the full
chain and gets a human approver who is not the requester. Two outcome gates apply to every change, whichever
phases ran: evidence before claiming done ([Pattern
4.1](L4-standards-measurement.md#pattern-41--evidence-based-claims)) and review before merge. CI and the merge
process hold them, not the chain. A phase tracker (rig has one) records that the agent visited a phase, not that
the phase did its job.

### Anti-Pattern

- Carrying a non-negotiable rule only as skill prose, with no hook or CI check behind it.
- Running five phases on a typo fix, or shipping a "small" change with no verification evidence or review.
- Treating a phase visit as proof that verification evidence exists.

**Evidence:** Thin — overlay and chain designs from superpowers, rig and this project's own experience (n=1); no
comparison against unchained work; inspect third-party skills before adopting (IS-13)

---

## Pattern 2.3 — Hook Automation

### Problem

Agents drop rules when context shifts or prompts get long. Prose does not hold a rule that must always hold.

### Solution

Hooks are handlers the harness runs before or after a tool call, independent of prompt content
([hooks reference](https://code.claude.com/docs/en/hooks)).

**Hook types.** A `command` hook runs a script and is deterministic. A `prompt` hook asks a model for a
single-turn decision and an `agent` hook starts a subagent before deciding: both are model judgments and hold a
rule at the strength of a prompt. `http` and `mcp_tool` hooks hand the decision to a service you review like any
other code. Use `command` hooks for policy.

**PreToolUse hooks** run before the call and can block it, or return `ask` to put the call to the person. Use
them for structured arguments: an Edit whose `file_path` is a protected path, an Edit that adds a mock import to
a stack-test file. **PostToolUse hooks** run after the call. They report, record and advise (untested source
edits, parsed test failures); they cannot prevent a call that already ran.

**What hooks cannot hold:**

- A permitted `bash`, `python`, `node` or `docker` is a general-purpose computer. Hooks gate the call, not what
  the tool does once running.
- A regex over a free-text shell string is bypassable (quoting, variables, a script). Match structured arguments.
- A project hook file is editable by the agent. Put policy hooks in managed settings with `allowManagedHooksOnly`
  ([Pattern 2.12](#pattern-212--skill-plugin-and-mcp-supply-chain)).
- Hooks run outside the Claude Code sandbox with the user's full access
  ([sandboxing](https://code.claude.com/docs/en/sandboxing)). Review a hook script as code that runs on the machine.

### Composing Checks

Several checks can fire on one tool call (stale tests, mock detection, scope control, failure parsing). Run them
through one orchestrator so the agent gets one signal. Each check has one responsibility and returns a level
(block, advise or silent) and a message; a project config file sets each rule's level. The orchestrator returns
the most severe level (block > advise > silent) with the messages at that level. A PreToolUse block stops the
call; a PostToolUse block means "stop and repair", because the call already ran.

### In Practice

A PreToolUse hook that blocks an Edit or Write to a protected path. Claude Code passes JSON on stdin with
absolute paths:

```bash
#!/usr/bin/env bash
# PreToolUse hook for the Edit and Write tools. Input it cannot parse blocks the call.
set -euo pipefail
if ! path=$(python3 -c 'import json,sys; print(json.load(sys.stdin)["tool_input"]["file_path"])' 2>/dev/null) \
    || [ -z "$path" ]; then
  echo "Blocked: could not read tool_input.file_path." >&2
  exit 2
fi
case "$path" in
  */.github/workflows/*|*/.claude/settings*.json)
    echo "Blocked: $path is protected policy. Ask a human to change it." >&2
    exit 2 ;;
esac
exit 0
```

Exit code 2 blocks. Exit code 0 proceeds unless JSON on stdout returns `"permissionDecision": "deny"`. Any other
failure (another exit code, a crash, a timeout, a script that does not start) is a non-blocking error and the
call proceeds, unless the handler sets `"onFailure": "block"` (Claude Code v2.1.295 or later; `command` and
`http` handlers). Set it on every policy hook so the hook fails closed:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          { "type": "command", "command": ".claude/hooks/protect-paths.sh", "onFailure": "block" }
        ]
      }
    ]
  }
}
```

**Audit records.** Use Claude Code's OpenTelemetry export, configured in managed settings and sent to a
collector outside the agent's reach. It emits `claude_code.tool_decision` for each permission decision and
`claude_code.tool_result` for each tool call, with arguments only when `OTEL_LOG_TOOL_DETAILS=1`; repository
settings cannot turn it on or redirect it ([monitoring](https://code.claude.com/docs/en/monitoring-usage)). A
harness without telemetry can append one JSON line per tool call from a PostToolUse hook. The agent's shell can
reach that file unless the sandbox denies writes to it, so it is a record, not evidence.

### Anti-Pattern

- A hook as the only control for something that must never happen. The sandbox and credential scope hold that.
- A policy hook without `"onFailure": "block"`, so a timeout or crash lets the call through.
- A `prompt` or `agent` hook, or an advisory hook, presented as policy that holds.
- A blocking hook that matches too broadly and stops legitimate work.
- Several checks with no severity resolution, so the agent guesses which message governs.

See [L3: Optimization](L3-optimization.md) for hooks as ergonomic nudges.

**Evidence:** Partial — Anthropic and Stripe put must-hold steps in deterministic code rather than prose, and
OWASP puts authorization outside the model; no study measures the effect; the composition design is this
project's own experience (OM-7, OM-12, SG-11, SG-16)

---

## Pattern 2.4 — Constitutional Rules

### Problem

Rules scattered across documentation, or written as soft suggestions, get forgotten or worked around. A rule
held by nothing depends on the model's attention on that turn.

### Solution

Constitutional rules are the hard rules declared in the instruction file (CLAUDE.md or AGENTS.md). **Each rule
names its enforcement point** from [the Overview table](#overview). A constitutional rule has no exceptions; a
rule that needs exceptions is a convention and belongs in a skill.

| Rule | Enforcement point | What holds it |
|------|-------------------|---------------|
| Real dependencies in E2E/integration and stack tests | Prompt, hook (best effort), CI | Skill carries the rule; a PreToolUse hook blocks mock imports in stack-test files (a regex on imports is bypassable); a CI check greps stack-test directories for mock libraries |
| No conditional test assertions | CI | Lint rule or test-integrity check in the required CI job ([Pattern 1.6](L1-patterns/1.6-test-integrity.md)) |
| Evidence-based claims only | Prompt, CI | Verification skill requires output; the CI result is the evidence the reviewer reads |
| Zero-defect tolerance | CI | Required check fails on any test failure, lint error or warning |
| Docs updated with code | CI | Required check fails when `examples/` changes without a `docs/` change |
| No production credentials in the agent's environment | Sandbox, downstream | Credentials injected outside the sandbox; scoped, short-lived tokens; the production system authorizes independently |
| No writes outside the working tree, no unapproved network egress | Sandbox | Filesystem and network policy, locked and failing closed |
| Never prune shared Docker state | Prompt, sandbox | Skill states the rule; the sandbox denies access to the host Docker socket |
| Requester cannot approve their own change | Downstream | Branch protection requiring a non-author review |

If a rule has only a prompt entry, say so in the table: it is guidance that may be missed. At review, check that
each rule's CI check ran and passed rather than re-reading the code for the rule.

### Anti-Pattern

- A rule held only by a prompt, presented as absolute.
- A safety rule ("never touch production") held by a hook alone. A permitted tool can do what the hook forbids by
  another route. Hold it in the sandbox or downstream.

The instruction file format is [Pattern
0.4](L0-foundation.md#pattern-04--agent-instruction-file-as-project-constitution); the first rule is [Pattern
1.5](L1-patterns/1.5-real-dependencies.md).

**Evidence:** Partial — the case for deterministic checks rests on vendor guidance and one company report
(Pattern 2.3); whether a declared rule list improves agent behavior is contested; the rule list is this
library's design choice (SC-4, SC-5, SC-11)

---

## Pattern 2.5 — Zero-Defect Tolerance

### Problem

When developers tolerate "unrelated" failures or "pre-existing" warnings, the agent cannot tell which errors need
action, and the feedback loop breaks. A tolerated defect becomes an undiagnosed regression later.

### Solution

Every error, warning and failure is addressed, in unit tests and stack tests alike:

- "This failure is unrelated" is not accepted without evidence of isolation (a different subsystem, shown by a run)
- "This warning was pre-existing" means fix it now
- A failing test is fixed, or skipped with a linked issue and a review date
- Compiler warnings are resolved, not suppressed; linter errors are fixed, not waived

**Enforcement point:** CI. A required check that fails on any test failure, lint error or warning holds this
rule. The prompt and the verification skill state it.

In production, zero-defect governs what must be addressed, not what is auto-repaired. Every production error is
triaged, fingerprinted and owned; grant and class decide which errors may be repaired without a person ([Pattern
1.11](L1-patterns/1.11-repair-budget-circuit-breaker-stop.md)).

### In Practice

A run shows `order.test.ts` failing and `Error: Cannot find module './utils/config.ts'`. Fix the missing module
first, re-run, then investigate the order test if it still fails. The task is complete when no error or warning
remains. Setting the module error aside as "unrelated to the order test" is the failure this pattern forbids.
Evidence standards for the claim are in [Pattern 4.1](L4-standards-measurement.md#pattern-41--evidence-based-claims).

**Evidence:** Partial — agents declare success on failing tests; the rest is a mechanism argument that agents
cannot tell tolerated from real failures (IS-15, OM-9)

---

## Pattern 2.8 — Compound Engineering

### Problem

Without persistent memory, every agent session re-derives the same lessons. The first time an agent solves an
N+1 query problem, it takes research; the next session facing it starts from zero.

### Solution

After each cycle of brainstorm, plan, work and review, capture what the cycle learned so the next session starts
from it: documented solutions (symptom, root cause, prevention), plans that survived review, architecture
decisions and failure modes, and constitutional amendments with an enforcement point ([Pattern
2.4](#pattern-24--constitutional-rules)).

Learnings are context. A wrong or stale learning degrades every later session, so the store of learnings has to
lose entries as well as gain them ([IS-13](references/sources.md)). An agent-written learning is also untrusted input:
the agent may have written it after reading content an outsider controls ([Pattern
2.10](#pattern-210--least-agency-and-session-composition)), and a planted instruction that becomes a learning is
read by every later session. Use a review step:

1. The agent writes the learning to a draft location that sessions do not load automatically.
2. A person checks the claim against the code or a test, and checks that it contains no instruction aimed at the
   agent ("always run", "ignore", "send").
3. The person promotes it to the loaded location, with the date and the reviewer's name.
4. After a repair, promote only after the confirmation window has passed and the recurrence check shows the
   fingerprint has not returned ([Pattern 1.9](L1-patterns/1.9-repair-loop-frozen-oracle.md)). A repair that
   masked a defect looks like a solution until the failure returns.
5. Each learning has an owner and a review date. Prune on a schedule ([Pattern
   0.8](L0-foundation.md#pattern-08--aggressive-cleanup)).

### Bindings

**Claude Code auto memory** is on by default in local sessions. Claude writes notes to
`~/.claude/projects/<project>/memory/`, shared by every worktree of the repository, and the first 200 lines or
25KB of `MEMORY.md` load at the start of every conversation ([memory](https://code.claude.com/docs/en/memory)).
That is an agent-written learning loaded with no review step. For a session that reads untrusted input, set
`"autoMemoryEnabled": false` in user or managed settings, or `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1` in the launcher. Otherwise review `MEMORY.md` on the same
schedule as other learnings.

The [compound-engineering](https://github.com/EveryInc/compound-engineering-plugin) plugin's `/ce-compound`
writes learnings to `docs/solutions/`, which its planning skills read later. Review its output with the steps
above.

### Anti-Pattern

- Work that produces code but no learnings, or learnings kept only in conversation history or personal notes.
- Approving or rejecting in review without recording why.
- Agent-written entries loaded into every session without review and never removed. One injected instruction
  becomes a standing one.

**Evidence:** Thin — the review step is this library's design; a learning store must remove as well as add
(IS-13); auto memory behavior is from vendor documentation (SC-8)

---

## Pattern 2.9 — Contain Before You Relax

### Problem

Agents run on the developer's machine with the developer's shell, keys, network and Docker socket. Teams try to
make that safe with approval prompts and hooks. Prompts wear out ([Pattern 2.13](#pattern-213--risk-tiered-review)).
Hooks run inside the agent's environment and match strings, so a permitted tool can do what the hook forbids by
another route.

The [containment example](../examples/containment/) shows the gap. A policy function with a deny rule for `sed
-i` allows `/usr/bin/sed -i`, `sed --in-place`, `perl -pi`, `bash -c "echo new > file"` and `$(echo sed)`, and two
fetches to a host outside the allowlist: eight of nine write commands and both network commands pass. A container
with a read-only mount and no network stops all of them without parsing a command.

Claude Code's defaults run the other way. In Claude Code v2.1.283 or later, auto mode is the built-in starting mode
for interactive terminal and VS Code sessions, and the sandbox is off by default
([permission modes](https://code.claude.com/docs/en/permission-modes),
[sandboxing](https://code.claude.com/docs/en/sandboxing)). Out of the box, prompts are relaxed and nothing is
contained; the vendor states that auto mode "does not guarantee safety".

### Solution

Start every agent session inside a boundary the agent cannot change. Relax approvals only inside it.

**Contract.** A boundary has five properties:

1. **Writes are confined** to the working tree and a scratch directory.
2. **Reads are bounded.** Credential files, home-directory secrets and other projects are unreadable.
3. **Network is allowlisted.** Egress goes to named hosts only.
4. **Secrets live outside.** A component outside the boundary injects a scoped credential when a call needs one
   ([Pattern 2.11](#pattern-211--agent-identity-and-delegation)).
5. **Failure closes.** If the boundary cannot start, the session does not start.

The agent cannot edit the boundary's configuration: keep it in managed settings, a launcher script or a container
definition outside the mounted tree.

**Stack tests need Docker.** Mounting the host Docker socket hands the agent root on the host. Give the session
its own daemon: rootless, inside the session's container or virtual machine, or a per-session remote daemon.
[Pattern 1.4](L1-patterns/1.4-container-isolation.md) isolates test runs from each other; this pattern isolates
the agent from the host.

### In Practice

1. Keep approval prompts on until the boundary is in place (see Bindings).
2. Pick the boundary (harness sandbox, container or virtual machine) and set the five properties. Keep
   credentials out of the mounted tree; the boundary does not hide files inside what it mounts.
3. Run a command that must fail (a write outside the tree, a fetch to an unlisted host) and check that it fails.
   The containment example runs each command in a permissive container and in the boundary.
4. Allow auto-approval inside the boundary. Keep approval for actions that leave it ([Pattern
   2.13](#pattern-213--risk-tiered-review)).

### Bindings

**Claude Code.**
[`examples/containment/claude-code/settings.json`](../examples/containment/claude-code/settings.json) sets each
property with keys from the [settings reference](https://code.claude.com/docs/en/settings-reference) and the
[sandboxing](https://code.claude.com/docs/en/sandboxing) page:

| Property | Setting |
|----------|---------|
| Writes confined | `sandbox.enabled`, `sandbox.filesystem.denyWrite`; `permissions.blockWritesOutsideWorkingDirectories` for the file tools |
| Reads bounded | `sandbox.filesystem.denyRead` for shell commands; `permissions.blockReadsOutsideWorkingDirectories` for the file tools, which `denyRead` does not cover, and for sandboxed commands; `permissions.deny` rules such as `Read(./.env)` |
| Network allowlisted | `sandbox.network.allowedDomains` (shell commands only; restrict WebFetch with permission rules) |
| Secrets outside | `sandbox.credentials.files` and `sandbox.credentials.envVars` with mode `deny`; mode `mask` lets a command use a credential on an allowed host without the session seeing the value (needs `network.tlsTerminate`; honored only from user or managed settings or `--settings`) |
| Failure closes | `sandbox.failIfUnavailable: true`, `sandbox.allowUnsandboxedCommands: false` |
| Agent cannot edit it | Managed settings, which take precedence over user, project and command-line settings ([SG-12](references/sources.md)) |
| Minimum version | v2.1.257 for the reads key, v2.1.314 for the writes key; set `requiredMinimumVersion` (managed only) to `2.1.314` so an older client refuses to start |

Without managed settings, put the keys in user settings (`~/.claude/settings.json`), which is outside the working
tree the agent can write. Until the boundary holds, set
[`permissions.disableAutoMode`](https://code.claude.com/docs/en/settings-reference#disableautomode) to `"disable"`
or `permissions.defaultMode` to `"default"` there; a project file cannot make `auto` or `bypassPermissions` the
default mode. The census ([Pattern A.4](earned-autonomy.md#pattern-a4--census)) reads only the project
`.claude/settings.json`, so commit the same keys there too if you run it.

The sandbox wraps shell commands only. The file tools, WebFetch, local MCP servers and hooks run outside it, under
permission rules and managed settings. On native Windows, commands run unsandboxed; use WSL2. `docker` does not
run inside the sandbox, and an `excludedCommands` entry runs it with full access. For Docker stack tests, run the
whole session inside a container or virtual machine with its own daemon; the
[FAQ](cross-cutting/faq.md#my-stack-tests-need-docker-how-do-i-run-them-inside-the-sandbox) compares the options.

For unattended sessions, `permissions.denyInsteadOfPrompting` (user or managed settings; v2.1.319 or later) or
[`dontAsk`](https://code.claude.com/docs/en/permission-modes) mode denies anything that would prompt, so a session with no person present stops instead of waiting.

**No harness: CI only.** Run the agent only in an ephemeral CI job or container with no secrets beyond a scoped
token, push to a branch that cannot merge itself, and require checks and a human review before merge. This holds
the outcome, not what the agent does on the machine before then.

### Anti-Pattern

- Running in auto mode before the boundary exists.
- Mounting the host Docker socket so stack tests work.
- Leaving `allowUnsandboxedCommands` open, so the agent retries blocked commands outside the sandbox.
- Skipping the negative test. A boundary nobody has tried to cross is an assumption.

The [threat model](cross-cutting/threat-model.md) lists what the boundary protects.

**Evidence:** Partial — Anthropic describes its own practice consistently across its docs and posts, and one company
reports the same; no independent comparison (PL-14, PL-15, PL-17, SG-10, SG-12, AN-9, AN-11)

---

## Pattern 2.10 — Least Agency and Session Composition

### Problem

An agent session is dangerous when it combines three things: untrusted input (a web page, an issue, a source read
during [design rinsing](L1-feedback-loops.md), tool output), access to private data or credentials, and a way to
act outside. With all three, text an attacker plants in the input can steer the agent to leak the data or take the
action. Simon Willison named the combination the lethal trifecta ([SG-1](references/sources.md)). Meta's Agents
Rule of Two says a session should hold at most two of the three unless a gate sits between them
([SG-2](references/sources.md)). OWASP lists excessive agency among the top risks for LLM applications
([SG-16](references/sources.md)). A research design from Google DeepMind and ETH Zurich separates untrusted data
from control flow by construction ([SG-3](references/sources.md)).

### Solution

Give each session type the least agency it needs. For every session type (rinse, implement, review, triage,
release), record whether it reads content an outsider can write (untrusted input), can read secrets, private code
or customer data (sensitive access), and can send, push, publish or change a system outside the boundary
(external action). A session may hold two. A session that holds all three needs a deterministic gate or a human
approval between the input and the action, outside the model.

**Defaults.**

- Tools are read-only until a task needs a write.
- A session that reads untrusted input gets no credentials and no external action.
- Output of an untrusted-input session, learnings included ([Pattern 2.8](#pattern-28--compound-engineering)),
  passes to the next session as reviewed text, not as live context.

### In Practice

| Session | Untrusted input | Sensitive access | External action | Gate |
|---------|:---:|:---:|:---:|------|
| Rinse an external repo | yes | no | no | None needed; notes reviewed before use |
| Implement a feature | no (own repo only) | no | no | Boundary from [2.9](#pattern-29--contain-before-you-relax); CI before merge |
| Triage public issues | yes | no | draft comment only | A person posts the comment |
| Release | no | yes | yes | Human approval, scoped token ([2.11](#pattern-211--agent-identity-and-delegation)) |

A rinse session has read access to the source, no write access to the target project, no credentials and no
network beyond the source. If a session needs all three properties, split it: one session reads the input and
writes a plain summary; a second session, with the credentials, reads only the summary.

### Bindings

**Claude Code.** For a read-only rinse session, add `permissions.deny` entries for `Edit` (which also covers
`Write`; [permissions](https://code.claude.com/docs/en/permissions)) and `Bash`. If you allow `Bash` for read-only commands, limit `sandbox.network.allowedDomains` to the
source host; that allowlist covers shell commands only, so also deny `WebFetch` or restrict it with a rule such as
`WebFetch(domain:example.com)`. Turn auto memory off for the session ([Pattern
2.8](#pattern-28--compound-engineering)). Credential and MCP server keys are in [Pattern
2.9](#pattern-29--contain-before-you-relax) and [Pattern 2.12](#pattern-212--skill-plugin-and-mcp-supply-chain).

**No harness: CI only.** Run untrusted-input sessions in a CI job with no secrets and a read-only checkout token.
Run the credentialed job separately, consuming only the first job's reviewed output.

### Anti-Pattern

- One long-lived session that reads the issue tracker, holds a deploy token and can push.
- Giving a session every tool "in case". Each tool is capability an injected instruction can use.
- Asking the model to refuse injected instructions, as the only control.
- Letting a rinse session read from or write into the target project.

**Evidence:** Strong — independent sources agree on the design rule; no study of its use by teams (SG-1, SG-2,
SG-3, SG-16)

---

## Pattern 2.11 — Agent Identity and Delegation

### Problem

Agents usually act with the developer's own keys. Logs then show the developer, and nobody can tell which commits,
API calls or deploys came from an agent. A leaked key grants everything the developer can do, for as long as the
key lives. Agent-specific identity standards are drafts ([PL-5, PL-6](references/sources.md)).

### Solution

Give each agent, or each agent session, its own identity and credentials, and record who it acted for.

**Contract.**

1. **Own identity.** An agent has an identifier distinct from any person, and its actions appear under it.
2. **Short-lived credentials.** Tokens expire in minutes or hours and are issued per session or per task.
3. **Narrow scope and audience.** A token names the one service it works for and the actions it allows.
4. **Delegation is visible.** Each action records the agent, the requesting person and the task. Prefer
   exchanging a person's token for a narrower agent token, as OAuth token exchange defines
   ([PL-7](references/sources.md)), over reusing the person's token.
5. **No passthrough.** A tool or server never forwards a token it received to another service ([PL-8,
   SG-14](references/sources.md)).
6. **Credentials stay outside the boundary** ([Pattern 2.9](#pattern-29--contain-before-you-relax)). An issuer
   outside the agent's reach mints them.

Microsoft's agent identity guidance adds a **sponsor**: a named person accountable for each agent identity, who
renews or retires it ([PO-10, PO-11](references/sources.md)). The register records sponsors ([Pattern
A.1](earned-autonomy.md#pattern-a1--autonomy-register)).

### In Practice

A coding agent that opens pull requests: the CI or launcher mints a one-hour token scoped to one repository, able
to push branches and open pull requests but not to merge or change settings. Commits carry a trailer naming the
agent and the requester, who is the author of record ([Pattern
4.7](L4-standards-measurement.md#pattern-47--author-of-record-and-agent-register)). Branch protection stops the
agent identity from merging, and a person other than the requester approves ([Pattern
2.13](#pattern-213--risk-tiered-review)).

### Bindings

**Claude Code** does not issue identities. A launcher script or CI job mints the short-lived token, passes it to
the session at start, and keeps long-lived keys out (`sandbox.credentials` in [Pattern
2.9](#pattern-29--contain-before-you-relax)). Put the "agent for person" trailer in the instruction file and check
it in CI, because the model may omit it.

A Claude Code cloud scheduled task acts through its owner's connected GitHub identity and connectors: its commits
and pull requests carry the owner's GitHub user, on `claude/`-prefixed branches
([scheduled tasks](https://code.claude.com/docs/en/routines)). For an unattended workflow, run it from CI under a
dedicated app identity, or require a reviewer other than the owner on every branch it can push to.

**No harness: CI only.** Use the CI platform's workload identity (OIDC tokens per job) for short-lived cloud
credentials, under a service account separate from any person.

### Anti-Pattern

- The developer's personal access token in the agent's environment.
- One shared long-lived service key for every agent and job.
- Logs that record "deploy by service account" with no link to the requesting person.
- Forwarding a user's token through an MCP server to a downstream API.

**Evidence:** Partial — strong direction in standards drafts and vendor guidance; no evaluation in coding-agent
teams (PL-5, PL-6, PL-7, PL-8, PO-10, PO-11, SG-14, SG-20)

---

## Pattern 2.12 — Skill, Plugin and MCP Supply Chain

### Problem

Skills, plugins, hooks and MCP servers run with the agent's privileges. A skill is instructions the model follows;
a plugin can bundle skills, hooks and servers; an MCP server is code on the machine that returns text the model
reads. Installing one adds a dependency that can read files, run commands and steer the agent.

Snyk scanned 3,984 skills from ClawHub and skills.sh, reported that 13.4% had a critical issue, and confirmed 76
as malicious on human review ([SG-28](references/sources.md)); that is a vendor's own scan. An unofficial npm
package that imitated Postmark's MCP email server shipped 15 clean versions, then added a line in version 1.0.16
that blind-copied every sent email to an attacker ([SG-29](references/sources.md)). The Thoughtworks Technology
Radar has entries on agent plugin marketplaces and on agent skills ([IS-13](references/sources.md)).

### Solution

Treat every skill, plugin, hook pack and MCP server as a third-party dependency.

1. **Allowlist.** A written list of approved sources and items. Anything else is not installed.
2. **Pin.** Install a specific version or commit hash, not a moving branch or `latest`.
3. **Read before install.** A person reads the instruction text and the code. Read a skill as you would a shell
   script.
4. **Review updates as diffs.**
5. **Treat fetched content as untrusted** ([Pattern 2.10](#pattern-210--least-agency-and-session-composition)).
6. **Record owner and provenance.** Each item has an owner, a source, a pinned version and a review date in the
   allowlist. Agent workflows are listed separately, in the register `.autonomy.yaml` ([Pattern
   A.1](earned-autonomy.md#pattern-a1--autonomy-register)).
7. **Enforce outside the agent.** The list lives where the agent cannot edit it.

### In Practice

This library's own recommendations are dependencies too:

| Item | Runs as | Review before install | Note |
|------|---------|----------------------|------|
| rig | Hooks, skills, agents | Hook scripts and settings it writes | Written by this library's author |
| superpowers | Skills and plugin | Skill text; any hook or script it adds | |
| compound-engineering plugin | Skills, commands, agents | Skill text; where `/ce-compound` writes | Its output feeds later prompts ([Pattern 2.8](#pattern-28--compound-engineering)) |
| [RTK](https://github.com/rtk-ai/rtk) | A command proxy on your shell commands | Source and what it rewrites | Sees every command it proxies |
| [jcodemunch](https://github.com/jgravelle/jcodemunch-mcp) | An MCP server that indexes your repository | Source; what it stores and sends | Its README states a non-commercial license; commercial use needs a paid license |

Where this library tells you to install any of these, the instruction assumes you have done this review.

### Bindings

**Claude Code.**

- [`strictKnownMarketplaces`](https://code.claude.com/docs/en/settings-reference#strictknownmarketplaces) (managed only) allowlists the marketplace sources users can add.
- [`enabledPlugins`](https://code.claude.com/docs/en/settings-reference#enabledplugins) turns plugins on or off per scope; [`extraKnownMarketplaces`](https://code.claude.com/docs/en/settings-reference#extraknownmarketplaces) registers marketplaces.
- [`allowedMcpServers`](https://code.claude.com/docs/en/settings-reference#allowedmcpservers) and [`deniedMcpServers`](https://code.claude.com/docs/en/settings-reference#deniedmcpservers) allow or block servers by URL, command or
  name; [`allowManagedMcpServersOnly`](https://code.claude.com/docs/en/settings-reference#allowmanagedmcpserversonly) (managed only) makes the managed list the only one.
- [`allowManagedHooksOnly`](https://code.claude.com/docs/en/settings-reference#allowmanagedhooksonly) (managed only) blocks user, project, local and plugin hooks, except hooks from
  plugins force-enabled in managed `enabledPlugins` ([hooks reference](https://code.claude.com/docs/en/hooks)).
- [`allowManagedPermissionRulesOnly`](https://code.claude.com/docs/en/settings-reference#allowmanagedpermissionrulesonly) (managed only) limits permission rules to managed ones.

Project `.claude/settings.json` is a file the agent can edit, so a repository can propose a plugin or server and
managed settings decide whether it installs.

**No harness: CI only.** Vendor skills and plugins into the repository at a pinned commit, so every update is a
pull request diff, with a CODEOWNERS entry for the directory and a CI job that fails if installed versions differ
from the pinned list.

### Anti-Pattern

- Installing from a README one-liner without reading what it adds.
- Following a moving branch, so an update arrives unreviewed.
- Letting the agent install its own skills and servers.
- A marketplace allowlist in a file the agent can edit.

**Evidence:** Partial — the threat is documented by a vendor scan and a reported incident; no study measures review
practice (SG-28, SG-29, IS-13)

---

## Pattern 2.13 — Risk-Tiered Review

### Problem

Uniform approval produces approval fatigue: people approve without reading, and the prompt stops being a control.
Thoughtworks calls review without real oversight "human-in-the-loop theater" ([OM-18](references/sources.md)).
Analyst commentary reported by ITPro says one governance setting for all agents fails in practice
([SG-26](references/sources.md)). A model's approval is not a person's approval, and a requester who approves
their own change adds nothing: GitHub does not count the requester's approval of its agent's pull request
([PO-20](references/sources.md)), and Stripe's engineers request review from another engineer
([PL-17](references/sources.md)).

### Solution

Tier changes and actions by reversibility and blast radius ([Pattern
1.8](L1-patterns/1.8-reversibility-blast-radius.md)). Spend human attention where mistakes are costly.

| Tier | 1.8 classes | Examples | Control | Grant |
|------|-------------|----------|---------|-------|
| Low | R0-R2 at B0 | A docs edit, a refactor behind passing stack tests | Automated checks, then one human approval | Checks alone, with no human, need A4 (R0, R1) or A5 (named R2 classes) |
| Medium | R0-R2 at B1-B2 | A normal feature change | One human reviewer who is not the requester, plus checks | A human reviews at every grant |
| High | R3, R4 or B3 | Migrations, permission changes, payments, deploys, publishing | A second human approver, a scoped credential and a downstream control | A human approves at every grant |

A grant needs a cap ([The Grants](earned-autonomy.md#the-grants)). A workflow below A4, which includes every
workflow in a repository capped at C2, keeps one human approval on every tier.

Rules at every tier:

1. **The requester cannot approve.**
2. **An agent's approval never counts as human approval.** A review agent can add findings.
3. **Approval prompts are for a short named list** of irreversible and externally visible actions. Machines check
   everything else in the session; the tier and grant set the pull request review.
4. **Measure the approve rate.** A prompt people approve nearly every time is not a control. Remove it or move
   the rule to a boundary.
5. **Review depth follows test coverage.** A change covered by a [stack test](L1-patterns/1.1-stack-tests.md) of
   the journey it touches needs less reading.

### In Practice

Write the high-tier list in the instruction file ("migrations, `.github/workflows/`, permission or role changes,
release publishing") and map it to paths and commands, so a rule decides the tier. Review the approve rate for
each prompt monthly. At review, check:

- The author of record is named and is not the approver ([Pattern
  4.7](L4-standards-measurement.md#pattern-47--author-of-record-and-agent-register)).
- A new or updated skill, plugin, hook or MCP server is pinned and on the allowlist ([Pattern
  2.12](#pattern-212--skill-plugin-and-mcp-supply-chain)).
- A high-tier change has a second human approver.

### Bindings

**Claude Code.** Use `permissions.ask` for the named actions (`Bash(git push *)`, `Bash(npm publish *)`) and
`permissions.deny` for actions nobody should do. These rules match strings, so put the real control for
high-tier actions downstream: protected branches and scoped tokens ([Pattern
2.11](#pattern-211--agent-identity-and-delegation)).

Auto mode uses a classifier model to reduce prompts ([SG-9](references/sources.md)); treat its decisions as
automation, not human approval. By default it blocks merging a pull request no human has approved, production
deploys and migrations, and after 3 blocks in a row or 20 in total it pauses and Claude Code resumes prompting
([permission modes](https://code.claude.com/docs/en/permission-modes)).

To measure the approve rate, export OpenTelemetry events ([Pattern 2.3](#pattern-23--hook-automation)): each
`claude_code.tool_decision` event carries `decision` (`accept` or `reject`) and `source`; count, per tool, the
decisions a person made at a prompt.

**No harness: CI only.** Branch protection holds the tiers: required status checks and one required non-author
review for low and medium, CODEOWNERS plus two approvals for high-tier paths. Enable "Require approval of the most
recent reviewable push" and "Dismiss stale pull request approvals when new commits are pushed" ([GitHub protected
branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches#require-pull-request-reviews-before-merging)).

### Anti-Pattern

- A confirmation prompt on every command, approved by habit.
- A review agent's "approved" counted toward required human reviews.
- The requester merging their own agent-written change.
- A high-tier list that lives only in someone's head.

The optional skill chain scales to these tiers ([Pattern 2.1](#pattern-21--skill-overlay-architecture)).

**Evidence:** Partial — vendor telemetry and design, a platform rule, one company's practice and analyst
corroboration. Anthropic's review design (AN-29) tiers by risk like this pattern but counts the requester as one
of the required reviewers; this library does not (SG-9, SG-26, OM-18, PO-20, PL-17, AN-29)

---

## Reference Implementations

- [rig](https://github.com/franklywatson/claude-rig), by this library's author: skill overlays and the chain in
  `templates/skills/`; the phase tracker in `src/skills/phase-tracker.ts`; hooks and the severity-resolving
  orchestrator (`handlePostToolUse`) in `src/enforcement/`, including `src/enforcement/constitutional.ts` (a regex
  mock check, with the limits in [Pattern 2.3](#pattern-23--hook-automation)) and `src/enforcement/zero-defect.ts`
  (parses test-runner output for failures and warnings).
- [compound-engineering](https://github.com/EveryInc/compound-engineering-plugin): `/ce-compound` for [Pattern
  2.8](#pattern-28--compound-engineering).

Review both before installing ([Pattern 2.12](#pattern-212--skill-plugin-and-mcp-supply-chain)).

---

**Previous:** [L1: Closed Loop Design and Verification](L1-feedback-loops.md) | **Next:** [L4: Standards &
Measurement](L4-standards-measurement.md) ([L3: Optimization](L3-optimization.md) is optional) | [Back to
Overview](../README.md)
