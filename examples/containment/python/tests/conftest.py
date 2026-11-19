import json
import os
import shutil
import tempfile
from collections.abc import Iterator
from pathlib import Path

import pytest

from containment.boundary import FixtureServer, start_fixture_server

CASES = json.loads((Path(__file__).resolve().parents[2] / "cases.json").read_text(encoding="utf8"))
ORIGINAL = "old\n"


@pytest.fixture(scope="session")
def server() -> Iterator[FixtureServer]:
    s = start_fixture_server()
    yield s
    s.stop()


@pytest.fixture
def make_project() -> Iterator[object]:
    created: list[str] = []

    def make() -> tuple[str, Path]:
        d = os.path.realpath(tempfile.mkdtemp(prefix="containment-"))
        created.append(d)
        target = Path(d) / "target.txt"
        target.write_text(ORIGINAL, encoding="utf8")
        # The container user is "nobody": the control run needs write access to succeed.
        os.chmod(d, 0o777)
        os.chmod(target, 0o666)
        return d, target

    yield make
    for d in created:
        shutil.rmtree(d, ignore_errors=True)
