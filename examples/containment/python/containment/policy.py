"""Policy layer: decide(tool_call) -> allow | deny | ask, driven by ../rules.json."""

import json
import posixpath
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

Decision = Literal["allow", "deny", "ask"]

RULES_FILE = Path(__file__).resolve().parents[2] / "rules.json"


@dataclass(frozen=True)
class Result:
    decision: Decision
    rule: str


@dataclass(frozen=True)
class Context:
    project_root: str
    home: str


def load_rules() -> dict[str, Any]:
    return json.loads(RULES_FILE.read_text(encoding="utf8"))


def _resolve(p: str, ctx: Context) -> str:
    expanded = posixpath.join(ctx.home, p[2:]) if p.startswith("~/") else ctx.home if p == "~" else p
    return posixpath.normpath(posixpath.join(ctx.project_root, expanded))


def _is_under(child: str, parent: str) -> bool:
    return child == parent or child.startswith(parent.rstrip("/") + "/")


def _is_credential(p: str, rules: dict[str, Any], ctx: Context) -> bool:
    cred = rules["credentials"]
    resolved = _resolve(p, ctx)
    base = posixpath.basename(resolved)
    if base in cred["basenameAllow"]:
        return False
    if base in cred["basenames"]:
        return True
    if any(base.startswith(prefix) for prefix in cred["basenamePrefixes"]):
        return True
    return any(_is_under(resolved, _resolve(prefix, ctx)) for prefix in cred["pathPrefixes"])


def _first_match(command: str, patterns: list[dict[str, str]]) -> str | None:
    for rule in patterns:
        if re.search(rule["regex"], command):
            return rule["id"]
    return None


def _disallowed_hosts(text: str, rules: dict[str, Any]) -> list[str]:
    egress = rules["egress"]
    hosts = [h.lower() for h in re.findall(egress["urlHostRegex"], text)]
    return [h for h in hosts if h not in egress["allowedHosts"]]


def decide(call: dict[str, str], rules: dict[str, Any], ctx: Context) -> Result:
    tool = call["tool"]
    if tool == "Read":
        if _is_credential(call.get("path", ""), rules, ctx):
            return Result("deny", "credential-read")
        return Result("allow", "default")
    if tool == "Write":
        target = call.get("path", "")
        if _is_credential(target, rules, ctx):
            return Result("deny", "credential-write")
        if not _is_under(_resolve(target, ctx), ctx.project_root):
            return Result("deny", "write-outside-project")
        return Result("allow", "default")
    if tool == "Bash":
        command = call.get("command", "")
        write_rule = _first_match(command, rules["shellWritePatterns"])
        if write_rule:
            return Result("deny", f"shell-write:{write_rule}")
        if re.search(rules["egress"]["networkCommandRegex"], command) and _disallowed_hosts(command, rules):
            return Result("deny", "egress-host")
        ask_rule = _first_match(command, rules["askPatterns"])
        if ask_rule:
            return Result("ask", f"ask:{ask_rule}")
        return Result("allow", "default")
    if tool == "WebFetch":
        if _disallowed_hosts(call.get("url", ""), rules):
            return Result("deny", "egress-host")
        return Result("allow", "default")
    return Result("ask", "unknown-tool")
