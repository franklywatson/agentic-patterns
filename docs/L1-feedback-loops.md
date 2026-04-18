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

### Design Rinsing — Cross-Domain Architectural Extraction

Context harvesting typically draws from the *current* project — docs, code, tests, logs. But agents can also extract architectural insight from *external* sources: other codebases (possibly in different languages, designed for different purposes), YouTube transcripts, articles, or design notes. **Design rinsing** is the structured process of directing an agent to analyze an external source, distill transferable patterns, and translate them into design decisions for the target project.

Design rinsing is not copying code. It is extracting the *why* behind architectural decisions — the structural reasoning, the failure modes that shaped a design, the trade-offs that were considered. The agent then translates those abstracted principles into the target project's language, constraints, and purpose. The result is never a direct port; it is an adaptation informed by cross-domain insight.

**How design rinsing differs from internal context harvesting:**

| Context Harvesting | Design Rinsing |
|-------------------|----------------|
| Internal — current codebase | External — outside sources |
| Before a specific change | Before a design direction or architectural evolution |
| Targeted slices (docs, code, tests, logs) | Cross-domain distillation (different language, purpose, or medium) |
| Agent reads to understand current state | Agent reads to extract transferable patterns |

![Design Rinsing Workflow](../diagrams/1.8-design-rinsing-workflow.png)

#### The Design Rinsing Workflow

1. **Identify the source** — What external material contains architectural insight relevant to your design challenge? A codebase in a different language, a YouTube talk, a design document from another domain.

2. **Scope the rinse** — What specific aspects are you looking for? Architecture, testing, agent coordination, error handling, progressive disclosure, state management.

3. **Direct the agent** — Point the agent at the source with specific analysis questions. "How does this system handle multi-agent coordination?" not "Read this entire codebase."

4. **Distill** — The agent extracts essential patterns, not surface-level code. What decisions were made, why, and what trade-offs they represent.

5. **Translate** — Adapt extracted patterns to the target project's language, constraints, and purpose. A Rust project's ownership model doesn't port to Python, but its approach to resource lifecycle management might.

6. **Document** — Record what was rinsed, what was extracted, and how it was translated. This becomes the design rationale that future sessions can reference.

#### Sources and Targets

Design rinsing works with diverse source materials:

| Source Type | What You Extract | Example |
|-------------|-----------------|---------|
| Codebase (different language) | Architecture, design patterns, testing strategy, module boundaries | Rust multi-agent system → Python voice assistant agent coordination |
| Codebase (same ecosystem) | Implementation patterns, tool choices, configuration conventions | Node.js trading bot stack tests → Python testing infrastructure |
| YouTube demo / walkthrough | Concrete architecture, agent roles, pipeline design, routing logic | Multi-agent command center demo → war room with 5 agents, Pipecat pipeline, 3-tier routing |
| YouTube talk / lecture | Core concepts, design principles, mental models | UC Berkeley talk on autonomous system design → graduated autonomy, context bundling |
| Article / blog post | Distilled observations, failure modes, trade-off analysis | Karpathy's LLM coding pitfalls → runtime behavioral skills |

#### When to Use Design Rinsing

Design rinsing is valuable when:

- The target project faces architectural questions that another project has already solved
- The team is exploring a new domain and needs mental models from established systems
- Cross-domain insight would prevent not-invented-here reinvention
- The design needs to evolve beyond the current codebase's accumulated patterns

Design rinsing is overkill when:

- The target project's existing patterns already solve the problem
- The external source is too distant to provide relevant insight (a game engine's architecture rarely informs a CRUD API)
- The rinse would take more context than building the solution from scratch

#### Design Rinsing and the REPL Fractal

Design rinsing operates at the **system-level** of the REPL fractal described earlier. It extends the Read phase beyond the current project — the agent reads external architecture to inform its mental model before acting. This is context harvesting at its broadest scope: not "what does this function do?" but "what design philosophy produced this system?"

The [my-claw project](references/reference-my-claw-case-study.md) demonstrates design rinsing across three phases: a YouTube demo video rinsed into concrete architecture (war room, agents, pipeline, routing), multiple external sources (academic talk, Rust codebase, behavioral specification) rinsed for agent design principles and autonomy models, and the agentic-patterns repository plus compound engineering plugin rinsed to establish the project's development approach.

---

## Pattern Index

The following patterns describe the verification mechanisms that close the loop on design intent. Each pattern has its own document with detailed guidance, code examples, and anti-patterns.

### [Pattern 1.1 — Stack Tests](L1-patterns/1.1-stack-tests.md)

Full-system tests running the complete Docker stack with API-level verification, zero mocks for owned services, and high failure diagnosticity. Each test models an atomic user journey — a single, complete interaction from the user's perspective. Includes health endpoint test mode, test fixture bootstrapping, and the "Beyond API Testing" extension to browser-driven verification with Playwright. **Why it matters:** Stack tests close the feedback loop — the agent gets binary confirmation that the system works end-to-end, not that individual functions return correct values.

### [Pattern 1.2 — Full-Loop Assertion Layering](L1-patterns/1.2-full-loop-assertions.md)

Three-level assertion structure (primary, second-order, third-order) that provides diagnostic signal at increasing distance from the primary action. Primary verifies the direct response, second-order verifies side effects through a different API endpoint, third-order verifies cross-functional consistency (audit logs, notifications, cross-endpoint agreement). **Why it matters:** A `200 OK` response proves nothing about side effects. Second-order assertions catch missing persistence; third-order assertions catch broken observability. Each failure mode points to a specific subsystem.

### [Pattern 1.3 — Sequential / Additive Test Design](L1-patterns/1.3-sequential-design.md)

Tests ordered by dependency so that if test N fails, the agent knows tests 1 through N-1 passed. The sequence acts as a diagnostic ladder narrowing the search space. Stack tests as vertical slices — each test is one atomic user journey that can be run individually during development or as a full suite before completion. **Why it matters:** Without ordering, a checkout failure could mean broken auth, broken database, or broken checkout logic — ordering tells the agent exactly which subsystem to investigate.

### [Pattern 1.4 — Container Isolation](L1-patterns/1.4-container-isolation.md)

Four mechanisms ensuring tests never interfere: unique container names, dynamic port allocation, transient volumes, and per-test compose files. Aggressive cleanup prevents Docker resource exhaustion during concurrent test execution. **Why it matters:** Hardcoded ports and shared state produce flaky, non-deterministic test failures that waste agent tokens on false investigations. Isolation makes every test run deterministic.

### [Pattern 1.5 — Real Dependencies in E2E/Integration and Stack Tests](L1-patterns/1.5-no-mock-philosophy.md)

Stack tests and E2E/integration tests use real everything — real PostgreSQL, real Redis, real message queues. If you own it, run it. If you can run it in Docker, run it in Docker. Also covers **focused integration tests** — a niche pattern for exhaustive edge-case coverage of complex external dependencies (payment providers, blockchain RPCs) against their real APIs, without running the full stack. **Why it matters:** Mocks create a fantasy system that passes tests but fails in production. Mocks are appropriate and encouraged in unit tests, which validate module contracts in isolation.

### [Pattern 1.6 — Test Integrity Rules](L1-patterns/1.6-test-integrity.md)

Six forbidden patterns that allow tests to silently pass: conditional assertions, catch without rethrow, optional chaining on expect, early returns before assertions, try-catch wrapped expectations, and soft assertions. Every test must either pass or fail explicitly. **Why it matters:** A test that can silently pass is worse than no test — it gives false confidence. Every test must provide unambiguous signal to the agent.

### [Testing Infrastructure Is Production Code](L1-patterns/testing-infrastructure.md)

The tooling that enables stack tests — port allocators, compose file generators, container managers — is application code, not scaffolding. Treat it with the same rigor: unit tests, error handling, edge case coverage, and code review. **Why it matters:** Brittle test infrastructure wastes more agent tokens than any other source — the agent debugs test tooling instead of application logic.

---

## Practitioner Insight

> "Close the loop: AI agents must be able to verify their own work."
> — Peter Steinberger, creator of OpenClaw

This is the foundational principle behind stack tests. When an agent can spin up the full system, execute against real dependencies, and validate through the API, it gets clear binary feedback — not ambiguous partial results from mocked components. The agent either passes or fails, and when it fails, the diagnostic signal points directly to what's broken.

---

**Previous:** [L0: Foundation](L0-foundation.md) | **Next:** [L2: Behavioral Guardrails](L2-behavioral-guardrails.md) | [Back to Overview](../README.md)
