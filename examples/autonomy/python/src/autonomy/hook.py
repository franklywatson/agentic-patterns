from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from typing import Any
from urllib.parse import urlparse

from autonomy.check import fold_text, is_governance_file
from autonomy.levels import Effective, all_workflows, effective_level
from autonomy.register import load_register_file, validate_register
from autonomy.util import git, inside_dir, match_command, match_path, read_json_if_exists

READ_TOOLS = {"Read", "Grep", "Glob", "LS", "TodoWrite", "NotebookRead", "Task", "Agent", "Skill", "ToolSearch", "AskUserQuestion", "ExitPlanMode", "EnterPlanMode", "TaskOutput", "TaskStop"}
WRITE_TOOLS = {"Write", "Edit", "MultiEdit", "NotebookEdit"}
NETWORK_TOOLS = {"WebFetch", "WebSearch"}
READ_ONLY_ORDER = ["ls", "cat", "head", "tail", "grep", "rg", "find", "pwd", "echo", "wc", "which", "sort", "diff", "stat"]
READ_ONLY_COMMANDS = set(READ_ONLY_ORDER)
PROTECTED = {"main", "master"}
SECRET_PATH = re.compile(r"(^|/)\.env(\.|$)|\.ssh/|\.aws/|\.npmrc|(^|/)secrets?(/|\.)")
GOV_WORDS = re.compile(r"\.autonomy|codeowners|\.github/(workflows|actions)|\.claude/(settings|hooks)|\.harness", re.I | re.A)
WRITE_HINT = re.compile(
    "|".join(
        [
            ">", r"\btee\b", r"\bsed\s+-i", "--in-place", r"\bmv\b", r"\bcp\b", r"\brm\b", r"\bln\b", r"\brsync\b", r"\btouch\b",
            r"\btruncate\b", r"\bdd\b", r"\binstall\b", r"\bchmod\b", r"\bunzip\b", "--output", r"git\s+(checkout|restore|apply|mv|rm)\b",
        ]
    ),
    re.A,
)
# Commands whose write flag can come anywhere after them: the command word, and the flag word.
LATER_FLAG_WRITES = [
    (re.compile(r"\btar\Z", re.A), re.compile(r"(?:-?[A-Za-z]*x[A-Za-z]*|--extract|--get)\Z")),
    (re.compile(r"\bfind\b", re.A), re.compile(r"-(?:delete|exec|execdir|ok|okdir|fprint0?|fprintf|fls)\b", re.A)),
    (re.compile(r"\bsort\b", re.A), re.compile(r"-[^-]*o")),
]


def _later_flag_write(text: str) -> bool:
    """True when `tar`, `find` or `sort` is followed, anywhere later, by one of its write flags. One pass, linear."""
    words = [w for w in re.split(r"[ \t\n\r\f\v]+", text) if w]
    flag_later = [False] * len(LATER_FLAG_WRITES)
    for word in reversed(words):
        for k, (cmd, flag) in enumerate(LATER_FLAG_WRITES):
            if flag_later[k] and cmd.search(word):
                return True
            if flag.match(word):
                flag_later[k] = True
    return False
PR_WRITE = re.compile(r"^gh\s+pr\s+(create|new|edit|close|reopen|ready|review|comment|lock|unlock|update-branch|revert)\b")
# A Bash command longer than this many UTF-8 bytes is denied before any pattern runs on it.
MAX_COMMAND_BYTES = 65536
# A tool path longer than this many UTF-8 bytes (PATH_MAX on Linux) is denied before it is resolved.
MAX_PATH_BYTES = 4096
URL_ARG = re.compile(r"(?:^|\s)['\"]?(?:[A-Za-z][\w+.-]*://|[\w.-]+@[\w.-]+:)", re.A)
API_METHOD = re.compile(r"(?:^|\s)(?:-X|--method)(?:\s*=\s*|\s+|(?=[A-Za-z'\"]))['\"]?([A-Za-z]+)")
API_BODY = re.compile(r"(?:^|\s)(?:-[fF]|--field|--raw-field|--input)(?:[\s=]|(?=\S)|$)")
GRAPHQL_MERGE = re.compile(r"merge(PullRequest|Branch)|enablePullRequestAutoMerge|enqueuePullRequest", re.I | re.A)


def _command_too_long(command: str) -> bool:
    return len(command.encode("utf-8", errors="surrogatepass")) > MAX_COMMAND_BYTES


def _governance_shell_write(command: str) -> bool:
    """True when a command names a locked or workflow path and a write verb, before or after removing quotes. Names
    are also compared folded (see fold_text) with dots and spaces before a `/` removed, the forms a
    case-insensitive file system or Windows resolves to the same file."""
    unquoted = re.sub(r"[\"'\\]", "", command)
    folded = []
    for c in (command, unquoted):
        parts = fold_text(c).split("/")
        folded.append("/".join([p.rstrip(". ") for p in parts[:-1]] + parts[-1:]))
    return any(GOV_WORDS.search(c) for c in (command, unquoted, *folded)) and any(WRITE_HINT.search(c) or _later_flag_write(c) for c in (command, unquoted))


def _is_api(seg: str) -> bool:
    return re.match(r"^gh\s+api\b", seg) is not None


def _api_writes(seg: str) -> bool:
    """`gh api` writes when its method is not GET or HEAD, or, with no method, when it sends fields or a body."""
    method = API_METHOD.search(seg)
    if method:
        return re.fullmatch(r"get|head", method.group(1), re.I) is None
    return API_BODY.search(seg) is not None


def _is_graphql(seg: str) -> bool:
    return _is_api(seg) and re.search(r"(?:^|\s)['\"]?graphql\b", seg) is not None


def _graphql_unseen(seg: str) -> bool:
    """A GraphQL query read from a file or stdin cannot be inspected."""
    return re.search(r"=@|--input\b", seg) is not None


def _is_pr_write(seg: str) -> bool:
    return (
        PR_WRITE.match(seg) is not None
        or (_is_api(seg) and re.search(r"\bpulls\b", seg) is not None and _api_writes(seg))
        or (_is_graphql(seg) and (re.search(r"\bmutation\b", seg) is not None or _graphql_unseen(seg)))
    )


def _is_api_ref_write(seg: str) -> bool:
    """A `gh api` call that moves a branch or commits to one: `git/refs` or `contents/` with a write method."""
    return _is_api(seg) and re.search(r"/(git/refs|contents)\b", seg) is not None and _api_writes(seg)


def _api_ref_protected(seg: str) -> bool:
    if re.search(r"heads/(main|master)\b", seg):
        return True
    if not re.search(r"/contents\b", seg):
        return False
    branch = re.search(r"(?:^|\s)(?:-[fF]\s*|--(?:raw-)?field[\s=]+)['\"]?branch=['\"]?([^\s'\"]+)", seg)
    return branch is None or branch.group(1) in PROTECTED

@dataclass
class HookContext:
    project_dir: str
    workflow: dict | None
    eff: Effective | None
    untrusted_seen: bool
    current_branch: str | None
    diff: dict | None
    register_invalid: bool = False  # the register failed schema validation: every call is denied


@dataclass
class Decision:
    allow: bool
    code: str | None = None
    reason: str | None = None
    mark_untrusted: bool = False


def _deny(code: str, reason: str) -> Decision:
    return Decision(False, code, reason)


OK = Decision(True)


# Characters trimmed from a segment before the deny rules read it: the same set in TypeScript and Python.
_BLANK = "\t\n\v\f\r \x1c\x1d\x1e\x1f\x85\xa0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff"


def _trim_blank(s: str) -> str:
    return s.strip(_BLANK)


def split_segments(command: str) -> list[str]:
    return [t for t in (_trim_blank(s) for s in re.split(r"&&|\|\||;|\||\n|&", command)) if t]


def _hosts_in(segment: str) -> list[str]:
    hosts = [m.group(1).lower() for m in re.finditer(r"https?://([^/\s:'\"]+)", segment)]
    hosts += [m.group(1).lower() for m in re.finditer(r"(?:^|\s)(?:\S+@)([A-Za-z0-9.-]+)", segment)]
    return hosts


def _host_allowed(host: str, allow: list[str]) -> bool:
    return any(a == "*" or host == a or host.endswith(f".{a}") for a in allow)


def _is_egress(seg: str) -> bool:
    return (
        re.match(r"^(curl|wget|ssh|scp|sftp|nc|ncat|telnet|ftp)\b", seg) is not None
        or re.match(r"^git\s+clone\b", seg) is not None
        or (re.match(r"^git\s+(fetch|pull|push|ls-remote|remote\s+add|submodule\s+add)\b", seg) is not None and URL_ARG.search(seg) is not None)
    )


def _is_push(seg: str) -> bool:
    return re.match(r"^git\s+(-\S+\s+)*push\b", seg) is not None


def _is_merge(seg: str) -> bool:
    return (
        re.match(r"^gh\s+pr\s+merge\b", seg) is not None
        or (_is_api(seg) and re.search(r"/merges?\b", seg) is not None)
        or (_is_graphql(seg) and (GRAPHQL_MERGE.search(seg) is not None or _graphql_unseen(seg)))
    )


def _is_merge_label(seg: str) -> bool:
    return re.match(r"^gh\s+(pr|issue)\s+(edit|create)\b", seg) is not None and re.search(r"--(add-)?label[= ]\S*merge", seg, re.I) is not None


def _is_force(seg: str) -> bool:
    return re.search(r"(\s-f\b|--force(-with-lease)?\b|\s\+\S)", seg) is not None


def _external_action(seg: str) -> bool:
    if _is_push(seg) or _is_merge(seg) or re.match(r"^(scp|ssh|sftp)\b", seg):
        return True
    if re.match(r"^(curl|wget)\b", seg) and re.search(r"(-X\s*(POST|PUT|DELETE|PATCH)|\s-d\b|--data|--upload-file|\s-F\b)", seg, re.I):
        return True
    if re.match(r"^gh\s+(issue|pr)\s+comment\b", seg):
        return True
    if _is_api(seg) and _api_writes(seg):
        return True
    return re.search(r"\bdeploy\b", seg, re.I | re.A) is not None


def _untrusted_read(seg: str) -> bool:
    return bool(
        re.match(r"^gh\s+issue\s+(view|list)\b", seg)
        or (re.match(r"^gh\s+pr\s+view\b", seg) and "--comments" in seg)
        or (re.match(r"^gh\s+api\b", seg) and re.search(r"(issues|comments|pulls)", seg))
        or (re.match(r"^(curl|wget)\b", seg) and not _external_action(seg))
    )


def _push_destination(ref: str) -> str:
    """The branch a refspec updates: the part after the last `:`, without quotes, `+` or `refs/heads/`."""
    dest = re.sub(r"^\+", "", re.sub(r"[\"'\\]", "", ref)).split(":")[-1]
    return re.sub(r"^refs/heads/", "", dest)


def _push_args(seg: str) -> list[str]:
    """Positional words after `git push`: the remote, then the refspecs."""
    return [a for a in re.split(r"\s+", re.sub(r"^git\s+(-\S+\s+)*push\b", "", seg).strip()) if a and not a.startswith("-")]


def _pushes_protected(seg: str, current_branch: str | None) -> bool:
    """True when a push names, or may update, a protected branch."""
    if re.search(r"(?:^|\s)--(all|mirror|branches)\b", seg):
        return True
    args = _push_args(seg)
    targets = [_push_destination(a) for a in args[1:]]
    refs = targets if targets else (["main"] if current_branch is None else [current_branch])
    head_on_protected = current_branch is not None and current_branch in PROTECTED
    return any(r in PROTECTED or (r == "HEAD" and head_on_protected) for r in [*refs, *(_push_destination(a) for a in args)])


def _permitted_tool(entries: list[str], tool: str, subject: str | None, bash_segments: list[str] | None) -> bool:
    for entry in entries:
        m = re.match(r"^(\w+)(?:\((.*)\))?$", entry, re.DOTALL)
        if not m or m.group(1) != tool:
            continue
        if m.group(2) is None:
            return True
        if bash_segments is not None:
            if all(match_command(m.group(2), s) for s in bash_segments):
                return True
        elif subject is not None and match_path(m.group(2), subject):
            return True
    return False


def _norm_paths(ctx: HookContext, p: str) -> tuple[str, str]:
    """Normalise a tool path against the project directory, resolving `..` and symlinks (realpath resolves the
    longest existing ancestor and keeps the rest)."""
    absolute = os.path.normpath(os.path.join(ctx.project_dir, p))
    real = os.path.realpath(absolute)
    root = os.path.realpath(ctx.project_dir)
    return os.path.relpath(absolute, ctx.project_dir).replace(os.sep, "/"), os.path.relpath(real, root).replace(os.sep, "/")


def _rel_path(ctx: HookContext, p: str) -> str:
    return _norm_paths(ctx, p)[0]


def _governance_path(ctx: HookContext, p: str) -> bool:
    rel, real = _norm_paths(ctx, p)
    return is_governance_file(rel) or is_governance_file(real)


_WRAPPER_OPTIONS = re.compile(
    r"^git\s+(?:(?:(?:-C|-c|--git-dir|--work-tree|--namespace)(?:\s+|=)\S+|--no-pager|--paginate|--no-optional-locks|-P)\s+)+"
)


def _command_name(segment: str) -> str:
    """Reduce the first word to the command bash runs: quotes and backslashes removed, then the part after the last `/`."""
    m = re.match(r"\S+", segment)
    first = m.group(0) if m else ""
    name = re.sub(r"[\"'\\]", "", first)
    base = name[name.rfind("/") + 1 :]
    return segment if base == "" else base + segment[len(first) :]


def strip_wrappers(segment: str) -> str:
    """Remove leading assignments, wrappers (env, sudo, time, xargs, ...), git global options and `gh` repository
    flags, and reduce the command word to its name: `/usr/bin/curl`, `"curl"`, `c''url` and `\\curl` all become `curl`."""
    s = _trim_blank(segment)
    while True:
        before = s
        s = re.sub(r"^[A-Za-z_][A-Za-z0-9_]*=\S*\s+", "", s)
        s = _command_name(s)
        s = re.sub(r"^(env|command|sudo|time|nohup|nice|exec|xargs)\s+(-\S+\s+)*", "", s)
        s = re.sub(r"^timeout\s+(-\S+\s+)*\d+[smhd]?\s+", "", s)
        s = _WRAPPER_OPTIONS.sub("git ", s, count=1)
        if re.match(r"^gh\s", s):
            s = re.sub(r"\s(?:-R|--repo)(?:=|\s+)\S+", "", s)
        if s == before:
            return s


INLINE_CODE = [
    re.compile(r"^(sh|bash|zsh|dash|ksh|fish)\s+(?:-\S+\s+)*-\S*c\b"),
    re.compile(r"^eval\b"),
    re.compile(r"^python[0-9.]*\s+(?:-\S+\s+)*-c\b"),
    re.compile(r"^(node|deno|bun)\s+(?:-\S+\s+)*(-e|--eval|-p|--print)\b"),
    re.compile(r"^(perl|ruby|php)\s+(?:-\S+\s+)*-\S*[eEr]\b"),
]


def _is_inline_code(seg: str) -> bool:
    return any(p.search(seg) for p in INLINE_CODE)


# A word at A1: letters, digits and `_ . / : = @ % + , -` only, so the shell cannot expand or redirect it.
PLAIN_WORD = re.compile(r"[A-Za-z0-9_./:=@%+,-]+")
A1_GIT_SUBCOMMANDS = {"status", "diff", "log", "show"}
A1_GIT_DENIED = re.compile(r"--(ou|ext|textc)")
FIND_WRITES = re.compile(r"-(delete|exec|execdir|ok|okdir|fprint|fprint0|fprintf|fls)")


def _read_only_words(words: list[str]) -> bool:
    cmd, args = words[0], words[1:]
    if cmd == "git":
        i = 0
        while i < len(args) and args[i] in ("--no-pager", "-P"):
            i += 1
        return i < len(args) and args[i] in A1_GIT_SUBCOMMANDS and not any(A1_GIT_DENIED.match(w) for w in args[i + 1 :])
    if cmd not in READ_ONLY_COMMANDS:
        return False
    if cmd == "find":
        return not any(FIND_WRITES.fullmatch(w) for w in args)
    if cmd == "sort":
        return not any(re.match(r"-[^-]*o", w) or re.match(r"--(o|co)", w) for w in args)
    if cmd == "rg":
        return not any(re.match(r"--(pre|hostname-bin)", w) for w in args)
    return True


def plain_read_only(command: str) -> bool:
    """The A1 rule: one or more commands from the read-only list joined by `|`, every word plain. Quotes, `$`,
    braces, globs, redirects, `;`, `&`, newlines and backticks are refused before any flag is checked, because
    the shell can rebuild a write flag from them after the check (`-del$'e'te`, `{-delete,-print}`)."""
    # Only space, tab and newline are trimmed here: a command word with any other character is not on the list.
    for segment in (s.strip(" \t\n") for s in command.split("|")):
        words = re.split(r"[ \t]+", segment)
        if segment == "" or not all(PLAIN_WORD.fullmatch(w) for w in words) or not _read_only_words(words):
            return False
    return True


def _tool_file(tool_input: dict) -> str | None:
    path = tool_input.get("file_path")
    return tool_input.get("notebook_path") if path is None else path


def _tainted(ctx: HookContext, wf: dict) -> bool:
    risk = wf.get("risk") or {}
    return ctx.untrusted_seen and (risk.get("trifecta") or {}).get("sensitive_data") is True and not risk.get("gate")


def _limits_decision(ctx: HookContext, wf: dict) -> Decision | None:
    perm = wf.get("permitted_actions") or {}
    if "auto_merge" not in (perm.get("git") or []):
        return _deny("merge-limits", "auto_merge is not in permitted_actions.git")
    if ctx.diff is None:
        return _deny("merge-limits", "diff size cannot be verified")
    maximum = (wf.get("limits") or {}).get("max_diff_lines")
    if maximum is not None and ctx.diff["lines"] > maximum:
        return _deny("merge-limits", f"diff of {ctx.diff['lines']} lines exceeds {maximum}")
    paths = perm.get("paths")
    if paths is not None:
        stray = next((f for f in ctx.diff["files"] if not any(match_path(g, f) for g in paths)), None)
        if stray is not None:
            return _deny("merge-limits", f"changed file outside permitted paths: {stray}")
    return None


def _decide_bash(ctx: HookContext, command: str) -> Decision:
    wf = ctx.workflow
    assert wf is not None and ctx.eff is not None
    level = ctx.eff.effective
    segments = split_segments(command)
    perm = wf.get("permitted_actions") or {}
    forbidden: list[str] = wf.get("forbidden_actions") or []
    if _command_too_long(command):
        return _deny("command-too-long", f"command is longer than {MAX_COMMAND_BYTES} bytes")
    if _governance_shell_write(command):
        return _deny("governance-write", "shell command writes to a governance file")
    if isinstance(perm.get("tools"), list):
        if re.search(r"\$\(|`|<\(|>\(", command):
            return _deny("outside-permitted-tools", "command substitution cannot be matched against permitted_actions")
        if not _permitted_tool(perm["tools"], "Bash", None, segments):
            return _deny("outside-permitted-tools", f"Bash command not in permitted_actions.tools: {command}")
    if level <= 1 and not plain_read_only(command):
        allowed = ", ".join(sorted(READ_ONLY_COMMANDS, key=READ_ONLY_ORDER.index))
        return _deny("a1-plain-commands-only", f"level 1 allows only plain read-only commands joined by |: {allowed}, git status|diff|log|show")
    network = perm.get("network")
    restrict_egress = level <= 2 or network is not None or level >= 4
    mark = False
    for raw in segments:
        seg = strip_wrappers(raw)
        explicit = isinstance(perm.get("tools"), list) and any(e.startswith("Bash(") and _permitted_tool([e], "Bash", None, [raw]) for e in perm["tools"])
        if _is_inline_code(seg) and not explicit:
            return _deny("inline-interpreter", "inline shell or interpreter code cannot be inspected; permit it with an explicit Bash(...) pattern")
        if _is_push(seg):
            if _is_force(seg):
                return _deny("force-push", "force push is never permitted")
            if level <= 2:
                return _deny("git-push-blocked", "git push is blocked below level 3")
            if _pushes_protected(seg, ctx.current_branch):
                return _deny("protected-branch-push", "push to a protected branch is blocked")
        if _is_api_ref_write(seg):
            if _api_ref_protected(seg):
                return _deny("protected-branch-push", "an API write to a protected branch is blocked")
            if level <= 2:
                return _deny("git-push-blocked", "updating a branch through the API is blocked below level 3")
        if _is_merge(seg) or _is_merge_label(seg):
            if level <= 3:
                return _deny("merge-blocked", "merging and merge-triggering labels are blocked below level 4")
            blocked = _limits_decision(ctx, wf)
            if blocked:
                return blocked
        if _is_pr_write(seg) and level <= 2:
            return _deny("pr-write-blocked", "opening or changing a pull request is blocked below level 3")
        if _is_egress(seg) and restrict_egress:
            hosts = _hosts_in(seg)
            allow = network or []
            if not hosts or not all(_host_allowed(h, allow) for h in hosts):
                return _deny("network-blocked", f"egress outside permitted_actions.network: {seg}")
        if "deploy" in forbidden and re.search(r"\bdeploy\b", seg, re.I | re.A):
            return _deny("forbidden-action", "deploy is forbidden")
        if "read_secrets" in forbidden and SECRET_PATH.search(seg):
            return _deny("forbidden-action", "read_secrets is forbidden")
        for word in [f for f in forbidden if f not in ("deploy", "read_secrets", "force_push", "edit_ci", "edit_autonomy")]:
            if re.search(rf"\b{re.escape(word)}\b", seg):
                return _deny("forbidden-action", f"{word} is forbidden")
        if _external_action(seg) and _tainted(ctx, wf):
            return _deny("trifecta-external-action", "session read untrusted input and holds sensitive data; external action needs a named gate")
        if _untrusted_read(seg):
            mark = True
    return Decision(True, mark_untrusted=True) if mark else OK


def decide(ctx: HookContext, call: dict) -> Decision:
    tool = call["tool_name"]
    tool_input = call.get("tool_input") or {}
    file = _tool_file(tool_input)
    if ctx.register_invalid:
        return _deny("register-invalid", "the register fails schema validation; every tool call is denied")
    if file is not None and len(str(file).encode("utf-8", errors="surrogatepass")) > MAX_PATH_BYTES:
        return _deny("path-too-long", f"path is longer than {MAX_PATH_BYTES} bytes")
    if file is not None and tool in WRITE_TOOLS and _governance_path(ctx, file):
        return _deny("governance-write", f"agents may not write {_rel_path(ctx, file)}")
    if ctx.workflow is None or ctx.eff is None:
        if tool in READ_TOOLS:
            return OK
        return _deny("unknown-workflow", "workflow is not in the register; only read-only tools are allowed")
    wf = ctx.workflow
    level = ctx.eff.effective
    perm = wf.get("permitted_actions") or {}
    rel = None if file is None else _rel_path(ctx, file)
    if tool in READ_TOOLS:
        if file is not None and "read_secrets" in (wf.get("forbidden_actions") or []) and SECRET_PATH.search(rel):
            return _deny("forbidden-action", "read_secrets is forbidden")
        if isinstance(perm.get("tools"), list) and not _permitted_tool(perm["tools"], tool, rel, None):
            return _deny("outside-permitted-tools", f"{tool} is not in permitted_actions.tools")
        return OK
    if tool in WRITE_TOOLS:
        if level <= 1:
            return _deny("read-only-level", "level 1 allows read-only tools only")
        if isinstance(perm.get("tools"), list) and not _permitted_tool(perm["tools"], tool, rel, None):
            return _deny("outside-permitted-tools", f"{tool} is not in permitted_actions.tools")
        if isinstance(perm.get("paths"), list) and (rel is None or not any(match_path(g, rel) for g in perm["paths"])):
            return _deny("outside-permitted-paths", f"{file} is outside permitted_actions.paths")
        return OK
    if tool in NETWORK_TOOLS:
        restrict = level <= 2 or perm.get("network") is not None or level >= 4
        if restrict and tool == "WebFetch":
            host = (urlparse(str(tool_input.get("url", ""))).hostname or "").lower()
            if not host:
                return _deny("network-blocked", "WebFetch url is not parseable")
            if not _host_allowed(host, perm.get("network") or []):
                return _deny("network-blocked", f"{host} is not in permitted_actions.network")
        elif restrict:
            return _deny("network-blocked", f"{tool} is blocked: egress is limited to permitted_actions.network")
        if isinstance(perm.get("tools"), list) and not _permitted_tool(perm["tools"], tool, None, None):
            return _deny("outside-permitted-tools", f"{tool} is not in permitted_actions.tools")
        return Decision(True, mark_untrusted=True)
    if tool == "Bash":
        return _decide_bash(ctx, str(tool_input.get("command", "")))
    if isinstance(perm.get("tools"), list):
        if not _permitted_tool(perm["tools"], tool, None, None):
            return _deny("outside-permitted-tools", f"{tool} is not in permitted_actions.tools")
        return _deny("read-only-level", "level 1 allows read-only tools only") if level <= 1 else OK
    return _deny("unknown-tool", f"{tool} is not a recognised tool and permitted_actions.tools does not list it")


@dataclass
class Resolved:
    workflow: dict | None
    eff: Effective | None
    note: str
    register_invalid: bool = False


def resolve_workflow(project_dir: str | Path, workflow_id: str, now: int) -> Resolved:
    root = Path(project_dir)
    register_path = root / ".autonomy.yaml"
    if not register_path.exists():
        return Resolved(None, None, "no .autonomy.yaml; read-only tools only")
    register = load_register_file(register_path)
    errors = validate_register(register)
    if errors:
        where = ", ".join(f"{e['path'] or '/'} {e['keyword']}" for e in errors)
        return Resolved(None, None, f".autonomy.yaml fails schema validation ({where}); every tool call is denied", True)
    wf = next((w for w in all_workflows(register) if w["id"] == workflow_id), None)
    if wf is None:
        return Resolved(None, None, f"workflow {workflow_id} is not in the register; read-only tools only")
    profile_rel = register.get("profile", ".autonomy/profile.json")
    profile = read_json_if_exists(root / profile_rel) if inside_dir(root, profile_rel) else None
    state = read_json_if_exists(root / ".autonomy" / "state.json")
    eff = effective_level(wf, profile, state, register.get("defaults"), now)
    why = f" (reduced: {', '.join(eff.reasons)})" if eff.reasons else ""
    return Resolved(wf, eff, f"workflow {workflow_id}: effective level {eff.effective} of granted {eff.granted}{why}")


def _safe(session: str) -> str:
    return re.sub(r"[^A-Za-z0-9_-]", "_", session)


def _current_branch(project_dir: str) -> str | None:
    out = git(project_dir, ["rev-parse", "--abbrev-ref", "HEAD"])
    return None if out is None else out.strip()


def _diff_against_base(project_dir: str, base: str) -> dict | None:
    out = git(project_dir, ["diff", "--numstat", base])
    if out is None:
        return None
    lines, files = 0, []
    for row in [r for r in out.split("\n") if r]:
        add, delete, name = row.split("\t")
        lines += (int(add) if add.isdigit() else 0) + (int(delete) if delete.isdigit() else 0)
        files.append(name)
    return {"lines": lines, "files": files}


def _iso_ms(now: int) -> str:
    return datetime.fromtimestamp(now / 1000, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def run_hook(event: str, stdin: str, env: dict[str, str | None], now: int) -> tuple[str, int]:
    """Return (stdout, exit_code) for one hook invocation."""
    data: Any = {} if not stdin.strip() else json.loads(stdin)
    if not isinstance(data, dict):
        raise ValueError("hook input must be a JSON object")
    project_dir = str(Path(env.get("CLAUDE_PROJECT_DIR") or data.get("cwd") or os.getcwd()).resolve())
    workflow_id = env.get("AUTONOMY_WORKFLOW") or "interactive"
    resolved = resolve_workflow(project_dir, workflow_id, now)
    if event == "session-start":
        context = f"Autonomy: {resolved.note}."
        return json.dumps({"hookSpecificOutput": {"hookEventName": "SessionStart", "additionalContext": context}}, separators=(",", ":")), 0
    if event != "pre-tool-use":
        raise ValueError(f"unknown hook event: {event}")
    if not isinstance(data.get("tool_name"), str) or data["tool_name"] == "" or not isinstance(data.get("tool_input"), dict):
        raise ValueError("pre-tool-use input needs a string tool_name and an object tool_input")
    session = data.get("session_id") or "unknown"
    session_path = Path(project_dir) / ".autonomy" / "sessions" / f"{_safe(session)}.json"
    seen = (read_json_if_exists(session_path) or {}).get("untrusted_input_seen") is True
    tool_input = data.get("tool_input") or {}
    command = str(tool_input.get("command", ""))
    is_merge_call = data.get("tool_name") == "Bash" and not _command_too_long(command) and any(_is_merge(strip_wrappers(s)) for s in split_segments(command))
    ctx = HookContext(
        project_dir,
        resolved.workflow,
        resolved.eff,
        seen,
        _current_branch(project_dir),
        _diff_against_base(project_dir, env.get("AUTONOMY_BASE") or "origin/main") if is_merge_call else None,
        resolved.register_invalid,
    )
    decision = decide(ctx, {"tool_name": data.get("tool_name"), "tool_input": tool_input})
    audit_dir = Path(project_dir) / ".autonomy" / "audit"
    audit_dir.mkdir(parents=True, exist_ok=True)
    entry = {
        "ts": _iso_ms(now),
        "agent": workflow_id,
        "human": env.get("AUTONOMY_SPONSOR"),
        "tool": data.get("tool_name"),
        "decision": "allow" if decision.allow else "deny",
        "code": decision.code,
    }
    with open(audit_dir / f"{_safe(session)}.jsonl", "a") as log:
        log.write(json.dumps(entry, separators=(",", ":")) + "\n")
    if decision.allow and decision.mark_untrusted:
        session_path.parent.mkdir(parents=True, exist_ok=True)
        session_path.write_text(json.dumps({"untrusted_input_seen": True}))
    if decision.allow:
        return "", 0
    out = {"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny", "permissionDecisionReason": f"{decision.code}: {decision.reason}"}}
    return json.dumps(out, separators=(",", ":")), 0
