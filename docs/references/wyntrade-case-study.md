# Wyntrade Case Study — Agentic Patterns in Production

**Project:** wyntrade-core — Trading automation platform (DEX swaps, bridges, limit orders, DCA strategies, stop-loss, trailing stops)

**Tech Stack:** Node.js, PostgreSQL/TimescaleDB, Redis, Docker, Ethereum testnets

**Scale:** Production-grade with comprehensive test coverage, real testnet blockchain trading

This case study demonstrates how all five levels of the agentic patterns pyramid manifest in a production codebase. Wyntrade is not theoretical — it handles real blockchain transactions, manages user funds, and operates with financial-grade reliability requirements.

---

## L0 in Practice — Foundation

### CLAUDE.md as Constitution

Wyntrade's CLAUDE.md is a 218-line contract that establishes the project's constitutional mandates. Unlike sprawling documents that agents cannot retain, it serves as a concise reference point for all development activity.

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

### Conceptual File Organization

The `src/` directory groups by capability, not technical layer:

```
src/
├── backup/           # Backup/restore domain
├── configs/          # Configuration management
├── constants/        # Shared constants (no hardcoded strings)
├── core/             # ServiceRegistry, ConfigManager, security
├── database/         # Database access layer
├── features/         # Feature-specific implementations
├── locales/          # Internationalization
├── monitoring/       # Observability
├── routes/           # API endpoints
├── services/         # Business logic services (all extend AbstractService)
├── shared/           # Shared services (logging, metadata)
├── utils/            # Utilities
├── web-pages/        # Web UI components
└── unified-platform.js  # Entry point
```

Compare to technical layering (`services/`, `handlers/`, `utils/`, `types/`) — wyntrade's structure lets agents find all backup code in one place, all trading code in another, without cross-referencing four directories.

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

---

## L1 in Practice — Feedback Loops

### StackTestUtils (236KB, 5,888 lines)

The backbone of stack testing is `tests/config/stack-utils.js` — a 236KB utility class that provides:

- **Container lifecycle management** — `initialize()`, `cleanup()`, `startContainers()`, `stopContainers()`
- **Authentication management** — `makeAuthenticatedRequest()`, `getAgentToken()`, `getUserToken()`
- **Health checks** — `waitForAppReady()`, `waitForBootstrapCompletion()`
- **Database access** — `getDatabaseConnections()` for direct verification
- **Log search** — `searchDockerLogs()` for debugging
- **Chain verification** — `verifyTransactionOnChain()` for blockchain operations

This is not a lightweight mock utility — it's production-grade infrastructure that spins up real Docker stacks, waits for real readiness, and verifies real effects.

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

### Stack Sequencer

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

### Intent Classification

Wyntrade implements intent classification for Telegram routing:

`src/core/telegram/intent/intent-classifier.js`:

```javascript
function classifyCallback(data) {
    const callbackMap = {
        [CALLBACKS.CANCEL]: INTENT_TYPES.CANCEL,
        [CALLBACKS.BACK]: INTENT_TYPES.BACK,
        [CALLBACKS.START_REGISTRATION]: INTENT_TYPES.START_REGISTRATION,
        // ... 30+ mappings
    };

    if (callbackMap[data]) {
        return { type: callbackMap[data] };
    }

    if (data.startsWith(CALLBACKS.NAVIGATE_PREFIX)) {
        const target = data.slice(CALLBACKS.NAVIGATE_PREFIX.length);
        return { type: INTENT_TYPES.NAVIGATE, target };
    }

    return { type: INTENT_TYPES.UNKNOWN };
}
```

This pattern mirrors L3's intent classification for command routing — parse input into categories, then route accordingly.

### Environment Detection

The system detects execution mode:

```javascript
const forceContainerMode = this.options.forceContainerMode !== false;

if (forceContainerMode) {
    this.localExecutionMode = false;
    this.useContainers = true;
} else if (!process.env.DOCKER_CONTAINER_ID) {
    this.logger.warn('WARNING: DOCKER_CONTAINER_ID not set - running in local development mode');
}
```

This environment awareness enables context-aware routing decisions (e.g., use test logs vs. docker logs based on whether containers are running).

### Harness-Agnostic Architecture

`src/core/` contains zero framework imports:

- `ServiceRegistry` — Dependency injection without framework coupling
- `ConfigManager` — Configuration management without framework assumptions
- `BullMQManager` — Queue abstraction (could swap implementations)
- `NamespaceDatabase` — Database abstraction

Only `src/routes/` and adapters know about Express. This isolation enables testing, portability, and framework evolution.

---

## L4 in Practice — Culture

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

### Documentation Health Tracking

`docs/README.md` tracks coverage:

```markdown
**📅 Last Updated:** 2026-02-19 | **Coverage:** 92%
```

Documentation is treated as a living contract with the codebase. When code changes, docs update in the same task.

### Plan Archival

`docs/plans/archive/` organizes completed work by month:

```
docs/plans/archive/
├── 2026-02/
│   ├── 2026-02-25-convergence-phase2-intent-classification.md
│   ├── 2026-02-25-convergence-phase4-sft.md
│   ├── 2026-02-27-convergence-phase7-extended-trading.md
│   └── ...
└── 2026-03/
    └── ...
```

Historical plans remain accessible without cluttering active documentation.

### Continuous Documentation Reorganization

The docs structure evolves with the codebase:

```
docs/
├── 01-constitutional/     # Constitutional mandates
├── 02-core-architecture/  # Core systems
├── 03-configuration-bootstrap/
├── 04-services-layer/
├── 05-event-system/
├── 06-chat-system/        # Added as chat platform support expanded
├── 07-api-reference/
├── 08-testing/
├── 09-operations/
├── 10-trading-system/
├── 11-advanced-features/
└── archive/               # Old docs moved here
```

When `06-chat-system/` was added for multi-platform chat abstraction, older docs moved to `archive/` — maintaining discoverability while preventing bloat.

---

## Cross-Level Integration

### How L0 Enables L1

CLAUDE.md's "No Mock System Components" rule (L0 constitutional mandate) makes stack tests (L1) meaningful. If tests mocked everything, they'd provide no confidence. The constitutional rule forces real testing.

### How L1 Enables L2

Stack tests provide the verification targets that skills (L2) enforce. The `tdd+` skill knows to require full-loop assertions because stack tests are designed around them.

### How L2 Enables L3

Skills establish patterns that optimization (L3) can automate. Intent classification started as a manual pattern, then became codified in `intent-classifier.js`. Future optimization layers can route based on these classified intents.

### How L3 Enables L4

Token efficiency (L3) frees resources for documentation rigor (L4). When commands route optimally, agents have budget for thorough verification and documentation updates.

### How L4 Maintains L0-L3

Evidence-based claims (L4) catch violations of constitutional rules (L0). Documentation health tracking (L4) catches drift in skill definitions (L2). The culture layer is the feedback loop that maintains all previous layers.

---

## Key Takeaways

1. **Constitutional rules must be enforceable** — Wyntrade's 9 mandates are codified in skills that activate during development, not just documented and forgotten.

2. **Testing infrastructure is production code** — StackTestUtils at 236KB is not an afterthought. It's the foundation that makes agentic development possible.

3. **Isolation enables parallelism** — Dynamic port allocation, unique container names, and per-test compose files allow stack tests to run concurrently without collision.

4. **Evidence beats claims** — The `verify+` skill's iron law ("No completion claims without fresh verification evidence") prevents false confidence from propagating.

5. **Documentation is a contract** — 92% coverage tracking, plan archival, and continuous reorganization treat docs as living artifacts, not static write-once content.

6. **All levels integrate** — L0 constitutional rules enable L1 stack tests, which provide targets for L2 skills, which establish patterns for L3 optimization, which L4 culture maintains.

---

## Further Reading

- **Wyntrade Repository:** `/home/jerome/wyntrade/wyntrade-core/.worktrees/tg-dash/`
- **CLAUDE.md:** Project constitution and skills reference
- **docs/README.md:** Documentation hub with coverage tracking
- **docs/08-testing/:** Testing methodology guides
- **tests/config/stack-utils.js:** Stack test infrastructure (236KB)
- **.claude/skills/:** 8 skill overlays enforcing behavioral guardrails
