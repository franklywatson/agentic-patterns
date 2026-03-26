# L1 Feedback Loops — Closed-Loop Testing

**Level 1** in the agentic patterns hierarchy: the foundational patterns that enable agents to self-diagnose and self-correct during system development. These patterns replace traditional integration testing with **stack tests** — full-system, no-mock, high-diagnosticity tests that give agents clear signals about what's broken and why.

---

## Pattern 1.1 — Stack Tests

### Problem

Integration tests occupy a painful middle ground: too slow for rapid iteration, too incomplete for deployment confidence. They mock some components but not others, creating a "fake system" that passes tests but fails in production. Unit tests are fast but test code, not behavior. E2E tests are comprehensive but slow and brittle. We need a testing approach that provides real confidence without sacrificing developer velocity.

### Solution

**Stack tests** run the complete Docker stack (app, databases, caches, queues) and verify behavior through the API only. No internal mocks, no backend shortcuts. The test treats the system as a black box: it spins up the stack, waits for readiness, makes API calls, and asserts on observable effects.

Stack tests differ from other approaches in key ways:

- **Scope**: Entire system — every service runs in real containers
- **Verification**: API-level only — tests interact like external clients
- **Isolation**: Full isolation between test runs — no shared state
- **Mock policy**: Zero mocks for owned services — real databases, real Redis, real side-effects
- **Failure diagnosticity**: High — failures always indicate real bugs, never test artifacts

### In Practice

A typical stack test:

1. Generates a unique `docker-compose.{test-name}.yml` with dynamic ports
2. Runs `docker compose up -d` and waits for health checks
3. Executes user journeys via HTTP API
4. Asserts on primary responses AND second-order effects (database state, logs)
5. Runs `docker compose down -v` to clean up everything

Example test structure:

```
tests/stack/
  01-app-startup.stack.test.ts         # Does the stack start?
  02-authentication.stack.test.ts      # Can users log in?
  03-basic-crud.stack.test.ts          # Core operations work
  04-domain-operations.stack.test.ts   # Business logic
  05-advanced-features.stack.test.ts   # Edge cases and complex flows
```

Run sequentially, each test building confidence in layers. If `01-app-startup` fails, the agent knows immediately: don't waste time debugging order processing logic — the foundation is broken.

### Comparison: Test Types

| Dimension | Unit Tests | Integration Tests | Stack Tests | E2E Tests |
|-----------|------------|-------------------|-------------|-----------|
| Scope | Single function/class | Multiple components, partial stack | Full system (all services) | Full system + external deps |
| Speed | Milliseconds | Seconds | Seconds to minutes | Minutes |
| Isolation | Complete (in-memory) | Partial (shared fixtures) | Complete (per-test containers) | Usually shared environments |
| Confidence Level | Low (implementation detail) | Medium (partial system) | High (production-like) | High (but flaky) |
| Mock Policy | Everything | Some components | Zero mocks | Zero mocks |
| Failure Diagnosticity | Low (false positives from mocks) | Medium (mock mismatches) | High (real failures) | Low (timing, flakiness) |
| Typical Use | Algorithm correctness | Component interaction | System behavior, user journeys | Critical paths, smoke tests |

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

### Cross-References

- **Pattern 1.2 (Full-Loop Assertion Layering)**: How to structure assertions within stack tests
- **Pattern 1.3 (Sequential/Additive Test Design)**: How to order stack tests for maximum diagnostic value
- **Pattern 1.4 (Container Isolation)**: How to run stack tests concurrently without collision
- **Pattern 1.5 (No-Mock Philosophy)**: Why stack tests avoid mocks entirely
- **L2 State Snapshots**: Stack tests create the ground truth for snapshot-based rollback

---

## Pattern 1.2 — Full-Loop Assertion Layering

### Problem

A test that asserts only on API response status codes gives false confidence. A `200 OK` response doesn't mean the system worked correctly — it only means the API didn't crash. Side effects might be missing: database not updated, cache not invalidated, audit log not written, event not published. When tests fail, shallow assertions make diagnosis difficult.

### Solution

**Full-loop assertion layering** structures checks at three levels of increasing distance from the primary action:

1. **Primary assertions**: Direct response from the API (status, body structure, immediate fields)
2. **Second-order assertions**: Effects observable via the API (database state changes, cache hits, resource creation)
3. **Third-order assertions**: Effects observable via administrative APIs (audit logs, event streams, background job completion)

Each layer provides diagnostic signal. If primary passes but second-order fails, the agent knows: core logic works, persistence is broken. If primary and second-order pass but third-order fails: happy path works, observability is broken.

### In Practice

Example: Order placement test with three-layer assertions

```typescript
// Primary: API response
const orderResponse = await api.post('/orders', {
  items: [{ productId: 'prod_123', quantity: 2 }],
  shippingAddress: { zip: '90210', country: 'US' }
});
expect(orderResponse.status).toBe(201);
expect(orderResponse.data.orderId).toBeDefined();

// Second-order: Database state via API
const cart = await api.get(`/cart/${userId}`);
expect(cart.data.items).toEqual([]);
expect(cart.data.subtotal).toBe('0');

// Third-order: Audit log via admin API
const adminClient = createAdminClient();
const auditLog = await adminClient.get(`/audit/${orderResponse.data.orderId}`);
expect(auditLog.data.event).toBe('ORDER_PLACED');
expect(auditLog.data.timestamp).toBeDefined();
```

Why this matters for agents:

- **Primary assertion fails**: Input validation, routing, or controller logic broken
- **Second-order fails**: Controller works but persistence layer broken
- **Third-order fails**: Core system works but observability/audit broken

Each failure mode points the agent to a specific subsystem to investigate.

### Anti-Pattern

**Don't** skip second and third-order assertions "to save time." Stack tests are already slow — add a few milliseconds for complete verification. The diagnostic value is worth it.

**Don't** implement third-order checks by querying databases directly. Use the API, even if it's an admin-only API. Tests should interact like users (or admins), not like developers with database access.

**Don't** make assertions conditional on earlier ones passing. All layers should run and report independently. If the primary assertion fails, still check second and third — you might learn that the core logic works but response serialization is broken.

### Cross-References

- **Pattern 1.6 (Test Integrity Rules)**: How to write assertions that can't be silently skipped
- **L2 Recovery Patterns**: Third-order assertion failures trigger rollback strategies

---

## Pattern 1.3 — Sequential / Additive Test Design

### Problem

Tests often run in unpredictable order, making failures hard to diagnose. If a complex order processing test fails, is the bug in checkout logic, authentication, or the fact that the server never started? Unordered tests waste time — agents debug symptoms instead of root causes.

### Solution

**Sequential/additive test design** orders tests by dependency: each test assumes all previous tests pass. The sequence acts as a diagnostic ladder — if test N fails, the agent knows tests 1 through N-1 passed, narrowing the search space.

Standard ordering:

1. **Startup**: Container starts, health endpoint responds
2. **Authentication**: Users can register and log in
3. **Basic flows**: CRUD operations work
4. **Domain operations**: Business logic behaves correctly
5. **Advanced features**: Edge cases, complex workflows

### In Practice

Use filenames to enforce order:

```
tests/stack/
  01-app-startup.stack.test.ts
  02-authentication.stack.test.ts
  03-user-crud.stack.test.ts
  04-checkout-basic.stack.test.ts
  05-checkout-advanced.stack.test.ts
  06-rate-limiting.stack.test.ts
  07-reconciliation.stack.test.ts
```

Example: If `04-checkout-basic.stack.test.ts` fails:

- Agent knows: Server starts (`01` ✓), auth works (`02` ✓), CRUD works (`03` ✓)
- Agent focuses: Checkout logic specifically, not auth or persistence
- Agent skips: Advanced checkout tests (`05`), rate limiting (`06`) — they'd fail anyway

### Anti-Pattern

**Don't** run tests individually during development. Run the full suite. A test that passes in isolation but fails in the suite reveals dependency bugs that individual runs hide.

**Don't** make tests depend on shared state from previous tests. Each test should still be independently valid — the sequence is about diagnostic ordering, not data dependencies. Use `beforeEach` to set up fresh state.

**Don't** put unrelated tests in the middle of the sequence. If a new test doesn't fit the dependency ladder, it probably belongs in a different suite or should be a unit test.

### Cross-References

- **Pattern 1.4 (Container Isolation)**: Each test gets its own isolated stack, preventing state leak
- **L4 Parallel Test Execution**: Ordered suites can run in parallel with each other, but tests within a suite run sequentially

---

## Pattern 1.4 — Container Isolation

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

**Don't** forget `-v` in `docker compose down -v`. Without it, volumes persist and subsequent tests see stale data.

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

**Don't** mock databases "because they're slow." PostgreSQL in Docker adds ~2 seconds to startup. Stack tests are already slow — you're not optimizing the right thing. Mock databases to test complex queries in unit tests, not in stack tests.

**Don't** mock external services that provide test environments. Stripe, Plaid, Twilio, etc. all provide test/sandbox modes. Use them — they catch real integration bugs.

**Don't** mock for "determinism." Real systems are non-deterministic. You want tests to fail when race conditions exist, not hide them behind perfect mocks.

### Cross-References

- **Pattern 1.1 (Stack Tests)**: No-mocks is core to stack test philosophy
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

---

**Previous:** [L0: Foundation — Project Structure for AI Accessibility](L0-foundation.md) | **Next:** [L2: Behavioral Guardrails — Skills & Extensions](L2-behavioral-guardrails.md) | [Back to Overview](../README.md)
