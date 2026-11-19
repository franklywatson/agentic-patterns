from __future__ import annotations

import json
import math
import os
import re
import subprocess
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

DAY_MS = 86_400_000
EPOCH = datetime(1970, 1, 1, tzinfo=timezone.utc)

# src/autonomy/util.py -> autonomy -> src -> python -> examples/autonomy
AUTONOMY_ROOT = Path(__file__).resolve().parents[3]
SCHEMA_PATH = AUTONOMY_ROOT / "schema" / "autonomy.schema.json"


# ISO 8601 as this tooling writes it: a date, or a date and time with `Z` or an offset.
ISO_TIME = re.compile(r"\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:\d{2}))?")


def parse_time(value: str) -> int:
    """Parse an ISO date or time to epoch milliseconds; raise ValueError on anything else, including 2027-02-31."""
    if not isinstance(value, str) or not ISO_TIME.fullmatch(value):
        raise ValueError(f"invalid date: {value}")
    text = f"{value}T00:00:00+00:00" if len(value) == 10 else value.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError as err:
        raise ValueError(f"invalid date: {value}") from err
    return (parsed - EPOCH) // timedelta(milliseconds=1)


def try_parse_time(value: Any) -> int | None:
    """Parse a time, or return None when it is not an ISO date or time."""
    try:
        return parse_time(value)
    except ValueError:
        return None


def now_ms(arg: str | None = None) -> int:
    value = arg or os.environ.get("AUTONOMY_NOW")
    return parse_time(value) if value else int(time.time() * 1000)


def iso_seconds(ms: int) -> str:
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def iso_date(ms: int) -> str:
    return iso_seconds(ms)[:10]


def age_days(now: int, then: int) -> int:
    return (now - then) // DAY_MS


def round4(value: float) -> float:
    return math.floor(value * 10000 + 0.5) / 10000


def read_json(path: str | Path) -> Any:
    return json.loads(Path(path).read_text())


def read_json_if_exists(path: str | Path) -> Any | None:
    return read_json(path) if Path(path).exists() else None


def inside_dir(directory: str | Path, rel: str) -> bool:
    root = Path(directory).resolve()
    target = (root / rel).resolve()
    return target == root or root in target.parents


# A glob wildcard never matches a line terminator, in either language.
_ANY = "[^\n\r\u2028\u2029]"
_SEGMENT = "[^/\n\r\u2028\u2029]"


def glob_to_regex(glob: str, any_slash: bool) -> re.Pattern[str]:
    """Translate a glob to a regex. `*` stays inside one path segment unless `any_slash`."""
    out = ""
    i = 0
    while i < len(glob):
        ch = glob[i]
        if ch == "*":
            if i + 1 < len(glob) and glob[i + 1] == "*":
                out += _ANY + "*"
                i += 1
            else:
                out += _ANY + "*" if any_slash else _SEGMENT + "*"
        elif ch == "?":
            out += _ANY if any_slash else _SEGMENT
        else:
            out += re.escape(ch)
        i += 1
    return re.compile(f"^{out}\\Z")


def match_path(glob: str, path: str) -> bool:
    return glob_to_regex(glob, False).search(path) is not None


def match_command(glob: str, command: str) -> bool:
    return glob_to_regex(glob, True).search(command) is not None


def git(cwd: str | Path, args: list[str]) -> str | None:
    result = subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True)
    return result.stdout if result.returncode == 0 else None


def list_files(directory: str | Path) -> list[str]:
    tracked = git(directory, ["ls-files"])
    if tracked is not None:
        return sorted(line for line in tracked.split("\n") if line)
    root = Path(directory)
    found: list[str] = []
    for current, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d not in (".git", "node_modules")]
        for name in files:
            found.append((Path(current) / name).relative_to(root).as_posix())
    return sorted(found)


def last_changed(directory: str | Path, path: str) -> int | None:
    out = git(directory, ["log", "-1", "--format=%cI", "--", path])
    text = (out or "").strip()
    return parse_time(text) if text else None


def deletions_since(directory: str | Path, path: str, since_ms: int) -> int:
    since = datetime.fromtimestamp(since_ms / 1000, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    out = git(directory, ["log", f"--since={since}", "--diff-filter=D", "--name-only", "--format=", "--", path])
    return len([line for line in (out or "").split("\n") if line])
