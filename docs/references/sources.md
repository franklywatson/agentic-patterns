---
reviewed: 2026-11-19
---

# Sources

Every reference ID cited in the pattern docs, with its public source. Most IDs come from the research baseline, the
author's unpublished synthesis. A reader cannot check the baseline itself, so this page carries its structure and
the public source behind each ID. A claim that rests on the baseline alone, with no public source, is Thin.

## How to Resolve a Reference

| Form in the corpus | Meaning | Where to look |
|--------------------|---------|---------------|
| `MC-11`, `PL-5`, `SC-8`, `OM-7`, `SG-28`, `PO-10`, `IS-6`, `MV-1` | A source cited by the research baseline | [Baseline sources](#baseline-sources) |
| `AN-27` | An Anthropic publication | [Anthropic sources](#anthropic-sources-an-n) |
| `A1`-`A5` | Autonomy grants | Not sources |

Some sources carry more than one ID because more than one baseline chapter cites them; the row says "Same source
as". A footer that cites two IDs of one source cites one source.

Run `python3 scripts/sourcecheck.py` to confirm that every ID cited under `docs/` has a row on this page.

## Baseline Structure

The research baseline is the author's unpublished, vendor-neutral account of what a mature AI-native engineering
organization does. It defines one five-step curve, applied separately to seven dimensions. Each factual claim in it
carries one of the source IDs listed below; statements that are its own synthesis say so.

### Sections

| Section | Title |
|---------|-------|
| 1 | Summary |
| 2 | Working definition of mature, used throughout |
| 3.1 | Two kinds of model, rarely told apart: autonomy ladders and capability ladders |
| 3.2 | Where published models agree |
| 3.3 | Where they disagree, and recurring flaws (levels defined by tool or agent count; single ladders; self-report; presence mistaken for practice) |
| 3.4 | Evidence about the curve itself |
| 3.5 | The proposed curve, the grid and the cap rule |
| 3.6 | How to place an organization on the curve, using artifacts and records rather than self-report |
| 3.7 | A defensible top of the curve |
| 3.8 | Gaps for section 3 |
| 4.1-4.7 | One chapter per dimension (see [Chapters](#chapters)) |
| 5 | Eight findings that recur across the chapters |
| 6 | Evidence gaps (6.1) and research agenda (6.2) |

The curve (C1 to C5), the grid of seven dimensions, the cap rule (section 3.5) and the defensible top (section 3.7)
are defined in [Earned Autonomy](../earned-autonomy.md#the-curve-and-the-cap).

### Chapters

| Chapter | Scope | Source prefix |
|---------|-------|---------------|
| 3 | The maturity curve | MC |
| 4.1 Platform | How agents get an identity, where they run, and the internal platform around them | PL |
| 4.2 Shared context | How team knowledge reaches the right place, with its access rules carried through | SC |
| 4.3 Team operating model | How a team runs all engineering work, including live systems, debt, bugs and incidents | OM |
| 4.4 Security and governance | How access rules, approvals and audit carry through to what is built and the data it uses | SG |
| 4.5 Production ownership | What AI changes about who owns things once they are live, including the shared AI tooling | PO |
| 4.6 Individual and team skill | How much engineers hand over, how well they direct and check the result, and how teams share skill | IS |
| 4.7 Measuring value | How an organization knows its AI investment works, beyond adoption figures | MV |

## Baseline Sources

Grouped by the baseline chapter that cites them. Tiers and read status are the baseline's own. Web pages were
accessed on 17 November 2026 unless the entry says otherwise.

### MC: 3 · The Maturity Curve

| ID | Source | Tier and read status | Link |
|----|--------|----------------------|------|
| MC-11 | A Few Pages of Markdown: Committed AI Configuration and Lower Quality Cost after Coding-Agent Adoption (Denisov-Blanch et al.). arXiv, submitted 26 Aug 2026, revised 14 Sep 2026. RAMP (Repository AI Maturity Profile) is the model inside it; the authors call the findings hypothesis-generating. | Preprint. Read: Abstract; body (levels, adoption landscape). | <https://arxiv.org/abs/2608.25241> |
| MC-20 | Measuring AI agent autonomy in practice. Anthropic, 18 Feb 2026. | Vendor research. Read: Section. | <https://www.anthropic.com/research/measuring-agent-autonomy> |
| MC-21 | Coding Is No Longer the Constraint. Spotify Engineering, June 2026 (from the page address). | Practitioner (company account). Read: Full. | <https://engineering.atspotify.com/2026/6/code-with-claude-coding-is-no-longer-the-constraint> |

### PL: 4.1 · Platform

| ID | Source | Tier and read status | Link |
|----|--------|----------------------|------|
| PL-3 | Capabilities: Continuous integration. DORA; living page, no date shown. | Independent research. Read: Section. | <https://dora.dev/capabilities/continuous-integration/> |
| PL-5 | AI Agent Authentication and Authorization, draft-klrc-aiagent-auth-03. IETF individual draft, 6 Jul 2026 (no longer active, replaced by draft-ietf-wimse-aims, PL-6; its text expires 7 Jan 2027). | Standards draft. Read: Section. | <https://www.ietf.org/archive/id/draft-klrc-aiagent-auth-03.txt> |
| PL-6 | AI Identity Management System, draft-ietf-wimse-aims. IETF WIMSE working group; active working-group draft, last updated 2 Nov 2026. | Standards draft. Read: Abstract. | <https://datatracker.ietf.org/doc/draft-ietf-wimse-aims/> |
| PL-7 | OAuth 2.0 Token Exchange, RFC 8693. IETF, Jan 2020. | Standards body. Read: Section (1.1). | <https://www.rfc-editor.org/rfc/rfc8693> |
| PL-8 | MCP Authorization, revision 2026-07-28. Model Context Protocol (accessed 19 Nov 2026). "MCP servers MUST NOT accept or transit any other tokens." | Standards body (open specification). Read: Section (token handling). | <https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization> |
| PL-14 | Securely deploying AI agents. Anthropic; living page, no date shown. | Vendor. Read: Section. | <https://code.claude.com/docs/en/agent-sdk/secure-deployment.md> |
| PL-15 | Beyond permission prompts: making Claude Code more secure and autonomous. Anthropic Engineering, 20 Oct 2025. Same source as SG-10. | Vendor. Read: Full. | <https://www.anthropic.com/engineering/claude-code-sandboxing> |
| PL-16 | Best practices for Claude Code. Anthropic; living page, no date shown. Same source as OM-7 and AN-3. | Vendor. Read: Section. | <https://code.claude.com/docs/en/best-practices.md> |
| PL-17 | Minions: Stripe's one-shot, end-to-end coding agents. Stripe Dev Blog, 9 Feb 2026. | Practitioner (company self-report). Read: Most of page. | <https://stripe.dev/blog/minions-stripes-one-shot-end-to-end-coding-agents> |
| PL-18 | Harness engineering for coding agent users (Böckeler). Thoughtworks / martinfowler.com, 2 Apr 2026. | Practitioner. Read: Section. | <https://martinfowler.com/articles/exploring-gen-ai/harness-engineering.html> |
| PL-21 | AGENTS.md. Stewarded by the Agentic AI Foundation under the Linux Foundation; living page, no date shown. | Standards body (open format). Read: Full. | <https://agents.md/> |

### SC: 4.2 · Shared Context

| ID | Source | Tier and read status | Link |
|----|--------|----------------------|------|
| SC-1 | Effective context engineering for AI agents. Anthropic, 29 Sep 2025. | Vendor. Read: Full. | <https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents> |
| SC-4 | Evaluating AGENTS.md (Gloaguen et al.). arXiv, v1 12 Feb 2026, v3 29 Sep 2026. | Preprint. Read: Abstract. | <https://arxiv.org/abs/2602.11988> |
| SC-5 | On the Impact of AGENTS.md Files on the Efficiency of AI Coding Agents (Lulla et al.). arXiv, 28 Jan 2026. | Preprint. Read: Abstract. | <https://arxiv.org/abs/2601.20404> |
| SC-6 | How Many Instructions Can LLMs Follow at Once? (IFScale). arXiv, 15 Jul 2025. | Preprint. Read: Abstract. | <https://arxiv.org/abs/2507.11538> |
| SC-8 | Claude Code memory. Anthropic; living page, no date shown. | Vendor. Read: Full. | <https://code.claude.com/docs/en/memory.md> |
| SC-11 | AGENTS.md outperforms skills in our agent evals. Vercel, Jan 2026. | Vendor (self-reported; eval size not stated). Read: Full. | <https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals> |

### OM: 4.3 · Team Operating Model

| ID | Source | Tier and read status | Link |
|----|--------|----------------------|------|
| OM-7 | Best practices for Claude Code. Anthropic; living page, no date shown. Same source as PL-16 and AN-3. | Vendor. Read: Section. | <https://code.claude.com/docs/en/best-practices.md> |
| OM-8 | Building effective agents. Anthropic, 19 Dec 2024. | Vendor. Read: Section. | <https://www.anthropic.com/engineering/building-effective-agents> |
| OM-9 | Effective harnesses for long-running agents. Anthropic, 26 Nov 2025. | Vendor. Read: Section. | <https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents> |
| OM-12 | Minions, Part 2. Stripe Dev Blog, 19 Feb 2026. | Practitioner (company self-report). Read: Section. | <https://stripe.dev/blog/minions-stripes-one-shot-end-to-end-coding-agents-part-2> |
| OM-18 | Technology Radar Vol 35, Techniques (blips cited: risk-tiered human oversight, human-in-the-loop theater, agent instruction bloat, feedback flywheel, agent pipeline responsibility, production-aware coding agents, unattended overnight builds, path-to-production mapping, agent sandboxing, coding throughput as a measure, enterprise harness). Thoughtworks, Nov 2026. Same page as IS-13 and MV-1. | Analyst. Read: Blips read in full. | <https://www.thoughtworks.com/radar/techniques> |
| OM-20 | Postmortem Culture: Learning from Failure (SRE Workbook); Managing Incidents (SRE Book). Google; living pages, no date shown (origin texts). | Vendor / practitioner canon. Read: Section. | <https://sre.google/workbook/postmortem-culture/> |

### SG: 4.4 · Security and Governance

| ID | Source | Tier and read status | Link |
|----|--------|----------------------|------|
| SG-1 | The lethal trifecta for AI agents. Simon Willison, 16 Jun 2025. | Practitioner. Read: Full. | <https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/> |
| SG-2 | Agents Rule of Two: a practical approach to AI agent security. Meta, 31 Oct 2025. | Vendor. Read: Most of page. | <https://ai.meta.com/blog/practical-ai-agent-security/> |
| SG-3 | Defeating Prompt Injections by Design (CaMeL). Debenedetti et al. (Google DeepMind, ETH Zurich), arXiv v2 24 Jun 2025. | Preprint. Read: Abstract. | <https://arxiv.org/abs/2503.18813> |
| SG-6 | Levels of Autonomy for AI Agents. Feng, McDonald, Zhang, arXiv v2 28 Jul 2025. | Preprint. Read: Abstract. | <https://arxiv.org/abs/2506.12469> |
| SG-7 | Google's Approach for Secure AI Agents: An Introduction. Google, May 2025. | Vendor. Read: Section (principles and layers). | <https://storage.googleapis.com/gweb-research2023-media/pubtools/1018686.pdf> |
| SG-9 | How we built Claude Code auto mode. Anthropic, 25 Mar 2026. | Vendor (self-reported telemetry). Read: Section. | <https://www.anthropic.com/engineering/claude-code-auto-mode> |
| SG-10 | Beyond permission prompts: making Claude Code more secure and autonomous. Anthropic, 20 Oct 2025. Same source as PL-15. | Vendor (self-reported). Read: Section. | <https://www.anthropic.com/engineering/claude-code-sandboxing> |
| SG-11 | Hooks guide. Anthropic; living page, no date shown. | Vendor. Read: Section. | <https://code.claude.com/docs/en/hooks-guide.md> |
| SG-12 | Server-managed settings. Anthropic; living page, no date shown. | Vendor. Read: Section. | <https://code.claude.com/docs/en/server-managed-settings.md> |
| SG-14 | MCP Security Best Practices. Model Context Protocol; living page, no date shown. | Standards body (open specification). Read: Section. | <https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices.md> |
| SG-16 | LLM06:2025 Excessive Agency. OWASP GenAI Security Project, 2025 edition (page metadata: published 10 Apr 2024, modified 5 May 2025). | Standards body. Read: Section (mitigations). | <https://genai.owasp.org/llmrisk/llm062025-excessive-agency/> |
| SG-20 | Concept paper: Accelerating the adoption of software and AI agent identity and authorization. NIST NCCoE, 5 Feb 2026 (initial public draft). | Standards body (draft for comment). Read: Landing page. | <https://csrc.nist.gov/pubs/other/2026/02/05/accelerating-the-adoption-of-software-and-ai-agent/ipd> |
| SG-26 | One-size-fits-all agent governance sets enterprises up to fail. ITPro, 27 May 2026 (reporting Gartner). | Analyst, via trade press. Read: Full. | <https://www.itpro.com/technology/artificial-intelligence/one-size-fits-all-agent-governance-sets-enterprises-up-to-fail> |
| SG-28 | ToxicSkills. Snyk, 5 Feb 2026. | Vendor (self-reported scan). Read: Section. | <https://snyk.io/blog/toxicskills-malicious-ai-agent-skills-clawhub/> |
| SG-29 | Postmark MCP server code hijacked. The Register, 29 Sep 2025. | Media. Read: Key passages. | <https://www.theregister.com/2025/09/29/postmark_mcp_server_code_hijacked/> |

### PO: 4.5 · Production Ownership

| ID | Source | Tier and read status | Link |
|----|--------|----------------------|------|
| PO-10 | Governing Agent identities and access. Microsoft Learn, 16 Nov 2026 (page metadata). | Vendor. Read: Full. | <https://learn.microsoft.com/en-us/entra/id-governance/agent-id-governance-overview> |
| PO-11 | Agent identity sponsor tasks in Lifecycle Workflows. Microsoft Learn, 25 Oct 2025 (page metadata). | Vendor. Read: Full. | <https://learn.microsoft.com/en-us/entra/id-governance/agent-sponsor-tasks> |
| PO-12 | AGENTOPS03-BP01 Define an agent lifecycle with clear SME ownership, testing, and governance. AWS Well-Architected Agentic AI Lens; living page, no date shown. | Vendor (reference architecture). Read: Full. | <https://docs.aws.amazon.com/wellarchitected/latest/agentic-ai-lens/agentops03-bp01.html> |
| PO-14 | Operational standards for AI agents. Microsoft Cloud Adoption Framework, 9 Nov 2026 (page metadata; accessed 19 Nov 2026). | Vendor. Read: Full. | <https://learn.microsoft.com/en-us/azure/cloud-adoption-framework/ai-agents/operational-standards> |
| PO-16 | AI Tool Use Policy. LLVM project; no date shown. | Practitioner (project policy). Read: Full. | <https://raw.githubusercontent.com/llvm/llvm-project/main/llvm/docs/AIToolPolicy.md> |
| PO-17 | AI Coding Assistants (Documentation/process/coding-assistants.rst). Linux kernel; current master, no date shown. | Practitioner (project policy). Read: Full. | <https://raw.githubusercontent.com/torvalds/linux/master/Documentation/process/coding-assistants.rst> |
| PO-19 | ASF Generative Tooling Guidance. Apache Software Foundation; no date shown (text refers to August 2026). | Practitioner (foundation policy). Read: Full. | <https://www.apache.org/legal/generative-tooling.html> |
| PO-20 | Review output from Copilot; Responsible use of Copilot cloud agent. GitHub Docs; living pages, no date shown. | Vendor. Read: Full (review page); section (responsible-use page, co-author passage). | <https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/review-copilot-prs> |
| PO-25 | Demystifying evals for AI agents. Anthropic, published 9 Jan 2026. Same source as MV-9 and AN-16. | Vendor. Read: Full. | <https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents> |
| PO-28 | AI in SRE: How Google is Engineering the Future of Reliable Operations. Google SRE; no date shown. | Vendor (position paper). Read: Full. | <https://sre.google/resources/practices-and-processes/ai-engineering-reliable-operations/> |

### IS: 4.6 · Individual and Team Skill

| ID | Source | Tier and read status | Link |
|----|--------|----------------------|------|
| IS-1 | How AI assistance impacts the formation of coding skills. Anthropic, 29 Jan 2026 (randomized trial; underlying paper is a preprint, arXiv 2601.20245). | Vendor research. Read: Section (design, results). | <https://www.anthropic.com/research/AI-assistance-coding-skills> |
| IS-4 | How AI is transforming work at Anthropic. Anthropic, 2 Dec 2025. Same source as MV-8. | Vendor research (staff self-report, n=132 plus interviews). Read: Section. | <https://www.anthropic.com/research/how-ai-is-transforming-work-at-anthropic> |
| IS-6 | Measuring the impact of early-2025 AI on experienced open-source developer productivity. METR, 10 Jul 2025 (underlying paper is a preprint). The page marks the early-2025 results as out of date; METR's [24 Feb 2026 update](https://metr.org/blog/2026-02-24-uplift-update/) estimates -18% time (CI -38% to +9%) for returning developers, calls that estimate unreliable because of selection effects, and does not re-test the perception gap. | Independent research. Read: Section (core result). | <https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/> |
| IS-12 | Codebase cognitive debt (Caution). Thoughtworks Technology Radar, 15 Apr 2026. | Analyst. Read: Full. | <https://www.thoughtworks.com/radar/techniques/codebase-cognitive-debt> |
| IS-13 | Technology Radar Vol 35, Techniques (blips cited: feedback flywheel, agent skill cognitive surrender, agent plugin marketplace). Thoughtworks, Nov 2026. Same page as OM-18 and MV-1. | Analyst. Read: Blips read in full. | <https://www.thoughtworks.com/radar/techniques> |
| IS-15 | How far can we push AI autonomy in code generation? (Böckeler). martinfowler.com / Thoughtworks, 5 Aug 2025. | Practitioner. Read: Section. | <https://www.martinfowler.com/articles/pushing-ai-autonomy.html> |

### MV: 4.7 · Measuring Value

| ID | Source | Tier and read status | Link |
|----|--------|----------------------|------|
| MV-1 | Technology Radar Vol 35, Techniques (blips cited: coding throughput as a measure of productivity, path-to-production mapping, context profiling, harness quality evaluation). Thoughtworks, Nov 2026. Same page as OM-18 and IS-13. | Analyst. Read: Blips read in full. | <https://www.thoughtworks.com/radar/techniques> |
| MV-2 | Measuring AI code assistants and agents (DX AI Measurement Framework). DX, 2025; no date shown. | Vendor (marketing research page). Read: Full. | <https://getdx.com/research/measuring-ai-code-assistants-and-agents/> |
| MV-5 | The SPACE of Developer Productivity (Forsgren, Storey, Maddila, Zimmermann, Houck, Butler). ACM Queue 19(1), 2021. | Practitioner journal (origin). Read: Most of paper. | <https://doi.org/10.1145/3454122.3454124> |
| MV-8 | How AI is transforming work at Anthropic. Anthropic, 2 Dec 2025. Same source as IS-4. | Vendor research (staff self-report). Read: Section. | <https://www.anthropic.com/research/how-ai-is-transforming-work-at-anthropic> |
| MV-9 | Demystifying evals for AI agents. Anthropic, published 9 Jan 2026. Same source as PO-25 and AN-16. | Vendor. Read: Full. | <https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents> |
| MV-10 | Evaluation best practices. OpenAI; living page, no date shown. | Vendor. Read: Full. | <https://developers.openai.com/api/docs/guides/evaluation-best-practices.md> |

## Anthropic Sources (AN-n)

These are Anthropic publications, so they are vendor material, not independent evidence. Labels: vendor practice
(Anthropic on its own practice or products), guidance (advice to customers), marketing (a product article), measured
(analysis of usage data), docs (product documentation, living pages with no date shown). These rows carry a tier but
no read status.

| ID | Source | Tier and read status | Link |
|----|--------|----------------------|------|
| AN-2 | How Claude Code works. Anthropic, no date shown. | Docs. | <https://code.claude.com/docs/en/how-claude-code-works.md> |
| AN-3 | Best practices for Claude Code. Anthropic, no date shown. Same source as OM-7 and PL-16. | Docs. | <https://code.claude.com/docs/en/best-practices.md> |
| AN-7 | The new rules of context engineering for Claude 5 generation models. Anthropic (claude.dev), 24 Jul 2026. | Vendor practice. | <https://claude.dev/blog/the-new-rules-of-context-engineering-for-claude-5-generation-models/> |
| AN-9 | How we contain Claude across products. Anthropic Engineering, 25 May 2026. | Vendor practice. | <https://www.anthropic.com/engineering/how-we-contain-claude> |
| AN-11 | Configure the sandboxed Bash tool. Anthropic, no date shown. | Docs. | <https://code.claude.com/docs/en/sandboxing.md> |
| AN-16 | Demystifying evals for AI agents. Anthropic Engineering, 9 Jan 2026. Same source as PO-25 and MV-9. | Guidance. | <https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents> |
| AN-27 | The AI-native SDLC playbook. Anthropic, 21 Aug 2026. | Guidance. | <https://claude.com/resources/articles/the-ai-native-sdlc-playbook> |
| AN-29 | How the Claude Code team does code review. Anthropic (claude.dev), 15 Oct 2026. | Vendor practice. | <https://claude.dev/blog/solving-code-review-at-anthropic/> |
| AN-48 | A guide to cost visibility and control in Claude. Anthropic, 4 Aug 2026. | Marketing. | <https://claude.com/resources/articles/a-guide-to-cost-visibility-and-control-in-claude> |
