import pytest

from repair_loop.classify import classify
from repair_loop.diff import glob_match, normalize_path, parse_diff
from support.builders import make_diff, patch_text, rules


def cls(text):
    return classify(parse_diff(text), rules)


def test_parse_diff_reads_status_paths_and_changed_lines():
    files = parse_diff(patch_text("INC-001.fix.patch"))
    assert len(files) == 1
    assert files[0].path == "app/src/routes/users.py"
    assert files[0].status == "modified"
    assert "UUID_PATTERN.fullmatch" in "\n".join(files[0].added)
    assert files[0].removed == []


def test_parse_diff_marks_files_created_from_dev_null_as_added():
    assert parse_diff(make_diff("tests/unit/new_test.py", ["x"], [], "added"))[0].status == "added"


def test_glob_match_double_star_crosses_directories_single_star_does_not():
    assert glob_match("app/src/routes/**", "app/src/routes/users.py")
    assert glob_match("app/src/routes/**", "app/src/routes/deep/x.py")
    assert not glob_match("app/src/*.py", "app/src/routes/users.py")
    assert glob_match("**/*.md", "docs/a/b.md")
    assert glob_match("app/src/auth.*", "app/src/auth.py")


def test_the_real_fix_is_r2_b0():
    result = cls(patch_text("INC-001.fix.patch"))
    assert (result.reversibility, result.blast) == ("R2", "B0")


def test_a_test_only_diff_is_r0_b0():
    result = cls(patch_text("INC-001.test-edit.patch"))
    assert (result.reversibility, result.blast) == ("R0", "B0")


def test_a_file_with_no_rule_takes_the_unknown_class_the_highest():
    result = cls(make_diff("scripts/deploy.sh", ["echo hi"]))
    assert (result.reversibility, result.blast) == ("R4", "B3")


def test_an_empty_diff_is_unknown_not_clean():
    result = classify([], rules)
    assert (result.reversibility, result.blast) == ("R4", "B3")


def test_the_auth_module_is_b3_by_path():
    result = cls(make_diff("app/src/auth.py", ["a = 1"]))
    assert (result.reversibility, result.blast) == ("R2", "B3")


def test_a_schema_statement_in_a_route_raises_the_class_to_r3():
    result = cls(make_diff("app/src/routes/users.py", ['conn.execute("ALTER TABLE users ADD COLUMN x INT")']))
    assert (result.reversibility, result.blast) == ("R3", "B0")


def test_an_outbound_http_call_raises_the_class_to_r4():
    result = cls(make_diff("app/src/routes/users.py", ['httpx.post("https://mail.example.test/send")']))
    assert result.reversibility == "R4"


def test_a_changed_line_that_mentions_a_password_raises_blast_to_b3():
    assert cls(make_diff("app/src/routes/users.py", ["password = body.password"])).blast == "B3"


def test_an_openapi_change_is_b2():
    result = cls(make_diff("app/openapi.yaml", ["x"]))
    assert (result.reversibility, result.blast) == ("R2", "B2")


@pytest.mark.parametrize("path", ["app/src/routes/../auth.py", "tests/../app/src/routes/evil.py"])
def test_unsafe_paths_take_the_unknown_class_and_are_not_normalized_into_a_lower_one(path):
    result = cls(make_diff(path, ["x"]))
    assert (result.reversibility, result.blast) == ("R4", "B3")


def test_redundant_segments_in_a_safe_path_are_normalized_before_matching():
    assert cls(make_diff("app/src/./auth.py", ["x"])).blast == "B3"


def test_parse_diff_follows_hunk_counts_a_removed_line_starting_with_dashes_hides_nothing():
    text = "\n".join([
        "--- a/app/src/routes/users.py", "+++ b/app/src/routes/users.py", "@@ -1,2 +1,3 @@",
        "--- sql comment", " keep", "+except Exception:", "+    pass", "",
    ])
    (file,) = parse_diff(text)
    assert file.removed == ["-- sql comment"]
    assert file.added == ["except Exception:", "    pass"]


def test_parse_diff_reads_a_directory_diff_first_component_stripped_added_detected_by_hunk():
    text = "\n".join(["--- base/tests/x.py\t1970-01-01", "+++ base-candidate/tests/x.py\t2026-01-01", "@@ -0,0 +1,1 @@", "+x", ""])
    (file,) = parse_diff(text)
    assert (file.path, file.status, file.added) == ("tests/x.py", "added", ["x"])


def test_the_class_of_a_diff_is_the_maximum_over_its_files():
    text = make_diff("tests/unit/a_test.py", ["x"], [], "added") + make_diff("app/src/infra.py", ["y"])
    result = cls(text)
    assert (result.reversibility, result.blast) == ("R2", "B1")


def test_normalize_path_collapses_redundant_segments_of_a_safe_path():
    assert normalize_path("app/src/./auth.py") == "app/src/auth.py"
    assert normalize_path("tests//x.py") == "tests/x.py"


def test_normalize_path_returns_an_unsafe_path_unchanged_so_it_stays_visible():
    assert normalize_path("tests/../app/x.py") == "tests/../app/x.py"
    assert normalize_path("/etc/x") == "/etc/x"


# parse_diff reads names from headers, git lines and binary lines (r10 C2); same cases as classify.test.ts.
def paths(lines):
    return [f"unparsed: {f.path}" if f.unparsed else f"{f.status} {f.path}" for f in parse_diff("\n".join(lines) + "\n")]


def test_a_binary_files_line_splits_on_the_and_that_names_one_path_on_both_sides():
    assert paths(["Binary files base/tests/a and X/app/y.bin and cand/tests/a and X/app/y.bin differ"]) == ["modified tests/a and X/app/y.bin"]
    assert paths(["Binary files /dev/null and b/app/a and b.bin differ"]) == ["modified app/a and b.bin"]


def test_a_binary_files_line_with_no_single_reading_is_unparsed():
    line = "Binary files base/app/a and cand/b and base/app/c differ"
    assert paths([line]) == [f"unparsed: {line}"]
    two_readings = "Binary files /dev/null and b/x and /dev/null differ"
    assert paths([two_readings]) == [f"unparsed: {two_readings}"]


def test_a_header_with_a_tab_inside_the_name_is_unparsed_a_quoted_header_is_read_with_c_escapes():
    assert paths(["--- base/app/a\tb.ts\t2026-01-01", "+++ cand/app/a\tb.ts\t2026-01-01", "@@ -0,0 +1 @@", "+x"]) == ["unparsed: +++ cand/app/a\tb.ts\t2026-01-01"]
    assert paths(["--- /dev/null", '+++ "b/app/caf\\303\\251\\tx.ts"', "@@ -0,0 +1 @@", "+x"]) == ["added app/café\tx.ts"]
    assert paths(["--- /dev/null", '+++ "b/app/bad\\q.ts"', "@@ -0,0 +1 @@", "+x"]) == ['unparsed: +++ "b/app/bad\\q.ts"']


def test_a_git_rename_lists_both_paths_from_the_rename_lines():
    assert paths(["diff --git a/tests/x.ts b/app/x.ts", "similarity index 100%", "rename from tests/x.ts", "rename to app/x.ts"]) == ["modified app/x.ts", "deleted tests/x.ts"]
    lines = ["diff --git a/tests/x.ts b/app/x.ts", "rename from tests/x.ts", "rename to app/x.ts", "--- a/tests/x.ts", "+++ b/app/x.ts", "@@ -1 +1 @@", "-a", "+b"]
    assert paths(lines) == ["modified app/x.ts", "deleted tests/x.ts"]


def test_a_git_diff_header_with_spaces_is_read_when_both_sides_agree_a_git_binary_patch_block_is_skipped():
    lines = [
        "diff --git a/app/a b.bin b/app/a b.bin", "new file mode 100644", "index 0000000..1111111", "GIT binary patch", "literal 4",
        "LcmZQzWMT#Y01f~L", "", "literal 0", "HcmV?d00001", "", "diff --git a/app/c.ts b/app/c.ts", "--- a/app/c.ts", "+++ b/app/c.ts",
        "@@ -1 +1 @@", "-a", "+b",
    ]
    assert paths(lines) == ["modified app/a b.bin", "modified app/c.ts"]


def test_a_line_diff_r_prints_for_a_type_change_is_unparsed():
    line = "File base/app/x is a regular file while file cand/app/x is a directory"
    assert paths([line]) == [f"unparsed: {line}"]


def test_an_unparsed_entry_classifies_as_unknown():
    c = cls("Binary files base/app/a and cand/b and base/app/c differ\n")
    assert (c.reversibility, c.blast) == ("R4", "B3")
    assert "cannot be read as one file path" in "\n".join(c.reasons)


@pytest.mark.parametrize(
    "path",
    [
        "CLAUDE.md", "app/CLAUDE.md", "CLAUDE.local.md", "app/claude.LOCAL.md", "AGENTS.md", "docs/agents.md", "GEMINI.md", "app/Gemini.md",
        ".claude/rules/x.md", "app/.claude/skills/x/SKILL.md", "app/.claude/skills/x/run.sh", ".claude/agents/r.md", ".claude/commands/c.md",
        ".mcp.json", "app/.mcp.json",
    ],
)
def test_instruction_and_tool_config_surfaces_at_any_depth_and_in_any_case_are_medium_tier(path):
    c = cls(make_diff(path, ["text"]))
    assert (c.reversibility, c.blast) == ("R0", "B1")


@pytest.mark.parametrize("path", [".claude/settings.json", ".claude/settings.local.json", "app/.claude/settings.json", ".claude/hooks/guard.sh", "app/.claude/hooks/x.sh"])
def test_claude_settings_and_hooks_at_any_depth_are_high_tier(path):
    c = cls(make_diff(path, ["{}"]))
    assert (c.reversibility, c.blast) == ("R4", "B3")


def test_a_glob_wildcard_does_not_match_a_line_terminator_in_either_language():
    for path in ["app/src/routes/\rx.py", "app/src/routes/x .py", "app/src/routes/a\nb.py"]:
        assert glob_match("app/src/routes/**", path) is False
        assert glob_match("app/src/routes/*", path) is False
    assert glob_match("app/src/routes/**", "app/src/routes/a/b.py") is True
