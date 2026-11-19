import subprocess

import pytest

from autonomy.check import (
    approved_prefixes,
    commits_from_git,
    format_check,
    is_agent_commit,
    is_governance_file,
    is_tier1_file,
    is_tier2_file,
    run_check,
)
from autonomy.util import parse_time
from tests.conftest import NOW, fixture, fixture_json

NOW_MS = parse_time(NOW)


def test_check_on_the_valid_register_matches_the_shared_golden_result():
    assert run_check(fixture("registers", "valid"), NOW_MS) == fixture_json("expected", "check-valid.json")


def test_check_fails_when_a_grant_exceeds_the_cap_matching_the_shared_golden_result():
    result = run_check(fixture("registers", "over-cap"), NOW_MS)
    assert result["ok"] is False
    assert result == fixture_json("expected", "check-over-cap.json")


def test_check_fails_when_the_profile_is_older_than_30_days():
    result = run_check(fixture("registers", "valid"), parse_time("2026-12-20T00:00:00Z"))
    assert result["ok"] is False
    assert {"code": "profile-stale"} in result["failures"]


def test_check_fails_when_the_profile_is_missing(copy_fixture):
    directory = copy_fixture("registers", "valid")
    (directory / ".autonomy" / "profile.json").unlink()
    result = run_check(directory, NOW_MS)
    assert result["failures"] == [
        {"code": "profile-missing"},
        {"code": "grant-exceeds-cap", "workflow": "dep-bump", "granted": 4, "cap": 2},
        {"code": "grant-exceeds-cap", "workflow": "flaky-test-triage", "granted": 3, "cap": 2},
        {"code": "grant-exceeds-cap", "workflow": "interactive", "granted": 3, "cap": 2},
    ]


def test_check_reports_schema_errors_and_stops(copy_fixture):
    directory = copy_fixture("registers", "valid")
    (directory / ".autonomy.yaml").write_text(
        "version: 1\nworkflows:\n  - id: w\n    owner: t\n    sponsor: s\n    granted_level: 3\n    identity: x\n    exception: waiver\n"
        "    risk: { reversible: true, verification: partial, blast_radius: repo, trifecta: { untrusted_input: false, sensitive_data: false, external_action: false } }\n"
    )
    result = run_check(directory, NOW_MS)
    assert result["ok"] is False
    assert result["failures"] == [{"code": "schema", "path": "/workflows/0/exception", "keyword": "additionalProperties"}]


def test_check_passes_a_stale_stop_test_but_lowers_the_effective_level(copy_fixture):
    result = run_check(copy_fixture("registers", "valid"), parse_time("2026-12-05T00:00:00Z"))
    dep = next(w for w in result["workflows"] if w["id"] == "dep-bump")
    assert result["ok"] is True
    assert dep == {"id": "dep-bump", "granted": 4, "effective": 2, "reasons": ["freshness:stop-test-overdue"]}


def agent_commit(files):
    return {"sha": "a1", "author": "deps-bot[bot]", "email": "bot@example.invalid", "files": files}


def human_commit(files):
    return {"sha": "h1", "author": "Alice", "email": "alice@example.invalid", "files": files}


def test_an_agent_commit_that_changes_autonomy_yaml_fails_the_check():
    result = run_check(fixture("registers", "valid"), NOW_MS, commits=[agent_commit([".autonomy.yaml"])])
    assert result["failures"] == [{"code": "governance-file-changed-by-agent", "commit": "a1", "file": ".autonomy.yaml"}]


def test_an_agent_commit_that_changes_codeowners_or_a_workflow_file_fails_the_check():
    commit = agent_commit(["docs/CODEOWNERS", ".github/workflows/ci.yml", "src/a.ts"])
    result = run_check(fixture("registers", "valid"), NOW_MS, commits=[commit])
    assert [(f["code"], f["file"]) for f in result["failures"]] == [
        ("governance-file-changed-by-agent", "docs/CODEOWNERS"),
        ("workflow-change-unacknowledged", ".github/workflows/ci.yml"),
    ]


def test_a_human_commit_that_changes_governance_files_passes_the_check():
    result = run_check(fixture("registers", "valid"), NOW_MS, commits=[human_commit([".autonomy.yaml", "CODEOWNERS"])])
    assert result["ok"] is True


def test_a_commit_by_a_register_identity_or_a_claude_co_author_is_an_agent_commit():
    assert is_agent_commit({"sha": "x", "author": "deps-bot", "email": "a@b.c", "files": []}, ["deps-bot"]) is True
    assert is_agent_commit({"sha": "x", "author": "Alice", "email": "a@b.c", "body": "Co-Authored-By: Claude <x@y.z>", "files": []}, []) is True
    assert is_agent_commit({"sha": "x", "author": "Alice", "email": "a@b.c", "files": []}, ["deps-bot"]) is False


def test_governance_file_patterns():
    for p in [".autonomy.yaml", ".autonomy/state.json", "CODEOWNERS", ".github/CODEOWNERS", ".github/workflows/ci.yml"]:
        assert is_governance_file(p) is True, p
    for p in ["src/autonomy.ts", "docs/autonomy.md", ".github/dependabot.yml"]:
        assert is_governance_file(p) is False, p


def test_commits_from_git_reads_authors_and_changed_files_from_a_real_repository(copy_fixture):
    directory = copy_fixture("registers", "valid")
    base = ["git", "-c", "user.name=deps-bot[bot]", "-c", "user.email=bot@example.invalid"]

    def git(*args):
        subprocess.run([*base, *args], cwd=directory, check=True, capture_output=True)

    git("init", "-q")
    git("add", "-A")
    git("commit", "-q", "-m", "base")
    with open(directory / ".autonomy.yaml", "a") as handle:
        handle.write("# edited\n")
    git("commit", "-q", "-am", "agent edit")
    commits = commits_from_git(directory, "HEAD~1..HEAD")
    assert len(commits) == 1
    assert commits[0]["files"] == [".autonomy.yaml"]
    assert commits[0]["author"] == "deps-bot[bot]"
    result = run_check(directory, NOW_MS, commits=commits)
    assert any(f["code"] == "governance-file-changed-by-agent" for f in result["failures"])


def _git(directory, name, *args):
    subprocess.run(["git", "-c", f"user.name={name}", "-c", "user.email=a@example.invalid", *args], cwd=directory, check=True, capture_output=True)


def test_a_commit_body_containing_double_at_and_unit_separators_is_parsed_intact(copy_fixture):
    directory = copy_fixture("registers", "valid")
    _git(directory, "Alice", "init", "-q")
    _git(directory, "Alice", "add", "-A")
    _git(directory, "Alice", "commit", "-q", "-m", "base")
    with open(directory / ".autonomy.yaml", "a") as handle:
        handle.write("# edited\n")
    _git(directory, "Alice", "commit", "-q", "-am", "edit\n\n@@ hunk @@ in the body\nCo-Authored-By: Claude <c@example.invalid>")
    commits = commits_from_git(directory, "HEAD~1..HEAD")
    assert len(commits) == 1
    assert commits[0]["files"] == [".autonomy.yaml"]
    assert "@@ hunk @@ in the body" in commits[0]["body"]
    assert is_agent_commit(commits[0], []) is True


def test_a_rename_out_of_a_governed_path_still_lists_the_old_path(copy_fixture):
    directory = copy_fixture("registers", "valid")
    (directory / ".github" / "workflows").mkdir(parents=True)
    (directory / ".github" / "workflows" / "ci.yml").write_text("name: ci\non: push\njobs: {}\n")
    _git(directory, "deps-bot[bot]", "init", "-q")
    _git(directory, "deps-bot[bot]", "add", "-A")
    _git(directory, "deps-bot[bot]", "commit", "-q", "-m", "base")
    (directory / "elsewhere").mkdir()
    _git(directory, "deps-bot[bot]", "mv", ".github/workflows/ci.yml", "elsewhere/ci.yml")
    _git(directory, "deps-bot[bot]", "commit", "-q", "-m", "move")
    commits = commits_from_git(directory, "HEAD~1..HEAD")
    assert sorted(commits[0]["files"]) == [".github/workflows/ci.yml", "elsewhere/ci.yml"]
    result = run_check(directory, NOW_MS, commits=commits)
    assert result["failures"] == [{"code": "workflow-change-unacknowledged", "commit": commits[0]["sha"], "file": ".github/workflows/ci.yml"}]


def test_commits_from_git_rejects_ranges_that_are_not_revisions():
    with pytest.raises(ValueError, match="invalid git range"):
        commits_from_git(fixture("registers", "valid"), "--output=x")
    with pytest.raises(ValueError, match="invalid git range"):
        commits_from_git(fixture("registers", "valid"), "a b")


def test_governance_patterns_are_case_insensitive_and_cover_hook_configuration():
    for p in [".AUTONOMY.yaml", "codeowners", "Docs/CodeOwners", ".GitHub/Workflows/ci.yml", ".claude/settings.json", ".claude/settings.local.json", ".claude/hooks/guard.sh", ".harness.yaml"]:
        assert is_governance_file(p) is True, p
    assert is_governance_file(".claude/commands/review.md") is False


def test_a_profile_path_that_escapes_the_repository_is_an_error(copy_fixture):
    directory = copy_fixture("registers", "valid")
    path = directory / ".autonomy.yaml"
    path.write_text(path.read_text().replace("profile: .autonomy/profile.json", "profile: ../../elsewhere/profile.json"))
    with pytest.raises(ValueError, match="escapes the repository"):
        run_check(directory, NOW_MS)


def test_an_impossible_calendar_date_is_a_schema_error_not_a_crash(copy_fixture):
    directory = copy_fixture("registers", "valid")
    path = directory / ".autonomy.yaml"
    path.write_text(path.read_text().replace("review_date: 2027-02-01", "review_date: 2027-02-31"))
    result = run_check(directory, NOW_MS)
    assert result["failures"] == [{"code": "schema", "path": "/workflows/0/review_date", "keyword": "format"}]


def commits_fixture(name):
    return fixture_json("commits", f"{name}.json")


def check_commits(name):
    return run_check(fixture("registers", "valid"), NOW_MS, commits=commits_fixture(name))


A1 = "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678"
A2 = "b2c3d4e5f60718293a4b5c6d7e8f901234567890"
H1 = "c3d4e5f60718293a4b5c6d7e8f90123456789012"


def unacknowledged(commit, file):
    return {"code": "workflow-change-unacknowledged", "commit": commit, "file": file}


def test_a_tier_1_file_still_fails_when_a_later_human_commit_carries_an_acknowledgement_line():
    result = check_commits("governance-tier1-with-ack")
    assert result["failures"] == [{"code": "governance-file-changed-by-agent", "commit": A1, "file": ".autonomy.yaml"}]
    assert result["acknowledged"] == []


def test_an_unacknowledged_agent_change_to_a_workflow_fails_with_workflow_change_unacknowledged():
    assert check_commits("governance-tier2-unacknowledged")["failures"] == [unacknowledged(A1, ".github/workflows/ci.yml")]


def test_a_workflow_change_acknowledged_by_a_later_human_commit_passes_and_is_reported():
    result = check_commits("governance-tier2-acknowledged")
    assert result["ok"] is True
    assert result["acknowledged"] == [{"commit": A1, "file": ".github/workflows/ci.yml", "by": H1}]
    assert "governance: a1b2c3d changed .github/workflows/ci.yml (acknowledged by c3d4e5f)" in format_check(result).split("\n")


@pytest.mark.parametrize(
    "name",
    [
        "governance-tier2-ack-by-agent",
        "governance-tier2-ack-before",
        "governance-tier2-ack-short-prefix",
        "governance-tier2-ack-wrong-sha",
    ],
)
def test_an_acknowledgement_that_does_not_qualify_does_not_count(name):
    result = check_commits(name)
    assert result["failures"] == [unacknowledged(A1, ".github/workflows/ci.yml")]
    assert result["acknowledged"] == []


def test_a_case_variant_workflow_path_is_tier_2():
    assert is_tier2_file(".GitHub/Workflows/x.yml") is True
    assert is_tier1_file(".GitHub/Workflows/x.yml") is False
    assert check_commits("governance-tier2-case-variant")["failures"] == [unacknowledged(A1, ".GitHub/Workflows/x.yml")]


def test_with_two_agent_commits_only_the_acknowledged_one_passes():
    result = check_commits("governance-tier2-two-agents-one-acked")
    assert result["failures"] == [unacknowledged(A2, ".github/workflows/release.yml")]
    assert result["acknowledged"] == [{"commit": A1, "file": ".github/workflows/ci.yml", "by": H1}]


def test_acknowledgement_lines_are_parsed_strictly():
    assert approved_prefixes("x\nGovernance-Approved: a1b2c3d\ngovernance-approved:A1B2C3D4") == ["a1b2c3d", "a1b2c3d4"]
    assert approved_prefixes("Governance-Approved: a1b2c3\nGovernance-Approved: a1b2c3dzz\n see Governance-Approved: a1b2c3d") == []


def test_commits_from_git_lists_commits_oldest_first_so_a_later_acknowledgement_is_found(copy_fixture):
    directory = copy_fixture("registers", "valid")
    (directory / ".github" / "workflows").mkdir(parents=True)
    _git(directory, "Alice", "init", "-q")
    _git(directory, "Alice", "add", "-A")
    _git(directory, "Alice", "commit", "-q", "-m", "base")
    (directory / ".github" / "workflows" / "ci.yml").write_text("name: ci\non: push\njobs: {}\n")
    _git(directory, "deps-bot[bot]", "add", "-A")
    _git(directory, "deps-bot[bot]", "commit", "-q", "-m", "add ci")
    sha = subprocess.run(["git", "rev-parse", "HEAD"], cwd=directory, check=True, capture_output=True, text=True).stdout.strip()
    _git(directory, "Alice", "commit", "-q", "--allow-empty", "-m", f"approve\n\nGovernance-Approved: {sha[:7]}")
    commits = commits_from_git(directory, "HEAD~2..HEAD")
    assert commits[0]["sha"] == sha
    result = run_check(directory, NOW_MS, commits=commits)
    assert result["ok"] is True
    assert len(result["acknowledged"]) == 1
