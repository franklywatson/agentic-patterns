---
last-validated-model: claude-opus-5-5
reviewed: 2026-11-19
---

# Adoption Guide

For a team deciding what to adopt first. Run the assessment below, pick the path that matches your largest gap and
follow its steps in order. The paths are this library's suggestions, not a record of what other teams did. L1 needs
L0's structure, L2 needs L1's checks, L4 measures L0 to L2, and the optional L3 uses L2's hooks
([README](../../README.md#the-pattern-layers)). The layers are not a maturity scale. Finishing L4 does not make
any workflow ready to run unattended: each workflow's grant and the repository's cap decide that ([How Far to Let
Go](#how-far-to-let-go)).

---

## Assessment: Where Are You Now?

Run the example CLI `autonomy census` ([examples/autonomy](../../examples/autonomy/README.md)) with `--dir` set to
your repository; add `--json` to see `missing_for_next`. It needs no register and lists what is missing for the next
position ([Pattern A.4](../earned-autonomy.md#pattern-a4--census)). It measures adoption of this library's files, so
a repository that has adopted none of them reads C1 whatever its controls. The checklist covers what a census cannot
read.

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
- [ ] A written high-tier list names the actions that need more than one approver, and the requester cannot approve
  (approvals are in the [How the Scales Fit Together](../../README.md#how-the-scales-fit-together) table and [Pattern 2.13](../L2-behavioral-guardrails.md#pattern-213--risk-tiered-review))
- [ ] Every agent-written change has an author of record, and every workflow has an owner in the register ([Pattern
  4.7](../L4-standards-measurement.md#pattern-47--author-of-record))
- [ ] Completion evidence comes from CI, not from the agent's message ([Pattern
  4.1](../L4-standards-measurement.md#pattern-41--evidence-based-claims))
- [ ] The team can supervise without the agent: the work sample passes ([Pattern
  4.9](../L4-standards-measurement.md#pattern-49--deliberate-practice))

The [threat model](threat-model.md) lists what each control protects.

### The New Starter Test

Give a person or an agent only AGENTS.md, the README and the file tree, and ask the six questions in [Pattern
0.9](../L0-foundation.md#pattern-09--ai-as-new-starter-standard). Each assumption they make is a gap.

---

## Adoption Paths

Four suggested paths (B and C are one). Pick the path whose first step closes your largest gap.

### Path A: Foundation-First (Default When Unsure)

Start with containment, then L0: structure and AGENTS.md cost little and later layers depend on them (this project's own experience;
no study compares layers). Then build upward.

1. **Contain** — Put the session in a locked sandbox and keep credentials out of it before anything else ([Pattern 2.9](../L2-behavioral-guardrails.md#pattern-29--contain-before-you-relax)): interactive sessions start in auto mode with the sandbox off ([permission modes](https://code.claude.com/docs/en/permission-modes)).
2. **L0 Foundation** — Restructure by domain, write AGENTS.md, establish doc freshness and cleanup practices. See [L0-foundation.md](../L0-foundation.md).
3. **L1 Closed Loop Design and Verification** — Add stack tests for your most critical user journeys. See [L1-feedback-loops.md](../L1-feedback-loops.md) and the working examples in [examples/stack-test/](../../examples/stack-test/).
4. **L2 Behavioral Guardrails** — Add skills and hooks for your project's most common errors. See [L2-behavioral-guardrails.md](../L2-behavioral-guardrails.md).
5. **L3 Optimization (optional)** — Reduce token spend with structured tools and context isolation, when token cost is a measured problem. See [L3-optimization.md](../L3-optimization.md) and the working example in [examples/guardrails/](../../examples/guardrails/).
6. **L4 Standards and Measurement** — Add metrics, CI guardrails, and context eval once the earlier layers are in place. Drift detection and the new-starter audit are in [Pattern 0.7](../L0-foundation.md#pattern-07--documentation-as-system-map) and [Pattern 0.9](../L0-foundation.md#pattern-09--ai-as-new-starter-standard). See [L4-standards-measurement.md](../L4-standards-measurement.md).

### Paths B and C: Start at the Layer of Your Largest Gap

Testing is the biggest pain (no stack tests, shallow assertions, missing edge-case coverage for external
dependencies): start at L1. Agents make consistent errors (missing tests, ignored rules, skipped verification):
start at L2.

1. **L1** — Add a stack test for each critical user journey, and reconcile journeys that overlap ([Pattern
   1.1](../L1-patterns/1.1-stack-tests.md#stack-test-brittleness-and-reconciliation)). For complex external dependencies (payment processors, blockchain RPCs), add focused integration tests against a real testnet or sandbox ([Pattern 1.5](../L1-patterns/1.5-real-dependencies.md), [examples/stack-test/](../../examples/stack-test/)).
2. **L2** — Add skills for your most violated rules and hooks to block destructive patterns ([L2](../L2-behavioral-guardrails.md)).
3. **L0** — Structure the project so tests stay maintainable and agents have clear context: deep modules, AGENTS.md, progressive disclosure.
4. **L4** — Then continue as in Path A; add L3 only when token cost is a measured problem.

### Path D: Containment-First (Teams Moving to Unattended Work)

If agents will run without a person watching each step, or already hold shell access, keys and network on
developer machines, start with containment. Do not loosen approvals first.

0. **Many machines** — Deliver the Pattern 2.9 keys and `requiredMinimumVersion` through [managed settings](https://code.claude.com/docs/en/managed-settings) (MDM, `managed-settings.json` or server-managed) to every machine, and set `strictKnownMarketplaces`, `allowManagedMcpServersOnly` and `allowManagedHooksOnly` ([Pattern 2.12](../L2-behavioral-guardrails.md#pattern-212--skill-plugin-and-mcp-supply-chain)). Then, per repository, commit a register, a baseline and the census and check jobs.
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
   4.7](../L4-standards-measurement.md#pattern-47--author-of-record).
5. **Then** continue with L1 and L2 as in Path A. Check the [Containment and governance
   block](#containment-and-governance) before each step toward unattended work.

### Path E: One Person, Attended Sessions

If one person watches each step, put the sandbox in place first ([FAQ: I work
alone](faq.md#i-work-alone-where-does-the-sandbox-settings-file-go)), then add a short AGENTS.md ([Pattern
0.4](../L0-foundation.md#pattern-04--agent-instruction-file-as-project-constitution)) and the test-integrity lint
in CI ([Pattern 1.6](../L1-patterns/1.6-test-integrity.md)).

Below A4, every tier in [Pattern 2.13](../L2-behavioral-guardrails.md#pattern-213--risk-tiered-review) needs an approval from someone other than the requester, so one person meets none of them. When you merge your own agent's change, the required checks are the only control that is not you. Make the test job and the test-integrity lint required checks, keep high-tier actions (migrations, CI workflows, publishing) human-made and reviewed by CI evidence only, and do not enable auto-merge. The register and grants are optional for one person; adopt them when a second person depends on the repository ([How the Scales Fit Together](../../README.md#how-the-scales-fit-together)).

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

```yaml
name: tests
on: pull_request            # no paths filter: the required job always runs
jobs:
  tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - name: Test each package that changed
        env: { BASE: "${{ github.event.pull_request.base.sha }}" }
        run: |
          changed=$(git diff --name-only "$BASE...HEAD")
          for dir in packages/*/; do
            if grep -q "^$dir" <<<"$changed"; then npm test --workspace "$dir"; fi
          done
```

The same `fetch-depth: 0` checkout is needed when a job runs `autonomy check --git-range <base sha>..<head sha>`
([CI job](../../examples/autonomy/README.md#run-against-your-own-repository)).

---

## How Far to Let Go

The scales, grants, cap and review tiers are defined once in [How the Scales Fit Together](../../README.md#how-the-scales-fit-together). The census runs per repository, so each repository has its own cap and a workflow that acts in several repositories answers to each one. A repository that has adopted nothing reads C1; see [Reaching C2](../earned-autonomy.md#reaching-c2). A team that wants A3 or A4 closes the capping dimension that `autonomy census` reports as lowest, then promotes workflows one grant at a time on evidence ([Pattern A.3](../earned-autonomy.md#pattern-a3--promotion-demotion-and-the-cap-gate)). The prerequisites for each grant are in [Prerequisites by Grant](../earned-autonomy.md#prerequisites-by-grant).

For many repositories, start with step 0 of [Path D](#path-d-containment-first-teams-moving-to-unattended-work).

Repair of owned code in production is the one unattended-work seam this library defines in detail: [Patterns 1.7
to 1.12](../L1-feedback-loops.md#closing-the-loop-in-production) with the runnable gate in
[examples/repair-loop](../../examples/repair-loop/README.md). Adopt it after stack tests exist for the journeys it
covers and after the containment block above passes. It does not lift the cap.

---
