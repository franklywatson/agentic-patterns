# Agentic Patterns — Design Spec

**Date**: 2026-03-26
**Status**: Draft
**Repository**: `agentic-patterns`

## Summary

A progressive library of patterns, guidance, and working examples for building projects that are effective for agentic AI development. Organized as a **capability pyramid** (L0-L4) that teams adopt incrementally, with TypeScript and Python examples demonstrating each pattern.

## Motivation

Traditional software engineering practices are optimized for humans — developers who can mentally bridge gaps, tolerate partial feedback, and rely on intuition. AI agents need something different: complete feedback loops, structured context, enforced discipline, and project layouts that a newcomer with zero prior knowledge can navigate.

The wyntrade-core project demonstrates a working production system built around these principles. This library extracts, generalizes, and documents those patterns so other teams can adopt them.

## Target Audience

- **Solo devs / small teams**: Start at L0, adopt progressively
- **Team leads / architects**: Use the full pyramid to establish org-wide practices

## Repository Structure

```
agentic-patterns/
├── README.md                           # Project overview + pyramid visualization
├── CLAUDE.md                           # Agent instructions for this repo
├── docs/
│   ├── L0-foundation.md                # Deep modules, progressive disclosure, file structure
│   ├── L1-feedback-loops.md            # Stack tests, full-loop assertions, sequential design
│   ├── L2-behavioral-guardrails.md     # Skills, hooks, constitutional rules, zero-defect
│   ├── L3-optimization.md              # Token efficiency, smart routing, guardrail middleware
│   ├── L4-culture.md                   # Doc rigor, evidence-based claims, aggressive cleanup
│   ├── cross-cutting/
│   │   ├── anti-patterns.md            # Common mistakes and what to avoid
│   │   ├── migration-guide.md          # Moving from traditional to agentic practices
│   │   └── glossary.md                 # Terminology reference
│   └── references/
│       ├── wyntrade-case-study.md      # Deep reference to the source project
│       └── further-reading.md          # External articles, videos, resources
├── examples/
│   ├── stack-test/                     # Minimal stack test examples (TS + Python)
│   ├── skills/                         # Skill overlay examples
│   ├── guardrails/                     # Guardrail middleware examples
│   └── project-structure/              # Before/after project structure examples
└── docs/specs/                         # Design specs
```

## The Agentic Project Pyramid

Each level builds on the previous. Teams should adopt in order — skipping levels creates fragile foundations.

```
            L4: Culture
          Rigor, docs, cleanup
        ┌─────────────────────┐
       L3: Optimization                   Token efficiency, smart routing
      ┌───────────────────────┐
     L2: Behavioral Guardrails             Skills, hooks, constitutional rules
    ┌─────────────────────────┐
   L1: Feedback Loops                        Stack tests, full-loop assertions
  ┌───────────────────────────┐
 L0: Foundation                               Project structure for AI accessibility
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## Level 0: Foundation — Project Structure for AI Accessibility

**Core thesis**: Your codebase is the biggest influence on AI's output. Structure it so an AI with zero prior context can navigate, understand, and contribute effectively.

### Patterns

**0.1 Deep Modules**
Simple interfaces, complex internals. AI sees the seam and delegates implementation inside. Contrast with shallow modules that force the agent to hold many interconnections simultaneously. Based on John Ousterhout's "A Philosophy of Software Design" and reinforced by Matt Pocock's graybox module concept — modules where tests lock down behavior, the public interface is carefully controlled, and the interior is delegatable to AI.

**0.2 Progressive Disclosure**
Directory structure mirrors mental models. AI discovers complexity gradually: README → CLAUDE.md → module interfaces → implementation. No 20-file-deep treasure hunts. Each layer of discovery should give enough context to decide whether to go deeper.

**0.3 Conceptual File Organization**
Group by domain or capability, not by technical layer. `trading/bridges/` not `services/handlers/utils/`. AI uses file paths as navigation hints. Disparate relationships between unrelated modules are the enemy.

**0.4 CLAUDE.md as Project Constitution**
The single source of truth for an agent entering the project. Contains rules, constraints, conventions, and architectural decisions. Not a tutorial — a contract. Should answer: what is this project, how is it structured, what must I never do, what patterns must I always follow. Hard limit: **150 lines maximum**. Beyond that, link to dedicated docs. Every additional line in CLAUDE.md displaces context the agent needs for the actual task. Reference external files via `@filename.md` includes rather than inlining content. All referenced docs must be reachable from CLAUDE.md — it serves as the master index. An agent should be able to discover any project document by starting from CLAUDE.md and following links.

**0.5 Git Worktree-Based Development**
Use git worktrees as the default working model for agentic development. Each task or feature branch gets its own worktree — a separate working directory sharing the same git object store. This provides: parallel work isolation (multiple agents on separate branches without conflict), clean slate per task (no leftover artifacts from previous sessions), non-destructive exploration (experiment without risking the main branch), and deterministic starting state (worktrees are created from a known commit). Agents should never work directly on the main branch for feature work.

**0.6 AI-as-New-Starter Standard**
If someone with zero context cannot understand your project from CLAUDE.md + README + file structure alone, the project is not agentic-ready. Every assumption not codified in these entry points is a point where the agent will go wrong.

### Examples
Before/after project structure comparisons in TS and Python showing shallow vs deep module organization.

---

## Level 1: Feedback Loops — Closed-Loop Testing

**Core thesis**: Traditional testing (unit → integration → acceptance) is designed for humans who can mentally bridge gaps between partial test results and system behavior. AI agents need complete feedback — a test either passes or fails, and the failure tells the agent exactly where to look and what to fix.

### Why Not Integration Tests

Partial-stack integration tests are the worst of both worlds: too slow for rapid iteration, too incomplete for real confidence. They test some components in isolation but leave the seams between tested and untested components as blind spots. Stack tests replace this by bringing up the entire application stack and testing through the API layer only.

### Patterns

**1.1 Stack Tests**
Bring up the full application stack (app server, databases, cache, message queues) in Docker. Test exclusively through API endpoints — no direct service access, no internal state inspection. The test models a complete user journey. Gives deterministic, binary outcomes.

**1.2 Full-Loop Assertion Layering**
After the primary assertion passes, expand to verify consequences:
- **Primary**: Core behavior works (the swap executed successfully)
- **Second-order**: Side effects are correct (database balance updated, transaction record created)
- **Third-order**: Downstream consequences fired (audit log entry, email notification, aggregation updated)

This layering catches regressions that primary assertions miss and gives the agent a systematic diagnostic framework.

**1.3 Sequential / Additive Test Design**
Tests ordered by natural dependency, building from infrastructure up to business logic:
1. App startup and dependencies
2. Authentication and authorization
3. Basic user flows
4. Domain-specific operations
5. Advanced strategies and edge cases

Running earlier tests first exposes problems at the right abstraction level. If app-startup fails, the agent knows not to waste time debugging trading logic. The sequence itself is a diagnostic tool.

**1.4 Container Isolation**
Each test gets its own isolated Docker environment:
- **Unique container names**: `{test-name}-{pid}-{random}-{service}` prevents collisions
- **Dynamic port allocation**: Ports assigned from available range, checked for availability before use
- **Transient volumes**: Data disappears when containers stop — no state leakage between tests
- **Per-test compose files**: `docker-compose-{test-name}-{pid}-{random}-{timestamp}.yml`
- **Resource hygiene**: Docker has hard limits on networks (~31 per bridge driver), containers, and volumes. Without cleanup discipline, concurrent tests exhaust these limits and crash the Docker daemon. Isolation combined with aggressive cleanup prevents resource exhaustion.

**1.5 No-Mock Philosophy**
Mock system components and you test your mocks, not your system. Stack tests use real databases, real Redis, real API calls. The only acceptable mocks are external services you do not control (third-party APIs, blockchains where testnet is unavailable).

**1.6 Test Integrity Rules**
Zero escape hatches — patterns that allow tests to silently pass when they should fail:
- No conditional assertions (`if (x) { expect(...) }`)
- No catch blocks without rethrow
- No optional chaining on expect (`expect(res?.data)`)
- No early returns before assertions
- No try-catch wrapping test logic

Tests that can't fail can't prove anything works.

### Examples
Minimal stack test setup in TypeScript (Jest + docker-compose) and Python (pytest + docker-compose) showing: container isolation, dynamic port allocation, full-loop assertions, sequential test ordering.

---

## Level 2: Behavioral Guardrails — Skills & Extensions

**Core thesis**: You cannot trust an agent to consistently follow rules written in prose alone. Skills and hooks are behavioral guardrails that enforce discipline through the tool layer, making correct behavior the path of least resistance.

### Patterns

**2.1 Skill Overlay Architecture**
Skills layer on top of base agent capabilities. Each skill references a base process and adds project-specific constraints. The overlay structure: base process → project-specific additions → hook activations → integration points with other skills. Skills are the mechanism by which a project's constitution (CLAUDE.md) becomes executable.

**2.2 The Skill Chain**
Skills compose into a workflow: design (brain+) → plan (plan+) → implement (tdd+) → verify (verify+) → review (review+). Each skill's output becomes the next skill's input. The chain enforces a complete development lifecycle. Skipping a link in the chain means losing a guardrail.

**2.3 Hook Automation**
- **PostToolUse hooks**: Track code changes, enforce test coverage by requiring test tasks before implementation tasks can complete
- **PreToolUse hooks**: Block destructive operations (sed -i, dangerous Docker commands) before they execute
- **Context-aware hooks**: Detect environment state (e.g., recent test-logs) and adjust behavior accordingly (block docker commands when log files are available)

Hooks make discipline automatic. The agent doesn't need to remember rules — the tool layer enforces them.

**2.4 Constitutional Rules**
Hard constraints in CLAUDE.md that never get relaxed:
- No mocking core system components (logger, blockchain libraries, database drivers)
- Full accounting for every state change
- Evidence-based claims only
- Docker-first development (no local execution)

Constitutional rules are enforced by review+ and tdd+ skills during their checklists.

**2.5 Zero-Defect Tolerance**
Every error, warning, and failure must be addressed. "This failure is unrelated" and "this warning was pre-existing" are never acceptable responses. The discipline that makes agentic development work at scale — agents don't have intuition to work around known issues.

### Examples
Skill file templates, hook scripts (PostToolUse/PreToolUse), CLAUDE.md constitution format, test-integrity enforcement patterns.

---

## Level 3: Optimization — Token Efficiency & Agent Performance

**Core thesis**: Agent efficiency is not just about speed — it is about quality. Tokens spent on understanding context reduce tokens wasted on wrong approaches. Structured tool selection turns 200 lines of raw grep output into 5 structured results.

### Patterns

**3.1 Smart Routing / Tool Selection**
Route shell commands to the most efficient tool based on intent:
- `grep`/`rg` → Grep tool or jcodemunch (structured output, 60-80% token reduction)
- `cat` → Read tool (clean output, no line number artifacts)
- `find` → Glob or jcodemunch get_file_tree (targeted discovery)
- `sed -i` / `awk` → Always block, redirect to Edit tool

**3.2 Intent Classification**
Parse bash commands to detect what the agent is trying to do:
- `file_read`: cat commands
- `text_search`: grep, rg
- `file_discovery`: find, fd
- `file_modify`: sed -i, awk with redirects
- `docker`: docker/docker-compose commands

Compound commands (`&&`, `||`, `;`, `|`) are split and each segment classified independently.

**3.3 Environment-Aware Routing**
Detect available tools at session start (RTK, jcodemunch, indexed repos) and route accordingly. Priority: specialized tool > general tool > raw command > block. Graceful degradation when tools aren't available — never hard-fail on a missing optimization.

**3.4 Context Engineering — The Scout Pattern**
Invest tokens upfront in structured exploration before taking action. The Scout Pattern (from the WISC framework): send a lightweight agent to map the codebase first, then act with full context. Structured exploration produces better outcomes than blind searching.

**3.5 Structured Output over Raw Text**
Prefer tools that return structured, summarized results over raw text dumps. jcodemunch returns 5 typed symbol results with signatures and summaries instead of 200 lines of grep matches. Same information, fraction of the tokens, and the agent can reason about it more effectively.

### Examples
Guardrail middleware implementation in TypeScript: intent parsing, environment detection, routing with graceful degradation. RTK integration pattern. Before/after token usage comparisons.

---

## Level 4: Culture — Rigor, Documentation & Maintenance

**Core thesis**: The rigor expected of an agentic bot is much higher than we would reasonably ask of a human engineer — and for good reason. Bots don't have intuition to work around stale docs, "known issues," or drift between code and documentation.

### Patterns

**4.1 Documentation as Contract**
Docs must match code. Always. Stale docs are worse than no docs because they send the agent down wrong paths with false confidence. Documentation freshness is a continuous obligation, not a one-time task.

**4.2 Evidence-Based Claims**
"Tests should pass" is not evidence. The verify+ pattern: run the commands, show the output, then make claims. Every completion claim must be backed by command output. "This failure is unrelated" must be replaced with either a fix or an explanation with evidence.

**4.3 Aggressive Cleanup**
Dead code, unused imports, stale comments, deprecated files — remove them. Every file an agent reads is context that could displace something important. Unused code is not harmless legacy — it is noise that degrades agent performance.

**4.4 Spec Drift Detection**
Documentation, tests, and code drift apart over time. Review checklists must include doc-to-code consistency checks. When code changes, the corresponding docs must be updated in the same task — not "I'll update the docs later."

**4.5 The New Starter Standard**
If someone with zero context cannot understand your project from CLAUDE.md + README + file structure alone, the project is not agentic-ready. This is the ultimate test for L0 — and a continuous standard that L4 maintains.

### Examples
Review checklist templates, documentation freshness workflow, cleanup automation patterns.

---

## Cross-Cutting Concerns

### Anti-Patterns
Common mistakes that undermine agentic development: god files, circular dependencies, mock-heavy test suites, "known issues" that accumulate, docs written once and never updated, conditional test assertions, destructive Docker commands in shared environments.

### Migration Guide
How to move from traditional engineering practices to agentic practices incrementally: start with L0 (restructure for discoverability), add L1 tests alongside existing tests, layer on L2 guardrails, optimize with L3, establish L4 culture.

### Glossary
Shared terminology: stack test, full-loop assertion, skill overlay, constitutional rule, zero-defect tolerance, scout pattern, deep module, graybox module, intent classification.

---

## External References

- **wyntrade-core case study**: Production reference implementation demonstrating all pyramid levels
- **Matt Pocock — "Your codebase is NOT ready for AI"** (youtu.be/uC44zFz7JSM): Deep modules, progressive disclosure, AI-as-new-starter
- **DIY Smart Code — WISC Framework** (youtu.be/gyo0eRgsUWk): Scout pattern, context engineering, input quality
- **Kadam Sagar — Beyond Copilots** (Medium): Closed-loop agentic testing ecosystem, MCP integration, skill-based architecture
- **Autonoma — What is Agentic Testing?**: Intent vs steps, three-agent architecture, self-healing tests

## Implementation Approach

1. **Scaffold repo structure** — README, CLAUDE.md, directory layout
2. **Write L0** — Foundation patterns with examples
3. **Write L1** — Feedback loops (largest section — stack tests, full-loop, sequential design, container isolation, test integrity)
4. **Write L2** — Behavioral guardrails with skill/hook templates
5. **Write L3** — Token optimization with guardrail middleware example
6. **Write L4** — Culture, rigor, maintenance
7. **Write cross-cutting docs** — Anti-patterns, migration guide, glossary
8. **Write references** — Case study, further reading
