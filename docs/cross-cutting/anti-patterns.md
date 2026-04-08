# Pattern Diagnostic Catalog

Recognize when a pattern is missing by the symptoms it leaves behind. Each entry describes a symptom, explains why it surfaces, and points to the pattern that resolves it.

Use this catalog when agents encounter friction. Match the symptom, apply the pattern.

---

## L0 Patterns in Practice

### Focused Modules

**Symptom**: A single source file has grown past 2000 lines, exports 20+ symbols, or mixes multiple concerns (parsing, validation, persistence, API logic together).

**Why This Happens**: Without an explicit boundary, files accumulate responsibility. Each addition is small; the aggregate is a file no agent can hold in context. Edits become unreliable because changing one concern risks the others, and the coupling is invisible until something breaks.

**Pattern**: Apply [Pattern 0.1 - Deep Modules](../L0-foundation.md#pattern-01--deep-modules):

- Export 3-5 functions maximum per module
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

**Symptom**: CLAUDE.md has grown past 500 lines, contains detailed tutorials and inline examples, or reads like a documentation site rather than a contract.

**Why This Happens**: Every important insight feels like it belongs in the file agents read first. But each line of constitution displaces context the agent needs for its actual task. Critical rules get buried in prose. The agent spends tokens reading the map instead of navigating the territory.

**Pattern**: Apply [Pattern 0.4 - CLAUDE.md as Project Constitution](../L0-foundation.md#pattern-04--claude-md-as-project-constitution):

- Hard limit: **150 lines maximum**
- Link to external docs for detailed explanations
- Keep CLAUDE.md focused on: what is this, structure, constitutional rules, doc links
- Move tutorials, examples, and extended guides to dedicated docs

Example refactor:

```
Before: CLAUDE.md (500 lines)
|- 50 lines: project description
|- 200 lines: detailed pattern explanations
|- 100 lines: inline examples
|- 50 lines: constitutional rules
+- 100 lines: setup instructions

After: CLAUDE.md (140 lines)
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

**Symptom**: Documentation files exist that are unreachable from CLAUDE.md. README files sit in subdirectories with no links to them. Multiple documentation files cover overlapping content.

**Why This Happens**: Documentation grows organically - someone writes a useful doc and commits it, but never links it from the master index. Over time, docs duplicate each other as different authors explain the same thing. Agents can only discover what's linked; everything else is invisible.

**Pattern**: Apply [Pattern 0.4 - CLAUDE.md as Project Constitution](../L0-foundation.md#pattern-04--claude-md-as-project-constitution):

- CLAUDE.md is the master index - every doc must be reachable from it
- Use `@filename.md` syntax to link docs
- Run link validation to find orphans
- Consolidate overlapping docs into single sources

Example audit:

```bash
# Find all markdown files
find docs -name "*.md"

# Verify each is reachable from CLAUDE.md
grep -r "filename.md" docs/CLAUDE.md

# If not found, either:
# - Add link to CLAUDE.md
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
- Unique container names with test name + PID + random

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

**Symptom**: Rules written in CLAUDE.md have no enforcement mechanism. Guidelines are phrased as "should" rather than "must." Agents forget or ignore the rules when context shifts or prompts get complex.

**Why This Happens**: Writing a rule feels like enforcing it. But prose rules are unreliable - agents drop them between phases of work, especially under complex prompts. Without tool-layer enforcement, rules are suggestions that erode under pressure.

**Pattern**: Apply [Pattern 2.1 - Skill Overlay Architecture](../L2-behavioral-guardrails.md#pattern-21--skill-overlay-architecture):

- Encapsulate rules in skills
- Skills enforce rules automatically when activated
- Hooks block violations at tool layer
- Constitutional rules are hardcoded, not soft suggestions

Example refactor:

```
Before: Rule in CLAUDE.md
"Never mock database drivers in tests"
(No enforcement - agent may mock anyway)

After: Skill with hook activation
tdd+ skill:
  - Reads CLAUDE.md constitutional rules
  - Rejects mock generation for protected components
  - Hook: blocks Edit tool if mock code detected
```

---

### Complete the Skill Chain

**Symptom**: Work jumps straight from planning to implementation without test-driven development. Changes ship without verification. Review happens after the fact, if at all.

**Why This Happens**: Skipping steps feels faster. But each link in the skill chain enforces a guardrail - skip TDD and code ships without tests; skip verification and claims go unverified; skip review and constitutional rules go unchecked.

**Pattern**: Apply [Pattern 2.2 - The Skill Chain](../L2-behavioral-guardrails.md#pattern-22--the-skill-chain):

- Complete chain: brain+ -> plan+ -> tdd+ -> verify+ -> review+
- Each skill validates input and produces structured output for next
- Every link catches what the previous link cannot

Example workflow:

```
brain+ -> plan+ -> tdd+ -> verify+ -> review+
- brain+: Design with stack testing considerations
- plan+: Create plan with test coverage matrix
- tdd+: RED-GREEN-REFACTOR with full-loop assertions
- verify+: Show command output before claiming done
- review+: Checklist-based compliance check
```

---

### Hooks That Block, Not Just Log

**Symptom**: Hook scripts warn but allow the operation to proceed. Warnings accumulate in output that agents learn to ignore. Rules that were important enough to hook are bypassed routinely.

**Why This Happens**: Advisory hooks feel safer - "we'll log it and let them decide." But agents treat warnings as noise. If a rule is important enough to hook, it's important enough to enforce. An advisory hook is a rule that's been written down and then abandoned.

**Pattern**: Apply [Pattern 2.3 - Hook Automation](../L2-behavioral-guardrails.md#pattern-23--hook-automation):

- Hooks should either allow, advise with clear action, or block
- Critical rules must block, not warn
- Clear narrow purposes with documented behavior

Example refactor:

```typescript
// Advisory: Warning only (agent ignores it)
hook.on('PreToolUse', (tool, args) => {
  if (tool === 'Bash' && args.command.includes('sed -i')) {
    console.warn('Prefer Edit tool over sed -i');
    return; // operation proceeds anyway
  }
});

// Enforcement: Block with explanation
hook.on('PreToolUse', (tool, args) => {
  if (tool === 'Bash' && args.command.includes('sed -i')) {
    throw new Error(
      'Use Edit tool instead of sed -i. ' +
      'sed -i is destructive and bypasses undo history.'
    );
  }
});
```

---

## L3 Patterns in Practice

### Use Structured Search When Available

**Symptom**: Raw grep/rg is used for code search when the repository is indexed. Megabytes of unstructured text output where structured search would return 5 typed results.

**Why This Happens**: grep is familiar and always available. Reaching for it is muscle memory. But when the repository is indexed by a tool like jcodemunch, raw grep costs 80% more tokens for the same information - and misses symbols that match text patterns inexactly.

**Pattern**: Apply [Pattern 3.1 - Smart Routing](../L3-optimization.md#pattern-31--smart-routing--tool-selection):

- Route to structured search when available
- Use `search_symbols` for typed results
- Use `search_text` for content search
- Raw grep only when repository is not indexed

Example refactor:

```bash
# Raw grep (200 lines of unstructured text)
grep -r "export.*function" src/

# Structured search (5 typed symbols with file locations and summaries)
search_symbols(query="function", kind="function")
```

---

### Read Only What You Need

**Symptom**: Agent reads a 300-line file when only 10 lines are needed. Entire configs are loaded to check one value. No scoping happens before reading.

**Why This Happens**: Reading the whole file feels thorough. But context window space is finite - every irrelevant line displaces something useful. With large codebases, this scales into a real constraint on what the agent can reason about simultaneously.

**Pattern**: Apply [Pattern 3.2 - Intent Classification](../L3-optimization.md#pattern-32--intent-classification):

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

**Pattern**: Apply [Pattern 3.3 - Environment-Aware Routing](../L3-optimization.md#pattern-33--environment-aware-routing):

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

This catalog is organized by pyramid level for quick diagnosis:

1. **Identify the symptom** - what friction is the agent encountering?
2. **Match to an entry** - which description fits your situation?
3. **Apply the pattern** - follow the linked pattern documentation
4. **Verify the fix** - the symptom should resolve once the pattern is in place

Each entry in this catalog is the observable absence of a pattern. When you see the symptom, the pattern is missing. Implementing the pattern resolves the symptom.
