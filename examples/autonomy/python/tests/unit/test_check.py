import subprocess

import pytest

from autonomy.check import (
    approved_prefixes,
    commits_from_git,
    format_check,
    is_agent_commit,
    is_governance_file,
    is_locked_file,
    is_workflow_file,
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
        {"code": "grant-exceeds-cap", "workflow": "dep-bump", "granted": 4, "cap": 1},
        {"code": "grant-exceeds-cap", "workflow": "flaky-test-triage", "granted": 3, "cap": 1},
        {"code": "grant-exceeds-cap", "workflow": "interactive", "granted": 3, "cap": 1},
    ]


MISSING_FAILURES = [
    {"code": "profile-missing"},
    {"code": "grant-exceeds-cap", "workflow": "dep-bump", "granted": 4, "cap": 1},
    {"code": "grant-exceeds-cap", "workflow": "flaky-test-triage", "granted": 3, "cap": 1},
    {"code": "grant-exceeds-cap", "workflow": "interactive", "granted": 3, "cap": 1},
]

NON_PROFILES = {
    "a-json-array": "[]",
    "a-json-string": '"x"',
    "a-date-that-is-not-iso": '{"generated":"November 18, 2026"}',
    "a-date-in-the-future": '{"generated":"2099-01-01","dimensions":{"platform":{"level":5},"governance":{"level":5},"ownership":{"level":5},"measuring":{"level":5}}}',
}


@pytest.mark.parametrize("name", NON_PROFILES)
def test_a_profile_that_is_not_valid_counts_as_missing_and_does_not_raise(copy_fixture, name):
    directory = copy_fixture("registers", "valid")
    (directory / ".autonomy" / "profile.json").write_text(NON_PROFILES[name])
    result = run_check(directory, NOW_MS)
    assert result["cap"] == 1
    assert result["profile_age_days"] is None
    assert result["failures"] == MISSING_FAILURES


def test_a_profile_with_no_capping_dimensions_caps_at_1_without_being_missing(copy_fixture):
    directory = copy_fixture("registers", "valid")
    (directory / ".autonomy" / "profile.json").write_text('{"generated": "2026-11-17T00:00:00Z", "dimensions": {}}')
    result = run_check(directory, NOW_MS)
    assert result["cap"] == 1
    assert result["profile_age_days"] == 1
    assert result["failures"] == MISSING_FAILURES[1:]


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


def test_a_locked_file_still_fails_when_a_later_human_commit_carries_an_acknowledgement_line():
    result = check_commits("governance-locked-with-ack")
    assert result["failures"] == [{"code": "governance-file-changed-by-agent", "commit": A1, "file": ".autonomy.yaml"}]
    assert result["acknowledged"] == []


def test_an_unacknowledged_agent_change_to_a_workflow_fails_with_workflow_change_unacknowledged():
    assert check_commits("governance-workflow-unacknowledged")["failures"] == [unacknowledged(A1, ".github/workflows/ci.yml")]


def test_a_workflow_change_acknowledged_by_a_later_human_commit_passes_and_is_reported():
    result = check_commits("governance-workflow-acknowledged")
    assert result["ok"] is True
    assert result["acknowledged"] == [{"commit": A1, "file": ".github/workflows/ci.yml", "by": H1}]
    assert "governance: a1b2c3d changed .github/workflows/ci.yml (acknowledged by c3d4e5f)" in format_check(result).split("\n")


@pytest.mark.parametrize(
    "name",
    [
        "governance-workflow-ack-by-agent",
        "governance-workflow-ack-before",
        "governance-workflow-ack-short-prefix",
        "governance-workflow-ack-wrong-sha",
    ],
)
def test_an_acknowledgement_that_does_not_qualify_does_not_count(name):
    result = check_commits(name)
    assert result["failures"] == [unacknowledged(A1, ".github/workflows/ci.yml")]
    assert result["acknowledged"] == []


def test_a_case_variant_workflow_path_is_a_workflow_file():
    assert is_workflow_file(".GitHub/Workflows/x.yml") is True
    assert is_locked_file(".GitHub/Workflows/x.yml") is False
    assert check_commits("governance-workflow-case-variant")["failures"] == [unacknowledged(A1, ".GitHub/Workflows/x.yml")]


def test_with_two_agent_commits_only_the_acknowledged_one_passes():
    result = check_commits("governance-workflow-two-agents-one-acked")
    assert result["failures"] == [unacknowledged(A2, ".github/workflows/release.yml")]
    assert result["acknowledged"] == [{"commit": A1, "file": ".github/workflows/ci.yml", "by": H1}]


def test_acknowledgement_lines_are_parsed_strictly():
    assert approved_prefixes("x\nGovernance-Approved: a1b2c3d\ngovernance-approved:A1B2C3D4") == ["a1b2c3d", "a1b2c3d4"]
    assert approved_prefixes("subject\nGovernance-Approved: a1b2c3\nGovernance-Approved: a1b2c3dzz\n see Governance-Approved: a1b2c3d") == []


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


B1 = "a1b2c3d0e5f60718293a4b5c6d7e8f9012345678"
WF = ".github/workflows/ci.yml"


def test_an_acknowledgement_prefix_that_matches_two_agent_commits_acknowledges_neither():
    result = check_commits("governance-workflow-ack-ambiguous-prefix")
    assert result["failures"] == [unacknowledged(A1, WF), unacknowledged(B1, ".github/workflows/release.yml")]
    assert result["acknowledged"] == []


def test_a_longer_prefix_that_names_one_agent_commit_acknowledges_only_that_commit():
    result = check_commits("governance-workflow-ack-disambiguated-prefix")
    assert result["failures"] == [unacknowledged(B1, ".github/workflows/release.yml")]
    assert result["acknowledged"] == [{"commit": A1, "file": WF, "by": H1}]


@pytest.mark.parametrize(
    "name",
    [
        "governance-workflow-ack-subject-line",
        "governance-workflow-ack-cr",
        "governance-workflow-ack-crlf",
        "governance-workflow-ack-line-separator",
        "governance-workflow-ack-by-anthropic-coauthor",
        "governance-workflow-ack-by-agent-committer",
    ],
)
def test_acknowledgements_that_are_malformed_or_by_an_agent_do_not_count(name):
    result = check_commits(name)
    assert result["failures"] == [unacknowledged(A1, WF)]
    assert result["acknowledged"] == []


def test_one_commit_that_touches_a_locked_and_a_workflow_file_fails_the_locked_file_and_still_reports_the_acknowledged_workflow_file():
    result = check_commits("governance-locked-and-workflow-one-commit")
    assert result["failures"] == [{"code": "governance-file-changed-by-agent", "commit": A1, "file": ".autonomy.yaml"}]
    assert result["acknowledged"] == [{"commit": A1, "file": WF, "by": H1}]


def test_any_claude_or_anthropic_co_author_trailer_marks_an_agent_commit_and_the_committer_counts():
    def commit(body):
        return {"sha": "x", "author": "Alice", "email": "a@b.c", "body": body, "files": []}

    for body in ["m\n\nCo-Authored-By: Anthropic Claude <x@y.z>", "m\n\nco-authored-by: claude", "m\n\nCO-AUTHORED-BY: Someone <n@anthropic.com>"]:
        assert is_agent_commit(commit(body), []) is True, body
    assert is_agent_commit(commit("m\n\nCo-Authored-By: Bob <b@example.invalid>"), []) is False
    assert is_agent_commit({**commit("m"), "committer": "deps-bot[bot]", "committer_email": "x@y.z"}, []) is True


def _repo(copy_fixture, author="Alice"):
    directory = copy_fixture("registers", "valid")
    _git(directory, author, "init", "-q")
    _git(directory, author, "add", "-A")
    _git(directory, author, "commit", "-q", "-m", "base")
    return directory


def _out(directory, name, *args):
    return subprocess.run(
        ["git", "-c", f"user.name={name}", "-c", "user.email=a@example.invalid", *args], cwd=directory, check=True, capture_output=True, text=True
    ).stdout


def test_non_ascii_and_tab_paths_are_listed_unquoted_and_match_the_governance_lists(copy_fixture):
    directory = _repo(copy_fixture, "deps-bot[bot]")
    (directory / ".github" / "workflows").mkdir(parents=True)
    (directory / ".autonomy" / "ledger").mkdir(parents=True, exist_ok=True)
    (directory / ".github" / "workflows" / "d\u00e9ploy.yml").write_text("name: d\n")
    (directory / ".github" / "workflows" / "tab\there.yml").write_text("name: t\n")
    (directory / ".autonomy" / "ledger" / "r\u00e9view.jsonl").write_text("{}\n")
    _git(directory, "deps-bot[bot]", "add", "-A")
    _git(directory, "deps-bot[bot]", "commit", "-q", "-m", "evil names")
    commits = commits_from_git(directory, "HEAD~1..HEAD")
    assert sorted(commits[0]["files"]) == [".autonomy/ledger/r\u00e9view.jsonl", ".github/workflows/d\u00e9ploy.yml", ".github/workflows/tab\there.yml"]
    result = run_check(directory, NOW_MS, commits=commits)
    assert [(f["code"], f["file"]) for f in result["failures"]] == [
        ("governance-file-changed-by-agent", ".autonomy/ledger/r\u00e9view.jsonl"),
        ("workflow-change-unacknowledged", ".github/workflows/d\u00e9ploy.yml"),
        ("workflow-change-unacknowledged", ".github/workflows/tab\there.yml"),
    ]


def test_a_commit_message_with_record_separators_cannot_forge_a_commit_or_an_acknowledgement(copy_fixture):
    directory = _repo(copy_fixture, "deps-bot[bot]")
    (directory / ".github" / "workflows").mkdir(parents=True)
    (directory / ".github" / "workflows" / "ci.yml").write_text("name: ci\n")
    _git(directory, "deps-bot[bot]", "add", "-A")
    _git(directory, "deps-bot[bot]", "commit", "-q", "-m", "add ci")
    sha = _out(directory, "deps-bot[bot]", "rev-parse", "HEAD").strip()
    forged = f"empty\n\n\x1d\x1e{'f' * 40}\x1fAlice\x1falice@example.invalid\x1fApprove\n\nGovernance-Approved: {sha[:7]}\n"
    _git(directory, "deps-bot[bot]", "commit", "-q", "--allow-empty", "-m", forged)
    commits = commits_from_git(directory, "HEAD~2..HEAD")
    assert len(commits) == 2
    assert all(len(c["sha"]) == 40 and c["author"] == "deps-bot[bot]" for c in commits)
    result = run_check(directory, NOW_MS, commits=commits)
    assert result["failures"] == [unacknowledged(sha, ".github/workflows/ci.yml")]


def test_files_an_agent_adds_in_a_merge_commit_are_listed_and_fail_as_locked_files(copy_fixture):
    directory = _repo(copy_fixture, "Alice")
    _git(directory, "Alice", "checkout", "-q", "-b", "side")
    (directory / "side.txt").write_text("side\n")
    _git(directory, "Alice", "add", "-A")
    _git(directory, "Alice", "commit", "-q", "-m", "side")
    _git(directory, "Alice", "checkout", "-q", "-")
    (directory / "main.txt").write_text("main\n")
    _git(directory, "Alice", "add", "-A")
    _git(directory, "Alice", "commit", "-q", "-m", "main")
    _git(directory, "deps-bot[bot]", "merge", "--no-ff", "--no-commit", "side")
    (directory / ".claude" / "hooks").mkdir(parents=True)
    (directory / ".claude" / "hooks" / "x.sh").write_text("true\n")
    (directory / "CODEOWNERS").write_text("* @agent\n")
    _git(directory, "deps-bot[bot]", "add", "-A")
    _git(directory, "deps-bot[bot]", "commit", "-q", "-m", "merge side")
    commits = commits_from_git(directory, "HEAD~2..HEAD")
    assert sorted(commits[-1]["files"]) == [".claude/hooks/x.sh", "CODEOWNERS"]
    result = run_check(directory, NOW_MS, commits=commits)
    assert [(f["code"], f["file"]) for f in result["failures"]] == [
        ("governance-file-changed-by-agent", ".claude/hooks/x.sh"),
        ("governance-file-changed-by-agent", "CODEOWNERS"),
    ]


def test_commits_from_git_reads_the_committer_so_an_agent_committer_is_an_agent_commit(copy_fixture, monkeypatch):
    directory = _repo(copy_fixture, "Alice")
    (directory / "a.txt").write_text("a\n")
    _git(directory, "Alice", "add", "-A")
    monkeypatch.setenv("GIT_COMMITTER_NAME", "deps-bot[bot]")
    _git(directory, "Alice", "commit", "-q", "-m", "x")
    commits = commits_from_git(directory, "HEAD~1..HEAD")
    assert commits[0]["author"] == "Alice"
    assert commits[0]["committer"] == "deps-bot[bot]"
    assert is_agent_commit(commits[0], []) is True


def _octopus_repo(copy_fixture, merge_author):
    directory = _repo(copy_fixture, "Alice")
    _git(directory, "Alice", "branch", "-M", "master")
    for b in ["b1", "b2"]:
        _git(directory, "Alice", "checkout", "-q", "-b", b, "master")
        (directory / f"{b}.txt").write_text(f"{b}\n")
        _git(directory, "Alice", "add", "-A")
        _git(directory, "Alice", "commit", "-q", "-m", b)
    _git(directory, "Alice", "checkout", "-q", "-b", "trunk", "master")
    _git(directory, merge_author, "merge", "--no-ff", "--no-commit", "b1", "b2")
    (directory / ".claude" / "hooks").mkdir(parents=True)
    (directory / ".claude" / "hooks" / "x.sh").write_text("true\n")
    _git(directory, merge_author, "add", "-A")
    _git(directory, merge_author, "commit", "-q", "-m", "octopus")
    return directory


def test_an_agent_commit_with_more_than_two_parents_fails_with_merge_unsupported(copy_fixture):
    directory = _octopus_repo(copy_fixture, "deps-bot[bot]")
    commits = commits_from_git(directory, "master..HEAD")
    assert commits[-1]["parents"] == 3
    assert run_check(directory, NOW_MS, commits=commits)["failures"] == [{"code": "merge-unsupported", "commit": commits[-1]["sha"]}]


def test_a_non_agent_octopus_merge_is_not_checked_and_lists_files_against_its_first_parent(copy_fixture):
    directory = _octopus_repo(copy_fixture, "Alice")
    commits = commits_from_git(directory, "master..HEAD")
    assert sorted(commits[-1]["files"]) == [".claude/hooks/x.sh", "b1.txt", "b2.txt"]
    assert run_check(directory, NOW_MS, commits=commits)["ok"] is True


def test_a_crlf_acknowledgement_read_from_git_does_not_count(copy_fixture):
    directory = _repo(copy_fixture, "deps-bot[bot]")
    (directory / ".github" / "workflows").mkdir(parents=True)
    (directory / ".github" / "workflows" / "ci.yml").write_text("name: ci\n")
    _git(directory, "deps-bot[bot]", "add", "-A")
    _git(directory, "deps-bot[bot]", "commit", "-q", "-m", "add ci")
    sha = _out(directory, "deps-bot[bot]", "rev-parse", "HEAD").strip()
    _git(directory, "Alice", "commit", "-q", "--allow-empty", "--cleanup=verbatim", "-m", f"Approve\r\n\r\nGovernance-Approved: {sha[:7]}\r\n")
    commits = commits_from_git(directory, "HEAD~2..HEAD")
    assert "\r\n" in commits[1]["body"]
    assert run_check(directory, NOW_MS, commits=commits)["failures"] == [unacknowledged(sha, ".github/workflows/ci.yml")]


def test_a_path_that_is_not_valid_utf_8_fails_closed_as_path_undecodable(copy_fixture):
    directory = _repo(copy_fixture, "deps-bot[bot]")
    blob = subprocess.run(["git", "hash-object", "-w", "--stdin"], cwd=directory, input=b"x\n", check=True, capture_output=True).stdout.decode().strip()
    entry = f"100644 {blob}\t.github/workflows/".encode() + b"\xff" + b".yml\n"
    subprocess.run(["git", "update-index", "--add", "--index-info"], cwd=directory, input=entry, check=True, capture_output=True)
    _git(directory, "deps-bot[bot]", "commit", "-q", "-m", "bad path")
    commits = commits_from_git(directory, "HEAD~1..HEAD")
    assert run_check(directory, NOW_MS, commits=commits)["failures"] == [
        {"code": "path-undecodable", "commit": commits[0]["sha"], "file": ".github/workflows/\ufffd.yml"}
    ]


def test_fail_lines_print_non_ascii_paths_as_they_are():
    result = run_check(fixture("registers", "valid"), NOW_MS, commits=[agent_commit([".autonomy/ledger/r\u00e9view.jsonl"])])
    assert '"file":".autonomy/ledger/r\u00e9view.jsonl"' in format_check(result)
