# Phase 2: Containment, Ownership and People

- **Status:** Not started
- **Depends on:** Phase 1 (layered-enforcement thesis and evidence labels in place)
- **Gated by decisions:** D5 (vendor posture: neutral contract plus bindings)
- **Suggested branch:** `refresh/phase-2-contain`

## Goal

Lift the three capping dimensions the library ignores (security and governance, production
ownership, and the people side of skill) far enough that a reader can reach C3 on security and
governance from the library alone. Phases 3 and 4 depend on this.

## Context to read first

- [../synthesis.md](../synthesis.md): section 6
- [../reviews/review-governance.md](../reviews/review-governance.md): sections 1-3 (the pattern table
  in section 3 is the spec for this phase)
- Research baseline chapters 4.1 Platform, 4.4 Security and governance, 4.5 Production ownership and
  4.6 Individual and team skill (not committed; the governance review restates what this phase needs)

## Tasks

Write each pattern in the repo's standard format: Problem, Solution, In Practice, Anti-Pattern,
Cross-References, Evidence. Write it first against a neutral contract (D5), then add a short
"Bindings" subsection:

- Claude Code: permission deny rules, sandbox settings, managed settings, hooks
- one other harness
- "no harness: CI only"

Replace the invented `hook.on(...)` API in L2 with the neutral contract plus a real Claude Code
binding.

### T1. New L2 patterns

| Number (suggested) | Pattern | Evidence label | Sources |
|--------------------|---------|----------------|---------|
| 2.9 | Contain before you relax (sandbox-first; secrets outside the boundary; fail closed; rootless or per-session Docker for stack tests) | Partial | PL-14 PL-15 PL-17 SG-10 AN-9 AN-11 |
| 2.10 | Least agency and session composition (lethal trifecta / Rule of Two; read-only rinsing) | Strong | SG-1 SG-2 SG-3 SG-16 |
| 2.11 | Agent identity and delegation (per-agent short-lived credentials; "agent X for person Y") | Partial | PL-5 PL-7 PL-8 SG-20 |
| 2.12 | Skill, plugin and MCP supply chain (allowlist, pin, read before install, review updates as diffs) | Strong (threat) | SG-28 SG-29 IS-13 |
| 2.13 | Risk-tiered review (tier by reversibility and blast radius; requester cannot approve; agent approval never counts as human) | Partial | SG-9 SG-26 OM-18 AN-29 |

- Add a pointer from L0 (structure) to 2.9, because containment is a day-one decision.
- Apply 2.12 to the repo's own recommendations: rig, superpowers, compound-engineering, RTK and
  jcodemunch. Add a supply-chain note wherever the docs tell readers to install these.
- Apply 2.10 to Pattern 2.8. Agent-written learnings are untrusted until reviewed. Add a review step
  before a learning is promoted.

### T2. New L4 patterns

| Number (suggested) | Pattern | Evidence label | Sources |
|--------------------|---------|----------------|---------|
| 4.7 | Author of record and agent register. Phase 3's `.autonomy.yaml` is its machine-readable form. Write 4.7 so the register can begin as a table and grow into A.1. | Partial | PO-10 to PO-17 |
| 4.8 | Evidence over self-report (rewrite of the 4.1 basis: completion evidence from systems the agent cannot edit; config changes as eval-gated releases) | Strong | IS-6 IS-3 MC-22 MV-8 PO-25 |
| 4.9 | Deliberate practice: keep supervision skill alive (protected hands-on time; explain-before-merge; work sample added to the new-starter audit) | Partial | IS-1 IS-4 IS-12 AN-20 AN-21 |

The tested stop is specified in Phase 3 (A.5). Reference it from 4.7; do not duplicate it.

### T3. Threat model page

Add `docs/cross-cutting/threat-model.md`. It lists:

- assets: code, secrets, CI, production
- untrusted entry points: rinse sources, issues, PR comments, MCP output, dependencies, learnings
  memory
- agent capabilities: shell, Docker, network, push
- which pattern mitigates each

Link it from CLAUDE.md.

### T4. Update existing material

- **`docs/L4-standards-measurement.md` review checklist.** Add a "Security and ownership" block:
  - the sandbox is on
  - no new secrets in agent-reachable config
  - new skills and MCP servers are vetted and pinned
  - an author of record is named
  - high-tier changes have a second human approver
- **`docs/cross-cutting/adoption-guide.md`.**
  - Add a "Containment and governance" assessment block.
  - Add a Path D, "Containment-first". Before any team moves from attended to unattended work, the
    adoption guide checks this block.
- **`docs/cross-cutting/anti-patterns.md`.** Add:
  - hooks as a security boundary
  - approval as a safety valve
  - unvetted skill install
  - self-promoting autonomy tiers
  - orphaned agent
- **`docs/cross-cutting/glossary.md`.** Add containment, lethal trifecta / Rule of Two, least
  agency, author of record, agent register, tested stop, approval fatigue and cognitive debt.
- **`docs/references/reference-my-claw-case-study.md`.** Add a caution note on the "autonomous (no
  oversight)" tier and on promotion after a run of successes.

### T5. Working example

Add a containment example that runs as-is in TypeScript and Python.

**Suggested:** `examples/containment/` with a neutral policy function, `(toolCall) -> allow | deny
| ask`, plus a real Claude Code settings file showing the equivalent deny rules and sandbox
configuration.

Unit tests must cover the bypasses Phase 0 documented:

- `/usr/bin/sed -i`
- `perl -pi`
- `bash -c`
- `$(...)`

They should also show that the policy layer alone does not stop them; the sandbox is the control.

## Acceptance checks

- `npm run lint:md` and `python3 docs/refresh/tools/linkcheck.py .` both report 0 issues.
- Every new pattern carries an Evidence line and a Bindings subsection.
- The `examples/containment/` tests pass in both languages, with the output in the PR.
- The threat model page is linked from CLAUDE.md.

## Out of scope

- The autonomy register file format and its tooling (Phase 3)
- Repair patterns (Phase 4)
