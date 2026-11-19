# FAQ

Short answers to questions teams ask when adopting the library, then the deployment and operations concerns it does
not prescribe. The deployment answers describe choices made on one project; teams with different constraints would
choose differently.

---

## Where do we start?

Where your gaps are. The layers are not a maturity scale. Run `autonomy census` if the repository has a register,
use the checklist in the [Adoption Guide](adoption-guide.md#assessment-where-are-you-now) if it does not, and pick the
path that matches the gap.

## How long before a workflow reaches A3 or A4?

The library sets no calendar time. A grant is earned on conditions: A3 needs a stack test for the journey, required
CI checks, an owner, a locked sandbox and a cap of C3 or higher. A4 also needs mechanical verification, a reversible
action, a cap of C4 or higher and a stop drill within 30 days ([Prerequisites by
Grant](../earned-autonomy.md#prerequisites-by-grant)). The cap is usually the slow part, because production ownership
sits at C1 even after adopting every pattern.

## Can an agent repair production on its own?

For owned code with a reproduction, a frozen oracle, a reversible change and a gate, within a repair budget: the
[repair loop](../L1-feedback-loops.md#closing-the-loop-in-production) defines the steps and
[examples/repair-loop](../../examples/repair-loop/README.md) runs the gate. It does not lift the cap, and data-forward
or irreversible changes are not repaired unattended at any grant.

## What can the census not see?

Operating model and individual skill cannot be read from files. The census emits a worksheet for those and counts a
dimension it cannot evidence as `unknown`, which caps at C2 ([Pattern A.4](../earned-autonomy.md#pattern-a4--census)).

---

## These patterns focus on development. What about deployment?

The patterns assume Docker for local development and testing. Production deployment is a separate concern that this pattern library deliberately doesn't prescribe — the right approach depends on your infrastructure, team structure, and scale.

In the reference project, deployment was handled in a separate DevOps repository using Terraform. That repo had:

- **Automation to detect config drift** between the project's `docker-compose.yml` and the production infrastructure definition. The agent could identify differences and propose alignment.
- **Tooling to audit environment variables and config** across dev and ops repos for consistency.
- **A commit-driven deployment model** — the DevOps repo deep-dived into GitHub commit changes to key application files, then followed a structured process for mapping those changes into infrastructure updates.

The agentic patterns from L0–L4 applied equally to the DevOps repo — the agent instruction file, progressive disclosure, evidence-based claims all work in infrastructure code. The discipline transfers; the tooling doesn't have to.

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

## What passes between the application and operations?

Production repair sits on the line between the application repo and the DevOps repo. Either side can own the loop if the contract is written down.

**In: the incident record.** The operations side sends one record per incident, in a fixed schema:

| Field | Content |
|-------|---------|
| `fingerprint` | A stable key for the failure: journey plus error class, not line numbers |
| `journey` | The user journey that failed, in one sentence |
| `request` | The failing request with personal data removed |
| `observed` / `expected` | What happened and what should have happened |
| `dependencies` | Each dependency's state, copied from the production health response |

**Out: a reproduction and an evidence bundle.** The application side returns a reproduction stack test that fails on the production commit ([Pattern 1.7](../L1-patterns/1.7-incident-to-stack-test.md)), and an evidence bundle: before and after test output, the diff, its reversibility and blast-radius classes, and the anti-masking result ([Pattern 1.9](../L1-patterns/1.9-repair-loop-frozen-oracle.md)).

The application owns the health endpoint, including its production mode ([Pattern 1.1](../L1-patterns/1.1-stack-tests.md#production-mode)). Operations owns detection, deployment, the gate and rollback. "Cannot reproduce" is a valid return: it routes to a person.

---

**Related:** [Adoption Guide](adoption-guide.md) | [Anti-Patterns](anti-patterns.md) | [Glossary](glossary.md) | [Back to Overview](../../README.md)
