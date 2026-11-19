"""Attempt budgets, the circuit breaker on recurrence, and stop authority.

State is immutable: every function returns a new BreakerState.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field, replace

from .models import GRANTS, Budget, RepairPolicy

DAY_SECONDS = 86_400
NOT_HUMAN = re.compile(r"^(agent|bot|breaker)\b", re.I)


@dataclass(frozen=True)
class Attempt:
    count: int
    last_attempt_at: float
    last_outcome: str


@dataclass(frozen=True)
class BreakerState:
    grant: str
    attempts: dict[str, Attempt] = field(default_factory=dict)
    confirmed_at: dict[str, float] = field(default_factory=dict)
    recurrences: int = 0
    clean_repairs_since_trip: int = 0
    stop: tuple[str, float] | None = None
    decisions: tuple[dict, ...] = ()


def new_breaker(grant: str) -> BreakerState:
    return BreakerState(grant=grant)


def budget_for(state: BreakerState, fingerprint: str, now: float, policy: RepairPolicy) -> Budget:
    """Attempts used, and whether the cooldown after the last unconfirmed attempt is running."""
    entry = state.attempts.get(fingerprint)
    cooldown = (
        entry is not None
        and entry.last_outcome != "confirmed"
        and now - entry.last_attempt_at < policy.cooldown_seconds
    )
    return Budget(entry.count if entry else 0, policy.attempts_per_fingerprint, cooldown)


def record_attempt(state: BreakerState, fingerprint: str, now: float, outcome: str) -> BreakerState:
    previous = state.attempts.get(fingerprint)
    attempts = {**state.attempts, fingerprint: Attempt((previous.count if previous else 0) + 1, now, outcome)}
    return replace(state, attempts=attempts)


def record_confirmed(state: BreakerState, fingerprint: str, now: float) -> BreakerState:
    next_state = record_attempt(state, fingerprint, now, "confirmed")
    return replace(
        next_state,
        confirmed_at={**next_state.confirmed_at, fingerprint: now},
        clean_repairs_since_trip=next_state.clean_repairs_since_trip + 1,
    )


def record_recurrence(state: BreakerState, fingerprint: str, now: float, policy: RepairPolicy) -> BreakerState:
    """A fingerprint reappears. Inside the window after a confirmed repair it counts as a
    recurrence; at the trip threshold the grant drops one level."""
    confirmed = state.confirmed_at.get(fingerprint)
    if confirmed is None or now - confirmed > policy.recurrence_window_days * DAY_SECONDS:
        return state
    recurrences = state.recurrences + 1
    if recurrences < policy.trip_recurrences:
        return replace(state, recurrences=recurrences, clean_repairs_since_trip=0)
    lowered = GRANTS[max(0, GRANTS.index(state.grant) - 1)]
    decision = {
        "at": now, "kind": "grant-dropped", "by": "breaker",
        "detail": f"{state.grant} -> {lowered} after recurrence of {fingerprint}",
    }
    return replace(
        state, grant=lowered, recurrences=0, clean_repairs_since_trip=0,
        decisions=(*state.decisions, decision),
    )


def restore_grant(state: BreakerState, to: str, by: str, now: float, policy: RepairPolicy) -> BreakerState:
    """Restoring a dropped grant is a named human decision. Hysteresis: it also needs a run
    of clean confirmed repairs, a higher bar than the single recurrence that tripped it."""
    if not by.strip() or NOT_HUMAN.match(by):
        raise ValueError("restoring a grant requires a named human")
    if state.clean_repairs_since_trip < policy.reset_clean_repairs:
        raise ValueError(
            f"restore needs {policy.reset_clean_repairs} clean repairs, found {state.clean_repairs_since_trip}"
        )
    decision = {"at": now, "kind": "grant-restored", "by": by, "detail": f"{state.grant} -> {to}"}
    return replace(state, grant=to, decisions=(*state.decisions, decision))


def engage_stop(state: BreakerState, by: str, now: float) -> BreakerState:
    if not by.strip():
        raise ValueError("the stop switch needs the name of the person who pulled it")
    decision = {"at": now, "kind": "stop-engaged", "by": by, "detail": "stop switch engaged"}
    return replace(state, stop=(by, now), decisions=(*state.decisions, decision))


def release_stop(state: BreakerState, by: str, now: float) -> BreakerState:
    if not by.strip() or NOT_HUMAN.match(by):
        raise ValueError("releasing the stop requires a named human")
    decision = {"at": now, "kind": "stop-released", "by": by, "detail": "stop switch released"}
    return replace(state, stop=None, decisions=(*state.decisions, decision))
