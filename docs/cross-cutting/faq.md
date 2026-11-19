# FAQ

Short answers to questions teams ask when adopting the library, then the contract with operations. Deployment is out
of scope. For definitions see the [Glossary](glossary.md).

---

## Where do we start?

Where your gaps are. The layers are not a maturity scale. Use the checklist in the
[Adoption Guide](adoption-guide.md#assessment-where-are-you-now), or run the example CLI `autonomy census`
([examples/autonomy](../../examples/autonomy/README.md)) against your repository root with `--dir <your repo>`; it
needs no register. Pick the path that matches the largest gap.

## How long before a workflow reaches A3 or A4?

The library sets no calendar time. A grant is earned on conditions, listed once in [Prerequisites by
Grant](../earned-autonomy.md#prerequisites-by-grant), and capped by the census of your repository. The C1-to-C2 steps
are in [Reaching C2](../earned-autonomy.md#reaching-c2).

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

The example keys are in the [containment binding](../../examples/containment/README.md#claude-code-binding) and
[examples/containment/claude-code/settings.json](../../examples/containment/claude-code/settings.json). Its paths work in
user settings. That file does not protect itself. For user settings, merge these keys as well:

```json
{
  "permissions": { "deny": ["Edit(~/.claude/settings.json)"] },
  "sandbox": { "filesystem": { "denyWrite": ["~/.claude/settings.json"] } }
}
```

With these keys, `git push` and `gh` fail inside the session because `~/.ssh` and `GITHUB_TOKEN` are denied: you
push. Add every package registry, container registry and API host your project uses to `allowedDomains`, or
installs fail. The example does not run Claude Code, so test the boundary yourself: ask the agent to run `touch
~/outside-tree` and `curl -sI https://example.com`; both must fail.

## My stack tests need Docker. How do I run them inside the sandbox?

The sandbox does not wrap `docker`; the documentation names it as incompatible
([sandboxing](https://code.claude.com/docs/en/sandboxing)). Three options, from weakest to strongest boundary:

1. **Exclude a narrow command.** `sandbox.excludedCommands: ["docker compose *"]` runs matching commands outside
   the sandbox with your full access. The page warns that a tool acting on a file in the working directory, as
   `docker compose` does with its compose file, lets the agent write that file and then run it outside the
   sandbox. Use this for attended sessions on a project whose compose file you review before each run.
2. **Run the whole session in a container or virtual machine with its own Docker daemon.** This puts file tools,
   hooks and MCP servers inside the boundary too ([sandbox
   environments](https://code.claude.com/docs/en/sandbox-environments)). A microVM with its own Docker daemon
   qualifies. Do not mount the host Docker socket into the session; that gives the agent root on the host.
3. **Run the stack tests in CI.** The agent pushes to a branch and CI runs the stack tests with no secrets
   beyond a scoped token ([Pattern 2.9, no harness](../L2-behavioral-guardrails.md#pattern-29--contain-before-you-relax)).

The containment example does not include a container or VM setup for the whole session; it shows only that a
read-only, no-network container stops the bypass commands.

## Monorepo or multi-repo for agents?

If you keep a monorepo, put the rules for the whole tree in one AGENTS.md at the root, imported by the root CLAUDE.md
([Claude Code memory](https://code.claude.com/docs/en/memory)). By default, a root CLAUDE.md stops Claude Code
from reading any AGENTS.md, including one in a subdirectory; the **Project instructions** setting
[`claude-md-and-agents-md`](https://code.claude.com/docs/en/memory#choose-which-instruction-files-load) reads both.
Put per-package rules in a subdirectory CLAUDE.md, which loads when Claude reads, writes or edits a file there, or
in `.claude/rules/` files with `paths:`, which load when matching files are used.

Make the test job a required check without a path filter ([how to](adoption-guide.md#make-the-test-job-a-required-check)).
The example census reads `.github/workflows/`, CODEOWNERS and `.claude/settings.json` under the directory you pass, so
run it at the repository root; it computes one cap for the whole monorepo, not one per package.

Whether to split is the author's opinion, not an evidenced pattern. A monorepo keeps contracts consistent through
shared types and loads every service into each session. Several smaller repositories keep each session small and move
contract checks to the agent, which reads the API contract in one repository, the event schema in another and the
types in a third. Choose multi-repo when services have clear owners and independent deploys, and each repository has
its own entry-point file that lists its public interfaces ([Pattern
0.2](../L0-foundation.md#pattern-02--progressive-disclosure)). Keep the monorepo when services share internal types
that change often or when build tooling assumes one. Do not split a monorepo that works, and do not split without an
entry-point file in each new repository.

---

## These patterns focus on development. What about deployment?

Deployment is out of scope; the right approach depends on your infrastructure, team structure and scale. The reference
project deploys from a separate DevOps repository using Terraform. The application owns health endpoints and
structured logs; the DevOps side owns infrastructure, monitoring, alerts and scaling. Someone owns the boundary
explicitly; the contract below states it.

---

## What passes between the application and operations?

Production repair sits on the line between the application repository and the DevOps repository. Either side can own the loop if the contract is written down.

**In: the incident record.** The operations side sends one record per incident, in a fixed schema:

| Field | Content |
|-------|---------|
| `fingerprint` | A stable key for the failure: journey plus error class, not line numbers |
| `journey` | The identifier of the user journey that failed |
| `request` | The failing request with personal data removed |
| `observed` / `expected` | What happened and what should have happened |
| `dependencies` | Each dependency's state, copied from the production health response |

**Out: a reproduction and an evidence bundle.** The application side returns a reproduction stack test that fails on the production commit ([Pattern 1.7](../L1-patterns/1.7-incident-to-stack-test.md)), and an evidence bundle: before and after test output, the diff, its reversibility and blast-radius classes, and the anti-masking result ([Pattern 1.9](../L1-patterns/1.9-repair-loop-frozen-oracle.md)).

The application owns the health endpoint, including its production mode ([Pattern 1.1](../L1-patterns/1.1-stack-tests.md#production-mode)). Operations owns detection, deployment, the gate and rollback. "Cannot reproduce" is a valid return: it routes to a person.

---

**Related:** [Adoption Guide](adoption-guide.md) | [Anti-Patterns](anti-patterns.md) | [Glossary](glossary.md) | [Back to Overview](../../README.md)
