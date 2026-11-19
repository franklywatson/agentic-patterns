#!/usr/bin/env python3
"""Check the `reviewed:` front matter date of pattern docs.

Usage: python3 scripts/check-doc-freshness.py [repo_root]
Checks docs/L0-foundation.md, docs/L1-feedback-loops.md, docs/L1-patterns/*.md, docs/L2-*.md, docs/L3-*.md,
docs/L4-*.md, docs/earned-autonomy.md, docs/cross-cutting/*.md (except glossary and faq) and
docs/references/task-bank.md.
Prints a GitHub Actions warning when `reviewed:` is 90 or more days old and an error when it is 180 or more days old,
unparseable, or missing. Also errors when `last-validated-model:` is missing.
Exits 1 if any error was reported, 0 otherwise.
"""
import re
import sys
from datetime import date
from pathlib import Path

WARN_DAYS = 90
FAIL_DAYS = 180
EXCLUDED = {"glossary.md", "faq.md"}
FRONT_RE = re.compile(r"\A---\n(.*?)\n---\n", re.S)
KEY_RE = re.compile(r"^([\w-]+):\s*(.*?)\s*$")


def pattern_docs(root):
    docs = root / "docs"
    found = [docs / "L0-foundation.md", docs / "L1-feedback-loops.md"]
    found += sorted((docs / "L1-patterns").glob("*.md"))
    found += sorted(docs.glob("L[234]-*.md"))
    found.append(docs / "earned-autonomy.md")
    found += [p for p in sorted((docs / "cross-cutting").glob("*.md")) if p.name not in EXCLUDED]
    found.append(docs / "references" / "task-bank.md")
    return [p for p in found if p.is_file()]


def front_matter(path):
    match = FRONT_RE.match(path.read_text())
    if not match:
        return {}
    keys = {}
    for line in match.group(1).splitlines():
        kv = KEY_RE.match(line)
        if kv:
            keys[kv.group(1)] = kv.group(2)
    return keys


def check(path, root, today):
    rel = path.relative_to(root)
    keys = front_matter(path)
    errors, warnings = [], []
    if not keys.get("last-validated-model"):
        errors.append(f"{rel}: front matter key `last-validated-model` is missing")
    reviewed = keys.get("reviewed")
    if not reviewed:
        errors.append(f"{rel}: front matter key `reviewed` is missing")
        return errors, warnings
    try:
        age = (today - date.fromisoformat(reviewed)).days
    except ValueError:
        errors.append(f"{rel}: `reviewed: {reviewed}` is not a YYYY-MM-DD date")
        return errors, warnings
    if age >= FAIL_DAYS:
        errors.append(f"{rel}: reviewed {age} days ago (fails at {FAIL_DAYS})")
    elif age >= WARN_DAYS:
        warnings.append(f"{rel}: reviewed {age} days ago (warns at {WARN_DAYS}, fails at {FAIL_DAYS})")
    return errors, warnings


def main():
    root = Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()
    today = date.today()
    docs = pattern_docs(root)
    failed = 0
    for path in docs:
        errors, warnings = check(path, root, today)
        for message in warnings:
            print(f"::warning file={path.relative_to(root)}::{message}")
        for message in errors:
            print(f"::error file={path.relative_to(root)}::{message}")
        failed += len(errors)
    print(f"check-doc-freshness: {len(docs)} docs checked, {failed} error(s)")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
