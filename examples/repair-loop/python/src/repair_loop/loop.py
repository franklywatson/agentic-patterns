"""The repair loop: a state machine tying the modules together.

The environment (Docker, test runs, patches, outbox) is an injected protocol, so the loop's
decisions are testable without Docker. Real adapters live in runtime.py.
"""

from __future__ import annotations

from dataclasses import dataclass
import sys
from typing import Callable, Protocol, TypeVar

from .antimask import scan_production_diff
from .breaker import BreakerState, budget_for, record_attempt, record_confirmed, record_recurrence
from .classify import classify
from .config import ReversibilityRules
from .diff import parse_diff
from .gate import gate
from .incident import fingerprints_from_log
from .models import EvidenceBundle, GateResult, Incident, RepairPolicy, Reproduction

TRANSITIONS: dict[str, dict[str, str]] = {
    "IDLE": {"incident": "DETECTED", "stop": "STOPPED"},
    "DETECTED": {"reproduced": "REPRODUCED", "not_reproduced": "HUMAN", "budget_denied": "HUMAN", "stop": "STOPPED"},
    "REPRODUCED": {"candidate_ready": "CANDIDATE", "stop": "STOPPED"},
    "CANDIDATE": {"gate_auto": "GATED", "gate_human": "HUMAN", "gate_block": "BLOCKED", "stop": "STOPPED"},
    "GATED": {"gate_auto": "PR_OPENED", "stop": "STOPPED"},
    "PR_OPENED": {"confirm_pass": "CONFIRMED", "confirm_fail": "ROLLED_BACK", "stop": "STOPPED"},
    "CONFIRMED": {},
    "ROLLED_BACK": {},
    "HUMAN": {},
    "BLOCKED": {},
    "STOPPED": {},
}


def transition(state: str, event: str) -> str:
    """The state machine's transition table as a pure function. Invalid moves raise."""
    try:
        return TRANSITIONS[state][event]
    except KeyError:
        raise ValueError(f"invalid transition: {state} on {event}") from None


@dataclass(frozen=True)
class Handle:
    dir: str


class Deployment(Protocol):
    base_url: str

    def logs(self) -> str: ...
    def stop(self) -> None: ...


@dataclass(frozen=True)
class ReproductionRun:
    passed: bool
    matches_incident: bool


@dataclass(frozen=True)
class OutboxEntry:
    kind: str  # ticket | pr | page
    incident_id: str
    title: str
    owner: str
    detail: list[str]


class RepairEnvironment(Protocol):
    def now(self) -> float: ...
    def freeze(self, incident: Incident) -> Handle: ...
    def candidate(self, base: Handle, patch_file: str) -> tuple[Handle, str]:
        """Apply the patch inside a copy of the base workspace. The text returned is the observed diff."""
        ...
    def deploy(self, handle: Handle) -> Deployment: ...
    def run_reproduction(self, base: Handle, deployment: Deployment, incident: Incident) -> ReproductionRun:
        """Run the frozen reproduction from the base workspace against a deployment. Candidate-supplied
        test files are never executed. `matches_incident` is true when a failure shows the incident's
        own symptom (not a stack that is down)."""
        ...

    def run_regression(self, base: Handle, deployment: Deployment) -> bool: ...
    def frozen_hash(self, handle: Handle, incident: Incident) -> str: ...
    def current_hash(self, handle: Handle, incident: Incident) -> str: ...
    def traffic(self, deployment: Deployment, incident: Incident, samples: int) -> tuple[int, int]: ...
    def emit(self, handle: Handle, entry: OutboxEntry) -> None: ...
    def record(self, handle: Handle, event: str, state: str, detail: str) -> None: ...


@dataclass(frozen=True)
class RepairOutcome:
    state: str
    gate: GateResult | None
    bundle: EvidenceBundle | None
    reasons: list[str]
    breaker: BreakerState
    base: Handle | None


def evaluate_confirmation(samples: int, fingerprint_count: int, policy: RepairPolicy) -> str:
    """The pre-declared confirmation rule, decided by code: enough samples and no recurrence."""
    if samples < policy.confirm_min_samples:
        return "insufficient-sample"
    if fingerprint_count > policy.confirm_max_fingerprint_count:
        return "fingerprint-present"
    return "confirmed"


def run_repair(
    env: RepairEnvironment,
    incident: Incident,
    patch_file: str,
    breaker: BreakerState,
    policy: RepairPolicy,
    rules: ReversibilityRules,
) -> RepairOutcome:
    state = "IDLE"
    base: Handle | None = None

    def log(event: str, detail: str) -> None:
        if base is not None:
            env.record(base, event, state, detail)

    def move(event: str, detail: str) -> None:
        nonlocal state
        state = transition(state, event)
        log(event, detail)

    def finish(reasons: list[str], result: GateResult | None = None, bundle: EvidenceBundle | None = None) -> RepairOutcome:
        return RepairOutcome(state, result, bundle, reasons, breaker, base)

    state = transition(state, "incident")
    if breaker.stop is not None:
        state = "STOPPED"
        return finish([f"stopped by {breaker.stop[0]}"])

    budget = budget_for(breaker, incident.fingerprint, env.now(), policy)
    base = env.freeze(incident)
    log("incident", f"{incident.id} fingerprint {incident.fingerprint}")
    if budget.attempts_used >= budget.attempts_allowed or budget.cooldown_active:
        move("budget_denied", "attempt budget exhausted or cooldown active")
        env.emit(base, OutboxEntry("page", incident.id, f"{incident.id}: automatic attempt budget used", policy.owner,
                                   ["a person must take this incident"]))
        return finish(["attempt budget exhausted or cooldown active"])

    base_deployment = env.deploy(base)
    base_run = _using(base_deployment, lambda: env.run_reproduction(base, base_deployment, incident))
    red_on_base = (not base_run.passed) and base_run.matches_incident
    if not red_on_base:
        reason = "cannot reproduce" if base_run.passed else "reproduction failed for a reason other than the incident symptom"
        move("not_reproduced", reason)
        env.emit(base, OutboxEntry("ticket", incident.id, f"{incident.id}: {reason}", policy.owner, [reason]))
        breaker = record_attempt(breaker, incident.fingerprint, env.now(), "not-reproduced")
        return finish([reason])
    move("reproduced", "reproduction is red on the base commit with the incident symptom")

    candidate, patch_text = env.candidate(base, patch_file)
    move("candidate_ready", f"candidate built from {patch_file}")
    diff = parse_diff(patch_text)
    deployment = env.deploy(candidate)

    def verify() -> RepairOutcome:
        nonlocal breaker
        candidate_run = env.run_reproduction(base, deployment, incident)
        regression_passed = env.run_regression(base, deployment)
        bundle = EvidenceBundle(
            incident_id=incident.id,
            fingerprint=incident.fingerprint,
            reproduction=Reproduction(red_on_base, candidate_run.passed, env.frozen_hash(base, incident), env.current_hash(candidate, incident)),
            regression="pass" if regression_passed else "fail",
            diff=diff,
            classification=classify(diff, rules),
            antimask=scan_production_diff(diff),
            budget=budget,
            grant=breaker.grant,
            stop_engaged=False,
        )
        result = gate(bundle, policy)
        detail = f"{result.decision}: {'; '.join(result.reasons)}"

        if result.decision == "block":
            move("gate_block", detail)
            env.emit(base, OutboxEntry("page", incident.id, f"{incident.id}: candidate blocked", policy.owner, result.reasons))
            breaker = record_attempt(breaker, incident.fingerprint, env.now(), "blocked")
            return finish(result.reasons, result, bundle)
        if result.decision == "human":
            move("gate_human", detail)
            masked = bool(bundle.antimask)
            title = f"{incident.id}: root-cause ticket for a mitigation" if masked else f"{incident.id}: needs a person"
            env.emit(base, OutboxEntry("ticket", incident.id, title, policy.owner,
                                       [*result.reasons, *[f"{h.rule} in {h.file}: {h.line}" for h in bundle.antimask]]))
            breaker = record_attempt(breaker, incident.fingerprint, env.now(), "human")
            return finish(result.reasons, result, bundle)

        move("gate_auto", detail)
        move("gate_auto", "evidence bundle attached to a pull request")
        c = bundle.classification
        env.emit(base, OutboxEntry("pr", incident.id, f"{incident.id}: repair with evidence bundle", policy.owner,
                                   [f"classification {c.reversibility}/{c.blast}", "merge by a person: the grant is below A4"]))
        samples, fingerprint_count = env.traffic(deployment, incident, policy.confirm_min_samples)
        confirmation = evaluate_confirmation(samples, fingerprint_count, policy)
        if confirmation == "confirmed":
            move("confirm_pass", f"{samples} samples, fingerprint seen {fingerprint_count} times")
            breaker = record_confirmed(breaker, incident.fingerprint, env.now())
        else:
            move("confirm_fail", confirmation)
            env.emit(base, OutboxEntry("page", incident.id, f"{incident.id}: confirmation failed, rolled back", policy.owner, [confirmation]))
            breaker = record_attempt(breaker, incident.fingerprint, env.now(), "rolled-back")
        return finish([confirmation], result, bundle)

    return _using(deployment, verify)


T = TypeVar("T")


def _using(deployment: Deployment, fn: Callable[[], T]) -> T:
    """Stop a deployment after `fn`. A failure to stop never hides the error that `fn` raised."""
    try:
        result = fn()
    except BaseException:
        try:
            deployment.stop()
        except Exception as stop_error:
            print(f"failed to stop a deployment after an error: {stop_error}", file=sys.stderr)
        raise
    deployment.stop()
    return result


def observe_recurrence(breaker: BreakerState, incident: Incident, log_text: str, now: float, policy: RepairPolicy) -> BreakerState:
    """Recurrence monitor: if the application logs show the incident's fingerprint again, report it
    to the breaker. Inside the window after a confirmed repair this drops the grant."""
    if incident.fingerprint in fingerprints_from_log(log_text):
        return record_recurrence(breaker, incident.fingerprint, now, policy)
    return breaker
