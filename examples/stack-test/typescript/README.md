# Stack Test Example — TypeScript

A minimal, working example of stack tests in TypeScript using Jest and Playwright. Each test models one **atomic user journey** — a complete interaction from the user's perspective.

## What This Demonstrates

- **User journey framing**: Each test is one complete user interaction, not a component check
- **Dynamic port allocation**: Ports assigned from available range (10000-65535)
- **Unique container naming**: `{test-name}-{pid}-{random}-{service}` prevents collisions
- **Transient volumes**: Data disappears when containers stop
- **Per-test compose files**: `docker-compose-{test-name}-{pid}-{random}-{timestamp}.yml`
- **Full-loop assertions**: Primary response, second-order cross-API verification, third-order audit/observability
- **Sequential ordering**: Tests numbered `01-`, `02-` to establish dependency ladder
- **Two test modes**: API-level (Jest) and browser-level (Playwright)

## Two Test Modes

This example demonstrates two complementary approaches to stack testing, both running against the same Docker stack with the same no-mock philosophy.

### API-Level Tests (Jest)

API-level tests drive the stack through HTTP calls — the same interface a mobile app or API consumer would use. They are fast, deterministic, and provide precise diagnostic signal through structured assertion layering.

**When to use:** Backend services, API contracts, internal system behavior, data integrity checks.

### Browser-Level Tests (Playwright)

Browser-level tests drive the stack through a real browser — the same interface an end user would use. They catch problems API tests cannot: broken JavaScript, missing CSS assets, rendering failures, and client-side logic errors.

This maps to the **"Beyond API Testing"** concept from [L1 Closed Loop Design](../../../docs/L1-feedback-loops.md#beyond-api-testing):

> Stack tests are not limited to driving backend APIs directly. For web applications, the same pattern applies with a browser automation layer like Playwright: spin up the full stack, then drive user journeys through the actual UI — form submissions, page transitions, rendered output — to verify that the combined frontend and backend work correctly end-to-end. The principle remains the same: real system, real dependencies, no mocks. Only the entry point changes from HTTP API calls to browser interactions.

**When to use:** Web applications with significant frontend logic, critical user flows that span page transitions, visual regression testing.

### How They Complement Each Other

| Concern | API Test (Jest) | Browser Test (Playwright) |
|---------|----------------|---------------------------|
| Backend logic | Verified directly | Verified through UI rendering |
| Frontend rendering | Not tested | Verified via DOM assertions |
| JavaScript execution | Not tested | Verified via console error checks |
| CSS/asset loading | Not tested | Verified via network request monitoring |
| Form validation (server) | Verified via HTTP responses | Verified via UI error messages |
| Form validation (client) | Not tested | Verified via DOM interaction |
| End-to-end user experience | Partial (API perspective) | Complete (user perspective) |
| Speed | Fast (HTTP only) | Slower (browser overhead) |

A healthy test suite uses both: API tests for fast feedback on backend changes, browser tests for confidence that the full user experience works.

## File Structure

```
.
├── package.json              # Dependencies (Jest + Playwright)
├── jest.config.js            # Jest config: 300s timeout, runInBand
├── playwright.config.ts      # Playwright config: Chromium, sequential
├── docker-compose.test.yml   # Template stack: app, postgres, redis
├── tests/
│   ├── config/
│   │   └── stack-utils.ts    # StackTestUtils class (API test helpers)
│   └── stack/
│       ├── 01-app-startup.stack.test.ts        # API: system comes online
│       ├── 02-user-registration.stack.test.ts  # API: user signs up
│       └── browser/
│           ├── 01-app-startup.browser.stack.test.ts  # Browser: page renders
│           └── 02-checkout.browser.stack.test.ts     # Browser: checkout flow
```

## How to Run

```bash
# Install dependencies (includes Playwright browser download)
npm install
npx playwright install chromium

# Run API-level stack tests (Jest)
npm run test:stack

# Run browser-level stack tests (Playwright)
# Requires the Docker stack to be running first
npm run test:browser

# Run with a custom base URL (dynamic port allocation)
BASE_URL=http://localhost:12345 npm run test:browser

# Run both test suites
npm run test:all

# Run a specific browser test file
npx playwright test --config=playwright.config.ts tests/stack/browser/01-app-startup.browser.stack.test.ts

# Run Playwright tests with UI mode (interactive debugging)
npx playwright test --config=playwright.config.ts --ui
```

## Requirements

- Docker and Docker Compose installed
- Node.js 20+
- Ports 10000-65535 available
- Chromium browser (installed via `npx playwright install chromium`)

## Key Concepts

### 1. Sequential Test Design

Tests are numbered `01-`, `02-` etc. to enforce ordering. Each test assumes all previous tests pass. This creates a diagnostic ladder: if test 02 fails, the agent knows test 01 passed, narrowing the problem space. Each test models one atomic user journey — a complete interaction from the user's perspective.

### 2. Full-Loop Assertions

Each test verifies at multiple levels:

- **Primary**: API response status and body (API tests) or page content (browser tests)
- **Second-order**: Derived effects verified through DIFFERENT API endpoints or pages than the one that performed the action
- **Third-order**: Cross-functional verification — audit logs, console errors, network request failures, cross-page consistency

### 3. Container Isolation

Every API test gets a unique compose file with unique container names and ports. Tests can run concurrently without collision. Browser tests share the same running stack (since a single browser session tests the UI against it).

### 4. Aggressive Cleanup

`docker compose down -v --remove-orphans` removes everything: containers, volumes, networks. No state leakage between tests.

### 5. Page Object Model

Browser tests use Playwright's Page Object Model pattern to keep test code clean:

- **Page objects** encapsulate DOM selectors and interaction patterns
- **Test code** expresses user intent, not DOM manipulation
- **Changes** to UI structure update one page object, not every test

### 6. Browser-Specific Assertions

Browser tests add assertion layers that API tests cannot provide:

- **Console error checks**: Page throws no JavaScript errors during load
- **Network request monitoring**: No failed asset loads (404s, 500s)
- **DOM state verification**: Elements are visible, enabled, and contain expected content
- **Cross-page consistency**: Data created on one page appears correctly on another

## Mock App

The tests reference a `./mock-app` directory that should contain a minimal Node.js app. For this example, the tests assume an app with:

**API endpoints:**

- `GET /health` — health check
- `GET /health/db` — database connectivity
- `GET /health/cache` — redis connectivity
- `POST /users` — create user
- `GET /users/:id` — get user
- `GET /users` — list users
- `GET /users/me` — get current user (authenticated)
- `POST /auth/login` — authenticate
- `PATCH /users/:id` — update user (authenticated)
- `GET /admin/audit/users` — audit log
- `GET /admin/notifications` — notification/email log

**Web pages:**

- `/health` — health status page (renders status indicator)
- `/products` — product listing (data-testid="product-card")
- `/cart` — shopping cart (data-testid="cart-item")
- `/checkout` — checkout form (data-testid="checkout-*")
- `/order-confirmation` — order confirmation (data-testid="order-*")
- `/orders` — order history (data-testid="order-row")

In real usage, point the compose file at your actual application.
