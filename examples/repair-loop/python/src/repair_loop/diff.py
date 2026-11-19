"""Unified diff parsing, path safety and glob matching."""

from __future__ import annotations

import json
import posixpath
import re

from .models import DiffFile

HUNK = re.compile(r"^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@", re.A)
# Control characters other than tab and carriage return: a text patch has none, a binary file has NUL.
CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


# Lines git writes between `diff --git` and the file headers.
GIT_EXTENDED = re.compile(r"(old mode|new mode|deleted file mode|new file mode|similarity index|dissimilarity index|index|copy from|copy to|rename from|rename to) ")
# A line of a `GIT binary patch` block: `literal N`, `delta N`, or base85 data (a length letter, no spaces).
GIT_BINARY_LINE = re.compile(r"(?:(?:literal|delta) [0-9]+|[A-Za-z][0-9A-Za-z!#$%&()*+;<=>?@^_`{|}~-]*)")
C_ESCAPES = {"a": 7, "b": 8, "t": 9, "n": 10, "v": 11, "f": 12, "r": 13, '"': 34, "\\": 92}


def _unquote(text: str) -> tuple[str, str] | None:
    """Read a C-quoted name (`"a\tb"`, `"caf\303\251"`) as git and GNU diff write it, from the start of `text`.
    Returns the name and the rest of the text, or None when the quoting is malformed."""
    if not text.startswith('"'):
        return None
    out = bytearray()
    i = 1
    while i < len(text):
        ch = text[i]
        if ch == '"':
            return out.decode("utf-8", errors="replace"), text[i + 1 :]
        if ch != "\\":
            out += ch.encode("utf-8", errors="surrogatepass")
        elif re.fullmatch(r"[0-3][0-7][0-7]", text[i + 1 : i + 4]):
            out.append(int(text[i + 1 : i + 4], 8))
            i += 3
        elif text[i + 1 : i + 2] in C_ESCAPES and text[i + 1 : i + 2] != "":
            out.append(C_ESCAPES[text[i + 1]])
            i += 1
        else:
            return None
        i += 1
    return None


def _header_name(text: str) -> str | None:
    """The name in a `---`/`+++` header: quoted, or the text before the one tab that starts the timestamp."""
    if text.startswith('"'):
        q = _unquote(text)
        return q[0] if q is not None and (q[1] == "" or q[1].startswith("\t")) else None
    parts = text.split("\t")
    return None if len(parts) > 2 else parts[0]


def _strip(path: str) -> str:
    """Drop the first path component (a/, b/ or a directory name from `diff -r`)."""
    return re.sub(r"^[^/]+/", "", path)


def _whole_name(text: str) -> str | None:
    """A name that is quoted must be quoted whole; an unquoted name is taken as is."""
    if not text.startswith('"'):
        return text
    q = _unquote(text)
    return q[0] if q is not None and q[1] == "" else None


def _split_pair(text: str, sep: str) -> tuple[str, str] | None:
    """Split "<old> <sep> <new>" where either name may contain the separator. A split counts when one side is
    /dev/null or both sides name the same path after the first component; exactly one split must count."""
    if text.startswith('"'):
        q = _unquote(text)
        if q is None or not q[1].startswith(sep):
            return None
        second = _whole_name(q[1][len(sep) :])
        return None if second is None else (q[0], second)
    found = []
    i = text.find(sep)
    while i != -1:
        left, right = text[:i], _whole_name(text[i + len(sep) :])
        if right is not None and (left == "/dev/null" or right == "/dev/null" or _strip(left) == _strip(right)):
            found.append((left, right))
        i = text.find(sep, i + 1)
    return found[0] if len(found) == 1 else None


def parse_diff(text: str) -> list[DiffFile]:
    """Parse a unified diff into per-file changes: `diff -ruN` output or a git diff.

    Paths come from the `---`/`+++` headers, `rename from`/`rename to`, `diff --git` and
    `Binary files ... differ` lines, with git's C quoting. A name that contains the separator
    (" and ", a space, a tab) is accepted only when exactly one reading names the same path on both
    sides. The parser follows hunk line counts, as `patch` does, so a removed line that starts with
    "-- " is not mistaken for a header. The first path component (a/, b/ or a directory name from
    `diff -r`) is stripped. A line that cannot be read this way, or a name that cannot be read
    unambiguously, becomes an entry marked `unparsed` whose path is the raw line: it classifies as
    unknown.
    """
    files: list[dict] = []
    current: dict | None = None
    old_header: str | None = None
    have_old = False
    old_left = new_left = 0
    first_hunk = False
    in_binary = False
    git: dict | None = None

    def push(path: str, status: str, added: list[str] | None = None) -> dict:
        entry = {"path": path, "status": status, "added": list(added or []), "removed": []}
        files.append(entry)
        return entry

    def unparsed(line: str) -> dict:
        entry = push(line, "modified")
        entry["unparsed"] = True
        return entry

    def finish_git() -> None:
        if git is None or git["emitted"]:
            return
        git["emitted"] = True
        names = git["names"]
        source = git.get("from") or (names[0] if names else None)
        target = git.get("to") or (names[1] if names else None)
        if source is None or target is None:
            unparsed(git["line"])
            return
        push(_strip(target), "modified")
        if _strip(source) != _strip(target):
            push(_strip(source), "deleted")

    for line in text.split("\n"):
        if old_left > 0 or new_left > 0:
            tag = line[:1]
            if tag == "+":
                current["added"].append(line[1:])
                new_left -= 1
            elif tag == "-":
                current["removed"].append(line[1:])
                old_left -= 1
            elif tag == " " or line == "":
                old_left -= 1
                new_left -= 1
            elif tag != "\\":
                unparsed(line)
            continue
        if in_binary:
            if line == "" or GIT_BINARY_LINE.fullmatch(line):
                continue
            in_binary = False
        hunk = HUNK.match(line)
        if hunk and current is not None:
            old_left = int(hunk.group(2) if hunk.group(2) is not None else 1)
            new_left = int(hunk.group(4) if hunk.group(4) is not None else 1)
            if first_hunk:
                if hunk.group(1) == "0" and old_left == 0:
                    current["status"] = "added"
                if hunk.group(3) == "0" and new_left == 0:
                    current["status"] = "deleted"
                first_hunk = False
        elif line.startswith("diff --git "):
            finish_git()
            current = None
            have_old = False
            git = {"names": _split_pair(line[11:], " "), "line": line, "emitted": False}
        elif git is not None and not git["emitted"] and GIT_EXTENDED.match(line):
            m = re.fullmatch(r"(rename|copy) (from|to) (.*)", line, re.S)
            if m:
                name = _whole_name(m.group(3))
                if name is None:
                    git["emitted"] = True
                    unparsed(line)
                elif m.group(2) == "from":
                    if m.group(1) == "rename":
                        git["from"] = f"a/{name}"
                else:
                    git["to"] = f"b/{name}"
        elif line.startswith("--- "):
            old_header = _header_name(line[4:])
            have_old = True
            current = None
        elif line.startswith("+++ ") and current is None and have_old:
            new_header = _header_name(line[4:])
            if git is not None:
                git["emitted"] = True
            if old_header is None or new_header is None:
                current = unparsed(line)
            else:
                status = "added" if old_header == "/dev/null" else "deleted" if new_header == "/dev/null" else "modified"
                current = push(_strip(old_header if new_header == "/dev/null" else new_header), status)
                if status == "modified" and _strip(old_header) != _strip(new_header):
                    push(_strip(old_header), "deleted")
            first_hunk = True
            have_old = False
        elif line.startswith("Binary files ") or line == "GIT binary patch":
            # A git diff names the file in its `diff --git` and rename lines; a `diff -r` binary line names it itself.
            in_binary = line == "GIT binary patch"
            if git is not None and not git["emitted"]:
                first = len(files)
                finish_git()
                files[first]["added"].append("<binary content>")
            else:
                m = re.fullmatch(r"Binary files (.+) differ", line, re.S)
                pair = _split_pair(m.group(1), " and ") if m else None
                if pair is None:
                    unparsed(line)
                else:
                    push(_strip(pair[0] if pair[1] == "/dev/null" else pair[1]), "modified", ["<binary content>"])
            current = None
        elif line == "" or line.startswith("\\") or (line.startswith("diff ") and git is None):
            pass  # blank lines, "\ No newline at end of file", and the `diff -ruN a b` line before each file in `diff -r` output
        else:
            unparsed(line)
    finish_git()
    return [DiffFile(**f) for f in files]


def assert_plain_unified_patch(text: str) -> list[str]:
    """Strict check that a patch is a plain unified diff and nothing else.

    Outside hunk bodies the only accepted lines are blank lines, `--- `/`+++ ` file headers and
    `@@` hunk headers, so context-diff headers (`***`), `Index:`, `diff --git`, `rename`, `copy`,
    mode lines (including symlink mode 120000) and binary patches are all refused. A control
    character (NUL included) in a header or a hunk line is refused, so the patch cannot create a
    binary file. Hunk bodies are read by line count, so content such as `+++ ../x` inside a hunk is
    not mistaken for a header. Returns the file paths.
    """
    lines = text.split("\n")
    paths: list[str] = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if line == "":
            i += 1
            continue
        if not line.startswith("--- "):
            raise ValueError(f'patch is not a plain unified diff: unexpected line "{line[:60]}"')
        old_name = line[4:].split("\t")[0]
        if i + 1 >= len(lines) or not lines[i + 1].startswith("+++ "):
            raise ValueError('patch is not a plain unified diff: "---" is not followed by "+++"')
        new_name = lines[i + 1][4:].split("\t")[0]
        for name in (old_name, new_name):
            if CONTROL.search(name) or name.startswith('"'):
                raise ValueError(f"patch names an unsafe path: {json.dumps(name)}")
            if name == "/dev/null":
                continue
            if name.startswith("/") or is_unsafe_path(re.sub(r"^[^/]+/", "", name)):
                raise ValueError(f"patch names an unsafe path: {name}")
        paths.append(old_name if new_name == "/dev/null" else new_name)
        i += 2
        if i >= len(lines) or not HUNK.match(lines[i]):
            raise ValueError("patch is not a plain unified diff: file header without a hunk")
        while i < len(lines) and HUNK.match(lines[i]):
            hunk = HUNK.match(lines[i])
            old_left = int(hunk.group(2) if hunk.group(2) is not None else 1)
            new_left = int(hunk.group(4) if hunk.group(4) is not None else 1)
            i += 1
            while old_left > 0 or new_left > 0:
                if i >= len(lines):
                    raise ValueError("patch is not a plain unified diff: truncated hunk")
                body = lines[i]
                if CONTROL.search(body):
                    raise ValueError("patch is not a plain unified diff: control character in a hunk line")
                if body[:1] == "+":
                    new_left -= 1
                elif body[:1] == "-":
                    old_left -= 1
                elif body[:1] == " " or body == "":
                    old_left -= 1
                    new_left -= 1
                else:
                    raise ValueError(f'patch is not a plain unified diff: bad hunk line "{body[:60]}"')
                i += 1
            while i < len(lines) and lines[i].startswith("\\"):
                i += 1
    if not paths:
        raise ValueError("patch contains no files")
    return paths


def is_unsafe_path(path: str) -> bool:
    """A path the gate refuses: absolute, empty, with a `..` segment, a backslash or a NUL."""
    return path == "" or path.startswith("/") or "\\" in path or "\0" in path or ".." in path.split("/")


def normalize_path(path: str) -> str:
    """Normalize a safe path; an unsafe path is returned unchanged so callers keep it visible."""
    return path if is_unsafe_path(path) else posixpath.normpath(path)


def glob_match(glob: str, path: str, ignore_case: bool = False) -> bool:
    """Match a path against a glob. `**` crosses directories, `*` does not, and neither matches a line
    terminator (the same rule in TypeScript). `ignore_case` folds ASCII letters only."""
    source = ""
    i = 0
    while i < len(glob):
        c = glob[i]
        if c == "*" and glob[i + 1 : i + 2] == "*":
            source += "[^\n\r\u2028\u2029]*"
            i += 1
            if glob[i + 1 : i + 2] == "/":
                i += 1
        elif c == "*":
            source += "[^/\n\r\u2028\u2029]*"
        else:
            source += re.escape(c)
        i += 1
    return re.fullmatch(source, path, re.I | re.A if ignore_case else 0) is not None
