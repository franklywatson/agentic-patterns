---
last-validated-model: claude-opus-5-5
reviewed: 2026-11-19
---

# L4: Standards & Measurement

L4 covers evidence-based claims, development metrics, CI guardrails, and context eval. Where L0 establishes
foundations and L1-L3 provide execution patterns, L4 checks that those standards hold and measures what they change.
Drift detection, the new-starter audit and pruning of context artefacts are in L0 ([Pattern
0.7](L0-foundation.md#pattern-07--documentation-as-system-map), [Pattern
0.9](L0-foundation.md#pattern-09--ai-as-new-starter-standard) and [Pattern
0.10](L0-foundation.md#pattern-010--prune-and-re-baseline-context)).

> **Scope note:** Patterns 4.1, 4.4 and 4.5 were not used in the reference project. The rig implements Pattern 4.6
> (Context Eval) as first-party code, with 6 evaluation suites covering tool routing, enforcement pipelines, Python
> environment detection, session state, config overrides, and determinism. L4 contains patterns 4.1, 4.4, 4.5 and 4.6.
> The [rig](https://github.com/franklywatson/claude-rig) repository holds the 4.6 implementation.

---

## Pattern 4.1 — Evidence-Based Claims

### Problem

Agents make claims without evidence. "Tests should pass" is a prediction, not evidence. An agent's report that it
finished is a claim by the party being checked, and a person's report that AI made them faster is also a claim. Both
can be wrong in ways their authors cannot see. In a randomised trial, experienced open-source developers took longer
to finish tasks with AI tools than without, while expecting and believing that the tools made them faster
([IS-6](references/sources.md)). A 1,300-engineer survey measures what engineers say about their practice, not what
they produce ([MC-22](references/sources.md)).

This pattern is **Strong** for the finding that self-report is unreliable. It is **Partial** for the practice of
gating configuration changes on evals, which rests on vendor guidance.

### Solution

Run the check, show its output, then make the claim. The shown output tells the reviewer what was run and what it
printed. The evidence is the result of a system the agent cannot edit, and the reviewer reads that result.

**Contract.**

1. **Run before claiming.** Every completion claim names the command that backs it and shows that command's output.
2. **Completion evidence comes from outside the agent.** A CI log, a required check result, a signed build record
   and the repository history count. Output the agent pastes into its own message, with no CI run behind it, is a
   claim about output. The reviewer reads the CI run.
3. **The agent cannot edit the evidence source.** It has no write access to the CI workflow, branch protection or
   the build signing step ([Pattern 2.3](L2-behavioral-guardrails.md#pattern-23--hook-automation), [Pattern
   2.9](L2-behavioral-guardrails.md#pattern-29--contain-before-you-relax)).
4. **Productivity claims rest on artefacts.** Use cycle time, rework, revert rate and escaped defects from version
   control and CI. A survey adds context. It does not stand alone ([IS-3, MV-8](references/sources.md)).
5. **Configuration changes are releases.** A change to a skill, hook, prompt, instruction file or model version runs
   against the task bank before it ships ([Pattern 4.6](#pattern-46--context-eval)). Run each task more than once,
   because agent runs vary, and pass the change only if it holds across runs ([PO-25](references/sources.md)).

**Evidence format template:**

```bash
# Step 1: Run verification command
$ <command>

# Step 2: Show actual output
<actual output>

# Step 3: Make claim based on output, and point at the run the reviewer reads
Claim: <what the output proves>
CI run: <link to the required check>
```

**Claims that REQUIRE evidence:**

- "Tests pass" → Show test output and link the CI run
- "Build succeeds" → Show build log
- "Function works" → Show example execution
- "Performance improved" → Show before/after metrics
- "Bug fixed" → Show reproduction failing before, passing after

**Graded production evidence.** Confirming a fix in production is statistical: error rates over a sample, not a single pass or fail. Accept it only under a rule declared before the change ships, which code evaluates, with a minimum sample size. Use it only for gates on reversible actions. A claim such as "no errors since deploy" on a path with no traffic is not evidence ([Pattern 1.10](L1-patterns/1.10-production-gate-progressive-confirmation.md)).

### In Practice

**Bad claims:**

- "Tests should pass now" → No verification
- "This failure is unrelated" → No investigation
- "This warning was pre-existing" → No baseline check
- "The function works correctly" → No execution shown

**Good claims:**

```bash
$ pytest tests/test_auth.py -v

tests/test_auth.py::test_login_success PASSED
tests/test_auth.py::test_token_refresh PASSED
tests/test_auth.py::test_invalid_credentials PASSED

Claim: All authentication tests pass. The login, token refresh, and error handling paths work correctly.
CI run: the `tests` required check on this pull request
```

**Before/after evidence:**

```bash
# Before: Bug reproduction
$ python -c "from mymodule import broken_func; broken_func()"
ValueError: division by zero

# After fix: Verification
$ python -c "from mymodule import fixed_func; fixed_func()"
Success: Operation completed

Claim: The division-by-zero bug is fixed. Function now handles edge cases correctly.
```

**Evidence for negative claims:**

```bash
# Claim: "This error is pre-existing"
$ git log --oneline -1
commit abc123 (HEAD) Add new feature

$ git diff abc123^..abc123 -- myfile.py
# No changes to error-prone code

Claim: The error existed before this commit. Changes in abc123 don't touch the relevant code.
```

**Around the claim:**

- The completion template in the instruction file asks for the command, its output and a link to the CI run.
- The reviewer opens the required check, not the agent's summary.
- A monthly report takes cycle time, revert rate and rework from the repository and CI, with the survey beside it.
- A pull request that edits a skill or the instruction file attaches the task-bank run. The eval job is a required
  check.

### Anti-Pattern

- **Prediction-based claims:** "Tests should pass" without running them.
- **Dismissive assertions:** "That's unrelated" without investigation.
- **Selective evidence:** Showing passing tests while hiding failing ones.
- **Hand-wavy verification:** "I checked it manually" with no output.
- **Evidence-free refutation:** "That failure is a flaky test" without logs.
- **Pasted output as proof:** accepting "all tests pass" with a pasted block the agent could have written, and no
  CI run to read.
- **Editable evidence:** letting the agent edit the workflow that produces the evidence.
- **Survey as productivity evidence:** reporting AI productivity from a satisfaction survey.
- **Untested configuration change:** changing a prompt or model version because it feels better, with no task set
  to compare.

### Cross-References

- [Pattern 1.2 — Full-Loop Assertion Layering](L1-patterns/1.2-full-loop-assertions.md): Evidence is part of tertiary assertions
- [Pattern 0.8 — Aggressive Cleanup](L0-foundation.md#pattern-08--aggressive-cleanup): Remove dead code that wastes verification tokens
- [Pattern 0.7 — Documentation as System Map](L0-foundation.md#pattern-07--documentation-as-system-map): Automated checks replace manual verification
- [Pattern 2.5 — Zero-Defect Tolerance](L2-behavioral-guardrails.md#pattern-25--zero-defect-tolerance): required checks
- [Pattern 4.4 — Agentic Development Metrics](#pattern-44--agentic-development-metrics): artefact-based metrics
- [Pattern 4.6 — Context Eval](#pattern-46--context-eval): the task bank that gates configuration changes

**Evidence:** Strong for the finding that self-report cannot stand in for output: developers believed AI sped them
up 20% after a measured 19% slowdown. Partial for eval-gated configuration releases, which rest on vendor guidance
(IS-6, IS-3, MC-22, MV-8, PO-25)

---

## Pattern 4.4 — Agentic Development Metrics

### Problem

Teams adopt agentic practices based on intuition and anecdote. Without measurement, they can't tell if the investment is paying off or where to focus next. "We feel faster" is not evidence — it's optimism bias. Teams that don't measure can't improve systematically.

### Solution

**Establish metrics that measure the outcomes agentic practices are designed to improve.** Metrics serve three purposes: check whether practices are working, identify where to focus next, and close the feedback loop on the practices themselves.

This is not about tracking agent activity for its own sake. Tokens consumed, commands executed, and sessions started are activity metrics — they measure effort, not outcomes. The metrics that matter measure whether the codebase is getting better and whether agents are becoming more effective over time.

**Autonomy is a separate axis.** These metrics measure outcomes. They do not say how much autonomy an agent should hold for a given workflow. That is a per-workflow grant, capped by the weakest control around it. See [Earned Autonomy](earned-autonomy.md) and [How Far a Team Can Let Go](../README.md#how-far-a-team-can-let-go).

**Key metric categories:**

**1. Velocity**

- Agent-driven cycle time per feature (from task assignment to verified completion)
- Task decomposition accuracy — how often the plan survives first execution without revision
- Stack test pass rate on first run ([L1](L1-feedback-loops.md))

**2. Quality**

- Defect rate in agent-delivered code (bugs found after merge per feature)
- Test coverage trend (stack tests covering new user journeys)
- Architectural coherence — frequency of cross-cutting refactors needed to maintain module boundaries

**3. Agent autonomy**

- Human intervention rate — how often a human must redirect or correct an agent mid-task. Treat it as an input to the grant decision, never as a target: driving it down by shrinking tasks or skipping review lowers the number without improving the work
- Task completion without handoff — percentage of tasks completed in a single agent session
- Review rejection rate — percentage of agent PRs requiring significant revision

**4. Governance**

- Constitutional rule violations caught by guardrails vs. caught in review
- Spec drift detected — broken links, stale docs, orphaned tests — tracked over time with the checks in [Pattern 0.7](L0-foundation.md#pattern-07--documentation-as-system-map)
- Rollback frequency — how often agent changes must be reverted
- Audit completeness — percentage of agent changes with full evidence trail

**5. Repair** (for teams that run a repair loop, [Patterns 1.7 to 1.12](L1-feedback-loops.md#closing-the-loop-in-production))

Speed and stability are read together, so a fast number cannot hide a weak one.

- Time to reproduce — from the incident record to a reproduction that is red on the production commit
- Time to confirmed repair — from the incident record to a fix that passed the confirmation window
- Repair revert rate — share of repairs rolled back or reverted
- Recurrence rate per fingerprint — share of confirmed repairs whose fingerprint returns within a set number of days
- Mitigation-to-fix ratio — mitigations shipped for every root-cause fix
- Masked-defect rate — runtime recoveries with no repair ticket, as a share of all recoveries ([Pattern 1.12](L1-patterns/1.12-self-healing-tests-vs-systems.md))
- Cost per confirmed repair — total spend divided by repairs that passed confirmation

The number of auto-repairs is never a target. Raising it means lowering the bar for what counts as a repair. The revert rate and recurrence rate also feed the circuit breaker ([Pattern 1.11](L1-patterns/1.11-repair-budget-circuit-breaker-stop.md)).

### In Practice

**Getting started — don't measure everything at once:**

Pick one metric from each category that matters most to your team. Track it for two weeks. If the data is noisy or hard to collect, pick a different metric. If it's clear and actionable, add more.

```
Starter set (one per category):
- Velocity: Agent-driven cycle time per feature
- Quality: Stack test pass rate on first run
- Autonomy: Human intervention rate
- Governance: Constitutional rule violations caught by guardrails
```

**Measurement cadence:**

- **Per-task:** Cycle time, intervention rate, plan revision count
- **Per-week:** Defect rate, review rejection rate, drift detection counts
- **Per-quarter:** Metric trend analysis, review of each workflow's autonomy grant, process refinement

**Closing the loop:**

Metrics that don't drive action are waste. For each metric, define:

- **Threshold:** What value triggers concern? (e.g., human intervention rate above 30%)
- **Action:** What do you do when the threshold is hit? (e.g., invest in better task scoping)
- **Owner:** Who is responsible for acting on it?

### Anti-Pattern

- **Vanity metrics:** Tracking tokens consumed or commands executed — these measure activity, not outcomes.
- **Measuring without acting:** Collecting data but not defining thresholds, actions, or owners.
- **Gaming the metrics:** Optimizing for the metric rather than the outcome (e.g., reducing intervention rate by making tasks so trivial the agent never needs help).
- **Intervention rate as a target:** It is an input. A low rate can mean good work or no oversight.
- **All-or-nothing:** Trying to measure everything from day one. Start with one metric per category.

### Cross-References

- [L1: Stack Tests](L1-feedback-loops.md): Pass rate on first run is a key quality signal
- [L2: Behavioral Guardrails](L2-behavioral-guardrails.md): Guardrail violation rates are a governance signal
- [L3: Optimization](L3-optimization.md): Token efficiency gains are measurable
- **Pattern 4.1 — Evidence-Based Claims**: The evidence standard applies to metrics claims themselves

**Evidence:** Strong — for avoiding activity and throughput metrics; the example thresholds are house values (MV-1, MV-2, MV-5, AN-26, AN-48)

---

## Pattern 4.5 — CI Guardrails

### Problem

L4 describes standards and measurement but doesn't address CI enforcement. Enforcement in hooks is session-scoped — it only works when the agent is running. CI provides non-negotiable enforcement that runs regardless of whether hooks are active.

### Solution

GitHub Actions workflows for docs quality and test coverage, paired with project config for threshold definitions.

**Key concepts:**

- Coverage gate: test coverage thresholds (e.g., 80% statements, 75% branches) defined in project config, not CI workflow
- Docs lint: markdownlint-cli2 with permissive rules + link checking
- Separate workflows: `docs.yml` for documentation, `coverage.yml` for test coverage
- Thresholds in project config, not CI — anyone can see and adjust them

### In Practice

```yaml
# .github/workflows/docs.yml
name: Documentation Quality
on: [push, pull_request]
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm run lint:md                       # markdownlint-cli2, config in .markdownlint-cli2.jsonc
      - run: python3 scripts/check-doc-links.py .  # links and anchors, exits 1 on any broken one
      - run: test "$(wc -l < AGENTS.md)" -le 200 || echo "::warning::AGENTS.md is over 200 lines"  # warning only
```

Each check exists in this repository: `npm run lint:md` is defined in `package.json`, `scripts/check-doc-links.py` is the link and anchor checker, and the line-count check is an inline shell step in the `instruction-file-length` job of `.github/workflows/docs.yml` (the `wc -l` line above is its one-line equivalent). It warns above about 200 lines for AGENTS.md and CLAUDE.md and never fails the build. The same workflow also runs a doc-reachability job (all docs referenced from AGENTS.md) and a writing-conventions job (filler words) as inline shell steps.

### Reference Implementation

The [rig](https://github.com/franklywatson/claude-rig) repo implements this in [`.github/workflows/`](https://github.com/franklywatson/claude-rig/tree/main/.github/workflows) with separate docs and coverage workflows.

### Anti-Pattern

Putting thresholds in CI workflow files rather than project config. When thresholds live in `.github/workflows/`, developers must dig through YAML to find them. When they live in `vitest.config.ts` or `.harness.yaml`, they're visible and adjustable alongside the code they govern.

### Cross-References

- [Pattern 0.7 — Documentation as System Map](L0-foundation.md#pattern-07--documentation-as-system-map) — CI automates drift checks
- [Pattern 4.1 — Evidence-Based Claims](#pattern-41--evidence-based-claims) — CI output is the evidence

**Evidence:** Partial — automated checks on every change are an independent practice; the scripts and thresholds are first-party, n=1 (PL-3)

---

## Pattern 4.6 — Context Eval

### Problem

Agent behavior changes when its context changes: the instruction file, a skill, a hook, a routing rule, the harness
configuration or the model version. Decision code that an agent's work passes through (a production gate, an
autonomy hook) changes the outcome too. Without a fixed set of tasks to run before and after, a change is accepted
because it feels better, and a regression shows up sessions later. One run of a stochastic agent shows nothing,
because two runs of the same configuration can differ ([PO-25](references/sources.md)).

### Solution

Keep a **task bank**: a fixed set of tasks, scored by checks the agent cannot influence, run by a runner on every
change to the agent's context and at each model upgrade. This pattern is the library's single definition of the task
bank. [Pattern 0.10](L0-foundation.md#pattern-010--prune-and-re-baseline-context) runs it to decide which context
artefacts to delete, and [Pattern A.2](earned-autonomy.md#pattern-a2--evidence-ledger) records its score in the
evidence ledger.

**The bank.** 10 to 30 tasks that represent the work agents do in the project. Each task has:

- a prompt, given verbatim, that names no pattern, so the agent has to find what applies;
- an expected artefact and where it is written;
- a check that does not read the agent's own report: a command's exit code, an exact comparison, an allow or deny
  decision;
- the docs and examples it relies on.

Expected values and seeds are held outside the agent's workspace, so a run cannot pass by reading them. The bank
changes only by recorded additions, and a task is retired only with a recorded reason.

**Scoring.**

| Check | Score | Used for |
|-------|-------|----------|
| Deterministic (exit code, exact comparison, decision) | Exact pass^k: a task passes only when all k runs pass. No partial credit | Every gate, and every task whose outcome a command can decide |
| Judged (a written explanation, a design choice) | Graded against a rubric fixed before the run | Reported beside the deterministic result; never turns a failed check into a pass |

k is at least 3 for tasks run by an agent; the decision-code evals in this repository use k = 5. The **bank score**
is the share of tasks that pass. Each gate states its floor: a configuration change passes when no task that passed at
baseline fails; a promotion criterion sets a floor such as 0.90 ([Pattern
A.3](earned-autonomy.md#pattern-a3--promotion-demotion-and-the-cap-gate)); a suite for a safety or governance
decision requires exactly 1.

**The runner.** For each task it copies the repository into a scratch directory without the expected values, plants
any seed, removes each artefact under test, runs the harness command with a pinned model id, scores the artefact and
appends one line to a run log. A dry-run mode scores a known-good and a known-bad artefact per task, so a broken
check is caught before a real run. The runner is a required check on any pull request that changes a skill, a hook,
the instruction file, the harness configuration or the model version ([Pattern 4.1](#pattern-41--evidence-based-claims),
[Pattern 4.5](#pattern-45--ci-guardrails)).

### In Practice

- **This repository's bank** is [the task bank](references/task-bank.md): 15 tasks, the run procedure and the run log.
  The runner is `scripts/task-bank/run.py`; `--remove PATH` takes an artefact out, `--model` pins the model id and
  `--dry-run` checks the checks.
- **Decision-code evals** use the same scoring without an agent in the loop. The autonomy example's eval
  ([examples/autonomy](../examples/autonomy/README.md#eval-suite)) runs 17 scenarios through the real hook and
  requires a score of exactly 1 at pass^5. The repair-loop gate eval ([examples/repair-loop](../examples/repair-loop/README.md))
  runs 35 scenarios at pass^5.
- **Tool routing** is another decision layer evaluated this way: scenarios of commands and expected routes, run
  against the real router in each environment variant ([Pattern
  3.1](L3-optimization.md#pattern-31--prefer-native-structured-tools-block-destructive-edits)).

### Anti-Pattern

- **One run per configuration.** A single pass or fail of a stochastic agent does not show a difference.
- **Partial credit on a deterministic check.** "Right action, wrong target" counted as half a pass lets a gate pass
  with wrong decisions.
- **A floor below 1 on a safety or governance suite.** One wrong allow on an irreversible action is a failure.
- **Checks that read the agent's report.** The agent's account of its work is a claim, not a result.
- **Evaluating a mock of the decision layer.** That tests the mock. Run the production code path.
- **Expected values in the agent's workspace.** The agent can read them and pass without doing the task.
- **A bank that is never run.** A bank with no run in its log supports no claim about any artefact.

### Cross-References

- [Pattern 0.10 — Prune and Re-baseline Context](L0-foundation.md#pattern-010--prune-and-re-baseline-context) —
  runs the bank without each artefact to decide what to delete
- [Pattern A.2 — Evidence Ledger](earned-autonomy.md#pattern-a2--evidence-ledger) — the bank score is a ledger field;
  a changed harness holds a workflow at A3 until the bank passes
- [Pattern 4.1 — Evidence-Based Claims](#pattern-41--evidence-based-claims) — configuration changes are releases
- [Pattern 4.5 — CI Guardrails](#pattern-45--ci-guardrails) — the runner as a required check
- [Pattern 1.7 — Incident-to-Stack-Test](L1-patterns/1.7-incident-to-stack-test.md) — an agent configuration
  incident becomes a task
- [Pattern 2.3 — Composing Checks](L2-behavioral-guardrails.md#composing-checks) — hook decisions are evaluated with
  exact scoring

**Evidence:** Partial — task banks, repeated trials and reading transcripts are documented practice from two vendors;
no independent outcome evidence that a task bank improves results (MV-9, MV-10, PO-25)

---

## Pattern 4.7 — Author of Record and Agent Register

### Problem

When an agent writes code, nobody is named as responsible for it. When an agent, a skill or a set of hooks has
no owner, it keeps running after the person who set it up has left. Credentials stay valid, instructions go
stale, and no one knows whether to remove it.

This pattern is **Partial**. Open-source projects have converged on one rule for agent-written code. Vendors
document sponsor and lifecycle mechanisms for agent identities. No source measures how teams apply either
([PO-10 to PO-17](references/sources.md)).

### Solution

Name a person for every piece of agent-written code, and list every agent and agent-facing artefact in one register.

**Author of record.** The person who asks an agent for a change is its author of record. They read it, they
answer for it, and they cannot approve it ([Pattern
2.13](L2-behavioral-guardrails.md#pattern-213--risk-tiered-review)). A different person approves. The LLVM
project, the Linux kernel and the Apache Software Foundation state this rule for contributions made with AI
tools: the human who submits is responsible ([PO-16, PO-17, PO-19](references/sources.md)). GitHub's guidance
for its cloud agent says the same about the person who asked for the work ([PO-20](references/sources.md)).
Record the tool in a commit trailer, such as a co-author line, so reviewers and later readers can see which
changes an agent wrote.

**Agent register.** One list of every agent, unattended workflow, skill, hook pack and MCP server in use. Each
entry holds:

| Field | Meaning |
|-------|---------|
| Item | Name and where it lives |
| Owner | The person who maintains it |
| Sponsor | The person accountable for it and for renewing or retiring it ([PO-10, PO-11](references/sources.md)) |
| Permitted actions | What it may read, write and call |
| Access expiry | When its credentials stop working unless renewed |
| State | Proposed, active, suspended or retired ([PO-12](references/sources.md)) |
| Last review | Date a person last checked that it is still needed and still correct |
| Retirement rule | What triggers removal: owner leaves, review lapses, no use for 90 days |
| Stop | For an unattended workflow: who can halt it, how, and when the stop was last tested |

The register starts as a table in the repository. As the number of entries grows, move it to a
machine-readable file (YAML or JSON) and add a CI check that fails when an entry has no owner, a review date
is older than the review interval, or an access expiry has passed. The fields stay the same.

A **tested stop** is a halt mechanism that someone has used in a drill, with a named person who can invoke it
and a named role who approves restart. This pattern only records whether one exists and when it was last
tested.

Retirement is part of [Pattern 0.8 — Aggressive Cleanup](L0-foundation.md#pattern-08--aggressive-cleanup),
applied to agents, skills and hooks: an item whose owner has left or whose review has lapsed is suspended,
then removed.

### In Practice

Start with a table in `docs/agents.md`:

| Item | Owner | Sponsor | Permitted actions | Access expiry | State | Last review | Retirement rule | Stop |
|------|-------|---------|-------------------|---------------|-------|-------------|-----------------|------|
| Nightly dependency-update agent | A. Rivera | J. Chen | Push to `deps/*` branches; open PRs | 2027-03-01 | Active | 2026-11-10 | Owner leaves or no PR in 90 days | Revoke token (J. Chen); drilled 2026-10-20 |
| `protect-paths` hook | M. Okafor | J. Chen | Block Edit and Write on protected paths | None | Active | 2026-11-10 | Review lapses | Not applicable |

At each quarterly review, confirm each entry still has a person who answers for it. Remove entries nobody claims.

For pull requests, use a template line "Requested by: <person>. Agent: <tool>." and a CI check that the commit
trailer is present.

### Anti-Pattern

- Agent-written code that nobody is named for, merged because "the agent wrote it".
- The requester approving their own agent's change.
- A register that lists agents but not the skills, hooks and servers they depend on.
- No access expiry, so a departed owner's agent keeps its credentials.
- Writing the register once and never reviewing it.

### Cross-References

- [Pattern 2.11 — Agent Identity and
  Delegation](L2-behavioral-guardrails.md#pattern-211--agent-identity-and-delegation) — the identity and
  credentials an entry refers to
- [Pattern 2.12 — Skill, Plugin and MCP Supply
  Chain](L2-behavioral-guardrails.md#pattern-212--skill-plugin-and-mcp-supply-chain) — owner and provenance per
  installed item
- [Pattern 2.13 — Risk-Tiered Review](L2-behavioral-guardrails.md#pattern-213--risk-tiered-review) — requester
  cannot approve
- [Pattern 0.8 — Aggressive Cleanup](L0-foundation.md#pattern-08--aggressive-cleanup) — retirement

**Evidence:** Partial — converged open-source rule and vendor-documented mechanisms; no practice data (PO-10
to PO-17, PO-19, PO-20, PO-31, AN-42)

---

## Pattern 4.9 — Deliberate Practice

### Problem

Safe delegation depends on a person who can read what the agent wrote, debug it and judge whether it is right.
Heavy delegation can erode that skill. In a randomised trial from Anthropic, people who used an AI assistant
to learn a new library scored lower on a comprehension test than people who coded by hand, and the gap
depended on how they used the assistant ([IS-1](references/sources.md)). Anthropic's staff reported the same
worry in a survey ([IS-4](references/sources.md)). Thoughtworks calls the team-level version codebase
cognitive debt: the code works, and nobody understands it ([IS-12](references/sources.md)).

This pattern is **Partial**. The trial was a short study of people learning a library. No study follows
experienced engineers over years.

### Solution

Keep supervision skill alive on purpose.

1. **Protected hands-on time.** Each engineer debugs or writes without the agent on a regular cadence, for
   example one session a week or one task a sprint. Choose work in the modules the engineer owns.
2. **Explain before merge.** For an owned module, the author of record explains the agent's change to a reviewer,
   in their own words, before it merges. If they cannot, the change is not ready.
3. **Rotate end-to-end diff reading.** Each week one person reads every agent diff in a module from start to
   finish, so more than one person holds the picture.
4. **Pair generation with comprehension.** When someone must own the result, they ask the agent to explain the
   code and the trade-offs, and then check the explanation against the code ([AN-20,
   AN-21](references/sources.md)).
5. **Test the skill.** The [new-starter audit](L0-foundation.md#pattern-09--ai-as-new-starter-standard) includes
   a work sample for the team: can an engineer explain and debug a module an agent changed?

### In Practice

A work sample takes 30 minutes:

1. Pick a module an agent changed in the last month.
2. Ask an engineer who did not review the change to explain what the module does and why the change was made.
3. Give them a failing test in the module and ask them to find the cause without the agent.

Record the result per module. A module nobody can explain gets a hands-on task assigned to an owner.

### Anti-Pattern

- Treating throughput as the only measure while no one can debug without the agent.
- Merging changes the author of record cannot explain.
- Skipping hands-on time because the schedule is tight.
- Using the work sample to rank people. It measures whether the team can supervise.

### Cross-References

- [Pattern 0.9 — AI-as-New-Starter Standard](L0-foundation.md#pattern-09--ai-as-new-starter-standard) — the
  audit that carries the work sample
- [Pattern 4.7 — Author of Record and Agent Register](#pattern-47--author-of-record-and-agent-register) — the
  person who must be able to explain the change
- [Pattern 2.13 — Risk-Tiered Review](L2-behavioral-guardrails.md#pattern-213--risk-tiered-review) — human
  attention goes where mistakes cost most

**Evidence:** Partial — the trial result is Strong in its setting; evidence for experienced engineers is Thin
and no study is longitudinal (IS-1, IS-4, IS-12, AN-20, AN-21)

---

## Review Checklist Template

Adopt this checklist for code reviews, PR reviews, and task completion verification. A PR should not merge until all applicable items pass.

### Constitutional Compliance

- [ ] AGENTS.md rules followed (if applicable)
- [ ] No hardcoded paths or secrets
- [ ] No blocking I/O without timeout
- [ ] Error handling covers all branches
- [ ] Logs include sufficient context

### Full-Loop Coverage

- [ ] Primary assertions: User-facing behavior verified (e.g., order placed successfully)
- [ ] Secondary assertions: Downstream effects verified (e.g., inventory updated, notification sent)
- [ ] Tertiary assertions: Cross-functional verification (e.g., audit log written, email received)
- [ ] Failure cases tested (error paths, edge cases, invalid input)

### Test Integrity

- [ ] No conditional assertions (assert inside if/else)
- [ ] No catch-without-throw (except re-throw scenarios)
- [ ] Tests are deterministic (no flaky randomness)
- [ ] Test isolation (no shared state between tests)
- [ ] Zero-defect tolerance: all test failures and warnings addressed, not dismissed ([Pattern 2.5](L2-behavioral-guardrails.md#pattern-25--zero-defect-tolerance))
- [ ] Unit tests cover algorithm correctness and edge cases
- [ ] Stack tests cover user journeys end-to-end ([L1: Stack Tests](L1-feedback-loops.md))

### Documentation

- [ ] Code changes documented in same task
- [ ] AGENTS.md updated if structure changed
- [ ] New docs linked from AGENTS.md (no orphans)
- [ ] Code examples tested and verified
- [ ] Deprecated features marked as such

### Evidence Requirements

- [ ] Claims backed by command output
- [ ] Completion evidence comes from CI or another system the agent cannot edit ([Pattern
  4.1](#pattern-41--evidence-based-claims))
- [ ] Test results shown (not just "tests pass")
- [ ] Before/after evidence for bug fixes
- [ ] Performance claims include metrics
- [ ] Negative claims include investigation

### Security and Ownership

- [ ] The sandbox is on and locked, and fails closed ([Pattern
  2.9](L2-behavioral-guardrails.md#pattern-29--contain-before-you-relax))
- [ ] No new secrets in agent-reachable configuration or files
- [ ] New skills, plugins and MCP servers are vetted and pinned ([Pattern
  2.12](L2-behavioral-guardrails.md#pattern-212--skill-plugin-and-mcp-supply-chain))
- [ ] An author of record is named, and they are not the approver ([Pattern
  4.7](#pattern-47--author-of-record-and-agent-register))
- [ ] High-tier changes have a second human approver ([Pattern
  2.13](L2-behavioral-guardrails.md#pattern-213--risk-tiered-review))
- [ ] New agents, skills and hooks have a register entry with an owner

### Code Quality

- [ ] Unused imports removed
- [ ] Dead code removed
- [ ] Stale comments removed
- [ ] No commented-out code
- [ ] No TODO comments without tickets

### Spec Consistency

- [ ] Docs match current code behavior
- [ ] Tests reference existing functions
- [ ] No broken links in documentation
- [ ] File paths in docs are accurate
- [ ] Pattern names match implementation

---

## Summary: L4 as Standards & Measurement

L4 holds the practices that check L0-L3 and measure their impact:

1. **Pattern 4.1 (Evidence-Based Claims):** Run the check and show its output; the reviewer reads the CI run
2. **Pattern 4.4 (Agentic Development Metrics):** Measure outcomes, close the feedback loop
3. **Pattern 4.5 (CI Guardrails):** Non-negotiable enforcement through CI workflows
4. **Pattern 4.6 (Context Eval):** A fixed task bank, scored by exact pass^k, gates every context or model change
5. **Pattern 4.7 (Author of Record and Agent Register):** Name a person for agent-written code; list every agent
   and its owner
6. **Pattern 4.9 (Deliberate Practice):** Keep the skill to supervise the agent alive

**The review checklist is the enforcement mechanism.** Apply it to every task, every PR, every completion.

When L4 is practiced consistently, the codebase remains agentic-ready: clear, clean, and maintainable for both human and agent collaborators.

## Practitioner Insight

> "Peter strikes me as a software architect who keeps the high-level structure of his project in his head, deeply cares about architecture, tech debt, extensibility, modularity, and so on."
> — Gergely Orosz, on Peter Steinberger's workflow

Architecture, tech debt, and modularity require continuous attention — especially when agents are doing the implementation. L4 provides the standards and measurement to ensure that attention is systematic, not ad-hoc.

---

**Previous:** [L3: Optimization (Optional)](L3-optimization.md) | [Back to Overview](../README.md)
