from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

import yaml
from datetime import datetime
from jsonschema import Draft7Validator

from autonomy.util import SCHEMA_PATH


class _Loader(yaml.SafeLoader):
    """SafeLoader that keeps dates as strings, as the YAML 1.2 core schema does."""


_Loader.yaml_implicit_resolvers = {
    key: [(tag, regexp) for tag, regexp in resolvers if tag != "tag:yaml.org,2002:timestamp"]
    for key, resolvers in yaml.SafeLoader.yaml_implicit_resolvers.items()
}

# YAML 1.2 booleans: only true and false (PyYAML defaults to YAML 1.1: on, yes, no, ...).
_Loader.yaml_implicit_resolvers = {
    key: [(tag, regexp) for tag, regexp in resolvers if tag != "tag:yaml.org,2002:bool"]
    for key, resolvers in _Loader.yaml_implicit_resolvers.items()
}
_Loader.add_implicit_resolver("tag:yaml.org,2002:bool", re.compile(r"^(?:true|True|TRUE|false|False|FALSE)$"), list("tTfF"))

_validator: Draft7Validator | None = None


def _is_calendar_date(value: str) -> bool:
    try:
        datetime.strptime(value, "%Y-%m-%d")
    except ValueError:
        return False
    return True


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
    workflows = data.get("workflows") if isinstance(data, dict) else None
    for i, wf in enumerate(workflows if isinstance(workflows, list) else []):
        wf = wf if isinstance(wf, dict) else {}
        stop = wf.get("stop") if isinstance(wf.get("stop"), dict) else {}
        for name, value in (("access_expires", wf.get("access_expires")), ("review_date", wf.get("review_date")), ("stop/last_tested", stop.get("last_tested"))):
            if isinstance(value, str) and re.fullmatch(r"\d{4}-\d{2}-\d{2}", value) and not _is_calendar_date(value):
                path = f"/workflows/{i}/{name}"
                found[f"{path}|format"] = {"path": path, "keyword": "format"}
    return [found[key] for key in sorted(found)]
