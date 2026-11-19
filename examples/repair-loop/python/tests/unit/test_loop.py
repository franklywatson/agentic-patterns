from dataclasses import dataclass, field, replace

import pytest

from repair_loop.breaker import new_breaker, record_attempt
from repair_loop.config import load_incident_record
from repair_loop.incident import parse_incident
from repair_loop.breaker import record_confirmed
from repair_loop.loop import Handle, ReproductionRun, evaluate_confirmation, observe_recurrence, run_repair, transition
from support.builders import patch_text, policy, rules

incident = parse_incident(load_incident_record("INC-001"))


@dataclass
class FakeDeployment:
    base_url: str
    log: list[str]

    def logs(self) -> str:
        return ""

    raises: bool = False

    def stop(self) -> None:
        self.log.append(f"stop:{self.base_url}")
        if self.raises:
            raise RuntimeError("stop failed")


@dataclass
class FakeEnvironment:
    """A fake environment for unit tests. Mocks are appropriate here (Pattern 1.5)."""

    other_failure: bool = False
    stop_raises: bool = False
    base_red: bool = True
    candidate_green: bool = True
    patch: str = field(default_factory=lambda: patch_text("INC-001.fix.patch"))
    current_hash_value: str = "frozen"
    fingerprint_count: int = 0
    outbox: list = field(default_factory=list)
    events: list = field(default_factory=list)
    deployed: list = field(default_factory=list)
    tested_from: list = field(default_factory=list)

    def now(self) -> float:
        return 1_000_000

    def freeze(self, incident):
        return Handle("base")

    def candidate(self, base, patch_file):
        return Handle("candidate"), self.patch

    def deploy(self, handle):
        self.deployed.append(f"start:{handle.dir}")
        return FakeDeployment(handle.dir, self.deployed, self.stop_raises and handle.dir == "candidate")

    def run_reproduction(self, base, deployment, incident):
        self.tested_from.append(f"reproduction:{base.dir}")
        if deployment.base_url == "base":
            return ReproductionRun(not self.base_red, not self.other_failure)
        return ReproductionRun(self.candidate_green, True)

    def run_regression(self, base, deployment):
        self.tested_from.append(f"regression:{base.dir}")
        return True

    def frozen_hash(self, handle, incident):
        return "frozen"

    def traffic(self, deployment, incident, samples):
        return samples, self.fingerprint_count

    def current_hash(self, handle, incident):
        return self.current_hash_value

    def emit(self, handle, entry):
        self.outbox.append(entry)

    def record(self, handle, event, state, detail):
        self.events.append(event)


def make_env(**kwargs):
    return FakeEnvironment(**kwargs)


def repair(env, breaker=None):
    return run_repair(env, incident, "fix.patch", breaker or new_breaker("A3"), policy, rules)


def test_transition_follows_the_table():
    assert transition("IDLE", "incident") == "DETECTED"
    assert transition("CANDIDATE", "gate_block") == "BLOCKED"
    assert transition("PR_OPENED", "confirm_fail") == "ROLLED_BACK"


def test_transition_rejects_moves_the_table_does_not_contain():
    with pytest.raises(ValueError, match="invalid transition: IDLE on gate_auto"):
        transition("IDLE", "gate_auto")
    with pytest.raises(ValueError, match="invalid transition"):
        transition("CONFIRMED", "incident")


def test_the_stop_event_is_valid_from_every_working_state_and_terminal_states_accept_nothing():
    for state in ["IDLE", "DETECTED", "REPRODUCED", "CANDIDATE", "GATED", "PR_OPENED"]:
        assert transition(state, "stop") == "STOPPED"
    with pytest.raises(ValueError, match="invalid transition"):
        transition("HUMAN", "stop")


def test_evaluate_confirmation_needs_the_minimum_sample_and_no_fingerprint_hits():
    assert evaluate_confirmation(50, 0, policy) == "confirmed"
    assert evaluate_confirmation(49, 0, policy) == "insufficient-sample"
    assert evaluate_confirmation(500, 1, policy) == "fingerprint-present"


def test_a_clean_fix_is_confirmed_and_both_stacks_are_stopped():
    env = make_env()
    outcome = repair(env)
    assert outcome.state == "CONFIRMED"
    assert [e.kind for e in env.outbox] == ["pr"]
    assert env.deployed == ["start:base", "stop:base", "start:candidate", "stop:candidate"]
    assert outcome.breaker.confirmed_at[incident.fingerprint] == 1_000_000


def test_a_reproduction_that_is_not_red_routes_to_a_human_before_any_candidate_is_built():
    env = make_env(base_red=False)
    outcome = repair(env)
    assert outcome.state == "HUMAN"
    assert outcome.reasons == ["cannot reproduce"]
    assert "cannot reproduce" in env.outbox[0].title
    assert env.deployed == ["start:base", "stop:base"]


def test_a_changed_reproduction_hash_is_blocked():
    env = make_env(current_hash_value="edited")
    outcome = repair(env)
    assert outcome.state == "BLOCKED"
    assert [e.kind for e in env.outbox] == ["page"]


def test_a_failed_confirmation_rolls_back_and_pages_the_owner():
    env = make_env(fingerprint_count=2)
    outcome = repair(env)
    assert outcome.state == "ROLLED_BACK"
    assert [e.kind for e in env.outbox] == ["pr", "page"]
    assert outcome.breaker.attempts[incident.fingerprint].last_outcome == "rolled-back"


def test_a_spent_budget_is_refused_before_any_stack_starts():
    env = make_env()
    spent = record_attempt(new_breaker("A3"), incident.fingerprint, 999_900, "rolled-back")
    assert repair(env, spent).state == "HUMAN"
    assert env.deployed == []


def test_an_engaged_stop_returns_stopped_without_touching_the_environment():
    env = make_env()
    stopped = replace(new_breaker("A3"), stop=("oncall-alice", 1))
    outcome = repair(env, stopped)
    assert outcome.state == "STOPPED"
    assert env.deployed == []
    assert env.events == []


def test_the_gate_sees_a_bundle_built_from_observations_not_from_the_candidate():
    outcome = repair(make_env())
    assert outcome.bundle.regression == "pass"
    assert outcome.bundle.grant == "A3"
    assert (outcome.bundle.reproduction.frozen_sha256, outcome.bundle.reproduction.current_sha256) == ("frozen", "frozen")


def test_a_reproduction_that_is_red_for_another_reason_is_not_accepted_as_the_incident():
    env = make_env(other_failure=True)
    outcome = repair(env)
    assert outcome.state == "HUMAN"
    assert outcome.reasons == ["reproduction failed for a reason other than the incident symptom"]
    assert env.outbox[0].kind == "ticket"
    assert env.deployed == ["start:base", "stop:base"]


def test_a_deployment_that_fails_to_stop_does_not_hide_the_original_error(capsys):
    env = make_env(stop_raises=True)

    def crash(base, deployment):
        raise RuntimeError("regression runner crashed")

    env.run_regression = crash
    with pytest.raises(RuntimeError, match="regression runner crashed"):
        repair(env)
    assert "failed to stop a deployment" in capsys.readouterr().err


def _log(route):
    return '{"level":"error","event":"unhandled_error","route":"%s","status":500,"errorClass":"pg:22P02"}' % route


def test_observe_recurrence_drops_the_grant_when_the_incident_fingerprint_reappears_after_a_confirmed_repair():
    confirmed = record_confirmed(new_breaker("A3"), incident.fingerprint, 0)
    assert observe_recurrence(confirmed, incident, _log("GET /users/:id"), 3600, policy).grant == "A2"


def test_observe_recurrence_ignores_other_fingerprints_and_clean_logs():
    confirmed = record_confirmed(new_breaker("A3"), incident.fingerprint, 0)
    assert observe_recurrence(confirmed, incident, _log("GET /orders/:id"), 3600, policy).grant == "A3"
    assert observe_recurrence(confirmed, incident, "INFO started", 3600, policy).grant == "A3"


def test_the_frozen_reproduction_and_the_regression_suite_run_from_the_base_workspace_for_both_deployments():
    env = make_env()
    repair(env)
    assert env.tested_from == ["reproduction:base", "reproduction:base", "regression:base"]
