---
last-validated-model: claude-opus-5-5
reviewed: 2026-11-19
---

# L0: Foundation — Project Structure for AI Accessibility

L0 makes a project navigable by an agent that has never seen it: small interfaces, docs it can find from one entry
file, tests that state each module's contract, and a habit of deleting what no longer helps. Read it when an agent
gets lost, edits the wrong module or follows stale instructions.

**Structure includes the boundary.** Where the agent runs, what it can write and which credentials it can reach are
set-up decisions, cheapest on day one. Make them on day one: Claude Code starts in auto mode with the sandbox off ([Pattern 2.9 — Contain Before You
Relax](L2-behavioral-guardrails.md#pattern-29--contain-before-you-relax)).

## Pattern 0.1 — Deep Modules

**Problem**: A module that exports 20 or more functions leaks types across its boundary, and the agent must track
every interconnection at once. Each export is a coupling point, and the agent spends context on details that should
be hidden.

**Solution**: A deep module has a small interface with a large implementation behind it (John Ousterhout, [*A
Philosophy of Software Design*](https://web.stanford.edu/~ouster/cgi-bin/book.php)). The agent sees the seam, a small set of exports, and can treat the interior as
delegatable. Matt Pocock's [graybox module](https://youtu.be/uC44zFz7JSM) adds the test discipline: tests lock down behavior, the interface is
controlled, and the interior can be handed to an agent.

**In Practice**:

- Keep the public interface small. As a heuristic, 3-5 exports per module; more is a prompt to check whether the
  module has more than one job.
- Put complex logic behind a simple facade, and keep types focused.
- Let tests specify behavior, not implementation.

```typescript
// Deep module — ecommerce/fulfillment/index.ts
export async function fulfillOrder(config: FulfillmentConfig, items: OrderItem[]): Promise<FulfillmentResult>
export async function getFulfillmentStatus(orderId: string): Promise<FulfillmentStatus>
export function getSupportedRegions(): readonly RegionId[]
```

The shallow version of the same file also exports `validateConfig`, `serializeOrder`, `calculateShipping` and 15
other internals, and every caller, human or agent, can couple to them.

**Anti-Pattern**: A "utils" file that exports 20 or more helpers. If you cannot describe what a module does in one
sentence, it is too shallow.

**Cross-References**: [Pattern 0.8](#pattern-08--aggressive-cleanup) keeps modules deep by removing what they no
longer need.

**Evidence:** Thin — the 3-5 export limit is a rule of thumb; Ousterhout gives no number (this project's own experience, n=1)

---

## Pattern 0.2 — Progressive Disclosure

**Problem**: A flat directory of 50 files, or filename prefixes standing in for directories (`fulfillment_fedex.ts`,
`catalog_shopify.ts`), forces the agent to read everything to learn how files relate. Grouping by technical layer
(`services/`, `handlers/`, `utils/`, `types/`) scatters one domain across the tree, so paths stop being navigation
hints.

**Solution**: Make the directory structure mirror the domain, so the agent discovers complexity one step at a time:
README, then AGENTS.md, then module interfaces, then implementation. Each step gives enough context to decide whether
to go deeper. Group code by what it does, not by which language construct it is.

**In Practice**:

- Put entry points at the root: `README.md`, `AGENTS.md`.
- Group files by domain (`ecommerce/fulfillment/`, not `services/fulfillment/`), and keep a domain's types inside it.
- Give each cross-cutting concern one directory at the root. Keep depth to 3-4 levels.

```text
Before — technical layering          After — grouped by domain
src/                                 project/
├── services/                        ├── README.md        # entry point
│   ├── checkout.ts                  ├── AGENTS.md        # agent contract
│   └── fulfillment.ts               ├── ecommerce/
├── handlers/                        │   ├── index.ts     # public interface
│   └── orderHandler.ts              │   ├── checkout.ts
├── utils/                           │   └── types.ts
│   └── shipping.ts                  ├── fulfillment/
└── types/                           │   ├── index.ts
    └── checkout.ts                  │   └── shipping.ts
                                     └── monitoring/      # cross-cutting
```

**Anti-Pattern**: "Treasure hunt" structures where understanding one file requires reading 10 others scattered across
the tree. A `shared/` or `common/` directory that collects unrelated code: if two domains share code, check whether
they are separated correctly.

**Cross-References**: [Pattern 0.1](#pattern-01--deep-modules) gives each domain directory a small interface.
[Pattern 0.7](#pattern-07--documentation-as-system-map) maps the same structure in docs. [Pattern
0.9](#pattern-09--ai-as-new-starter-standard) tests whether disclosure works for a reader with no context.

**Evidence:** Partial — vendor guidance on loading context just in time, no measured comparison (SC-1, AN-2)

---

## Pattern 0.4 — Agent Instruction File as Project Constitution

**Problem**: An agent needs to know what the project is, how it is structured, what it must never do and which
patterns it must follow. Scattered across READMEs, CONTRIBUTING files and wikis, these rules are found after the agent
has broken them.

**Solution**: One instruction file is the single source of truth: a contract, not a tutorial. Use AGENTS.md as the
shared file, which several coding agents read. Claude Code reads AGENTS.md only when the repository has no CLAUDE.md,
`.claude/CLAUDE.md` or `CLAUDE.local.md`; any of them suppresses AGENTS.md, so a CLAUDE.md beside AGENTS.md imports it
with a one-line `@AGENTS.md` ([SC-8](references/sources.md), [Claude Code
memory](https://code.claude.com/docs/en/memory#agents-md)). Keep the file short, owned, tested and re-baselined:

- **Short**: link to docs for anything long. CI warns above 200 lines, the vendor's target for a CLAUDE.md file
  ([SC-8](references/sources.md)); instruction-following accuracy falls as instructions grow
  ([SC-6](references/sources.md)). Rules for one part of the tree can move to path-scoped rules (`.claude/rules/`
  files with `paths:`), which Claude Code loads only when the agent works with matching files ([Claude Code
  memory](https://code.claude.com/docs/en/memory#path-specific-rules)).
- **Owned**: a named person owns the file and records a reviewed date in it.
- **Tested**: CI checks the file's length, its links and the reachability of every doc.
- **Re-baselined**: at each model upgrade, delete the rules that no longer change behavior ([Pattern
  0.10](#pattern-010--prune-and-re-baseline-context)).

**In Practice**:

```markdown
# Project — Agent Contract (AGENTS.md)

One sentence on what this project does, then a tree of the major directories.

## Constitutional Rules (Never Violate)
1. Real dependencies in stack tests (enforced by: required CI stack-test job)
2. Zero-defect tolerance (enforced by: lint and test jobs fail on any warning)

## High-Tier Paths
- `migrations/`, `.github/workflows/` (enforced by: CODEOWNERS and two required approvals)

## Index
- [docs/L0-foundation.md](docs/L0-foundation.md) — Project structure
```

Every doc is reachable from AGENTS.md by following relative links, so it is the master index. Each rule names its
enforcement point; a rule held only by prose is guidance ([Pattern
2.4](L2-behavioral-guardrails.md#pattern-24--constitutional-rules)). The high-tier list names your own paths and
commands that the [risk model](L1-patterns/1.8-reversibility-blast-radius.md#risk-model) puts in the high tier, each
with its enforcement point. Claude Code expands `@path` imports into context
when the importing file loads ([imports](https://code.claude.com/docs/en/memory#import-additional-files)), so imports do not reduce context cost: use plain links for the index, and `@` only for
content that must load in every session, such as `@AGENTS.md` in CLAUDE.md.

**Anti-Pattern**: Tutorials in the instruction file; every line displaces context the task needs. A file with no
owner and no review date, whose rules nobody has re-tested since the last model upgrade.

**Cross-References**: [Pattern 0.9](#pattern-09--ai-as-new-starter-standard) tests whether the file succeeds.
[Pattern 0.7](#pattern-07--documentation-as-system-map) keeps the index in sync with the docs.

**Evidence:** Partial — instruction-file studies disagree on value; the 200-line warning follows vendor guidance (SC-4, SC-5, SC-6, SC-8, SC-11)

---

## Pattern 0.5 — Unit Tests as Contract

**Problem**: Documentation describes intent and drifts from what the code does. An agent cannot tell which one is
wrong; it needs a specification that is checked on every run.

**Solution**: Treat unit tests as the executable specification of each module: what it does, which edge cases it
handles and how it fails. A test passes or fails, so its assertions state current behavior, and docs are checked
against them ([Pattern 0.7](#pattern-07--documentation-as-system-map)). Direct the agent toward diagnostic tests
(boundary conditions, error paths, module seams), not line coverage with trivial assertions.

**In Practice**: in a refactoring session, the agent reads the current tests to learn the contract; you review the
test plan together in plan mode ([permission modes](https://code.claude.com/docs/en/permission-modes)) and close
coverage gaps; the agent refactors against passing tests; then it adds tests for the behavior it changed. When
debugging, have the agent reduce the failure to a small isolated test, fix the code, and keep the test if it guards
behavior worth keeping. Mocks belong in unit tests; stack tests use real dependencies. The test levels are
compared in [Pattern 1.1](L1-patterns/1.1-stack-tests.md#comparison-test-types), and what to mock is in [Pattern
1.5](L1-patterns/1.5-real-dependencies.md).

**Anti-Pattern**: Documentation as the primary contract. Treating unit test failures as less important than stack test
results. Tests written for coverage numbers.

**Cross-References**: [Pattern 2.5](L2-behavioral-guardrails.md#pattern-25--zero-defect-tolerance) treats every test
failure as a defect, unit or stack.

**Evidence:** Partial — one vendor's guidance to give agents a verifiable check; no outcome study (OM-7)

---

## Pattern 0.6 — Git Worktree-Based Development

**Problem**: Several agents on one checkout overwrite each other's edits; switching branches leaves artifacts.

**Solution**: Give each task its own git worktree: a separate checkout on its own branch that shares the object
store. Claude Code creates one per session with `claude --worktree <name>` ([Claude Code common
workflows](https://code.claude.com/docs/en/common-workflows#run-parallel-sessions-with-worktrees)); other agents use
`git worktree add .worktrees/<branch> -b <branch>` and `git worktree remove` when the branch merges.

A worktree separates files, not privileges. An agent in a worktree still has the user's shell, keys and network.
Containment is a separate decision ([Pattern 2.9](L2-behavioral-guardrails.md#pattern-29--contain-before-you-relax)).

**Anti-Pattern**: Feature work directly on main. An agent modifies main only on explicit instruction.

**Cross-References**: [Pattern 2.3](L2-behavioral-guardrails.md#pattern-23--hook-automation) hooks can block edits
outside a worktree. [Further Reading](references/further-reading.md) lists skill packs that automate worktree setup;
read one before installing it ([Pattern 2.12](L2-behavioral-guardrails.md#pattern-212--skill-plugin-and-mcp-supply-chain)).

**Evidence:** Partial — vendor guidance runs parallel sessions in separate worktrees, and Claude Code creates them natively; no measured comparison (OM-7)

---

## Pattern 0.7 — Documentation as System Map

**Problem**: Documentation, tests and code drift apart. A pattern is renamed in code but not in the docs, or a doc
describes behavior that changed months ago. Agents follow stale docs with full confidence and build the wrong thing.

**Solution**: Treat documentation as the map of structure, intent and conventions, one scale above the file tree
([Pattern 0.2](#pattern-02--progressive-disclosure)):

- **Same commit**: a code change and its doc update land together.
- **Reachable**: every doc is reachable from AGENTS.md by following links
  ([Pattern 0.4](#pattern-04--agent-instruction-file-as-project-constitution)). An unlinked doc is invisible to agents.
- **Current**: code in docs matches the code in the repository.
- **Deleted, not archived**: version control is the archive. Delete docs for deleted features.

**In Practice**: run drift checks as commands in CI. This repository's jobs (links, source IDs, reachability,
instruction-file length, writing conventions, freshness) are listed in [Pattern 4.5 — CI
Guardrails](L4-standards-measurement.md#pattern-45--ci-guardrails); run `python3 scripts/check-doc-links.py .`
before committing. Three checks have no script and belong in review: code examples match the current code, named file
paths exist, and behavior descriptions match what the tests assert ([Pattern 0.5](#pattern-05--unit-tests-as-contract)).
When a check finds drift, decide which side is wrong, fix it in the same commit, and re-run the check.

**Anti-Pattern**: Deferring doc updates to a later change. Keeping docs for deleted features "for reference". Manual
review for drift that a script can find.

**Cross-References**: [Pattern 0.9](#pattern-09--ai-as-new-starter-standard) tests whether the map works for a reader
with no context.

**Evidence:** Thin — the same-commit and reachability rules are reasoned. This repository's `Doc Reachability from AGENTS.md` job fails on an unreachable doc (advisory until the check is required on `main`), and review holds the same-commit rule. No study measures their effect on agents (this project's own experience, n=1)

---

## Pattern 0.8 — Aggressive Cleanup

**Problem**: Dead code, unused imports, stale comments and deprecated files accumulate. An agent reads unused code and
cannot tell it is unused, so it takes context the task needs ([SC-1](references/sources.md) on context as a finite
resource) and invites edits to code nothing calls.

**Solution**: Clean up as part of each task, not in a later sprint:

- **Unused imports and dead code**: delete functions, classes and debug output that nothing calls.
- **Stale comments**: delete comments that repeat the code or describe old behavior.
- **Deprecated code**: delete it once nothing calls it; do not keep it marked as deprecated.
- **TODO comments**: do the work in this change or delete the comment; do not commit a TODO.

**In Practice**: remove dead code you notice near the task in the same commit, run the tests, and name the cleanup in
the commit message ("Fix auth bug and remove unused `old_auth_method`"). Before deleting a function, search the
codebase to confirm only its definition remains. Linters find candidates: `ruff check --select F401` (unused Python
imports), `vulture` (dead Python code).

**Anti-Pattern**: Keeping code in case someone needs it. Commented-out code. Refusing to delete because "someone might
be using this" without searching. Removing a few imports and leaving large dead paths.

**Cross-References**: [Pattern 0.7](#pattern-07--documentation-as-system-map) covers stale docs. [Pattern
4.1](L4-standards-measurement.md#pattern-41--evidence-based-claims) sets the standard for showing a cleanup broke
nothing.

**Evidence:** Thin — reasoned from context as a finite resource (SC-1); this project's own experience, n=1

---

## Pattern 0.9 — AI-as-New-Starter Standard

**Problem**: Projects accumulate implicit knowledge: "we always put types in `src/types/`", "utils live in
`shared/`". Each unwritten assumption is a point where an agent goes wrong.

**Solution**: If someone with no context cannot understand the project from AGENTS.md, README and the file structure
alone, the project is not agent-ready. Give a person or an agent only those three entry points and ask:

1. What does this project do?
2. How do I run it locally?
3. Where do I add a new feature?
4. What patterns should I follow?
5. How do I test my changes?
6. What must I never do?

Each assumption the reader has to make is a gap. Fix the entry point, not the reader. Apply the same rule to every
doc section: no undefined terms, no assumed prior knowledge, no "we" implying team membership, no examples that depend
on unstated setup.

**In Practice**: audit quarterly and after any change that moves or renames a top-level directory:

- [ ] README explains the project in under 30 seconds.
- [ ] The quick start runs without reading beyond the README.
- [ ] AGENTS.md is a map with stated rules, not a wall of links.
- [ ] Examples in docs run as written.
- [ ] Directory names communicate intent ([Pattern 0.2](#pattern-02--progressive-disclosure)).
- [ ] Work sample: an engineer who did not review a module an agent changed recently can explain it and find the
  cause of a failing test without the agent ([Pattern
  4.9](L4-standards-measurement.md#pattern-49--deliberate-practice)).

**Anti-Pattern**: "They should read the code." Code shows what exists, not why. Insider references ("the thing from
the meeting"). Quick starts that fail because a step is missing.

**Cross-References**: [Pattern 0.4](#pattern-04--agent-instruction-file-as-project-constitution) specifies the
AGENTS.md format.

**Evidence:** Thin — a reasoned audit test with no study (this project's own experience, n=1)

---

## Pattern 0.10 — Prune and Re-baseline Context

**Problem**: Instruction files, skills, hooks and routing rules accumulate and are rarely removed. Each rule
compensated for a weakness of the model of its day; when the model improves, the rule is noise or pushes the agent
away from what the newer model does well. In one study of 441 repositories, 73.8% of committed AI configuration
artifacts were never changed after they were added (MC-11, a preprint its authors call hypothesis-generating).
Anthropic reports removing over 80% of Claude Code's system prompt for a new model generation with no measurable loss
on its coding evaluations, which are not published (AN-7).

**Solution**: Give every context artifact an owner and a review date, and test each one by removing it. A **context
artifact** is any file or setting that adds instructions to an agent session: the instruction file, a skill, a hook,
a deny rule, a routing note, a memory file.

1. **Owner and `reviewed:` date, with an optional expiry.** Put them in the artifact's front matter. A hook or
   setting has none, so record them in the pinned allowlist of [Pattern
   2.12](L2-behavioral-guardrails.md#pattern-212--skill-plugin-and-mcp-supply-chain); agent workflows have theirs in
   the register ([Pattern A.1](earned-autonomy.md#pattern-a1--autonomy-register)). An expired artifact is retired or
   re-reviewed.
2. **A fixed task bank, run against a pinned model.** [Pattern
   4.6](L4-standards-measurement.md#pattern-46--context-eval) defines the bank, its scoring and its runner; this
   repository's bank is [the task bank](references/task-bank.md). Pin the model id so a difference between two runs
   comes from the artifact, not the model.
3. **Delete first at each model upgrade, and at least quarterly.** Run the bank without the artifact. If every task
   passes, delete it. If a task regresses, restore it and record the justifying task next to it.
4. **Classify each rule as guidance or invariant.** Guidance is prose and is prunable by step 3. An invariant must
   hold regardless of the model, so it lives in a command hook, a deny rule, a sandbox setting or a required CI
   check, never in prose only ([Pattern 2.4](L2-behavioral-guardrails.md#pattern-24--constitutional-rules)).
   Re-baselining removes prose duplicates of invariants; it does not remove the hook, rule or check.
5. **Measure maintained configuration**: when each file last changed, how often each skill was invoked, and how many
   rules have a justifying task. Fail CI on an artifact past its `reviewed:` limit or its `expires:` date.

**In Practice**:

```yaml
---
owner: platform-team
reviewed: 2026-11-19
expires: 2027-02-17      # optional
justified-by: T-07       # the task-bank task that fails without this artifact
---
```

In a skill file, put these keys under `metadata:`: Claude Code ignores unknown top-level keys, but packaging or
uploading a skill outside Claude Code fails on any top-level key the Agent Skills spec does not allow ([Claude Code
skills](https://code.claude.com/docs/en/skills)).

This repository checks pattern docs with [scripts/check-doc-freshness.py](../scripts/check-doc-freshness.py): each
carries `reviewed:` and `last-validated-model:` (the model the doc was last read against), and the script warns at
90 days and fails at 180 days, on a missing key, or once an `expires:` date has passed. The rule is in
[AGENTS.md](../AGENTS.md#writing-rules-for-this-repository).

The steps of a run and this repository's run log are in [the task
bank](references/task-bank.md#procedure-for-a-run). Claude Code's `/doctor prompt-audit` reports instructions written
for older models, references to missing files and contradictions between instruction files ([Claude Code
memory](https://code.claude.com/docs/en/memory)); use it to choose candidates, and let the bank decide.

If removing a prose rule regresses nothing because a hook already blocks the violation, delete the prose. If it
regresses nothing because no task exercises the rule, add the task before deleting.

**Anti-Pattern**: "We added it, so it must help": skills, hooks and rules only ever added, and no one can say which
task each fixed. Each addition answered a real failure, so removal feels like reintroducing it; give each artifact a
justifying task and keep it only if that task regresses. A line limit used as a proxy for signal: the instruction file
passes the length check and still holds stale rules, or a useful rule is cut to fit; test the content with step 3
instead of trimming to a number. A bank written from the artifacts it tests, so it passes with or without them; draw
tasks from real work and incidents. Re-running only the tasks the artifact was written for; a removal can regress an
unrelated task. Deleting an invariant because the model behaves without it; the hook or CI check holds the rule for the
day it does not.

**Cross-References**: [Pattern 0.4](#pattern-04--agent-instruction-file-as-project-constitution) sets the instruction
file's owner and review date. [Pattern 0.8](#pattern-08--aggressive-cleanup) is the same discipline for code.

**Evidence:** Partial — most committed AI config is never changed; a vendor cut over 80% of a prompt (MC-11, AN-7); task banks as the test (MV-9)

---

## Further Reading

- John Ousterhout, [*A Philosophy of Software Design*](https://web.stanford.edu/~ouster/cgi-bin/book.php) — deep modules
- Matt Pocock, ["Your codebase is NOT ready for AI"](https://youtu.be/uC44zFz7JSM) — graybox modules, progressive disclosure
- [Further Reading](references/further-reading.md)

---

**Next:** [L1: Closed Loop Design and Verification](L1-feedback-loops.md) | [Back to Overview](../README.md)
