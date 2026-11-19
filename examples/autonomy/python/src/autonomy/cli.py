from __future__ import annotations

import json
import sys
from pathlib import Path

from autonomy.census import run_census, write_census
from autonomy.check import commits_from_git, format_check, run_check
from autonomy.drill import run_drill
from autonomy.hook import run_hook
from autonomy.ledger import apply_demotion, build_report, format_report, read_ledger
from autonomy.levels import all_workflows
from autonomy.register import load_register_file, validate_register
from autonomy.util import now_ms, read_json, read_json_if_exists

USAGE = """usage: autonomy <command> [options]

  check   [--dir D] [--register F] [--now T] (--commits F | --git-range R | --no-commits) [--json]
  census  [--dir D] [--now T] [--json]
  ledger  --workflow ID [--dir D] [--now T] [--apply-demotion] [--json]
  drill   --workflow ID [--dir D] [--bound-ms N] [--now T]
  hook    pre-tool-use | session-start   (reads the hook JSON on stdin)
"""


def _parse_args(argv: list[str]) -> tuple[dict[str, str | bool], list[str]]:
    flags: dict[str, str | bool] = {}
    rest: list[str] = []
    i = 0
    while i < len(argv):
        a = argv[i]
        if a.startswith("--"):
            nxt = argv[i + 1] if i + 1 < len(argv) else None
            if nxt is not None and not nxt.startswith("--"):
                flags[a[2:]] = nxt
                i += 1
            else:
                flags[a[2:]] = True
        else:
            rest.append(a)
        i += 1
    return flags, rest


def _load_valid_register(directory: Path) -> dict:
    register = load_register_file(directory / ".autonomy.yaml")
    errors = validate_register(register)
    if errors:
        raise ValueError(f"register is invalid: {json.dumps(errors)}")
    return register


def _run(argv: list[str]) -> int:
    if not argv:
        sys.stderr.write(USAGE)
        return 2
    command, args = argv[0], argv[1:]
    flags, rest = _parse_args(args)

    def text(key: str) -> str | None:
        value = flags.get(key)
        return value if isinstance(value, str) else None

    directory = Path(text("dir") or ".").resolve()
    now = now_ms(text("now"))
    as_json = "json" in flags
    if command == "check":
        commits = None
        if text("commits"):
            commits = read_json(text("commits"))
        elif text("git-range"):
            commits = commits_from_git(directory, text("git-range"))
        result = run_check(directory, now, text("register"), commits)
        skipped = commits is None
        if skipped and "no-commits" not in flags:
            result["failures"].append({"code": "governance-check-skipped"})
            result["ok"] = False
        note = "\ngovernance check: skipped (--no-commits)" if skipped and "no-commits" in flags else ""
        print(json.dumps(result, indent=2) if as_json else f"{format_check(result)}{note}")
        return 0 if result["ok"] else 1
    if command == "census":
        result = run_census(directory, now)
        path = write_census(directory, result)
        profile = result["profile"]
        if as_json:
            print(json.dumps(profile, indent=2))
        else:
            dims = "\n".join(f"{d}: {v['level']}" for d, v in profile["dimensions"].items())
            print(f"wrote {path}\ncap: {profile['cap']}\n{dims}\nworksheet: {directory / '.autonomy' / 'worksheet.json'}")
        return 0
    if command == "ledger":
        wid = text("workflow")
        if not wid:
            raise ValueError("ledger needs --workflow")
        register = _load_valid_register(directory)
        wf = next((w for w in all_workflows(register) if w["id"] == wid), None)
        if wf is None:
            raise ValueError(f"workflow {wid} is not in the register")
        profile = read_json_if_exists(directory / register.get("profile", ".autonomy/profile.json"))
        state = read_json_if_exists(directory / ".autonomy" / "state.json")
        report = build_report(wf, read_ledger(directory, wid), profile, state, register.get("defaults"), now)
        if "apply-demotion" in flags and report["demotion"]["triggered"]:
            apply_demotion(directory, wid, report["demotion"]["to_level"], report["demotion"]["reasons"], now)
        print(json.dumps(report, indent=2) if as_json else format_report(report))
        return 0
    if command == "drill":
        wid = text("workflow")
        if not wid:
            raise ValueError("drill needs --workflow")
        register = _load_valid_register(directory)
        wf = next((w for w in register["workflows"] if w["id"] == wid), None)
        if wf is None:
            raise ValueError(f"workflow {wid} is not in the register")
        result = run_drill(directory, directory / ".autonomy.yaml", wf, int(text("bound-ms") or 2000), now)
        print(json.dumps(result, indent=2))
        if result["reason"] == "canary-never-started":
            return 2
        return 0 if result["passed"] else 1
    if command == "hook":
        import os

        stdout, code = run_hook(rest[0], sys.stdin.read(), dict(os.environ), now)
        if stdout:
            sys.stdout.write(stdout)
        return code
    sys.stderr.write(USAGE)
    return 2


def main(argv: list[str] | None = None) -> int:
    try:
        return _run(sys.argv[1:] if argv is None else argv)
    except Exception as err:  # the CLI reports every failure the same way
        sys.stderr.write(f"autonomy: {err}\n")
        return 2


if __name__ == "__main__":
    sys.exit(main())
