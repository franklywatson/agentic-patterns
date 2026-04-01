# Testing Infrastructure Is Production Code

The tooling that enables stack tests — port allocators, compose file generators, container managers, health check pollers, authentication utilities — is not test scaffolding. It is application code that happens to serve a testing purpose. Treat it with the same rigor as any production module: unit tests, error handling, edge case coverage, and code review.

## Why This Matters

When agents rely on flaky test utilities, every stack test result becomes suspect. A port allocator with a race condition produces intermittent failures that look like application bugs. A compose file generator that forgets to clean up volumes causes state leakage between runs. An authentication helper with silent error swallowing produces "permission denied" failures that send agents debugging the wrong layer.

The diagnostic power of stack tests ([1.1](1.1-stack-tests.md)), the sequential ordering ([1.3](1.3-sequential-design.md)), and the container isolation ([1.4](1.4-container-isolation.md)) all depend on the test infrastructure working correctly. If the infrastructure is unreliable, the entire feedback loop degrades — and agents lose the ability to self-diagnose.

## In Practice

Apply the same standards to test infrastructure as to application code:

- **Unit test the utilities**: Port allocators, compose generators, and health check pollers should have their own test suites. A `PortAllocator` with 99.9% availability still introduces flakiness at scale — test the edge cases (exhausted port ranges, concurrent allocation, permission errors).
- **Error handling, not error swallowing**: Test utilities must throw on failure, not return null or log silently. An agent can't diagnose what it can't see.
- **Code review with the same scrutiny**: Stack test utilities go through the same PR review process as application endpoints. There is no separate "lower standard" for test infrastructure.
- **Refactor when it grows**: A 5,000-line test utility file is a god file ([L0: Pattern 0.1](../L0-foundation.md#pattern-01--deep-modules)). Extract concerns — container lifecycle, authentication, assertion helpers — into focused modules with clean interfaces. (Note: the reference project's `StackTestUtils` at 5,888 lines in a single class predates this principle being applied to test infrastructure — it is a known rough edge that accumulated organically and would benefit from decomposition into focused modules.)

## Cross-References

- [L0: Pattern 0.1 — Deep Modules](../L0-foundation.md#pattern-01--deep-modules) — Test utilities need the same module discipline
- [Pattern 1.4 — Container Isolation](1.4-container-isolation.md) — Isolation mechanics must themselves be reliable
- [Pattern 1.6 — Test Integrity Rules](1.6-test-integrity.md) — Integrity applies to test infrastructure, not just test assertions
- [L2: Pattern 2.5 — Zero-Defect Tolerance](../L2-behavioral-guardrails.md#pattern-25--zero-defect-tolerance) — Flaky infrastructure violates zero-defect

---

[Back to L1 Overview](../L1-feedback-loops.md) | [Previous: Pattern 1.6](1.6-test-integrity.md)
