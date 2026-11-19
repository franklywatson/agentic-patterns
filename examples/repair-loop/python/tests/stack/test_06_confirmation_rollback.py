"""Stack test 06: an over-fitted fix guards only the literal id from the incident. It passes the
reproduction and the regression suite, so the gate returns auto. The confirmation window replays
the incident's traffic, still sees the fingerprint, and rolls the repair back."""

import pytest

from stack.support import cleanup, incident, outbox_of, register_events_of, repair_with

pytestmark = pytest.mark.stack


@pytest.fixture(scope="module")
def result():
    repair = repair_with("INC-001.partial.patch")
    try:
        yield repair
    finally:
        cleanup(repair.outcome)


def test_primary_the_gate_said_auto_and_confirmation_then_rolled_the_repair_back(result):
    assert result.outcome.gate.decision == "auto"
    assert result.outcome.state == "ROLLED_BACK"
    assert result.outcome.reasons == ["fingerprint-present"]


def test_second_order_the_oracle_was_satisfied_so_only_the_confirmation_window_could_catch_it(result):
    bundle = result.outcome.bundle
    assert bundle.reproduction.green_on_candidate is True
    assert bundle.regression == "pass"
    assert bundle.antimask == []


def test_third_order_a_pull_request_and_then_a_page_are_in_the_outbox_and_the_budget_is_spent(result):
    assert [e["kind"] for e in outbox_of(result.outcome)] == ["pr", "page"]
    assert register_events_of(result.outcome)[-2:] == ["gate_auto", "confirm_fail"]
    attempt = result.outcome.breaker.attempts[incident().fingerprint]
    assert (attempt.count, attempt.last_outcome) == (1, "rolled-back")
    assert incident().fingerprint not in result.outcome.breaker.confirmed_at
