"""Typed records shared by the repair loop modules."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

Decision = Literal["auto", "human", "block"]
Merge = Literal["person", "unattended"]  # who merges an auto change; human and block carry none
REVERSIBILITY = ["R0", "R1", "R2", "R3", "R4"]
BLAST = ["B0", "B1", "B2", "B3"]
GRANTS = ["A1", "A2", "A3", "A4", "A5"]


@dataclass(frozen=True)
class Incident:
    id: str
    fingerprint: str
    journey: str
    entrypoint: str
    error_class: str
    request: dict[str, Any]
    observed: dict[str, Any]
    expected: dict[str, Any]
    dependencies: dict[str, Any]
    detected_at: str
    replay_paths: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class DiffFile:
    path: str
    status: Literal["added", "modified", "deleted"]
    added: list[str] = field(default_factory=list)
    removed: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class Classification:
    reversibility: str
    blast: str
    reasons: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class AntimaskHit:
    rule: str
    file: str
    line: str


@dataclass(frozen=True)
class Reproduction:
    red_on_base: bool
    green_on_candidate: bool
    frozen_sha256: str
    current_sha256: str


@dataclass(frozen=True)
class Budget:
    attempts_used: int
    attempts_allowed: int
    cooldown_active: bool


@dataclass(frozen=True)
class EvidenceBundle:
    incident_id: str
    fingerprint: str
    reproduction: Reproduction
    regression: Literal["pass", "fail"]
    diff: list[DiffFile]
    classification: Classification
    antimask: list[AntimaskHit]
    budget: Budget
    grant: str
    stop_engaged: bool


@dataclass(frozen=True)
class GateResult:
    decision: Decision
    reasons: list[str]
    merge: Merge | None


@dataclass(frozen=True)
class RepairPolicy:
    workflow: str
    grant: str
    owner: str
    min_grant_for_auto: str
    auto_ceiling: dict[str, str]
    unattended_ceiling: dict[str, dict[str, str]]  # highest class that merges unattended, per grant
    unattended_r2_paths: list[str]  # an R2 change merges unattended only with every file on these paths
    protected_paths: list[str]
    attempts_per_fingerprint: int
    cooldown_seconds: int
    recurrence_window_days: int
    trip_recurrences: int
    reset_clean_repairs: int
    confirm_min_samples: int
    confirm_max_fingerprint_count: int
