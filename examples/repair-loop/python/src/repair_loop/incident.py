"""Parse, validate and fingerprint incident records."""

from __future__ import annotations

import hashlib
import json
import re
from typing import Any

from .models import Incident

EMAIL = re.compile(r"[^\s\"'@]+@[^\s\"'@]+\.[^\s\"'@]+")
SECRET_KEYS = re.compile(r"^(password|passwd|token|authorization|cookie|secret)$", re.I)
REQUIRED = ["id", "fingerprint", "journey", "entrypoint", "errorClass", "request", "observed", "expected", "dependencies"]


def fingerprint_of(entrypoint: str, status: int, error_class: str) -> str:
    return hashlib.sha256(f"{entrypoint}|{status}|{error_class}".encode()).hexdigest()[:12]


def _assert_pii_free(value: Any, path: str) -> None:
    if isinstance(value, str) and EMAIL.search(value):
        raise ValueError(f"incident record contains an email address at {path}")
    if isinstance(value, dict):
        for key, child in value.items():
            if SECRET_KEYS.match(key):
                raise ValueError(f"incident record contains a secret field at {path}.{key}")
            _assert_pii_free(child, f"{path}.{key}")


def parse_incident(raw: dict[str, Any]) -> Incident:
    """Validate required fields, a PII-free request and a matching fingerprint."""
    for key in REQUIRED:
        if key not in raw:
            raise ValueError(f'incident record is missing "{key}"')
    _assert_pii_free(raw["request"], "request")
    expected = fingerprint_of(raw["entrypoint"], raw["observed"]["status"], raw["errorClass"])
    if raw["fingerprint"] != expected:
        raise ValueError(f"fingerprint {raw['fingerprint']} does not match the record (expected {expected})")
    return Incident(
        id=raw["id"],
        fingerprint=raw["fingerprint"],
        journey=raw["journey"],
        entrypoint=raw["entrypoint"],
        error_class=raw["errorClass"],
        request=raw["request"],
        observed=raw["observed"],
        expected=raw["expected"],
        dependencies=raw["dependencies"],
        detected_at=raw.get("detectedAt", ""),
    )


def fingerprints_from_log(log_text: str) -> list[str]:
    """Extract fingerprints from structured error lines in application logs."""
    found: list[str] = []
    for line in log_text.splitlines():
        start = line.find("{")
        if start == -1:
            continue
        try:
            entry = json.loads(line[start:])
        except json.JSONDecodeError:
            continue  # not a JSON log line (compose prefix only, or plain text)
        if entry.get("event") == "unhandled_error" and entry.get("route") and entry.get("status") and entry.get("errorClass"):
            found.append(fingerprint_of(entry["route"], entry["status"], entry["errorClass"]))
    return found
