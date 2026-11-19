"""Regression suite for the minimal app. Runs against a deployed stack at
REGRESSION_BASE_URL. The repair loop runs it on every candidate."""

import os
import uuid

import httpx
import pytest


@pytest.fixture(scope="module")
def http():
    with httpx.Client(base_url=os.environ["REGRESSION_BASE_URL"], timeout=30.0) as client:
        yield client


@pytest.fixture(scope="module")
def user(http):
    email = f"user-{uuid.uuid4()}@example.test"
    created = http.post("/users", json={"email": email, "username": "regression", "password": "pw-regression-1"})
    assert created.status_code == 201
    return {"email": email, **created.json()}


def test_health_reports_both_dependencies_connected(http):
    response = http.get("/health", params={"mode": "prod"})
    assert response.status_code == 200
    assert response.json()["services"]["postgres"]["connected"] is True
    assert response.json()["services"]["redis"]["connected"] is True


def test_a_user_can_register_and_be_read_back_by_id(http, user):
    fetched = http.get(f"/users/{user['id']}")
    assert fetched.status_code == 200
    assert fetched.json()["email"] == user["email"]


def test_a_duplicate_email_is_rejected(http, user):
    duplicate = http.post("/users", json={"email": user["email"], "username": "regression", "password": "pw-regression-2"})
    assert duplicate.status_code == 409


def test_an_unknown_but_well_formed_id_is_404(http):
    response = http.get(f"/users/{uuid.uuid4()}")
    assert response.status_code == 404
    assert response.json() == {"error": "User not found"}


def test_login_returns_a_session_token(http, user):
    response = http.post("/auth/login", json={"email": user["email"], "password": "pw-regression-1"})
    assert response.status_code == 200
    assert isinstance(response.json()["token"], str)
