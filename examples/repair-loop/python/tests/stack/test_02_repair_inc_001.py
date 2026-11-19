"""Stack test 02: an incident arrives, the loop reproduces it, applies the real fix, verifies
it, and the gate returns auto. Real Docker stacks with PostgreSQL and Redis; the reproduction
and the regression suite run against the deployed app over HTTP."""

import json
from pathlib import Path

import pytest

from repair_loop.reproduce import sha256_file
from stack.support import cleanup, incident, outbox_of, register_events_of, repair_with

pytestmark = pytest.mark.stack


@pytest.fixture(scope="module")
def result():
    repair = repair_with("INC-001.fix.patch")
    try:
        yield repair
    finally:
        cleanup(repair.outcome)


def test_primary_the_gate_returns_auto_and_the_loop_confirms_the_repair(result):
    assert result.outcome.gate.decision == "auto"
    assert result.outcome.state == "CONFIRMED"


def test_second_order_the_reproduction_was_red_for_the_right_reason_then_green(result):
    runs = [r for r in result.env.runs if r.kind == "reproduction"]
    assert len(runs) == 2
    on_base, on_candidate = runs
    assert on_base.passed is False
    assert "assert 500 == 404" in on_base.output
    assert on_candidate.passed is True
    assert result.outcome.bundle.reproduction.red_on_base is True
    assert result.outcome.bundle.reproduction.green_on_candidate is True


def test_second_order_the_regression_suite_is_green_and_the_diff_is_clean_and_small(result):
    bundle = result.outcome.bundle
    assert bundle.regression == "pass"
    assert bundle.antimask == []
    assert (bundle.classification.reversibility, bundle.classification.blast) == ("R2", "B0")
    assert [f.path for f in bundle.diff] == ["app/src/routes/users.py"]


def test_second_order_the_frozen_hash_on_disk_matches_the_reproduction_that_ran(result):
    base = Path(result.outcome.base.dir)
    lock = json.loads((base / ".repair" / "INC-001.lock.json").read_text())
    candidate_hash = sha256_file(Path(f"{base}-candidate") / lock["path"])
    assert candidate_hash == lock["sha256"]
    assert result.outcome.bundle.reproduction.frozen_sha256 == lock["sha256"]


def test_third_order_the_outbox_holds_one_pull_request_and_the_register_holds_the_full_path(result):
    outbox = outbox_of(result.outcome)
    assert [e["kind"] for e in outbox] == ["pr"]
    assert outbox[0]["incident_id"] == incident().id
    assert register_events_of(result.outcome) == [
        "incident", "reproduced", "candidate_ready", "gate_auto", "gate_auto", "confirm_pass",
    ]
    assert result.outcome.breaker.confirmed_at[incident().fingerprint] > 0
