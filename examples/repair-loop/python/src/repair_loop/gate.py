"""The production gate: a pure function of the evidence bundle and the policy."""

from __future__ import annotations

from .classify import exceeds
from .diff import glob_match, is_unsafe_path, normalize_path
from .models import GRANTS, Decision, EvidenceBundle, GateResult, Merge, RepairPolicy

SEVERITY: dict[str, int] = {"auto": 0, "human": 1, "block": 2}
# Pattern 1.11: nothing above R2, and nothing beyond B0, merges unattended at any grant. The policy cannot raise this.
UNATTENDED_LIMIT = {"reversibility": "R2", "blast": "B0"}
# Pattern 1.11: below A4 a person merges, whatever the policy's unattended_ceiling lists.
UNATTENDED_MIN_GRANT = "A4"


def merge_for(bundle: EvidenceBundle, policy: RepairPolicy) -> Merge:
    """Who merges an auto change (Pattern 1.11). A person, unless the grant is A4 or higher and
    the class is within that grant's unattended ceiling; an R2 change also needs every changed
    file on a named path."""
    if GRANTS.index(bundle.grant) < GRANTS.index(UNATTENDED_MIN_GRANT):
        return "person"
    ceiling = policy.unattended_ceiling.get(bundle.grant)
    c = bundle.classification
    if ceiling is None or exceeds(c, ceiling) or exceeds(c, UNATTENDED_LIMIT):
        return "person"
    if c.reversibility == "R2":
        named = bool(bundle.diff) and all(
            not is_unsafe_path(f.path) and any(glob_match(g, normalize_path(f.path)) for g in policy.unattended_r2_paths)
            for f in bundle.diff
        )
        if not named:
            return "person"
    return "unattended"


def gate(bundle: EvidenceBundle, policy: RepairPolicy) -> GateResult:
    """Return the most severe decision any check produced (block > human > auto, as in
    Pattern 2.3) and the reasons for that decision. The loop builds the bundle from
    observations (hashes, test runs, the applied diff), not from the repair agent's claims."""
    findings: list[tuple[Decision, str]] = []

    def add(decision: Decision, reason: str) -> None:
        findings.append((decision, reason))

    if bundle.stop_engaged:
        add("block", "stop switch is engaged")

    repro = bundle.reproduction
    if repro.frozen_sha256 != repro.current_sha256:
        add("block", "reproduction test changed after it was frozen")
    for file in bundle.diff:
        if is_unsafe_path(file.path):
            add("block", f"diff contains unsafe path {file.path}")
        elif any(glob_match(g, normalize_path(file.path), True) for g in policy.protected_paths):
            add("block", f"diff touches protected path {file.path}")
    if not repro.green_on_candidate:
        add("block", "reproduction is not green on the candidate")
    if bundle.regression != "pass":
        add("block", "regression suite is not green on the candidate")

    if not repro.red_on_base:
        add("human", "reproduction was not red on the base commit: cannot reproduce")
    if bundle.antimask:
        add("human", f"anti-masking scan found {len(bundle.antimask)} hit(s): treated as a mitigation")
    if exceeds(bundle.classification, policy.auto_ceiling):
        c = bundle.classification
        add(
            "human",
            f"class {c.reversibility}/{c.blast} is above the ceiling "
            f"{policy.auto_ceiling['reversibility']}/{policy.auto_ceiling['blast']}",
        )
    if GRANTS.index(bundle.grant) < GRANTS.index(policy.min_grant_for_auto):
        add("human", f"grant {bundle.grant} is below {policy.min_grant_for_auto}")
    if bundle.budget.attempts_used >= bundle.budget.attempts_allowed:
        add("human", "attempt budget is exhausted for this fingerprint")
    if bundle.budget.cooldown_active:
        add("human", "cooldown is active for this fingerprint")

    decision: Decision = "auto"
    for d, _ in findings:
        if SEVERITY[d] > SEVERITY[decision]:
            decision = d
    if decision == "auto":
        return GateResult("auto", ["all mechanical checks passed within the ceiling"], merge_for(bundle, policy))
    return GateResult(decision, [reason for d, reason in findings if d == decision], None)
