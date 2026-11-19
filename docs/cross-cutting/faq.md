# FAQ

Short answers to questions teams ask when adopting the library, then the deployment and operations concerns it
does not prescribe. The deployment answers describe choices made on one project; teams with different
constraints would choose differently. For definitions see the [Glossary](glossary.md).

---

## Where do we start?

Where your gaps are. The layers are not a maturity scale. Use the checklist in the
[Adoption Guide](adoption-guide.md#assessment-where-are-you-now), or run the example CLI `autonomy census`
([examples/autonomy](../../examples/autonomy/README.md)) against your repository with `--dir <your repo>`; it
needs no register. Pick the path that matches the largest gap.

## How long before a workflow reaches A3 or A4?

The library sets no calendar time. A grant is earned on conditions: A3 needs a stack test for the journey,
required CI checks, an owner, a locked sandbox and a cap of C3 or higher. A4 also needs mechanical verification,
a reversible action, a cap of C4 or higher and a stop drill within 30 days ([Prerequisites by
Grant](../earned-autonomy.md#prerequisites-by-grant)). The cap comes from your team's census, not from the
library; [The Curve and the Cap](../earned-autonomy.md#the-curve-and-the-cap) says how it is computed and what
raises it.

## Can an agent repair production on its own?

For owned code with a reproduction, a frozen oracle, a reversible change and a gate, within a repair budget: the
[repair loop](../L1-feedback-loops.md#closing-the-loop-in-production) defines the steps and
[examples/repair-loop](../../examples/repair-loop/README.md) runs the gate. The grant and cap still apply, and
data-forward or irreversible changes are not repaired unattended at any grant.

## What can the census not see?

Individual skill cannot be read from files. The census emits a worksheet for it and for the human-only checks of
the other dimensions, and reports skill as `unknown` until a result is recorded. A dimension with no evidence
counts as C1 ([Pattern A.4](../earned-autonomy.md#pattern-a4--census)).

---

## I work alone. Where does the sandbox settings file go?

Put the keys where the agent cannot edit them, so the agent cannot switch the boundary off
([Pattern 2.9](../L2-behavioral-guardrails.md#pattern-29--contain-before-you-relax)). A project
`.claude/settings.json` does not qualify: it sits in the working tree and the agent can write it. Two placements
work for one person.

- **Managed settings file.** Managed settings rank above every other source, including `--settings`, so no other
  file overrides them. Save the policy as `managed-settings.json` in the system directory for your OS: macOS
  `/Library/Application Support/ClaudeCode/`, Linux and WSL `/etc/claude-code/`, Windows
  `C:\Program Files\ClaudeCode\`. Create it with administrator rights. Run `/status` and check that the
  `Setting sources` line shows the managed file. A developer with local administrator rights can edit the file,
  and `/etc/claude-code` on WSL is user-writable, so the file protects against the agent, not against you
  ([managed settings](https://code.claude.com/docs/en/managed-settings#deploy-a-managed-settings-file)).
- **User settings.** `~/.claude/settings.json` applies to every project on the machine and is outside the
  repository ([settings](https://code.claude.com/docs/en/settings)). The agent can still write it, so add
  `permissions.deny` rules `Edit(~/.claude/settings.json)` for the file tools and
  `sandbox.filesystem.denyWrite` for the same path for shell subprocesses
  ([permissions](https://code.claude.com/docs/en/permissions)). Check the result in `/status`.

The example keys are in [examples/containment/claude-code/settings.json](../../examples/containment/claude-code/settings.json).
The example does not run Claude Code, so test the boundary yourself: ask the agent to write outside the tree and
check that it fails.

## My stack tests need Docker. How do I run them inside the sandbox?

The sandbox does not wrap `docker`; the documentation names it as incompatible
([sandboxing](https://code.claude.com/docs/en/sandboxing)). Three options, from weakest to strongest boundary:

1. **Exclude a narrow command.** `sandbox.excludedCommands: ["docker compose *"]` runs matching commands outside
   the sandbox with your full access. The page warns that a tool acting on a file in the working directory, as
   `docker compose` does with its compose file, lets the agent write that file and then run it outside the
   sandbox. Use this for attended sessions on a project whose compose file you review before each run.
2. **Run the whole session in a container or virtual machine with its own Docker daemon.** This puts file tools,
   hooks and MCP servers inside the boundary too ([sandbox
   environments](https://code.claude.com/docs/en/sandbox-environments)). Docker Sandboxes is a microVM with its
   own Docker daemon. Do not mount the host Docker socket into the session; that gives the agent root on the host.
3. **Run the stack tests in CI.** The agent pushes to a branch and CI runs the stack tests with no secrets
   beyond a scoped token ([Pattern 2.9, no harness](../L2-behavioral-guardrails.md#pattern-29--contain-before-you-relax)).

The containment example does not include a container or VM setup for the whole session; it shows only that a
read-only, no-network container stops the bypass commands.

## Monorepo or multi-repo for agents?

This is the author's opinion, not an evidenced pattern. A monorepo keeps contracts consistent through shared
types and also loads every service into each session. Several smaller repositories keep each session small and
move contract checks to the agent: it reads the API contract in one repository, the event schema in another and
the types in a third, then reports mismatches.

Choose multi-repo when services have clear owners and independent deploys, and each repository has its own entry-point
file that lists its public interfaces ([Pattern 0.2](../L0-foundation.md#pattern-02--progressive-disclosure)).
Keep the monorepo when services share internal types that change often or when build tooling assumes one. Do not
split a monorepo that works, and do not split without an entry-point file in each new repository: the agent then
finds nothing.

---

## These patterns focus on development. What about deployment?

The patterns assume Docker for local development and testing. Production deployment is a separate concern that this pattern library deliberately doesn't prescribe — the right approach depends on your infrastructure, team structure, and scale.

In the reference project, deployment runs from a separate DevOps repository using Terraform. That repo has:

- **Automation to detect config drift** between the project's `docker-compose.yml` and the production infrastructure definition. The agent can identify differences and propose alignment.
- **Tooling to audit environment variables and config** across dev and ops repos for consistency.
- **A commit-driven deployment model** — the DevOps repo reads GitHub commit changes to key application files, then follows a structured process for mapping those changes into infrastructure updates.

The patterns from L0 to L4 apply equally to the DevOps repo — the agent instruction file, progressive disclosure, evidence-based claims all work in infrastructure code. The discipline transfers; the tooling doesn't have to.

This is a preference for this project's scale and team structure. Teams deploying to Kubernetes, serverless platforms, or managed services would adapt the deployment model to their context. What transfers is the discipline (evidence-based changes, structured context, clear contracts between repos), not the specific tools.

---

## How do you separate operational concerns from application code?

In the reference project, scaling, monitoring, observability and alerting live in the DevOps repo, so the application repo carries no operational concerns. The split:

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
