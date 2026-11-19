# Agentic Patterns

Patterns and runnable examples for letting AI coding agents change a codebase safely: how to structure a project so
an agent can find its way, how the agent proves a change works, where each rule is enforced, and how far one
workflow may run without a person. For developers and teams using Claude Code or a similar agent harness. Adopt the
patterns where your gaps are.

The library uses three separate scales:

| Scale | Values | Answers | Defined in |
|-------|--------|---------|------------|
| Layers | L0 to L4 | What to build | [The Pattern Layers](#the-pattern-layers) |
| Enforcement points | prompt, hook, CI, sandbox, downstream | Where a rule holds | [L2 Overview](docs/L2-behavioral-guardrails.md#overview) |
| Curve and grants | C1 to C5 per team dimension; A1 to A5 per workflow | How far a workflow may run without a person | [Earned Autonomy](docs/earned-autonomy.md#the-curve-and-the-cap) |

The layers are not a maturity scale. The curve is.

## Start Here

| You are | Read first | First action |
|---------|-----------|--------------|
| A developer who wants safer agent sessions this week | [Pattern 2.9](docs/L2-behavioral-guardrails.md#pattern-29--contain-before-you-relax), [containment example](examples/containment/README.md) | Turn on the sandbox with the Claude Code binding, keep credentials out, and run one command that must fail |
| A lead deciding how far agents may run | [Earned Autonomy: the curve and the cap](docs/earned-autonomy.md#the-curve-and-the-cap), [threat model](docs/cross-cutting/threat-model.md) | Run the example census on one repository and read its cap |
| A maintainer adding agents to an existing repository with CI | [Pattern 0.4](docs/L0-foundation.md#pattern-04--agent-instruction-file-as-project-constitution), [Pattern 4.1](docs/L4-standards-measurement.md#pattern-41--evidence-based-claims), [Pattern 4.5](docs/L4-standards-measurement.md#pattern-45--ci-guardrails) | Write a short AGENTS.md with an enforcement point per rule, and make the test job a required check |
| Not sure where the gaps are | [Adoption Guide assessment](docs/cross-cutting/adoption-guide.md#assessment-where-are-you-now) | Pick a path |

Contain before you relax approvals: Pattern 2.9 comes before any loosening of permissions.

## The Pattern Layers

The library has five layers, L0 to L4. A layer is a group of patterns that depend on the layers below it: L1 verification needs the navigable structure of L0, and L2 enforcement needs the checks of L1. L3 is optional and sits beside the path to L4. The layers are not a maturity scale: finishing L4 does not make a team ready for work with no person watching each step. Adoption starts where your gaps are, not at L0 by default. The dependency diagram is `docs/diagrams/pyramid.png`.

### Layer Overviews

**[L0: Foundation](docs/L0-foundation.md)** — Structure your codebase so an AI with zero prior context can navigate, understand, and contribute. Deep modules, progressive disclosure, an agent instruction file (AGENTS.md) as project constitution, unit tests as contract, documentation as system map, and aggressive cleanup. The "can a new starter figure this out?" test.

**[L1: Closed Loop Design and Verification](docs/L1-feedback-loops.md)** — How an agent proves its own change works. Context harvesting gathers targeted evidence before implementation. Design rinsing extracts distilled architectural understanding from external sources (codebases, transcripts, articles) and translates it into design decisions for the target project. Stack tests validate design intent end-to-end through the full application stack with real dependencies and no ambiguous results. Mocks are appropriate in unit tests for isolation. Full-loop assertion layering catches regressions at primary, secondary and tertiary levels. Patterns 1.7 to 1.12 extend the loop to production incidents.

**[L2: Behavioral Guardrails](docs/L2-behavioral-guardrails.md)** — Enforcement points stack. Prose is guidance. Command hooks are deterministic policy inside the harness. Containment and credentials are the boundary. Skills are prompt-level and guarantee nothing. Name the enforcement point for every constitutional rule. Skills overlay project rules on base agent capabilities; the skill chain is optional and scales with risk.

**[L3: Optimization (optional)](docs/L3-optimization.md)** — Reduces tokens spent on exploration and tool output. It is not on the path to verified or unattended work. Covers preferring native structured tools, blocking destructive shell edits, and context isolation with a scout sub-agent (from the WISC framework).

**[L4: Standards & Measurement](docs/L4-standards-measurement.md)** — Evidence-based claims, development metrics, CI guardrails, context eval, ownership of agent-written code and the team's skill to supervise. Measures whether the other layers hold and what they change.

## How Far a Team Can Let Go

The layers make an agent's work verifiable. The curve and the cap say how far a team may let a workflow run without a person. [Earned Autonomy](docs/earned-autonomy.md) defines both and how a workflow earns each grant.

- **Autonomy grants (A1-A5).** A grant is what one named workflow may do. A1 suggests and a human applies the change. A2 opens pull requests that a human reads. A3 passes required checks before a human merges. A4 acts on an event or schedule within permitted actions, with an owner, limits, an audit record and a tested stop, only where verification is mechanical and the action reversible. A5 is A4 managed as an investment: baseline, target, review date and stop rule.
- **The curve (C1-C5).** A team has a position for each of seven dimensions. Four of them (platform, security and governance, production ownership, measuring value) set the cap: the lowest of the four. No grant may sit above it: A2 needs a cap of at least C2, A3 C3, A4 C4, A5 C5.

The cap comes from the team's own census, not from the library. The example CLI `autonomy census` ([examples/autonomy](examples/autonomy/README.md)) reports a repository's positions from its register and files. A team that adopts only this library is held back by measuring value: C3 needs a committed baseline file, and the library does not describe how to build one. Until a baseline exists the practical ceiling is C2 and the grant A2.

## What's in This Repo

```
docs/                 # Pattern documentation (layers L0-L4), Earned Autonomy and guides
  cross-cutting/      # Anti-patterns, adoption guide, threat model, FAQ, glossary
  references/         # Case study, further reading, sources, task bank
  diagrams/           # Diagrams for the README and layer docs
examples/             # Working code (TypeScript and Python for core patterns; the optional L3 example is TypeScript only)
  stack-test/         # Pattern 1.1: Docker stack tests (typescript/ with Playwright, python/ with pytest)
  repair-loop/        # Patterns 1.7-1.11: incident to reproduction to gate decision, no LLM (TypeScript and Python)
  containment/        # Pattern 2.9: policy layer vs container boundary, with tests (TypeScript and Python)
  autonomy/           # Patterns A.1-A.6: register check, census, ledger, stop drill, hook (TypeScript and Python)
  guardrails/         # Pattern 3.1: optional token-optimization middleware (TypeScript only)
  project-structure/  # L0: before and after directory layouts (documentation only)
```

The TypeScript stack-test example extends to browser-based testing with Playwright; the Python example demonstrates API-level testing with pytest. Both are self-contained.

## What This Library Does Not Cover

- **Production ownership, in part.** [Pattern 4.7](docs/L4-standards-measurement.md#pattern-47--author-of-record-and-agent-register) names an author of record and an agent register with sponsor, expiry and stop authority. [Pattern A.5](docs/earned-autonomy.md#pattern-a5--tested-stop) and the stop drill rehearse the stop. Not covered: running and repairing agent-built software in production, including on-call and rollback. The [FAQ](docs/cross-cutting/faq.md) names deployment as out of scope.
- **Measuring value against a baseline.** L4 describes metrics. It does not describe how to set a baseline before adopting a pattern or how to compare against it afterwards.
- **Data handling, audit retention and incident response.** Security and governance is otherwise covered by [Patterns 2.9 to 2.13](docs/L2-behavioral-guardrails.md#pattern-29--contain-before-you-relax), the [threat model](docs/cross-cutting/threat-model.md) and [Patterns 4.7 and 4.9](docs/L4-standards-measurement.md#pattern-47--author-of-record-and-agent-register).
- **Docker stack tests inside the sandbox.** Pattern 2.9 states that `docker` does not run in the sandbox; no example shows a session inside a container or virtual machine with its own daemon.
- **Monorepo layouts.** The examples assume one repository with one register.

What is covered: the development-time loop (L0 to L4), and the seam where production incidents enter it. [Patterns 1.7 to 1.12](docs/L1-feedback-loops.md#closing-the-loop-in-production) define the incident record, reproduction, classification, gate, limits and stop for repairing owned code, with a runnable gate in [examples/repair-loop](examples/repair-loop/README.md). Out of scope: deployment pipelines, feature-flag services and production telemetry. The [FAQ](docs/cross-cutting/faq.md#what-passes-between-the-application-and-operations) defines the contract between the application and operations. Unattended repair of data-forward or irreversible changes is not supported at any grant.

## Why This Exists

AI coding agents are becoming standard tools. But most codebases were built for humans — humans who can mentally bridge gaps, tolerate partial feedback, rely on intuition to navigate messy directories, and instinctively know which warnings to ignore.

AI agents can't do any of that. They need:

- **Complete feedback** — a test either passes or fails, and the failure tells them exactly where to look
- **Structured context** — information organized so complexity is discoverable, not dumped all at once
- **Enforced discipline** — rules held by hooks, CI or the boundary, not only written in a wiki
- **Deterministic environments** — no "it works on my machine," no shared state leaking between tests

None of these ideas are new. Deep modules, progressive disclosure, and evidence-based engineering are decades old — drawn from John Ousterhout's work on software design, Matt Pocock's graybox module concept, and well-established testing discipline. What's new is how critical they become when your coworker is an AI with no memory of your codebase and no intuition to fall back on.

These patterns stand on the shoulders of those established ideas. They reframe practices that excellent engineers already use — making them explicit, composable, and enforceable so that agents and humans alike benefit from the structure.

## Where These Patterns Come From

The patterns were extracted from a [production-grade Telegram trading bot](docs/references/reference-telegram-trading-bot-case-study.md) — a trading application that moves funds on blockchains (its tests run on testnets), built fully agentically with Claude Code as the primary development tool. That project developed **Stack-First Development**: bringing up the entire application stack in Docker and testing through API endpoints only, where each stack test is an atomic user journey that passes or fails as a whole.

Peter Steinberger, creator of OpenClaw, has described a similar approach ([interview](docs/references/further-reading.md#peter-steinberger-on-shipping-code-with-agents)) — managing 5-10 parallel agents, closing the feedback loop so agents verify their own work, investing heavily in planning before implementation, and treating code reviews as architecture discussions. His core insight: *"I don't think software engineering is dead with AI: in fact, quite the opposite."* Agentic development demands more engineering discipline, not less.

Other frameworks approach similar problems from different angles. [superpowers](https://github.com/obra/superpowers) provides base skills for brainstorming, planning, TDD, and code review. [rig](https://github.com/franklywatson/claude-rig) is a configurable guardrails framework built on the L2-L4 patterns from this repo: enforcement pipelines, tool routing, token-optimized scout agents, context eval and session management.

Disclosure: the author of this library also built rig, from these patterns. rig demonstrates the patterns. It does not independently validate them.

### Reference Implementations

| System | What it implements | Language |
|--------|-------------------|----------|
| [rig](https://github.com/franklywatson/claude-rig) | Guardrails framework: L2 enforcement pipeline, L3 tool routing + token-optimized scout agent, L4 context eval, skill chain with phase transitions, CI guardrails. Configurable via `.harness.yaml`. | TypeScript |
| [superpowers](https://github.com/obra/superpowers) | L2 base skills (brainstorming, TDD, verification, review), automated worktree management | Markdown/JS |

Both install hooks, skills and commands that run with your agent's privileges. Read and pin before installing
([Pattern 2.12](docs/L2-behavioral-guardrails.md#pattern-212--skill-plugin-and-mcp-supply-chain)). rig installs
with `rig init`.

## Contributing

This is a living pattern library. Contributions welcome:

- **New patterns** that extend or challenge the existing framework
- **Real-world examples** from different domains (the current examples cover ecommerce, incident repair, containment and earned autonomy)
- **Corrections** when a pattern doesn't match your experience — document the exception
- **Translations** of concepts to other frameworks and tools

## Background and Further Reading

- [Reference Telegram Trading Bot Case Study](docs/references/reference-telegram-trading-bot-case-study.md) — the production system these patterns were extracted from
- [FAQ](docs/cross-cutting/faq.md) — deployment, operations, and other SDLC concerns beyond the patterns
- [Further Reading](docs/references/further-reading.md) — articles, videos, and tools that informed this work
- [Glossary](docs/cross-cutting/glossary.md) — terminology reference
