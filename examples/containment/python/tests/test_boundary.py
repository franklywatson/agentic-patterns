import pytest

from containment.boundary import run_in_container
from containment.policy import Context, decide, load_rules

from conftest import CASES, ORIGINAL

RULES = load_rules()
CTX = Context(project_root="/work/project", home="/home/dev")


def policy_decision(command: str) -> str:
    return decide({"tool": "Bash", "command": command}, RULES, CTX).decision


@pytest.mark.parametrize("case", CASES["writeCases"], ids=lambda c: c["id"])
def test_write_boundary(case: dict[str, str], make_project) -> None:
    assert policy_decision(case["command"]) == case["policy"]

    control_dir, control_target = make_project()
    permissive = run_in_container(case["command"], control_dir, read_only=False, network="none")
    assert permissive.exit_code == 0, permissive.stderr
    assert control_target.read_text(encoding="utf8") != ORIGINAL, "control run must change the file"

    bounded_dir, bounded_target = make_project()
    contained = run_in_container(case["command"], bounded_dir, read_only=True, network="none")
    assert "Read-only file system" in contained.stderr
    assert bounded_target.read_text(encoding="utf8") == ORIGINAL


@pytest.mark.parametrize("case", CASES["networkCases"], ids=lambda c: c["id"])
def test_network_boundary(case: dict[str, str], make_project, server) -> None:
    command = case["command"].replace("{SERVER}", server.host)
    assert policy_decision(command) == case["policy"]

    control_dir, _ = make_project()
    permissive = run_in_container(command, control_dir, read_only=True, network=server.network)
    assert permissive.exit_code == 0, permissive.stderr
    assert permissive.stdout.strip() == "containment-ok"

    bounded_dir, _ = make_project()
    contained = run_in_container(command, bounded_dir, read_only=True, network="none")
    assert contained.exit_code != 0
    assert "containment-ok" not in contained.stdout


def test_container_runs_as_non_root(make_project) -> None:
    project_dir, _ = make_project()
    r = run_in_container("id -u", project_dir, read_only=True, network="none")
    assert r.exit_code == 0, r.stderr
    assert r.stdout.strip() == "65534"
