# Adopter red-team and model-generation review: agentic-patterns

> Edited on 2026-11-19 for vendor neutrality. References to the second research input now name it the Anthropic
> guidance companion (cited as AC). Findings are otherwise unchanged.

Reviewer lens: a staff engineer at a 200-person org in Nov 2026, running Claude 5-generation models, deciding whether to adopt this repo. Compared against `research/industry-baseline.txt` (the baseline) and `research/anthropic-companion.txt` (the companion).

Repo state: HEAD dated 2026-04-18, with 24 commits in total between 2026-03-28 and 2026-04-18. Nothing has changed in about 7 months, across at least one model generation. `CLAUDE.md` says "Last updated 2026-04-18 / v0.2.0". The repo's own committed AI config (`.claude/skills/*`, all marked `<!-- rig-generated -->`) was last touched on 2026-04-18. That is exactly the RAMP failure mode the baseline describes: "most committed artefacts are never changed after being added" (MC-11). The repo has artefacts that are present but not practised.

---

## 1. Model-generation realism: what is obsolete, what matters more

### 1a. Obsolete, or compensating for weaknesses newer models no longer have

| Pattern | Why it ages badly | Evidence from the research | Verdict |
|---|---|---|---|
| **3.1 Smart Routing / 3.2 Intent Classification / 3.3 Env-aware routing** (grep→Grep/jcodemunch/RTK, regex intent classifier) | Current harnesses already ship native Grep, Read and Glob tools, and Claude 5-generation models choose tools well. A regex pre-classifier on Bash commands is brittle: it is bypassable (`bash -c`, `xargs sed -i`, `perl -pi`) and adds a layer that must itself be eval'd (4.6 exists partly to test this layer). The token-saving figures (60-90%, ~80%, ~85%) are unsourced estimates. The README says 60-80% while L3 says 60-90%. | Anthropic guidance: "Simple first. Add … only when a measured gap appears". Baseline 4.3: deterministic checks are for *rules that must hold*, not for steering tool preference. | Demote to optional or historical. Keep one rule: **block destructive edits with a deny rule or hook**. That belongs to containment, not optimisation. |
| **3.7 TOON** | It is a niche serialisation for MCP payloads. The headline example is wrong: the doc says "JSON — 163 characters / TOON — 61 characters (63% reduction)", but when measured the JSON is **117** chars and the TOON block is **79** chars, a reduction of about 32%. The table of "typical savings" is not sourced. The doc says "records separated by pipes" while the example uses newlines. | Baseline: no evidence that token micro-optimisation improves outcomes. Cost belongs in 4.7 "cost per outcome", not per-call character counts. | Cut from the core path. Move to the further-reading appendix with corrected numbers. |
| **3.4 Scout Pattern** as a mandated precursor | Long context windows and native subagents make scouting a built-in harness behaviour, so it no longer needs a pattern. The "200 tokens vs 5000" numbers are illustrative only. | Anthropic guidance: "let agents pull in their own context" (Level 3→4). | Merge into a short "context isolation via subagents" note. Do not prescribe it. |
| **3.8 Session lifecycle / 30-min env cache** | This is implementation detail of rig, not a pattern. | n/a | Move to rig's docs. |
| **2.2 Skill Chain (brain+→plan+→tdd+→verify+→review+) + 2.7 Phase Transition Validation ("must be blocking")** | It treats every task as needing a five-phase ceremony. Blocking `tdd+` without `plan+` is a gate on process, not on outcome, and it is wrong for one-line fixes, docs and spikes. It compensates for older models that skipped planning or verification unless forced. Anthropic's own skill guidance is "set appropriate degrees of freedom". There is also an internal mismatch: L1 names an `executing-tasks` skill that is not in the chain or in superpowers' list (`executing-plans`). | Anthropic guidance: "Simple first"; "Review depth set by risk". Baseline 4.3: review depth tied to risk zone. Vercel SC-11: the skill was "never invoked in 56% of runs". | Keep verify and review as **outcome gates** (a check must pass). Demote phase tracking to optional. Replace "must be blocking" with "scale ceremony to risk". |
| **0.4 / Constitution 6: "CLAUDE.md hard max 150 lines"** | The number is arbitrary, and the repo's own reference project used a 218-line CLAUDE.md that it praises as "concise". The real principle is *only what the agent cannot discover, owned, tested, pruned*. A line cap measures length, not signal. | Anthropic guidance: Anthropic targets "under 200 lines per CLAUDE.md file". The baseline Level 3 asks for files that are "short, scoped and owned. Changes are checked". SC-4 finds overviews unhelpful. | Reframe as "short, owned, tested, re-baselined". Keep a CI warning at around 200 lines, but stop treating it as constitutional. |
| **0.1 "Export 3-5 functions maximum"** | The rule is over-precise and has no source. Ousterhout's depth is a ratio of interface to implementation, not an export count. | n/a | Soften to a heuristic. |
| **Heavy L2 prose skills that restate rules** | Anthropic says "if you keep adding emphasis to a CLAUDE.md line and Claude still misses it, that's a sign the line belongs in a hook" (OM-7). The repo agrees in principle, but its skill overlays still carry many rules as prose. | companion #4: "Hard rules live in configuration". | Move non-negotiables to deny rules, hooks and CI. Shrink the skills. |

### 1b. More important now (under-weighted in the repo)

1. **Verification as the earner of delegation.** Companion position 02 rates this Strong. Stack tests (1.1), full-loop assertions (1.2) and test integrity (1.6) are the repo's best and most durable content. They should be the centre of the repo, but today they are one level of five.
2. **Containment and sandboxing.** Companion position 03: "Contain, then relax oversight"; "supervise what it's able to do". The repo has **no containment pattern**: no sandbox, permissions, egress, secrets or agent identity. Worktrees (0.6) are about isolating the working tree, not about security. This is the biggest gap for an org.
3. **Evals that gate every change to context, skills or models.** Companion position 06. 4.6 Context Eval is present but aimed at routing logic. It should be generalised to "every CLAUDE.md, skill, hook or model change runs a fixed task bank before rollout" (baseline recommendation 02 and SC-4).
4. **Re-baselining at model change.** Companion recommendation 05: "delete first, then add back on failure", with the precedent that Anthropic removed "over 80% of Claude Code's system prompt" for Claude 5-generation models with no eval loss. The repo has no such pattern, and it is itself the counterexample: it has not changed since April.
5. **Review depth set by risk, and no unattended run without a stop.** Companion positions 07 and 08. The repo's maturity table (4.4) leaps to "Autonomous" without owner, limits, audit record or tested stop.
6. **Measuring value beyond activity.** 4.4 is reasonable, but it lacks baseline, target, review date and stop rule per investment (baseline 4.7 L5).

---

## 2. Internal inconsistencies and errors

### 2a. Broken anchors (checked programmatically with GitHub slug rules; script at `scratchpad/linkcheck.py`)

The script found 27 real broken in-repo anchors, excluding `@filename.md` placeholders and the `specs/` folder. The CI `link-integrity` job **strips anchors before checking**, which is why none of these are caught. Main classes:

- `#pattern-04--claude-md-as-project-constitution` and `#pattern-04-claude-md-...`: the real GitHub slug is `pattern-04--claudemd-as-project-constitution`, because "CLAUDE.md" becomes `claudemd`. This is broken in L0 (x4), L2 (x3), L3, L4, the glossary and anti-patterns (x2).
- `#pattern-31--smart-routing-tool-selection` (single hyphen): the real slug is `...smart-routing--tool-selection`. Broken in the glossary (x2) and the trading-bot case study. In L2, `@L3-optimization.md#pattern-31-smart-routing--tool-selection` is also broken.
- `#pattern-34--context-engineering-the-scout-pattern`: the real slug is `...context-engineering--the-scout-pattern`. Broken in the glossary (x2), further-reading and the trading-bot case study.
- L2's `@L1-feedback-loops.md#pattern-11-stack-tests`, `#pattern-12-…`, `#pattern-13-…` and `#pattern-16-…` are all missing the double hyphen.
- `examples/stack-test/typescript/README.md` → `L1-feedback-loops.md#beyond-api-testing`: that section moved to `L1-patterns/1.1-stack-tests.md`.
- L2 cites `@docs/examples/guardrails/`, a path that does not exist (it is `examples/guardrails/`).

### 2b. Wrong or garbled cross-references

- L4.1 cross-ref "**L2.3 — Full-Loop Coverage**": full-loop is 1.2, and 2.3 is Hook Automation.
- anti-patterns "Read Only What You Need" cites **Pattern 3.2 Intent Classification**. It should be 3.4 or 3.5.
- anti-patterns has an "L4 Patterns in Practice" section whose entries cite 0.7, 2.5 and 0.8, with no L4 pattern among them.
- In the glossary, the "Focused Integration Test" entry has a stray duplicate `See: Pattern 2.6 Enforcement Pipeline`. Alphabetical order is broken: Progressive and Phase are filed after Real, and Focused is under E.
- In the glossary, "New Starter Standard" is defined at both L0 (0.9) and L4 (4.3). The two patterns duplicate each other.
- The diagram `1.8-design-rinsing-workflow.png` implies a Pattern 1.8, but no 1.7 or 1.8 exists. Design rinsing is a subsection of L1, and `docs/plans/design-rinsing-pattern.md` (205 lines) is an orphan not linked from CLAUDE.md.
- `specs/` (4 files) and `docs/plans/` are not in the CLAUDE.md structure tree. This breaks the repo's own "every doc reachable" rule, and the CI reachability check is warning-only.
- L4.5 lists `./scripts/check-claude-md-lines.sh`, `check-doc-links.sh` and others. **There is no `scripts/` directory.** The real CI uses inline bash.
- jcodemunch is attributed to two different GitHub owners: `jeromedecock/jcodemunch` (L3) and `nicolo-ribaudo/jcodemunch` (further-reading and the case study). At least one is wrong.
- The trading-bot case study says routing is done by "PostToolUse hooks that classify intent and redirect". Redirecting before execution requires PreToolUse.
- L2.3's "context-aware hook" sample comments `return; // block the docker logs command`. A bare `return` does not block.

### 2c. Conceptual inconsistencies

- **Pyramid L0-L4 vs. maturity stages in 4.4** (Foundational → Orchestrated → Self-optimizing → Autonomous). These are two different ladders mapped loosely onto each other. "Self-optimizing = L3 token efficiency" is a category error: token efficiency is not self-correction. The baseline's L5 "Self-correcting" means *pruning, retiring, re-baselining*.
- **L4 scope note: "Patterns 4.1-4.5 were not implemented in the reference project."** The top of the pyramid is therefore unvalidated by the case it was extracted from. That is honest, but the README presents L4 as equal to the others. Meanwhile 4.1 Evidence-Based Claims *was* practised (verify+ is described in the case study), so the note contradicts the case study.
- **Level vs. dimension.** The baseline finds that strict sequential ladders mislead ("a single rung cannot help you place multi-agent skill"; CNCF "independent aspects"). The README hedges ("start where your gaps are"), but the pyramid diagram and "each building on the previous" assert a sequence.
- **Mocks.** The repo carefully allows mocks in unit tests. The my-claw case study then says "Unit tests use no mocks", and the L2.4 example rules list "logger, payment processor libraries … database drivers" as unmockable without scoping. Adopters will be confused.
- **my-claw numbers disagree within one doc:** ST1-ST12 vs ST1-ST11, and ST-D1-D11 vs ST-D1-D10.
- **150-line constitution vs the 218-line praised exemplar** (see 1a).
- **"Zero-defect tolerance" is constitutional, but the repo's own CI only warns** on orphans and filler words. The filler-word check also omits "just", which appears 29 times as a whole word in the docs and README; some uses are legitimate, but the rule names it.
- **"All examples must run as-is" (CLAUDE.md) is false:**
  - Both stack-test `docker-compose.test.yml` files mount `./mock-app:/app:ro`, and **no `mock-app/` directory exists** in either example. The stack cannot start.
  - `examples/guardrails` has `"test": "node --test dist/**/*.test.js"`, but there are **zero test files**, no `tsconfig.json` (so `npm run build` → `tsc` has no config), and `main: dist/index.js` with no `src/index.ts`.
  - A stand-alone type-check of `src/*/*.ts` with TS 5.4 and @types/node 20 does pass, so the code is sound but not runnable as packaged.
  - The README also says "TypeScript and Python versions for each pattern", but guardrails is TS-only.

---

## 3. Adoption friction (why a 200-person org would stall)

1. **No "where are we?" instrument.** The adoption guide's checklist is self-report, and the baseline is clear that self-assessments are unreliable (IS-6, MC-22). Teams want an **artefact-based repo census**: which AI config is committed, its last-changed date, line counts, whether hooks or deny rules exist, whether CI runs a check, whether stack tests exist. The tool would place each repo per dimension and apply the cap rule. Neither a page nor a script for this exists.
2. **No "start here in a day".** The shortest path is spread across README, L0 and the adoption guide, and runs to about 5,500 lines of docs. Teams want one page covering: a CLAUDE.md with only the undiscoverable facts, one check command CI runs, a sandbox or deny-rule baseline, and one stack test that runs from a template that actually works.
3. **Vendor and tool coupling.** rig, superpowers, jcodemunch, RTK, TOON and compound-engineering are threaded through the core docs, and some links are unreliable. An org will not adopt seven third-party plugins to follow a pattern library. The baseline's rule is "levels are tool-independent".
4. **Ceremony cost.** A five-skill chain with blocking phases on every change would be rejected by platform teams as process tax.
5. **Gaps exactly where an org needs it:** identity, permissions, sandboxing, secrets, audit, who owns an agent's change, risk-tiered review, cost governance and production gates. None of these is covered. The FAQ explicitly defers deployment and ops.
6. **Broken examples undermine trust** in a repo whose constitution is "evidence-based claims only".
7. **Thin evidence base.** It rests on one solo-ish trading-bot project and a personal multi-agent project, plus vendor or influencer sources, and some numbers are illustrative but presented as fact. Rule 2 ("Evidence-based claims only") is not applied to the repo's own claims.

---

## 4. Proposed pattern: "Prune and Re-baseline" (for the repo and for adopters)

**Pattern 4.7: Prune and Re-baseline Context.**

- **Problem:** Instruction files, skills, hooks and routing rules accumulate and are never removed. When models improve, rules that compensated for old weaknesses become noise, or actively harmful (RAMP: most artefacts are never changed after being added; Anthropic: more than 80% of a system prompt removed with no eval loss on a new model generation).
- **Solution:**
  1. Give every context artefact an owner, a `reviewed:` date and an expiry, set in front-matter.
  2. Keep a fixed task bank (10-30 representative tasks) with the model pinned.
  3. On each model upgrade, or every quarter, **delete first**: run the task bank with the artefact removed. Add it back only if a task regresses, and record which task justified it.
  4. Classify every rule: *guidance* (prose, prunable) or *invariant* (moves to a hook, deny rule or CI, and is never prose-only).
  5. Measure *maintained configuration*: when each file last changed, how often skills are invoked, and how many rules have a justifying task. Fail CI on artefacts past expiry.
- **Anti-pattern:** "We added it, so it must help." Line caps as a proxy for signal.
- **Apply to this repo:** tag every pattern with `last-validated-model:` and `evidence:` (strong / partial / anecdotal / illustrative), and add a "Model-generation notes" box per level.

### Concrete cut / merge / demote list

**Cut (or move to rig's own docs):**

- 3.7 TOON. Also fix its numbers if it is kept anywhere.
- 3.8 Session Lifecycle.
- 3.3 Environment-aware routing and its RTK/jcodemunch detection code samples.
- 2.6 and 2.7 TypeScript snippets that document rig internals.
- `specs/` and `docs/plans/`. These are completed planning docs, and the repo's own rule says "delete stale plans; git is the archive".
- The commit-history analysis section of the trading-bot case study. It is interesting, but it is not evidence for the patterns.

**Merge:**

- 0.9 AI-as-New-Starter + 4.3 New Starter Standard → one pattern.
- 3.1 + 3.2 + 3.5 → one short "Prefer native structured tools; block destructive shell edits" note.
- 3.4 Scout → a note under context isolation.
- 0.7 Documentation as System Map + 4.2 Spec Drift Detection → one "Docs freshness" pattern with an automated check.
- Duplicate L1 pattern summaries (L1-feedback-loops index vs. 1.x pages vs. glossary) → keep the 1.x pages and keep the index to one line each.
- Anti-patterns "L4" section → fold into the relevant L0/L2 entries, or rewrite against real L4 patterns.

**Demote to "optional / historical (pre-Claude 5)":**

- 2.2 Skill Chain as mandatory, and 2.7 blocking Phase Tracker.
- The 150-line constitutional rule (make it a guideline of under ~200 lines that is owned and tested).
- The "3-5 exports" rule.
- 3.6 Cross-domain multi-repo alignment (an opinion piece).
- 2.8 Compound Engineering (keep the capture-and-review loop, but pair it with pruning).

**Promote or add:**

- Verification (1.1, 1.2, 1.6) as the core of the repo.
- A new **Containment** pattern: sandbox, deny rules, secrets, egress, agent identity.
- A new **Risk-tiered review and unattended-run stop** pattern.
- 4.6 generalised to "Evals gate every context, skill or model change".
- The new 4.7 Prune and Re-baseline.
- A **repo census script** and a **one-day start page**.

**Fix immediately:**

- The 27 broken anchors. Make CI check anchors.
- Add the missing `mock-app/` directories, or remove the "runs as-is" claims.
- Add guardrails tests and `tsconfig.json`.
- The nonexistent `scripts/` references in 4.5.
- The jcodemunch URL.
- The wrong cross-refs (L4.1 "L2.3", anti-patterns 3.2).
- The my-claw count mismatches.
- The CLAUDE.md "Last updated" date and version.
