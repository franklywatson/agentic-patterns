"""Render the reproduction stack test from an incident record and freeze its hash."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from .models import Incident

REPRO_DIR = "tests/repro"


def repro_path(incident: Incident) -> str:
    return f"{REPRO_DIR}/test_{incident.id.lower().replace('-', '_')}_repro.py"


def render_reproduction(incident: Incident) -> str:
    """The test asserts the invariant: the expected status and body.

    Every value from the incident record enters the source as a Python literal produced by
    repr() or json.dumps(); the record is validated by parse_incident before it gets here.
    """
    request, expected = incident.request, incident.expected
    return f'''"""Reproduction for {incident.id} (fingerprint {incident.fingerprint}), journey {incident.journey}.

Generated from the incident record. Frozen before any fix is written.
"""

import os

import httpx


def test_request_answers_as_expected():
    base_url = os.environ["REPRO_BASE_URL"]
    response = httpx.request(
        {request["method"]!r},
        base_url + {request["path"]!r},
        headers={dict(request["headers"])!r},
    )
    assert response.status_code == {int(expected["status"])}
    assert response.json() == {dict(expected["body"])!r}
'''


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def freeze_reproduction(workspace: Path, incident: Incident) -> tuple[str, str]:
    """Write the reproduction into a workspace and record its hash in the lock file."""
    rel = repro_path(incident)
    target = workspace / rel
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(render_reproduction(incident))
    digest = sha256_file(target)
    lock = workspace / ".repair" / f"{incident.id}.lock.json"
    lock.parent.mkdir(parents=True, exist_ok=True)
    lock.write_text(json.dumps({"incidentId": incident.id, "path": rel, "sha256": digest}, indent=2))
    return rel, digest


def read_frozen_hash(workspace: Path, incident: Incident) -> str:
    return json.loads((workspace / ".repair" / f"{incident.id}.lock.json").read_text())["sha256"]
