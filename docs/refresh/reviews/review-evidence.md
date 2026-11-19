# Evidence audit: agentic-patterns against the research baseline and the Anthropic guidance companion

> Edited on 2026-11-19 for vendor neutrality. References to the second research input now name it the Anthropic
> guidance companion (cited as AC). Findings are otherwise unchanged.

Reviewer lens: evidence auditor and sceptic. The repo's own constitution (CLAUDE.md:36-38, CLAUDE.md:103-104)
requires that "every claim must be specific and verifiable" and "evidence-based claims only". This review holds
the repo to that rule.

Sources: `industry-baseline.txt` (IDs MC-, PL-, SC-, OM-, SG-, PO-, IS-, MV-) and `anthropic-companion.txt` (IDs A-n,
stances 1-10). Repo state: last commit 2026-04-18; CLAUDE.md:113 "Last updated 2026-04-18". That is seven months
old at review date (2026-11-19). No repo files were edited.

Legend for the proposed labels (adopted from the baseline, line 36): **Strong** = evidence supports it, or it
follows from how the mechanism works. **Partial** = some support, with caveats. **Thin** = reasoned or advice-level
only, little or no measured support.

---

## P0: claims the repo cannot support, or that are arithmetically wrong

### P0.1 The TOON worked example is wrong by a factor of two

- `docs/L3-optimization.md:425-436`: the comments say "JSON — 163 characters" and "TOON — 61 characters (63%
  reduction)". Counted with `len()`, the JSON string is **117** characters and the TOON block is **79** characters.
  That is a **32% reduction, not 63%**.
- `docs/L3-optimization.md:516`: "{"orderId": "abc", "status": "filled"}" is called "46 characters". It is **38**.
- `docs/L3-optimization.md:505-512`: the savings table (~61-63% at every size) and the claim that "Savings stay in
  the 60-65% range regardless of record count" both contradict the page's own 2-record example. The table values
  look estimated, not measured. No tokenizer, dataset or script is named.
- `docs/L3-optimization.md:438, 445`: "Records are separated by pipes (or newlines)". As far as I know, the TOON
  format separates rows with newlines and allows pipe as an alternative *field* delimiter. Check this against
  the spec before keeping the line.
- Characters are not tokens. The section's title claims token optimisation but reports only character counts.
- Research context: MV-1 says "measure before optimizing" applies to token spend. Companion stance 9 and A48 say
  cost per outcome, not token consumption, is the primary measure of value. The baseline gives no evidence
  that TOON's output keeps model accuracy unchanged.
- **Fix:** recompute the example, or remove it. Replace the table with a reproducible script that names its
  tokenizer, or cite TOON's own published benchmarks and label them Vendor/Thin. Also state that the effect on
  comprehension accuracy has not been measured.

### P0.2 The "60-90% token savings" headline has no source, and the repo gives three different numbers

- `docs/L3-optimization.md:11` says "reduce token consumption by 60-90%". `docs/L3-optimization.md:598` says
  "Result: 60-90% token savings, fewer errors, better outcomes". `docs/cross-cutting/glossary.md:267` gives 60-90%.
  `README.md:53` gives "60-80%". `docs/diagrams/3.1-smart-routing-flow.excalidraw:41` gives 60-90%.
- The per-tool table (`docs/L3-optimization.md:29-37`, with ~75-85%) and its twin in `examples/guardrails/README.md:137-147`
  cite no measurement. The example code under `examples/guardrails/` routes commands but never measures tokens.
- `docs/cross-cutting/anti-patterns.md:430` says "raw grep costs 80% more tokens". That is a different claim (80%
  *more*, not 80% *less*). `reference-telegram-trading-bot-case-study.md:366` says "~15% of the token cost". These
  figures are mutually inconsistent.
- "Grep tool vs bash grep ~80%" (`L3-optimization.md:31`) is doubtful on mechanism. Claude Code's Grep tool is
  ripgrep and returns much the same lines. The savings come from scoping and output limits, not from the choice
  of tool.
- "fewer errors, better outcomes" (`L3:598`) and "Agent efficiency is quality" (`README.md:53`) are causal
  claims with no evidence behind them. MV-20 (Princeton HAL) found that more spend often buys no accuracy
  (21 of 36 configurations). By the same logic, cutting tokens does not automatically buy quality.
- Internal contradiction: `docs/L4-standards-measurement.md:358` lists "Tracking tokens consumed" as a *vanity
  metric*, yet L3's headline value proposition is token reduction. MV-1, MV-2 and companion stance 9 side with L4.
- **Fix:** pick one number and attribute it ("rtk's README claims...", "jcodemunch's README claims..."), label it
  Vendor/Thin, or measure it on a fixed task bank as MV-9 describes. Reframe L3's value as cost per completed
  task at equal pass rate, not as raw token reduction.

### P0.3 "~80% of agent failures come from context" and "90.2% better" come from a YouTube video

- `docs/L3-optimization.md:242` presents the 80% figure as "the observation". `docs/references/further-reading.md:79,83`
  repeats it and adds "90.2% Better AI Coding Results" as the video's title.
- Neither figure has a method or dataset. The research supports the *direction*: SC-1 says context should be
  curated to "the smallest possible set of high-signal tokens", and SC-7 (Chroma) found performance "grows
  increasingly unreliable as input length grows". It does not support the number. The baseline also shows that
  failures come from verification gaps (OM-7 "no way to check its own work"; finding 2), so a single-cause
  "80%" framing runs against the research.
- **Fix:** attribute it as the video author's claim ("Medin claims..."), label it Thin, and cite SC-1 and SC-7
  for the direction.

### P0.4 The constitution's 150-line rule is undermined by the repo's own `@` imports

- `CLAUDE.md:109` and `docs/L0-foundation.md:167` set a hard limit of 150 lines. But CLAUDE.md:30, 70-99 reference
  every doc with `@docs/...` syntax. In Claude Code, an `@path` in CLAUDE.md is an *import* that is expanded into
  context at load time (SC-8 / A8, memory docs). The effective always-loaded context is therefore the whole
  library: README plus all L0-L4 docs plus cross-cutting plus references, several thousand lines. This session
  loaded exactly that.
- That is the pattern the research warns against. SC-4, the only controlled study, found context files "do not
  generally improve task success rates, while increasing inference cost by over 20%" and that repository
  overviews "are not helpful". SC-6 found 68% accuracy at 500 simultaneous instructions. A7 reports Anthropic
  removed over 80% of Claude Code's system prompt with no loss.
- The number 150 itself has no source. Anthropic's own guidance is "target under 200 lines per CLAUDE.md file"
  (A8, companion 4.2 level 3). SC-1 adds "minimal does not necessarily mean short". The research supports "small and
  non-redundant" (Partial), not a specific line count.
- The repo's own flagship breaks the rule: `reference-telegram-trading-bot-case-study.md:17` calls a
  **218-line** CLAUDE.md "concise".
- The L0 template (`docs/L0-foundation.md:172-188`) tells teams to put a "Repository Structure" tree in CLAUDE.md.
  SC-4 says overviews of this kind are unhelpful. CLAUDE.md:12-29 does exactly that.
- **Fix:** replace `@docs/...` with plain relative links or path references, so docs are discovered on demand
  rather than imported. Re-word rule 6 as "small, non-redundant, holds only what the agent cannot find by reading
  the repo (Partial: SC-4, SC-5, SC-11 disagree)". Keep 150 as a house rule, labelled as a house rule. Add the
  practice from baseline 4.2: check changes to the instruction file against a small eval or a before/after run
  (SC-4, Partial).

### P0.5 Self-contradictory mock rules; "always indicate real bugs" is falsifiable

- `docs/L1-patterns/1.1-stack-tests.md:22` says stack-test failures "always indicate real bugs, never test
  artifacts". The same doc contradicts this at :97-107 (brittleness), and so do Pattern 1.4 (port collisions,
  Docker exhaustion) and `testing-infrastructure.md` ("brittle test infrastructure wastes more agent tokens than
  any other source", also unmeasured). Re-word as "high, when the infrastructure is deterministic".
- `1.1-stack-tests.md:67-69` rates unit tests "Mock Policy: Everything", "Confidence: Low", "Diagnosticity: Low
  (false positives from mocks)". That contradicts L0 Pattern 0.5 (`L0-foundation.md:196-228`), where unit tests
  are "the contract" that "never lies", and 1.5:13, where mocks are "appropriate and encouraged".
- `reference-my-claw-case-study.md:191`: "Unit tests use no mocks". The case study is cited as following the
  repo's patterns, and the repo says the opposite.
- `reference-telegram-trading-bot-case-study.md:21`: mandate #1 says "Never mock logger, never mock ethers" with
  no test-tier scope, while :241 scopes it to stack tests. The repo's constitutional rule 1 is the scoped form.
- `1.5-no-mock-philosophy.md:5` ("Mocks lie") and :155 ("PostgreSQL in Docker adds ~2 seconds") have no source
  or measurement.
- The research does not test mocking at all. The nearest evidence: PL-3 (DORA) says "the tests must also run in
  a few minutes or less", and PL-18 says cheap computational sensors should run on every change. Both support
  tiering (fast unit and lint checks always, stack tests before commit, as in `1.1:83`), not an absolute rule.
  IS-15 (agent "would declare success even when tests were failing") and IS-14 support Pattern 1.6 test integrity.
- **Label:** real dependencies at the stack tier = Partial (follows from mechanism, unmeasured). The "no mocks"
  framing as a whole = Thin. Make the four documents agree.

### P0.6 my-claw "auto-skip if no .env" breaks Pattern 1.6

- `reference-my-claw-case-study.md:191`: integration tests "auto-skip if no .env". A test that silently skips
  is the escape hatch that `1.6-test-integrity.md` and CLAUDE.md rule 5 forbid. A case study offered as
  evidence for the pattern shows a violation of it.

---

## P1: the evidence base is first-party and circular

### P1.1 What the repo actually cites

- Zero peer-reviewed or independent studies. The repo cites no DORA, METR, SPACE, RAMP or OWASP work. The
  baseline's independent anchors (finding 8) are absent.
- Evidence sources: two first-party case studies (the trading bot and my-claw), practitioner blogs and podcasts
  (Steinberger, Pocock, Waselnuk), YouTube videos (WISC, my-claw sources) and tool READMEs (rtk, jcodemunch, TOON).
- **Circularity.** `README.md:30-32` says the patterns were extracted into this repo and then used to build rig.
  `L4-standards-measurement.md:5` then cites rig as having "implemented and validated" Pattern 4.6. my-claw's
  Phase 3 rinsed *this repo* (`reference-my-claw-case-study.md:72-96`) and is then cited as evidence for it
  (`L1-feedback-loops.md:134`, `L2-behavioral-guardrails.md:497`). Both downstream implementations are
  self-citations. They prove the patterns can be implemented, not that they work.
- The trading-bot case study is an n=1 account written by the same author, of a private repo the reader cannot
  inspect. Examples: the 92% "coverage" (:39, :62, :449) has no definition; the commit classification method
  (:459-472) is not stated.
- Credit where due: `L4-standards-measurement.md:5` has an honest scope note ("4.1-4.5 were not implemented in
  the reference project"). That is the model to extend everywhere.

### P1.2 Internal inconsistencies in the case studies

- my-claw test counts disagree across the doc. :80 says "12 stack tests (ST1-ST12)" but :181 says "ST1-ST11".
  :80 says "11 Docker stack tests (ST-D1-ST-D11)" but :184 says "ST-D1-ST-D10". :80 says "5 tool stack tests"
  but :189 says "ST-T1-ST-T6".
- my-claw :90 says "Plans are archived when complete ..., following the principle of deleting stale docs rather
  than archiving them". That sentence contradicts itself.
- Trading bot :474-478 calls a figure the "feature-to-test ratio" of 0.54x (159/297 is actually *test-to-feature*),
  then calls December's 2.71x "test-heavy". The label is inverted.
- Trading bot :497 says the "Bugfix rate is high but expected ... bugs are caught early". That is a causal claim
  from a commit share, with no baseline or comparison.
- Trading bot :358 says raw commands "are intercepted by PostToolUse hooks that classify intent and redirect".
  PostToolUse fires *after* the command runs (as `L2-behavioral-guardrails.md:158` itself says), so it cannot
  redirect. This should be PreToolUse.
- `L2-behavioral-guardrails.md:222`: in the "context-aware hook" example the comment says `return; // block`,
  but a bare return allows the command. The code does the opposite of what the comment says.

### P1.3 Recommendation: adopt the baseline's evidence labels

Add a one-line "Evidence:" footer to each pattern, using Strong, Partial or Thin plus the basis (independent /
vendor / first-party case study / practitioner). Proposed labels, and the research that sets them:

| Repo pattern | Proposed label | Basis |
|---|---|---|
| 2.3/2.4 hooks over prose; hard rules in deterministic checks | **Strong** | OM-7, OM-18, OM-12 (three orgs independently), SG-11, SG-16, SC-8; baseline finding 3; companion position 04 |
| L1 closed loop: agent ends on a check it can run | **Strong** (principle), Partial (numbers) | OM-7, OM-9, MC-3, MC-7; finding 2; companion position 02 |
| 4.1 evidence-based claims; distrust self-report | **Strong** | IS-6 (believed +20% after a measured 19% slowdown), MV-7, MV-8, MC-22; finding 5 |
| 4.6 context eval | **Strong as practice**, no outcome evidence | MV-9 (task banks, pass^k, read transcripts), MV-10, PO-25 |
| 4.4 metrics: no vanity metrics | **Strong** | MV-1, MV-2, MV-5 (SPACE); companion stance 1 |
| 1.6 test integrity | **Partial** | IS-15 (agents declare success on failing tests), IS-14 |
| 0.6 worktrees / isolation | **Partial** | OM-18 (sandboxing as default), PL-15; now native in Claude Code |
| 0.4 short CLAUDE.md | **Partial**; the 150 figure is a house rule | SC-1, SC-4, SC-5, SC-11 disagree; A8 says <200 |
| 0.7 docs updated with code | **Thin** for agents | MC-11: committed artefacts are mostly never updated (presence is not practice) |
| 1.1/1.5 stack tests, real deps | **Partial** (mechanism) / **Thin** (absolutism) | PL-3, PL-18 tiering; no study |
| 2.8 compound engineering, "80/20" (`L2:487`) | **Thin** | Vendor plugin claim; IS-13 says the flywheel must "remove as well as add" |
| 3.1-3.5, 3.7 token savings | **Thin** | Tool READMEs, unmeasured; MV-1, MV-20 caution |
| 3.4 scout pattern | **Partial** | SC-1, OM-8; Anthropic subagent guidance; no measured comparison |
| 3.6 multi-repo over monorepo | **Thin** | No source; reasoned |
| 0.1 "3-5 exports maximum" (`L0:15`) | **Thin** | Ousterhout gives no number; rule of thumb |
| 4.4 maturity stages, "30% intervention" threshold (`L4:345`) | **Thin** | Arbitrary; see P2.2 |

---

## P2: claims the research weakens or reframes

### P2.1 Instruction-file value is contested, not settled

The repo treats CLAUDE.md as unambiguously high-ROI ("highest-impact, lowest-effort starting point",
`README.md:61`; `adoption-guide.md:96`). The research is split three ways (baseline 4.2 "Contested"): SC-4
found no gain and over 20% extra cost; SC-5 found efficiency gains but did not measure correctness; SC-11
(Vercel) found a large gain for a compact docs index. The repo should say this is contested and adopt the
baseline's reading: content the model cannot find for itself, kept small, and tested.

### P2.2 The pyramid is a single ladder; the research flags that as a recurring flaw

- `README.md:41` says each level builds "on the previous". `L4-standards-measurement.md:296-303` maps four
  stages from Foundational to "Autonomous" onto L0-L4, with "End-to-end delivery" at the top.
- The research flags this as a recurring flaw: a single ladder hides uneven progress (baseline 3.3). It also says
  "higher is not always better" (MC-5, MC-13), and the defensible top is "a capability, not a volume" (3.7). The
  cap rule (3.5) has no counterpart in the repo. Gate criteria (`L4:351-353`) are prose, with no observable
  artefact check (compare baseline 3.6).
- Self-assessment checklists (`adoption-guide.md:13-38`) measure *presence* ("CLAUDE.md exists"). MC-11 and
  finding 6 show that presence is not practice. Add "last changed" and "has a test" checks.

### P2.3 Repo silent on the areas where the research says the field is weakest

The repo has no material on production ownership of agents (4.5), security and governance beyond hook examples
(4.4: sandboxing, lethal trifecta SG-1, Rule of Two SG-2, supply-chain risk in skills SG-28), or measuring value
against a baseline (4.7). For an evidence auditor, this matters mainly because the repo recommends installing
third-party skills and plugins (superpowers, gstack, compound-engineering, rig) with no vetting guidance. SG-28
found 13.4% of 3,984 scanned public skills had a critical issue and 76 were confirmed malicious. IS-13 says
"inspect and review skill instructions before adapting them". This should be added to L2.

### P2.4 Claims the research strengthens, which can now be cited

- L2's opening thesis, "Prose instructions are insufficient" (`L2:3`), is directly supported by OM-7 ("that's a
  sign the line belongs in a hook"), OM-18, SG-11 and SC-8 ("context, not enforced configuration").
- L1 "Close the loop" (`L1:171`) is supported by OM-7 and OM-9. It can cite those instead of a podcast quote.
- L4.1 "Prediction-based claims" (`L4:84-89`) is supported by IS-6 and MV-7.
- L4.6 graduated scoring and threshold gating are consistent with MV-9. The pattern should also adopt pass^k
  reporting and "read the transcripts" from MV-9. Note that its 0.5 partial credit and 0.7 threshold
  (`L4:551, 568`) are arbitrary.
- L4.4's vanity-metric anti-pattern (`L4:358`) is supported by MV-1, MV-2 and companion stance 1.
- The worktree and isolation thesis is supported by OM-18 ("agent sandboxing a sensible default").

---

## P3: stale or unverifiable references (as of 2026-11-19)

Network checks to GitHub were blocked in this session, so the repository links below were **not verified**.
Each needs a manual check.

1. **jcodemunch has two inconsistent URLs and an implausible creator.** The repo uses
   `github.com/jeromedecock/jcodemunch` (`L3-optimization.md:295, 352`; `examples/guardrails/README.md:153`) and
   also `github.com/nicolo-ribaudo/jcodemunch` (`further-reading.md:104`;
   `reference-telegram-trading-bot-case-study.md:366`). `further-reading.md:102` names "Nicolo Ribaudo" as the
   creator. To my knowledge the project is `jgravelle/jcodemunch-mcp`. Verify and use one link.
2. **OpenSpec** (`L2-behavioral-guardrails.md:5`): `github.com/openspec-dev/openspec`. I believe the canonical repo
   is `Fission-AI/OpenSpec`. Verify.
3. **Claude Code URL** (`further-reading.md:128`): `claude.ai/code`. Current documentation lives at
   `code.claude.com/docs` (PL-13, PL-16, SC-8 and others all cite it).
4. **Matt Pocock article** (`further-reading.md:15`) links to a Medium profile, not to the article. The claim
   cannot be checked.
5. **Product facts that have moved since April 2026** (companion 4.1-4.4). The repo does not mention: the sandbox
   (off by default, A11); auto mode as the default start mode from v2.1.283 (A12); managed and server-managed
   settings; plugins and marketplaces; Code Review; AGENTS.md as an open format under the Agentic AI Foundation
   (PL-19, PL-21); the Agent Skills open specification (PL-22). L2's description of a skill as markdown with a
   "base reference" (`L2:44-51`) predates the spec. L0.6 recommends a superpowers skill for worktrees, but
   Claude Code now has native worktree support.
6. **Hook pseudocode** (`L2:186-225`, `anti-patterns.md:389-409`) shows a JS `hook.on(...)` / `throw` API. Real
   Claude Code hooks are configured commands that block via exit code or a JSON decision (SG-11). Label the
   snippets as pseudocode for a fictional API, or show the real configuration.
7. **Model generation drift.** A7 reports that Claude 5-generation models needed 80% less system prompt. Routing
   tables and "always prefer tool X" savings measured on older models may no longer hold. Add a "re-baseline at
   each model upgrade" note (companion 4.2 rec 05; baseline 4.2 level 5).
8. **Steinberger descriptor** (`README.md:24`, `L1:173`, `L2:548`, `L3:624`): "creator of OpenClaw". Reportedly
   he moved to OpenAI in early 2026. The attribution still holds, but check whether the role description is
   current.
9. **Broken anchors** (13 found by script; ".md" in a heading slugs to `claudemd`, not `claude-md`):
   `L4:263`, `L3:409`, `glossary.md:59,150,194,204,234`, `anti-patterns.md:78,114`, `further-reading.md:83`,
   `reference-telegram-trading-bot-case-study.md:358,366`, and `examples/stack-test/typescript/README.md:30`
   (`#beyond-api-testing` moved to `L1-patterns/1.1`). Also `L2:235` points to `@docs/examples/guardrails/`,
   which does not exist (examples live at the root), and `L4:98` references "L2.3 — Full-Loop Coverage", which
   is not L2.3. Under rule 3 (zero defects) these are defects.
10. **Master index breach.** `specs/` and `docs/plans/` are not reachable from CLAUDE.md, which breaks the repo's
    own master-index rule (CLAUDE.md:51-54).
11. **Mismatched cross-reference.** `anti-patterns.md:457` maps "Read Only What You Need" to Pattern 3.2 (Intent
    Classification), but the advice concerns targeted reads, which Pattern 3.5 covers.

---

## Suggested remediation order

1. Fix the TOON arithmetic and remove the unsourced token-savings figures, or attribute and label them (P0.1-P0.3).
2. Replace the `@` imports in CLAUDE.md with plain links, and re-word rule 6 as evidence-labelled (P0.4).
3. Make the mock rules agree across 1.1, 1.5, L0.5 and both case studies (P0.5, P0.6).
4. Add evidence footers (Strong/Partial/Thin) with research IDs, and label the case studies "first-party, n=1".
   State the rig and my-claw circularity (P1).
5. Fix the case-study inconsistencies and the PostToolUse/`return` errors (P1.2).
6. Fix the links and anchors, refresh product facts, and bump the "Last updated" date (P3).
