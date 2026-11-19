---
last-validated-model: claude-sonnet-5-5
reviewed: 2026-11-19
---

# Adoption Guide — Paths to Agentic Development

Suggested approaches for teams adopting agentic development patterns incrementally. The paths are this library's
design suggestions, not a rigid plan and not a record of what other teams did.

**Core principle:** The layers are not a maturity scale. Start where your gaps are and adopt what helps. L0
Foundation alone gives agents a navigable structure and a documented entry point (evidence: first-party experience,
no controlled comparison). Finishing L4 does not make a team ready for unattended work: that depends on the curve and
the cap described in [How far to let go](#how-far-to-let-go).

---

## Assessment: Where Are You Now?

Before choosing a path, assess your current state. For a repository with an `.autonomy.yaml` register, run
the example CLI `autonomy census` ([examples/autonomy](../../examples/autonomy/README.md)) first, with `--dir` set to
your repository. It computes the platform, governance, ownership and measuring positions from the repository's own
files, treats a dimension with no evidence as C1 (only `skill` can be `unknown`, counted as C2), and lists what is
missing for the next position ([Pattern A.4](../earned-autonomy.md#pattern-a4--census)). The checklist below covers what a census cannot read and is
the starting point when there is no register yet.

### Entry Points

- [ ] An agent instruction file (AGENTS.md, imported by CLAUDE.md) exists, has a named owner and a reviewed date, and is short enough that every line earns its place
- [ ] README.md clearly explains what the project does
- [ ] The instruction file links to all relevant documentation
- [ ] File structure is grouped by domain, not layer

### Testing

- [ ] Stack tests and E2E/integration tests use real components (no mocks for owned services)
- [ ] Complex external dependencies have focused integration tests against real testnet/sandbox
- [ ] Tests run in isolated environments (no shared state)
- [ ] Test failures provide clear diagnostic signals
- [ ] Tests assert on side effects, not just responses

### Documentation

- [ ] Every pattern is documented with examples
- [ ] Code examples in docs match current codebase
- [ ] Documentation is linked from the agent instruction file (AGENTS.md)
- [ ] No orphaned docs (all reachable from the master index)

### Tooling

- [ ] Git worktrees are used for feature branches
- [ ] Linting/formatting is automated
- [ ] Pre-commit hooks enforce basic rules
- [ ] CI runs tests in isolated environments

### Containment and governance

Check this block before any team moves from attended work (a person watches each step) to unattended work.

- [ ] The agent runs inside a sandbox or container that confines writes and network, and the setting is locked
  ([Pattern 2.9](../L2-behavioral-guardrails.md#pattern-29--contain-before-you-relax))
- [ ] Credentials are outside the agent's environment, short-lived and scoped ([Pattern
  2.11](../L2-behavioral-guardrails.md#pattern-211--agent-identity-and-delegation))
- [ ] No session holds untrusted input, sensitive access and external action together without a gate ([Pattern
  2.10](../L2-behavioral-guardrails.md#pattern-210--least-agency-and-session-composition))
- [ ] Installed skills, plugins and MCP servers are on an allowlist, pinned and read ([Pattern
  2.12](../L2-behavioral-guardrails.md#pattern-212--skill-plugin-and-mcp-supply-chain))
- [ ] A written high-tier list names the actions that need a second human, and the requester cannot approve
  ([Pattern 2.13](../L2-behavioral-guardrails.md#pattern-213--risk-tiered-review))
- [ ] Every agent-written change has an author of record, and every agent has an owner in a register ([Pattern
  4.7](../L4-standards-measurement.md#pattern-47--author-of-record-and-agent-register))
- [ ] Completion evidence comes from CI, not from the agent's message ([Pattern
  4.1](../L4-standards-measurement.md#pattern-41--evidence-based-claims))
- [ ] The team can supervise without the agent: the work sample passes ([Pattern
  4.9](../L4-standards-measurement.md#pattern-49--deliberate-practice))

The [threat model](threat-model.md) lists what each control protects.

### The New Starter Test

The ultimate assessment: give someone (or an agent) with zero context your AGENTS.md + README + file structure. Can they answer these questions without asking for help?

1. What does this project do?
2. How do I run it locally?
3. Where do I add a new feature?
4. What patterns should I follow?
5. How do I test my changes?
6. What must I never do?

Document every assumption they had to make. Each assumption is a gap.

### Gap Identification by Layer

| Layer | Focus | Common Gaps | Quick Win |
|-------|-------|-------------|-----------|
| **L0 Foundation** | Structure, AGENTS.md, doc freshness, cleanup | No AGENTS.md, technical-layer organization, stale docs | Write AGENTS.md, restructure by domain |
| **L1 Closed Loop Design** | Design-led verification with stack tests and focused integration tests | No stack tests, shallow assertions, no edge-case coverage for complex external deps | Add app-startup stack test |
| **L2 Guardrails** | Skills, hooks, behavioral rules | Rules only in prose, agents make common errors | Move the most violated rule into a hook or CI check |
| **L3 Optimization (optional)** | Native structured tools, context isolation | Raw grep/cat commands, token waste | Route grep and cat to native tools |
| **L4 Standards & Measurement** | Evidence, metrics, CI guardrails, context eval | Claims without evidence, no outcome metrics | Establish evidence standard |

---

## Adoption Paths

Five suggested paths. Choose based on your situation.

### Path A: Foundation-First (Default When Unsure)

Start with L0: structure and AGENTS.md cost little and later layers depend on them (first-party experience; no
study compares layers). Then build upward.

1. **L0 Foundation** — Restructure by domain, write AGENTS.md, establish doc freshness and cleanup practices. See [L0-foundation.md](../L0-foundation.md).
2. **L1 Closed Loop Design** — Add stack tests for your most critical user journeys. See [L1-feedback-loops.md](../L1-feedback-loops.md) and the working examples in [examples/stack-test/](../../examples/stack-test/).
3. **L2 Guardrails** — Add skills and hooks for your project's most common errors. See [L2-behavioral-guardrails.md](../L2-behavioral-guardrails.md).
4. **L3 Optimization (optional)** — Reduce token spend with structured tools and context isolation, when token cost is a measured problem. See [L3-optimization.md](../L3-optimization.md) and the working example in [examples/guardrails/](../../examples/guardrails/).
5. **L4 Standards & Measurement** — Add metrics, CI guardrails, and context eval once the earlier layers are in place. Drift detection and the new-starter audit are in [Pattern 0.7](../L0-foundation.md#pattern-07--documentation-as-system-map) and [Pattern 0.9](../L0-foundation.md#pattern-09--ai-as-new-starter-standard). See [L4-standards-measurement.md](../L4-standards-measurement.md).

### Path B: Testing-First (Teams with Testing Gaps)

If your testing is the biggest pain point — no stack tests, shallow assertions, or missing edge-case coverage for external dependencies — start at L1.

1. **L1** — Ensure that there exists a stack test to cover all user journeys, avoiding duplicated testing as much as possible. For complex external dependencies (payment processors, blockchain RPCs), add focused integration tests against real testnet/sandbox. See [Pattern 1.1 — Stack Tests](../L1-patterns/1.1-stack-tests.md), [Pattern 1.5 — Real Dependencies](../L1-patterns/1.5-real-dependencies.md), and [examples/stack-test/](../../examples/stack-test/).
2. **L0** — Once stack tests are working, structure the project to make them maintainable. Deep modules, AGENTS.md, progressive disclosure.
3. **L2-L4** — Continue upward as in Path A.

### Path C: Guardrails-First (Teams with Agent Errors)

If agents are making consistent errors (missing tests, ignoring rules, skipping verification), start at L2.

1. **L2** — Add skills for your most violated rules, hooks to block destructive patterns. See [L2-behavioral-guardrails.md](../L2-behavioral-guardrails.md).
2. **L0** — Structure the project so agents have clear context to work with.
3. **L1, L3-L4** — Fill in remaining layers as capacity allows.

### Path D: Containment-First (Teams Moving to Unattended Work)

If agents will run without a person watching each step, or already hold shell access, keys and network on
developer machines, start with containment. Do not loosen approvals first.

1. **Contain** — Put the agent in a locked, fail-closed boundary and move credentials outside it. See [Pattern
   2.9](../L2-behavioral-guardrails.md#pattern-29--contain-before-you-relax) and the [containment
   example](../../examples/containment/).
2. **Compose sessions** — Decide which sessions hold untrusted input, sensitive access and external action, and
   split any that hold all three. See [Pattern
   2.10](../L2-behavioral-guardrails.md#pattern-210--least-agency-and-session-composition).
3. **Vet dependencies and tier review** — Allowlist and pin skills, plugins and servers. Write the high-tier
   list. See [Pattern 2.12](../L2-behavioral-guardrails.md#pattern-212--skill-plugin-and-mcp-supply-chain) and
   [Pattern 2.13](../L2-behavioral-guardrails.md#pattern-213--risk-tiered-review).
4. **Name owners** — Name an author of record and start the register, `.autonomy.yaml`. See [Pattern
   4.7](../L4-standards-measurement.md#pattern-47--author-of-record-and-agent-register).
5. **Then** continue with L1 and L2 as in Path A. Check the [Containment and governance
   block](#containment-and-governance) before each step toward unattended work.

### Path E: One Person, Attended Sessions

If one person watches each step, start with containment and a short instruction file: [Pattern
2.9](../L2-behavioral-guardrails.md#pattern-29--contain-before-you-relax) (sandbox and credentials), [Pattern
0.4](../L0-foundation.md#pattern-04--agent-instruction-file-as-project-constitution) (a short AGENTS.md) and [Pattern
1.6](../L1-patterns/1.6-test-integrity.md) (test integrity in CI). Rules that need a second person (the high tier of
Pattern 2.13, the approver in Pattern 4.7) cannot be met. Keep every workflow at A1 or A2 and do not enable
auto-merge.

---

## How Far to Let Go

Layers say what to build. Two other scales say how far a team may let agents run, and they are separate from L0-L4
(definitions in [Earned Autonomy](../earned-autonomy.md#the-curve-and-the-cap)).

- **The curve, C1 to C5,** places a team on each of seven dimensions. Four dimensions cap unattended work: platform,
  security and governance, production ownership and measuring value. The cap is the lowest of those four, and no
  workflow grant may exceed it.
- **Grants, A1 to A5,** are what one named workflow may do: suggest, open pull requests, pass checks before a human
  merges, act on events within limits, and run as a managed investment.

The cap comes from the team's own census, not from the library
([The Curve and the Cap](../earned-autonomy.md#the-curve-and-the-cap)). A team that adopts only this library is held
back by measuring value: C3 needs a committed baseline file, and the library does not describe how to build one
([README](../../README.md#what-this-library-does-not-cover)). Until a baseline exists the practical ceiling is C2 and
the grant A2. A team that wants A3 or A4 closes the capping dimension that `autonomy census` reports as lowest, then promotes workflows one grant at a time on evidence
([Pattern A.3](../earned-autonomy.md#pattern-a3--promotion-demotion-and-the-cap-gate)).

Repair of owned code in production is the one unattended-work seam this library defines in detail: [Patterns 1.7
to 1.12](../L1-feedback-loops.md#closing-the-loop-in-production) with the runnable gate in
[examples/repair-loop](../../examples/repair-loop/README.md). Adopt it after stack tests exist for the journeys it
covers and after the containment block above passes. It does not lift the cap.

---

## What to Read for Each Layer

The pattern docs contain the detailed guidance. This guide links to them rather than duplicating content.

| Layer | Start With | Working Example |
|-------|-----------|-----------------|
| L0 | [L0-foundation.md](../L0-foundation.md) — Deep modules, AGENTS.md, progressive disclosure | [examples/project-structure/](../../examples/project-structure/) |
| L1 | [L1-feedback-loops.md](../L1-feedback-loops.md) — Context harvesting, stack tests, full-loop assertions | [examples/stack-test/typescript/](../../examples/stack-test/typescript/) or [examples/stack-test/python/](../../examples/stack-test/python/) |
| L2 | [L2-behavioral-guardrails.md](../L2-behavioral-guardrails.md) — Skills, hooks, constitutional rules | [superpowers](https://github.com/obra/superpowers) or [rig](https://github.com/franklywatson/claude-rig) |
| L3 | [L3-optimization.md](../L3-optimization.md) — Native structured tools, context isolation | [examples/guardrails/](../../examples/guardrails/) |
| L4 | [L4-standards-measurement.md](../L4-standards-measurement.md) — Evidence, metrics, CI guardrails, context eval | [examples/autonomy/](../../examples/autonomy/README.md) (register, census, ledger, stop drill) |
| Repair loop (1.7-1.11) | [1.9 Repair loop](../L1-patterns/1.9-repair-loop-frozen-oracle.md) | [examples/repair-loop/](../../examples/repair-loop/README.md) |

### Readiness for A3 and A4

A workflow is ready for A3 (gated) when its journey has a stack test, required checks run in CI, a named owner exists, the sandbox is locked and the cap is C3 or higher. It is ready for A4 (unattended) only when verification is mechanical, the action is reversible, the cap is C4 or higher, and a stop drill has passed within 30 days. A3 and A4 both need the cap, so the capping dimensions come first. See [Earned Autonomy](../earned-autonomy.md#prerequisites-by-grant).

### Reference Implementations

| System | What it implements | Language |
|--------|-------------------|----------|
| [rig](https://github.com/franklywatson/claude-rig) | L2 enforcement pipeline, L3 tool routing + token-optimized scout agent, L4 context eval, skill chain with phase transitions, CI guardrails | TypeScript |
| [superpowers](https://github.com/obra/superpowers) | L2 base skills (brainstorming, TDD, verification, review), worktree management | Markdown/JS |

Each of these installs code or instructions that run with the agent's privileges. Read and pin before
installing ([Pattern 2.12](../L2-behavioral-guardrails.md#pattern-212--skill-plugin-and-mcp-supply-chain)).

---

## Key Success Factors

1. **Incremental adoption** — Each layer delivers value independently. Don't try to implement everything at once.
2. **Start with L0 if unsure** — Structure and AGENTS.md cost little and the later layers depend on them (evidence: first-party experience, not a measured ROI).
3. **Measure before you loosen** — Run the example `autonomy census` and read the cap before raising any grant.
4. **Update docs in the same task as code** — Deferred documentation is stale documentation. See [Pattern 0.7 — Documentation as System Map](../L0-foundation.md#pattern-07--documentation-as-system-map).
5. **Remove dead code as you find it** — Cleanup is continuous, not periodic. See [Pattern 0.8 — Aggressive Cleanup](../L0-foundation.md#pattern-08--aggressive-cleanup).
6. **Use the New Starter Test regularly** — It catches gaps that code review misses. See [Pattern 0.9 — AI-as-New-Starter Standard](../L0-foundation.md#pattern-09--ai-as-new-starter-standard).
7. **Re-baseline at each model upgrade** — Run a fixed task bank without each skill, hook and rule, and delete what no
   task needs. See [Pattern 0.10 — Prune and Re-baseline
   Context](../L0-foundation.md#pattern-010--prune-and-re-baseline-context).

### Common Pitfalls

- **Skipping assessment** — Without understanding your gaps, you may optimize the wrong things.
- **Deferring documentation** — "I'll update the docs later" means the docs stay stale.
- **Allowing constitutional rule exceptions** — Rules that bend become suggestions, and suggestions erode.
- **Only adding configuration** — Rules, skills and hooks added for an older model stay in place and are never tested
  for need. Name an owner and a review date for each and delete first at each model upgrade.
- **Treating cleanup as a quarterly sprint** — Dead code is noise. Remove it as you encounter it.

---

## Further Reading

- [L0 Foundation](../L0-foundation.md) — Project structure patterns
- [L1 Closed Loop Design](../L1-feedback-loops.md) — Design-led verification
- [L2 Behavioral Guardrails](../L2-behavioral-guardrails.md) — Skills and hooks
- [L3 Optimization](../L3-optimization.md) — Optional token efficiency
- [L4 Standards & Measurement](../L4-standards-measurement.md) — Evidence, metrics, CI guardrails, context eval
- [Anti-Patterns](./anti-patterns.md) — Common mistakes to avoid
- [Earned Autonomy](../earned-autonomy.md) — Curve, cap and grants
- [Reference Implementation Case Study](../references/reference-telegram-trading-bot-case-study.md) — Project walkthrough with commit statistics (descriptive, not evidence)
