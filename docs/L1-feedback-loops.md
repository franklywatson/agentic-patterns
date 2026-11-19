---
last-validated-model: claude-opus-5-5
reviewed: 2026-11-19
---

# L1: Closed Loop Design and Verification

**Layer 1** of the agentic patterns. L0 provides navigable structure: deep modules, progressive disclosure, the agent
instruction file and unit tests as contract. L1 is where the agent uses that structure to gather evidence, form a
design, implement it and verify the result in a closed loop.

The loop is design, implement, verify, confirm, not only test, fix, test. Stack tests close it by confirming that the
design intent was implemented. Every plan, bugfix and investigation begins by harvesting the context that shows what
the system does, what it should do and what evidence supports the change.

---

## The REPL Fractal — Closed Loops at Every Scale

L1's closed loop is a higher-order read-eval-print loop (REPL):

- **Read**: context harvesting (docs, code, tests, logs)
- **Eval**: design and implement
- **Print**: stack test output
- **Loop**: adjust the design and verify again

The same loop runs at every scale: a line (read code, evaluate syntax), a function (read the contract, implement, run
the unit test), a journey (read requirements, implement, run a stack test) and the system (read the architecture,
make a cross-cutting change, run the full suite). Each level absorbs the lower ones. Unit tests become the contract
that stack tests verify against. Brandon Waselnuk's [REPL is dead, long live REPL](https://getunblocked.com/blog/repl-is-dead-long-live-repl/)
explores this view.

---

## Context Harvesting — From Understanding to Design

Every feature, bugfix or investigation starts with context, not code. The agent harvests targeted information from
documentation (intent), code (contract), tests (expected behavior) and logs (what happened), then proposes a change.
Reading a 500-line file to find one assertion wastes context; the test for that assertion answers in 20 lines.

### The Design-First Workflow

1. **Explain the problem.** Name the component, behavior or user journey affected.
2. **Provide evidence.** Log excerpts, reference code that models the preferred solution, test output showing the
   current behavior.
3. **State the goal.** Define the end state precisely, for example: "The system stores the order status when the
   order is sent. We also need confirmation that the upstream ERP received the order and acknowledged it."
4. **Invoke the right skill.** A debugging skill for investigations (such as superpowers `systematic-debugging`) or a
   planning skill for design proposals (such as `writing-plans`). The skill structures the analysis.
5. **Iterate on the plan.** The plan includes the unit and stack test changes that give end-to-end confidence. Review
   it and challenge assumptions; it is a contract between intent and execution.
6. **Save the converged plan** to the filesystem so later sessions can verify implementation against it.
7. **Execute** with an execution skill (such as `executing-plans`), run the tests and check the plan's acceptance
   criteria.

The workflow does not depend on a skill pack. The [rig](https://github.com/franklywatson/claude-rig) pack (review it
before installing, per [Pattern 2.12](L2-behavioral-guardrails.md#pattern-212--skill-plugin-and-mcp-supply-chain))
implements it as a skill chain with `plan+` for the design step; see
[L2: Behavioral Guardrails](L2-behavioral-guardrails.md).

If the design is wrong, perfect tests confirm the wrong thing with high confidence, which is why the agent understands
the system before changing it.

### Design Rinsing — Cross-Domain Architectural Extraction

**Design rinsing** directs an agent to analyze an *external* source (another codebase, a talk transcript, an article)
and distill the reasoning behind its architecture: the failure modes that shaped it and the trade-offs considered. The
agent translates those principles into the target project's language and constraints. The result is an adaptation,
never a port. Context harvesting reads the current project to understand it; design rinsing reads outside material to
extract transferable patterns before a design direction is set. It sits at the system level of the REPL fractal.

![Design Rinsing Workflow](diagrams/1.8-design-rinsing-workflow.png)

1. **Identify the source** with architectural insight relevant to the design challenge.
2. **Scope the rinse**: architecture, testing, agent coordination, error handling, state management.
3. **Direct the agent** with specific questions ("How does this system handle multi-agent coordination?"), not
   "read this codebase."

   **Warning: external sources are untrusted input.** A repository, transcript or article can contain text that
   instructs the agent (prompt injection). Rinse in a read-only session with no write access to the target project and
   no network egress beyond the source. Carry only the distilled notes into the design session
   ([Pattern 2.10](L2-behavioral-guardrails.md#pattern-210--least-agency-and-session-composition)).
4. **Distill** the decisions, their reasons and their trade-offs, not surface code.
5. **Translate** to the target. A Rust ownership model does not port to Python, but its approach to resource
   lifecycle might.
6. **Document** what was rinsed, extracted and translated, as design rationale for later sessions.

Rinse when another project has already solved the question, or the team is entering an unfamiliar domain. Skip it when
existing patterns solve the problem, the source is too distant (a game engine rarely informs a CRUD API) or the rinse
costs more context than building the solution.

**Evidence:** Thin — a reasoned technique from first-party use; no study of cross-domain extraction (first-party, n=1)

---

## Pattern Index

Patterns 1.1 to 1.6 close the loop during development. Patterns 1.7 to 1.12 extend it to production incidents.

### Development loop

#### [Pattern 1.1 — Stack Tests](L1-patterns/1.1-stack-tests.md)

Full-stack, API-level tests of one user journey each, with no mocks for owned services. Includes the health endpoint
test mode, fixture bootstrapping, browser-driven journeys and the rule that stack tooling is production code.

#### [Pattern 1.2 — Full-Loop Assertion Layering](L1-patterns/1.2-full-loop-assertions.md)

Primary, second-order and third-order assertions, ordered so the failing layer points at a subsystem.

#### [Pattern 1.3 — Sequential / Additive Test Design](L1-patterns/1.3-sequential-design.md)

Tests ordered by dependency, so a failure at test N means tests 1 to N-1 passed.

#### [Pattern 1.4 — Container Isolation](L1-patterns/1.4-container-isolation.md)

Compose project scoping, dynamic ports, transient volumes and per-run compose files, so concurrent runs do not collide.

#### [Pattern 1.5 — Real Dependencies in E2E/Integration and Stack Tests](L1-patterns/1.5-real-dependencies.md)

Real databases, caches and queues in stack and E2E tests; mocks in unit tests; focused integration tests for complex
external dependencies; fault injection that keeps the real client.

#### [Pattern 1.6 — Test Integrity Rules](L1-patterns/1.6-test-integrity.md)

Six forbidden patterns that let a test pass silently, and the lint, CI and mutation checks that catch them.

---

### Closing the loop in production

The same loop can extend into production for one narrow case: an incident in code you own, repaired by a change that is
reversible and that a machine can verify. The repair loop must not hide defects, must not grade its own work and must be
stoppable. Pattern 1.7 needs no autonomy. The others set limits before any repair runs unattended. Evidence is mixed:
1.7 is well supported for human-run teams, while 1.10, 1.11 and 1.12 are Thin (see each pattern's evidence line).

- [Pattern 1.7 — Incident-to-Stack-Test](L1-patterns/1.7-incident-to-stack-test.md): every incident ends with a reproduction that fails on the production commit and passes on the fix.
- [Pattern 1.8 — Reversibility and Blast-Radius Classes](L1-patterns/1.8-reversibility-blast-radius.md): classify each change from its diff, in code, failing closed (R0 to R4, B0 to B3).
- [Pattern 1.9 — Repair Loop with a Frozen Oracle](L1-patterns/1.9-repair-loop-frozen-oracle.md): the reproduction is frozen before the fix, the fix touches no existing test, and a scan turns masking changes into mitigations for a human.
- [Pattern 1.10 — Production Gate and Progressive Confirmation](L1-patterns/1.10-production-gate-progressive-confirmation.md): a deterministic gate outside the agent, a staged rollout, a pre-declared confirmation rule and automatic rollback.
- [Pattern 1.11 — Repair Budget, Circuit Breaker and Stop Authority](L1-patterns/1.11-repair-budget-circuit-breaker-stop.md): attempt budgets, a breaker that lowers the grant and a named stop. Unattended repair of R3 and R4 changes is not supported at any grant.
- [Pattern 1.12 — Self-Healing Tests vs Self-Healing Systems](L1-patterns/1.12-self-healing-tests-vs-systems.md): tests never heal themselves, and recovery without a repair ticket is a masked defect.

A runnable example of the gate is in [`examples/repair-loop/`](../examples/repair-loop/README.md) (TypeScript and
Python). It simulates production confirmation and does not prove it.

---

**Previous:** [L0: Foundation](L0-foundation.md) | **Next:** [L2: Behavioral Guardrails](L2-behavioral-guardrails.md) | [Back to Overview](../README.md)
