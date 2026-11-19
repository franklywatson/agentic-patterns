#!/usr/bin/env python3
"""Run the task bank (docs/references/task-bank.md) and score it mechanically.

The agent under test works in a scratch copy of the repository that omits scripts/task-bank/ (answers, seeds and this
runner), so it cannot read expected values. docs/references/task-bank.md stays in the copy because other docs link to
it; it holds prompts and check kinds but no answers. Scoring reads answers.json from the real
repository and looks only at the scratch workspace. Nothing is written into the repository except the run log.

Usage:
  python3 scripts/task-bank/run.py --agent-cmd CMD [--task T-04 ...] [--remove PATH ...] [--model ID]
                                   [--run-log FILE] [--skip-docker] [--keep]
  python3 scripts/task-bank/run.py --dry-run [--task T-04 ...] [--docker]

--agent-cmd is a shell command run in the scratch workspace. It receives the prompt on stdin and in the environment
variable TASK_PROMPT, and the task id in TASK_ID. It must leave its artefacts in the working directory.
--remove deletes a path (relative to the repository root) from the workspace before the agent starts. Repeat it to
remove several artefacts for one run.
--dry-run scores a known-good and a known-bad artefact per task, with no agent, and exits 1 unless each is scored as
expected. Tasks that need Docker are skipped unless --docker is given.

Exit status: 0 when the run completed (a failed task is not an error), 1 when a dry run mismatches, 2 on a usage error.
Run log: one JSON line per run with date, model, commit, removed artefacts, passed and failed task ids.
"""
import argparse
import datetime
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
BANK_DOC = REPO / "docs" / "references" / "task-bank.md"
ANSWERS = Path(__file__).resolve().parent / "answers.json"
SEEDS = Path(__file__).resolve().parent / "seeds"
DEFAULT_LOG = Path(__file__).resolve().parent / "run-log.jsonl"
SKIP_DIRS = {".git", ".worktrees", "node_modules", ".superpowers"}
EXCLUDE = {"scripts/task-bank"}
LINK_NODE_MODULES = ["node_modules", "examples/autonomy/typescript/node_modules"]
COMMAND_TIMEOUT = 900


# ---------------------------------------------------------------- workspace

def copy_repo(dest):
    for root, dirs, files in os.walk(REPO):
        rel_root = Path(root).relative_to(REPO)
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS and (rel_root / d).as_posix() not in EXCLUDE]
        for name in files:
            rel = (rel_root / name).as_posix()
            if rel in EXCLUDE:
                continue
            target = dest / rel
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(Path(root) / name, target, follow_symlinks=False)


def link_node_modules(dest):
    for rel in LINK_NODE_MODULES:
        source = REPO / rel
        if source.is_dir() and (dest / Path(rel).parent).is_dir():
            link = dest / rel
            if not link.exists():
                link.symlink_to(source)


def apply_seed(ws, name, reverse=False):
    args = ["patch", "-p1", "-s", "-d", str(ws)] + (["-R"] if reverse else [])
    with open(SEEDS / name) as handle:
        result = subprocess.run(args, stdin=handle, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"seed {name} failed: {result.stdout}{result.stderr}")


def snapshot(ws):
    state = {}
    for root, dirs, files in os.walk(ws):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for name in files:
            path = Path(root) / name
            if path.is_symlink():
                continue
            state[path.relative_to(ws).as_posix()] = hashlib.sha256(path.read_bytes()).hexdigest()
    return state


def diff_state(before, after):
    added = sorted(set(after) - set(before))
    deleted = sorted(set(before) - set(after))
    modified = sorted(p for p in before if p in after and before[p] != after[p])
    return added, modified, deleted


def make_workspace(task, answers, removed):
    ws = Path(tempfile.mkdtemp(prefix=f"taskbank-{task}-"))
    copy_repo(ws)
    link_node_modules(ws)
    seed = answers["tasks"][task].get("seed")
    if seed:
        apply_seed(ws, seed)
    for rel in removed:
        target = (ws / rel).resolve()
        if ws.resolve() not in target.parents:
            raise ValueError(f"--remove path escapes the workspace: {rel}")
        if target.is_dir():
            shutil.rmtree(target)
        elif target.exists():
            target.unlink()
        else:
            raise ValueError(f"--remove path not found in the workspace: {rel}")
    return ws


# ------------------------------------------------------------------ scoring

def matches(expected, got):
    if isinstance(expected, dict) and set(expected) == {"set"}:
        return isinstance(got, list) and {str(x).lower() for x in got} == {str(x).lower() for x in expected["set"]}
    if isinstance(expected, dict) and set(expected) == {"superset"}:
        return isinstance(got, list) and {str(x) for x in expected["superset"]} <= {str(x) for x in got}
    if isinstance(expected, dict) and set(expected) == {"regex"}:
        return isinstance(got, str) and re.search(expected["regex"], got, re.I) is not None
    if isinstance(expected, dict):
        return isinstance(got, dict) and all(k in got and matches(v, got[k]) for k, v in expected.items())
    if isinstance(expected, str) and isinstance(got, str):
        return expected.strip().lower() == got.strip().lower()
    return expected == got


def score_json(ws, spec, **_):
    path = ws / spec["artefact"]
    if not path.is_file():
        return False, [f"missing {spec['artefact']}"]
    try:
        got = json.loads(path.read_text())
    except ValueError as error:
        return False, [f"{spec['artefact']} is not valid JSON: {error}"]
    bad = [k for k, v in spec["expected"].items() if not (isinstance(got, dict) and k in got and matches(v, got[k]))]
    return not bad, [f"mismatch on key {k}" for k in bad]


def score_hook(ws, spec, **_):
    script = ws / spec["artefact"]
    if not script.is_file():
        return False, [f"missing {spec['artefact']}"]
    details = []
    for index, case in enumerate(spec["cases"]):
        stdin = case["stdin"] if isinstance(case["stdin"], str) else json.dumps(case["stdin"])
        try:
            result = subprocess.run([sys.executable, str(script)], input=stdin, capture_output=True, text=True,
                                    timeout=10, cwd=ws)
            code, err = result.returncode, result.stderr
        except subprocess.TimeoutExpired:
            code, err = "timeout", ""
        if code != case["exit"]:
            details.append(f"case {index}: exit {code}, expected {case['exit']}")
        elif case.get("stderr_nonempty") and not err.strip():
            details.append(f"case {index}: no reason on stderr")
    return not details, details


def autonomy_cli():
    cli = REPO / "examples" / "autonomy" / "typescript" / "dist" / "src" / "cli.js"
    if not cli.is_file():
        raise RuntimeError("build the autonomy CLI first: cd examples/autonomy/typescript && npm ci && npm run build")
    return cli


def score_register_fix(ws, spec, **_):
    edited = ws / spec["artefact"]
    if not edited.is_file():
        return False, [f"missing {spec['artefact']}"]
    text = edited.read_text()
    details = [f"register no longer contains {s!r}" for s in spec["must_contain"] if s not in text]
    scratch = Path(tempfile.mkdtemp(prefix="taskbank-register-"))
    try:
        check_dir = scratch / "register"
        shutil.copytree(REPO / spec["fixture"], check_dir)
        shutil.copy2(edited, check_dir / ".autonomy.yaml")
        result = subprocess.run(["node", str(autonomy_cli()), "check", "--dir", str(check_dir), "--now", spec["now"],
                                 "--no-commits"], capture_output=True, text=True, timeout=120)
        if result.returncode != 0:
            details.append(f"autonomy check exited {result.returncode}: {result.stdout.strip().splitlines()[-1:]}")
    finally:
        shutil.rmtree(scratch, ignore_errors=True)
    return not details, details


def read_text(path):
    try:
        return path.read_text()
    except (UnicodeDecodeError, OSError):
        return None


def run_command(ws, step):
    cwd = ws / step.get("cwd", ".")
    temp = None
    if step.get("apply_patch"):
        temp = Path(tempfile.mkdtemp(prefix="taskbank-apply-"))
        shutil.copytree(cwd, temp / "w", symlinks=True)
        cwd = temp / "w"
        with open(cwd / step["apply_patch"]) as handle:
            subprocess.run(["patch", "-p1", "-s", "-d", str(cwd)], stdin=handle, check=True, capture_output=True)
    try:
        result = subprocess.run(step["cmd"], shell=True, cwd=cwd, capture_output=True, text=True,
                                timeout=COMMAND_TIMEOUT)
    except subprocess.TimeoutExpired:
        return False, f"{step['cmd']}: timeout"
    finally:
        if temp:
            shutil.rmtree(temp, ignore_errors=True)
    expected = step.get("exit")
    if expected == "nonzero" and result.returncode == 0:
        return False, f"{step['cmd']} ({step.get('label', '')}): exit 0, expected non-zero"
    if isinstance(expected, int) and result.returncode != expected:
        return False, f"{step['cmd']}: exit {result.returncode}, expected {expected}"
    if step.get("stdout_regex") and not re.search(step["stdout_regex"], result.stdout, re.M):
        return False, f"{step['cmd']}: output does not match {step['stdout_regex']!r}"
    return True, ""


def score_commands(ws, spec, before=None, **_):
    details = []
    added, modified, deleted = diff_state(before, snapshot(ws))
    changed = added + modified
    if spec.get("artefact") and not (ws / spec["artefact"]).is_file():
        details.append(f"missing {spec['artefact']}")
    prefix = spec.get("new_files_only_under")
    if prefix:
        stray = [p for p in modified + deleted if True] + [p for p in added if not p.startswith(prefix)]
        details += [f"change outside allowed new files: {p}" for p in stray]
        if not any(p.startswith(prefix) for p in added):
            details.append(f"no new file under {prefix}")
    for prot in spec.get("protect_unchanged_prefix", []) + spec.get("forbid_changed_prefix", []):
        details += [f"protected path changed: {p}" for p in changed + deleted if p.startswith(prot)]
    texts = {p: read_text(ws / p) for p in changed}
    for pattern in spec.get("forbid_regex", []):
        details += [f"{p} matches forbidden {pattern!r}" for p, t in texts.items() if t and re.search(pattern, t)]
    for pattern in spec.get("require_regex", []):
        if not any(t and re.search(pattern, t) for t in texts.values()):
            details.append(f"no changed file matches {pattern!r}")
    for rel, patterns in spec.get("require_file_regex", {}).items():
        text = read_text(ws / rel) or ""
        details += [f"{rel} does not match {p!r}" for p in patterns if not re.search(p, text)]
    if not details:
        for step in spec.get("commands", []):
            ok, message = run_command(ws, step)
            if not ok:
                details.append(message)
                break
    return not details, details


SCORERS = {"json": score_json, "hook": score_hook, "register_fix": score_register_fix, "commands": score_commands}


def score(task, ws, answers, before):
    spec = answers["tasks"][task]
    return SCORERS[spec["kind"]](ws, spec, before=before)


# ------------------------------------------------------------------- driver

def parse_prompts():
    text = BANK_DOC.read_text()
    prompts = {}
    for match in re.finditer(r"^### (T-\d+) .*?^- \*\*Prompt\*\*: (.*?)(?=^- \*\*)", text, re.S | re.M):
        prompts[match.group(1)] = " ".join(line.strip() for line in match.group(2).splitlines()).strip()
    return prompts


def needs_skip(spec, allow_docker):
    if spec.get("requires") == "docker" and (not allow_docker or shutil.which("docker") is None):
        return "needs Docker"
    return None


def apply_dry_ops(ws, ops):
    for op in ops:
        if "write" in op:
            target = ws / op["write"]
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(op["content"])
        elif "replace" in op:
            target = ws / op["replace"]
            text = target.read_text()
            if op["old"] not in text:
                raise RuntimeError(f"dry-run replace: {op['old']!r} not in {op['replace']}")
            target.write_text(text.replace(op["old"], op["new"], 1))
        elif "reverse_seed" in op:
            apply_seed(ws, op["reverse_seed"], reverse=True)


def dry_run(tasks, answers, allow_docker):
    mismatches = 0
    for task in tasks:
        spec = answers["tasks"][task]
        reason = needs_skip(spec, allow_docker)
        if reason or "dry_run" not in spec:
            print(f"{task}: skipped ({reason or 'no dry-run data'})")
            continue
        for variant, expect in (("good", True), ("bad", False)):
            ws = make_workspace(task, answers, [])
            try:
                before = snapshot(ws)
                apply_dry_ops(ws, spec["dry_run"][variant])
                passed, details = score(task, ws, answers, before)
            finally:
                shutil.rmtree(ws, ignore_errors=True)
            verdict = "PASS" if passed else "FAIL"
            status = "ok" if passed == expect else "MISMATCH"
            mismatches += passed != expect
            note = f" ({'; '.join(details)})" if details else ""
            print(f"{task} {variant}: scored {verdict}, expected {'PASS' if expect else 'FAIL'} -> {status}{note}")
    print(f"dry run: {mismatches} mismatch(es)")
    return 1 if mismatches else 0


def commit():
    result = subprocess.run(["git", "rev-parse", "HEAD"], cwd=REPO, capture_output=True, text=True)
    return result.stdout.strip() or "unknown"


def real_run(args, tasks, answers):
    prompts = parse_prompts()
    passed, failed, skipped = [], [], []
    for task in tasks:
        spec = answers["tasks"][task]
        reason = needs_skip(spec, not args.skip_docker)
        if reason:
            skipped.append(task)
            print(f"{task}: skipped ({reason})")
            continue
        if task not in prompts:
            raise RuntimeError(f"no prompt found for {task} in {BANK_DOC.name}")
        ws = make_workspace(task, answers, args.remove)
        try:
            before = snapshot(ws)
            env = dict(os.environ, TASK_ID=task, TASK_PROMPT=prompts[task])
            subprocess.run(args.agent_cmd, shell=True, cwd=ws, input=prompts[task], text=True, env=env)
            ok, details = score(task, ws, answers, before)
            for rubric in spec.get("rubric", []):
                details = details + [f"rubric (person to answer): {rubric}"]
        finally:
            if not args.keep:
                shutil.rmtree(ws, ignore_errors=True)
        (passed if ok else failed).append(task)
        print(f"{task}: {'PASS' if ok else 'FAIL'} {'; '.join(details)}")
    entry = {"date": datetime.date.today().isoformat(), "model": args.model, "commit": commit(),
             "removed": args.remove, "passed": passed, "failed": failed, "skipped": skipped}
    with open(args.run_log, "a") as log:
        log.write(json.dumps(entry) + "\n")
    print(f"run log line appended to {args.run_log}")
    return 0


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--agent-cmd")
    parser.add_argument("--task", action="append")
    parser.add_argument("--remove", action="append", default=[])
    parser.add_argument("--model", default="unrecorded")
    parser.add_argument("--run-log", default=str(DEFAULT_LOG))
    parser.add_argument("--skip-docker", action="store_true")
    parser.add_argument("--keep", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--docker", action="store_true")
    args = parser.parse_args()
    answers = json.loads(ANSWERS.read_text())
    tasks = args.task or sorted(answers["tasks"])
    unknown = [t for t in tasks if t not in answers["tasks"]]
    if unknown:
        print(f"unknown task id(s): {unknown}", file=sys.stderr)
        return 2
    if args.dry_run:
        return dry_run(tasks, answers, args.docker)
    if not args.agent_cmd:
        print("--agent-cmd is required unless --dry-run is given", file=sys.stderr)
        return 2
    return real_run(args, tasks, answers)


if __name__ == "__main__":
    sys.exit(main())
