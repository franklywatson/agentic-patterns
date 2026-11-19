"""Unified diff parsing, path safety and glob matching."""

from __future__ import annotations

import posixpath
import re

from .models import DiffFile

HUNK = re.compile(r"^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@")


def _strip(path: str) -> str:
    return re.sub(r"^[^/]+/", "", path.split("\t")[0])


def parse_diff(text: str) -> list[DiffFile]:
    """Parse a unified diff into per-file changes.

    The parser follows hunk line counts, as `patch` does, so a removed line that starts with
    "-- " is not mistaken for a file header. The first path component (a/, b/ or a directory
    name from `diff -r`) is stripped.
    """
    files: list[dict] = []
    current: dict | None = None
    old_path = ""
    old_left = new_left = 0
    first_hunk = False
    for line in text.split("\n"):
        if old_left > 0 or new_left > 0:
            tag = line[:1]
            if tag == "+":
                current["added"].append(line[1:])
                new_left -= 1
            elif tag == "-":
                current["removed"].append(line[1:])
                old_left -= 1
            elif tag == " " or line == "":
                old_left -= 1
                new_left -= 1
            continue
        hunk = HUNK.match(line)
        if hunk and current is not None:
            old_left = int(hunk.group(2) if hunk.group(2) is not None else 1)
            new_left = int(hunk.group(4) if hunk.group(4) is not None else 1)
            if first_hunk:
                if hunk.group(1) == "0" and old_left == 0:
                    current["status"] = "added"
                if hunk.group(3) == "0" and new_left == 0:
                    current["status"] = "deleted"
                first_hunk = False
        elif line.startswith("--- "):
            old_path = line[4:].split("\t")[0]
            current = None
        elif line.startswith("+++ ") and current is None and old_path:
            new_path = line[4:].split("\t")[0]
            path = _strip(old_path if new_path == "/dev/null" else new_path)
            status = "added" if old_path == "/dev/null" else "deleted" if new_path == "/dev/null" else "modified"
            current = {"path": path, "status": status, "added": [], "removed": []}
            files.append(current)
            first_hunk = True
            old_path = ""
        elif line.startswith("Binary files "):
            m = re.match(r"^Binary files (.+) and (.+) differ$", line)
            if m:
                files.append({"path": _strip(m.group(2)), "status": "modified", "added": ["<binary content>"], "removed": []})
    return [DiffFile(**f) for f in files]


def is_unsafe_path(path: str) -> bool:
    """A path the gate refuses: absolute, empty, with a `..` segment, a backslash or a NUL."""
    return path == "" or path.startswith("/") or "\\" in path or "\0" in path or ".." in path.split("/")


def normalize_path(path: str) -> str:
    """Normalize a safe path; an unsafe path is returned unchanged so callers keep it visible."""
    return path if is_unsafe_path(path) else posixpath.normpath(path)


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
