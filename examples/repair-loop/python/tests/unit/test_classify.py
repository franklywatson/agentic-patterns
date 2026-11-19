from repair_loop.classify import classify
from repair_loop.diff import glob_match, parse_diff
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


def test_the_class_of_a_diff_is_the_maximum_over_its_files():
    text = make_diff("tests/unit/a_test.py", ["x"], [], "added") + make_diff("app/src/infra.py", ["y"])
    result = cls(text)
    assert (result.reversibility, result.blast) == ("R2", "B1")
