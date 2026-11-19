import json

from tests.conftest import NOW, fixture


def test_check_exits_0_on_the_valid_register_and_prints_each_workflow(cli):
    run = cli(["check", "--dir", str(fixture("registers", "valid")), "--now", NOW])
    assert run.returncode == 0
    assert "workflow dep-bump: granted 4, effective 4" in run.stdout
    assert "autonomy check: ok" in run.stdout


def test_check_exits_1_when_a_grant_exceeds_the_cap(cli):
    run = cli(["check", "--dir", str(fixture("registers", "over-cap")), "--now", NOW])
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
    run = cli(["check", "--dir", str(directory), "--now", NOW, "--json"])
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
    run = cli(["check", "--dir", str(fixture("repos", "bare")), "--now", NOW])
    assert run.returncode == 2
    assert "autonomy: " in run.stderr


def test_the_hook_settings_examples_name_sessionstart_and_pretooluse_and_call_the_hook_subcommands():
    for name in ("settings.typescript.example.json", "settings.python.example.json"):
        settings = json.loads((fixture("..", "hooks", name)).read_text())
        assert sorted(settings["hooks"]) == ["PreToolUse", "SessionStart"]
        assert settings["hooks"]["PreToolUse"][0]["hooks"][0]["command"].endswith("hook pre-tool-use")
        assert settings["hooks"]["SessionStart"][0]["hooks"][0]["command"].endswith("hook session-start")
        assert settings["hooks"]["PreToolUse"][0]["hooks"][0]["type"] == "command"
