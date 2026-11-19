import shutil
import tempfile
from pathlib import Path

import pytest

from repair_loop.diff import parse_diff
from repair_loop.loop import Handle
from repair_loop.runtime import DockerEnvironment, apply_patch, new_workspace, observed_diff, remove_workspaces, validate_patch
from support.builders import make_diff, patch_text


@pytest.fixture
def sandbox():
    root = Path(tempfile.mkdtemp(prefix="repair-runtime-"))
    base = root / "base"
    (base / "app" / "src").mkdir(parents=True)
    (base / "app" / "src" / "a.py").write_text("one\n")
    yield root, Handle(str(base)), Handle(str(root / "candidate"))
    shutil.rmtree(root, ignore_errors=True)


@pytest.mark.parametrize("name", ["INC-001.fix.patch", "INC-001.mask.patch", "INC-001.test-edit.patch", "INC-001.partial.patch"])
def test_validate_patch_accepts_the_shipped_patches(name):
    validate_patch(patch_text(name))


@pytest.mark.parametrize("path", ["../escaped.txt", "app/../../escaped.txt", "/tmp/escaped.txt", "app\\evil.txt"])
def test_validate_patch_rejects_unsafe_paths(path):
    with pytest.raises(ValueError, match="unsafe path"):
        validate_patch(make_diff(path, ["x"], [], "added"))


def test_validate_patch_rejects_a_text_that_is_not_a_patch():
    with pytest.raises(ValueError, match="not a plain unified diff"):
        validate_patch("not a patch")
    with pytest.raises(ValueError, match="no files"):
        validate_patch("")


SAFE = ["--- a/app/src/a.py", "+++ b/app/src/a.py", "@@ -1,1 +1,1 @@", "-one", "+two"]


@pytest.mark.parametrize(
    "lines",
    [
        [*SAFE, "*** a/../victim.txt", "--- b/app/nonexist.txt", "***************", "*** 1 ****", "--- 1 ----", "! PWN", ""],
        ["Index: ../victim.txt", *SAFE, ""],
        ["diff --git a/app/src/a.py b/../x", *SAFE, ""],
        [*SAFE, "rename from app/src/a.py", "rename to ../x", ""],
        [*SAFE, "copy from app/src/a.py", "copy to ../x", ""],
        ["--- /dev/null", "+++ b/app/link", "new file mode 120000", "@@ -0,0 +1,1 @@", "+../../etc/passwd", ""],
        ["old mode 100644", "new mode 100755", *SAFE, ""],
        ["GIT binary patch", "literal 3", "xcmZ", ""],
        [*SAFE, "something else", ""],
        ["--- a/app/src/a.py", "+++ b/app/src/a.py", "@@ -1,3 +1,3 @@", "-one", ""],
    ],
    ids=["context-diff", "index", "diff-git", "rename", "copy", "symlink-mode", "mode-line", "binary", "trailing-garbage", "truncated-hunk"],
)
def test_validate_patch_rejects_non_unified_forms(lines):
    with pytest.raises(ValueError):
        validate_patch("\n".join(lines))


def test_a_hunk_body_that_looks_like_headers_is_content_not_a_header():
    lines = ["--- a/app/src/a.py", "+++ b/app/src/a.py", "@@ -1,1 +1,3 @@", " one", "++++ ../x", "+--- a/../y", ""]
    validate_patch("\n".join(lines))


def test_a_unified_section_plus_a_context_diff_section_naming_a_file_outside_writes_nothing(sandbox):
    root, base, _ = sandbox
    victim = root / "victim.txt"
    victim.write_text("safe\n")
    patch_file = root / "mixed.patch"
    patch_file.write_text("\n".join([*SAFE, "*** a/../victim.txt", "--- b/app/nonexist.txt", "***************", "*** 1 ****", "--- 1 ----", "! PWN", ""]))
    with pytest.raises(ValueError, match="not a plain unified diff"):
        apply_patch(base, str(patch_file))
    assert victim.read_text() == "safe\n"
    assert (Path(base.dir) / "app/src/a.py").read_text() == "one\n"


def test_content_lines_that_start_with_plus_plus_plus_and_contain_dotdot_apply_as_content(sandbox):
    root, base, _ = sandbox
    patch_file = root / "content.patch"
    patch_file.write_text("\n".join(["--- a/app/src/a.py", "+++ b/app/src/a.py", "@@ -1,1 +1,2 @@", " one", "++++ ../x", ""]))
    apply_patch(base, str(patch_file))
    assert (Path(base.dir) / "app/src/a.py").read_text() == "one\n+++ ../x\n"
    assert not (Path(base.dir) / ".git").exists()


def test_a_patch_with_a_dotdot_path_is_refused_before_patch_runs_and_nothing_is_written_outside(sandbox):
    root, base, _ = sandbox
    patch_file = root / "evil.patch"
    patch_file.write_text(make_diff("../escaped.txt", ["pwned"], [], "added"))
    with pytest.raises(ValueError, match="unsafe path"):
        apply_patch(base, str(patch_file))
    assert not (root / "escaped.txt").exists()
    assert not (root.parent / "escaped.txt").exists()


def test_the_gate_sees_the_observed_directory_diff_which_names_the_files_that_really_changed(sandbox):
    root, base, candidate = sandbox
    shutil.copytree(base.dir, candidate.dir)
    patch_file = root / "ok.patch"
    patch_file.write_text("--- a/app/src/a.py\n+++ b/app/src/a.py\n@@ -1,1 +1,1 @@\n-one\n+two\n")
    apply_patch(candidate, str(patch_file))
    assert (Path(candidate.dir) / "app/src/a.py").read_text() == "two\n"
    (file,) = parse_diff(observed_diff(base, candidate))
    assert (file.path, file.status, file.added, file.removed) == ("app/src/a.py", "modified", ["two"], ["one"])


def test_candidate_returns_the_observed_diff_and_a_file_under_dist_is_visible_to_the_gate(tmp_path):
    env = DockerEnvironment()
    base = new_workspace("observed")
    patch_file = tmp_path / "hidden.patch"
    patch_file.write_text("\n".join(["--- /dev/null", "+++ b/app/src/node_modules/mask.py", "@@ -0,0 +1,1 @@", "+MASK = True", ""]))
    try:
        _, text = env.candidate(base, str(patch_file))
        files = parse_diff(text)
        assert [f.path for f in files] == ["app/src/node_modules/mask.py"]
        assert files[0].status == "added"
        assert "diff -ruN" in text
    finally:
        remove_workspaces(base)


def test_a_change_under_repair_is_visible_too(tmp_path):
    env = DockerEnvironment()
    base = new_workspace("observed-repair")
    (Path(base.dir) / ".repair" / "x.json").write_text("{}\n")
    patch_file = tmp_path / "repair.patch"
    patch_file.write_text("\n".join(["--- a/.repair/x.json", "+++ b/.repair/x.json", "@@ -1,1 +1,1 @@", "-{}", '+{"a":1}', ""]))
    try:
        _, text = env.candidate(base, str(patch_file))
        assert [f.path for f in parse_diff(text)] == [".repair/x.json"]
    finally:
        remove_workspaces(base)


def nul_patch(path):
    return f"--- /dev/null\n+++ b/{path}\n@@ -0,0 +1,2 @@\n+evil\0bytes\n+line2\n"


def test_a_patch_with_a_nul_byte_in_a_hunk_line_is_refused_so_it_cannot_create_a_binary_file():
    for path in ("tests/a and X/app/src/routes/y.bin", "app/src/routes/y.bin"):
        with pytest.raises(ValueError, match="control character"):
            validate_patch(nul_patch(path))


@pytest.mark.parametrize(
    "text",
    [
        "--- a/app/src/a\x01.py\n+++ b/app/src/a\x01.py\n@@ -1 +1 @@\n-one\n+two\n",
        '--- "a/app/src/a.py"\n+++ "b/app/src/a.py"\n@@ -1 +1 @@\n-one\n+two\n',
    ],
    ids=["a control character in a header name", "a quoted header name"],
)
def test_validate_patch_refuses_odd_header_names(text):
    with pytest.raises(ValueError, match="unsafe path"):
        validate_patch(text)


def test_a_binary_file_under_tests_whose_name_contains_and_is_read_at_its_real_path(sandbox):
    root, base, candidate = sandbox
    (Path(base.dir) / "tests").mkdir()
    shutil.copytree(base.dir, candidate.dir)
    folder = Path(candidate.dir) / "tests" / "a and X" / "app" / "src" / "routes"
    folder.mkdir(parents=True)
    (folder / "y.bin").write_bytes(b"evil\0bytes\n")
    observed = observed_diff(base, candidate)
    assert "Binary files" in observed
    assert [(f.path, f.unparsed) for f in parse_diff(observed)] == [("tests/a and X/app/src/routes/y.bin", False)]


def test_a_file_name_with_a_tab_or_a_newline_is_not_guessed_it_is_marked_unparsed(sandbox):
    root, base, candidate = sandbox
    shutil.copytree(base.dir, candidate.dir)
    (Path(candidate.dir) / "app" / "src" / "tab\tname.py").write_text("x\n")
    (Path(candidate.dir) / "app" / "src" / "nl\nname.py").write_text("x\n")
    files = parse_diff(observed_diff(base, candidate))
    assert any(f.unparsed for f in files)
    assert "app/src/tab" not in [f.path for f in files if not f.unparsed]
