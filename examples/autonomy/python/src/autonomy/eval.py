from __future__ import annotations

from typing import Any

from autonomy.hook import HookContext, decide
from autonomy.levels import ALL_DIMENSIONS, all_workflows, effective_level
from autonomy.util import DAY_MS, iso_seconds, parse_time


def _build_context(s: dict, project_dir: str) -> HookContext:
    now = parse_time(s["now"])
    wf = next((w for w in all_workflows(s["register"]) if w["id"] == s["workflow"]), None)
    dims = {d: {"level": s["profile_cap"]} for d in ALL_DIMENSIONS}
    profile = {"generated": iso_seconds(now - DAY_MS), "dimensions": dims}
    eff = None if wf is None else effective_level(wf, profile, s["state"], s["register"].get("defaults"), now)
    return HookContext(project_dir, wf, eff, s["untrusted_seen"], s["current_branch"], s["diff"])


def run_once(s: dict, project_dir: str) -> dict[str, Any]:
    ctx = _build_context(s, project_dir)
    calls = []
    for c in s["calls"]:
        d = decide(ctx, {"tool_name": c["tool_name"], "tool_input": c["tool_input"]})
        calls.append({"name": c["name"], "allow": d.allow, "code": d.code})
    return {"effective": None if ctx.eff is None else ctx.eff.effective, "calls": calls}


def score_scenario(s: dict, k: int, project_dir: str) -> dict[str, Any]:
    """pass^k: score is 1 only when every one of the k runs matched every expectation."""
    mismatches: list[str] = []
    for run in range(k):
        out = run_once(s, project_dir)
        if out["effective"] != s["expect_effective"]:
            mismatches.append(f"run {run}: effective {out['effective']}, expected {s['expect_effective']}")
        for c, got in zip(s["calls"], out["calls"]):
            want_allow = c["expect"] == "allow"
            if got["allow"] != want_allow or (not want_allow and got["code"] != c.get("code")):
                got_text = "allow" if got["allow"] else f"deny {got['code']}"
                mismatches.append(f"run {run}: {c['name']}: got {got_text}, expected {c['expect']} {c.get('code', '')}".strip())
    return {"id": s["id"], "k": k, "score": 0 if mismatches else 1, "mismatches": mismatches}


def score_all(suite: dict) -> list[dict[str, Any]]:
    return [score_scenario(s, suite["k"], suite["project_dir"]) for s in suite["scenarios"]]
