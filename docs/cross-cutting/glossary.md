# Glossary

Alphabetical reference for specialized terms used across the agentic-patterns library.

---

## A

### Agent Register

**Layer**: L4 - Standards & Measurement
**Definition**: One list of every agent, unattended workflow, skill, hook pack and MCP server in use, with its
owner, sponsor, permitted actions, access expiry, state, last review, retirement rule and stop. It can start
as a table and grow into a machine-readable file checked in CI.
**See**: [Pattern 4.7 - Author of Record and Agent
Register](../L4-standards-measurement.md#pattern-47--author-of-record-and-agent-register)

### Agentic Testing

**Layer**: L1 - Closed Loop Design
**Definition**: Full-system, no-mock testing approach that enables AI agents to self-diagnose and self-correct during system development.
**See**: [L1 Closed Loop Design](../L1-feedback-loops.md)

### Approval Fatigue

**Layer**: L2 - Behavioral Guardrails
**Definition**: The effect of asking for confirmation too often: people approve without reading, and the
prompt stops working as a control. The remedy is to tier approvals by risk and to measure the approve rate.
**See**: [Pattern 2.13 - Risk-Tiered Review](../L2-behavioral-guardrails.md#pattern-213--risk-tiered-review)

### Autonomy Grant (A1-A5)

**Definition**: What one named workflow may do on its own. A1 suggests and a human applies the change. A2 opens pull requests that a human reads. A3 passes required checks before a human merges. A4 acts on an event or schedule within permitted actions. A5 is A4 managed as an investment with a baseline, target, review date and stop rule. A grant is per workflow and cannot sit above the cap line.
**See**: [How Far a Team Can Let Go](../../README.md#how-far-a-team-can-let-go)

### Assertion Layering (Full-Loop)

**Layer**: L1 - Closed Loop Design
**Definition**: Three-level assertion structure (primary, second-order, third-order) that provides diagnostic signal at increasing distance from the primary action.
**See**: [Pattern 1.2 - Full-Loop Assertion Layering](../L1-feedback-loops.md#pattern-12--full-loop-assertion-layering)

### Author of Record

**Layer**: L4 - Standards & Measurement
**Definition**: The person who asked an agent for a change. They read it and answer for it, and they cannot
approve it; a different person approves.
**See**: [Pattern 4.7 - Author of Record and Agent
Register](../L4-standards-measurement.md#pattern-47--author-of-record-and-agent-register)

### Autonomy Grant

**Layer**: Cross-cutting - Earned Autonomy
**Definition**: What one named workflow may do without a human, from A1 (assisted) to A5 (portfolio-managed). Held per workflow, never above the cap.
**See**: [Earned Autonomy](../earned-autonomy.md)

### Autonomy Register

**Layer**: Cross-cutting - Earned Autonomy
**Definition**: Committed, schema-validated `.autonomy.yaml` listing every agent workflow with owner, grant, identity, limits, stop mechanism and review date. No agent may write it.
**See**: [Earned Autonomy](../earned-autonomy.md)

---

## B

### Blast Radius

**Layer**: L1 - Closed Loop Design
**Definition**: How far a change reaches, classified from its diff: B0 one journey, B1 one service, B2 a cross-service contract, B3 money, auth, PII or audit. An unknown change is treated as B3.
**See**: [Pattern 1.8 - Reversibility and Blast-Radius Classes](../L1-patterns/1.8-reversibility-blast-radius.md)

---

## C

### Cap Line

**Definition**: The lowest position among the four dimensions that cap unattended work (platform, measuring value, security and governance, production ownership). No workflow grant may sit above it.
**See**: [How Far a Team Can Let Go](../../README.md#how-far-a-team-can-let-go)

### CI Guardrails

**Layer**: L4 - Standards & Measurement
**Definition**: GitHub Actions workflows for docs quality and test coverage, providing non-negotiable enforcement independent of session-scoped hooks. Thresholds defined in project config, not CI workflow.
**See**: [Pattern 4.5 - CI Guardrails](../L4-standards-measurement.md#pattern-45--ci-guardrails)

### Context Artefact

**Layer**: L0 - Foundation
**Definition**: Any file or setting that adds instructions to an agent session: instruction file, skill, hook, deny rule, routing note or memory file. Each carries an owner, a `reviewed:` date and an expiry.
**See**: [Pattern 0.10 - Prune and Re-baseline Context](../L0-foundation.md#pattern-010--prune-and-re-baseline-context)

### Context Eval

**Layer**: L4 - Standards & Measurement
**Definition**: Structured evaluation pattern that scores an agent's decisions against expected outcomes across multiple scenarios and configurations. Applies to any decision layer (tool routing, enforcement pipelines, skill selection, constitutional compliance). Uses graduated scoring (1.0 exact, 0.5 partial, 0.0 miss) and fails the build if overall score falls below a threshold.
**See**: [Pattern 4.6 - Context Eval](../L4-standards-measurement.md#pattern-46--context-eval)

### Circuit Breaker

**Layer**: L1 - Closed Loop Design
**Definition**: Code that lowers a repair workflow's grant when its revert rate or recurrence rate crosses a threshold. A person restores the grant. The trip and reset thresholds differ so the grant does not flap.
**See**: [Pattern 1.11 - Repair Budget, Circuit Breaker and Stop Authority](../L1-patterns/1.11-repair-budget-circuit-breaker-stop.md)

### Cognitive Debt

**Layer**: L4 - Standards & Measurement
**Definition**: The gap that grows when a team ships code it does not understand: the code works, and nobody
can explain or debug it. Agents widen the gap when people stop reading what they produce.
**See**: [Pattern 4.9 - Deliberate Practice](../L4-standards-measurement.md#pattern-49--deliberate-practice)

### Conditional Assertion (Anti-Pattern)

**Layer**: L1 - Closed Loop Design
**Definition**: Forbidden test pattern where assertions are wrapped in conditional statements, allowing tests to pass silently without running any checks.
**See**: [Pattern 1.6 - Test Integrity Rules](../L1-feedback-loops.md#pattern-16--test-integrity-rules)

### Constitutional Rule

**Layer**: L2 - Behavioral Guardrails
**Definition**: Hard rule declared in the instruction file (CLAUDE.md or AGENTS.md) that names its enforcement point: prompt, hook, CI, sandbox or downstream. A rule is only as absolute as its weakest enforcement point.
**See**: [Pattern 2.4 - Constitutional Rules](../L2-behavioral-guardrails.md#pattern-24--constitutional-rules)

### Container Isolation

**Layer**: L1 - Closed Loop Design
**Definition**: Four mechanisms (compose project scoping, dynamic port allocation, transient volumes, per-run compose files) ensuring tests never interfere with each other.
**See**: [Pattern 1.4 - Container Isolation](../L1-feedback-loops.md#pattern-14--container-isolation)

### Containment

**Layer**: L2 - Behavioral Guardrails
**Definition**: Running the agent inside a boundary it cannot change: writes confined to the working tree,
reads bounded, network allowlisted, credentials held outside, and no session if the boundary cannot start.
Approvals are relaxed only inside it.
**See**: [Pattern 2.9 - Contain Before You Relax](../L2-behavioral-guardrails.md#pattern-29--contain-before-you-relax)

### Context Isolation

**Layer**: L3 - Optimization (optional)
**Definition**: Delegating exploration to a sub-agent that returns a short map, so search noise stays out of the main session.
**See**: [Pattern 3.2 - Context Isolation](../L3-optimization.md#pattern-32--context-isolation-scout)

### Cap Rule

**Layer**: Cross-cutting - Earned Autonomy
**Definition**: No grant may exceed the lowest position among the four capping dimensions: platform, security and governance, production ownership, measuring value.
**See**: [Earned Autonomy](../earned-autonomy.md)

### Census

**Layer**: Cross-cutting - Earned Autonomy
**Definition**: Command that probes a repository for artefacts, checking presence and practice, and writes a profile with one level per dimension. Unknown counts as C2.
**See**: [Earned Autonomy](../earned-autonomy.md)

---

## D

### Curve (C1-C5)

**Definition**: A five-step scale applied separately to each of seven dimensions: C1 Individual, C2 Grounded, C3 Verified delegation, C4 Governed autonomy, C5 Self-correcting. The C prefix distinguishes it from the layers L0-L4.
**See**: [How Far a Team Can Let Go](../../README.md#how-far-a-team-can-let-go)

### Deep Module

**Layer**: L0 - Foundation
**Definition**: Module with a small interface that hides complex implementation details behind a clean facade. As a heuristic, 3-5 exports; more suggests the module has more than one job.
**See**: [Pattern 0.1 - Deep Modules](../L0-foundation.md#pattern-01--deep-modules)

### Delete-First Re-baselining

**Layer**: L0 - Foundation
**Definition**: At each model upgrade, run the task bank with an artefact removed and keep the artefact only if a task regresses. The justifying task is recorded next to it.
**See**: [Pattern 0.10 - Prune and Re-baseline Context](../L0-foundation.md#pattern-010--prune-and-re-baseline-context)

### Docker Resource Limits

**Layer**: L1 - Closed Loop Design
**Definition**: Hard constraints in Docker (~31 networks per bridge driver, finite containers and volumes) that require aggressive cleanup hygiene to prevent exhaustion during concurrent testing.
**See**: [Pattern 1.4 - Container Isolation](../L1-feedback-loops.md#pattern-14--container-isolation)

### Dynamic Port Allocation

**Layer**: L1 - Closed Loop Design
**Definition**: Runtime assignment of confirmed-free ports from available range (10000-65535) to prevent port conflicts during concurrent test execution.
**See**: [Pattern 1.4 - Container Isolation](../L1-feedback-loops.md#pattern-14--container-isolation)

---

## E

### Enforcement Pipeline

**Layer**: L2 - Behavioral Guardrails
**Definition**: Composable pipeline where independent enforcement checks return severity levels, resolved to the most severe result (block > advise > silent). PostToolUse checks are detective: they run after the tool call and report it, but cannot prevent it. Prevention needs a PreToolUse hook or a boundary outside the agent.
**See**: [Pattern 2.6 - Enforcement Pipeline Composition](../L2-behavioral-guardrails.md#pattern-26--enforcement-pipeline-composition)

### Enforcement Point

**Layer**: L2 - Behavioral Guardrails
**Definition**: The mechanism that holds a rule: prompt, hook, CI, sandbox or downstream authorisation. A rule is as strong as its weakest enforcement point, and each constitutional rule names its own.
**See**: [Pattern 2.4 - Constitutional Rules](../L2-behavioral-guardrails.md#pattern-24--constitutional-rules)

### Evidence Label

**Definition**: The closing line of a pattern, `Evidence: Strong`, `Partial` or `Thin`, followed by the basis for the rating and the source IDs. Strong means the claim is measured or corroborated by independent sources, Partial means support exists but is incomplete or contested, and Thin means the pattern rests on reasoning, first-party experience or unmeasured vendor claims. Source IDs resolve in [Sources](../references/sources.md).

### Focused Integration Test

**Layer**: L1 - Closed Loop Design
**Definition**: Narrow-scope test that exercises a single external dependency's real API (testnet or sandbox) with exhaustive edge-case coverage. No mocks, no full system stack — just the adapter code plus the real external service. Used for complex dependencies like payment providers where each error code, timeout scenario, and rate limit behavior needs individual verification.
**See**: [Pattern 1.5 - Real Dependencies in E2E/Integration and Stack Tests](../L1-feedback-loops.md#pattern-15--real-dependencies-in-e2eintegration-and-stack-tests)

### Evidence-Based Claim

**Layer**: L4 - Standards & Measurement
**Definition**: Completion claim backed by actual command output showing verification results; "tests should pass" is not evidence.
**See**: [Pattern 4.1 - Evidence-Based Claims](../L4-standards-measurement.md#pattern-41--evidence-based-claims)

### Evidence Ledger

**Layer**: Cross-cutting - Earned Autonomy
**Definition**: Append-only per-run record written only by CI and after-the-fact jobs, used to compute promotion and demotion evidence.
**See**: [Earned Autonomy](../earned-autonomy.md)

---

## F

### Frozen Oracle

**Layer**: L1 - Closed Loop Design
**Definition**: The reproduction test for an incident, hashed before the fix is written. The repair agent cannot edit it, and a changed hash blocks the repair.
**See**: [Pattern 1.9 - Repair Loop with a Frozen Oracle](../L1-patterns/1.9-repair-loop-frozen-oracle.md)

---

## G

### Graybox Module

**Layer**: L0 - Foundation
**Definition**: Module concept where tests lock down behavior, the public interface is carefully controlled, and the interior is delegatable to AI (based on Matt Pocock's concept).
**See**: [Pattern 0.1 - Deep Modules](../L0-foundation.md#pattern-01--deep-modules)

### Guardrail

**Layer**: L2 - Behavioral Guardrails
**Definition**: A control that holds a rule at one layer: prompt (guidance), hook (deterministic policy inside the harness), CI (required check), sandbox or credential scope (boundary), or downstream authorisation. Each rule is only as strong as the layer that holds it. A hook is not a security boundary.
**See**: [L2 Behavioral Guardrails Overview](../L2-behavioral-guardrails.md)

### Guidance

**Layer**: L0 - Foundation
**Definition**: A rule held only as prose in an instruction file or skill. It shapes how the agent works and is prunable by re-baselining. A rule that must always hold is an invariant instead.
**See**: [Pattern 0.10 - Prune and Re-baseline Context](../L0-foundation.md#pattern-010--prune-and-re-baseline-context)

---

## H

### Hook

**Layer**: L2 - Behavioral Guardrails
**Definition**: Script the harness runs around a tool call. PreToolUse hooks run before the call and can block it; PostToolUse hooks run after the call and are detective (they report and record, and cannot prevent the call). Hooks gate the agent's tool calls, not what a permitted tool does once running.
**See**: [Pattern 2.3 - Hook Automation](../L2-behavioral-guardrails.md#pattern-23--hook-automation)

---

## I

### Intent Classification

**Layer**: L3 - Optimization (optional)
**Definition**: Parsing bash commands into intent categories (file_read, text_search, file_modify, docker, etc.) to enable correct routing and blocking of dangerous operations.
**See**: [Pattern 3.1 - Prefer Native Structured Tools](../L3-optimization.md#pattern-31--prefer-native-structured-tools-block-destructive-edits)

### Incident Fingerprint

**Layer**: L1 - Closed Loop Design
**Definition**: A stable key for a production failure, built from the journey and error class rather than line numbers, so a recurrence after a repair can be detected.
**See**: [Pattern 1.7 - Incident-to-Stack-Test](../L1-patterns/1.7-incident-to-stack-test.md)

### Invariant

**Layer**: L0 - Foundation
**Definition**: A rule that holds regardless of the model, enforced by a hook, deny rule, sandbox setting or required CI check and never by prose alone. Re-baselining does not remove it.
**See**: [Pattern 2.4 - Constitutional Rules](../L2-behavioral-guardrails.md#pattern-24--constitutional-rules)

---

## L

### Least Agency

**Layer**: L2 - Behavioral Guardrails
**Definition**: Giving a session only the tools, permissions and autonomy its task needs. Each unneeded
capability is something an injected instruction can use.
**See**: [Pattern 2.10 - Least Agency and Session
Composition](../L2-behavioral-guardrails.md#pattern-210--least-agency-and-session-composition)

### Lethal Trifecta / Rule of Two

**Layer**: L2 - Behavioral Guardrails
**Definition**: The lethal trifecta is the combination of untrusted input, access to sensitive data and a way
to act outside, in one session. The Rule of Two says a session holds at most two of the three unless a
deterministic or human gate sits between them.
**See**: [Pattern 2.10 - Least Agency and Session
Composition](../L2-behavioral-guardrails.md#pattern-210--least-agency-and-session-composition)

### Layer (L0-L4)

**Definition**: A group of patterns that depend on the layers below it: L0 Foundation, L1 Closed Loop Design and Verification, L2 Behavioral Guardrails, L3 Optimization (optional), L4 Standards & Measurement. The layers are not a maturity scale. Not the same as an enforcement point or a position on the curve.
**See**: [README](../../README.md)

---

## M

### Maintained Configuration

**Layer**: L0 - Foundation
**Definition**: Context artefacts that are kept current, measured by last change date, invocation counts and the share of rules with a justifying task. The opposite of configuration that is present but never changed.
**See**: [Pattern 0.10 - Prune and Re-baseline Context](../L0-foundation.md#pattern-010--prune-and-re-baseline-context)

### Master Index

**Layer**: L0 - Foundation
**Definition**: AGENTS.md (imported by CLAUDE.md) serves as the single source of truth and discovery mechanism; all project documents must be reachable from it via link chains.
**See**: [Pattern 0.4 - Agent instruction file as project constitution](../L0-foundation.md#pattern-04--agent-instruction-file-as-project-constitution)

---

## N

### Native Structured Tools

**Layer**: L3 - Optimization (optional)
**Definition**: Routing shell commands to the native or structured tool that does the same job (Grep, Read, Glob, symbol search), and blocking in-place edits such as `sed -i`. Tool results are typed records instead of raw text.
**See**: [Pattern 3.1 - Prefer Native Structured Tools](../L3-optimization.md#pattern-31--prefer-native-structured-tools-block-destructive-edits)

### New Starter Standard

**Layer**: L0 - Foundation
**Definition**: Ultimate test where someone with zero context must be able to understand the project from AGENTS.md + README + file structure alone.
**See**: [Pattern 0.9 - AI-as-New-Starter Standard](../L0-foundation.md#pattern-09--ai-as-new-starter-standard)

### Real Dependencies (No-Mock in Stack Tests)

**Layer**: L1 - Closed Loop Design
**Definition**: Stack tests and E2E/integration tests use real dependencies (PostgreSQL, Redis, etc.) for owned services; only external services without testnet should be mocked. Mocks are appropriate and encouraged in unit tests for isolation.
**See**: [Pattern 1.5 - Real Dependencies in E2E/Integration and Stack Tests](../L1-feedback-loops.md#pattern-15--real-dependencies-in-e2eintegration-and-stack-tests)

### Pass^k

**Layer**: L4 - Standards & Measurement
**Definition**: The share of evaluation runs in which all k repeats of a scenario pass. It rewards consistency, unlike best-of-k. Used to score decisions on irreversible actions, such as the production gate.
**See**: [Pattern 1.10 - Production Gate and Progressive Confirmation](../L1-patterns/1.10-production-gate-progressive-confirmation.md)

### Production Gate

**Layer**: L1 - Closed Loop Design
**Definition**: Deterministic code outside the agent that takes an evidence bundle and change classes and returns `auto`, `human` or `block`. The agent can act up to the gate and cannot pass it.
**See**: [Pattern 1.10 - Production Gate and Progressive Confirmation](../L1-patterns/1.10-production-gate-progressive-confirmation.md)

### Progressive Disclosure

**Layer**: L0 - Foundation
**Definition**: Directory structure that mirrors mental models, allowing AI to discover complexity gradually (README → AGENTS.md → module interfaces → implementation).
**See**: [Pattern 0.2 - Progressive Disclosure](../L0-foundation.md#pattern-02--progressive-disclosure)

### Phase Transition Validation

**Layer**: L2 - Behavioral Guardrails
**Definition**: Optional state machine that records which skill chain phases the agent has visited and checks declared prerequisites, with strictness scaled to the change's risk. It records visits, not outcomes; verification and review remain outcome gates held by CI and the merge process.
**See**: [Pattern 2.7 - Phase Transition Validation](../L2-behavioral-guardrails.md#pattern-27--phase-transition-validation)

---

## R

### Resource Hygiene

**Layer**: L1 - Closed Loop Design
**Definition**: Aggressive cleanup practices (docker compose down -v, volume removal, network pruning) required to prevent Docker resource exhaustion during concurrent testing.
**See**: [Pattern 1.4 - Container Isolation](../L1-feedback-loops.md#pattern-14--container-isolation)

### Reversibility Class

**Layer**: L1 - Closed Loop Design
**Definition**: How a change can be undone, classified from its diff: R0 inert, R1 flag-reversible, R2 deploy-reversible, R3 data-forward, R4 external or irreversible. An unknown change is treated as R4.
**See**: [Pattern 1.8 - Reversibility and Blast-Radius Classes](../L1-patterns/1.8-reversibility-blast-radius.md)

### Routing Table

**Layer**: L3 - Optimization (optional)
**Definition**: Data structure mapping shell commands to the native or structured tool that does the same job.
**See**: [Pattern 3.1 - Prefer Native Structured Tools](../L3-optimization.md#pattern-31--prefer-native-structured-tools-block-destructive-edits)

---

## S

### Scout Pattern

**Layer**: L3 - Optimization (optional)
**Definition**: Lightweight read-only sub-agent that maps codebase structure (relevant files, entry points, key symbols) and returns a short summary before implementation.
**See**: [Pattern 3.2 - Context Isolation](../L3-optimization.md#pattern-32--context-isolation-scout)

### Session Lifecycle

**Layer**: L3 - Optimization (optional)
**Definition**: Detecting available tools once at session start and caching the result, instead of re-detecting on every tool call.
**See**: [Pattern 3.3 - Environment-Aware Routing and Session Lifecycle](../L3-optimization.md#pattern-33--environment-aware-routing-and-session-lifecycle)

### Shallow Module

**Layer**: L0 - Foundation
**Definition**: Anti-pattern where a module exports 20+ functions, leaking implementation details and creating excessive coupling points that confuse AI agents.
**See**: [Pattern 0.1 - Deep Modules](../L0-foundation.md#pattern-01--deep-modules)

### Skill Chain

**Layer**: L2 - Behavioral Guardrails
**Definition**: Optional workflow pipeline where skills compose (brain+ → plan+ → tdd+ → verify+ → review+). Ceremony scales with risk; verification and review stay outcome gates for every change.
**See**: [Pattern 2.2 - The Skill Chain](../L2-behavioral-guardrails.md#pattern-22--the-skill-chain)

### Skill Overlay

**Layer**: L2 - Behavioral Guardrails
**Definition**: Extension of base agent capabilities with project-specific rules, hook activations, and integration points declared in a markdown file.
**See**: [Pattern 2.1 - Skill Overlay Architecture](../L2-behavioral-guardrails.md#pattern-21--skill-overlay-architecture)

### Spec Drift

**Layer**: L0 - Foundation
**Definition**: Misalignment between documentation, tests, and code that accumulates over time, creating confusion and wasting tokens as agents chase outdated specifications.
**See**: [Pattern 0.7 - Documentation as System Map](../L0-foundation.md#pattern-07--documentation-as-system-map)

### Stack Test

**Layer**: L1 - Closed Loop Design
**Definition**: Full-system test running complete Docker stack with API-level verification, zero mocks for owned services, and high failure diagnosticity.
**See**: [Pattern 1.1 - Stack Tests](../L1-feedback-loops.md#pattern-11--stack-tests)

---

## T

### Task Bank

**Layer**: L0 - Foundation
**Definition**: A fixed set of 10 to 30 representative tasks, each with a prompt, an expected artefact and a mechanical check, run against a pinned model to test whether a context artefact is needed.
**See**: [Task Bank](../references/task-bank.md)

### Test Integrity

**Layer**: L1 - Closed Loop Design
**Definition**: Rules eliminating escape hatches (conditional assertions, catch without rethrow, optional chaining) that allow tests to silently skip assertions.
**See**: [Pattern 1.6 - Test Integrity Rules](../L1-feedback-loops.md#pattern-16--test-integrity-rules)

### Tested Stop

**Layer**: L4 - Standards & Measurement
**Definition**: A way to halt an unattended workflow that someone has used in a drill: a named person who can
invoke it, a mechanism such as credential revocation or a queue pause, and a named role that approves restart.
The agent register records whether one exists. Under [Earned Autonomy](../earned-autonomy.md) a scheduled drill
runs the stop against a canary and writes the date it last passed; a failed or overdue drill demotes the workflow.
**See**: [Pattern 4.7 - Author of Record and Agent
Register](../L4-standards-measurement.md#pattern-47--author-of-record-and-agent-register)

### Token Efficiency

**Layer**: L3 - Optimization (optional)
**Definition**: Lower token consumption per task, pursued through native structured tools and context isolation. Measure it on your own sessions, in tokens.
**See**: [L3: Optimization](../L3-optimization.md)

### Transient Volume

**Layer**: L1 - Closed Loop Design
**Definition**: Docker named volume that disappears with `docker compose down -v`, preventing state leakage between test runs.
**See**: [Pattern 1.4 - Container Isolation](../L1-feedback-loops.md#pattern-14--container-isolation)

---

## Z

### Zero-Defect Tolerance

**Layer**: L2 - Behavioral Guardrails
**Definition**: Discipline requiring every error, warning, and failure to be addressed; agents cannot distinguish "relevant" from "irrelevant" issues without breaking the feedback loop.
**See**: [Pattern 2.5 - Zero-Defect Tolerance](../L2-behavioral-guardrails.md#pattern-25--zero-defect-tolerance)

---

## Cross-References

- **L0 Foundation**: Project structure and entry points
- **L1 Closed Loop Design**: Design-led verification and closed-loop testing
- **L2 Behavioral Guardrails**: Skills, hooks, and enforcement
- **L3 Optimization (optional)**: Token efficiency and routing
- **L4 Standards & Measurement**: Evidence-based claims, metrics, CI guardrails, context eval
