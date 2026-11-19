"""Parse, validate and fingerprint incident records."""

from __future__ import annotations

import hashlib
import json
import re
from typing import Any

from .models import Incident

EMAIL = re.compile(r"[^\s\"'@]+@[^\s\"'@]+\.[^\s\"'@]+")
SECRET_KEYS = re.compile(r"(password|passwd|token|authorization|cookie|secret|api[-_]?key)", re.I)
ID = re.compile(r"INC-[0-9]{1,9}")
METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"]
PATH = re.compile(r"/[A-Za-z0-9._~/%-]*")
SLUG = re.compile(r"[a-z0-9][a-z0-9-]*")
ERROR_CLASS = re.compile(r"[A-Za-z0-9:_.-]+")
ENTRYPOINT = re.compile(r"(GET|POST|PUT|PATCH|DELETE) /[A-Za-z0-9._~/:%-]*")
HEADER_NAME = re.compile(r"[A-Za-z0-9-]+")
HEADER_VALUE = re.compile(r"[\x20-\x7e]*")
REQUIRED = ["id", "fingerprint", "journey", "entrypoint", "errorClass", "request", "observed", "expected", "dependencies"]


def fingerprint_of(entrypoint: str, status: int, error_class: str) -> str:
    return hashlib.sha256(f"{entrypoint}|{status}|{error_class}".encode()).hexdigest()[:12]


def _assert_pii_free(value: Any, path: str) -> None:
    if isinstance(value, str) and EMAIL.search(value):
        raise ValueError(f"incident record contains an email address at {path}")
    if isinstance(value, dict):
        for key, child in value.items():
            if SECRET_KEYS.search(key):
                raise ValueError(f"incident record contains a secret field at {path}.{key}")
            _assert_pii_free(child, f"{path}.{key}")


def _check(ok: bool, message: str) -> None:
    if not ok:
        raise ValueError(f"incident record is invalid: {message}")


def _assert_shape(raw: dict[str, Any]) -> None:
    """Incident records are untrusted input. Every field that reaches generated code or a file path is checked."""
    _check(isinstance(raw["id"], str) and ID.fullmatch(raw["id"]) is not None, "id must match INC-<digits>")
    _check(isinstance(raw["journey"], str) and SLUG.fullmatch(raw["journey"]) is not None, "journey must be a lowercase slug")
    _check(isinstance(raw["entrypoint"], str) and ENTRYPOINT.fullmatch(raw["entrypoint"]) is not None, 'entrypoint must be "<METHOD> /path"')
    _check(isinstance(raw["errorClass"], str) and ERROR_CLASS.fullmatch(raw["errorClass"]) is not None, "errorClass has unexpected characters")
    request = raw["request"]
    _check(request.get("method") in METHODS, "request.method is not allowed")
    paths = [request.get("path"), *raw.get("replayPaths", [])]
    _check(
        all(isinstance(p, str) and PATH.fullmatch(p) is not None and ".." not in p.split("/") for p in paths),
        "request paths must match the path allowlist",
    )
    for name, value in (request.get("headers") or {}).items():
        _check(HEADER_NAME.fullmatch(name) is not None and isinstance(value, str) and HEADER_VALUE.fullmatch(value) is not None,
               f"header {name} has unexpected characters")
    _check(type(raw["observed"].get("status")) is int and type(raw["expected"].get("status")) is int, "statuses must be integers")
    _check(isinstance(raw["expected"].get("body"), dict), "expected.body must be an object")


def parse_incident(raw: dict[str, Any]) -> Incident:
    """Validate required fields, a PII-free request and a matching fingerprint."""
    for key in REQUIRED:
        if key not in raw:
            raise ValueError(f'incident record is missing "{key}"')
    _assert_pii_free(raw["request"], "request")
    _assert_pii_free(raw["observed"], "observed")
    _assert_pii_free(raw["expected"], "expected")
    _assert_shape(raw)
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
        replay_paths=list(raw.get("replayPaths", [raw["request"]["path"]])),
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
