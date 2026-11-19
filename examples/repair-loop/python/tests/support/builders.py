"""Builders shared by unit, eval and stack tests."""

from __future__ import annotations

from dataclasses import replace
from pathlib import Path

from repair_loop.antimask import scan_production_diff
from repair_loop.classify import classify
from repair_loop.config import load_policy, load_rules
from repair_loop.diff import parse_diff
from repair_loop.models import Budget, EvidenceBundle, Reproduction

policy = load_policy()
rules = load_rules()
PATCH_DIR = Path(__file__).resolve().parents[2] / "patches"


def patch_text(name: str) -> str:
    return (PATCH_DIR / name).read_text()


def clean_bundle(**overrides) -> EvidenceBundle:
    """An evidence bundle that the gate accepts. Tests override single fields."""
    diff = parse_diff(patch_text("INC-001.fix.patch"))
    bundle = EvidenceBundle(
        incident_id="INC-001",
        fingerprint="92e2a8020bd5",
        reproduction=Reproduction(True, True, "aaa", "aaa"),
        regression="pass",
        diff=diff,
        classification=classify(diff, rules),
        antimask=scan_production_diff(diff),
        budget=Budget(0, 1, False),
        grant="A3",
        stop_engaged=False,
    )
    return replace(bundle, **overrides)


def bundle_from_diff(text: str, **overrides) -> EvidenceBundle:
    """Build a bundle from a diff text: classification and scan come from the real modules."""
    diff = parse_diff(text)
    return clean_bundle(diff=diff, classification=classify(diff, rules), antimask=scan_production_diff(diff), **overrides)


def make_diff(path: str, added: list[str], removed: list[str] | None = None, status: str = "modified") -> str:
    old = "/dev/null" if status == "added" else f"a/{path}"
    lines = [f"--- {old}", f"+++ b/{path}", "@@ -1,1 +1,1 @@"]
    lines += [f"-{line}" for line in removed or []]
    lines += [f"+{line}" for line in added]
    return "\n".join(lines) + "\n"
