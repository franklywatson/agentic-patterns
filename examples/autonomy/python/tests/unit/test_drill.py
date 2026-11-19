import json

import pytest

from autonomy.drill import run_drill, set_last_tested
from autonomy.register import load_register_file
from autonomy.util import parse_time
from tests.conftest import NOW

NOW_MS = parse_time(NOW)


def drill(directory, workflow_id, bound_ms=2000):
    path = directory / ".autonomy.yaml"
    workflow = next(w for w in load_register_file(path)["workflows"] if w["id"] == workflow_id)
    return run_drill(directory, path, workflow, bound_ms, NOW_MS)


def test_set_last_tested_replaces_an_existing_date_and_keeps_the_rest_of_the_file():
    text = "workflows:\n  - id: a\n    stop:\n      last_tested: 2026-01-01  # drill\n  - id: b\n    stop:\n      last_tested: 2026-02-02\n"
    assert set_last_tested(text, "a", "2026-11-18") == (
        "workflows:\n  - id: a\n    stop:\n      last_tested: 2026-11-18  # drill\n  - id: b\n    stop:\n      last_tested: 2026-02-02\n"
    )


def test_set_last_tested_inserts_the_field_into_a_block_stop_mapping():
    text = "workflows:\n  - id: a\n    stop:\n      mechanism: m\n"
    assert set_last_tested(text, "a", "2026-11-18") == "workflows:\n  - id: a\n    stop:\n      last_tested: 2026-11-18\n      mechanism: m\n"


def test_set_last_tested_edits_a_flow_style_stop_mapping():
    text = "workflows:\n  - id: a\n    stop: { mechanism: m, last_tested: 2026-01-01 }\n"
    assert set_last_tested(text, "a", "2026-11-18") == "workflows:\n  - id: a\n    stop: { mechanism: m, last_tested: 2026-11-18 }\n"


def test_set_last_tested_rejects_an_unknown_workflow_and_a_missing_stop_mapping():
    with pytest.raises(ValueError, match="not found"):
        set_last_tested("workflows:\n  - id: a\n", "zzz", "2026-11-18")
    with pytest.raises(ValueError, match="no block-style stop"):
        set_last_tested("workflows:\n  - id: a\n    owner: t\n", "a", "2026-11-18")


def test_a_passing_drill_halts_the_canary_within_the_bound_and_writes_stop_last_tested(copy_fixture):
    directory = copy_fixture("registers", "valid")
    result = drill(directory, "dep-bump")
    assert result["passed"] is True
    assert result["reason"] is None
    assert result["halted_in_ms"] <= 2000
    assert load_register_file(directory / ".autonomy.yaml")["workflows"][0]["stop"]["last_tested"] == "2026-11-18"
    log = [json.loads(line) for line in (directory / ".autonomy" / "drills.jsonl").read_text().strip().split("\n")]
    assert [(entry["workflow"], entry["passed"]) for entry in log] == [("dep-bump", True)]


def test_a_stop_command_that_signals_the_canary_process_also_passes(copy_fixture):
    directory = copy_fixture("registers", "valid")
    path = directory / ".autonomy.yaml"
    path.write_text(path.read_text().replace("""'touch "$AUTONOMY_STOP_FILE"'""", """'kill "$AUTONOMY_CANARY_PID"'"""))
    assert drill(directory, "dep-bump")["passed"] is True


def test_a_failed_drill_leaves_last_tested_unchanged_and_demotes_the_workflow(copy_fixture):
    directory = copy_fixture("registers", "valid")
    path = directory / ".autonomy.yaml"
    path.write_text(path.read_text().replace("""'touch "$AUTONOMY_STOP_FILE"'""", "'true'"))
    result = drill(directory, "dep-bump", 500)
    assert result["passed"] is False
    assert result["reason"] == "canary-still-running"
    assert load_register_file(path)["workflows"][0]["stop"]["last_tested"] == "2026-11-02"
    state = json.loads((directory / ".autonomy" / "state.json").read_text())
    assert state["workflows"]["dep-bump"]["demotion_override"] == 3
    assert state["workflows"]["dep-bump"]["reasons"] == ["stop-drill-failed:canary-still-running"]


def test_a_stop_command_that_exits_non_zero_fails_the_drill(copy_fixture):
    directory = copy_fixture("registers", "valid")
    path = directory / ".autonomy.yaml"
    path.write_text(path.read_text().replace("""'touch "$AUTONOMY_STOP_FILE"'""", "'exit 7'"))
    assert drill(directory, "dep-bump", 500)["reason"] == "stop-command-failed"


def test_a_workflow_without_a_stop_command_fails_the_drill(copy_fixture):
    directory = copy_fixture("registers", "valid")
    result = drill(directory, "flaky-test-triage", 500)
    assert result["passed"] is False
    assert result["reason"] == "no-stop-command"
