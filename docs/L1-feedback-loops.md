# L1 Closed Loop Design and Verification

**Level 1** in the agentic patterns hierarchy: the level where agents stop guessing and start designing. L0 provides navigable structure — deep modules, progressive disclosure, CLAUDE.md as constitution, unit tests as contract. L1 is where the agent uses that structure to gather evidence, form hypotheses, propose architectural changes, and validate the result through closed-loop verification.

The "closed loop" is design→implement→verify→confirm, not just test→fix→test. Stack tests are the validation mechanism that closes the loop — they confirm that the design intent was implemented correctly. But the design comes first. Every plan, every bugfix, every investigation begins with harvesting the right context: understanding what the system does, what it should do, and what evidence supports the proposed change.

---

## The REPL Fractal — Closed Loops at Every Scale

The Read-Eval-Print Loop exists at every abstraction layer. L1's closed-loop design is a higher-order REPL:

- **Read** = Context harvesting (gather evidence, read docs/code/tests/logs)
- **Eval** = Design + implement (agent acts on harvested context)
- **Print** = Stack test output (verify the result)
- **Loop** = Iterate based on feedback (adjust design, re-verify)

This REPL exists at multiple scales:

- **Line-level**: Agent reads code, evaluates syntax, prints result
- **Function-level**: Agent reads contract, implements, runs unit test
- **Journey-level**: Agent reads requirements, implements feature, runs stack test
- **System-level**: Agent reads architecture, makes cross-cutting change, runs full suite

Each higher-level REPL absorbs but doesn't replace the lower ones. Unit tests don't go away when you add stack tests — they become the contract that stack tests verify against. The fractal pattern means every interaction follows the same structure: gather context, act, verify, iterate.

This fractal view of the REPL — where agents handle code-level loops so engineers can operate at the intent layer — is explored further in Brandon Waselnuk's article [REPL is dead, long live REPL](https://getunblocked.com/blog/repl-is-dead-long-live-repl/).

---

## Context Harvesting — From Understanding to Design

Every agent interaction with the system — a new feature, a bug fix, an architectural investigation — starts with context, not code. The agent harvests targeted information from documentation (intent), code (contract), tests (expected behavior), and logs (what actually happened) to construct a mental model before proposing changes.

### The Design-First Workflow

1. **Explain the problem** — Describe what's broken or what needs to change. Be specific: which component, which behavior, which user journey is affected.

2. **Provide evidence** — Give the agent pointers to the relevant context: log excerpts showing the failure, reference code that models the preferred solution, test output that demonstrates the current behavior. The agent needs concrete evidence, not vague descriptions.

3. **State the goal** — Define the desired end state with precision. For example: "Right now the system only stores the order status when the order is sent. We also need confidence that the order was triggered into the upstream ERP and that system has acknowledged receipt."

4. **Invoke the right skill** — Use `systematic-debugging` for investigations (analyzing failures, tracing root causes) or `plan+` for design proposals (new features, architectural changes). The skill structures the agent's analysis and prevents undisciplined exploration.

5. **Iterate on the plan** — The design must include unit and stack test changes that provide end-to-end confidence. Review the plan, challenge assumptions, refine scope. The plan is a contract between human intent and agent execution.

6. **Save the refined plan** — Persist the converged plan to the filesystem after Q&A is complete. Future sessions can reference the plan; the agent can verify implementation against it.

7. **Execute** — Use the `executing-tasks` skill to implement the plan as documented. Run tests, fix issues found, verify against the plan's acceptance criteria.

The [rig](https://github.com/franklywatson/claude-rig) framework automates this workflow through its skill chain — enforcing the transition from planning to implementation to verification. The `plan+` skill structures the design-first approach; the phase tracker prevents jumping to `tdd+` without a prior plan. See [L2: Behavioral Guardrails](L2-behavioral-guardrails.md) for the full skill chain architecture.

### Why Context Harvesting Precedes Testing

Stack tests validate design intent. But if the design is wrong, perfect tests just confirm the wrong thing with high confidence. The agent needs to understand the system before changing it.

This is why L0 exists as a prerequisite: deep modules make code contracts discoverable, progressive disclosure makes structure navigable, and CLAUDE.md makes rules explicit. L1 is where the agent activates those foundations — reading the map before charting the course, then verifying the destination was reached.

### Targeted Context, Not Exhaustive Reading

Don't read everything. The agent constructs a mental model from targeted slices:

- **Docs for intent** — What is this module supposed to do? What are the constraints?
- **Code for contract** — What does the interface promise? What types flow in and out?
- **Tests for expected behavior** — What does the system actually do today? What edge cases are covered?
- **Logs for what happened** — What went wrong in this specific instance? What was the observable behavior?

Each source answers a different question. Reading a 500-line file to find one assertion wastes context. Reading the test for that assertion gives the answer in 20 lines.

---

## Pattern Index

The following patterns describe the verification mechanisms that close the loop on design intent. Each pattern has its own document with detailed guidance, code examples, and anti-patterns.

### [Pattern 1.1 — Stack Tests](L1-patterns/1.1-stack-tests.md)

Full-system tests running the complete Docker stack with API-level verification, zero mocks for owned services, and high failure diagnosticity. Each test models an atomic user journey — a single, complete interaction from the user's perspective. Includes health endpoint test mode, test fixture bootstrapping, and the "Beyond API Testing" extension to browser-driven verification with Playwright.

### [Pattern 1.2 — Full-Loop Assertion Layering](L1-patterns/1.2-full-loop-assertions.md)

Three-level assertion structure (primary, second-order, third-order) that provides diagnostic signal at increasing distance from the primary action. Primary verifies the direct response, second-order verifies side effects through a different API endpoint, third-order verifies cross-functional consistency (audit logs, notifications, cross-endpoint agreement).

### [Pattern 1.3 — Sequential / Additive Test Design](L1-patterns/1.3-sequential-design.md)

Tests ordered by dependency so that if test N fails, the agent knows tests 1 through N-1 passed. The sequence acts as a diagnostic ladder narrowing the search space. Stack tests as vertical slices — each test is one atomic user journey that can be run individually during development or as a full suite before completion.

### [Pattern 1.4 — Container Isolation](L1-patterns/1.4-container-isolation.md)

Four mechanisms ensuring tests never interfere: unique container names, dynamic port allocation, transient volumes, and per-test compose files. Aggressive cleanup prevents Docker resource exhaustion during concurrent test execution.

### [Pattern 1.5 — No-Mock Philosophy](L1-patterns/1.5-no-mock-philosophy.md)

Stack tests use real everything — real PostgreSQL, real Redis, real message queues. The only acceptable mocks are external services without test environments. If you own it, run it. If you can run it in Docker, run it in Docker.

### [Pattern 1.6 — Test Integrity Rules](L1-patterns/1.6-test-integrity.md)

Six forbidden patterns that allow tests to silently pass: conditional assertions, catch without rethrow, optional chaining on expect, early returns before assertions, try-catch wrapped expectations, and soft assertions. Every test must either pass or fail explicitly.

### [Testing Infrastructure Is Production Code](L1-patterns/testing-infrastructure.md)

The tooling that enables stack tests — port allocators, compose file generators, container managers — is application code, not scaffolding. Treat it with the same rigor: unit tests, error handling, edge case coverage, and code review.

---

## Practitioner Insight

> "Close the loop: AI agents must be able to verify their own work."
> — Peter Steinberger, creator of OpenClaw

This is the foundational principle behind stack tests. When an agent can spin up the full system, execute against real dependencies, and validate through the API, it gets clear binary feedback — not ambiguous partial results from mocked components. The agent either passes or fails, and when it fails, the diagnostic signal points directly to what's broken.

---

**Previous:** [L0: Foundation](L0-foundation.md) | **Next:** [L2: Behavioral Guardrails](L2-behavioral-guardrails.md) | [Back to Overview](../README.md)
