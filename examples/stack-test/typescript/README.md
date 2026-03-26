# Stack Test Example — TypeScript

A minimal, working example of stack tests in TypeScript using Jest. Each test models one **atomic user journey** — a complete interaction from the user's perspective.

## What This Demonstrates

- **User journey framing**: Each test is one complete user interaction, not a component check
- **Dynamic port allocation**: Ports assigned from available range (10000-65535)
- **Unique container naming**: `{test-name}-{pid}-{random}-{service}` prevents collisions
- **Transient volumes**: Data disappears when containers stop
- **Per-test compose files**: `docker-compose-{test-name}-{pid}-{random}-{timestamp}.yml`
- **Full-loop assertions**: Primary response, second-order cross-API verification, third-order audit/observability
- **Sequential ordering**: Tests numbered `01-`, `02-` to establish dependency ladder

## File Structure

```
.
├── package.json              # Dependencies
├── jest.config.js            # Jest config: 300s timeout, runInBand
├── docker-compose.test.yml   # Template stack: app, postgres, redis
├── tests/
│   ├── config/
│   │   └── stack-utils.ts    # StackTestUtils class
│   └── stack/
│       ├── 01-app-startup.stack.test.ts        # Journey: system comes online
│       └── 02-user-registration.stack.test.ts  # Journey: user signs up
```

## How to Run

```bash
# Install dependencies
npm install

# Run all stack tests
npm run test:stack

# Run specific test file
npx jest tests/stack/01-app-startup.stack.test.ts

# Run with verbose output
npx jest --verbose
```

## Requirements

- Docker and Docker Compose installed
- Node.js 20+
- Ports 10000-65535 available

## Key Concepts

### 1. Sequential Test Design

Tests are numbered `01-`, `02-` etc. to enforce ordering. Each test assumes all previous tests pass. This creates a diagnostic ladder: if test 02 fails, the agent knows test 01 passed, narrowing the problem space. Each test models one atomic user journey — a complete interaction from the user's perspective.

### 2. Full-Loop Assertions

Each test verifies at multiple levels:

- **Primary**: API response status and body
- **Second-order**: Derived effects verified through DIFFERENT API endpoints than the one that performed the action (cross-API verification)
- **Third-order**: Cross-functional verification via admin/observability APIs (audit logs, email notifications, cross-endpoint consistency, auth enforcement)

### 3. Container Isolation

Every test gets a unique compose file with unique container names and ports. Tests can run concurrently without collision.

### 4. Aggressive Cleanup

`docker compose down -v --remove-orphans` removes everything: containers, volumes, networks. No state leakage between tests.

## Mock App

The tests reference a `./mock-app` directory that should contain a minimal Node.js app. For this example, the tests assume an app with:

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

In real usage, point the compose file at your actual application.
