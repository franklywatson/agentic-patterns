# Anti-Patterns Catalog

Common agentic development mistakes, organized by pyramid level. Each anti-pattern includes: name, what it looks like, why it's harmful, and what to do instead.

Use this catalog as a diagnostic guide when agents encounter problems. If a symptom matches an anti-pattern, apply the recommended fix.

---

## L0 Anti-Patterns

### God Files

**What It Looks Like**
- Single source file with 2000+ lines
- 20+ exports from one module
- Multiple concerns mixed in one file (parsing, validation, persistence, API logic all together)
- File cannot be read in one context window without truncation

**Why It's Harmful**
- Agent can't hold the file in context—edits become unreliable
- Changes to one area inadvertently affect others
- No clear boundary for the agent to reason about
- Refactoring becomes dangerous because coupling is invisible

**What To Do Instead**
Apply [Pattern 0.1 — Deep Modules](../L0-foundation.md#pattern-01--deep-modules):
- Export 3-5 functions maximum per module
- Put complex logic behind a simple facade
- Split god files by domain concern
- Let tests specify behavior, not implementation

Example refactor:
```
Before: ecommerce/order-service.ts (2000 lines, 25 exports)
After:  ecommerce/orders/index.ts (3 exports)
        ecommerce/orders/validate.ts (internal)
        ecommerce/orders/monitor.ts (internal)
```

---

### Flat Directory Structures

**What It Looks Like**
- 50+ files in one directory with no subdirectories
- No grouping by domain or capability
- Related concepts scattered across the directory
- File names become long prefixes to fake organization (ecommerce_auth_xxx.ts, ecommerce_db_xxx.ts)

**Why It's Harmful**
- No progressive disclosure—agent must read every file to understand relationships
- Navigation hints from file paths are lost
- Mental model doesn't match structure
- Agents can't infer where new code belongs

**What To Do Instead**
Apply [Pattern 0.2 — Progressive Disclosure](../L0-foundation.md#pattern-02--progressive-disclosure):
- Group related files into domain directories
- Keep depth to 3-4 levels maximum
- Each directory should have a clear single purpose
- Use file paths as navigation hints

Example refactor:
```
Before: src/ (50 files)
├── ecommerce_auth.ts
├── ecommerce_db.ts
├── ecommerce_orders.ts
├── auth_handlers.ts
├── auth_middleware.ts
... (45 more files)

After: src/
├── ecommerce/
│   ├── index.ts
│   ├── auth.ts
│   └── orders.ts
├── auth/
│   ├── index.ts
│   ├── handlers.ts
│   └── middleware.ts
```

---

### CLAUDE.md Bloat

**What It Looks Like**
- CLAUDE.md with 500+ lines of prose
- Detailed tutorials and explanations
- Extensive examples inline
- Multiple pages of constitutional rules

**Why It's Harmful**
- Agent's context window is wasted on constitution instead of task
- Critical rules get lost in verbose explanations
- Every line of bloat displaces context needed for the actual work
- Agent must skip past extensive documentation to reach the actual task

**What To Do Instead**
Apply [Pattern 0.4 — CLAUDE.md as Project Constitution](../L0-foundation.md#pattern-04--claude-md-as-project-constitution):
- Hard limit: **150 lines maximum**
- Link to external docs for detailed explanations
- Keep CLAUDE.md focused on: what is this, structure, constitutional rules, doc links
- Move tutorials, examples, and extended guides to dedicated docs

Example refactor:
```
Before: CLAUDE.md (500 lines)
├── 50 lines: project description
├── 200 lines: detailed pattern explanations
├── 100 lines: inline examples
├── 50 lines: constitutional rules
└── 100 lines: setup instructions

After: CLAUDE.md (140 lines)
├── 10 lines: project description
├── 30 lines: structure overview
├── 20 lines: constitutional rules
├── 50 lines: links to detailed docs
└── 30 lines: quick reference

Plus: docs/patterns/*.md (moved from inline)
     docs/examples/*.md (moved from inline)
```

---

### Orphaned Docs

**What It Looks Like**
- Documentation files not reachable from CLAUDE.md
- README files in subdirectories with no links to them
- Wiki pages or external docs not referenced in the project
- Multiple documentation files with overlapping content

**Why It's Harmful**
- Agent can't discover the documentation
- Duplicates effort—agents recreate existing docs
- Conflicting information when docs drift apart
- No single source of truth

**What To Do Instead**
Apply [Pattern 0.4 — CLAUDE.md as Project Constitution](../L0-foundation.md#pattern-04--claude-md-as-project-constitution):
- CLAUDE.md is the master index—every doc must be reachable from it
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

### Direct Main Branch Work

**What It Looks Like**
- Feature development directly on main branch
- No feature branches or isolation
- Experiments that risk the main branch
- Switching branches leaves artifacts in working directory

**Why It's Harmful**
- No isolation—broken work affects everyone
- No clean rollback if experiment fails
- Conflicts when parallel agents work on same codebase
- Context carries over between sessions, creating hidden state

**What To Do Instead**
Apply [Pattern 0.5 — Git Worktree-Based Development](../L0-foundation.md#pattern-05--git-worktree-based-development):
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

## L1 Anti-Patterns

### Partial-Stack Integration Tests

**What It Looks Like**
- Tests that start 3 of 5 services in the stack
- Some components mocked, others real
- Tests that are too slow for unit speed but too incomplete for confidence
- "Integration test" that tests database but mocks API layer

**Why It's Harmful**
- Too slow for rapid iteration (seconds per test)
- Too incomplete for deployment confidence (missing services)
- Mock mismatches create false failures
- Worst of both worlds: slow tests that don't prove anything

**What To Do Instead**
Apply [Pattern 1.1 — Stack Tests](../L1-feedback-loops.md#pattern-11--stack-tests):
- Test at unit level (fast, isolated) OR stack level (complete, real)
- Stack tests run the complete Docker stack
- No middle ground—either test behavior (unit) or system (stack)

Example refactor:
```
Before: Integration test (3 services, 2 mocked)
├── App container (real)
├── Database (real)
├── Redis (mocked)
├── External API (mocked)
└── Message queue (not started)

After 1: Unit test (milliseconds)
└── Test order processing logic in isolation, no containers

After 2: Stack test (seconds, complete confidence)
├── App container (real)
├── Database (real)
├── Redis (real)
├── External API (real or testnet)
└── Message queue (real)
```

---

### Mock-Heavy Test Suites

**What It Looks Like**
- Tests that mock database drivers, HTTP clients, blockchain libraries
- More mock setup code than test code
- Tests that pass but production fails because mocks behave differently
- Mocks that return perfect data, never timeout, never throw unexpected errors

**Why It's Harmful**
- False confidence—tests pass but system is broken
- Mocks drift from reality as real services evolve
- Testing mocks instead of real system behavior
- Real edge cases never appear in tests

**What To Do Instead**
Apply [Pattern 1.5 — No-Mock Philosophy](../L1-feedback-loops.md#pattern-15--no-mock-philosophy):
- If you own it, run it—real PostgreSQL, real Redis, real services
- Only mock external services you don't control (and no testnet exists)
- Use Docker for owned services—free, fast, realistic

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
// Test fails when schema is wrong—real feedback
```

---

### Conditional Test Assertions

**What It Looks Like**
- Assertions wrapped in if statements
- Tests that skip validation when data is missing
- Optional chaining on expect statements
- Early returns before assertions complete

**Why It's Harmful**
- Tests silently pass when they should fail
- No signal when something is wrong
- Agent can't trust test results
- Escape hatch undermines the entire feedback loop

**What To Do Instead**
Apply [Pattern 1.6 — Test Integrity Rules](../L1-feedback-loops.md#pattern-16--test-integrity-rules):
- Every assertion must run unconditionally
- No conditional tests—tests must either pass or fail explicitly
- Fail fast on first error

Example refactor:
```typescript
// Forbidden: Conditional assertion
if (response) {
  expect(response.status).toBe(200);
}
// If response is undefined, test passes with no assertions!

// Correct: Assertion runs unconditionally
expect(response).toBeDefined();
expect(response.status).toBe(200);
```

---

### Hardcoded Ports in Docker Configs

**What It Looks Like**
- `docker-compose.yml` with ports `3000:3000`, `5432:5432`, `6379:6379`
- Multiple tests using same ports
- Port conflicts when tests run concurrently
- "Port already in use" errors in CI

**Why It's Harmful**
- Tests collide when run in parallel
- Flaky failures depending on execution order
- Can't run multiple test suites simultaneously
- Developer machine conflicts with services already running

**What To Do Instead**
Apply [Pattern 1.4 — Container Isolation](../L1-feedback-loops.md#pattern-14--container-isolation):
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

### Running Only the Full Suite, Never Individual Tests

**What It Looks Like**
- Refusing to run individual stack tests during feature development
- Always requiring the full suite even during active iteration
- Treating individual test runs as a code smell

**Why It's Harmful**
- Slows iteration during feature development — individual runs are the fastest feedback loop
- Stack tests are vertical slices (like agile user stories) — running a single slice is the natural unit of development
- Agents need fast feedback when building a specific journey, not the entire suite
- Humans orchestrating agents may not need full suite runs at every step

**What To Do Instead**
Apply [Pattern 1.3 — Sequential/Additive Test Design](../L1-feedback-loops.md#pattern-13--sequential--additive-test-design):
- Run individual stack tests during active feature development for fast iteration
- Run the full suite before marking work complete or merging
- A test that passes in isolation but fails in the suite reveals a dependency bug — valuable signal, not a reason to forbid individual runs

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

## L2 Anti-Patterns

### Rules in Prose Only

**What It Looks Like**
- Rules written in CLAUDE.md but no skills or hooks to enforce them
- Constitutional rules that agents ignore when inconvenient
- Guidelines written as "should" not "must"
- No automated checking for rule violations

**Why It's Harmful**
- Soft rules are unreliable—agents forget or ignore them
- No enforcement when context shifts or prompts get complex
- Rules get dropped between phases of work
- Inconsistent application across different tasks

**What To Do Instead**
Apply [Pattern 2.1 — Skill Overlay Architecture](../L2-behavioral-guardrails.md#pattern-21--skill-overlay-architecture):
- Encapsulate rules in skills
- Skills enforce rules automatically when activated
- Hooks block violations at tool layer
- Constitutional rules are hardcoded, not soft suggestions

Example refactor:
```
Before: Rule in CLAUDE.md
"Never mock database drivers in tests"
(But no enforcement—agent may mock anyway)

After: Skill with hook activation
tdd+ skill:
  - Reads CLAUDE.md constitutional rules
  - Rejects mock generation for protected components
  - Hook: blocks Edit tool if mock code detected
```

---

### Skipping Skill Chain Links

**What It Looks Like**
- Going straight from plan to implementation without tdd+
- Writing code without test-driven development
- Making changes without verification
- Skipping review+ before considering task complete

**Why It's Harmful**
- Lost guardrails—each link enforces critical constraints
- Code works but can't be verified systematically
- No evidence-based claims before moving on
- Constitutional rules not checked at each phase

**What To Do Instead**
Apply [Pattern 2.2 — The Skill Chain](../L2-behavioral-guardrails.md#pattern-22--the-skill-chain):
- Complete chain: brain+ → plan+ → tdd+ → verify+ → review+
- Each skill validates input and produces structured output for next
- Skipping a link means losing a guardrail

Example workflow:
```
Wrong: Plan → Implementation (skip TDD, verification)
Code written but:
- No tests to verify behavior
- No evidence that it works
- No compliance review

Correct: brain+ → plan+ → tdd+ → verify+ → review+
- brain+: Design with stack testing considerations
- plan+: Create plan with test coverage matrix
- tdd+: RED-GREEN-REFACTOR with full-loop assertions
- verify+: Show command output before claiming done
- review+: Checklist-based compliance check
```

---

### Hooks That Only Log

**What It Looks Like**
- Hook scripts that warn but don't block
- "Prefer X over Y" instead of "Use X, not Y"
- Warnings that agents learn to ignore
- Hooks that emit messages but allow operation to proceed

**Why It's Harmful**
- Agents learn to ignore warnings
- No real enforcement—rules are bypassed
- Warning fatigue—signal lost in noise
- Hook becomes advisory rather than mandatory

**What To Do Instead**
Apply [Pattern 2.3 — Hook Automation](../L2-behavioral-guardrails.md#pattern-23--hook-automation):
- Hooks should either allow, advise with clear action, or block
- Critical rules must block, not warn
- If rule is important enough to hook, it's important enough to enforce
- Clear narrow purposes with documented behavior

Example refactor:
```typescript
// Weak: Warning only
hook.on('PreToolUse', (tool, args) => {
  if (tool === 'Bash' && args.command.includes('sed -i')) {
    console.warn('Prefer Edit tool over sed -i');
    return; // operation proceeds anyway
  }
});

// Strong: Block with explanation
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

## L3 Anti-Patterns

### grep When jcodemunch Is Indexed

**What It Looks Like**
- Using raw grep/rg for code search when repository is indexed
- Getting unstructured text output instead of typed results
- Parsing line numbers and extracting context manually
- Megabytes of grep output when structured search would return 5 results

**Why It's Harmful**
- 80% more tokens for same information
- Agent wastes time parsing unstructured output
- No type information or summaries
- Misses symbols that don't match text pattern exactly

**What To Do Instead**
Apply [Pattern 3.1 — Smart Routing](../L3-optimization.md#pattern-31--smart-routing--tool-selection):
- Route to structured search when available
- Use jcodemunch `search_symbols` for typed results
- Use jcodemunch `search_text` for content search
- Raw grep only when repository is not indexed

Example refactor:
```bash
# Inefficient: Raw grep
grep -r "export.*function" src/
# Returns: 200 lines of unstructured text

# Efficient: Structured search
search_symbols(query="function", kind="function")
# Returns: 5 typed symbols with file locations and summaries
```

---

### Reading Entire Files Unnecessarily

**What It Looks Like**
- Agent reads 300-line file when only 10 lines needed
- Reading full file to check one function signature
- Reading entire config when one value needed
- No scoping before reading

**Why It's Harmful**
- Context window waste
- Slower token processing
- Agent must scroll past irrelevant content
- Scales poorly with large codebases

**What To Do Instead**
Apply [Pattern 3.2 — Intent Classification](../L3-optimization.md#pattern-32--intent-classification):
- Use targeted reads with line ranges
- Use `get_symbol` to extract specific functions
- Use `get_file_outline` to see structure before reading
- Scope exploration before diving in

Example refactor:
```bash
# Wasteful: Read entire file
Read src/ecommerce/orders/execute.ts (300 lines)

# Efficient: Read specific function
get_symbol(symbol_id="src/ecommerce/orders/execute.ts:processOrder")
# Returns: 20 lines for just that function

# Or: Get outline first
get_file_outline(file_path="src/ecommerce/orders/execute.ts")
# Returns: All function signatures, then choose what to read
```

---

### No Environment Detection

**What It Looks Like**
- Same command routing regardless of available tools
- Not using RTK when it's available
- Not using jcodemunch when repository is indexed
- Missing optimization opportunities

**Why It's Harmful**
- Suboptimal token usage
- Slower operations
- No adaptation to environment
- Waste available tooling

**What To Do Instead**
Apply [Pattern 3.3 — Environment-Aware Routing](../L3-optimization.md#pattern-33--environment-aware-routing):
- Detect available tools before routing
- Use RTK when installed for git operations
- Use jcodemunch when repository is indexed
- Check environment and optimize accordingly

Example refactor:
```typescript
// Naive: Always use bash grep
function searchCode(query: string) {
  return bash(`grep -r "${query}" src/`);
}

// Aware: Check for indexed repo
async function searchCode(query: string) {
  if (await isRepoIndexed()) {
    return jcodemunch.search_text({ query });
  }
  return bash(`grep -r "${query}" src/`);
}
```

---

## L4 Anti-Patterns

### "I'll Update the Docs Later"

**What It Looks Like**
- Code changes without corresponding doc updates
- Filing tickets for doc updates as separate work
- "The docs are close enough for now"
- Examples in docs that don't match current code

**Why It's Harmful**
- Specs drift immediately—code and docs diverge
- Agents follow outdated docs with false confidence
- "Later" never comes—docs stay stale
- Compound interest of technical debt

**What To Do Instead**
Apply [Pattern 4.1 — Documentation as Contract](../L4-culture.md#pattern-41--documentation-as-contract):
- Code changes and doc updates happen in the SAME task
- Never defer documentation to "later"
- Every behavior change requires immediate doc update
- Link validation to catch orphans

Example workflow:
```
Wrong: Code now, docs later
Task: Refactor authentication flow
1. Implement new auth logic
2. Commit code
3. File ticket: "Update auth docs"
4. Ticket never gets done

Correct: Code + docs together
Task: Refactor authentication flow
1. Read current auth docs
2. Implement new auth logic
3. Update auth docs with new flow
4. Verify examples match current code
5. Commit: Code + docs together
```

---

### Accepting Known Issues

**What It Looks Like**
- "This warning is pre-existing"
- "This failure is unrelated to my work"
- "We can ignore that error"
- Tolerating defects instead of fixing them

**Why It's Harmful**
- Agents can't distinguish tolerated vs real issues
- Tolerated defect becomes undiagnosed regression later
- Compound interest of bugs
- Breaks zero-defect tolerance

**What To Do Instead**
Apply [Pattern 4.2 — Zero-Defect Tolerance](../L2-behavioral-guardrails.md#pattern-25--zero-defect-tolerance):
- Every error, warning, and failure must be addressed
- "Pre-existing" means fix it now
- No classification of errors as "relevant" vs "irrelevant" without evidence
- Clean slate before starting work

Example refactor:
```bash
# Wrong: Ignore pre-existing issues
npm test
# 2 passing, 1 failing (pre-existing)
Agent: "The failure is unrelated to my work"
# Agent proceeds, ignores real bug

# Correct: Fix all issues
npm test
# 2 passing, 1 failing
Agent: "There's a failure. Fix it first."
Agent fixes failure, re-runs tests
# Now: 3 passing
Agent can proceed with confidence
```

---

### Keeping Dead Code "Just in Case"

**What It Looks Like**
- Commented-out code blocks kept for future reference
- Unused functions "because we might need them"
- Feature flags that are never enabled
- Deprecated code paths never removed

**Why It's Harmful**
- Dead code is noise that degrades agent performance
- Agents waste tokens reading irrelevant code
- Confusion about what's actually used
- Maintenance burden on code that doesn't run

**What To Do Instead**
Apply [Pattern 4.3 — Aggressive Cleanup](../L4-culture.md#pattern-43--aggressive-cleanup):
- Delete dead code immediately
- Git history is your reference if you need it later
- No commented-out code—delete it
- Unused imports, variables, functions all removed

Example refactor:
```typescript
// Wrong: Keep dead code
// TODO: Re-enable this feature later
// function deprecatedFeature() {
//   ... 50 lines ...
// }

function currentFeature() {
  // ... actual code ...
}

// Correct: Delete it
function currentFeature() {
  // ... actual code ...
}
// If you need it later, check git history
```

---

## Usage Guide

This catalog is organized by pyramid level for quick diagnosis:

1. **Identify the symptom**—what problem are you seeing?
2. **Match to anti-pattern**—which entry describes your situation?
3. **Apply the fix**—follow the "What To Do Instead" guidance
4. **Reference the pattern**—cross-references point to full documentation

Anti-patterns are the mirror image of patterns. When you see an anti-pattern, you're seeing the absence of its corresponding pattern. Fixing the anti-pattern means implementing the pattern correctly.
