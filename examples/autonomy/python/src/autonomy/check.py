from __future__ import annotations

import re
import subprocess
from pathlib import Path
from typing import Any

from autonomy.levels import all_workflows, cap_of, effective_level, profile_status
from autonomy.register import load_register_file, validate_register
from autonomy.util import age_days, git, inside_dir, parse_time, read_json_if_exists

# Tier 1: never changed by an agent commit, no relief.
TIER1 = [
    re.compile(r"^\.autonomy"),
    re.compile(r"(^|/)codeowners$"),
    re.compile(r"^\.claude/settings[^/]*\.json$"),
    re.compile(r"^\.claude/hooks/"),
    re.compile(r"^\.harness\.yaml$"),
]
# Tier 2: changed by an agent commit only when a later non-agent commit acknowledges it.
TIER2 = [re.compile(r"^\.github/workflows/")]

ACK_LINE = re.compile(r"governance-approved:[ \t]*([0-9a-f]{7,40})", re.I)


def is_tier1_file(path: str) -> bool:
    lower = path.lower()
    return any(p.search(lower) for p in TIER1)


def is_tier2_file(path: str) -> bool:
    lower = path.lower()
    return not is_tier1_file(path) and any(p.search(lower) for p in TIER2)


def is_governance_file(path: str) -> bool:
    return is_tier1_file(path) or is_tier2_file(path)


def approved_prefixes(body: str | None) -> list[str]:
    """Hex prefixes named by whole-line `Governance-Approved: <sha>` lines in the body (not the subject line)."""
    prefixes = []
    for line in (body or "").split("\n")[1:]:
        m = ACK_LINE.fullmatch(line)
        if m:
            prefixes.append(m.group(1).lower())
    return prefixes


def agent_tokens(register: dict) -> list[str]:
    tokens = []
    for w in register.get("workflows") or []:
        identity = str(w.get("identity") or "")
        if ":" in identity and not identity.startswith("person:"):
            tokens.append(identity[identity.index(":") + 1 :].lower())
    return tokens


CO_AUTHOR_AGENT = re.compile(r"co-authored-by:[\s\S]*(claude|anthropic)", re.I)


def is_agent_commit(commit: dict, tokens: list[str]) -> bool:
    who = " ".join(
        [commit["author"], commit["email"], commit.get("committer") or "", commit.get("committer_email") or ""]
    ).lower()
    if "[bot]" in who:
        return True
    if any(t in who for t in tokens):
        return True
    return any(CO_AUTHOR_AGENT.match(line) for line in (commit.get("body") or "").split("\n"))


RANGE = re.compile(r"^[\w./^~@{:+][\w./^~@{}:+-]*(\.\.\.?[\w./^~@{}:+-]+)?\Z")
SHA = re.compile(r"([0-9a-f]{40}|[0-9a-f]{64})")


def git_raw(directory: str | Path, args: list[str]) -> tuple[str, str] | None:
    """Run git, decode stdout as UTF-8 without newline translation (invalid bytes become U+FFFD), keep stderr."""
    run = subprocess.run(["git", *args], cwd=directory, capture_output=True)
    if run.returncode != 0:
        return None
    return run.stdout.decode("utf-8", errors="replace"), run.stderr.decode("utf-8", errors="replace")


def commits_from_git(directory: str | Path, range_: str) -> list[dict]:
    """Commits in the range, oldest first. Each commit is read in its own git call and parsed by NUL, which git
    refuses in a message, so a message cannot forge a record. Paths are read with -z and quotePath off, and a
    merge lists what it changed beyond the automatic merge (remerge)."""
    if not RANGE.match(range_):
        raise ValueError(f"invalid git range: {range_}")
    listing = git_raw(directory, ["rev-list", "--reverse", range_])
    if listing is None:
        raise RuntimeError(f"git rev-list failed for range {range_}")
    commits = []
    for sha in [line for line in listing[0].split("\n") if line]:
        if not SHA.fullmatch(sha):
            raise RuntimeError(f"git returned a malformed sha: {sha}")
        meta = git_raw(directory, ["-c", "core.quotePath=false", "show", "-s", "--format=%an%x00%ae%x00%cn%x00%ce%x00%P%x00%B", sha])
        names = git_raw(directory, ["-c", "core.quotePath=false", "show", "-z", "--name-only", "--no-renames", "--diff-merges=remerge", "--format=", sha])
        if meta is None or names is None:
            raise RuntimeError(f"git show failed for {sha}")
        author, email, committer, committer_email, parent_list, *body = meta[0].split("\0")
        parents = len([p for p in parent_list.split(" ") if p])
        files = [f for f in names[0].split("\0") if f]
        if parents > 1 and "warning:" in names[0] + names[1]:
            # remerge was skipped (git prints a warning): list against the first parent instead of trusting the output.
            fallback = git_raw(directory, ["-c", "core.quotePath=false", "diff-tree", "-z", "--name-only", "-r", "--no-renames", f"{sha}^1", sha])
            if fallback is None:
                raise RuntimeError(f"git diff-tree failed for {sha}")
            files = [f for f in fallback[0].split("\0") if f]
        commits.append(
            {
                "sha": sha,
                "author": author,
                "email": email,
                "committer": committer,
                "committer_email": committer_email,
                "parents": parents,
                "body": "\0".join(body),
                "files": files,
            }
        )
    return commits


def run_check(directory: str | Path, now: int, register_path: str | Path | None = None, commits: list[dict] | None = None) -> dict[str, Any]:
    root = Path(directory).resolve()
    path = Path(register_path) if register_path else root / ".autonomy.yaml"
    result: dict[str, Any] = {"ok": True, "cap": None, "profile_age_days": None, "workflows": [], "acknowledged": [], "failures": []}
    register = load_register_file(path)
    errors = validate_register(register)
    for e in errors:
        result["failures"].append({"code": "schema", "path": e["path"], "keyword": e["keyword"]})
    if errors:
        result["ok"] = False
        return result
    profile_rel = register.get("profile", ".autonomy/profile.json")
    if not inside_dir(root, profile_rel):
        raise ValueError(f"profile path escapes the repository: {profile_rel}")
    profile_path = root / profile_rel
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
    ordered = commits or []
    agent_shas = [c["sha"].lower() for c in ordered if is_agent_commit(c, tokens)]
    for index, commit in enumerate(ordered):
        if not is_agent_commit(commit, tokens):
            continue
        if (commit.get("parents") or 0) > 2:
            result["failures"].append({"code": "merge-unsupported", "commit": commit["sha"]})
            continue
        sha = commit["sha"].lower()
        acknowledger = next(
            (
                later
                for later in ordered[index + 1 :]
                if not is_agent_commit(later, tokens)
                and any(sha.startswith(p) and sum(a.startswith(p) for a in agent_shas) == 1 for p in approved_prefixes(later.get("body")))
            ),
            None,
        )
        for file in commit["files"]:
            if "\ufffd" in file:
                result["failures"].append({"code": "path-undecodable", "commit": commit["sha"], "file": file})
            elif is_tier1_file(file):
                result["failures"].append({"code": "governance-file-changed-by-agent", "commit": commit["sha"], "file": file})
            elif is_tier2_file(file):
                if acknowledger:
                    result["acknowledged"].append({"commit": commit["sha"], "file": file, "by": acknowledger["sha"]})
                else:
                    result["failures"].append({"code": "workflow-change-unacknowledged", "commit": commit["sha"], "file": file})
    result["ok"] = not result["failures"]
    return result


def format_check(result: dict) -> str:
    import json

    cap = result["cap"] if result["cap"] is not None else "n/a"
    lines = [f"cap: {cap}"]
    for w in result["workflows"]:
        why = f"  ({', '.join(w['reasons'])})" if w["reasons"] else ""
        lines.append(f"workflow {w['id']}: granted {w['granted']}, effective {w['effective']}{why}")
    for a in result["acknowledged"]:
        lines.append(f"governance: {a['commit'][:7]} changed {a['file']} (acknowledged by {a['by'][:7]})")
    for f in result["failures"]:
        lines.append(f"FAIL {json.dumps(f, separators=(',', ':'), ensure_ascii=False)}")
    lines.append("autonomy check: ok" if result["ok"] else "autonomy check: FAILED")
    return "\n".join(lines)
