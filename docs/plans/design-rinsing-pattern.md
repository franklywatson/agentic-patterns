# Plan: Design Rinsing Pattern + my-claw Case Study

## Overview

Add Design Rinsing as a new context harvesting technique in L1-feedback-loops.md and create a full case study for the my-claw project as a second reference implementation.

## Constitutional Rules for This Plan

- Doc freshness: all changes include corresponding doc updates in the same session
- CLAUDE.md line limit: hard maximum 150 lines
- Every doc must be reachable from CLAUDE.md
- Markdown conventions: `#` page title, `##` main sections, `###` subsections, no emoji
- Line length: prefer 80-100 chars, hard limit 120

## Mock Policy

Documentation-only plan — no code, no tests, no mocks.

---

### Task 1: Add Design Rinsing subsection to L1-feedback-loops.md

**Files:** `docs/L1-feedback-loops.md`
**Evidence criteria:** New subsection reads coherently, follows existing section conventions, cross-references work

**Insertion point:** After "Targeted Context, Not Exhaustive Reading" (end of Context Harvesting section), before "Pattern Index"

**Content structure:**

```
### Design Rinsing — Cross-Domain Architectural Extraction

[Definition paragraph — what design rinsing is]

[Comparison with internal context harvesting — table format]

#### The Design Rinsing Workflow

[6-step workflow: Identify → Scope → Direct → Distill → Translate → Document]

#### Sources and Targets

[Table of source types: codebase, transcript, article, design notes]
[Table showing what gets extracted vs what gets discarded]

#### When to Use Design Rinsing

[Criteria: cross-domain insight, architectural evolution, avoiding NIH]

#### Design Rinsing and the REPL Fractal

[How design rinsing fits into the Read phase of the REPL at system-level scale]

**Cross-references:**
- Pattern 3.4 — Scout Pattern (structural exploration mechanism)
- L0 Pattern 0.4 — CLAUDE.md (documentation of rinse results)
- L4 Pattern 4.1 — Evidence-Based Claims (verify rinse results are valid)
```

- [ ] Draft the subsection
- [ ] Insert at correct location in L1-feedback-loops.md
- [ ] Verify cross-references point to existing patterns
- [ ] Verify section reads coherently with surrounding content
- [ ] Commit

---

### Task 2: Create my-claw case study

**Files:** `docs/references/reference-my-claw-case-study.md`
**Evidence criteria:** Document follows case study conventions established by trading bot case study

**Content structure:**

```
# Reference my-claw Project — Design Rinsing in Practice

**Project:** my-claw — Python voice assistant with room-based agent architecture
**Tech Stack:** Python, [frameworks from scout]
**Scale:** [from scout]

## Design Rinsing Lineage

### Phase 1: Transcript to Architecture
[YouTube video: Alex Krantz's "Principles for Autonomous System Design" talk at UC Berkeley]
[What was extracted: room concepts, frame processing pipeline, voice integration]
[Condensed 200-300 word summary of the transcript notes]

### Phase 2: Multi-Source Codebase Rinsing
[claw-code (Rust): token routing, multi-agent coordination, behavioral constitution]
[karpathy-skills (Markdown): 4 behavioral principles adapted for autonomous agents]

### Phase 3: Agentic Patterns Infusion
[agentic-patterns repo: L0-L4 patterns applied to development approach]
[trading bot reference: stack test design informing testing methodology]

## my-claw Architecture (Rinsed Design)

[Brief architecture description showing the rinsed patterns]

## Cross-Level Integration

[How rinsed patterns manifest at each level]

## Key Takeaways

[What the my-claw lineage demonstrates about design rinsing as a pattern]
```

- [ ] Draft the case study
- [ ] Include condensed summary of the transcript (200-300 words)
- [ ] Document each rinsing phase with observable evidence
- [ ] Verify all cross-references
- [ ] Commit

**BLOCKER:** YouTube video URL needed from user for Phase 1 documentation.

---

### Task 3: Update README.md

**Files:** `README.md`
**Evidence criteria:** my-claw appears in Reference Implementations table, design rinsing mentioned in L1 overview

**Changes:**

1. Add my-claw row to Reference Implementations table (after superpowers):

```
| [my-claw](https://github.com/[user]/my-claw) | L1 design rinsing reference: voice assistant whose architecture evolved through 3 phases of cross-domain design rinsing (transcript → architecture, external codebases → agent design, agentic-patterns → development approach) | Python |
```

1. In L1 overview paragraph, add sentence about design rinsing:
"Design rinsing extends context harvesting beyond the current project — agents extract distilled architectural understanding from external sources (codebases, transcripts, articles) and translate it into design decisions for the target project."

- [ ] Add my-claw to Reference Implementations table
- [ ] Add design rinsing mention to L1 overview
- [ ] Verify table formatting
- [ ] Commit

**DEPENDS ON:** Task 2 (need to verify my-claw GitHub URL)

---

### Task 4: Update CLAUDE.md

**Files:** `CLAUDE.md`
**Evidence criteria:** New case study linked from References section, line count stays under 150

**Changes:**

1. Add to References section:

```
- @docs/references/reference-my-claw-case-study.md — Design rinsing reference implementation
```

- [ ] Add link to new case study
- [ ] Verify line count under 150
- [ ] Commit

**DEPENDS ON:** Task 2

---

### Task 5: Add karpathy-skills to further-reading.md

**Files:** `docs/references/further-reading.md`
**Evidence criteria:** New entry follows existing format exactly

**Changes:**

Add to Articles section (after REPL article):

```
### Andrej Karpathy's LLM Coding Principles

- **Type:** Behavioral specification
- **Author:** Forrest Chang (forrestchang)
- **Summary:** Codifies Andrej Karpathy's observations about LLM coding pitfalls into four behavioral principles: Think Before Coding, Simplicity First, Surgical Changes, and Goal-Driven Execution. Installable as a Claude Code plugin or per-project CLAUDE.md overlay. The principles reduce the most common costly mistakes LLMs make when writing code — wrong assumptions, overcomplicated abstractions, and unnecessary refactoring.
- **Related to:** L2
- **URL:** <https://github.com/forrestchang/andrej-karpathy-skills>
```

- [ ] Add entry to Articles section
- [ ] Verify format matches existing entries
- [ ] Commit

**DEPENDS ON:** None (independent)

---

## Execution Order

1. Task 5 (independent, quick win)
2. Task 1 (independent, core content)
3. Task 2 (needs YouTube URL from user)
4. Task 3 (depends on Task 2)
5. Task 4 (depends on Task 2)

## Open Questions

1. **YouTube URL** — User said they'll provide the link to Alex Krantz's talk. Blocked until received.
2. **my-claw GitHub URL** — Need the public repo URL for the Reference Implementations table. Is there a public repo?
3. **claw-code credit** — Should claw-code (ultraworkers/claw-code) be added to further-reading.md too? It was a rinsing source.
