import shutil
import tempfile
from pathlib import Path

import pytest

from repair_loop.diff import parse_diff
from repair_loop.loop import Handle
from repair_loop.runtime import apply_patch, observed_diff, validate_patch
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


def test_validate_patch_rejects_an_empty_patch():
    with pytest.raises(ValueError, match="no files"):
        validate_patch("not a patch")


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
