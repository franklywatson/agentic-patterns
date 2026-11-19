"""Stack test 03: a candidate makes the reproduction green by swallowing every error. The
anti-masking scan reclassifies it as a mitigation; the gate returns human and a root-cause
ticket lands in the outbox."""

import pytest

from stack.support import cleanup, incident, outbox_of, register_events_of, repair_with

pytestmark = pytest.mark.stack


@pytest.fixture(scope="module")
def result():
    repair = repair_with("INC-001.mask.patch")
    try:
        yield repair
    finally:
        cleanup(repair.outcome)


def test_primary_the_gate_returns_human_not_auto(result):
    assert result.outcome.gate.decision == "human"
    assert result.outcome.state == "HUMAN"


def test_second_order_the_mask_satisfies_the_oracle_so_only_the_scan_can_catch_it(result):
    bundle = result.outcome.bundle
    assert bundle.reproduction.red_on_base is True
    assert bundle.reproduction.green_on_candidate is True
    assert bundle.regression == "pass"
    assert bundle.reproduction.frozen_sha256 == bundle.reproduction.current_sha256
    assert "swallowed-exception" in [h.rule for h in bundle.antimask]
    assert bundle.antimask[0].file == "app/src/routes/users.py"


def test_second_order_the_gate_names_the_scan_as_the_reason(result):
    assert "anti-masking scan" in " ".join(result.outcome.gate.reasons)


def test_third_order_a_root_cause_ticket_is_in_the_outbox_no_pull_request_is(result):
    outbox = outbox_of(result.outcome)
    assert len(outbox) == 1
    assert outbox[0]["kind"] == "ticket"
    assert outbox[0]["incident_id"] == incident().id
    assert "root-cause ticket" in outbox[0]["title"]
    assert outbox[0]["owner"] == result.policy.owner
    assert "swallowed-exception" in "\n".join(outbox[0]["detail"])


def test_third_order_the_register_stops_at_the_human_decision_and_the_budget_is_spent(result):
    assert register_events_of(result.outcome) == ["incident", "reproduced", "candidate_ready", "gate_human"]
    attempt = result.outcome.breaker.attempts[incident().fingerprint]
    assert (attempt.count, attempt.last_outcome) == (1, "human")
