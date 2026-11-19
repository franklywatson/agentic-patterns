"""Helpers shared by the stack tests."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from repair_loop.breaker import BreakerState, new_breaker
from repair_loop.config import load_incident_record, load_policy, load_rules
from repair_loop.incident import parse_incident
from repair_loop.loop import RepairOutcome, run_repair
from repair_loop.runtime import DockerEnvironment, read_json_lines, remove_workspaces

PATCH_DIR = Path(__file__).resolve().parents[2] / "patches"


def patch_path(name: str) -> str:
    return str(PATCH_DIR / name)


def incident():
    return parse_incident(load_incident_record("INC-001"))


@dataclass
class Repair:
    env: DockerEnvironment
    outcome: RepairOutcome
    policy: object


def repair_with(patch_name: str, breaker: BreakerState | None = None) -> Repair:
    env = DockerEnvironment()
    policy = load_policy()
    outcome = run_repair(env, incident(), patch_path(patch_name), breaker or new_breaker(policy.grant), policy, load_rules())
    return Repair(env, outcome, policy)


def outbox_of(outcome: RepairOutcome) -> list[dict]:
    return read_json_lines(outcome.base, "outbox.jsonl")


def register_events_of(outcome: RepairOutcome) -> list[str]:
    return [e["event"] for e in read_json_lines(outcome.base, "register.jsonl")]


def cleanup(outcome: RepairOutcome | None) -> None:
    if outcome is not None and outcome.base is not None:
        remove_workspaces(outcome.base)
