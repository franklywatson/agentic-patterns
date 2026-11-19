---
name: verify-harness
description: "Run after installing the rig hooks to verify the hooks and skills work in the live session."
user-invocable: true
metadata:
  owner: franklywatson
  reviewed: 2026-11-19
---

<!-- rig-generated -->

# verify-harness — Post-Install Verification

Run this skill after installing the rig hooks (`rig init`) to confirm they work. The repository itself ships only the skills; the router and enforcement checks apply once the hooks are installed.

## Procedure

Run each check and report PASS/FAIL with evidence.

### Session Start Hook

- [ ] **S1**: Session started without hook errors
- [ ] **S2**: Run `which rtk` — report if available
- [ ] **S3**: Run `which jcodemunch` — report if available
- [ ] **S4**: Check if CWD is indexed: run `jcodemunch list_repos` if available

### Tool Router (PreToolUse Hook)

- [ ] **TR1**: Run `grep -r test .` in a test call — does the hook intercept it?
- [ ] **TR2**: Run `find . -name '*.ts'` — does the hook intercept it?
- [ ] **TR3**: Run `sed -i 's/old/new/g' file` — does the hook BLOCK it?
- [ ] **TR4**: Run `git status` — does the hook advise rtk (if available)?
- [ ] **TR5**: Run `Read` on a specific file — does it pass through?
- [ ] **TR6**: Run `Grep` tool (Windows, or if the Grep tool is enabled) — does it advise jcodemunch (if indexed)?
- [ ] **TR7**: Run `Glob` tool (Windows, or if the Glob tool is enabled) — does it advise jcodemunch (if indexed)?
- [ ] **TR8**: Reference an external directory — does it trigger auto-index?

### Enforcement (PostToolUse Hook)

- [ ] **E1**: Edit a source file — does it warn about missing test update?
- [ ] **E2**: Write a test with `jest.mock()` — does constitutional check fire?
- [ ] **E3**: Run a test that fails — does zero-defect check fire?
- [ ] **E4**: Edit source without test — does stale test warning appear?
- [ ] **E5**: During tdd+ phase, run full suite — does a warning appear after the run?
- [ ] **E6**: During verify+ phase, run full suite — is it allowed?

### Skills

- [ ] **SK1**: `/brain+` shows in skill list
- [ ] **SK2**: `/plan+` shows in skill list
- [ ] **SK3**: `/tdd+` shows in skill list
- [ ] **SK4**: `/verify+` shows in skill list
- [ ] **SK5**: `/review+` shows in skill list

## Report Format

```text
Session Verification Report
============================
Session Start:  X/4 passed
Tool Router:    X/8 passed
Enforcement:    X/6 passed
Skills:         X/5 passed

TOTAL: XX/23 passed

Failures:
- [ID]: [what happened]. Expected: [expected]. Got: [actual].
  Remediation: [how to fix]
```
