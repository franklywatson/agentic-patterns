---
last-validated-model: glm-5.3
reviewed: 2026-11-22
---

# L3: Optimization (optional)

L3 is optional. It reduces the tokens an agent spends on exploration and tool output, and matches the model and
effort a session runs on to the task. It is not on the path to verified or unattended work: L0, L1, L2 and L4 carry
that. Adopt L3 when token cost or context noise is a measured problem, and measure the effect on your own sessions:
in tokens for routing, and as cost per merged change for model choice. It uses the hook mechanism of
[Pattern 2.3](L2-behavioral-guardrails.md#pattern-23--hook-automation).

The patterns share one idea: a tool that returns a short, typed answer costs less context than a raw dump the
agent has to parse.

---

## Pattern 3.1 — Prefer Native Structured Tools; Block Destructive Edits

### Problem

Agents reach for shell commands out of habit. `grep -r` over a repository returns hundreds of unranked lines.
`cat` reads a whole file when one function is needed. `sed -i` edits files in place and bypasses the editor
tool's checks.

### Solution

Route a shell command to a structured tool that does the same job, when that tool exists in the session, and block
in-place edits. A pre-execution hook classifies each command and returns one of three results: allow, advise (use
this tool instead), or block.

The preferred tool depends on what the session has, so the hook checks before it advises. A structured tool is
any tool that returns records instead of text: a language-server (code intelligence) tool, an indexed
symbol-search server, or a file reader that takes a line range.

| Command | Advise when the session has | Otherwise |
|---------|-----------------------------|-----------|
| `grep`, `rg` | an indexed symbol or text search tool | allow |
| `cat` | a file reader that takes a line range | allow |
| `find` | an indexed file or symbol listing | allow |
| `sed -i`, any command redirecting into a file | not applicable | block |
| anything else | not applicable | allow |

Do not advise a tool the session lacks. In Claude Code, the Grep and Glob tools are absent by default on macOS,
Linux and WSL. Claude searches with `find` and `grep` through the Bash tool, where they run embedded versions of
`bfs` and `ugrep`. Those searches reach hooks and permission rules as Bash calls
([tools reference](https://code.claude.com/docs/en/tools-reference#glob-tool-behavior)). An advice to "use the
Grep tool" there points at a tool that is not present. The same page lists an `LSP` tool for jumping to
definitions and finding references; it is a candidate target when the session has it.

Classify each segment of a compound command. The split on `&&`, `||`, `;` and `|` is quote- and escape-aware, so
separators inside quotes and find's `-exec \;` terminator stay data. A segment after a `|` filters upstream output:
drop its advisory intents, because a post-pipe `grep` reads the pipe, not files, but still check it for writes, because
`true | echo x > f` writes a file. Check destructive patterns first, so `sed -i` is never classified as a text search.

Detect the available tools once per session, write the result to a file (a hook process starts fresh for each
call), and fall back to allow when a specialized tool is missing.

### In Practice

```typescript
// Patterns ordered by precedence: destructive first
const INTENT_PATTERNS = [
  { pattern: /^\s*sed\s+(-i|--in-place)\b/, type: 'file_modify' },
  { predicate: hasFileRedirect, type: 'file_modify' },
  { pattern: /^\s*cat\s+\S+/, type: 'file_read' },
  { pattern: /^\s*(grep[rx]?|rg)\b/, type: 'text_search' },
  { pattern: /^\s*find\s+/, type: 'file_discovery' },
];
```

`hasFileRedirect` is a predicate, not a regex, because a redirect check must scan quotes: a `>` inside an awk program
is text, `2>&1` duplicates a file descriptor, and `/dev/null` writes no file, so none of the three is a write.

Structured tools return typed records instead of text to parse:

```text
search_symbols("process", kind="function")
[
  { name: "processLogin",   file: "src/auth.ts",    line: 45 },
  { name: "processPayment", file: "src/payment.ts", line: 12 }
]
```

String matching is a nudge, not a control. The classifier matches strings and misses other spellings
(`/usr/bin/sed -i`, `sed -E -i`, `perl -pi`), a single `&` between two commands, and writes that use no redirect
(`cp`, `tee`). The router's unanchored `sed` rule blocks harmless text such as `echo sed -i`; the classifier's
anchored patterns do not. Limits that must hold go in a sandbox or credential scope
([Pattern 2.9](L2-behavioral-guardrails.md#pattern-29--contain-before-you-relax)).

The [guardrails example](../examples/guardrails/) implements the classifier, the tool detection
(`src/core/environment.ts`, an in-process cache) and a data-driven routing table in TypeScript, with tests. A fuller
implementation is in the [rig](https://github.com/franklywatson/claude-rig) repository, which is by this
repository's author: [`src/router`](https://github.com/franklywatson/claude-rig/tree/master/src/router) for
environment-aware resolution and [`src/session`](https://github.com/franklywatson/claude-rig/tree/master/src/session)
for session-start detection. These links track the `master` branch and can drift; pin a commit if you depend on
them. rig installs hooks and skills, and RTK ([Further Reading](references/further-reading.md#rtk-rust-token-killer)) proxies your shell commands, so review either before you install it
([Pattern 2.12](L2-behavioral-guardrails.md#pattern-212--skill-plugin-and-mcp-supply-chain)).

### Anti-Pattern

```typescript
// Generic pattern first: sed -i is classified as text_search and allowed
if (/grep|sed|awk/.test(cmd)) return 'text_search';
```

### Cross-References

- [Pattern 2.3: Hook Automation](L2-behavioral-guardrails.md#pattern-23--hook-automation) for how pre-execution hooks work
- [Pattern 4.6: Context Eval](L4-standards-measurement.md#pattern-46--context-eval) for testing a routing rule as one decision in a task bank

**Evidence:** Thin — tools publish their own savings figures on their own benchmarks; none is measured here. Measure on your own sessions. The environment detection and rig router are this project's own designs (n=1).

---

## Pattern 3.2 — Context Isolation (Scout)

### Problem

Exploration fills the main session with search results and file contents the implementation does not need. Later
steps then run with less usable context.

### Solution

Delegate exploration to a subagent and have it return a short map: relevant files, entry points, key symbols and
their dependencies. The main session reads the map and acts on it.

Claude Code ships a read-only built-in `Explore` subagent for this, with Write and Edit denied
([subagents](https://code.claude.com/docs/en/sub-agents)). The rules below apply to it and to a scout you define.

This is the Isolate strategy of the WISC framework (Write, Isolate, Select, Compress; Cole Medin, adapted by DIY
Smart Code). The framework's claim that most agent failures come from context management rests on a single video
and a single uncontrolled source, so treat it as Thin evidence.

### In Practice

- Give the scout a bounded question ("which modules handle payment retries?"), not "explore the repo".
- Require a result under a stated size, for example 30 lines.
- The scout reads; it does not edit.
- Run the scout on a small model ([Pattern 3.5](#pattern-35--model-effort-and-cost-per-task)).

### Anti-Pattern

Running broad `grep` and `find` commands in the main session, then carrying every match forward.

### Cross-References

- [Further reading: WISC](references/further-reading.md)
- [WISC video](https://youtu.be/gyo0eRgsUWk) and [WISC repository](https://github.com/coleam00/context-engineering-intro/tree/main/use-cases/ai-coding-wisc-framework)

**Evidence:** Partial — vendor guidance on isolating exploration in subagents; no measured comparison (SC-1, OM-8)

---

## Pattern 3.5 — Model, Effort and Cost per Task

### Problem

A session runs one model at one effort level for whatever it is given. A large model at high effort renames a
variable at the large model's per-token price. A small model reviews a security change and misses what it was there
to find, which costs more than the tokens it saved. The setting is chosen by feel and judged by tokens per session,
which counts activity, not outcomes ([Pattern
4.4](L4-standards-measurement.md#pattern-44--agentic-development-metrics)).

### Solution

**Model class and effort.** Anthropic offers a small model class for high-volume, latency-sensitive work, a mid class
for everyday coding and large classes for complex reasoning and long agentic work (AN-77, AN-73). Effort trades
capability for tokens within one model; levels and defaults differ by model (AN-70). Names and prices change each
release, so this page names classes. Anthropic's own guide starts most workloads on a large class and lowers effort
or the class only where evals allow: "Tuning effort is often a better lever than switching models" ([choosing a
model](https://platform.claude.com/docs/en/about-claude/models/choosing-a-model)).

| Task type | Model class | Effort | Why |
|-----------|-------------|--------|-----|
| Mechanical edit, rename, formatting, transcription, extraction, the scout of [Pattern 3.2](#pattern-32--context-isolation-scout) | Small | Low or default | A deterministic check (test, diff, exact comparison) catches a miss |
| Routine implementation with a clear scope and existing tests | Mid | Default | Tests catch most misses; a large model buys little |
| Bug fix in existing code | Mid, or large when a mid run fails | High | Verification matters and edge cases are likely |
| Design, architecture, debugging an unknown cause, security review, a review agent ([Pattern 2.14](L2-behavioral-guardrails.md#pattern-214--delegating-to-subagents)) | Large | High or above | No test catches the miss; it surfaces at merge or in production |

The table is this library's starting point and sits lower than Anthropic's guide, so keep a step down only when the
task bank passes (In Practice, step 2). It follows the advice to "choose smaller models for more routine tasks and
larger models for more complex or ambiguous tasks" (AN-75); GitHub groups models the same way (OM-70). When a run
fails, check the prompt, tools and context first; a wrong answer given full context and a real attempt means a
larger class, and a skipped file, an unrun test or an unchecked result means higher effort (AN-75). Moving work on
high-tier paths of the [risk model](L1-patterns/1.8-reversibility-blast-radius.md#risk-model) up one model class is
this library's design.

![Model and effort per task: a mechanical edit starts on a small model at low effort, routine implementation on a mid model at default effort, a bug fix on a mid model at high effort and design or review on a large model at high effort or above; work on a high-tier path moves up one model class when a larger one exists; model and effort are set before the run; when a run fails, check the prompt, tools and context, then rerun on a larger class for a wrong answer given full context or at higher effort for a skipped file or unrun test](diagrams/task-routing-flow.png)

**Metric.** Judge a setting by cost per merged change ([Pattern
4.4](L4-standards-measurement.md#pattern-44--agentic-development-metrics)), not tokens per session. Anthropic's
guidance is to "compare models on cost per completed task, not per token": a cheaper model's failed tasks still bill
their tokens, then the retry ([AN-74](references/sources.md)).

**Caching.** Each request re-sends the conversation, and prompt caching bills the unchanged prefix at a reduced rate
(AN-71). Each model keeps its own cache, so a mid-session model switch re-reads the conversation uncached, which
can cost more than the switch saves, as does the first turn after an idle gap longer than the cache lifetime; whether
an effort change keeps the cache depends on the model and platform (AN-72). Set model and effort at session start,
clear between unrelated tasks, and send work that needs another model to a subagent with its own `model` and
`effort` fields, which leaves the parent's cache intact (AN-72, AN-78).

**Limits and where each is held.** A budget written only in the instruction file is a prompt; nothing enforces it.

| Limit | Enforcement point | What it does not do |
|-------|-------------------|---------------------|
| Allowed models and an effort ceiling | Managed settings: `availableModels` with `enforceAvailableModels`, and `maxEffortLevel` ([model configuration](https://code.claude.com/docs/en/model-config)) | Cap spend |
| Spend and turns per unattended run | Harness: `--max-budget-usd` and `--max-turns` ([CLI flags](https://code.claude.com/docs/en/cli-reference#cli-flags)) | Apply to interactive sessions (print mode only). The budget is a client-side estimate and spend can pass it |
| Cost per run of a registered workflow | `limits.max_cost_usd_per_run` in the [register](earned-autonomy.md#pattern-a1--autonomy-register), checked by `autonomy ledger` after the run; for an A4 or A5 workflow, `--apply-demotion` demotes it to A3 ([Pattern A.3](earned-autonomy.md#pattern-a3--promotion-demotion-and-the-cap-gate)) | Stop a run in progress |
| Spend per workspace, organization, group or member | Billing: Console workspace spend limits, Team and Enterprise spend limits, cloud budget controls ([costs](https://code.claude.com/docs/en/costs#manage-costs-for-your-organization)) | Separate one workflow from another in the same scope |
| A model or effort change that regresses work | CI: the task bank as a required check where the harness runs in CI ([Pattern 4.6](L4-standards-measurement.md#pattern-46--context-eval)) | Hold here: this repository has no such job; its run log holds one baseline and no artifact comparison |

### In Practice

1. Set `model` and `effort` in each subagent definition and in each unattended command, and restrict both with
   managed settings, so the setting does not depend on who starts the session. A table in the instruction file is
   guidance only.
2. Run the [task bank](references/task-bank.md) at the candidate setting and one step up, k of at least 3 each. Keep
   the cheaper setting only if it passes every task the stronger one passes. Record Model, Effort and Harness in the
   run log, and write each run's estimated cost from `/usage` beside it; the runner records neither effort nor cost.
3. A model or effort change changes a registered workflow's `harness_hash`, which holds it at A3 until the bank
   passes ([Pattern A.2](earned-autonomy.md#pattern-a2--evidence-ledger)); re-run step 2 at each model upgrade
   ([Pattern 0.10](L0-foundation.md#pattern-010--prune-and-re-baseline-context)).

```bash
claude -p --model "$SMALL_MODEL_ID" --effort low --max-budget-usd 2.00 --max-turns 30 "$TASK_PROMPT"
```

### Anti-Pattern

- **A large model at maximum effort everywhere.** On routine work both classes generally succeed (AN-75); maximum
  effort is prone to overthinking (AN-70), and high spend traces to long uncleared sessions or a large model left as
  the default (AN-71).
- **Tokens per session as the metric**, or a model class chosen from one run instead of the bank.

**Evidence:** Partial — vendor guidance on choosing a model and effort by task type, which differs on where to start,
and Anthropic guidance and measurements on cost per completed task, with no independent measurement; the task-type
table, the risk-tier step-up and the limits table are this library's design (AN-70 to AN-78, OM-70)

---

## Example Implementation

[examples/guardrails](../examples/guardrails/) illustrates Pattern 3.1 in TypeScript: an intent classifier, an
environment detector, a router and a data-driven routing table. Run its tests with
`cd examples/guardrails && npm install && npm test` (Node.js 22 or later).

---

**Previous:** [L2: Behavioral Guardrails](L2-behavioral-guardrails.md) | **Next:** [L4: Standards and Measurement](L4-standards-measurement.md) | [Back to Overview](../README.md)
