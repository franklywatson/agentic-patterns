from autonomy.levels import cap_of, dimension_level, effective_level, profile_status
from autonomy.util import parse_time

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
    assert cap_of(dims({"platform": 5, "governance": 3, "ownership": 4, "measuring": 5})) == 3


def test_a_dimension_outside_the_capping_four_does_not_lower_the_cap():
    assert cap_of(dims({"platform": 4, "governance": 4, "ownership": 4, "measuring": 4, "skill": 1})) == 4


def test_unknown_counts_as_level_2():
    assert dimension_level(dims({"measuring": "unknown"}), "measuring") == 2
    assert cap_of(dims({"platform": 4, "governance": 4, "ownership": 4, "measuring": "unknown"})) == 2


def test_a_missing_profile_caps_at_1():
    assert cap_of(None) == 1
    assert cap_of({"dimensions": FULL["dimensions"]}) == 1
    assert cap_of([]) == 1


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


def test_counted_as_in_a_profile_cannot_raise_the_cap_unknown_is_always_2():
    forged = {"generated": "2026-11-10T00:00:00Z", "dimensions": {"platform": {"level": 4}, "governance": {"level": 4}, "ownership": {"level": 4}, "measuring": {"level": "unknown", "counted_as": 5}}}
    assert cap_of(forged) == 2


def test_a_level_outside_1_to_5_counts_as_2():
    def dims_for(level):
        return {"generated": "2026-11-10T00:00:00Z", "dimensions": {"platform": {"level": 4}, "governance": {"level": 4}, "ownership": {"level": 4}, "measuring": {"level": level}}}

    assert cap_of(dims_for(9)) == 2
    assert cap_of(dims_for(0)) == 2
    assert cap_of(dims_for(2.5)) == 2
