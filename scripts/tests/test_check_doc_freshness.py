"""Tests for scripts/check-doc-freshness.py. Run: python3 -m unittest discover -s scripts/tests"""
import importlib.util
import tempfile
import unittest
from datetime import date, timedelta
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "check-doc-freshness.py"
spec = importlib.util.spec_from_file_location("check_doc_freshness", SCRIPT)
freshness = importlib.util.module_from_spec(spec)
spec.loader.exec_module(freshness)

TODAY = date(2026, 11, 19)


def result(front_matter):
    """Return (errors, warnings) for a doc whose front matter is the given text (None: no front matter)."""
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        doc = root / "doc.md"
        doc.write_text("# Title\n" if front_matter is None else f"---\n{front_matter}\n---\n\n# Title\n")
        return freshness.check(doc, root, TODAY)


def fm(reviewed, extra=""):
    return f"last-validated-model: claude-opus-5-5\nreviewed: {reviewed}\n{extra}".rstrip("\n")


def days_ago(days):
    return (TODAY - timedelta(days=days)).isoformat()


class AgeThresholds(unittest.TestCase):
    def test_89_days_is_silent(self):
        self.assertEqual(result(fm(days_ago(89))), ([], []))

    def test_90_days_warns(self):
        errors, warnings = result(fm(days_ago(90)))
        self.assertEqual((errors, len(warnings)), ([], 1))

    def test_179_days_warns(self):
        errors, warnings = result(fm(days_ago(179)))
        self.assertEqual((errors, len(warnings)), ([], 1))

    def test_180_days_fails(self):
        errors, warnings = result(fm(days_ago(180)))
        self.assertEqual((len(errors), warnings), (1, []))


class Keys(unittest.TestCase):
    def test_missing_front_matter(self):
        errors, _ = result(None)
        self.assertEqual(len(errors), 2)

    def test_missing_reviewed(self):
        errors, _ = result("last-validated-model: claude-opus-5-5")
        self.assertEqual(len(errors), 1)
        self.assertIn("`reviewed` is missing", errors[0])

    def test_missing_model(self):
        errors, _ = result(f"reviewed: {days_ago(1)}")
        self.assertEqual(len(errors), 1)
        self.assertIn("`last-validated-model` is missing", errors[0])


class DateForms(unittest.TestCase):
    def test_future_date_fails(self):
        errors, _ = result(fm((TODAY + timedelta(days=1)).isoformat()))
        self.assertEqual(len(errors), 1)
        self.assertIn("future", errors[0])

    def test_today_passes(self):
        self.assertEqual(result(fm(TODAY.isoformat())), ([], []))

    def test_double_quoted_date(self):
        self.assertEqual(result(fm(f'"{days_ago(1)}"')), ([], []))

    def test_single_quoted_date(self):
        self.assertEqual(result(fm(f"'{days_ago(1)}'")), ([], []))

    def test_inline_comment(self):
        self.assertEqual(result(fm(f"{days_ago(1)}  # read in review")), ([], []))

    def test_malformed_date(self):
        for bad in ("2026-13-45", "yesterday", "19/11/2026", '"2026-11-1"'):
            with self.subTest(bad=bad):
                errors, _ = result(fm(bad))
                self.assertEqual(len(errors), 1)
                self.assertIn("not a YYYY-MM-DD date", errors[0])


class Expiry(unittest.TestCase):
    def test_future_expiry_passes(self):
        self.assertEqual(result(fm(days_ago(1), f"expires: {(TODAY + timedelta(days=30)).isoformat()}")), ([], []))

    def test_past_expiry_fails(self):
        errors, _ = result(fm(days_ago(1), f"expires: {days_ago(1)}"))
        self.assertEqual(len(errors), 1)
        self.assertIn("expired", errors[0])

    def test_expiry_today_passes(self):
        self.assertEqual(result(fm(days_ago(1), f"expires: {TODAY.isoformat()}")), ([], []))

    def test_malformed_expiry_fails(self):
        errors, _ = result(fm(days_ago(1), "expires: soon"))
        self.assertEqual(len(errors), 1)


if __name__ == "__main__":
    unittest.main()
