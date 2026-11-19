"""Gate eval (Pattern 4.6, context eval applied to the production gate).

Each scenario fixes an input and the exact decision the gate must return. Scoring is exact:
1 for the expected decision, 0 otherwise, with no partial credit, because a gate that is
"mostly right" on irreversible actions is wrong. Each scenario runs K times with the diff
files in a different order; the scenario passes only if all K runs pass (pass^k, not
best-of-k). The threshold is 1.0. For an auto decision the merge (person or unattended) is
scored too. The scenarios are in shared/eval/gate-scenarios.json, which the TypeScript suite
reads as well.
"""

import copy
import json
import random
from dataclasses import dataclass, field, replace

import pytest

from repair_loop.config import SHARED_DIR
from repair_loop.gate import gate
from repair_loop.models import Budget, EvidenceBundle, Reproduction
from support.builders import bundle_from_diff, make_diff, patch_text, policy

SHARED = json.loads((SHARED_DIR / "eval" / "gate-scenarios.json").read_text())
K = SHARED["k"]
THRESHOLD = SHARED["threshold"]


def pick(value, fallback):
    """A value in the shared file is either the same for both languages or keyed by language."""
    if value is None:
        return fallback
    return value["python"] if isinstance(value, dict) else value


def bundle_overrides(raw: dict) -> dict:
    """Map the shared file's camelCase bundle fields onto the Python records."""
    out = {}
    if "reproduction" in raw:
        r = raw["reproduction"]
        out["reproduction"] = Reproduction(r["redOnBase"], r["greenOnCandidate"], r["frozenSha256"], r["currentSha256"])
    if "budget" in raw:
        b = raw["budget"]
        out["budget"] = Budget(b["attemptsUsed"], b["attemptsAllowed"], b["cooldownActive"])
    if "regression" in raw:
        out["regression"] = raw["regression"]
    if "grant" in raw:
        out["grant"] = raw["grant"]
    if "stopEngaged" in raw:
        out["stop_engaged"] = raw["stopEngaged"]
    unknown = set(raw) - {"reproduction", "budget", "regression", "grant", "stopEngaged"}
    if unknown:
        raise ValueError(f"unknown bundle fields in the shared scenarios: {sorted(unknown)}")
    return out


@dataclass
class Scenario:
    id: str
    category: str
    expected: str
    reason: str
    merge: str | None = None
    patch: str | None = None
    files: list = field(default_factory=list)
    bundle: dict = field(default_factory=dict)

    def build(self) -> EvidenceBundle:
        if self.patch is not None:
            text = patch_text(self.patch)
        else:
            text = "".join(
                make_diff(pick(f["path"], ""), pick(f.get("added"), []), pick(f.get("removed"), []), f.get("status", "modified"))
                for f in self.files
            )
        return bundle_from_diff(text, **bundle_overrides(self.bundle))


SCENARIOS = [Scenario(**s) for s in SHARED["scenarios"]]


def run_scenario(s: Scenario) -> dict:
    actual, reasons_ok = [], True
    for run in range(K):
        bundle = copy.deepcopy(s.build())
        diff = list(bundle.diff)
        random.Random(run + 1).shuffle(diff)
        result = gate(replace(bundle, diff=diff), policy)
        actual.append((result.decision, result.merge))
        reasons_ok = reasons_ok and s.reason in "\n".join(result.reasons)
    return {"actual": actual, "reasons_ok": reasons_ok, "pass_k": all(a == (s.expected, s.merge) for a in actual)}


RESULTS = {s.id: run_scenario(s) for s in SCENARIOS}


@pytest.mark.parametrize("scenario", SCENARIOS, ids=lambda s: s.id)
def test_scenario(scenario):
    result = RESULTS[scenario.id]
    assert result["actual"] == [(scenario.expected, scenario.merge)] * K
    assert result["reasons_ok"] is True


def test_suite_covers_every_decision_and_both_merges_with_at_least_30_scenarios_and_k_of_at_least_5():
    assert K >= 5
    assert THRESHOLD == 1.0
    assert len(SCENARIOS) >= 30
    assert len({s.id for s in SCENARIOS}) == len(SCENARIOS)
    assert {s.expected for s in SCENARIOS} == {"auto", "human", "block"}
    assert {s.merge for s in SCENARIOS if s.expected == "auto"} == {"person", "unattended"}
    assert [s.id for s in SCENARIOS if s.expected != "auto" and s.merge is not None] == []


def test_overall_pass_k_meets_the_threshold_and_so_does_every_category(capsys):
    passed = [s for s in SCENARIOS if RESULTS[s.id]["pass_k"] and RESULTS[s.id]["reasons_ok"]]
    overall = len(passed) / len(SCENARIOS)
    by_category = {}
    for category in sorted({s.category for s in SCENARIOS}):
        members = [s for s in SCENARIOS if s.category == category]
        by_category[category] = sum(RESULTS[s.id]["pass_k"] for s in members) / len(members)
    with capsys.disabled():
        print(f"\ngate eval: pass^{K} = {overall:.3f} over {len(SCENARIOS)} scenarios {by_category}")
    assert overall >= THRESHOLD
    assert all(score >= THRESHOLD for score in by_category.values())
