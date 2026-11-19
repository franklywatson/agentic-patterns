import copy

import pytest

from autonomy.eval import run_once, score_all, score_scenario
from tests.conftest import fixture_json

SUITE = fixture_json("eval", "scenarios.json")
PROJECT = SUITE["project_dir"]


def scenario(scenario_id):
    return next(s for s in SUITE["scenarios"] if s["id"] == scenario_id)


def test_the_suite_repeats_each_scenario_at_least_5_times():
    assert SUITE["k"] >= 5


def test_the_suite_covers_a2_a3_a4_cap_below_grant_stale_stop_and_a_trifecta_session():
    ids = [s["id"] for s in SUITE["scenarios"]]
    for wanted in ["a2-reviewed", "a3-gated", "a4-unattended", "cap-below-grant", "stale-stop", "trifecta-tainted"]:
        assert wanted in ids, wanted


@pytest.mark.parametrize("scenario_id", [s["id"] for s in SUITE["scenarios"]])
def test_pass_k(scenario_id):
    score = score_scenario(scenario(scenario_id), SUITE["k"], PROJECT)
    assert score["mismatches"] == []
    assert score["score"] == 1


def test_the_overall_score_is_exactly_1():
    scores = score_all(SUITE)
    assert sum(s["score"] for s in scores) == len(scores)


def test_the_scorer_can_fail_a_wrong_expectation_scores_0_and_names_the_mismatch():
    broken = copy.deepcopy(scenario("a3-gated"))
    broken["calls"][1]["expect"] = "allow"
    score = score_scenario(broken, 5, PROJECT)
    assert score["score"] == 0
    assert len(score["mismatches"]) == 5
    assert "push-main: got deny protected-branch-push, expected allow" in score["mismatches"][0]


def test_the_scorer_can_fail_a_wrong_denial_code_scores_0():
    broken = copy.deepcopy(scenario("a3-gated"))
    broken["calls"][1]["code"] = "merge-blocked"
    assert score_scenario(broken, 5, PROJECT)["score"] == 0


def test_the_scorer_can_fail_a_wrong_effective_level_scores_0():
    broken = copy.deepcopy(scenario("stale-stop"))
    broken["expect_effective"] = 4
    assert score_scenario(broken, 5, PROJECT)["score"] == 0


def test_a_scenario_is_deterministic_repeated_runs_give_identical_outcomes():
    s = scenario("a4-unattended")
    first = run_once(s, PROJECT)
    for _ in range(5):
        assert run_once(s, PROJECT) == first


def test_the_same_a4_grant_gets_different_outcomes_under_the_cap_stale_stop_and_clean_scenarios():
    def by_id(scenario_id):
        return run_once(scenario(scenario_id), PROJECT)

    assert by_id("a4-unattended")["effective"] == 4
    assert by_id("cap-below-grant")["effective"] == 2
    assert by_id("stale-stop")["effective"] == 2
    assert by_id("a4-unattended")["calls"][-1]["allow"] is True
    assert by_id("cap-below-grant")["calls"][0]["allow"] is False
