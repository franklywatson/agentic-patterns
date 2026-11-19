"""Boundary layer: run a shell command in a read-only, no-network, non-root container."""

import os
import secrets
import subprocess
from collections.abc import Callable
from dataclasses import dataclass

IMAGE = "python:3.12-slim"
NOBODY = "65534:65534"


@dataclass(frozen=True)
class RunResult:
    exit_code: int
    stdout: str
    stderr: str


@dataclass(frozen=True)
class FixtureServer:
    network: str
    host: str
    stop: Callable[[], None]


def _unique(prefix: str) -> str:
    return f"{prefix}-{os.getpid()}-{secrets.token_hex(3)}"


def _docker(args: list[str], timeout: float = 60) -> RunResult:
    r = subprocess.run(["docker", *args], capture_output=True, text=True, timeout=timeout, check=False)
    return RunResult(r.returncode, r.stdout, r.stderr)


def run_in_container(
    command: str, project_dir: str, read_only: bool, network: str, timeout: float = 60
) -> RunResult:
    """Run `command` with the project mounted at /work.

    The command is one argv entry, so nothing on the host parses it.
    """
    name = _unique("cp-run")
    mount = f"{project_dir}:/work{':ro' if read_only else ''}"
    try:
        return _docker(
            [
                "run", "--rm", "--name", name,
                "--user", NOBODY,
                "--network", network,
                "--cap-drop", "ALL",
                "--security-opt", "no-new-privileges",
                "-v", mount, "-w", "/work",
                IMAGE, "sh", "-c", command,
            ],
            timeout,
        )
    finally:
        _docker(["rm", "-f", name])


def start_fixture_server() -> FixtureServer:
    """Start an HTTP server on a private Docker network. It replies "containment-ok"."""
    network = _unique("cp-net")
    host = _unique("cp-srv")

    def stop() -> None:
        _docker(["rm", "-f", host])
        _docker(["network", "rm", network])

    created = _docker(["network", "create", network])
    if created.exit_code != 0:
        raise RuntimeError(f"network create failed: {created.stderr}")
    try:
        started = _docker(
            [
                "run", "-d", "--rm", "--name", host, "--network", network, "--user", NOBODY,
                "--cap-drop", "ALL", "--security-opt", "no-new-privileges",
                IMAGE, "sh", "-c",
                "mkdir -p /tmp/srv && echo containment-ok > /tmp/srv/index.html"
                " && exec python3 -m http.server 8000 --directory /tmp/srv",
            ]
        )
        if started.exit_code != 0:
            raise RuntimeError(f"server start failed: {started.stderr}")
        _wait_until_serving(network, host)
    except Exception:
        stop()
        raise
    return FixtureServer(network, host, stop)


def _wait_until_serving(network: str, host: str) -> None:
    probe = f"python3 -c \"import urllib.request as u;u.urlopen('http://{host}:8000/',timeout=2)\""
    for _ in range(30):
        r = _docker(["run", "--rm", "--network", network, IMAGE, "sh", "-c", probe])
        if r.exit_code == 0:
            return
    raise RuntimeError("fixture server did not become ready")
