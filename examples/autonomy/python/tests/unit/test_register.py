import copy

import pytest

from autonomy.register import load_register_file, validate_register
from tests.conftest import fixture, fixture_json

EXPECTED = fixture_json("registers", "invalid", "expected.json")


def test_the_valid_example_register_has_no_schema_errors():
    assert validate_register(load_register_file(fixture("registers", "valid", ".autonomy.yaml"))) == []


@pytest.mark.parametrize("name", sorted(EXPECTED))
def test_invalid_register_fails_with_exactly_the_expected_errors(name):
    errors = validate_register(load_register_file(fixture("registers", "invalid", f"{name}.yaml")))
    assert errors == EXPECTED[name]


def test_every_invalid_fixture_has_an_expectation():
    files = sorted(p.stem for p in fixture("registers", "invalid").glob("*.yaml"))
    assert files == sorted(EXPECTED)


def test_a_level_3_workflow_with_a_full_trifecta_passes_once_a_gate_is_named():
    register = load_register_file(fixture("registers", "invalid", "trifecta-no-gate.yaml"))
    register["workflows"][0]["risk"]["gate"] = "required-approval-check"
    assert validate_register(register) == []


def test_a_level_2_workflow_with_a_full_trifecta_needs_no_gate():
    register = copy.deepcopy(load_register_file(fixture("registers", "invalid", "trifecta-no-gate.yaml")))
    register["workflows"][0]["granted_level"] = 2
    assert validate_register(register) == []


def test_dates_stay_strings_so_the_schema_pattern_applies():
    register = load_register_file(fixture("registers", "valid", ".autonomy.yaml"))
    assert register["workflows"][0]["stop"]["last_tested"] == "2026-11-02"


def test_yaml_1_1_words_stay_strings_on_yes_and_no_are_not_booleans(tmp_path):
    path = tmp_path / "r.yaml"
    path.write_text("trigger: on\nname: yes\nother: no\nflag: true\n")
    assert load_register_file(path) == {"trigger": "on", "name": "yes", "other": "no", "flag": True}


def test_a_trailing_newline_does_not_satisfy_the_date_pattern():
    register = load_register_file(fixture("registers", "valid", ".autonomy.yaml"))
    register["workflows"][0]["review_date"] = "2027-02-01\n"
    assert [f"{e['path']}:{e['keyword']}" for e in validate_register(register)] == ["/workflows/0/review_date:pattern"]
