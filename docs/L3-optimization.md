# L3 Optimization — Token Efficiency & Agent Performance

**Level**: Optimization (L3)
**Prerequisites**: [L2 Guardrails](./L2-behavioral-guardrails.md)
**Related Patterns**: Scout Pattern

---

## Overview

L3 Optimization focuses on making agents more efficient by routing commands to the right tools, classifying intent before execution, and investing tokens upfront in structured exploration. These patterns aim to reduce token consumption and improve outcome quality; measure the effect on your own sessions, in tokens.

The core insight: **not all tool calls are created equal**. A raw `grep` can return hundreds of lines of noisy text; a structured search returns a handful of typed results with summaries. Blind file exploration wastes tokens bouncing between false leads; structured scoping produces a map before the journey.

---

## Pattern 3.1 — Smart Routing / Tool Selection

![Smart Routing Flow](diagrams/3.1-smart-routing-flow.png)

*This diagram predates the November 2026 correction. Figures shown in the image are superseded by the text; the follow-up diagrams PR replaces it.*

### Problem

Agents often use inefficient tools for common operations. A raw bash `grep` across a codebase returns megabytes of unstructured text. The agent then wastes tokens parsing line numbers, extracting context, and filtering noise.

### Solution

Route commands to the most efficient tool based on intent detection. Maintain a routing table that maps common commands to their optimal implementations.

| Command | Preferred Tool | Why |
|---------|---------------|-----|
| `grep`/`rg` | Grep tool or jcodemunch | Structured, targeted results |
| `cat` | Read tool | Clean output, no artifacts |
| `find` | Glob or jcodemunch | Targeted discovery |
| `sed -i` / `awk` | Edit tool (always) | Destructive, should block (prevents errors) |
| `git status` | RTK (if available) | Filtered output |
| `npm install` | RTK (if available) | Silent execution |
| code search | jcodemunch `search_symbols` | Typed results with summaries |

No token-savings figures are given for these routes: none has a measured basis in this repository. Measure savings in tokens on your own sessions.

### In Practice

```typescript
// Routing table entry for grep
{
  command: /grep|rg/,
  intents: ['text_search'],
  resolutions: {
    rtk: { action: 'advise', tool: 'rtk grep', reason: 'structured output' },
    jcodemunch: { action: 'advise', tool: 'search_text', reason: 'indexed search' },
    fallback: { action: 'advise', tool: 'Grep', reason: 'dedicated tool' }
  }
}
```

When the agent attempts `grep -r "function" src/`, the middleware:

1. Detects the `grep` intent
2. Checks available tools (RTK? jcodemunch?)
3. Returns an `advise` resolution pointing to the best tool
4. Agent re-routes the call automatically

### Anti-Pattern

```bash
# DON'T: Let agent grep the entire codebase
grep -r "export.*function" . | head -100

# DO: Use structured search
search_symbols(query="export.*function", kind="function")
```

Raw grep returns line noise. Structured search returns typed symbols with file locations and summaries — same information, fraction of the tokens.

### Cross-References

- [Pattern 3.2](#pattern-32--intent-classification) — Detecting intent from commands
- [Pattern 3.3](#pattern-33--environment-aware-routing) — Checking available tools
- [L2 Guardrails](./L2-behavioral-guardrails.md) — Enforcing routing decisions

### Reference Implementation

The [rig](https://github.com/franklywatson/claude-rig) repo implements this in [`src/router/`](https://github.com/franklywatson/claude-rig/tree/main/src/router) with a resolver chain that routes commands to optimal tools based on intent and environment.

## Pattern 3.2 — Intent Classification

### Problem

Bash commands are opaque strings. An agent's `grep -r pattern .` could be a search, but `sed -i 's/old/new/g' file` is a mutation. Without parsing the command, we can't route it correctly or block dangerous operations.

### Solution

Parse bash commands into intent categories. Classify each segment of compound commands independently. Check destructive patterns first (precedence matters).

| Intent | Description | Examples | Default Resolution |
|--------|-------------|----------|-------------------|
| `file_read` | Reading file contents | `cat file.txt`, `head file` | Advise Read tool |
| `text_search` | Searching text content | `grep pattern`, `rg pattern` | Advise Grep/jcodemunch |
| `file_discovery` | Finding files by name/pattern | `find . -name "*.ts"`, `fd pattern` | Advise Glob/jcodemunch |
| `file_modify` | Destructive file edits | `sed -i`, `awk ... > file` | **BLOCK** (use Edit) |
| `docker` | Container operations | `docker build`, `docker-compose up` | Allow (pass-through) |
| `pass_through` | Unknown/benign commands | `ls`, `pwd`, `echo` | Allow (pass-through) |

### In Practice

```typescript
// Intent patterns ordered by precedence
const INTENT_PATTERNS: IntentMatch[] = [
  { pattern: /^\s*sed\s+(-i|--in-place)\b/, type: 'file_modify' },
  { pattern: /^\s*awk\b.*>\s*\S+/, type: 'file_modify' },
  { pattern: /^\s*cat\s+\S+/, type: 'file_read' },
  { pattern: /^\s*(grep[rx]?|rg)\b/, type: 'text_search' },
  { pattern: /^\s*find\s+/, type: 'file_discovery' },
  { pattern: /^\s*fd\b/, type: 'file_discovery' },
  { pattern: /^\s*docker(-compose)?\b/, type: 'docker' },
];

// Split compound commands
function classifyCommand(command: string): Intent[] {
  const segments = command.split(/&&|\|\||;|\|/);
  return segments.flatMap(segment => {
    for (const { pattern, type } of INTENT_PATTERNS) {
      if (pattern.test(segment.trim())) return [type];
    }
    return ['pass_through'];
  });
}
```

Precedence is critical: `sed -i` must match before generic text patterns, else it gets classified as `text_search` and allowed through.

String matching is an ergonomic nudge, not a security control. The anchored classifier pattern (`^\s*sed\s+(-i|--in-place)\b`) misses `/usr/bin/sed -i` and `sed -E -i`. Every pattern misses `perl -pi`, `python -c` file writes and `$(...)` substitution. The `docker` intent allows every Docker command (Docker socket access is root-equivalent). Use a containment boundary (sandbox, credential scope) for limits that must hold; see [the containment prerequisite track](refresh/synthesis.md#6-prerequisite-track-containment-ownership-and-people).

### Anti-Pattern

```typescript
// DON'T: Check for generic patterns first
if (/grep|sed|awk/.test(cmd)) return 'text_search';
// sed -i slips through!

// DO: Check destructive patterns first
if (/sed\s+(-i|--in-place)/.test(cmd)) return 'file_modify';
if (/grep/.test(cmd)) return 'text_search';
```

### Cross-References

- [Pattern 3.1](#pattern-31--smart-routing--tool-selection) — Mapping intents to tools
- [Example Implementation](../examples/guardrails/src/core/intent.ts) — Full intent classifier

---

## Pattern 3.3 — Environment-Aware Routing

### Problem

Optimal tools vary by environment. A project indexed by jcodemunch should use `search_symbols`. A machine with RTK installed should use `rtk grep`. Hard-coding a single tool breaks portability.

### Solution

Detect available tools at session start and cache results. Route commands based on what's actually available. Gracefully degrade when specialized tools are missing.

**Detection Checklist:**

- **RTK**: Run `which rtk` and check exit code
- **jcodemunch**: Check for `.jcodemunch/` directory in project root
- **Stack test context**: Check `./test-logs/` for files modified within 5 minutes
- **Cache**: Store detection results for 30 minutes

**Priority Resolution:**

1. Specialized tool (RTK/jcodemunch) → use it
2. General tool (Grep/Read/Glob) → next best
3. Raw command → allow, but log missed optimization
4. Block → only for dangerous operations

### In Practice

```typescript
interface Environment {
  rtkAvailable: boolean;
  jcodemunchIndexed: boolean;
  stackTestActive: boolean;
  detectedAt: number;  // timestamp
}

async function detectEnvironment(projectDir: string): Promise<Environment> {
  const [rtkCheck, jmCheck, stackCheck] = await Promise.all([
    exec('which rtk').then(() => true).catch(() => false),
    access(`${projectDir}/.jcodemunch`).then(() => true).catch(() => false),
    checkStackTestActive(projectDir)
  ]);

  return {
    rtkAvailable: rtkCheck,
    jcodemunchIndexed: jmCheck,
    stackTestActive: stackCheck,
    detectedAt: Date.now()
  };
}

// Resolution with environment awareness
function resolve(rule: RoutingRule, env: Environment): Resolution {
  if (env.rtkAvailable && rule.resolutions.rtk) {
    return rule.resolutions.rtk;
  }
  if (env.jcodemunchIndexed && rule.resolutions.jcodemunch) {
    return rule.resolutions.jcodemunch;
  }
  return rule.resolutions.fallback ?? rule.resolutions._;
}
```

### Anti-Pattern

```typescript
// DON'T: Assume tools are present
function routeGrep() {
  return 'rtk grep';  // fails if rtk not installed
}

// DO: Check and degrade gracefully
function routeGrep(env: Environment) {
  if (env.rtkAvailable) return 'rtk grep';
  return { action: 'allow' };  // let raw grep through
}
```

### Cross-References

- [Pattern 3.1](#pattern-31--smart-routing--tool-selection) — Routing table format
- [Example Implementation](../examples/guardrails/src/core/environment.ts) — Full detector

---

## Pattern 3.4 — Context Engineering — The Scout Pattern

![Scout/Implementer Pattern](diagrams/3.4-scout-implementer-pattern.png)

*This diagram predates the November 2026 correction. Figures shown in the image are superseded by the text; the follow-up diagrams PR replaces it.*

### Problem

Agents often "search blindly" — issuing `grep` and `find` commands without understanding the codebase structure. This leads to false positives, wasted context, and missed files. Each blind search is a token tax.

### Solution

From the **WISC framework** (Cole Medin, adapted by DIY Smart Code): **invest tokens upfront in structured exploration**. WISC — **W**rite, **I**solate, **S**elect, **C**ompress — is a context engineering framework based on the claim that ~80% of agent failures come from how you manage context, not from the model itself (source: the WISC video by Cole Medin; evidence level: Thin, a single uncontrolled source; the video title also claims "90.2% better AI coding results", with no method stated in this repository). The Scout Pattern maps to the **Isolate** strategy: keep exploration noise out of the main session by delegating to sub-agents.

Send a lightweight "scout" agent to map the codebase first:

1. **File tree**: Get directory structure and key files
2. **Key exports**: Identify main entry points and exported symbols
3. **Dependencies**: Map imports and module relationships
4. **Summarize**: Return a concise map, not raw dumps

The implementer agent then acts with full context, making targeted decisions instead of blind searches.

### In Practice

```typescript
// Scout returns a structured map
interface CodebaseMap {
  structure: FileTree;
  entryPoints: string[];
  keyExports: SymbolSummary[];
  dependencies: DependencyGraph;
}

// Scout agent runs first
const map = await scoutAgent.analyze('/project');

// Implementer uses the map
const targetFile = map.keyExports.find(s => s.name === 'processPayment')?.file;
await editFile(targetFile, { replace: oldPattern, with: newPattern });
```

Structured exploration produces:

- **File tree**: a short directory summary instead of the full `find` listing
- **Symbol index**: Typed results vs grep noise
- **Decision quality**: Agent knows where things are

### Anti-Pattern

```bash
# DON'T: Blind search
grep -r "processPayment" .    # many unranked matches
grep -r "payment" .           # many more matches
find . -name "*.ts" | xargs grep "export"

# DO: Scout first
scout.mapCodebase()           # returns a structured index
target = map.exports.find("processPayment")  # O(1) lookup
```

### Cross-References

- [WISC Framework](https://youtu.be/gyo0eRgsUWk) — Write, Isolate, Select, Compress context engineering strategies
- [WISC GitHub repo](https://github.com/coleam00/context-engineering-intro/tree/main/use-cases/ai-coding-wisc-framework) — Full framework with examples
- [jcodemunch](https://github.com/jgravelle/jcodemunch-mcp) — Tool for indexing codebases

---

## Pattern 3.5 — Structured Output over Raw Text

### Problem

Raw text commands (grep, find, cat) return unstructured output. Agents waste tokens parsing line numbers, extracting filenames, and filtering noise. The information is there, but buried in format overhead.

### Solution

Prefer tools that return structured, summarized results. Compare:

| Raw Command | Structured Tool | Output Format |
|-------------|-----------------|---------------|
| `grep -r "export"` | `search_symbols` | `{name, kind, file, summary}` |
| `find . -name "*.ts"` | `get_file_tree` | `{path, type, exports}` |
| `cat file.ts` | `get_symbol` | `{signature, docs, body}` |
| `git log` | `gh repo view` | `{issues, prs, commits}` |

Structured output lets the agent reason about data, not parse strings.

### In Practice

```typescript
// Raw grep (illustrative: hundreds of matching lines)
$ grep -r "function.*process" ./src
src/auth.ts:45:export function processLogin() {
src/auth.ts:89:function processLogout() {
src/payment.ts:12:export async function processPayment() {
// ... 197 more lines

// Structured search (illustrative: a handful of typed results)
$ search_symbols("process", kind="function")
[
  { name: "processLogin", file: "src/auth.ts", line: 45, summary: "Authenticates user" },
  { name: "processLogout", file: "src/auth.ts", line: 89, summary: "Clears session" },
  { name: "processPayment", file: "src/payment.ts", line: 12, summary: "Handles Stripe charges" }
]
```

Same information. The structured version is far shorter and immediately usable by the agent. The sizes shown are illustrative, not measured.

### Anti-Pattern

```bash
# DON'T: Parse raw text with grep
grep -r "export" . | grep "function" | cut -d: -f1 | sort -u

# DO: Query structured data
search_symbols({ kind: "function" }).map(s => s.file)
```

### Cross-References

- [Pattern 3.1](#pattern-31--smart-routing--tool-selection) — Routing to structured tools
- [jcodemunch](https://github.com/jgravelle/jcodemunch-mcp) — Codebase indexing tool

---

## Pattern 3.6 — Cross-Domain Architecture Alignment

### Problem

Monorepos have traditionally solved a real problem: keeping architectures aligned across related services. When multiple teams own services that share contracts, protocols, or data models, a monorepo ensures a single source of truth. But monorepos extract a heavy tax: context bloat. Every agent session loads the entire repository structure, and L0 progressive disclosure breaks down when unrelated services share the same tree. A payments team's agent doesn't need the notification service's code, but in a monorepo, it's there — consuming context, creating noise, increasing the chance of false-positive search results.

### Solution

**AI agents can traverse multiple repositories to align architectures without requiring them to share a filesystem.** An agent can read the authentication service's API contract from `repo-a`, the notification service's event schema from `repo-b`, and the payment service's type definitions from `repo-c` — then analyze whether the three are architecturally consistent. This was impractical for human developers switching between repos, but agents do it naturally.

This doesn't mean monorepos are wrong. It means the cost-benefit calculation has shifted:

| Concern | Monorepo | Multi-Repo + Agentic Alignment |
|---------|----------|-------------------------------|
| Contract consistency | Enforced by shared types | Verified by agent analysis on change |
| Context bloat | High — all code visible to agent | Low — each repo loads independently |
| Build coupling | Shared build pipeline | Independent pipelines, agent checks integration |
| Discovery | File tree navigation | Agent reads CLAUDE.md + entry points per repo |
| Scope for errors | Cross-service breakage caught at build | Cross-service breakage caught by agent review |

### In Practice

**When multi-repo with agentic alignment works well:**

- Services with clearly owned domains (payments, auth, notifications)
- Teams that want independent deploy cycles
- Codebases where L0 progressive disclosure matters more than shared types
- Projects where context window usage is a bottleneck

**When a monorepo is still the better choice:**

- Services with shared internal types that change frequently
- Teams that lack the discipline to maintain separate CLAUDE.md files per repo
- Projects where build tooling assumes a monorepo (turborepo, nx)

**The agentic alignment workflow:**

1. Each repo maintains its own CLAUDE.md with API contracts and public interfaces
2. When a service changes its API, the agent reads dependent repos' CLAUDE.md files to identify breakage
3. The agent proposes coordinated changes across repos based on analysis, not assumption
4. L4 documentation freshness ensures system maps stay current in each repo

This is a **subjective trade-off, not a hard rule**. The point is that agentic development makes the multi-repo approach more viable than it was — the coordination cost that previously required a monorepo can now be handled by an agent that reads across repositories.

### Anti-Pattern

**Don't** split into multiple repos without maintaining CLAUDE.md and public interfaces in each. A multi-repo setup without L0 entry points is worse than a monorepo — the agent can't find anything.

**Don't** treat this as a mandate to break up monorepos. If your monorepo works, keep it. This pattern is for teams where the monorepo's context tax is actively causing problems.

### Cross-References

- [Pattern 0.2 — Progressive Disclosure](L0-foundation.md#pattern-02--progressive-disclosure) — Context bloat undermines progressive disclosure
- [Pattern 0.4 — Agent instruction file as project constitution](L0-foundation.md#pattern-04--agent-instruction-file-as-project-constitution) — Each repo needs its own entry point
- [Pattern 3.4 — The Scout Pattern](#pattern-34--context-engineering--the-scout-pattern) — Structured exploration across repos

---

## Pattern 3.7 — TOON Serialization for MCP Response Optimization

This pattern was removed in the November 2026 refresh. It described one transport-specific optimization (a compact tabular encoding for MCP responses), and its own worked example overstated the savings. Measure token savings on your own payloads, with your own tokenizer, before adopting any serialization format.

---

## Pattern 3.8 — Session Lifecycle

### Problem

Pattern 3.3 describes environment detection (RTK, jcodemunch) but doesn't address when detection happens or how long results are valid. In practice, detection should happen once at session start and cache for the session's duration. Without session lifecycle management, every tool call re-detects the environment — wasting tokens on redundant checks.

### Solution

A session start hook that detects the environment, auto-indexes the project, and caches results with a TTL. The cache prevents redundant detection on every tool call while allowing refresh if the session is long-running.

**Key concepts:**

- Session start hook fires once when Claude Code starts
- `detectEnvironment()` checks for rtk, jcodemunch, stack-test via injectable `ExecFn`
- `SessionCache` with 30-minute TTL
- Auto-indexing: if jcodemunch is available and the project isn't indexed, index it
- Injectable `ExecFn` for testability (don't call `execSync` directly)

### In Practice

```typescript
interface SessionCache {
  get(key: string): CacheEntry | null;
  set(key: string, value: unknown, ttlMs: number): void;
  isExpired(key: string): boolean;
}

async function onSessionStart(projectDir: string, exec: ExecFn): Promise<void> {
  const env = await detectEnvironment(projectDir, exec);
  sessionCache.set('environment', env, 30 * 60 * 1000); // 30-minute TTL

  if (env.jcodemunchAvailable && !env.jcodemunchIndexed) {
    await exec('jcodemunch', ['index', projectDir]);
  }
}
```

### Reference Implementation

The [rig](https://github.com/franklywatson/claude-rig) repo implements this in [`src/session/`](https://github.com/franklywatson/claude-rig/tree/main/src/session) with environment detection, session caching, and auto-indexing.

### Anti-Pattern

Detecting the environment on every tool call. This is wasteful — the environment doesn't change within a session (except in rare cases like installing new tools mid-session, which the TTL handles).

### Cross-References

- [Pattern 3.3 — Environment-Aware Routing](#pattern-33--environment-aware-routing) — The detection that session lifecycle manages
- [L2 — Hook Automation](L2-behavioral-guardrails.md#pattern-23--hook-automation) — Session start hooks fire the detection

---

## Putting It All Together

The complete optimization pipeline:

1. **Intercept**: Agent issues a bash command
2. **Classify** ([3.2](#pattern-32--intent-classification)): Detect intent from command pattern
3. **Detect** ([3.3](#pattern-33--environment-aware-routing)): Check available tools (RTK, jcodemunch)
4. **Route** ([3.1](#pattern-31--smart-routing--tool-selection)): Return optimal resolution
5. **Execute**: Agent uses advised tool or proceeds with original command
6. **Scout** ([3.4](#pattern-34--context-engineering--the-scout-pattern)): For complex tasks, map first
7. **Structure** ([3.5](#pattern-35--structured-output-over-raw-text)): Prefer typed results
8. **Align** ([3.6](#pattern-36--cross-domain-architecture-alignment)): For cross-repo changes, verify architectural consistency
9. **Evaluate** ([L4: Context Eval](L4-standards-measurement.md#pattern-46--context-eval)): Score routing decisions against expected outcomes to catch regressions

Intended result: fewer wasted tokens, fewer errors, better outcomes. Measure the effect on your own sessions.

---

## Example Implementation

See [examples/guardrails](../examples/guardrails/) for a complete TypeScript implementation of:

- Intent classifier ([`intent.ts`](../examples/guardrails/src/core/intent.ts))
- Environment detector ([`environment.ts`](../examples/guardrails/src/core/environment.ts))
- Smart router ([`router.ts`](../examples/guardrails/src/core/router.ts))
- Data-driven config ([`routing.config.ts`](../examples/guardrails/src/config/routing.config.ts))

Run the unit tests with `cd examples/guardrails && npm install && npm test` (Node.js 21 or later).

---

## Further Reading

- [WISC Framework](https://youtu.be/gyo0eRgsUWk) — Scout/Implementer pattern
- [L2 — Guardrails](./L2-behavioral-guardrails.md) — Enforcing behavioral rules
- [L4 — Context Eval](L4-standards-measurement.md#pattern-46--context-eval) — Evaluating routing effectiveness
- [RTK](https://github.com/rtk-ai/rtk) — Token-optimized CLI proxy

## Practitioner Insight

> "Under-prompt intentionally to discover unexpected solutions."
> — Peter Steinberger, creator of OpenClaw

The scout pattern invests tokens in structured exploration before jumping to implementation. Sometimes the best architecture decision isn't the one you expected — and agents that explore the codebase before acting discover alternatives that a blind search would miss.

---

**Previous:** [L2: Behavioral Guardrails — Skills & Extensions](L2-behavioral-guardrails.md) | **Next:** [L4: Standards & Measurement](L4-standards-measurement.md) | [Back to Overview](../README.md)
