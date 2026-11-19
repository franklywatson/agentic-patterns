"""The drill and the check run as separate CLI processes on one copied repository, so the only link
between them is what the drill wrote to the register and to .autonomy/state.json."""

import json

from autonomy.register import load_register_file
from tests.conftest import NOW


def check_json(cli, directory, now):
    return json.loads(cli(["check", "--dir", str(directory), "--now", now, "--json", "--no-commits"]).stdout)


def dep_bump(result):
    return next(w for w in result["workflows"] if w["id"] == "dep-bump")


def last_tested(directory):
    return load_register_file(directory / ".autonomy.yaml")["workflows"][0]["stop"]["last_tested"]


def test_a_passing_drill_through_the_cli_restores_the_grant_a_stale_stop_test_lowered_using_the_date_it_printed(cli, copy_fixture):
    directory = copy_fixture("registers", "valid")
    at = "2026-12-05T00:00:00Z"
    assert dep_bump(check_json(cli, directory, at)) == {"id": "dep-bump", "granted": 4, "effective": 2, "reasons": ["freshness:stop-test-overdue"]}

    drill = cli(["drill", "--workflow", "dep-bump", "--dir", str(directory), "--now", at])
    assert drill.returncode == 0, drill.stderr
    printed = json.loads(drill.stdout)
    assert printed["passed"] is True
    assert printed["last_tested"] == "2026-12-05"
    assert last_tested(directory) == printed["last_tested"]

    after = check_json(cli, directory, at)
    assert after["ok"] is True
    assert dep_bump(after) == {"id": "dep-bump", "granted": 4, "effective": 4, "reasons": []}


def test_a_failing_drill_through_the_cli_demotes_the_workflow_in_autonomy_check_and_leaves_the_date_alone(cli, copy_fixture):
    directory = copy_fixture("registers", "valid")
    path = directory / ".autonomy.yaml"
    original = path.read_text()
    broken = original.replace("command: 'touch \"$AUTONOMY_STOP_FILE\"'", "command: 'true'")
    assert broken != original
    path.write_text(broken)
    assert dep_bump(check_json(cli, directory, NOW)) == {"id": "dep-bump", "granted": 4, "effective": 4, "reasons": []}

    drill = cli(["drill", "--workflow", "dep-bump", "--dir", str(directory), "--now", NOW, "--bound-ms", "500"])
    assert drill.returncode == 1, drill.stderr
    printed = json.loads(drill.stdout)
    assert [printed["passed"], printed["reason"], printed["last_tested"]] == [False, "canary-still-running", None]
    assert last_tested(directory) == "2026-11-02"

    after = check_json(cli, directory, NOW)
    assert after["ok"] is True
    assert dep_bump(after) == {"id": "dep-bump", "granted": 4, "effective": 3, "reasons": ["demotion:3"]}
