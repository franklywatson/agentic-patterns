---
last-validated-model: claude-opus-5-5
reviewed: 2026-11-19
---

# Earned Autonomy

This guide is for whoever decides how much an agent workflow may do without a person. A grant (A1 to A5) is what
one workflow may do: a named person gives it, CI evidence supports it, and it falls automatically when the evidence
stops. No grant may exceed the repository's cap, the lowest of four positions on the curve C1 to C5. A new
repository starts with a cap of C1, which allows only read-only A1 sessions; [Reaching C2](#reaching-c2) lists the
four changes that allow an agent to edit files.

Evidence is uneven. The grants A1 to A3 match published tiered-autonomy models (SG-26, SG-6). A4, A5, the curve, the
grid, the cap rule, promotion, demotion, the census and the stop drill are this library's design, drawn in part from
the author's unpublished research synthesis; no published study validates them. Every threshold here is
illustrative: tune it from your own ledger. Sources cited by ID are listed on [the sources page](references/sources.md).

## The Curve and the Cap

The curve C1 to C5 places a repository on each of seven dimensions separately. The census ([Pattern
A.4](#pattern-a4--census)) reads one repository and writes its profile, and `autonomy check` compares that
repository's register with that profile. A team that owns several repositories runs the census in each and compares
the profiles; a workflow that acts in several repositories needs a grant within the cap of each.

The top of the curve is the ability to raise a named workflow's grant on evidence, show the evidence, and lower it
again. It is not "most agents" or "no humans".

### The Curve

| Position | Name | Defined by |
|----------|------|------------|
| C1 | Individual | People use AI as they choose. Nothing is shared or committed. |
| C2 | Grounded | Approved tools, committed shared context, and every agent change read by a human. |
| C3 | Verified delegation | Autonomy chosen per task. Agent changes pass automated checks before a human sees them. Skills and instructions are versioned and reviewed. Every agent change has a named owner. |
| C4 | Governed autonomy | Agents run unattended on events, schedules or a backlog, each workflow with an owner, permitted actions, limits, an audit record and a tested stop. Controls are enforced by the system. |
| C5 | Self-correcting | Workflows are managed as a portfolio with cost, value, risk and a review date, and some are retired. Autonomy is extended or withdrawn per workflow on evidence. Shared context is pruned as well as grown. |

### The Grid

Each row is one dimension. The [sources page](references/sources.md#chapters) names the synthesis chapter behind each.

| Dimension | C1 | C2 | C3 | C4 | C5 |
|-----------|----|----|----|----|----|
| Platform | Personal keys; agents cannot be listed | Agents and keys listed and mapped to teams | Agent identity from a template; one gateway; a check command CI runs | Isolation by default; delegated actions audited; loop alerts | Contribution path for tools and skills; vendor change touches configuration only |
| Shared context | Knowledge in heads and chats | Instruction files committed, often long and untested | Short, owned, tested files; hard rules in hooks | Governed connectors; permissions enforced at query time | Layered, owned, expiring; re-baselined when models change |
| Team operating model | Private use; no stated stance | Written stance; one human review per PR | Conventions as checks; automated plus human review | Review depth by risk; sandboxed loops; agent first-pass on incidents | Unattended work routine; process retired when its gap closes |
| Security and governance | Unvetted tools; broad access | Policy written; nearly every prompt approved | Sandboxed, scoped, vetted; agent PRs pass the same gates | Autonomy tiers; risky combinations gated; deterministic policy | Controls tested against adaptive attacks; tiers change with evidence |
| Production ownership | Nobody can list or stop agents | Inventory with individual owners | Sponsor per agent; expiring access; human author of record | Changes eval-gated and versioned; stop and restore authority assigned | Automatic handover and retirement; shared tooling owned as a product |
| Individual and team skill | Habit; nobody can say how output is checked | Engineers state what they hand over | Output checked against specs and tests; debugging practiced; reviewed skills shared | Work broken down for unattended agents; supervision by outcome and exception; failure drills | Pruning, protected practice, autonomy raised only with feedback loops |
| Measuring value | Counting use | Measuring speed | Flow and stability against a baseline | Task banks, leading indicators, maintained configuration | Baseline, target, review date and stop rule per investment |

### The Cap Rule

Four dimensions cap unattended work: platform, security and governance, production ownership and measuring value.
The cap is the lowest position among those four, and no grant may exceed it: a repository at C4 on operating model and
C2 on production ownership has a cap of C2. The cap has no exception field. A grant above the cap is a configuration
error, and `autonomy check` fails CI ([Pattern A.3](#pattern-a3--promotion-demotion-and-the-cap-gate)).

The cap comes from the repository's own census, not from this library or from the patterns a team has adopted. A
dimension whose probes find no evidence is at C1. Only individual skill, which no file shows, can be `unknown`; it
counts as C2 and does not cap.

### Reaching C2

A new repository is at C1 on the four capping dimensions, so its cap is C1 and only A1 is allowed. In the example hook
an A1 session may use read-only tools only, so an agent session that edits files needs A2, and A2 needs a cap of C2.
Each capping dimension reaches C2 when one probe of the example census passes:

| Dimension | Probe | Passes when | What it takes |
|-----------|-------|-------------|---------------|
| Platform | `agent-config` | `.claude/`, `AGENTS.md` or `.harness.yaml` exists | One committed file or directory |
| Security and governance | `constitutional-rules` | "constitutional" appears in CLAUDE.md, in an AGENTS.md that CLAUDE.md imports with `@AGENTS.md`, or in AGENTS.md when there is no CLAUDE.md | A rules section whose rules each name an enforcement point ([Pattern 2.4](L2-behavioral-guardrails.md#pattern-24--constitutional-rules)) |
| Production ownership | `register-owners` | `.autonomy.yaml` lists at least one workflow and each has an owner | A register entry per workflow, `interactive` included, with an owner who accepts the role ([Pattern A.1](#pattern-a1--autonomy-register)) |
| Measuring value | `outcome-tracking` | `.autonomy/baseline.json` or a file in `.autonomy/ledger/` exists | A first baseline of the repository's flow and stability numbers, such as cycle time and revert rate ([Pattern 4.4](L4-standards-measurement.md#pattern-44--agentic-development-metrics)) |

Commit the four together, then run `autonomy census` and `autonomy check`. A register that does not list
`interactive` grants it A2 (`defaults.interactive_level`), so `check` fails until the cap reaches C2. C3 on measuring
value needs a baseline with non-empty `flow` and `stability` objects captured within 90 days; until one exists, the
cap stays at C2 or below and no grant exceeds A2. What a passed probe proves is in [Pattern A.4](#pattern-a4--census).

## The Grants

A grant belongs to one workflow, not to an agent or a team. One agent may run several workflows at different grants.
An interactive developer session is a workflow too.

| Grant | Name | What the workflow may do | Needs a cap of at least |
|-------|------|--------------------------|-------------------------|
| A1 | Assisted | Suggest, with read-only tools. A human applies the change. | none |
| A2 | Reviewed | Edit files and commit in a working tree. A human reads every change, pushes the branch and opens the pull request. | C2 |
| A3 | Gated | Pushes branches and opens pull requests. Changes pass required checks before a human sees them. A human merges. Every change has a named owner. | C3 |
| A4 | Unattended, reversible | Acts on an event, schedule or backlog within its permitted actions, and may merge with no human. Has an owner, limits, an audit record and a tested stop. | C4 |
| A5 | Portfolio-managed | A4 plus a baseline, a target, a review date and a stop rule. The grant moves on evidence. The workflow can be retired. | C5 |

A4 applies only where verification is mechanical and the action is reversible. Which change classes merge with no
person at A4 and A5, and which review tier each class gets, is the [risk
model](L1-patterns/1.8-reversibility-blast-radius.md#risk-model). In what it may merge, A5 adds only R2 changes on
named paths to A4. The register stores a grant as a number (`granted_level: 4` is A4).

### Why Stack Tests Earn Autonomy

In this library, stack tests are what earn autonomy. A4 requires mechanical verification: a machine, not the agent and
not a tired reviewer, decides whether the change worked. That holds only where the workflow's user journey has a stack
test ([Pattern 1.1](L1-patterns/1.1-stack-tests.md)) with full-loop assertions ([Pattern
1.2](L1-patterns/1.2-full-loop-assertions.md)) that cannot pass silently ([Pattern
1.6](L1-patterns/1.6-test-integrity.md)). Without one, verification is partial or a matter of judgment, and the
workflow stays at A3 or below however long it has run cleanly. This reading rests on vendor guidance that an agent
with a check to run does better work (AN-3, OM-9) and on one company's unattended maintenance, which runs where checks
are mechanical (MC-21).

## Prerequisites by Grant

A grant needs its row, every row above it and the cap in [The Grants](#the-grants). This table is the readiness
list for each grant; other docs link here and do not repeat it.

| Grant | Layer patterns | Containment and ownership patterns | Patterns in this guide |
|-------|----------------|------------------------------------|------------------------|
| A2 | [0.2](L0-foundation.md#pattern-02--progressive-disclosure) progressive disclosure, [0.4](L0-foundation.md#pattern-04--agent-instruction-file-as-project-constitution) agent instruction file, [0.6](L0-foundation.md#pattern-06--git-worktree-based-development) worktrees, [0.7](L0-foundation.md#pattern-07--documentation-as-system-map) docs as system map, [2.4](L2-behavioral-guardrails.md#pattern-24--constitutional-rules) constitutional rules | Register with owners (A.1), [4.7](L4-standards-measurement.md#pattern-47--author-of-record-and-agent-register) author of record | A.1 |
| A3 | [0.5](L0-foundation.md#pattern-05--unit-tests-as-contract) unit tests as contract, [1.1](L1-patterns/1.1-stack-tests.md) to [1.6](L1-patterns/1.6-test-integrity.md) stack tests and test integrity, [2.3](L2-behavioral-guardrails.md#pattern-23--hook-automation) hooks and check composition, [2.5](L2-behavioral-guardrails.md#pattern-25--zero-defect-tolerance) zero-defect, [4.1](L4-standards-measurement.md#pattern-41--evidence-based-claims) evidence-based claims, [4.5](L4-standards-measurement.md#pattern-45--ci-guardrails) CI guardrails as required checks | [2.9](L2-behavioral-guardrails.md#pattern-29--contain-before-you-relax) contain before you relax, [2.12](L2-behavioral-guardrails.md#pattern-212--skill-plugin-and-mcp-supply-chain) supply chain, [2.13](L2-behavioral-guardrails.md#pattern-213--risk-tiered-review) risk-tiered review, a non-author approval rule, a human author-of-record trailer | A.2 |
| A4 | [4.4](L4-standards-measurement.md#pattern-44--agentic-development-metrics) metrics with thresholds and owners, [4.6](L4-standards-measurement.md#pattern-46--context-eval) context eval as a task bank | [2.10](L2-behavioral-guardrails.md#pattern-210--least-agency-and-session-composition) least agency (trifecta gate), [2.11](L2-behavioral-guardrails.md#pattern-211--agent-identity-and-delegation) agent identity, register entries with sponsor, expiry and stop authority | A.3, A.4, A.5, A.6 |
| A5 | [2.8](L2-behavioral-guardrails.md#pattern-28--compound-engineering) compound engineering with pruning, [0.8](L0-foundation.md#pattern-08--aggressive-cleanup) aggressive cleanup applied to skills and rules, [0.9](L0-foundation.md#pattern-09--ai-as-new-starter-standard) new-starter standard | A retirement record per workflow | A.3 review |

Layer L3 is on no row. It reduces cost per outcome, which A5 reports, but it is not a safety prerequisite at any grant.

## Pattern A.1 — Autonomy Register

### Problem

Autonomy is granted implicitly. Whoever configures a scheduled agent or turns on auto-merge decides, and nobody can list what runs, at what grant, or who can stop it.

### Solution

One committed, schema-validated file per repository lists every agent workflow and its grant. The file is `.autonomy.yaml`. It is a governance artifact: CODEOWNERS protects it and no agent may write it (Pattern A.6).

Each entry records the owner, an accountable sponsor, the grant, a non-personal identity, permitted and forbidden
actions, a risk class, limits, the stop mechanism with the date it was last tested, and a review date. A5 adds a
baseline, a target and a stop rule.

### In Practice

```yaml
# .autonomy.yaml
version: 1
defaults: { interactive_level: 3, stop_test_max_age_days: 30 }
profile: .autonomy/profile.json   # written by `autonomy census`; never hand-edited

workflows:
  - id: dep-bump
    owner: team-platform            # should resolve in CODEOWNERS
    sponsor: "@alice"               # accountable human
    granted_level: 4                # A4
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
      trifecta: { untrusted_input: true, sensitive_data: false, external_action: false }
    limits: { max_runs_per_day: 5, max_cost_usd_per_run: 2.00, max_diff_lines: 400 }
    stop:
      mechanism: "gh workflow disable deps-bot.yml; revoke app installation token"
      command: 'touch "$AUTONOMY_STOP_FILE"'   # the drill runs it and checks the canary stopped
      authority: ["team-platform", "@oncall"]
      last_tested: 2026-11-02       # written by the stop drill, not by hand
    review_date: 2027-02-01
```

The schema rules for each grant are in [the example README](../examples/autonomy/README.md#the-register). No tool
checks that a sponsor is current; whether each owner appears in CODEOWNERS is a census probe, not a check.

Keep the register separate from the harness configuration. The harness file is tuned by developers per rule. The register has different owners, and mixing the two lets a routine harness edit change a grant.

### Anti-Pattern

- A register that lists agents instead of workflows. The same agent runs a low-risk and a high-risk job; one entry hides the difference.
- A register an agent can edit. It can then promote itself.
- Interactive sessions left off the list. They are workflows too, and the one most developers run.

### Cross-References

- [Pattern 4.7](L4-standards-measurement.md#pattern-47--author-of-record-and-agent-register) names the human author of
  record for agent commits.

**Evidence:** Partial — tiered, per-workflow grants appear in analyst and preprint models, and ownership with expiring access appears in vendor identity governance; the register schema is this library's design (SG-6, SG-26, PO-10, PO-11)

## Pattern A.2 — Evidence Ledger

### Problem

Promotion on "consecutive successes" raises a question: who records success? If the agent does, the evidence is
self-report, and agents mark work complete when it is not (IS-15, OM-9).

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

The ledger lives at `.autonomy/ledger/<workflow>.jsonl` on a bot-only branch or in an artifact store, which keeps the main branch history clean.

Three fields arrive late. A nightly job fills `reverted_at` (it scans for reverts), `rework_commits_14d` (follow-up commits touching the same lines) and `escaped_defect` (issues linked to the merge commit). Revert count alone is easy to game: do not revert. Rework and escaped defects close that gap.

`harness_hash` covers the model id, the effort level, the agent instruction file, `.claude/**`, skills, hooks and the
harness configuration. A change to it is a release of the workflow. The workflow is capped at A3 until its [task
bank](L4-standards-measurement.md#pattern-46--context-eval) passes on the new hash. The `context-eval` check in the
record is the task-bank score that Pattern 4.6 defines: the share of tasks that pass at pass^k.

The example `autonomy ledger` command prints the evidence report a promotion pull request attaches (Pattern A.3); it
ships no nightly job.

### Anti-Pattern

- Counting runs the agent reports as successful.
- A ledger on the main branch that the workflow itself can push to.
- Measuring only reverts. Silent rework and escaped defects then count as success.

### Cross-References

- [Pattern 4.1 — Evidence-Based Claims](L4-standards-measurement.md#pattern-41--evidence-based-claims): completion evidence comes from systems the agent cannot edit.
- [examples/autonomy/README.md](../examples/autonomy/README.md#ledger) documents the `ledger` command and the fields it reads.

**Evidence:** Partial — vendor guidance supports evaluation against task banks, and agents report work complete when it is not; the record fields and the 14-day rework window are this library's design (IS-15, OM-9, MV-9)

## Pattern A.3 — Promotion, Demotion and the Cap Gate

### Problem

If grants rise on a feeling and fall only after an incident, autonomy ratchets up and nobody can say why. A per-agent
trust tier that promotes on a short run of successes can be promoted by chance. A workflow that is never reviewed
stays granted because nobody asked.

### Solution

Promotion is slow and human. Demotion is fast and automatic. A scheduled review decides whether each workflow keeps
its grant. The grant a workflow holds at runtime is the lowest of five values:

```text
effective = min(granted_level, cap(profile), freshness_gate, harness_gate, demotion_override)
```

The freshness gate is A2 when the stop test is overdue, the review date or access has passed, or the census profile is
stale or missing. The harness gate is A3 until the task bank passes on the current `harness_hash`. The demotion
override comes from the demotion job or a failed stop drill.

### In Practice

**Promotion** moves up one grant at a time, always by a human.

- Only through a pull request that changes `granted_level` in the register.
- CI attaches an evidence report computed from the ledger over the evidence window.
- The owner team and someone other than the author approve after reading the evidence report and the census profile
  (Pattern A.4). An agent identity never approves.
- No promotion within 30 days of a demotion.
- Thresholds use the Wilson 95% confidence bound, not the raw rate, so five lucky runs cannot promote.

The criteria below are illustrative defaults. Each team sets its own per workflow.

| To | Criteria over the evidence window |
|----|----------------------------------|
| A3 | At least 20 runs at A2. First-run pass rate on required checks has a lower bound of 0.80 or more. A traced sample of 10 runs shows substantive human review. An owner is named. |
| A4 | At least 30 runs at A3 (the minimum sample, not enough alone: zero reverts clears the 3% revert upper bound at about 125 merged runs). First-run pass lower bound of 0.90 or more. Revert rate upper bound of 3% or less. Zero escaped defects. Task bank scores 0.90 or more on the current harness. The work is reversible and mechanically verified. A stop drill passed within 30 days. Cap of C4 or higher. |
| A5 | At least 90 days at A4. Baseline, target and stop rule are set. Cost per merged outcome is reported. One review cycle has a recorded decision. Cap of C5. |

**Demotion** is automatic and immediate. Any one trigger is enough. In parentheses: how the example implements it.

- An escaped defect or a linked incident, to A2 (`autonomy ledger`, escaped defects only).
- A revert rate upper bound above 6% over the trailing window, to A3 (`autonomy ledger`). The gap to the 3% promote
  threshold prevents oscillation.
- A task bank score below its floor, to A3 (`autonomy ledger`), or a changed `harness_hash` without a passing run (the
  harness gate).
- A breached cost, run-count or diff-size limit, to A3 (`autonomy ledger`).
- An overdue stop drill, a passed review date or expired access (the freshness gate, A2), or a failed drill (an A3
  override written by `autonomy drill`).
- An invalid owner or sponsor, or an attempted forbidden action (not implemented; the hook denies the action).

`autonomy ledger --apply-demotion` writes the override to `.autonomy/state.json`, so it applies without waiting for
review. A production demotion job also opens a pull request that reconciles the register.

**Review.** At each `review_date` a scheduled job opens one issue per workflow with the ledger trend, cost per merged
outcome against the baseline, the demotion history and the stop rule evaluated. The owner records one decision: keep,
promote, demote or retire. Retirement deletes the register entry and revokes the identity ([Pattern
0.8](L0-foundation.md#pattern-08--aggressive-cleanup)); the review also prunes the skills and rules the workflow used
([Pattern 2.8](L2-behavioral-guardrails.md#pattern-28--compound-engineering)). The example ships no review job; the
census counts `.autonomy/reviews.jsonl` and `.autonomy/retirements.jsonl` as the record.

**The cap gate.** `autonomy check` is a required status check. It fails when a grant exceeds the cap, the register
fails its schema, the census profile is stale or missing, or an agent identity changed a governance file (Pattern
A.6). The failure codes are in [the example README](../examples/autonomy/README.md#effective-grant).

### Anti-Pattern

- Promoting on a raw success rate over a handful of runs.
- A symmetric rule where promotion and demotion are equally automatic. Trust is cheap to lose and costly to earn; the rules should reflect that.
- A waiver label that skips the cap gate. Once it exists, it is used.
- Renewing every workflow at review by default, or reviewing activity (runs, tokens) instead of outcomes against the
  baseline.
- Retiring the register entry but leaving the credentials live.

### Cross-References

- [Pattern 4.5 — CI Guardrails](L4-standards-measurement.md#pattern-45--ci-guardrails): `autonomy check` is a required check.
- [Pattern 4.4 — Agentic Development Metrics](L4-standards-measurement.md#pattern-44--agentic-development-metrics):
  thresholds, actions and owners for the review.

**Evidence:** Thin — confidence-bound promotion and automatic demotion are this library's design and the thresholds are illustrative; AWS guidance calls for an agent registry, named owners and quarterly portfolio reviews, and Microsoft guidance for retirement criteria and cost per outcome, but no study validates either (SG-6, AN-27, PO-12, PO-14)

## Pattern A.4 — Census

### Problem

Placing a repository on the curve by questionnaire is weak: in one 2025 trial, self-reported speed ran opposite to measured
speed (IS-6), and most committed AI configuration files are never changed after they are added (MC-11), so a file's
presence says little about practice. A repository can compute part of its own profile from its artifacts. It cannot
see everything.

### Solution

A census command reads one repository's files and writes `.autonomy/profile.json`. A dimension's position is the
highest whose probes all pass, with each lower position passing first; a dimension with no evidence is at C1. The
census proves presence and recency, not quality: a probe checks that a file exists, has the expected keys, changed
within 90 days or is named in a CI workflow, and a stub file can pass it. The profile is evidence a human reviews: the
reviewer of a promotion pull request reads the files behind each passed probe.

Individual skill has no file probe. The census writes a worksheet (a work sample and a perception survey, plus human
checks for other dimensions such as a merge sample) and records skill as `unknown` until a dated result exists; a
result older than 90 days reverts to `unknown`.

### In Practice

The C3 probes for the capping dimensions in the example census:

| Dimension | C3 probes |
|-----------|-----------|
| Platform | A check command (`npm test`, `pytest`, `make check` and similar) is named in CLAUDE.md and in a CI workflow. CI uses no `*API_KEY` secret, or grants `id-token: write` (OIDC). The sandbox is enabled and `allowUnsandboxedCommands` is false in `.claude/settings.json`. |
| Security and governance | The sandbox is locked as above. Permission deny rules exist. Skills, plugins and MCP servers are pinned by SHA-256 in `.claude/pins.json`. A committed ruleset requires an approving review. Secret scanning runs in CI. |
| Production ownership | Every register owner appears in CODEOWNERS. Every workflow has a sponsor, and every A4 workflow an access expiry. CLAUDE.md names an author-of-record or `Co-Authored-By` trailer, or a `.gitmessage` exists. |
| Measuring value | `.autonomy/baseline.json` holds non-empty `flow` and `stability` objects captured within 90 days. |

Limitation: `sandbox-locked` reads only the project `.claude/settings.json`, which an agent can edit. `autonomy
check` fails an agent commit that changes it and the example hook denies a hooked session's writes (Pattern A.6), but
the probe cannot see whether developer machines enforce the same keys. [Pattern
2.9](L2-behavioral-guardrails.md#pattern-29--contain-before-you-relax) keeps the enforcing copy in managed or user
settings, which the census cannot read; commit the same keys to the project file as the declaration the census reads.

### Anti-Pattern

- Reading a passed probe as practice. A stub file or an untouched instruction file passes and proves nothing.
- Hand-editing the profile. The census writes it; a reviewer reads the files behind it.
- Treating a computed profile as a full assessment. Culture, skill and judgment stay outside it.

### Cross-References

- [Pattern 0.9 — AI-as-New-Starter Standard](L0-foundation.md#pattern-09--ai-as-new-starter-standard): a human audit complements the census.
- [examples/autonomy/README.md](../examples/autonomy/README.md#census) lists every probe and the files it reads.

**Evidence:** Partial — preferring artifacts to self-report is supported by one trial in which self-reported speed ran opposite to measured speed and by a study of committed AI configuration; the probe set and the cap rule are this library's design (IS-6, MC-11)

## Pattern A.5 — Tested Stop

### Problem

Every A4 workflow has a documented stop. A stop nobody has run may not work, and the first time it is tried is during
an incident.

### Solution

Exercise the stop on a schedule. A monthly drill triggers the stop against a canary run, checks that the run halts
within a bound, and writes `stop.last_tested`. A failed or overdue drill lowers the workflow's grant. A complete drill
also checks that the workflow's tokens are revoked and that the workflow can be restored.

### In Practice

`autonomy drill` starts a canary (a process that writes a heartbeat file), runs the workflow's `stop.command`, and
passes when the canary exits and the heartbeat stops within the bound (default 2 seconds). On success it writes
today's date to `stop.last_tested`; on failure it writes a demotion override of A3. The example does not check token
revocation or restore; add both to your own drill, because a stopped agent with a live token is still a risk.

`stop.authority` in the register names who may invoke the stop; it must include someone reachable outside working
hours.

### Anti-Pattern

- A runbook that says "disable the workflow" and has never been followed.
- A drill that stops the canary but does not check token revocation.
- A `last_tested` date set by hand.

### Cross-References

- [Pattern A.3](#pattern-a3--promotion-demotion-and-the-cap-gate): an overdue drill lowers the freshness gate.
- [examples/autonomy/README.md](../examples/autonomy/README.md#stop-drill) documents `drill`.

**Evidence:** Thin — vendor guidance names a stop switch and rehearsed rollback but no drill for the stop itself; the drill is this library's design (PO-12, PO-28, AN-27)

## Pattern A.6 — Enforcement Through Hooks

### Problem

A grant in a file is a statement. If no enforcement point enforces it, the agent can exceed it, or edit the file that holds it.

### Solution

Bind the register to the harness. In the example, two command hooks enforce the effective grant inside the harness
and one eval suite tests them. Both handlers set `"onFailure": "block"` (Claude Code v2.1.295 or later, [hooks
reference](https://code.claude.com/docs/en/hooks#block-the-action-when-a-hook-fails)), so a PreToolUse hook that
cannot start, crashes or times out blocks the call instead of letting it through.

- **SessionStart** resolves the workflow (`AUTONOMY_WORKFLOW`, default `interactive`), computes its effective grant
  from the register, the profile and the state file, and adds it to the session context with any reduction's reason.
- **PreToolUse** denies a tool call outside `permitted_actions`, inside `forbidden_actions`, or writing a governance
  file. A1 allows read-only tools only; A2 and below block `git push`; A3 and below block merging; A4 merges only with
  `auto_merge` and within its limits. Each decision is appended to `.autonomy/audit/<session>.jsonl` with the workflow
  id and the requesting human; the record has no outcome, so add a PostToolUse hook if the audit needs one.
- **The eval suite** ([Pattern 4.6](L4-standards-measurement.md#pattern-46--context-eval)) replays 17 scenarios
  through the hook and scores a scenario only when all five runs match, so a refactor cannot widen grants silently.

### In Practice

**Two tiers of governance files.** An agent commit never changes tier 1 (the register, CODEOWNERS, Claude Code
settings and hooks) and changes tier 2 (CI workflows) only with a later non-agent acknowledgement ([matching
rules](../examples/autonomy/README.md#governance-files)). The boundary that holds is CODEOWNERS with required
non-author review.

A command hook is deterministic policy inside the harness. It is not a security boundary: a workflow that can run arbitrary code can route around it. Hooks hold the grant only together with the sandbox and credential scope of [Pattern 2.9](L2-behavioral-guardrails.md#pattern-29--contain-before-you-relax) and the agent identity of [Pattern 2.11](L2-behavioral-guardrails.md#pattern-211--agent-identity-and-delegation).

### Anti-Pattern

- Hooks that warn instead of block for grant limits.
- Relying on hooks alone where credentials can do the same work outside the harness.

### Cross-References

- [Pattern 2.3 — Hook Automation](L2-behavioral-guardrails.md#composing-checks): the autonomy check runs with the
  other checks under one orchestrator.
- [examples/autonomy/README.md](../examples/autonomy/README.md#hook) documents the hook rules and their deny codes.

**Evidence:** Partial — vendor documentation places must-hold rules in hooks and OWASP places authorization outside the model; whether an autonomy-grant hook reduces incidents is untested (SG-11, SG-16, SC-8)

## Applied to This Repository

This repository's register is [.autonomy.yaml](../.autonomy.yaml): Claude Code sub-agents that edit docs and examples
in git worktrees and push branches, plus the interactive workflow, both granted A1, with the maintainer as owner,
sponsor and identity because no bot identity exists. The `autonomy-check` job in
[.github/workflows/docs.yml](../.github/workflows/docs.yml) runs `autonomy census` and then `autonomy check`, with
`--git-range` over a pull request's commits and `--no-commits` on a push to main; its log prints the cap and each
dimension's position.

On the commit this doc was reviewed at, measuring value has no ledger or baseline (`outcome-tracking`), so the cap is
C1. Both workflows edit files, which exceeds A1, and the hook is not bound here (`.claude/` holds skills only): the
violation is recorded, not enforced. The fix is [Reaching C2](#reaching-c2).

## Related Documents

- [Threat Model](cross-cutting/threat-model.md): the entry points and capabilities a grant exposes.
- [Adoption Guide](cross-cutting/adoption-guide.md): assessment and adoption paths.
- [Glossary](cross-cutting/glossary.md): grant, register, ledger, census, cap, tested stop.
- Runnable reference: [examples/autonomy/README.md](../examples/autonomy/README.md), with CLIs in
  [TypeScript](../examples/autonomy/typescript/) and [Python](../examples/autonomy/python/) that read one [register
  schema](../examples/autonomy/schema/autonomy.schema.json).

---

**Previous:** [L4: Standards and Measurement](L4-standards-measurement.md) | **Next:** [Threat
Model](cross-cutting/threat-model.md) | [Back to Overview](../README.md)
