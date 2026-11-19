import json
import os
import subprocess

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


STUB_BASELINES = {
    "empty-flow": {"captured": "2026-10-20", "flow": {}, "stability": {"change_failure_rate": 0.08}},
    "empty-stability": {"captured": "2026-10-20", "flow": {"median_cycle_hours": 31}, "stability": {}},
    "flow-not-an-object": {"captured": "2026-10-20", "flow": "fast", "stability": {"change_failure_rate": 0.08}},
    "missing-stability": {"captured": "2026-10-20", "flow": {"median_cycle_hours": 31}},
    "null-values-only": {"captured": "2026-10-20", "flow": {"x": None}, "stability": {"y": None}},
    "placeholder-strings": {"captured": "2026-10-20", "flow": {"lead_time": "TBD"}, "stability": {"change_failure_rate": "TBD"}},
    "capture-date-in-the-future": {"captured": "2099-01-01", "flow": {"median_cycle_hours": 31}, "stability": {"change_failure_rate": 0.08}},
    "capture-date-not-iso": {"captured": "October 20, 2026", "flow": {"median_cycle_hours": 31}, "stability": {"change_failure_rate": 0.08}},
    "not-an-object": "[1]",
}


@pytest.mark.parametrize("name", STUB_BASELINES)
def test_a_stub_baseline_does_not_satisfy_the_baseline_probe(cli, git_fixture_repo, name):
    directory = git_fixture_repo("adopter")
    baseline = STUB_BASELINES[name]
    (directory / ".autonomy" / "baseline.json").write_text(baseline if isinstance(baseline, str) else json.dumps(baseline))
    measuring = census(cli, directory)["dimensions"]["measuring"]
    assert measuring["level"] == 2
    assert "baseline" not in measuring["evidence"]
    assert "baseline" in measuring["missing_for_next"]


# Shared with the TypeScript suite: fixtures/census/non-author-approval.json.
APPROVAL_CASES = {c["name"]: c for c in fixture_json("census", "non-author-approval.json")["cases"]}


@pytest.mark.parametrize("name", APPROVAL_CASES)
def test_non_author_approval_needs_an_active_default_branch_ruleset_and_a_named_code_owner(cli, git_fixture_repo, name):
    case = APPROVAL_CASES[name]
    directory = git_fixture_repo("adopter")
    ruleset = case["ruleset"] if isinstance(case["ruleset"], str) else json.dumps(case["ruleset"])
    (directory / ".github" / "rulesets" / "main.json").write_text(ruleset)
    for path, text in case["files"].items():
        if text is None:
            (directory / path).unlink()
        else:
            (directory / path).write_text(text)
    governance = census(cli, directory)["dimensions"]["governance"]
    assert ("non-author-approval" in governance["evidence"]) is case["met"]
    assert ("non-author-approval" in governance["missing_for_next"]) is not case["met"]


def commit_at(directory, date):
    env = {**os.environ, "GIT_AUTHOR_DATE": date, "GIT_COMMITTER_DATE": date}
    base = ["git", "-c", "user.name=fixture", "-c", "user.email=fixture@example.invalid"]
    for args in (["add", "-A"], ["commit", "-q", "-m", "change"]):
        subprocess.run([*base, *args], cwd=directory, env=env, check=True, capture_output=True)


def test_claude_md_fresh_follows_the_agents_md_import(cli, git_fixture_repo):
    directory = git_fixture_repo("rules-import", "2026-01-01T00:00:00Z")
    assert "claude-md-fresh" in census(cli, directory)["dimensions"]["shared_context"]["missing_for_next"]
    with open(directory / "AGENTS.md", "a") as f:
        f.write("2. Every change has a test.\n")
    commit_at(directory, "2026-11-01T00:00:00Z")
    assert "claude-md-fresh" not in census(cli, directory)["dimensions"]["shared_context"]["missing_for_next"]


def test_claude_md_fresh_ignores_an_agents_md_that_claude_md_does_not_import(cli, git_fixture_repo):
    directory = git_fixture_repo("rules-agents-not-imported", "2026-01-01T00:00:00Z")
    with open(directory / "AGENTS.md", "a") as f:
        f.write("2. Every change has a test.\n")
    commit_at(directory, "2026-11-01T00:00:00Z")
    assert "claude-md-fresh" in census(cli, directory)["dimensions"]["shared_context"]["missing_for_next"]


def test_claude_md_short_counts_claude_md_and_the_imported_agents_md_together_against_200_lines(cli, git_fixture_repo):
    directory = git_fixture_repo("rules-import")
    claude_lines = len((directory / "CLAUDE.md").read_text().split("\n")) - 1
    agents = directory / "AGENTS.md"
    agents_lines = len(agents.read_text().split("\n")) - 1
    agents.write_text(agents.read_text() + "- rule\n" * (200 - claude_lines - agents_lines))
    assert "claude-md-short" not in census(cli, directory)["dimensions"]["shared_context"]["missing_for_next"]
    with open(agents, "a") as f:
        f.write("- one more\n")
    assert "claude-md-short" in census(cli, directory)["dimensions"]["shared_context"]["missing_for_next"]


def test_check_command_and_author_trailer_read_the_agents_md_that_claude_md_imports(cli, git_fixture_repo):
    directory = git_fixture_repo("adopter")
    (directory / "AGENTS.md").write_text((directory / "CLAUDE.md").read_text())
    (directory / "CLAUDE.md").write_text("# Adopter project\n\n@AGENTS.md\n")
    dims = census(cli, directory)["dimensions"]
    assert dims["platform"]["level"] == 3
    assert "check-command" in dims["platform"]["evidence"]
    assert dims["ownership"]["level"] == 3
    assert "author-trailer" in dims["ownership"]["evidence"]


def test_the_census_text_output_names_the_probes_that_block_each_dimensions_next_position(cli, git_fixture_repo):
    directory = git_fixture_repo("bare")
    lines = cli(["census", "--dir", str(directory), "--now", NOW]).stdout.strip().split("\n")
    assert lines[1:10] == [
        "cap: 1",
        "platform: 1 (next: agent-config)",
        "shared_context: 2 (next: claude-md-owner, decision-log, blocking-hook-tested)",
        "operating_model: 1 (next: ci-tests-lint)",
        "governance: 1 (next: constitutional-rules)",
        "ownership: 1 (next: register-owners)",
        "skill: unknown (next: worksheet:skill)",
        "measuring: 1 (next: outcome-tracking)",
        f"worksheet: {directory.resolve() / '.autonomy' / 'worksheet.json'}",
    ]
