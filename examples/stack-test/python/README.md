# Stack Test Example — Python

A minimal, working example of stack tests in Python using pytest. Each test models one **atomic user journey** — a complete interaction from the user's perspective. For a team writing its first stack test; run it before adapting [Pattern 1.1](../../../docs/L1-patterns/1.1-stack-tests.md).

## What This Demonstrates

- **User journey framing**: Each test is one complete user interaction, not a component check
- **Dynamic port allocation**: Ports assigned from available range (10000-65535)
- **Unique compose project**: `docker compose -p stacktest-{pid}-{random}` isolates containers, network and volumes; the compose file sets no fixed `container_name`
- **Transient volumes**: Data disappears when the stack is removed
- **Full-loop assertions**: Primary response, second-order cross-API verification, third-order audit/observability
- **Sequential ordering**: Tests numbered `test_01_`, `test_02_` to establish dependency ladder
- **Health endpoint test mode**: `GET /health?mode=test` returns per-service diagnostics ([Pattern 1.1](../../../docs/L1-patterns/1.1-stack-tests.md))

## File Structure

```text
.
├── pyproject.toml             # Test dependencies (uv project, not a package)
├── pytest.ini                 # Pytest settings: 300s timeout, warnings are errors
├── docker-compose.test.yml    # Stack: app (built from ./app), postgres, redis
├── app/                       # FastAPI + PostgreSQL + Redis app under test
│   ├── Dockerfile
│   ├── requirements.txt
│   └── src/                   # main (endpoints), infra (db, redis, hashing)
├── tests/
│   ├── conftest.py            # Session-scoped stack fixtures
│   └── stack/
│       ├── test_01_app_startup.py        # Journey: system comes online
│       └── test_02_user_registration.py  # Journey: user signs up
```

## How to Run

Run all commands from `examples/stack-test/python/`.

```bash
# Create the virtual environment and install the locked test dependencies
uv venv
uv sync --frozen

# Run all stack tests. The session fixture builds the app image, starts a
# uniquely named compose project on free ports, and removes it (down -v) at the end.
uv run pytest tests/stack/

# Run one file
uv run pytest tests/stack/test_01_app_startup.py
```

`uv.lock` is committed and `--frozen` installs exactly the locked versions, so a new dependency release cannot introduce warnings (pytest runs with `filterwarnings = error`). The app image installs the pinned `app/requirements.txt`.

Without uv (unlocked versions): `python3 -m venv .venv && .venv/bin/pip install pytest pytest-timeout httpx && .venv/bin/pytest tests/stack/`.

Expected result: every test passes.

## Requirements

- Docker and Docker Compose installed
- Python 3.12+ and [uv](https://docs.astral.sh/uv/) (or pip, see above)
- Ports 10000-65535 available

## Key Concepts

### 1. Session-Scoped Fixtures

The `stack_config` fixture starts the stack once per test session. All tests in the session share the same stack, making tests faster while maintaining isolation between test runs.

### 2. Sequential Test Design

Tests are numbered `test_01_`, `test_02_` etc. Pytest runs files in alphabetical order, establishing a dependency ladder. If test 02 fails, the agent knows test 01 passed. Each test models one atomic user journey — a complete interaction from the user's perspective.

### 3. Full-Loop Assertions

Each test asserts in three layers:

- **Primary**: API response status and body
- **Second-order**: Derived effects verified through a different API endpoint than the one that performed the action (cross-API verification)
- **Third-order**: Cross-functional verification via admin/observability APIs (audit logs, email notifications, cross-endpoint consistency, auth enforcement)

### 4. Container Isolation

Every test session gets a unique compose project name and dynamically allocated host ports. Concurrent test sessions do not collide.

### 5. Aggressive Cleanup

`docker compose -p <project> down -v --remove-orphans` removes containers, volumes and the network. The fixture runs it in a `finally` block, and a failing cleanup raises instead of being ignored.

### 6. No Escape Hatches

Assertions use direct `assert` statements. No conditional checks, no try-catch that swallows errors, no early returns. A failing assertion stops the test and names the value.

## The App Under Test

`app/` is a minimal FastAPI application backed by real PostgreSQL 16 and Redis 7. It implements exactly what the tests exercise. Docker Compose builds it from `app/Dockerfile`.

- `GET /health` — status, timestamp and a `services` map; `GET /health?mode=test` replaces `services` with per-dependency objects (`postgres`, `redis`: `connected`, `version`, `latency_ms`), the same shape as the TypeScript app
- `GET /health/db` — PostgreSQL connectivity and version
- `GET /health/cache` — Redis connectivity and version
- `POST /users` — create user (PostgreSQL; writes an audit entry and a notification record in the same transaction; 409 on duplicate email)
- `GET /users`, `GET /users/{id}` — list and fetch users (404 for unknown ids)
- `POST /auth/login` — verify the scrypt password hash, issue a JWT, store the session in Redis
- `GET /users/me` — current user; requires `Authorization: Bearer <token>` and a live Redis session (401 otherwise)
- `PATCH /users/{id}` — update own email or username (401 without a token, 403 for another user)
- `GET /admin/audit/users` — audit log (`USER_CREATED`, `USER_LOGIN`)
- `GET /admin/notifications` — notification records (`welcome-email`)

The admin endpoints (`/admin/*`) are unauthenticated and `JWT_SECRET` falls back to a fixed demo value. Both exist to keep the example small and are not production patterns.

To test your own application instead, point the `app` service in `docker-compose.test.yml` at it and keep the endpoints your tests use.

## Comparison with TypeScript Example

Both examples demonstrate the same concepts:

| Concept | TypeScript | Python |
|---------|-----------|--------|
| Test runner | Jest | pytest |
| Fixtures | beforeAll/beforeEach | pytest fixtures |
| Async support | async/await | Synchronous tests with `httpx.Client` |
| Isolation | Per-test-file stack | Per-session stack |
| Assertion style | expect().toBe() | assert == |

Choose the language that matches your application stack. The patterns are identical.
