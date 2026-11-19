"""Pattern 1.6 forbidden patterns, applied to production diffs.

A change that makes the failure disappear without removing its cause is a mitigation, not a fix.
"""

from __future__ import annotations

import re
from dataclasses import replace

from .diff import is_unsafe_path, normalize_path
from .models import AntimaskHit, DiffFile

CATCH = re.compile(r"^\s*except\b|\.catch\s*\(|\bcatch\b")
RERAISE = re.compile(r"\braise\b|\bthrow\b")
RETRY = re.compile(r"\b(retry|retries|backoff)\b", re.I)
NUMERIC_SETTING = re.compile(
    r"\b(\w*(?:timeout|ttl|deadline|threshold|min_\w*|required\w*)\w*)\s*[:=]\s*(\d+(?:\.\d+)?)", re.I
)
WIDENING_KEY = re.compile(r"timeout|ttl|deadline", re.I)
LOWERING_KEY = re.compile(r"threshold|^min|required", re.I)
CATCH_WINDOW = 6


def _numeric_settings(lines: list[str]) -> dict[str, float]:
    out: dict[str, float] = {}
    for line in lines:
        m = NUMERIC_SETTING.search(line)
        if m:
            out[m.group(1).lower()] = float(m.group(2))
    return out


def scan_production_diff(files: list[DiffFile]) -> list[AntimaskHit]:
    """Scan the added lines of non-test files. An empty result means clean."""
    hits: list[AntimaskHit] = []
    for diff_file in files:
        file = replace(diff_file, path=normalize_path(diff_file.path))
        if (not is_unsafe_path(file.path) and file.path.startswith("tests/")) or file.status == "deleted":
            continue
        for index, line in enumerate(file.added):
            if CATCH.search(line):
                following = "\n".join(file.added[index : index + CATCH_WINDOW])
                if not RERAISE.search(following):
                    hits.append(AntimaskHit("swallowed-exception", file.path, line.strip()))
            if RETRY.search(line):
                hits.append(AntimaskHit("new-retry", file.path, line.strip()))
        before = _numeric_settings(file.removed)
        for key, value in _numeric_settings(file.added).items():
            previous = before.get(key)
            if previous is None:
                continue
            if WIDENING_KEY.search(key) and value > previous:
                hits.append(AntimaskHit("widened-timeout", file.path, f"{key}: {previous:g} -> {value:g}"))
            if LOWERING_KEY.search(key) and value < previous:
                hits.append(AntimaskHit("lowered-threshold", file.path, f"{key}: {previous:g} -> {value:g}"))
    return hits
