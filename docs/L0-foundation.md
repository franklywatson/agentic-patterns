---
last-validated-model: claude-opus-5-5
reviewed: 2026-11-19
---

# L0: Foundation — Project Structure for AI Accessibility

Your codebase is the biggest influence on AI's output. Structure it so an AI with zero prior context can navigate, understand, and contribute effectively.

**Structure includes the boundary.** Where the agent runs, what it can write and which credentials it can reach are
decisions about how the project is set up, and they are cheapest on day one. Decide them before you loosen any
approvals: see [Pattern 2.9 — Contain Before You
Relax](L2-behavioral-guardrails.md#pattern-29--contain-before-you-relax).

## Pattern 0.1 — Deep Modules

**Problem**: Shallow modules expose too much surface area. When a module exports 20+ functions, types leak across boundaries, and the AI must track many interconnections simultaneously. Each export creates a potential coupling point. The agent wastes context understanding implementation details that should be hidden.

**Solution**: A deep module has a simple interface with lots of implementation hidden behind it. The AI sees the seam — a clean, small set of exports — and delegates implementation details to the interior. Based on John Ousterhout's "A Philosophy of Software Design" and Matt Pocock's graybox module concept: modules where tests lock down behavior, the public interface is carefully controlled, and the interior is delegatable to AI.

**In Practice**:

- Keep the public interface small. As a heuristic, 3-5 exports per module; more is a prompt to check whether the module has more than one job
- Put complex logic behind a simple facade
- Let tests specify behavior, not implementation
- Keep types focused — avoid "kitchen sink" interfaces

```typescript
// Deep module — clean interface, complexity hidden
// ecommerce/fulfillment/index.ts
export interface FulfillmentConfig {
  sourceWarehouse: WarehouseId;
  targetRegion: RegionId;
  confirmations: number;
}

export async function fulfillOrder(config: FulfillmentConfig, items: OrderItem[]): Promise<FulfillmentResult>
export async function getFulfillmentStatus(orderId: string): Promise<FulfillmentStatus>
export function getSupportedRegions(): readonly RegionId[]
```

```typescript
// Shallow module — leaking internals, 20+ exports
// ecommerce/fulfillment/index.ts
export function fulfillOrder(...) { }
export function getFulfillmentStatus(...) { }
export function getSupportedRegions() { }
export function validateConfig(...) { }           // internal
export function parseWarehouseId(...) { }              // internal
export function serializeOrder(...) { }               // internal
export function deserializeOrder(...) { }              // internal
export function calculateShipping(...) { }               // internal
export function estimateTax(...) { }                // internal
export function formatAddress(...) { }              // internal
export function parseAddress(...) { }               // internal
// ... 10 more internal utilities
```

**Anti-Pattern**: Creating "utils" files that export 20+ helper functions. If you can't describe what a module does in one sentence, it's too shallow.

**Cross-References**: See [L2: Skills Framework](L2-behavioral-guardrails.md) for how skills enforce deep module boundaries during implementation. [Pattern 0.8 — Aggressive Cleanup](#pattern-08--aggressive-cleanup) covers maintaining depth through continuous cleanup.

**Evidence:** Thin — the 3-5 export limit is a rule of thumb; Ousterhout gives no number (first-party, n=1)

---

## Pattern 0.2 — Progressive Disclosure

**Problem**: A flat directory with 50 files forces the AI to read everything to understand relationships. Deep nesting hides important files behind many clicks. Both extremes waste context — the agent can't discover structure incrementally.

**Solution**: Directory structure mirrors mental models. AI discovers complexity gradually: README → AGENTS.md → module interfaces → implementation. Each layer gives enough context to decide whether to go deeper.

**In Practice**:

- Put entry points at the root: `README.md`, `AGENTS.md`
- Group related files into directories by domain
- Keep depth to 3-4 levels maximum
- Each directory should have a clear purpose

```
Good — progressive disclosure
project/
├── README.md                    # Overview, entry point
├── AGENTS.md                    # Agent contract
├── CLAUDE.md                    # Imports AGENTS.md
├── ecommerce/                   # Domain module
│   ├── index.ts                 # Public interface
│   ├── fulfillment/             # Sub-domain
│   │   ├── index.ts
│   │   └── shipping.ts
│   └── catalog/                 # Sub-domain
│       └── index.ts
└── testing/                     # Cross-cutting concern
    └── stack-test.ts
```

```
Bad — flat 50-file directory
project/
├── README.md
├── fulfillment_shipstation.ts
├── fulfillment_fedex.ts
├── catalog_shopify.ts
├── catalog_woocommerce.ts
├── catalog_bigcommerce.ts
├── ecommerce_inventory.ts
├── ecommerce_tax.ts
├── ecommerce_pricing.ts
├── ecommerce_checkout.ts
├── ecommerce_monitoring.ts
├── ecommerce_recovery.ts
... (40 more files)
```

**Anti-Pattern**: "Treasure hunt" structures where understanding one file requires reading 10 others scattered across the tree.

**Cross-References**: [Pattern 0.3](#pattern-03--conceptual-file-organization) expands on grouping by domain. [Pattern 0.9](#pattern-09--ai-as-new-starter-standard) tests whether disclosure works for zero-context agents.

**Evidence:** Partial — vendor guidance on loading context just in time, no measured comparison (SC-1, AN-2)

---

## Pattern 0.3 — Conceptual File Organization

**Problem**: Grouping by technical layer (`services/`, `handlers/`, `utils/`, `types/`) separates related concepts. The AI can't find all ecommerce code in one place — it's scattered across directories. File paths become meaningless navigation hints.

**Solution**: Group by domain or capability. AI uses file paths as navigation hints. Co-locate related code by what it does, not what language construct it uses.

**In Practice**:

- `ecommerce/fulfillment/` not `services/fulfillment/`
- `ecommerce/types.ts` inside the domain, not a global `types/` dir
- One domain per directory, cross-cutting concerns at root level

```
Before — technical layering
src/
├── services/
│   ├── checkout.ts
│   ├── fulfillment.ts
│   └── monitoring.ts
├── handlers/
│   ├── orderHandler.ts
│   └── fulfillmentHandler.ts
├── utils/
│   ├── tax.ts
│   └── shipping.ts
└── types/
    ├── checkout.ts
    └── fulfillment.ts
```

```
After — conceptual organization
src/
├── ecommerce/
│   ├── index.ts                 # Public interface
│   ├── checkout.ts              # Implementation
│   ├── monitor.ts               # Monitoring logic
│   ├── types.ts                 # Domain types
│   └── utils/                   # Ecommerce-specific utilities
│       ├── tax.ts
│       └── shipping.ts
├── fulfillment/
│   ├── index.ts
│   ├── shipstation.ts
│   └── types.ts
└── monitoring/                  # Cross-cutting
    └── index.ts
```

**Anti-Pattern**: Creating `shared/` or `common/` directories that become dumping grounds for unrelated code. If code is shared between two domains, question whether those domains are properly separated.

**Cross-References**: [Pattern 0.1](#pattern-01--deep-modules) shows how deep modules reinforce conceptual organization. [Pattern 0.7](#pattern-07--documentation-as-system-map) — file structure is the physical map; documentation is the conceptual map. [L1: Stack Tests](L1-feedback-loops.md) demonstrates testing at domain boundaries.

**Evidence:** Thin — reasoned from how agents use paths; no study (first-party, n=1)

---

## Pattern 0.4 — Agent instruction file as project constitution

**Problem**: An agent entering a project needs to know: what is this, how is it structured, what must I never do, what patterns must I follow. Scattering this across READMEs, CONTRIBUTING files, and wiki pages forces the agent to hunt for rules it may violate before finding them.

**Solution**: One agent instruction file is the single source of truth: a contract, not a tutorial. It answers the essential questions in one place. Use AGENTS.md as the shared file, which several coding agents read, and have CLAUDE.md import it. Claude Code reads CLAUDE.md, not AGENTS.md, unless CLAUDE.md imports AGENTS.md or settings say otherwise ([SC-8](references/sources.md)).

Keep the file short, owned, tested and re-baselined:

- **Short**: link to docs for anything long. CI warns at about 200 lines. Length costs context on every session, and instruction-following accuracy falls as the number of instructions grows ([SC-6](references/sources.md)).
- **Owned**: a named person owns the file and records a reviewed date in it.
- **Tested**: CI checks the file (line count, links, reachability of every doc).
- **Re-baselined**: at each model upgrade, test whether each rule still changes behaviour, and delete the rules that
  no longer do ([Pattern 0.10](#pattern-010--prune-and-re-baseline-context)).

**In Practice**:

```markdown
# Project — Agent Contract (AGENTS.md)

## Project Description
One-sentence summary of what this project does.

## Repository Structure
Tree diagram showing major directories and their purposes.

## Constitutional Rules (Never Violate)
1. Real dependencies in E2E/integration and stack tests
2. Evidence-based claims only
3. Zero-defect tolerance

## Layer Documentation
- [docs/L0-foundation.md](docs/L0-foundation.md)
- [docs/L1-feedback-loops.md](docs/L1-feedback-loops.md)
```

Every doc must be reachable from AGENTS.md, which serves as the master index. An agent discovers any project document by starting here and following the relative markdown links.

Claude Code expands `@path` imports into context when CLAUDE.md loads, so an index of `@` imports loads every listed doc into every session. Use plain markdown links for an index, and `@` only for content that must always load. The one-line `@AGENTS.md` import in CLAUDE.md is the intended use:

```markdown
# Claude Code

@AGENTS.md
```

**Anti-Pattern**: Writing tutorials or extensive guides in the instruction file. Every line displaces context the agent needs for the actual task. A file with no owner and no review date, whose rules nobody has re-tested since the last model upgrade, accumulates rules that no longer help.

**Cross-References**: [Pattern 0.9](#pattern-09--ai-as-new-starter-standard) tests whether the instruction file
succeeds. [Pattern 0.10](#pattern-010--prune-and-re-baseline-context) removes rules the current model no longer needs.
[Pattern 0.7 — Documentation as System Map](#pattern-07--documentation-as-system-map) covers keeping the system map in
sync with code.

**Evidence:** Partial — instruction-file studies disagree on value; the 200-line warning is a house rule (SC-4, SC-5, SC-8, SC-11)

---

## Pattern 0.5 — Unit Tests as Contract

**Problem**: Documentation describes intent. Unit tests define contract. Documentation can drift from reality — it describes what the code *should* do, not what it *actually* does. Unit tests are the executable specification that never lies: they either pass or fail, and their assertions are the ground truth of system behavior.

In agentic development, unit tests become even more important. Agents lack the intuition to interpolate between what docs say and what code does. They need a reliable specification layer — and unit tests are that layer. Documentation maps the system ([Pattern 0.7](#pattern-07--documentation-as-system-map)); unit tests are the contract it must satisfy.

**Solution**: Treat unit tests as the contract for your codebase — the executable specification that defines what each module does, what edge cases it handles, and what happens when things go wrong. What changes with agentic engineering is not the role of unit tests but the expectations you can place on them.

**What agentic engineering enables in unit testing:**

**Exhaustive coverage** — Agents generate test cases at a pace humans can't match. Counsel the agent to focus on high-value tests (boundary conditions, error paths, integration seams) rather than achieving 100% line coverage with trivial assertions. Coverage without diagnosticity is waste.

**Rapid mock scaffolding** — The tedious, time-consuming work of mocking complex dependencies for unit tests is fast and mechanical for an agent. When a module requires twelve mock objects with specific return values, the agent assembles them in seconds. This shifts the bottleneck from "setting up the test" to "deciding what the test should verify."

**Architectural direction** — Unit tests provide a mechanism for directing refactoring from an architectural standpoint. When restructuring a module, write the test plan first, have the agent review it with you for critical changes, refine the approach using plan mode, then execute. Tests become the contract that the refactoring must satisfy.

**Peer and temporary tests** — Agents can quickly create new tests to validate different approaches during exploration. When debugging a complex failure, the agent can boil down the focus into a concise, isolated test case that captures the essence of the problem — then reflect the fix back into the more complex code context. These temporary tests validate hypotheses before committing to changes.

**Documentation fidelity** — Unit tests ensure that documentation refreshes capture critical nuances. When analyzing code for documentation updates, test assertions reveal behavior that might otherwise be missed — edge cases, error handling paths, and implicit contracts that are exercised by tests but not documented. The contract (tests) keeps the map (docs) honest.

**In Practice**:

```
During a refactoring session:

1. Agent reads current tests → understands existing contract
2. You review test plan together in plan mode → refine coverage gaps
3. Agent executes refactoring against passing tests → contract preserved
4. Agent adds new tests for changed behavior → contract extended
5. Tests document what the code actually does → docs stay accurate
```

**Unit tests and stack tests are complementary, not competing concerns.** Stack tests ([L1](L1-feedback-loops.md#pattern-11--stack-tests)) validate end-to-end user journeys through the full system with real dependencies ([Pattern 1.5](L1-patterns/1.5-no-mock-philosophy.md)). Unit tests validate individual module contracts in isolation, where mocks provide the necessary isolation to test logic without standing up infrastructure. Mocks are appropriate and encouraged in unit tests — they enable fast, focused, diagnostic tests of module behavior. A codebase needs both: stack tests catch integration failures; unit tests catch logic errors within modules. Dismissing a unit test failure while trusting stack test results means relying on partial feedback.

**Anti-Pattern**: Relying on documentation as the primary contract. Documentation drifts. Tests execute. Treating unit tests as subordinate to stack tests — both layers provide distinct, necessary signals. Writing tests for coverage metrics rather than diagnostic value.

**Cross-References**: [L1: Stack Tests](L1-feedback-loops.md#pattern-11--stack-tests) — the system-level complement to unit tests. [Pattern 0.4](#pattern-04--agent-instruction-file-as-project-constitution) — the instruction file as the human-readable contract layer. [L2: Zero-Defect Tolerance](L2-behavioral-guardrails.md#pattern-25--zero-defect-tolerance) — every test failure matters, unit or stack.

**Evidence:** Partial — one vendor's guidance to give agents a verifiable check; no outcome study (OM-7)

---

## Pattern 0.6 — Git Worktree-Based Development

**Problem**: Multiple agents working on the same codebase create conflicts. Switching branches leaves artifacts. Experiments risk the main branch. Context carries over between sessions, creating hidden state.

**Solution**: Use git worktrees as the default working model. Each task or feature branch gets its own working directory — sharing the same git object store but with separate working trees.

**In Practice**:

Worktree management can be manual, but is most effective when automated through agent skills. The
[obra/superpowers](https://github.com/obra/superpowers) framework (a skill pack: read it before you install
it, per [Pattern 2.12](L2-behavioral-guardrails.md#pattern-212--skill-plugin-and-mcp-supply-chain)) provides a
**[using-git-worktrees](https://github.com/obra/superpowers)** skill that automates worktree creation with
smart directory selection and safety verification — agents create isolated worktrees at the start of feature
work without manual `git worktree` commands.

```bash
# Manual equivalent (agents typically use the skill instead)
git worktree add .worktrees/feature-x feature-x
cd .worktrees/feature-x
# ... make changes, commit, test ...
git worktree remove .worktrees/feature-x
```

Benefits:

- **Parallel isolation**: Multiple agents on separate branches without conflict
- **Clean slate**: No leftover artifacts from previous sessions
- **Non-destructive**: Experiment without risking the main branch
- **Deterministic state**: Worktrees created from a known commit

Convention: `.worktrees/<branch-name>/` directory.

A worktree separates files, not privileges. An agent in a worktree still has the user's shell, keys and network.
Containment is a separate decision ([Pattern 2.9](L2-behavioral-guardrails.md#pattern-29--contain-before-you-relax)).

**Anti-Pattern**: Working directly on main for feature work. Agents should never modify main without explicit instruction.

**Cross-References**: [L2: Skills](L2-behavioral-guardrails.md) can enforce worktree usage via hooks. See [Further Reading](references/further-reading.md) for the superpowers framework.

**Evidence:** Partial — isolation by default is vendor and practitioner guidance; native in Claude Code (OM-18, PL-15)

---

## Pattern 0.7 — Documentation as System Map

**Problem**: Documentation, tests and code drift apart. A pattern is renamed in code but not in the docs, a test calls a deleted function, a doc describes behavior that changed months ago. Agents follow stale docs with full confidence, which costs tokens and produces wrong implementations. File structure ([Pattern 0.3](#pattern-03--conceptual-file-organization)) and documentation serve the same purpose at different scales: both help agents navigate. When either drifts, discoverability breaks.

**Solution**: Treat documentation as the system map: the navigational layer for structure, intent and conventions. Update the affected docs in the same task as the code change, and check for drift with commands that run in CI.

- **Synchronous updates**: a code change and its doc update land in the same commit.
- **Reachability**: every doc is reachable from AGENTS.md by following links, directly or through other docs ([Pattern 0.4](#pattern-04--agent-instruction-file-as-project-constitution)). An unlinked doc is invisible to agents.
- **Current examples**: code in docs matches the code in the repository.
- **Deletion over archiving**: version control is the archive. Delete docs for deleted features.

**In Practice**:

This repository runs these checks in `.github/workflows/docs.yml`:

| Check | What it verifies | Result on failure |
|-------|------------------|-------------------|
| `markdown-lint` (`npm run lint:md`) | Markdown style rules | Fails |
| `link-integrity` (`python3 scripts/check-doc-links.py .`) | Every relative link and `#anchor` resolves | Fails |
| `doc-reachability` (`python3 scripts/check-doc-reachability.py .`) | Every file under `docs/` is reachable from AGENTS.md by following links | Warns |
| `source-ids` (`python3 scripts/sourcecheck.py .`) | Every cited source ID has a row in `docs/references/sources.md` | Fails |
| `writing-conventions` | No filler words ("basically", "simply") | Warns |

Run the link check locally before committing:

```bash
python3 scripts/check-doc-links.py .
```

Three drift checks have no script and stay manual. Run them in review:

- Code examples in docs match the current code.
- File paths named in docs exist.
- Behavior descriptions match what the tests assert ([Pattern 0.5](#pattern-05--unit-tests-as-contract)).

When a check or a review finds drift:

1. Decide which side is wrong: the code or the doc.
2. Fix that side in the same commit.
3. Re-run the check.

**Anti-Pattern**: Deferring doc updates to a later change. Tolerating "close enough" drift. Keeping docs for deleted features "for reference". Relying on manual review alone for drift that a script can find.

**Cross-References**: [Pattern 0.3](#pattern-03--conceptual-file-organization) — file structure is the physical map; docs are the conceptual map. [Pattern 0.4](#pattern-04--agent-instruction-file-as-project-constitution) establishes the master index. [Pattern 0.9](#pattern-09--ai-as-new-starter-standard) tests whether the map works for a reader with no context. [Pattern 4.5 — CI Guardrails](L4-standards-measurement.md#pattern-45--ci-guardrails) covers running checks in CI.

**Evidence:** Thin — for agents; committed documentation artefacts are mostly never updated, so presence is not practice (MC-11)

---

## Pattern 0.8 — Aggressive Cleanup

**Problem**: Dead code, unused imports, stale comments, and deprecated files accumulate over time. Every file an agent reads is context that could displace something important. Unused code is not harmless legacy—it's noise that degrades agent performance by consuming context window and creating confusion about what's actually used. Documentation cleanup is a separate concern covered by [Pattern 0.7](#pattern-07--documentation-as-system-map).

**Solution**: **Treat cleanup as a continuous practice, not a quarterly sprint.** When you find dead code during a task, remove it as part of that task. Every task should leave the codebase cleaner than it found it.

**Cleanup scope:**

- **Unused imports:** Remove imports that aren't referenced
- **Dead code:** Remove functions, classes, and methods that aren't called
- **Stale comments:** Remove comments that duplicate the code or are outdated
- **Deprecated files:** Remove files marked as deprecated or unused
- **TODO comments:** Either do the task or remove the TODO
- **Debug code:** Remove print statements, debug logging, temporary files

**Detection tools:**

```bash
# Unused imports (Python)
$ ruff check --select F401

# Dead code detection
$ vulture myproject/

# Find stale TODOs
$ grep -r "TODO" --include="*.py" | grep "201[0-9]"  # Old TODOs

# Find deprecated markers
$ grep -r "deprecated" --include="*.py"
```

**In Practice**:

**During any task:**

1. Use the relevant file
2. Notice dead code nearby
3. Remove it as part of the same commit
4. Verify nothing breaks (run tests)
5. Note the cleanup in commit message

**Example:**

```
Task: Fix authentication bug

1. Open auth.py to fix bug
2. Notice unused function: old_auth_method()
3. Search codebase: grep -r "old_auth_method" → only definition found
4. Remove function
5. Run tests: pytest tests/auth/ → pass
6. Commit: "Fix auth bug and remove unused old_auth_method"
```

**Targeted cleanup sessions:**

```bash
# Find and remove unused imports
$ ruff check --select F401 --fix .

# Find large comment blocks
$ find . -name "*.py" -exec wc -l {} \; | sort -n | tail -20
# Review top 20 files for excessive comments

# Find stale files (not modified in 2+ years)
$ find . -name "*.py" -mtime +730 -ls
```

**Commit message pattern:**

```
[Primary task description]

Cleanup:
- Remove unused imports in X files
- Delete dead function: old_auth_method()
- Remove stale TODO comments from 2023
```

**Anti-Pattern**: "Just in case" retention. Commented-out code. Defensive cleanup avoidance ("someone might be using this"). Cleanup theater (removing a few imports but leaving major dead code). Deferred cleanup.

**Cross-References**: [Pattern 0.3](#pattern-03--conceptual-file-organization) — clean file structure and clean code reinforce each other. [Pattern 0.7](#pattern-07--documentation-as-system-map) — documentation cleanup is a separate concern; stale docs are covered there. [Pattern 4.1 — Evidence-Based Claims](L4-standards-measurement.md#pattern-41--evidence-based-claims) establishes the standard for verifying cleanup doesn't break anything.

**Evidence:** Thin — reasoned; the author's practice (first-party, n=1)

---

## Pattern 0.9 — AI-as-New-Starter Standard

**Problem**: Projects accumulate implicit knowledge: "we always put types in `src/types/`", "utils live in `shared/`". Each unwritten assumption is a point where an agent goes wrong, and the gaps grow as the project changes.

**Solution**: If someone with zero context cannot understand the project from AGENTS.md, README and file structure alone, the project is not agent-ready. Test this on a schedule, not once. Give a person or an agent only those three entry points and ask:

1. What does this project do?
2. How do I run it locally?
3. Where do I add a new feature?
4. What patterns should I follow?
5. How do I test my changes?
6. What must I never do?

Each assumption the reader has to make is a gap. Fix the entry point, not the reader.

**In Practice**:

Audit quarterly and after each major structural change:

- [ ] README explains the project in under 30 seconds.
- [ ] The quick start runs without reading beyond the README.
- [ ] AGENTS.md is a map with stated rules, not a wall of links.
- [ ] Examples in docs run as written.
- [ ] Directory names communicate intent ([Pattern 0.2](#pattern-02--progressive-disclosure)).
- [ ] Work sample: an engineer who did not review a module an agent changed recently can explain it and find the
  cause of a failing test without the agent ([Pattern
  4.9](L4-standards-measurement.md#pattern-49--deliberate-practice)).

Apply the zero-context rule to every doc section: no undefined terms, no assumed prior knowledge, no "we" implying existing team membership, no examples that depend on unstated setup.

**Anti-Pattern**: "They should read the code." Code shows what exists, not why. Insider references ("the thing from the meeting"). Quick starts that fail because a step is missing. Explaining how without saying why.

**Cross-References**: [Pattern 0.4](#pattern-04--agent-instruction-file-as-project-constitution) specifies the AGENTS.md format. [Pattern 0.7](#pattern-07--documentation-as-system-map) keeps the entry points current.

**Evidence:** Thin — a reasoned audit test with no study (first-party, n=1)

---

## Pattern 0.10 — Prune and Re-baseline Context

**Problem**: Instruction files, skills, hooks and routing rules accumulate and are rarely removed. Each rule was
written to compensate for a weakness of the model of that day. When the model improves, the rule is noise, or it
pushes the agent away from what the newer model does well. A study of committed AI configuration found that most of
it is never changed after it is added (MC-11), so presence in the repository says nothing about whether a rule is
maintained or still helps. Anthropic reports removing over 80% of a system prompt for a new model generation with no
loss on its evaluations (AN-7).

**Solution**: Treat every context artefact as something with an owner, a review date and an expiry, and test each one
against the current model by removing it.

A **context artefact** is any file or setting that adds instructions to an agent session: the instruction file, a
skill, a hook, a deny rule, a routing note, a memory file. The steps:

1. **Owner, `reviewed:` date and expiry per artefact.** Record them in the artefact's own front matter when it is a
   file (instruction file, skill, doc). A hook or setting has no front matter, so record them in the
   [agent register](L4-standards-measurement.md#pattern-47--author-of-record-and-agent-register). An artefact past its
   expiry is retired or re-reviewed; there is no third state.
2. **A fixed task bank, run against a pinned model.** 10 to 30 tasks that represent the work agents do in the
   project. Each task has a prompt, an expected artefact and a check that does not depend on the agent's own report.
   The bank changes only by recorded additions. The model id is pinned for each run so that a difference between two
   runs comes from the artefact or the model, not from both. This repository's bank is
   [the task bank](references/task-bank.md). Its expected answers and seeds are held outside the agent's workspace by
   `scripts/task-bank/run.py`, so a run cannot pass by reading them.
3. **Delete first at each model upgrade, and at least quarterly.** Run the bank without the artefact. If every task
   passes, delete it. If a task regresses, add the artefact back and record the task that justified it next to the
   artefact. An artefact with no justifying task is guidance nobody can show is needed.
4. **Classify each rule as guidance or invariant.** Guidance is prose that shapes how the agent works and is prunable
   by step 3. An invariant is a rule that must hold regardless of the model: it lives in a hook, a deny rule, a
   sandbox setting or a required CI check, and is never prose only ([Pattern
   2.4](L2-behavioral-guardrails.md#pattern-24--constitutional-rules) names the enforcement point per rule).
   Re-baselining removes prose duplicates of invariants and tests the rest; it does not remove the hook, deny rule or
   CI check.
5. **Measure maintained configuration.** Three numbers per artefact set: when each file last changed, how often each
   skill was invoked in the period, and how many rules have a justifying task. Fail CI on any artefact
   whose `reviewed:` date is past its limit or whose `expires:` date has passed.

**In Practice**:

Front matter for a document or skill file, with the fields this repository checks:

```yaml
---
last-validated-model: claude-opus-5-5
reviewed: 2026-11-19
---
```

For artefacts that carry an owner and expiry, add them to the same block:

```yaml
---
owner: platform-team
reviewed: 2026-11-19
expires: 2027-02-17
justified-by: T-07
---
```

This repository checks every pattern doc with [scripts/check-doc-freshness.py](../scripts/check-doc-freshness.py), as
the CI job `doc-freshness`. It warns when `reviewed:` is 90 days old, and fails at 180 days, on a future or malformed
date, or when a key is missing. If `expires:` is present, it fails once that date has passed. `owner:` is not checked
by script. The pattern docs here carry `reviewed:` and `last-validated-model:` only; the library's owner is named in
AGENTS.md. `last-validated-model:` records the model against which the doc was last read for correctness; the
script requires the key to be present and does not compare its value with the current model.

A re-baseline run, in order:

1. Pin the model id and record it in the run log.
2. Run the whole bank with every artefact present. This is the baseline; a task that fails here is a task or model
   problem, not an artefact problem.
3. For each artefact, remove it, run the bank, and record which tasks pass.
4. Delete every artefact whose removal regressed no task. Keep each artefact whose removal regressed a task, and write
   the task id next to it.
5. Commit the deletions and the log in one change so that `git revert` restores them.

The run log and procedure for this repository are in [the task bank](references/task-bank.md#run-log).

A rule that must always hold is not a candidate for deletion by this procedure. If removing a prose rule regresses
nothing because a hook already blocks the violation, delete the prose. If removing it regresses nothing because the
bank has no task that exercises the rule, add the task before deleting.

**Anti-Pattern**:

- "We added it, so it must help." No artefact is removed because no run shows what it contributes. The
  configuration only grows ([anti-patterns catalog](cross-cutting/anti-patterns.md#we-added-it-so-it-must-help)).
- A line cap used as a proxy for signal. A file under its cap can be all noise, and a file over it can be all
  needed. Length is a warning to look; the test is whether removing a rule changes a task result
  ([anti-patterns catalog](cross-cutting/anti-patterns.md#line-caps-as-a-proxy-for-signal)).
- A bank that was written from the artefacts it tests, so it passes with or without them. Draw tasks from real work and
  incidents.
- Re-running only the tasks the artefact was written for. A removal can regress an unrelated task.
- Deleting an invariant because the model "now behaves". A hook or CI check holds the rule for the day the model does
  not.

**Cross-References**: [Pattern 0.4](#pattern-04--agent-instruction-file-as-project-constitution) sets the instruction
file's owner and review date. [Pattern 0.8](#pattern-08--aggressive-cleanup) is the same discipline for code. [Pattern
2.4](L2-behavioral-guardrails.md#pattern-24--constitutional-rules) places each rule at an enforcement point. [Pattern
4.6](L4-standards-measurement.md#pattern-46--context-eval) supplies the scoring method for a task bank. [Pattern
4.7](L4-standards-measurement.md#pattern-47--author-of-record-and-agent-register) holds owner and expiry for hooks and
settings.

**Evidence:** Partial — most committed AI config is never changed; a vendor cut 80% of a prompt (MC-11, AN-7, MV-9)

---

## Related Patterns

- **L1: Closed Loop Design** — Testing at module boundaries validates deep module design
- **L2: Behavioral Guardrails** — Skills enforce structural conventions during implementation
- **L3: Optimization** — Good structure reduces token overhead for navigation
- **L4: Standards & Measurement** — Evidence-based claims, metrics, CI guardrails, context eval; the task bank scoring
  in Pattern 0.10 uses [Pattern 4.6](L4-standards-measurement.md#pattern-46--context-eval)

## Further Reading

- John Ousterhout, *A Philosophy of Software Design* — Deep modules concept
- Matt Pocock, "Your codebase is NOT ready for AI" — Graybox modules, progressive disclosure
- [Further Reading](references/further-reading.md)

---

**Next:** [L1: Closed Loop Design and Verification](L1-feedback-loops.md) | [Back to Overview](../README.md)
