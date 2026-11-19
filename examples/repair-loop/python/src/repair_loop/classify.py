"""Deterministic reversibility and blast-radius classification from a diff."""

from __future__ import annotations

import re
from dataclasses import replace

from .config import ReversibilityRules
from .diff import glob_match, is_unsafe_path, normalize_path
from .models import BLAST, REVERSIBILITY, Classification, DiffFile


def max_r(a: str, b: str) -> str:
    return a if REVERSIBILITY.index(a) >= REVERSIBILITY.index(b) else b


def max_b(a: str, b: str) -> str:
    return a if BLAST.index(a) >= BLAST.index(b) else b


def exceeds(value: Classification, ceiling: dict[str, str]) -> bool:
    return (
        REVERSIBILITY.index(value.reversibility) > REVERSIBILITY.index(ceiling["reversibility"])
        or BLAST.index(value.blast) > BLAST.index(ceiling["blast"])
    )


def classify(files: list[DiffFile], rules: ReversibilityRules) -> Classification:
    """Each file takes the class of its first matching path rule, or the unknown class (the
    highest). A case variant names the same file on a case-insensitive file system, so a file
    also takes the class of its first case-insensitive match when that is higher. Content rules
    raise the class when a production file's changed lines match. An empty diff is unknown."""
    if not files:
        return Classification(
            rules.unknown["reversibility"], rules.unknown["blast"],
            ["empty diff: unknown classifies as the highest class"],
        )
    reversibility, blast = "R0", "B0"
    reasons: list[str] = []
    for diff_file in files:
        file = replace(diff_file, path=normalize_path(diff_file.path))
        rule = None if is_unsafe_path(file.path) else next((p for p in rules.paths if glob_match(p["glob"], file.path)), None)
        folded = rule and next((p for p in rules.paths if glob_match(p["glob"], file.path, True)), None)
        if rule:
            for r in [rule, folded] if folded and folded is not rule else [rule]:
                reversibility = max_r(reversibility, r["reversibility"])
                blast = max_b(blast, r["blast"])
                reasons.append(f"{file.path}: {r['glob']} -> {r['reversibility']}/{r['blast']}")
        else:
            reversibility = max_r(reversibility, rules.unknown["reversibility"])
            blast = max_b(blast, rules.unknown["blast"])
            reasons.append(
                f"{file.path}: no rule, unknown -> {rules.unknown['reversibility']}/{rules.unknown['blast']}"
            )
        if not is_unsafe_path(file.path) and file.path.startswith("tests/"):
            continue
        changed = "\n".join([*file.added, *file.removed])
        for content in rules.content:
            if re.search(content["pattern"], changed, re.I):
                if "reversibility" in content:
                    reversibility = max_r(reversibility, content["reversibility"])
                if "blast" in content:
                    blast = max_b(blast, content["blast"])
                reasons.append(f"{file.path}: content rule {content['name']}")
    return Classification(reversibility, blast, reasons)
