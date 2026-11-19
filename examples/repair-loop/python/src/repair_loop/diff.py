"""Unified diff parsing and glob matching."""

from __future__ import annotations

import re

from .models import DiffFile


def parse_diff(text: str) -> list[DiffFile]:
    """Parse a unified diff (from `diff -u` or `git diff`) into per-file changes."""
    files: list[dict] = []
    current: dict | None = None
    old_path = ""
    for line in text.split("\n"):
        if line.startswith("--- "):
            old_path = line[4:].split("\t")[0]
            current = None
        elif line.startswith("+++ ") and current is None:
            new_path = line[4:].split("\t")[0]
            path = re.sub(r"^[ab]/", "", old_path if new_path == "/dev/null" else new_path)
            status = "added" if old_path == "/dev/null" else "deleted" if new_path == "/dev/null" else "modified"
            current = {"path": path, "status": status, "added": [], "removed": []}
            files.append(current)
        elif current is not None and line.startswith("+"):
            current["added"].append(line[1:])
        elif current is not None and line.startswith("-"):
            current["removed"].append(line[1:])
    return [DiffFile(**f) for f in files]


def glob_match(glob: str, path: str) -> bool:
    """Match a path against a glob. `**` crosses directories, `*` does not."""
    source = ""
    i = 0
    while i < len(glob):
        c = glob[i]
        if c == "*" and glob[i + 1 : i + 2] == "*":
            source += ".*"
            i += 1
            if glob[i + 1 : i + 2] == "/":
                i += 1
        elif c == "*":
            source += "[^/]*"
        else:
            source += re.escape(c)
        i += 1
    return re.fullmatch(source, path) is not None
