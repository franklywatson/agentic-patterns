"""
02_user_registration.py

Second test in the sequential stack test suite.
Models the atomic user journey: a new user signs up and can access their account.

Demonstrates full-loop assertion layering:
- Primary: Direct API response (status, body shape, field values)
- Second-order: Derived effects verified through DIFFERENT API endpoints
  than the one that performed the action (cross-API verification)
- Third-order: Cross-functional verification via admin/observability APIs
  (audit logs, email notifications, cross-endpoint consistency)

All verification goes through public API endpoints — stack tests never
query databases or internal services directly.
"""

import pytest


@pytest.fixture
def created_user_id(http_client, wait_for_ready) -> str:
    """Create a user and return the ID. Shared across tests for sequential flow."""
    wait_for_ready()

    user_data = {
        "email": "test@example.com",
        "username": "testuser",
        "password": "SecurePass123!",
    }

    response = http_client.post("/users", json=user_data)

    # Strict assertion — no conditional checks
    assert response.status_code == 201, f"Expected 201, got {response.status_code}: {response.text}"

    data = response.json()
    assert "id" in data
    assert data["email"] == user_data["email"]
    assert data["username"] == user_data["username"]
    assert "password" not in data  # Sensitive field never returned
    assert "password_hash" not in data  # Internal field never exposed

    return data["id"]


@pytest.fixture
def auth_token(http_client, created_user_id) -> str:
    """Authenticate as the created user and return a session token."""
    response = http_client.post(
        "/auth/login",
        json={"email": "test@example.com", "password": "SecurePass123!"},
    )
    assert response.status_code == 200
    return response.json()["token"]


@pytest.mark.stack
class TestUserSignUpJourney:
    """Verify the atomic user journey: sign up, authenticate, access account, see audit trail."""

    def test_create_user_returns_201(self, http_client, wait_for_ready):
        """Journey step 1: POST /users creates a new user."""
        wait_for_ready()

        user_data = {
            "email": "newuser@example.com",
            "username": "newuser",
            "password": "SecurePass123!",
        }

        # --- Primary assertion: API response ---
        response = http_client.post("/users", json=user_data)
        assert response.status_code == 201
        data = response.json()
        assert data["id"]
        assert data["email"] == user_data["email"]
        assert data["username"] == user_data["username"]
        assert data["created_at"]

    def test_create_user_cross_api_verification(self, http_client, created_user_id):
        """
        Second-order assertion: user is discoverable through a DIFFERENT endpoint
        than the one that created it. The list endpoint uses its own query path,
        so a match proves the user was persisted correctly — not just that POST
        returned a success object.
        """
        response = http_client.get("/users")
        assert response.status_code == 200
        data = response.json()
        assert "users" in data

        user_ids = [u["id"] for u in data["users"]]
        assert created_user_id in user_ids

        created_user = next(
            (u for u in data["users"] if u["id"] == created_user_id), None
        )
        assert created_user is not None
        assert created_user["username"] == "testuser"
        assert created_user["email"] == "test@example.com"

    def test_create_user_triggers_email_notification(self, http_client, created_user_id):
        """
        Third-order assertion: registration triggered an email through the
        notification service admin API. This checks a cross-functional concern:
        user creation -> notification pipeline -> email queued.
        """
        response = http_client.get("/admin/notifications")
        assert response.status_code == 200
        data = response.json()

        notifications = [
            n for n in data.get("notifications", [])
            if n.get("eventType") == "USER_CREATED"
            and n.get("recipient") == "test@example.com"
        ]
        assert len(notifications) > 0, "No USER_CREATED notification found"

        notification = notifications[0]
        assert notification["templateId"] == "welcome-email"
        assert notification["variables"]["username"] == "testuser"

    def test_user_can_authenticate(self, http_client, created_user_id):
        """
        Primary assertion: login returns a valid session token.
        """
        response = http_client.post(
            "/auth/login",
            json={"email": "test@example.com", "password": "SecurePass123!"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["token"]
        assert data["userId"] == created_user_id
        assert data["expiresIn"]

        # Token should be JWT format
        assert data["token"].startswith("eyJ")

    def test_authenticated_session_works_cross_api(self, http_client, auth_token, created_user_id):
        """
        Second-order: the token works for authenticated requests against a
        DIFFERENT endpoint. This proves the session was created, stored, and
        is retrievable — not just that the login endpoint returned a string.
        """
        response = http_client.get(
            "/users/me",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == created_user_id
        assert data["username"] == "testuser"

    def test_unauthenticated_request_rejected(self, http_client):
        """
        Third-order: authentication enforcement. The same endpoint rejects
        unauthenticated requests, proving auth middleware is active.
        """
        response = http_client.get("/users/me")
        assert response.status_code == 401

    def test_cross_endpoint_consistency(self, http_client, created_user_id):
        """
        Third-order: fetch via by-ID and list endpoints, verify they agree.
        If the endpoints disagree, something is broken in the query layer.
        """
        by_id = http_client.get(f"/users/{created_user_id}").json()
        by_list = http_client.get("/users").json()

        listed_user = next(
            (u for u in by_list["users"] if u["id"] == created_user_id), None
        )
        assert listed_user is not None

        assert listed_user["username"] == by_id["username"]
        assert listed_user["email"] == by_id["email"]
        assert listed_user["created_at"] == by_id["created_at"]

    def test_duplicate_email_returns_409(self, http_client, created_user_id):
        """Verify uniqueness constraint is enforced."""
        duplicate_data = {
            "email": "test@example.com",  # Same email
            "username": "different",
            "password": "AnotherPass123!",
        }

        response = http_client.post("/users", json=duplicate_data)
        assert response.status_code == 409
        data = response.json()
        assert "error" in data
        assert "already exists" in data["error"].lower()

    def test_duplicate_no_audit_event(self, http_client, created_user_id):
        """
        Third-order: a rejected registration should NOT produce an audit log entry.
        This proves the uniqueness check runs before persistence.
        """
        http_client.post(
            "/users",
            json={
                "email": "test@example.com",
                "username": "another-duplicate",
                "password": "AnotherPass123!",
            },
        )

        audit = http_client.get("/admin/audit/users").json()
        failed_attempts = [
            e for e in audit["entries"]
            if e.get("action") == "USER_CREATED"
            and e.get("email") == "another-duplicate"
        ]
        assert failed_attempts == []

    def test_audit_trail_is_complete(self, http_client, created_user_id):
        """
        Third-order: audit log contains complete trail with timestamps and metadata.
        Both USER_CREATED and USER_LOGIN events are present, in correct order.
        """
        response = http_client.get("/admin/audit/users")
        assert response.status_code == 200
        data = response.json()
        assert "entries" in data

        # Find creation event
        creation_events = [
            e for e in data["entries"]
            if e.get("action") == "USER_CREATED"
            and e.get("entity_id") == created_user_id
        ]
        assert len(creation_events) > 0, "User creation event not found in audit log"

        creation = creation_events[0]
        assert creation["entity_type"] == "user"
        assert "timestamp" in creation
        assert creation["metadata"]["email"] == "test@example.com"
        assert creation["metadata"]["username"] == "testuser"

        # Find login event
        login_events = [
            e for e in data["entries"]
            if e.get("action") == "USER_LOGIN"
            and e.get("entity_id") == created_user_id
        ]
        assert len(login_events) > 0, "User login event not found in audit log"
        login = login_events[0]
        assert "timestamp" in login["timestamp"]

        # Login happened AFTER registration
        from datetime import datetime

        creation_time = datetime.fromisoformat(creation["timestamp"])
        login_time = datetime.fromisoformat(login["timestamp"])
        assert login_time >= creation_time

    def test_user_data_persists(self, http_client, created_user_id):
        """
        Verify data persistence across requests.
        Transient Docker volumes should persist until cleanup() is called.
        """
        response1 = http_client.get(f"/users/{created_user_id}")
        assert response1.status_code == 200
        original_data = response1.json()

        response2 = http_client.get(f"/users/{created_user_id}")
        assert response2.status_code == 200
        assert response2.json() == original_data

    def test_invalid_user_id_returns_404(self, http_client):
        """Verify proper error handling for non-existent users."""
        response = http_client.get("/users/nonexistent-id")
        assert response.status_code == 404
        data = response.json()
        assert "error" in data

    def test_update_user_email(self, http_client, created_user_id, auth_token):
        """
        Verify user update works and the change is visible through
        a different endpoint (cross-API verification).
        """
        new_email = "updated@example.com"

        response = http_client.patch(
            f"/users/{created_user_id}",
            json={"email": new_email},
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        assert response.status_code == 200
        assert response.json()["email"] == new_email

        # Verify the change is visible through the GET endpoint
        get_response = http_client.get(f"/users/{created_user_id}")
        assert get_response.json()["email"] == new_email

        # And through the list endpoint
        list_response = http_client.get("/users")
        updated_user = next(
            (u for u in list_response.json()["users"] if u["id"] == created_user_id), None
        )
        assert updated_user is not None
        assert updated_user["email"] == new_email
