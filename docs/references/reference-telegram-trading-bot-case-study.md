---
reviewed: 2026-11-19
---

# Reference Project: Telegram Trading Bot

This case study is this project's own experience, n=1: one private project by the author of these patterns, with no independent
replication. It describes what the project does; it is not evidence that a pattern works elsewhere.

**Project:** Telegram trading bot: DEX swaps, bridges, limit orders, DCA strategies, stop-loss and trailing stops.

**Tech stack:** Node.js, PostgreSQL/TimescaleDB, Redis, Docker.

**Test environment:** Stack tests run against Ethereum testnets (Sepolia), so no test moves real funds.

The bot builds and sends blockchain transactions for its users. A sent transaction cannot be undone, which is class
R4 in [Pattern 1.8](../L1-patterns/1.8-reversibility-blast-radius.md). The sections below show where each layer
appears in the codebase.

---

## L0: Foundation

### CLAUDE.md as Constitution

The project's CLAUDE.md is 218 lines, above the 200-line threshold that
[Pattern 0.4](../L0-foundation.md#pattern-04--agent-instruction-file-as-project-constitution) sets. It lists nine
constitutional mandates:

1. **No Mock System Components**: never mock the logger, never mock ethers, never assert on log calls
2. **Docker-First Development**: the app runtime never runs on the host OS
3. **Container Preservation**: never touch containers you did not create, never prune Docker systems
4. **Full Accounting**: every transaction is completely accounted for
5. **Belt-and-Braces**: several validation steps for each financial operation
6. **No Hardcoded Strings**: event names, UI strings, URLs and configs use constants
7. **Provider-Agnostic Design**: no hardcoded provider names (`'alchemy'`, `'moralis'`)
8. **Service Initialization Pattern**: every service extends `AbstractService` with structured dependencies
9. **Service-Identified Logging**: `this.logInfo(SERVICE_NAME, 'message')`

The project carries these rules in L2 skill overlays, which are prompt-level: they raise the chance that the agent
follows a rule and guarantee nothing ([Pattern 2.4](../L2-behavioral-guardrails.md#pattern-24--constitutional-rules)).
This case study does not show which of the nine rules a hook or CI check holds.

### Progressive Disclosure

Four entry points lead an agent from shallow to deep
([Pattern 0.2](../L0-foundation.md#pattern-02--progressive-disclosure)):

1. **README.md**: platform overview, quick start, feature list
2. **CLAUDE.md**: constitutional mandates, skills reference, quick checks
3. **docs/README.md**: documentation hub, which records its own coverage figure (92%)
4. **docs/index.md**: full documentation index by functional area

Each step gives enough context to decide whether to go deeper. Completed plans and superseded docs are deleted once
their work is merged, not archived; version control is the archive
([Pattern 0.8](../L0-foundation.md#pattern-08--aggressive-cleanup)).

---

## L1: Closed Loop Design and Verification

### Stack Test Tooling

`tests/config/stack-utils.js` (`StackTestUtils`) provides:

- **Container lifecycle**: `initialize()`, `cleanup()`, `startContainers()`, `stopContainers()`
- **Authentication**: `makeAuthenticatedRequest()`, `getAgentToken()`, `getUserToken()`
- **Health checks**: `waitForAppReady()`, `waitForBootstrapCompletion()`
- **Database access**: `getDatabaseConnections()`, which some tests use for direct verification
- **Log search**: `searchDockerLogs()`
- **Chain verification**: `verifyTransactionOnChain()`

It is one class of 5,888 lines and breaks the rule in
[Pattern 1.1](../L1-patterns/1.1-stack-tests.md#stack-tooling-is-production-code) that stack tooling is split into
focused modules. Direct database verification breaks
[Pattern 1.2](../L1-patterns/1.2-full-loop-assertions.md#anti-pattern), which keeps assertions on the API.

`tests/config/stack-container-manager.js` isolates concurrent runs
([Pattern 1.4](../L1-patterns/1.4-container-isolation.md)):

- container names built from the test name, process id and a random suffix
- ports from a `PortAllocator` class in the range 10000-65535
- one generated compose file per test run
- volumes removed with `docker compose down -v`

### Health Endpoint and Bootstrap

The app's health endpoint has a test mode that reports each dependency (PostgreSQL, Redis, email relay, message
queue, secrets manager) and a `bootstrap.completed` flag, in the form shown in
[Pattern 1.1](../L1-patterns/1.1-stack-tests.md#health-endpoint-test-mode). No domain test runs until the flag is
`true`; if bootstrap completes but a dependency is down, the `services` block names it.

Bootstrap loads test users, wallets, agents and tokens from `config/bootstrap-data/bootstrap.json` through the
application's service interfaces, not by direct database inserts. The start-up sequence is: containers come up, the
health endpoint reports every service connected, bootstrap reports `completed: true`, test users exist and their
wallets are funded. Domain tests start after that.

Tests are ordered by dependency ([Pattern 1.3](../L1-patterns/1.3-sequential-design.md)):

```text
tests/stack/
├── system/
│   └── app-startup-dependencies.stack.test.js    # Foundation
├── authentication/
│   ├── agent-auth-server.stack.test.js
│   └── registration-flow-complete.stack.test.js
├── onboarding/        # Telegram onboarding and UI state
├── backup/            # Backup and restore cycle
├── portfolio/         # Portfolio tracking and tax reporting
└── trading/
    ├── dex-swap-execution.stack.test.js
    ├── limit-order-4-stage-pipeline-e2e.stack.test.js
    └── ... (13 further trading journeys)
```

If `app-startup-dependencies` fails, the agent does not debug trading logic: the foundation is broken.

Stack tests use real PostgreSQL/TimescaleDB and Redis in Docker, Ethereum Sepolia and Infisical for secrets
([Pattern 1.5](../L1-patterns/1.5-real-dependencies.md)). The project mocks only an external service that has no
test environment.

### Trading Journeys on Chain

Each trading journey (DEX swap, limit order, DCA, bridge) is verified in five steps. For a DEX swap:

1. **Order accepted**: `POST /api/v1/orders` returns 201 with order id, strategy id and initial status.
2. **Order completed**: `waitForOrderCompletion()` polls the order status endpoint until the strategy reaches a
   terminal state, filtered by `expectedStrategyType` and with a retry limit.
3. **On chain**: `verifyTransactionOnChain()` confirms the transaction exists with the required block
   confirmations.
4. **Recorded**: `verifyTransactionComplete()` checks the database status (`confirmed`) and the chain receipt
   (`blockNumber`, `gasUsed`) in one call.
5. **Notified**: `verifyDexSwapEmail()` confirms the email was sent and contains the token addresses and symbols,
   transaction hash, strategy type and order id.

Steps 1, 2, 3 and 5 use the API or chain RPC. Step 4 reads the database directly, which
[Pattern 1.2](../L1-patterns/1.2-full-loop-assertions.md#anti-pattern) advises against.

A limit order runs a four-stage pipeline (TRIGGER, OPEN, MANAGE, CLOSE). The test injects a price that crosses the
trigger, checks each status transition from PENDING through MONITORING, TRIGGERED and EXECUTING to FILLED, checks
that the dependent stop-loss and take-profit strategies are linked by `dependsOnStrategy`, and ends with the exit
transaction on chain and the confirmation email.

---

## L2: Behavioral Guardrails

### Skill Overlays

`.claude/skills/` holds eight overlays, each extending a superpowers base skill with project rules: `brain+`
(design), `plan+` (planning with a stack test plan), `tdd+` (RED-GREEN-REFACTOR with full-loop assertions),
`debug+` (Docker and log discipline), `verify+` (evidence before claims), `review+` (stack-first compliance),
`test-integrity` (forbidden test patterns) and `test-coverage-guard` (coverage tracking).

The skills walk the agent through design, plan, implement, verify and review. `brain+` adds design questions, for
example "What stack test would validate this user journey?" and "What constitutional rules apply (logger,
blockchain)?". `test-integrity` lists the forbidden patterns of
[Pattern 1.6](../L1-patterns/1.6-test-integrity.md): conditional assertions, catch without rethrow, optional
chaining on assertions, early returns before assertions and try-catch around test logic. A skill that does not
load, or that the agent ignores, holds nothing.

---

## L3: Optimization

PreToolUse hooks classify raw `grep`, `cat` and `find` commands and redirect them to structured tools, and fall
back to raw tools when no code index is available
([Pattern 3.1](../L3-optimization.md#pattern-31--prefer-native-structured-tools-block-destructive-edits)). Redirection
needs a hook that runs before the command; a hook that runs after it cannot redirect it.

[RTK](https://github.com/rtk-ai/rtk) filters `git status`, `git diff` and `git log` output through a hook.
[jcodemunch](https://github.com/jgravelle/jcodemunch-mcp) returns typed symbol search results with file locations
when the repository is indexed. Both run with the agent's privileges; review them before installing
([Pattern 2.12](../L2-behavioral-guardrails.md#pattern-212--skill-plugin-and-mcp-supply-chain)). The project did
not measure the token or error effect of any of these tools.

---

## L4: Standards & Measurement

The `verify+` skill asks for a completion report with pasted output: unit test output with 0 failures, stack suite
output, and a checklist of primary, second-order and third-order effects verified. Its rule is "No completion claims
without fresh verification evidence". It also forbids the dismissals that
[Pattern 2.5](../L2-behavioral-guardrails.md#pattern-25--zero-defect-tolerance) lists ("unrelated to my change",
"already there", "a known issue").

Pasted output is a claim. [Pattern 4.1](../L4-standards-measurement.md#pattern-41--evidence-based-claims) counts it
as evidence only when a CI run of the same commit backs it.

---

## What This Project Shows

These are observations from one project, not measured results.

1. **Skills carry rules; they do not hold them.** The nine mandates live in skill overlays. A rule that must hold
   needs a hook, a CI check or a sandbox.
2. **The stack tooling is critical code.** Every stack result in the project depends on `StackTestUtils`, so a
   defect in it shows up as a failure in application tests.
3. **Isolation lets stack tests run concurrently.** Unique container names, allocated ports and per-run compose
   files remove collisions between runs.
