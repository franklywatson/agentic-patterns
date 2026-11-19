# Pattern Diagnostic Catalog

Recognize when a pattern is missing by the symptoms it leaves behind. Each entry describes a symptom, explains why it surfaces, and points to the pattern that resolves it.

Use this catalog when agents encounter friction. Match the symptom, apply the pattern.

---

## L0 Patterns in Practice

### Focused Modules

**Symptom**: A single source file has grown past 2000 lines, exports 20+ symbols, or mixes multiple concerns (parsing, validation, persistence, API logic together).

**Why This Happens**: Without an explicit boundary, files accumulate responsibility. Each addition is small; the aggregate is a file no agent can hold in context. Edits become unreliable because changing one concern risks the others, and the coupling is invisible until something breaks.

**Pattern**: Apply [Pattern 0.1 - Deep Modules](../L0-foundation.md#pattern-01--deep-modules):

- Keep the public interface small (heuristic: 3-5 exports per module)
- Put complex logic behind a simple facade
- Split by domain concern
- Let tests specify behavior, not implementation

Example refactor:

```
Before: ecommerce/order-service.ts (2000 lines, 25 exports)
After:  ecommerce/orders/index.ts (3 exports)
        ecommerce/orders/validate.ts (internal)
        ecommerce/orders/monitor.ts (internal)
```

---

### Domain-Grouped Directories

**Symptom**: A directory contains 50+ files with no subdirectories. Related concepts are scattered. File names use long prefixes to fake organization (`ecommerce_auth_xxx.ts`, `ecommerce_db_xxx.ts`).

**Why This Happens**: Flat structures emerge when files are added one at a time without pausing to group them. Once the directory is large enough, nobody wants to reorganize it. Meanwhile, agents lose the navigation hints that paths provide - they must read every file to understand relationships.

**Pattern**: Apply [Pattern 0.2 - Progressive Disclosure](../L0-foundation.md#pattern-02--progressive-disclosure):

- Group related files into domain directories
- Keep depth to 3-4 levels maximum
- Each directory should have a clear single purpose
- Use file paths as navigation hints

Example refactor:

```
Before: src/ (50 files)
|- ecommerce_auth.ts
|- ecommerce_db.ts
|- ecommerce_orders.ts
|- auth_handlers.ts
|- auth_middleware.ts
... (45 more files)

After: src/
|- ecommerce/
|   |- index.ts
|   |- auth.ts
|   +- orders.ts
+- auth/
    |- index.ts
    |- handlers.ts
    +- middleware.ts
```

---

### Concise Project Constitution

**Symptom**: The agent instruction file has grown past 500 lines, contains detailed tutorials and inline examples, or reads like a documentation site rather than a contract. It has no owner or reviewed date, and no one has re-tested its rules since the last model upgrade.

**Why This Happens**: Every important insight feels like it belongs in the file agents read first. But each line of constitution displaces context the agent needs for its actual task. Critical rules get buried in prose. The agent spends tokens reading the map instead of navigating the territory.

**Pattern**: Apply [Pattern 0.4 - Agent instruction file as project constitution](../L0-foundation.md#pattern-04--agent-instruction-file-as-project-constitution):

- Keep the file short; CI warns at about 200 lines
- Name an owner, record a reviewed date, and re-test the rules at each model upgrade
- Link to external docs for detailed explanations
- Keep the file focused on: what is this, structure, constitutional rules, doc links
- Move tutorials, examples, and extended guides to dedicated docs

Example refactor:

```
Before: AGENTS.md (500 lines)
|- 50 lines: project description
|- 200 lines: detailed pattern explanations
|- 100 lines: inline examples
|- 50 lines: constitutional rules
+- 100 lines: setup instructions

After: AGENTS.md (140 lines)
|- 10 lines: project description
|- 30 lines: structure overview
|- 20 lines: constitutional rules
|- 50 lines: links to detailed docs
+- 30 lines: quick reference

Plus: docs/patterns/*.md (moved from inline)
     docs/examples/*.md (moved from inline)
```

---

### Linked Documentation

**Symptom**: Documentation files exist that are unreachable from AGENTS.md. README files sit in subdirectories with no links to them. Multiple documentation files cover overlapping content.

**Why This Happens**: Documentation grows organically - someone writes a useful doc and commits it, but never links it from the master index. Over time, docs duplicate each other as different authors explain the same thing. Agents can only discover what's linked; everything else is invisible.

**Pattern**: Apply [Pattern 0.4 - Agent instruction file as project constitution](../L0-foundation.md#pattern-04--agent-instruction-file-as-project-constitution):

- AGENTS.md is the master index (CLAUDE.md imports it) - every doc must be reachable from it
- Use plain relative markdown links (`[title](path.md)`), not `@` imports, which load the linked doc into every session
- Run link validation to find orphans
- Consolidate overlapping docs into single sources

Example audit:

```bash
# Find all markdown files
find docs -name "*.md"

# Verify each is reachable from AGENTS.md
grep -F "filename.md" AGENTS.md

# If not found, either:
# - Add link to AGENTS.md
# - Delete the orphan file
# - Merge into existing doc
```

---

### Worktree-Based Development

**Symptom**: Feature development happens directly on the main branch. Switching branches leaves artifacts. Experiments risk the main branch. Context carries over between sessions, creating hidden state.

**Why This Happens**: Working on main is the path of least resistance when you start. But it means broken work affects everyone, experiments have no clean rollback, and parallel agents collide on the same working directory.

**Pattern**: Apply [Pattern 0.6 - Git Worktree-Based Development](../L0-foundation.md#pattern-06--git-worktree-based-development):

- Use git worktrees as default working model
- Each task or feature branch gets its own working directory
- Convention: `.worktrees/<branch-name>/` directory

Example workflow:

```bash
# Create worktree for feature
git worktree add .worktrees/feature-x feature-x

# Work in isolation
cd .worktrees/feature-x
# ... make changes, commit, test ...

# Remove when done
git worktree remove .worktrees/feature-x
```

---

## L1 Patterns in Practice

### Complete Stack Tests

**Symptom**: Tests start 3 of 5 services, mock some components but run others real, and are too slow for unit speed but too incomplete for deployment confidence.

**Why This Happens**: Partial-stack tests feel like a reasonable compromise - faster than full stack, more realistic than mocks. In practice they deliver the worst of both: slow tests that still miss integration failures. Mock mismatches create false signals the agent cannot diagnose.

**Pattern**: Apply [Pattern 1.1 - Stack Tests](../L1-patterns/1.1-stack-tests.md):

- Test at unit level (fast, isolated), use focused integration tests for external dependency edge cases, or test at the stack level (complete, real)
- Stack tests run the complete Docker stack
- The third option — focused integration tests — provides exhaustive edge-case coverage of a single external dependency's real API without running the full system. See [Pattern 1.5 - Focused Integration Tests](../L1-patterns/1.5-no-mock-philosophy.md#focused-integration-tests-for-external-dependencies).

Example refactor:

```
Before: Integration test (3 services, 2 mocked)
|- App container (real)
|- Database (real)
|- Redis (mocked)
|- External API (mocked)
+- Message queue (not started)

After 1: Unit test (milliseconds)
+- Test order processing logic in isolation, no containers

After 2: Focused integration test (seconds, narrow scope)
+- Test Stripe adapter against real testnet
+- Exhaustive edge cases: declined cards, rate limits, idempotency

After 3: Stack test (seconds, complete confidence)
|- App container (real)
|- Database (real)
|- Redis (real)
|- External API (real or testnet)
+- Message queue (real)
```

---

### Real Dependencies in E2E/Integration and Stack Tests

**Symptom**: Stack tests or E2E tests have more mock setup code than test code. Tests pass but production fails because mocks behave differently. Mocks return perfect data, never timeout, never throw unexpected errors.

**Why This Happens**: Mocks start as a convenience - faster setup, deterministic results. But mocks drift from reality as real services evolve. The test suite gains false confidence: green tests, broken system. Real edge cases (timeouts, unexpected error formats, connection drops) never appear.

**Pattern**: Apply [Pattern 1.5 - Real Dependencies in E2E/Integration and Stack Tests](../L1-patterns/1.5-no-mock-philosophy.md):

- If you own it, run it - real PostgreSQL, real Redis, real services in stack tests
- Only mock external services you genuinely cannot run (and no testnet exists) in stack tests
- Use Docker for owned services - free, fast, realistic
- For complex external dependencies, use focused integration tests against real testnet/sandbox — see [Focused Integration Tests](../L1-patterns/1.5-no-mock-philosophy.md#focused-integration-tests-for-external-dependencies)
- Mocks are appropriate in unit tests — this pattern applies to stack and E2E tests only

Example refactor:

```typescript
// Before: Mocked database
const mockDb = {
  getUser: (id) => ({ id, name: 'Test User' }),
  saveUser: (user) => Promise.resolve()
};
// Test passes, but real DB has schema issues

// After: Real database in Docker
const db = new PostgreSQL(process.env.TEST_DB_URL);
await db.migrate();
// Test fails when schema is wrong - real feedback
```

---

### Unconditional Assertions

**Symptom**: Assertions are wrapped in if statements. Tests skip validation when data is missing. Optional chaining appears on expect statements. Early returns exit before assertions run.

**Why This Happens**: Conditional assertions often start as a workaround for flaky data - "sometimes the response is undefined, so guard against it." But a test that silently passes when it should fail is worse than no test. The agent trusts the green suite and ships broken code.

**Pattern**: Apply [Pattern 1.6 - Test Integrity Rules](../L1-patterns/1.6-test-integrity.md):

- Every assertion must run unconditionally
- Tests must either pass or fail explicitly
- Fail fast on first error

Example refactor:

```typescript
// Conditional assertion - silently passes when response is undefined
if (response) {
  expect(response.status).toBe(200);
}

// Unconditional assertion - always runs, always provides signal
expect(response).toBeDefined();
expect(response.status).toBe(200);
```

---

### Dynamic Port Allocation

**Symptom**: `docker-compose.yml` uses hardcoded ports (3000:3000, 5432:5432, 6379:6379). Tests collide when run in parallel. "Port already in use" errors appear in CI.

**Why This Happens**: Hardcoded ports work fine when only one test runs at a time. But the moment tests run concurrently - or a developer already has PostgreSQL running locally - collisions surface as flaky failures that waste diagnostic time.

**Pattern**: Apply [Pattern 1.4 - Container Isolation](../L1-patterns/1.4-container-isolation.md):

- Dynamic port allocation from range (10000-65535)
- Verify ports are available before assigning
- Unique compose project name (`docker compose -p`) with test name + PID + random

Example refactor:

```typescript
// Before: Hardcoded ports
services:
  app:
    ports:
      - "3000:3000"
  postgres:
    ports:
      - "5432:5432"

// After: Dynamic ports
const ports = await allocatePorts({ app: 1, postgres: 1 });
services:
  app:
    ports:
      - "${ports.app}:3000"
  postgres:
    ports:
      - "${ports.postgres}:5432"
```

---

### Individual Tests During Development, Full Suite Before Completion

**Symptom**: The team only runs the full stack test suite, never individual tests. Iteration during feature development is slow because every change triggers a 10-minute suite.

**Why This Happens**: Running individual tests feels incomplete - "what if it passes alone but fails in the suite?" This caution becomes counterproductive. Stack tests are vertical slices (like agile user stories) - running a single slice is the natural unit of development feedback.

**Pattern**: Apply [Pattern 1.3 - Sequential/Additive Test Design](../L1-patterns/1.3-sequential-design.md):

- Run individual stack tests during active feature development for fast iteration
- Run the full suite before marking work complete or merging
- A test that passes in isolation but fails in the suite reveals a dependency bug - valuable signal, not a reason to avoid individual runs

Example workflow:

```bash
# During development: run the relevant slice
npm test -- ecommerce-basic.stack.test.ts

# Before completion: run the full suite
npm test -- tests/stack/

# If 04-ecommerce-basic fails in the full suite:
# - Agent knows: 01, 02, 03 passed (startup, auth, CRUD work)
# - Agent focuses: Ecommerce logic specifically
# - Agent skips: 05, 06, 07 (they'd fail anyway)
```

---

## L2 Patterns in Practice

### Enforce Rules Through Skills and Hooks

**Symptom**: Rules written in AGENTS.md have no enforcement mechanism. Guidelines are phrased as "should" rather than "must." Agents forget or ignore the rules when context shifts or prompts get complex. Or the opposite: a safety rule ("never touch production") is held only by a hook.

**Why This Happens**: Writing a rule feels like enforcing it. Prose rules are guidance; agents drop them between phases of work, especially under complex prompts. A hook is stronger, but it runs inside the agent's environment: it gates tool calls, not what a permitted tool does once running, and the agent can often edit project hook files. Rules are only as strong as the layer that holds them.

**Pattern**: Apply [Pattern 2.4 - Constitutional Rules](../L2-behavioral-guardrails.md#pattern-24--constitutional-rules) and [Pattern 2.1 - Skill Overlay Architecture](../L2-behavioral-guardrails.md#pattern-21--skill-overlay-architecture):

- Name each rule's enforcement point: prompt, hook, CI, sandbox or downstream
- What must never happen goes to the sandbox, credential scope or downstream authorisation
- What must always happen goes to a hook plus a required CI check
- Prompts and skills carry everything else

Example refactor:

```
Before: Rule in AGENTS.md
"Never mock database drivers in stack tests"
(Enforcement point: prompt only. The agent may mock anyway.)

After: Rule with named enforcement points
Prompt: tdd+ skill states the rule
Hook: PreToolUse blocks an Edit that adds a mock import to a stack-test file
CI: required check searches stack-test directories for mock libraries
```

---

### Scale the Skill Chain to Risk

**Symptom**: Every change, including a typo fix, runs through five phases. Agents and reviewers skip phases in bulk. Or the opposite: changes ship without verification evidence or review because they "looked small".

**Why This Happens**: A chain that applies uniformly is simple to state. Applied to every change, it adds ceremony to small changes, and people learn to bypass it. Visiting a phase also does not show that the phase did its job.

**Pattern**: Apply [Pattern 2.2 - The Skill Chain](../L2-behavioral-guardrails.md#pattern-22--the-skill-chain) as an optional pipeline:

- Scale ceremony to risk: reversibility and blast radius set how many phases a change needs
- Verification (evidence before claims) and review stay outcome gates for every change
- Hold those gates in CI and the merge process, not in whether the agent visited a phase
- Use [phase tracking](../L2-behavioral-guardrails.md#pattern-27--phase-transition-validation) only where an audit trail of phases is wanted, with strictness set per risk tier

Example workflow:

```
Typo fix:           edit -> CI checks -> review
Small code change:  tdd+ -> verify+ -> review
Feature:            brain+ -> plan+ -> tdd+ -> verify+ -> review+
Irreversible:       full chain + approver who is not the requester
```

---

### Match the Hook to the Job

**Symptom**: Hook scripts warn but allow the operation to proceed, and agents learn to ignore the warnings. Or a PostToolUse check is described as "blocking" a violation that has already happened. Or a hook is the only control for something that must never happen.

**Why This Happens**: One mechanism gets used for three jobs: nudging (advise is fine), enforcing a workflow rule (needs a block or a required CI check), and preventing harm (needs a sandbox or downstream authorisation, with a hook as defence in depth). Advisory hooks on rules that must hold are rules written down and abandoned. A PostToolUse hook runs after the tool call, so it is detective: it reports and records, and cannot prevent the call.

**Pattern**: Apply [Pattern 2.3 - Hook Automation](../L2-behavioral-guardrails.md#pattern-23--hook-automation) and [Pattern 2.6 - Enforcement Pipeline Composition](../L2-behavioral-guardrails.md#pattern-26--enforcement-pipeline-composition):

- Use advise for ergonomic nudges
- Use PreToolUse blocks on structured arguments (a file path in an Edit call) for workflow rules
- Use a required CI check for invariants on every change
- Use the sandbox, credential scope and downstream authorisation for what must never happen
- Do not rely on PostToolUse to prevent anything

Example refactor:

```bash
# Advisory only for a rule that must hold: the agent ignores the message.
echo "Prefer the Edit tool for protected files" >&2
exit 0

# PreToolUse block on a structured argument (Edit tool, file_path).
case "$path" in
  .github/workflows/*) echo "Blocked: protected path" >&2; exit 2 ;;
esac
```

---

### Hooks as a Security Boundary

**Symptom**: The only control on credential access, destructive commands or network use is a hook or a deny
rule that matches command strings. The team believes the rule holds.

**Why This Happens**: A hook is easy to write and visible in review, so it feels like a wall. It runs inside
the agent's environment and matches text. `/usr/bin/sed -i`, `perl -pi`, `bash -c` and `$(...)` all pass a
rule written for `sed -i`. The agent can often edit project hook files.

**Pattern**: Apply [Pattern 2.9 - Contain Before You
Relax](../L2-behavioral-guardrails.md#pattern-29--contain-before-you-relax):

- Put what must never happen in a sandbox or container, with credentials outside it
- Keep hooks as ergonomic nudges and workflow checks
- Test the boundary with a command that must fail

The [containment example](../../examples/containment/) runs the bypass commands through a policy function and
a container, and shows which one stops them.

---

### Approval as a Safety Valve

**Symptom**: Every command asks for confirmation. People approve in a rhythm without reading. The team treats
the prompt as the safety control.

**Why This Happens**: A prompt looks like oversight. Frequent prompts for low-risk actions train people to
approve all of them, and then the one risky prompt gets approved too.

**Pattern**: Apply [Pattern 2.13 - Risk-Tiered Review](../L2-behavioral-guardrails.md#pattern-213--risk-tiered-review):

- Tier actions by reversibility and blast radius
- Reserve human approval for a short named list of irreversible or external actions
- Run everything else inside a boundary with automated checks
- Measure how often each prompt is approved, and remove prompts that are always approved

---

### Unvetted Skill Install

**Symptom**: Skills, plugins and MCP servers are installed from a README one-liner. Nobody has read them. They
follow a moving branch and update without review.

**Why This Happens**: Installing a skill feels like adding a prompt, not a dependency. A skill steers the
model, a plugin can add hooks, and an MCP server is code on the machine. One scan found a critical issue in
13.4% of 3,984 public skills ([SG-28](../references/sources.md)).

**Pattern**: Apply [Pattern 2.12 - Skill, Plugin and MCP Supply
Chain](../L2-behavioral-guardrails.md#pattern-212--skill-plugin-and-mcp-supply-chain):

- Keep an allowlist enforced where the agent cannot edit it
- Pin a version or commit, and read the instructions and code before install
- Review each update as a diff
- Record an owner for each item

---

### Self-Promoting Autonomy Tiers

**Symptom**: An agent, or the workflow around it, raises its own permissions after a run of successes: more
tools, fewer approvals, wider access. No person decided.

**Why This Happens**: Automatic promotion looks like earned trust (the autonomy grants A1 to A5 are defined in
[the README](../../README.md#how-far-a-team-can-let-go)). But the success count comes from the same system
that gets the new permission, and a streak of easy tasks says nothing about a hard one.

**Pattern**: Apply [Pattern 2.13 - Risk-Tiered
Review](../L2-behavioral-guardrails.md#pattern-213--risk-tiered-review) and [Pattern 4.7 - Author of Record
and Agent Register](../L4-standards-measurement.md#pattern-47--author-of-record-and-agent-register):

- A person grants each permission increase, and the register records it
- The requester or the agent cannot approve its own promotion
- Judge promotion on evidence from systems the agent cannot edit ([Pattern
  4.8](../L4-standards-measurement.md#pattern-48--evidence-over-self-report))

---

### Orphaned Agent

**Symptom**: An agent, scheduled workflow, skill or hook set keeps running after its creator has left the
team. Nobody knows what it may do, whether it is needed or how to stop it. Its credentials are still valid.

**Why This Happens**: Setting up an agent is a task. Owning it is not, so no one is assigned. Access has no
expiry, and nothing prompts a review.

**Pattern**: Apply [Pattern 4.7 - Author of Record and Agent
Register](../L4-standards-measurement.md#pattern-47--author-of-record-and-agent-register):

- List every agent and agent-facing artefact with an owner, a sponsor, an access expiry and a review date
- Suspend, then remove, any item whose owner has left or whose review has lapsed
- Give credentials an expiry ([Pattern 2.11](../L2-behavioral-guardrails.md#pattern-211--agent-identity-and-delegation))

---

## L3 Patterns in Practice

### Use Structured Search When Available

**Symptom**: Raw grep/rg is used for code search when the repository is indexed. Megabytes of unstructured text output where structured search would return a short list of typed results.

**Why This Happens**: grep is familiar and always available. Reaching for it is muscle memory. But when the repository is indexed by a tool like jcodemunch, raw grep returns more tokens for the same information - and misses symbols that match text patterns inexactly.

**Pattern**: Apply [Pattern 3.1 - Prefer Native Structured Tools](../L3-optimization.md#pattern-31--prefer-native-structured-tools-block-destructive-edits):

- Route to structured search when available
- Use `search_symbols` for typed results
- Use `search_text` for content search
- Raw grep only when repository is not indexed

Example refactor:

```bash
# Raw grep (illustrative: hundreds of lines of unstructured text)
grep -r "export.*function" src/

# Structured search (illustrative: a few typed symbols with file locations and summaries)
search_symbols(query="function", kind="function")
```

---

### Read Only What You Need

**Symptom**: Agent reads a 300-line file when only 10 lines are needed. Entire configs are loaded to check one value. No scoping happens before reading.

**Why This Happens**: Reading the whole file feels thorough. But context window space is finite - every irrelevant line displaces something useful. With large codebases, this scales into a real constraint on what the agent can reason about simultaneously.

**Pattern**: Apply [Pattern 3.1 - Prefer Native Structured Tools](../L3-optimization.md#pattern-31--prefer-native-structured-tools-block-destructive-edits):

- Use targeted reads with line ranges
- Use `get_symbol` to extract specific functions
- Use `get_file_outline` to see structure before reading
- Scope exploration before diving in

Example refactor:

```bash
# Read entire file (300 lines, most irrelevant)
Read src/ecommerce/orders/execute.ts

# Read specific function (20 lines, exactly what's needed)
get_symbol(symbol_id="src/ecommerce/orders/execute.ts:processOrder")

# Or: Get outline first, then choose what to read
get_file_outline(file_path="src/ecommerce/orders/execute.ts")
```

---

### Detect Available Tools at Session Start

**Symptom**: Same command routing regardless of what tools are installed. RTK is available but unused. Repository is indexed by jcodemunch but agents still grep.

**Why This Happens**: Without environment detection, the agent defaults to the lowest common denominator. It has no way to know that better tools are available unless someone tells it - and that knowledge does not persist between sessions.

**Pattern**: Apply [Pattern 3.3 - Environment-Aware Routing and Session Lifecycle](../L3-optimization.md#pattern-33--environment-aware-routing-and-session-lifecycle):

- Detect available tools before routing
- Use RTK when installed for git operations
- Use jcodemunch when repository is indexed
- Degrade gracefully when specialized tools are missing

Example refactor:

```typescript
// Default routing (misses optimization opportunities)
function searchCode(query: string) {
  return bash(`grep -r "${query}" src/`);
}

// Environment-aware routing
async function searchCode(query: string) {
  if (await isRepoIndexed()) {
    return jcodemunch.search_text({ query });
  }
  return bash(`grep -r "${query}" src/`);
}
```

---

## L4 Patterns in Practice

### Update Docs With Code

**Symptom**: Code changes ship without corresponding doc updates. Documentation updates are filed as separate tickets. Examples in docs no longer match current code.

**Why This Happens**: "I'll update the docs later" is the most natural deferral in software development. The feature is done, the tests pass, the PR is ready - docs feel like a follow-up task. But "later" rarely arrives, and each deferred update compounds into spec drift that misleads every agent and new contributor who reads the stale docs.

**Pattern**: Apply [Pattern 0.7 - Documentation as System Map](../L0-foundation.md#pattern-07--documentation-as-system-map):

- Code changes and doc updates happen in the SAME task
- Every behavior change requires immediate doc update
- Link validation catches orphans

Example workflow:

```
Task: Refactor authentication flow

1. Read current auth docs
2. Implement new auth logic
3. Update auth docs with new flow
4. Verify examples match current code
5. Commit: Code + docs together
```

---

### Fix Every Error Before Proceeding

**Symptom**: "This warning is pre-existing." "This failure is unrelated to my work." "We can ignore that error." Errors are classified as relevant or irrelevant without investigation.

**Why This Happens**: Under time pressure, it's tempting to triage errors by apparent relevance. But agents process feedback systematically - they cannot distinguish between tolerated errors and real regressions. A tolerated defect today becomes an undiagnosed regression tomorrow, compounding until the feedback loop breaks entirely.

**Pattern**: Apply [Pattern 2.5 - Zero-Defect Tolerance](../L2-behavioral-guardrails.md#pattern-25--zero-defect-tolerance):

- Every error, warning, and failure must be addressed
- "Pre-existing" means fix it now
- Establish a clean baseline before starting work

Example workflow:

```bash
# Agent encounters a failure
npm test
# 2 passing, 1 failing

# Fix all issues first
# Agent fixes the failure, re-runs tests
npm test
# 3 passing

# Now the agent can proceed with confidence -
# any new failure is a real signal from the current work
```

---

### Delete Dead Code Immediately

**Symptom**: Commented-out code blocks, unused functions kept "just in case," feature flags that are never enabled, deprecated code paths never removed.

**Why This Happens**: Keeping code around feels safer than deleting it - "we might need it." But dead code is noise that consumes context window, confuses agents about what's actually in use, and creates maintenance burden on code that never runs. Git history is the archive; the working tree should contain only what's alive.

**Pattern**: Apply [Pattern 0.8 - Aggressive Cleanup](../L0-foundation.md#pattern-08--aggressive-cleanup):

- Delete dead code immediately
- Git history is your reference if you need it later
- Remove commented-out code, unused imports, stale variables and functions

Example refactor:

```typescript
// Before: Dead code retained
// TODO: Re-enable this feature later
// function deprecatedFeature() {
//   ... 50 lines ...
// }

function currentFeature() {
  // ... actual code ...
}

// After: Clean working tree
function currentFeature() {
  // ... actual code ...
}
// If you need deprecatedFeature later, check git history
```

---

## Using This Catalog

This catalog is organized by layer for quick diagnosis:

1. **Identify the symptom** - what friction is the agent encountering?
2. **Match to an entry** - which description fits your situation?
3. **Apply the pattern** - follow the linked pattern documentation
4. **Verify the fix** - the symptom should resolve once the pattern is in place

Each entry in this catalog is the observable absence of a pattern. When you see the symptom, the pattern is missing. Implementing the pattern resolves the symptom.
