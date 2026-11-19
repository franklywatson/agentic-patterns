# Agentic Patterns

Patterns and runnable examples for letting AI coding agents change a codebase safely: how to structure a project so
an agent can find its way, how the agent proves a change works, where each rule is enforced, and how far one
workflow may run without a person. For developers and teams using Claude Code or a similar agent harness. Adopt the
patterns where your gaps are.

## Start Here

| You are | Read first | First action |
|---------|-----------|--------------|
| A developer who wants safer agent sessions this week | [Pattern 2.9](docs/L2-behavioral-guardrails.md#pattern-29--contain-before-you-relax) | Put the keys from the [containment binding](examples/containment/claude-code/settings.json) where the agent cannot edit them ([FAQ: where the settings file goes](docs/cross-cutting/faq.md#i-work-alone-where-does-the-sandbox-settings-file-go)), keep credentials out, and run one command that must fail (optional: the [containment example](examples/containment/README.md) shows a hook policy missing eight of nine writes). If your tests need Docker: [FAQ: Docker in the sandbox](docs/cross-cutting/faq.md#my-stack-tests-need-docker-how-do-i-run-them-inside-the-sandbox). Then follow [Path E](docs/cross-cutting/adoption-guide.md#path-e-one-person-attended-sessions) |
| A lead deciding how far agents may run | [Earned Autonomy: the curve and the cap](docs/earned-autonomy.md#the-curve-and-the-cap), [threat model](docs/cross-cutting/threat-model.md) | Run the example census at the root of one repository (needs Node 22 and a clone of this repository) and read the failed probes per dimension; the cap stays C1 until the repository has the files in [Reaching C2](docs/earned-autonomy.md#reaching-c2) |
| A maintainer adding agents to an existing repository with CI | [Pattern 0.4](docs/L0-foundation.md#pattern-04--agent-instruction-file-as-project-constitution), [Pattern 4.1](docs/L4-standards-measurement.md#pattern-41--evidence-based-claims), [Pattern 4.5](docs/L4-standards-measurement.md#pattern-45--ci-guardrails) | Write a short AGENTS.md with an enforcement point per rule, and make the test job a required check ([how to](docs/cross-cutting/adoption-guide.md#make-the-test-job-a-required-check)) |
| Not sure where the gaps are | [Adoption Guide assessment](docs/cross-cutting/adoption-guide.md#assessment-where-are-you-now) | Pick a path |

## How the Scales Fit Together

Four scales, each answering one question:

| Scale | Values | Unit | Question |
|-------|--------|------|----------|
| Layer | L0 to L4 | Pattern group | What do we build? |
| Enforcement point | prompt, hook, CI, sandbox, downstream | Rule | Where does this rule hold? |
| Risk tier | low, medium, high, from reversibility (R0-R4) and reach (B0-B3) | Change | How much review does this change get? |
| Grant, capped by the curve | A1 to A5, capped at C1 to C5 | Workflow, capped per repository | May this workflow act with no person? |

The layers make work checkable; they are not a maturity scale, and finishing them grants nothing. The risk tier sets review: below A4 a person merges every change, and the approvals each tier needs are stated once in [Pattern 2.13](docs/L2-behavioral-guardrails.md#pattern-213--risk-tiered-review). The grant decides whether anyone merges at all. A1: the agent reads and suggests. A2: it edits and commits, and a person pushes and opens the pull request. A3: it pushes branches and opens pull requests, and a person merges after required checks. A4: it acts on an event or schedule with an owner, limits, an audit record and a tested stop, and merges with no person only low-tier changes (R0-R1 at B0) that are reversible and mechanically verified ([risk model](docs/L1-patterns/1.8-reversibility-blast-radius.md#risk-model)). A5: A4 managed as an investment, with a baseline, a target, a review date and a stop rule.

Grants bind only when you adopt them: a register (`.autonomy.yaml`), the census and `autonomy check` in CI. The census places one repository, read at its root, on seven dimensions; the cap is the lowest of four (platform, security and governance, production ownership, measuring value), and no grant may exceed it. It measures adoption of this library's files and wording, not governance in general ([Pattern A.4](docs/earned-autonomy.md#pattern-a4--census)). A repository that has adopted neither the register nor the artifacts the probes look for reads C1, which allows only A1. [Reaching C2](docs/earned-autonomy.md#reaching-c2) lists the four files that allow A2, and [Pattern 4.4](docs/L4-standards-measurement.md#pattern-44--agentic-development-metrics) shows the baseline C3 needs. This repository's own register is at cap C1 while its sub-agents edit files, which needs A2; the violation is recorded, not enforced ([Applied to This Repository](docs/earned-autonomy.md#applied-to-this-repository)). One person working alone does not need the register: see [Path E](docs/cross-cutting/adoption-guide.md#path-e-one-person-attended-sessions).

## The Pattern Layers

The library has five layers, L0 to L4. A layer is a group of patterns that depend on the layers below it: L1 verification needs the navigable structure of L0, and L2 enforcement needs the checks of L1. L3 is optional and sits beside the path to L4. The layers are not a maturity scale: finishing L4 does not make a team ready for work with no person watching each step. Adoption starts where your gaps are; when unsure, the [adoption guide](docs/cross-cutting/adoption-guide.md) starts at L0. Pattern numbers are stable identifiers and are not contiguous.

### Layer Overviews

**[L0: Foundation](docs/L0-foundation.md)** — Structure your codebase so an AI with zero prior context can navigate, understand, and contribute. Deep modules, progressive disclosure, an agent instruction file (AGENTS.md) as project constitution, unit tests as contract, documentation as system map, and aggressive cleanup. The "can a new starter figure this out?" test.

**[L1: Closed Loop Design and Verification](docs/L1-feedback-loops.md)** — How an agent proves its own change works. Stack tests run the whole application in Docker with real dependencies and assert on each journey's effects; tests that can pass silently are forbidden. Patterns 1.7 to 1.12 extend the loop to incidents in code you own.

**[L2: Behavioral Guardrails](docs/L2-behavioral-guardrails.md)** — Enforcement points stack. Prose is guidance. Command hooks are deterministic policy inside the harness. Containment and credentials are the boundary. Skills are prompt-level and guarantee nothing. Name the enforcement point for every constitutional rule. Skills overlay project rules on base agent capabilities; the skill chain is optional and scales with risk.

**[L3: Optimization (optional)](docs/L3-optimization.md)** — Reduces tokens spent on exploration and tool output. It is not on the path to verified or unattended work. Covers preferring native structured tools, blocking destructive shell edits, and context isolation with a scout sub-agent (from the WISC framework).

**[L4: Standards & Measurement](docs/L4-standards-measurement.md)** — Evidence-based claims, development metrics, CI guardrails, context eval, ownership of agent-written code and the team's skill to supervise. Measures whether the other layers hold and what they change.

## What's in This Repo

```text
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

The TypeScript stack-test example extends to browser-based testing with Playwright; the Python example demonstrates API-level testing with pytest.

## What This Library Does Not Cover

- **Production ownership, in part.** [Pattern 4.7](docs/L4-standards-measurement.md#pattern-47--author-of-record-and-agent-register) names an author of record and an agent register with sponsor, expiry and stop authority. [Pattern A.5](docs/earned-autonomy.md#pattern-a5--tested-stop) and the stop drill rehearse the stop. Not covered: running and repairing agent-built software in production, including on-call and rollback, deployment pipelines, feature-flag services and production telemetry. The [FAQ](docs/cross-cutting/faq.md#what-passes-between-the-application-and-operations) defines the contract between the application and operations.
- **Comparing outcomes against a baseline.** [Pattern 4.4](docs/L4-standards-measurement.md#pattern-44--agentic-development-metrics) shows the baseline file the census reads. L4 does not describe how to compare against it after adopting a pattern.
- **Data handling, audit retention and incident response.** Security and governance is otherwise covered by [Patterns 2.9 to 2.13](docs/L2-behavioral-guardrails.md#pattern-29--contain-before-you-relax), the [threat model](docs/cross-cutting/threat-model.md) and [Patterns 4.7 and 4.9](docs/L4-standards-measurement.md#pattern-47--author-of-record-and-agent-register).
- **Docker stack tests inside the sandbox.** Pattern 2.9 states that `docker` does not run in the sandbox; the [FAQ](docs/cross-cutting/faq.md#my-stack-tests-need-docker-how-do-i-run-them-inside-the-sandbox) compares three options, and no example shows a session inside a container or virtual machine with its own daemon.
- **Monorepos.** The examples assume one repository with one register, and the census computes one cap per repository, not per package. The [adoption guide](docs/cross-cutting/adoption-guide.md#make-the-test-job-a-required-check) and the [FAQ](docs/cross-cutting/faq.md#monorepo-or-multi-repo-for-agents) cover required checks and instruction files.

Covered: the development-time loop (L0 to L4) and the seam where production incidents enter it. [Patterns 1.7 to 1.12](docs/L1-feedback-loops.md#closing-the-loop-in-production) define the incident record, reproduction, classification, gate, limits and stop for repairing owned code, with a runnable gate in [examples/repair-loop](examples/repair-loop/README.md). Unattended repair of data-forward or irreversible changes is not supported at any grant.

## Origin and Disclosure

An agent starts each session with no memory of the codebase. It needs a test that passes or fails and says where, context it can find one step at a time, rules held by something other than its attention, and an environment that gives the same result every run. The ideas are established: Ousterhout's deep modules, Matt Pocock's graybox modules, progressive disclosure and evidence-based engineering. This library states them as patterns with a check for each.

In this project's own experience, the patterns were extracted from a [Telegram trading bot](docs/references/reference-telegram-trading-bot-case-study.md): a private application by this library's author that moves funds on blockchains (its tests run on testnets), developed with Claude Code. That project developed **Stack-First Development**: the entire application stack in Docker, tested through API endpoints only, each stack test an atomic user journey. It is one project with no independent replication.

The author also built [rig](https://github.com/franklywatson/claude-rig), a guardrails framework on the L2 to L4 patterns with L3 tool routing; [superpowers](https://github.com/obra/superpowers) provides L2 base skills. rig demonstrates the patterns; it does not independently validate them. Both install hooks, skills and commands that run with your agent's privileges: read and pin before installing ([Pattern 2.12](docs/L2-behavioral-guardrails.md#pattern-212--skill-plugin-and-mcp-supply-chain)).

## Contributing

Contributions are welcome:

- **New patterns** that extend or challenge the existing framework
- **Real-world examples** from different domains (the examples cover stack tests, incident repair, containment and earned autonomy)
- **Corrections** when a pattern doesn't match your experience — document the exception
- **Bindings** for other harnesses (the contract in each L2 pattern's Bindings section)

## Background and Further Reading

- [Reference Telegram Trading Bot Case Study](docs/references/reference-telegram-trading-bot-case-study.md) — the reference project these patterns were extracted from
- [FAQ](docs/cross-cutting/faq.md) — deployment, operations, and other SDLC concerns beyond the patterns
- [Further Reading](docs/references/further-reading.md) — articles, videos, and tools that informed this work
- [Glossary](docs/cross-cutting/glossary.md) — terminology reference
