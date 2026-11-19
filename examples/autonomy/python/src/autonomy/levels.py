from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from autonomy.util import age_days, parse_time

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


def dimension_level(profile: dict | None, dimension: str) -> int:
    entry = ((profile or {}).get("dimensions") or {}).get(dimension)
    if entry is None:
        return 2
    level = entry.get("level")
    return level if isinstance(level, int) and not isinstance(level, bool) and 1 <= level <= 5 else 2


def _is_missing(profile: Any) -> bool:
    """A profile is missing when there is none, it is not an object, or it has no `generated` time."""
    return not isinstance(profile, dict) or not isinstance(profile.get("generated"), str)


def cap_of(profile: dict | None) -> int:
    """Lowest capping dimension; a missing profile caps at 1, because nothing has been measured."""
    if _is_missing(profile):
        return 1
    return min(dimension_level(profile, d) for d in CAPPING_DIMENSIONS)


def profile_status(profile: dict | None, now: int) -> str:
    if _is_missing(profile):
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


def effective_level(wf: dict, profile: dict | None, state: dict | None, defaults: dict | None, now: int) -> Effective:
    granted = wf["granted_level"]
    cap = cap_of(profile)
    stale = profile_status(profile, now)
    fresh = _freshness_reasons(wf, defaults, now)
    if stale != "ok":
        fresh.append(f"profile-{stale}")
    freshness = FRESHNESS_LEVEL if fresh else 5
    entry = ((state or {}).get("workflows") or {}).get(wf["id"]) or {}
    harness_hash = entry.get("harness_hash")
    harness = HARNESS_LEVEL if isinstance(harness_hash, str) and harness_hash != entry.get("task_bank_passed_hash") else 5
    override = entry["demotion_override"] if isinstance(entry.get("demotion_override"), int) else 5
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
