import copy
from dataclasses import replace

from repair_loop.gate import gate
from repair_loop.models import Budget, Reproduction
from support.builders import bundle_from_diff, clean_bundle, make_diff, patch_text, policy


def decide(**overrides):
    return gate(clean_bundle(**overrides), policy)


def test_clean_evidence_within_the_ceiling_returns_auto():
    result = decide()
    assert result.decision == "auto"
    assert result.reasons == ["all mechanical checks passed within the ceiling"]


def test_a_changed_reproduction_hash_blocks():
    result = decide(reproduction=Reproduction(True, True, "a", "b"))
    assert result.decision == "block"
    assert "reproduction test changed after it was frozen" in result.reasons


def test_an_existing_test_modified_by_the_diff_blocks():
    result = gate(bundle_from_diff(make_diff("tests/unit/other_test.py", ["x"], ["y"])), policy)
    assert result.decision == "block"
    assert "diff modifies existing test tests/unit/other_test.py" in result.reasons


def test_a_new_test_file_is_allowed():
    assert gate(bundle_from_diff(make_diff("tests/unit/new_test.py", ["x"], [], "added")), policy).decision == "auto"


def test_the_register_file_is_protected_whatever_its_status():
    assert gate(bundle_from_diff(make_diff(".autonomy.yaml", ["grant: A5"], [], "added")), policy).decision == "block"


def test_a_candidate_that_leaves_the_reproduction_red_is_blocked():
    assert decide(reproduction=Reproduction(True, False, "a", "a")).decision == "block"


def test_a_failing_regression_suite_blocks():
    assert decide(regression="fail").decision == "block"


def test_an_engaged_stop_switch_blocks_even_clean_evidence():
    assert decide(stop_engaged=True).decision == "block"


def test_a_reproduction_that_was_not_red_on_base_routes_to_a_human():
    result = decide(reproduction=Reproduction(False, True, "a", "a"))
    assert result.decision == "human"
    assert "cannot reproduce" in result.reasons[0]


def test_the_masking_patch_routes_to_a_human():
    result = gate(bundle_from_diff(patch_text("INC-001.mask.patch")), policy)
    assert result.decision == "human"
    assert "anti-masking scan" in result.reasons[0]


def test_a_class_above_the_ceiling_routes_to_a_human():
    result = gate(bundle_from_diff(make_diff("app/src/auth.py", ["a = 1"])), policy)
    assert result.decision == "human"
    assert "R2/B3 is above the ceiling R2/B1" in result.reasons[0]


def test_a_grant_below_a3_routes_to_a_human():
    assert decide(grant="A2").decision == "human"


def test_a_spent_budget_and_an_active_cooldown_each_route_to_a_human():
    assert decide(budget=Budget(1, 1, False)).decision == "human"
    assert decide(budget=Budget(0, 1, True)).decision == "human"


def test_block_outranks_human_and_only_its_reasons_are_listed():
    result = decide(grant="A1", regression="fail")
    assert result.decision == "block"
    assert result.reasons == ["regression suite is not green on the candidate"]


def test_the_gate_does_not_mutate_its_inputs():
    bundle = clean_bundle()
    before = copy.deepcopy(bundle)
    gate(bundle, policy)
    assert bundle == before
    assert replace(bundle) == before
