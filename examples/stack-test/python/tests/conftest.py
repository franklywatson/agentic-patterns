"""
Pytest configuration and fixtures for stack tests.

Demonstrates:
- Session-scoped stack initialization
- Dynamic port allocation
- Unique compose project name (isolates containers, network and volumes)
- Aggressive cleanup
"""

import os
import random
import socket
import string
import subprocess
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Generator

import httpx
import pytest

COMPOSE_FILE = Path(__file__).resolve().parent.parent / "docker-compose.test.yml"


@dataclass
class StackConfig:
    """Configuration for a running test stack."""
    project: str
    ports: dict[str, int]
    base_url: str


def _is_port_available(port: int) -> bool:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind(("127.0.0.1", port))
        return True
    except OSError:
        return False


def allocate_ports(count: int, min_port: int = 10000, max_port: int = 65535) -> list[int]:
    """Allocate distinct free ports from the given range."""
    ports: list[int] = []
    for _ in range(count):
        for _attempt in range(100):
            port = random.randint(min_port, max_port)
            if port not in ports and _is_port_available(port):
                ports.append(port)
                break
        else:
            raise RuntimeError(f"Could not allocate {count} free ports")
    return ports


class StackTestManager:
    """Starts and removes one isolated Docker stack."""

    def __init__(self, compose_file: Path):
        self.compose_file = compose_file
        suffix = "".join(random.choices(string.ascii_lowercase + string.digits, k=8))
        self.project = f"stacktest-{os.getpid()}-{suffix}"
        self.env: dict[str, str] = {}

    def _compose(self, *args: str) -> subprocess.CompletedProcess:
        result = subprocess.run(
            ["docker", "compose", "-p", self.project, "-f", str(self.compose_file), *args],
            env={**os.environ, **self.env},
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            raise RuntimeError(
                f"docker compose {' '.join(args)} failed ({result.returncode}):\n"
                f"{result.stdout}\n{result.stderr}"
            )
        return result

    def start_stack(self) -> StackConfig:
        app_port, postgres_port, redis_port = allocate_ports(3)
        self.env = {
            "APP_PORT": str(app_port),
            "POSTGRES_PORT": str(postgres_port),
            "REDIS_PORT": str(redis_port),
        }
        print(f"\nStarting stack {self.project}: app={app_port} "
              f"postgres={postgres_port} redis={redis_port}")
        self._compose("up", "-d", "--build", "--wait")
        return StackConfig(
            project=self.project,
            ports={"app": app_port, "postgres": postgres_port, "redis": redis_port},
            base_url=f"http://localhost:{app_port}",
        )

    def stop_stack(self) -> None:
        """Remove containers, volumes, networks and orphans."""
        print(f"\nCleaning up stack {self.project}")
        self._compose("down", "-v", "--remove-orphans")

    def get_logs(self, service: str) -> str:
        return self._compose("logs", service).stdout


@pytest.fixture(scope="session")
def stack_manager() -> StackTestManager:
    return StackTestManager(COMPOSE_FILE)


@pytest.fixture(scope="session")
def stack_config(stack_manager: StackTestManager) -> Generator[StackConfig, None, None]:
    """Start the stack once per test session; always remove it afterwards."""
    try:
        config = stack_manager.start_stack()
        yield config
    finally:
        stack_manager.stop_stack()


@pytest.fixture(scope="session")
def http_client(stack_config: StackConfig) -> Generator[httpx.Client, None, None]:
    with httpx.Client(base_url=stack_config.base_url, timeout=30.0) as client:
        yield client


@pytest.fixture(scope="session")
def wait_for_ready(http_client: httpx.Client):
    """Return a helper that blocks until GET /health returns 200."""
    def _wait(timeout: float = 120.0, interval: float = 2.0) -> None:
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            try:
                if http_client.get("/health").status_code == 200:
                    return
            except httpx.TransportError:
                pass  # app not accepting connections yet; retried until the deadline
            time.sleep(interval)
        raise RuntimeError(f"Stack not ready after {timeout}s")

    return _wait
