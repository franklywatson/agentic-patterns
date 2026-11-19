"""Stack test 05: a repair is confirmed, then the same fingerprint reappears in the logs of a
regressed build. The breaker drops the grant, the next attempt goes to a person, and the stop
switch halts the loop before any stack starts."""

import json
from dataclasses import replace
from datetime import date
from pathlib import Path

import httpx
import pytest

from repair_loop.breaker import engage_stop, record_recurrence, restore_grant
from repair_loop.config import load_rules
from repair_loop.gate import gate
from repair_loop.incident import fingerprints_from_log
from repair_loop.loop import run_repair
from repair_loop.runtime import DockerEnvironment
from stack.support import cleanup, incident, outbox_of, patch_path, repair_with

pytestmark = pytest.mark.stack


@pytest.fixture(scope="module")
def first():
    repair = repair_with("INC-001.fix.patch")
    try:
        yield repair
    finally:
        cleanup(repair.outcome)


@pytest.fixture(scope="module")
def after_recurrence(first):
    # The regressed build is the base workspace: it still contains the defect.
    regressed = first.env.deploy(first.outcome.base)
    try:
        httpx.get(f"{regressed.base_url}{incident().request['path']}")
        assert incident().fingerprint in fingerprints_from_log(regressed.logs())
        return record_recurrence(first.outcome.breaker, incident().fingerprint, first.env.now() + 3600, first.policy)
    finally:
        regressed.stop()


def test_primary_the_first_repair_was_confirmed_then_the_recurrence_dropped_the_grant(first, after_recurrence):
    assert first.outcome.state == "CONFIRMED"
    assert first.outcome.breaker.grant == "A3"
    assert after_recurrence.grant == "A2"
    assert [d["kind"] for d in after_recurrence.decisions] == ["grant-dropped"]


def test_second_order_the_same_clean_evidence_now_gets_human_because_the_grant_is_below_a3(first, after_recurrence):
    result = gate(replace(first.outcome.bundle, grant=after_recurrence.grant), first.policy)
    assert result.decision == "human"
    assert "grant A2 is below A3" in "\n".join(result.reasons)


def test_second_order_a_new_attempt_on_the_fingerprint_is_refused_before_any_stack_starts(first, after_recurrence):
    env = DockerEnvironment()
    refused = run_repair(env, incident(), patch_path("INC-001.fix.patch"), after_recurrence, first.policy, load_rules())
    try:
        assert refused.state == "HUMAN"
        assert refused.reasons == ["attempt budget exhausted or cooldown active"]
        assert env.runs == []
        assert [e["kind"] for e in outbox_of(refused)] == ["page"]
    finally:
        cleanup(refused)


def test_third_order_the_stop_switch_halts_the_loop_and_the_drill_is_recorded(first, after_recurrence):
    env = DockerEnvironment()
    stopped = engage_stop(after_recurrence, "oncall-alice", env.now())
    outcome = run_repair(env, incident(), patch_path("INC-001.fix.patch"), stopped, first.policy, load_rules())
    assert outcome.state == "STOPPED"
    assert outcome.reasons == ["stopped by oncall-alice"]
    assert env.runs == []
    assert gate(replace(first.outcome.bundle, stop_engaged=True), first.policy).decision == "block"

    drill = Path(first.outcome.base.dir) / ".repair" / "stop-drill.json"
    drill.write_text(json.dumps({"workflow": "repair-loop", "last_tested": date.today().isoformat(), "result": "halted"}))
    assert json.loads(drill.read_text())["result"] == "halted"


def test_third_order_restoring_the_grant_needs_a_named_human_and_a_run_of_clean_repairs(first, after_recurrence):
    with pytest.raises(ValueError, match="named human"):
        restore_grant(after_recurrence, "A3", "agent:repair-bot", 0, first.policy)
    with pytest.raises(ValueError, match="needs 5 clean repairs"):
        restore_grant(after_recurrence, "A3", "alice", 0, first.policy)
