# Reference Telegram Trading Bot Project — Agentic Patterns in Production

**Project:** Telegram trading bot — Trading automation platform (DEX swaps, bridges, limit orders, DCA strategies, stop-loss, trailing stops)

**Tech Stack:** Node.js, PostgreSQL/TimescaleDB, Redis, Docker, Ethereum testnets

**Scale:** Production-grade with comprehensive test coverage, real testnet blockchain trading

This case study demonstrates how all five levels of the agentic patterns pyramid manifest in a production codebase. The project handles real blockchain transactions, manages user funds, and operates with financial-grade reliability requirements.

---

## L0 in Practice — Foundation

### CLAUDE.md as Constitution

The project's CLAUDE.md is a 218-line contract that establishes the project's constitutional mandates. Unlike sprawling documents that agents cannot retain, it serves as a concise reference point for all development activity.

**Nine Constitutional Mandates:**

1. **No Mock System Components** — Never mock logger, never mock ethers, never assert on log calls
2. **Docker-First Development** — No local OS execution of app runtime
3. **Container Preservation** — Never touch containers you didn't create, never prune Docker systems
4. **Full Accounting** — Every transaction completely accounted for
5. **Belt-and-Braces** — Multiple validation layers for financial operations
6. **No Hardcoded Strings** — All event names, UI strings, URLs, configs use constants
7. **Provider-Agnostic Design** — No hardcoded provider names ('alchemy', 'moralis')
8. **Service Initialization Pattern** — All services extend AbstractService with structured dependencies
9. **Service-Identified Logging** — `this.logInfo(SERVICE_NAME, 'message')` pattern

These rules are not suggestions — they are enforced through L2 skill overlays.

### Progressive Disclosure

Entry points guide agents from shallow to deep:

1. **README.md** — Platform overview, quick start, feature list
2. **CLAUDE.md** — Constitutional mandates, skills reference, quick checks
3. **docs/README.md** — Documentation hub with coverage tracking (92% as of 2026-02-19)
4. **docs/index.md** — Full documentation index by functional area

Each layer provides enough context to decide whether to go deeper. A new agent can understand what the project does from README alone, then discover patterns through CLAUDE.md, then dive into specific docs.

### Git Worktree Development

The worktree at `.worktrees/tg-dash/` demonstrates feature isolation:

- Separate working directory for telegram dashboard development
- Shared git object store, independent working tree
- No risk to main branch during experimental work
- Clean slate for each feature branch

### Documentation as Contract

The project treats documentation as a living contract with the codebase. When code changes, docs update in the same task. DOCS commits at 13.5% of the total (172 of 1,276 non-merge commits) confirm this is not aspirational — it is practiced daily.

### Documentation Health Tracking

`docs/README.md` tracks coverage:

```markdown
**📅 Last Updated:** 2026-02-19 | **Coverage:** 92%
```

Coverage tracking ensures documentation freshness is visible and measurable, not assumed.

### Plan Archival

Completed plans are deleted once their work is merged. Version control preserves history — keeping stale plans in an `archive/` directory pollutes context and creates confusion about what's current. Agents don't need access to old plans; they need confidence that current docs reflect current reality.

### Continuous Documentation Reorganization

The docs structure evolves with the codebase. When `06-chat-system/` was added for multi-platform chat abstraction, superseded docs were deleted rather than archived. Version control preserves history — old docs left in `archive/` directories pollute context and create ambiguity about what's current. If a doc no longer reflects the system, delete it.

### Aggressive Cleanup

Dead code, stale comments, and superseded documentation are removed as they are encountered — not deferred to cleanup sprints. REFACTOR commits at 8.5% (108 of 1,276) show continuous quality maintenance distributed across the project's lifetime rather than concentrated in dedicated sprints.

---

## L1 in Practice — Feedback Loops

### StackTestUtils

The backbone of stack testing is `tests/config/stack-utils.js` — a utility class that provides:

- **Container lifecycle management** — `initialize()`, `cleanup()`, `startContainers()`, `stopContainers()`
- **Authentication management** — `makeAuthenticatedRequest()`, `getAgentToken()`, `getUserToken()`
- **Health checks** — `waitForAppReady()`, `waitForBootstrapCompletion()`
- **Database access** — `getDatabaseConnections()` for direct verification
- **Log search** — `searchDockerLogs()` for debugging
- **Chain verification** — `verifyTransactionOnChain()` for blockchain operations

This is not a lightweight mock utility — it's production-grade infrastructure that spins up real Docker stacks, waits for real readiness, and verifies real effects. The class has grown organically over many sessions and has fallen behind the project's own refactoring principles ([L0: Deep Modules](../L0-foundation.md#pattern-01--deep-modules)) — it would benefit from decomposition into focused modules (container lifecycle, authentication, assertion helpers) with clean interfaces.

### StackContainerManager

`tests/config/stack-container-manager.js` provides Docker lifecycle management:

```javascript
const processId = process.pid;
const randomSuffix = Math.random().toString(36).substring(2, 6);
this.projectFullName = `${prefix}-${testName}-${processId}-${randomSuffix}`;
```

Key features:
- **Unique container names** — No collision between concurrent test runs
- **Dynamic port allocation** — Via `PortAllocator` class (10000-65535 range)
- **Per-test compose files** — `docker-compose-stack-{test-name}-{pid}-{random}-{timestamp}.yml`
- **Transient volumes** — Disappear with `docker compose down -v`

### PortAllocator

`tests/config/port-allocator.js` implements dynamic port allocation:

```javascript
async isPortAvailable(port, host = '127.0.0.1') {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.listen(port, host, () => {
            server.once('close', () => resolve(true));
            server.close();
        });
        server.on('error', () => resolve(false));
        setTimeout(() => {
            server.close();
            resolve(false);
        }, 1000);
    });
}
```

No hardcoded ports, no conflicts, true parallel test execution.

### Health Endpoint with Bootstrap Status

The health endpoint runs in test mode, decorating responses with real service diagnostics and dependency connectivity. Tests poll this endpoint until bootstrap completes:

```javascript
// GET /health?mode=test
{
  "status": "healthy",
  "timestamp": "2026-03-26T10:00:00Z",
  "version": "2.4.1",
  "uptime": 42.5,
  "services": {
    "postgres": { "connected": true, "latency_ms": 3 },
    "redis": { "connected": true, "latency_ms": 1 },
    "email_relay": { "configured": true, "smtp_verified": true },
    "message_queue": { "connected": true, "pending_jobs": 0 },
    "secrets_manager": { "connected": true, "resolved_secrets": 14 }
  },
  "bootstrap": {
    "completed": true,
    "completedAt": "2026-03-26T10:00:01Z",
    "results": {
      "usersLoaded": 3,
      "walletsConfigured": 5,
      "chainsInitialized": 2
    }
  }
}
```

The `services` block reports real-time dependency health — each external service's connectivity, latency, and configuration status. This is the richer signal: bootstrap might report `completed: true` but a critical dependency (email relay, blockchain node) could be down. Tests check `services` to ensure the full dependency graph is healthy, not just that initialization ran.

The `bootstrap.completed` flag is the gate: no domain test runs until this is `true`. The `services` block is the diagnostic signal: if bootstrap succeeds but a service is down, the agent knows exactly which dependency to investigate.

### Test Fixture Bootstrapping

Domain tests need realistic data: a user can't place a trade without a funded wallet. The bootstrap system loads test fixture data from JSON configuration:

```javascript
// config/bootstrap-data/bootstrap.json (simplified)
{
  "users": [
    {
      "userId": 1,
      "email": "test_trader_1@test.example",
      "role": "trader",
      "wallets": [{
        "chainId": 11155111,
        "address": "0x93eb...",
        "privateKey": "0xf286..."
      }]
    }
  ],
  "agents": [...],
  "tokens": [...],
  "testSettings": {
    "priceInjection": true,
    "syntheticOrders": false
  }
}
```

Bootstrapping loads via the canonical service interfaces used by the system — not direct database inserts. The startup test sequence is: (1) containers come up, (2) health endpoint reports all services connected, (3) bootstrap reports `completed: true`, (4) test users exist and wallets are funded. Only then do domain tests begin.

Tests are ordered by natural dependency:

```
tests/stack/
├── system/
│   └── app-startup-dependencies.stack.test.js    # Foundation
├── authentication/
│   ├── agent-auth-server.stack.test.js           # Auth layer
│   ├── registration-flow-complete.stack.test.js
│   └── user-registration-wallet-creation.stack.test.js
├── onboarding/
│   ├── telegram-onboarding-flow.stack.test.js    # User setup
│   └── telegram-ui-state.stack.test.js
├── backup/
│   └── backup-restore-cycle.stack.test.js        # Data safety
├── portfolio/
│   ├── portfolio-tracking-service.stack.test.js  # Asset management
│   ├── tax-calculation.stack.test.js
│   └── tax-reporting.stack.test.js
└── trading/
    ├── simple-transfer-execution.stack.test.js   # Basic trading
    ├── dex-swap-execution.stack.test.js
    ├── bridge-stargate.stack.test.js
    ├── bridge-relay.stack.test.js
    ├── bridge-debridge.stack.test.js
    ├── position-open-execution.stack.test.js
    ├── limit-order-4-stage-pipeline-e2e.stack.test.js
    ├── limit-order-execution.stack.test.js
    ├── dca-strategy-execution.stack.test.js
    ├── stop-loss-take-profit.stack.test.js
    ├── trailing-stop.stack.test.js
    ├── oco-bracket-order.stack.test.js
    ├── telegram-extended-trading.stack.test.js
    ├── telegram-mcp-convergence.stack.test.js
    └── native-wrap-unwrap.stack.test.js
```

If `app-startup-dependencies` fails, agents know: don't debug trading logic — the foundation is broken.

### No-Mock Policy

Constitutional mandate #1: "No Mock System Components"

Stack tests use:
- **Real PostgreSQL/TimescaleDB** — Run in Docker containers
- **Real Redis** — Run in Docker containers
- **Real testnet blockchains** — Ethereum Sepolia for transaction verification
- **Real KMS integration** — Infisical for secret resolution

The only acceptable mocks are external services without testnets — and even then, mocks are the last resort, not the default.

### Trading Stack Tests — Full-Loop Verification on Chain

Trading stack tests demonstrate the most rigorous end-to-end assertion pattern in the project. Each trading journey (DEX swap, limit order, DCA, bridge) verifies through five distinct verification layers — all accessed through public API endpoints or on-chain RPC calls, never by querying databases directly.

**The trading verification sequence** (using DEX swap as example):

1. **Primary**: POST to `/api/v1/orders` returns 201 with order ID, strategy ID, and initial status
2. **Order completion**: `waitForOrderCompletion()` polls the order status endpoint until the strategy reaches a terminal state, with `expectedStrategyType` filtering and retry limits
3. **On-chain verification**: `verifyTransactionOnChain()` confirms the transaction exists on the blockchain with the required number of block confirmations
4. **Comprehensive verification**: `verifyTransactionComplete()` checks both database status ('confirmed') and blockchain receipt (blockNumber, gasUsed) in a single call
5. **Email content verification**: `verifyDexSwapEmail()` confirms the confirmation email was sent and that its contents reflect the full trade details — token addresses, token symbols, transaction hash, strategy type, and order ID

For a simple transfer, `verifyTransactionEmail()` checks chain details, recipient address, amount, and token symbol. For a limit order executing through the 4-stage pipeline (TRIGGER → OPEN → MANAGE → CLOSE), each stage transition is verified: order moves from PENDING through MONITORING, TRIGGERED, EXECUTING to FILLED, with dependent strategies (stop-loss, take-profit) created and linked via `dependsOnStrategy` relationships.

The limit order test verifies across all four stages:
- Stage 1 (TRIGGER): Order created, price data collection begins
- Stage 2 (OPEN): Price injected to trigger threshold, DEX swap executes
- Stage 3 (MANAGE): Dependent strategies created with correct `dependsOnStrategy` links, waiting state verified
- Stage 4 (CLOSE): Exit strategy executes, all strategies reach 'completed' status, transaction verified on chain, confirmation email verified with full order contents

Every trading test follows this pattern: create order via API → wait for completion via polling → verify on blockchain → verify in system via API → verify email notification with content matching. No layer is skipped, and each layer proves something the previous layer cannot.

---

## L2 in Practice — Behavioral Guardrails

### 8 Skill Overlays

The `.claude/skills/` directory contains 8 skill overlays:

1. **brain+** — Design with stack-first considerations
2. **debug+** — Docker abstraction, log discipline, proper affordances
3. **plan+** — Multi-step implementation with stack test planning
4. **tdd+** — RED-GREEN-REFACTOR with full-loop assertions
5. **verify+** — Evidence before claims (zero-defect tolerance)
6. **review+** — Stack-first compliance checks
7. **test-integrity** — Zero-escape-hatch policy enforcement
8. **test-coverage-guard** — Coverage tracking

Each skill extends a superpowers base and adds project-specific constraints.

### Skill Chain Composition

From `brain+/SKILL.md`:

```markdown
## Integration

After design approved:
- Use `plan+` for implementation planning
- Design document feeds testing strategy section
```

From `verify+/SKILL.md`:

```markdown
## Zero Defect Tolerance

FORBIDDEN: "This failing test is unrelated to my change"
FORBIDDEN: "This warning was already there"
FORBIDDEN: "This is a known issue, not caused by my work"

REQUIRED: Fix every failure, error, and warning before claiming done
```

The chain enforces a complete development lifecycle: design → plan → implement → verify → review.

### Test Integrity Rules

`test-integrity/SKILL.md` enforces zero-escape-hatch policy:

**Forbidden patterns:**
- Conditional assertions (`if (response) { expect(...) }`)
- Catch without rethrow
- Optional chaining on assertions (`expect(res?.data)`)
- Early returns before assertions
- Try-catch wrapping test logic

**The rule:** "Tests that can't fail, can't prove anything works."

### Constitutional Rule Enforcement

Skills are the mechanism by which CLAUDE.md's constitutional rules become executable:

```markdown
## Stack-First Additions

### Design Questions to Ask

During clarifying questions phase, also ask:
- "What stack test would validate this user journey?"
- "What second/third order consequences should be verified?"
- "Which services are involved beyond the primary action?"
- "What constitutional rules apply (logger, blockchain)?"
```

When `tdd+` is invoked, it knows to reject mocked loggers and mocked ethers because those are constitutional rules #1.

---

## L3 in Practice — Optimization

### Intent-Based Command Routing

The project implements L3's smart routing pattern ([Pattern 3.1](../L3-optimization.md#pattern-31--smart-routing-tool-selection)) through a combination of skills and hooks. Raw shell commands — `grep`, `cat`, `find` — are intercepted by PostToolUse hooks that classify intent ([Pattern 3.2](../L3-optimization.md#pattern-32--intent-classification)) and redirect to structured tools. `grep -r "export.*function" .` becomes a symbol search; `cat file.ts` becomes a targeted read; `find . -name "*.ts"` becomes a glob query. Environment-aware routing ([Pattern 3.3](../L3-optimization.md#pattern-33--environment-aware-routing)) detects whether jcodemunch indexes are available and degrades gracefully to raw tools when they aren't.

### RTK Integration

The [RTK (Rust Token Killer)](https://github.com/rtk-ai/rtk) CLI proxy filters noisy git output — `git status`, `git diff`, `git log` — stripping line noise and returning structured results. This is the simplest L3 win: install RTK, configure it as a hook, and git commands become ~60% cheaper in token usage with no behavior change.

### jcodemunch for Structured Code Search

When the repository is indexed by [jcodemunch](https://github.com/nicolo-ribaudo/jcodemunch), agent searches bypass raw grep entirely. `search_symbols` returns typed results with file locations and summaries — the same information as `grep -r` output but at ~15% of the token cost. The scout pattern ([Pattern 3.4](../L3-optimization.md#pattern-34--context-engineering-the-scout-pattern)) applies here: a sub-agent maps the codebase structure first, then the implementer works with a concise index instead of re-deriving file locations each session.

### TOON Serialization for MCP Responses

The project's MCP server uses [TOON (Token-Oriented Object Notation)](https://github.com/toon-format/toon) to serialize tabular responses ([Pattern 3.7](../L3-optimization.md#pattern-37--toon-serialization-for-mcp-response-optimization)). Order lists, portfolio holdings, and market data — uniform object arrays returned to agents from internal tools — are compressed to ~35-40% of their JSON size by declaring field names once in a header row. The agent receives the same data; it just costs fewer tokens to consume.

### Structured Output Over Raw Text

Across the agent-facing tool surface, structured output ([Pattern 3.5](../L3-optimization.md#pattern-35--structured-output-over-raw-text)) replaces raw text commands wherever possible. The result: agents reason about typed data structures instead of parsing unstructured text — faster, fewer errors, less wasted context.

---

## L4 in Practice — Standards & Measurement

### Evidence-Based Verification

The `verify+` skill enforces evidence before claims:

```markdown
## Evidence Format

When claiming completion, include:

## Verification Evidence

**Unit Tests:**
[paste test output showing 0 failures]

**Stack Tests:**
[paste suite output showing pass]

**Full-Loop Verified:**
- [x] Primary: [what was verified]
- [x] Secondary: [side effects verified]
- [x] Tertiary: [downstream verified]
```

"No completion claims without fresh verification evidence" is the iron law.

### Zero-Defect Tolerance

From `verify+/SKILL.md`:

```
FORBIDDEN: "This failing test is unrelated to my change"
FORBIDDEN: "This warning was already there"
FORBIDDEN: "This is a known issue, not caused by my work"
```

Every error, warning, and failure must be addressed. Not "relevant" errors — ALL of them.

---

## Cross-Level Integration

### How L0 Enables L1

CLAUDE.md's "No Mock System Components" rule (L0 constitutional mandate) makes stack tests (L1) meaningful. If tests mocked everything, they'd provide no confidence. The constitutional rule forces real testing.

### How L1 Enables L2

Stack tests provide the verification targets that skills (L2) enforce. The `tdd+` skill knows to require full-loop assertions because stack tests are designed around them.

### How L2 Enables L3

Skills establish patterns that optimization (L3) can automate. Intent classification started as a manual pattern, then became codified in the project's intent routing system.

### How L3 Amplifies L0-L2

Token optimization isn't just cheaper — it makes agents more effective. Structured search means faster discovery. Smart routing means fewer dead-end explorations. TOON serialization means more context available for actual reasoning. L3 amplifies the value of every pattern below it by making agent sessions tighter and more focused.

---

## Key Takeaways

1. **Constitutional rules must be enforceable** — The project's 9 mandates are codified in skills that activate during development, not just documented and forgotten.

2. **Testing infrastructure is production code** — StackTestUtils is the foundation that makes agentic development possible, though it has grown beyond ideal module size and would benefit from decomposition.

3. **Isolation enables parallelism** — Dynamic port allocation, unique container names, and per-test compose files allow stack tests to run concurrently without collision.

4. **Evidence beats claims** — The `verify+` skill's iron law ("No completion claims without fresh verification evidence") prevents false confidence from propagating.

5. **Documentation is a contract** — 92% coverage tracking and continuous reorganization treat docs as living artifacts. Superseded docs are deleted, not archived — version control preserves history.

6. **All levels integrate** — L0 constitutional rules enable L1 stack tests, which provide targets for L2 skills, which L3 amplifies through token optimization, which L4 standards & measurement maintains.

---

## Commit History Analysis

The reference project's git history provides empirical evidence for how agentic development operates at scale. The analysis covers 1,497 commits from 2025-10-31 to 2026-03-10 (~5 months), classified by type.

![Commit Analysis Dashboard](../diagrams/commit-analysis-dashboard.png)

### Commit Type Distribution (non-merge: 1,276 commits)

| Type | Count | Share |
|------|-------|-------|
| FEATURE | 297 | 23.3% |
| CHORE | 219 | 17.2% |
| BUGFIX | 201 | 15.8% |
| DOCS | 172 | 13.5% |
| TEST | 159 | 12.5% |
| SECURITY | 110 | 8.6% |
| REFACTOR | 108 | 8.5% |
| CI | 10 | 0.8% |

### Feature-to-Test Ratio

The overall feature-to-test ratio is 0.54x (one test commit for every two feature commits). This ratio varies significantly by month:

- **December 2025**: 2.71x (test-heavy — infrastructure and test framework buildout)
- **January 2026**: 1.64x (balanced — steady feature development with testing)
- **February 2026**: 0.33x (feature-heavy — peak development velocity)
- **March 2026**: 0.52x (rebalancing — testing catches up after the February surge)

The November-December spike reflects the upfront investment in testing infrastructure (StackTestUtils, container isolation, bootstrap system) that enabled the higher feature velocity in subsequent months.

### Development Velocity

February 2026 was the busiest period: 629 non-merge commits across 17 active days (37.0 commits/day average).

### What the Data Shows

1. **Testing is a first-class output, not an afterthought** — 12.5% of commits are TEST, comparable to DOCS (13.5%). Test infrastructure received dedicated investment in November-December before the feature acceleration in January-February.

2. **Documentation keeps pace with code** — DOCS commits at 13.5% indicate continuous documentation updates, consistent with the L0 documentation-as-contract pattern. Docs are not deferred to a separate phase.

3. **Refactoring is continuous** — 8.5% REFACTOR commits show ongoing code quality maintenance rather than periodic cleanup sprints. This aligns with L0 aggressive cleanup as a continuous practice.

4. **Bugfix rate is high but expected** — 15.8% BUGFIX commits reflect iterative development where bugs are found and fixed rapidly through the stack test feedback loop. The high diagnosticity of stack tests means bugs are caught early and fixed immediately (L2 zero-defect tolerance), rather than accumulating.

5. **Security is a significant concern** — 8.6% SECURITY commits reflect continuous attention to security in a financial application handling real funds and blockchain transactions. This is a domain-specific requirement that compounds with the zero-defect tolerance pattern.

6. **CHORE commits reveal infrastructure investment** — 17.2% CHORE commits cover Docker configuration, dependency management, CI pipeline setup, and environment configuration. This overhead is the cost of running a full Docker stack for every test — the investment that makes stack tests possible.

