# Migration Guide — From Traditional to Agentic Development

This guide helps teams transition from traditional software development practices to agentic development patterns. The migration is organized into **6 phases**, each independently valuable. You don't need L4 to benefit from L0. Start where you are, implement what you can, and iterate.

**Core principle:** Each phase delivers immediate value. L0 Foundation alone dramatically improves agent performance. L1 Feedback Loops reduce debugging time. L2 Guardrails prevent common errors. Implement incrementally based on your team's capacity and needs.

---

## How Long Will This Take?

| Phase | Time Investment | Team Size | Value Delivered |
|-------|----------------|-----------|-----------------|
| Phase 0: Assessment | 1-2 days | 1-2 people | Clear roadmap, prioritized gaps |
| Phase 1: L0 Foundation | 1-2 weeks | Whole team | 50-70% improvement in agent navigation |
| Phase 2: L1 Feedback Loops | 2-4 weeks | 2-3 engineers | Reduced debugging, faster iteration |
| Phase 3: L2 Guardrails | 2-3 weeks | 1-2 engineers | Fewer errors, consistent patterns |
| Phase 4: L3 Optimization | 1-2 weeks | 1 engineer | 60-90% token savings |
| Phase 5: L4 Culture | Ongoing | Whole team | Sustained quality, reduced tech debt |

**Total:** 6-12 weeks for full adoption across a team of 3-5 engineers. Phases can run in parallel once L0 is complete.

---

## Phase 0: Assessment

**Goal:** Understand where you are and what gaps exist.

**Time:** 1-2 days

**Team:** 1-2 people (tech lead + senior engineer)

### Checklist: Is Your Project Agentic-Ready?

Run through this checklist to identify gaps:

#### Entry Points
- [ ] CLAUDE.md exists and is under 150 lines
- [ ] README.md clearly explains what the project does
- [ ] CLAUDE.md links to all relevant documentation
- [ ] File structure is grouped by domain, not layer

#### Testing
- [ ] Integration tests use real components (no mocks for owned services)
- [ ] Tests run in isolated environments (no shared state)
- [ ] Test failures provide clear diagnostic signals
- [ ] Tests assert on side effects, not just responses

#### Documentation
- [ ] Every pattern is documented with examples
- [ ] Code examples in docs match current codebase
- [ ] Documentation is linked from CLAUDE.md
- [ ] No orphaned docs (all reachable from master index)

#### Tooling
- [ ] Git worktrees are used for feature branches
- [ ] Linting/formatting is automated
- [ ] Pre-commit hooks enforce basic rules
- [ ] CI runs tests in isolated environments

### The New Starter Test

**The ultimate test:** Give someone (or something) with zero context your CLAUDE.md + README + file structure. Can they navigate?

**Procedure:**

1. **Fresh clone simulation**
   ```bash
   # Clone your repo to a temporary location
   git clone <your-repo> /tmp/test-agentic-readiness
   cd /tmp/test-agentic-readiness

   # Read ONLY README.md and CLAUDE.md
   # Attempt to answer:
   ```

2. **Answer these questions using only entry points:**
   - What does this project do?
   - How do I run it locally?
   - Where do I add a new feature?
   - What patterns should I follow?
   - How do I test my changes?
   - What must I never do?

3. **Document every assumption** you had to make. Each assumption is a gap.

4. **Categorize gaps:**
   - **Missing documentation:** Add to CLAUDE.md or linked docs
   - **Unclear structure:** Restructure file layout (Phase 1)
   - **Missing patterns:** Document in L1-L3 docs
   - **Broken navigation:** Fix links or organization

### Identify Biggest Gaps Using Pyramid Levels

Use the agentic patterns pyramid as a framework:

| Level | Focus | Common Gaps | Quick Wins |
|-------|-------|-------------|------------|
| **L0 Foundation** | Project structure, CLAUDE.md | No CLAUDE.md, layer-based organization | Write CLAUDE.md, restructure by domain |
| **L1 Feedback Loops** | Stack tests, full-loop assertions | Mock-heavy integration tests, shallow assertions | Add app-startup test, implement sequential tests |
| **L2 Guardrails** | Skills, hooks, behavioral rules | No enforcement, agents make common errors | Add test-integrity skill, implement PreToolUse hooks |
| **L3 Optimization** | Smart routing, structured search | Raw grep/cat commands, token waste | Set up jcodemunch, implement routing guardrails |
| **L4 Culture** | Documentation rigor, cleanup, drift detection | Stale docs, dead code accumulation | Establish doc update workflow, schedule cleanup sessions |

**Prioritization matrix:**

| Gap | Impact | Effort | Priority |
|-----|--------|--------|----------|
| No CLAUDE.md | High | Low | **Do first** |
| Layer-based file structure | High | Medium | **Do second** |
| Mock-heavy tests | Medium | High | Phase 2 |
| No structured search | Medium | Low | Phase 4 |
| Stale documentation | Low | Medium | Phase 5 |

### Expected Output: Prioritized List

By the end of Phase 0, you should have:

1. **Gap list:** What's missing, categorized by pyramid level
2. **Impact assessment:** Which gaps most hurt agent performance
3. **Migration roadmap:** Which phases to tackle in what order
4. **Quick wins:** Things you can fix in a day that deliver immediate value

**Example output:**

```
Assessment Summary for MyProject

Critical Gaps (L0):
- No CLAUDE.md → creates 150+ line confusion for agents
- File structure grouped by layer (services/, handlers/, utils/)
  → agents can't find related code
- 7 orphaned documentation files not linked from anywhere

High-Priority Gaps (L1):
- Integration tests mock database → tests pass, production fails
- No sequential test ordering → failures hard to diagnose
- Tests don't assert on side effects → false confidence

Medium-Priority Gaps (L2):
- No test-integrity rules → agents use conditional assertions
- No PreToolUse hooks → destructive operations slip through
- No verify+ enforcement → claims without evidence

Lower-Priority Gaps (L3/L4):
- Raw grep commands waste tokens (~65% overhead)
- Documentation drift: 3 docs not updated in 6+ months
- Dead code accumulation: 12 unused functions detected

Migration Roadmap:
1. Week 1: Write CLAUDE.md, restructure by domain (L0)
2. Week 2-3: Add stack tests, remove mocks (L1)
3. Week 4-5: Implement test-integrity skill, add hooks (L2)
4. Week 6: Set up jcodemunch, implement routing (L3)
5. Ongoing: Documentation rigor, cleanup (L4)
```

---

## Phase 1: L0 Foundation (Smallest Effort, Highest Impact)

**Goal:** Make your project navigable for agents with zero prior context.

**Time:** 1-2 weeks

**Team:** Whole team (everyone contributes to restructuring)

**Value:** 50-70% improvement in agent navigation and understanding.

### Step 1: Restructure File Layout

**Problem:** Layer-based organization (`services/`, `handlers/`, `utils/`, `types/`) scatters related code across directories. Agents can't find all ecommerce logic in one place.

**Solution:** Group by domain or capability.

**Before (layer-based):**
```
src/
├── services/
│   ├── orders.ts
│   ├── payments.ts
│   └── monitoring.ts
├── handlers/
│   ├── orderHandler.ts
│   └── paymentHandler.ts
├── utils/
│   ├── pricing.ts
│   └── inventory.ts
└── types/
    ├── orders.ts
    └── payments.ts
```

**After (domain-based):**
```
src/
├── ecommerce/
│   ├── index.ts                 # Public interface
│   ├── orders/                  # Order processing
│   │   ├── execute.ts
│   │   ├── monitor.ts
│   │   └── types.ts
│   ├── payments/                # Payment processing
│   │   ├── stripe.ts
│   │   └── types.ts
│   └── utils/                   # Ecommerce-specific utilities
│       ├── pricing.ts
│       └── inventory.ts
└── monitoring/                  # Cross-cutting
    └── index.ts
```

**Migration strategy:**

1. **Identify domains** (not layers): What are the capabilities of your system?
   - Orders, payments, catalog, inventory, authentication, monitoring, etc.

2. **Create domain directories** for each capability

3. **Move files** by domain, not by file type
   - `services/orders.ts` → `ecommerce/orders/execute.ts`
   - `handlers/orderHandler.ts` → `ecommerce/orders/handler.ts`
   - `types/orders.ts` → `ecommerce/orders/types.ts`
   - `utils/pricing.ts` → `ecommerce/utils/pricing.ts`

4. **Update imports** across the codebase
   ```bash
   # Find all imports and update paths
   grep -r "from.*services/" src/
   # Replace with new domain paths
   ```

5. **Verify:** Run tests, ensure nothing broke

**Anti-pattern:** Creating `shared/` or `common/` directories that become dumping grounds. If code is shared between domains, question whether those domains are properly separated.

### Step 2: Write CLAUDE.md

**Problem:** Agents entering a project don't know: what is this, how is it structured, what must I never do, what patterns must I follow.

**Solution:** CLAUDE.md is the single source of truth — a contract, not a tutorial. Hard limit: **150 lines maximum**.

**CLAUDE.md template:**

```markdown
# [Project Name] — Agent Contract

## Project Description
[One sentence summary of what this project does.]

## Repository Structure
[Tree diagram showing major directories and their purposes.]

## Constitutional Rules (Never Violate)
1. [No mocking core system components]
2. [Evidence-based claims only]
3. [Zero-defect tolerance]
[... add project-specific rules]

## Level Documentation
- @docs/L0-foundation.md
- @docs/L1-feedback-loops.md
- @docs/L2-behavioral-guardrails.md
- @docs/L3-optimization.md
- @docs/L4-culture.md

## Quick Start
[How to run the project locally in 3-5 commands.]

## Development Workflow
[How to make changes, run tests, and contribute.]

## Tooling and Conventions
[Linting, formatting, testing frameworks, etc.]
```

**Key principles:**

- **Under 150 lines:** Link to docs for details, keep CLAUDE.md concise
- **Master index:** Every doc must be reachable from CLAUDE.md via `@filename.md` links
- **Constitutional rules:** What must NEVER be violated
- **Navigation focus:** Help agents find what they need quickly

**Example constitutional rules:**

```markdown
## Constitutional Rules (Never Violate)

1. **No mocking owned services:** If we control it, we test it. Real PostgreSQL in Docker, real Redis, real side effects.

2. **Evidence-based claims:** Never claim "tests pass" without showing test output. Run commands, show output, then claim.

3. **Zero-defect tolerance:** Bugs found in production trigger immediate test addition. Failures are never dismissed as "unrelated."

4. **Domain organization:** Code is grouped by what it does (ecommerce/orders/, ecommerce/payments/), not by file type (services/, utils/).

5. **Full-loop assertions:** Tests verify primary responses, second-order cross-API effects, and third-order cross-functional verification (audit logs, notifications, cross-endpoint consistency).

6. **Documentation sync:** Code changes and doc updates happen in the same task. Never defer documentation.
```

### Step 3: Ensure CLAUDE.md is Master Index

**Problem:** Documentation scattered across multiple files creates discoverability issues. Agents can't find what they need.

**Solution:** CLAUDE.md is the root of a documentation tree. Every doc must be reachable via link chains starting from CLAUDE.md.

**Link validation:**

```bash
# Check all docs linked from CLAUDE.md are reachable
find docs -name "*.md" -exec grep -l "\[.*\](.*\.md)" {} \; | \
  while read f; do
    grep -o '\[.*\]([^)]*\.md)' "$f" | \
    while read link; do
      target=$(echo "$link" | sed 's/.*(\(.*\))/\1/')
      if [ ! -f "docs/$target" ]; then
        echo "Broken link in $f: $target"
      fi
    done
  done
```

**Linking conventions:**

- Use `@filename.md` for links to docs in the same directory
- Use `@../directory/filename.md` for links to other directories
- Update links when files move
- Remove links to deleted docs

**Example CLAUDE.md section:**

```markdown
## Level Documentation

### Foundation (L0)
- @docs/L0-foundation.md — Project structure for AI accessibility

### Feedback Loops (L1)
- @docs/L1-feedback-loops.md — Stack tests and full-loop assertions

### Guardrails (L2)
- @docs/L2-behavioral-guardrails.md — Skills, hooks, and enforcement

### Optimization (L3)
- @docs/L3-optimization.md — Token efficiency and smart routing

### Culture (L4)
- @docs/L4-culture.md — Documentation rigor and cleanup

### Cross-Cutting
- @docs/cross-cutting/migration-guide.md — This guide
- @docs/cross-cutting/anti-patterns.md — Common mistakes to avoid
```

### Step 4: Establish Worktree Conventions

**Problem:** Multiple agents working on the same codebase create conflicts. Switching branches leaves artifacts.

**Solution:** Use git worktrees as the default working model. Each feature branch gets its own working directory.

**Setup:**

```bash
# Create .worktrees directory
mkdir -p .worktrees

# Create a worktree for a feature branch
git worktree add .worktrees/feature-x feature-x

# Agent works in isolated directory
cd .worktrees/feature-x
# ... make changes, commit, test ...

# Remove when done
git worktree remove .worktrees/feature-x
```

**Benefits:**

- **Parallel isolation:** Multiple agents on separate branches without conflict
- **Clean slate:** No leftover artifacts from previous sessions
- **Non-destructive:** Experiment without risking the main branch
- **Deterministic state:** Worktrees created from a known commit

**Convention:** `.worktrees/<branch-name>/` directory.

**Add to CLAUDE.md:**

```markdown
## Development Workflow

### Git Worktrees
All feature work happens in git worktrees, not on the main branch.

```bash
# Create a worktree for your feature
git worktree add .worktrees/feature-branch-name feature-branch-name

# Work in the isolated directory
cd .worktrees/feature-branch-name

# When done, remove the worktree
git worktree remove .worktrees/feature-branch-name
```

**Why:** Prevents conflicts, provides clean slate for each task.
```

### Step 5: Audit — Can a New Starter Navigate?

**Test:** Can someone with zero context understand your project from CLAUDE.md + README + file structure alone?

**Procedure:**

1. **Ask a colleague** (or use an agent with no project context)
2. **Give them only:** README.md, CLAUDE.md, and file structure
3. **Ask them to:**
   - Explain what the project does
   - Run the project locally
   - Find where to add a new feature
   - Identify the patterns to follow
   - Locate testing documentation

4. **Document every question** they ask. Each question is a gap in your entry points.

5. **Fix gaps:** Add missing information to CLAUDE.md or linked docs

**Passing criteria:**

- [ ] They can explain the project in one sentence
- [ ] They can run "hello world" without asking questions
- [ ] They know where to add a feature (file structure is clear)
- [ ] They know what patterns to follow (docs are discoverable)
- [ ] They know what must NEVER be done (constitutional rules)

**If they fail:** Your CLAUDE.md or file structure needs work. Iterate until a zero-context newcomer can navigate confidently.

---

## Phase 2: L1 Feedback Loops

**Goal:** Implement stack tests that give agents clear signals about what's broken and why.

**Time:** 2-4 weeks

**Team:** 2-3 engineers (infrastructure-focused)

**Value:** Reduced debugging time, faster iteration, higher confidence in deployments.

### Step 1: Add Stack Test Infrastructure

**Problem:** Integration tests mock some components but not others, creating a "fake system" that passes tests but fails in production.

**Solution:** Stack tests run the complete Docker stack (app, databases, caches, queues) and verify behavior through the API only. No internal mocks.

**Infrastructure setup:**

1. **Create stack test directory:**
   ```bash
   mkdir -p tests/stack
   ```

2. **Create test utilities:**
   ```typescript
   // tests/stack/utils/stack.ts
   export async function startStack(testName: string) {
     const ports = await allocatePorts(3); // app, db, redis
     const composeFile = generateComposeFile(testName, ports);

     await exec('docker', ['compose', '-f', composeFile, 'up', '-d']);
     await waitForHealthCheck(ports.app);

     return { ports, composeFile };
   }

   export async function stopStack(composeFile: string) {
     await exec('docker', ['compose', '-f', composeFile, 'down', '-v']);
     await unlink(composeFile);
   }

   export async function allocatePorts(count: number): Promise<number[]> {
     const ports: number[] = [];
     const portRange = { min: 10000, max: 65535 };

     for (let i = 0; i < count; i++) {
       let port: number;
       let available = false;
       let attempts = 0;

       while (!available && attempts < 100) {
         port = randomInt(portRange.min, portRange.max);
         available = await isPortAvailable(port);
         attempts++;
       }

       if (!available) {
         throw new Error(`Could not allocate ${count} ports`);
       }
       ports.push(port);
     }

     return ports;
   }
   ```

3. **Create Docker Compose generator:**
   ```typescript
   // tests/stack/utils/compose.ts
   export function generateComposeFile(
     testName: string,
     ports: Record<string, number>
   ): string {
     const filename = `docker-compose-${testName}-${process.pid}-${randomBytes(4).toString('hex')}-${Date.now()}.yml`;

     const content = `
   version: '3.8'
   services:
     app:
       container_name: ${testName}-${process.pid}-${randomBytes(4).toString('hex')}-app
       ports:
         - "${ports.app}:3000"
       environment:
         - DB_HOST=postgres
         - DB_PORT=${ports.postgres}
       depends_on:
         - postgres
     postgres:
       container_name: ${testName}-${process.pid}-${randomBytes(4).toString('hex')}-postgres
       ports:
         - "${ports.postgres}:5432"
       volumes:
         - postgres-data:/var/lib/postgresql/data
   volumes:
     postgres-data:
   `;

     writeFile(filename, content);
     return filename;
   }
   ```

### Step 2: Start with App-Startup Test

**Problem:** Complex tests fail when the server never started. Agents waste time debugging business logic when the foundation is broken.

**Solution:** Start with the simplest test — validate the stack comes up.

**Test:**

```typescript
// tests/stack/01-app-startup.stack.test.ts
import { startStack, stopStack } from './utils/stack';
import { createClient } from './utils/client';

describe('App Startup', () => {
  let composeFile: string;
  let ports: Record<string, number>;

  beforeAll(async () => {
    ({ composeFile, ports } = await startStack('app-startup'));
  });

  afterAll(async () => {
    await stopStack(composeFile);
  });

  it('should start the application server', async () => {
    const client = createClient(`http://localhost:${ports.app}`);

    // Primary assertion: Server responds
    const response = await client.get('/health');
    expect(response.status).toBe(200);

    // Second-order assertion: Health endpoint reports healthy
    expect(response.data.status).toBe('healthy');
  });
});
```

**Run the test:**

```bash
# Run just this test first
npm test -- tests/stack/01-app-startup.stack.test.ts

# If it passes, you know:
# - Docker compose works
# - Ports allocate correctly
# - Server starts and responds
```

### Step 3: Add Sequential Test for Simplest User Flow

**Problem:** Tests run in unpredictable order, making failures hard to diagnose.

**Solution:** Order tests by dependency. Each test assumes all previous tests pass.

**Test sequence:**

```
tests/stack/
  01-app-startup.stack.test.ts         # Does the stack start?
  02-authentication.stack.test.ts      # Can users log in?
  03-basic-crud.stack.test.ts          # Core operations work
  04-domain-operations.stack.test.ts   # Business logic
  05-advanced-features.stack.test.ts   # Edge cases and complex flows
```

**Example: Authentication test**

```typescript
// tests/stack/02-authentication.stack.test.ts
import { startStack, stopStack } from './utils/stack';
import { createClient } from './utils/client';

describe('Authentication', () => {
  let composeFile: string;
  let ports: Record<string, number>;
  let client: ReturnType<typeof createClient>;

  beforeAll(async () => {
    ({ composeFile, ports } = await startStack('authentication'));
    client = createClient(`http://localhost:${ports.app}`);
  });

  afterAll(async () => {
    await stopStack(composeFile);
  });

  it('should register a new user', async () => {
    // Primary assertion: API response
    const response = await client.post('/auth/register', {
      email: 'test@example.com',
      password: 'securepassword'
    });
    expect(response.status).toBe(201);
    expect(response.data.userId).toBeDefined();

    // Second-order assertion: User exists in database
    const user = await client.get(`/users/${response.data.userId}`);
    expect(user.data.email).toBe('test@example.com');

    // Third-order assertion: Audit log created
    const adminClient = createAdminClient(`http://localhost:${ports.app}`);
    const auditLog = await adminClient.get(`/audit/${response.data.userId}`);
    expect(auditLog.data.event).toBe('USER_REGISTERED');
  });

  it('should log in with valid credentials', async () => {
    const response = await client.post('/auth/login', {
      email: 'test@example.com',
      password: 'securepassword'
    });
    expect(response.status).toBe(200);
    expect(response.data.token).toBeDefined();
  });
});
```

### Step 4: Implement Dynamic Port Allocation and Container Isolation

**Problem:** Tests pass in isolation but fail in parallel due to port conflicts and shared state.

**Solution:** Dynamic port allocation, unique container names, transient volumes.

**Implementation:** (See Step 1 above for utilities)

**Verification:**

```bash
# Run tests in parallel
npm test -- --tests/stack/ --parallel

# All tests should pass without port conflicts
```

### Step 5: Run Stack Tests as a Suite

**Problem:** Running tests individually hides dependency bugs.

**Solution:** Run the full suite sequentially.

**Add to package.json:**

```json
{
  "scripts": {
    "test:stack": "jest tests/stack/*.test.ts --runInBand"
  }
}
```

**Run before committing:**

```bash
# Run full stack test suite
npm run test:stack

# If all pass, commit with confidence
```

### Step 6: Verify Full-Loop Assertions Work

**Problem:** Tests that only assert on API response status codes give false confidence.

**Solution:** Structure checks at three levels: primary (response), second-order (side effects), third-order (observability).

**Example: Order processing test**

```typescript
it('should process an order payment', async () => {
  // Primary: API response
  const orderResponse = await api.post('/orders', {
    items: [{ productId: 'prod-123', quantity: 2 }],
    paymentMethod: 'stripe'
  });
  expect(orderResponse.status).toBe(200);
  expect(orderResponse.data.orderId).toBeDefined();

  // Second-order: Database state via API
  const orderStatus = await api.get(`/orders/${orderResponse.data.orderId}`);
  expect(orderStatus.data.status).toBe('paid');
  expect(orderStatus.data.totalAmount).toBeGreaterThan(0);

  // Third-order: Audit log via admin API
  const adminClient = createAdminClient();
  const auditLog = await adminClient.get(`/audit/${orderResponse.data.orderId}`);
  expect(auditLog.data.event).toBe('ORDER_PAID');
  expect(auditLog.data.timestamp).toBeDefined();
});
```

**Diagnostic value:**

- **Primary fails:** Input validation, routing, or controller logic broken
- **Second-order fails:** Controller works but persistence layer broken
- **Third-order fails:** Core system works but observability/audit broken

---

## Phase 3: L2 Guardrails

**Goal:** Prevent common errors through skills, hooks, and behavioral rules.

**Time:** 2-3 weeks

**Team:** 1-2 engineers (tooling-focused)

**Value:** Fewer errors, consistent patterns, reduced review burden.

### Step 1: Create Test-Integrity Skill

**Problem:** Tests with escape hatches silently pass when they should fail.

**Solution:** Create a skill that forbids conditional assertions, catch-without-rethrow.

**Skill implementation:**

```typescript
// .claude/skills/test-integrity.md
# Test Integrity Check

You are a test integrity checker. When asked to review test code, check for these forbidden patterns:

## Forbidden Patterns

### 1. Conditional Assertions
**Bad:** `if (response) { expect(response.status).toBe(200); }`
**Why:** If response is undefined, test passes with no assertions run.

**Fix:**
```typescript
expect(response).toBeDefined();
expect(response.status).toBe(200);
```

### 2. Catch Without Rethrow
**Bad:**
```javascript
try {
  await riskyOperation();
} catch (e) {
  console.log(e);
}
```

**Fix:**
```javascript
await expect(riskyOperation()).resolves.not.toThrow();
```

### 3. Optional Chaining on Expect
**Bad:** `expect(res?.data).toBeDefined();`
**Fix:**
```typescript
expect(res).toBeDefined();
expect(res.data).toBeDefined();
```

### 4. Early Returns Before Assertions
**Bad:** `if (!user) return; expect(user.email).toContain('@');`
**Fix:**
```typescript
expect(user).toBeDefined();
expect(user.email).toContain('@');
```

### 5. Try-Catch Wrapped Expectations
**Bad:**
```typescript
try {
  expect(actual).toBe(expected);
} catch (e) {
  // Error swallowed
}
```

**Fix:**
```typescript
expect(actual).toBe(expected);
```

## Check Procedure

1. Read the test file
2. Search for forbidden patterns
3. Report each violation with line number
4. Suggest correct alternative
5. Do not allow test to proceed until violations are fixed
```

**Usage:**

```bash
# Before committing tests
claude skill test-integrity tests/auth.test.ts
```

### Step 2: Add Verify+ Skill

**Problem:** Agents make claims without backing them with evidence.

**Solution:** Create a skill that enforces evidence before claims.

**Skill implementation:**

```markdown
# Verify+ Skill

You are an evidence enforcer. When an agent makes a claim, require verification.

## Claims Requiring Evidence

- "Tests pass" → Show test output
- "Build succeeds" → Show build log
- "Function works" → Show example execution
- "Performance improved" → Show before/after metrics
- "Bug fixed" → Show reproduction failing before, passing after

## Evidence Format

```bash
# Step 1: Run verification command
$ <command>

# Step 2: Show actual output
<actual output>

# Step 3: Make claim based on output
Claim: <what the output proves>
```

## Enforcement

When you see a claim without evidence:
1. Stop the agent
2. Request verification command
3. Require actual output
4. Only then allow the claim

## Example

**Bad:**
> "Tests should pass now"

**Good:**
```bash
$ pytest tests/auth.py -v

tests/auth.py::test_login PASSED
tests/auth.py::test_logout PASSED

Claim: All authentication tests pass. Login and logout paths work correctly.
```
```

### Step 3: Set Up PreToolUse Hooks to Block Destructive Operations

**Problem:** Destructive operations (sed -i, rm -rf) slip through and cause damage.

**Solution:** PreToolUse hooks that block dangerous commands.

**Hook implementation:**

```typescript
// .claude/hooks/pre-tool-use.ts
export function preToolUse(toolInput: ToolInput): ToolInput | BlockResponse {
  if (toolInput.tool === 'bash') {
    const command = toolInput.input.command;

    // Block destructive patterns
    const destructivePatterns = [
      /sed\s+(-i|--in-place)\b/,
      /rm\s+-rf/,
      /rm\s+--recursive/,
      />.*\s+/  // Redirect to file (awk, etc.)
    ];

    for (const pattern of destructivePatterns) {
      if (pattern.test(command)) {
        return {
          blocked: true,
          reason: `Destructive command blocked: ${command}\n` +
                   `Use the Edit tool instead. If you must use this command, ` +
                   `explicitly acknowledge the risk.`,
          alternatives: ['Edit tool', 'Read tool']
        };
      }
    }
  }

  return toolInput;
}
```

**Effect:** Agents are forced to use safer alternatives (Edit tool) or explicitly acknowledge risk.

### Step 4: Set Up PostToolUse Hooks to Track Code Changes

**Problem:** Code changes happen without corresponding test updates or documentation changes.

**Solution:** PostToolUse hooks that track changes and require test coverage.

**Hook implementation:**

```typescript
// .claude/hooks/post-tool-use.ts
export function postToolUse(toolOutput: ToolOutput): ToolOutput {
  if (toolOutput.tool === 'edit' || toolOutput.tool === 'write') {
    const changedFile = toolOutput.input.path;

    // Check if tests exist for this file
    const testFile = changedFile.replace(/\.ts$/, '.test.ts');
    if (!fileExists(testFile)) {
      console.warn(`⚠️  No test file found for ${changedFile}`);
      console.warn(`   Consider adding tests before committing.`);
    }

    // Check if documentation exists
    const docFile = findDocForFile(changedFile);
    if (docFile && !fileExists(docFile)) {
      console.warn(`⚠️  Documentation may be missing for ${changedFile}`);
      console.warn(`   Update docs in the same task as code changes.`);
    }
  }

  return toolOutput;
}
```

**Effect:** Agents are reminded to add tests and update documentation as part of the same task.

### Step 5: Enforce Constitutional Rules Through Review+ Skill

**Problem:** Agents violate project rules (mocking core components, making claims without evidence).

**Solution:** Create a skill that enforces constitutional rules during review.

**Skill implementation:**

```markdown
# Review+ Skill

You are a constitutional compliance checker. Before any work is marked complete, verify:

## Constitutional Rules

### 1. No Mocking Core Components
- [ ] No mocks for PostgreSQL, Redis, or other owned services
- [ ] Real components run in Docker for stack tests
- [ ] Only external services (Stripe, third-party APIs) may be mocked

### 2. Evidence-Based Claims
- [ ] "Tests pass" → Test output shown
- [ ] "Build succeeds" → Build log shown
- [ ] "Bug fixed" → Before/after evidence shown

### 3. Zero-Defect Tolerance
- [ ] Bugs trigger immediate test addition
- [ ] Failures are investigated, not dismissed
- [ ] Root cause is identified and fixed

### 4. Full-Loop Assertions
- [ ] Primary assertions: API response verified
- [ ] Second-order assertions: Side effects verified
- [ ] Third-order assertions: Observability verified

### 5. Documentation Sync
- [ ] Code changes documented in same task
- [ ] CLAUDE.md updated if structure changed
- [ ] New docs linked from CLAUDE.md

## Review Procedure

1. Read the task description
2. Check each constitutional rule
3. Report violations with specific examples
4. Do not allow task completion until all rules pass
```

**Usage:**

```bash
# Before marking a task complete
claude skill review+ --task="Implement authentication flow"
```

---

## Phase 4: L3 Optimization

**Goal:** Reduce token consumption by routing commands to optimal tools and using structured search.

**Time:** 1-2 weeks

**Team:** 1 engineer (tooling-focused)

**Value:** 60-90% token savings, faster agent responses.

### Step 1: Set Up jcodemunch or Equivalent Structured Code Search

**Problem:** Raw grep returns megabytes of unstructured text. Agents waste tokens parsing noise.

**Solution:** Use structured code search (jcodemunch, grep.app, etc.) that returns typed results.

**jcodemunch setup:**

```bash
# Install jcodemunch
npm install -g jcodemunch

# Index your codebase
cd /your-project
jcodemunch index .

# Search for symbols
jcodemunch search "processPayment" --kind function
```

**Comparison:**

| Approach | Output | Tokens |
|----------|--------|--------|
| `grep -r "processPayment" .` | 200 lines of unstructured text | ~5000 |
| `jcodemunch search "processPayment"` | 5 typed results with summaries | ~500 |

### Step 2: Create Intent Classification for Common Bash Commands

**Problem:** Bash commands are opaque strings. We can't route them correctly or block dangerous operations.

**Solution:** Parse commands into intent categories.

**Implementation:**

```typescript
// Intent patterns ordered by precedence
const INTENT_PATTERNS = [
  { pattern: /^\s*sed\s+(-i|--in-place)\b/, type: 'file_modify' },
  { pattern: /^\s*awk\b.*>\s*\S+/, type: 'file_modify' },
  { pattern: /^\s*cat\s+\S+/, type: 'file_read' },
  { pattern: /^\s*(grep[rx]?|rg)\b/, type: 'text_search' },
  { pattern: /^\s*find\s+/, type: 'file_discovery' },
  { pattern: /^\s*fd\b/, type: 'file_discovery' },
  { pattern: /^\s*docker(-compose)?\b/, type: 'docker' },
];

// Split compound commands
function classifyCommand(command: string): Intent[] {
  const segments = command.split(/&&|\|\||;|\|/);
  return segments.flatMap(segment => {
    for (const { pattern, type } of INTENT_PATTERNS) {
      if (pattern.test(segment.trim())) return [type];
    }
    return ['pass_through'];
  });
}
```

### Step 3: Implement Routing Guardrails

**Problem:** Agents use inefficient tools for common operations.

**Solution:** Route commands to optimal tools based on intent.

**Routing table:**

```typescript
const ROUTING_TABLE = {
  text_search: {
    preferred: 'jcodemunch search_text',
    fallback: 'Grep tool',
    reason: 'Structured output vs raw text'
  },
  file_read: {
    preferred: 'Read tool',
    fallback: 'cat',
    reason: 'Clean output, no artifacts'
  },
  file_discovery: {
    preferred: 'jcodemunch get_file_tree',
    fallback: 'Glob tool',
    reason: 'Targeted discovery vs recursive search'
  },
  file_modify: {
    action: 'block',
    reason: 'Use Edit tool instead'
  }
};
```

**Router implementation:**

```typescript
function routeCommand(command: string, env: Environment): Resolution {
  const intents = classifyCommand(command);

  for (const intent of intents) {
    const rule = ROUTING_TABLE[intent];
    if (!rule) continue;

    if (rule.action === 'block') {
      return { blocked: true, reason: rule.reason };
    }

    if (env.jcodemunchAvailable && rule.preferred.includes('jcodemunch')) {
      return { advise: rule.preferred, reason: rule.reason };
    }

    if (rule.fallback) {
      return { advise: rule.fallback, reason: rule.reason };
    }
  }

  return { allow: true };
}
```

### Step 4: Detect Environment at Session Start

**Problem:** Optimal tools vary by environment. Hard-coding breaks portability.

**Solution:** Detect available tools at session start and cache results.

**Detection script:**

```bash
#!/bin/bash
# .claude/hooks/session-start.sh

echo "Detecting environment..."

# Check for RTK
if which rtk >/dev/null 2>&1; then
  echo "✓ RTK available"
  export RTK_AVAILABLE=true
else
  echo "✗ RTK not available"
  export RTK_AVAILABLE=false
fi

# Check for jcodemunch
if [ -d .jcodemunch ]; then
  echo "✓ jcodemunch index exists"
  export JCODEMUNCH_INDEXED=true
else
  echo "✗ jcodemunch index missing (run: jcodemunch index .)"
  export JCODEMUNCH_INDEXED=false
fi

# Check for stack test context
if [ -d ./test-logs ]; then
  recent_files=$(find ./test-logs -mmin -5 | wc -l)
  if [ "$recent_files" -gt 0 ]; then
    echo "✓ Stack test context active"
    export STACK_TEST_ACTIVE=true
  fi
fi

echo "Environment detection complete."
```

### Step 5: Measure Token Savings Before/After

**Problem:** Hard to quantify the value of optimization.

**Solution:** Track token usage before and after implementing routing.

**Measurement approach:**

```bash
# Before optimization
# Run a representative task
claude "Find all functions that call processPayment"

# Note token usage from output

# After optimization (with jcodemunch + routing)
claude "Find all functions that call processPayment"

# Compare token usage
```

**Expected savings:**

- **Grep → jcodemunch:** ~80% reduction
- **Cat → Read:** ~75% reduction
- **Find → Glob:** ~77% reduction
- **RTK filtering:** ~60% reduction on git commands

**Overall:** 60-90% token savings on typical development workflows.

---

## Phase 5: L4 Culture

**Goal:** Establish continuous quality practices that maintain standards over time.

**Time:** Ongoing (establish in 1-2 weeks, practice continuously)

**Team:** Whole team

**Value:** Sustained quality, reduced tech debt, smoother onboarding.

### Step 1: Establish Review Checklists

**Problem:** Code reviews are inconsistent. Some PRs merge with violations, others are blocked on minor issues.

**Solution:** Use a standardized checklist for all reviews.

**Checklist template:**

```markdown
## Review Checklist

### Constitutional Compliance
- [ ] CLAUDE.md rules followed (if applicable)
- [ ] No hardcoded paths or secrets
- [ ] No blocking I/O without timeout
- [ ] Error handling covers all branches
- [ ] Logs include sufficient context

### Full-Loop Coverage
- [ ] Primary assertions: Core functionality verified
- [ ] Secondary assertions: Side effects verified
- [ ] Tertiary assertions: Cleanup verified
- [ ] Failure cases tested

### Test Integrity
- [ ] No conditional assertions
- [ ] No catch-without-throw
- [ ] Tests are deterministic
- [ ] Test isolation maintained

### Documentation
- [ ] Code changes documented in same task
- [ ] CLAUDE.md updated if structure changed
- [ ] New docs linked from CLAUDE.md
- [ ] Code examples tested

### Evidence Requirements
- [ ] Claims backed by command output
- [ ] Test results shown
- [ ] Before/after evidence for bug fixes

### Code Quality
- [ ] Unused imports removed
- [ ] Dead code removed
- [ ] Stale comments removed
- [ ] No commented-out code

### Spec Consistency
- [ ] Docs match current code behavior
- [ ] Tests reference existing functions
- [ ] No broken links in documentation
```

**Integration:** Add checklist to PR template and require reviewers to check all boxes before approval.

### Step 2: Create Documentation Freshness Workflow

**Problem:** Documentation drifts from code. "I'll update the docs later" never happens.

**Solution:** Code changes and doc updates happen in the same task.

**Workflow:**

**Before starting a task:**
1. Read the relevant documentation sections
2. Verify examples match current code
3. If docs are stale, flag it before proceeding

**During implementation:**
1. Make code changes
2. IMMEDIATELY update affected docs
3. Update CLAUDE.md links if structure changed
4. Run link validation to catch orphans

**Before marking task complete:**
```bash
# Check for broken links
find docs -name "*.md" -exec grep -l "\[.*\](.*\.md)" {} \; | \
  while read f; do
    grep -o '\[.*\]([^)]*\.md)' "$f" | \
    while read link; do
      target=$(echo "$link" | sed 's/.*(\(.*\))/\1/')
      if [ ! -f "docs/$target" ]; then
        echo "Broken link in $f: $target"
      fi
    done
  done
```

**Commit message pattern:**
```
[Feature description]

Documentation:
- Updated L1/testing.md with new flow
- Added L2/new-pattern.md
- Verified all links from CLAUDE.md
```

### Step 3: Set Up Aggressive Cleanup Practice

**Problem:** Dead code, unused imports, and stale comments accumulate over time.

**Solution:** Remove dead code as you find it, during every task.

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

**During any task:**
1. Use the relevant file
2. Notice dead code nearby
3. Remove it as part of the same commit
4. Verify nothing breaks (run tests)
5. Note the cleanup in commit message

**Commit message pattern:**
```
[Primary task description]

Cleanup:
- Remove unused imports in X files
- Delete dead function: old_auth_method()
- Remove stale TODO comments from 2023
```

### Step 4: Schedule Periodic Spec Drift Audits

**Problem:** Documentation, tests, and code drift apart over time.

**Solution:** Monthly audits to detect and fix drift.

**Audit checklist:**

**Link integrity (automated):**
```bash
# Check all docs linked from CLAUDE.md are reachable
./scripts/check_docs_links.sh
```

**Stale file detection (automated):**
```bash
# Find docs not updated in 6+ months
find docs -name "*.md" -mtime +180 -ls
```

**Test-to-code alignment (automated):**
```bash
# Tests reference non-existent functions
pytest --collect-only --quiet
```

**Doc-to-code consistency (manual):**
- Code examples in docs match actual code syntax
- Pattern names match current implementation
- File paths referenced in docs exist
- Behavior descriptions match current implementation

**Remediation workflow:**
1. Detection tool identifies drift
2. Categorize: code drift or doc drift
3. Fix: Either update code or update docs
4. Verify: Run detection again
5. Commit: "Fix spec drift in [component]"

### Step 5: Make the New Starter Test Part of Onboarding

**Problem:** New contributors struggle because onboarding documents assume context they don't have.

**Solution:** The New Starter Test becomes part of the onboarding process.

**Onboarding checklist:**

1. **Clone the repository**
2. **Read only:** README.md, CLAUDE.md, and docs linked from CLAUDE.md
3. **Try to:**
   - Run the project locally
   - Add a simple feature
   - Run the tests
   - Make a documentation change
4. **Document every question** you had to ask
5. **Report gaps** to the team

**Team action:**
- Review gaps reported by new starters
- Update CLAUDE.md or linked docs to address gaps
- Iterate until new starters can onboard without asking questions

**Quarterly audit:**
- Even if no new team members joined, run the New Starter Test quarterly
- Prevents accumulated implicit knowledge
- Ensures entry points remain clear

---

## Putting It All Together

### Migration Timeline

**Week 1: Phase 0 (Assessment)**
- Run New Starter Test
- Identify gaps using pyramid levels
- Create prioritized roadmap

**Weeks 2-3: Phase 1 (L0 Foundation)**
- Restructure file layout by domain
- Write CLAUDE.md (under 150 lines)
- Establish worktree conventions
- Audit: Can a new starter navigate?

**Weeks 4-7: Phase 2 (L1 Feedback Loops)**
- Add stack test infrastructure
- Implement app-startup test
- Add sequential tests for core flows
- Implement full-loop assertions

**Weeks 8-10: Phase 3 (L2 Guardrails)**
- Create test-integrity skill
- Add verify+ skill
- Set up PreToolUse/PostToolUse hooks
- Enforce constitutional rules

**Weeks 11-12: Phase 4 (L3 Optimization)**
- Set up jcodemunch
- Create intent classification
- Implement routing guardrails
- Measure token savings

**Week 13+: Phase 5 (L4 Culture)**
- Establish review checklists
- Implement doc freshness workflow
- Practice aggressive cleanup
- Schedule periodic drift audits
- Make New Starter Test part of onboarding

### Key Success Factors

1. **Incremental adoption:** Each phase delivers value independently
2. **Team-wide participation:** L0 and L4 require whole-team buy-in
3. **Tooling investment:** L2 and L3 require upfront tooling work
4. **Continuous practice:** L4 is not a one-time cleanup—it's ongoing
5. **Measurement:** Track token savings, debugging time, and onboarding success

### Common Pitfalls to Avoid

**Don't:**
- Try to implement all phases at once
- Skip Phase 0 (assessment)
- Defer documentation updates to "later"
- Allow exceptions to constitutional rules
- Treat cleanup as a quarterly sprint

**Do:**
- Start with L0 Foundation (highest ROI)
- Implement incrementally based on priority
- Update docs in the same task as code changes
- Remove dead code as you find it
- Practice the New Starter Test regularly

---

## Further Reading

- [L0 Foundation](../L0-foundation.md) — Project structure patterns
- [L1 Feedback Loops](../L1-feedback-loops.md) — Stack tests and assertions
- [L2 Behavioral Guardrails](../L2-behavioral-guardrails.md) — Skills and hooks
- [L3 Optimization](../L3-optimization.md) — Token efficiency
- [L4 Culture](../L4-culture.md) — Documentation rigor and cleanup
- [Anti-Patterns](./anti-patterns.md) — Common mistakes to avoid
