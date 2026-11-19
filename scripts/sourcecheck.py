#!/usr/bin/env python3
"""Check that every reference ID cited in docs/ resolves in docs/references/sources.md.

Usage: python3 scripts/sourcecheck.py [repo_root]
Exits 1 and lists the IDs if any cited ID has no row in sources.md.
"""
import re
import sys
from pathlib import Path

PREFIXES = "MC|PL|SC|OM|SG|PO|IS|MV|AN"
ID_RE = re.compile(r"\b(" + PREFIXES + r")-(\d+)\b")
RANGE_RE = re.compile(r"\b(" + PREFIXES + r")-(\d+) to (?:\1-)?(\d+)\b")
ROW_RE = re.compile(r"^\| (" + PREFIXES + r")-(\d+) \|", re.M)


def cited_ids(text):
    ids = {f"{p}-{n}" for p, n in ID_RE.findall(text)}
    for p, a, b in RANGE_RE.findall(text):
        ids |= {f"{p}-{n}" for n in range(int(a), int(b) + 1)}
    return ids


def main():
    root = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
    docs = root / "docs"
    sources = docs / "references/sources.md"
    listed = {f"{p}-{n}" for p, n in ROW_RE.findall(sources.read_text())}
    cited = set()
    for path in sorted(docs.rglob("*")):
        if path.suffix in {".md", ".html"} and path != sources:
            cited |= cited_ids(path.read_text())
    missing = sorted(cited - listed, key=lambda s: (s.split("-")[0], int(s.split("-")[1])))
    for ref in missing:
        print(f"UNRESOLVED {ref}")
    print(f"cited {len(cited)}, listed {len(listed)}, unresolved {len(missing)}")
    return 1 if missing else 0


if __name__ == "__main__":
    sys.exit(main())
