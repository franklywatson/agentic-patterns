from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from autonomy.util import age_days, parse_time, try_parse_time

CAPPING_DIMENSIONS = ("platform", "governance", "ownership", "measuring")
ALL_DIMENSIONS = (
    "platform",
    "shared_context",
    "operating_model",
    "governance",
    "ownership",
    "skill",
    "measuring",
)
PROFILE_MAX_AGE_DAYS = 30
FRESHNESS_LEVEL = 2
HARNESS_LEVEL = 3


@dataclass
class Effective:
    id: str
    granted: int
    cap: int
    freshness: int
    harness: int
    override: int
    effective: int
    reasons: list[str] = field(default_factory=list)


def _as_dict(value: Any) -> dict:
    return value if isinstance(value, dict) else {}


def dimension_level(profile: Any, dimension: str) -> int:
    """Level of one capping dimension: an absent, unknown or invalid entry counts as 1."""
    entry = _as_dict(_as_dict(profile).get("dimensions")).get(dimension)
    if not isinstance(entry, dict):
        return 1
    level = entry.get("level")
    return level if isinstance(level, int) and not isinstance(level, bool) and 1 <= level <= 5 else 1


def _is_missing(profile: Any, now: int) -> bool:
    """A profile is missing when there is none, it is not an object, or its `generated` time is absent, not an
    ISO date or time, or later than `now`."""
    if not isinstance(profile, dict):
        return True
    generated = try_parse_time(profile.get("generated"))
    return generated is None or generated > now


def cap_of(profile: Any, now: int) -> int:
    """Lowest capping dimension; a missing profile caps at 1, because nothing has been measured."""
    if _is_missing(profile, now):
        return 1
    return min(dimension_level(profile, d) for d in CAPPING_DIMENSIONS)


def profile_status(profile: Any, now: int) -> str:
    if _is_missing(profile, now):
        return "missing"
    return "stale" if age_days(now, parse_time(profile["generated"])) > PROFILE_MAX_AGE_DAYS else "ok"


def _freshness_reasons(wf: dict, defaults: dict | None, now: int) -> list[str]:
    reasons: list[str] = []
    max_age = (defaults or {}).get("stop_test_max_age_days", 30)
    if wf["granted_level"] >= 4:
        tested = (wf.get("stop") or {}).get("last_tested")
        if tested is None or age_days(now, parse_time(tested)) > max_age:
            reasons.append("stop-test-overdue")
    if "review_date" in wf and parse_time(wf["review_date"]) < now:
        reasons.append("review-date-passed")
    if "access_expires" in wf and parse_time(wf["access_expires"]) < now:
        reasons.append("access-expired")
    return reasons


def effective_level(wf: dict, profile: Any, state: Any, defaults: dict | None, now: int) -> Effective:
    granted = wf["granted_level"]
    cap = cap_of(profile, now)
    stale = profile_status(profile, now)
    fresh = _freshness_reasons(wf, defaults, now)
    if stale != "ok":
        fresh.append(f"profile-{stale}")
    freshness = FRESHNESS_LEVEL if fresh else 5
    entry = _as_dict(_as_dict(_as_dict(state).get("workflows")).get(wf["id"]))
    harness_hash = entry.get("harness_hash")
    harness = HARNESS_LEVEL if isinstance(harness_hash, str) and harness_hash != entry.get("task_bank_passed_hash") else 5
    demotion = entry.get("demotion_override")
    override = demotion if isinstance(demotion, int) and not isinstance(demotion, bool) else 5
    effective = min(granted, cap, freshness, harness, override)
    reasons: list[str] = []
    if cap < granted:
        reasons.append(f"cap:{cap}")
    if freshness < granted:
        reasons.extend(f"freshness:{r}" for r in fresh)
    if harness < granted:
        reasons.append("harness:task-bank-not-passed")
    if override < granted:
        reasons.append(f"demotion:{override}")
    return Effective(wf["id"], granted, cap, freshness, harness, override, effective, reasons)


def all_workflows(register: dict) -> list[dict]:
    workflows = list(register["workflows"])
    if not any(w["id"] == "interactive" for w in workflows):
        level = (register.get("defaults") or {}).get("interactive_level", 2)
        workflows.append({"id": "interactive", "granted_level": level})
    return workflows
