"""Stack test 04: a candidate edits the reproduction test so that it would pass against the
unfixed app. The loop runs the frozen reproduction, never the candidate's copy, so the bug is
still seen; the changed hash and the protected path make the gate return block."""

import pytest

from stack.support import cleanup, incident, outbox_of, repair_with

pytestmark = pytest.mark.stack


@pytest.fixture(scope="module")
def result():
    repair = repair_with("INC-001.test-edit.patch")
    try:
        yield repair
    finally:
        cleanup(repair.outcome)


def test_primary_the_gate_returns_block(result):
    assert result.outcome.gate.decision == "block"
    assert result.outcome.state == "BLOCKED"


def test_second_order_the_frozen_reproduction_still_fails_on_the_candidate_because_the_bug_is_still_in_the_app(result):
    on_base, on_candidate = [r for r in result.env.runs if r.kind == "reproduction"]
    assert on_base.passed is False
    assert on_candidate.passed is False
    assert on_candidate.workspace == on_base.workspace
    assert "assert 500 == 404" in on_candidate.output
    assert result.outcome.bundle.reproduction.green_on_candidate is False
    assert [f.path for f in result.outcome.bundle.diff] == ["tests/repro/test_inc_001_repro.py"]


def test_second_order_the_hash_changed_and_class_and_scan_alone_would_have_allowed_it(result):
    bundle = result.outcome.bundle
    reasons = "\n".join(result.outcome.gate.reasons)
    assert bundle.reproduction.frozen_sha256 != bundle.reproduction.current_sha256
    assert (bundle.classification.reversibility, bundle.classification.blast) == ("R0", "B0")
    assert bundle.antimask == []
    assert "reproduction test changed after it was frozen" in reasons
    assert "protected path tests/repro/test_inc_001_repro.py" in reasons


def test_third_order_a_page_reaches_the_owner_and_no_pull_request_is_opened(result):
    outbox = outbox_of(result.outcome)
    assert [e["kind"] for e in outbox] == ["page"]
    assert outbox[0]["incident_id"] == incident().id
    attempt = result.outcome.breaker.attempts[incident().fingerprint]
    assert (attempt.count, attempt.last_outcome) == (1, "blocked")
