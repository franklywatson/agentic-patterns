# Stack Test Example — Python

A minimal, working example of stack tests in Python using pytest. Each test models one **atomic user journey** — a complete interaction from the user's perspective.

## What This Demonstrates

- **User journey framing**: Each test is one complete user interaction, not a component check
- **Dynamic port allocation**: Ports assigned from available range (10000-65535)
- **Unique container naming**: `{test-name}-{pid}-{random}-{service}` prevents collisions
- **Transient volumes**: Data disappears when containers stop
- **Per-test compose files**: `docker-compose-{test-name}-{pid}-{random}-{timestamp}.yml`
- **Full-loop assertions**: Primary response, second-order cross-API verification, third-order audit/observability
- **Sequential ordering**: Tests numbered `01_`, `02_` to establish dependency ladder

## File Structure

```
.
├── pyproject.toml             # Dependencies and pytest config
├── pytest.ini                 # Pytest settings: 300s timeout
├── docker-compose.test.yml    # Template stack: app, postgres, redis
├── tests/
│   ├── conftest.py            # Session-scoped fixtures
│   └── stack/
│       ├── test_01_app_startup.py        # Journey: system comes online
│       └── test_02_user_registration.py  # Journey: user signs up
```

## How to Run

```bash
# Install dependencies
pip install -e .

# Run all stack tests
pytest tests/stack/

# Run specific test file
pytest tests/stack/test_01_app_startup.py

# Run with verbose output
pytest -v tests/stack/

# Run with coverage
pytest --cov=app tests/stack/
```

## Requirements

- Docker and Docker Compose installed
- Python 3.12+
- Ports 10000-65535 available

## Key Concepts

### 1. Session-Scoped Fixtures

The `stack_config` fixture starts the stack once per test session. All tests in the session share the same stack, making tests faster while maintaining isolation between test runs.

### 2. Sequential Test Design

Tests are numbered `test_01_`, `test_02_` etc. Pytest runs files in alphabetical order, establishing a dependency ladder. If test 02 fails, the agent knows test 01 passed. Each test models one atomic user journey — a complete interaction from the user's perspective.

### 3. Full-Loop Assertions

Each test verifies at multiple levels:

- **Primary**: API response status and body
- **Second-order**: Derived effects verified through DIFFERENT API endpoints than the one that performed the action (cross-API verification)
- **Third-order**: Cross-functional verification via admin/observability APIs (audit logs, email notifications, cross-endpoint consistency, auth enforcement)

### 4. Container Isolation

Every test session gets a unique compose file with unique container names and ports. Concurrent test sessions don't collide.

### 5. Aggressive Cleanup

`docker compose down -v --remove-orphans` removes everything: containers, volumes, networks. No state leakage between test sessions.

### 6. No Escape Hatches

Assertions use direct `assert` statements. No conditional checks, no try-catch that swallows errors, no early returns. Tests fail loudly and clearly.

## Mock App

The tests reference a `./mock-app` directory that should contain a minimal FastAPI app. For this example, the tests assume an app with:

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

## Comparison with TypeScript Example

Both examples demonstrate the same concepts:

| Concept | TypeScript | Python |
|---------|-----------|--------|
| Test runner | Jest | pytest |
| Fixtures | beforeAll/beforeEach | pytest fixtures |
| Async support | async/await | pytest-asyncio |
| Isolation | Per-test | Per-session |
| Assertion style | expect().toBe() | assert == |

Choose the language that matches your application stack. The patterns are identical.
