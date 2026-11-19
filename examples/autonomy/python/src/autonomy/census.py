from __future__ import annotations

import json
import math
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable

from autonomy.levels import ALL_DIMENSIONS, cap_of
from autonomy.register import load_register_file, validate_register
from autonomy.util import (
    DAY_MS,
    age_days,
    deletions_since,
    git,
    iso_seconds,
    last_changed,
    list_files,
    read_json_if_exists,
    try_parse_time,
)

FRESH_DAYS = 90
WORKSHEET_MAX_AGE_DAYS = 90
AGENTS_IMPORT = re.compile(r"(^|\s)@AGENTS\.md\b", re.M | re.A)
CHECK_CMD = re.compile(r"\b(npm (run )?(test|check)|pnpm (run )?(test|check)|pytest|make (test|check))\b", re.A)


class Ctx:
    def __init__(self, directory: Path, now: int) -> None:
        self.dir = directory
        self.now = now
        self.files = list_files(directory)
        settings = self._json(".claude/settings.json")
        self.settings = settings if isinstance(settings, dict) else {}
        # CLAUDE.md, plus AGENTS.md when CLAUDE.md imports it with `@AGENTS.md` or CLAUDE.md is absent: the files
        # Claude Code loads. Existing files only.
        files = ["CLAUDE.md"]
        if not self.exists("CLAUDE.md") or AGENTS_IMPORT.search(self.text("CLAUDE.md")):
            files.append("AGENTS.md")
        self.instruction_files = [f for f in files if self.exists(f)]
        self.instructions = "\n".join(self.text(f) for f in self.instruction_files)
        workflow_files = [f for f in self.files if re.fullmatch(r"\.github/workflows/.+\.ya?ml", f)]
        self.workflows = "\n".join(self.text(f) for f in workflow_files)
        # GitHub reads only the first CODEOWNERS it finds, in this order.
        self.codeowners_path = next((p for p in (".github/CODEOWNERS", "CODEOWNERS", "docs/CODEOWNERS") if self.exists(p)), None)
        self.codeowners = "" if self.codeowners_path is None else self.text(self.codeowners_path)
        # The branch origin/HEAD names, or main and master when the clone has no origin/HEAD.
        head = (git(directory, ["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"]) or "").strip()
        self.default_branches = [head[head.index("/") + 1 :]] if head else ["main", "master"]
        self.register: dict | None = None
        if self.exists(".autonomy.yaml"):
            try:
                self.register = load_register_file(directory / ".autonomy.yaml")
            except Exception:  # an unreadable register is absent evidence
                self.register = None
        self.audit_lines: list[dict] = []
        audit_dir = directory / ".autonomy" / "audit"
        if audit_dir.exists():
            for name in sorted(p.name for p in audit_dir.iterdir() if p.name.endswith(".jsonl")):
                for line in self.text(f".autonomy/audit/{name}").split("\n"):
                    if not line:
                        continue
                    try:
                        self.audit_lines.append(json.loads(line))
                    except json.JSONDecodeError:
                        pass  # a malformed audit line is not evidence
        ledger_dir = directory / ".autonomy" / "ledger"
        self.ledger_names = [p.name for p in ledger_dir.iterdir() if p.name.endswith(".jsonl")] if ledger_dir.exists() else []

    def text(self, path: str) -> str:
        full = self.dir / path
        return full.read_text(encoding="utf-8", errors="replace") if full.is_file() else ""

    def exists(self, path: str) -> bool:
        return (self.dir / path).exists()

    def _json(self, path: str) -> Any:
        try:
            return json.loads(self.text(path))
        except json.JSONDecodeError:
            return {}

    def changed_within(self, path: str, days: int) -> bool:
        t = last_changed(self.dir, path)
        return t is not None and age_days(self.now, t) <= days


@dataclass
class Probe:
    dimension: str
    level: int
    id: str
    test: Callable[[Ctx], bool]


def _wfs(c: Ctx) -> list[dict]:
    return (c.register or {}).get("workflows") or []


def _sandbox(c: Ctx) -> dict:
    return c.settings.get("sandbox") or {}


def _non_empty_list(v: Any) -> bool:
    return isinstance(v, list) and len(v) > 0


OWNER = re.compile(r"@[\w.-]+(/[\w.-]+)?|[^@\s]+@[^@\s]+\.[^@\s]+", re.A)


def _codeowners_rules(c: Ctx) -> list[tuple[str, list[str]]]:
    """CODEOWNERS rules with their valid owners (`@user`, `@org/team` or an email); comments are removed."""
    rules = []
    for line in c.codeowners.split("\n"):
        parts = re.sub(r"(^|\s)#.*$", "", line).strip().split()
        owners = [o for o in parts[1:] if OWNER.fullmatch(o)]
        if parts and owners:
            rules.append((parts[0], owners))
    return rules


def _codeowners_sets(c: Ctx) -> set[str]:
    return {" ".join(sorted(owners)) for _, owners in _codeowners_rules(c)}


def codeowners_match(pattern: str, path: str) -> bool:
    """True when a CODEOWNERS pattern matches a file path. Gitignore rules as GitHub applies them: a leading or inner
    `/` anchors the pattern at the root, a trailing `/` matches only a folder's contents, `*` and `?` stay inside
    one name, `**` crosses folders, and a pattern that names a folder also matches its contents, except one ending
    in `/*`, which GitHub applies to that folder's own files only."""
    dir_only = pattern.endswith("/")
    body = re.sub(r"/$", "", re.sub(r"^/", "", pattern))
    if body == "":
        return False
    anchored = pattern.startswith("/") or "/" in body
    out = ""
    i = 0
    while i < len(body):
        ch = body[i]
        if body.startswith("**/", i):
            out += "(?:[^/]+/)*"
            i += 2
        elif body.startswith("/**", i) and i + 3 == len(body):
            out += "/.*"
            i += 2
        elif ch == "*":
            out += "[^/]*"
        elif ch == "?":
            out += "[^/]"
        else:
            out += re.escape(ch)
        i += 1
    tail = "/.*" if dir_only else "" if body.endswith("/*") else "(?:/.*)?"
    return re.fullmatch(("" if anchored else "(?:[^/]+/)*") + out + tail, path, re.S) is not None


# Paths a high-tier change touches: CI, Claude Code configuration, the register and CODEOWNERS itself.
HIGH_TIER_SAMPLES = (".github/workflows/ci.yml", ".github/actions/setup/action.yml", ".claude/settings.json", ".claude/hooks/guard.sh", ".autonomy.yaml", ".autonomy/profile.json")


def _codeowners_cover_high_tier(c: Ctx) -> bool:
    """Every high-tier sample path, and the CODEOWNERS file itself, has an owner: the last matching rule names one."""
    lines = [parts for parts in (re.sub(r"(^|\s)#.*$", "", line).strip().split() for line in c.codeowners.split("\n")) if parts]

    def owned(path: str) -> bool:
        rule = next((parts for parts in reversed(lines) if codeowners_match(parts[0], path)), None)
        return rule is not None and any(OWNER.fullmatch(o) for o in rule[1:])

    return c.codeowners_path is not None and all(owned(p) for p in (*HIGH_TIER_SAMPLES, c.codeowners_path))


def _empty_or_absent(obj: dict, key: str) -> bool:
    """The key is absent or holds an empty list; anything else (a non-empty list, null, an object) is not empty."""
    return key not in obj or (isinstance(obj[key], list) and obj[key] == [])


def _names_default(c: Ctx, patterns: Any) -> bool:
    """A ref_name pattern list names the default branch: `~DEFAULT_BRANCH`, `refs/heads/<name>` or `<name>`."""
    return isinstance(patterns, list) and any(
        p == "~DEFAULT_BRANCH" or any(p in (b, f"refs/heads/{b}") for b in c.default_branches) for p in patterns
    )


def _rule_approves(c: Ctx, rule: Any) -> bool:
    if not isinstance(rule, dict) or rule.get("type") != "pull_request" or not isinstance(rule.get("parameters"), dict):
        return False
    parameters = rule["parameters"]
    count = parameters.get("required_approving_review_count")
    if isinstance(count, float) and count.is_integer():
        count = int(count)  # JSON 1.0 is the integer 1, as in TypeScript
    if isinstance(count, int) and not isinstance(count, bool) and _finite(count) and count >= 1:
        return True
    return parameters.get("require_code_owner_review") is True and _codeowners_cover_high_tier(c)


def _ruleset_approves(c: Ctx) -> bool:
    """A committed ruleset that is enforced (`enforcement: "active"`) on the default branch, with no bypass actors and
    no excluded branches, requires a non-author approval: on every pull request (an integer
    `required_approving_review_count` of at least 1), or on pull requests that change a file with a code owner
    (`require_code_owner_review: true` and a CODEOWNERS whose rules give an owner to every high-tier path). The probe
    reads the committed file's shape; it does not show that GitHub enforces the ruleset."""
    for f in c.files:
        if not re.fullmatch(r"\.github/rulesets/.+\.json", f):
            continue
        try:
            rs = json.loads(c.text(f), parse_constant=_reject_constant)
        except ValueError:
            continue
        if not isinstance(rs, dict) or rs.get("enforcement") != "active" or rs.get("target", "branch") != "branch":
            continue
        if not _empty_or_absent(rs, "bypass_actors"):
            continue
        ref = rs["conditions"].get("ref_name") if isinstance(rs.get("conditions"), dict) else None
        if not isinstance(ref, dict) or not _names_default(c, ref.get("include")) or not _empty_or_absent(ref, "exclude"):
            continue
        if isinstance(rs.get("rules"), list) and any(_rule_approves(c, r) for r in rs["rules"]):
            return True
    return False


def _reject_constant(name: str) -> Any:
    raise ValueError(f"{name} is not JSON")  # TypeScript's JSON.parse rejects NaN and Infinity too


def _pins_valid(c: Ctx) -> bool:
    try:
        pins = json.loads(c.text(".claude/pins.json")).get("pins") or []
    except json.JSONDecodeError:
        return False
    return len(pins) > 0 and all(re.fullmatch(r"[0-9a-f]{64}", p.get("sha256") or "") for p in pins)


def _finite(v: int | float) -> bool:
    """Finite as a JSON number in TypeScript: an integer too large for a double is Infinity there."""
    try:
        return math.isfinite(float(v))
    except OverflowError:
        return False


def _has_finite_number(value: Any) -> bool:
    return isinstance(value, dict) and any(isinstance(v, (int, float)) and not isinstance(v, bool) and _finite(v) for v in value.values())


def _recent(c: Ctx, value: Any, days: int) -> bool:
    """A date the census accepts as evidence: an ISO date or time, not later than now, within `days`."""
    t = try_parse_time(value)
    return t is not None and t <= c.now and age_days(c.now, t) <= days


def _baseline_fresh(c: Ctx) -> bool:
    try:
        b = json.loads(c.text(".autonomy/baseline.json"), parse_constant=_reject_constant)
    except ValueError:
        return False
    return isinstance(b, dict) and _has_finite_number(b.get("flow")) and _has_finite_number(b.get("stability")) and _recent(c, b.get("captured"), FRESH_DAYS)


def _last_review_fresh(c: Ctx) -> bool:
    lines = [line for line in c.text(".autonomy/reviews.jsonl").split("\n") if line]
    if not lines:
        return False
    try:
        last = json.loads(lines[-1])
    except ValueError:
        return False
    return isinstance(last, dict) and _recent(c, last.get("ts"), FRESH_DAYS)


INSTRUCTION_LINE_LIMIT = 200


def _line_count(text: str) -> int:
    return len(text.split("\n")) - (1 if text.endswith("\n") else 0)


def _instructions_fresh(c: Ctx) -> bool:
    """Latest commit time across the instruction files, so a maintained AGENTS.md keeps a one-line CLAUDE.md fresh."""
    return any(c.changed_within(f, FRESH_DAYS) for f in c.instruction_files)


def _trifecta_classified(c: Ctx) -> bool:
    workflows = _wfs(c)
    if not workflows:
        return False
    for w in workflows:
        t = (w.get("risk") or {}).get("trifecta")
        if not t:
            return False
        if t.get("untrusted_input") and t.get("sensitive_data") and t.get("external_action") and not w["risk"].get("gate"):
            return False
    return True


def _task_banks(c: Ctx) -> bool:
    banks = [(w.get("verification") or {}).get("task_bank") for w in _wfs(c)]
    banks = [b for b in banks if b]
    return len(banks) > 0 and all(c.exists(b) for b in banks)


def _has(*parts: str) -> Callable[[dict], bool]:
    return lambda w: all(w.get(p) for p in parts)


PROBES: list[Probe] = [
    # platform
    Probe("platform", 2, "agent-config", lambda c: c.exists(".claude") or c.exists(".harness.yaml") or c.exists("AGENTS.md")),
    Probe("platform", 3, "check-command", lambda c: bool(CHECK_CMD.search(c.instructions)) and bool(CHECK_CMD.search(c.workflows))),
    Probe("platform", 3, "ci-identity", lambda c: not re.search(r"secrets\.[A-Z_]*API_KEY", c.workflows) or bool(re.search(r"id-token:\s*write", c.workflows))),
    Probe("platform", 3, "sandbox-locked", lambda c: _sandbox(c).get("enabled") is True and _sandbox(c).get("allowUnsandboxedCommands") is False),
    Probe("platform", 4, "egress-allowlist", lambda c: _non_empty_list((_sandbox(c).get("network") or {}).get("allowedDomains"))),
    Probe("platform", 4, "audit-log", lambda c: len(c.audit_lines) > 0),
    Probe("platform", 5, "versioned-marketplace", lambda c: len(c.settings.get("extraKnownMarketplaces") or {}) > 0),
    Probe("platform", 5, "agents-md", lambda c: c.exists("AGENTS.md")),
    # shared context
    Probe("shared_context", 2, "claude-md", lambda c: c.exists("CLAUDE.md")),
    Probe("shared_context", 3, "claude-md-short", lambda c: sum(_line_count(c.text(f)) for f in c.instruction_files) <= INSTRUCTION_LINE_LIMIT),
    Probe("shared_context", 3, "claude-md-fresh", _instructions_fresh),
    Probe("shared_context", 3, "claude-md-owner", lambda c: any(p in ("CLAUDE.md", "/CLAUDE.md", "*") for p, _ in _codeowners_rules(c))),
    Probe(
        "shared_context", 3, "decision-log",
        lambda c: any(re.match(r"^docs/(solutions|adr|adrs|decisions)/", f) and c.changed_within(f, FRESH_DAYS) for f in c.files),
    ),
    Probe(
        "shared_context", 3, "blocking-hook-tested",
        lambda c: _non_empty_list((c.settings.get("hooks") or {}).get("PreToolUse")) and any(re.search(r"hook.*test|test.*hook", f, re.I | re.A) for f in c.files),
    ),
    Probe("shared_context", 5, "docs-pruned", lambda c: deletions_since(c.dir, "docs", c.now - FRESH_DAYS * DAY_MS) > 0),
    # operating model
    Probe("operating_model", 2, "ci-tests-lint", lambda c: bool(re.search(r"\btest\b", c.workflows, re.I | re.A)) and bool(re.search(r"\blint\b", c.workflows, re.I | re.A))),
    Probe("operating_model", 3, "ci-on-pr", lambda c: "pull_request" in c.workflows),
    Probe("operating_model", 3, "automated-review", lambda c: re.search(r"anthropics/claude-code-action|claude-code-review|code-review", c.workflows, re.I | re.A) is not None),
    Probe("operating_model", 3, "skill-chain", lambda c: c.exists(".harness.yaml") or any(f.startswith(".claude/skills/") for f in c.files)),
    Probe("operating_model", 4, "review-tiers", lambda c: c.exists("REVIEW.md") or len(_codeowners_sets(c)) >= 2),
    Probe("operating_model", 5, "retired-rules-recorded", lambda c: c.exists("docs/retired.md")),
    # governance
    Probe("governance", 2, "constitutional-rules", lambda c: re.search(r"constitutional", c.instructions, re.I | re.A) is not None),
    Probe("governance", 3, "sandbox-locked", lambda c: _sandbox(c).get("enabled") is True and _sandbox(c).get("allowUnsandboxedCommands") is False),
    Probe("governance", 3, "deny-rules", lambda c: _non_empty_list((c.settings.get("permissions") or {}).get("deny"))),
    Probe("governance", 3, "extensions-pinned", _pins_valid),
    Probe("governance", 3, "non-author-approval", _ruleset_approves),
    Probe("governance", 3, "secret-scanning", lambda c: re.search(r"gitleaks|trufflehog|secret-scanning", c.workflows, re.I | re.A) is not None or c.exists(".github/secret_scanning.yml")),
    Probe("governance", 4, "trifecta-classified", _trifecta_classified),
    Probe("governance", 4, "audit-names-agent", lambda c: any(bool(line.get("agent")) and bool(line.get("human")) for line in c.audit_lines)),
    Probe("governance", 5, "review-record", _last_review_fresh),
    Probe(
        "governance", 5, "stop-drills-recorded",
        lambda c: any(w["granted_level"] >= 4 for w in _wfs(c)) and all((w.get("stop") or {}).get("last_tested") is not None for w in _wfs(c) if w["granted_level"] >= 4),
    ),
    # ownership
    Probe("ownership", 2, "register-owners", lambda c: len(_wfs(c)) > 0 and all(isinstance(w.get("owner"), str) and w["owner"] != "" for w in _wfs(c))),
    Probe("ownership", 3, "owners-in-codeowners", lambda c: len(_wfs(c)) > 0 and all(w["owner"] in c.codeowners for w in _wfs(c))),
    Probe("ownership", 3, "sponsors-and-expiry", lambda c: len(_wfs(c)) > 0 and all(w.get("sponsor") and (w["granted_level"] < 4 or w.get("access_expires")) for w in _wfs(c))),
    Probe("ownership", 3, "author-trailer", lambda c: re.search(r"author-of-record|co-authored-by", c.instructions, re.I | re.A) is not None or c.exists(".gitmessage")),
    Probe("ownership", 4, "harness-eval-in-ci", lambda c: re.search(r"\.claude/\*\*", c.workflows) is not None),
    Probe(
        "ownership", 4, "stop-authority",
        lambda c: all((w.get("stop") or {}).get("mechanism") and _non_empty_list((w.get("stop") or {}).get("authority")) for w in _wfs(c) if w["granted_level"] >= 3)
        and any(w["granted_level"] >= 3 for w in _wfs(c)),
    ),
    Probe("ownership", 5, "retirements-recorded", lambda c: c.exists(".autonomy/retirements.jsonl")),
    # measuring
    Probe("measuring", 2, "outcome-tracking", lambda c: len(c.ledger_names) > 0 or c.exists(".autonomy/baseline.json")),
    Probe("measuring", 3, "baseline", _baseline_fresh),
    Probe("measuring", 4, "task-banks", _task_banks),
    Probe("measuring", 5, "per-workflow-targets", lambda c: len(_wfs(c)) > 0 and all(_has("baseline", "target", "review_date", "stop_rule")(w) for w in _wfs(c))),
]

WORKSHEET_ITEMS = [
    {"dimension": "skill", "step": "work-sample", "instruction": "Run a supervised work sample with each regular agent user and score review quality from 1 to 5."},
    {"dimension": "skill", "step": "perception-survey", "instruction": "Run the perception survey last, after the work sample, so it does not bias the sample."},
    {"dimension": "operating_model", "step": "merge-sample", "instruction": "Sample 10 merged agent PRs and record the share changed after human review."},
    {"dimension": "shared_context", "step": "governed-connectors", "instruction": "Confirm that organisation-level connectors are governed outside this repository."},
]


def run_census(directory: str | Path, now: int) -> dict[str, Any]:
    root = Path(directory).resolve()
    ctx = Ctx(root, now)
    dimensions: dict[str, Any] = {}
    for dimension in ALL_DIMENSIONS:
        if dimension == "skill":
            try:
                sheet = read_json_if_exists(root / ".autonomy" / "worksheets" / "skill.json")
            except ValueError:
                sheet = None
            fresh = isinstance(sheet, dict) and _recent(ctx, sheet.get("date"), WORKSHEET_MAX_AGE_DAYS)
            level = sheet.get("level") if isinstance(sheet, dict) else None
            if fresh and isinstance(level, int) and not isinstance(level, bool) and 1 <= level <= 5:
                dimensions["skill"] = {"level": level, "evidence": ["worksheet:skill"], "missing_for_next": []}
            else:
                dimensions["skill"] = {"level": "unknown", "counted_as": 2, "evidence": [], "missing_for_next": ["worksheet:skill"]}
            continue
        probes = [p for p in PROBES if p.dimension == dimension]
        level = 1
        for nxt in range(2, 6):
            group = [p for p in probes if p.level == nxt]
            if not group or not all(p.test(ctx) for p in group):
                break
            level = nxt
        evidence: list[str] = []
        for p in probes:
            if p.level <= level and p.test(ctx) and p.id not in evidence:
                evidence.append(p.id)
        missing: list[str] = []
        if level < 5:
            next_group = [p for p in probes if p.level == level + 1]
            missing = [f"human-only:c{level + 1}"] if not next_group else [p.id for p in next_group if not p.test(ctx)]
        dimensions[dimension] = {"level": level, "evidence": evidence, "missing_for_next": missing}
    profile: dict[str, Any] = {"generated": iso_seconds(now), "dimensions": dimensions, "cap": 0, "workflows_over_cap": []}
    profile["cap"] = cap_of(profile, now)
    if ctx.register is not None and not validate_register(ctx.register):
        profile["workflows_over_cap"] = [w["id"] for w in ctx.register["workflows"] if w["granted_level"] > profile["cap"]]
    worksheet = {
        "generated": iso_seconds(now),
        "items": [{**i, "record_to": f".autonomy/worksheets/{i['dimension']}.json"} for i in WORKSHEET_ITEMS],
    }
    return {"profile": profile, "worksheet": worksheet}


def write_census(directory: str | Path, result: dict[str, Any]) -> str:
    out = Path(directory).resolve() / ".autonomy"
    out.mkdir(parents=True, exist_ok=True)
    path = out / "profile.json"
    path.write_text(json.dumps(result["profile"], indent=2) + "\n")
    (out / "worksheet.json").write_text(json.dumps(result["worksheet"], indent=2) + "\n")
    return str(path)
