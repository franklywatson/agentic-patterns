from __future__ import annotations

import json
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
    iso_seconds,
    last_changed,
    list_files,
    parse_time,
    read_json_if_exists,
)

FRESH_DAYS = 90
WORKSHEET_MAX_AGE_DAYS = 90
CHECK_CMD = re.compile(r"\b(npm (run )?(test|check)|pnpm (run )?(test|check)|pytest|make (test|check))\b")


class Ctx:
    def __init__(self, directory: Path, now: int) -> None:
        self.dir = directory
        self.now = now
        self.files = list_files(directory)
        self.settings = self._json(".claude/settings.json")
        self.claude_md = self.text("CLAUDE.md")
        workflow_files = [f for f in self.files if re.fullmatch(r"\.github/workflows/.+\.ya?ml", f)]
        self.workflows = "\n".join(self.text(f) for f in workflow_files)
        self.codeowners = "\n".join(self.text(p) for p in ("CODEOWNERS", ".github/CODEOWNERS", "docs/CODEOWNERS"))
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
        return full.read_text() if full.is_file() else ""

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


def _codeowners_sets(c: Ctx) -> set[str]:
    sets: set[str] = set()
    for line in c.codeowners.split("\n"):
        parts = line.strip().split()
        if parts and not parts[0].startswith("#") and len(parts) > 1:
            sets.add(" ".join(sorted(parts[1:])))
    return sets


def _ruleset_approves(c: Ctx) -> bool:
    for f in c.files:
        if not re.fullmatch(r"\.github/rulesets/.+\.json", f):
            continue
        try:
            rules = json.loads(c.text(f)).get("rules") or []
        except json.JSONDecodeError:
            continue
        if any(r.get("type") == "pull_request" and (r.get("parameters") or {}).get("required_approving_review_count", 0) >= 1 for r in rules):
            return True
    return False


def _pins_valid(c: Ctx) -> bool:
    try:
        pins = json.loads(c.text(".claude/pins.json")).get("pins") or []
    except json.JSONDecodeError:
        return False
    return len(pins) > 0 and all(re.fullmatch(r"[0-9a-f]{64}", p.get("sha256") or "") for p in pins)


def _baseline_fresh(c: Ctx) -> bool:
    try:
        b = json.loads(c.text(".autonomy/baseline.json"))
        return "flow" in b and "stability" in b and age_days(c.now, parse_time(b["captured"])) <= FRESH_DAYS
    except (json.JSONDecodeError, KeyError, ValueError, TypeError):
        return False


def _last_review_fresh(c: Ctx) -> bool:
    lines = [line for line in c.text(".autonomy/reviews.jsonl").split("\n") if line]
    if not lines:
        return False
    try:
        return age_days(c.now, parse_time(json.loads(lines[-1])["ts"])) <= FRESH_DAYS
    except (json.JSONDecodeError, KeyError, ValueError, TypeError):
        return False


def _claude_md_lines(c: Ctx) -> int:
    return len(c.claude_md.split("\n")) - (1 if c.claude_md.endswith("\n") else 0)


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
    Probe("platform", 3, "check-command", lambda c: bool(CHECK_CMD.search(c.claude_md)) and bool(CHECK_CMD.search(c.workflows))),
    Probe("platform", 3, "ci-identity", lambda c: not re.search(r"secrets\.[A-Z_]*API_KEY", c.workflows) or bool(re.search(r"id-token:\s*write", c.workflows))),
    Probe("platform", 3, "sandbox-locked", lambda c: _sandbox(c).get("enabled") is True and _sandbox(c).get("allowUnsandboxedCommands") is False),
    Probe("platform", 4, "egress-allowlist", lambda c: _non_empty_list((_sandbox(c).get("network") or {}).get("allowedDomains"))),
    Probe("platform", 4, "audit-log", lambda c: len(c.audit_lines) > 0),
    Probe("platform", 5, "versioned-marketplace", lambda c: len(c.settings.get("extraKnownMarketplaces") or {}) > 0),
    Probe("platform", 5, "agents-md", lambda c: c.exists("AGENTS.md")),
    # shared context
    Probe("shared_context", 2, "claude-md", lambda c: c.exists("CLAUDE.md")),
    Probe("shared_context", 3, "claude-md-short", lambda c: _claude_md_lines(c) <= 150),
    Probe("shared_context", 3, "claude-md-fresh", lambda c: c.changed_within("CLAUDE.md", FRESH_DAYS)),
    Probe("shared_context", 3, "claude-md-owner", lambda c: re.search(r"^/?(CLAUDE\.md|\*)\s+\S+", c.codeowners, re.M) is not None),
    Probe(
        "shared_context", 3, "decision-log",
        lambda c: any(re.match(r"^docs/(solutions|adr|adrs|decisions)/", f) and c.changed_within(f, FRESH_DAYS) for f in c.files),
    ),
    Probe(
        "shared_context", 3, "blocking-hook-tested",
        lambda c: _non_empty_list((c.settings.get("hooks") or {}).get("PreToolUse")) and any(re.search(r"hook.*test|test.*hook", f, re.I) for f in c.files),
    ),
    Probe("shared_context", 5, "docs-pruned", lambda c: deletions_since(c.dir, "docs", c.now - FRESH_DAYS * DAY_MS) > 0),
    # operating model
    Probe("operating_model", 2, "ci-tests-lint", lambda c: bool(re.search(r"\btest\b", c.workflows, re.I)) and bool(re.search(r"\blint\b", c.workflows, re.I))),
    Probe("operating_model", 3, "ci-on-pr", lambda c: "pull_request" in c.workflows),
    Probe("operating_model", 3, "automated-review", lambda c: re.search(r"anthropics/claude-code-action|claude-code-review|code-review", c.workflows, re.I) is not None),
    Probe("operating_model", 3, "skill-chain", lambda c: c.exists(".harness.yaml") or any(f.startswith(".claude/skills/") for f in c.files)),
    Probe("operating_model", 4, "review-tiers", lambda c: c.exists("REVIEW.md") or len(_codeowners_sets(c)) >= 2),
    Probe("operating_model", 5, "retired-rules-recorded", lambda c: c.exists("docs/retired.md")),
    # governance
    Probe("governance", 2, "constitutional-rules", lambda c: re.search(r"constitutional", c.claude_md, re.I) is not None),
    Probe("governance", 3, "sandbox-locked", lambda c: _sandbox(c).get("enabled") is True and _sandbox(c).get("allowUnsandboxedCommands") is False),
    Probe("governance", 3, "deny-rules", lambda c: _non_empty_list((c.settings.get("permissions") or {}).get("deny"))),
    Probe("governance", 3, "extensions-pinned", _pins_valid),
    Probe("governance", 3, "non-author-approval", _ruleset_approves),
    Probe("governance", 3, "secret-scanning", lambda c: re.search(r"gitleaks|trufflehog|secret-scanning", c.workflows, re.I) is not None or c.exists(".github/secret_scanning.yml")),
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
    Probe("ownership", 3, "author-trailer", lambda c: re.search(r"author-of-record|co-authored-by", c.claude_md, re.I) is not None or c.exists(".gitmessage")),
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
            sheet = read_json_if_exists(root / ".autonomy" / "worksheets" / "skill.json")
            fresh = sheet is not None and age_days(now, parse_time(sheet["date"])) <= WORKSHEET_MAX_AGE_DAYS
            if fresh and isinstance(sheet["level"], int) and 1 <= sheet["level"] <= 5:
                dimensions["skill"] = {"level": sheet["level"], "evidence": ["worksheet:skill"], "missing_for_next": []}
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
    profile["cap"] = cap_of(profile)
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
