# Agentic Patterns

Patterns and runnable examples for letting AI coding agents change a codebase safely: how to structure a project so
an agent can find its way, how the agent proves a change works, where each rule is enforced, and how far one
workflow may run without a person. For developers and teams using Claude Code or a similar agent harness. Adopt the
patterns where your gaps are.

## Start Here

| You are | Read first | First action |
|---------|-----------|--------------|
| A developer who wants safer agent sessions this week | [FAQ: I work alone](docs/cross-cutting/faq.md#i-work-alone-where-does-the-sandbox-settings-file-go), [Pattern 2.9](docs/L2-behavioral-guardrails.md#pattern-29--contain-before-you-relax) | Copy the keys in the [containment binding](examples/containment/README.md#claude-code-binding) into user or managed settings and add your package registries to `allowedDomains`. Ask the agent to run `touch ~/outside-tree` and `curl -sI https://example.com`; both must fail. Docker stack tests: [FAQ](docs/cross-cutting/faq.md#my-stack-tests-need-docker-how-do-i-run-them-inside-the-sandbox). Then [Path E](docs/cross-cutting/adoption-guide.md#path-e-one-person-attended-sessions) |
| A lead deciding how far agents may run | [Path D](docs/cross-cutting/adoption-guide.md#path-d-containment-first-teams-moving-to-unattended-work), [The Curve and the Cap](docs/earned-autonomy.md#the-curve-and-the-cap), [threat model](docs/cross-cutting/threat-model.md) | Deliver the sandbox keys to every machine through managed settings ([Pattern 2.9](docs/L2-behavioral-guardrails.md#pattern-29--contain-before-you-relax)). Then [run the census](examples/autonomy/README.md#run-against-your-own-repository) on one repository with `--json` and read `missing_for_next` per dimension. A repository without this library's files reads C1 |
| A maintainer adding agents to a repository or monorepo with CI | [Pattern 0.4](docs/L0-foundation.md#pattern-04--agent-instruction-file-as-project-constitution), [Pattern 4.5](docs/L4-standards-measurement.md#pattern-45--ci-guardrails), [FAQ: monorepo](docs/cross-cutting/faq.md#monorepo-or-multi-repo-for-agents) | Write a short root AGENTS.md with an owner, a reviewed date and an enforcement point per rule; import it from CLAUDE.md with `@AGENTS.md`; make one unfiltered `tests` job a required check ([how to](docs/cross-cutting/adoption-guide.md#make-the-test-job-a-required-check)) |
| Not sure where the gaps are | [Adoption Guide assessment](docs/cross-cutting/adoption-guide.md#assessment-where-are-you-now) | Pick a path |

## How the Scales Fit Together

Four scales, each answering one question:

| Scale | Values | Applies to | Question | Defined in |
|-------|--------|-----------|----------|------------|
| Layer | L0 to L4 | Pattern group | What do we build? | [The Pattern Layers](#the-pattern-layers) |
| Enforcement point | prompt, hook, CI, sandbox, downstream | Rule | Where does this rule hold? | [L2](docs/L2-behavioral-guardrails.md) |
| Review tier | low, medium, high, from reversibility (R0-R4) and blast radius (B0-B3) | Change | Who must approve it? | [Risk model](docs/L1-patterns/1.8-reversibility-blast-radius.md#risk-model) |
| Grant, capped by the curve | A1 to A5, capped at C1 to C5 | Workflow, capped per repository | May this workflow act with no person? | [The Grants](docs/earned-autonomy.md#the-grants), [The Curve and the Cap](docs/earned-autonomy.md#the-curve-and-the-cap) |

A grant belongs to one workflow:

| Grant | The agent may | A person still | Needs cap |
|-------|---------------|----------------|-----------|
| A1 | Read and suggest | Applies every change | none |
| A2 | Edit and commit | Pushes, opens the pull request, merges | C2 |
| A3 | Push branches and open pull requests | Merges after required checks | C3 |
| A4 | Act on an event or schedule; merge R0-R1 changes at B0 | Merges every other change; owns the tested stop | C4 |
| A5 | A4, plus R2 at B0 on named paths, managed against a baseline, target, review date and stop rule | Decides at each review | C5 |

A change's review tier sets who approves it before a person merges. This table is the one statement of approvals;
the classes are defined in the [risk model](docs/L1-patterns/1.8-reversibility-blast-radius.md#risk-model).
"Low tier" is R0-R1 at B0 and R2 at B0; the latter merges unattended only at A5 on named paths.

| Class | Review tier | Approvals before a person merges | Merges with no person |
|-------|-------------|----------------------------------|-----------------------|
| R0-R1 at B0 | Low | One, not the requester | At A4 and A5, on required checks |
| R2 at B0 | Low | One, not the requester | At A5, on named paths only |
| R0-R2 at B1 or B2 | Medium | One, not the requester | Never |
| R3 or R4 at any reach, or any class at B3 | High | A code owner plus a second, neither the requester | Never |

Below A4 every tier needs an approval from someone other than the requester, so one person working alone meets none
of them ([Pattern 2.13](docs/L2-behavioral-guardrails.md#pattern-213--risk-tiered-review);
[Path E](docs/cross-cutting/adoption-guide.md#path-e-one-person-attended-sessions)). Instruction and tool
configuration files (`CLAUDE.md`, `AGENTS.md`, `.claude/` agents, commands and skills, `.mcp.json`) are medium tier.

The layers make work checkable; finishing them grants nothing. The cap is the lowest of four census dimensions
(platform, security and governance, production ownership, measuring value), and no grant may exceed it. A repository
without this library's files reads C1, which allows only A1. [Reaching C2](docs/earned-autonomy.md#reaching-c2)
lists the four files that allow A2; A3 needs C3, whose probes are explained in [Pattern
A.4](docs/earned-autonomy.md#pattern-a4--census) and [Pattern 4.4](docs/L4-standards-measurement.md#pattern-44--agentic-development-metrics).
The census measures adoption of this library's files and wording, not governance in general.

Grants bind only where you adopt the register (`.autonomy.yaml`) and make `autonomy check` a required check. The
hook's Bash rules are a nudge; the boundary is the tools allow-list, CODEOWNERS, `autonomy check` in CI and
containment. This repository's own register records A1, within its cap of C1, but the subagents that work on it push
branches and open pull requests, which is A3 and needs C3. No hook is bound here and `autonomy check` compares
recorded grants with the cap, not actions with the grant, so nothing stops them ([Applied to This
Repository](docs/earned-autonomy.md#applied-to-this-repository)). One person working alone can skip the register
([Path E](docs/cross-cutting/adoption-guide.md#path-e-one-person-attended-sessions)).

## The Pattern Layers

A layer is a group of patterns that depend on the layers below it: L1 verification needs the navigable structure of L0, and L2 enforcement needs the checks of L1. L3 is optional and sits beside the path to L4. Adoption starts where your gaps are; when unsure, the [adoption guide](docs/cross-cutting/adoption-guide.md) starts at L0. Pattern numbers are stable identifiers and are not contiguous.

### Layer Overviews

**[L0: Foundation](docs/L0-foundation.md)** — Structure the codebase so an AI with zero prior context can navigate it: deep modules, progressive disclosure, an agent instruction file (AGENTS.md) as project constitution, unit tests as contract, documentation as system map and aggressive cleanup.

**[L1: Closed Loop Design and Verification](docs/L1-feedback-loops.md)** — How an agent proves its own change works. Stack tests run the whole application in Docker with real dependencies and assert on each journey's effects; tests that can pass silently are forbidden. Patterns 1.7 to 1.12 extend the loop to incidents in code you own.

**[L2: Behavioral Guardrails](docs/L2-behavioral-guardrails.md)** — Enforcement points stack. Prose is guidance, command hooks are deterministic policy inside the harness, containment and credentials are the boundary, and skills guarantee nothing. Name the enforcement point for every constitutional rule.

**[L3: Optimization (optional)](docs/L3-optimization.md)** — Reduces tokens spent on exploration and tool output: native structured tools, blocking destructive shell edits and context isolation with a scout sub-agent (from the WISC framework). It is not on the path to verified or unattended work.

**[L4: Standards & Measurement](docs/L4-standards-measurement.md)** — Evidence-based claims, development metrics, CI guardrails, context eval, ownership of agent-written code and the team's skill to supervise.

## What's in This Repo

```text
docs/                 # Pattern documentation (layers L0-L4), Earned Autonomy and guides
  cross-cutting/      # Anti-patterns, adoption guide, threat model, FAQ, glossary
  references/         # Case study, further reading, sources, task bank
  diagrams/           # Diagrams for the L1 docs and the guardrails example
examples/             # Working code (TypeScript and Python for core patterns; L3 is TypeScript only)
  stack-test/         # Pattern 1.1: Docker stack tests (typescript/ with Playwright, python/ with pytest)
  repair-loop/        # Patterns 1.7-1.11: incident to reproduction to gate decision, no LLM (TypeScript and Python)
  containment/        # Pattern 2.9: policy layer vs container boundary, with tests (TypeScript and Python)
  autonomy/           # Patterns A.1-A.6: register check, census, ledger, stop drill, hook (TypeScript and Python)
  guardrails/         # Pattern 3.1: optional token-optimization middleware (TypeScript only)
  project-structure/  # L0: before and after directory layouts (documentation only)
```

## What This Library Does Not Cover

- **Production ownership, in part.** [Pattern 4.7](docs/L4-standards-measurement.md#pattern-47--author-of-record) names an author of record and an agent register, and [Pattern A.5](docs/earned-autonomy.md#pattern-a5--tested-stop) rehearses the stop. Not covered: on-call, rollback, deployment pipelines, feature-flag services and production telemetry; the [FAQ](docs/cross-cutting/faq.md#what-passes-between-the-application-and-operations) defines the contract with operations.
- **Comparing outcomes against a baseline.** [Pattern 4.4](docs/L4-standards-measurement.md#pattern-44--agentic-development-metrics) shows the baseline file the census reads, not how to compare against it.
- **Data handling, audit retention and incident response.** The rest of security and governance is in [Patterns 2.9 to 2.13](docs/L2-behavioral-guardrails.md#pattern-29--contain-before-you-relax) and the [threat model](docs/cross-cutting/threat-model.md).
- **Docker stack tests inside the sandbox.** The [FAQ](docs/cross-cutting/faq.md#my-stack-tests-need-docker-how-do-i-run-them-inside-the-sandbox) compares three options; no example shows a session in a container or virtual machine with its own daemon.
- **Monorepos.** The census computes one cap per repository, not per package ([FAQ](docs/cross-cutting/faq.md#monorepo-or-multi-repo-for-agents)).

Covered: the development-time loop (L0 to L4) and the seam where production incidents enter it. [Patterns 1.7 to 1.12](docs/L1-feedback-loops.md#closing-the-loop-in-production) define repair of owned code, with a runnable gate in [examples/repair-loop](examples/repair-loop/README.md). Unattended repair of data-forward or irreversible changes is not supported at any grant.

## Origin and Disclosure

An agent starts each session with no memory of the codebase. It needs tests that say where they fail, context it can find one step at a time, rules held by something other than its attention, and a repeatable environment. The ideas are established (Ousterhout's deep modules, Matt Pocock's graybox modules, progressive disclosure, evidence-based engineering); this library states them as patterns with a check for each.

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
