"""Real adapters for the repair loop: Docker stacks, pytest subprocesses, GNU patch,
and a JSON-lines outbox and register."""

from __future__ import annotations

import dataclasses
import json
import os
import secrets
import shutil
import socket
import subprocess
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path

import httpx

from .incident import fingerprints_from_log
from .loop import Deployment, Handle, OutboxEntry
from .models import Incident
from .reproduce import freeze_reproduction, read_frozen_hash, repro_path, sha256_file

ROOT = Path(__file__).resolve().parents[2]
WORKSPACES = ROOT / ".workspaces"


def free_ports(count: int) -> list[int]:
    """Ask the OS for free ports on 127.0.0.1. Sockets stay open until every port is chosen."""
    sockets = []
    try:
        for _ in range(count):
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.bind(("127.0.0.1", 0))
            sockets.append(s)
        return [s.getsockname()[1] for s in sockets]
    finally:
        for s in sockets:
            s.close()


def _run(args: list[str], cwd: Path | None = None, env: dict[str, str] | None = None) -> tuple[int, str]:
    result = subprocess.run(args, cwd=cwd, env=env, capture_output=True, text=True)
    return result.returncode, result.stdout + result.stderr


def new_workspace(label: str) -> Handle:
    WORKSPACES.mkdir(parents=True, exist_ok=True)
    directory = WORKSPACES / f"{label}-{os.getpid()}-{secrets.token_hex(3)}"
    directory.mkdir()
    ignore = shutil.ignore_patterns("__pycache__", "*.pyc", ".venv")
    shutil.copytree(ROOT / "app", directory / "app", ignore=ignore)
    shutil.copytree(ROOT / "tests" / "regression", directory / "tests" / "regression", ignore=ignore)
    shutil.copy(ROOT / "docker-compose.yml", directory / "docker-compose.yml")
    (directory / ".repair").mkdir()
    return Handle(str(directory))


def remove_workspaces(base: Handle) -> None:
    """Remove a base workspace and the candidate workspace derived from it."""
    shutil.rmtree(base.dir, ignore_errors=True)
    shutil.rmtree(f"{base.dir}-candidate", ignore_errors=True)


def apply_patch(handle: Handle, patch_file: str) -> str:
    code, output = _run(["patch", "-p1", "--no-backup-if-mismatch", "-s", "-i", patch_file], cwd=Path(handle.dir))
    if code != 0:
        raise RuntimeError(f"patch {patch_file} failed:\n{output}")
    return Path(patch_file).read_text()


class StackDeployment:
    def __init__(self, project: str, compose_file: Path, env: dict[str, str], base_url: str):
        self.project = project
        self.compose_file = compose_file
        self.env = env
        self.base_url = base_url

    def _compose(self, *args: str) -> tuple[int, str]:
        return _run(["docker", "compose", "-p", self.project, "-f", str(self.compose_file), *args], env=self.env)

    def logs(self) -> str:
        return self._compose("logs", "--no-color", "app")[1]

    def stop(self) -> None:
        code, output = self._compose("down", "-v", "--remove-orphans", "--rmi", "local")
        if code != 0:
            raise RuntimeError(f"compose down failed for {self.project}:\n{output}")


def deploy_stack(handle: Handle) -> StackDeployment:
    app, postgres, redis = free_ports(3)
    project = f"repair-{os.getpid()}-{secrets.token_hex(3)}"
    env = {**os.environ, "APP_PORT": str(app), "POSTGRES_PORT": str(postgres), "REDIS_PORT": str(redis)}
    deployment = StackDeployment(project, Path(handle.dir) / "docker-compose.yml", env, f"http://127.0.0.1:{app}")
    code, output = deployment._compose("up", "-d", "--build", "--wait", "--wait-timeout", "180")
    if code != 0:
        logs = deployment._compose("logs", "--no-color")[1]
        deployment._compose("down", "-v", "--remove-orphans", "--rmi", "local")
        raise RuntimeError(f"stack {project} failed to start:\n{output}\n{logs}")
    return deployment


def run_pytest(handle: Handle, target: str, base_url: str) -> tuple[bool, str]:
    env = {k: v for k, v in os.environ.items() if k != "PYTEST_CURRENT_TEST"}
    env.update({"REPRO_BASE_URL": base_url, "REGRESSION_BASE_URL": base_url})
    code, output = _run(
        [sys.executable, "-m", "pytest", "-c", str(ROOT / "pytest.sub.ini"), "--rootdir", handle.dir, target],
        cwd=Path(handle.dir),
        env=env,
    )
    return code == 0, output


def _append(handle: Handle, name: str, entry: dict) -> None:
    with (Path(handle.dir) / ".repair" / name).open("a") as f:
        f.write(json.dumps(entry) + "\n")


def read_json_lines(handle: Handle, name: str) -> list[dict]:
    path = Path(handle.dir) / ".repair" / name
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text().splitlines() if line]


@dataclass
class TestRun:
    __test__ = False  # not a pytest test class

    kind: str
    workspace: str
    passed: bool
    output: str


@dataclass
class DockerEnvironment:
    runs: list[TestRun] = field(default_factory=list)

    def now(self) -> float:
        return time.time()

    def freeze(self, incident: Incident) -> Handle:
        handle = new_workspace(f"base-{incident.id}")
        freeze_reproduction(Path(handle.dir), incident)
        return handle

    def candidate(self, base: Handle, patch_file: str) -> tuple[Handle, str]:
        directory = f"{base.dir}-candidate"
        shutil.copytree(base.dir, directory)
        handle = Handle(directory)
        return handle, apply_patch(handle, patch_file)

    def deploy(self, handle: Handle) -> Deployment:
        return deploy_stack(handle)

    def run_reproduction(self, handle: Handle, deployment: Deployment) -> bool:
        passed, output = run_pytest(handle, "tests/repro", deployment.base_url)
        self.runs.append(TestRun("reproduction", handle.dir, passed, output))
        return passed

    def run_regression(self, handle: Handle, deployment: Deployment) -> bool:
        passed, output = run_pytest(handle, "tests/regression", deployment.base_url)
        self.runs.append(TestRun("regression", handle.dir, passed, output))
        return passed

    def frozen_hash(self, handle: Handle, incident: Incident) -> str:
        return read_frozen_hash(Path(handle.dir), incident)

    def current_hash(self, handle: Handle, incident: Incident) -> str:
        return sha256_file(Path(handle.dir) / repro_path(incident))

    def traffic(self, deployment: Deployment, incident: Incident, samples: int) -> tuple[int, int]:
        with httpx.Client(base_url=deployment.base_url, timeout=30.0) as client:
            for _ in range(samples):
                client.request(incident.request["method"], incident.request["path"], headers=incident.request["headers"])
        count = sum(1 for f in fingerprints_from_log(deployment.logs()) if f == incident.fingerprint)
        return samples, count

    def emit(self, handle: Handle, entry: OutboxEntry) -> None:
        _append(handle, "outbox.jsonl", dataclasses.asdict(entry))

    def record(self, handle: Handle, event: str, state: str, detail: str) -> None:
        _append(handle, "register.jsonl", {
            "workflow": "repair-loop",
            "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "event": event, "state": state, "detail": detail,
        })
