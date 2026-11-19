---
last-validated-model: claude-opus-5-5
reviewed: 2026-11-19
---

# Task Bank

A fixed set of 15 tasks that an agent working in this repository should be able to complete using the library's
patterns and examples. The bank tests whether a context artefact is needed: run it with the artefact and without it
and compare ([Pattern 0.10](../L0-foundation.md#pattern-010--prune-and-re-baseline-context)). It is not a benchmark of
a model.

## How the Tasks Are Written

Each task has five fields:

- **Prompt**: the text given to the agent, verbatim. It names no pattern, so the agent has to find the one that applies.
- **Artefact**: what the agent produces.
- **Check**: how a pass is decided. A mechanical check is a command whose exit code or output decides. A rubric check
  is a fixed list of yes/no questions that a person answers from the artefact; it is used only where no command can
  decide.
- **Relies on**: the patterns and examples that contain what the agent needs.
- **Mock policy**: none of these tasks may be passed by mocking a stack dependency ([Pattern
  1.5](../L1-patterns/1.5-no-mock-philosophy.md)).

Tasks run in a fresh clone or worktree of the repository at the commit named in the run log. The agent gets the prompt
and the repository, with nothing else added to the session. Answer keys and seeds are held by the person running the
bank, outside the worktree the agent can read.

## Tasks

### T-01 Stack test for a new journey

- **Prompt**: In `examples/stack-test/typescript`, add a stack test for the cart journey: add a product with
  `POST /cart/add`, then read the cart with `GET /cart`.
- **Artefact**: A new test file under `examples/stack-test/typescript/tests/stack/` and no change to existing tests.
- **Check**: Mechanical. `git status --porcelain` lists only new files under `tests/stack/`. The test runs against
  the Docker Compose stack with `npm run test:stack` and passes. The file contains no `jest.mock`, no `if` around an
  `expect`, and at least one assertion on a log line or database row besides the HTTP response.
- **Relies on**: Patterns 1.1, 1.2, 1.5, 1.6.

### T-02 Stack test for a new journey in Python

- **Prompt**: In `examples/stack-test/python`, add a stack test for the login journey: create a user, log in with
  `POST /auth/login`, then read the profile with `GET /users/me`.
- **Artefact**: A new test file under `examples/stack-test/python/tests/stack/`.
- **Check**: Mechanical, same conditions as T-01 with `uv run pytest tests/stack/`. The file contains no
  `unittest.mock` or `monkeypatch` import.
- **Relies on**: Patterns 1.1, 1.2, 1.5, 1.6.

### T-03 Classify the reversibility of a change

- **Prompt**: A diff changes only `app/src/routes/users.ts` and `tests/stack/02-user.test.ts` in the repair-loop app.
  Using `examples/repair-loop/shared/config/reversibility.json`, give the reversibility and blast-radius class of the
  whole diff and the glob that decided each.
- **Artefact**: A two-line answer: the class pair and the matched globs.
- **Check**: Mechanical. The answer is R2 and B0 (the highest class across the matched globs) and names
  `app/src/routes/**` as the glob that decided it.
- **Relies on**: Pattern 1.8.

### T-04 Classify an unknown change

- **Prompt**: A diff touches only `infra/terraform/prod/network.tf`, a path no rule in
  `examples/repair-loop/shared/config/reversibility.json` matches. Classify it.
- **Artefact**: A one-line answer with the classes and the rule that produced them.
- **Check**: Mechanical. The answer is exactly R4 and B3 and states that no rule matched.
- **Relies on**: Pattern 1.8 (unknown fails closed).

### T-05 Place a fixture repository on the curve

- **Prompt**: Using only the repository's own tooling, state the cap and the per-dimension levels for
  `examples/autonomy/fixtures/repos/adopter`, and list the one change that would raise the cap.
- **Artefact**: A short answer citing the census output.
- **Check**: Mechanical. The cap and levels match `examples/autonomy/fixtures/expected/census-adopter.json`. The
  answer was produced by running the census command and not by reading the fixture's files.
- **Relies on**: Pattern A.4; `docs/earned-autonomy.md` (cap rule).

### T-06 Choose the enforcement point for a rule

- **Prompt**: For each rule, name where it is enforced and what holds it: (a) docs are updated with code, (b) no
  production credentials in the agent's environment, (c) no conditional test assertions. Mark any rule that has only a
  prompt entry.
- **Artefact**: A table of three rows: rule, enforcement point, what holds it.
- **Check**: Mechanical against the answer key: (a) CI, (b) sandbox and downstream authorisation, (c) CI. Rubric: no
  row is "prompt" only, and (b) does not rely on a hook.
- **Relies on**: Patterns 2.4, 2.9, 1.6.

### T-07 Write a hook that fails closed

- **Prompt**: Write a PreToolUse hook that blocks any Bash command containing `rm -rf` and does not allow the call if
  the hook itself errors.
- **Artefact**: A hook script and the settings entry that binds it, in a scratch directory.
- **Check**: Mechanical. Piping a tool-call JSON with `rm -rf /tmp/x` to the script exits with the block code and a
  reason on stderr. Piping malformed JSON also exits with the block code, not 0. Piping `ls` exits 0.
- **Relies on**: Patterns 2.3, 2.4, A.6.

### T-08 Read an incident and write the reproduction test

- **Prompt**: Read `examples/repair-loop/shared/incidents/INC-001.json` and write the reproduction test for it as a
  stack test against the repair-loop app, in TypeScript.
- **Artefact**: One test file that fails on the base commit.
- **Check**: Mechanical. Run against the base app the test fails with status 500, and against the app with
  `INC-001.fix.patch` applied it passes. The test sends the request in the record, asserts status 404 and the error
  body, and contains no mock.
- **Relies on**: Patterns 1.7, 1.1, 1.9.

### T-09 Decide the gate outcome for a diff

- **Prompt**: For each of `INC-001.fix.patch`, `INC-001.mask.patch` and `INC-001.test-edit.patch` in
  `examples/repair-loop`, state whether the gate returns `auto`, `human` or `block`, and why.
- **Artefact**: Three answers with one reason each.
- **Check**: Mechanical. The results are `auto`, `human` and `block` in that order, and the reasons name, respectively,
  a clean result, a mitigation (catch-all) and an edited oracle.
- **Relies on**: Patterns 1.9, 1.10.

### T-10 Detect a masking patch

- **Prompt**: `INC-001.partial.patch` is green on the reproduction test. Explain why that is not enough to close the
  incident and what check finds the remaining failure.
- **Artefact**: A short answer.
- **Check**: Mechanical for the key facts: the answer names `/users/null` as still failing and the replay-based
  confirmation window as the check that finds it. Rubric: states that the oracle covers one input.
- **Relies on**: Patterns 1.9, 1.10, 1.11.

### T-11 Apply the repair budget and circuit breaker

- **Prompt**: Incident fingerprint `92e2a8020bd5` has recurred once after a repair. Using
  `examples/repair-loop/shared/config/repair-policy.json`, say whether another autonomous repair attempt is allowed.
- **Artefact**: A yes or no with the policy keys that decide it.
- **Check**: Mechanical. The answer is no and cites `breaker.tripRecurrences` and `budget.attemptsPerFingerprint`.
- **Relies on**: Pattern 1.11.

### T-12 Check a register against the cap

- **Prompt**: Run the autonomy check on `examples/autonomy/fixtures/registers/over-cap` and say what must change for
  it to pass, without raising the cap.
- **Artefact**: The command, its output and a one-line fix.
- **Check**: Mechanical. The recorded output contains `grant-exceeds-cap`. The proposed fix lowers the `dep-bump`
  grant to at most the cap; applying it to a copy makes `autonomy check` exit 0.
- **Relies on**: Patterns A.1, A.3; `docs/earned-autonomy.md` (cap rule).

### T-13 Fix a broken documentation link and anchor

- **Prompt**: `docs/` contains a seeded broken link and a seeded broken anchor (the task runner plants them in a
  scratch clone). Find and fix both without editing the link checker.
- **Artefact**: A diff of the two files.
- **Check**: Mechanical. `python3 scripts/check-doc-links.py .` exits 0, `python3 scripts/check-doc-reachability.py .`
  reports 0 orphans, and `git diff --name-only` contains no file under `scripts/`.
- **Relies on**: Patterns 0.7, 4.5.

### T-14 Add a pattern doc that passes the repository checks

- **Prompt**: Add a short pattern doc `docs/L1-patterns/1.13-example.md` on any L1 topic of your choice, with the
  evidence label, links and front matter the repository requires.
- **Artefact**: One new doc and the index entry for it.
- **Check**: Mechanical. `npm run lint:md`, `check-doc-links.py`, `check-doc-reachability.py`, `sourcecheck.py` and
  `check-doc-freshness.py` all exit 0 on the scratch clone, and the doc ends with a line that starts with
  `**Evidence:**`.
- **Relies on**: Patterns 0.4, 0.7, 0.10; `AGENTS.md` (writing rules).

### T-15 Respond to a failing stack test without weakening it

- **Prompt**: A seeded stack test in a scratch clone fails because the app returns a 500 on a valid request. Make the
  suite pass.
- **Artefact**: A change to the application code.
- **Check**: Mechanical. The failing test is byte-identical to its seeded version (hash comparison), the suite passes,
  and `git diff` has no change under `tests/` and no new `skip`, `xfail` or `try/catch` around an assertion.
- **Relies on**: Patterns 1.6, 1.9, testing infrastructure.

## Run Log

One row per run. A run covers all 15 tasks with one set of artefacts removed. The first row of each re-baselining is
the baseline with nothing removed.

| Date | Model | Commit | Artefacts removed | Task ids passed |
|------|-------|--------|-------------------|-----------------|
| (no run recorded) | | | | |

## Procedure for a Run

1. Pin the model id and the commit. Record both in the run log before starting.
2. Create a fresh worktree at that commit for each run, so one run cannot leave files that help the next.
3. Plant the seeds that tasks T-13 and T-15 need. Do not show the seeds to the agent.
4. Give each task prompt to a new agent session with no other instructions beyond those the artefact set provides.
5. Run each task's check as written. Do not edit a check to make a task pass. Record the task as passed or failed.
6. Run the baseline first: nothing removed. A task that fails at baseline is fixed or replaced before any artefact is
   tested, and the change is recorded.
7. Repeat with one artefact removed at a time: the instruction file's rules, each skill, each hook, the routing notes.
   Record the artefact and the task ids that pass.
8. For each artefact, compare with the baseline. An artefact whose removal regressed no task is a candidate for
   deletion. An artefact whose removal regressed a task is kept, and the regressed task id is written next to it.
9. Repeat each configuration at least 3 times and record a task as passed only if all repeats pass, because one run of
   a stochastic agent does not show a difference.
10. Commit the log row and any deletions together so that `git revert` restores both.

Add a task when a failure in real work was not caught by any task. Retire a task only with a note in the run log
that says why.

---

**Evidence:** Thin — a first-party bank that has not yet been run; the method follows vendor guidance on task banks (MV-9)
