from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

import yaml
from jsonschema import Draft7Validator

from autonomy.util import SCHEMA_PATH


class _Loader(yaml.SafeLoader):
    """SafeLoader that keeps dates as strings, as the YAML 1.2 core schema does."""


_Loader.yaml_implicit_resolvers = {
    key: [(tag, regexp) for tag, regexp in resolvers if tag != "tag:yaml.org,2002:timestamp"]
    for key, resolvers in yaml.SafeLoader.yaml_implicit_resolvers.items()
}

_validator: Draft7Validator | None = None


def _compiled() -> Draft7Validator:
    global _validator
    if _validator is None:
        _validator = Draft7Validator(json.loads(Path(SCHEMA_PATH).read_text()))
    return _validator


def load_register_file(path: str | Path) -> Any:
    return yaml.load(Path(path).read_text(), Loader=_Loader)


def validate_register(data: Any) -> list[dict[str, str]]:
    """Validate a parsed register. Returns normalised, sorted, de-duplicated errors."""
    found: dict[str, dict[str, str]] = {}
    for err in _compiled().iter_errors(data):
        path = "".join(f"/{part}" for part in err.absolute_path)
        if err.validator == "required":
            names = [re.search(r"'([^']+)'", err.message).group(1)]  # type: ignore[union-attr]
        elif err.validator == "additionalProperties":
            names = re.findall(r"'([^']+)'", err.message)
        else:
            names = [None]
        for name in names:
            full = f"{path}/{name}" if name is not None else path
            found[f"{full}|{err.validator}"] = {"path": full, "keyword": err.validator}
    return [found[key] for key in sorted(found)]
