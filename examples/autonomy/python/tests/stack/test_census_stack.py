import json

import pytest

from tests.conftest import NOW, fixture_json


def census(cli, directory):
    run = cli(["census", "--dir", str(directory), "--now", NOW])
    assert run.returncode == 0, run.stderr
    return json.loads((directory / ".autonomy" / "profile.json").read_text())


def test_census_on_the_adopter_repository_writes_the_golden_profile_and_a_cap_of_3(cli, git_fixture_repo):
    profile = census(cli, git_fixture_repo("adopter"))
    assert profile == fixture_json("expected", "census-adopter.json")
    assert profile["cap"] == 3
    assert profile["workflows_over_cap"] == ["dep-bump"]
    assert {k: v["level"] for k, v in profile["dimensions"].items()} == {
        "platform": 3, "shared_context": 3, "operating_model": 4, "governance": 3, "ownership": 3, "skill": "unknown", "measuring": 3,
    }


def test_census_counts_an_unknown_dimension_as_level_2_and_writes_a_dated_worksheet(cli, git_fixture_repo):
    directory = git_fixture_repo("adopter")
    profile = census(cli, directory)
    assert profile["dimensions"]["skill"] == {"level": "unknown", "counted_as": 2, "evidence": [], "missing_for_next": ["worksheet:skill"]}
    worksheet = json.loads((directory / ".autonomy" / "worksheet.json").read_text())
    assert worksheet["generated"] == NOW
    assert [f"{i['dimension']}/{i['step']}" for i in worksheet["items"]] == [
        "skill/work-sample", "skill/perception-survey", "operating_model/merge-sample", "shared_context/governed-connectors",
    ]


def test_census_on_a_bare_repository_gives_a_cap_of_1(cli, git_fixture_repo):
    profile = census(cli, git_fixture_repo("bare"))
    assert profile == fixture_json("expected", "census-bare.json")
    assert profile["cap"] == 1
    assert profile["dimensions"]["shared_context"]["level"] == 2


def test_presence_without_practice_does_not_count_a_stale_claude_md_loses_the_freshness_probe(cli, git_fixture_repo):
    profile = census(cli, git_fixture_repo("adopter", "2026-01-01T00:00:00Z"))
    assert profile["dimensions"]["shared_context"]["level"] == 2
    assert profile["dimensions"]["shared_context"]["missing_for_next"] == ["claude-md-fresh", "decision-log"]


def skill_dimension(cli, git_fixture_repo, date):
    directory = git_fixture_repo("adopter")
    (directory / ".autonomy" / "worksheets").mkdir(parents=True)
    (directory / ".autonomy" / "worksheets" / "skill.json").write_text(json.dumps({"date": date, "level": 3}))
    return census(cli, directory)["dimensions"]["skill"]


def test_a_skill_worksheet_result_within_90_days_replaces_unknown(cli, git_fixture_repo):
    assert skill_dimension(cli, git_fixture_repo, "2026-11-01") == {"level": 3, "evidence": ["worksheet:skill"], "missing_for_next": []}


def test_a_skill_worksheet_result_older_than_90_days_reverts_to_unknown(cli, git_fixture_repo):
    assert skill_dimension(cli, git_fixture_repo, "2026-06-01")["level"] == "unknown"


def test_check_fails_on_the_census_output_of_the_adopter_repository_because_dep_bump_exceeds_the_cap(cli, git_fixture_repo):
    directory = git_fixture_repo("adopter")
    census(cli, directory)
    run = cli(["check", "--dir", str(directory), "--now", NOW, "--json", "--no-commits"])
    assert run.returncode == 1
    assert json.loads(run.stdout)["failures"] == [{"code": "grant-exceeds-cap", "workflow": "dep-bump", "granted": 4, "cap": 3}]


def test_check_passes_after_the_grant_is_lowered_to_the_cap(cli, git_fixture_repo):
    directory = git_fixture_repo("adopter")
    census(cli, directory)
    path = directory / ".autonomy.yaml"
    original = path.read_text()
    lowered = original.replace("granted_level: 4", "granted_level: 3")
    assert lowered != original
    path.write_text(lowered)
    assert cli(["check", "--dir", str(directory), "--now", NOW, "--no-commits"]).returncode == 0


RULES_CASES = [
    ("rules-import", True),
    ("rules-claude-only", True),
    ("rules-agents-only", True),
    ("rules-agents-not-imported", False),
    ("rules-none", False),
]


@pytest.mark.parametrize("name,expected", RULES_CASES)
def test_constitutional_rules_probe(cli, git_fixture_repo, name, expected):
    governance = census(cli, git_fixture_repo(name))["dimensions"]["governance"]
    assert ("constitutional-rules" in governance["evidence"]) is expected
    assert governance["level"] == (2 if expected else 1)
