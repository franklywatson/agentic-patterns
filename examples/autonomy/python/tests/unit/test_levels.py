import pytest

from autonomy.levels import cap_of, dimension_level, effective_level, profile_status
from autonomy.util import parse_time
from tests.conftest import fixture_json

NOW = parse_time("2026-11-18T00:00:00Z")


def dims(levels):
    return {
        "generated": "2026-11-10T00:00:00Z",
        "dimensions": {k: ({"level": "unknown", "counted_as": 2} if v == "unknown" else {"level": v}) for k, v in levels.items()},
    }


def wf(**over):
    base = {"id": "w", "granted_level": 4, "stop": {"last_tested": "2026-11-02"}, "review_date": "2027-02-01", "access_expires": "2027-02-01"}
    return {**base, **over}


FULL = dims({"platform": 4, "governance": 4, "ownership": 4, "measuring": 4})


def test_cap_is_the_minimum_of_the_four_capping_dimensions():
    assert cap_of(dims({"platform": 5, "governance": 3, "ownership": 4, "measuring": 5}), NOW) == 3


def test_a_dimension_outside_the_capping_four_does_not_lower_the_cap():
    assert cap_of(dims({"platform": 4, "governance": 4, "ownership": 4, "measuring": 4, "skill": 1}), NOW) == 4


def test_skill_recorded_as_unknown_does_not_lower_the_cap():
    assert cap_of(dims({"platform": 4, "governance": 4, "ownership": 4, "measuring": 4, "skill": "unknown"}), NOW) == 4


def test_a_capping_dimension_recorded_as_unknown_counts_as_1():
    assert dimension_level(dims({"measuring": "unknown"}), "measuring") == 1
    assert cap_of(dims({"platform": 4, "governance": 4, "ownership": 4, "measuring": "unknown"}), NOW) == 1


def test_an_absent_capping_dimension_counts_as_1():
    assert cap_of(dims({"platform": 4, "governance": 4, "ownership": 4}), NOW) == 1


def test_a_profile_with_no_capping_dimensions_caps_at_1():
    assert cap_of({"generated": "2026-11-10T00:00:00Z"}, NOW) == 1
    assert cap_of({"generated": "2026-11-10T00:00:00Z", "dimensions": {}}, NOW) == 1
    assert cap_of({"generated": "2026-11-10T00:00:00Z", "dimensions": []}, NOW) == 1
    assert cap_of({"generated": "2026-11-10T00:00:00Z", "dimensions": "x"}, NOW) == 1


def test_a_dimension_entry_that_is_not_an_object_counts_as_1():
    profile = {"generated": "2026-11-10T00:00:00Z", "dimensions": {"platform": 4, "governance": {"level": 4}, "ownership": {"level": 4}, "measuring": {"level": 4}}}
    assert cap_of(profile, NOW) == 1


def test_a_missing_profile_caps_at_1():
    assert cap_of(None, NOW) == 1
    assert cap_of({"dimensions": FULL["dimensions"]}, NOW) == 1
    assert cap_of([], NOW) == 1
    assert cap_of("x", NOW) == 1
    assert cap_of(5, NOW) == 1


@pytest.mark.parametrize("generated", ["2099-01-01", "2026-11-18T00:00:01Z", "November 18, 2026", "", "2026-11-18T00:00:00", "20261118", "2026-02-31"])
def test_a_generated_time_in_the_future_or_not_an_iso_date_counts_as_a_missing_profile(generated):
    profile = {**FULL, "generated": generated}
    assert cap_of(profile, NOW) == 1
    assert profile_status(profile, NOW) == "missing"
    assert effective_level(wf(), profile, None, {}, NOW).effective == 1


def test_a_generated_time_up_to_now_with_any_offset_is_accepted():
    assert cap_of({**FULL, "generated": "2026-11-18T00:00:00Z"}, NOW) == 4
    assert cap_of({**FULL, "generated": "2026-11-18T01:00:00+02:00"}, NOW) == 4


def test_a_missing_profile_holds_every_grant_at_1():
    e = effective_level({"id": "interactive", "granted_level": 2}, None, None, {}, NOW)
    assert e.effective == 1
    assert e.reasons == ["cap:1"]


def test_profile_status_distinguishes_ok_stale_and_missing():
    assert profile_status(FULL, NOW) == "ok"
    assert profile_status({**FULL, "generated": "2026-10-01T00:00:00Z"}, NOW) == "stale"
    assert profile_status(None, NOW) == "missing"


def test_effective_level_equals_the_grant_when_every_gate_is_open():
    e = effective_level(wf(), FULL, None, {}, NOW)
    assert e.effective == 4
    assert e.reasons == []


def test_a_cap_below_the_grant_lowers_the_effective_level_and_names_the_cap():
    e = effective_level(wf(), dims({"platform": 3, "governance": 4, "ownership": 4, "measuring": 4}), None, {}, NOW)
    assert e.effective == 3
    assert e.reasons == ["cap:3"]


def test_a_stop_test_older_than_the_default_30_days_drops_a_level_4_workflow_to_2():
    e = effective_level(wf(stop={"last_tested": "2026-10-01"}), FULL, None, {}, NOW)
    assert e.effective == 2
    assert e.reasons == ["freshness:stop-test-overdue"]


def test_stop_test_max_age_days_from_the_register_defaults_is_honoured():
    e = effective_level(wf(stop={"last_tested": "2026-10-01"}), FULL, None, {"stop_test_max_age_days": 60}, NOW)
    assert e.effective == 4


def test_a_passed_review_date_and_an_expired_access_each_drop_the_grant_to_2():
    assert effective_level(wf(review_date="2026-11-01"), FULL, None, {}, NOW).effective == 2
    assert effective_level(wf(access_expires="2026-11-01"), FULL, None, {}, NOW).effective == 2


def test_a_stale_profile_drops_the_grant_to_2():
    e = effective_level(wf(), {**FULL, "generated": "2026-09-01T00:00:00Z"}, None, {}, NOW)
    assert e.effective == 2
    assert e.reasons == ["freshness:profile-stale"]


def test_a_harness_hash_without_a_passing_task_bank_caps_the_grant_at_3():
    state = {"workflows": {"w": {"harness_hash": "sha256:new", "task_bank_passed_hash": "sha256:old"}}}
    e = effective_level(wf(), FULL, state, {}, NOW)
    assert e.effective == 3
    assert e.reasons == ["harness:task-bank-not-passed"]


def test_a_matching_harness_hash_leaves_the_grant_alone():
    state = {"workflows": {"w": {"harness_hash": "sha256:a", "task_bank_passed_hash": "sha256:a"}}}
    assert effective_level(wf(), FULL, state, {}, NOW).effective == 4


def test_a_demotion_override_lowers_the_effective_level():
    e = effective_level(wf(), FULL, {"workflows": {"w": {"demotion_override": 3}}}, {}, NOW)
    assert e.effective == 3
    assert e.reasons == ["demotion:3"]


def test_the_effective_level_is_the_minimum_of_all_gates():
    state = {"workflows": {"w": {"demotion_override": 3}}}
    profile = dims({"platform": 3, "governance": 4, "ownership": 4, "measuring": 4})
    assert effective_level(wf(review_date="2026-11-01"), profile, state, {}, NOW).effective == 2


def test_counted_as_in_a_profile_cannot_raise_the_cap_an_unknown_capping_dimension_is_1():
    forged = {"generated": "2026-11-10T00:00:00Z", "dimensions": {"platform": {"level": 4}, "governance": {"level": 4}, "ownership": {"level": 4}, "measuring": {"level": "unknown", "counted_as": 5}}}
    assert cap_of(forged, NOW) == 1


def test_a_level_outside_1_to_5_counts_as_1():
    def dims_for(level):
        return {"generated": "2026-11-10T00:00:00Z", "dimensions": {"platform": {"level": 4}, "governance": {"level": 4}, "ownership": {"level": 4}, "measuring": {"level": level}}}

    assert cap_of(dims_for(9), NOW) == 1
    assert cap_of(dims_for(0), NOW) == 1
    assert cap_of(dims_for(2.5), NOW) == 1
    assert cap_of(dims_for("4"), NOW) == 1
    assert cap_of(dims_for(True), NOW) == 1


@pytest.mark.parametrize("state", [[], "x", 5, {"workflows": []}, {"workflows": {"w": "x"}}])
def test_a_state_file_that_is_not_an_object_applies_no_override_and_does_not_raise(state):
    assert effective_level(wf(), FULL, state, {}, NOW).effective == 4


# Shared with the TypeScript suite: fixtures/parity/levels.json.
LEVEL_CASES = fixture_json("parity", "levels.json")


@pytest.mark.parametrize("case", LEVEL_CASES["cases"], ids=lambda c: c["name"])
def test_level_edge_cases_give_the_same_grant_cap_and_effective_level_in_both_languages(case):
    e = effective_level(case["workflow"], case["profile"], case["state"], {}, parse_time(LEVEL_CASES["now"]))
    assert {"granted": e.granted, "cap": e.cap, "effective": e.effective} == case["expect"]
    assert type(e.granted) is int and type(e.effective) is int
