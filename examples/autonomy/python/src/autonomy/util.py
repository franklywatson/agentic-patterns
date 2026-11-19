from __future__ import annotations

import json
import math
import os
import re
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

DAY_MS = 86_400_000

# src/autonomy/util.py -> autonomy -> src -> python -> examples/autonomy
AUTONOMY_ROOT = Path(__file__).resolve().parents[3]
SCHEMA_PATH = AUTONOMY_ROOT / "schema" / "autonomy.schema.json"


def parse_time(value: str) -> int:
    text = f"{value}T00:00:00+00:00" if re.fullmatch(r"\d{4}-\d{2}-\d{2}", value) else value
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError as err:
        raise ValueError(f"invalid date: {value}") from err
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return int(parsed.timestamp() * 1000)


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


def glob_to_regex(glob: str, any_slash: bool) -> re.Pattern[str]:
    out = ""
    i = 0
    while i < len(glob):
        ch = glob[i]
        if ch == "*":
            if i + 1 < len(glob) and glob[i + 1] == "*":
                out += ".*"
                i += 1
            else:
                out += ".*" if any_slash else "[^/]*"
        elif ch == "?":
            out += "." if any_slash else "[^/]"
        else:
            out += re.escape(ch)
        i += 1
    return re.compile(f"^{out}$", re.DOTALL)


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
