"""Check internal markdown links and anchors.

Scans every .md file under the root directory and reports:

- MISSING: a relative link whose target file or directory does not exist.
- ANCHOR: a link to a .md file whose #fragment matches no heading slug there.
- ATMISSING / ATANCHOR: the same two checks for `@file.md#anchor` references.

Slugs follow GitHub rules: lowercase, punctuation other than hyphens and
spaces removed, spaces replaced by hyphens. Fenced code blocks and inline
code are ignored. node_modules, .git, .superpowers, .worktrees and the
verbatim review records in docs/refresh/reviews/ are skipped.

Usage: python3 scripts/check-doc-links.py [ROOT]
Exit status: 0 when no issues are found, 1 otherwise.
"""
import glob
import os
import re
import sys

SKIP = ("node_modules", ".git", ".superpowers", ".worktrees")


def slug(heading):
    heading = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", heading).strip().lower()
    heading = re.sub(r"[^\w\- ]", "", heading)
    return heading.replace(" ", "-")


def collect_files(root):
    files = []
    for path in glob.glob(os.path.join(root, "**", "*.md"), recursive=True):
        parts = os.path.relpath(path, root).split(os.sep)
        if any(part in SKIP for part in parts):
            continue
        if "/".join(parts).startswith("docs/refresh/reviews/"):
            continue
        files.append(path)
    return files


def collect_anchors(files):
    anchors = {}
    for path in files:
        found = set()
        in_fence = False
        with open(path) as handle:
            for line in handle:
                if line.startswith("```"):
                    in_fence = not in_fence
                    continue
                match = None if in_fence else re.match(r"^(#+)\s+(.*)", line)
                if match:
                    found.add(slug(match.group(2)))
        anchors[os.path.abspath(path)] = found
    return anchors


def strip_code(text):
    text = re.sub(r"```.*?```", "", text, flags=re.S)
    return re.sub(r"`[^`\n]*`", "", text)


def check(root):
    files = collect_files(root)
    anchors = collect_anchors(files)
    issues = []
    for path in files:
        rel = os.path.relpath(path, root)
        with open(path) as handle:
            text = strip_code(handle.read())
        for match in re.finditer(r"\]\(([^)\s]+)\)", text):
            link = match.group(1)
            if link.startswith(("http", "mailto")):
                continue
            target, _, fragment = link.partition("#")
            resolved = (
                os.path.abspath(os.path.join(os.path.dirname(path), target))
                if target
                else os.path.abspath(path)
            )
            if not os.path.exists(resolved):
                issues.append(("MISSING", rel, link))
            elif fragment and resolved.endswith(".md") and fragment not in anchors.get(resolved, set()):
                issues.append(("ANCHOR", rel, link))
        for match in re.finditer(r"@([\w./-]+\.md)(#[\w-]+)?", text):
            name = match.group(1)
            fragment = (match.group(2) or "")[1:]
            candidates = [
                os.path.join(root, name),
                os.path.join(os.path.dirname(path), name),
                os.path.join(root, "docs", name),
            ]
            found = [c for c in candidates if os.path.exists(c)]
            if not found:
                issues.append(("ATMISSING", rel, match.group(0)))
            elif fragment and fragment not in anchors.get(os.path.abspath(found[0]), set()):
                issues.append(("ATANCHOR", rel, match.group(0)))
    return issues


def main():
    root = sys.argv[1] if len(sys.argv) > 1 else "."
    issues = check(root)
    for kind, rel, link in issues:
        print(kind, rel, link)
    print("total issues", len(issues))
    return 1 if issues else 0


if __name__ == "__main__":
    sys.exit(main())
