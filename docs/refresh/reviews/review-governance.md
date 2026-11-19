# Review: agentic-patterns through the security, governance, ownership and people lens

> Edited on 2026-11-19 for vendor neutrality. References to the second research input now name it the Anthropic
> guidance companion (cited as AC). Findings are otherwise unchanged.
> Edited again on 2026-11-19: Anthropic source IDs renamed from the A27 form to the AN-27 form, and citations of the
> companion's own positions, stances and recommendations replaced with the Anthropic or baseline sources
> beneath them. Every ID resolves in [../sources.md](../sources.md).

Reviewer 4 of 5. Lens: agent identity, containment, prompt injection, supply chain, audit, ownership,
stop authority, and keeping human supervisory skill alive.

Inputs:

- Repo at `/home/user/agentic-patterns` (HEAD `a07ad93`), all docs plus `examples/guardrails/`.
- Baseline: `research/industry-baseline.txt` (cited as IB; source IDs PL-, SG-, PO-, IS-, MC-).
- Anthropic guidance companion: `research/anthropic-companion.txt` (cited as AC; source IDs AN-n).

Evidence strength labels (Strong / Partial / Thin) are taken from the research documents, not
assigned by this reviewer, unless marked "reviewer judgement".

---

## 0. Headline

agentic-patterns is a strong library on **verification** (L1) and on **making rules executable** (L2),
and it already says the right sentence: "Prose instructions are insufficient ... Skills and hooks enforce
discipline through the tool layer" (`docs/L2-behavioral-guardrails.md:3`, `README.md:51`). That sentence
is half of baseline finding 3. The other half, that hard limits must sit *outside the agent's reach*
(sandbox, credentials, downstream authorisation), is absent. The repo treats the agent harness as the
trust boundary, has no threat model, and has no material on identity, containment, prompt injection,
the supply chain of the skills/plugins/MCP servers it recommends, audit, ownership of agents or
agent-written code, stop authority, or supervision-skill retention.

On the baseline's own curve, the repo's guidance would place a team at roughly **level 2 on security
and governance** ("rules written, not enforced"; users approve each action; settings per user; logs do
not identify agents, IB 4.4 level table) and **level 1-2 on production ownership** and **individual and
team skill**. Under the baseline's cap rule (baseline 3.5), those dimensions cap safe unattended autonomy at
level 2, while the repo's L4 "Autonomous" stage (`docs/L4-standards-measurement.md:290`) invites
teams to go further.

---

## 1. Concrete gaps and errors (with file:line)

### 1.1 Enforcement examples that do not enforce

| # | Location | Problem | Why it matters |
|---|----------|---------|----------------|
| E1 | `docs/L2-behavioral-guardrails.md:216-225` | The "context-aware hook" logs two warnings and `return;` with the comment `// block the docker logs command`. A bare `return` from a PreToolUse handler allows the call. The example does the opposite of what its comment says. | The repo's own anti-pattern catalogue names this exact failure ("Hooks That Block, Not Just Log", `docs/cross-cutting/anti-patterns.md:388-422`, advisory example at `:402-409`). The L2 doc ships the anti-pattern as the positive example. Readers copy examples, not prose. |
| E2 | `docs/L2-behavioral-guardrails.md:205-210`; `docs/cross-cutting/anti-patterns.md:411-419` | `args.command.includes('sed -i')` is presented as "blocking destructive operations". Bypassed by `sed -e s/a/b/ -i f`, `sed -ie`, `sed --in-place=bak`, `perl -pi -e`, `python -c "open(...).write(...)"`, `printf ... > f`, `tee f`, `cp`, `bash -c "$(echo c2VkIC1p \| base64 -d) ..."`. | Fine as an ergonomic nudge ("use the Edit tool, it keeps undo history"). Wrong when framed as a control. String-matching shell commands is a denylist on a Turing-complete input; it cannot be a security boundary. |
| E3 | `examples/guardrails/src/core/intent.ts:34-35`, `:57-62` | The classifier anchors on `^\s*sed\s+(-i...)`, so `/usr/bin/sed -i`, `env sed -i`, `sudo sed -i`, `xargs sed -i`, `sed -n -i` are `pass_through`. `splitCompoundCommand` splits on `\|`, `;` and `&&` with no quote awareness, so `sed -i 's/a\|b/c/' f` splits mid-expression and `$(...)`/backticks/newlines are not segments at all. | The example is labelled "working code" under the repo's own rules (`CLAUDE.md` "Working code only"). It works as a router; it does not work as the "BLOCK" its doc claims (`docs/L3-optimization.md:98`, `:128`). |
| E4 | `examples/guardrails/src/core/router.ts:75-76`; `src/config/routing.config.ts:124-131` | Default is allow: unknown commands (`rm -rf`, `curl ... \| sh`, `git push --force`, `chmod`, `ssh`) resolve to `{ action: 'allow' }`. | Default-allow is right for token routing. It is wrong for anything described as a guardrail. The doc must say which one this is. |
| E5 | `examples/guardrails/src/config/routing.config.ts:115-122`; `docs/L3-optimization.md:99` | Every `docker` command is allowed ("pass-through, no dedicated tool"). | Access to the Docker socket is root-equivalent on the host (`docker run -v /:/host ...`). The repo's Docker-first stack testing (L1) means agents routinely hold this capability. The one routing rule with the highest blast radius is the one marked benign. |
| E6 | `examples/guardrails/README.md` (usage block, "if (resolution.action === 'block') { // Agent stops, explains why }") | The `block` resolution is returned to the agent, which is expected to comply. Enforcement depends on the model's cooperation. | This is a prompt with extra steps, the thing L2 says is insufficient. A block must be applied by the harness (deny the call) or below it (sandbox/credentials). |
| E7 | `docs/L2-behavioral-guardrails.md:376-397` (2.6) | The enforcement pipeline is wired to `handlePostToolUse`. A PostToolUse check runs after the edit or command executed; "block" at that point cannot prevent the action, only stop the next turn. The doc does not state this. | Severity resolution is useful; but readers will believe "block" in PostToolUse prevents a mock from landing or a destructive command from running. Prevention belongs in PreToolUse, a permission deny rule, or CI. |
| E8 | `docs/L2-behavioral-guardrails.md:190-226` | All hook examples use an invented `hook.on('PreToolUse', ...)` API with `throw`. No real harness looks like this; in Claude Code a PreToolUse hook is an external command that denies via exit code 2 or a JSON permission decision. | Readers cannot copy the examples into any real tool, and the invented API hides the key fact that a hook is a separate process the harness obeys, which is what makes it deterministic (SG-11). |
| E9 | `docs/L2-behavioral-guardrails.md:168` | "Require confirmation before deleting files matching a pattern" is offered as a PreToolUse control. | Baseline finding 4: people approve 93% of permission prompts (SG-9, Partial); approval "can degrade under ... approval fatigue" (SG-26). Confirmation prompts should be reserved for a short list of irreversible actions, and the approve rate measured (IB 4.4 practice row, Partial). |
| E10 | `docs/L2-behavioral-guardrails.md:282`; `:291` | "Constitutional rules must have no escape hatches", with rig's `checkConstitutional()` using "regex detection to identify mock patterns". | Regex over edited text is bypassable by renaming (`const fakeDb`, a helper module, a test double factory). That is acceptable for a code-quality rule (the cost of a miss is a bad test). The doc should separate *quality* rules, where a heuristic hook plus CI plus review is proportionate, from *safety* rules, where a heuristic is not a control. |

### 1.2 Missing threat surfaces the repo itself creates

| # | Location | Gap |
|---|----------|-----|
| G1 | `docs/L1-feedback-loops.md:70-134` (Design Rinsing) | The workflow directs an agent at external codebases, YouTube transcripts and articles ("Point the agent at the source", `:93`). These are untrusted content. The same session typically has repository write access, shell, and network: all three legs of Willison's lethal trifecta (SG-1, Strong as a design rule) or Meta's Rule of Two (SG-2). No warning, no instruction to rinse in a read-only, network-limited session. Prompt-injection defences fail against adaptive attackers (SG-5, SG-19), so "be careful" is not a mitigation; session composition is. |
| G2 | `docs/L3-optimization.md:356-412` (3.6 Cross-Domain Alignment) | Recommends one agent reading and proposing coordinated changes across many repositories. This widens the agent's access scope with no mention of least privilege (SG-16, SG-8: "read-only DB access ... can be deployed far more broadly", Strong) or of read-only credentials for the alignment pass. |
| G3 | `docs/L3-optimization.md:531-566` (3.8) | Session start hook auto-executes a third-party binary (`exec('jcodemunch', ['index', projectDir])`) on every session. Combined with the repo citing **two different upstreams** for that tool, `github.com/jeromedecock/jcodemunch` (`docs/L3-optimization.md:295`, `:352`) and `github.com/nicolo-ribaudo/jcodemunch` (`docs/references/further-reading.md:104`, `docs/references/reference-telegram-trading-bot-case-study.md:366`), this is a supply-chain hazard: readers cannot tell which binary is genuine, and the doc auto-runs it. (Reviewer has not checked which, if either, URL is real; the inconsistency alone is the finding.) |
| G4 | `README.md:26-36`; `docs/L0-foundation.md:246`; `docs/L2-behavioral-guardrails.md:5`, `:116-128`, `:505`; `docs/cross-cutting/adoption-guide.md:107`, `:113-117` | The repo recommends installing rig (`rig init`), superpowers, gstack, compound-engineering, RTK, jcodemunch, and MCP servers, all of which execute code or inject instructions into agent sessions with the developer's privileges. No guidance on vetting, pinning versions, or treating fetched content as untrusted. Baseline: Snyk found 13.4% of 3,984 public skills with a critical issue and 76 confirmed malicious payloads (SG-28); a fake MCP package added a backdoor in version 1.0.16 after 15 clean versions (SG-29). Practice "every skill, plugin and MCP server is vetted ... versions are pinned" is Strong on threat, Partial on prevalence (IB 4.4). Thoughtworks names "adopting community skill libraries without understanding them" as a failure mode (IS-13). |
| G5 | `docs/L3-optimization.md:414-527` (3.7 TOON for MCP) | Treats MCP responses purely as a token-cost problem. MCP tool output is untrusted input to the model (SG-14, SG-8: "an audited connector isn't the same as audited data"). Nothing on token audience binding (PL-8, Strong: "MCP servers MUST NOT accept or transit any other tokens") or on per-agent curated tool subsets (PL-17, Thin). |
| G6 | `docs/L2-behavioral-guardrails.md:469-537` (2.8 Compound Engineering); `docs/references/reference-my-claw-case-study.md:88`, `:170-172` | Agents write "learnings" that are injected into future system prompts (`get_project_context()`). This is a persistence channel: one injected session can plant instructions that every later session obeys (memory poisoning). Needs: learnings go through review like code (IS-16: skills "get the same treatment as code: pull requests, reviews, version history", Partial), provenance on each entry, and a retirement path ("the flywheel needs to remove as well as add", IS-13, Thin). |
| G7 | `docs/references/reference-my-claw-case-study.md:47`, `:158` | Presented uncritically: an "autonomous (no oversight)" tier with "auto-promotion after consecutive successes". Promotion on a success streak is the self-report trap of finding 5 in automated form: success is judged by the system being promoted, with no owner, stop, or audit named. Baseline tiering (SG-26, SG-6, Partial) assesses tier alongside access scope; the baseline requires an owner, permitted actions, limits, an audit record and a tested stop before unattended work (baseline 3.5, level 4), and Anthropic stops the agent at the production gate (AN-27). The case study should flag this as a risk, not a takeaway. |
| G8 | `docs/L0-foundation.md:254-262` (0.6 worktrees) | "Parallel isolation", "Non-destructive", "Deterministic state" are framed as isolation properties. Worktrees isolate *working trees*, not *privileges*: same user, same credentials, same network, shared `.git/hooks` and config, and an agent in one worktree can write to another. Readers can mistake this for containment. |
| G9 | `docs/L1-patterns/1.5-no-mock-philosophy.md` (Stripe example, `process.env.STRIPE_TEST_KEY`); `docs/references/reference-telegram-trading-bot-case-study.md:180-186` (bootstrap JSON with `privateKey` fields), `:248` | Secrets are reachable from the agent's environment and from committed config. Testnet keys are low-stakes, but the pattern teaches agents to work in sessions that hold credentials. Baseline: "it never sees the credential itself" (PL-14, Partial); GitGuardian reports agent-co-authored commits leak secrets at about 2x baseline (SG-30, Partial, vendor, correlational). The only security item in the review checklist is "No hardcoded paths or secrets" (`docs/L4-standards-measurement.md:634`). |
| G10 | `docs/L2-behavioral-guardrails.md:258`; `docs/references/reference-telegram-trading-bot-case-study.md:22-23` | "Docker-first development — no local OS execution" and "Container Preservation" are framed as reproducibility and etiquette. They are half of a containment story that the repo never completes: the app runs in containers, the *agent* runs on the host with the developer's shell, keys and Docker socket. |

### 1.3 Governance, ownership and audit

| # | Location | Gap |
|---|----------|-----|
| O1 | Whole repo | No concept of agent identity. Nothing distinguishes "the agent acted as itself" from "the agent acted for a person" (RFC 8693 framing, PL-7, PL-5, Strong as principle); no short-lived credentials (PL-5, PL-8, PL-9, PL-10, Strong on direction); no per-developer or per-agent gateway credential (PL-13, Partial). |
| O2 | Whole repo; `docs/L4-standards-measurement.md:319` | "Audit completeness — percentage of agent changes with full evidence trail" is the only audit item, and it means test output, not an action log. No record of which agent, on whose behalf, with which tool calls (SG-7, SG-20, Partial; "no published standard defines what an agent audit record contains"). |
| O3 | Whole repo | No author of record for agent-written code. Converged open-source rule: "the contributor is always the author and is fully accountable" (LLVM, PO-16); "AI agents MUST NOT add Signed-off-by tags" (Linux, PO-17); disclosure (Ghostty PO-18, ASF PO-19). The requester must not be the sole approver (GitHub, SG-27, PO-20). Partial overall. The repo's own commit attribution practice (Co-Authored-By trailers) is never discussed as a governance choice. |
| O4 | Whole repo | No register of agents, skills, hooks or unattended workflows, no owner field, no expiry, no retirement (PO-10 to PO-15, Partial; AWS: "an agent portfolio without lifecycle discipline becomes a graveyard of undocumented services with forgotten owners", PO-12). Pattern 0.8 Aggressive Cleanup (`docs/L0-foundation.md:326-409`) covers dead code but not dead skills, hooks or agents, which accrue privileges rather than just noise. |
| O5 | `docs/L4-standards-measurement.md:269-370` (4.4) | Maturity stages run to "Autonomous ... End-to-end delivery with governance guardrails" (`:290`) with gates at `:352-355` that never require a stop, an owner, rollback that is rehearsed, or containment. Contrast the baseline's cap rule and baseline: "the weakest of platform, governance, ownership and measurement limits how much autonomy can safely be granted" (IB summary and 3.5). |
| O6 | Whole repo | No stop. No kill switch, circuit breaker, rate limit or "who can stop this agent and who approves restoring it" (PO-14, PO-12, PO-28, Partial; SG-26, SG-7, Thin). "Rollback frequency" is measured (`docs/L4-standards-measurement.md:318`) but rollback is never designed; Google notes rollback becomes risky at AI change volume (PO-28, Thin). |
| O7 | Whole repo | Changes to skills, hooks, CLAUDE.md, routing config, or model version are not treated as releases. Pattern 4.6 Context Eval is the right instrument and is the repo's best governance asset, but it is framed as routing correctness, not as the release gate for agent configuration (PO-25, PO-14, Partial; AN-16 and AN-29, evals and incidents-as-evals, Strong as practice). |

### 1.4 People: supervision skill and self-report

| # | Location | Gap |
|---|----------|-----|
| P1 | `docs/L4-standards-measurement.md:13-95` (4.1 Evidence-Based Claims); `CLAUDE.md:105` | "Evidence" is command output the agent pastes into its own transcript (template `:19-29`). That is self-report with formatting: the agent chooses what to run, what to show, and can truncate (the doc lists "selective evidence" as an anti-pattern, `:91`, but provides no mechanism). Evidence the reviewer trusts should come from a system the agent cannot edit: CI run logs, required checks, signed artefacts. Finding 5 (Partial-Strong) is about humans, but the same logic applies to agents. |
| P2 | `docs/L4-standards-measurement.md:302-319` (4.4 metrics) | Velocity and autonomy metrics are collected without guarding against perceived-vs-measured speed: METR found experienced developers 19% slower with AI while believing they were 20% faster (IS-6, Independent). "Human intervention rate" as an autonomy metric (`:310`, `:331`) rewards less supervision; the doc's gaming warning (`:361`) catches trivial tasks but not rubber-stamping. Add approve rate on permission prompts and review depth by risk tier. |
| P3 | Whole repo; `docs/L0-foundation.md:206-216` | Pattern 0.5 celebrates agents generating exhaustive tests and mocks. Nothing addresses who checks the tests: Böckeler found the agent workflow would "declare success even when tests were failing" (IS-15); tests stand in for reading only where the tests are good (IS-14, contested). The repo's L1 test-integrity rules (1.6) are good here but are not framed as a human supervision skill. |
| P4 | Whole repo | No mention of skill atrophy or cognitive debt. AI-assisted learners scored 50% vs 67% on comprehension, gap largest on debugging (IS-1, AN-20; Strong in trial setting, Thin for experienced engineers); "codebase cognitive debt ... reduces developers' ability to guide AI effectively" (IS-12). The repo's audience includes solo developers and team leads (`README.md` Audience) who will run 5-10 parallel agents (`README.md:24`); nothing protects their ability to supervise those agents. |
| P5 | `docs/L4-standards-measurement.md:240-265` (4.3) | The New Starter Standard tests whether docs onboard a newcomer; it does not test whether the human team still understands the system the agents changed. A "new starter" test for the team (can an engineer explain and debug this module without the agent?) is the missing twin. |

---

## 2. The L2 thesis against finding 3: alignment and overreach

### Where it aligns

- L2's opening (`docs/L2-behavioral-guardrails.md:3`) and 2.3 problem statement (`:150`, "Agents forget rules.
  Instructions written in prose are unreliable enforcement mechanisms") match finding 3's first clause:
  "Instruction files are context, not enforcement" (SC-8); "conventions that must hold belong in hooks and
  CI" (OM-7, OM-18). Hooks run at fixed lifecycle points, "which gives you deterministic control" (SG-11);
  Anthropic's best practices: "If something has to happen every time, make it a hook, a deny rule, or a
  managed setting" (AN-3, Strong).
- Pattern 4.5 CI Guardrails (`docs/L4-standards-measurement.md:373-421`) is correctly motivated: "Enforcement
  in hooks is session-scoped ... CI provides non-negotiable enforcement". That is exactly the right
  instinct and should be promoted from L4 footnote to the core of L2.
- 2.7 "Phase enforcement must be blocking" (`:460`) and the anti-pattern entry on advisory hooks
  (`docs/cross-cutting/anti-patterns.md:388-422`) state the right rule.
- 4.6 Context Eval is the only place in the repo that tests a control against adversarial-ish cases
  (`sed -i` blocked "regardless of environment", `:442`). It is the seed of "test your controls".

### Where it overreaches

1. **A hook is inside the agent's operating environment, so it is not a security boundary.** A hook
   constrains the agent's *tool calls through the harness*. It does not constrain what a permitted tool
   can do once running (any allowed `bash`, `python`, `node`, `docker`, `make` is a general-purpose
   computer), and project-level hook configuration is often a file the agent can edit. Baseline puts hard
   limits "in the sandbox and credential design ..., in a policy engine, and in downstream authorisation"
   (IB 4.4, SG-16, SG-7). Hooks belong in the *policy-engine* row only when they pattern-match on
   structured tool arguments (a file path in an Edit call), not on free-text shell strings.
2. **Containment beats hooks for anything that matters.** "Rather than supervising what the agent does, we
   supervise what it's able to do" (AN-9; Strong on mechanism, first-party on outcomes).
   Sandboxing reduced prompts by 84% in Anthropic's own use (SG-10, Partial). A filesystem/network sandbox
   plus credentials absent from the environment makes the `sed -i` and `docker system prune` hooks
   unnecessary as safety controls; they remain useful as ergonomic nudges.
3. **"Block" vs "advise" vs "confirm" conflates three jobs.** The repo uses one mechanism for (a)
   steering token use (L3 routing), (b) enforcing code-quality conventions (mocks in stack tests), and (c)
   preventing harm (destructive commands). Each needs a different strength: (a) advise is fine; (b) hook
   plus required CI check; (c) containment and downstream authorisation, with a hook only as
   defence-in-depth.
4. **Approval fatigue.** "Require confirmation" (`:168`) and "advise (warn but allow)" (`:182`) assume a
   human or agent will weigh each prompt. Evidence: 93% approval (SG-9); the auto-mode classifier lets
   through 17% of real overeager actions (SG-9, "the honest number"). The repo should move from
   case-by-case approval to tiers (finding 4).
5. **Overstated rule absolutism.** "Constitutional rules must have no escape hatches" (`:282`) is
   asserted for rules enforced by regex. A rule is only as absolute as its weakest enforcement point; the
   doc should state the enforcement point per rule (prompt / hook / CI / sandbox / downstream).
6. **Token routing marketed as guardrail.** L3's "guardrail middleware" (`CLAUDE.md` L3 entry;
   `examples/guardrails/README.md`) is a router with default-allow. Calling it a guardrail teaches
   readers that security can be bolted onto token optimisation.

### Proposed reframing (one paragraph to replace the L2 overview claim)

"Prose is guidance; hooks are deterministic policy *within the harness*; containment and credentials are
the boundary. Put each rule at the lowest layer that can hold it: what must never happen is prevented by
the sandbox, credential scope, or downstream authorisation; what must always happen runs as a hook and a
required CI check; prompts and skills carry everything else."

---

## 3. Proposed new patterns and level material

The pyramid is capability-ordered (L0 structure, L1 verification, L2 enforcement, L3 efficiency, L4
measurement). Security and ownership do not fit one level. Recommendation: add a short **cross-cutting
"Containment and governance" track** plus targeted patterns at L0, L2 and L4, with a rule that the
adoption guide checks it before any team moves from attended to unattended work. Proposed numbering
below fits existing gaps; final numbers are the maintainer's choice.

| Proposed pattern | Level | Problem | Solution sketch | Evidence | Sources |
|------------------|-------|---------|-----------------|----------|---------|
| **0.10 Contain before you relax** (sandbox-first) | L0 (structure) with L2 cross-ref | Agents run on the developer host with shell, keys, network and Docker socket; hooks are asked to compensate. | The agent runs inside a filesystem- and network-restricted boundary from day one; secrets are injected outside it; Docker access for stack tests goes through a rootless or per-session daemon, not the host socket. Relax approvals only *inside* the boundary. Fail closed if the sandbox is unavailable (AN-11). | Partial (consistent, all first-party; no independent runtime comparison) | PL-14, PL-15, PL-17, SG-10, AN-9, AN-11, AN-12 |
| **2.9 Layered enforcement: put each rule at the lowest layer that holds it** | L2 (rewrite of 2.3/2.4 framing) | Hooks are presented as the top of the enforcement stack. | Table per rule: prompt / skill / hook (PreToolUse deny) / required CI check / sandbox / downstream authorisation. Safety rules must sit at sandbox or below; quality rules at hook + CI. PostToolUse checks are detective, not preventive. | Strong (two vendors and OWASP agree on deterministic enforcement; outside-the-model principle) | SG-7, SG-11, SG-16, SC-8, OM-7, AN-3 |
| **2.10 Least agency and session composition** | L2 | Design rinsing, cross-repo alignment and MCP tools combine untrusted input, private data and external action in one session. | Every session type declares which of {untrusted input, sensitive data/credentials, external side effects} it holds; never all three without a deterministic or human gate. Rinsing runs read-only with no network egress beyond the source. Tools read-only by default. | Strong as design rule; no evaluation of teams using it | SG-1, SG-2, SG-3, SG-16, SG-8 |
| **2.11 Agent identity and delegation** | L2 (enforcement) with L4 audit | Agents act with the developer's static keys; logs cannot separate agent from human. | Each agent (or session) gets its own identity with short-lived, audience-bound credentials; actions record "agent X on behalf of person Y"; prefer visible delegation over impersonation; no token passthrough. | Partial-Strong (Strong on short-lived and audience binding direction; Partial on agent-specific identity) | PL-5, PL-6, PL-7, PL-8, PL-11, SG-7, SG-20 |
| **2.12 Skill, plugin and MCP supply chain review** | L2 (the repo's own recommended ecosystem) | The repo tells readers to install skills, hooks, plugins and MCP servers that run with full privileges. | Treat each as a dependency: allowlist, pin versions or commit hashes, read the instructions before install, review updates as diffs, treat fetched content as untrusted, record owner and provenance. Apply to the repo's own recommendations (rig, superpowers, compound-engineering, RTK, jcodemunch). Fix the jcodemunch URL inconsistency. | Strong that threat is real; Partial on prevalence; Thin on the inspection practice | SG-28, SG-29, SG-8, SG-14, IS-13 |
| **2.13 Risk-tiered review and approval** | L2 (with L1 link: review depth keyed to stack-test coverage) | Uniform confirmation prompts and uniform review produce approval fatigue and "human-in-the-loop theater". | Tier changes and actions by reversibility and blast radius. Low tier: automated checks only. High tier: second human, requester cannot approve. Human approval reserved for a short named list of irreversible/externally visible actions. Measure approve rate. An agent's approval never counts as a human one. | Partial (one vendor's telemetry and one first-party review design; analyst corroboration) | SG-9, SG-26, SG-27, OM-18, AN-29 |
| **4.7 Author of record and agent register** | L4 | No one is named for an agent, a skill, a hook set, or agent-written code; artefacts orphan when people leave. | (a) The requester is author of record for agent-written code and answers for it; a different human approves; tool-provenance trailer. (b) A register lists each agent, unattended workflow, skill and hook pack with owner, sponsor, permitted actions, access expiry, lifecycle state, review date and retirement rule. Extend 0.8 Aggressive Cleanup to retire unused skills/hooks/agents. | Partial (converged open-source rule; vendor-documented sponsor/lifecycle mechanisms; no practice evidence) | PO-10 to PO-17, PO-19, PO-20, PO-31, AN-42 |
| **4.8 Tested stop** | L4 (prerequisite gate for "Autonomous" stage in 4.4) | Unattended agents have no rehearsed way to halt; rollback is measured but not designed. | Every unattended workflow has: a named person who can stop it, a mechanism (credential revocation, queue pause, rate limit/circuit breaker), a named role that approves restoration, and a drill on a cadence. Prefer feature flags over rollback for high-volume agent changes. Add to 4.4 stage gates. | Thin (vendor guidance; nothing found on use or effectiveness) | PO-14, PO-12, PO-28, SG-26, SG-7, AN-13, AN-27 |
| **4.9 Evidence over self-report** | L4 (rewrite of 4.1) | 4.1's evidence is agent-pasted output; 4.4 metrics risk perceived speed. | Completion evidence comes from systems the agent cannot edit (CI logs, required checks, signed provenance). Human productivity claims rest on artefacts (cycle time, rework, revert rate from VCS/CI), never on survey alone. Agent configuration changes (skills, hooks, prompts, model version) are eval-gated releases using 4.6. | Partial-Strong (finding 5 on human misjudgement; vendor guidance on eval gates) | IS-6, IS-3, MC-22, MV-8, PO-25, PO-14, AN-16, AN-29, AN-46, AN-48 |
| **4.10 Deliberate practice: keep supervision skill alive** | L4 (people) with L0 0.9 cross-ref | Heavy delegation erodes the debugging and system-understanding skill that makes delegation safe; cognitive debt accrues across the team. | Protect hands-on time on purpose (debug without the agent on a cadence; explain-before-merge for owned modules; rotate who reads agent diffs end to end). Add a "team new-starter" check to 4.3: can an engineer explain and debug a module the agent changed? Pair generation with comprehension (ask why, request explanations) when the engineer must own the result. | Partial (Strong in the trial setting, Thin for experienced engineers; no longitudinal study) | IS-1, IS-4, IS-12, IS-18 (risk, inference), AN-20, AN-18, AN-20, AN-21 |
| **Cross-cutting: Threat model for an agentic repo** | cross-cutting doc linked from CLAUDE.md | No document says what the agent can reach and what could go wrong. | One page: assets (code, secrets, CI, prod), entry points for untrusted content (rinse sources, issues, MCP output, dependencies, learnings memory), capabilities (shell, Docker, network, push), and which pattern mitigates each. | Reviewer judgement (synthesis of SG chapter) | SG-1, SG-16, SG-18 (headings only) |

Also update existing material:

- `docs/L4-standards-measurement.md:285-290` stage table: add containment, owner and tested stop as entry
  conditions for Orchestrated and Autonomous; adopt the cap rule.
- `docs/L4-standards-measurement.md:627-688` review checklist: add a "Security and ownership" block
  (sandbox on, no new secrets in agent-reachable config, new skills/MCP servers vetted and pinned,
  author of record named, second human approver on high tier).
- `docs/cross-cutting/adoption-guide.md:9-65` assessment: add a "Containment and governance" checklist and a
  Path D ("Containment-first") for teams moving to unattended work.
- `docs/cross-cutting/anti-patterns.md`: add "Hooks as a security boundary", "Approval as a safety
  valve", "Unvetted skill install", "Self-promoting autonomy tiers", "Orphaned agent".
- `docs/cross-cutting/glossary.md`: add Containment, Lethal trifecta / Rule of Two, Least agency, Author
  of record, Agent register, Tested stop, Approval fatigue, Cognitive debt.
- `docs/references/reference-my-claw-case-study.md:47`, `:158`: add a caution box on the autonomous tier
  and success-streak promotion.

---

## 4. Vendor neutrality

### Current state

- Entry point and examples are Claude Code-specific: Pattern 0.4 is "CLAUDE.md as Project Constitution";
  hooks are named by Claude Code events (PreToolUse/PostToolUse); routing targets "Edit tool", "Read
  tool"; skill frameworks are superpowers and rig (authored by the same person as this repo, per README
  lineage) plus gstack and compound-engineering.
- The L2 note (`docs/L2-behavioral-guardrails.md:5`) and 2.1 (`:40`) claim the patterns are
  framework-agnostic, which is right for the *ideas*, but no example demonstrates portability.
- There is no disclosure of the author relationship to rig, the most-cited reference implementation.
  The Anthropic guidance companion discloses its own vendor lean explicitly (it states that it deliberately recommends Claude); the repo should do the same.

### Recommendations

1. **Write each pattern against a neutral contract, then show bindings.** For example, "a pre-execution
   policy hook receives a structured tool call and returns allow/deny/ask; the harness enforces deny".
   Then a short "Bindings" subsection per pattern: Claude Code (settings.json hooks, permission deny
   rules, sandbox, managed settings), plus at least one other harness, plus "no harness: CI only". Replace
   the invented `hook.on(...)` API (`docs/L2-behavioral-guardrails.md:190-226`) with the neutral contract
   plus one real binding.
2. **AGENTS.md as the portable source.** Rename Pattern 0.4 to "Agent instruction file as project
   constitution"; recommend AGENTS.md (open format, PL-21) as the shared source and CLAUDE.md as a thin
   file that imports it, since Claude Code reads only CLAUDE.md when both exist unless configured (AN-8). Recommend Agent Skills spec (PL-22) for skills. Baseline practice "Agent
   instructions live in open, portable formats in the repo" is Partial (PL-21, PL-22, PL-19); its level 5
   ("a vendor change touches configuration, not repositories", IB 4.1) is the goal. The repo's own
   `CLAUDE.md` would be the first adopter.
3. **Label evidence by tier, as the research does.** Most of the repo's numbers ("60-90% token
   reduction", "~85%") and all reference implementations are first-party. Add an evidence label to each
   pattern (Strong/Partial/Thin plus source tier) and a disclosure line on rig/superpowers relationships.
4. **Keep vendor-specific security guidance, but mark its gaps.** Security mechanisms are inherently
   product-specific (sandbox flags, managed settings). Map coverage explicitly: state the neutral
   requirement, give the vendor mechanism, and list where the mechanism does not reach (for example
   managed settings not covering some cloud or third-party sessions, SG-12, AN-40). A team on another
   harness should be able to read the neutral requirement and find its own mechanism.
5. **Distinguish what the repo's lineage teaches from what the field has converged on.** Where the repo's
   L2 thesis matches the field (deterministic enforcement), cite the neutral sources (OWASP SG-16, Google
   SG-7) alongside the Claude doc; where it is a house style (skill chain names `brain+`, `plan+`), say so.

---

## 5. Priority order for the maintainer

1. Fix E1 (non-blocking "block" hook) and E6/E7 framing; relabel L3 middleware as routing, not guardrail.
   Low effort, removes actively misleading examples.
2. Add the layered-enforcement reframe (2.9) and "Contain before you relax" (0.10). These correct the
   L2 thesis's overreach without discarding it.
3. Add supply-chain review (2.12) and fix the jcodemunch URL inconsistency (G3) and the auto-exec
   example.
4. Add prompt-injection/session-composition guidance to Design Rinsing (G1) and Compound Engineering
   memory (G6).
5. Add author of record, register, tested stop and cap-rule gates to L4 (4.7, 4.8, O5).
6. Add evidence-over-self-report and deliberate-practice material (4.9, 4.10).
7. Neutral contracts and AGENTS.md portability across all levels.

Evidence caveat (from the baseline, finding 8): the containment, identity and ownership evidence is
mostly vendor-documented mechanism without independent outcome data; the strongest independent anchors
are OWASP/NIST/IETF standards on principle and METR/the Anthropic trial on people. New patterns should
carry those labels rather than present themselves as proven.
