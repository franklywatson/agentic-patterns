"""
01_app_startup.py

First test in the sequential stack test suite.
Verifies that the complete Docker stack starts successfully.

Demonstrates:
- Stack initialization with dynamic ports
- Health endpoint verification
- Proper cleanup via session-scoped fixtures
"""

import pytest


class TestAppStartup:
    """Verify the application stack starts correctly."""

    @pytest.mark.stack
    def test_health_endpoint_responds(self, http_client, wait_for_ready):
        """Primary assertion: health endpoint returns 200 OK."""
        # Wait for stack to be ready
        wait_for_ready()

        # Check health endpoint
        response = http_client.get("/health")

        # No escape hatches — assertions must run unconditionally
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

        data = response.json()
        assert data["status"] == "ok"
        assert "timestamp" in data

    @pytest.mark.stack
    def test_database_is_connected(self, http_client, wait_for_ready):
        """Second-order assertion: database connectivity via health API."""
        wait_for_ready()

        response = http_client.get("/health/db")

        assert response.status_code == 200

        data = response.json()
        assert data["database"] == "connected"
        assert "postgres" in data
        assert "version" in data["postgres"]

    @pytest.mark.stack
    def test_redis_is_connected(self, http_client, wait_for_ready):
        """Second-order assertion: cache connectivity via health API."""
        wait_for_ready()

        response = http_client.get("/health/cache")

        assert response.status_code == 200

        data = response.json()
        assert data["cache"] == "connected"
        assert "redis" in data
        assert "version" in data["redis"]

    @pytest.mark.stack
    def test_all_services_healthy(self, http_client, wait_for_ready):
        """Third-order assertion: comprehensive health check."""
        wait_for_ready()

        response = http_client.get("/health")

        assert response.status_code == 200

        data = response.json()
        # All services should be reported
        assert "services" in data
        services = data["services"]
        assert services["app"] == "healthy"
        assert services["database"] == "healthy"
        assert services["cache"] == "healthy"

    @pytest.mark.stack
    def test_health_test_mode_reports_service_diagnostics(self, http_client, wait_for_ready):
        """Pattern 1.1: /health?mode=test decorates the response with per-service detail."""
        wait_for_ready()

        response = http_client.get("/health", params={"mode": "test"})

        assert response.status_code == 200

        details = response.json()["services"]
        assert details["postgres"]["connected"] is True
        assert details["postgres"]["latency_ms"] >= 0
        assert details["postgres"]["version"]
        assert details["redis"]["connected"] is True
        assert details["redis"]["latency_ms"] >= 0
        assert details["redis"]["version"]
