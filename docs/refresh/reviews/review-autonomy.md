# Review: agentic-patterns through the autonomy-ladder lens

> Edited on 2026-11-19 for vendor neutrality. References to the second research input now name it the Anthropic
> guidance companion (cited as AC). Findings are otherwise unchanged.
> Edited again on 2026-11-19: Anthropic source IDs renamed from the A27 form to the AN-27 form, and citations of the
> companion's own positions, stances and recommendations replaced with the Anthropic or baseline sources
> beneath them. Every ID resolves in [../sources.md](../sources.md).
> Edited again on 2026-11-19: references to a removed case study deleted by maintainer decision.

Reviewer lens: "software that ladders itself up to autonomy". Sources compared:

- Repo: README.md, CLAUDE.md, docs/L0-L4, docs/L1-patterns/*, docs/cross-cutting/*, docs/references/* (HEAD a07ad93).
- Research: `research/industry-baseline.txt` (5 levels x 7 dimensions, cap rule, placement by artefacts,
  defensible top, 8 findings, gaps) and `research/anthropic-companion.txt` (Anthropic sources, cited as AN-n).

Curve levels are written **C1-C5** (Individual, Grounded, Verified delegation, Governed autonomy,
Self-correcting) to avoid colliding with the repo's L0-L4.

---

## 0. Headline findings

1. **agentic-patterns is a capability ladder, not an autonomy ladder.** The baseline (3.1) separates
   autonomy ladders ("how much the human lets go") from capability ladders ("whether letting go is safe")
   and notes almost no published model joins them. L0-L4 sits squarely in the capability family, closest
   to ACMM (feedback-loop structure) and RAMP (committed configuration). It never says how much autonomy a
   given workflow is granted, who grants it, on what evidence, or how it is withdrawn.
2. **The one place the repo describes autonomy contradicts the research.** Pattern 4.4's maturity table
   maps Foundational/Orchestrated/Self-optimizing/Autonomous one-to-one onto L0 / L1-L2 / L3 / L4, and
   defines "Autonomous" as "end-to-end delivery". This is (a) a single sequential ladder, the flaw the
   baseline names in 3.3; (b) it equates token efficiency (L3) with "self-optimizing", which is unrelated
   to self-correction; (c) its top is a volume ("end-to-end", "organization-wide adoption"), where the
   defensible top (3.7) is the *capability to raise and lower autonomy per named workflow on evidence*.
3. **Under the cap rule, a team that adopts all of L0-L4 is still capped at C1-C2 for unattended work.**
   The cap is the minimum of platform, security & governance, production ownership and measuring value.
   The repo explicitly scopes production ownership out (faq.md: deployment and operations are "a separate
   concern that this pattern library deliberately doesn't prescribe") and has almost nothing on agent
   containment, identity, audit or supply chain. Its strongest dimensions (shared context, operating model)
   are exactly the ones that *do not* set the cap.
4. **The only real autonomy mechanism in the repo was buried in a former case study (removed 2026-11-19).** Its trust tiers
   (advisory / supervised / autonomous, auto-promotion after consecutive successes, auto-demotion after
   failures, persisted in `trust_scores`) is the seed of an autonomy ladder, but it is (a) per agent, not
   per workflow; (b) promoted on a success count of unspecified provenance; (c) tops out at "autonomous
   (no oversight)", which lacks the owner, limits, audit record and tested stop the baseline requires at C4.
5. **The repo already has most of the C3 machinery and one genuine C4 element.** Hooks that block
   (2.3), constitutional rules with no escape hatches (2.4), enforcement pipeline (2.6), phase validation
   (2.7), zero-defect (2.5), CI guardrails (4.5) and evidence-based claims (4.1) are a strong rendering of
   finding 3 ("hard limits live outside the model"). Context eval (4.6) is a task bank with graduated
   scoring and a threshold gate: the C4 measuring-value practice, applied today only to harness decisions.
   The gap is not mechanism; it is that none of this is *bound to an autonomy grant*.

---

## 1. Mapping L0-L4 onto the 5 x 7 curve

### 1.1 Coverage table

Rating: **S** = strong (patterns with mechanism and examples), **P** = partial, **N** = not addressed.
"Ceiling" = highest curve level the repo's content would let a team evidence on that dimension.

| Dimension | Repo patterns that contribute | C2 | C3 | C4 | C5 | Ceiling | Key gaps against the baseline |
|---|---|---|---|---|---|---|---|
| **Platform** (cap) | rig/.harness.yaml, 2.3 hooks, 3.3/3.8 environment detection and session cache, 0.6 worktrees, 1.4 container isolation (tests only), 4.5 CI | P | P | N | N | C2-C3 | No agent identity (per-agent, non-personal, short-lived), no gateway or per-user limits, no runtime sandbox for the *agent* (1.4 isolates test containers, not the agent), no "check command CI runs" named as a platform contract (stack tests come close), no loop/anomaly alerts |
| **Shared context** | 0.2 progressive disclosure, 0.4 CLAUDE.md <=150 lines, 0.7 docs as system map, 0.8 cleanup, 0.9/4.3 new-starter, 2.1 skill overlays, 2.8 compound engineering (learnings), L1 context harvesting and design rinsing, 3.4 scout | S | S | N | P | C3 (part C5) | Hard rules in hooks: yes. Short, owned file: short yes, *owned* no. *Tested* instruction files: no (4.6 evaluates routing, not CLAUDE.md's effect). No governed connectors or permission-aware retrieval. No expiry or re-baseline on model change. 0.4's "every doc reachable from CLAUDE.md" is a growth rule with no expiry rule; presence is checked, practice (last-changed) is not |
| **Team operating model** | 2.2 skill chain, 2.7 phase validation, 2.5 zero-defect, 1.3 vertical slices, L4 review checklist, design-first workflow (L1), 2.8 compound loop | S | S | P | N | C3 | No risk-tiered review depth (the checklist is uniform, which finding 4 calls "human-in-the-loop theater" at scale). No mixed deterministic+agent unattended workflows described (rig hints). No agent first-pass incident investigation beyond `debug+`. No "process retired when its gap closes" |
| **Security & governance** (cap) | 2.4 constitutional rules, 2.3 blocking `sed -i` / `docker system prune`, trading-bot "container preservation" mandate, L4 checklist "no hardcoded secrets" | P | N | N | N | C2 | No sandbox/egress policy for agents, no credential handling, no lethal-trifecta / Rule-of-Two analysis, no vetting or pinning of skills/plugins/MCP servers (despite recommending installs of superpowers, gstack, rig, compound-engineering, jcodemunch), no audit record naming agent and human, no "requester cannot approve agent PR", no autonomy tiers |
| **Production ownership** (cap) | None in pattern docs. faq.md declares deployment/ops out of scope. 4.4 asks for metric "owners" only | N | N | N | N | C1 | No agent inventory, sponsor, lifecycle, access expiry, human author of record, eval-gated model/prompt/skill changes, stop/restore authority, retirement. This is the baseline's largest field-wide gap (finding 7) and the repo does not touch it |
| **Individual & team skill** | L1 design-first workflow (explain, evidence, goal, skill, iterate), design rinsing, 0.5 peer/temporary tests, Steinberger practitioner quotes | P | P | N | N | C2-C3 | No statement of what to hand over vs keep; no work-sample ("debug a change you did not write"); no failure drills; no protected hands-on practice; nothing on detecting an agent declaring success on failing tests (1.6 helps mechanically) |
| **Measuring value** (cap) | 4.4 metrics (outcomes over activity, vanity-metric anti-pattern, thresholds/actions/owners), 4.6 context eval (task bank, threshold gate), 4.1 evidence, trading-bot commit-history analysis | P | P | P | N | C2-C3 | No pre-adoption baseline (C3 requires it), no DORA stability measures, no cost per outcome, no per-workflow target/review date/stop rule. 4.4 scope note admits 4.1-4.5 were not implemented in the reference project. Commit-type shares and feature:test ratio are activity metrics, which finding 6 warns against using as maturity evidence |

### 1.2 Resulting profile for a full adopter

| Dimension | Profile level | Caps? |
|---|---|---|
| Platform | C2 (C3 with rig + CI check command) | yes |
| Shared context | C3 | no |
| Team operating model | C3 | no |
| Security & governance | C2 | yes |
| Production ownership | C1 | yes |
| Individual & team skill | C2 | no |
| Measuring value | C2 (C3 elements) | yes |
| **Capped level for unattended work** | **C1** (C2 if a team supplies its own inventory) | |

The repo produces teams that are good at *verified, attended* delegation and lack the scaffolding to
earn *unattended* delegation. That matches the research's observation that most work stays supervised,
but the repo never names the ceiling, so adopters are not told why stopping at L4 does not license
autonomy.

### 1.3 Where the mapping fails structurally

- **Unit of assessment.** L0-L4 is per repository. The curve is per dimension, and autonomy is per
  workflow (3.5 C3: "autonomy is chosen per task"; C5: "extended or withdrawn per workflow"). The repo has
  no workflow concept at all; "the agent" is singular and implicit.
- **Measurement placed last.** L4 sits at the apex, so the adoption order defers measurement until after
  optimization. The curve requires a baseline *before* the AI change (measuring value C3) and makes
  measuring value a cap dimension. Measuring last means teams raise autonomy before they can show it is
  safe.
- **L3 sits between L2 and L4 for no safety reason.** Token efficiency maps to cost per outcome (measuring
  value C5) and mildly to platform. It is not a prerequisite for any autonomy level. Its position in the
  stack implies otherwise.
- **Counts as a level signal.** README and L1/L2 cite Steinberger's "5-10 parallel agents" as an
  aspiration. The baseline (3.3) treats agent counts as illustrative only, and Cherny's own
  table warns against "scaling agent count before the loop has earned widespread trust" (AN-49).
- **Presence as practice.** Checks the repo proposes (CLAUDE.md line count, reachability, linked docs)
  measure presence. RAMP's finding (most committed artefacts never change after being added) means these
  checks cannot distinguish C2 from C3.

---

## 2. Is the pyramid the right shape?

### 2.1 Critique

The README already softens the order ("teams should start where their gaps are"), and the adoption guide
offers three paths. But three artefacts reassert a single ladder:

1. The pyramid diagram itself (each level rests on the one below).
2. Pattern 4.4's stage table binding maturity stages to L0-L4.
3. The phrase "levels suggest an adoption order — earlier levels provide the foundation that later levels
   depend on".

The research says three things the pyramid cannot express:

- Dimensions progress unevenly; a single label hides that (3.3 flaw 2; CNCF "not meant to classify an
  organization ... as wholly Level 1 or Level 4").
- The weakest of four specific dimensions caps autonomy. A pyramid has no "weakest column".
- Higher is not always better (Swarmia, CNCF, Feng). A pyramid implies the apex is the goal.

The dependency claims inside the pyramid are partly right and should be kept: L1 stack tests do depend on
L0 structure, and L2 enforcement does depend on L1 producing binary signals. What is wrong is presenting
the stack as a *maturity* scale.

### 2.2 Proposed restructure (recommended: two axes plus a cap line)

**Axis 1 — Capability layers (keep, rename).** Keep L0-L4 content but call them *layers*, not *levels*,
and stop calling the stack a maturity scale:

| Layer | Name | Role in the new model |
|---|---|---|
| L0 | Foundation | Shared-context and operating-model prerequisites |
| L1 | Closed loops | Verification capability; what makes a check "mechanical" |
| L2 | Guardrails | Deterministic enforcement; the *mechanism* autonomy grants are enforced through |
| L3 | Efficiency | Optional; feeds cost-per-outcome. Not on the autonomy critical path |
| L4 | Evidence | Split: 4.1/4.2/4.5/4.6 move to a cross-cutting "evidence" column used at every autonomy level; 4.4's stage table is replaced by the autonomy axis below |

**Axis 2 — Autonomy per workflow (new, orthogonal).** A1-A5, deliberately aligned with the curve's
level names so a reader can read one against the other. Each workflow in a repo holds one grant.

| Grant | Name | Human role (Feng et al.) | What the agent may do | Minimum curve profile on capping dimensions |
|---|---|---|---|---|
| A1 | Assisted | Operator | Suggest; human applies | none |
| A2 | Reviewed | Collaborator | Edit and open PRs; every change read by a human before checks matter | C2 |
| A3 | Gated delegation | Consultant / approver | Changes must pass required checks before a human sees them; human merges; named owner per change | C3 |
| A4 | Unattended, reversible | Approver by exception | Runs on event/schedule/backlog; may merge or act inside permitted actions; owner, limits, audit, tested stop | C4 |
| A5 | Portfolio-managed | Observer | A4 plus baseline, target, review date and stop rule; grant moved up or down on evidence; retirement possible | C5 |

A5 is not "more autonomous" than A4 in what the agent may do; it is A4 managed as an investment. This
encodes the defensible top: the capability to move grants, not a bigger grant.

**The cap line.** Draw the seven dimensions as columns, shade the profile, and draw a horizontal line at
the minimum of the four capping columns. No workflow grant may sit above that line. This replaces the
pyramid diagram as the repo's primary visual (keep the pyramid as the "layer dependencies" diagram).

**New pattern families to fill the capping columns.** Slot them into existing layers so CLAUDE.md stays
an index, not a rewrite:

- L2 gains containment patterns: 2.9 Agent containment (sandbox + egress + credentials outside the
  boundary), 2.10 Supply-chain vetting for skills/plugins/MCP, 2.11 Trifecta gate.
- A new doc `docs/L-autonomy.md` (or `docs/A-earned-autonomy.md`) holds A.1-A.7 below, and is the only
  place that defines grants.
- L4 gains 4.7 Workflow register and ownership, 4.8 Baseline before change.

Alternative considered: add an "L5 Autonomy" apex. Rejected: it repeats the single-ladder error, and
implies autonomy is earned by finishing L0-L4, when the cap rule says it is earned by the weakest column.

---

## 3. The autonomy-ladder pattern family (A-series)

Evidence labelling, per the repo's own rule 2: A.1-A.3 rest on partial evidence (Gartner tiers via trade
press, Feng et al. preprint, Anthropic first-party, Spotify practitioner account). A.4-A.7 are mechanism
design; the baseline marks tested stops and portfolio review as thin. The docs should say so.

### A.1 Autonomy register — `.autonomy.yaml`

**Problem.** Autonomy is granted implicitly: whoever configures a scheduled agent or turns on auto-merge
decides, and nobody can list what runs, at what level, or who stops it (curve C1 on ownership).

**Solution.** One committed, schema-validated file per repository lists every agent workflow and its
grant. Interactive developer sessions are a workflow too (`interactive`, default A2 or A3). It is a
governance artefact: protected by CODEOWNERS, never writable by an agent (see A.6).

```yaml
# .autonomy.yaml
version: 1
defaults:
  interactive_level: 3          # developer-driven sessions
  evidence_window: { min_runs: 30, max_days: 60 }
  review_cadence_days: 90
  stop_test_max_age_days: 30
profile: .autonomy/profile.json # written by `autonomy census` (A.4); never hand-edited

workflows:
  - id: dep-bump
    description: Patch and minor dependency bumps with lockfile regeneration
    owner: team-platform            # must resolve to a CODEOWNERS team
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
      reversible: true              # can the action be undone by revert?
      verification: mechanical      # mechanical | partial | judgement
      blast_radius: repo            # file | repo | service | external
      trifecta:                     # Willison / Meta Rule of Two
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
      last_tested: 2026-11-02       # written by the stop drill job, not by hand
    review_date: 2027-02-01
    stop_rule: "retire if < 2 merged PRs/month over 90 days, or cost per merged PR > $5"

  - id: flaky-test-triage
    owner: team-qa
    sponsor: "@bob"
    granted_level: 3                # opens PRs; humans merge
    target_level: 4
    risk: { reversible: true, verification: partial, blast_radius: repo,
            trifecta: { untrusted_input: false, sensitive_data: false, external_action: false } }
    # ...
```

Schema rules enforced by `autonomy check` (A.3):

- `granted_level >= 4` requires `stop.last_tested`, `review_date`, `limits`, `identity` not a person,
  `risk.reversible: true` **and** `risk.verification: mechanical`. This encodes the baseline's defensible
  top: unattended only where verification is mechanical and the action reversible.
- `granted_level == 5` additionally requires `stop_rule`, a baseline file and a target.
- A trifecta with all three true is rejected at any level >= 3 unless a deterministic gate is named.
- `owner` must resolve in CODEOWNERS; `sponsor` must be a current member (checked via `gh api`).

### A.2 Evidence ledger

**Problem.** The common per-agent trust-tier design promotes after "consecutive successes", but who records success? If the agent does,
the evidence is self-report, which finding 5 says is unreliable even for humans.

**Solution.** An append-only ledger per workflow, written only by CI and by scheduled jobs that observe
source control after the fact. One JSON line per run:

```json
{"run":"gh-123456","ts":"2026-11-18T03:12:00Z","workflow":"dep-bump","level":4,
 "model":"claude-opus-5-5","harness_hash":"sha256:9f1c...","outcome":"merged",
 "checks":{"unit":"pass","stack":"pass","context-eval":0.94},
 "first_run_pass":true,"human_interventions":0,"diff_lines":212,"cost_usd":0.83,
 "reverted_at":null,"rework_commits_14d":0,"escaped_defect":false}
```

Location: `.autonomy/ledger/<workflow>.jsonl` on a bot-only branch or an artifact store (keeps main's
history clean). Late-arriving fields (`reverted_at`, `rework_commits_14d`, `escaped_defect`) are filled
by a nightly job that scans reverts (`git log --grep '^Revert'`), follow-up commits touching the same
lines, and issues linked to the merge commit. Revert alone is gameable (just do not revert); rework and
escaped defects close that hole.

`harness_hash` hashes the model id, CLAUDE.md, `.claude/**`, skills, hooks and `.harness.yaml`. A change
to it is a release of the workflow (baseline 4.5: "model or prompt changes behave like releases").

### A.3 Promotion, demotion and the cap gate

**Effective level** for a workflow at runtime:

```
effective = min(
  granted_level,
  cap(profile)                     # min of platform, governance, ownership, measuring (A.4)
  freshness_gate,                  # 2 if stop test overdue, owner invalid, review date passed, access expired
  harness_gate,                    # min(granted, 3) until task bank passes on the new harness_hash
  demotion_override                # written by the demotion job
)
```

**Promotion (up, one level at a time, always human).**

- Only via a PR that changes `granted_level` in `.autonomy.yaml`.
- CI attaches an evidence report computed from the ledger over the evidence window.
- Approved by the owner team **and** someone other than the PR author (and never by an agent identity).
- Cooldown: no promotion within 30 days of a demotion.
- Criteria (defaults, overridable per workflow; thresholds use the Wilson 95% lower bound, not the raw
  rate, so 5 lucky runs cannot promote):

| To | Criteria over the window |
|---|---|
| A3 | >= 20 runs at A2; required-check first-run pass lower bound >= 0.80; human review comments show substance in a 10-run traced sample; owner named |
| A4 | >= 30 runs at A3; first-run pass lower bound >= 0.90; revert rate upper bound <= 0.03; zero escaped defects; task-bank score >= 0.90 on current harness; `reversible` and `mechanical` true; stop drill passed within 30 days; cap >= 4 |
| A5 | >= 90 days at A4; baseline, target and stop rule set; cost per merged outcome reported; one review cycle completed with a recorded decision; cap >= 5 |

**Demotion (down, automatic, immediate).** Triggers, any one sufficient:

- Escaped defect of severity >= S2, or any incident linked to the workflow.
- Revert rate upper bound over the trailing window exceeds the promotion threshold plus a margin
  (hysteresis: promote at <= 3%, demote at > 6%) to avoid oscillation.
- Task-bank score below floor, or `harness_hash` changed without a passing task-bank run.
- Stop drill overdue, review date passed, owner or sponsor invalid, access expired.
- A limit breached (cost, run count, diff size) or a forbidden action attempted (from the audit log).

Demotion is written by a bot to `.autonomy/state.json` (overrides) so it takes effect without waiting on
review, and a PR is opened to reconcile `.autonomy.yaml`. Demotion drops to A3, or A2 for incidents.

This inverts the repo's existing Ratchet pattern (1.1: coverage "only tightens"): autonomy *loosens* only
with evidence and human sign-off, and *tightens* automatically. Same idea, applied to trust.

**The cap gate in CI.** `autonomy check` is a required status check. It fails when:

- Any `granted_level` exceeds the computed cap. No exception field exists (constitutional, per 2.4:
  "if a rule needs exceptions, it is not constitutional").
- Schema rules from A.1 fail.
- `.autonomy.yaml`, `.autonomy/**`, CODEOWNERS, branch protection workflows or hook config were changed
  in a commit authored by an agent identity.
- The profile is older than 30 days.

### A.4 Self-placement — `autonomy census`

**Problem.** Placement by questionnaire is weak (baseline 3.6, MC-22). A codebase can compute much of
its own profile from artefacts, but only the parts visible from the repo.

**Solution.** A census command that runs probes and writes `.autonomy/profile.json`. Each probe checks
presence *and* practice (last-changed date, referenced by CI, exercised in the ledger). Cells a repo cannot
evidence are `unknown`, and `unknown` counts as C2 for the cap, so missing evidence lowers autonomy
rather than being ignored.

| Dimension | C2 probe | C3 probe | C4 probe | C5 probe |
|---|---|---|---|---|
| Platform | Agent config committed (`.claude/`, `.harness.yaml`) | Check command named in CLAUDE.md and run by a required CI job; CI agent uses OIDC / app identity (no `secrets.*_API_KEY` tied to a person); sandbox enabled and locked in committed settings | Agent workflows run on isolated runners with an egress allowlist; audit log present for last N runs | Skills/hooks consumed from a versioned internal marketplace; `AGENTS.md` portability |
| Shared context | CLAUDE.md exists | <=150 lines; changed in last 90 days; owner in CODEOWNERS; >=1 blocking hook with tests; decisions log (`docs/solutions/` or ADRs) written in last 90 days | (org-level: governed connectors) `unknown` from repo | Context re-baselined since last model change (harness hash vs eval run); docs pruned (deletions in last 90 days) |
| Operating model | CI runs tests and linters | Required checks enforce conventions; automated review pass on every PR; phase tracker or skill chain configured | Review depth rules by path/risk (e.g. CODEOWNERS tiers, `REVIEW.md`); unattended workflows mix deterministic and agent steps | Retired workflows or rules recorded |
| Security & governance | Constitutional rules in CLAUDE.md | Sandbox locked; deny rules; skills/plugins/MCP pinned with hashes; branch protection requires a non-author approver; secret scanning on | Every workflow has trifecta classification and named gate; audit records name agent and human; tiers declared | Review record of approve/block rates within cadence; stop drills recorded |
| Production ownership | `.autonomy.yaml` exists with owners | Owners resolve to teams; sponsors current; access expiry set; agent commits carry a human author-of-record trailer | Harness changes trigger task-bank eval in CI (path filter on `.claude/**`, skills, model id); stop authority and rollback runbook per workflow | Inactive workflows auto-disabled; retirement records |
| Skill | (sample) | (sample) | (sample) | (sample) |
| Measuring value | Cycle time tracked | `.autonomy/baseline.json` with pre-change flow and stability metrics; quarterly trend | Task banks per workflow in CI reporting reliability and cost per task | Per-workflow baseline, target, review date, stop rule; cost per merged outcome |

Skill and parts of operating model cannot be read from files. The census emits worksheets for the
human steps (merge sample, traced samples, work sample, perception survey last) and records their result
with a date; stale samples revert to `unknown`.

```json
{
  "generated": "2026-11-19T02:00:00Z",
  "dimensions": {
    "platform":   {"level": 3, "evidence": ["ci:check-command", "settings:sandbox-locked"]},
    "governance": {"level": 2, "missing_for_next": ["skills-pinned", "non-author-approval"]},
    "ownership":  {"level": 3, "evidence": ["autonomy.yaml:owners-resolve"]},
    "measuring":  {"level": "unknown", "counted_as": 2},
    "shared_context": {"level": 3}, "operating_model": {"level": 3}, "skill": {"level": "unknown"}
  },
  "cap": 2,
  "workflows_over_cap": []
}
```

The report shape matches the baseline: a profile, one level per dimension with evidence, plus the capped
level.

### A.5 Tested stop

Every A4+ workflow has a stop that is exercised, not documented. A scheduled drill job (monthly) triggers
the stop mechanism against a canary run, asserts the run halts within a bound and tokens are revoked,
restores, and writes `stop.last_tested`. Failure demotes the workflow. This fills a gap in Anthropic's guidance
(the SDLC playbook asks for rehearsed rollback, not a tested stop for the agent itself, AN-27) and the
baseline's "nothing found on whether kill switches work".

### A.6 Enforcement through rig and hooks

The grant is only real if the tool layer enforces it (finding 3, repo Pattern 2.3).

- **SessionStart** (extends 3.8): resolve workflow id from `AUTONOMY_WORKFLOW` (CI) or default to
  `interactive`; load `.autonomy.yaml`, `profile.json`, `state.json`; compute effective level; cache with
  the existing TTL mechanism; print the effective level and the reason for any reduction.
- **PreToolUse** (extends 2.3/2.6 as a new check `checkAutonomy()` in the pipeline):
  - Block any tool call outside `permitted_actions` or inside `forbidden_actions`.
  - A1-A2: block `git push`, PR merge, and any network egress beyond the allowlist.
  - A3: allow push to non-protected branches and opening PRs; block merge and labels that trigger merge.
  - A4: allow auto-merge only when diff size and file paths are within limits.
  - Trifecta tracker: once a session has read untrusted input (web fetch, issue body, PR comment) and
    holds sensitive data, block external actions without the named gate.
  - Constitutional: block agent writes to `.autonomy*`, CODEOWNERS, `.github/workflows/*`, hook and
    harness config. An agent cannot promote itself or weaken its gate.
- **PostToolUse**: append to `.autonomy/audit/<session>.jsonl` with agent identity, requesting human,
  tool, parameters hash, outcome.
- **Context eval** (4.6) gains an `autonomy` suite: scenarios x configurations (A2/A3/A4, cap below
  grant, stale stop, trifecta session) asserting block/allow. This tests the gate itself, so a refactor of
  rig cannot silently widen grants.
- **Config placement.** Keep `.autonomy.yaml` separate from `.harness.yaml`. The harness file is
  developer-tunable (block/advise/silent per rule); the register is a governance artefact with different
  owners. Mixing them lets a routine harness edit change a grant.

### A.7 Autonomy portfolio review (A5)

A scheduled job opens one issue per workflow at `review_date` with: ledger trend, cost per merged outcome
against the baseline, demotion history, and the stop rule evaluated. The owner records keep / promote /
demote / retire. Retirement deletes the workflow entry and revokes identity (consistent with 0.7/0.8:
version control is the archive). The baseline notes no canonical framework exists for this; label it thin.

### 3.1 Critique of the common per-agent trust-tier design as the seed

| Per-agent trust tiers (common design) | Change |
|---|---|
| Tiers per agent | Grants per workflow; one agent may run several workflows at different levels |
| Promote on consecutive successes | Promote on ledger evidence with lower confidence bounds, recorded by CI, plus human sign-off |
| Demote on failures (symmetric, automatic) | Keep automatic demotion; make promotion asymmetric (human) with hysteresis and cooldown |
| "Autonomous (no oversight)" | Rename "unattended (observed)": owner, limits, audit, tested stop remain |
| Success definition implicit | Success = required checks pass, no revert/rework/escaped defect within 14 days |
| Tier state in SQLite `trust_scores` | Grant in reviewed config; runtime overrides in bot-written state; evidence in append-only ledger |
| No link to model changes | `harness_hash` change caps at A3 until the task bank passes |

---

## 4. Existing patterns as prerequisites for autonomy grants

A grant requires its row and every row above it. "New" = proposed pattern not yet in the repo.

| Grant | Prerequisite patterns (existing) | New patterns required | Why |
|---|---|---|---|
| **A2 Reviewed** | 0.2 progressive disclosure, 0.3 conceptual organisation, 0.4 CLAUDE.md constitution, 0.6 worktrees, 0.7 docs as system map, 2.4 constitutional rules (declared) | A.1 register (owners only) | Curve C2: approved tools, committed shared context, every change read by a human, an inventory with owners |
| **A3 Gated delegation** | 0.5 unit tests as contract, 1.1 stack tests, 1.2 full-loop assertions, 1.3 sequential design, 1.4 container isolation, 1.5 real dependencies, 1.6 test integrity, testing infrastructure, 2.2 skill chain, 2.3 blocking hooks, 2.5 zero-defect, 2.6 enforcement pipeline, 2.7 phase validation, 4.1 evidence-based claims, 4.5 CI guardrails as required checks | 2.9 agent containment (sandbox locked), 2.10 skill/plugin/MCP pinning, non-author approval rule, human author-of-record trailer, 4.8 baseline before change, A.2 ledger | Curve C3: checks pass before a human sees the change, owner per change, sandboxed and scoped, baseline taken. L1 is what makes a check *mechanical*; L1.6 is what makes it unable to pass silently |
| **A4 Unattended, reversible** | 4.2 spec drift detection, 4.6 context eval (as task bank and harness eval gate), 3.8 session lifecycle (to carry effective level), 4.4 metrics with thresholds/actions/owners | A.3 promotion/demotion and cap gate, A.4 census, A.5 tested stop, A.6 hook enforcement and audit log, 2.11 trifecta gate, 4.7 workflow register with sponsor/expiry/stop authority | Curve C4: owner, permitted actions, limits, audit record, tested stop, controls enforced by the system; model/prompt/skill changes eval-gated |
| **A5 Portfolio-managed** | 2.8 compound engineering (with pruning, not only capture), 0.8 aggressive cleanup (applied to skills and rules), 4.3 new-starter audit | A.7 portfolio review, retirement, context re-baseline on model change, supervision-skill drills | Curve C5: cost, value, risk and review date per workflow; some retired; context pruned; supervision skills kept |
| *(none)* | L3 3.1-3.7 | — | Efficiency. Useful for cost per outcome at A5, not a safety prerequisite at any grant |

Observation: L1 is the hinge. It is the only layer that turns "the agent says it worked" into a signal a
machine can trust, and A4's `verification: mechanical` condition is satisfiable only where L1 coverage
exists for the workflow's journey. The repo should say this directly: stack tests are what earn autonomy,
which is the research's "verification earns delegation" (baseline finding 2; AN-2, AN-3) in the repo's own vocabulary.

---

## 5. Smaller issues found on the way

- `docs/plans/design-rinsing-pattern.md` is not linked from CLAUDE.md, contrary to the repo's own master
  index rule (CLAUDE.md "Every doc in this repo must be reachable"). Either link it or delete it after
  merge (the trading-bot case study says completed plans are deleted).
- Pattern 4.4's "Human intervention rate" under "Agent autonomy" invites the gaming its own anti-pattern
  warns about. Under A.3 it becomes one input among revert, rework and escaped defects, never a target.
- Pattern 4.4's gate "Self-optimizing -> Autonomous: organization-wide adoption in at least one major
  product area" is a volume criterion. Replace with A.3 criteria.
- L2 anti-pattern "Hooks that block, not just log" and finding 4 (approval prompts are accepted 93% of
  the time) agree; the repo should cite the finding, which strengthens its own argument.
- The repo recommends installing several third-party skill frameworks and tools with no supply-chain
  advice. Given the baseline's skill-registry scan figures (13.4% critical issues), 2.10 is the highest
  value single addition for security.
- Upper autonomy grants rest on thin evidence. The repo's rule 2 (evidence-based claims) obliges the new
  docs to label A4/A5 accordingly rather than present them as proven.

---

## 6. Recommended changes, in order

1. Add a "What this library does not cover" section to README naming production ownership and
   security & governance, and stating the cap consequence (unattended work capped at C1-C2).
2. Replace Pattern 4.4's stage table with a pointer to the autonomy axis; keep its metric categories.
3. Add `docs/A-earned-autonomy.md` with A.1-A.7, linked from CLAUDE.md; publish the `.autonomy.yaml`
   schema and a working `autonomy check` + `autonomy census` example in `examples/autonomy/` (TS and
   Python, per the repo's writing rules).
4. Add 2.9-2.11 (containment, supply chain, trifecta) to L2 and 4.7-4.8 (workflow register, baseline) to
   L4.
5. Replace the pyramid as the primary diagram with the dimension grid plus cap line; keep the pyramid as
   "layer dependencies".
6. Rename L0-L4 "levels" to "layers" throughout to avoid confusion with curve levels and autonomy grants.
