"""Stack test 01: the base app comes online with PostgreSQL and Redis and reports healthy.

Runs first: if it fails, no repair test below it is meaningful.
"""

import time

import httpx
import pytest

from repair_loop.runtime import deploy_stack, new_workspace, remove_workspaces

pytestmark = pytest.mark.stack


@pytest.fixture(scope="module")
def deployment():
    workspace = new_workspace("startup")
    stack = deploy_stack(workspace)
    try:
        yield stack
    finally:
        stack.stop()
        remove_workspaces(workspace)


def test_primary_health_answers_200_with_status_ok(deployment):
    response = httpx.get(f"{deployment.base_url}/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["version"] == "1.0.0"


def test_second_order_prod_mode_reports_postgres_and_redis_connected(deployment):
    body = httpx.get(f"{deployment.base_url}/health", params={"mode": "prod"}).json()
    assert body["services"]["postgres"]["connected"] is True
    assert body["services"]["redis"]["connected"] is True


def test_second_order_a_user_round_trips_through_postgres_and_login_lands_in_redis(deployment):
    email = f"startup-{time.time_ns()}@example.test"
    created = httpx.post(f"{deployment.base_url}/users", json={"email": email, "username": "startup", "password": "pw-startup-1"})
    assert created.status_code == 201
    login = httpx.post(f"{deployment.base_url}/auth/login", json={"email": email, "password": "pw-startup-1"})
    assert login.status_code == 200
    assert login.json()["userId"] == created.json()["id"]


def test_third_order_the_app_logs_no_unhandled_errors_during_startup(deployment):
    assert "unhandled_error" not in deployment.logs()
