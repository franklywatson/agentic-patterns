---
last-validated-model: claude-opus-5-5
reviewed: 2026-11-19
---

# Task Bank

A fixed set of 15 tasks that an agent working in this repository should be able to complete using the library's
patterns and examples. The bank tests whether a context artifact is needed: run it with the artifact and without it
and compare ([Pattern 0.10](../L0-foundation.md#pattern-010--prune-and-re-baseline-context)). It is not a benchmark of
a model.

## How the Tasks Are Written

Each task has four fields:

- **Prompt**: the text given to the agent, verbatim. It names no pattern, so the agent has to find the one that applies.
- **Artifact**: what the agent produces, and where. Answer tasks write `ANSWER.json` in the workspace root with the
  keys shown in the prompt.
- **Check**: the kind of check, not the expected values. A mechanical check is a command or comparison whose result
  decides. A rubric item is a yes/no question that a person answers from the artifact; it never decides a pass.
- **Relies on**: the patterns and examples that contain what the agent needs.

Expected values, seeds and the check parameters live in `scripts/task-bank/` (`answers.json`, `seeds/`, `run.py`).
The runner copies the repository into a scratch directory without `scripts/task-bank/`, so the agent cannot read
them, and it never writes into the repository's fixtures. None of these tasks may be passed by mocking a stack
dependency ([Pattern 1.5](../L1-patterns/1.5-real-dependencies.md)).

Lookup tasks (T-03, T-04, T-06, T-09, T-10, T-11) check whether the agent finds and applies a rule that is written in
the library. They discriminate little between models and are included because a removed artifact can break the lookup.

## Tasks

### T-01 Stack test for a new journey

- **Prompt**: In `examples/stack-test/typescript`, add a stack test for the cart journey: add a product with a
  form-encoded `POST /cart/add` (the app answers 303), then read the cart with `GET /cart`.
- **Artifact**: A new test file under `examples/stack-test/typescript/tests/stack/` and no change to existing files.
- **Check**: Mechanical (needs Docker). Only new files under `tests/stack/`; the file passes `npm run test:stack`; it
  has no `jest.mock` and no `if` around an `expect`. Rubric: one assertion beyond the HTTP response.
- **Relies on**: Patterns 1.1, 1.2, 1.5, 1.6.

### T-02 Stack test for a new journey in Python

- **Prompt**: In `examples/stack-test/python`, add a stack test for the login journey: create a user, log in with
  `POST /auth/login`, then read the profile with `GET /users/me`.
- **Artifact**: A new test file under `examples/stack-test/python/tests/stack/`.
- **Check**: Mechanical (needs Docker). Same conditions as T-01 with `uv run pytest tests/stack/`, and no
  `unittest.mock` or `monkeypatch` in the file.
- **Relies on**: Patterns 1.1, 1.2, 1.5, 1.6.

### T-03 Classify the reversibility of a change

- **Prompt**: A diff adds one line to `app/src/routes/users.ts` and one line to a test file under `tests/`. Paths are
  relative to `examples/repair-loop/typescript`, and the added lines match none of the `content` rules. Using
  `examples/repair-loop/shared/config/reversibility.json`, write `ANSWER.json` with `reversibility`, `blast` and `glob`
  (the glob that decided the class pair).
- **Artifact**: `ANSWER.json`.
- **Check**: Mechanical comparison of the three keys. Lookup task.
- **Relies on**: Pattern 1.8.

### T-04 Classify an unknown change

- **Prompt**: A diff touches only `infra/terraform/prod/network.tf`, a path that no glob in
  `examples/repair-loop/shared/config/reversibility.json` is meant to cover. Write `ANSWER.json` with `reversibility`,
  `blast` and `rule_matched` (true or false).
- **Artifact**: `ANSWER.json`.
- **Check**: Mechanical comparison. Lookup task.
- **Relies on**: Pattern 1.8.

### T-05 Place a fixture repository on the curve

- **Prompt**: Using the repository's own tooling, find the cap and the position of each dimension for
  `examples/autonomy/fixtures/repos/adopter`. Write `ANSWER.json` with `cap` and `levels` (a map from dimension name
  to position, with `unknown` where the tool reports it).
- **Artifact**: `ANSWER.json`.
- **Check**: Mechanical comparison against the census output for the fixture. The runner works in a scratch copy, so
  running `census` there does not change the repository.
- **Relies on**: Pattern A.4; `docs/earned-autonomy.md` (cap rule).

### T-06 Choose the enforcement point for a rule

- **Prompt**: For each rule, name where it is enforced and what holds it: (a) docs are updated with code, (b) no
  production credentials in the agent's environment, (c) no conditional test assertions. Write `ANSWER.json` with keys
  `a`, `b` and `c`, each a list of enforcement points (`prompt`, `hook`, `CI`, `sandbox`, `downstream`).
- **Artifact**: `ANSWER.json`.
- **Check**: Mechanical comparison of each list as a set. Rubric: no row is prompt only; (b) does not rely on a hook.
  Lookup task.
- **Relies on**: Patterns 2.4, 2.9, 1.6.

### T-07 Write a hook that fails closed

- **Prompt**: Write a Claude Code PreToolUse hook in Python 3 at `hook/pretooluse.py` that blocks any Bash command
  containing `rm -rf`. It reads the tool call as JSON on stdin and exits with Claude Code's blocking code (exit code 2)
  with the reason on stderr. If the hook cannot parse its input, it must also block. Add the settings entry that binds
  it in `hook/settings.json`.
- **Artifact**: `hook/pretooluse.py` and `hook/settings.json`.
- **Check**: Mechanical. The runner pipes four tool calls to the script and compares the exit code and stderr: two
  blocked commands, one malformed input and one harmless command. Rubric: the settings entry matches Bash on
  PreToolUse.
- **Relies on**: Patterns 2.3, 2.4, A.6.

### T-08 Read an incident and write the reproduction test

- **Prompt**: Read `examples/repair-loop/shared/incidents/INC-001.json` and write the reproduction test for it as a
  stack test against the repair-loop app, in TypeScript.
- **Artifact**: One new test file under `examples/repair-loop/typescript/tests/stack/`.
- **Check**: Mechanical (needs Docker). The file sends the recorded request, asserts the expected status and body, and
  has no mock. The runner runs it against the base app, where it must fail, and with `INC-001.fix.patch` applied,
  where it must pass.
- **Relies on**: Patterns 1.7, 1.1, 1.9.

### T-09 Decide the gate outcome for a diff

- **Prompt**: For each of `INC-001.fix.patch`, `INC-001.mask.patch` and `INC-001.test-edit.patch` in
  `examples/repair-loop/typescript/patches`, decide whether the gate returns `auto`, `human` or `block`. Write
  `ANSWER.json` with keys `fix`, `mask` and `test-edit`.
- **Artifact**: `ANSWER.json`.
- **Check**: Mechanical comparison. Lookup task.
- **Relies on**: Patterns 1.9, 1.10.

### T-10 Detect a masking patch

- **Prompt**: `INC-001.partial.patch` is green on the reproduction test. Write `ANSWER.json` with `failing_path` (a
  replay path that still fails) and `check` (the check that finds it).
- **Artifact**: `ANSWER.json`.
- **Check**: Mechanical: the path equals the expected path and `check` matches the expected check. Rubric: states that
  the reproduction covers one input. Lookup task.
- **Relies on**: Patterns 1.9, 1.10, 1.11.

### T-11 Apply the repair budget and circuit breaker

- **Prompt**: Incident fingerprint `92e2a8020bd5` has recurred once after a repair. Using
  `examples/repair-loop/shared/config/repair-policy.json`, write `ANSWER.json` with `allowed` (whether another
  autonomous repair attempt is allowed) and `keys` (the policy keys that decide it).
- **Artifact**: `ANSWER.json`.
- **Check**: Mechanical: `allowed` equals the expected value and `keys` contains the expected keys. Lookup task.
- **Relies on**: Pattern 1.11.

### T-12 Fix a register that exceeds the cap

- **Prompt**: Run the autonomy check on `examples/autonomy/fixtures/registers/over-cap`, then edit that register's
  `.autonomy.yaml` so the check passes without raising the cap.
- **Artifact**: The edited `.autonomy.yaml` in the workspace.
- **Check**: Mechanical. The runner puts the edited file next to the original profile in a scratch directory and runs
  `autonomy check` there; it must exit 0, and the workflow ids must remain.
- **Relies on**: Patterns A.1, A.3; `docs/earned-autonomy.md` (cap rule).

### T-13 Fix a broken documentation link and anchor

- **Prompt**: A documentation link and an anchor in `docs/` are broken. Find and fix both without editing anything
  under `scripts/`.
- **Artifact**: A diff of the docs that were wrong.
- **Check**: Mechanical. The seed (`scripts/task-bank/seeds/T-13.patch`) is planted by the runner. Afterwards
  `check-doc-links.py` exits 0, `check-doc-reachability.py` reports 0 orphans and nothing under `scripts/` changed.
- **Relies on**: Patterns 0.7, 4.5.

### T-14 Add a pattern doc that passes the repository checks

- **Prompt**: Add a short pattern doc `docs/L1-patterns/1.13-example.md` on any L1 topic of your choice, with the
  evidence label, links and front matter the repository requires, and add it to the index.
- **Artifact**: One new doc and the index entry for it.
- **Check**: Mechanical. `npm run lint:md`, the link, source, reachability and freshness scripts pass, the doc has
  front matter with both keys and ends with an `**Evidence:**` line.
- **Relies on**: Patterns 0.4, 0.7, 0.10; `AGENTS.md` (writing rules).

### T-15 Respond to a failing stack test without weakening it

- **Prompt**: A stack test in `examples/stack-test/typescript` fails because the app returns a 500 on a valid
  request. Make the suite pass.
- **Artifact**: A change to the application code.
- **Check**: Mechanical (needs Docker). The runner plants the seed (`seeds/T-15.patch`). Nothing under `tests/`
  changed, no `.skip`, `.only` or `xfail` was added, and `npm run test:stack` passes.
- **Relies on**: Patterns 1.1, 1.6, 1.9.

## Run Log

One row per run. No run has been recorded, so there is no baseline yet; the first row will be the baseline with nothing removed. A run covers all 15 tasks with one set of artifacts removed. The first row of each re-baselining is
the baseline. The runner also appends one JSON line per run to `scripts/task-bank/run-log.jsonl`
with the date, the `--model` value, the commit, the artifacts removed and the task ids passed, failed and skipped.
It does not record the effort level or the harness; write those in this table by hand.

| Field | What to record |
|-------|----------------|
| Date | Date of the run |
| Model | Model id the harness command sets (for Claude Code, `--model <id>`) |
| Effort | Effort level the harness command sets (for Claude Code, `--effort <level>`, see the [CLI reference](https://code.claude.com/docs/en/cli-reference); available levels depend on the model) |
| Harness | Harness name and version (for Claude Code, the output of `claude --version`) |
| Commit | Commit of this repository |
| Artifacts removed | Paths passed with `--remove`, or none for the baseline |
| Task ids passed | Tasks that passed in every repeat |

| Date | Model | Effort | Harness | Commit | Artifacts removed | Task ids passed |
|------|-------|--------|---------|--------|-------------------|-----------------|
| (no run recorded) | | | | | | |

## Procedure for a Run

1. Pin the model id, the effort level, the harness version and the commit, and record them in the run log before
   starting. The harness command sets the model and effort; the runner does not. User-level instruction files
   (`~/.claude/CLAUDE.md`, `~/.claude/rules/`) and auto memory load into every Claude Code session
   ([memory](https://code.claude.com/docs/en/memory)), so run under a user profile without them, or set
   `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1` and record what else loaded.
2. Build the autonomy CLI once (`cd examples/autonomy/typescript && npm ci && npm run build`). Tasks that need Docker
   need a running Docker daemon.
3. Run `python3 scripts/task-bank/run.py --agent-cmd "<harness command>" --model <id>`. `--model` only writes the
   id to the run log; it is not passed to the harness command. The runner makes a fresh scratch copy of the
   repository for each task, without `scripts/task-bank/`, plants any seed, removes each path named by `--remove`,
   runs the harness command in the copy with the prompt on stdin (and in `TASK_PROMPT`), and scores the result
   against `answers.json`.
4. Run the baseline first, with nothing removed. A task that fails at baseline is fixed or replaced before any artifact
   is tested, and the change is recorded.
5. Repeat with one artifact removed at a time (`--remove PATH`): the instruction file's rules, each skill, each hook,
   the routing notes. Record the artifact and the task ids that pass.
6. For each artifact, compare with the baseline. An artifact whose removal regressed no task is a candidate for
   deletion. An artifact whose removal regressed a task is kept, and the regressed task id is written next to it.
7. Repeat each configuration at least 3 times and record a task as passed only if all repeats pass, because one run of
   a stochastic agent does not show a difference.
8. Answer the rubric items for each artifact. They are listed with each result and do not change a pass or fail.
9. Commit the log row and any deletions together so that `git revert` restores both.

`python3 scripts/task-bank/run.py --dry-run` scores a known-good and a known-bad artifact for the tasks that have
dry-run data in `answers.json` (T-03 to T-07, T-09 to T-13) and exits 1 if either is scored wrongly. It skips the
Docker tasks (T-01, T-02, T-08, T-15) and T-14, none of which has dry-run data. Build the autonomy CLI first
(step 2 above); T-05 and T-12 run it. Run the dry run after changing a check or an answer.

Add a task when a failure in real work was not caught by any task. Retire a task only with a note in the run log that
says why.

---

**Evidence:** Thin — no run, baseline included, is recorded in the run log; the method follows vendor guidance on task banks (MV-9)
