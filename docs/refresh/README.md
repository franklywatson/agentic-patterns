# Agentic Patterns Refresh (November 2026)

This directory holds a critical review of this repository and the plans to act on it. It exists so
that any session, human or agent, can take over the refresh without the conversation that
produced it.

Status: **analysis complete; Phase 0 is merged. Phase 1 is in progress on branch
`refresh/phase-1-reframe`.** All decisions D1-D7 are decided (2026-11-19; see
[decisions.md](decisions.md)).

## What happened

On 2026-11-19 the repository at commit `a07ad93` (last changed 2026-04-18) was reviewed against two
research documents written on 2026-11-18. Five reviewers worked in parallel, each with a
different lens. Their reports were combined into one synthesis.

| Input | What it is |
|-------|------------|
| Research baseline | Vendor-neutral AI-native engineering maturity research. It defines a five-level curve over seven dimensions, the cap rule, eight findings, an evidence gap list, and source IDs (MC-, PL-, SC-, OM-, SG-, PO-, IS-, MV-). |
| Anthropic guidance companion | Maps Anthropic's published principles, practices and Claude capabilities onto the baseline. Its source IDs (AN-n) are Anthropic publications. It leans towards Anthropic by design, so the reviews treat it as vendor guidance, not independent evidence. |

Neither input is committed. The reviews name them by the plain-text extracts made during the review,
`research/industry-baseline.txt` and `research/anthropic-companion.txt`. Instead,
[sources.md](../references/sources.md) restates the baseline's structure (curve, cap rule, findings, chapters) and
lists every source the corpus cites, with its public URL, so every reference ID can be checked
without the inputs. `python3 docs/refresh/tools/sourcecheck.py` confirms that each cited ID
resolves.

The synthesis is committed twice: as a page snapshot,
[agentic-patterns-refresh.html](agentic-patterns-refresh.html), and as text,
[synthesis.md](synthesis.md).

## Contents

| File | Purpose |
|------|---------|
| [synthesis.md](synthesis.md) | The combined findings, the reframe, both goals, the prerequisite track, pruning, defects, roadmap and decisions |
| [sources.md](../references/sources.md) | Every cited source with its public URL, and the baseline's structure, so each reference ID resolves |
| [decisions.md](decisions.md) | All decisions D1-D7, decided 2026-11-19, with options and the choice made. **Read first**: the plans follow them. |
| [plans/](plans/) | One scoped plan per phase, each written to be executed by a session that has read only this directory |
| [reviews/review-evidence.md](reviews/review-evidence.md) | Evidence auditor: holds the repo to its own "every claim verifiable" rule |
| [reviews/review-autonomy.md](reviews/review-autonomy.md) | Autonomy-ladder architect: maps L0-L4 onto the curve and designs earned autonomy |
| [reviews/review-selfrepair.md](reviews/review-selfrepair.md) | Self-repair: extends the closed loop into production |
| [reviews/review-governance.md](reviews/review-governance.md) | Security, governance, ownership and people |
| [reviews/review-adopter.md](reviews/review-adopter.md) | Adopter red team and model-generation realist |
| [tools/linkcheck.py](tools/linkcheck.py) | Link and anchor checker used by the adopter review (`python3 docs/refresh/tools/linkcheck.py .`) |
| [tools/anchors.py](tools/anchors.py) | Anchor-only checker used by the evidence review |
| [tools/sourcecheck.py](tools/sourcecheck.py) | Checks that every reference ID cited anywhere under `docs/` resolves in [sources.md](../references/sources.md) |

The reviews are kept as written, apart from the edits noted at the top of each. Their line numbers refer to commit `a07ad93`, and some have moved
since then. Two later commits are not on main yet: gstack removal and an L4 lint fix, both in
PR #4.

## Plans

| Phase | Plan | Depends on | Gated by decisions |
|-------|------|-----------|--------------------|
| 0 | [Correct defects](plans/phase-0-correct.md) | none | none |
| 1 | [Reframe and prune](plans/phase-1-reframe.md) | Phase 0 | D2, D3, D4, D5, D6 (all decided 2026-11-19) |
| 2 | [Containment, ownership and people](plans/phase-2-contain.md) | Phase 1 | D5 (decided 2026-11-19) |
| 3 | [Earned autonomy](plans/phase-3-earned-autonomy.md) | Phase 2 | D2, D7 (decided 2026-11-19) |
| 4 | [Self-repair](plans/phase-4-self-repair.md) | Phase 3 (A.1-A.3) | D1 (decided 2026-11-19) |
| Ongoing | [Prune and re-baseline](plans/phase-5-rebaseline.md) | Phase 1 | D4 (decided 2026-11-19) |

## How to take over

1. Read [synthesis.md](synthesis.md), then [decisions.md](decisions.md).
2. All decisions are decided; if a plan's task conflicts with one, ask the maintainer before
   proceeding.
   Phase 0 needs no decision and can start immediately.
3. Pick one plan. Each lists its tasks, the files it touches, its acceptance checks and what is out
   of scope. Work on a branch, one PR per phase. If a phase is large, split it into one PR per
   task group.
4. Follow the repository's [CLAUDE.md](../../CLAUDE.md):
   - Examples ship in TypeScript and Python, and run as-is.
   - Docs change in the same PR as code.
   - Every new doc is reachable from CLAUDE.md.
   - Every claim carries evidence.
5. When a plan's acceptance checks pass, update its **Status** line, the table above, and the
   decision log in [decisions.md](decisions.md).

## Evidence labels used throughout

The labels follow the research baseline:

- **Strong**: the evidence supports that the practice helps, or the benefit follows from how the
  mechanism works.
- **Partial**: some support, with caveats stated.
- **Thin**: reasoned or advice-level, with little or no measured support.

"None found" means neither research document contains evidence. "New" marks this review's own
synthesis.
