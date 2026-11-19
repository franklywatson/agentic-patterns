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
| A developer who wants safer agent sessions this week | [Pattern 2.9](docs/L2-behavioral-guardrails.md#pattern-29--contain-before-you-relax), [containment example](examples/containment/README.md) | Put the keys from the [containment binding](examples/containment/claude-code/settings.json) where the agent cannot edit them ([FAQ: where the settings file goes](docs/cross-cutting/faq.md#i-work-alone-where-does-the-sandbox-settings-file-go)), keep credentials out, and run one command that must fail. If your tests need Docker: [FAQ: Docker in the sandbox](docs/cross-cutting/faq.md#my-stack-tests-need-docker-how-do-i-run-them-inside-the-sandbox) |
| A lead deciding how far agents may run | [Earned Autonomy: the curve and the cap](docs/earned-autonomy.md#the-curve-and-the-cap), [threat model](docs/cross-cutting/threat-model.md) | Run the example census on one repository and read its cap |
| A maintainer adding agents to an existing repository with CI | [Pattern 0.4](docs/L0-foundation.md#pattern-04--agent-instruction-file-as-project-constitution), [Pattern 4.1](docs/L4-standards-measurement.md#pattern-41--evidence-based-claims), [Pattern 4.5](docs/L4-standards-measurement.md#pattern-45--ci-guardrails) | Write a short AGENTS.md with an enforcement point per rule, and make the test job a required check ([how to](docs/cross-cutting/adoption-guide.md#make-the-test-job-a-required-check)) |
| Not sure where the gaps are | [Adoption Guide assessment](docs/cross-cutting/adoption-guide.md#assessment-where-are-you-now) | Pick a path |

Contain before you relax approvals: Pattern 2.9 comes before any loosening of permissions.

## The Pattern Layers

The library has five layers, L0 to L4. A layer is a group of patterns that depend on the layers below it: L1 verification needs the navigable structure of L0, and L2 enforcement needs the checks of L1. L3 is optional and sits beside the path to L4. The layers are not a maturity scale: finishing L4 does not make a team ready for work with no person watching each step. Adoption starts where your gaps are; when unsure, the [adoption guide](docs/cross-cutting/adoption-guide.md) starts at L0.

### Layer Overviews

**[L0: Foundation](docs/L0-foundation.md)** — Structure your codebase so an AI with zero prior context can navigate, understand, and contribute. Deep modules, progressive disclosure, an agent instruction file (AGENTS.md) as project constitution, unit tests as contract, documentation as system map, and aggressive cleanup. The "can a new starter figure this out?" test.

**[L1: Closed Loop Design and Verification](docs/L1-feedback-loops.md)** — How an agent proves its own change works. Stack tests run the whole application in Docker with real dependencies and assert on each journey's effects; tests that can pass silently are forbidden. Patterns 1.7 to 1.12 extend the loop to incidents in code you own.

**[L2: Behavioral Guardrails](docs/L2-behavioral-guardrails.md)** — Enforcement points stack. Prose is guidance. Command hooks are deterministic policy inside the harness. Containment and credentials are the boundary. Skills are prompt-level and guarantee nothing. Name the enforcement point for every constitutional rule. Skills overlay project rules on base agent capabilities; the skill chain is optional and scales with risk.

**[L3: Optimization (optional)](docs/L3-optimization.md)** — Reduces tokens spent on exploration and tool output. It is not on the path to verified or unattended work. Covers preferring native structured tools, blocking destructive shell edits, and context isolation with a scout sub-agent (from the WISC framework).

**[L4: Standards & Measurement](docs/L4-standards-measurement.md)** — Evidence-based claims, development metrics, CI guardrails, context eval, ownership of agent-written code and the team's skill to supervise. Measures whether the other layers hold and what they change.

## How Far a Workflow May Run Without a Person

The layers make an agent's work checkable. Two more scales, defined in [Earned Autonomy](docs/earned-autonomy.md), say how far one workflow may run without a person watching. The risk tier of a change decides its review, and the grant decides who acts unattended: the [risk model](docs/L1-patterns/1.8-reversibility-blast-radius.md#risk-model) joins the two.

- **Grant (A1-A5), per workflow.** A1: the agent reads and suggests; a person makes every change. A2: the agent edits and commits; a person reads every change, pushes the branch and opens the pull request. A3: the agent pushes branches and opens pull requests, changes pass required checks before a person merges. A4: the workflow acts on an event or schedule with an owner, limits, an audit record and a tested stop, only where verification is mechanical and the action reversible. A5: A4 managed as an investment, with a baseline, a target, a review date and a stop rule.
- **Curve (C1-C5) and cap, per repository.** `autonomy census` ([examples/autonomy](examples/autonomy/README.md)) places one repository, the directory you pass with `--dir`, on seven dimensions. The cap is the lowest of four: platform, security and governance, production ownership and measuring value. Grant An needs a cap of at least Cn, and `autonomy check` fails CI when a grant exceeds the cap.

A new repository starts at C1, which allows only A1, read-only suggestions. An agent session that edits files needs A2, so a new repository first reaches C2: [Reaching C2](docs/earned-autonomy.md#reaching-c2) lists the census probes to pass. C3 needs a committed baseline, and this library does not show how to compute one, so a repository that uses only this library stops at C2 and A2. The census checks that files exist and are recent, not that their content is true: a reviewer reads the profile.

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
- **Docker stack tests inside the sandbox.** Pattern 2.9 states that `docker` does not run in the sandbox; the [FAQ](docs/cross-cutting/faq.md#my-stack-tests-need-docker-how-do-i-run-them-inside-the-sandbox) compares three options, and no example shows a session inside a container or virtual machine with its own daemon.
- **Monorepos.** The examples assume one repository with one register. The census runs on one directory at a time and computes no per-package cap. The [adoption guide](docs/cross-cutting/adoption-guide.md#make-the-test-job-a-required-check) and the [FAQ](docs/cross-cutting/faq.md#monorepo-or-multi-repo-for-agents) cover required checks and instruction files.

What is covered: the development-time loop (L0 to L4), and the seam where production incidents enter it. [Patterns 1.7 to 1.12](docs/L1-feedback-loops.md#closing-the-loop-in-production) define the incident record, reproduction, classification, gate, limits and stop for repairing owned code, with a runnable gate in [examples/repair-loop](examples/repair-loop/README.md). Out of scope: deployment pipelines, feature-flag services and production telemetry. The [FAQ](docs/cross-cutting/faq.md#what-passes-between-the-application-and-operations) defines the contract between the application and operations. Unattended repair of data-forward or irreversible changes is not supported at any grant.

## Why This Exists

An agent starts each session with no memory of the codebase. It needs a test that passes or fails and says where, context it can find one step at a time, rules held by something other than its attention, and an environment that gives the same result every run. The ideas are established: Ousterhout's deep modules, Matt Pocock's graybox modules, progressive disclosure and evidence-based engineering. This library states them as patterns with a check for each.

## Where These Patterns Come From

In this project's own experience, the patterns were extracted from a [Telegram trading bot](docs/references/reference-telegram-trading-bot-case-study.md): a private application by this library's author that moves funds on blockchains (its tests run on testnets), developed with Claude Code as the primary development tool. That project developed **Stack-First Development**: bringing up the entire application stack in Docker and testing through API endpoints only, where each stack test is an atomic user journey that passes or fails as a whole. It is one project with no independent replication.

Disclosure: the author of this library also built rig, from these patterns. rig demonstrates the patterns. It does not independently validate them.

### Reference Implementations

[rig](https://github.com/franklywatson/claude-rig) is a guardrails framework built on the L2 to L4 patterns, with L3 tool routing and a token-optimized scout agent; it installs with `rig init`. [superpowers](https://github.com/obra/superpowers) provides L2 base skills (brainstorming, TDD, verification, review) and worktree management. Both install hooks, skills and commands that run with your agent's privileges. Read and pin before installing ([Pattern 2.12](docs/L2-behavioral-guardrails.md#pattern-212--skill-plugin-and-mcp-supply-chain)).

## Contributing

Contributions are welcome:

- **New patterns** that extend or challenge the existing framework
- **Real-world examples** from different domains (the examples cover stack tests, incident repair, containment and earned autonomy)
- **Corrections** when a pattern doesn't match your experience — document the exception
- **Translations** of concepts to other frameworks and tools

## Background and Further Reading

- [Reference Telegram Trading Bot Case Study](docs/references/reference-telegram-trading-bot-case-study.md) — the reference project these patterns were extracted from
- [FAQ](docs/cross-cutting/faq.md) — deployment, operations, and other SDLC concerns beyond the patterns
- [Further Reading](docs/references/further-reading.md) — articles, videos, and tools that informed this work
- [Glossary](docs/cross-cutting/glossary.md) — terminology reference
