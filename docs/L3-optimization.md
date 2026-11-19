# L3: Optimization (Optional)

**Level**: Optimization (L3)
**Prerequisites**: [L2 Guardrails](./L2-behavioral-guardrails.md)

L3 is optional. It reduces the tokens an agent spends on exploration and tool output. It is not on the path to verified or unattended work: L0, L1, L2 and L4 carry that. Adopt L3 when token cost or context noise is a measured problem, and measure the effect in tokens on your own sessions.

The patterns here share one idea: a tool that returns a short, typed answer costs less context than a raw dump the agent has to parse.

---

## Pattern 3.1 — Prefer Native Structured Tools; Block Destructive Edits

### Problem

Agents reach for shell commands out of habit. `grep -r` over a repository returns hundreds of unranked lines. `cat` reads a whole file when one function is needed. `sed -i` edits files in place and bypasses the editor tool's checks.

### Solution

Route shell commands to the native or structured tool that does the same job, and block in-place edits. A pre-execution hook classifies each command and returns one of three results: allow, advise (use this tool instead), or block.

| Command | Preferred tool | Result |
|---------|----------------|--------|
| `grep`, `rg` | Grep tool, or an indexed symbol search | advise |
| `cat` | Read tool, with a line range | advise |
| `find` | Glob tool | advise |
| `sed -i`, `awk ... > file` | Edit tool | block |
| `docker ...` | none | allow |
| anything else | none | allow |

Classify each segment of a compound command (split on `&&`, `||`, `;`, `|`). Check destructive patterns first, so `sed -i` is never classified as a text search.

No token-savings figures are given: none has a measured basis in this repository.

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

String matching is a nudge, not a security control. The anchored `sed` pattern misses `/usr/bin/sed -i` and `sed -E -i`. No pattern catches `perl -pi`, `python -c` file writes or `$(...)` substitution. The `docker` rule allows every Docker command, and Docker socket access is root-equivalent. Use a sandbox or credential scope for limits that must hold.

The [guardrails example](../examples/guardrails/) implements the classifier and routing table in TypeScript, with tests.

### Anti-Pattern

```typescript
// Generic pattern first: sed -i is classified as text_search and allowed
if (/grep|sed|awk/.test(cmd)) return 'text_search';
```

Cross-References:

- [L2: Hook Automation](L2-behavioral-guardrails.md#pattern-23--hook-automation) for how pre-execution hooks work
- [L4: Context Eval](L4-standards-measurement.md#pattern-46--context-eval) for scoring routing decisions against expected outcomes

---

## Pattern 3.2 — Context Isolation (Scout)

### Problem

Exploration fills the main session with search results and file contents the implementation does not need. Later steps then run with less usable context.

### Solution

Delegate exploration to a sub-agent and have it return a short map: relevant files, entry points, key symbols and their dependencies. The main session reads the map and acts on it.

This is the Isolate strategy of the WISC framework (Write, Isolate, Select, Compress; Cole Medin, adapted by DIY Smart Code). The framework's claim that most agent failures come from context management rests on a single video and a single uncontrolled source, so treat it as Thin evidence.

### In Practice

- Give the scout a bounded question ("which modules handle payment retries?"), not "explore the repo".
- Require a result under a stated size, for example 30 lines.
- The scout reads; it does not edit.

### Anti-Pattern

Running broad `grep` and `find` commands in the main session, then carrying every match forward.

Cross-References:

- [Further reading: WISC](references/further-reading.md)
- [WISC video](https://youtu.be/gyo0eRgsUWk) and [WISC repository](https://github.com/coleam00/context-engineering-intro/tree/main/use-cases/ai-coding-wisc-framework)

---

## Pattern 3.3 — Environment-Aware Routing and Session Lifecycle

Routing should depend on which tools exist: an indexed repository can use symbol search, and a machine without the indexer should fall back to the Grep tool. Detect available tools once per session, cache the result, and degrade to the native tool when a specialized one is missing.

This guide does not reproduce the detection and caching code. The reference implementations are in the [rig](https://github.com/franklywatson/claude-rig) repository: [`src/router`](https://github.com/franklywatson/claude-rig/tree/main/src/router) for environment-aware resolution and [`src/session`](https://github.com/franklywatson/claude-rig/tree/main/src/session) for session-start detection and caching. rig is by this repository's author.

---

## Pattern 3.4 — Cross-Repo Architecture Alignment

This pattern is the author's opinion. It is a judgement about trade-offs, not an evidenced pattern.

### Problem

A monorepo keeps related services aligned, and it also loads every service into each agent session. Unrelated code adds context and search noise.

### Solution

An agent can read several repositories and check them for consistency without a shared filesystem. It reads the API contract in one repo, the event schema in another, and the types in a third, then reports mismatches. This makes several smaller repositories more workable than before.

| Concern | Monorepo | Multi-repo with agent alignment |
|---------|----------|---------------------------------|
| Contract consistency | Shared types enforce it | Agent checks it on each change |
| Context size | All code visible | Each repo loads alone |
| Build coupling | Shared pipeline | Independent pipelines |
| Discovery | File tree | Each repo's AGENTS.md or CLAUDE.md |

### In Practice

Multi-repo works when services have clear owners and independent deploys, and when each repo keeps its own entry-point file with its public interfaces. A monorepo remains the better choice when services share internal types that change often, or when build tooling assumes one.

Workflow:

1. Each repo documents its API contracts and public interfaces in its entry-point file.
2. When a service changes its API, the agent reads the dependent repos' entry-point files to find breakage.
3. The agent proposes coordinated changes, and tests in each repo verify them.

### Anti-Pattern

Splitting into repos without an entry-point file in each. The agent then cannot find anything. Do not break up a monorepo that works.

Cross-References:

- [Pattern 0.2 — Progressive Disclosure](L0-foundation.md#pattern-02--progressive-disclosure)
- [Pattern 3.2 — Context Isolation](#pattern-32--context-isolation-scout)

---

## Example Implementation

[examples/guardrails](../examples/guardrails/) illustrates Pattern 3.1 in TypeScript: an intent classifier, an environment detector, a router and a data-driven routing table. Run its tests with `cd examples/guardrails && npm install && npm test` (Node.js 21 or later).

---

**Previous:** [L2: Behavioral Guardrails](L2-behavioral-guardrails.md) | **Next:** [L4: Standards & Measurement](L4-standards-measurement.md) | [Back to Overview](../README.md)
