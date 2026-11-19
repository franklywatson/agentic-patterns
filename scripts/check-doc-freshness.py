#!/usr/bin/env python3
"""Check the `reviewed:` front matter date of pattern docs.

Usage: python3 scripts/check-doc-freshness.py [repo_root]
Checks docs/L0-foundation.md, docs/L1-feedback-loops.md, docs/L1-patterns/*.md, docs/L2-*.md, docs/L3-*.md,
docs/L4-*.md, docs/earned-autonomy.md, docs/cross-cutting/*.md (except glossary and faq) and
docs/references/task-bank.md.
Prints a GitHub Actions warning when `reviewed:` is 90 or more days old and an error when it is 180 or more days old,
dated in the future, unparseable, or missing. Also errors when `last-validated-model:` is missing. If an optional
`expires:` key is present, it errors when that date is in the past or unparseable.
Dates are YYYY-MM-DD, optionally quoted, optionally followed by a `# comment`. "Today" is the UTC date.
Exits 1 if any error was reported, 0 otherwise.
"""
import re
import sys
from datetime import date, datetime, timezone
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
            keys[kv.group(1)] = clean(kv.group(2))
    return keys


def clean(value):
    """Drop an inline `# comment` and one pair of surrounding quotes."""
    value = re.sub(r"\s+#.*$", "", value).strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
        value = value[1:-1].strip()
    return value


def parse_date(value):
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def check(path, root, today):
    rel = path.relative_to(root)
    keys = front_matter(path)
    errors, warnings = [], []
    if not keys.get("last-validated-model"):
        errors.append(f"{rel}: front matter key `last-validated-model` is missing")
    expires = keys.get("expires")
    if expires:
        expiry = parse_date(expires)
        if expiry is None:
            errors.append(f"{rel}: `expires: {expires}` is not a YYYY-MM-DD date")
        elif expiry < today:
            errors.append(f"{rel}: expired on {expires}")
    reviewed = keys.get("reviewed")
    if not reviewed:
        errors.append(f"{rel}: front matter key `reviewed` is missing")
        return errors, warnings
    reviewed_on = parse_date(reviewed)
    if reviewed_on is None:
        errors.append(f"{rel}: `reviewed: {reviewed}` is not a YYYY-MM-DD date")
        return errors, warnings
    age = (today - reviewed_on).days
    if age < 0:
        errors.append(f"{rel}: `reviewed: {reviewed}` is in the future")
    elif age >= FAIL_DAYS:
        errors.append(f"{rel}: reviewed {age} days ago (fails at {FAIL_DAYS})")
    elif age >= WARN_DAYS:
        warnings.append(f"{rel}: reviewed {age} days ago (warns at {WARN_DAYS}, fails at {FAIL_DAYS})")
    return errors, warnings


def main():
    root = Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()
    today = datetime.now(timezone.utc).date()
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
