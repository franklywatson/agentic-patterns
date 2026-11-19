# Synthesis: Agentic Patterns Refresh

Combined findings of five independent reviews of `franklywatson/agentic-patterns` at commit `a07ad93`,
written 2026-11-19. The full reviewer reports are in [reviews/](reviews/). Reference IDs (MC-, PL-,
SC-, OM-, SG-, PO-, IS-, MV-) belong to the research baseline described in [README.md](README.md). AN-numbers are
Anthropic publications cited by the Anthropic guidance companion (vendor guidance, not independent
evidence). Every ID resolves to a public source in [sources.md](sources.md).

Lens tags in brackets show which reviewer raised a finding:

- `[evidence]`: evidence auditor
- `[autonomy]`: autonomy-ladder architect
- `[repair]`: self-repair
- `[governance]`: security, governance, ownership and people
- `[adopter]`: adopter red team

## 1. Verdict

### Holds, and matters more now

- **Stack tests, full-loop assertions and test integrity (1.1, 1.2, 1.6).** They turn "the agent
  says it worked" into a signal a machine can trust. That signal is what earns delegation (baseline
  finding 2; AN-2, AN-3).
- **"Prose is suggestion; enforcement is deterministic" (L2).** This is now supported by independent
  sources (SC-8, OM-7, OM-18, SG-11, SG-16).
- **Evidence-based claims (4.1) and context eval (4.6).** Both match the field on self-report and
  task banks (IS-6, MV-9).

### Has aged

- **Routing patterns (3.1-3.3, 3.8):** command routing, intent classification and environment
  detection. Current harnesses ship native tools that do this.
- **TOON (3.7).** Its worked example is arithmetically wrong.
- **Token-saving figures (60-90%).** They are unsourced, and the docs disagree with each other.
- **The mandatory five-phase skill chain with a blocking phase tracker (2.2, 2.7).** It is ceremony
  that compensated for models which skipped planning or verification.
- **The 150-line CLAUDE.md rule.** CLAUDE.md `@`-imports every doc, so the rule does not limit what
  the agent loads.

### Missing

- **Containment:** sandbox, egress, credentials, agent identity.
- **Ownership:** agent register, author of record, tested stop, retirement.
- **Measuring value against a baseline.**
- **Per-workflow autonomy, and anything about production beyond the development loop.** The FAQ
  scopes production out.

### The central reframe

L0-L4 is a capability stack. It says whether letting go is safe. It does not say how much a given
workflow is allowed to let go, on what evidence, or how that grant is withdrawn. The research's
defensible top is exactly that missing piece: "the ability to raise autonomy for a named workflow
when evidence supports it, show that evidence, and lower it again" (baseline 3.7).

The proposal:

1. Keep the layers.
2. Add an orthogonal autonomy axis, gated by the cap rule.
3. Fill the three capping dimensions the library ignores.

Self-repair then becomes one family of workflows on that axis, not a new level.

## 2. Where the library stands

This is the profile a team reaches by adopting every pattern as written. It is the ceiling the
content allows, not an assessment of any particular team. Curve levels are written C1-C5 to keep
them distinct from L0-L4. `[autonomy]` `[repair]` `[governance]`

| Dimension | Level | Caps unattended work? |
|-----------|-------|----------------------|
| Shared context | C3 | no |
| Team operating model | C3 | no |
| Platform | C2-C3 | yes |
| Measuring value | C2-C3 | yes |
| Individual and team skill | C2 | no |
| Security and governance | C2 | yes |
| Production ownership | C1 (out of scope in `faq.md`) | yes |
| **Cap for unattended work** | **C1** | lowest of the four capping dimensions |

The library produces teams that are good at verified, attended delegation. It does not give them
the scaffolding to earn unattended delegation. Its strongest dimensions are exactly the ones that do
not set the cap, and the repo never tells readers this.

Pattern 4.4 maps maturity stages one-to-one onto L0-L4 and puts "Autonomous: end-to-end delivery"
at the top. That has three problems:

- It is a single sequential ladder with a volume-based top, the two flaws the baseline names (3.3,
  3.7).
- It treats token efficiency (L3) as "self-optimizing".
- It places measurement last, although the curve needs a baseline before autonomy rises.

## 3. The reframe: two axes and a cap line

All five lenses rejected an "L5 Autonomy" or "L5 Self-repair" apex. An apex repeats the
single-ladder error, and it implies autonomy is earned by finishing L0-L4. The cap rule says
autonomy is limited by the weakest column. `[autonomy]` `[repair]` `[governance]`

### Axis 1: capability layers (keep, rename "levels" to "layers")

| Layer | Role in the new model |
|-------|----------------------|
| L0 Foundation | Shared-context and operating-model prerequisites |
| L1 Closed loops | The hinge: it makes verification mechanical, which is what earns A3 and A4. Extended to production by the 1.7-1.12 repair family. |
| L2 Guardrails | The mechanism grants are enforced through. Gains containment and supply chain, and a rewrite as layered enforcement. |
| L3 Efficiency | Optional. Feeds cost per outcome. Not on the autonomy critical path. |
| L4 Evidence | Evidence, evals and measurement used at every grant. The 4.4 stage table is replaced by Axis 2. |

### Axis 2: autonomy grant per workflow (new)

| Grant | What the agent may do | Needs cap of at least |
|-------|----------------------|----------------------|
| A1 Assisted | Suggest; a human applies the change | none |
| A2 Reviewed | Edit and open PRs; a human reads every change | C2 |
| A3 Gated | Changes pass required checks before a human sees them; a human merges; every change has a named owner | C3 |
| A4 Unattended, reversible | Acts on an event, schedule or backlog within its permitted actions. Has an owner, limits, an audit record and a tested stop. Only where verification is mechanical and the action reversible. | C4 |
| A5 Portfolio-managed | A4 plus baseline, target, review date and stop rule; the grant moves on evidence; the workflow can be retired | C5 |

A5 grants no more power than A4. It is A4 managed as an investment, which encodes the defensible
top as a capability rather than a volume.

**Primary diagram.** Replace the pyramid with the seven-dimension grid with a cap line across it. No
workflow grant may sit above the line. Keep the pyramid as a secondary "layer dependencies" diagram:
its dependency claims are right.

## 4. Goal A: software that ladders itself up to autonomy

The repo already has most of the A3 machinery: blocking hooks, constitutional rules, the
enforcement pipeline, CI guardrails and context eval as a task bank. What it lacks is a binding
between that machinery and an explicit, revocable grant. The A-series supplies the binding.
The common per-agent trust-tier design (promotion on consecutive successes) is the seed. `[autonomy]`

| ID | Pattern | Summary | Evidence |
|----|---------|---------|----------|
| A.1 | Autonomy register | Committed, schema-validated `.autonomy.yaml` listing every agent workflow, including interactive sessions. Each entry has owner, sponsor, grant, identity, permitted and forbidden actions, risk class, limits, stop mechanism with its last-tested date, review date and stop rule. Protected by CODEOWNERS and never writable by an agent. | Partial |
| A.2 | Evidence ledger | Append-only, per-run records written only by CI and by jobs that observe source control afterwards. Records check results, reverts, rework within 14 days and escaped defects. A `harness_hash` covers model, CLAUDE.md, skills and hooks; changing it counts as a release. | Partial |
| A.3 | Promotion, demotion, cap gate | Promotion is one level at a time, by a human-approved PR with ledger evidence using lower confidence bounds. Demotion is automatic and immediate, with hysteresis and a cooldown. `autonomy check` is a required CI check with no exception field. | Thin |
| A.4 | Self-placement census | `autonomy census` probes artefacts for both presence and practice (last changed, run by CI, exercised in the ledger). It writes a profile with one level per dimension. Unknown cells count as C2, so missing evidence lowers the cap. | Partial |
| A.5 | Tested stop | A monthly drill triggers the stop against a canary run, asserts the halt and token revocation, then restores. A failed drill demotes the workflow. | Thin |
| A.6 | Enforcement through hooks | SessionStart computes the effective level. PreToolUse blocks actions outside the grant, including agent writes to `.autonomy*`, CODEOWNERS or CI config. PostToolUse writes an audit record. Context eval gains an `autonomy` suite that tests the gate. | Strong (mechanism), Thin (outcomes) |
| A.7 | Portfolio review | At each review date, an issue is opened showing the ledger trend, cost per merged outcome against the baseline, and the stop rule evaluated. The owner records keep, promote, demote or retire. | Thin |

Example register entry:

```yaml
workflows:
  - id: dep-bump
    owner: team-platform            # resolves in CODEOWNERS
    sponsor: "@alice"               # accountable human; access expires with sponsorship
    granted_level: 4
    identity: github-app:deps-bot   # non-personal, short-lived token
    permitted_actions: { paths: [package.json, package-lock.json], git: [open_pr, auto_merge] }
    forbidden_actions: [deploy, read_secrets, edit_ci, edit_autonomy]
    risk: { reversible: true, verification: mechanical, blast_radius: repo,
            trifecta: { untrusted_input: true, sensitive_data: false, external_action: false } }
    limits: { max_runs_per_day: 5, max_cost_usd_per_run: 2.00, max_diff_lines: 400 }
    stop: { mechanism: "disable workflow; revoke app token", authority: [team-platform, "@oncall"],
            last_tested: 2026-11-02 }   # written by the drill job
    review_date: 2027-02-01
    stop_rule: "retire if < 2 merged PRs/month over 90 days"
```

Promotion criteria (illustrative defaults):

| To | Criteria over the evidence window |
|----|----------------------------------|
| A3 | At least 20 runs at A2. First-run pass rate on required checks has a lower bound of 0.80 or more. A traced sample shows substantive human review. An owner is named. |
| A4 | At least 30 runs at A3. First-run pass lower bound of 0.90 or more. Revert upper bound of 3% or less. Zero escaped defects. Task bank scores 0.90 or more on the current harness. The work is reversible and mechanically verified. A stop drill passed within 30 days. Cap of C4 or higher. |
| A5 | At least 90 days at A4. Baseline, target and stop rule are set. Cost per merged outcome is reported. One review cycle has a recorded decision. Cap of C5. |
| Demote | Any one of: an S2+ escaped defect or a linked incident; revert rate above 6% (hysteresis against the 3% promotion threshold); task bank below its floor; harness changed without an eval; stop drill overdue; owner, sponsor or access expired; a limit breached or a forbidden action attempted. |

How the common per-agent trust-tier design would change:

| Per-agent trust tiers (common design) | Change |
|---------------------------|--------|
| Tiers per agent | Grants per workflow |
| Promotion on consecutive successes, with an unspecified source | Promotion on ledger evidence written by CI, with confidence bounds, plus human sign-off |
| "Autonomous (no oversight)" | "Unattended (observed)": owner, limits, audit record and tested stop remain |
| No link to model changes | A change to `harness_hash` caps the grant at A3 until the task bank passes |

**One line the repo should state outright: stack tests are what earn autonomy.** A4's condition that
verification is mechanical can only be met where L1 covers the workflow's user journey.

## 5. Goal B: self-repairing software

The repo closes a development-time loop; self-repair closes a production-time loop. The only
evidenced top of the curve is unattended change "because verification is mechanical and the action
reversible": Spotify's 2.5 million auto-merged maintenance PRs (MC-21). The repo supplies the
mechanical half and none of the reversible half. Neither research document found unattended
incident repair, only maintenance. `[repair]`

Each stage of the repair loop:

| Stage | Today |
|-------|-------|
| Detect | Missing |
| Diagnose | Exists: 1.3's diagnostic ladder |
| Reproduce from the incident | Missing |
| Propose a fix | Missing |
| Verify | Exists: 1.1, 1.2, 1.6 |
| Classify risk | Missing |
| Production gate | Missing |
| Progressive confirmation | Missing |
| Learn | Partial: 2.8 records learnings as prose only |
| Stop or roll back | Missing |

The health endpoint's test mode (1.1) is a ready-made detection probe, but it is defined for tests
only.

These patterns are proposed as an L1 sub-family, "Closing the loop in production". Production
repair is the same loop with a different trigger and a wider confirmation step. It is blocked by L4
maturity rather than stacked on it.

| ID | Pattern | Summary | Evidence |
|----|---------|---------|----------|
| 1.7 | Incident-to-stack-test | Every incident in owned code ends with a reproduction stack test that is red before the fix and green after it, placed in the sequential suite. No repair is proposed until the reproduction is red. "Cannot reproduce" routes to a human. Incidents in agent configuration become eval cases. Ship this first: it is useful at A3 with no autonomy. | Strong (human practice), Partial (agent) |
| 1.8 | Reversibility and blast-radius classes | Each change is classified deterministically from its diff, failing closed. Reversibility: R0 inert, R1 flag-reversible, R2 deploy-reversible, R3 data-forward, R4 irreversible or external. Blast radius: B0 one journey, B1 one service, B2 a cross-service contract, B3 money, auth, PII or audit. | Partial; the taxonomy is new |
| 1.9 | Repair loop with a frozen oracle | The reproduction test is frozen as a protected path before the fix is written, and the fix may not touch existing tests. An anti-masking scan applies 1.6's forbidden patterns to production diffs. A hit reclassifies the change as a mitigation, which routes to a human. | Strong (principle); separating the oracle from the fix is new |
| 1.10 | Production gate and progressive confirmation | "The agent may act up to the production gate and cannot pass it" (AN-27). The gate is deterministic code outside the agent that returns auto, human or block. An auto result ships behind a flag or canary, with a pre-declared confirmation rule and a minimum sample. Rollback is automatic and rehearsed. | Partial, Thin |
| 1.11 | Repair budget, circuit breaker, stop authority | Each fingerprint gets an attempt budget, with a cooldown after a rollback. Revert or recurrence rates drop the grant automatically, and a human restores it. A named on-call role holds a tested stop. Anthropic names this breaker as not yet built (AN-29). | Partial; none found in practice |
| 1.12 | Self-healing tests are not self-healing systems | Tests never heal themselves. A test the loop wants to change means the spec changed. Systems heal at three depths: runtime recovery, mitigation, repair. Recovery that repeats without a repair ticket is a masked defect. | Definitional |

Repair capability that is defensible at each grant:

| Grant | Defensible repair capability |
|-------|------------------------------|
| A3 | The agent drafts a reproduction and a fix PR from an incident record; a human merges, with an evidence bundle |
| A4 | First-pass diagnosis on every incident. R0-R1/B0 repairs pass through the gate with a canary, budgets, a tested stop and a register entry. |
| A5 | Grants move on revert and recurrence evidence. Workflows are retired. R2 repairs run unattended for named classes only. |
| Never, on current evidence | Unattended R3/R4 repairs at any grant. The trading-bot reference domain is mostly R4. |

Collisions with the repo's own constitution:

- **Zero-defect plus automatic action flaps.** In production, zero-defect should govern what must be
  addressed (triaged, fingerprinted, owned), not what is auto-repaired.
- **Automatic repair tends to mask defects.** Without the 1.9 scan, a repair loop converts defects
  into silent defects.
- **Evidence is binary; production confirmation is statistical.** Accept graded evidence under a
  pre-declared rule that code decides, and keep it out of gates for irreversible actions.
- **The "real dependencies" rule blocks the most common reproduction.** Add a carve-out:
  network-level fault injection in front of a real dependency is not a mock.
- **Doc freshness.** A code-only repair loop breaks rule 4 by construction.
- **Approval fatigue.** Polished evidence bundles get less scrutiny (IS-3), and 93% of prompts are
  approved (SG-9). Humans should decide about classes of change, not each instance.

## 6. Prerequisite track: containment, ownership and people

Both goals are blocked by the same capping dimensions. `[governance]` `[autonomy]` `[adopter]`

**Proposed replacement for the L2 thesis.** Prose is guidance. Hooks are deterministic policy within
the harness. Containment and credentials are the boundary. Put each rule at the lowest layer that
can hold it:

- What must never happen is prevented by the sandbox, credential scope or downstream authorisation.
- What must always happen runs as a hook and a required CI check.
- Prompts and skills carry everything else.

A hook is inside the agent's operating environment, so it is not a security boundary.

| Proposed pattern | Problem it solves | Evidence | Sources |
|------------------|-------------------|----------|---------|
| Contain before you relax | Agents run on the host with shell, keys, network and the Docker socket. Sandbox on and locked by default; secrets injected outside the boundary; fail closed. | Partial | PL-14 PL-15 SG-10 AN-9 AN-11 |
| Layered enforcement | One mechanism used for nudging, quality and safety alike. Declare each rule's enforcement point. PostToolUse detects; it does not prevent. | Strong | SG-7 SG-11 SG-16 SC-8 OM-7 |
| Least agency and session composition | Untrusted input, private data and external action never meet in one session without a gate. Rinsing runs read-only. | Strong | SG-1 SG-2 SG-3 SG-16 |
| Agent identity and delegation | Per-agent, short-lived, audience-bound credentials; "agent X for person Y" in logs | Partial | PL-5 PL-7 PL-8 SG-20 |
| Skill, plugin and MCP supply chain | 13.4% of 3,984 public skills had a critical issue. Allowlist, pin, read before install, review updates as diffs. | Strong (threat) | SG-28 SG-29 IS-13 |
| Risk-tiered review | Uniform review is "human-in-the-loop theater". Tier by reversibility and blast radius. The requester cannot approve their own change; an agent's approval never counts as a human's. | Partial | SG-9 SG-26 OM-18 AN-29 |
| Author of record and agent register | The requester answers for agent-written code. The register records owner, sponsor, expiry and retirement (folds into A.1). | Partial | PO-10 to PO-17 |
| Evidence over self-report | Completion evidence comes from systems the agent cannot edit | Strong | IS-6 MC-22 MV-8 |
| Deliberate practice | Protect hands-on debugging; explain-before-merge for owned modules; a work sample in the new-starter audit | Partial | IS-1 IS-4 AN-20 |
| Threat model page | Assets, untrusted entry points, capabilities, and the pattern that mitigates each | Synthesis | SG chapter |

**Vendor neutrality:**

- Write each pattern against a neutral contract, with bindings for Claude Code, another harness,
  and a CI-only setup.
- Make AGENTS.md the shared instruction file and have CLAUDE.md import it.
- Disclose the author's relationship to rig.

**Compound engineering:** learnings written by agents feed future prompts without review (IS-13).
Promote a learning only after review, and only after a repair's confirmation window passes. Pair
capturing learnings with pruning them.

## 7. Prune and re-baseline

The repo has not changed since 2026-04-18, which makes it an instance of the RAMP finding: committed
AI configuration that is present but never maintained (MC-11). Anthropic reports removing over 80%
of Claude Code's system prompt for the Claude 5 generation with no eval loss (AN-7). `[adopter]`
`[evidence]`

**New pattern: Prune and re-baseline context.**

1. Give every context artefact an owner, a reviewed date and an expiry.
2. Keep a fixed task bank of 10-30 tasks against a pinned model.
3. On each model upgrade, delete first. Add an artefact back only if a task regresses, and record
   which task justified it.
4. Classify each rule as guidance (prunable prose) or invariant (lives in a hook, deny rule or CI).
5. Track whether artefacts are maintained, not merely present.

| Action | Items |
|--------|-------|
| Cut, or move to rig's docs | 3.7 TOON (done in Phase 0); 3.8 Session lifecycle; 3.3 routing code; 2.6/2.7 rig-internal snippets; `specs/` and `docs/plans/` (done in Phase 0); trading-bot commit-mix analysis presented as evidence |
| Merge | 0.9 + 4.3; 3.1 + 3.2 + 3.5 into "prefer native tools, block destructive edits"; 3.4 Scout into a context-isolation note; 0.7 + 4.2 into a docs-freshness pattern; duplicate L1 summaries |
| Demote to optional | 2.2 skill chain as mandatory, and 2.7 blocking tracker; rule 6 (150 lines) becomes "short, owned, tested" with a warning at about 200 lines; "3-5 exports"; 3.6 multi-repo alignment |
| Promote or add | Verification (1.1, 1.2, 1.6) as the core; 4.6 generalised to gate every context, skill or model change, with pass^k; evidence labels and `last-validated-model` on every pattern; a one-day start page; a repo census |

## 8. Defects to fix now

| Defect | Where | Found by |
|--------|-------|----------|
| TOON example claims 163 vs 61 chars (63%). Measured: 117 vs 79 (32%). The "46 characters" example is 38. | `docs/L3-optimization.md` (TOON section) | `[evidence]` `[adopter]` |
| Token savings stated as 60-90%, 60-80% and "80% more", all unsourced | README, L3, glossary, anti-patterns | `[evidence]` `[adopter]` |
| "~80% of failures from context" and "90.2% better" come from a single video | L3 3.4, further-reading | `[evidence]` |
| Stack-test examples mount `./mock-app`, which does not exist; the guardrails example has no tests | `examples/stack-test/*/docker-compose.test.yml`, `examples/guardrails/` | `[adopter]` `[repair]` |
| A hook example comments "block" but returns, which allows the call | L2 2.3, context-aware hook | `[governance]` `[repair]` `[evidence]` |
| The `sed -i` string match is bypassed by `/usr/bin/sed`, `perl -pi` and `$(...)`; the router allows every `docker` command | L2, L3, `examples/guardrails/src/core/router.ts`, `routing.config.ts` | `[governance]` |
| The trading-bot study says PostToolUse hooks "redirect" commands; they fire after the command | trading-bot case study, L3 section | `[evidence]` `[governance]` |
| CLAUDE.md `@docs/...` imports load the whole library into context | `CLAUDE.md` | `[evidence]` |
| Mock rules contradict each other. 1.1 says failures "always indicate real bugs". A former case study (removed 2026-11-19) said unit tests use no mocks, and its integration tests auto-skip without `.env`. | 1.1, 1.5, L0.5, a former case study | `[evidence]` |
| Broken internal anchors (13 by one check, 27 by another); CI strips anchors; L4.5 references a `scripts/` directory that does not exist | across docs; L4 4.5 | `[adopter]` `[evidence]` |
| jcodemunch linked to two owners; `specs/` and `docs/plans/` are not in the master index (resolved by D6: both deleted) | L3, further-reading, CLAUDE.md | `[evidence]` `[governance]` `[autonomy]` |
| Design rinsing feeds untrusted content into a session with write, shell and network access, with no prompt-injection warning | L1 design rinsing | `[governance]` |

Already done: gstack references removed and two pre-existing lint errors fixed (PR #4).

## 9. Roadmap

| Phase | Scope | Exit |
|-------|-------|------|
| 0 Correct | Fix section 8; anchor check in CI; real minimal app for stack-test examples; plain links instead of `@` imports | Lint, link and anchor checks pass; both stack-test examples run from a clean clone |
| 1 Reframe | Rename levels to layers; "what this library does not cover"; replace the 4.4 stage table; evidence labels; prune, merge and demote; AGENTS.md; layered-enforcement L2 thesis | Every pattern carries an evidence label; CLAUDE.md indexes a smaller library |
| 2 Contain | Section 6 patterns; threat model; containment and ownership gate in the adoption guide | A reader reaches C3 on security and governance from the library alone |
| 3 Earn autonomy | `docs/earned-autonomy.md` (A.1-A.7); `examples/autonomy/` in TS and Python | The census places this repo; `autonomy check` runs in its CI |
| 4 Repair | 1.7-1.12; fault-injection carve-out; app/ops contract; `examples/repair-loop/` in TS and Python | Stack tests show the fix accepted, the masking patch routed to a human, and the test edit blocked |
| Ongoing | Prune and re-baseline at each model generation; `last-validated-model` per pattern | Recorded as the library's own case study |

Scoped plans for each phase are in [plans/](plans/). Open decisions are in
[decisions.md](decisions.md).

## 10. Reviewer disagreements resolved here

- Four lenses each proposed a different "Pattern 4.7": a workflow register, a repair register,
  author of record, and prune. The synthesis folds the registers into A.1 and keeps prune as its own
  pattern.
- The reviewers counted broken anchors differently, 13 and 27. Phase 0 re-counts with
  `tools/linkcheck.py` and fixes all of them.
- Where self-repair lives: an L1 sub-family, not L5 (all lenses agree).
- The governance lens files containment under L0 ("contain before you relax"), and the autonomy
  lens files it under L2 (2.9). Phase 2 places it in L2, with a pointer from L0.
