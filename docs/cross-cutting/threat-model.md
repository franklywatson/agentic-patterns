---
last-validated-model: claude-opus-5-5
reviewed: 2026-11-19
---

# Threat Model for an Agentic Repository

This page lists what an agent can reach, what could go wrong, and which pattern holds each risk. Use it to
decide where to put a control, and as a checklist when you review a setup. Read it before granting any workflow
A3 or above ([Earned Autonomy](../earned-autonomy.md#the-grants)). Add your own assets and entry points.

## How to Read It

An attack needs three things: an untrusted entry point that delivers text or code to the agent, a capability
the agent can use, and an asset worth reaching. A control breaks the chain at one of the three. The strongest
controls remove the capability or move the asset out of reach, because a control that relies on the agent
behaving can fail when the agent is steered ([Pattern
2.10](../L2-behavioral-guardrails.md#pattern-210--least-agency-and-session-composition)).

## Assets

| Asset | What is at risk | Main mitigations |
|-------|----------------|------------------|
| Source code | Unreviewed or malicious changes; leaked private code | Author of record and a non-requester approver ([2.13](../L2-behavioral-guardrails.md#pattern-213--risk-tiered-review), [4.7](../L4-standards-measurement.md#pattern-47--author-of-record)); write confinement ([2.9](../L2-behavioral-guardrails.md#pattern-29--contain-before-you-relax)) |
| Secrets | API keys, tokens, cloud credentials, `.env` files read or sent out | Credentials outside the boundary, short-lived and scoped ([2.9](../L2-behavioral-guardrails.md#pattern-29--contain-before-you-relax), [2.11](../L2-behavioral-guardrails.md#pattern-211--agent-identity-and-delegation)); sessions never hold secrets with untrusted input ([2.10](../L2-behavioral-guardrails.md#pattern-210--least-agency-and-session-composition)) |
| CI | Workflow edits that remove checks, steal secrets or forge evidence | Agent commits cannot change locked files and change workflow files only with a later human acknowledgement ([A.6](../earned-autonomy.md#pattern-a6--enforcement-through-hooks)); the agent cannot edit branch protection ([2.11](../L2-behavioral-guardrails.md#pattern-211--agent-identity-and-delegation)); evidence from CI, not the agent ([4.1](../L4-standards-measurement.md#pattern-41--evidence-based-claims)); high-tier review for workflow paths ([2.13](../L2-behavioral-guardrails.md#pattern-213--risk-tiered-review)) |
| Production | Deploys, migrations, data access, permission changes | Downstream authorization and scoped tokens ([2.11](../L2-behavioral-guardrails.md#pattern-211--agent-identity-and-delegation)); high-tier review ([2.13](../L2-behavioral-guardrails.md#pattern-213--risk-tiered-review)); no production credentials in agent sessions ([2.9](../L2-behavioral-guardrails.md#pattern-29--contain-before-you-relax)) |

## Untrusted Entry Points

Each can carry text that instructs the agent or code that runs with its privileges. OWASP calls the first
kind indirect prompt injection ([LLM01:2025 Prompt
Injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/)); its mitigations include least privilege,
human approval for high-risk actions and keeping external content apart from instructions, which the rows below
apply.

| Entry point | How it reaches the agent | Main mitigations |
|-------------|--------------------------|------------------|
| Rinse sources | Repositories, transcripts and articles read during [design rinsing](../L1-feedback-loops.md#design-rinsing--cross-domain-architectural-extraction) | Rinse in a read-only session with no credentials and no network beyond the source; review notes before use ([2.10](../L2-behavioral-guardrails.md#pattern-210--least-agency-and-session-composition)) |
| Issues | Titles, bodies and attachments from people outside the team | Triage sessions hold no credentials and cannot act; a person posts replies ([2.10](../L2-behavioral-guardrails.md#pattern-210--least-agency-and-session-composition)) |
| PR comments | Review comments and suggested changes from contributors | Treat as input; a person decides what the agent acts on ([2.10](../L2-behavioral-guardrails.md#pattern-210--least-agency-and-session-composition), [2.13](../L2-behavioral-guardrails.md#pattern-213--risk-tiered-review)) |
| MCP output | Text returned by a tool server | Allowlist servers; treat output as untrusted; no token passthrough ([2.12](../L2-behavioral-guardrails.md#pattern-212--skill-plugin-and-mcp-supply-chain), [2.11](../L2-behavioral-guardrails.md#pattern-211--agent-identity-and-delegation)) |
| Dependencies | Packages, skills, plugins, hook packs, command proxies; one MCP server package turned malicious after 15 clean versions ([2.12](../L2-behavioral-guardrails.md#pattern-212--skill-plugin-and-mcp-supply-chain)) | Allowlist sources, pin versions, read before install, review updates as diffs ([2.12](../L2-behavioral-guardrails.md#pattern-212--skill-plugin-and-mcp-supply-chain)) |
| Production incident records | Request bodies, error text and logs sent by operations into a repair loop | Records carry no personal data and are treated as input, not instructions; the repair session holds no production credentials ([1.7](../L1-patterns/1.7-incident-to-stack-test.md), [2.10](../L2-behavioral-guardrails.md#pattern-210--least-agency-and-session-composition)) |
| Learnings and auto memory | Notes an agent wrote earlier, loaded into later sessions. Claude Code's auto memory is on by default in local sessions and loads part of `MEMORY.md` into every session ([memory docs](https://code.claude.com/docs/en/memory#auto-memory)) | Draft location, human review before promotion, review date and pruning ([2.8](../L2-behavioral-guardrails.md#pattern-28--compound-engineering)); for a session that reads untrusted input, set `autoMemoryEnabled: false` in user or managed settings (not project settings, which the agent can edit) or `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1` in the launcher ([memory docs](https://code.claude.com/docs/en/memory#enable-or-disable-auto-memory)) |
| Other agents and triggers | Messages from subagents or other sessions; payloads of scheduled or event triggers | Treat as input, not instructions; a triggered session holds only the credentials its task needs ([2.10](../L2-behavioral-guardrails.md#pattern-210--least-agency-and-session-composition)) |

## Agent Capabilities

| Capability | Risk | Main mitigations |
|------------|------|------------------|
| Shell | Any permitted command is a general-purpose computer; string rules are bypassable | Sandbox or container confines writes, reads and network ([2.9](../L2-behavioral-guardrails.md#pattern-29--contain-before-you-relax)); command hooks as policy inside the harness, not as the boundary ([2.3](../L2-behavioral-guardrails.md#pattern-23--hook-automation)) |
| Docker | Access to the host Docker socket is root on the host | A separate daemon per session: rootless, inside the session's container, or remote ([2.9](../L2-behavioral-guardrails.md#pattern-29--contain-before-you-relax)) |
| Network | Exfiltration and fetching of untrusted content | Allowlisted egress ([2.9](../L2-behavioral-guardrails.md#pattern-29--contain-before-you-relax)); no session combines network with secrets and untrusted input ([2.10](../L2-behavioral-guardrails.md#pattern-210--least-agency-and-session-composition)) |
| Push | Unreviewed code reaches shared branches or releases | An agent identity cannot approve its own change; an agent merges only R0-R1 at B0 at A4, plus R2 at B0 on named paths at A5 ([risk model](../L1-patterns/1.8-reversibility-blast-radius.md#risk-model)); only the repair gate classifies a change, so a `permitted_actions.paths` list of low-tier paths keeps other unattended merges low-tier ([A.6](../earned-autonomy.md#pattern-a6--enforcement-through-hooks)); protected branches ([2.11](../L2-behavioral-guardrails.md#pattern-211--agent-identity-and-delegation), [2.13](../L2-behavioral-guardrails.md#pattern-213--risk-tiered-review)); a workflow cannot raise its own grant ([A.3](../earned-autonomy.md#pattern-a3--promotion-demotion-and-the-cap-gate)) |

## Controls That People Over-Trust

| Control | Why it is weaker than it looks | Use it for |
|---------|--------------------------------|-----------|
| Hooks and deny rules on command strings | Run inside the agent's environment; bypassed by another spelling or a script. Prompt and agent hooks are model judgments | Deterministic workflow checks (command hooks) |
| Approval prompts | People approve by habit ([Pattern 2.13](../L2-behavioral-guardrails.md#pattern-213--risk-tiered-review)) | A short list of irreversible actions |
| A review agent's approval | Not a human approval | Extra findings |
| The agent's own completion report | A claim by the checked party ([Pattern 4.1](../L4-standards-measurement.md#pattern-41--evidence-based-claims)) | Pointing the reviewer to the CI result |

## OWASP Agentic Top 10

Where each item of the [OWASP Top 10 for Agentic
Applications](https://genai.owasp.org/2025/12/09/owasp-top-10-for-agentic-applications-the-benchmark-for-agentic-security-in-the-age-of-autonomous-ai/)
(December 2025) is handled in this library.

| OWASP item | Where it is handled |
|------------|---------------------|
| ASI01 Agent Goal Hijack | Untrusted entry points above; [2.10](../L2-behavioral-guardrails.md#pattern-210--least-agency-and-session-composition) |
| ASI02 Tool Misuse | [2.9](../L2-behavioral-guardrails.md#pattern-29--contain-before-you-relax), [2.10](../L2-behavioral-guardrails.md#pattern-210--least-agency-and-session-composition) |
| ASI03 Identity & Privilege Abuse | [2.11](../L2-behavioral-guardrails.md#pattern-211--agent-identity-and-delegation) |
| ASI04 Agentic Supply Chain Vulnerabilities | [2.12](../L2-behavioral-guardrails.md#pattern-212--skill-plugin-and-mcp-supply-chain) |
| ASI05 Unexpected Code Execution | [2.9](../L2-behavioral-guardrails.md#pattern-29--contain-before-you-relax) |
| ASI06 Memory & Context Poisoning | [2.8](../L2-behavioral-guardrails.md#pattern-28--compound-engineering); the learnings and auto memory row above |
| ASI07 Insecure Inter-Agent Communication | Partly: the other agents row above; no pattern covers inter-agent protocols |
| ASI08 Cascading Failures | [1.11](../L1-patterns/1.11-repair-budget-circuit-breaker-stop.md) |
| ASI09 Human-Agent Trust Exploitation | [2.13](../L2-behavioral-guardrails.md#pattern-213--risk-tiered-review), [4.1](../L4-standards-measurement.md#pattern-41--evidence-based-claims) |
| ASI10 Rogue Agents | [A.3](../earned-autonomy.md#pattern-a3--promotion-demotion-and-the-cap-gate), [A.5](../earned-autonomy.md#pattern-a5--tested-stop) |

## Gaps

This page does not cover data handling, audit retention, incident response or inter-agent protocols. It does not
model attackers who already control the developer's machine or the CI platform.

**Evidence:** Partial — the author's synthesis of OWASP, vendor and practitioner sources, not a tested model; each
pattern carries its own label (SG-1, SG-2, SG-16)

---

[Back to Overview](../../README.md) | [Earned Autonomy](../earned-autonomy.md) | [Anti-Patterns](anti-patterns.md) |
[Adoption Guide](adoption-guide.md)
