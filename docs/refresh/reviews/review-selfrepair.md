# Review: agentic-patterns through a self-repairing-software lens

> Edited on 2026-11-19 for vendor neutrality. References to the second research input now name it the Anthropic
> guidance companion (cited as AC). Findings are otherwise unchanged.
> Edited again on 2026-11-19: Anthropic source IDs renamed from the A27 form to the AN-27 form, and citations of the
> companion's own positions, stances and recommendations replaced with the Anthropic or baseline sources
> beneath them. Every ID resolves in [../../references/sources.md](../../references/sources.md).

Reviewer lens: self-repairing software futurist. Sources: the repository at
`/home/user/agentic-patterns` (README, CLAUDE.md, L0-L4, L1-patterns, cross-cutting incl. faq.md,
references, examples) against `research/industry-baseline.txt` (cited as **BL §x**) and
`research/anthropic-companion.txt` (cited as **AC**; its Anthropic sources as AN-n). Evidence labels (Strong / Partial / Thin / None found)
follow the baseline's convention. Where a claim is my own inference it is marked *(inference)*.

---

## 0. Framing: two loops, one oracle

agentic-patterns closes a **development-time loop**: context harvest -> design -> implement -> stack
test -> confirm (L1 "REPL fractal"). The FAQ deliberately moves "scaling, monitoring, observability,
and alerting" to a separate DevOps repo.

Self-repairing software closes a **production-time loop**:

```
detect -> triage/diagnose -> reproduce -> propose fix -> verify -> gate -> deploy (progressive)
       -> confirm in production -> learn (incident becomes test/eval) -> (stop / roll back at any step)
```

The repo already describes the hardest single component of that loop: a **mechanical oracle**
(stack tests with full-loop assertions, run on a developer machine, binary pass/fail). The baseline
says the only evidenced top of the curve is unattended change "because verification is mechanical
and the action reversible" (BL §3.7, Spotify 2.5M auto-merged maintenance PRs, MC-21). The repo has
the *mechanical* half and none of the *reversible* half. It also has nothing on the dimension the
baseline names as the weakest in the whole field: production ownership (BL §4.5, finding 7).

Applying the baseline's **cap rule** (BL §3.5: the lowest of platform, governance, ownership and
measurement limits autonomy for unattended work): agentic-patterns is roughly level 3 on operating
model (conventions as hooks, checks before humans), and level 1-2 on production ownership and
measuring value (L4 scope note admits 4.1-4.5 are not implemented in the reference project). A
team that adopts the library as written should be treated as **level 2 for unattended work**.
Self-repair is unattended work by definition. So the honest headline is: *the library is a good
substrate for self-repair, and on its own does not license any of it.*

---

## 1. Substrate inventory: what already exists, what it lacks

| Repo asset | Role in a repair loop | What is missing for production use |
|---|---|---|
| Stack tests (1.1), atomic user journeys, local Docker | The **verification oracle** for a proposed fix; red->green on a reproduction is the cleanest mechanical signal available | No path from a production signal to a new stack test. Stack tests are written from requirements, never from incidents. Production data shape/scale is not reproducible locally (and must not be, for privacy) |
| Full-loop assertions (1.2): primary / second / third order | Lets a repair be verified on side effects, not just status codes; third-order (audit, notifications) is the closest thing to a production "confirm" step | No mapping from production SLIs (error rate, latency, saturation) to assertion layers. Third-order assertions are the natural bridge to production telemetry but are framed only as test-time |
| Sequential/additive design (1.3), incl. "Additive tests as comparative ground truth" | Diagnostic ladder for localisation: the first failing test in sequence names the subsystem; comparative diff against a passing parent test is a usable automated diagnosis step | Assumes the failure surfaces *in the suite*. A production incident that the suite does not reproduce gets no ladder |
| Health endpoint test mode (1.1 `?mode=test`) | Ready-made **detection and readiness probe**; the services block already reports per-dependency state | Defined only for tests. No production mode, no SLO thresholds, no "degraded" semantics, no history. Explicitly declared "not a synthetic endpoint", which is the right instinct for a production probe |
| Test integrity (1.6): six forbidden patterns | The strongest **anti-masking** rule set in the repo. Catch-without-rethrow and soft assertions are exactly how naive auto-repair "fixes" errors | Scoped to test code. Nothing applies the same rules to *repair diffs in production code* (a retry wrapper or a swallowed exception is a soft assertion in production) |
| Zero-defect (2.5) | Supplies the trigger: every error is a signal, none are "unrelated" | At production volume, zero-defect plus automatic action is a flapping generator. No notion of error budget, deduplication or fingerprinting |
| Hooks / enforcement pipeline (2.3, 2.6) block/advise/silent | The **deterministic gate** shape; severity resolution is what a production gate needs | Only PreToolUse/PostToolUse in a dev session. No deploy-time hook, no gate outside the agent session |
| Phase tracker (2.7) | State machine pattern for loop stages; "cannot enter verify+ without tdd+" generalises to "cannot enter deploy without reproduce+verify" | Phases are dev-lifecycle only; no `reproduce`, `canary`, `confirm`, `rollback` states |
| Constitutional rules (2.4) | Where hard limits on a repairing agent would be declared | No rule about irreversible actions, production access, or stop authority |
| Compound engineering (2.8) | The **learn** step: each solved problem documented for lookup | Learnings are prose docs (`docs/solutions/`). The research says incidents should become *executable* evals/tests ("Any incidents are now an eval", AN-29), not notes |
| Context eval (4.6), graduated scoring, threshold gate | The **eval harness for the repair agent's decisions** (classify, gate, roll back) | Applied only to routing/enforcement. Graduated 0.5 scoring is the wrong instrument for irreversible-action decisions (must be exact, i.e. pass^k, BL §4.7) |
| Evidence-based claims (4.1) | Requires that "fixed" is shown, not asserted | Before/after evidence is defined for local reproductions only; no production confirmation evidence |
| Worktrees (0.6), container isolation (1.4) | Isolation for parallel repair attempts; matches BL "sandboxing a sensible default" (OM-18) | Nothing about the repair agent's own identity, credentials or sandbox |
| FAQ: DevOps repo detects config drift between compose and Terraform | Shows the authors already do cross-repo agent work on ops | The boundary contract (signals in, reproductions and patches out) is undefined |

### Gaps, stated as the missing loop stages

1. **Production signal -> reproduction stack test.** No pattern, no schema for an incident record.
2. **Incident -> permanent regression test / eval.** Compound engineering captures prose; nothing
   requires an executable artefact.
3. **Reversibility and blast-radius classification** of a proposed change. Absent.
4. **Production gate.** Absent; the deepest gate is review+ in a dev session.
5. **Progressive delivery / canary / feature flags.** Absent. BL §4.5 (PO-28) notes rollback "becomes
   highly risky when dozens of changes have been submitted in rapid succession" (intervening PR
   problem) and recommends flags and fix-forward.
6. **Repair budget, circuit breaker, cooldown.** Absent. Anthropic notes that its own circuit breaker
   "that tighten[s] approval when reverts rise" is "not yet built" (AN-29).
7. **Ownership of the repairing agent** (sponsor, permitted actions, limits, audit, tested stop —
   BL level 4; AN-27). Absent.
8. **Stop and restore authority.** Absent. BL PO-14: "a healthy agent can still take harmful actions".
9. **Confirmation in production** with a defined window and evidence. Absent.
10. **Repair-loop metrics** (MTTR, repair revert rate, recurrence rate, masked-defect rate). L4.4
    lists "rollback frequency" but nothing repair-specific.

---

## 2. Proposed pattern set: "L1-P — Closing the Loop in Production"

I recommend this as a **new L1 sub-family plus one L4 pattern**, not a new pyramid level. The core
argument of the repo is that L1 is "closed loop design and verification"; production repair is the
same loop with a different trigger and a wider confirm step. Putting it at L5 would imply it sits on
top of a completed L4, which is exactly the wrong signal given the cap rule — it should be *blocked
by* L4 maturity, not stacked on it. Numbering is a suggestion: 1.7-1.12 under `docs/L1-patterns/`,
4.7 in L4, with a cap-rule note in the adoption guide.

Each pattern: problem, solution, prerequisites, evidence strength, failure modes.

### Pattern 1.7 — Incident-to-Stack-Test (Reproduce Before Repair)

**Problem.** A production incident is diagnosed and patched, but the system never gains a test that
would have caught it. The next agent session faces the same failure from zero. Prose postmortems
(and prose `docs/solutions/` entries) do not execute.

**Solution.** Every incident whose root cause is in owned code ends with a new **reproduction stack
test** that (a) fails on the pre-fix commit, (b) passes on the fix commit, (c) is added to the
sequential suite at the position of the subsystem it exercises (1.3). The reproduction is the
artefact of record; the postmortem links to it. The incident record has a schema (fingerprint,
entry point / journey, request shape with PII stripped, observed vs expected, dependency states from
the health block). Reproduction is generated from that record via the existing StackTestUtils
toolkit, never against production data.

**Rules.**

- No repair is proposed until the reproduction is red on the current production commit. "Cannot
  reproduce" is a valid, terminal outcome that routes to a human, not a licence to patch blind.
- The reproduction test is authored and frozen **before** the fix is written (see 1.9 on
  separating oracle and repairer).
- Where the incident lives in agent configuration (prompt, skill, model, permissions), the artefact
  is an eval case in the context-eval suite (4.6) instead of a stack test.

**Prerequisites.** Runnable stack tests (currently broken in `examples/`, see §5); a structured
incident record; structured logging (FAQ already says the app repo "owns (produces)" logs).

**Evidence.** Human-run equivalent is **Strong** (SRE postmortem canon with owned, tracked action
items, OM-20). "Incidents become evals" is **Partial** (Anthropic first-party, AN-29; "start with 20-50
tasks drawn from real failures", AN-16). Agent-generated reproduction from incident records: **None
found** in either document.

**Failure modes.** Over-fitted reproduction (asserts the exact payload, not the invariant), so the
fix passes the test and the class of bug survives. Reproductions that need prod-only data and so
get "approximated" until they no longer reproduce. Suite bloat: every incident adds a full stack
journey; mitigate with the repo's own reconciliation guidance (1.1 "Stack test brittleness").

### Pattern 1.8 — Reversibility and Blast-Radius Classification

**Problem.** "Can the agent do X unattended?" is answered per prompt, by a human, at volume — and
BL finding 4 shows people approve 93% of prompts (SG-9). Approval is not a control.

**Solution.** Classify every proposed repair action **deterministically, from the diff and the
target, before any human sees it**, on two axes:

| Reversibility | Definition | Example |
|---|---|---|
| R0 Inert | No runtime effect | Add test, add log field, doc |
| R1 Flag-reversible | Behind a flag defaulting off; disable is one config write | New code path guarded by flag |
| R2 Deploy-reversible | Revert commit + redeploy restores prior state; no data written in new shape | Pure logic fix |
| R3 Data-forward | Writes data that the old version cannot read, or migrates schema | Migration, backfill |
| R4 Externally visible / irreversible | Money moved, message sent, third-party state changed, deletion | Refund, email, chain tx |

| Blast radius | Measured by |
|---|---|
| B0 single journey, internal | which stack tests touch changed files (mechanical, from coverage) |
| B1 one service, all users | |
| B2 cross-service contract | changed public interface (deep-module seam, 0.1) |
| B3 money, auth, PII, audit | owner-listed paths (cf. AN-29: owner-listed paths and CI workflow files always need a person) |

The classification is data-driven config (same shape as `examples/guardrails/src/config/routing.config.ts`)
and is itself covered by context-eval scenarios with **exact** scoring.

**Prerequisites.** Deep modules (so blast radius is computable from the seam); code ownership file;
test-to-file coverage mapping.

**Evidence.** Tiering by risk beats uniform approval: **Partial-to-Strong as a direction** (BL
finding 4; OM-18 "human-in-the-loop theater"; Anthropic 0.8% of actions irreversible, MC-20). The
specific R/B taxonomy is **my synthesis; None found** as a published scheme. Note the reference
project is a trading bot: most of its interesting repairs are R4/B3, i.e. the worst possible
candidate for self-repair *(inference)*.

**Failure modes.** Misclassification by under-reading the diff (a "pure logic" fix that changes how
amounts are rounded is R4 in a payments system). Mitigate: unknown => highest class; classifier
fails closed. Classification drift as code moves; requires the ownership file to be maintained
(BL: "presence is not practice", RAMP MC-11).

### Pattern 1.9 — Repair Loop with Mechanical Verification

**Problem.** An agent that writes both the reproduction and the fix grades its own homework. The
cheapest way to turn a red test green is to change the test, widen the tolerance, or catch the
exception.

**Solution.** A repair is accepted by the loop only when **all** of these are mechanically true:

1. Reproduction test (1.7) was red on base commit, is green on candidate, and **is byte-identical**
   to the version frozen before the fix (enforced as a protected path in the repair agent's
   permissions, not by instruction — BL finding 3).
2. Full stack suite and unit suite green (zero-defect, 2.5), run in an isolated stack (1.4).
3. The diff touches no existing test file except to add the reproduction.
4. **Anti-masking scan** on the production diff — the six test-integrity patterns (1.6) applied to
   production code: new bare `catch`/`except` without rethrow, new retry loops, increased timeouts,
   lowered thresholds, new feature flag default-off on the failing path, early returns on error. Any
   hit reclassifies the change from **fix** to **mitigation**: allowed, but routed to a human, and a
   root-cause ticket with an owner is opened automatically.
5. Classification (1.8) is R0-R2 and B0-B1 for unattended progression; anything else stops at a
   human with the evidence bundle attached.
6. Evidence bundle per 4.1: before/after test output, diff, classification, anti-masking result.

**Prerequisites.** 1.6 enforcement already implemented as a hook (rig `checkConstitutional`), so the
scanner exists in shape; L2 phase tracker extended with `reproduce` and `verify-repair` phases.

**Evidence.** "Every agent task ends on a check the agent can run": **Strong** on principle (OM-7,
OM-9). Unattended merge where verification is mechanical: **Strong at scale for maintenance**
(Spotify, MC-21), **Thin/None found for incident repair**. Separation of oracle and repairer: **None
found** in the research; it is the obvious defence against Goodhart and I'd flag it as the most
important original contribution the repo could make *(inference)*.

**Failure modes.** Goodhart on tests (above). Fix passes the reproduction, breaks an untested
journey — the suite is only as good as its journey coverage; the repo has no coverage-of-journeys
metric. Masking via code the scanner does not recognise (defensive `Optional`/`?? default`). Long
suites make the loop slow enough that humans bypass it.

### Pattern 1.10 — Production Gate and Progressive Confirmation

**Problem.** A verified fix is still a deploy. Stack-test green is local evidence; production
behaviour is the claim.

**Solution.**

- **The repair agent may act up to the production gate and cannot pass it** (AN-27). The gate is
  deterministic code outside the agent (a deploy hook / pipeline step), consuming the evidence
  bundle and classification and returning `auto | human | block` — the same block/advise/silent
  severity resolution as 2.6.
- Only `auto` changes progress, and only via **progressive delivery**: flag or canary to a small
  cohort, with a fixed **confirmation window** in which production evidence must show the incident
  fingerprint absent and the journey SLIs within bounds. The health endpoint gets a production mode
  (status + per-dependency + version) so confirmation compares like with like.
- Confirmation evidence is graded, not binary (see §3 on the tension with the repo's binary ethos):
  a pre-declared statistical rule (e.g. fingerprint count zero over N requests on the cohort,
  error rate not worse than control) decided by code, not by the agent.
- Rollback / flag-off is automatic on confirmation failure and is **rehearsed** (AN-27 "rehearsed
  rollback").
- Prefer flag-off over revert at high change volume (intervening PR problem, PO-28).

**Prerequisites.** Feature flags; deploy pipeline that accepts a gate; production health signals;
the FAQ's app/DevOps contract written down.

**Evidence.** Production gate: **Partial/Thin** (one vendor playbook, AN-27). Progressive access and
circuit breakers for agents: **Partial** (one position paper, PO-28). Flags over rollback: **Thin**
(PO-28). Canary/progressive delivery for human changes is mature general practice but neither
research document evidences it, so I label it **not assessed here**.

**Failure modes.** Confirmation window too short for low-traffic paths (absence of errors with no
traffic is not evidence) — require minimum sample size. Flag debt: every repair leaves a flag;
needs a retirement rule (0.8 aggressive cleanup should name flags). Gate-by-agent creep: someone
lets the agent "summarise the canary" and the agent becomes the gate.

### Pattern 1.11 — Repair Budget, Circuit Breaker and Stop Authority

**Problem.** Automatic repair at production volume oscillates: repair -> regress -> revert -> repair.
Zero-defect turns every alert into a trigger. A healthy agent can take harmful actions (PO-14).

**Solution.**

- **Per-fingerprint attempt budget** (e.g. one automatic attempt, then human); **per-service daily
  budget**; **cooldown** after any rollback; global spend/turn caps (AN-3 asks what stops an unattended run).
- **Circuit breaker on outcomes**: if the repair revert rate, or recurrence rate (same fingerprint
  within N days of a "confirmed" repair), crosses a threshold, the workflow drops one autonomy tier
  automatically (auto -> human-approved -> read-only diagnosis). Raising it back is a named human
  decision recorded in the register. This is the breaker Anthropic says it has not built (AN-29).
- **Stop authority**: a named person/role can stop the repair workflow; the stop is a single
  deterministic switch, **tested on a schedule** ("tested stop", BL level 4). A named role
  approves restore after an agent-caused incident (PO-14).
- Hysteresis: thresholds to trip differ from thresholds to reset, to avoid tier flapping.

**Prerequisites.** Fingerprinting/deduplication of incidents; repair register (1.12); metrics (4.7).

**Evidence.** Circuit breakers and per-agent rate limits: **Partial** (PO-28, one paper). Stop and
restore authority: **Partial** (vendor guidance PO-14, PO-12). Outcome-triggered autonomy
reduction: **None found** in practice (named as unbuilt by AN-29).

**Failure modes.** Budget exhaustion during a real outage when repair would help — acceptable;
humans are the fallback. Breaker never trips because recurrence detection depends on fingerprint
stability (stack traces change with the fix). Stop switch exists but nobody has authority to pull
it at 3am — the stop must have an on-call owner, not a committee.

### Pattern 1.12 — Self-Healing Tests vs. Self-Healing Systems

**Problem.** "Self-healing" is used for two opposite things. Self-healing *tests* (tests that adapt
selectors, retry, or rewrite expectations when they fail) remove signal. Self-healing *systems*
(the system restores correct behaviour) add it. The first is forbidden by this repo's own rules.

**Solution.** State explicitly:

- Tests never heal themselves. A test that changes its own assertions on failure is a soft
  assertion (1.6 rule 6) with extra steps. Playwright locator auto-repair is acceptable only as a
  proposed diff that goes through 1.9 like any other change, with assertions protected.
- A test that the repair loop wants to change is evidence that the *spec* changed; that is a design
  decision (brain+/plan+), not a repair.
- Systems may heal at three depths, in increasing autonomy: **runtime recovery** (restart, failover,
  breaker — owned by ops, FAQ split), **mitigation** (flag-off, rollback — reversible, 1.10),
  **repair** (code change — 1.7-1.11). Only repair produces a learning artefact; runtime recovery
  that repeats without a repair ticket is a masked defect.

**Evidence.** Neither research document covers self-healing tests. This is a definitional pattern
that follows from the repo's own constitutional rule 5; label **None found (definitional)**.

**Failure modes.** Teams adopting a vendor "self-healing test" product and believing they have
self-repair. Runtime recovery (pod restarts) hiding a memory leak indefinitely.

### Pattern 4.7 — Repair Loop Register and Metrics (L4)

**Problem.** An unattended workflow nobody can list, own or stop is level 1 on ownership regardless
of how good its tests are (BL §4.5 level table).

**Solution.** Each repair workflow has a register entry: owner and sponsor, permitted action classes
(R/B tiers), budgets, stop switch and last tested date, eval suite and its owner, review date and
stop rule (BL level 5 and §4.7).
Metrics, in tension-pairs per SPACE/DORA (MV-3, MV-5):

- speed: time-to-reproduce, time-to-confirmed-repair (MTTR);
- stability: repair revert rate, recurrence rate per fingerprint, escaped regressions caused by repairs;
- integrity: mitigation-vs-fix ratio, **masked-defect rate** (runtime recoveries without a repair
  ticket), reproduction-cannot-reproduce rate;
- cost: cost per confirmed repair (MV-18 "cost per successful outcome").
Never a target: number of auto-repairs (MV-1 Goodhart).
Evals for the repair agent's decisions report **pass^k** (MV-9), not best-of-k.

**Evidence.** Workflow register with owner/limits/stop: **Partial** (vendor guidance; no practice
evidence, BL §4.5 "What is not known"). Pass^k task banks: **Strong as engineering practice**
(MV-9). Repair-specific metrics: **None found**.

### Mapping to the always-on primitives and the curve

Anthropic lists always-on agent primitives "an event inbox, timers, memory, permissions, and an outbox"
(AN-32). The repair loop maps cleanly *(inference)*:

| Primitive | Repair loop element |
|---|---|
| Event inbox | Incident records, alerts, failed-deploy events (fingerprinted, deduplicated) |
| Timers | Confirmation window, cooldown, stop-test schedule, register review date |
| Memory | Fingerprint history, prior attempts, reproduction tests, compound learnings |
| Permissions | R/B tier ceiling, protected paths (tests, owner-listed paths), no deploy credential |
| Outbox | PR with evidence bundle, ticket for mitigations, page to owner, register update |

| Curve level (BL §3.5) | Repair capability that is defensible at that level |
|---|---|
| 3 Verified delegation | Agent drafts reproduction + fix as a PR from an incident; human merges; evidence bundle required |
| 4 Governed autonomy | First-pass diagnosis on every incident (OM-14, thin); R0-R1/B0 repairs through gate with canary; budgets, tested stop, register |
| 5 Self-correcting | Tiers move on revert/recurrence evidence; workflows retired; R2 repairs unattended for named classes only |

R3/R4 repairs are not unattended at any level supported by current evidence.

---

## 3. Risks and contradictions

### 3.1 With the repo's own constitutional rules

- **Zero-defect (rule 3) vs. production noise.** In development, "every error matters" is achievable
  because the environment is deterministic (1.4). In production it produces an unbounded trigger
  stream. Literal zero-defect + automatic action = flapping. Resolution: zero-defect governs what
  must be *addressed* (triaged, fingerprinted, owned), not what must be *auto-repaired*. The repo
  should say this before anyone builds a loop on it.
- **Zero-defect vs. mitigation.** The fastest way to make an error disappear is to catch it. Without
  1.9's anti-masking scan, an auto-repair loop is a machine for converting defects into silent
  defects — the production analogue of the soft assertions the repo forbids.
- **Evidence-based claims (rule 2) vs. probabilistic confirmation.** The repo's evidence model is
  binary command output. Production confirmation is statistical. Either the repo accepts graded
  evidence with a pre-declared decision rule (and says so), or "confirmed" becomes an unfalsifiable
  claim ("no errors since deploy" on a path with no traffic). Context eval already uses graduated
  scoring, so there is precedent, but it must not leak into the gate for irreversible actions.
- **No conditional assertions (rule 5) vs. production probes.** Probes are inherently conditional
  ("if traffic > N then error rate must be < x"). Keep the condition in the gate's declared rule, not
  in test code; tests stay unconditional.
- **Real dependencies (rule 1) vs. reproducing third-party failures.** Many incidents are a
  dependency misbehaving (timeouts, 5xx from Stripe). Reproducing them requires fault injection,
  which looks like a mock. The repo needs an explicit carve-out: network-level fault injection
  against a real dependency (proxy that delays/drops) is not a mock; replacing the client is. Without
  it, rule 1 blocks the most common class of reproduction.
- **Stack tests "run on a developer machine" vs. production fidelity.** Good for privacy and
  determinism, but scale, data-shape and concurrency incidents will not reproduce. 1.7's "cannot
  reproduce => human" is the honest consequence; the repo should expect a large share of incidents
  to land there.
- **Doc freshness (rule 4).** An auto-repair that changes behaviour must update docs in the same
  change; a repair loop that ships code-only diffs violates the constitution by construction.

### 3.2 With the research's warnings

- **Approval fatigue (93%, SG-9).** A "human approves every auto-repair PR" design is the worst of
  both: volume rises, scrutiny falls, and the approval provides a false sense of safety (SG-26).
  Polished output gets less scrutiny (IS-3), and an auto-repair PR with a tidy evidence bundle is
  polished output. Tier by R/B class instead; reserve humans for R3-R4/B2-B3 and make the human
  decision about *the class*, not every instance.
- **Verification bottleneck (finding 2).** Self-repair generates changes faster than incidents
  generate understanding. Review time is already up 91% on high-adoption teams (MV-11). Unless repair
  PRs are mechanically verifiable, a repair loop moves load onto reviewers rather than off them —
  Anthropic's own guardrail: "if [revert and incident rates] rise, we haven't saved human time, we've
  only moved it" (AN-29).
- **Ownership gap (finding 7).** No published postmortem names who answers for an agent's harmful
  action (BL §4.5). A repair agent that causes an outage while fixing one is precisely that case.
  "You land it, you own it" (AN-29) needs a human who "landed" it: the register's sponsor. Without
  that, the library would be recommending the one practice the field has least evidence for.
- **Thin evidence top-to-bottom.** Incident first-pass investigation: one first-party account
  (OM-14). Production gate: one playbook (AN-27). Circuit breakers: one paper (PO-28). Unattended
  incident *repair* (as opposed to maintenance): none found. The repo's writing rule "every claim
  must be specific and verifiable" means any self-repair section must carry evidence labels, which
  the current docs do not use anywhere.
- **Cap rule.** The L4 scope note says Patterns 4.1-4.5 were not implemented in the reference
  project. A library whose ownership and measurement layers are untested in its own reference
  implementation cannot credibly recommend unattended production repair. Put the cap rule in the
  adoption guide.
- **Reversibility in the reference domain.** The trading bot handles "real blockchain
  transactions". On-chain actions are R4 by definition. The case study is a strong argument for
  stack tests and a strong argument *against* presenting it as a self-repair exemplar.
- **Compound engineering amplifies wrong lessons.** If a masked repair is recorded as a "solution",
  every later session inherits the mask. Learnings from repairs should only be promoted after the
  confirmation window and recurrence check pass.

### 3.3 Existing repo issues that matter for this lens

- `examples/stack-test/{typescript,python}/docker-compose.test.yml` mount `./mock-app`, which does
  not exist in the repo. The stack-test examples therefore do not "run as-is" (CLAUDE.md writing
  rule), and there is no system under test. A repair-loop example cannot be built on them until a
  real minimal app exists. (The directory name "mock-app" is also unfortunate in a repo whose first
  constitutional rule is about mocks.)
- The glossary's "Agentic Testing" entry says tests let agents "self-diagnose and self-correct
  during system development" — the right scoping, and the natural place to point to a production
  extension.
- The FAQ's app/DevOps split is reasonable but leaves the contract implicit. Self-repair lives
  exactly on that seam; at minimum the repo should specify the incident record (in) and the
  reproduction test + evidence bundle (out) so either repo can own the loop.
- L2.3's "context-aware hook" example comments `return; // block` while the code only warns and
  returns — a hook that claims to block but advises is the exact failure mode a production gate must
  not have (anti-patterns.md "Hooks that block, not just log").

---

## 4. Working example sketch: `examples/repair-loop/` (TS + Python)

Goal: demonstrate the *decision logic* of the loop end-to-end, runnable as-is, with no LLM and no
cloud. The "agent" is an interface; the example ships a deterministic candidate patch so the loop
is reproducible (consistent with "working code only, no placeholders").

```
examples/repair-loop/
  README.md                      # what is real, what is simulated, how to run
  app/                           # tiny real service (also fixes the missing mock-app problem)
    (TS: express + pg)  (Py: fastapi + psycopg)  with /health?mode=test|prod
  incidents/
    INC-001.json                 # fingerprint, journey, request (PII-free), expected vs observed
  patches/
    INC-001.fix.patch            # correct fix
    INC-001.mask.patch           # "fix" that wraps in try/catch -> must be classified mitigation
    INC-001.test-edit.patch      # "fix" that edits the reproduction -> must be blocked
  config/
    reversibility.config.ts|.py  # data-driven R/B rules (paths, patterns, owner-listed paths)
    repair-policy.config.ts|.py  # budgets, cooldowns, breaker thresholds, confirm rule
  src/
    incident.ts|py               # parse + fingerprint incident records
    reproduce.ts|py              # render a stack test from incident via StackTestUtils template
    classify.ts|py               # diff -> {reversibility, blastRadius}; unknown -> highest; fails closed
    antimask.ts|py               # 1.6 rules applied to production diffs
    gate.ts|py                   # evidence bundle -> auto | human | block  (pure function)
    breaker.ts|py                # per-fingerprint budget, cooldown, tier drop with hysteresis
    loop.ts|py                   # state machine: detect->reproduce->verify->gate->confirm->learn|stop
  tests/
    unit/                        # classify, antimask, gate, breaker (mocks allowed, per 1.5)
    eval/gate-eval.test          # context-eval scenarios, exact scoring, pass^k over k runs
    stack/
      01-app-startup             # existing pattern
      02-repair-INC-001          # full loop on a real stack:
                                 #   checkout base (bug present) -> reproduction RED
                                 #   apply fix.patch -> reproduction GREEN, suite GREEN,
                                 #   antimask clean, class R2/B0 -> gate = auto
      03-repair-masking-rejected #   apply mask.patch -> GREEN but antimask hit -> gate = human,
                                 #   ticket emitted to outbox
      04-repair-test-edit-blocked#   apply test-edit.patch -> reproduction hash changed -> block
      05-breaker-trips           #   simulated recurrence after "confirm" -> tier drops; stop switch
                                 #   exercised and verified
```

Key design points:

- The gate is a pure function of a typed evidence bundle; that is what makes it eval-able (4.6) and
  keeps "detection stays deterministic" (AN-27).
- Production confirmation is simulated by a second container running the candidate behind a flag
  with a traffic generator; the confirm rule (min sample size, fingerprint count = 0) is in config.
  README states plainly that this simulates, not proves, production confirmation.
- Every stack test asserts unconditionally on the gate's output and the outbox contents (full-loop:
  primary = gate decision, second-order = reproduction hash / suite result via a different command,
  third-order = register/audit entry written).
- Fault-injection variant (optional INC-002): Redis timeout reproduced with a TCP proxy in front of
  real Redis, documenting the rule-1 carve-out in practice.
- Per CLAUDE.md, a new example requires a doc in `docs/L1-patterns/` and links from CLAUDE.md (which
  is currently near its 150-line limit; the new patterns should be one index line pointing to an
  L1-P overview doc).

---

## 5. Recommendations (prioritised)

1. **Do not add self-repair as L5.** Add "L1-P: Closing the Loop in Production" (1.7-1.12) plus L4.7,
   with the cap rule stated in the adoption guide: no unattended repair until production ownership
   and measurement are at level 4.
2. **Ship 1.7 (Incident-to-Stack-Test) first.** It is useful at level 3 with no autonomy at all, has
   the strongest human-practice evidence, and converts compound engineering from prose into
   executable regression tests.
3. **Extend 1.6 to production diffs (anti-masking).** Cheapest, highest-value guard; reuses the
   existing enforcement shape.
4. **Write the app/DevOps contract** (incident record schema in, reproduction + evidence bundle out)
   into faq.md, so the punt to the DevOps repo has a defined seam.
5. **Add the rule-1 fault-injection carve-out** to 1.5.
6. **Fix the missing `mock-app`** so stack-test examples actually run; a repair example depends on it.
7. **Adopt evidence labels** (Strong/Partial/Thin/None found) for any production-facing pattern; the
   research shows this area is thin, and the repo's writing rules require verifiable claims.
8. Treat R3/R4 repairs as permanently human-gated under current evidence, and say why using the
   reference project's own domain.
