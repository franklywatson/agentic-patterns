# Sources

Every reference ID cited in the pattern docs, with its public source. The research baseline that most IDs come from
is not committed, so this page carries what a reader needs to check a citation: the baseline's structure, and the
bibliography entries for each cited source.

Run `python3 scripts/sourcecheck.py` to confirm that every ID cited under `docs/` has a row on this page.

## How to resolve a reference

| Form in the corpus | Meaning | Where to look |
|--------------------|---------|---------------|
| `MC-11`, `PL-5`, `SC-8`, `OM-7`, `SG-28`, `PO-10`, `IS-6`, `MV-1` | A source cited by the research baseline | [Baseline sources](#baseline-sources) |
| `AN-27` | An Anthropic publication cited by the Anthropic guidance companion | [Anthropic sources](#anthropic-sources-an-n) |
| `baseline 3.7`, `BL §4.5`, `IB 4.4`, `finding 2` | A section or finding of the baseline document | [Baseline structure](#baseline-structure) |
| `BL level 4`, `baseline 4.2 level 5` | A cell of the baseline's maturity grid | [The grid](#the-grid) |
| `AC` | The Anthropic guidance companion as a whole | Its citations are the `AN-n` sources |
| `A1`-`A5` | Autonomy grants | Not sources |

Anthropic sources use the prefix `AN-n`, which is distinct from the autonomy grants `A1`-`A5`.

## Baseline structure

The research baseline is a vendor-neutral account of what a mature AI-native engineering organisation
does. It defines one five-level curve, applied separately to seven dimensions. Each factual claim in it
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
| 3.6 | How to place an organisation on the curve, using artefacts and records rather than self-report |
| 3.7 | A defensible top of the curve |
| 3.8 | Gaps for section 3 |
| 4.1-4.7 | One chapter per dimension (see [Chapters](#chapters)) |
| 5 | Eight findings that recur across the chapters |
| 6 | Evidence gaps (6.1) and research agenda (6.2) |

### The curve

| Level | Name | Defined by |
|-------|------|------------|
| C1 | Individual | People use AI as they choose. Nothing is shared or committed. |
| C2 | Grounded | Approved tools, committed shared context, and every agent change read by a human. |
| C3 | Verified delegation | Autonomy chosen per task. Agent changes pass automated checks before a human sees them. Skills and instructions are versioned and reviewed. Every agent change has a named owner. |
| C4 | Governed autonomy | Agents run unattended on events, schedules or a backlog, each workflow with an owner, permitted actions, limits, an audit record and a tested stop. Controls are enforced by the system. |
| C5 | Self-correcting | Workflows are managed as a portfolio with cost, value, risk and a review date, and some are retired. Autonomy is extended or withdrawn per workflow on evidence. Shared context is pruned as well as grown. |

The curve is C1-C5, which keeps it distinct from this repository's L0-L4.

**The cap rule (baseline 3.5, the baseline's own inference).** The lowest of platform, security and
governance, production ownership and measuring value limits how much autonomy can safely be granted. A team
at level 4 on its operating model and level 2 on ownership is treated as level 2 for unattended work.

**The defensible top (baseline 3.7).** "The ability to raise autonomy for a named workflow when evidence
supports it, show that evidence, and lower it again", with some workflows running unattended because
verification is mechanical and the action reversible (MC-21). It is not "most agents" or "no humans".

### The grid

| Dimension | C1 | C2 | C3 | C4 | C5 |
|-----------|----|----|----|----|----|
| Platform (4.1) | Personal keys; agents cannot be listed | Agents and keys listed and mapped to teams | Agent identity from a template; one gateway; a check command CI runs | Isolation by default; delegated actions audited; loop alerts | Contribution path for tools and skills; vendor change touches configuration only |
| Shared context (4.2) | Knowledge in heads and chats | Instruction files committed, often long and untested | Short, owned, tested files; hard rules in hooks | Governed connectors; permissions enforced at query time | Layered, owned, expiring; re-baselined when models change |
| Team operating model (4.3) | Private use; no stated stance | Written stance; one human review per PR | Conventions as checks; automated plus human review | Review depth by risk; sandboxed loops; agent first-pass on incidents | Unattended work routine; process retired when its gap closes |
| Security and governance (4.4) | Unvetted tools; broad access | Policy written; nearly every prompt approved | Sandboxed, scoped, vetted; agent PRs pass the same gates | Autonomy tiers; risky combinations gated; deterministic policy | Controls tested against adaptive attacks; tiers change with evidence |
| Production ownership (4.5) | Nobody can list or stop agents | Inventory with individual owners | Sponsor per agent; expiring access; human author of record | Changes eval-gated and versioned; stop and restore authority assigned | Automatic handover and retirement; shared tooling owned as a product |
| Individual and team skill (4.6) | Habit; nobody can say how output is checked | Engineers state what they hand over | Output checked against specs and tests; debugging practised; reviewed skills shared | Work broken down for unattended agents; supervision by outcome and exception; failure drills | Pruning, protected practice, autonomy raised only with feedback loops |
| Measuring value (4.7) | Counting use | Measuring speed | Flow and stability against a baseline | Task banks, leading indicators, maintained configuration | Baseline, target, review date and stop rule per investment |

### Findings

| Finding | Statement |
|---------|-----------|
| 1 | AI amplifies the engineering system an organisation already has |
| 2 | The bottleneck has moved from writing code to verifying it |
| 3 | Hard limits live outside the model |
| 4 | Containment and tiering beat case-by-case approval |
| 5 | People misjudge their own speed and checking, so evidence beats self-report |
| 6 | Usage is not maturity, and presence is not practice |
| 7 | Ownership has not caught up with what AI makes possible |
| 8 | The evidence base is thin and vendor-heavy |

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
| 4.7 Measuring value | How an organisation knows its AI investment works, beyond adoption figures | MV |

## Baseline sources

Grouped by the baseline chapter that cites them. Tiers and read status are the baseline's own. Web pages were accessed on 17 November 2026 unless the entry says otherwise.

### MC: 3 · The maturity curve

| ID | Source | Tier and read status | Link |
|----|--------|----------------------|------|
| MC-3 | Agentic autonomy levels (Osmani). addyosmani.com, 2 Jul 2026. | Practitioner. Read: Full. | <https://addyosmani.com/blog/agentic-autonomy-levels/> |
| MC-5 | Five levels of AI agent autonomy. Swarmia, 19 Mar 2026. | Vendor. Read: Section. | <https://www.swarmia.com/blog/five-levels-ai-agent-autonomy/> |
| MC-7 | The 8 levels of agentic engineering (Eledath). bassimeledath.com, 11 Mar 2026. | Practitioner. Read: Levels 1–7. | <https://www.bassimeledath.com/blog/levels-of-agentic-engineering> |
| MC-11 | RAMP: Repository AI Maturity Profile (Denisov-Blanch et al.). arXiv, submitted 26 Aug 2026, revised 14 Sep 2026. | Preprint. Read: Abstract; body (levels, adoption landscape). | <https://arxiv.org/abs/2608.25241> |
| MC-13 | Platform Engineering Maturity Model. CNCF TAG App Delivery; living page, no date shown. | Independent (foundation). Read: Section. | <https://tag-app-delivery.cncf.io/whitepapers/platform-eng-maturity-model/> |
| MC-20 | Measuring AI agent autonomy in practice. Anthropic, 18 Feb 2026. | Vendor research. Read: Section. | <https://www.anthropic.com/research/measuring-agent-autonomy> |
| MC-21 | Coding Is No Longer the Constraint. Spotify Engineering, June 2026 (from the page address). | Practitioner (company account). Read: Full. | <https://engineering.atspotify.com/2026/6/code-with-claude-coding-is-no-longer-the-constraint> |
| MC-22 | AI engineering maturity: what 1,300 engineers told us about how they really work with AI. Boye & Company, 29 Jun 2026. | Practitioner (self-assessment, one organisation). Read: Full. | <https://www.boye-co.com/blog/2026/6/ai-engineering-maturity-what-1300-engineers-told-us-about-how-they-really-work-with-ai> |

### PL: 4.1 · Platform

| ID | Source | Tier and read status | Link |
|----|--------|----------------------|------|
| PL-3 | Capabilities: Continuous integration. DORA; living page, no date shown. | Independent research. Read: Section. | <https://dora.dev/capabilities/continuous-integration/> |
| PL-5 | AI Agent Authentication and Authorization, draft-klrc-aiagent-auth-03. IETF individual draft, 6 Jul 2026 (expired, replaced by a working-group draft). | Standards draft. Read: Section. | <https://www.ietf.org/archive/id/draft-klrc-aiagent-auth-03.txt> |
| PL-6 | AI Identity Management System, draft-ietf-wimse-aims. IETF WIMSE working group; active working-group draft, last updated 2 Nov 2026. | Standards draft. Read: Abstract. | <https://datatracker.ietf.org/doc/draft-ietf-wimse-aims/> |
| PL-7 | OAuth 2.0 Token Exchange, RFC 8693. IETF, Jan 2020. | Standards body. Read: Section (1.1). | <https://www.rfc-editor.org/rfc/rfc8693> |
| PL-8 | MCP Authorization, revision 2025-11-25. Model Context Protocol, 25 Nov 2025. | Standards body (open specification). Read: Section (security). | <https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization> |
| PL-9 | SPIFFE Overview. SPIFFE / CNCF; living page, no date shown. | Standards body. Read: Full. | <https://spiffe.io/docs/latest/spiffe-about/overview/> |
| PL-10 | OpenID Connect. GitHub Docs; living page, no date shown. | Vendor. Read: Full. | <https://docs.github.com/en/actions/concepts/security/openid-connect> |
| PL-11 | What are agent identities?. Microsoft Learn, 5 Nov 2026. | Vendor. Read: Most of page. | <https://learn.microsoft.com/en-us/entra/agent-id/identity-platform/what-is-agent-id> |
| PL-13 | Other LLM gateways. Anthropic; living page, no date shown. | Vendor. Read: Full. | <https://code.claude.com/docs/en/llm-gateway.md> |
| PL-14 | Securely deploying AI agents. Anthropic; living page, no date shown. | Vendor. Read: Section. | <https://code.claude.com/docs/en/agent-sdk/secure-deployment.md> |
| PL-15 | Claude Code sandboxing. Anthropic Engineering, 20 Oct 2025. | Vendor. Read: Full. | <https://www.anthropic.com/engineering/claude-code-sandboxing> |
| PL-16 | Best practices. Anthropic; living page, no date shown. | Vendor. Read: Section. | <https://code.claude.com/docs/en/best-practices.md> |
| PL-17 | Minions: Stripe's one-shot, end-to-end coding agents. Stripe Dev Blog, 9 Feb 2026. | Practitioner (company self-report). Read: Most of page. | <https://stripe.dev/blog/minions-stripes-one-shot-end-to-end-coding-agents> |
| PL-18 | Harness engineering for coding agent users (Böckeler). Thoughtworks / martinfowler.com, 2 Apr 2026. | Practitioner. Read: Section. | <https://martinfowler.com/articles/exploring-gen-ai/harness-engineering.html> |
| PL-19 | Linux Foundation announces the formation of the Agentic AI Foundation. Linux Foundation, 9 Dec 2025. | Vendor / foundation. Read: First half. | <https://www.linuxfoundation.org/press/linux-foundation-announces-the-formation-of-the-agentic-ai-foundation> |
| PL-21 | AGENTS.md. AGENTS.md; living page, no date shown. | Standards body (open format). Read: Full. | <https://agents.md/> |
| PL-22 | Agent Skills specification. agentskills.io; page metadata modified 4 Aug 2026. | Standards body (open format). Read: Opening sections. | <https://agentskills.io/specification> |

### SC: 4.2 · Shared context

| ID | Source | Tier and read status | Link |
|----|--------|----------------------|------|
| SC-1 | Effective context engineering for AI agents. Anthropic, 29 Sep 2025. | Vendor. Read: Full. | <https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents> |
| SC-4 | Evaluating AGENTS.md (Gloaguen et al.). arXiv, v1 12 Feb 2026, v3 29 Sep 2026. | Preprint. Read: Abstract. | <https://arxiv.org/abs/2602.11988> |
| SC-5 | On the Impact of AGENTS.md Files on the Efficiency of AI Coding Agents (Lulla et al.). arXiv, 28 Jan 2026. | Preprint. Read: Abstract. | <https://arxiv.org/abs/2601.20404> |
| SC-6 | How Many Instructions Can LLMs Follow at Once? (IFScale). arXiv, 15 Jul 2025. | Preprint. Read: Abstract. | <https://arxiv.org/abs/2507.11538> |
| SC-7 | Context Rot. Chroma, 14 Jul 2025. | Independent research (vendor-published). Read: Full. | <https://research.trychroma.com/context-rot> |
| SC-8 | Claude Code memory. Anthropic; living page, no date shown. | Vendor. Read: Full. | <https://code.claude.com/docs/en/memory.md> |
| SC-11 | AGENTS.md outperforms skills in our agent evals. Vercel, Jan 2026. | Vendor (self-reported). Read: Full. | <https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals> |

### OM: 4.3 · Team operating model

| ID | Source | Tier and read status | Link |
|----|--------|----------------------|------|
| OM-7 | Best practices for Claude Code. Anthropic; living page, no date shown. | Vendor. Read: Section. | <https://code.claude.com/docs/en/best-practices.md> |
| OM-8 | Building effective agents. Anthropic, 19 Dec 2024. | Vendor. Read: Section. | <https://www.anthropic.com/engineering/building-effective-agents> |
| OM-9 | Effective harnesses for long-running agents. Anthropic, 26 Nov 2025. | Vendor. Read: Section. | <https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents> |
| OM-12 | Minions, Part 2. Stripe Dev Blog, 19 Feb 2026. | Practitioner (company self-report). Read: Section. | <https://stripe.dev/blog/minions-stripes-one-shot-end-to-end-coding-agents-part-2> |
| OM-14 | How Databricks Uses AI to Accelerate Incident Investigation. Databricks, published 24 Aug 2026, modified 20 Oct 2026. | Vendor (first-party account). Read: Section. | <https://www.databricks.com/blog/how-databricks-uses-ai-accelerate-incident-investigation> |
| OM-18 | Technology Radar Vol 35, Techniques (blips cited: risk-tiered human oversight, human-in-the-loop theater, agent instruction bloat, feedback flywheel, agent pipeline responsibility, production-aware coding agents, unattended overnight builds, path-to-production mapping, agent sandboxing, coding throughput as a measure, enterprise harness). Thoughtworks, Nov 2026. | Analyst. Read: Blips read in full. | <https://www.thoughtworks.com/radar/techniques> |
| OM-20 | Postmortem Culture: Learning from Failure (SRE Workbook); Managing Incidents (SRE Book). Google; living pages, no date shown (origin texts). | Vendor / practitioner canon. Read: Section. | <https://sre.google/workbook/postmortem-culture/> |

### SG: 4.4 · Security and governance

| ID | Source | Tier and read status | Link |
|----|--------|----------------------|------|
| SG-1 | The lethal trifecta for AI agents. Simon Willison, 16 Jun 2025. | Practitioner. Read: Full. | <https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/> |
| SG-2 | Agents Rule of Two: a practical approach to AI agent security. Meta, 31 Oct 2025. | Vendor. Read: Most of page. | <https://ai.meta.com/blog/practical-ai-agent-security/> |
| SG-3 | Defeating Prompt Injections by Design (CaMeL). Debenedetti et al. (Google DeepMind, ETH Zurich), arXiv v2 24 Jun 2025. | Preprint. Read: Abstract. | <https://arxiv.org/abs/2503.18813> |
| SG-5 | The Attacker Moves Second. Nasr, Carlini, Tramèr et al., arXiv 10 Oct 2025. | Preprint. Read: Abstract. | <https://arxiv.org/abs/2510.09023> |
| SG-6 | Levels of Autonomy for AI Agents. Feng, McDonald, Zhang, arXiv v2 28 Jul 2025. | Preprint. Read: Abstract. | <https://arxiv.org/abs/2506.12469> |
| SG-7 | Google's Approach for Secure AI Agents: An Introduction. Google, May 2025. | Vendor. Read: Section (principles and layers). | <https://storage.googleapis.com/gweb-research2023-media/pubtools/1018686.pdf> |
| SG-8 | How we contain Claude across products. Anthropic, 25 May 2026. | Vendor. Read: Section. | <https://www.anthropic.com/engineering/how-we-contain-claude> |
| SG-9 | How we built Claude Code auto mode. Anthropic, 25 Mar 2026. | Vendor (self-reported telemetry). Read: Section. | <https://www.anthropic.com/engineering/claude-code-auto-mode> |
| SG-10 | Making Claude Code safer with sandboxing. Anthropic, 20 Oct 2025. | Vendor (self-reported). Read: Section. | <https://www.anthropic.com/engineering/claude-code-sandboxing> |
| SG-11 | Hooks guide. Anthropic; living page, no date shown. | Vendor. Read: Section. | <https://code.claude.com/docs/en/hooks-guide.md> |
| SG-12 | Server-managed settings. Anthropic; living page, no date shown. | Vendor. Read: Section. | <https://code.claude.com/docs/en/server-managed-settings.md> |
| SG-14 | MCP Security Best Practices. Model Context Protocol; living page, no date shown. | Standards body (open specification). Read: Section. | <https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices.md> |
| SG-16 | LLM06:2025 Excessive Agency. OWASP GenAI Security Project, 2025 edition (page metadata: published 10 Apr 2024, modified 5 May 2025). | Standards body. Read: Section (mitigations). | <https://genai.owasp.org/llmrisk/llm062025-excessive-agency/> |
| SG-18 | OWASP Top 10 for Agentic Applications 2026. OWASP, 9 Dec 2025. | Standards body. Read: Headings (category names only). | <https://genai.owasp.org/2025/12/09/owasp-top-10-for-agentic-applications-the-benchmark-for-agentic-security-in-the-age-of-autonomous-ai/> |
| SG-19 | Technical blog: Strengthening AI agent hijacking evaluations. NIST, 17 Jan 2025 (updated 19 Dec 2025). | Standards body. Read: Most of page. | <https://www.nist.gov/news-events/news/2025/01/technical-blog-strengthening-ai-agent-hijacking-evaluations> |
| SG-20 | Concept paper: Accelerating the adoption of software and AI agent identity and authorization. NIST NCCoE, 5 Feb 2026 (initial public draft). | Standards body (draft for comment). Read: Landing page. | <https://csrc.nist.gov/pubs/other/2026/02/05/accelerating-the-adoption-of-software-and-ai-agent/ipd> |
| SG-26 | One-size-fits-all agent governance sets enterprises up to fail. ITPro, 27 May 2026 (reporting Gartner). | Analyst, via trade press. Read: Full. | <https://www.itpro.com/technology/artificial-intelligence/one-size-fits-all-agent-governance-sets-enterprises-up-to-fail> |
| SG-27 | Risks and mitigations for GitHub Copilot cloud agent. GitHub Docs; living page, no date shown. | Vendor. Read: Section. | <https://docs.github.com/en/copilot/concepts/agents/coding-agent/risks-and-mitigations> |
| SG-28 | ToxicSkills. Snyk, 5 Feb 2026. | Vendor (self-reported scan). Read: Section. | <https://snyk.io/blog/toxicskills-malicious-ai-agent-skills-clawhub/> |
| SG-29 | Postmark MCP server code hijacked. The Register, 29 Sep 2025. | Media. Read: Key passages. | <https://www.theregister.com/2025/09/29/postmark_mcp_server_code_hijacked/> |
| SG-30 | State of Secrets Sprawl 2026. GitGuardian, 2026 report; no publication date shown. | Vendor (self-reported, public repositories only). Read: Landing page highlights. | <https://www.gitguardian.com/state-of-secrets-sprawl-report-2026> |

### PO: 4.5 · Production ownership

| ID | Source | Tier and read status | Link |
|----|--------|----------------------|------|
| PO-10 | Governing Agent identities and access. Microsoft Learn, 16 Nov 2026 (page metadata). | Vendor. Read: Full. | <https://learn.microsoft.com/en-us/entra/id-governance/agent-id-governance-overview> |
| PO-11 | Agent identity sponsor tasks in Lifecycle Workflows. Microsoft Learn, 25 Oct 2025 (page metadata). | Vendor. Read: Full. | <https://learn.microsoft.com/en-us/entra/id-governance/agent-sponsor-tasks> |
| PO-12 | AGENTOPS03-BP01 Define an agent lifecycle with clear SME ownership, testing, and governance. AWS Well-Architected Agentic AI Lens; living page, no date shown. | Vendor (reference architecture). Read: Full. | <https://docs.aws.amazon.com/wellarchitected/latest/agentic-ai-lens/agentops03-bp01.html> |
| PO-13 | Governance and security across the organization (AI agents). Microsoft Cloud Adoption Framework, 9 Nov 2026 (page metadata). | Vendor. Read: Full. | <https://learn.microsoft.com/en-us/azure/cloud-adoption-framework/ai-agents/governance-security-across-organization> |
| PO-14 | Integrate, manage and operate AI agents. Microsoft Cloud Adoption Framework, 9 Nov 2026 (page metadata). | Vendor. Read: Full. | <https://learn.microsoft.com/en-us/azure/cloud-adoption-framework/ai-agents/integrate-manage-operate> |
| PO-15 | AI RMF Playbook: Govern. NIST; living page, no date shown. | Standards body. Read: Section (GOVERN 1.6, 1.7, 2.1, 2.3). | <https://airc.nist.gov/airmf-resources/playbook/govern/> |
| PO-16 | AI Tool Use Policy. LLVM project; no date shown. | Practitioner (project policy). Read: Full. | <https://raw.githubusercontent.com/llvm/llvm-project/main/llvm/docs/AIToolPolicy.md> |
| PO-17 | AI Coding Assistants (Documentation/process/coding-assistants.rst). Linux kernel; current master, no date shown. | Practitioner (project policy). Read: Full. | <https://raw.githubusercontent.com/torvalds/linux/master/Documentation/process/coding-assistants.rst> |
| PO-18 | AI Usage Policy. Ghostty; current main, no date shown. | Practitioner (project policy). Read: Full. | <https://raw.githubusercontent.com/ghostty-org/ghostty/main/AI_POLICY.md> |
| PO-19 | ASF Generative Tooling Guidance. Apache Software Foundation; no date shown (text refers to August 2026). | Practitioner (foundation policy). Read: Full. | <https://www.apache.org/legal/generative-tooling.html> |
| PO-20 | Review output from Copilot; Responsible use of Copilot cloud agent. GitHub Docs; living pages, no date shown. | Vendor. Read: Full (review page); section (responsible-use page, co-author passage). | <https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/review-copilot-prs> |
| PO-25 | Demystifying evals for AI agents. Anthropic, published 9 Jan 2026, modified 18 Oct 2026. | Vendor. Read: Full. | <https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents> |
| PO-28 | AI in SRE: How Google is Engineering the Future of Reliable Operations. Google SRE; no date shown. | Vendor (position paper). Read: Full. | <https://sre.google/resources/practices-and-processes/ai-engineering-reliable-operations/> |
| PO-31 | Lessons from building Claude Code: How we use skills. Anthropic, 3 Jun 2026. | Vendor (first-party account). Read: Full. | <https://claude.com/blog/lessons-from-building-claude-code-how-we-use-skills> |

### IS: 4.6 · Individual and team skill

| ID | Source | Tier and read status | Link |
|----|--------|----------------------|------|
| IS-1 | How AI assistance impacts the formation of coding skills. Anthropic, 29 Jan 2026 (randomised trial; underlying paper is a preprint, arXiv 2601.20245). | Vendor research. Read: Section (design, results). | <https://www.anthropic.com/research/AI-assistance-coding-skills> |
| IS-3 | The AI Fluency Index. Anthropic, 23 Feb 2026. | Vendor research (observational). Read: Section (findings, limits). | <https://www.anthropic.com/research/AI-fluency-index> |
| IS-4 | How AI is transforming work at Anthropic. Anthropic, 2 Dec 2025. | Vendor research (staff self-report, n=132 plus interviews). Read: Section. | <https://www.anthropic.com/research/how-ai-is-transforming-work-at-anthropic> |
| IS-6 | Measuring the impact of early-2025 AI on experienced open-source developer productivity. METR, 10 Jul 2025 (underlying paper is a preprint). | Independent research. Read: Section (core result). | <https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/> |
| IS-12 | Codebase cognitive debt (Caution). Thoughtworks Technology Radar, 15 Apr 2026. | Analyst. Read: Full. | <https://www.thoughtworks.com/radar/techniques/codebase-cognitive-debt> |
| IS-13 | Technology Radar Vol 35, Techniques (blips cited: feedback flywheel, agent skill cognitive surrender, agent plugin marketplace). Thoughtworks, Nov 2026. | Analyst. Read: Blips read in full. | <https://www.thoughtworks.com/radar/techniques> |
| IS-14 | Vibe coding and agentic engineering are getting closer than I'd like. Simon Willison, 6 May 2026. | Practitioner. Read: Full. | <https://simonwillison.net/2026/May/6/vibe-coding-and-agentic-engineering> |
| IS-15 | How far can we push AI autonomy in code generation? (Böckeler). martinfowler.com / Thoughtworks, 5 Aug 2025. | Practitioner. Read: Section. | <https://www.martinfowler.com/articles/pushing-ai-autonomy.html> |
| IS-16 | 3 Principles for Designing Agent Skills. Block Engineering, 15 Feb 2026. | Practitioner (company account). Read: Full. | <https://engineering.block.xyz/blog/3-principles-for-designing-agent-skills> |
| IS-18 | Canaries in the Coal Mine? Six Facts about the Recent Employment Effects of Artificial Intelligence (Brynjolfsson, Chandar, Chen). Stanford Digital Economy Lab, working paper (version at the November 2025 address). | Independent research (working paper, not peer-reviewed as far as confirmed). Read: Section (abstract, findings). | <https://digitaleconomy.stanford.edu/app/uploads/2025/11/CanariesintheCoalMine_Nov25.pdf> |

### MV: 4.7 · Measuring value

| ID | Source | Tier and read status | Link |
|----|--------|----------------------|------|
| MV-1 | Technology Radar Vol 35, Techniques (blips cited: coding throughput as a measure of productivity, path-to-production mapping, context profiling, harness quality evaluation). Thoughtworks, Nov 2026. | Analyst. Read: Blips read in full. | <https://www.thoughtworks.com/radar/techniques> |
| MV-2 | Measuring AI code assistants and agents (DX AI Measurement Framework). DX, 2025; no date shown. | Vendor. Read: Full. | <https://getdx.com/research/measuring-ai-code-assistants-and-agents/> |
| MV-3 | State of AI-assisted Software Development 2025. DORA / Google Cloud, Sep 2025. | Independent research (survey-based). Read: Section. | <https://services.google.com/fh/files/misc/2025_state_of_ai_assisted_software_development.pdf> |
| MV-5 | The SPACE of Developer Productivity (Forsgren, Storey, Maddila, Zimmermann, Houck, Butler). ACM Queue 19(1), 2021 (read from a university-hosted copy). | Practitioner journal (origin). Read: Most of paper. | <https://people.uncw.edu/vetterr/classes/csc550-spring2023/The%20SPACE%20of%20Developer%20Productivity.pdf> |
| MV-7 | Measuring the impact of early-2025 AI on experienced open-source developer productivity. METR, 10 Jul 2025. | Independent research. Read: Full. | <https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/> |
| MV-8 | How AI is transforming work at Anthropic. Anthropic, 2 Dec 2025. | Vendor research (staff self-report). Read: Section. | <https://www.anthropic.com/research/how-ai-is-transforming-work-at-anthropic> |
| MV-9 | Demystifying evals for AI agents. Anthropic, published 9 Jan 2026, modified 18 Oct 2026. | Vendor. Read: Full. | <https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents> |
| MV-10 | Evaluation best practices. OpenAI; living page, no date shown. | Vendor. Read: Full. | <https://developers.openai.com/api/docs/guides/evaluation-best-practices.md> |
| MV-11 | The AI Productivity Paradox Report 2025. Faros AI, 23 Jul 2025. | Vendor telemetry (observational). Read: Full. | <https://www.faros.ai/blog/ai-productivity-paradox-report-2025> |
| MV-18 | FinOps for AI Overview. FinOps Foundation, last updated 28 Oct 2026. | Independent (industry foundation guidance). Read: Full. | <https://www.finops.org/wg/finops-for-ai-overview/> |
| MV-20 | Holistic Agent Leaderboard: The Missing Infrastructure for AI Agent Evaluation. Kapoor, Stroebl, Narayanan et al. (Princeton), arXiv 13 Oct 2025. | Preprint (venue not confirmed on pages read). Read: Section. | <https://arxiv.org/abs/2510.11977> |

## Anthropic sources (AN-n)

These are Anthropic publications, so they are vendor material, not independent evidence. Labels: first-party (Anthropic on its own practice or products), guidance (advice to customers), measured (analysis of usage data), docs (product documentation, living pages with no date shown).

| ID | Source | Tier and read status | Link |
|----|--------|----------------------|------|
| AN-2 | How Claude Code works. Anthropic, No date shown. | Docs. | <https://code.claude.com/docs/en/how-claude-code-works.md> |
| AN-3 | Best practices for Claude Code. Anthropic, No date shown. | Docs. | <https://code.claude.com/docs/en/best-practices.md> |
| AN-6 | Skill authoring best practices. Anthropic, No date shown. | Docs. | <https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices.md> |
| AN-7 | The new rules of context engineering for Claude 5 generation models. Anthropic (claude.dev), 24 Jul 2026. | First-party. | <https://claude.dev/blog/the-new-rules-of-context-engineering-for-claude-5-generation-models/> |
| AN-8 | How Claude remembers your project. Anthropic, No date shown. | Docs. | <https://code.claude.com/docs/en/memory.md> |
| AN-9 | How we contain Claude across products. Anthropic Engineering, 25 May 2026. | First-party. | <https://www.anthropic.com/engineering/how-we-contain-claude> |
| AN-11 | Configure the sandboxed Bash tool. Anthropic, No date shown. | Docs. | <https://code.claude.com/docs/en/sandboxing.md> |
| AN-12 | Choose a permission mode. Anthropic, No date shown. | Docs. | <https://code.claude.com/docs/en/permission-modes.md> |
| AN-13 | Our framework for developing safe and trustworthy agents. Anthropic, 4 Aug 2025. | Guidance. | <https://www.anthropic.com/news/our-framework-for-developing-safe-and-trustworthy-agents> |
| AN-16 | Demystifying evals for AI agents. Anthropic Engineering, 9 Jan 2026. | Guidance. | <https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents> |
| AN-18 | AI Fluency: Framework and foundations (course); The AI Fluency Framework (one page). Anthropic, with R. Dakan and J. Feller, No date shown (course); copyright 2025 (framework). | Guidance. | <https://academy.claude.com/courses/ai-fluency-framework-foundations> · <https://www-cdn.anthropic.com/b383cf6baddbfc72fdf8b0ed533a518e2872d531.pdf> |
| AN-20 | How AI assistance impacts the formation of coding skills. Anthropic, 29 Jan 2026. | Measured (randomised trial; paper a preprint). | <https://www.anthropic.com/research/AI-assistance-coding-skills> |
| AN-21 | How AI is transforming work at Anthropic. Anthropic, 2 Dec 2025. | First-party (staff survey and interviews). | <https://www.anthropic.com/research/how-ai-is-transforming-work-at-anthropic> |
| AN-26 | Running an AI-native engineering org. Anthropic, 3 Jun 2026. | First-party. | <https://claude.com/resources/articles/running-an-ai-native-engineering-org> |
| AN-27 | The AI-native SDLC playbook. Anthropic, 21 Aug 2026. | Guidance. | <https://claude.com/resources/articles/the-ai-native-sdlc-playbook> |
| AN-29 | How the Claude Code team does code review. Anthropic (claude.dev), 15 Oct 2026. | First-party. | <https://claude.dev/blog/solving-code-review-at-anthropic/> |
| AN-32 | Building always-on agents. Anthropic, 13 Nov 2026. | Guidance. | <https://claude.com/resources/articles/building-always-on-agents> |
| AN-40 | Server-managed settings. Anthropic, No date shown. | Docs (Team, Enterprise). | <https://code.claude.com/docs/en/server-managed-settings.md> |
| AN-42 | Claude Managed Agents: overview; define your agent; secure deployment. Anthropic, No date shown. | Docs (public beta). | <https://platform.claude.com/docs/en/managed-agents/overview.md> · <https://platform.claude.com/docs/en/managed-agents/agent-setup.md> · <https://platform.claude.com/docs/en/managed-agents/secure-deployment> |
| AN-46 | Track team usage with analytics. Anthropic, No date shown. | Docs (contribution metrics public beta). | <https://code.claude.com/docs/en/analytics.md> |
| AN-48 | A guide to cost visibility and control in Claude. Anthropic, 4 Aug 2026. | Guidance. | <https://claude.com/resources/articles/a-guide-to-cost-visibility-and-control-in-claude> |
| AN-49 | Steps of AI Adoption (table), and the LinkedIn post that links it. Boris Cherny (Anthropic); not hosted by Anthropic, 16 Jul 2026 (in the document). | Practitioner synthesis, no data. | <https://docs.google.com/document/d/1R91ayvj7uvlxgNi--__2-Bf3w8x5r1nF-xIBN7ds8Ns/> · <https://www.linkedin.com/posts/bcherny_i-talk-to-engineers-at-other-companies-every-activity-7483695059843043328-kEPH> |
