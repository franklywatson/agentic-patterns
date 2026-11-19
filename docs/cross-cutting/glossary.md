# Glossary

Alphabetical reference for specialized terms used across the agentic-patterns library.

---

## A

### Agentic Testing

**Layer**: L1 - Closed Loop Design
**Definition**: Full-system, no-mock testing approach that enables AI agents to self-diagnose and self-correct during system development.
**See**: [L1 Closed Loop Design](../L1-feedback-loops.md)

### Autonomy Grant (A1-A5)

**Definition**: What one named workflow may do on its own. A1 suggests and a human applies the change. A2 opens pull requests that a human reads. A3 passes required checks before a human merges. A4 acts on an event or schedule within permitted actions. A5 is A4 managed as an investment with a baseline, target, review date and stop rule. A grant is per workflow and cannot sit above the cap line.
**See**: [How Far a Team Can Let Go](../../README.md#how-far-a-team-can-let-go)

### Assertion Layering (Full-Loop)

**Layer**: L1 - Closed Loop Design
**Definition**: Three-level assertion structure (primary, second-order, third-order) that provides diagnostic signal at increasing distance from the primary action.
**See**: [Pattern 1.2 - Full-Loop Assertion Layering](../L1-feedback-loops.md#pattern-12--full-loop-assertion-layering)

### Autonomy Grant

**Layer**: Cross-cutting - Earned Autonomy
**Definition**: What one named workflow may do without a human, from A1 (assisted) to A5 (portfolio-managed). Held per workflow, never above the cap.
**See**: [Earned Autonomy](../earned-autonomy.md)

### Autonomy Register

**Layer**: Cross-cutting - Earned Autonomy
**Definition**: Committed, schema-validated `.autonomy.yaml` listing every agent workflow with owner, grant, identity, limits, stop mechanism and review date. No agent may write it.
**See**: [Earned Autonomy](../earned-autonomy.md)

---

## C

### Cap Line

**Definition**: The lowest position among the four dimensions that cap unattended work (platform, measuring value, security and governance, production ownership). No workflow grant may sit above it.
**See**: [How Far a Team Can Let Go](../../README.md#how-far-a-team-can-let-go)

### CI Guardrails

**Layer**: L4 - Standards & Measurement
**Definition**: GitHub Actions workflows for docs quality and test coverage, providing non-negotiable enforcement independent of session-scoped hooks. Thresholds defined in project config, not CI workflow.
**See**: [Pattern 4.5 - CI Guardrails](../L4-standards-measurement.md#pattern-45--ci-guardrails)

### Context Eval

**Layer**: L4 - Standards & Measurement
**Definition**: Structured evaluation pattern that scores an agent's decisions against expected outcomes across multiple scenarios and configurations. Applies to any decision layer (tool routing, enforcement pipelines, skill selection, constitutional compliance). Uses graduated scoring (1.0 exact, 0.5 partial, 0.0 miss) and fails the build if overall score falls below a threshold.
**See**: [Pattern 4.6 - Context Eval](../L4-standards-measurement.md#pattern-46--context-eval)

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

## G

### Graybox Module

**Layer**: L0 - Foundation
**Definition**: Module concept where tests lock down behavior, the public interface is carefully controlled, and the interior is delegatable to AI (based on Matt Pocock's concept).
**See**: [Pattern 0.1 - Deep Modules](../L0-foundation.md#pattern-01--deep-modules)

### Guardrail

**Layer**: L2 - Behavioral Guardrails
**Definition**: A control that holds a rule at one layer: prompt (guidance), hook (deterministic policy inside the harness), CI (required check), sandbox or credential scope (boundary), or downstream authorisation. Each rule is only as strong as the layer that holds it. A hook is not a security boundary.
**See**: [L2 Behavioral Guardrails Overview](../L2-behavioral-guardrails.md)

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

---

## L

### Layer (L0-L4)

**Definition**: A group of patterns that depend on the layers below it: L0 Foundation, L1 Closed Loop Design and Verification, L2 Behavioral Guardrails, L3 Optimization (optional), L4 Standards & Measurement. The layers are not a maturity scale. Not the same as an enforcement point or a position on the curve.
**See**: [README](../../README.md)

---

## M

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

### Test Integrity

**Layer**: L1 - Closed Loop Design
**Definition**: Rules eliminating escape hatches (conditional assertions, catch without rethrow, optional chaining) that allow tests to silently skip assertions.
**See**: [Pattern 1.6 - Test Integrity Rules](../L1-feedback-loops.md#pattern-16--test-integrity-rules)

### Token Efficiency

**Layer**: L3 - Optimization (optional)
**Definition**: Lower token consumption per task, pursued through native structured tools and context isolation. Measure it on your own sessions, in tokens.
**See**: [L3: Optimization](../L3-optimization.md)

### Transient Volume

**Layer**: L1 - Closed Loop Design
**Definition**: Docker named volume that disappears with `docker compose down -v`, preventing state leakage between test runs.
**See**: [Pattern 1.4 - Container Isolation](../L1-feedback-loops.md#pattern-14--container-isolation)

### Tested Stop

**Layer**: Cross-cutting - Earned Autonomy
**Definition**: A stop mechanism exercised by a scheduled drill against a canary run, which writes the date it last passed. A failed or overdue drill demotes the workflow.
**See**: [Earned Autonomy](../earned-autonomy.md)

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
