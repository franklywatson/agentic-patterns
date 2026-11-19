"""Load the shared, data-driven configuration."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .models import RepairPolicy

SHARED_DIR = Path(__file__).resolve().parents[3] / "shared"


def _read(*parts: str) -> Any:
    return json.loads(SHARED_DIR.joinpath(*parts).read_text())


@dataclass(frozen=True)
class ReversibilityRules:
    unknown: dict[str, str]
    paths: list[dict[str, str]]
    content: list[dict[str, str]]


def load_rules() -> ReversibilityRules:
    raw = _read("config", "reversibility.json")
    return ReversibilityRules(unknown=raw["unknown"], paths=raw["paths"], content=raw["content"])


def load_policy() -> RepairPolicy:
    raw = _read("config", "repair-policy.json")
    return RepairPolicy(
        workflow=raw["workflow"],
        grant=raw["grant"],
        owner=raw["owner"],
        min_grant_for_auto=raw["minGrantForAuto"],
        auto_ceiling=raw["autoCeiling"],
        protected_paths=raw["protectedPaths"],
        existing_tests_glob=raw["existingTestsGlob"],
        attempts_per_fingerprint=raw["budget"]["attemptsPerFingerprint"],
        cooldown_seconds=raw["budget"]["cooldownSeconds"],
        recurrence_window_days=raw["breaker"]["recurrenceWindowDays"],
        trip_recurrences=raw["breaker"]["tripRecurrences"],
        reset_clean_repairs=raw["breaker"]["resetCleanRepairs"],
        confirm_min_samples=raw["confirm"]["minSamples"],
        confirm_max_fingerprint_count=raw["confirm"]["maxFingerprintCount"],
    )


def load_incident_record(incident_id: str) -> dict[str, Any]:
    return _read("incidents", f"{incident_id}.json")
