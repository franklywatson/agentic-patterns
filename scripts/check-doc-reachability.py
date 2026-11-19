#!/usr/bin/env python3
"""Report docs/**/*.md files that cannot be reached from AGENTS.md by following markdown links.

Usage: python3 scripts/check-doc-reachability.py [repo_root] [--exclude PREFIX ...]
Links are followed transitively: AGENTS.md -> docs it links to -> docs those link to.
Prints a GitHub Actions error annotation per orphan. Exits 1 when at least one orphan exists, 0 otherwise.
"""
import re
import sys
from pathlib import Path

LINK_RE = re.compile(r"\]\(([^)\s#]+\.md)(?:#[^)\s]*)?\)|(?<![\w/])@(\.?/?[\w./-]+\.md)")


def links(path, root):
    found = set()
    for target in LINK_RE.findall(path.read_text()):
        raw = target[0] or target[1]
        if "://" in raw:
            continue
        base = root if raw.startswith("/") else path.parent
        candidate = (base / raw.lstrip("/")).resolve()
        if candidate.is_file():
            found.add(candidate)
    return found


def main():
    args = sys.argv[1:]
    excludes = []
    while "--exclude" in args:
        i = args.index("--exclude")
        excludes.append(args[i + 1])
        del args[i:i + 2]
    root = Path(args[0] if args else ".").resolve()
    start = root / "AGENTS.md"
    seen, queue = {start}, [start]
    while queue:
        for nxt in links(queue.pop(), root):
            if nxt not in seen and nxt.suffix == ".md":
                seen.add(nxt)
                queue.append(nxt)
    orphans = 0
    for doc in sorted((root / "docs").rglob("*.md")):
        rel = doc.relative_to(root).as_posix()
        if doc.resolve() in seen or any(rel.startswith(p) for p in excludes):
            continue
        print(f"::error file={rel}::Orphaned doc: {rel} is not reachable from AGENTS.md")
        orphans += 1
    print(f"{orphans} orphan doc(s); {len(seen)} files reachable from AGENTS.md")
    return 1 if orphans else 0


if __name__ == "__main__":
    sys.exit(main())
