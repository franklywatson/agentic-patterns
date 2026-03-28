# Frequently Asked Questions — Beyond the Patterns

Questions about aspects of the software development lifecycle that the pattern library doesn't cover. These are not universal rules — they describe choices that worked for one team on one project. Other teams with different constraints would reasonably choose differently.

---

## These patterns focus on development. What about deployment?

The patterns assume Docker for local development and testing. Production deployment is a separate concern that this pattern library deliberately doesn't prescribe — the right approach depends on your infrastructure, team structure, and scale.

In the reference project, deployment was handled in a separate DevOps repository using Terraform. That repo had:

- **Automation to detect config drift** between the project's `docker-compose.yml` and the production infrastructure definition. The agent could identify differences and propose alignment.
- **Tooling to audit environment variables and config** across dev and ops repos for consistency.
- **A commit-driven deployment model** — the DevOps repo deep-dived into GitHub commit changes to key application files, then followed a structured process for mapping those changes into infrastructure updates.

The agentic patterns from L0–L4 applied equally to the DevOps repo — CLAUDE.md, progressive disclosure, evidence-based claims all work in infrastructure code. The discipline transfers; the tooling doesn't have to.

This was a preference for this project's scale and team structure. Teams deploying to Kubernetes, serverless platforms, or managed services would adapt the deployment model to their context. What transfers is the discipline (evidence-based changes, structured context, clear contracts between repos), not the specific tools.

---

## How do you separate operational concerns from application code?

In the reference project, scaling, monitoring, observability, and alerting lived in the DevOps repo — not polluting the application repo with operational concerns. The split looked like this:

| Concern | Application Repo | DevOps Repo |
|---------|-----------------|-------------|
| Docker stack for local testing | Owns | — |
| Health endpoints (service status) | Owns | Consumes |
| Structured logging | Owns (produces) | Consumes |
| Terraform modules | — | Owns |
| Kubernetes configs | — | Owns |
| Monitoring dashboards | — | Owns |
| Alert rules | — | Owns |
| Scaling policies | — | Owns |

The boundary principle: the application provides health and telemetry through well-defined interfaces; the DevOps repo consumes them. The application repo stays focused on what the system *does* (behavior validated by stack tests). The DevOps repo handles *how it runs* at scale.

This separation is a preference, not a rule. Some teams prefer a single repo with infrastructure-as-code alongside application code. Others use platform teams that own the operational layer entirely. The right split depends on team size, deployment frequency, and operational maturity. What matters is that someone owns the boundary explicitly — whether that's a contract between repos or a contract between teams.

---

**Related:** [Migration Guide](migration-guide.md) | [Anti-Patterns](anti-patterns.md) | [Glossary](glossary.md) | [Back to Overview](../../README.md)
