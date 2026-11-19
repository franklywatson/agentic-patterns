import json
import os
import re
import subprocess
import sys

import pytest

from tests.conftest import NOW, fixture


def test_check_exits_0_on_the_valid_register_and_prints_each_workflow(cli):
    run = cli(["check", "--dir", str(fixture("registers", "valid")), "--now", NOW, "--no-commits"])
    assert run.returncode == 0
    assert "governance check: skipped (--no-commits)" in run.stdout
    assert "workflow dep-bump: granted 4, effective 4" in run.stdout
    assert "autonomy check: ok" in run.stdout


def test_check_exits_1_when_a_grant_exceeds_the_cap(cli):
    run = cli(["check", "--dir", str(fixture("registers", "over-cap")), "--now", NOW, "--no-commits"])
    assert run.returncode == 1
    assert "grant-exceeds-cap" in run.stdout
    assert "autonomy check: FAILED" in run.stdout


def test_check_exits_1_when_an_agent_commit_changed_a_governance_file(cli):
    run = cli(["check", "--dir", str(fixture("registers", "valid")), "--now", NOW, "--commits", str(fixture("commits", "agent-edits-register.json"))])
    assert run.returncode == 1
    assert "governance-file-changed-by-agent" in run.stdout


def test_check_exits_0_when_only_a_human_changed_governance_files(cli):
    run = cli(["check", "--dir", str(fixture("registers", "valid")), "--now", NOW, "--commits", str(fixture("commits", "human-edits-register.json"))])
    assert run.returncode == 0


def test_ledger_prints_a_markdown_evidence_report_and_exits_0(cli):
    run = cli(["ledger", "--dir", str(fixture("ledgers", "project")), "--workflow", "dep-bump", "--now", NOW])
    assert run.returncode == 0
    assert "| revert-upper | <= 0.03 | 0.0287 | pass |" in run.stdout


def test_ledger_apply_demotion_writes_the_override_and_a_later_check_shows_the_lowered_level(cli, copy_fixture):
    directory = copy_fixture("ledgers", "project")
    assert cli(["ledger", "--dir", str(directory), "--workflow", "dep-regress", "--now", NOW, "--apply-demotion"]).returncode == 0
    run = cli(["check", "--dir", str(directory), "--now", NOW, "--json", "--no-commits"])
    dep = next(w for w in json.loads(run.stdout)["workflows"] if w["id"] == "dep-regress")
    assert dep == {"id": "dep-regress", "granted": 4, "effective": 3, "reasons": ["demotion:3"]}


def test_the_hook_subcommand_reads_json_on_stdin_and_prints_the_deny_decision(cli, copy_fixture):
    directory = copy_fixture("registers", "valid")
    payload = json.dumps({"session_id": "cli", "cwd": str(directory), "hook_event_name": "PreToolUse", "tool_name": "Write", "tool_input": {"file_path": f"{directory}/CODEOWNERS", "content": "x"}})
    run = cli(["hook", "pre-tool-use", "--now", NOW], payload)
    assert run.returncode == 0
    assert json.loads(run.stdout)["hookSpecificOutput"]["permissionDecision"] == "deny"


def test_an_unknown_command_exits_2_with_usage_on_stderr(cli):
    run = cli(["frobnicate"])
    assert run.returncode == 2
    assert "usage: autonomy" in run.stderr


def test_a_missing_register_is_a_loud_error_with_exit_code_2(cli):
    run = cli(["check", "--dir", str(fixture("repos", "bare")), "--now", NOW, "--no-commits"])
    assert run.returncode == 2
    assert "autonomy: " in run.stderr


def test_the_hook_settings_examples_name_sessionstart_and_pretooluse_and_call_the_hook_subcommands():
    for name in ("settings.typescript.example.json", "settings.python.example.json"):
        settings = json.loads((fixture("..", "hooks", name)).read_text())
        assert sorted(settings["hooks"]) == ["PreToolUse", "SessionStart"]
        assert settings["hooks"]["PreToolUse"][0]["hooks"][0]["command"].endswith("hook pre-tool-use")
        assert settings["hooks"]["SessionStart"][0]["hooks"][0]["command"].endswith("hook session-start")
        assert settings["hooks"]["PreToolUse"][0]["hooks"][0]["type"] == "command"


def test_every_hook_binding_in_the_settings_examples_sets_onfailure_to_block():
    for name in ("settings.typescript.example.json", "settings.python.example.json"):
        settings = json.loads((fixture("..", "hooks", name)).read_text())
        handlers = [h for groups in settings["hooks"].values() for g in groups for h in g["hooks"]]
        assert len(handlers) == 2
        assert all(h.get("onFailure") == "block" for h in handlers), name


def test_check_without_commits_and_without_no_commits_fails_instead_of_printing_ok(cli):
    run = cli(["check", "--dir", str(fixture("registers", "valid")), "--now", NOW, "--json"])
    assert run.returncode == 1
    assert json.loads(run.stdout)["failures"] == [{"code": "governance-check-skipped"}]


def test_check_rejects_a_git_range_that_looks_like_an_option(cli):
    run = cli(["check", "--dir", str(fixture("registers", "valid")), "--now", NOW, "--git-range", "-p"])
    assert run.returncode == 2


def test_check_rejects_a_git_range_with_unexpected_characters(cli):
    run = cli(["check", "--dir", str(fixture("registers", "valid")), "--now", NOW, "--git-range", "HEAD;rm"])
    assert run.returncode == 2
    assert "invalid git range" in run.stderr


def test_pre_tool_use_hook_exits_2_on_empty_stdin(cli):
    assert cli(["hook", "pre-tool-use", "--now", NOW], "").returncode == 2


@pytest.mark.parametrize(
    "payload",
    [
        "{}",
        "null",
        json.dumps({"tool_input": {}}),
        json.dumps({"tool_name": 7, "tool_input": {}}),
        json.dumps({"tool_name": "", "tool_input": {}}),
        json.dumps({"tool_name": "Edit"}),
        "not json",
    ],
)
def test_pre_tool_use_hook_exits_2_on_malformed_input(cli, payload):
    run = cli(["hook", "pre-tool-use", "--now", NOW], payload)
    assert run.returncode == 2
    assert run.stdout == ""


def _hook(directory, workflow, body):
    env = {**os.environ, "CLAUDE_PROJECT_DIR": str(directory), "AUTONOMY_WORKFLOW": workflow}
    return subprocess.run([sys.executable, "-m", "autonomy", "hook", "pre-tool-use", "--now", NOW], input=body, capture_output=True, text=True, env=env, check=True).stdout


def test_hook_scenarios_replayed_through_the_cli_give_the_expected_allow_and_deny_decisions(tmp_path):
    suite = json.loads(fixture("eval", "scenarios.json").read_text())
    replayed = 0
    for index, s in enumerate(x for x in suite["scenarios"] if x["diff"] is None and not x["untrusted_seen"]):
        directory = tmp_path / f"replay{index}"
        (directory / ".autonomy").mkdir(parents=True)
        (directory / ".autonomy.yaml").write_text(json.dumps(s["register"]))
        dims = {d: {"level": s["profile_cap"]} for d in ("platform", "governance", "ownership", "measuring")}
        (directory / ".autonomy" / "profile.json").write_text(json.dumps({"generated": "2026-11-17T00:00:00Z", "dimensions": dims}))
        (directory / ".autonomy" / "state.json").write_text(json.dumps(s["state"]))
        for c in s["calls"]:
            body = json.dumps({"session_id": "replay", "cwd": str(directory), "tool_name": c["tool_name"], "tool_input": c["tool_input"]}).replace("/work/project/", f"{directory}/")
            out = _hook(directory, s["workflow"], body)
            want = r"^$" if c["expect"] == "allow" else rf'"permissionDecisionReason":"{c.get("code")}:'
            assert re.search(want, out), f"{s['id']}/{c['name']}"
            replayed += 1
    assert replayed >= 40


def test_a_symlink_to_a_governance_file_is_denied(copy_fixture):
    directory = copy_fixture("registers", "valid")
    os.symlink(directory / ".autonomy.yaml", directory / "notes.txt")
    body = json.dumps({"session_id": "sl", "cwd": str(directory), "tool_name": "Write", "tool_input": {"file_path": str(directory / "notes.txt"), "content": "x"}})
    out = _hook(directory, "interactive", body)
    assert json.loads(out)["hookSpecificOutput"]["permissionDecisionReason"].startswith("governance-write:")
