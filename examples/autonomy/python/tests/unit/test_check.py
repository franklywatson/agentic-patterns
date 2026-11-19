import subprocess

from autonomy.check import commits_from_git, is_agent_commit, is_governance_file, run_check
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
    assert [f["file"] for f in result["failures"]] == ["docs/CODEOWNERS", ".github/workflows/ci.yml"]


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
