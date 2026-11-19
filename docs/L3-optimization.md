---
last-validated-model: claude-opus-5-5
reviewed: 2026-11-19
---

# L3: Optimization (Optional)

L3 is optional. It reduces the tokens an agent spends on exploration and tool output. It is not on the path to
verified or unattended work: L0, L1, L2 and L4 carry that. Adopt L3 when token cost or context noise is a measured
problem, and measure the effect in tokens on your own sessions. It uses the hook mechanism of
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
Linux and WSL; Claude searches with `find` and `grep` through the Bash tool, where they run embedded versions of
`bfs` and `ugrep`, and those searches reach hooks and permission rules as Bash calls
([tools reference](https://code.claude.com/docs/en/tools-reference#glob-tool-behavior)). An advice to "use the
Grep tool" there points at a tool that is not present. The same page lists an `LSP` tool for jumping to
definitions and finding references; it is a candidate target when the session has it.

Classify each segment of a compound command (split on `&&`, `||`, `;`, `|`). Check destructive patterns first,
so `sed -i` is never classified as a text search.

Detect the available tools once per session, cache the result, and fall back to allow when a specialized tool is
missing.

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
(`src/core/environment.ts`, 30-minute cache) and a data-driven routing table in TypeScript, with tests. A fuller
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

Delegate exploration to a sub-agent and have it return a short map: relevant files, entry points, key symbols and
their dependencies. The main session reads the map and acts on it.

Claude Code ships a read-only built-in `Explore` subagent for this, with Write and Edit denied
([sub-agents](https://code.claude.com/docs/en/sub-agents)). The rules below apply to it and to a scout you define.

This is the Isolate strategy of the WISC framework (Write, Isolate, Select, Compress; Cole Medin, adapted by DIY
Smart Code). The framework's claim that most agent failures come from context management rests on a single video
and a single uncontrolled source, so treat it as Thin evidence.

### In Practice

- Give the scout a bounded question ("which modules handle payment retries?"), not "explore the repo".
- Require a result under a stated size, for example 30 lines.
- The scout reads; it does not edit.

### Anti-Pattern

Running broad `grep` and `find` commands in the main session, then carrying every match forward.

### Cross-References

- [Further reading: WISC](references/further-reading.md)
- [WISC video](https://youtu.be/gyo0eRgsUWk) and [WISC repository](https://github.com/coleam00/context-engineering-intro/tree/main/use-cases/ai-coding-wisc-framework)

**Evidence:** Partial — vendor guidance on isolating exploration in sub-agents; no measured comparison (SC-1, OM-8)

---

## Example Implementation

[examples/guardrails](../examples/guardrails/) illustrates Pattern 3.1 in TypeScript: an intent classifier, an
environment detector, a router and a data-driven routing table. Run its tests with
`cd examples/guardrails && npm install && npm test` (Node.js 22 or later).

---

**Previous:** [L2: Behavioral Guardrails](L2-behavioral-guardrails.md) | **Next:** [L4: Standards & Measurement](L4-standards-measurement.md) | [Back to Overview](../README.md)
