# Earned Autonomy

How much one workflow may do without a human is a grant. A named person gives it, evidence supports it, and it is withdrawn when the evidence stops. This guide defines the grants, the records that justify them and the checks that enforce them.

The patterns L0 to L4 say whether letting go is safe. They do not say how far a given workflow may go. The A-series patterns in this guide add that. Sources cited by ID (MC-, SG-, and so on) are listed in [the sources page](references/sources.md).

Evidence for this guide is uneven. The grants A1 to A3 follow published practice. The grants A4 and A5, and the promotion, stop-drill and portfolio-review mechanisms, are design proposals with little outside evidence. Each pattern carries its own label, and the labels say so.

## The Grants

A grant belongs to one workflow, not to an agent or a team. One agent may run several workflows at different grants. An interactive developer session is a workflow too.

| Grant | Name | What the workflow may do | Needs a cap of at least |
|-------|------|--------------------------|-------------------------|
| A1 | Assisted | Suggest. A human applies the change. | none |
| A2 | Reviewed | Edit and open pull requests. A human reads every change. | C2 |
| A3 | Gated | Changes pass required checks before a human sees them. A human merges. Every change has a named owner. | C3 |
| A4 | Unattended, reversible | Acts on an event, schedule or backlog within its permitted actions. Has an owner, limits, an audit record and a tested stop. | C4 |
| A5 | Portfolio-managed | A4 plus a baseline, a target, a review date and a stop rule. The grant moves on evidence. The workflow can be retired. | C5 |

A4 applies only where verification is mechanical and the action is reversible. A5 grants no more power than A4. It is A4 managed as an investment, so the top of the scale is the ability to move grants on evidence, not a larger grant.

### The cap rule

The curve C1 to C5 and its seven dimensions are described in the [baseline structure](references/sources.md#baseline-structure). Four dimensions cap unattended work: platform, security and governance, production ownership and measuring value. The cap is the lowest position among those four. No grant may exceed it. A team at C4 on operating model and C2 on production ownership has a cap of C2.

The cap has no exception field. A grant above the cap is a configuration error, and CI fails.

### Why stack tests earn autonomy

Stack tests are what earn autonomy. A4 requires that verification is mechanical: a machine, not the agent and not a tired reviewer, decides whether the change worked. That condition holds only where the workflow's user journey has a stack test ([Pattern 1.1](L1-patterns/1.1-stack-tests.md)) with full-loop assertions ([Pattern 1.2](L1-patterns/1.2-full-loop-assertions.md)) that cannot pass silently ([Pattern 1.6](L1-patterns/1.6-test-integrity.md)). Where the journey has no stack test, verification is partial or a matter of judgement, and the workflow stays at A3 or below however long it has run cleanly.

This is the library's version of a finding that recurs across the research: verification earns delegation (AN-2, AN-3). L1 is the layer that turns "the agent says it worked" into a signal a machine can trust.

## Prerequisites by Grant

A grant needs its row and every row above it.

| Grant | Existing patterns | Containment and ownership patterns | Patterns in this guide |
|-------|-------------------|------------------------------------|------------------------|
| A2 | 0.2 progressive disclosure, 0.3 conceptual organization, 0.4 agent instruction file, 0.6 worktrees, 0.7 docs as system map, 2.4 constitutional rules | Register with owners (4.7 author of record and agent register) | A.1 |
| A3 | 0.5 unit tests as contract, 1.1 to 1.6 and testing infrastructure, 2.2 skill chain, 2.3 hooks, 2.5 zero-defect, 2.6 enforcement pipeline, 4.1 evidence-based claims, 4.5 CI guardrails as required checks | 2.9 contain before you relax, 2.12 supply chain, 2.13 risk-tiered review, a non-author approval rule, a human author-of-record trailer | A.2 |
| A4 | 4.6 context eval as a task bank, 3.8 session lifecycle, 4.4 metrics with thresholds and owners | 2.10 least agency (trifecta gate), 2.11 agent identity, 4.7 register with sponsor, expiry and stop authority | A.3, A.4, A.5, A.6 |
| A5 | 2.8 compound engineering with pruning, 0.8 aggressive cleanup applied to skills and rules, 0.9 new-starter standard | A retirement record per workflow | A.7 |

Layer L3 is on no row. It reduces cost per outcome, which A5 reports, but it is not a safety prerequisite at any grant.

Containment patterns 2.9 to 2.13 and the register pattern 4.7 are named here by number. Read them in the L2 and L4 documents when those sections are present in your copy of the library.

## Pattern A.1 — Autonomy Register

### Problem

Autonomy is granted implicitly. Whoever configures a scheduled agent or turns on auto-merge decides, and nobody can list what runs, at what grant, or who can stop it.

### Solution

One committed, schema-validated file per repository lists every agent workflow and its grant. The file is `.autonomy.yaml`. It is a governance artefact: CODEOWNERS protects it and no agent may write it (Pattern A.6).

Each entry records the owner, an accountable sponsor, the granted and target grant, the trigger, a non-personal identity, permitted and forbidden actions, a risk class, limits, the stop mechanism with the date it was last tested, a review date and a stop rule.

### In Practice

```yaml
# .autonomy.yaml
version: 1
defaults:
  interactive_level: 3
  evidence_window: { min_runs: 30, max_days: 60 }
  review_cadence_days: 90
  stop_test_max_age_days: 30
profile: .autonomy/profile.json   # written by `autonomy census`; never hand-edited

workflows:
  - id: dep-bump
    description: Patch and minor dependency bumps with lockfile regeneration
    owner: team-platform            # resolves in CODEOWNERS
    sponsor: "@alice"               # accountable human; access expires with sponsorship
    granted_level: 4
    target_level: 4
    trigger: schedule:weekly
    identity: github-app:deps-bot   # non-personal, short-lived token
    access_expires: 2027-02-01
    permitted_actions:
      tools: ["Read", "Edit", "Bash(npm install*)", "Bash(npm test*)"]
      paths: ["package.json", "package-lock.json"]
      git: [branch, commit, open_pr, auto_merge]
      network: ["registry.npmjs.org"]
    forbidden_actions: [deploy, read_secrets, force_push, edit_ci, edit_autonomy]
    risk:
      reversible: true              # a revert undoes the action
      verification: mechanical      # mechanical | partial | judgement
      blast_radius: repo            # file | repo | service | external
      trifecta:
        untrusted_input: true       # release notes, changelogs
        sensitive_data: false
        external_action: false
    limits: { max_runs_per_day: 5, max_cost_usd_per_run: 2.00, max_diff_lines: 400 }
    verification:
      required_checks: [unit, stack, context-eval, autonomy-check]
      task_bank: tests/eval/dep-bump.bank.json
    stop:
      mechanism: "gh workflow disable deps-bot.yml; revoke app installation token"
      authority: ["team-platform", "@oncall"]
      last_tested: 2026-11-02       # written by the stop drill, not by hand
    review_date: 2027-02-01
    stop_rule: "retire if < 2 merged PRs/month over 90 days, or cost per merged PR > $5"
```

The schema rules, enforced by `autonomy check` (Pattern A.3):

- A grant of A4 or above requires `stop.last_tested`, `review_date`, `limits`, an `identity` that is not a person, `risk.reversible: true` and `risk.verification: mechanical`.
- A5 additionally requires `stop_rule`, a baseline file and a target.
- A workflow with all three trifecta flags true ([Pattern 2.10](#prerequisites-by-grant)) is rejected at A3 or above unless a deterministic gate is named.
- `owner` must resolve in CODEOWNERS. `sponsor` must be a current member.

Keep the register separate from the harness configuration. The harness file is tuned by developers per rule. The register has different owners, and mixing the two lets a routine harness edit change a grant.

### Anti-Pattern

- A register that lists agents instead of workflows. The same agent runs a low-risk and a high-risk job; one entry hides the difference.
- A register an agent can edit. It can then promote itself.
- Interactive sessions left off the list. They are the most common workflow and the one with the least review.

### Cross-References

- [Pattern 2.4 — Constitutional Rules](L2-behavioral-guardrails.md#pattern-24--constitutional-rules): "no exception field" follows the rule that a rule with exceptions is a guideline.
- Pattern 4.7 (author of record and agent register) is the table form of this register.
- `examples/autonomy/README.md` is the runnable reference for the schema and the `check` command.

**Evidence:** Partial — tiered, per-workflow grants appear in analyst and preprint models, and ownership with expiring access appears in vendor identity governance; the register schema is this library's design (SG-6, SG-26, PO-10, PO-11, MC-21)

## Pattern A.2 — Evidence Ledger

### Problem

Promotion on "consecutive successes" raises a question: who records success? If the agent does, the evidence is self-report. People misjudge their own speed and checking, and an agent's account of its own work is no better (IS-6).

### Solution

An append-only ledger per workflow, written only by CI and by scheduled jobs that observe source control afterwards. One JSON line per run. The agent never writes it.

### In Practice

```json
{"run":"gh-123456","ts":"2026-11-18T03:12:00Z","workflow":"dep-bump","level":4,
 "model":"claude-opus-5-5","harness_hash":"sha256:9f1c...","outcome":"merged",
 "checks":{"unit":"pass","stack":"pass","context-eval":0.94},
 "first_run_pass":true,"human_interventions":0,"diff_lines":212,"cost_usd":0.83,
 "reverted_at":null,"rework_commits_14d":0,"escaped_defect":false}
```

The ledger lives at `.autonomy/ledger/<workflow>.jsonl` on a bot-only branch or in an artefact store, which keeps the main branch history clean.

Three fields arrive late. A nightly job fills `reverted_at` (it scans for reverts), `rework_commits_14d` (follow-up commits touching the same lines) and `escaped_defect` (issues linked to the merge commit). Revert count alone is easy to game: do not revert. Rework and escaped defects close that gap.

`harness_hash` covers the model id, the agent instruction file, `.claude/**`, skills, hooks and the harness configuration. A change to it is a release of the workflow. The workflow is capped at A3 until its task bank passes on the new hash.

The `autonomy ledger` command reads a ledger and prints the evidence report that a promotion pull request attaches (Pattern A.3).

### Anti-Pattern

- Counting runs the agent reports as successful.
- A ledger on the main branch that the workflow itself can push to.
- Measuring only reverts. Silent rework and escaped defects then count as success.

### Cross-References

- [Pattern 4.1 — Evidence-Based Claims](L4-standards-measurement.md#pattern-41--evidence-based-claims): completion evidence comes from systems the agent cannot edit.
- [Pattern 4.6 — Context Eval](L4-standards-measurement.md#pattern-46--context-eval): the task bank is both a ledger field and a promotion criterion.
- `examples/autonomy/README.md` documents the `ledger` command and the record format.

**Evidence:** Partial — the need for evaluation against task banks and for evidence over self-report is supported; the record fields and the 14-day rework window are this library's design (IS-6, MV-9, MC-21)

## Pattern A.3 — Promotion, Demotion and the Cap Gate

### Problem

If grants rise on a feeling and fall only after an incident, autonomy ratchets up and nobody can say why. A per-agent trust tier that promotes on a short run of successes can be promoted by chance.

### Solution

Promotion is slow and human. Demotion is fast and automatic. A required CI check, `autonomy check`, ties every grant to the cap.

The grant a workflow actually holds at runtime is the lowest of five values:

```text
effective = min(
  granted_level,
  cap(profile),          # lowest of the four capping dimensions (Pattern A.4)
  freshness_gate,        # A2 if the stop test, review date, owner or access is out of date
  harness_gate,          # A3 until the task bank passes on the current harness_hash
  demotion_override      # written by the demotion job
)
```

### In Practice

**Promotion** moves up one grant at a time, always by a human.

- Only through a pull request that changes `granted_level` in the register.
- CI attaches an evidence report computed from the ledger over the evidence window.
- The owner team and someone other than the author approve. An agent identity never approves.
- No promotion within 30 days of a demotion.
- Thresholds use the Wilson 95% confidence bound, not the raw rate, so five lucky runs cannot promote.

The criteria below are illustrative defaults. Each team sets its own per workflow.

| To | Criteria over the evidence window |
|----|----------------------------------|
| A3 | At least 20 runs at A2. First-run pass rate on required checks has a lower bound of 0.80 or more. A traced sample of 10 runs shows substantive human review. An owner is named. |
| A4 | At least 30 runs at A3. First-run pass lower bound of 0.90 or more. Revert rate upper bound of 3% or less. Zero escaped defects. Task bank scores 0.90 or more on the current harness. The work is reversible and mechanically verified. A stop drill passed within 30 days. Cap of C4 or higher. |
| A5 | At least 90 days at A4. Baseline, target and stop rule are set. Cost per merged outcome is reported. One review cycle has a recorded decision. Cap of C5. |

**Demotion** is automatic and immediate. Any one trigger is enough:

- An escaped defect of severity S2 or worse, or any incident linked to the workflow.
- A revert rate upper bound above 6% over the trailing window. The gap between 3% to promote and 6% to demote prevents oscillation.
- A task bank score below its floor, or a changed `harness_hash` without a passing task-bank run.
- A stop drill that is overdue, a passed review date, an invalid owner or sponsor, or expired access.
- A breached limit (cost, run count, diff size) or an attempted forbidden action.

A bot writes the demotion to `.autonomy/state.json` so it applies without waiting for review, and opens a pull request to reconcile the register. Demotion drops to A3, or to A2 after an incident.

This inverts the ratchet in [Pattern 1.1](L1-patterns/1.1-stack-tests.md): autonomy loosens only on evidence and human sign-off, and tightens automatically.

**The cap gate.** `autonomy check` is a required status check. It fails when:

- Any `granted_level` exceeds the computed cap. There is no exception field.
- Any schema rule in Pattern A.1 fails.
- `.autonomy.yaml`, `.autonomy/**`, CODEOWNERS, branch-protection workflows or hook configuration changed in a commit by an agent identity.
- The census profile is older than 30 days.

### Anti-Pattern

- Promoting on a raw success rate over a handful of runs.
- A symmetric rule where promotion and demotion are equally automatic. Trust is cheap to lose and costly to earn; the rules should reflect that.
- A waiver label that skips the cap gate. Once it exists, it is used.

### Cross-References

- [Pattern 4.5 — CI Guardrails](L4-standards-measurement.md#pattern-45--ci-guardrails): `autonomy check` is a required check.
- [Pattern 2.4 — Constitutional Rules](L2-behavioral-guardrails.md#pattern-24--constitutional-rules): no escape hatches.
- `examples/autonomy/README.md` documents `check` and the effective-level calculation.

**Evidence:** Thin — confidence-bound promotion and automatic demotion are this library's own design; the thresholds are illustrative, and no published study validates them (SG-6, MC-21, AN-27)

## Pattern A.4 — Census

### Problem

Placing a team on the curve by questionnaire is weak: people over-report, and presence of a document is mistaken for practice (MC-22). A repository can compute part of its own profile from its artefacts. It cannot see everything.

### Solution

A census command probes the repository and writes `.autonomy/profile.json`. Each probe checks presence and practice: when the artefact last changed, whether CI refers to it, whether the ledger exercises it. A dimension the repository cannot evidence is recorded as `unknown`, and `unknown` counts as C2 for the cap. Missing evidence lowers autonomy rather than being ignored.

### In Practice

Examples of probes at C3 for the capping dimensions:

| Dimension | C3 probe |
|-----------|----------|
| Platform | A check command is named in the instruction file and run by a required CI job. The CI agent uses an app or OIDC identity, not a personal key. The sandbox is enabled and locked in committed settings. |
| Security and governance | Skills, plugins and MCP servers are pinned. Branch protection requires a non-author approver. Secret scanning is on. |
| Production ownership | Owners in the register resolve to teams. Sponsors are current. Access expiry is set. Agent commits carry a human author-of-record trailer. |
| Measuring value | A baseline file holds pre-change flow and stability metrics. A trend is reviewed each quarter. |

Operating-model and skill dimensions cannot be read from files. For those, the census emits a worksheet (a merge sample, a traced sample, a work sample) and records the dated result. A stale result reverts to `unknown`.

Output, trimmed:

```json
{
  "generated": "2026-11-19T02:00:00Z",
  "dimensions": {
    "platform":   {"level": 3, "evidence": ["ci:check-command", "settings:sandbox-locked"]},
    "governance": {"level": 2, "missing_for_next": ["skills-pinned", "non-author-approval"]},
    "ownership":  {"level": 3, "evidence": ["autonomy.yaml:owners-resolve"]},
    "measuring":  {"level": "unknown", "counted_as": 2}
  },
  "cap": 2,
  "workflows_over_cap": []
}
```

The cap is 2 here because governance is C2 and measuring is unknown. The `missing_for_next` list is the work that raises it.

### Anti-Pattern

- Counting a file's existence as practice. An untouched instruction file proves nothing.
- Hand-editing the profile. It is a measurement.
- Treating a computed profile as a full assessment. Culture, skill and judgement stay outside it.

### Cross-References

- [Pattern 0.9 — AI-as-New-Starter Standard](L0-foundation.md#pattern-09--ai-as-new-starter-standard): a human audit complements the census.
- `examples/autonomy/README.md` documents the `census` command and its probes.

**Evidence:** Partial — placing an organization by artefacts and records instead of self-report is supported, and the cap rule is the baseline's own inference; the probe set is this library's design (MC-22, MC-11)

## Pattern A.5 — Tested Stop

### Problem

Every A4 workflow has a documented stop, and most documented stops were never run. A kill switch that has not been exercised may not work, and the first time it is tried is during an incident.

### Solution

Exercise the stop on a schedule. A monthly drill triggers the stop mechanism against a canary run, asserts that the run halts within a bound and that tokens are revoked, then restores the workflow and writes `stop.last_tested`. A failed or overdue drill demotes the workflow.

### In Practice

The command is `autonomy drill`. It runs a canary workflow (a loop that writes a heartbeat file), triggers the documented stop and checks three things: the heartbeat stopped within the time bound, credentials were revoked, and the workflow restores. Only the drill job writes the `last_tested` date. A person cannot set it.

The stop needs an authority: the register names who may invoke it. The authority must include someone reachable outside working hours.

### Anti-Pattern

- A runbook that says "disable the workflow" and has never been followed.
- A drill that stops the canary but does not check token revocation. A stopped agent with a live token is still a risk.
- A `last_tested` date set by hand.

### Cross-References

- Pattern 4.7 (author of record and agent register) records stop authority.
- [Pattern A.3](#pattern-a3--promotion-demotion-and-the-cap-gate): an overdue drill lowers the freshness gate.
- `examples/autonomy/README.md` documents `drill`.

**Evidence:** Thin — vendor guidance asks for rehearsed rollback but not a tested stop for the agent itself, and the research baseline found nothing on whether kill switches work; the drill is this library's design (AN-27)

## Pattern A.6 — Enforcement Through Hooks

### Problem

A grant in a file is a statement. If the tool layer does not enforce it, the agent can exceed it, or edit the file that holds it.

### Solution

Bind the register to the harness. Three hooks and one eval suite make the effective grant real.

- **SessionStart** resolves the workflow id (from `AUTONOMY_WORKFLOW` in CI, otherwise `interactive`), loads the register, the profile and the state file, computes the effective grant and prints it with the reason for any reduction.
- **PreToolUse** denies any tool call outside `permitted_actions` or inside `forbidden_actions`. The grant sets the limits: A1 and A2 block `git push`, merging and network egress beyond the allowlist. A3 allows pushing to unprotected branches and opening pull requests, and blocks merging. A4 allows auto-merge only within the diff-size and path limits. A session that has read untrusted input and holds sensitive data cannot take an external action without the named gate.
- **PostToolUse** appends to `.autonomy/audit/<session>.jsonl`: agent identity, requesting human, tool, a hash of the parameters and the outcome.
- **Context eval** gains an `autonomy` suite covering A2, A3, A4, a cap below the grant, a stale stop and a trifecta session. It scores exactly, not on a graduated scale. It tests the gate, so a refactor cannot widen grants silently.

### In Practice

The hooks block agent writes to `.autonomy*`, CODEOWNERS, `.github/workflows/*` and hook or harness configuration. An agent cannot promote itself or weaken its own gate.

A hook is deterministic policy inside the harness. It is not a security boundary: a workflow that can run arbitrary code can in principle route around it. Hooks hold the grant only together with the sandbox and credential scope of Pattern 2.9 and the agent identity of Pattern 2.11.

### Anti-Pattern

- Hooks that warn instead of block for grant limits.
- Putting the register inside the harness configuration. A routine tuning change then edits a grant.
- Relying on hooks alone where credentials can do the same work outside the harness.

### Cross-References

- [Pattern 2.3 — Hook Automation](L2-behavioral-guardrails.md#pattern-23--hook-automation) and [Pattern 2.6 — Enforcement Pipeline Composition](L2-behavioral-guardrails.md#pattern-26--enforcement-pipeline-composition): the new check joins the existing pipeline.
- [Pattern 4.6 — Context Eval](L4-standards-measurement.md#pattern-46--context-eval): the `autonomy` suite.
- `examples/autonomy/README.md` documents the hook binding.

**Evidence:** Strong for the mechanism, Thin for outcomes — deterministic hooks, scoped permissions and least agency are documented by vendors and standards bodies; whether an autonomy-grant hook reduces incidents is untested (SG-11, SG-16, OM-18, SC-8)

## Pattern A.7 — Portfolio Review

### Problem

Workflows accumulate. Some earn their cost, some stop being used, some drift. Without a scheduled look, a granted workflow stays granted because nobody asked.

### Solution

At each `review_date` a scheduled job opens one issue per workflow. The issue shows the ledger trend, cost per merged outcome against the baseline, the demotion history and the stop rule evaluated. The owner records one decision: keep, promote, demote or retire.

### In Practice

Retirement deletes the workflow's register entry and revokes its identity. Version control is the archive ([Pattern 0.8](L0-foundation.md#pattern-08--aggressive-cleanup)). The same review prunes the skills and rules the workflow used. A review with no recorded decision lowers the freshness gate until one is recorded.

### Anti-Pattern

- Renewing every workflow by default.
- A review that checks only activity (runs, tokens) and not outcomes against the baseline.
- Retiring the entry but leaving the credentials live.

### Cross-References

- [Pattern 2.8 — Compound Engineering](L2-behavioral-guardrails.md#pattern-28--compound-engineering): capture and pruning belong together.
- [Pattern 4.4 — Agentic Development Metrics](L4-standards-measurement.md#pattern-44--agentic-development-metrics): thresholds, actions and owners.
- `examples/autonomy/README.md` documents the register fields this review reads.

**Evidence:** Thin — no canonical framework for portfolio review of agent workflows exists in the research; this pattern is the library's own proposal (PO-15)

## Where the Evidence Stands

- A1 to A3 follow published practice on tiering, review and gated delegation.
- The one defended example of unattended work is maintenance where verification is mechanical and the action reversible: Spotify's auto-merged maintenance pull requests (MC-21). Neither the research baseline nor the vendor guidance found unattended incident repair.
- The thresholds, hysteresis, cooldown and drill cadence are illustrative. Tune them from your own ledger.
- A.3, A.5 and A.7 are Thin. Treat them as designs to test, not settled practice.

## Related Documents

- [L1: Closed Loop Design and Verification](L1-feedback-loops.md): the layer that makes verification mechanical.
- [L2: Behavioral Guardrails](L2-behavioral-guardrails.md): hooks, constitutional rules and enforcement.
- [L4: Standards and Measurement](L4-standards-measurement.md): evidence, context eval, metrics.
- [Adoption Guide](cross-cutting/adoption-guide.md): when a team is ready for A3 and A4.
- [Glossary](cross-cutting/glossary.md): grant, register, ledger, census, cap rule, tested stop.
- Runnable reference: `examples/autonomy/README.md` (commands `check`, `census`, `ledger`, `drill`).

---

[Back to Overview](../README.md)
