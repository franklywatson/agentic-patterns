---
last-validated-model: claude-sonnet-5-5
reviewed: 2026-11-19
---

# Adoption Guide

For a team deciding what to adopt first. Run the assessment below, pick the path that matches your largest gap and
follow its steps in order. The paths are this library's suggestions, not a record of what other teams did. The layers
build on the ones below them, with L3 optional ([README](../../README.md#the-pattern-layers)), and they are not a
maturity scale. Finishing L4 does not make any workflow ready to run unattended: each workflow's grant and the
repository's cap decide that ([How Far to Let Go](#how-far-to-let-go)).

---

## Assessment: Where Are You Now?

Run the example CLI `autonomy census` ([examples/autonomy](../../examples/autonomy/README.md)) with `--dir` set to
your repository. It needs no register. It computes the platform, governance, ownership and measuring positions from
the repository's own files, treats a dimension with no evidence as C1 (only `skill` can be `unknown`, counted as C2)
and lists what is missing for the next position ([Pattern A.4](../earned-autonomy.md#pattern-a4--census)). The
checklist covers what a census cannot read.

### Entry Points

- [ ] AGENTS.md exists, CLAUDE.md imports it, and the file is under 200 lines with a named owner and a reviewed date
- [ ] Each constitutional rule in the instruction file names its enforcement point
- [ ] README.md states what the project does in its first paragraph
- [ ] The instruction file links to every doc in the repository, directly or through another linked doc
- [ ] Top-level directories are named for domains (billing, auth), not for technical layers (controllers, models)

### Testing

- [ ] Stack tests and E2E tests start the owned services for real; no mock replaces an owned service
- [ ] A complex external dependency has an integration test against its real testnet or sandbox
- [ ] Each test run starts from a clean environment and shares no state with another run
- [ ] A failing test names the journey and the assertion layer that failed
- [ ] Tests assert on side effects (database rows, emitted events), not only on responses

### Documentation

- [ ] Each convention the agent must follow is written in a doc linked from AGENTS.md
- [ ] A change to code updates the doc that describes it in the same pull request
- [ ] A link and reachability check runs in CI and no doc is unreachable from AGENTS.md

### Tooling

- [ ] Feature branches use git worktrees
- [ ] Lint and format run before commit and in CI
- [ ] CI runs the tests in a clean container, and the test job is a required check
  ([how to](#make-the-test-job-a-required-check))

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
- [ ] Every agent-written change has an author of record, and every workflow has an owner in the register ([Pattern
  4.7](../L4-standards-measurement.md#pattern-47--author-of-record-and-agent-register))
- [ ] Completion evidence comes from CI, not from the agent's message ([Pattern
  4.1](../L4-standards-measurement.md#pattern-41--evidence-based-claims))
- [ ] The team can supervise without the agent: the work sample passes ([Pattern
  4.9](../L4-standards-measurement.md#pattern-49--deliberate-practice))

The [threat model](threat-model.md) lists what each control protects.

### The New Starter Test

Give a person or an agent only AGENTS.md, the README and the file tree, and ask the six questions in [Pattern
0.9](../L0-foundation.md#pattern-09--ai-as-new-starter-standard). Each assumption they make is a gap.

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

Start with L0: structure and AGENTS.md cost little and later layers depend on them (this project's own experience;
no study compares layers). Then build upward.

1. **L0 Foundation** — Restructure by domain, write AGENTS.md, establish doc freshness and cleanup practices. See [L0-foundation.md](../L0-foundation.md).
2. **L1 Closed Loop Design** — Add stack tests for your most critical user journeys. See [L1-feedback-loops.md](../L1-feedback-loops.md) and the working examples in [examples/stack-test/](../../examples/stack-test/).
3. **L2 Guardrails** — Add skills and hooks for your project's most common errors. See [L2-behavioral-guardrails.md](../L2-behavioral-guardrails.md).
4. **L3 Optimization (optional)** — Reduce token spend with structured tools and context isolation, when token cost is a measured problem. See [L3-optimization.md](../L3-optimization.md) and the working example in [examples/guardrails/](../../examples/guardrails/).
5. **L4 Standards & Measurement** — Add metrics, CI guardrails, and context eval once the earlier layers are in place. Drift detection and the new-starter audit are in [Pattern 0.7](../L0-foundation.md#pattern-07--documentation-as-system-map) and [Pattern 0.9](../L0-foundation.md#pattern-09--ai-as-new-starter-standard). See [L4-standards-measurement.md](../L4-standards-measurement.md).

### Path B: Testing-First (Teams with Testing Gaps)

If your testing is the biggest pain point — no stack tests, shallow assertions, or missing edge-case coverage for external dependencies — start at L1.

1. **L1** — Add a stack test for each critical user journey, and reconcile journeys that overlap ([Pattern
   1.1](../L1-patterns/1.1-stack-tests.md#stack-test-brittleness-and-reconciliation)). For complex external dependencies (payment processors, blockchain RPCs), add focused integration tests against a real testnet or sandbox. See [Pattern 1.5 — Real Dependencies](../L1-patterns/1.5-real-dependencies.md) and [examples/stack-test/](../../examples/stack-test/).
2. **L0** — Once stack tests are working, structure the project to make them maintainable. Deep modules, AGENTS.md, progressive disclosure.
3. **L2, L4** — Continue upward as in Path A; add L3 only when token cost is a measured problem.

### Path C: Guardrails-First (Teams with Agent Errors)

If agents are making consistent errors (missing tests, ignoring rules, skipping verification), start at L2.

1. **L2** — Add skills for your most violated rules, hooks to block destructive patterns. See [L2-behavioral-guardrails.md](../L2-behavioral-guardrails.md).
2. **L0** — Structure the project so agents have clear context to work with.
3. **L1, then L4** — Add L1 next, then L4; add L3 only when token cost is a measured problem.

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

If one person watches each step, follow the first row of the [README reading path](../../README.md#start-here)
(sandbox, credentials, one command that must fail). Then add a short AGENTS.md ([Pattern
0.4](../L0-foundation.md#pattern-04--agent-instruction-file-as-project-constitution)) and the test-integrity lint
in CI ([Pattern 1.6](../L1-patterns/1.6-test-integrity.md)).

A new repository starts at cap C1, which allows only A1, read-only suggestions. A session that edits files needs A2,
so the repository first reaches C2 ([Reaching C2](../earned-autonomy.md#reaching-c2)). Rules that need a second
person (the high tier of Pattern 2.13, the approver in Pattern 4.7) cannot be met. Keep every workflow at A1 or A2
and do not enable auto-merge.

---

## Make the Test Job a Required Check

A hook acts only while the harness runs it. A required check blocks the merge whatever happened in the session
([Pattern 4.5](../L4-standards-measurement.md#pattern-45--ci-guardrails)).

1. Run the tests in one CI job with a fixed name, for example `tests`, in a workflow that starts on every pull request.
2. In the repository settings, add that job as a required status check in a ruleset or a branch protection rule. All
   required checks must pass before a pull request merges ([available rules for
   rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets),
   [about protected
   branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)).
3. Check that the workflow has no `paths`, `paths-ignore` or branch filter. When a filter skips the workflow, its
   required checks stay Pending and block the merge. GitHub's guidance is to avoid requiring workflows that can be
   skipped ([troubleshooting required status
   checks](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/collaborating-on-repositories-with-code-quality-features/troubleshooting-required-status-checks)).

In a monorepo, a per-package workflow with a `paths:` filter cannot be a required check. Run one workflow on every
pull request with one required job, and decide inside the job which package tests to run: the first step compares
the changed files with each package's directory, and later steps run only for packages that changed. The job still
finishes with success when no package changed, so the required check is satisfied. For the instruction files of a
monorepo see the [FAQ](faq.md#monorepo-or-multi-repo-for-agents).

---

## How Far to Let Go

Layers say what to build. Grants and the cap say how far a workflow may run without a person; the definitions are in
[Earned Autonomy](../earned-autonomy.md#the-curve-and-the-cap). The census runs per repository, so each repository
has its own cap and a workflow that acts in several repositories answers to each one. The risk tier of a change
decides its review, and the grant decides who acts unattended ([risk
model](../L1-patterns/1.8-reversibility-blast-radius.md#risk-model)).

A new repository starts at C1, which allows only A1, read-only suggestions. A session that edits files needs A2, so
a new repository first reaches C2 ([Reaching C2](../earned-autonomy.md#reaching-c2)). C3 needs a committed baseline,
which this library does not show how to compute, so a repository that uses only this library stops at C2 and A2. A
team that wants A3 or A4 closes the capping dimension that `autonomy census` reports as lowest, then promotes
workflows one grant at a time on evidence ([Pattern
A.3](../earned-autonomy.md#pattern-a3--promotion-demotion-and-the-cap-gate)). The prerequisites for each grant are in
one list: [Prerequisites by Grant](../earned-autonomy.md#prerequisites-by-grant).

Repair of owned code in production is the one unattended-work seam this library defines in detail: [Patterns 1.7
to 1.12](../L1-feedback-loops.md#closing-the-loop-in-production) with the runnable gate in
[examples/repair-loop](../../examples/repair-loop/README.md). Adopt it after stack tests exist for the journeys it
covers and after the containment block above passes. It does not lift the cap.

---

## Key Success Factors

1. **Build on the layer below** — A layer depends on the layers below it ([README](../../README.md#the-pattern-layers)), so check that the layer below holds before relying on one above. Start with L0 when unsure.
2. **Measure before you loosen** — Run the example `autonomy census` and read the cap before raising any grant.
3. **Update docs in the same task as code** — Deferred documentation is stale documentation ([Pattern 0.7](../L0-foundation.md#pattern-07--documentation-as-system-map)).
4. **Re-baseline at each model upgrade** — Run a fixed task bank without each skill, hook and rule, and delete what no
   task needs ([Pattern 0.10](../L0-foundation.md#pattern-010--prune-and-re-baseline-context)).

---

## Further Reading

- [L0 Foundation](../L0-foundation.md) — Project structure patterns
- [L1 Closed Loop Design](../L1-feedback-loops.md) — Design-led verification
- [L2 Behavioral Guardrails](../L2-behavioral-guardrails.md) — Skills and hooks
- [L3 Optimization](../L3-optimization.md) — Optional token efficiency
- [L4 Standards & Measurement](../L4-standards-measurement.md) — Evidence, metrics, CI guardrails, context eval
- [Anti-Patterns](./anti-patterns.md) — Common mistakes to avoid
- [Earned Autonomy](../earned-autonomy.md) — Curve, cap and grants
- [Reference Implementation Case Study](../references/reference-telegram-trading-bot-case-study.md) — What the reference project shows at each layer and where it departs from the patterns (n=1, not evidence)
- Reference implementations: [rig](https://github.com/franklywatson/claude-rig) (by this library's author) and [superpowers](https://github.com/obra/superpowers) install hooks, skills and commands that run with the agent's privileges. Read and pin before installing ([Pattern 2.12](../L2-behavioral-guardrails.md#pattern-212--skill-plugin-and-mcp-supply-chain)).
