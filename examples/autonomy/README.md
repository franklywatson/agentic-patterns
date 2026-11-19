# Autonomy: Earned-Autonomy Tooling

Small, runnable tooling for [Earned Autonomy](../../docs/earned-autonomy.md). A workflow holds an explicit grant (A1 to A5) in a committed register. The grant never exceeds a cap computed from the repository's own artefacts. It rises only on ledger evidence with human sign-off. It falls automatically.

The same behavior is implemented twice: [TypeScript](typescript/) and [Python](python/). Both read the same schema and fixtures and produce the same results.

The register and the census profile store grants and curve positions as numbers: `granted_level: 4` is A4, and `"level": 3` or `cap: 3` in a profile is C3. Command output uses the same numbers.

## Layout

```text
examples/autonomy/
  schema/autonomy.schema.json   JSON Schema for .autonomy.yaml
  fixtures/                     registers, ledgers, fixture repositories, eval scenarios, golden outputs
  hooks/                        Claude Code settings snippets that bind the hook
  typescript/                   Node 22+, tsc, node:test (ajv, yaml)
  python/                       Python 3.12+, uv, pytest (jsonschema, pyyaml)
```

## The Five Commands

Each language has one CLI with five commands. All commands accept `--dir D` (the repository root, default the current directory) and `--now T` (an ISO date or time, default the current time; the environment variable `AUTONOMY_NOW` does the same). `--now` and `AUTONOMY_NOW` exist for tests and replays: CI must not set them, because a back-dated clock hides stale profiles and stop tests.

| Command | What it does | Exit code |
|---|---|---|
| `autonomy check` | Validates `.autonomy.yaml` against the schema, computes each workflow's effective grant, and fails on the rules below. Needs `--commits`, `--git-range` or an explicit `--no-commits` | 0 ok, 1 failed, 2 error |
| `autonomy census` | Probes the repository, writes `.autonomy/profile.json` and `.autonomy/worksheet.json` | 0 |
| `autonomy ledger` | Reads `.autonomy/ledger/<workflow>.jsonl`, prints a promotion evidence report, optionally applies a demotion | 0 |
| `autonomy drill` | Runs the stop drill for one workflow and writes `stop.last_tested` | 0 passed, 1 failed, 2 tool fault |
| `autonomy hook` | Claude Code hook entry point: `pre-tool-use` and `session-start` | 0 |

### TypeScript

```bash
cd examples/autonomy/typescript
npm install
npm test                      # builds, then runs node:test (unit, stack, eval)
node dist/src/cli.js check --dir ../fixtures/registers/valid --now 2026-11-18T00:00:00Z --no-commits
```

`npm run autonomy -- <command> ...` runs the built CLI.

### Python

```bash
cd examples/autonomy/python
uv sync
uv run pytest                 # unit, stack and eval tests; every warning is an error
uv run autonomy check --dir ../fixtures/registers/valid --now 2026-11-18T00:00:00Z --no-commits
```

### Run Against Your Own Repository

Build once in this repository, then point `--dir` at your repository's root. `census` needs no register; `check` needs `.autonomy.yaml` and a profile.

```bash
cd examples/autonomy/typescript
npm install && npm run build
node dist/src/cli.js census --dir /path/to/your-repo
node dist/src/cli.js check --dir /path/to/your-repo --git-range origin/main..HEAD
```

With Python: `uv run autonomy census --dir /path/to/your-repo` from `examples/autonomy/python`.

### Example run

```text
$ autonomy check --dir fixtures/registers/over-cap --now 2026-11-18T00:00:00Z --no-commits
cap: 2
workflow dep-bump: granted 4, effective 2  (cap:2)
workflow interactive: granted 2, effective 2
FAIL {"code":"grant-exceeds-cap","workflow":"dep-bump","granted":4,"cap":2}
autonomy check: FAILED
governance check: skipped (--no-commits)
```

```text
$ autonomy ledger --dir fixtures/ledgers/project --workflow dep-bump --now 2026-11-18T00:00:00Z
Evidence report: dep-bump
Date: 2026-11-18T00:00:00Z
Granted level: 3; target: 4
Window: 60 days, 130 runs (130 at the granted level)
First-run pass: 129/130 = 0.9923, Wilson lower bound 0.9577
Reverts: 0/130 merged = 0, Wilson upper bound 0.0287
Escaped defects: 0
Band: promote (promote at revert upper <= 0.03, demote above 0.06)

| Criterion | Required | Actual | Result |
|---|---|---|---|
| runs-at-level | >= 30 | 130 | pass |
| first-run-pass-lower | >= 0.90 | 0.9577 | pass |
| revert-upper | <= 0.03 | 0.0287 | pass |
...
Automated criteria: all met
Demotion: not triggered
```

## The Register

`.autonomy.yaml` lists every agent workflow, including interactive sessions. The schema is `schema/autonomy.schema.json`. The schema has no exception field: an unknown field is a schema error.

### Top-level fields

| Field | Meaning |
|---|---|
| `version` | Always `1` |
| `defaults.interactive_level` | Grant of the `interactive` workflow when the register does not list it (default 2) |
| `defaults.evidence_window` | `min_runs` (default 30) and `max_days` (default 60) for ledger evidence |
| `defaults.stop_test_max_age_days` | Age at which a stop test counts as overdue (default 30) |
| `defaults.review_cadence_days` | Review interval, informational |
| `profile` | Path of the census profile (default `.autonomy/profile.json`) |
| `workflows` | One entry per workflow |

### Workflow fields

| Field | Required | Meaning |
|---|---|---|
| `id` | yes | Lowercase identifier; also the value of `AUTONOMY_WORKFLOW` for the hook |
| `owner` | yes | Owning team. The census probe `owners-in-codeowners` looks for it in CODEOWNERS; `check` does not |
| `sponsor` | yes | Accountable human. No command checks that the sponsor is current |
| `granted_level` | yes | 1 to 5 (A1 to A5) |
| `identity` | yes | Who acts. A4 and above need `github-app:`, `service-account:`, `bot:` or `oidc:` followed by a name |
| `risk.reversible` | yes | Whether a revert undoes the action |
| `risk.verification` | yes | `mechanical`, `partial` or `judgement` |
| `risk.blast_radius` | yes | `file`, `repo`, `service` or `external` |
| `risk.trifecta` | yes | Three booleans: `untrusted_input`, `sensitive_data`, `external_action` |
| `risk.gate` | when needed | Name of a deterministic gate. Required at A3 and above when all three trifecta flags are true |
| `permitted_actions` | no | `tools` (for example `Bash(npm test*)`), `paths` (globs), `git` (`branch`, `commit`, `open_pr`, `auto_merge`), `network` (hosts) |
| `forbidden_actions` | no | For example `deploy`, `read_secrets`, `force_push`, `edit_ci`, `edit_autonomy` |
| `limits` | A4+ | `max_runs_per_day`, `max_cost_usd_per_run`, `max_diff_lines` |
| `stop` | A4+ | `mechanism` (prose), `command`, `authority`, `last_tested`. The drill runs `command` against a canary, so `command` must halt the canary: touch `$AUTONOMY_STOP_FILE` or kill `$AUTONOMY_CANARY_PID`. A command such as `gh workflow disable` never halts the canary and fails the drill; wrap it in a script that also signals the canary when run under the drill |
| `review_date` | A4+ | Date the grant must be reviewed by |
| `stop_rule` | A5 | When to retire the workflow |
| `baseline` | A5 | Path of the pre-change baseline |
| `target` | A5 | The measurable target |
| `access_expires`, `trigger`, `target_level`, `verification`, `description` | no | Expiry date, trigger, intended grant, required checks and task bank, free text |

Rules enforced by the schema:

- `granted_level >= 4` requires `stop` (with `mechanism`, `command` and `last_tested`), `review_date`, `limits`, a non-person `identity`, `risk.reversible: true` and `risk.verification: mechanical`.
- `granted_level == 5` also requires `stop_rule`, `baseline` and `target`.
- A full trifecta at `granted_level >= 3` is rejected unless `risk.gate` names a deterministic gate.

## Effective Grant

```text
effective = min(granted, cap(profile), freshness_gate, harness_gate, demotion_override)
```

| Term | Value |
|---|---|
| `cap(profile)` | Lowest position of platform, governance, ownership and measuring. A dimension that is `unknown` or absent counts as C2. A missing profile caps at C2 |
| `freshness_gate` | 2 when an A4-or-above stop test is older than `stop_test_max_age_days`, the review date has passed, access has expired, or the profile is older than 30 days or missing |
| `harness_gate` | 3 when `.autonomy/state.json` holds a `harness_hash` that differs from `task_bank_passed_hash` for the workflow |
| `demotion_override` | `demotion_override` for the workflow in `.autonomy/state.json` |

`autonomy check` fails when:

- the register does not validate against the schema;
- any `granted_level` exceeds the cap (`grant-exceeds-cap`);
- the profile is older than 30 days (`profile-stale`) or missing (`profile-missing`);
- an agent identity changed a tier 1 governance file (`governance-file-changed-by-agent`);
- an agent identity changed a tier 2 file, `.github/workflows/*`, and no later non-agent commit acknowledges it (`workflow-change-unacknowledged`);
- an agent commit is a merge with more than two parents (`merge-unsupported`) or changes a path that is not valid UTF-8 (`path-undecodable`); both fail closed because the changed files cannot be listed reliably;
- no commits were supplied (`governance-check-skipped`). Pass `--commits`, `--git-range`, or `--no-commits` to skip the rule on purpose; the text output then prints `governance check: skipped (--no-commits)`. A required CI check should pass `--git-range origin/main..HEAD`.

A reduced effective grant is reported but does not fail the check: the hook enforces the lower grant at run time. YAML is read with 1.2 booleans in both languages: only `true` and `false` are booleans, so `on` and `no` stay strings. Dates are calendar-checked: `2027-02-31` is a schema error.

### Governance files

Governance files are matched case-insensitively in two tiers. The tier lists are constants in the code, with no configuration switch.

- Tier 1 is never changed by an agent commit: `.autonomy*`, `CODEOWNERS` (any directory), `.claude/settings*.json`, `.claude/hooks/*` and `.harness.yaml`. The last three keep an agent from removing the hook.
- Tier 2 is `.github/workflows/*`. An agent commit may change it when a later commit in the same range, by a non-agent identity, has the message line `Governance-Approved: <sha>`. The sha is a hex prefix of at least 7 characters that matches exactly one agent commit in the range. It is a whole line in the body, not the subject, one line per agent commit; `git commit --allow-empty` is enough.
- An agent commit cannot acknowledge any commit. An acknowledgement before the agent commit does not count. A malformed, short, ambiguous or different sha never matches.
- Each acknowledged change prints `governance: <sha7> changed <file> (acknowledged by <sha7>)`, and the JSON result lists it under `acknowledged`.
- The acknowledgement is a trailer-based record, not a cryptographic control: author and committer identity are self-asserted, and CODEOWNERS and required review remain the boundary. Tier 2 relief applies to agent commits made outside the Claude Code hook, because the hook still denies a hooked session's writes to both tiers. The register and the checker code live under `examples/`, so reviewers must read changes to them.

Commit input:

- `--commits file.json` takes a list of `{sha, author, email, body, files}`, with optional `committer`, `committer_email` and `parents`. The list order is the commit order.
- `--git-range A..B` lists commits oldest first. A range must look like a revision. Renames are reported as a delete plus an add, so moving a governed file is visible. Each commit is read in its own git call with NUL framing, so a message cannot forge a commit. A merge commit is checked for what it changed beyond the automatic merge. Output is decoded as UTF-8 without newline translation in both languages.

A commit is an agent commit when its author or committer name or email contains `[bot]` or the name part of a workflow `identity`, or its message has a `Co-Authored-By:` trailer naming Claude or Anthropic in any case.

## Census

`autonomy census` probes presence and practice for the seven dimensions: platform, shared context, operating model, governance, ownership, skill and measuring. Practice means last changed within 90 days (from git history) or referenced by CI. A dimension's position is the highest whose probes all pass, with each lower position passing first. C1 means C2 is not met, so a dimension with no evidence is C1.

- Skill is the only dimension with no file probe. It is `unknown`, counted as C2, until a worksheet result is recorded.
- Positions no file can show (for example shared context at C4) stop the climb and appear as `human-only:c4` in `missing_for_next`.
- `.autonomy/worksheet.json` lists the human steps with the date it was generated. Record a skill result in `.autonomy/worksheets/skill.json` as `{"date": "2026-11-01", "level": 3}`. A result older than 90 days reverts to `unknown`.
- `workflows_over_cap` lists the register workflows whose grant exceeds the cap.

Probe ids per dimension (each id is the name shown in `evidence` and `missing_for_next`):

| Dimension | C2 | C3 | C4 | C5 |
|---|---|---|---|---|
| platform | `agent-config` | `check-command`, `ci-identity`, `sandbox-locked` | `egress-allowlist`, `audit-log` | `versioned-marketplace`, `agents-md` |
| shared_context | `claude-md` | `claude-md-short`, `claude-md-fresh`, `claude-md-owner`, `decision-log`, `blocking-hook-tested` | human only | `docs-pruned` |
| operating_model | `ci-tests-lint` | `ci-on-pr`, `automated-review`, `skill-chain` | `review-tiers` | `retired-rules-recorded` |
| governance | `constitutional-rules` | `sandbox-locked`, `deny-rules`, `extensions-pinned`, `non-author-approval`, `secret-scanning` | `trifecta-classified`, `audit-names-agent` | `review-record`, `stop-drills-recorded` |
| ownership | `register-owners` | `owners-in-codeowners`, `sponsors-and-expiry`, `author-trailer` | `harness-eval-in-ci`, `stop-authority` | `retirements-recorded` |
| skill | worksheet | worksheet | worksheet | worksheet |
| measuring | `outcome-tracking` | `baseline` | `task-banks` | `per-workflow-targets` |

`constitutional-rules` passes when "constitutional" appears in CLAUDE.md, or in an AGENTS.md that CLAUDE.md imports with `@AGENTS.md`, or in AGENTS.md when no CLAUDE.md exists. The other CLAUDE.md probes read CLAUDE.md only. `sandbox-locked` reads `.claude/settings.json`, which an agent can edit; `autonomy check` and the hook protect it as a tier 1 governance file, but the probe cannot see whether developer machines enforce the same keys.

Main files the probes read: `CLAUDE.md`, `AGENTS.md`, `CODEOWNERS`, `.claude/settings.json` (sandbox, permissions, hooks), `.claude/pins.json` (`{"pins": [{"name": "...", "sha256": "..."}]}`), `.github/workflows/*.yml`, `.github/rulesets/*.json`, `.autonomy.yaml`, `.autonomy/baseline.json` (`captured`, `flow`, `stability`), `.autonomy/audit/*.jsonl`, `.autonomy/ledger/*.jsonl`, `.autonomy/reviews.jsonl`, `.autonomy/retirements.jsonl`.

## Ledger

One JSON line per run in `.autonomy/ledger/<workflow>.jsonl`, written by CI. Fields used: `ts`, `level`, `outcome`, `first_run_pass`, `reverted_at`, `escaped_defect`, `diff_lines`, `cost_usd`, `checks["context-eval"]`.

`autonomy ledger --workflow ID` reports the evidence for the next grant using the Wilson 95 percent interval. Counts come from runs inside the evidence window.

| To grant | Criteria |
|---|---|
| A3 | At least 20 runs at A2; first-run pass lower bound at least 0.80; owner named; a traced sample is listed as a human step |
| A4 | At least 30 runs at A3 (the minimum sample, not sufficient alone); first-run pass lower bound at least 0.90; revert upper bound at most 0.03 (zero reverts clears this only from about 125 merged runs); zero escaped defects; task bank score at least 0.90 on the latest run; reversible and mechanical; stop drill within 30 days; cap at least C4; no demotion in the last 30 days |
| A5 | At least 90 days at A4; baseline, target and stop rule set; cost per merged outcome reported; cap at least C5; no demotion in the last 30 days; a recorded review cycle is listed as a human step |

A gap separates the promote and demote thresholds. A revert upper bound of 0.03 or less allows promotion. An upper bound above 0.06 demotes. Between the two the band is `hold`. Zero reverts clear 0.03 only from 125 merged runs, so a small sample cannot promote. A revert demotion needs at least one revert in the window and at least `min_runs` merged runs, so a small clean sample is not demoted.

Demotion triggers over runs at A3 and above: an escaped defect (to A2); a revert upper bound above 0.06; a latest task bank score below 0.80; a run over `max_diff_lines`; a run over `max_cost_usd_per_run`; a day over `max_runs_per_day` (each to A3). `--apply-demotion` writes the lowest target to `.autonomy/state.json` as `demotion_override` with `demoted_at`. It never raises an existing override.

## Stop Drill

`autonomy drill --workflow ID [--bound-ms N]` (default 2000 ms):

1. Starts a canary process that writes a heartbeat file every 50 ms and exits when a stop file appears.
2. Waits for the heartbeat, then runs the workflow's `stop.command` with `AUTONOMY_CANARY_PID`, `AUTONOMY_STOP_FILE` and `AUTONOMY_HEARTBEAT` set.
3. Asserts the canary exits within the bound and the heartbeat stops changing.
4. On success writes today's date to `stop.last_tested` in `.autonomy.yaml` (an in-place text edit that keeps comments).
5. On failure writes `demotion_override: 3` to `.autonomy/state.json`. A missing `stop.command`, a failing command, a canary that keeps running and a stop that takes longer than the bound (the bound includes the command's own run time) are all failures. A canary that never starts is a tool fault: exit code 2, no demotion, no date written.

Every drill appends a line to `.autonomy/drills.jsonl`. The drill does not check that tokens were revoked or that the workflow can be restored.

The drill runs `stop.command` through `sh -c` in the repository root with only `PATH`, `HOME` and the three `AUTONOMY_*` variables. The register is a governance file, but a job that runs the drill on a pull-request checkout runs whatever the pull request wrote: run the drill only from a checkout of the default branch.

## Hook

`autonomy hook pre-tool-use` and `autonomy hook session-start` read the Claude Code hook JSON on stdin ([hooks reference](https://code.claude.com/docs/en/hooks)). The workflow comes from `AUTONOMY_WORKFLOW` (default `interactive`). The project root comes from `CLAUDE_PROJECT_DIR`.

- `session-start` returns `additionalContext` naming the effective grant and the reasons for any reduction.
- `pre-tool-use` returns `hookSpecificOutput` with `permissionDecision: "deny"` and a reason that starts with a code. An allowed call prints nothing, so the normal permission flow applies.

Add `hooks/settings.typescript.example.json` or `hooks/settings.python.example.json` to `.claude/settings.json`. Both are command hooks whose path is `$CLAUDE_PROJECT_DIR/examples/autonomy/...`; in another repository, point the command at your built copy of the CLI.

| Rule | Code |
|---|---|
| Write, Edit, MultiEdit or NotebookEdit on a governance file (the list above, case-insensitive, after resolving `..` and symlinks); a shell command that mentions one and writes (redirect, `tee`, `sed -i`, `mv`, `cp`, `rm` and similar) | `governance-write` |
| Workflow missing from the register, or no register: only read-only tools | `unknown-workflow` |
| A1: any write tool or non-read-only command | `read-only-level` |
| Tool name that is not recognized and not listed in `permitted_actions.tools` | `unknown-tool` |
| `sh -c`, `eval`, `python -c`, `node -e`, `perl -e` and similar inline code, unless an explicit `Bash(...)` pattern permits it | `inline-interpreter` |
| Tool or Bash command outside `permitted_actions.tools`; every segment of a compound command must match; command substitution is rejected | `outside-permitted-tools` |
| Write outside `permitted_actions.paths` | `outside-permitted-paths` |
| `deploy`, `read_secrets` or another word in `forbidden_actions` | `forbidden-action` |
| `git push --force` at any grant | `force-push` |
| `git push` at A2 or below | `git-push-blocked` |
| Push to `main` or `master` | `protected-branch-push` |
| `gh pr merge` or a merge-triggering label at A3 or below | `merge-blocked` |
| Merge at A4 or above without `auto_merge`, over `max_diff_lines`, or touching a path outside `permitted_actions.paths` (diff from `git diff --numstat origin/main`, or `AUTONOMY_BASE`) | `merge-limits` |
| Egress outside `permitted_actions.network` (applies at A2 or below, when `network` is set, and at A4 or above) | `network-blocked` |
| After the session read untrusted input (WebFetch, WebSearch, `gh issue view`, `curl` GET), an external action when the workflow holds sensitive data and names no `risk.gate` | `trifecta-external-action` |

Input that is not a JSON object with a string `tool_name` and an object `tool_input` exits with code 2, which blocks the call. Leading `VAR=x`, `env`, `command`, `sudo`, `time`, `timeout N`, `nice`, `nohup`, `exec` and git global options (`git -C dir`, `-c k=v`, `--git-dir`) are stripped before the git, merge and egress rules apply.

The Bash rules match command strings. That is a nudge, not a boundary: a shell can reach the same effect through paths the matcher does not parse. The controls that hold are a `permitted_actions.tools` allow-list (Bash is default-deny once the list exists), CODEOWNERS with required review, `autonomy check` in CI, and the container or sandbox the agent runs in (see Pattern 2.3 in the L2 document: hooks reduce mistakes; isolation limits damage).

The hook appends every decision to `.autonomy/audit/<session>.jsonl` with the fields `ts`, `agent` (the workflow id), `human` (from `AUTONOMY_SPONSOR`), `tool`, `decision` and `code`; the record has no outcome field. It records the untrusted-input flag in `.autonomy/sessions/<session>.json`. Both are runtime state, not source: keep `.autonomy/audit/` and `.autonomy/sessions/` out of version control. The Bash rules are a backstop. CODEOWNERS and `autonomy check` remain the control for governance files.

## Eval Suite

`fixtures/eval/scenarios.json` holds 17 scenarios. They cover:

- A1, and A2 including egress;
- A3, including bypass attempts: wrappers, inline interpreters, `..` and case-variant paths, hook configuration, unknown tools;
- A4 within limits, with a diff too large and with a stray file;
- a cap below the grant, a stale stop, a demotion override and a changed harness;
- a trifecta session (tainted, clean, with a gate) and an unknown workflow.

Each scenario sets an effective grant and a list of tool calls with the expected allow or the expected deny code. A test in each language also replays the scenarios through the real `hook pre-tool-use` command over stdin.

Scoring is pass^k, not graduated: a scenario scores 1 only when all k runs (k is 5) match every expectation, otherwise 0. The suite requires a score of exactly 1. Tests in `typescript/tests/eval/` and `python/tests/eval/` also show the scorer failing on a wrong expectation.

## Tests

Both suites cover the same behavior.

| Group | Location | What it shows |
|---|---|---|
| Unit | `tests/unit/` | Schema rules, effective grant, Wilson bounds, promote and demote thresholds, drill, hook decisions, CLI exit codes |
| Stack | `tests/stack/` | `census` against committed fixture repositories (copied to a temporary git repository with a fixed commit date); asserts the profile and the cap; `check` then fails because a grant exceeds the cap |
| Eval | `tests/eval/` | pass^k over the shared scenarios |

Both suites compare results with the golden files in `fixtures/expected/`, so TypeScript and Python are held to the same output.

## Fixtures

| Path | Content |
|---|---|
| `fixtures/registers/valid/` | A valid register, a current profile and state |
| `fixtures/registers/over-cap/` | An A4 grant under a cap of C2 |
| `fixtures/registers/invalid/` | Eight invalid registers and `expected.json` with the exact schema errors |
| `fixtures/repos/adopter/` | Fixture repository: cap C3 with an A4 workflow |
| `fixtures/repos/bare/` | Fixture repository with only a `CLAUDE.md`: cap C1 |
| `fixtures/repos/rules-*/` | Five repositories for the `constitutional-rules` probe: CLAUDE.md importing AGENTS.md, CLAUDE.md only, AGENTS.md only, AGENTS.md not imported, no rules |
| `fixtures/ledgers/project/` | Four ledgers: ready to promote, hold, regressing, incident |
| `fixtures/commits/` | Commit lists for the governance-file check, including the tier 2 acknowledgement cases |
| `fixtures/eval/scenarios.json` | The hook eval scenarios |
| `fixtures/expected/` | Golden outputs shared by both languages |
