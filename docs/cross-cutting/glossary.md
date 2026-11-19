# Glossary

Terms used across the library, in alphabetical order. Each entry links to the doc that defines it.

The [scales table](../../README.md#how-the-scales-fit-together) separates layer, enforcement point, review tier and
grant.

**Anti-Masking Scan** — A text scan of a repair diff for code that hides an error instead of fixing it, such as a
new catch, a retry or a longer timeout. A flagged change is reclassified as a mitigation. See
[Pattern 1.9](../L1-patterns/1.9-repair-loop-frozen-oracle.md).

**Attended** — A person watches each step of the session and applies or approves what the agent does. See
[Path E](adoption-guide.md#path-e-one-person-attended-sessions).

**Author of Record** — The person who asked an agent for a change. They read it and answer for it, and they cannot
approve it; a different person approves. See
[Pattern 4.7](../L4-standards-measurement.md#pattern-47--author-of-record).

**Behavior Surface** — An instruction or tool-configuration file (`CLAUDE.md`, `CLAUDE.local.md`, `AGENTS.md`, `GEMINI.md` and `.mcp.json` at any depth, and anything under a `.claude/` folder except `.claude/settings*.json` and `.claude/hooks/**`): medium tier, edited in ordinary pull requests, never merged
unattended. See [Pattern A.6](../earned-autonomy.md#pattern-a6--enforcement-through-hooks).

**Blast-Radius Class** — How far a change reaches, classified from its diff: B0 one journey, B1 one service, B2 a
cross-service contract, B3 money, auth, PII or audit. An unknown change is B3. See
[Pattern 1.8](../L1-patterns/1.8-reversibility-blast-radius.md).

**Cap** — The lowest curve position among the four dimensions that limit unattended work: platform, security and
governance, production ownership and measuring value. The census of one repository computes it, and no grant may
exceed it. A spend limit is a budget and a size limit is a line limit, not a cap. See
[The Curve and the Cap](../earned-autonomy.md#the-curve-and-the-cap).

**Ceiling** — In the repair-loop policy, the highest reversibility and blast-radius class a grant lets the gate pass as
`auto` (`autoCeiling`) or merge with no person (`unattendedCeiling`). See
[Pattern 1.11](../L1-patterns/1.11-repair-budget-circuit-breaker-stop.md#grants-and-repair-capability).

**Census** — The command that reads a repository's files and writes a profile with one curve position per
dimension and the cap. A dimension with no evidence is C1. Only skill, which no file shows, is recorded as
`unknown` until a worksheet result exists. See [Pattern A.4](../earned-autonomy.md#pattern-a4--census).

**CI Guardrails** — Required CI checks that run on every push and pull request whether or not session hooks are
active. Thresholds live in project config, not in the workflow file. See
[Pattern 4.5](../L4-standards-measurement.md#pattern-45--ci-guardrails).

**Circuit Breaker** — Code that lowers a repair workflow's grant when its revert or recurrence rate crosses a
threshold. A person restores the grant. See [Pattern 1.11](../L1-patterns/1.11-repair-budget-circuit-breaker-stop.md).

**Cognitive Debt** — The gap that grows when a team ships code nobody can explain or debug without the agent. See
[Pattern 4.9](../L4-standards-measurement.md#pattern-49--deliberate-practice).

**Conditional Assertion** — An assertion inside an `if`, behind optional chaining or after an early return, so the
test can pass without checking anything. Forbidden. See [Pattern 1.6](../L1-patterns/1.6-test-integrity.md).

**Constitutional Rule** — A hard rule in the agent instruction file that names its enforcement point. A rule held
only in prose is guidance. See
[Pattern 2.4](../L2-behavioral-guardrails.md#pattern-24--constitutional-rules).

**Container Isolation** — Running each test run in its own compose project with dynamic ports and transient
volumes, so concurrent runs do not interfere. See [Pattern 1.4](../L1-patterns/1.4-container-isolation.md).

**Containment** — Running the agent inside a boundary it cannot change: writes confined to the working tree, reads
bounded, network allowlisted and credentials held outside. Approvals are relaxed only inside it. See
[Pattern 2.9](../L2-behavioral-guardrails.md#pattern-29--contain-before-you-relax).

**Context Artifact** — Any file or setting that adds instructions to an agent session: instruction file, skill,
hook, deny rule, routing note or memory file. Each has an owner and a `reviewed:` date. See
[Pattern 0.10](../L0-foundation.md#pattern-010--prune-and-re-baseline-context).

**Context Eval** — Running a fixed task bank against an agent's context or decision code and scoring the result.
Deterministic checks score pass^k with no partial credit; judged tasks use a rubric fixed before the run. See
[Pattern 4.6](../L4-standards-measurement.md#pattern-46--context-eval).

**Context Harvesting** — Gathering targeted evidence from docs, code, tests and logs before proposing a change. See
[L1](../L1-feedback-loops.md#context-harvesting--from-understanding-to-design).

**Context Isolation** — Delegating exploration to a subagent that returns a short map, so search output stays out
of the main session. See [Pattern 3.2](../L3-optimization.md#pattern-32--context-isolation-scout).

**Curve (C1-C5)** — A five-step scale applied to each of seven dimensions of one repository: C1 Individual, C2 Grounded,
C3 Verified delegation, C4 Governed autonomy, C5 Self-correcting. A repository's place on one dimension is its position.
See [The Curve and the Cap](../earned-autonomy.md#the-curve-and-the-cap).

**Deep Module** — A module with a small interface that hides a complex implementation. See
[Pattern 0.1](../L0-foundation.md#pattern-01--deep-modules).

**Design Rinsing** — Extracting transferable design decisions from an external source in a read-only session, then
translating them for the target project. See
[L1](../L1-feedback-loops.md#design-rinsing--cross-domain-architectural-extraction).

**Effective Grant** — The grant a workflow runs at: the lowest of its granted value, the cap, the freshness gate
(overdue stop test, passed review date, expired access, stale or missing census profile), the harness gate and any
demotion override. See [Pattern A.3](../earned-autonomy.md#pattern-a3--promotion-demotion-and-the-cap-gate).

**Enforcement Point** — Where a rule holds: prompt, hook, CI, sandbox or downstream authorization. Enforcement
points stack. Prose is guidance, command hooks are deterministic policy inside the harness, and containment and
credentials are the boundary. See [L2 Overview](../L2-behavioral-guardrails.md#overview).

**Evidence-Based Claim** — A completion claim backed by the output of the command that was run and by the CI run
the reviewer reads. Output the agent pastes with no CI run behind it is a claim, not evidence. See
[Pattern 4.1](../L4-standards-measurement.md#pattern-41--evidence-based-claims).

**Evidence Bundle** — The record a repair attempt hands the gate: test output before and after, the diff, its classes,
the anti-masking result, the attempt budget and the grant. See
[Pattern 1.9](../L1-patterns/1.9-repair-loop-frozen-oracle.md).

**Evidence Label** — The closing `**Evidence:**` line of a pattern: Strong (measured or corroborated by an independent
source), Partial (support exists but is incomplete, contested or unmeasured guidance from one vendor) or Thin
(reasoning, this project's own experience, a single anecdote or no source), followed by the basis and source IDs. See [Sources](../references/sources.md).

**Evidence Ledger** — The append-only record of workflow runs, written only by CI and after-the-fact jobs, from
which promotion and demotion are computed. See [Pattern A.2](../earned-autonomy.md#pattern-a2--evidence-ledger).

**Focused Integration Test** — A test of one adapter against one external dependency's real sandbox or testnet,
without the full stack. See
[Pattern 1.5](../L1-patterns/1.5-real-dependencies.md#focused-integration-tests-for-external-dependencies).

**Frozen Oracle** — The reproduction test for an incident, hashed before the fix is written. The repair agent
cannot edit it, and a changed hash blocks the repair. See
[Pattern 1.9](../L1-patterns/1.9-repair-loop-frozen-oracle.md).

**Full-Loop Assertions** — Checks at three orders of distance from the action: primary (the direct API response),
second-order (the effect read through a different endpoint) and third-order (cross-functional effects read through
admin or observability APIs, such as audit logs). See
[Pattern 1.2](../L1-patterns/1.2-full-loop-assertions.md).

**Grant (A1-A5)** — What one named workflow may do and what a person still does, from A1 (suggests; a human applies the change)
to A5 (unattended and managed against a baseline and a stop rule). A grant cannot exceed the cap. See
[The Grants](../earned-autonomy.md#the-grants).

**Guidance** — A rule held only as prose in an instruction file or skill. It shapes how the agent works and can be
pruned by re-baselining. A rule that must always hold is an invariant. See
[Pattern 0.10](../L0-foundation.md#pattern-010--prune-and-re-baseline-context).

**Harness** — The program that runs the agent with its tools, hooks and permissions, for example Claude Code.

**Hook** — A handler the harness runs on an event such as a tool call. A command hook runs a script and is
deterministic; Claude Code's prompt and agent hooks ask a model and are judgments
([hooks reference](https://code.claude.com/docs/en/hooks)). A PreToolUse hook can block a call; a PostToolUse hook
runs after it and can only report. Hooks are not a security boundary. See
[Pattern 2.3](../L2-behavioral-guardrails.md#pattern-23--hook-automation).

**Incident Fingerprint** — A stable key for a production failure, built from the journey and error class rather than
line numbers, so a recurrence after a repair is detected. See
[Pattern 1.7](../L1-patterns/1.7-incident-to-stack-test.md).

**Invariant** — A rule that holds regardless of the model, enforced by a command hook, deny rule, sandbox setting or
required CI check. Re-baselining does not remove it. See
[Pattern 2.4](../L2-behavioral-guardrails.md#pattern-24--constitutional-rules).

**Layer (L0-L4)** — A group of patterns: L0 Foundation, L1 Closed Loop Design and Verification, L2 Behavioral
Guardrails, L3 Optimization (optional), L4 Standards and Measurement. The layers are not a maturity scale. See the
[README](../../README.md).

**Least Agency** — Giving a session only the tools, permissions and autonomy its task needs. See
[Pattern 2.10](../L2-behavioral-guardrails.md#pattern-210--least-agency-and-session-composition).

**Lethal Trifecta / Rule of Two** — The trifecta is untrusted input, access to sensitive data and a way to act
outside, in one session. The Rule of Two allows at most two of the three unless a deterministic or human gate sits
between them. See [Pattern 2.10](../L2-behavioral-guardrails.md#pattern-210--least-agency-and-session-composition).

**Locked File** — A permission or hook file that `autonomy check` always blocks from agent commits: `.autonomy*`
(state and demotion override included), CODEOWNERS, `.claude/settings*.json`, `.claude/hooks/*` and `.harness.yaml`.
Behavior surfaces are not locked. See [Pattern A.6](../earned-autonomy.md#pattern-a6--enforcement-through-hooks).

**Mechanical Verification** — A check whose pass or fail a machine decides, with no judgment by the agent or a
reviewer. Grant A4 requires it. See [Why Stack Tests Earn Autonomy](../earned-autonomy.md#why-stack-tests-earn-autonomy).

**Mitigation** — A change that removes the symptom but not the cause, such as a rollback or turning a flag off.
It needs a root-cause ticket. See [Pattern 1.12](../L1-patterns/1.12-self-healing-tests-vs-systems.md).

**Native Structured Tools** — Tools that return typed results for search, file reads and edits, used in place of
raw shell commands such as `grep`, `cat` and `sed -i`. See
[Pattern 3.1](../L3-optimization.md#pattern-31--prefer-native-structured-tools-block-destructive-edits).

**New-Starter Standard** — A check that someone with no context can understand the project from AGENTS.md, the
README and the file structure alone. See
[Pattern 0.9](../L0-foundation.md#pattern-09--ai-as-new-starter-standard).

**Pass^k** — A scenario passes only when all k runs pass; the suite score is the share of scenarios that pass. It
rewards consistency, unlike best-of-k. See
[Pattern 4.6](../L4-standards-measurement.md#pattern-46--context-eval).

**Probe** — One file check the census runs for a dimension and position, such as `agent-config` for platform at C2.
A passed probe shows presence and recency, not quality. See [Pattern A.4](../earned-autonomy.md#pattern-a4--census).

**Production Gate** — Deterministic code outside the agent that takes an evidence bundle and change classes and
returns `auto`, `human` or `block`. The agent can act up to the gate and cannot pass it. See
[Pattern 1.10](../L1-patterns/1.10-production-gate-progressive-confirmation.md).

**Profile** — The file `autonomy census` writes (`.autonomy/profile.json`): one curve position per dimension, the cap
and the probes behind each. A repository with no profile is at C1. See [Pattern A.4](../earned-autonomy.md#pattern-a4--census).

**Progressive Disclosure** — A layout that lets a reader go from README to AGENTS.md to module interfaces to
implementation, with directories named for concepts. See
[Pattern 0.2](../L0-foundation.md#pattern-02--progressive-disclosure).

**Register** — The committed, schema-validated `.autonomy.yaml` that lists every agent workflow with its owner,
sponsor, grant, identity, limits, stop and review date. No agent may write it. See
[Pattern A.1](../earned-autonomy.md#pattern-a1--autonomy-register).

**REPL Fractal** — The read-eval-print loop applied at every scale, from a line of code to a running system. See
[L1](../L1-feedback-loops.md#the-repl-fractal--closed-loops-at-every-scale).

**Reversibility Class** — How a change can be undone, classified from its diff: R0 inert, R1 flag-reversible, R2
deploy-reversible, R3 data-forward, R4 external or irreversible. An unknown change is R4. With the blast-radius
class it sets the review tier, which decides the review; the grant decides who acts unattended. See the
[risk model](../L1-patterns/1.8-reversibility-blast-radius.md#risk-model).

**Review Tier** — Low, medium or high, set by a change's reversibility and blast-radius classes. It decides the
approvals a change needs. In this library's patterns, "tier" means only the review tier. See the [risk
model](../L1-patterns/1.8-reversibility-blast-radius.md#risk-model).

**Risk Model** — The table that maps a change's reversibility and blast-radius classes to a review tier and to the
lowest grant that may merge it with no person. See
[Pattern 1.8](../L1-patterns/1.8-reversibility-blast-radius.md#risk-model).

**Skill** — A prompt-level instruction file the agent loads when relevant. A skill shapes behavior and guarantees
nothing. A skill overlay adds project rules to a base skill. See
[Pattern 2.1](../L2-behavioral-guardrails.md#pattern-21--skill-overlay-architecture).

**Skill Chain** — An optional sequence of skills (brain+, plan+, tdd+, verify+, review+) whose ceremony scales with
the change's risk. See [Pattern 2.1](../L2-behavioral-guardrails.md#pattern-21--skill-overlay-architecture).

**Sponsor** — The named person accountable for an agent identity, who renews or retires it. See
[Pattern 2.11](../L2-behavioral-guardrails.md#pattern-211--agent-identity-and-delegation).

**Stack Test** — A test that runs the whole system in Docker and checks a user journey through the API, with no
mocks for owned services. See [Pattern 1.1](../L1-patterns/1.1-stack-tests.md).

**Stop Drill** — The scheduled run that triggers a workflow's stop against a canary and records `stop.last_tested`. See
[Pattern A.5](../earned-autonomy.md#pattern-a5--tested-stop).

**Task Bank** — A fixed set of representative tasks, each with a prompt, an expected artifact and a check,
run against a pinned model. See [Pattern 4.6](../L4-standards-measurement.md#pattern-46--context-eval); this
repository's bank is the [Task Bank](../references/task-bank.md).

**Test Integrity** — Rules that remove the ways a test can skip its assertions, such as conditional assertions and
a catch without a rethrow. See [Pattern 1.6](../L1-patterns/1.6-test-integrity.md).

**Tested Stop** — A way to halt a workflow at grant A4 or higher that a scheduled drill has used: a named person
who can invoke it and a mechanism such as revoking credentials. A failed or overdue drill demotes the workflow. See [Pattern A.5](../earned-autonomy.md#pattern-a5--tested-stop).

**Unattended** — An agent acts on an event, a schedule or a backlog with no person watching each step: grant A4 and
above. At A3 a person still merges. See [The Grants](../earned-autonomy.md#the-grants).

**Workflow** — One named entry in the register: a trigger, the actions it may take, its owner and its grant. See
[Pattern A.1](../earned-autonomy.md#pattern-a1--autonomy-register).

**Workflow File** — A file under `.github/workflows/` or `.github/actions/`. An agent commit may change it only with a later non-agent
`Governance-Approved: <sha>` line. See [Pattern A.6](../earned-autonomy.md#pattern-a6--enforcement-through-hooks).

**Zero-Defect Tolerance** — Every error and warning is addressed, because an agent cannot tell a relevant failure
from an irrelevant one. See [Pattern 2.5](../L2-behavioral-guardrails.md#pattern-25--zero-defect-tolerance).
