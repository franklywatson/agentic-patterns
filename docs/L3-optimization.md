---
last-validated-model: claude-opus-5-5
reviewed: 2026-11-19
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
| `sed -i`, `awk ... > file` | not applicable | block |
| anything else | not applicable | allow |

Do not advise a tool the session lacks. In Claude Code, the Grep and Glob tools are absent by default on macOS,
Linux and WSL. Claude searches with `find` and `grep` through the Bash tool, where they run embedded versions of
`bfs` and `ugrep`. Those searches reach hooks and permission rules as Bash calls
([tools reference](https://code.claude.com/docs/en/tools-reference#glob-tool-behavior)). An advice to "use the
Grep tool" there points at a tool that is not present. The same page lists an `LSP` tool for jumping to
definitions and finding references; it is a candidate target when the session has it.

Classify each segment of a compound command (split on `&&`, `||`, `;`, `|`). Check destructive patterns first,
so `sed -i` is never classified as a text search.

Detect the available tools once per session, write the result to a file (a hook process starts fresh for each
call), and fall back to allow when a specialized tool is missing.

### In Practice

```typescript
// Patterns ordered by precedence: destructive first
const INTENT_PATTERNS = [
  { pattern: /^\s*sed\s+(-i|--in-place)\b/, type: 'file_modify' },
  { pattern: /^\s*awk\b.*>\s*\S+/, type: 'file_modify' },
  { pattern: /^\s*cat\s+\S+/, type: 'file_read' },
  { pattern: /^\s*(grep[rx]?|rg)\b/, type: 'text_search' },
  { pattern: /^\s*find\s+/, type: 'file_discovery' },
];
```

Structured tools return typed records instead of text to parse:

```text
search_symbols("process", kind="function")
[
  { name: "processLogin",   file: "src/auth.ts",    line: 45 },
  { name: "processPayment", file: "src/payment.ts", line: 12 }
]
```

String matching is a nudge, not a control. The classifier matches strings and misses other spellings
(`/usr/bin/sed -i`, `sed -E -i`, `perl -pi`) and blocks harmless text such as `echo sed -i`. Limits that must hold go in
a sandbox or credential scope ([Pattern 2.9](L2-behavioral-guardrails.md#pattern-29--contain-before-you-relax)).

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
- Run the scout on a small model tier ([Pattern 3.5](#pattern-35--model-effort-and-cost-per-task)).

### Anti-Pattern

Running broad `grep` and `find` commands in the main session, then carrying every match forward.

### Cross-References

- [Further reading: WISC](references/further-reading.md)
- [WISC video](https://youtu.be/gyo0eRgsUWk) and [WISC repository](https://github.com/coleam00/context-engineering-intro/tree/main/use-cases/ai-coding-wisc-framework)

**Evidence:** Partial — vendor guidance on isolating exploration in subagents; no measured comparison (SC-1, OM-8)

---

## Pattern 3.5 — Model, Effort and Cost per Task

For teams that pay for agent sessions: set the model tier and effort level by task type, verify the setting on the
task bank, and put each spend limit where something enforces it, so cost per merged change falls without lowering
what merges.

### Problem

A session runs one model at one effort level for whatever it is given. The top tier at high effort renames a variable
at the top tier's per-token price. The small tier reviews a security change and misses what it was there to find,
which costs more than the tokens it saved. The setting is chosen by feel and judged by tokens per session, which
counts activity, not outcomes ([Pattern 4.4](L4-standards-measurement.md#pattern-44--agentic-development-metrics)).

### Solution

**Tiers.** The vendor's lineup runs from a small tier for high-volume, latency-sensitive work, through a mid tier
that balances speed and capability for everyday coding, to top tiers for complex reasoning and long-running agentic
work ([models overview](https://platform.claude.com/docs/en/about-claude/models/overview), [choosing a
model](https://platform.claude.com/docs/en/about-claude/models/choosing-a-model)). Effort trades capability for tokens
within one model; levels and defaults differ by model ([model
configuration](https://code.claude.com/docs/en/model-config#adjust-effort-level)). Model names and prices change with
each release, so this library names tiers and links those pages for the current names.

| Task type | Tier | Effort | Why |
|-----------|------|--------|-----|
| Mechanical edit, rename, formatting, transcription, extraction, the scout of [Pattern 3.2](#pattern-32--context-isolation-scout) | Small | Low or default | A deterministic check (test, diff, exact comparison) catches a miss |
| Routine implementation with a clear scope and existing tests | Mid | Default | Tests catch most misses; the top tier's premium buys little |
| Bug fix in existing code | Mid, or top when a mid-tier run fails | High | Verification matters and edge cases are likely |
| Design, architecture, debugging an unknown cause, security review, a review agent | Top | High or above | No test catches the miss; it surfaces at merge or in production |

The table is this library's starting point. It follows the vendors' guidance: "Choose smaller models for more routine
tasks and larger models for more complex or ambiguous tasks"
([Claude Code blog](https://claude.com/blog/claude-model-and-effort-level-in-claude-code)), and GitHub groups models
the same way ([model comparison](https://docs.github.com/en/copilot/reference/ai-models/model-comparison)). The same
blog post sets effort as a standing preference per type of work, not per task, and treats a miss from missing
knowledge as a reason to move up a tier and a skipped file or test as a reason to raise effort. Moving work on
high-tier paths of the [risk model](L1-patterns/1.8-reversibility-blast-radius.md#risk-model) up one tier is this
library's design choice.

**Metric: cost per merged change.** A workflow's spend over a period divided by its merged changes, read beside its
revert rate and escaped defects ([Pattern 4.4](L4-standards-measurement.md#pattern-44--agentic-development-metrics));
an A5 workflow reports it ([Pattern A.3](earned-autonomy.md#pattern-a3--promotion-demotion-and-the-cap-gate)).
Anthropic's guidance is to "compare models on cost per completed task, not per token": a cheaper model's failed
tasks still bill their tokens, then the retry
([cost and intelligence](https://platform.claude.com/docs/en/about-claude/models/optimizing-for-cost-and-intelligence#compare-models-on-cost-per-task)).

**Context and caching.** Each request re-sends the conversation, so cost grows with context; prompt caching bills the
unchanged prefix at a reduced rate ([costs](https://code.claude.com/docs/en/costs#reduce-token-usage)). Each model
keeps its own cache, and on most models so does each effort level, so a mid-session switch re-reads the whole
conversation uncached, as does the first turn after an idle gap longer than the cache lifetime ([prompt
caching](https://code.claude.com/docs/en/prompt-caching#actions-that-invalidate-the-cache)). Set model and effort at
session start, clear between unrelated tasks, and send work that needs another tier to a subagent with its own
`model` and `effort` fields ([subagents](https://code.claude.com/docs/en/sub-agents#choose-a-model)); the parent's
cache is unaffected.

**Limits and where each is held.**

| Limit | Enforcement point | What it does not do |
|-------|-------------------|---------------------|
| Allowed models and an effort ceiling | Managed settings: `availableModels` with `enforceAvailableModels`, and `maxEffortLevel` ([restrict models](https://code.claude.com/docs/en/model-config#restrict-model-selection)) | Cap spend |
| Spend and turns per unattended run | Harness: `--max-budget-usd` and `--max-turns` ([CLI flags](https://code.claude.com/docs/en/cli-reference#cli-flags)) | Apply to interactive sessions (print mode only). The budget is a client-side estimate and spend can pass it |
| Cost per run of a registered workflow | `limits.max_cost_usd_per_run` in the [register](earned-autonomy.md#pattern-a1--autonomy-register), read by `autonomy ledger` after the run, which demotes to A3 | Stop a run in progress |
| Spend per workspace, organization, group or member | Billing: Console workspace spend limits, Team and Enterprise spend limits, cloud budget controls ([costs](https://code.claude.com/docs/en/costs#manage-costs-for-your-organization)) | Separate one workflow from another in the same scope |
| A model or effort change that regresses work | CI: the task bank as a required check where the harness runs in CI ([Pattern 4.6](L4-standards-measurement.md#pattern-46--context-eval)) | Exist in this repository, which has no such job and no recorded run |

A budget written only in the instruction file is a prompt; nothing enforces it.

### In Practice

1. Write the task-type table into the instruction file ([Pattern
   0.4](L0-foundation.md#pattern-04--agent-instruction-file-as-project-constitution)) and set `model` and `effort` in
   each subagent definition, so the setting does not depend on who starts the session.
2. Run the [task bank](references/task-bank.md) at the candidate setting and one step up, k of at least 3 each. Keep
   the cheaper setting only if it passes every task the stronger one passes. Record Model, Effort and Harness in the
   run log, and write each run's estimated cost from `/usage` beside it; the runner records neither effort nor cost.
3. For a registered workflow, model id and effort are part of `harness_hash`, so a change holds the workflow at A3
   until the bank passes ([Pattern A.2](earned-autonomy.md#pattern-a2--evidence-ledger)). Re-run step 2 at each model
   upgrade ([Pattern 0.10](L0-foundation.md#pattern-010--prune-and-re-baseline-context)).
4. Pin the setting and limits in the unattended command:

   ```bash
   claude -p --model "$SMALL_TIER_ID" --effort low --max-budget-usd 2.00 --max-turns 30 "$TASK_PROMPT"
   ```

### Anti-Pattern

- **The top tier at maximum effort everywhere.** On routine work both tiers generally succeed, so the premium buys nothing; the
  vendor warns that maximum effort is prone to overthinking. Its cost guide traces unexpectedly high spend to long
  uncleared sessions and the top tier left as the default.
- **The cheapest tier for the reviewer.** A review agent's misses produce no failing check; they surface after merge.
  Its findings never count as approval ([Pattern 2.13](L2-behavioral-guardrails.md#pattern-213--risk-tiered-review)),
  and a weaker reviewer hands the approving person fewer findings to check.
- **Tokens per session as the metric**, or a tier chosen from one run instead of the bank.
- **Switching models mid-task to save money.** The uncached re-read can cost more than the switch saves.

**Evidence:** Partial — consistent vendor guidance from two vendors on choosing a model by task type, and Anthropic
guidance and measurements on cost per completed task, with no independent measurement; the task-type table, the
reviewer rule, the risk-tier step-up and the limits table are this library's design (AN-70, AN-71, AN-72, AN-73,
AN-74, AN-75, AN-76, AN-77, AN-78, OM-70)

---

## Example Implementation

[examples/guardrails](../examples/guardrails/) illustrates Pattern 3.1 in TypeScript: an intent classifier, an
environment detector, a router and a data-driven routing table. Run its tests with
`cd examples/guardrails && npm install && npm test` (Node.js 22 or later).

---

**Previous:** [L2: Behavioral Guardrails](L2-behavioral-guardrails.md) | **Next:** [L4: Standards and Measurement](L4-standards-measurement.md) | [Back to Overview](../README.md)
