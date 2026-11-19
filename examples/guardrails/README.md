# Guardrail Middleware Example

A simplified implementation demonstrating tool routing and intent classification for token-optimized agent behavior.

This is a single-language (TypeScript) example for the optional [L3: Optimization](../../docs/L3-optimization.md) layer. It illustrates Pattern 3.1, Prefer Native Structured Tools; Block Destructive Edits.

## Overview

This example shows the core routing logic:

1. **Intent Classification** — Parse bash commands to detect what the agent is trying to do
2. **Environment Detection** — Check available tools (RTK, jcodemunch) at session start
3. **Native Structured Tool Routing** — Route commands to the native or structured tool for the job, based on intent + environment
4. **Resolution** — Return `allow`, `advise` (use different tool), or `block`

## Architecture

![Guardrail Middleware Architecture](../../docs/diagrams/guardrail-middleware-architecture.png)

## File Structure

```
src/
├── core/
│   ├── intent.ts        # Intent classifier (command → intent)
│   ├── router.ts        # Router (intent + env → resolution)
│   └── environment.ts   # Environment detector (RTK, jcodemunch)
└── config/
    └── routing.config.ts # Data-driven routing rules
```

## Usage Example

```typescript
import { classifyCommand } from './core/intent.js';
import { getEnvironment } from './core/environment.js';
import { resolve } from './core/router.js';
import { findMatchingRule } from './config/routing.config.js';

// Agent issues a command
const command = 'grep -r "export.*function" ./src';

// 1. Classify intent
const intents = classifyCommand(command);
// → ['text_search']

// 2. Detect environment
const env = await getEnvironment('/path/to/project');
// → { rtkAvailable: true, jcodemunchIndexed: true, ... }

// 3. Find matching rule and resolve
const rule = findMatchingRule(command);
const resolution = resolve(rule!, env);
// → { action: 'advise', tool: 'rtk grep', reason: '...' }

// 4. Apply resolution
if (resolution.action === 'advise') {
  // Agent re-routes to advised tool
} else if (resolution.action === 'block') {
  // Agent stops, explains why
} else {
  // Proceed with original command
}
```

## Build and Test

Requires Node.js 21 or later (the test script passes a quoted glob to `node --test`).

```bash
npm ci
npm test        # runs `npm run build` (tsc) first, then node:test on dist/**/*.test.js
```

Tests live in `src/__tests__/`. They cover intent classification, environment-aware resolution, the docker default-allow rule, and the known string-matching bypasses. Environment detection (`detectEnvironment`) shells out to `which rtk` and has no injectable seam, so the tests exercise `resolve()` with hand-built `Environment` values instead.

### String matching is a nudge, not a control

The classifier (`src/core/intent.ts`) and the router (`src/config/routing.config.ts`) use different patterns for `sed -i`:

- The classifier is anchored to the start of each segment (`^\s*sed\s+(-i|--in-place)\b`). It misses `/usr/bin/sed -i` and `sed -E -i`.
- The router rule is unanchored (`\bsed\s+(-i|--in-place)\b`). It catches `/usr/bin/sed -i` but also blocks harmless text such as `echo sed -i` (false positive). It misses `sed -E -i`.
- Neither matches `perl -pi`, `python -c` file writes, or commands assembled at runtime (`$(echo sed) -i ...`).

Use a containment boundary for limits that must hold.

## Intent Types

| Intent | Description | Default Resolution |
|--------|-------------|-------------------|
| `file_read` | Reading file contents (`cat`, `head`, `tail`) | `cat`: advise Read tool. `head` and `tail` are classified but have no router rule, so they pass through |
| `text_search` | Searching text (`grep`, `rg`) | Advise Grep/jcodemunch |
| `file_discovery` | Finding files (`find`, `fd`) | Advise Glob/jcodemunch |
| `file_modify` | Destructive edits (`sed -i`, `awk > file`) | **BLOCK** |
| `docker` | Container operations | Allow (pass-through) |
| `pass_through` | Unknown/benign commands | Allow |

### Docker is default-allow

The router allows every `docker` and `docker-compose` command (`src/config/routing.config.ts`, intent
`docker`). It does not inspect subcommands or flags, so `docker run -v /:/host` and `docker exec` pass. Access
to the Docker socket is root-equivalent on the host. Treat this rule as a statement that no dedicated tool
exists for Docker commands, not as a security control. Restrict Docker access with a containment boundary
(sandbox, credential scope); see [Pattern 2.9 — Contain Before You
Relax](../../docs/L2-behavioral-guardrails.md#pattern-29--contain-before-you-relax).

## Routing Rules

Rules are defined in `src/config/routing.config.ts`. Each rule specifies:

- **Pattern**: RegExp to match commands
- **Intent**: Classification type
- **Resolutions**: Per-environment actions (rtk, jcodemunch, general, fallback)

Example rule for `grep`:

```typescript
{
  match: /\b(grep[rx]?|rg)\b/,
  intent: 'text_search',
  resolutions: {
    rtk: { action: 'advise', tool: 'rtk grep', reason: 'structured output, filtered results' },
    jcodemunch: { action: 'advise', tool: 'jcodemunch search_text', reason: 'indexed search, faster' },
    general: { action: 'advise', tool: 'Grep tool', reason: 'structured results, no artifacts' },
    fallback: { action: 'allow' },
  },
}
```

## Integration with Claude Code

To integrate this middleware with Claude Code:

1. **Hook Implementation**: Create a Claude Code hook that intercepts bash commands
2. **Session Setup**: Run environment detection once per session
3. **Command Interception**: Before each bash call, classify + route
4. **Resolution Handling**: Apply `advise` and `block` resolutions

Example hook flow:

```typescript
// In your Claude Code hook
async function beforeBash(command: string): Promise<boolean> {
  const rule = findMatchingRule(command);
  if (!rule) return true; // allow

  const resolution = resolve(rule, sessionEnvironment);

  if (resolution.action === 'block') {
    console.error(`BLOCKED: ${resolution.reason}`);
    return false; // prevent execution
  }

  if (resolution.action === 'advise') {
    console.warn(`Advising: Use ${resolution.tool} instead`);
    // Could auto-retry with advised tool
  }

  return true; // allow execution
}
```

## Adapting for Other Projects

1. **Custom Intents**: Add new intent types to `intent.ts`
2. **Custom Tools**: Extend routing rules in `routing.config.ts`
3. **Custom Environment Checks**: Add detectors in `environment.ts`
4. **Custom Resolutions**: Define new resolution actions beyond allow/advise/block

## Token Savings

Savings depend on the repository, the query, and the tools installed. Measure them in tokens on your own sessions before relying on any figure.

## Further Reading

- [L3 Optimization Documentation](../../docs/L3-optimization.md)
- [RTK](https://github.com/rtk-ai/rtk) — Token-optimized CLI proxy
- [jcodemunch](https://github.com/jgravelle/jcodemunch-mcp) — Codebase indexing

RTK proxies your shell commands and jcodemunch is an MCP server that indexes your repository. Treat both as
dependencies: read the source before installing and pin a version ([Pattern
2.12](../../docs/L2-behavioral-guardrails.md#pattern-212--skill-plugin-and-mcp-supply-chain)). jcodemunch is
free for non-commercial use; commercial use needs a paid licence.
