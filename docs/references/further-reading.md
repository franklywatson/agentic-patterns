---
reviewed: 2026-11-19
---

# Further Reading

The sources cited by the evidence labels on each pattern are listed in [sources.md](sources.md). This page lists
the material the patterns draw on beyond those citations.

## Start here

- PL-21: [AGENTS.md](https://agents.md/), the open format for agent instruction files ([Pattern
  0.4](../L0-foundation.md#pattern-04--agent-instruction-file-as-project-constitution)).
- PL-16: [Best practices](https://code.claude.com/docs/en/best-practices.md), Anthropic's guidance on instruction
  files, verification and context.
- PL-18: [Harness engineering for coding agent
  users](https://martinfowler.com/articles/exploring-gen-ai/harness-engineering.html) (Böckeler), Thoughtworks' account
  of harness design for coding agents.
- IS-6: [METR's randomised trial](https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/) of
  experienced developers using AI, evidence that developers misjudge the speed effect of AI tools ([Pattern
  4.1](../L4-standards-measurement.md#pattern-41--evidence-based-claims)).

## Articles and podcasts

### Peter Steinberger on shipping code with agents

- **Type:** Podcast / Article
- **Creator:** Gergely Orosz (The Pragmatic Engineer) with Peter Steinberger, creator of OpenClaw
- **Summary:** Steinberger describes building with AI agents: closing the feedback loop so agents verify their
  own work, planning before implementation, running 5-10 parallel agents, and treating code review as an
  architecture discussion. The page is titled "The Creator of Clawd", the project's name before it became
  OpenClaw. The account is one practitioner's; this library treats an agent's verification of its own work as
  self-report ([Pattern 4.1](../L4-standards-measurement.md#pattern-41--evidence-based-claims)).
- **Related to:** L0, L1, L2
- **URL:** <https://newsletter.pragmaticengineer.com/p/the-creator-of-clawd-i-ship-code>

### Compound Engineering Plugin

- **Type:** Tool / Framework
- **Creator:** Every Inc.
- **Summary:** Plugin for a development workflow in which each unit of work records what it learned so the next
  unit is easier: ideate, brainstorm, plan, work, review, compound. Knowledge is codified as "learnings" through
  `/ce:compound`. The cycle weights planning and review at 80% and execution at 20%, per the project's own
  description.
- **Related to:** L2
- **URL:** <https://github.com/EveryInc/compound-engineering-plugin>

### REPL is dead, long live REPL

- **Type:** Article
- **Author:** Brandon Waselnuk (Unblocked)
- **Summary:** Argues that the Read-Eval-Print Loop moved to the intent layer: engineers read agent output,
  evaluate it against intent, print the next instruction and loop, while agents run the code-level loop. The
  article argues that curated context and intent-level evaluation produce better results than a code-level loop.
- **Related to:** L1
- **URL:** <https://getunblocked.com/blog/repl-is-dead-long-live-repl/>

## Videos

### Your codebase is NOT ready for AI

- **Type:** Video
- **Creator:** Matt Pocock
- **Summary:** Deep modules, graybox modules and progressive disclosure of complexity as ways to make a codebase
  workable for AI agents.
- **Related to:** L0
- **URL:** <https://youtu.be/uC44zFz7JSM>

### The WISC Framework

- **Type:** Video / Framework
- **Creator:** Cole Medin
- **Summary:** Context engineering framework: Write, Isolate, Select, Compress. The video claims that most agent
  failures come from context management rather than the model; the claim comes from a single uncontrolled
  source (evidence level: Thin). Write externalises memory (progress files, separate planning and implementation
  sessions). Isolate splits work across sub-agents. Select loads only what a task needs through tiered rules and
  reference docs. Compress covers focused compaction and session handoffs. The scout in [Pattern
  3.2](../L3-optimization.md#pattern-32--context-isolation-scout) corresponds to Isolate.
- **Related to:** L3
- **URL:** <https://youtu.be/gyo0eRgsUWk>
- **GitHub:** <https://github.com/coleam00/context-engineering-intro/tree/main/use-cases/ai-coding-wisc-framework>

## Tools

Skills, plugins, hooks, command proxies and MCP servers run with the agent's privileges. Read the source, pin
a version and review updates before installing any tool listed here ([Pattern
2.12](../L2-behavioral-guardrails.md#pattern-212--skill-plugin-and-mcp-supply-chain)). jcodemunch is free for
non-commercial use and needs a paid licence for commercial use (README at
github.com/jgravelle/jcodemunch-mcp).

### Superpowers (obra)

- **Type:** Tool / Framework
- **Creator:** Jesse Vincent (obra)
- **Summary:** Skills framework for Claude Code covering worktree management, brainstorming, planning, test-driven
  development, code review and verification workflows.
- **Related to:** L0, L2
- **URL:** <https://github.com/obra/superpowers>

### jcodemunch

- **Type:** Tool
- **Creator:** J. Gravelle
- **Summary:** Indexes a repository and returns typed, summarised symbol search results instead of raw text.
- **Related to:** L3
- **URL:** <https://github.com/jgravelle/jcodemunch-mcp>

### RTK (Rust Token Killer)

- **Type:** Tool
- **Creator:** Community
- **Summary:** CLI proxy that filters noisy shell command output before it reaches the agent.
- **Related to:** L3
- **URL:** <https://github.com/rtk-ai/rtk>

### Claude Code

- **Type:** Tool
- **Creator:** Anthropic
- **Summary:** Coding agent CLI with skills, hooks, sub-agents and settings-based permissions; the harness that the
  L2 examples target.
- **Related to:** L2, L3
- **URL:** <https://code.claude.com/docs/en/overview>
