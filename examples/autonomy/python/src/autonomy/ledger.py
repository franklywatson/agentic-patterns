from __future__ import annotations

import json
import math
from collections import defaultdict
from pathlib import Path
from typing import Any

from autonomy.levels import cap_of
from autonomy.util import DAY_MS, age_days, iso_date, iso_seconds, parse_time, read_json_if_exists, round4

Z = 1.96
PROMOTE_REVERT_UPPER = 0.03
DEMOTE_REVERT_UPPER = 0.06
TASK_BANK_FLOOR = 0.8
COOLDOWN_DAYS = 30


def wilson(k: int, n: int, z: float = Z) -> tuple[float, float]:
    """Wilson score interval as (lower, upper)."""
    if n == 0:
        return (0.0, 1.0)
    p = k / n
    denom = 1 + (z * z) / n
    center = (p + (z * z) / (2 * n)) / denom
    half = (z * math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom
    return (max(0.0, center - half), min(1.0, center + half))


def read_ledger(directory: str | Path, workflow: str) -> list[dict]:
    path = Path(directory) / ".autonomy" / "ledger" / f"{workflow}.jsonl"
    if not path.exists():
        raise FileNotFoundError(f"no ledger at {path}")
    return [json.loads(line) for line in path.read_text().split("\n") if line]


def _ratio(k: int, n: int) -> float:
    return 0 if n == 0 else round4(k / n)


def _criterion(id_: str, required: str, actual: Any, passed: bool | None) -> dict:
    return {"id": id_, "required": required, "actual": actual, "pass": passed}


def build_report(wf: dict, runs_all: list[dict], profile: dict | None, state: dict | None, defaults: dict | None, now: int) -> dict:
    granted = wf["granted_level"]
    target = None if granted >= 5 else granted + 1
    window = (defaults or {}).get("evidence_window") or {}
    window_days = max(window.get("max_days", 60), 90 if target == 5 else 0)
    min_runs = window.get("min_runs", 30)
    in_window = [r for r in runs_all if age_days(now, parse_time(r["ts"])) <= window_days]
    at_level = [r for r in in_window if r["level"] == granted]
    first_pass = len([r for r in at_level if r.get("first_run_pass") is True])
    fp_lower, _ = wilson(first_pass, len(at_level))
    trail = [r for r in in_window if r["level"] >= 3]
    merged = [r for r in trail if r.get("outcome") == "merged"]
    reverted = len([r for r in merged if r.get("reverted_at") is not None])
    _, rv_upper = wilson(reverted, len(merged))
    escaped = len([r for r in trail if r.get("escaped_defect") is True])
    latest = max(in_window, key=lambda r: r["ts"], default=None)
    bank_score = ((latest or {}).get("checks") or {}).get("context-eval")
    merged_at_level = [r for r in at_level if r.get("outcome") == "merged"]
    cost = sum(r.get("cost_usd") or 0 for r in at_level)
    cost_per = None if not merged_at_level else round4(cost / len(merged_at_level))
    cap = cap_of(profile, now)
    entry = ((state or {}).get("workflows") or {}).get(wf["id"]) or {}
    demoted_at = entry.get("demoted_at")
    cooldown_ok = demoted_at is None or age_days(now, parse_time(demoted_at)) >= COOLDOWN_DAYS
    tested = (wf.get("stop") or {}).get("last_tested")
    stop_age = None if tested is None else age_days(now, parse_time(tested))
    times = [parse_time(r["ts"]) for r in at_level]
    span = 0 if not times else (max(times) - min(times)) // DAY_MS
    risk = wf.get("risk") or {}

    criteria: list[dict] = []
    manual: list[str] = []
    if target == 3:
        criteria.append(_criterion("runs-at-level", ">= 20", len(at_level), len(at_level) >= 20))
        criteria.append(_criterion("first-run-pass-lower", ">= 0.80", round4(fp_lower), fp_lower >= 0.8))
        criteria.append(_criterion("owner-named", "present", wf.get("owner"), bool(wf.get("owner"))))
        manual.append("traced sample of 10 runs shows substantive human review")
    elif target == 4:
        criteria.append(_criterion("runs-at-level", ">= 30", len(at_level), len(at_level) >= 30))
        criteria.append(_criterion("first-run-pass-lower", ">= 0.90", round4(fp_lower), fp_lower >= 0.9))
        criteria.append(_criterion("revert-upper", "<= 0.03", round4(rv_upper), rv_upper <= PROMOTE_REVERT_UPPER))
        criteria.append(_criterion("escaped-defects", "0", escaped, escaped == 0))
        criteria.append(_criterion("task-bank-score", ">= 0.90", bank_score, bank_score is not None and bank_score >= 0.9))
        criteria.append(_criterion("reversible", "true", risk.get("reversible"), risk.get("reversible") is True))
        criteria.append(_criterion("mechanical", "mechanical", risk.get("verification"), risk.get("verification") == "mechanical"))
        criteria.append(_criterion("stop-drill-age-days", "<= 30", stop_age, stop_age is not None and stop_age <= 30))
        criteria.append(_criterion("cap", ">= 4", cap, cap >= 4))
        criteria.append(_criterion("cooldown", ">= 30 days since demotion", demoted_at, cooldown_ok))
    elif target == 5:
        criteria.append(_criterion("days-at-level", ">= 90", span, span >= 90))
        criteria.append(_criterion("baseline", "present", wf.get("baseline"), bool(wf.get("baseline"))))
        criteria.append(_criterion("target", "present", wf.get("target"), bool(wf.get("target"))))
        criteria.append(_criterion("stop-rule", "present", wf.get("stop_rule"), bool(wf.get("stop_rule"))))
        criteria.append(_criterion("cost-per-merged-change", "reported", cost_per, cost_per is not None))
        criteria.append(_criterion("cap", ">= 5", cap, cap >= 5))
        criteria.append(_criterion("cooldown", ">= 30 days since demotion", demoted_at, cooldown_ok))
        manual.append("one review cycle completed with a recorded decision")

    reasons: list[str] = []
    to = 5

    def lower(level: int, reason: str) -> None:
        nonlocal to
        to = min(to, level)
        reasons.append(reason)

    if granted >= 3:
        if escaped > 0:
            lower(2, "escaped-defect")
        if reverted > 0 and len(merged) >= min_runs and rv_upper > DEMOTE_REVERT_UPPER:
            lower(3, "revert-upper-above-hysteresis")
        if bank_score is not None and bank_score < TASK_BANK_FLOOR:
            lower(3, "task-bank-below-floor")
        lim = wf.get("limits") or {}
        if "max_diff_lines" in lim and any(r["diff_lines"] > lim["max_diff_lines"] for r in trail):
            lower(3, "diff-limit-breached")
        if "max_cost_usd_per_run" in lim and any(r["cost_usd"] > lim["max_cost_usd_per_run"] for r in trail):
            lower(3, "cost-limit-breached")
        if "max_runs_per_day" in lim:
            per_day: dict[str, int] = defaultdict(int)
            for r in trail:
                per_day[r["ts"][:10]] += 1
            if any(n > lim["max_runs_per_day"] for n in per_day.values()):
                lower(3, "run-limit-breached")
    triggered = len(reasons) > 0 and to < granted
    band = "hold"
    if triggered:
        band = "demote"
    elif len(merged) > 0 and rv_upper <= PROMOTE_REVERT_UPPER:
        band = "promote"
    auto_pass = all(c["pass"] is True for c in criteria)
    return {
        "workflow": wf["id"],
        "now": iso_seconds(now),
        "granted_level": granted,
        "target_level": target,
        "window": {"days": window_days, "runs": len(in_window)},
        "first_run_pass": {"k": first_pass, "n": len(at_level), "rate": _ratio(first_pass, len(at_level)), "lower": round4(fp_lower)},
        "revert": {"k": reverted, "n": len(merged), "rate": _ratio(reverted, len(merged)), "upper": round4(rv_upper)},
        "escaped_defects": escaped,
        "task_bank_score": bank_score,
        "cost_per_merged_outcome": cost_per,
        "band": band,
        "criteria": criteria,
        "promotion_ready": None if target is None else (auto_pass and not triggered),
        "manual_items": manual,
        "demotion": {"triggered": triggered, "to_level": to if triggered else None, "reasons": reasons if triggered else []},
    }


def _fmt(value: Any) -> str:
    if value is None:
        return "null"
    if value is True:
        return "true"
    if value is False:
        return "false"
    if isinstance(value, float) and value == int(value):
        return str(int(value))
    return str(value)


def format_report(r: dict) -> str:
    fp, rv = r["first_run_pass"], r["revert"]
    lines = [
        f"Evidence report: {r['workflow']}",
        f"Date: {r['now']}",
        f"Granted level: {r['granted_level']}; target: {_fmt(r['target_level']) if r['target_level'] is not None else 'none (top level)'}",
        f"Window: {r['window']['days']} days, {r['window']['runs']} runs ({fp['n']} at the granted level)",
        f"First-run pass: {fp['k']}/{fp['n']} = {_fmt(fp['rate'])}, Wilson lower bound {_fmt(fp['lower'])}",
        f"Reverts: {rv['k']}/{rv['n']} merged = {_fmt(rv['rate'])}, Wilson upper bound {_fmt(rv['upper'])}",
        f"Escaped defects: {r['escaped_defects']}",
        f"Band: {r['band']} (promote at revert upper <= {PROMOTE_REVERT_UPPER}, demote above {DEMOTE_REVERT_UPPER})",
        "",
        "| Criterion | Required | Actual | Result |",
        "|---|---|---|---|",
        *[f"| {c['id']} | {c['required']} | {_fmt(c['actual'])} | {'pass' if c['pass'] else 'FAIL'} |" for c in r["criteria"]],
        "",
    ]
    for item in r["manual_items"]:
        lines.append(f"Needs a human: {item}")
    if r["promotion_ready"] is not None:
        lines.append(f"Automated criteria: {'all met' if r['promotion_ready'] else 'not met'}")
    d = r["demotion"]
    lines.append(f"Demotion: to level {d['to_level']} ({', '.join(d['reasons'])})" if d["triggered"] else "Demotion: not triggered")
    return "\n".join(lines)


def apply_demotion(directory: str | Path, workflow: str, to: int, reasons: list[str], now: int) -> None:
    """Write a demotion override. Only ever lowers the stored override."""
    root = Path(directory) / ".autonomy"
    path = root / "state.json"
    state = read_json_if_exists(path) or {"workflows": {}}
    state.setdefault("workflows", {})
    entry = state["workflows"].get(workflow) or {}
    entry["demotion_override"] = min(to, entry.get("demotion_override", 5))
    entry["demoted_at"] = iso_date(now)
    entry["reasons"] = reasons
    state["workflows"][workflow] = entry
    root.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(state, indent=2) + "\n")
