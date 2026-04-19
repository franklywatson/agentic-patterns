# Glossary

Alphabetical reference for specialized terms used across the agentic-patterns library.

---

## A

### Agentic Testing

**Level**: L1 - Closed Loop Design
**Definition**: Full-system, no-mock testing approach that enables AI agents to self-diagnose and self-correct during system development.
**See**: [L1 Closed Loop Design](../L1-feedback-loops.md)

### Assertion Layering (Full-Loop)

**Level**: L1 - Closed Loop Design
**Definition**: Three-level assertion structure (primary, second-order, third-order) that provides diagnostic signal at increasing distance from the primary action.
**See**: [Pattern 1.2 - Full-Loop Assertion Layering](../L1-feedback-loops.md#pattern-12--full-loop-assertion-layering)

---

## C

### CI Guardrails

**Level**: L4 - Standards & Measurement
**Definition**: GitHub Actions workflows for docs quality and test coverage, providing non-negotiable enforcement independent of session-scoped hooks. Thresholds defined in project config, not CI workflow.
**See**: [Pattern 4.5 - CI Guardrails](../L4-standards-measurement.md#pattern-45--ci-guardrails)

### Context Eval

**Level**: L4 - Standards & Measurement
**Definition**: Structured evaluation pattern that scores an agent's decisions against expected outcomes across multiple scenarios and configurations. Applies to any decision layer (tool routing, enforcement pipelines, skill selection, constitutional compliance). Uses graduated scoring (1.0 exact, 0.5 partial, 0.0 miss) and fails the build if overall score falls below a threshold.
**See**: [Pattern 4.6 - Context Eval](../L4-standards-measurement.md#pattern-46--context-eval)

### Conditional Assertion (Anti-Pattern)

**Level**: L1 - Closed Loop Design
**Definition**: Forbidden test pattern where assertions are wrapped in conditional statements, allowing tests to pass silently without running any checks.
**See**: [Pattern 1.6 - Test Integrity Rules](../L1-feedback-loops.md#pattern-16--test-integrity-rules)

### Constitutional Rule

**Level**: L2 - Behavioral Guardrails
**Definition**: Hard constraint declared in CLAUDE.md that never relaxes; foundational to a project's guardrail system.
**See**: [Pattern 2.4 - Constitutional Rules](../L2-behavioral-guardrails.md#pattern-24--constitutional-rules)

### Container Isolation

**Level**: L1 - Closed Loop Design
**Definition**: Four mechanisms (unique container names, dynamic port allocation, transient volumes, per-test compose files) ensuring tests never interfere with each other.
**See**: [Pattern 1.4 - Container Isolation](../L1-feedback-loops.md#pattern-14--container-isolation)

### Context Engineering

**Level**: L3 - Optimization
**Definition**: Practice of investing tokens upfront in structured exploration (Scout pattern) to reduce wasted context from blind searches.
**See**: [Pattern 3.4 - Context Engineering](../L3-optimization.md#pattern-34--context-engineering-the-scout-pattern)

---

## D

### Deep Module

**Level**: L0 - Foundation
**Definition**: Module with a simple interface (3-5 exports maximum) that hides complex implementation details behind a clean facade.
**See**: [Pattern 0.1 - Deep Modules](../L0-foundation.md#pattern-01--deep-modules)

### Docker Resource Limits

**Level**: L1 - Closed Loop Design
**Definition**: Hard constraints in Docker (~31 networks per bridge driver, finite containers and volumes) that require aggressive cleanup hygiene to prevent exhaustion during concurrent testing.
**See**: [Pattern 1.4 - Container Isolation](../L1-feedback-loops.md#pattern-14--container-isolation)

### Dynamic Port Allocation

**Level**: L1 - Closed Loop Design
**Definition**: Runtime assignment of confirmed-free ports from available range (10000-65535) to prevent port conflicts during concurrent test execution.
**See**: [Pattern 1.4 - Container Isolation](../L1-feedback-loops.md#pattern-14--container-isolation)

---

## E

### Enforcement Pipeline

**Level**: L2 - Behavioral Guardrails
**Definition**: Composable pipeline where independent enforcement checks return severity levels, resolved to the most severe result (block > advise > silent).
**See**: [Pattern 2.6 - Enforcement Pipeline Composition](../L2-behavioral-guardrails.md#pattern-26--enforcement-pipeline-composition)

### Focused Integration Test

**Level**: L1 - Closed Loop Design
**Definition**: Narrow-scope test that exercises a single external dependency's real API (testnet or sandbox) with exhaustive edge-case coverage. No mocks, no full system stack — just the adapter code plus the real external service. Used for complex dependencies like payment providers where each error code, timeout scenario, and rate limit behavior needs individual verification.
**See**: [Pattern 1.5 - Real Dependencies in E2E/Integration and Stack Tests](../L1-feedback-loops.md#pattern-15--real-dependencies-in-e2eintegration-and-stack-tests)
**See**: [Pattern 2.6 - Enforcement Pipeline Composition](../L2-behavioral-guardrails.md#pattern-26--enforcement-pipeline-composition)

### Evidence-Based Claim

**Level**: L4 - Standards & Measurement
**Definition**: Completion claim backed by actual command output showing verification results; "tests should pass" is not evidence.
**See**: [Pattern 4.1 - Evidence-Based Claims](../L4-standards-measurement.md#pattern-41--evidence-based-claims)

---

## G

### Graybox Module

**Level**: L0 - Foundation
**Definition**: Module concept where tests lock down behavior, the public interface is carefully controlled, and the interior is delegatable to AI (based on Matt Pocock's concept).
**See**: [Pattern 0.1 - Deep Modules](../L0-foundation.md#pattern-01--deep-modules)

### Guardrail

**Level**: L2 - Behavioral Guardrails
**Definition**: Automated enforcement mechanism operating at the tool layer that blocks, advises, or transforms operations to ensure consistent behavior.
**See**: [L2 Behavioral Guardrails Overview](../L2-behavioral-guardrails.md)

---

## H

### Hook

**Level**: L2 - Behavioral Guardrails
**Definition**: Automated trigger that fires before or after tool operations to enforce rules through the tool layer, independent of prompt content.
**See**: [Pattern 2.3 - Hook Automation](../L2-behavioral-guardrails.md#pattern-23--hook-automation)

---

## I

### Intent Classification

**Level**: L3 - Optimization
**Definition**: Parsing bash commands into intent categories (file_read, text_search, file_modify, docker, etc.) to enable correct routing and blocking of dangerous operations.
**See**: [Pattern 3.2 - Intent Classification](../L3-optimization.md#pattern-32--intent-classification)

---

## M

### Master Index

**Level**: L0 - Foundation
**Definition**: CLAUDE.md serves as the single source of truth and discovery mechanism; all project documents must be reachable from it via link chains.
**See**: [Pattern 0.4 - CLAUDE.md as Project Constitution](../L0-foundation.md#pattern-04--claude-md-as-project-constitution)

---

## N

### New Starter Standard

**Level**: L0 - Foundation, L4 - Standards & Measurement
**Definition**: Ultimate test where someone with zero context must be able to understand the project from CLAUDE.md + README + file structure alone.
**See**: [Pattern 0.9 - AI-as-New-Starter Standard](../L0-foundation.md#pattern-09--ai-as-new-starter-standard) | [Pattern 4.3 - New Starter Standard](../L4-standards-measurement.md#pattern-43--new-starter-standard)

### Real Dependencies (No-Mock in Stack Tests)

**Level**: L1 - Closed Loop Design
**Definition**: Stack tests and E2E/integration tests use real dependencies (PostgreSQL, Redis, etc.) for owned services; only external services without testnet should be mocked. Mocks are appropriate and encouraged in unit tests for isolation.
**See**: [Pattern 1.5 - Real Dependencies in E2E/Integration and Stack Tests](../L1-feedback-loops.md#pattern-15--real-dependencies-in-e2eintegration-and-stack-tests)

### Progressive Disclosure

**Level**: L0 - Foundation
**Definition**: Directory structure that mirrors mental models, allowing AI to discover complexity gradually (README → CLAUDE.md → module interfaces → implementation).
**See**: [Pattern 0.2 - Progressive Disclosure](../L0-foundation.md#pattern-02--progressive-disclosure)

### Phase Transition Validation

**Level**: L2 - Behavioral Guardrails
**Definition**: State machine that tracks which skill chain phases the agent has visited and validates transitions, preventing phase-skipping (e.g., tdd+ without prior plan+).
**See**: [Pattern 2.7 - Phase Transition Validation](../L2-behavioral-guardrails.md#pattern-27--phase-transition-validation)

---

## R

### Resource Hygiene

**Level**: L1 - Closed Loop Design
**Definition**: Aggressive cleanup practices (docker compose down -v, volume removal, network pruning) required to prevent Docker resource exhaustion during concurrent testing.
**See**: [Pattern 1.4 - Container Isolation](../L1-feedback-loops.md#pattern-14--container-isolation)

### Routing Table

**Level**: L3 - Optimization
**Definition**: Data structure mapping common commands to their optimal implementations based on intent detection and available tools.
**See**: [Pattern 3.1 - Smart Routing](../L3-optimization.md#pattern-31--smart-routing-tool-selection)

---

## S

### Scout Pattern

**Level**: L3 - Optimization
**Definition**: Lightweight agent that maps codebase structure (file tree, key exports, dependencies) before implementation, reducing blind searches and token waste.
**See**: [Pattern 3.4 - Context Engineering](../L3-optimization.md#pattern-34--context-engineering-the-scout-pattern)

### Session Lifecycle

**Level**: L3 - Optimization
**Definition**: Session start hook that detects environment, auto-indexes project, and caches results with TTL to prevent redundant detection on every tool call.
**See**: [Pattern 3.8 - Session Lifecycle](../L3-optimization.md#pattern-38--session-lifecycle)

### Shallow Module

**Level**: L0 - Foundation
**Definition**: Anti-pattern where a module exports 20+ functions, leaking implementation details and creating excessive coupling points that confuse AI agents.
**See**: [Pattern 0.1 - Deep Modules](../L0-foundation.md#pattern-01--deep-modules)

### Skill Chain

**Level**: L2 - Behavioral Guardrails
**Definition**: Workflow pipeline where skills compose (brain+ → plan+ → tdd+ → verify+ → review+), each validating input and producing structured output for the next.
**See**: [Pattern 2.2 - The Skill Chain](../L2-behavioral-guardrails.md#pattern-22--the-skill-chain)

### Skill Overlay

**Level**: L2 - Behavioral Guardrails
**Definition**: Extension of base agent capabilities with project-specific rules, hook activations, and integration points declared in a markdown file.
**See**: [Pattern 2.1 - Skill Overlay Architecture](../L2-behavioral-guardrails.md#pattern-21--skill-overlay-architecture)

### Smart Routing

**Level**: L3 - Optimization
**Definition**: Directing commands to the most efficient tool based on intent detection (e.g., Grep tool instead of raw grep, jcodemunch instead of find).
**See**: [Pattern 3.1 - Smart Routing](../L3-optimization.md#pattern-31--smart-routing-tool-selection)

### Spec Drift

**Level**: L4 - Standards & Measurement
**Definition**: Misalignment between documentation, tests, and code that accumulates over time, creating confusion and wasting tokens as agents chase outdated specifications.
**See**: [Pattern 4.2 - Spec Drift Detection](../L4-standards-measurement.md#pattern-42--spec-drift-detection)

### Stack Test

**Level**: L1 - Closed Loop Design
**Definition**: Full-system test running complete Docker stack with API-level verification, zero mocks for owned services, and high failure diagnosticity.
**See**: [Pattern 1.1 - Stack Tests](../L1-feedback-loops.md#pattern-11--stack-tests)

### Structured Output

**Level**: L3 - Optimization
**Definition**: Tool results returned as typed, summarized data structures instead of raw text, enabling agents to reason about data rather than parse strings.
**See**: [Pattern 3.5 - Structured Output](../L3-optimization.md#pattern-35--structured-output-over-raw-text)

---

## T

### Test Integrity

**Level**: L1 - Closed Loop Design
**Definition**: Rules eliminating escape hatches (conditional assertions, catch without rethrow, optional chaining) that allow tests to silently skip assertions.
**See**: [Pattern 1.6 - Test Integrity Rules](../L1-feedback-loops.md#pattern-16--test-integrity-rules)

### Token Efficiency

**Level**: L3 - Optimization
**Definition**: 60-90% reduction in token consumption achieved through smart routing, structured output, and context engineering patterns.
**See**: [L3 Optimization Overview](../L3-optimization.md)

### Transient Volume

**Level**: L1 - Closed Loop Design
**Definition**: Docker named volume that disappears with `docker compose down -v`, preventing state leakage between test runs.
**See**: [Pattern 1.4 - Container Isolation](../L1-feedback-loops.md#pattern-14--container-isolation)

---

## Z

### Zero-Defect Tolerance

**Level**: L2 - Behavioral Guardrails
**Definition**: Discipline requiring every error, warning, and failure to be addressed; agents cannot distinguish "relevant" from "irrelevant" issues without breaking the feedback loop.
**See**: [Pattern 2.5 - Zero-Defect Tolerance](../L2-behavioral-guardrails.md#pattern-25--zero-defect-tolerance)

---

## Cross-References

- **L0 Foundation**: Project structure and entry points
- **L1 Closed Loop Design**: Design-led verification and closed-loop testing
- **L2 Behavioral Guardrails**: Skills, hooks, and enforcement
- **L3 Optimization**: Token efficiency and routing
- **L4 Standards & Measurement**: Evidence, drift detection, metrics, context eval, maturity
