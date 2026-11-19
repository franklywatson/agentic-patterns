# Threat Model for an Agentic Repository

This page lists what an agent can reach, what could go wrong, and which pattern holds each risk. Use it to
decide where to put a control, and as a checklist when you review a setup.

The list of assets, entry points and capabilities is the author's synthesis of the
[sources](../references/sources.md) cited in the patterns, so the evidence is Thin (see the footer). The
individual patterns carry their own evidence labels.
Add your own assets and entry points; this list is a start.

## How to read it

An attack needs three things: an untrusted entry point that delivers text or code to the agent, a capability
the agent can use, and an asset worth reaching. A control breaks the chain at one of the three. The strongest
controls remove the capability or move the asset out of reach, because a control that relies on the agent
behaving can fail when the agent is steered ([Pattern
2.10](../L2-behavioral-guardrails.md#pattern-210--least-agency-and-session-composition)).

## Assets

| Asset | What is at risk | Main mitigations |
|-------|----------------|------------------|
| Source code | Unreviewed or malicious changes; leaked private code | Author of record and a non-requester approver ([2.13](../L2-behavioral-guardrails.md#pattern-213--risk-tiered-review), [4.7](../L4-standards-measurement.md#pattern-47--author-of-record-and-agent-register)); write confinement ([2.9](../L2-behavioral-guardrails.md#pattern-29--contain-before-you-relax)) |
| Secrets | API keys, tokens, cloud credentials, `.env` files read or sent out | Credentials outside the boundary, short-lived and scoped ([2.9](../L2-behavioral-guardrails.md#pattern-29--contain-before-you-relax), [2.11](../L2-behavioral-guardrails.md#pattern-211--agent-identity-and-delegation)); sessions never hold secrets with untrusted input ([2.10](../L2-behavioral-guardrails.md#pattern-210--least-agency-and-session-composition)) |
| CI | Workflow edits that remove checks, steal secrets or forge evidence | Agent cannot edit workflows or branch protection ([2.9](../L2-behavioral-guardrails.md#pattern-29--contain-before-you-relax), [2.3](../L2-behavioral-guardrails.md#pattern-23--hook-automation)); evidence from CI, not the agent ([4.8](../L4-standards-measurement.md#pattern-48--evidence-over-self-report)); high-tier review for workflow paths ([2.13](../L2-behavioral-guardrails.md#pattern-213--risk-tiered-review)) |
| Production | Deploys, migrations, data access, permission changes | Downstream authorisation and scoped tokens ([2.11](../L2-behavioral-guardrails.md#pattern-211--agent-identity-and-delegation)); second human approver for the high tier ([2.13](../L2-behavioral-guardrails.md#pattern-213--risk-tiered-review)); no production credentials in agent sessions ([2.9](../L2-behavioral-guardrails.md#pattern-29--contain-before-you-relax)) |

## Untrusted entry points

Each of these can carry text that instructs the agent (prompt injection) or code that runs with its privileges.

| Entry point | How it reaches the agent | Main mitigations |
|-------------|--------------------------|------------------|
| Rinse sources | Repositories, transcripts and articles read during [design rinsing](../L1-feedback-loops.md) | Rinse in a read-only session with no credentials and no network beyond the source; review notes before use ([2.10](../L2-behavioral-guardrails.md#pattern-210--least-agency-and-session-composition)) |
| Issues | Titles, bodies and attachments from people outside the team | Triage sessions hold no credentials and cannot act; a person posts replies ([2.10](../L2-behavioral-guardrails.md#pattern-210--least-agency-and-session-composition)) |
| PR comments | Review comments and suggested changes from contributors | Treat as input; a person decides what the agent acts on ([2.10](../L2-behavioral-guardrails.md#pattern-210--least-agency-and-session-composition), [2.13](../L2-behavioral-guardrails.md#pattern-213--risk-tiered-review)) |
| MCP output | Text returned by a tool server | Allowlist servers; treat output as untrusted; no token passthrough ([2.12](../L2-behavioral-guardrails.md#pattern-212--skill-plugin-and-mcp-supply-chain), [2.11](../L2-behavioral-guardrails.md#pattern-211--agent-identity-and-delegation)) |
| Dependencies | Packages, skills, plugins, hook packs, command proxies | Allowlist, pin, read before install, review updates as diffs ([2.12](../L2-behavioral-guardrails.md#pattern-212--skill-plugin-and-mcp-supply-chain)) |
| Learnings memory | Notes an agent wrote earlier, loaded into later sessions | Draft location, human review before promotion, review date and pruning ([2.8](../L2-behavioral-guardrails.md#pattern-28--compound-engineering)) |

## Agent capabilities

| Capability | Risk | Main mitigations |
|------------|------|------------------|
| Shell | Any permitted command is a general-purpose computer; string rules are bypassable | Sandbox or container confines writes, reads and network ([2.9](../L2-behavioral-guardrails.md#pattern-29--contain-before-you-relax)); hooks only as nudges ([2.3](../L2-behavioral-guardrails.md#pattern-23--hook-automation)) |
| Docker | Access to the host Docker socket is root on the host | A separate daemon per session: rootless, inside the session's container, or remote ([2.9](../L2-behavioral-guardrails.md#pattern-29--contain-before-you-relax)) |
| Network | Exfiltration and fetching of untrusted content | Allowlisted egress ([2.9](../L2-behavioral-guardrails.md#pattern-29--contain-before-you-relax)); no session combines network with secrets and untrusted input ([2.10](../L2-behavioral-guardrails.md#pattern-210--least-agency-and-session-composition)) |
| Push | Unreviewed code reaches shared branches or releases | Agent identity cannot merge; protected branches; requester cannot approve ([2.11](../L2-behavioral-guardrails.md#pattern-211--agent-identity-and-delegation), [2.13](../L2-behavioral-guardrails.md#pattern-213--risk-tiered-review)) |

## Controls that people over-trust

| Control | Why it is weaker than it looks | Use it for |
|---------|--------------------------------|-----------|
| Hooks and deny rules on command strings | Run inside the agent's environment; bypassed by another spelling or a script | Nudges and workflow checks |
| Approval prompts | People approve by habit ([Pattern 2.13](../L2-behavioral-guardrails.md#pattern-213--risk-tiered-review)) | A short list of irreversible actions |
| A review agent's approval | Not a human approval | Extra findings |
| The agent's own completion report | A claim by the checked party ([Pattern 4.8](../L4-standards-measurement.md#pattern-48--evidence-over-self-report)) | Pointing the reviewer to the CI result |

## Gaps

This page does not cover data handling, audit retention or incident response. It does not model attackers who
already control the developer's machine or the CI platform.

**Evidence:** Thin — the author's synthesis of the sources behind the patterns, not a tested model (SG-1, SG-2, SG-16)

---

[Back to Overview](../../README.md) | [Anti-Patterns](anti-patterns.md) | [Adoption Guide](adoption-guide.md)
