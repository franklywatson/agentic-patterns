import json

import pytest

from autonomy.ledger import apply_demotion, build_report, read_ledger, wilson
from autonomy.register import load_register_file
from autonomy.util import parse_time, read_json, round4
from tests.conftest import NOW, fixture, fixture_json

NOW_MS = parse_time(NOW)
PROJECT = fixture("ledgers", "project")
REGISTER = load_register_file(PROJECT / ".autonomy.yaml")
PROFILE = read_json(PROJECT / ".autonomy" / "profile.json")


def wf_of(workflow_id):
    return next(w for w in REGISTER["workflows"] if w["id"] == workflow_id)


def report(workflow_id, wf=None, runs=None, state=None):
    return build_report(wf or wf_of(workflow_id), runs if runs is not None else read_ledger(PROJECT, workflow_id), PROFILE, state, REGISTER["defaults"], NOW_MS)


def test_wilson_bounds_match_known_values():
    assert round4(wilson(0, 130)[0]) == 0
    assert round4(wilson(0, 130)[1]) == 0.0287
    assert round4(wilson(129, 130)[0]) == 0.9577
    assert round4(wilson(5, 5)[0]) == 0.5655
    assert round4(wilson(5, 5)[1]) == 1


def test_wilson_bounds_with_no_observations_span_the_whole_interval():
    assert wilson(0, 0) == (0, 1)


def test_five_lucky_runs_cannot_clear_the_0_80_lower_bound():
    assert wilson(5, 5)[0] < 0.8


def test_zero_reverts_clear_the_3_percent_upper_bound_only_from_125_merged_runs():
    assert wilson(0, 124)[1] > 0.03
    assert wilson(0, 125)[1] <= 0.03


@pytest.mark.parametrize("workflow_id", ["dep-bump", "dep-hold", "dep-regress", "dep-incident"])
def test_ledger_report_matches_the_shared_golden_report(workflow_id):
    assert report(workflow_id) == fixture_json("expected", f"ledger-{workflow_id}.json")


def test_a_workflow_with_enough_clean_evidence_is_ready_for_promotion():
    r = report("dep-bump")
    assert r["band"] == "promote"
    assert r["promotion_ready"] is True
    assert r["demotion"]["triggered"] is False


def test_hysteresis_an_upper_bound_between_3_and_6_percent_neither_promotes_nor_demotes():
    r = report("dep-hold")
    assert r["band"] == "hold"
    assert r["promotion_ready"] is False
    assert r["demotion"]["triggered"] is False
    assert 0.03 < r["revert"]["upper"] <= 0.06


def test_an_upper_bound_above_6_percent_with_reverts_demotes_to_level_3():
    r = report("dep-regress")
    assert r["band"] == "demote"
    assert r["demotion"] == {"triggered": True, "to_level": 3, "reasons": ["revert-upper-above-hysteresis"]}


def test_an_escaped_defect_demotes_to_level_2():
    r = report("dep-incident")
    assert r["demotion"] == {"triggered": True, "to_level": 2, "reasons": ["escaped-defect"]}


def test_zero_reverts_in_a_small_sample_do_not_trigger_a_revert_demotion():
    runs = [{**run, "escaped_defect": False} for run in read_ledger(PROJECT, "dep-incident")]
    assert report("dep-incident", runs=runs)["demotion"]["triggered"] is False


def test_a_run_over_the_diff_limit_demotes_to_level_3():
    runs = [{**run, "level": 4, "diff_lines": 900} if i == 0 else run for i, run in enumerate(read_ledger(PROJECT, "dep-bump"))]
    r = report("dep-bump", wf={**wf_of("dep-bump"), "granted_level": 4}, runs=runs)
    assert r["demotion"]["reasons"] == ["diff-limit-breached"]
    assert r["demotion"]["to_level"] == 3


def test_a_task_bank_score_below_the_floor_demotes_to_level_3():
    runs = [{**run, "reverted_at": None, "checks": {**run["checks"], "context-eval": 0.7}} for run in read_ledger(PROJECT, "dep-regress")]
    assert report("dep-regress", runs=runs)["demotion"]["reasons"] == ["task-bank-below-floor"]


def test_promotion_is_blocked_during_the_cooldown_after_a_demotion():
    r = report("dep-bump", state={"workflows": {"dep-bump": {"demoted_at": "2026-11-10"}}})
    assert r["promotion_ready"] is False
    assert next(c for c in r["criteria"] if c["id"] == "cooldown")["pass"] is False


def test_promotion_to_level_3_uses_the_20_run_and_0_80_criteria_and_lists_the_human_sample():
    runs = [{**run, "level": 2} for run in read_ledger(PROJECT, "dep-bump")[:25]]
    r = report("dep-bump", wf={**wf_of("dep-bump"), "granted_level": 2}, runs=runs)
    assert [c["id"] for c in r["criteria"]] == ["runs-at-level", "first-run-pass-lower", "owner-named"]
    assert r["promotion_ready"] is True
    assert r["manual_items"] == ["traced sample of 10 runs shows substantive human review"]


def test_a_workflow_at_the_top_level_has_no_promotion_target():
    r = report("dep-bump", wf={**wf_of("dep-bump"), "granted_level": 5}, runs=[])
    assert r["target_level"] is None
    assert r["promotion_ready"] is None


def test_apply_demotion_writes_an_override_and_never_raises_an_existing_one(copy_fixture):
    directory = copy_fixture("ledgers", "project")
    apply_demotion(directory, "dep-regress", 3, ["revert-upper-above-hysteresis"], NOW_MS)
    apply_demotion(directory, "dep-regress", 2, ["escaped-defect"], NOW_MS)
    apply_demotion(directory, "dep-regress", 3, ["revert-upper-above-hysteresis"], NOW_MS)
    state = json.loads((directory / ".autonomy" / "state.json").read_text())
    assert state["workflows"]["dep-regress"]["demotion_override"] == 2
    assert state["workflows"]["dep-regress"]["demoted_at"] == "2026-11-18"


def test_read_ledger_fails_loudly_when_the_ledger_is_missing():
    with pytest.raises(FileNotFoundError, match="no ledger"):
        read_ledger(PROJECT, "no-such-workflow")
