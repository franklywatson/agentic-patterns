import copy
from dataclasses import replace

import pytest

from repair_loop.gate import gate, merge_for
from repair_loop.models import Budget, Reproduction
from support.builders import bundle_from_diff, clean_bundle, make_diff, patch_text, policy


def decide(**overrides):
    return gate(clean_bundle(**overrides), policy)


def test_clean_evidence_within_the_ceiling_returns_auto():
    result = decide()
    assert result.decision == "auto"
    assert result.reasons == ["all mechanical checks passed within the ceiling"]
    assert result.merge == "person"


def test_a_changed_reproduction_hash_blocks():
    result = decide(reproduction=Reproduction(True, True, "a", "b"))
    assert result.decision == "block"
    assert "reproduction test changed after it was frozen" in result.reasons


@pytest.mark.parametrize("status", ["modified", "added"])
def test_any_change_under_tests_blocks_modified_or_added(status):
    result = gate(bundle_from_diff(make_diff("tests/unit/other_test.py", ["x"], ["y"] if status == "modified" else [], status)), policy)
    assert result.decision == "block"
    assert "diff touches protected path tests/unit/other_test.py" in result.reasons


def test_a_deleted_test_blocks():
    bundle = bundle_from_diff(make_diff("tests/unit/other_test.py", [], ["y"]))
    deleted = replace(bundle.diff[0], status="deleted")
    assert gate(replace(bundle, diff=[deleted]), policy).decision == "block"


@pytest.mark.parametrize("path", ["tests/conftest.py", "tests/repro/httpx.py", "tests/regression/__init__.py"])
def test_a_conftest_or_shadowing_module_added_under_tests_blocks(path):
    assert gate(bundle_from_diff(make_diff(path, ["x"], [], "added")), policy).decision == "block"


@pytest.mark.parametrize("path", ["app/src/routes/../auth.py", "tests/../app/src/routes/evil.py", "/etc/passwd", "../escape.py"])
def test_a_path_with_dotdot_segments_blocks_whatever_it_resolves_to(path):
    result = gate(bundle_from_diff(make_diff(path, ["x"], [], "added")), policy)
    assert result.decision == "block"
    assert "unsafe path" in "\n".join(result.reasons)


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
    assert "grant A2 is below A3" in decide(grant="A2").reasons


def test_below_a4_a_person_merges_every_auto_change():
    assert decide(grant="A3").merge == "person"
    assert gate(bundle_from_diff(make_diff("docs/notes.md", ["text"])), policy).merge == "person"


def test_at_a4_only_r0_and_r1_at_b0_merge_unattended_and_an_r2_fix_is_merged_by_a_person():
    assert gate(bundle_from_diff(make_diff("docs/notes.md", ["text"]), grant="A4"), policy).merge == "unattended"
    result = decide(grant="A4")
    assert (result.decision, result.merge) == ("auto", "person")


def test_at_a5_an_r2_change_merges_unattended_only_at_b0_and_only_when_every_file_is_on_a_named_path():
    assert decide(grant="A5").merge == "unattended"
    assert gate(bundle_from_diff(make_diff("app/src/health.py", ["ok = True"]), grant="A5"), policy).merge == "person"
    mixed = make_diff("app/src/routes/users.py", ["ok = True"]) + make_diff("docs/notes.md", ["text"])
    assert gate(bundle_from_diff(mixed, grant="A5"), policy).merge == "person"


def test_human_and_block_decisions_carry_no_merge():
    assert decide(grant="A2").merge is None
    assert decide(grant="A5", regression="fail").merge is None


def test_r3_and_r4_never_merge_unattended_even_under_a_policy_that_names_a_higher_ceiling():
    loose = replace(
        policy,
        auto_ceiling={"reversibility": "R4", "blast": "B3"},
        unattended_ceiling={"A5": {"reversibility": "R4", "blast": "B3"}},
    )
    schema = bundle_from_diff(make_diff("app/src/routes/users.py", ['conn.execute("ALTER TABLE users ADD COLUMN x INT")']), grant="A5")
    result = gate(schema, loose)
    assert (result.decision, result.merge) == ("auto", "person")


def test_a_spent_budget_and_an_active_cooldown_each_route_to_a_human():
    assert decide(budget=Budget(1, 1, False)).decision == "human"
    assert decide(budget=Budget(0, 1, True)).decision == "human"


def test_block_outranks_human_and_only_its_reasons_are_listed():
    result = decide(grant="A1", regression="fail")
    assert result.decision == "block"
    assert result.reasons == ["regression suite is not green on the candidate"]


INSTRUCTION_PATHS = [
    "CLAUDE.md", "AGENTS.md", "app/CLAUDE.md", "docs/AGENTS.md", ".claude/CLAUDE.md", ".claude/rules/style.md",
    ".claude/agents/fixer.md", ".claude/commands/ship.md", ".claude/skills/review/SKILL.md", ".claude/skills/review/run.sh", ".mcp.json",
    "claude.md", "Agents.md", ".Claude/Skills/x/SKILL.md",
]


@pytest.mark.parametrize("path", INSTRUCTION_PATHS)
@pytest.mark.parametrize("grant", ["A4", "A5"])
def test_instruction_and_tool_configuration_files_are_medium_tier_and_merged_by_a_person(path, grant):
    bundle = bundle_from_diff(make_diff(path, ["text"]), grant=grant)
    result = gate(bundle, policy)
    assert (result.decision, result.merge) == ("auto", "person")
    assert bundle.classification.blast == "B1"


@pytest.mark.parametrize("path", ["Tests/unit/x_test.py", "TESTS/x.py", "Shared/Config/repair-policy.json", ".Autonomy.yaml", ".GitHub/workflows/ci.yml"])
def test_a_protected_path_in_another_case_still_blocks(path):
    result = gate(bundle_from_diff(make_diff(path, ["x"])), policy)
    assert result.decision == "block"
    assert "protected path" in "\n".join(result.reasons)


def test_a_person_merges_below_a4_even_when_the_policy_names_an_unattended_ceiling_for_the_grant():
    loose = replace(policy, unattended_ceiling={**policy.unattended_ceiling, "A3": {"reversibility": "R1", "blast": "B0"}})
    assert gate(bundle_from_diff(make_diff("docs/notes.md", ["text"]), grant="A3"), loose).merge == "person"
    assert gate(bundle_from_diff(make_diff("docs/notes.md", ["text"]), grant="A4"), loose).merge == "unattended"


def test_merge_for_keeps_a_person_on_an_r2_change_with_an_empty_diff_or_an_unsafe_path_even_at_a5():
    named = bundle_from_diff(make_diff("app/src/routes/users.py", ["ok = True"]), grant="A5")
    assert merge_for(named, policy) == "unattended"
    assert merge_for(replace(named, diff=[]), policy) == "person"
    assert merge_for(replace(named, diff=[replace(named.diff[0], path="app/src/routes/../routes/users.py")]), policy) == "person"


def test_the_gate_does_not_mutate_its_inputs():
    bundle = clean_bundle()
    before = copy.deepcopy(bundle)
    gate(bundle, policy)
    assert bundle == before
    assert replace(bundle) == before
