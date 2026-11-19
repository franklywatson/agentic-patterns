---
last-validated-model: claude-opus-5-5
reviewed: 2026-11-19
---

# L4: Standards and Measurement

L4 checks that the other layers hold and measures what they change: claims backed by CI output, outcome metrics,
required CI checks, a task bank that gates context and model changes, a named person for agent-written code, and the
team's skill to supervise. Read it when "the agent says it passed" is the only evidence, or before a model or context
change. Drift checks, the new-starter audit and context pruning are in [L0](L0-foundation.md) (Patterns 0.7, 0.9
and 0.10).

---

## Pattern 4.1 — Evidence-Based Claims

### Problem

Agents make claims without evidence. "Tests should pass" is a prediction, not evidence. An agent's report that it
finished is a claim by the party being checked, and a person's report that AI made them faster is also a claim. Both
can be wrong in ways their authors cannot see. In a 2025 randomized trial, 16 experienced open-source developers took
longer to finish tasks with AI tools than without, while believing that the tools made them faster
([IS-6](references/sources.md)). METR marks the speed result out of date; its later update does not re-test the
belief gap.

### Solution

Run the check, show its output, then make the claim. The evidence is the result of a system the agent cannot edit,
and the reviewer reads that result.

**Contract.**

1. **Run before claiming.** Every completion claim names the command that backs it and shows that command's output.
2. **Completion evidence comes from outside the agent.** A CI log, a required check result, a signed build record
   and the repository history count. Output the agent pastes with no CI run behind it is a claim, not evidence. The
   reviewer reads the CI run.
3. **The agent cannot edit the evidence source.** It has no write access to the CI workflow, branch protection or
   the build signing step ([Pattern 2.3](L2-behavioral-guardrails.md#pattern-23--hook-automation), [Pattern
   2.9](L2-behavioral-guardrails.md#pattern-29--contain-before-you-relax)).
4. **Productivity claims rest on artifacts.** Use cycle time, rework, revert rate and escaped defects from version
   control and CI. A survey adds context. It does not stand alone ([MV-8](references/sources.md)).
5. **Configuration changes are releases.** A change to a skill, hook, prompt, instruction file or model version runs
   against the task bank before it ships ([Pattern 4.6](#pattern-46--context-eval)). Run each task more than once,
   because agent runs vary, and pass the change only if it holds across runs ([PO-25](references/sources.md)).

**Graded production evidence.** A production confirmation is statistical. It counts only under a rule declared before
the change ships, evaluated by code, with a minimum sample size, and only for gates on reversible actions; "no errors
since deploy" on a path with no traffic is not evidence ([Pattern
1.10](L1-patterns/1.10-production-gate-progressive-confirmation.md)).

### In Practice

**A test claim: command, output, claim, and the run the reviewer reads:**

```bash
$ pytest tests/test_auth.py -v

tests/test_auth.py::test_login_success PASSED
tests/test_auth.py::test_token_refresh PASSED
tests/test_auth.py::test_invalid_credentials PASSED

Claim: The login, token refresh and invalid-credential paths pass.
CI run: the `tests` required check on this pull request
```

**A bug fix: the same call before and after:**

```bash
$ python -c "from mymodule import ratio; print(ratio(1, 0))"   # before the fix
ZeroDivisionError: division by zero
$ python -c "from mymodule import ratio; print(ratio(1, 0))"   # after the fix
None

Claim: ratio(1, 0) raised ZeroDivisionError before the change and returns None after it.
```

**A negative claim: the failure exists on the parent commit:**

```bash
$ git switch --detach abc123^
$ pytest tests/test_x.py
FAILED tests/test_x.py::test_parse - KeyError: 'id'

Claim: The failure exists on the parent commit; abc123 did not introduce it.
```

A pre-existing failure is still fixed or recorded, not dismissed ([Pattern
2.5](L2-behavioral-guardrails.md#pattern-25--zero-defect-tolerance)).

The completion template in the instruction file asks for the command, its output and a link to the CI run. A pull
request that edits a skill or the instruction file attaches the task-bank run.

### Anti-Pattern

- **Prediction-based claims:** "Tests should pass" without running them.
- **Dismissive assertions:** "That's unrelated", "that was pre-existing" or "that test is flaky" with no run or log
  behind it.
- **Selective evidence:** showing passing tests while hiding failing ones.
- **Hand-wavy verification:** "I checked it manually" with no output.
- **Pasted output as proof:** accepting "all tests pass" with a pasted block the agent could have written, and no
  CI run to read.
- **Editable evidence:** letting the agent edit the workflow that produces the evidence.
- **Survey as productivity evidence:** reporting AI productivity from a satisfaction survey.

### Cross-References

- [Pattern 1.2 — Full-Loop Assertion Layering](L1-patterns/1.2-full-loop-assertions.md): the assertions whose output
  is the evidence
- [Pattern 4.4 — Agentic Development Metrics](#pattern-44--agentic-development-metrics): artifact-based metrics

**Evidence:** Partial — one 2025 trial measured the belief gap (IS-6); eval-gated configuration releases rest on
vendor guidance (MV-8, PO-25)

---

## Pattern 4.4 — Agentic Development Metrics

### Problem

Teams adopt agentic practices on intuition and anecdote, so they cannot tell whether the investment pays off or where
to focus next. "We feel faster" is not evidence ([Pattern 4.1](#pattern-41--evidence-based-claims)).

### Solution

Measure the outcomes agentic practices are meant to improve, and use each metric to decide something: whether a
practice works, where to focus next, and which practice to change. Tokens consumed, commands executed and sessions
started measure activity, not outcomes.

Metrics do not set grants; a grant is per workflow, capped by the repository's census ([The Curve and the
Cap](earned-autonomy.md#the-curve-and-the-cap)).

**Metric categories:**

1. **Velocity:** cycle time of agent pull requests, as defined under Create a baseline below.
2. **Quality**
   - Defect rate in agent-delivered code: bugs found after merge, per feature
   - Stack test pass rate on first run ([Pattern 1.1](L1-patterns/1.1-stack-tests.md))
   - Stack tests covering new user journeys
3. **Supervision load**
   - Human intervention rate: how often a person redirects or corrects an agent mid-task. It is an input to the grant
     decision, never a target
   - Task completion without handoff: share of tasks completed in one agent session
   - Review rejection rate: share of agent pull requests with at least one change requested before merge
4. **Governance**
   - Rule violations caught by an enforcement point (hook, CI) against those caught in review
   - Drift found by the checks in [Pattern 0.7](L0-foundation.md#pattern-07--documentation-as-system-map) (broken
     links, stale docs, orphaned tests), tracked over time
   - Revert rate: how often agent changes are reverted
5. **Repair** (for teams that run a repair loop, [Patterns 1.7 to
   1.12](L1-feedback-loops.md#closing-the-loop-in-production)). Speed and stability are read together, so a fast
   number cannot hide a weak one.
   - Time to reproduce and time to confirmed repair: from the incident record to a reproduction that is red on the
     production commit, and to a fix that passed the confirmation window
   - Repair revert rate: share of repairs rolled back or reverted
   - Recurrence rate per fingerprint: share of confirmed repairs whose fingerprint returns within a set number of days
   - Mitigation-to-fix ratio: mitigations shipped for every root-cause fix
   - Masked-defect rate: runtime recoveries with no repair ticket, as a share of all recoveries ([Pattern
     1.12](L1-patterns/1.12-self-healing-tests-vs-systems.md))
   - Cost per confirmed repair: total spend divided by repairs that passed confirmation

The number of auto-repairs is never a target. Raising it means lowering the bar for what counts as a repair. The
revert rate and recurrence rate also feed the circuit breaker ([Pattern
1.11](L1-patterns/1.11-repair-budget-circuit-breaker-stop.md)).

### In Practice

**Start with one metric per category**, for example cycle time, first-run stack test pass rate, intervention rate,
rule violations caught by an enforcement point and, with a repair loop, time to confirmed repair. Track each for two
weeks. If the data is noisy or hard to collect, pick a different metric; if it is clear and drives a decision, add
more.

**Create a baseline.** Before raising any grant, record the repository's flow and stability numbers over the last
90 days in `.autonomy/baseline.json`, the file the census reads ([Pattern A.4](earned-autonomy.md#pattern-a4--census)):

```json
{
  "captured": "2026-11-19",
  "window_days": 90,
  "flow": { "merged_prs": 142, "median_cycle_time_hours": 31.5 },
  "stability": { "reverts": 3, "revert_rate": 0.021, "escaped_defects": 2 }
}
```

Cycle time runs from a pull request's creation to its merge; a revert is a merged commit whose message starts with
`Revert`; an escaped defect is a bug filed against a merged change. The census checks only that `flow` and
`stability` are non-empty objects and that `captured` is at most 90 days old, so recompute the file every 90 days:

```bash
since=2026-08-21   # 90 days before the capture date
gh pr list --state merged --limit 1000 --search "merged:>=$since" --json createdAt,mergedAt \
  | jq '[.[] | ((.mergedAt|fromdate) - (.createdAt|fromdate)) / 3600] | sort
        | {merged_prs: length, median_cycle_time_hours: .[length / 2 | floor]}'
git log --since="$since" --oneline --grep='^Revert' | wc -l    # reverts
```

**Cadence.** Record cycle time and intervention rate per task; review defect rate, review rejection rate and drift
counts weekly; review trends and each workflow's autonomy grant quarterly.

**Closing the loop.** For each metric, define a threshold that triggers action (for example, intervention rate above
30%), the action taken at the threshold (for example, smaller, better-scoped tasks) and the person who acts on it.

### Anti-Pattern

- **Vanity metrics:** tracking tokens consumed or commands executed.
- **Measuring without acting:** collecting data with no thresholds, actions or owners.
- **Gaming the metrics:** lowering the intervention rate by making tasks so small the agent never needs help, or by
  skipping review. A low rate can mean good work or no oversight.

**Evidence:** Partial — independent sources warn against throughput and activity counts used alone (MV-1, MV-5);
vendor frameworks still track adoption and spend beside outcomes (MV-2, AN-48); the metric set and thresholds are
this library's design

---

## Pattern 4.5 — CI Guardrails

### Problem

A hook is an enforcement point inside the agent's session: it acts only while the harness runs it. CI runs on every
push and pull request whatever happened in the session, and the agent cannot switch it off from inside one. Its
output is the evidence [Pattern 4.1](#pattern-41--evidence-based-claims) asks for.

### Solution

Run each automated check as its own CI job, so a failure names the check that failed, and make the jobs required
checks. A warning check reports without failing the build. Keep thresholds in project config, not in the workflow:
coverage thresholds (for example 80% statements, 75% branches) live in the test config, such as `vitest.config.ts`,
next to the code they govern.

An application repository makes these required checks: unit tests; stack tests ([Pattern
1.1](L1-patterns/1.1-stack-tests.md)); the test-integrity lint ([Pattern
1.6](L1-patterns/1.6-test-integrity.md)); lint with warnings as errors ([Pattern
2.5](L2-behavioral-guardrails.md#pattern-25--zero-defect-tolerance)); link and reachability checks on its docs
([Pattern 0.7](L0-foundation.md#pattern-07--documentation-as-system-map)); and, where it keeps a register,
`autonomy check` ([Pattern A.3](earned-autonomy.md#pattern-a3--promotion-demotion-and-the-cap-gate)).

### In Practice

This repository's checks are the jobs in `.github/workflows/docs.yml`, named with the rule each holds in
[AGENTS.md](../AGENTS.md). `main` has no branch protection, so a failing job is advisory until the check is required
on `main`, and the workflow has a path filter, which the [adoption
guide](cross-cutting/adoption-guide.md#make-the-test-job-a-required-check) advises against for a required check.

### Anti-Pattern

- Thresholds in workflow files rather than project config, where nobody editing the code sees them.
- Checks that run but are not required, so a failure does not block the merge.

**Evidence:** Partial — automated checks on every change are an independent practice; the scripts and thresholds are
this project's own experience, n=1 (PL-3)

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
artifacts to delete, and [Pattern A.2](earned-autonomy.md#pattern-a2--evidence-ledger) records its score in the
evidence ledger.

**The bank.** 10 to 30 tasks (this library's sizing) that represent the work agents do in the project. Each task has:

- a prompt, given verbatim, that names no pattern, so the agent has to find what applies;
- an expected artifact and where it is written;
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
any seed, removes each artifact under test, runs the harness command, scores the artifact and appends one line to a
run log. The harness command pins the model id and any effort or reasoning setting; the runner records the model id
it is given but does not set it. A dry-run mode scores a known-good and a known-bad artifact per task, so a broken
check is caught before a real run. Where the harness runs in CI, the runner is a required check on any pull request
that changes a skill, a hook, the instruction file, the harness configuration or the model version ([Pattern
4.5](#pattern-45--ci-guardrails)).

### In Practice

- **This repository's bank** is [the task bank](references/task-bank.md): 15 tasks, the run procedure and the run log.
  The runner is `scripts/task-bank/run.py`. It runs each task once per invocation, so pass^3 means three invocations
  per configuration. Its `--model` flag writes the model id to the run log only.
- **Decision-code evals** use the same scoring without an agent in the loop. The autonomy example's eval
  ([examples/autonomy](../examples/autonomy/README.md#eval-suite)) runs its scenarios through the real hook and
  requires a score of exactly 1 at pass^5. The repair-loop gate eval
  ([examples/repair-loop](../examples/repair-loop/README.md)) runs its gate scenarios at pass^5.

### Anti-Pattern

- **One run per configuration.** A single pass or fail of a stochastic agent does not show a difference.
- **Partial credit on a deterministic check.** "Right action, wrong target" counted as half a pass lets a gate pass
  with wrong decisions.
- **A floor below 1 on a safety or governance suite.** One wrong allow on an irreversible action is a failure.
- **Checks that read the agent's report**, or expected values the agent can read.
- **Evaluating a mock of the decision code.** That tests the mock. Run the production code path.
- **A bank that is never run.** A bank with no run in its log supports no claim about any artifact.

### Cross-References

- [Pattern A.2 — Evidence Ledger](earned-autonomy.md#pattern-a2--evidence-ledger): a changed harness holds a
  workflow at A3 until the bank passes
- [Pattern 4.1 — Evidence-Based Claims](#pattern-41--evidence-based-claims): configuration changes are releases
- [Pattern 1.7 — Incident-to-Stack-Test](L1-patterns/1.7-incident-to-stack-test.md): an agent configuration
  incident becomes a task
- [Pattern 2.3 — Composing Checks](L2-behavioral-guardrails.md#composing-checks): hook decisions are evaluated with
  exact scoring

**Evidence:** Partial — task banks, repeated trials and reading transcripts are documented practice from two vendors;
no independent outcome evidence that a task bank improves results (MV-10, PO-25)

---

## Pattern 4.7 — Author of Record

### Problem

When an agent writes code, nobody is named as responsible for it. When an agent workflow, a skill or a hook has no
owner, it keeps running after the person who set it up has left. Credentials stay valid, instructions go stale, and
no one knows whether to remove it.

### Solution

Name a person for every piece of agent-written code, and an owner for every agent workflow, skill and hook.

**Author of record.** The person who asks an agent for a change is its author of record. They read it, they
answer for it, and they cannot approve it ([Pattern
2.13](L2-behavioral-guardrails.md#pattern-213--risk-tiered-review)). A different person approves. LLVM
and the Linux kernel state that the human who submits AI-assisted work is responsible, and the Apache Software
Foundation makes the contributor represent the work as original and disclose generated material
([PO-16, PO-17, PO-19](references/sources.md)). GitHub does not count
the requester's approval of its cloud agent's pull request; another reviewer must approve
([PO-20](references/sources.md)). A `Co-Authored-By:` trailer names the agent, so reviewers and later readers see
which changes an agent wrote; `autonomy check` identifies agent commits by it
([examples/autonomy](../examples/autonomy/README.md#governance-files)).

**Workflow owners.** Every agent workflow, unattended or interactive, has an entry in the register, `.autonomy.yaml`
([Pattern A.1](earned-autonomy.md#pattern-a1--autonomy-register)). Its schema requires `owner`, `sponsor` and
`identity`, so `autonomy check` fails CI on an entry without them, and a workflow whose review date or access expiry
has passed drops to A2 ([Pattern A.3](earned-autonomy.md#pattern-a3--promotion-demotion-and-the-cap-gate)).

**Skills, hooks, plugins and MCP servers** are not workflows. Each has a named owner, a source and a review date
where it is installed: front matter on a skill file ([Pattern
0.10](L0-foundation.md#pattern-010--prune-and-re-baseline-context)) and the pinned allowlist for hooks, plugins and
servers ([Pattern 2.12](L2-behavioral-guardrails.md#pattern-212--skill-plugin-and-mcp-supply-chain)).

**Retirement** is [Pattern 0.8 — Aggressive Cleanup](L0-foundation.md#pattern-08--aggressive-cleanup) applied to
agents, skills and hooks: an item whose owner has left or whose review has lapsed is suspended, then removed. A
retired workflow is deleted from `.autonomy.yaml`; the repository history keeps the entry.

### In Practice

- The commit author is the requester. State the `Co-Authored-By:` trailer rule in the instruction file, and fail
  CI on an agent-written commit without it.
- At each quarterly review, confirm that each register entry, skill and hook still has a person who answers for it.
  Remove entries nobody claims.

### Anti-Pattern

- Agent-written code that nobody is named for, merged because "the agent wrote it".
- The requester approving their own agent's change.
- A second list of agents (a table in a doc) beside `.autonomy.yaml`. The two drift apart, and only one is checked.
- Skills, hooks and servers with no owner where they are installed.
- No access expiry, so a departed owner's agent keeps its credentials.
- Writing the register once and never reviewing it.

### Cross-References

- [Pattern 2.11 — Agent Identity and
  Delegation](L2-behavioral-guardrails.md#pattern-211--agent-identity-and-delegation): the identity and
  credentials an entry refers to
- [Pattern 4.9 — Deliberate Practice](#pattern-49--deliberate-practice): the author of record must be able to
  explain the change

**Evidence:** Partial — a rule open-source projects share and one vendor enforces in review; no source measures how
teams apply it (PO-16, PO-17, PO-19, PO-20)

---

## Pattern 4.9 — Deliberate Practice

### Problem

Safe delegation depends on a person who can read what the agent wrote, debug it and judge whether it is right.
Heavy delegation can erode that skill. In a randomized trial from Anthropic (52 mostly junior engineers), people
who used an AI assistant to learn a new library scored lower on a comprehension test than people who coded by
hand, and the gap depended on how they used the assistant ([IS-1](references/sources.md)). Anthropic's staff reported the same
worry in a survey ([IS-4](references/sources.md)). Thoughtworks calls the team-level version codebase
cognitive debt: the code works, and nobody understands it ([IS-12](references/sources.md)).

### Solution

Keep supervision skill alive on purpose.

1. **Protected hands-on time.** Each engineer debugs or writes without the agent on a regular cadence, for
   example one session a week or one task a sprint. Choose work in the modules the engineer owns.
2. **Explain before merge.** For an owned module, the author of record explains the agent's change to a reviewer,
   in their own words, before it merges. If they cannot, the change is not ready.
3. **Rotate end-to-end diff reading.** Each week one person reads every agent diff in a module from start to
   finish, so more than one person holds the picture.
4. **Pair generation with comprehension.** When someone must own the result, they ask the agent to explain the
   code and the trade-offs, and then check the explanation against the code ([IS-1, IS-4](references/sources.md)).
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

- [Pattern 4.7 — Author of Record](#pattern-47--author-of-record): the
  person who must be able to explain the change
- [Pattern 2.13 — Risk-Tiered Review](L2-behavioral-guardrails.md#pattern-213--risk-tiered-review): human
  attention goes where mistakes cost most

**Evidence:** Partial — the trial result is measured in its setting (one vendor-run trial, 52 mostly junior
engineers); evidence for experienced engineers is Thin and no study is longitudinal (IS-1, IS-4, IS-12)

---

**Previous:** [L3: Optimization (optional)](L3-optimization.md) | **Next:** [Earned Autonomy](earned-autonomy.md) |
[Back to Overview](../README.md)
