# L4 Culture — Rigor, Documentation & Maintenance

L4 is the capstone layer that maintains the standards established by L0-L3. Where L0 defines the entry points and L1-L3 provide execution patterns, L4 ensures continuous quality through documentation rigor, evidence-based work, aggressive cleanup, drift detection, and the new starter standard.

---

## Pattern 4.1 — Documentation as Contract

### Problem

Stale documentation is worse than no documentation. When docs are outdated, agents follow them with false confidence, leading to wasted tokens, incorrect implementations, and cascading errors. Documentation freshness is often treated as a one-time task rather than a continuous obligation.

### Solution

**Treat documentation as a living contract with the codebase.** When code changes, update the corresponding documentation in the SAME task—not deferred to "later." Every change that affects behavior must include a corresponding documentation update.

The CLAUDE.md master index pattern (from L0.4) is the enforcement mechanism: documentation not linked from CLAUDE.md is orphaned and therefore dead. Link validation is part of the contract.

**Key principles:**
- **Synchronous updates:** Code changes and doc updates happen in the same task
- **Reference integrity:** All docs must be reachable from CLAUDE.md via link chains
- **Version-aware docs:** When patterns evolve, mark old versions as deprecated and link to current ones
- **Example currency:** Code examples in docs must match the current codebase

### In Practice

**Before starting a task:**
1. Read the relevant documentation sections
2. Verify the examples match current code
3. If docs are stale, flag it before proceeding

**During implementation:**
1. Make code changes
2. IMMEDIATELY update affected docs
3. Update CLAUDE.md links if structure changed
4. Run link validation to catch orphans

**Example task flow:**
```
Task: Refactor authentication flow

1. Read L1/L2 patterns for auth
2. Implement new auth logic
3. Update L1/L2 pattern docs with new flow
4. Update CLAUDE.md if patterns moved
5. Verify: grep -r "old_auth_function" docs/
6. Commit: Code + docs together
```

**Never defer:**
- "I'll update the docs in a separate PR"
- "The docs are close enough for now"
- "I'll document this when the feature is complete"

### Anti-Pattern

❌ **"Good enough" documentation:** "The docs are roughly correct, the agent can figure it out"
❌ **Deferred updates:** Making code changes and filing a doc ticket for "later"
❌ **Orphaned content:** Writing docs that aren't linked from CLAUDE.md
❌ **Unverified examples:** Code snippets in docs that haven't been tested against current code
❌ **Zombie docs:** Keeping old versions around without marking them deprecated

### Cross-References

- **L0.4 — CLAUDE.md Master Index:** The linking and discovery mechanism
- **Pattern 4.4 — Spec Drift Detection:** Automated checks for doc freshness
- **Pattern 4.5 — The New Starter Standard:** Ultimate test for entry point clarity

---

## Pattern 4.2 — Evidence-Based Claims

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

❌ **Prediction-based claims:** "Tests should pass" without running them
❌ **Dismissive assertions:** "That's unrelated" without investigation
❌ **Selective evidence:** Showing passing tests while hiding failing ones
❌ **Hand-wavy verification:** "I checked it manually" with no output
❌ **Evidence-free refutation:** "That failure is a flaky test" without logs

### Cross-References

- **L2.3 — Full-Loop Coverage:** Evidence is part of tertiary assertions
- **Pattern 4.3 — Aggressive Cleanup:** Remove dead code that wastes verification tokens
- **Pattern 4.4 — Spec Drift Detection:** Automated checks replace manual verification

---

## Pattern 4.3 — Aggressive Cleanup

### Problem

Dead code, unused imports, stale comments, and deprecated files accumulate over time. Every file an agent reads is context that could displace something important. Unused code is not harmless legacy—it's noise that degrades agent performance by consuming context window and creating confusion about what's actually used.

### Solution

**Treat cleanup as a continuous practice, not a quarterly sprint.** When you find dead code during a task, remove it as part of that task. Every task should leave the codebase cleaner than it found it.

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

### In Practice

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

### Anti-Pattern

❌ **"Just in case" retention:** Keeping code "in case it's needed later"
❌ **Commented-out code:** Leaving code in comments instead of deleting it
❌ **Defensive cleanup avoidance:** "Someone might be using this"
❌ **Cleanup theater:** Removing a few imports but leaving major dead code
❌ **Deferred cleanup:** "I'll create a cleanup ticket for this"

### Cross-References

- **Pattern 4.2 — Evidence-Based Claims:** Verify cleanup doesn't break anything
- **Pattern 4.4 — Spec Drift Detection:** Automated tools detect dead code
- **L0.4 — CLAUDE.md Master Index:** Remove docs for deleted code

---

## Pattern 4.4 — Spec Drift Detection

![Spec Drift Detection Layers](diagrams/4.4-spec-drift-detection-layers.png)

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

❌ **"Close enough" tolerance:** Ignoring minor drift because "it's basically right"
❌ **Deferred fixes:** Filing tickets for drift instead of fixing immediately
❌ **Partial updates:** Updating code but forgetting docs (violates 4.1)
❌ **Zombie specs:** Keeping docs around for deleted features "for reference"
❌ **Manual-only checks:** Relying on human review without automated detection

### Cross-References

- **Pattern 4.1 — Documentation as Contract:** Drift is contract violation
- **Pattern 4.2 — Evidence-Based Claims:** Automated checks provide evidence
- **Pattern 4.5 — The New Starter Standard:** Drift breaks new starter experience

---

## Pattern 4.5 — The New Starter Standard

### Problem

Projects accumulate implicit knowledge that exists only in team members' heads. New contributors struggle because onboarding documents assume context they don't have. The project becomes unapproachable for agents and humans alike.

### Solution

**The ultimate test: If someone with zero context cannot understand your project from CLAUDE.md + README + file structure alone, the project is not agentic-ready.**

This is the standard that L4 maintains. It's the practical application of L0's entry point principles.

**New starter test:**
1. Clone the repository
2. Read only: README.md, CLAUDE.md, and docs linked from CLAUDE.md
3. Can you answer these questions?
   - What does this project do?
   - How do I run it locally?
   - Where do I add a new feature?
   - What patterns should I follow?
   - How do I test my changes?
   - Who do I ask for help?

If the answer is "no" to any question, the entry points need work.

### In Practice

**Periodic audits (quarterly or per major change):**
```bash
# Simulate new starter experience
1. Fresh clone of repo
2. Read README.md
3. Read CLAUDE.md and linked docs
4. Try to: run tests, add a feature, build the project
5. Document every assumption you had to make
6. Fix entry points to eliminate assumptions
```

**Audit checklist:**
- [ ] **README clarity:** Can a stranger understand what this project does in 30 seconds?
- [ ] **Quick start:** Can they run "hello world" without reading beyond README?
- [ ] **CLAUDE.md structure:** Is it a clear map or a wall of links?
- [ ] **Pattern docs:** Do L1/L2/L3 docs have examples that run out of the box?
- [ ] **File organization:** Does the directory structure communicate intent?
- [ ] **Onboarding gaps:** What questions would you ask if you joined today?

**Example improvements from audits:**

*Before:*
```markdown
# MyProject

See CLAUDE.md for documentation.
```

*After:*
```markdown
# MyProject

**What it does:** Transforms CSV data into SQL tables with automatic type inference.

**Quick start:**
```bash
pip install -e .
python examples/hello.py
```

**Documentation:**
- CLAUDE.md — Project map and patterns
- L1-basics.md — Core concepts (start here)
- examples/ — Runnable examples

**Next steps:**
1. Read L1-basics.md for core patterns
2. Run examples/hello.py to verify installation
3. Check examples/ for common tasks
```

**The "zero context" rule:**
Every documentation section should pass the zero-context test:
- Does it reference undefined terms?
- Does it assume prior knowledge of the project?
- Does it use "we" language that implies existing team membership?
- Does it have examples that rely on unstated setup?

### Anti-Pattern

❌ **Insider documentation:** "You know, the thing we discussed in the meeting"
❌ **Assumed knowledge:** "Just follow the pattern we always use" (without linking to it)
❌ **Incomplete onboarding:** "Read the whole docs folder" (without a guide)
❌ **Stale quick starts:** Examples that don't run because of missing steps
❌ **Missing "why":** Explaining "how" but not "why" (agents need intent)

### Cross-References

- **L0.4 — CLAUDE.md Master Index:** The foundation of discoverability
- **Pattern 4.1 — Documentation as Contract:** Entry points ARE the contract
- **Pattern 4.4 — Spec Drift Detection:** Audits catch entry point drift

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
- [ ] Primary assertions: Core functionality verified (e.g., function returns correct output)
- [ ] Secondary assertions: Side effects verified (e.g., file written, DB updated)
- [ ] Tertiary assertions: Cleanup verified (e.g., connections closed, temp files deleted)
- [ ] Failure cases tested (error paths, edge cases)

### Test Integrity
- [ ] No conditional assertions (assert inside if/else)
- [ ] No catch-without-throw (except re-throw scenarios)
- [ ] Tests are deterministic (no flaky randomness)
- [ ] Test isolation (no shared state between tests)

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

### New Starter Check (for PRs affecting entry points)
- [ ] README is clear to strangers
- [ ] Quick start example runs without issues
- [ ] CLAUDE.md is a clear map
- [ ] No undefined jargon in docs
- [ ] Zero-context test passed

---

## Summary: L4 as Continuous Quality

L4 is not a one-time cleanup—it's a continuous practice:

1. **Pattern 4.1 (Documentation as Contract):** Keep docs in sync with code, every time
2. **Pattern 4.2 (Evidence-Based Claims):** Verify before claiming, show output
3. **Pattern 4.3 (Aggressive Cleanup):** Remove dead code as you find it
4. **Pattern 4.4 (Spec Drift Detection):** Automate drift checks, fix immediately
5. **Pattern 4.5 (New Starter Standard):** Audit entry points, fix gaps

**The review checklist is the enforcement mechanism.** Apply it to every task, every PR, every completion.

When L4 is practiced consistently, the codebase remains agentic-ready: clear, clean, and maintainable for both human and agent collaborators.

## Practitioner Insight

> "Peter strikes me as a software architect who keeps the high-level structure of his project in his head, deeply cares about architecture, tech debt, extensibility, modularity, and so on."
> — Gergely Orosz, on Peter Steinberger's workflow

L4 culture ensures that agentic development doesn't degrade project quality over time. Architecture, tech debt, and modularity require continuous attention — especially when agents are doing the implementation. Documentation rigor, evidence-based claims, and aggressive cleanup are what keep a project agentic-ready as it grows.

---

**Previous:** [L3: Optimization — Token Efficiency & Agent Performance](L3-optimization.md) | [Back to Overview](../README.md)
