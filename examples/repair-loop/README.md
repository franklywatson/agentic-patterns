# Repair Loop Example

A runnable repair loop with a deterministic gate, in TypeScript and Python. The loop takes an
incident record, reproduces the failure, applies a candidate patch, verifies it, and asks a
pure-function gate for one of three answers: `auto`, `human` or `block`. A fixed patch stands
in for the repair agent, so every run is reproducible. No LLM is involved.

The example demonstrates three outcomes on one seeded defect (INC-001):

| Candidate patch | What it does | Gate answer |
|-----------------|--------------|-------------|
| `INC-001.fix.patch` | Validates the id before the query | `auto` |
| `INC-001.mask.patch` | Wraps the handler in a catch-all that returns 404 | `human`, with a root-cause ticket |
| `INC-001.test-edit.patch` | Edits the reproduction to expect the 500 | `block` |
| `INC-001.partial.patch` | Guards only the literal id `undefined`: green on the oracle, still failing on `/users/null` | `auto`, then the confirmation window rolls it back |

## What Is Real and What Is Simulated

Real:

- The app runs in Docker with PostgreSQL and Redis. Reproduction and regression tests call it over HTTP.
- The reproduction is red on the base commit and green on the fix, observed in test output.
- Patches are validated (no absolute path, no `..`, no backslash), applied with `patch` inside a temporary
  workspace, and the diff that the gate sees is observed with `diff -ruN` between the base and candidate
  directories, not read from the patch text. Hashes are computed from files on disk.
- The oracle never comes from the candidate. The loop runs the frozen reproduction and the regression suite
  from the base workspace against the candidate's deployment, with `--noconftest` and importlib mode (pytest)
  or explicit test paths and restricted roots (Jest). The compose file is always the pristine template.
- Incident records are untrusted input. `id`, `method`, `journey`, request paths, headers and the error class
  are checked against strict patterns, and every value enters generated test code as a literal.

Simulated:

- **Production confirmation.** After the gate returns `auto`, the loop sends 50 requests that replay the
  incident to the candidate stack and counts the incident fingerprint in the app logs. This
  simulates a canary window. It does not prove behaviour in production.
- **The merge.** At grant A3 a person merges. The example treats the pull request in the outbox as merged.
- **The outbox and register.** Tickets, pages and audit entries are JSON-lines files, not a ticketing system.
- **The repair agent.** Fixed patches replace it.

Not demonstrated: the Pattern 1.5 carve-out for network-level fault injection (a proxy in front of a real
dependency). The example has no INC-002 that reproduces a dependency timeout.

`.autonomy.yaml` is schema-valid. Running `autonomy check` on this directory alone still fails with
`profile-missing` and `grant-exceeds-cap`, because the cap check needs a census profile that the example
does not ship.

Out of scope: unattended repair of R3 (data-forward) or R4 (irreversible or external) changes. The
gate sends every such change to a person, and the example never grants A4.

## The Loop

1. **Detect.** Parse the incident record (`shared/incidents/INC-001.json`). Reject it if the
   fingerprint does not match, or the request holds an email address or a secret field.
2. **Check the stop switch and the budget.** A stopped loop ends. A fingerprint with a spent attempt
   budget or an active cooldown goes to a person before any work starts.
3. **Reproduce.** Render the reproduction test from the record, freeze its SHA-256 hash, start the base
   commit in Docker, run the test. It must be red. A reproduction that is not red routes to a person
   ("cannot reproduce").
4. **Build the candidate.** Copy the workspace, apply the patch.
5. **Verify.** Start the candidate in Docker. Run the frozen reproduction and the regression suite against it.
   Recompute the reproduction hash from the candidate's workspace. A reproduction that is red for another
   reason than the incident symptom (stack down, compile error) is treated as "not reproduced".
6. **Assemble the evidence bundle** from observations: test results, both hashes, the applied diff, its
   class (R0 to R4 by B0 to B3), the anti-masking scan result, the attempt budget and the grant.
7. **Gate.** Return the most severe decision any check produces (block over human over auto) with the reasons.
8. **Act on the decision.**
    - `auto`: open a pull request with the evidence bundle in the outbox, then run the confirmation rule
      (at least 50 samples, no fingerprint hits). Confirmed repairs are recorded in the breaker.
      A failed confirmation rolls back and pages the owner.
    - `human`: open a ticket. A masking change gets a root-cause ticket.
    - `block`: page the owner.
9. **Watch for recurrence.** `observeRecurrence` (`observe_recurrence` in Python) takes application logs. If the
   incident fingerprint reappears inside 14 days of a confirmed repair, it drops the grant one level.
   Restoring it needs a named person and five clean repairs. Stack test 05 drives it with the logs of a
   regressed build.

## Gate Rules

| Result | Condition |
|--------|-----------|
| `block` | Stop switch engaged. Reproduction hash differs from the frozen hash. The diff touches a protected path: anything under `tests/` (added, changed or deleted), `.autonomy.yaml`, `.github` or `shared/config`. The diff names an unsafe path (absolute, `..`, backslash). The reproduction is not green on the candidate. The regression suite is not green. |
| `human` | Reproduction was not red on base. The anti-masking scan has a hit. The class is above R2/B1. The grant is below A3. The attempt budget is spent or a cooldown is active. |
| `auto` | None of the above. |

Classification is deterministic and fails closed: a file with no path rule, and an empty diff, take the
highest class (R4/B3). The rules are data in `shared/config/reversibility.json`. The policy, budgets and
confirmation rule are in `shared/config/repair-policy.json`.

The anti-masking scan applies the Pattern 1.6 forbidden patterns to production diffs: swallowed
exceptions, new retries, widened timeouts and lowered thresholds. It is a text scan, so it flags
conservatively and misses masks it has no pattern for. It is a heuristic and one input to the gate, not the
only one. Known bypasses, all of which can reach `auto` on the evidence the gate sees:

- An error-handler change in `main.py` or `index.ts` that answers 404 for every error (no `catch` token).
- An `except` block with an unrelated `raise` inside the six-line window, or one that rethrows on a different path.
- `contextlib.suppress(Exception)`, `.then(null, ...)`, `|| default` and `?? default`.
- Editing the body of a `catch` line that is only context in the diff (only added lines are scanned).
- Retries spelled `attempt` or `while`, and timeout or threshold changes made through expressions,
  multi-line settings or renamed keys.

The confirmation window and the regression suite are the second line of defence for these.

## Layout

```text
examples/repair-loop/
  README.md
  .autonomy.yaml             Register entry for the repair workflow at grant A3
  shared/
    incidents/INC-001.json   Incident record (fingerprint, journey, PII-free request, observed, expected)
    config/                  reversibility.json and repair-policy.json
  typescript/                Node 21+, Jest
  python/                    Python 3.12+, uv, pytest
```

Each language directory has the same structure:

```text
app/                  The minimal app (PostgreSQL and Redis) with the seeded defect
patches/              INC-001.fix, .mask, .test-edit and .partial
src/                  incident, reproduce, classify, antimask, gate, breaker, loop, runtime
tests/unit/           Module tests (mocks allowed)
tests/eval/           Gate eval: 34 scenarios, exact scoring, pass^5
tests/stack/          01 startup, 02 repair, 03 masking rejected, 04 test edit blocked, 05 breaker trips, 06 confirmation rollback
tests/regression/     Regression suite that the loop runs, from the base workspace, against every candidate
docker-compose.yml    Stack template; ports bind to 127.0.0.1
```

Patches differ per language because the app does. The incident record and the configuration are shared.

## The Seeded Defect

INC-001: `GET /users/undefined` returns 500 because `users.id` is a UUID column and PostgreSQL rejects the
malformed value. The expected answer is 404 with `{"error": "User not found"}`. The app logs one
structured line per unhandled error, which gives the incident its fingerprint:
`sha256("GET /users/:id|500|pg:22P02")`, first 12 hex characters.

## How to Run

Requirements: Docker with Compose, Node 21 or later, Python 3.12 or later with
[uv](https://docs.astral.sh/uv/), and GNU or BSD `patch` on the path.

TypeScript, from `examples/repair-loop/typescript/`:

```bash
npm ci
npm test                  # unit, eval and stack tests
npm run test:unit         # no Docker
npm run test:eval         # no Docker
npm run test:stack        # Docker; about 5 minutes
```

Python, from `examples/repair-loop/python/`:

```bash
uv sync --frozen
uv run pytest             # unit, eval and stack tests
uv run pytest tests/unit tests/eval   # no Docker
uv run pytest tests/stack             # Docker; about 5 minutes
```

Every stack run uses a unique compose project name (`repair-<pid>-<random>`), free ports on
127.0.0.1 and no fixed container names. The runtime tears each stack down with
`down -v --remove-orphans --rmi local`, which removes only that project's containers, volumes,
network and built image. Workspaces are created under `.workspaces/` and removed after each test file.

## Pattern References

- [Pattern 1.1](../../docs/L1-patterns/1.1-stack-tests.md): stack tests and the health endpoint modes
- [Pattern 1.6](../../docs/L1-patterns/1.6-test-integrity.md): the forbidden patterns, applied to tests and, by the scan, to production diffs
- [Pattern 1.5](../../docs/L1-patterns/1.5-no-mock-philosophy.md): real dependencies in stack tests; mocks only in unit tests
