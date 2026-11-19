import copy

import pytest

from repair_loop.config import load_incident_record
from repair_loop.incident import fingerprint_of, fingerprints_from_log, parse_incident
from repair_loop.reproduce import render_reproduction, repro_path


def record():
    return copy.deepcopy(load_incident_record("INC-001"))


def test_inc_001_parses_and_its_fingerprint_matches_the_record():
    assert parse_incident(record()).fingerprint == fingerprint_of("GET /users/:id", 500, "pg:22P02")


def test_a_fingerprint_that_does_not_match_the_record_is_rejected():
    with pytest.raises(ValueError, match="does not match the record"):
        parse_incident({**record(), "fingerprint": "000000000000"})


def test_an_email_address_in_the_request_is_rejected():
    bad = record()
    bad["request"]["path"] = "/users/by-email/alice@example.com"
    with pytest.raises(ValueError, match="email address"):
        parse_incident(bad)


def test_a_secret_field_in_the_request_is_rejected():
    bad = record()
    bad["request"]["body"] = {"password": "x"}
    with pytest.raises(ValueError, match="secret field"):
        parse_incident(bad)


def test_a_missing_field_is_rejected_by_name():
    bad = record()
    del bad["expected"]
    with pytest.raises(ValueError, match='missing "expected"'):
        parse_incident(bad)


def test_fingerprints_from_log_finds_structured_error_lines_and_ignores_other_text():
    log = "\n".join([
        "app-1  | INFO:     Uvicorn running on http://0.0.0.0:8000",
        'app-1  | {"level":"error","event":"unhandled_error","route":"GET /users/:id","status":500,"errorClass":"pg:22P02"}',
        'app-1  | {"level":"info","event":"other"}',
    ])
    assert fingerprints_from_log(log) == [fingerprint_of("GET /users/:id", 500, "pg:22P02")]


def test_the_rendered_reproduction_asserts_the_expected_status_and_body_unconditionally():
    incident = parse_incident(record())
    source = render_reproduction(incident)
    assert repro_path(incident) == "tests/repro/test_inc_001_repro.py"
    assert "assert response.status_code == 404" in source
    assert 'assert response.json() == {"error": "User not found"}' in source
    assert "\n    if " not in source
