# Further Reading

## Articles

### Your codebase is NOT ready for AI (here's how to fix it)
- **Type:** Article
- **Author:** Matt Pocock
- **Summary:** Discusses deep modules, progressive disclosure, graybox modules, and the AI-as-new-starter metaphor to prepare codebases for AI assistance.
- **Related to:** L0
- **URL:** https://medium.com/@mattpocockuk

### Beyond Copilots: Building a Closed-Loop Agentic Testing Ecosystem with MCP and Cursor
- **Type:** Article
- **Author:** Kadam Sagar
- **Summary:** Explores skill-based architecture, MCP integration, and defect prediction workflows for creating intelligent testing systems.
- **Related to:** L1, L2
- **URL:** https://medium.com/@kadam.sagar2689/beyond-copilots-building-a-closed-loop-agentic-testing-ecosystem-with-mcp-and-cursor-22a603c76b7d

### What is Agentic Testing?
- **Type:** Article
- **Creator:** Autonoma
- **Summary:** Introduces intent-based testing, three-agent architecture (planner/automator/maintainer), self-healing tests, and the 80/20 rule for efficient testing.
- **Related to:** L1
- **URL:** https://www.getautonoma.com/blog/what-is-agentic-testing

### The Creator of Clawd — "I Ship Code"
- **Type:** Podcast / Article
- **Creator:** Gergely Orosz (The Pragmatic Engineer) with Peter Steinberger
- **Summary:** Peter Steinberger (creator of OpenClaw) describes building entirely with AI agents: closing the feedback loop so agents verify their own work, investing heavily in planning before implementation, managing 5-10 parallel agents, and treating code reviews as architecture discussions. Demonstrates that agentic development requires more engineering discipline, not less.
- **Related to:** L0, L1, L2, L3, L4
- **URL:** https://newsletter.pragmaticengineer.com/p/the-creator-of-clawd-i-ship-code

## Videos

### Your codebase is NOT ready for AI
- **Type:** Video
- **Creator:** Matt Pocock
- **Summary:** Covers deep modules, graybox modules, and progressive disclosure of complexity to make codebases AI-friendly.
- **Related to:** L0
- **URL:** https://youtu.be/uC44zFz7JSM

### The WISC Framework: 90.2% Better AI Coding Results!
- **Type:** Video / Framework
- **Creator:** Cole Medin (original), DIY Smart Code (adaptation)
- **Summary:** Context engineering framework — **W**rite, **I**solate, **S**elect, **C**ompress. Core thesis: ~80% of agent failures come from context management, not the model. Write externalizes memory (structured commits, progress files, separate planning/implementation sessions). Isolate splits work across sub-agents (scout pattern, research delegation). Select loads only what's needed via a 3-tier context system (global rules, on-demand rules, reference docs). Compress provides focused compaction and session handoffs. The Scout Pattern used in [Pattern 3.4](../L3-optimization.md#pattern-34--context-engineering-the-scout-pattern) maps to WISC's Isolate strategy.
- **Related to:** L3
- **URL:** https://youtu.be/gyo0eRgsUWk
- **GitHub:** https://github.com/coleam00/context-engineering-intro/tree/main/use-cases/ai-coding-wisc-framework

## Tools

### Superpowers (obra)
- **Type:** Tool / Framework
- **Creator:** Jesse Vincent (obra)
- **Summary:** Skills framework for Claude Code providing automated worktree management, brainstorming, planning, TDD, code review, and verification workflows. The worktree, planning, and execution skills automate the full development lifecycle within isolated git worktrees — the pattern described in L0.5.
- **Related to:** L0, L2
- **URL:** https://github.com/obra/superpowers

### jcodemunch
- **Type:** Tool
- **Creator:** Nicolo Ribaudo
- **Summary:** Structured code search and symbol navigation tool that indexes repositories for AI-efficient code exploration, returning typed, summarized results instead of raw text.
- **Related to:** L3
- **URL:** https://github.com/nicolo-ribaudo/jcodemunch

### RTK (Rust Token Killer)
- **Type:** Tool
- **Creator:** Community
- **Summary:** CLI proxy that optimizes shell commands for token usage, providing 60-90% savings on development operations through intelligent command filtering.
- **Related to:** L3
- **URL:** https://github.com/rtk-ai/rtk

### TOON (Token-Oriented Object Notation)
- **Type:** Tool / Format
- **Creator:** toon-format
- **Summary:** Compact, human-readable encoding of the JSON data model designed for LLM prompts. Eliminates redundant structure in tabular data (the most common shape of MCP API responses) by declaring field names once in a header. Provides 60-65% token reduction on uniform object arrays with lossless round-trip serialization. Applied as middleware on MCP response paths to transparently optimize token usage without changing the agent's consumption model.
- **Related to:** L3
- **URL:** https://github.com/toon-format/toon

### Claude Code (Anthropic)
- **Type:** Tool
- **Creator:** Anthropic
- **Summary:** AI coding CLI with skills, hooks, and agentic capabilities that enhances developer productivity through intelligent code assistance and automation.
- **Related to:** L2, L3
- **URL:** https://claude.ai/code