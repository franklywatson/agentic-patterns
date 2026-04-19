# L4: Standards & Measurement

L4 is the maturity layer. Where L0 establishes foundations and L1-L3 provide execution patterns, L4 ensures those standards hold over time through evidence-based discipline, automated monitoring, periodic audits, and measurable outcomes.

> **Scope note:** Patterns 4.1-4.5 were not implemented in the reference project, which operated at L0-L3. They describe the maturity layer that enterprise adopters or larger teams would add, informed by the reference project's informal practices and industry standards. Pattern 4.6 (Context Eval) is an exception — it is implemented and validated in the [rig](https://github.com/franklywatson/claude-rig) reference implementation, with 18 scenarios across 5 environment presets and graduated scoring.

---

## Pattern 4.1 — Evidence-Based Claims

### Problem

Agents make claims without backing them with evidence. "Tests should pass" is not evidence—it's a prediction. Without verification, claims waste tokens when they're wrong, and erode trust when failures are dismissed as "unrelated."

### Solution

**The verify+ pattern:** Run the commands, show the output, then make the claim. Every completion claim must be backed by actual command output.

**Evidence format template:**

```bash
# Step 1: Run verification command
$ <command>

# Step 2: Show actual output
<actual output>

# Step 3: Make claim based on output
Claim: <what the output proves>
```

**Claims that REQUIRE evidence:**

- "Tests pass" → Show test output
- "Build succeeds" → Show build log
- "Function works" → Show example execution
- "Performance improved" → Show before/after metrics
- "Bug fixed" → Show reproduction failing before, passing after

### In Practice

**Bad claims:**

- "Tests should pass now" → No verification
- "This failure is unrelated" → No investigation
- "This warning was pre-existing" → No baseline check
- "The function works correctly" → No execution shown

**Good claims:**

```bash
$ pytest tests/test_auth.py -v

tests/test_auth.py::test_login_success PASSED
tests/test_auth.py::test_token_refresh PASSED
tests/test_auth.py::test_invalid_credentials PASSED

Claim: All authentication tests pass. The login, token refresh, and error handling paths work correctly.
```

**Before/after evidence:**

```bash
# Before: Bug reproduction
$ python -c "from mymodule import broken_func; broken_func()"
ValueError: division by zero

# After fix: Verification
$ python -c "from mymodule import fixed_func; fixed_func()"
Success: Operation completed

Claim: The division-by-zero bug is fixed. Function now handles edge cases correctly.
```

**Evidence for negative claims:**

```bash
# Claim: "This error is pre-existing"
$ git log --oneline -1
commit abc123 (HEAD) Add new feature

$ git diff abc123^..abc123 -- myfile.py
# No changes to error-prone code

Claim: The error existed before this commit. Changes in abc123 don't touch the relevant code.
```

### Anti-Pattern

- **Prediction-based claims:** "Tests should pass" without running them.
- **Dismissive assertions:** "That's unrelated" without investigation.
- **Selective evidence:** Showing passing tests while hiding failing ones.
- **Hand-wavy verification:** "I checked it manually" with no output.
- **Evidence-free refutation:** "That failure is a flaky test" without logs.

### Cross-References

- **L2.3 — Full-Loop Coverage:** Evidence is part of tertiary assertions
- [Pattern 0.8 — Aggressive Cleanup](L0-foundation.md#pattern-08--aggressive-cleanup): Remove dead code that wastes verification tokens
- **Pattern 4.2 — Spec Drift Detection:** Automated checks replace manual verification

---

## Pattern 4.2 — Spec Drift Detection

![Spec Drift Detection Layers](diagrams/4.2-spec-drift-detection-layers.png)

### Problem

Documentation, tests, and code drift apart over time. A pattern documented in L1 may be renamed in the code. A test may reference a function that was deleted. Documentation may describe behavior that changed months ago. This drift creates confusion and wastes tokens as agents chase outdated specifications.

### Solution

**Implement automated and manual checks to detect drift between specs and implementation.** When drift is found, fix it immediately—don't let it compound.

**Detection layers:**

**1. Link integrity (automated)**

```bash
# Check all docs linked from CLAUDE.md are reachable
$ find docs -name "*.md" -exec grep -l "\[.*\](.*\.md)" {} \; | \
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

**2. Stale file detection (automated)**

```bash
# Find docs not updated in 6+ months
$ find docs -name "*.md" -mtime +180 -ls

# Find docs with old date markers
$ grep -r "Last updated: 202[0-9]" docs/
```

**3. Test-to-code alignment (automated)**

```bash
# Tests reference non-existent functions
$ pytest --collect-only | while read line; do
  func=$(echo "$line" | grep -o "test_[a-z_]*" | sed 's/test_//')
  if ! grep -q "def $func" src/**/*.py; then
    echo "Test for missing function: $func"
  fi
done
```

**4. Doc-to-code consistency (manual checklist)**

- Code examples in docs match actual code syntax
- Pattern names match current implementation
- File paths referenced in docs exist
- Behavior descriptions match current implementation

### In Practice

**Continuous monitoring:**

```bash
# Add to pre-commit hook or CI
#!/bin/bash
echo "Checking for spec drift..."

# 1. Broken links in docs
./scripts/check_docs_links.sh
# Fail on broken links

# 2. Stale docs (warning only)
./scripts/check_stale_docs.sh
# Warn but don't fail

# 3. Test coverage
pytest --collect-only --quiet
# Fail if tests reference missing code
```

**Manual review checklist (per PR):**

- [ ] Updated documentation for all changed code
- [ ] All new docs linked from CLAUDE.md
- [ ] Code examples tested against current code
- [ ] Tests reference existing functions
- [ ] No orphaned docs (deleted code → deleted docs)

**Drift remediation workflow:**

1. Detection tool identifies drift
2. Categorize: code drift (code changed, docs didn't) or doc drift (docs changed, code didn't)
3. Fix: Either update code or update docs
4. Verify: Run detection again
5. Commit: "Fix spec drift in [component]"

**Example findings:**

```
Broken link: L1/testing.md references L3/deprecated-mocking.md (deleted)
→ Action: Remove reference, link to current L3/mocking.md

Stale doc: L2/api.md last updated 2024-06, api.py changed 2025-01
→ Action: Review api.py changes, update L2/api.md

Test drift: test_legacy_flow() references deleted function old_flow()
→ Action: Delete test, it's testing non-existent code
```

### Anti-Pattern

- **"Close enough" tolerance:** Ignoring minor drift because "it's basically right."
- **Deferred fixes:** Filing tickets for drift instead of fixing immediately.
- **Partial updates:** Updating code but forgetting docs (violates [Pattern 0.7](L0-foundation.md#pattern-07--documentation-as-system-map)).
- **Zombie specs:** Keeping docs around for deleted features "for reference."
- **Manual-only checks:** Relying on human review without automated detection.

### Cross-References

- [Pattern 0.7 — Documentation as System Map](L0-foundation.md#pattern-07--documentation-as-system-map): Drift breaks the map
- **Pattern 4.1 — Evidence-Based Claims:** Automated checks provide evidence
- **Pattern 4.3 — New Starter Standard:** Drift breaks new starter experience

---

## Pattern 4.3 — New Starter Standard

### Problem

Projects accumulate implicit knowledge that exists only in team members' heads. New contributors — human or AI — struggle because onboarding documents assume context they don't have.

### Solution

**The test: Can someone with zero context understand your project from CLAUDE.md + README + file structure alone?** If the answer is no to any of these — what it does, how to run it, where to add features, what patterns to follow, how to test changes — the entry points need work.

This is the practical application of [Pattern 0.9](L0-foundation.md#pattern-09--ai-as-new-starter-standard), maintained as a periodic audit in L4.

### In Practice

**Audit checklist (quarterly or per major change):**

- [ ] README explains the project in under 30 seconds
- [ ] Quick start runs without reading beyond README
- [ ] CLAUDE.md is a clear map, not a wall of links
- [ ] Pattern docs have examples that run out of the box
- [ ] Directory structure communicates intent

**The "zero context" rule:** Every doc section must pass this test — no undefined terms, no assumed prior knowledge, no "we" language implying existing team membership, no examples relying on unstated setup.

### Anti-Pattern

- **Insider documentation:** "You know, the thing we discussed in the meeting."
- **Assumed knowledge:** "Just follow the pattern we always use" (without linking to it).
- **Stale quick starts:** Examples that don't run because of missing steps.
- **Missing "why":** Explaining "how" but not "why" (agents need intent).

### Cross-References

- [Pattern 0.4 — CLAUDE.md as Project Constitution](L0-foundation.md#pattern-04--claude-md-as-project-constitution): The foundation of discoverability
- [Pattern 0.7 — Documentation as System Map](L0-foundation.md#pattern-07--documentation-as-system-map): Entry points ARE the map
- **Pattern 4.2 — Spec Drift Detection:** Audits catch entry point drift

---

## Pattern 4.4 — Agentic Development Metrics

### Problem

Teams adopt agentic practices based on intuition and anecdote. Without measurement, they can't tell if the investment is paying off, where to focus next, or whether maturity is progressing. "We feel faster" is not evidence — it's optimism bias. Teams that don't measure can't improve systematically.

### Solution

**Establish metrics that measure the outcomes agentic practices are designed to improve.** Metrics serve three purposes: validate that practices are working, identify where to focus next, and close the feedback loop on the practices themselves.

This is not about tracking agent activity for its own sake. Tokens consumed, commands executed, and sessions started are activity metrics — they measure effort, not outcomes. The metrics that matter measure whether the codebase is getting better and whether agents are becoming more effective over time.

**Maturity progression:**

Agentic development matures through four stages. Each stage maps to the pattern pyramid:

| Stage | Description | Pattern Foundation |
|-------|-------------|-------------------|
| **Foundational** | Agents handle bounded tasks with human oversight. Single-file changes, clear instructions, manual verification. No production data in prompts. | L0: Structure is navigable. Agent can find what it needs. |
| **Orchestrated** | Multi-agent workflows: task decomposition, cross-file changes, test-first development, evidence-based completion. Cross-repo awareness. Governance policies in place. | L1-L2: Feedback loops catch errors. Guardrails prevent violations. |
| **Self-optimizing** | Agents critique and revise their own work. Plan-execute-observe cycles. Memory of prior decisions and failure modes. Propose refactors with architectural alignment. | L3: Efficient token use. Structured exploration. Smart routing. |
| **Autonomous** | End-to-end delivery with governance guardrails. Multi-agent coordination across domains. Metrics-driven process refinement. Continuous improvement loops. | L4: Standards hold over time. Drift is detected. Outcomes are measured. |

A team doesn't "arrive" at a stage — different parts of the codebase may be at different maturity levels. The metrics framework identifies where to invest next.

**Key metric categories:**

**1. Velocity**

- Agent-driven cycle time per feature (from task assignment to verified completion)
- Task decomposition accuracy — how often the plan survives first execution without revision
- Stack test pass rate on first run ([L1](L1-feedback-loops.md))

**2. Quality**

- Defect rate in agent-delivered code (bugs found after merge per feature)
- Test coverage trend (stack tests covering new user journeys)
- Architectural coherence — frequency of cross-cutting refactors needed to maintain module boundaries

**3. Agent autonomy**

- Human intervention rate — how often a human must redirect or correct an agent mid-task
- Task completion without handoff — percentage of tasks completed in a single agent session
- Review rejection rate — percentage of agent PRs requiring significant revision

**4. Governance**

- Constitutional rule violations caught by guardrails vs. caught in review
- Spec drift detected — broken links, stale docs, orphaned tests — tracked over time via [Pattern 4.2](#pattern-42--spec-drift-detection)
- Rollback frequency — how often agent changes must be reverted
- Audit completeness — percentage of agent changes with full evidence trail

### In Practice

**Getting started — don't measure everything at once:**

Pick one metric from each category that matters most to your team. Track it for two weeks. If the data is noisy or hard to collect, pick a different metric. If it's clear and actionable, add more.

```
Starter set (one per category):
- Velocity: Agent-driven cycle time per feature
- Quality: Stack test pass rate on first run
- Autonomy: Human intervention rate
- Governance: Constitutional rule violations caught by guardrails
```

**Measurement cadence:**

- **Per-task:** Cycle time, intervention rate, plan revision count
- **Per-week:** Defect rate, review rejection rate, drift detection counts
- **Per-quarter:** Maturity stage assessment, metric trend analysis, process refinement

**Closing the loop:**

Metrics that don't drive action are waste. For each metric, define:

- **Threshold:** What value triggers concern? (e.g., human intervention rate above 30%)
- **Action:** What do you do when the threshold is hit? (e.g., invest in better task scoping)
- **Owner:** Who is responsible for acting on it?

**Gate criteria for maturity stage transitions:**

Each stage has observable gates — not arbitrary timelines:

- **Foundational → Orchestrated:** A medium-sized feature (2-5 files) completes end-to-end with agent-driven flow and passes CI
- **Orchestrated → Self-optimizing:** Agents autonomously propose and run safe plans, requiring human review only for critical-path or security changes
- **Self-optimizing → Autonomous:** Organization-wide adoption in at least one major product area, with documented safety nets, rollback plans, and cost governance

### Anti-Pattern

- **Vanity metrics:** Tracking tokens consumed or commands executed — these measure activity, not outcomes.
- **Measuring without acting:** Collecting data but not defining thresholds, actions, or owners.
- **Gaming the metrics:** Optimizing for the metric rather than the outcome (e.g., reducing intervention rate by making tasks so trivial the agent never needs help).
- **All-or-nothing:** Trying to measure everything from day one. Start with one metric per category.

### Cross-References

- [L1: Stack Tests](L1-feedback-loops.md): Pass rate on first run is a key quality signal
- [L2: Behavioral Guardrails](L2-behavioral-guardrails.md): Guardrail violation rates are a governance signal
- [L3: Optimization](L3-optimization.md): Token efficiency gains are measurable
- **Pattern 4.1 — Evidence-Based Claims**: The evidence standard applies to metrics claims themselves

---

## Pattern 4.5 — CI Guardrails

### Problem

L4 describes standards and measurement but doesn't address CI enforcement. Enforcement in hooks is session-scoped — it only works when the agent is running. CI provides non-negotiable enforcement that runs regardless of whether hooks are active.

### Solution

GitHub Actions workflows for docs quality and test coverage, paired with project config for threshold definitions.

**Key concepts:**

- Coverage gate: test coverage thresholds (e.g., 80% statements, 75% branches) defined in project config, not CI workflow
- Docs lint: markdownlint-cli2 with permissive rules + link checking
- Separate workflows: `docs.yml` for documentation, `coverage.yml` for test coverage
- Thresholds in project config, not CI — anyone can see and adjust them

### In Practice

```yaml
# .github/workflows/docs.yml
name: Documentation Quality
on: [push, pull_request]
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm run lint:md
      - run: ./scripts/check-claude-md-lines.sh  # Verify CLAUDE.md under 150 lines
      - run: ./scripts/check-doc-links.sh         # Internal link integrity
      - run: ./scripts/check-doc-reachability.sh  # All docs reachable from CLAUDE.md
      - run: ./scripts/check-writing-conventions.sh # No filler words
```

### Reference Implementation

The [rig](https://github.com/franklywatson/claude-rig) repo implements this in [`.github/workflows/`](https://github.com/franklywatson/claude-rig/tree/main/.github/workflows) with separate docs and coverage workflows.

### Anti-Pattern

Putting thresholds in CI workflow files rather than project config. When thresholds live in `.github/workflows/`, developers must dig through YAML to find them. When they live in `vitest.config.ts` or `.harness.yaml`, they're visible and adjustable alongside the code they govern.

### Cross-References

- [Pattern 4.2 — Spec Drift Detection](#pattern-42--spec-drift-detection) — CI automates drift checks
- [Pattern 4.1 — Evidence-Based Claims](#pattern-41--evidence-based-claims) — CI output is the evidence

---

## Pattern 4.6 — Context Eval

### Problem

L3 defines routing and optimization patterns — smart routing, intent classification, environment-aware tool selection. But without systematic evaluation, there is no evidence that the routing logic makes correct decisions. Changes to routing rules, new environment presets, or updated intent patterns can introduce regressions that go undetected until an agent session wastes tokens on a wrong tool choice. L4 requires evidence-based claims ([Pattern 4.1](#pattern-41--evidence-based-claims)); routing effectiveness needs the same rigor.

### Solution

**Context eval** is a structured evaluation pattern that scores an agent's routing and tool-selection decisions against expected outcomes across multiple scenarios and environments. Each scenario defines a tool call (command, tool name) and the expected routing decision for each environment preset. The evaluation runs the actual routing logic, compares results to expectations, and produces a scored report with category and environment breakdowns.

**The closed loop:**

```
Define scenarios (tool call + expected outcome per environment)
    ↓
Run scenarios against actual routing logic
    ↓
Score each result (1.0 exact, 0.5 partial, 0.0 miss)
    ↓
Generate report (overall score, per-category, per-environment, failures)
    ↓
Fail build if overall score below threshold (e.g., 0.7)
    ↓
Fix routing logic or update scenarios → re-evaluate
```

**Why context eval matters:** Routing decisions are the highest-frequency agent actions. Every `grep`, `cat`, `find`, or `git status` passes through the routing layer. A 5% regression in routing accuracy translates to thousands of wasted tokens per session. Context eval catches regressions before they reach production sessions.

**Key concepts:**

- **Scenarios**: Each scenario specifies a tool call (the command the agent issues) and the expected outcome (action + optional tool) for each environment preset
- **Environment presets**: Different tool availability combinations (e.g., both RTK and jcodemunch available, RTK only, neither). Routing that works in one environment may fail in another
- **Graduated scoring**: 1.0 for exact match (correct action and tool), 0.5 for partial match (correct action, wrong tool), 0.0 for miss
- **Category coverage**: Scenarios organized by category (bash, native, agent, pipe, edge) with per-category score reporting
- **Threshold gate**: Minimum overall score that must be met; build fails if unmet, with detailed failure output
- **Bidirectional coverage**: Not just "does the right tool get selected?" but also "does the wrong command get blocked?" — destructive operations (`sed -i`) must produce a `block` action regardless of environment

### In Practice

```typescript
// Scenario definition — what should happen for each environment
const scenario: EvalScenario = {
  id: 'grep-should-route-to-rtk-or-grep-tool',
  category: 'bash',
  description: 'grep command routes to rtk grep (if available) or Grep tool',
  toolCall: { tool: 'Bash', command: 'grep -r "processOrder" src/' },
  expected: {
    full:       { action: 'rewrite', tool: 'rtk grep' },
    rtk_only:   { action: 'rewrite', tool: 'rtk grep' },
    jm_only:    { action: 'advise',  tool: 'Grep' },
    neither:    { action: 'advise',  tool: 'Grep' },
    jm_not_indexed: { action: 'advise', tool: 'Grep' },
  }
};

// Scoring: graduated, not binary
function scoreResult(expected: ExpectedOutcome, actual: ActualOutcome): number {
  if (expected.action === actual.action) {
    if (!expected.tool || expected.tool === actual.tool) return 1.0; // exact
    return 0.5; // correct action, wrong tool
  }
  return 0.0; // miss
}

// Evaluation loop: every scenario × every environment
describe('Context Eval: routing effectiveness', () => {
  const results: EvalResult[] = [];
  const MIN_OVERALL_SCORE = 0.7;

  for (const scenario of ALL_SCENARIOS) {
    for (const preset of ENV_PRESETS) {
      it(`${scenario.id} [${preset.name}]`, () => {
        const actual = handlePreToolUse(scenario.toolCall, preset.env);
        const expected = scenario.expected[preset.name];
        const score = scoreResult(expected, actual);
        results.push({ scenario, preset: preset.name, score, actual, expected });
        expect(score).toBeGreaterThanOrEqual(0.5);
      });
    }
  }

  it('overall score meets minimum threshold', () => {
    const report = buildReport(results);
    if (report.overallScore < MIN_OVERALL_SCORE) {
      // Detailed failure output for diagnosis
      console.log(`Overall: ${report.overallScore} (min: ${MIN_OVERALL_SCORE})`);
      for (const [cat, score] of Object.entries(report.byCategory)) {
        console.log(`  ${cat}: ${score}`);
      }
      for (const f of report.failures) {
        console.log(`  FAIL: ${f.scenario} [${f.preset}] — ${f.reason}`);
      }
    }
    expect(report.overallScore).toBeGreaterThanOrEqual(MIN_OVERALL_SCORE);
  });
});
```

**Report structure** — the eval produces a structured report, not just pass/fail:

```
{
  overallScore: 0.83,
  totalScenarios: 90,    // 18 scenarios × 5 environments
  passCount: 75,
  byCategory: {
    bash: 0.89,
    native: 1.0,
    agent: 0.78,
    pipe: 0.80,
    edge: 0.67           ← edge cases need attention
  },
  byEnvironment: {
    full: 0.94,
    rtk_only: 0.83,
    jm_only: 0.78,
    neither: 0.72,
    jm_not_indexed: 0.89
  },
  failures: [
    { scenario: 'sed-i-blocks', preset: 'neither', expected: 'block', actual: 'allow', reason: 'Destructive edit not blocked' }
  ]
}
```

The category and environment breakdowns direct attention: a low `edge` score says "improve edge-case handling"; a low `neither` score says "test the degraded path more carefully."

### Reference Implementation

The [rig](https://github.com/franklywatson/claude-rig) repo implements context eval in [`tests/eval/`](https://github.com/franklywatson/claude-rig/tree/main/tests/eval) with:

- [`eval.test.ts`](https://github.com/franklywatson/claude-rig/blob/main/tests/eval/eval.test.ts) — Main evaluation loop: iterates all scenarios across all environment presets
- [`scenarios.ts`](https://github.com/franklywatson/claude-rig/blob/main/tests/eval/scenarios.ts) — 18 scenarios across 5 categories with 5 environment presets
- [`score.ts`](https://github.com/franklywatson/claude-rig/blob/main/tests/eval/score.ts) — Graduated scoring logic and report generation
- [`score.test.ts`](https://github.com/franklywatson/claude-rig/blob/main/tests/eval/score.test.ts) — Unit tests for the scoring functions themselves

### Anti-Pattern

- **Binary pass/fail**: Routing decisions have nuance — suggesting `Grep` when `rtk grep` is unavailable is correct, not a failure. Graduated scoring captures this.
- **Single-environment testing**: Routing that works when all tools are present may fail when tools are missing. Test across environment presets.
- **Evaluating mocked routing**: Running eval against a mock of the routing logic tests the mock, not the routing. Context eval exercises the actual `handlePreToolUse` function — the same code that runs in production sessions.
- **Threshold too low**: A threshold of 0.0 means every routing decision can be wrong and the build still passes. A meaningful threshold (0.7+) forces routing quality to improve or the build fails.
- **Scenarios that never change**: As routing logic evolves, scenarios must evolve with it. Stale scenarios test a routing system that no longer exists.

### Cross-References

- [Pattern 3.1 — Smart Routing](L3-optimization.md#pattern-31--smart-routing--tool-selection) — The routing logic that context eval verifies
- [Pattern 3.2 — Intent Classification](L3-optimization.md#pattern-32--intent-classification) — Intent parsing correctness is eval'd through scenarios
- [Pattern 3.3 — Environment-Aware Routing](L3-optimization.md#pattern-33--environment-aware-routing) — Environment presets in eval ensure degraded paths work
- [Pattern 4.1 — Evidence-Based Claims](#pattern-41--evidence-based-claims) — Context eval produces evidence for routing effectiveness claims
- [Pattern 4.5 — CI Guardrails](#pattern-45--ci-guardrails) — Context eval runs in CI as a non-negotiable quality gate

---

## Review Checklist Template

Adopt this checklist for code reviews, PR reviews, and task completion verification. A PR should not merge until all applicable items pass.

### Constitutional Compliance

- [ ] CLAUDE.md rules followed (if applicable)
- [ ] No hardcoded paths or secrets
- [ ] No blocking I/O without timeout
- [ ] Error handling covers all branches
- [ ] Logs include sufficient context

### Full-Loop Coverage

- [ ] Primary assertions: User-facing behavior verified (e.g., order placed successfully)
- [ ] Secondary assertions: Downstream effects verified (e.g., inventory updated, notification sent)
- [ ] Tertiary assertions: Cross-functional verification (e.g., audit log written, email received)
- [ ] Failure cases tested (error paths, edge cases, invalid input)

### Test Integrity

- [ ] No conditional assertions (assert inside if/else)
- [ ] No catch-without-throw (except re-throw scenarios)
- [ ] Tests are deterministic (no flaky randomness)
- [ ] Test isolation (no shared state between tests)
- [ ] Zero-defect tolerance: all test failures and warnings addressed, not dismissed ([Pattern 2.5](L2-behavioral-guardrails.md#pattern-25--zero-defect-tolerance))
- [ ] Unit tests cover algorithm correctness and edge cases
- [ ] Stack tests cover user journeys end-to-end ([L1: Stack Tests](L1-feedback-loops.md))

### Documentation

- [ ] Code changes documented in same task
- [ ] CLAUDE.md updated if structure changed
- [ ] New docs linked from CLAUDE.md (no orphans)
- [ ] Code examples tested and verified
- [ ] Deprecated features marked as such

### Evidence Requirements

- [ ] Claims backed by command output
- [ ] Test results shown (not just "tests pass")
- [ ] Before/after evidence for bug fixes
- [ ] Performance claims include metrics
- [ ] Negative claims include investigation

### Code Quality

- [ ] Unused imports removed
- [ ] Dead code removed
- [ ] Stale comments removed
- [ ] No commented-out code
- [ ] No TODO comments without tickets

### Spec Consistency

- [ ] Docs match current code behavior
- [ ] Tests reference existing functions
- [ ] No broken links in documentation
- [ ] File paths in docs are accurate
- [ ] Pattern names match implementation

---

## Summary: L4 as Standards & Measurement

L4 is the maturity layer — the practices that verify L0-L3 are holding and measure their impact:

1. **Pattern 4.1 (Evidence-Based Claims):** Verify before claiming, show output
2. **Pattern 4.2 (Spec Drift Detection):** Automate drift checks, fix immediately
3. **Pattern 4.3 (New Starter Standard):** Audit entry points, fix gaps
4. **Pattern 4.4 (Agentic Development Metrics):** Measure outcomes, close the feedback loop
5. **Pattern 4.5 (CI Guardrails):** Non-negotiable enforcement through CI workflows
6. **Pattern 4.6 (Context Eval):** Score routing decisions against expected outcomes across environments

**The review checklist is the enforcement mechanism.** Apply it to every task, every PR, every completion.

When L4 is practiced consistently, the codebase remains agentic-ready: clear, clean, and maintainable for both human and agent collaborators.

## Practitioner Insight

> "Peter strikes me as a software architect who keeps the high-level structure of his project in his head, deeply cares about architecture, tech debt, extensibility, modularity, and so on."
> — Gergely Orosz, on Peter Steinberger's workflow

Architecture, tech debt, and modularity require continuous attention — especially when agents are doing the implementation. L4 provides the standards and measurement to ensure that attention is systematic, not ad-hoc.

---

**Previous:** [L3: Optimization — Token Efficiency & Agent Performance](L3-optimization.md) | [Back to Overview](../README.md)
