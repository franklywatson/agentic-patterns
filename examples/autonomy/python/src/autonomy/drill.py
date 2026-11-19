from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from typing import Any, Callable

from autonomy.ledger import apply_demotion
from autonomy.util import iso_date, iso_seconds

CANARY = """
import os, sys, time
hb = os.environ["AUTONOMY_HEARTBEAT"]
stop = os.environ["AUTONOMY_STOP_FILE"]
n = 0
while True:
    if os.path.exists(stop):
        sys.exit(0)
    n += 1
    with open(hb, "w") as f:
        f.write(str(n))
    time.sleep(0.05)
"""

_DATE_FIELD = re.compile(r"(last_tested:\s*)(\d{4}-\d{2}-\d{2})")


def set_last_tested(text: str, workflow_id: str, date: str) -> str:
    """Set `last_tested` for one workflow by editing the register text in place."""
    lines = text.split("\n")
    id_line = re.compile(rf"""^\s*-\s+id:\s*["']?{re.escape(workflow_id)}["']?\s*$""")
    start = next((i for i, line in enumerate(lines) if id_line.search(line)), -1)
    if start < 0:
        raise ValueError(f"workflow {workflow_id} not found in register text")
    end = len(lines)
    for i in range(start + 1, len(lines)):
        if re.search(r"^\s*-\s+id:", lines[i]):
            end = i
            break
    for i in range(start, end):
        if _DATE_FIELD.search(lines[i]):
            lines[i] = _DATE_FIELD.sub(lambda m: f"{m.group(1)}{date}", lines[i], count=1)
            return "\n".join(lines)
    for i in range(start, end):
        m = re.match(r"^(\s*)stop:\s*$", lines[i])
        if m:
            lines.insert(i + 1, f"{m.group(1)}  last_tested: {date}")
            return "\n".join(lines)
    raise ValueError(f"workflow {workflow_id} has no block-style stop mapping to update")


def _wait_for(test: Callable[[], bool], timeout_s: float) -> bool:
    start = time.monotonic()
    while time.monotonic() - start < timeout_s:
        if test():
            return True
        time.sleep(0.02)
    return test()


def _read_beat(path: Path) -> str:
    return path.read_text() if path.exists() else ""


def run_drill(directory: str | Path, register_path: str | Path, workflow: dict, bound_ms: int, now: int) -> dict[str, Any]:
    work = Path(tempfile.mkdtemp(prefix="autonomy-drill-"))
    heartbeat, stop_file = work / "heartbeat", work / "stop"
    env = {**os.environ, "AUTONOMY_HEARTBEAT": str(heartbeat), "AUTONOMY_STOP_FILE": str(stop_file)}
    canary = subprocess.Popen([sys.executable, "-c", CANARY], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    def result(passed: bool, reason: str | None, ms: int | None) -> dict[str, Any]:
        return {"workflow": workflow["id"], "passed": passed, "reason": reason, "halted_in_ms": ms, "bound_ms": bound_ms}

    try:
        beating = _wait_for(lambda: int(_read_beat(heartbeat) or 0) >= 2, 5.0)
        if not beating:
            outcome = result(False, "canary-never-started", None)
        elif not (workflow.get("stop") or {}).get("command"):
            outcome = result(False, "no-stop-command", None)
        else:
            try:
                stop = subprocess.run(
                    ["sh", "-c", workflow["stop"]["command"]],
                    env={**env, "AUTONOMY_CANARY_PID": str(canary.pid)},
                    timeout=10,
                    capture_output=True,
                )
                stop_ok = stop.returncode == 0
            except subprocess.TimeoutExpired:
                stop_ok = False
            started = time.monotonic()
            if not stop_ok:
                outcome = result(False, "stop-command-failed", None)
            else:
                halted = _wait_for(lambda: canary.poll() is not None, bound_ms / 1000)
                took = int((time.monotonic() - started) * 1000)
                if not halted:
                    outcome = result(False, "canary-still-running", None)
                else:
                    before = _read_beat(heartbeat)
                    time.sleep(0.3)
                    outcome = result(True, None, took) if _read_beat(heartbeat) == before else result(False, "heartbeat-continued", took)
    finally:
        if canary.poll() is None:
            canary.kill()
        canary.wait()
        shutil.rmtree(work, ignore_errors=True)
    root = Path(directory)
    (root / ".autonomy").mkdir(parents=True, exist_ok=True)
    with open(root / ".autonomy" / "drills.jsonl", "a") as log:
        log.write(json.dumps({"ts": iso_seconds(now), "workflow": workflow["id"], "passed": outcome["passed"], "reason": outcome["reason"]}, separators=(",", ":")) + "\n")
    if outcome["passed"]:
        path = Path(register_path)
        path.write_text(set_last_tested(path.read_text(), workflow["id"], iso_date(now)))
    else:
        apply_demotion(root, workflow["id"], 3, [f"stop-drill-failed:{outcome['reason']}"], now)
    return outcome
