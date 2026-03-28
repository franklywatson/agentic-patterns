# L1 Closed Loop Design and Verification

**Level 1** in the agentic patterns hierarchy: the level where agents stop guessing and start designing. L0 provides navigable structure — deep modules, progressive disclosure, CLAUDE.md as constitution. L1 is where the agent uses that structure to gather evidence, form hypotheses, propose architectural changes, and validate the result through closed-loop verification.

The "closed loop" is design→implement→verify→confirm, not just test→fix→test. Stack tests are the validation mechanism that closes the loop — they confirm that the design intent was implemented correctly. But the design comes first. Every plan, every bugfix, every investigation begins with harvesting the right context: understanding what the system does, what it should do, and what evidence supports the proposed change.

---

## Context Harvesting — From Understanding to Design

Every agent interaction with the system — a new feature, a bug fix, an architectural investigation — starts with context, not code. The agent harvests targeted information from documentation (intent), code (contract), tests (expected behavior), and logs (what actually happened) to construct a mental model before proposing changes. This section describes the workflow that turns context into design, and design into verified implementation.

### The Design-First Workflow

The workflow for driving an architectural change through the system:

1. **Explain the problem** — Describe what's broken or what needs to change. Be specific: which component, which behavior, which user journey is affected.

2. **Provide evidence** — Give the agent pointers to the relevant context: log excerpts showing the failure, reference code that models the preferred solution, test output that demonstrates the current behavior. The agent needs concrete evidence, not vague descriptions.

3. **State the goal** — Define the desired end state with precision. For example: "Right now the system only stores the order status when the order is sent. We also need confidence that the order was triggered into the upstream ERP and that system has acknowledged receipt."

4. **Invoke the right skill** — Use `systematic-debugging` for investigations (analyzing failures, tracing root causes) or `plan+` for design proposals (new features, architectural changes). The skill structures the agent's analysis and prevents undisciplined exploration.

5. **Iterate on the plan** — The design must include unit and stack test changes that provide end-to-end confidence. Review the plan, challenge assumptions, refine scope. The plan is a contract between human intent and agent execution.

6. **Save the refined plan** — Persist the converged plan to the filesystem after Q&A is complete. Future sessions can reference the plan; the agent can verify implementation against it.

7. **Execute** — Use the `executing-tasks` skill to implement the plan as documented. Run tests, fix issues found, verify against the plan's acceptance criteria.

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

### From Design to Verification

The following patterns (1.1–1.6) describe the verification mechanisms that close the loop on design intent. Stack tests validate end-to-end user journeys. Full-loop assertion layering catches missing side effects. Sequential ordering provides diagnostic signal. Together, they confirm that the context harvesting produced the right design, and the implementation delivered it.

## Pattern 1.1 — Stack Tests

### Problem

Integration tests occupy a painful middle ground: too slow for rapid iteration, too incomplete for deployment confidence. They mock some components but not others, creating a "fake system" that passes tests but fails in production. Unit tests are fast but test code, not behavior. E2E tests are comprehensive but slow and brittle. We need a testing approach that provides real confidence without sacrificing developer velocity.

### Solution

**Stack tests** run the complete Docker stack (app, databases, caches, queues) and verify behavior through the API only. No internal mocks, no backend shortcuts. The test treats the system as a black box: it spins up the stack, waits for readiness, makes API calls, and asserts on observable effects.

Stack tests are the primary verification mechanism for the design intent established through context harvesting. When the agent has harvested context, framed a problem, and designed a solution, stack tests validate that the solution works end-to-end — not just that individual functions return correct values, but that the full user journey behaves as designed.

The defining characteristic of a stack test is that it models an **atomic user journey** — a single, complete interaction from the user's perspective. Not "does the order service work?" but "a user places an order, pays, and sees their balance update." The test verifies the entire journey end-to-end, not individual components in isolation.

Stack tests differ from other approaches in key ways:

- **Scope**: Entire system — every service runs in real containers, plus external deps to the fullest possible extent
- **Verification**: API-level only — tests interact like external clients
- **Granularity**: One atomic user journey per test — a complete interaction from the user's perspective
- **Isolation**: Full isolation between test runs — no shared state
- **Mock policy**: Zero mocks for owned services — real databases, real Redis, real side-effects
- **Failure diagnosticity**: High — failures always indicate real bugs, never test artifacts
- **Runs on a developer machine**: The full stack must be executable locally — no cloud deployment, no staging environment, no infrastructure beyond Docker. Every member of the team (human or AI) can run the complete test suite on their own machine and get deterministic results

### In Practice

The naive approach to stack testing would be:

1. Generate a unique `docker-compose.{test-name}.yml` with dynamic ports
2. Run `docker compose up -d` and wait for health checks
3. Execute user journeys via HTTP API
4. Assert on primary responses AND second-order effects (cross-API verification, audit)
5. Run `docker compose down -v` to clean up everything

However, leaving the orchestration of Docker operations to the agent is brittle and non-deterministic. Each session, the agent must re-derive compose file generation, port allocation, health check polling, container naming, volume cleanup, and authentication setup — and get every detail right. The first time there's a problem — a port collision, a stale volume, a race condition in health polling — the agent spends tokens debugging infrastructure instead of application logic.

This leads to a **defining insight for closed-loop testing** (closely related to the WISC context engineering framework — [Write, Isolate, Select, Compress](../L3-optimization.md#pattern-34--context-engineering--the-scout-pattern)):

**Turn brittle agent-side orchestration into deterministic tooling.** The first time trusting the agent to manually manage Docker operations causes a problem, invest in writing the tooling to fully automate that problem. Drive the agent to build a toolkit that encapsulates container lifecycle, port allocation, health check polling, authentication, and cleanup into a deterministic interface the agent invokes simply — `await stack.start()`, `await stack.cleanup()` — instead of re-deriving each operation every session.

In the [reference project](references/reference-telegram-trading-bot-case-study.md), this pattern produced `StackTestUtils` — a single class providing container lifecycle management, dynamic port allocation, authentication helpers, health check polling, database access for verification, log search for debugging, and blockchain transaction verification. The agent didn't write this in one pass. It accumulated over sessions as each brittle manual operation was automated into a reliable method. Once the toolkit existed, every subsequent agent session could run stack tests deterministically without re-deriving infrastructure logic.

The test structure remains the same — each test is one atomic user journey:

```
tests/stack/
  01-app-startup.stack.test.ts         # Journey: system comes online and reports healthy
  02-authentication.stack.test.ts      # Journey: user registers, logs in, receives a token
  03-basic-crud.stack.test.ts          # Journey: user creates, reads, updates, deletes a resource
  04-checkout-complete.stack.test.ts   # Journey: user adds items, checks out, payment succeeds
  05-refund-and-reconciliation.stack.test.ts  # Journey: user requests refund, balance updates
```

The framing matters. "Does authentication work?" tests a component. "A user registers, logs in, and receives a valid token" tests a journey. Journeys catch component-interaction bugs that component tests cannot.

Run sequentially, each test building confidence in layers. If `01-app-startup` fails, the agent knows immediately: don't waste time debugging order processing logic — the foundation is broken.

![Stack Test Architecture](diagrams/1.1-stack-test-architecture.png)

### Comparison: Test Types

| Dimension | Unit Tests | Integration Tests | Stack Tests | E2E Tests |
|-----------|------------|-------------------|-------------|-----------|
| Scope | Single function/class | Multiple components, partial stack | Full system + external deps (to fullest possible extent) | Full system + external deps |
| Speed | Milliseconds | Seconds | Seconds to minutes | Minutes |
| Isolation | Complete (in-memory) | Partial (shared fixtures) | Complete (per-test containers) | Usually shared environments |
| Confidence Level | Low (implementation detail) | Medium (partial system) | High (production-like) | High (but flaky) |
| Mock Policy | Everything | Some components | Zero mocks | Zero mocks |
| Failure Diagnosticity | Low (false positives from mocks) | Medium (mock mismatches) | High (real failures) | Low (timing, flakiness) |
| Typical Use | Algorithm correctness | Component interaction | System behavior, user journeys | Critical paths, smoke tests |
| Runs Locally | Always | Usually | Must — Docker only | Often requires cloud/staging |

### Anti-Pattern

**Don't** write "integration tests" that start a few services and mock others. You end up testing your mocks, not your system. Either test at the unit level (fast, isolated) or at the stack level (complete, real). The middle ground gives you the worst of both worlds: slow tests that don't prove anything.

**Don't** run stack tests for every code change during development. Use unit tests for rapid iteration. Run stack tests before committing or as a pre-commit hook.

### Caveats and Scope

Stack-first development is most achievable on **greenfield projects** designed with this approach from the start. When you control the architecture, you can ensure every component fits cleanly into a Docker stack and every service exposes an API surface that's testable from the outside.

For **large, sprawling existing systems**, full adoption may not be immediately practical:

- **Docker complexity limits**: Systems with dozens of microservices, specialized hardware dependencies, or complex networking may be too large to containerize as a single stack
- **Dependency depth**: Some systems have too many interdependent services to automate into a single deterministic stack
- **Legacy constraints**: Existing systems may have components that resist containerization (kernel modules, hardware integrations, licensed software)

In these cases, the stack-test approach can still be applied **incrementally**: identify the highest-value subsystems, extract them behind clean API boundaries, and stack-test those boundaries. The goal is to expand coverage over time, not to boil the ocean on day one.

The key insight: stack-first development is an architectural decision, not just a testing strategy. It shapes how you design services, define boundaries, and manage dependencies. Starting greenfield with this approach is straightforward. Retrofitting onto brownfield systems requires patience and incremental extraction — but the principles remain the same.

### Health Endpoint Test Mode

The startup test needs to verify more than "is the server running?" A production system depends on external services — email relays, message queues, secrets managers, blockchain nodes — that may be configured but not healthy. The health endpoint should support a **test mode** that decorates its response with detailed service health information:

```typescript
// GET /health?mode=test
{
  "status": "healthy",
  "services": {
    "postgres": { "connected": true, "latency_ms": 3 },
    "redis": { "connected": true, "latency_ms": 1 },
    "email_relay": { "configured": true, "smtp_verified": true },
    "message_queue": { "connected": true, "pending_jobs": 0 },
    "secrets_manager": { "connected": true, "resolved_secrets": 14 }
  },
  "version": "2.4.1",
  "env": "test"
}
```

**Why test mode on the health endpoint, not synthetic endpoints?** Creating `/test/db-health`, `/test/queue-health` etc. is an anti-pattern: it adds test-only code to production, leaks infrastructure details, and requires maintenance alongside the real endpoints. Instead, the existing health endpoint accepts a `?mode=test` query parameter that enriches its response with service-level diagnostics. The same endpoint serves both production health checks (simple status) and test-time validation (detailed diagnostics).

### Test Fixture Data Bootstrap

Stack tests need realistic data to exercise user journeys. A user can't place an order if the catalog is empty. A refund test can't run without a prior purchase. **Bootstrapping** is the process of loading test fixture data before domain tests begin.

The bootstrap step (typically `02-bootstrap-test-data.stack.test.ts`) runs after the startup test and before domain tests. It loads the prerequisite data that domain journeys need: products in the catalog, pre-configured users, reference data, and system settings.

**Bootstrap principles:**
- Use the same internal service APIs that user-facing or admin functions use — bootstrap goes through the same code paths as production, not synthetic test-only endpoints that would never exist in a real deployment
- Direct database seeding is acceptable for bootstrapping, but it must use the same internal service layer and data access patterns the application uses — not raw SQL that bypasses validation, hooks, or business logic
- Each bootstrap test creates one category of fixture data — products, users, configuration
- Bootstrap tests are sequential: domain tests assume all bootstrap tests pass
- If a bootstrap test fails, all subsequent tests are meaningless — the diagnostic signal is clear

### Cross-References

- **Pattern 1.2 (Full-Loop Assertion Layering)**: How to structure assertions within stack tests
- **Pattern 1.3 (Sequential/Additive Test Design)**: How to order stack tests for maximum diagnostic value
- **Pattern 1.4 (Container Isolation)**: How to run stack tests concurrently without collision
- **Pattern 1.5 (No-Mock Philosophy)**: Why stack tests avoid mocks entirely
- **L2 State Snapshots**: Stack tests create the ground truth for snapshot-based rollback

---

## Pattern 1.2 — Full-Loop Assertion Layering

![Full-Loop Assertion Layering](diagrams/1.2-full-loop-assertion-layering.png)

### Problem

A test that asserts only on API response status codes gives false confidence. A `200 OK` response doesn't mean the system worked correctly — it only means the API didn't crash. Side effects might be missing: database not updated, cache not invalidated, audit log not written, event not published. When tests fail, shallow assertions make diagnosis difficult.

### Solution

**Full-loop assertion layering** structures checks at three levels of increasing distance from the primary action:

1. **Primary assertions**: Direct response from the API (status, body structure, immediate fields)
2. **Second-order assertions**: Derived effects verified through a DIFFERENT API endpoint than the one that performed the action — e.g., create a user via POST, then verify the user exists via the list endpoint. Cross-API verification proves data was persisted, not just that the operation returned a success object.
3. **Third-order assertions**: Cross-functional verification via administrative or observability APIs — audit logs, email notifications, cross-endpoint consistency, authentication enforcement. These prove that the system's side effects (notification pipeline, audit trail, auth middleware) are working correctly.

Each layer provides diagnostic signal. If primary passes but second-order fails, the agent knows: core logic works, persistence is broken. If primary and second-order pass but third-order fails: happy path works, observability is broken.

### In Practice

Example: "User places an order" journey with three-layer assertions

```typescript
// Journey: A user adds items to cart, checks out, and the order is fulfilled
// Primary assertion: API response
const orderResponse = await api.post('/orders', {
  items: [{ productId: 'prod_123', quantity: 2 }],
  shippingAddress: { zip: '90210', country: 'US' }
});
expect(orderResponse.status).toBe(201);
expect(orderResponse.data.orderId).toBeDefined();

// Second-order: Cross-API verification — cart emptied via a DIFFERENT endpoint
// than the one that created the order. This proves the order was committed,
// not just that POST /orders returned a success object.
const cart = await api.get(`/cart/${userId}`);
expect(cart.data.items).toEqual([]);
expect(cart.data.subtotal).toBe('0');

// Third-order: Cross-functional verification via admin API
// Proves the audit pipeline processed the event correctly.
const adminClient = createAdminClient();
const auditLog = await adminClient.get(`/audit/${orderResponse.data.orderId}`);
expect(auditLog.data.event).toBe('ORDER_PLACED');
expect(auditLog.data.timestamp).toBeDefined();

// Third-order: Cross-endpoint consistency
// The order summary endpoint must agree with the order creation response.
const summary = await api.get(`/orders/${orderResponse.data.orderId}/summary`);
expect(summary.data.total).toBe(orderResponse.data.total);
```

Why this matters for agents:

- **Primary assertion fails**: Input validation, routing, or controller logic broken
- **Second-order fails**: Controller works but persistence or downstream effects broken
- **Third-order fails**: Core system works but observability, audit, or cross-endpoint consistency broken

Each failure mode points the agent to a specific subsystem to investigate.

### Anti-Pattern

**Don't** skip second and third-order assertions "to save time." Each assertion layer catches a distinct class of failure that the previous layer cannot. Primary assertions verify the happy path; second-order assertions verify persistence and side effects; third-order assertions verify cross-functional consistency. Skipping a layer means accepting a blind spot in your diagnostic signal — a bug in that layer will surface silently in production, not in your tests.

**Don't** implement any assertion layer by querying databases directly. Use the API, even if it's an admin-only API. Tests should interact like users (or admins), not like developers with database access. Every assertion must go through a public API endpoint — the stack test has no direct database, Redis, or internal service access.

**Don't** make assertions conditional on earlier ones passing. All layers should run and report independently. If the primary assertion fails, still check second and third — you might learn that the core logic works but response serialization is broken.

### Cross-References

- **Pattern 1.6 (Test Integrity Rules)**: How to write assertions that can't be silently skipped
- **L2 Recovery Patterns**: Third-order assertion failures trigger rollback strategies

---

## Pattern 1.3 — Sequential / Additive Test Design

![Sequential Test Ladder](diagrams/1.3-sequential-test-ladder.png)

### Problem

Tests often run in unpredictable order, making failures hard to diagnose. If a complex order processing test fails, is the bug in checkout logic, authentication, or the fact that the server never started? Unordered tests waste time — agents debug symptoms instead of root causes.

### Solution

**Sequential/additive test design** orders tests by dependency: each test assumes all previous tests pass. The sequence acts as a diagnostic ladder — if test N fails, the agent knows tests 1 through N-1 passed, narrowing the search space.

Standard ordering — each step is a user journey that builds on previous journeys:

1. **Startup**: System comes online and reports healthy — the health endpoint runs in test mode, decorating responses with real service health (email relay connectivity, message queue status, secrets manager verification) without requiring synthetic endpoints
2. **Bootstrap**: Test fixture data is loaded — seed users, pre-configured resources, reference data required for subsequent journeys
3. **Authentication**: User registers, logs in, receives a valid session token
4. **Basic flows**: User creates, reads, updates, and deletes resources
5. **Domain operations**: User completes a domain-specific workflow (checkout, refund, export)
6. **Advanced features**: User exercises edge cases and complex multi-step workflows

### In Practice

Use filenames to enforce order:

```
tests/stack/
  01-app-startup.stack.test.ts
  02-bootstrap-test-data.stack.test.ts
  03-authentication.stack.test.ts
  04-user-crud.stack.test.ts
  05-checkout-complete.stack.test.ts
  06-refund-and-reconciliation.stack.test.ts
  07-rate-limiting.stack.test.ts
```

Each test is one atomic user journey. The sequence builds from infrastructure to domain logic:

Example: If `04-checkout-basic.stack.test.ts` fails:

- Agent knows: Server starts (`01` ✓), auth works (`02` ✓), CRUD works (`03` ✓)
- Agent focuses: Checkout logic specifically, not auth or persistence
- Agent skips: Advanced checkout tests (`05`), rate limiting (`06`) — they'd fail anyway

### Stack Tests as Vertical Slices

Each stack test is a **vertical slice** through the system — analogous to a user story in agile development. It cuts across every layer from API to database to external services, validating that the entire stack works together for a specific user journey. This is not a component test that checks one service in isolation; it is a slice that confirms the system delivers value end-to-end.

This framing has practical implications for how tests are run during development:

- **Individual test runs are essential** during feature development. When building a checkout flow, running `05-checkout-complete.stack.test.ts` in isolation is the fastest way to iterate — the agent brings up the stack, exercises the journey, and gets feedback immediately without waiting for unrelated tests.
- **Full suite runs are for validation**, not iteration. An agent executing a plan should run the full suite before claiming completion. A human orchestrator deciding whether a feature is ready may run the full suite less frequently — the individual journey test provides sufficient signal during active development.
- **A test that passes in isolation but fails in the suite reveals a dependency bug** — this is valuable information when it surfaces, not a reason to forbid individual runs.

### Additive Tests as Comparative Ground Truth

Even with guardrails, skills, and stack tests, agents will sometimes produce undesirable changes that slip through. A skill might have a gap, a hook might not cover a specific mutation, or the agent might introduce subtly wrong internals that pass on the surface but cause problems later. The additive test structure provides a recovery mechanism: use a known-good, passing foundational stack test as executable ground truth to diagnose a failing new test.

**Example scenario:**

1. A `user-order-completion` stack test exists and passes. It verifies: user logs in → navigates to item → places in basket → pays → stack test asserts order state in `/user/orders` list API, email notifications sent, payment processor debit for correct amount.

2. Some time later, you instruct the agent to implement a label-printing capability for order returns. It writes code and a new stack test. The test runs and fails — for odd reasons, and things don't look quite right.

3. Instead of visual debugging, task the agent to do a **comparative analysis**: diff the passing `user-order-completion` test against the failing new test. Focus on logs, code, and tests as they relate to order creation and terminal state assertion expectations.

4. The comparison surfaces convention misalignments: the new test used a different bootstrap user than expected, used the wrong service to create the order, or the terminal state assertions only verify label existence — not label content legibility.

5. The agent fixes the in-progress solution to align with the conventions established by the foundational test.

This pattern — employing a foundational, fully passing stack test against a formative, broken one — gives the agent a structured way to discover what's wrong by comparing against what's right. The additive structure means earlier tests represent stable conventions; later tests inherit and extend those conventions. When inheritance breaks, the diff against the parent test reveals where and why.

### Anti-Pattern

**Don't** make tests depend on shared state from previous tests. Each test should still be independently valid — the sequence is about diagnostic ordering, not data dependencies. Use `beforeEach` to set up fresh state.

**Don't** put unrelated tests in the middle of the sequence. If a new test doesn't fit the dependency ladder, it probably belongs in a different suite or should be a unit test.

### Cross-References

- **Pattern 1.4 (Container Isolation)**: Each test gets its own isolated stack, preventing state leak
- **L4 Parallel Test Execution**: Ordered suites can run in parallel with each other, but tests within a suite run sequentially

---

## Pattern 1.4 — Container Isolation

![Container Isolation](diagrams/1.4-container-isolation.png)

### Problem

Running Docker-based tests concurrently creates collision chaos: containers share names, ports conflict, volumes leak state, and Docker hits hard resource limits. Tests pass in isolation, fail in parallel. CI becomes flaky. Developers lose trust.

### Solution

**Container isolation** provides four mechanisms to ensure tests never interfere:

1. **Unique container names**: `{test-name}-{pid}-{random}-{service}` guarantees no name collisions
2. **Dynamic port allocation**: Check available ports from range (10000-65535), assign only confirmed-free ports
3. **Transient volumes**: Named volumes disappear with `docker compose down -v` — no state leakage
4. **Per-test compose files**: `docker-compose-{test-name}-{pid}-{random}-{timestamp}.yml` ensures file-level isolation

Beyond collision prevention, isolation solves **Docker resource exhaustion**. Docker has hard limits: ~31 networks per bridge driver, finite containers and volumes. Without cleanup hygiene, concurrent tests exhaust these limits and crash the Docker daemon. Aggressive cleanup (down -v, volume removal, network pruning) combined with isolation prevents resource exhaustion.

### In Practice

Port allocation utility:

```typescript
async function allocatePorts(count: number): Promise<number[]> {
  const ports: number[] = [];
  const portRange = { min: 10000, max: 65535 };

  for (let i = 0; i < count; i++) {
    let port: number;
    let available = false;
    let attempts = 0;

    while (!available && attempts < 100) {
      port = randomInt(portRange.min, portRange.max);
      available = await isPortAvailable(port);
      attempts++;
    }

    if (!available) {
      throw new Error(`Could not allocate ${count} ports`);
    }
    ports.push(port);
  }

  return ports;
}
```

Compose file generation:

```typescript
function generateComposeFile(testName: string, ports: Record<string, number>): string {
  const filename = `docker-compose-${testName}-${process.pid}-${randomBytes(4).toString('hex')}-${Date.now()}.yml`;

  const content = `
version: '3.8'
services:
  app:
    container_name: ${testName}-${process.pid}-${randomBytes(4).toString('hex')}-app
    ports:
      - "${ports.app}:3000"
    environment:
      - DB_HOST=postgres
      - DB_PORT=${ports.postgres}
    # ...
  postgres:
    container_name: ${testName}-${process.pid}-${randomBytes(4).toString('hex')}-postgres
    ports:
      - "${ports.postgres}:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data
volumes:
  postgres-data:
`;

  await writeFile(filename, content);
  return filename;
}
```

Cleanup is critical:

```typescript
async function cleanup(composeFile: string): Promise<void> {
  await exec('docker', ['compose', '-f', composeFile, 'down', '-v', '--remove-orphans']);
  await unlink(composeFile);
}
```

### Anti-Pattern

**Don't** use hardcoded ports like `3000`, `5432`, `6379`. These collide on the developer's machine and in CI. Always allocate dynamically.

**Don't** use shared volumes for "performance." State leakage causes flaky tests. Transient volumes are slightly slower but reliable.

**Don't** rely on Docker's auto-cleanup. Networks and orphaned containers accumulate. Explicit removal in every test's teardown is required.

### Cross-References

- **Pattern 1.1 (Stack Tests)**: Isolation enables stack tests to run concurrently
- **L3 Test Orchestration**: The orchestration layer manages isolation at scale

---

## Pattern 1.5 — No-Mock Philosophy

### Problem

Mock system components and you test your mocks, not your system. Mocks lie: they return perfect data, never timeout, never throw unexpected errors. Tests pass but production fails because real databases have latency, real APIs return errors, real caches miss. Mocking creates a fantasy system that doesn't exist.

### Solution

**Stack tests use real everything** — real PostgreSQL, real Redis, real RabbitMQ, real HTTP calls to other services. The only acceptable mocks are external services you don't control: third-party APIs where no sandbox exists, payment processors where test mode is unavailable.

No-mock philosophy: if you own it, run it. If you can run it in Docker, run it in Docker. If you can't, that's a deployment dependency, not a testing concern.

### In Practice

What to mock vs. not mock:

| Component | Mock? | Reason |
|-----------|-------|--------|
| PostgreSQL, MySQL, MongoDB | No | Run in Docker — free, fast, realistic |
| Redis, Memcached | No | Run in Docker — trivial setup |
| RabbitMQ, Kafka | No | Run in Docker — handles real edge cases |
| Internal microservices | No | Run the full stack — integration is what you're testing |
| External APIs with sandbox (Stripe, Plaid) | No | Use sandbox — they provide it for this reason |
| External APIs without sandbox | Yes | Mock the client, test error handling |
| Time (for testing expiry) | Maybe | Use time-skewing libraries if system clock dependency is critical |

Example: Testing a payment flow

```typescript
// Good: Use Stripe testnet
const stripe = new Stripe(process.env.STRIPE_TEST_KEY);
const payment = await stripe.paymentIntents.create({
  amount: 1000,
  currency: 'usd',
  // Real Stripe testnet handles edge cases: declined cards, network errors
});

// Bad: Mock Stripe client
const mockStripe = {
  paymentIntents: {
    create: () => ({ id: 'pi_mock', status: 'succeeded' })
  };
  // This passes tests but tells you nothing about real integration
};
```

### Anti-Pattern

**Don't** mock databases "because they're slow." PostgreSQL in Docker adds ~2 seconds to startup. Mock databases to test complex queries in unit tests, not in stack tests.

**Don't** mock external services that provide test environments. Stripe, Plaid, Twilio, etc. all provide test/sandbox modes. Use them — they catch real integration bugs.

**Don't** mock for "determinism." Real systems are non-deterministic. You want tests to fail when race conditions exist, not hide them behind perfect mocks.

### Cross-References

- **Pattern 1.1 (Stack Tests)**: No-mocks is core to stack test philosophy
- [Pattern 0.5 — Unit Tests as Contract](L0-foundation.md#pattern-05--unit-tests-as-contract): Unit tests validate individual module contracts in isolation — stack tests validate system behavior through the API
- **L2 Deterministic Simulation**: When you truly need determinism (e.g., replay tests), use simulation, not mocks

---

## Pattern 1.6 — Test Integrity Rules

### Problem

Tests with escape hatches silently pass when they should fail. A developer adds an early return to skip a failing test, wraps assertions in try-catch to "see what happens," or uses optional chaining on expected values. The test suite passes, but the system is broken. These anti-patterns undermine the entire feedback loop — agents can't self-correct when tests lie.

### Solution

**Test integrity rules** eliminate escape hatches — patterns that allow tests to silently skip assertions. Every test must either pass or fail explicitly. No quiet paths.

### In Practice

Six forbidden patterns with correct alternatives:

#### 1. Conditional Assertions

**Forbidden**:

```typescript
if (response) {
  expect(response.status).toBe(200);
}
// If response is undefined, test passes with no assertions run!
```

**Correct**:

```typescript
expect(response).toBeDefined();
expect(response.status).toBe(200);
// Assertion runs unconditionally
```

#### 2. Catch Without Rethrow

**Forbidden**:

```javascript
try {
  await riskyOperation();
} catch (e) {
  console.log(e);
}
// Test passes even if operation fails
```

**Correct**:

```javascript
await expect(riskyOperation()).resolves.not.toThrow();
// Or:
try {
  await riskyOperation();
} catch (e) {
  throw new TestError(`Operation failed: ${e.message}`);
}
```

#### 3. Optional Chaining on Expect

**Forbidden**:

```typescript
expect(res?.data).toBeDefined();
// If res is undefined, expect(undefined).toBeDefined() passes!
```

**Correct**:

```typescript
expect(res).toBeDefined();
expect(res.data).toBeDefined();
// Separate assertions, both must pass
```

#### 4. Early Returns Before Assertions

**Forbidden**:

```typescript
if (!user) return;
expect(user.email).toContain('@');
// If user is null, test ends with no assertions
```

**Correct**:

```typescript
expect(user).toBeDefined();
expect(user.email).toContain('@');
// Assert on existence, then property
```

#### 5. Try-Catch Wrapped Expectations

**Forbidden**:

```typescript
try {
  expect(actual).toBe(expected);
} catch (e) {
  // Error swallowed
}
```

**Correct**:

```typescript
expect(actual).toBe(expected);
// Let the test fail loudly
```

#### 6. Soft Assertions (Report-Only)

**Forbidden**:

```typescript
softAssert(response.status === 200);
softAssert(response.data.id);
// Test continues after failure, reports all at end
```

**Correct**:

```typescript
expect(response.status).toBe(200);
expect(response.data.id).toBeDefined();
// Fail fast on first error — prevents cascade confusion
```

### Enforcement

Configure test runners to detect these patterns:

- Jest: Use `eslint-plugin-jest` with rules against conditional assertions
- pytest: Use `pytest-strictly-passing` plugin
- CI: Fail if test output contains "0 assertions"

### Anti-Pattern

**Don't** add "TODO: re-enable" comments that skip tests. If a test is legitimately blocked, move it to a separate suite or use test skipping features (`test.skip`, `@pytest.mark.skip`) — but these must be reviewed regularly.

**Don't** use test hooks (`beforeEach`, `beforeAll`) to set up conditions that silently skip tests. Assertions belong in test bodies, not setup code.

### Cross-References

- **Pattern 1.2 (Full-Loop Assertion Layering)**: Integrity rules ensure all assertion layers run
- **L4 Continuous Verification**: Integrity rules are enforced at the agent level, not just test runner level

## Testing Infrastructure Is Production Code

The tooling that enables stack tests — port allocators, compose file generators, container managers, health check pollers, authentication utilities — is not test scaffolding. It is application code that happens to serve a testing purpose. Treat it with the same rigor as any production module: unit tests, error handling, edge case coverage, and code review.

### Why This Matters

When agents rely on flaky test utilities, every stack test result becomes suspect. A port allocator with a race condition produces intermittent failures that look like application bugs. A compose file generator that forgets to clean up volumes causes state leakage between runs. An authentication helper with silent error swallowing produces "permission denied" failures that send agents debugging the wrong layer.

The diagnostic power of stack tests ([1.1](#pattern-11--stack-tests)), the sequential ordering ([1.3](#pattern-13--sequential--additive-test-design)), and the container isolation ([1.4](#pattern-14--container-isolation)) all depend on the test infrastructure working correctly. If the infrastructure is unreliable, the entire feedback loop degrades — and agents lose the ability to self-diagnose.

### In Practice

Apply the same standards to test infrastructure as to application code:

- **Unit test the utilities**: Port allocators, compose generators, and health check pollers should have their own test suites. A `PortAllocator` with 99.9% availability still introduces flakiness at scale — test the edge cases (exhausted port ranges, concurrent allocation, permission errors).
- **Error handling, not error swallowing**: Test utilities must throw on failure, not return null or log silently. An agent can't diagnose what it can't see.
- **Code review with the same scrutiny**: Stack test utilities go through the same PR review process as application endpoints. There is no separate "lower standard" for test infrastructure.
- **Refactor when it grows**: A 5,000-line test utility file is a god file ([L0: Pattern 0.1](L0-foundation.md#pattern-01--deep-modules)). Extract concerns — container lifecycle, authentication, assertion helpers — into focused modules with clean interfaces. (Note: the reference project's `StackTestUtils` at 5,888 lines in a single class predates this principle being applied to test infrastructure — it is a known rough edge that accumulated organically and would benefit from decomposition into focused modules.)

### Cross-References

- [L0: Pattern 0.1 — Deep Modules](L0-foundation.md#pattern-01--deep-modules) — Test utilities need the same module discipline
- [Pattern 1.4 — Container Isolation](#pattern-14--container-isolation) — Isolation mechanics must themselves be reliable
- [Pattern 1.6 — Test Integrity Rules](#pattern-16--test-integrity-rules) — Integrity applies to test infrastructure, not just test assertions
- [L2: Pattern 2.5 — Zero-Defect Tolerance](L2-behavioral-guardrails.md#pattern-25--zero-defect-tolerance) — Flaky infrastructure violates zero-defect

---

## Practitioner Insight

> "Close the loop: AI agents must be able to verify their own work."
> — Peter Steinberger, creator of OpenClaw

This is the foundational principle behind stack tests. When an agent can spin up the full system, execute against real dependencies, and validate through the API, it gets clear binary feedback — not ambiguous partial results from mocked components. The agent either passes or fails, and when it fails, the diagnostic signal points directly to what's broken.

---

**Previous:** [L0: Foundation — Project Structure for AI Accessibility](L0-foundation.md) | **Next:** [L2: Behavioral Guardrails — Skills & Extensions](L2-behavioral-guardrails.md) | [Back to Overview](../README.md)

