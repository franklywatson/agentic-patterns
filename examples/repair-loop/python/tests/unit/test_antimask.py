from repair_loop.antimask import scan_production_diff
from repair_loop.diff import parse_diff
from support.builders import make_diff, patch_text


def scan(path, added, removed=None):
    return scan_production_diff(parse_diff(make_diff(path, added, removed)))


def rules_of(hits):
    return [h.rule for h in hits]


def test_the_real_fix_is_clean():
    assert scan_production_diff(parse_diff(patch_text("INC-001.fix.patch"))) == []


def test_the_masking_patch_is_caught_as_a_swallowed_exception():
    hits = scan_production_diff(parse_diff(patch_text("INC-001.mask.patch")))
    assert rules_of(hits) == ["swallowed-exception"]
    assert hits[0].file == "app/src/routes/users.py"


def test_an_except_block_that_reraises_is_allowed():
    added = ["try:", "    run()", "except ValueError as error:", "    log(error)", "    raise"]
    assert scan("app/src/a.py", added) == []


def test_an_except_block_that_passes_is_a_swallowed_exception():
    added = ["try:", "    run()", "except Exception:", "    pass"]
    assert rules_of(scan("app/src/a.py", added)) == ["swallowed-exception"]


def test_a_new_retry_loop_is_a_hit():
    assert rules_of(scan("app/src/a.py", ["for retries in range(3):"])) == ["new-retry"]


def test_a_widened_timeout_is_a_hit_a_narrowed_one_is_not():
    assert rules_of(scan("app/src/a.py", ["timeout_s = 30"], ["timeout_s = 3"])) == ["widened-timeout"]
    assert scan("app/src/a.py", ["timeout_s = 1"], ["timeout_s = 3"]) == []


def test_a_lowered_threshold_is_a_hit_a_raised_one_is_not():
    assert rules_of(scan("app/src/a.py", ["min_samples = 5"], ["min_samples = 50"])) == ["lowered-threshold"]
    assert scan("app/src/a.py", ["min_samples = 50"], ["min_samples = 5"]) == []


def test_test_files_are_not_production_code():
    assert scan("tests/unit/a_test.py", ["except Exception:", "    pass"]) == []
