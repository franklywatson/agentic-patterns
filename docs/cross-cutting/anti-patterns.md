---
last-validated-model: claude-opus-5-5
reviewed: 2026-11-19
---

# Pattern Diagnostic Catalog

Find a symptom you see, then open the pattern that is probably missing; its Anti-Pattern section lists the failure
modes. Two anti-patterns that cut across layers are described in full at the end of this page.

## Symptom to Pattern

### L0 Foundation

| Symptom | Likely missing pattern |
|---------|------------------------|
| A source file passes 2000 lines or exports 20+ symbols; edits to one concern break another | [0.1 Deep Modules](../L0-foundation.md#pattern-01--deep-modules) |
| A directory holds 50+ files with no subdirectories, or long filename prefixes stand in for structure | [0.2 Progressive Disclosure](../L0-foundation.md#pattern-02--progressive-disclosure) |
| The instruction file reads like a documentation site, or has no owner or reviewed date | [0.4 Agent instruction file as project constitution](../L0-foundation.md#pattern-04--agent-instruction-file-as-project-constitution) |
| Tests exist but the code's contract is only in prose that has drifted | [0.5 Unit Tests as Contract](../L0-foundation.md#pattern-05--unit-tests-as-contract) |
| Feature work happens on the main branch, or parallel agents share one working directory | [0.6 Git Worktree-Based Development](../L0-foundation.md#pattern-06--git-worktree-based-development) |
| Docs are unreachable from AGENTS.md, duplicate each other, or no longer match the code | [0.7 Documentation as System Map](../L0-foundation.md#pattern-07--documentation-as-system-map) |
| Commented-out code, unused functions and never-enabled flags remain in the working tree | [0.8 Aggressive Cleanup](../L0-foundation.md#pattern-08--aggressive-cleanup) |
| A reader with no context cannot follow the quick start or learn why a decision was made | [0.9 AI-as-New-Starter Standard](../L0-foundation.md#pattern-09--ai-as-new-starter-standard) |
| Skills, hooks and rules have only been added, and no one can say which task each one fixed | [0.10 Prune and Re-baseline Context](../L0-foundation.md#pattern-010--prune-and-re-baseline-context) (see [We Added It So It Must Help](#we-added-it-so-it-must-help)) |
| The instruction file passes a line-count check and still holds stale rules | [0.10](../L0-foundation.md#pattern-010--prune-and-re-baseline-context) (see [Line Caps as a Proxy for Signal](#line-caps-as-a-proxy-for-signal)) |

### L1 Closed Loop Design and Verification

| Symptom | Likely missing pattern |
|---------|------------------------|
| Tests start some services, mock others and are neither fast nor conclusive | [1.1 Stack Tests](../L1-patterns/1.1-stack-tests.md) |
| A failure shows only the primary assertion, with no signal from downstream effects | [1.2 Full-Loop Assertion Layering](../L1-patterns/1.2-full-loop-assertions.md) |
| Iteration is slow because only the whole suite is run, or a failure does not say which step broke | [1.3 Sequential / Additive Test Design](../L1-patterns/1.3-sequential-design.md) |
| Hardcoded ports, "port already in use" in CI, state leaking between runs | [1.4 Container Isolation](../L1-patterns/1.4-container-isolation.md) |
| Mock setup outweighs test code, or tests pass while production fails | [1.5 Real Dependencies](../L1-patterns/1.5-real-dependencies.md) |
| Assertions sit inside `if`, behind optional chaining or after an early return | [1.6 Test Integrity Rules](../L1-patterns/1.6-test-integrity.md) |
| A production incident is fixed without a test that reproduces it first | [1.7 Incident-to-Stack-Test](../L1-patterns/1.7-incident-to-stack-test.md) |
| Every change gets the same review, or risk is judged from the commit message | [1.8 Reversibility and Blast-Radius Classes](../L1-patterns/1.8-reversibility-blast-radius.md#risk-model) (risk model) |
| The agent that fixes a bug also writes or edits the test that proves it | [1.9 Repair Loop with a Frozen Oracle](../L1-patterns/1.9-repair-loop-frozen-oracle.md) |
| The agent summarizes its own canary results, or a gate warns and lets the change through | [1.10 Production Gate and Progressive Confirmation](../L1-patterns/1.10-production-gate-progressive-confirmation.md) |
| A repair workflow that keeps reverting is only alerted on, and nobody can stop it | [1.11 Repair Budget, Circuit Breaker and Stop Authority](../L1-patterns/1.11-repair-budget-circuit-breaker-stop.md) |
| A "self-healing" tool is counted as self-repair, or a mitigation is counted as a fix | [1.12 Self-Healing Tests vs Self-Healing Systems](../L1-patterns/1.12-self-healing-tests-vs-systems.md) |

### L2 Behavioral Guardrails

| Symptom | Likely missing pattern |
|---------|------------------------|
| The same rules are copied into many prompts and have drifted | [2.1 Skill Overlay Architecture](../L2-behavioral-guardrails.md#pattern-21--skill-overlay-architecture) |
| Every change, including a typo fix, runs five phases; or changes ship with no verification or review | [2.1 Skill Overlay Architecture](../L2-behavioral-guardrails.md#pattern-21--skill-overlay-architecture) (skill chain) |
| Hooks warn and the call proceeds, a PostToolUse check is described as blocking, or checks return conflicting severities | [2.3 Hook Automation](../L2-behavioral-guardrails.md#pattern-23--hook-automation) |
| Rules in AGENTS.md say "should" and nothing names what enforces them | [2.4 Constitutional Rules](../L2-behavioral-guardrails.md#pattern-24--constitutional-rules) |
| Errors are waved off as "pre-existing" or "unrelated" | [2.5 Zero-Defect Tolerance](../L2-behavioral-guardrails.md#pattern-25--zero-defect-tolerance) |
| Review comments and incident findings never reach a doc, test or rule | [2.8 Compound Engineering](../L2-behavioral-guardrails.md#pattern-28--compound-engineering) |
| The only control on credentials, destructive commands or network use is a hook or a deny rule on command strings | [2.9 Contain Before You Relax](../L2-behavioral-guardrails.md#pattern-29--contain-before-you-relax) |
| One session reads untrusted input, holds a secret and can act outside | [2.10 Least Agency and Session Composition](../L2-behavioral-guardrails.md#pattern-210--least-agency-and-session-composition) |
| The agent runs on a developer's personal token, or logs show only a shared service account | [2.11 Agent Identity and Delegation](../L2-behavioral-guardrails.md#pattern-211--agent-identity-and-delegation) |
| Skills, plugins and MCP servers are installed from a README one-liner and follow a moving branch | [2.12 Skill, Plugin and MCP Supply Chain](../L2-behavioral-guardrails.md#pattern-212--skill-plugin-and-mcp-supply-chain) |
| Every command prompts for approval, or a requester approves their own agent's change | [2.13 Risk-Tiered Review](../L2-behavioral-guardrails.md#pattern-213--risk-tiered-review) |

### L3 Optimization (optional)

| Symptom | Likely missing pattern |
|---------|------------------------|
| Raw `grep` or `cat` returns whole files and hundreds of lines when a symbol search or a line range would do, or routing assumes a tool the machine lacks | [3.1 Prefer Native Structured Tools](../L3-optimization.md#pattern-31--prefer-native-structured-tools-block-destructive-edits) |
| Broad searches fill the main session with matches it carries forward | [3.2 Context Isolation](../L3-optimization.md#pattern-32--context-isolation-scout) |

Changes in one repository that break a contract in another are an architecture question, not an L3 pattern: see
[Monorepo or multi-repo for agents?](faq.md#monorepo-or-multi-repo-for-agents).

### L4 Standards & Measurement, and Earned Autonomy

| Symptom | Likely missing pattern |
|---------|------------------------|
| "Tests should pass" with no output, or pasted output with no CI run behind it | [4.1 Evidence-Based Claims](../L4-standards-measurement.md#pattern-41--evidence-based-claims) |
| Metrics count tokens or commands, or have no threshold, action or owner | [4.4 Agentic Development Metrics](../L4-standards-measurement.md#pattern-44--agentic-development-metrics) |
| Quality thresholds live in workflow files, or checks run only in a session hook | [4.5 CI Guardrails](../L4-standards-measurement.md#pattern-45--ci-guardrails) |
| A prompt, skill or model change is accepted because it feels better | [4.6 Context Eval](../L4-standards-measurement.md#pattern-46--context-eval) |
| Nobody is named as answering for agent-written code | [4.7 Author of Record](../L4-standards-measurement.md#pattern-47--author-of-record-and-agent-register) |
| The team ships code nobody can explain or debug without the agent | [4.9 Deliberate Practice](../L4-standards-measurement.md#pattern-49--deliberate-practice) |
| An agent workflow keeps running after its owner left, an agent lists itself, or its workflow edits the list that sets its permissions | [A.1 Autonomy Register](../earned-autonomy.md#pattern-a1--autonomy-register) |
| Success counts come from the workflow's own report | [A.2 Evidence Ledger](../earned-autonomy.md#pattern-a2--evidence-ledger) |
| An agent or its workflow raises its own permissions after a run of successes, or grants are never reviewed against results | [A.3 Promotion, Demotion and the Cap Gate](../earned-autonomy.md#pattern-a3--promotion-demotion-and-the-cap-gate) |
| Nobody can say which practices exist in the repository and which are only written down | [A.4 Census](../earned-autonomy.md#pattern-a4--census) |
| An unattended workflow has no stop, or the stop was never used | [A.5 Tested Stop](../earned-autonomy.md#pattern-a5--tested-stop) |
| The agent's own hooks or harness settings can be edited by the agent | [A.6 Enforcement Through Hooks](../earned-autonomy.md#pattern-a6--enforcement-through-hooks) |

## Anti-Patterns Linked From Pattern Docs

[Pattern 0.10](../L0-foundation.md#pattern-010--prune-and-re-baseline-context) links to these two entries.

### We Added It So It Must Help

**Symptom**: Skills, hooks, routing notes and instruction-file rules have only ever been added. No one can say which
task each one fixed. The configuration was last changed before the current model generation.

**Why it happens**: Each addition answered a real failure, so removing it feels like reintroducing the failure.
Nothing measures an artifact's contribution, so it stays by default.

**Fix**: Apply [Pattern 0.10](../L0-foundation.md#pattern-010--prune-and-re-baseline-context):

- Give each artifact an owner and a `reviewed:` date
- Run the [task bank](../references/task-bank.md) without the artifact at each model upgrade
- Keep the artifact only if a task regresses, and record that task next to it
- Move rules that must always hold into a command hook, deny rule or CI check

### Line Caps as a Proxy for Signal

**Symptom**: The instruction file passes a line-count check, so it is treated as healthy. It holds rules the agent
discovers from the code anyway, stale commands and rules for weaknesses the current model no longer has. Or a useful
rule is cut because the file is at its cap.

**Why it happens**: A line count is the one property of the file that CI measures cheaply. Length costs context on
every session, but the count says nothing about which lines change what the agent does.

**Fix**: Keep the length warning as a prompt to look, and test the content with
[Pattern 0.10](../L0-foundation.md#pattern-010--prune-and-re-baseline-context):

- Remove a rule, run the task bank, and keep the rule only if a task regresses
- Do not trim rules to meet a number before testing them
- Hold the rules that matter in a command hook or CI, where file length does not affect them

## Using This Page

1. Match the symptom to a row.
2. Open the pattern and read its Anti-Pattern section for the failure modes, and its Solution for the fix.
3. After the fix, check that the symptom no longer appears.
