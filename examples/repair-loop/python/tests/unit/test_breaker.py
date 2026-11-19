import pytest

from repair_loop.breaker import (
    budget_for, engage_stop, new_breaker, record_attempt, record_confirmed,
    record_recurrence, release_stop, restore_grant,
)
from repair_loop.models import Budget
from support.builders import policy

FP = "92e2a8020bd5"
DAY = 86_400


def test_one_attempt_per_fingerprint_exhausts_the_budget():
    state = new_breaker("A3")
    assert budget_for(state, FP, 0, policy) == Budget(0, 1, False)
    used = record_attempt(state, FP, 1000, "rolled-back")
    assert budget_for(used, FP, 1002, policy) == Budget(1, 1, True)
    assert budget_for(used, FP, 1000 + 901, policy).cooldown_active is False


def test_a_confirmed_attempt_starts_no_cooldown():
    confirmed = record_confirmed(new_breaker("A3"), FP, 1000)
    assert budget_for(confirmed, FP, 1002, policy).cooldown_active is False


def test_a_recurrence_inside_the_window_drops_the_grant_one_level():
    confirmed = record_confirmed(new_breaker("A3"), FP, 0)
    tripped = record_recurrence(confirmed, FP, 3 * DAY, policy)
    assert tripped.grant == "A2"
    assert tripped.decisions[0]["kind"] == "grant-dropped"
    assert tripped.decisions[0]["by"] == "breaker"
    assert tripped.clean_repairs_since_trip == 0


def test_a_recurrence_outside_the_window_or_of_an_unconfirmed_fingerprint_changes_nothing():
    confirmed = record_confirmed(new_breaker("A3"), FP, 0)
    assert record_recurrence(confirmed, FP, 15 * DAY, policy).grant == "A3"
    assert record_recurrence(new_breaker("A3"), FP, 0, policy).grant == "A3"


def test_the_grant_never_drops_below_a1():
    confirmed = record_confirmed(new_breaker("A1"), FP, 0)
    assert record_recurrence(confirmed, FP, DAY, policy).grant == "A1"


def test_restore_needs_a_named_human_and_five_clean_repairs():
    state = record_recurrence(record_confirmed(new_breaker("A3"), FP, 0), FP, DAY, policy)
    with pytest.raises(ValueError, match="named human"):
        restore_grant(state, "A3", "agent:repair-bot", 0, policy)
    with pytest.raises(ValueError, match="named human"):
        restore_grant(state, "A3", "", 0, policy)
    with pytest.raises(ValueError, match="needs 5 clean repairs, found 0"):
        restore_grant(state, "A3", "alice", 0, policy)
    for i in range(5):
        state = record_confirmed(state, f"fp-{i}", DAY + i)
    restored = restore_grant(state, "A3", "alice", 2 * DAY, policy)
    assert restored.grant == "A3"
    assert restored.decisions[-1]["kind"] == "grant-restored"
    assert restored.decisions[-1]["by"] == "alice"


def test_the_stop_switch_needs_a_name_and_only_a_person_releases_it():
    with pytest.raises(ValueError, match="name"):
        engage_stop(new_breaker("A3"), "", 0)
    stopped = engage_stop(new_breaker("A3"), "oncall-alice", 5)
    assert stopped.stop == ("oncall-alice", 5)
    with pytest.raises(ValueError, match="named human"):
        release_stop(stopped, "agent:x", 6)
    assert release_stop(stopped, "oncall-alice", 6).stop is None


def test_state_transitions_return_new_objects():
    state = new_breaker("A3")
    record_attempt(state, FP, 1, "x")
    assert state.attempts == {}
