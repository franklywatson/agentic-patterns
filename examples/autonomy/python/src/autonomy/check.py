from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from autonomy.levels import all_workflows, cap_of, effective_level, profile_status
from autonomy.register import load_register_file, validate_register
from autonomy.util import age_days, git, parse_time, read_json_if_exists

GOVERNANCE = [re.compile(r"^\.autonomy"), re.compile(r"(^|/)CODEOWNERS$"), re.compile(r"^\.github/workflows/")]


def is_governance_file(path: str) -> bool:
    return any(p.search(path) for p in GOVERNANCE)


def agent_tokens(register: dict) -> list[str]:
    tokens = []
    for w in register.get("workflows") or []:
        identity = str(w.get("identity") or "")
        if ":" in identity and not identity.startswith("person:"):
            tokens.append(identity[identity.index(":") + 1 :].lower())
    return tokens


def is_agent_commit(commit: dict, tokens: list[str]) -> bool:
    who = f"{commit['author']} {commit['email']}".lower()
    if "[bot]" in who:
        return True
    if any(t in who for t in tokens):
        return True
    return re.search(r"^co-authored-by:\s*claude", commit.get("body") or "", re.I | re.M) is not None


def commits_from_git(directory: str | Path, range_: str) -> list[dict]:
    out = git(directory, ["log", "--name-only", "--format=@@%H%x1f%an%x1f%ae%x1f%b%x1e", range_])
    if out is None:
        raise RuntimeError(f"git log failed for range {range_}")
    commits = []
    for chunk in [c for c in out.split("@@") if c.strip()]:
        head, files_text = chunk.split("\x1e")
        sha, author, email, body = head.split("\x1f")
        commits.append({"sha": sha, "author": author, "email": email, "body": body, "files": [f for f in files_text.split("\n") if f]})
    return commits


def run_check(directory: str | Path, now: int, register_path: str | Path | None = None, commits: list[dict] | None = None) -> dict[str, Any]:
    root = Path(directory).resolve()
    path = Path(register_path) if register_path else root / ".autonomy.yaml"
    result: dict[str, Any] = {"ok": True, "cap": None, "profile_age_days": None, "workflows": [], "failures": []}
    register = load_register_file(path)
    errors = validate_register(register)
    for e in errors:
        result["failures"].append({"code": "schema", "path": e["path"], "keyword": e["keyword"]})
    if errors:
        result["ok"] = False
        return result
    profile_path = root / register.get("profile", ".autonomy/profile.json")
    profile = read_json_if_exists(profile_path)
    state = read_json_if_exists(root / ".autonomy" / "state.json")
    status = profile_status(profile, now)
    result["cap"] = cap_of(profile)
    if status == "missing":
        result["failures"].append({"code": "profile-missing"})
    if status == "stale":
        result["failures"].append({"code": "profile-stale"})
    if profile is not None and isinstance(profile.get("generated"), str):
        result["profile_age_days"] = age_days(now, parse_time(profile["generated"]))
    for wf in all_workflows(register):
        eff = effective_level(wf, profile, state, register.get("defaults"), now)
        result["workflows"].append({"id": wf["id"], "granted": eff.granted, "effective": eff.effective, "reasons": eff.reasons})
        if eff.granted > eff.cap:
            result["failures"].append({"code": "grant-exceeds-cap", "workflow": wf["id"], "granted": eff.granted, "cap": eff.cap})
    tokens = agent_tokens(register)
    for commit in commits or []:
        if not is_agent_commit(commit, tokens):
            continue
        for file in [f for f in commit["files"] if is_governance_file(f)]:
            result["failures"].append({"code": "governance-file-changed-by-agent", "commit": commit["sha"], "file": file})
    result["ok"] = not result["failures"]
    return result


def format_check(result: dict) -> str:
    import json

    cap = result["cap"] if result["cap"] is not None else "n/a"
    lines = [f"cap: {cap}"]
    for w in result["workflows"]:
        why = f"  ({', '.join(w['reasons'])})" if w["reasons"] else ""
        lines.append(f"workflow {w['id']}: granted {w['granted']}, effective {w['effective']}{why}")
    for f in result["failures"]:
        lines.append(f"FAIL {json.dumps(f, separators=(',', ':'))}")
    lines.append("autonomy check: ok" if result["ok"] else "autonomy check: FAILED")
    return "\n".join(lines)
