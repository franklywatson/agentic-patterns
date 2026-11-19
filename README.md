# Agentic Patterns

A toolkit of patterns for making codebases work effectively with AI coding agents — gathered from production use, organized into five layers, and designed to adopt incrementally.

## Why This Exists

AI coding agents are becoming standard tools. But most codebases were built for humans — humans who can mentally bridge gaps, tolerate partial feedback, rely on intuition to navigate messy directories, and instinctively know which warnings to ignore.

AI agents can't do any of that. They need:

- **Complete feedback** — a test either passes or fails, and the failure tells them exactly where to look
- **Structured context** — information organized so complexity is discoverable, not dumped all at once
- **Enforced discipline** — rules enforced by hooks or the boundary, not only written in a wiki
- **Deterministic environments** — no "it works on my machine," no shared state leaking between tests

None of these ideas are new. Deep modules, progressive disclosure, and evidence-based engineering are decades old — drawn from John Ousterhout's work on software design, Matt Pocock's graybox module concept, and well-established testing discipline. What's new is how critical they become when your coworker is an AI with no memory of your codebase and no intuition to fall back on.

These patterns stand on the shoulders of those established ideas. They reframe practices that excellent engineers already use — making them explicit, composable, and enforceable so that agents and humans alike benefit from the structure.

## Where These Patterns Come From

The patterns were extracted from a [production-grade Telegram trading bot](docs/references/reference-telegram-trading-bot-case-study.md) — a financial application handling real blockchain transactions, built fully agentically with Claude Code as the primary development tool. That project developed **Stack-First Development**: bringing up the entire application stack in Docker and testing through API endpoints only, where each stack test is an atomic user journey that passes or fails as a whole.

Peter Steinberger, creator of OpenClaw, has described a similar approach ([interview](docs/references/further-reading.md#peter-steinberger-on-shipping-code-with-agents)) — managing 5-10 parallel agents, closing the feedback loop so agents verify their own work, investing heavily in planning before implementation, and treating code reviews as architecture discussions. His core insight: *"I don't think software engineering is dead with AI: in fact, quite the opposite."* Agentic development demands more engineering discipline, not less.

Other frameworks approach similar problems from different angles. [superpowers](https://github.com/obra/superpowers) provides base skills for brainstorming, planning, TDD, and code review. [rig](https://github.com/franklywatson/claude-rig) is a configurable guardrails framework built on the L2-L4 patterns from this repo — automating enforcement pipelines, tool routing, token-optimized scout agents, context eval, and session management. These systems informed this work — the best available ideas at the time, applied in practice.

Disclosure: the author of this library also built rig, from these patterns. rig demonstrates the patterns. It does not independently validate them.

The lineage: patterns were extracted from the reference project, organized into this library, then used to build rig — to serve as a working reference implementation and configurable toolkit for general use.

### Reference Implementations

| System | What it implements | Language |
|--------|-------------------|----------|
| [rig](https://github.com/franklywatson/claude-rig) | Guardrails framework: L2 enforcement pipeline, L3 tool routing + token-optimized scout agent, L4 context eval, skill chain with phase transitions, CI guardrails. Configurable via `.harness.yaml`. | TypeScript |
| [superpowers](https://github.com/obra/superpowers) | L2 base skills (brainstorming, TDD, verification, review), automated worktree management | Markdown/JS |

Both install hooks, skills and commands that run with your agent's privileges. Read and pin before installing
([Pattern 2.12](docs/L2-behavioral-guardrails.md#pattern-212--skill-plugin-and-mcp-supply-chain)). rig installs
with `rig init`.

## The Pattern Layers

The library has five layers, L0 to L4. A layer is a group of patterns that depend on the layers below it: L1 verification needs the navigable structure of L0, and L2 enforcement needs the checks of L1. The layers are not a maturity scale. Finishing L4 does not make a team ready for unattended agent work. Adoption starts where your gaps are, not at L0 by default.

![Layer dependencies: each layer builds on the one below](docs/diagrams/pyramid.png)

### Layer Overviews

**[L0: Foundation](docs/L0-foundation.md)** — Structure your codebase so an AI with zero prior context can navigate, understand, and contribute. Deep modules, progressive disclosure, conceptual file organization, an agent instruction file (AGENTS.md) as project constitution, unit tests as contract, documentation as system map, and aggressive cleanup. The "can a new starter figure this out?" test.

**[L1: Closed Loop Design and Verification](docs/L1-feedback-loops.md)** — The layer where agents stop guessing and start designing. Context harvesting gathers targeted evidence before implementation. Design rinsing extends this beyond the current project — extracting distilled architectural understanding from external sources (codebases, transcripts, articles) and translating it into design decisions for the target project. Stack tests validate design intent end-to-end through the full application stack — real dependencies (no mocks in stack tests), no partial integration, no ambiguous results. Mocks are appropriate in unit tests for isolation. Full-loop assertion layering catches regressions at primary, secondary, and tertiary levels of assertion.

**[L2: Behavioral Guardrails](docs/L2-behavioral-guardrails.md)** — Prose is guidance. Hooks are deterministic policy within the harness. Containment and credentials are the boundary. Put each rule at the weakest enforcement point that can hold it, and name that enforcement point for every constitutional rule. Skills overlay project rules on base agent capabilities; the skill chain and phase tracking are optional and scale with risk.

**[L3: Optimization (optional)](docs/L3-optimization.md)** — Reduces tokens spent on exploration and tool output. It is not on the path to verified or unattended work. Covers preferring native structured tools and blocking destructive shell edits, context isolation with a scout sub-agent (from the WISC framework), and a pointer to rig's code for environment-aware routing.

**[L4: Standards & Measurement](docs/L4-standards-measurement.md)** — Evidence-based claims, development metrics, CI
guardrails, and context eval for routing effectiveness. Measures whether L0-L3 are holding and what they change. Drift
detection, the new-starter audit and pruning of context artefacts live in L0 ([Pattern
0.7](docs/L0-foundation.md#pattern-07--documentation-as-system-map), [Pattern
0.9](docs/L0-foundation.md#pattern-09--ai-as-new-starter-standard) and [Pattern
0.10](docs/L0-foundation.md#pattern-010--prune-and-re-baseline-context)).

## How Far a Team Can Let Go

The layers say whether letting go is safe. [Earned Autonomy](docs/earned-autonomy.md) says how far one workflow may
go and how it gets there.

- **Autonomy grants (A1-A5).** A grant is what one named workflow may do. A1 suggests and a human applies the
  change. A2 opens pull requests that a human reads. A3 passes required checks before a human merges. A4 acts on an
  event or schedule within permitted actions, with an owner, limits, an audit record and a tested stop, only where
  verification is mechanical and the action reversible. A5 is A4 managed as an investment: baseline, target, review
  date and stop rule.
- **The cap.** A team has a position on the curve C1-C5 for each of seven dimensions. The cap for unattended work is
  the lowest position among platform, security and governance, production ownership and measuring value. No grant
  may sit above it: A2 needs a cap of at least C2, A3 C3, A4 C4, A5 C5. The curve is defined in
  [Baseline structure](docs/references/sources.md#baseline-structure).

The cap belongs to a team, not to the library. Adopting patterns does not set it. `autonomy census` reports a
repository's own positions from its register, and the lowest capping position is its cap.

## What This Library Does Not Cover Yet

- **Production ownership, in part.** [Pattern
  4.7](docs/L4-standards-measurement.md#pattern-47--author-of-record-and-agent-register) names an author of record
  and an agent register with sponsor, expiry and stop authority. [Pattern A.5](docs/earned-autonomy.md#pattern-a5--tested-stop)
  and the stop drill rehearse the stop. Not covered: running and repairing agent-built software in production,
  including on-call and rollback. The [FAQ](docs/cross-cutting/faq.md) names deployment as out of scope.
- **Measuring value against a baseline.** L4 describes metrics. It does not describe how to set a baseline before
  adopting a pattern or how to compare against it afterwards.
- **Data handling, audit retention and incident response.** Security and governance is otherwise covered by
  [Patterns 2.9 to 2.13](docs/L2-behavioral-guardrails.md#pattern-29--contain-before-you-relax), the [threat
  model](docs/cross-cutting/threat-model.md) and [Patterns 4.7 to
  4.9](docs/L4-standards-measurement.md#pattern-47--author-of-record-and-agent-register).

What is covered: the development-time loop (L0 to L4), and the seam where production incidents enter it. [Patterns
1.7 to 1.12](docs/L1-feedback-loops.md#closing-the-loop-in-production) define the incident record, reproduction,
classification, gate, limits and stop for repairing owned code, with a runnable gate in
[examples/repair-loop](examples/repair-loop/README.md). Out of scope: deployment pipelines, feature-flag services
and production telemetry. The [FAQ](docs/cross-cutting/faq.md#what-passes-between-the-application-and-operations)
defines the contract between the application and operations. Unattended repair of data-forward or irreversible
changes is not supported at any grant.

## Getting Started

1. **Find your gaps.** The [Adoption Guide](docs/cross-cutting/adoption-guide.md) has a short assessment and four
   paths (foundation-first, testing-first, guardrails-first, containment-first). Start there.
2. **Make the project navigable.** Read [Pattern
   0.2](docs/L0-foundation.md#pattern-02--progressive-disclosure) and [Pattern
   0.4](docs/L0-foundation.md#pattern-04--agent-instruction-file-as-project-constitution), then write a short
   AGENTS.md. The rest of [L0](docs/L0-foundation.md) can wait until you need it.
3. **Close the loop.** [L1: Closed Loop Design and Verification](docs/L1-feedback-loops.md) and [Pattern
   1.1](docs/L1-patterns/1.1-stack-tests.md) show how an agent verifies its own work.
4. **Contain before you relax approvals.** [Pattern
   2.9](docs/L2-behavioral-guardrails.md#pattern-29--contain-before-you-relax) comes before any loosening of
   permissions. The rest of [L2](docs/L2-behavioral-guardrails.md) and [L4](docs/L4-standards-measurement.md) add
   guardrails and measurement.

## Audience

- **Solo developers and small teams** using Claude Code, Cursor, or similar tools — adopt patterns incrementally, starting where your gaps are
- **Team leads and architects** exploring agentic development practices for their organization
- **Anyone** curious about what "agentic-friendly" software engineering looks like in practice

## What's in This Repo

```
docs/                 # Pattern documentation (layers L0-L4), Earned Autonomy and guides
  cross-cutting/      # Anti-patterns, adoption guide, threat model, FAQ, glossary
  references/         # Case study, further reading, sources, task bank
examples/             # Working code (TypeScript and Python for core patterns; the optional L3 example is TypeScript only)
  stack-test/         # Pattern 1.1: Docker stack tests (typescript/ with Playwright, python/ with pytest)
  repair-loop/        # Patterns 1.7-1.11: incident to reproduction to gate decision, no LLM (TypeScript and Python)
  containment/        # Pattern 2.9: policy layer vs container boundary, with tests (TypeScript and Python)
  autonomy/           # Patterns A.1-A.6: register check, census, ledger, stop drill, hook (TypeScript and Python)
  guardrails/         # Pattern 3.1: optional token-optimization middleware (TypeScript only)
  project-structure/  # L0: before and after directory layouts (documentation only)
```

The TypeScript and Python stack-test examples cover the same core pattern (Docker-based stack tests with full-loop assertions) but differ in scope: the TypeScript example extends to browser-based testing with Playwright, while the Python example demonstrates API-level testing with pytest conventions. Both are self-contained and runnable independently.

## Contributing

This is a living pattern library. Contributions welcome:

- **New patterns** that extend or challenge the existing framework
- **Real-world examples** from different domains (the current examples cover ecommerce, trading, incident repair and containment)
- **Corrections** when a pattern doesn't match your experience — document the exception
- **Translations** of concepts to other frameworks and tools

## Background and Further Reading

- [Reference Telegram Trading Bot Case Study](docs/references/reference-telegram-trading-bot-case-study.md) — the production system these patterns were extracted from
- [FAQ](docs/cross-cutting/faq.md) — deployment, operations, and other SDLC concerns beyond the patterns
- [Further Reading](docs/references/further-reading.md) — articles, videos, and tools that informed this work
- [Glossary](docs/cross-cutting/glossary.md) — terminology reference
