from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import pytest

FIXTURES = Path(__file__).resolve().parents[2] / "fixtures"
NOW = "2026-11-18T00:00:00Z"


def fixture(*parts: str) -> Path:
    return FIXTURES.joinpath(*parts)


def fixture_json(*parts: str):
    return json.loads(fixture(*parts).read_text())


@pytest.fixture
def copy_fixture(tmp_path):
    counter = {"n": 0}

    def _copy(*parts: str) -> Path:
        counter["n"] += 1
        dest = tmp_path / f"copy{counter['n']}"
        shutil.copytree(fixture(*parts), dest)
        return dest

    return _copy


@pytest.fixture
def git_fixture_repo(tmp_path):
    counter = {"n": 0}

    def _make(name: str, date: str = "2026-11-01T00:00:00Z") -> Path:
        counter["n"] += 1
        dest = tmp_path / f"repo{counter['n']}"
        shutil.copytree(fixture("repos", name), dest)
        env = {**os.environ, "GIT_AUTHOR_DATE": date, "GIT_COMMITTER_DATE": date}
        base = ["git", "-c", "user.name=fixture", "-c", "user.email=fixture@example.invalid"]
        for args in (["init", "-q"], ["add", "-A"], ["commit", "-q", "-m", "fixture"]):
            subprocess.run([*base, *args], cwd=dest, env=env, check=True, capture_output=True)
        return dest

    return _make


def run_cli(args: list[str], stdin: str = "") -> subprocess.CompletedProcess:
    return subprocess.run([sys.executable, "-m", "autonomy", *args], input=stdin, capture_output=True, text=True)


@pytest.fixture
def cli():
    return run_cli


@pytest.fixture
def tmp_project():
    path = Path(tempfile.mkdtemp(prefix="autonomy-project-"))
    yield path
    shutil.rmtree(path, ignore_errors=True)
