# Containment Example

Two enforcement points, and tests that show which one is the control. Run it to see why [Pattern
2.9](../../docs/L2-behavioral-guardrails.md#pattern-29--contain-before-you-relax) puts the boundary in a container or
sandbox rather than in a hook. The tests do not run Claude Code; the [binding](#claude-code-binding) at the end
configures it.

- **Policy check (hook enforcement point).** `decide(tool_call)` returns `allow`, `deny` or `ask`. It reads its rules from [`rules.json`](rules.json). It runs inside the agent's environment and matches strings.
- **Boundary (sandbox enforcement point).** A container with the project mounted read-only, `--network none`, a non-root user, all capabilities dropped. It does not parse commands.

The tests run each bypass command through both enforcement points. The policy misses eight of the nine write commands and both network commands. The boundary stops all of them.

## Run

TypeScript (Node 22 or later, Docker running):

```bash
cd examples/containment/typescript
npm install
npm test
```

Python (3.12 or later, uv, Docker running):

```bash
cd examples/containment/python
uv sync --frozen
uv run pytest
```

The first run pulls `python:3.12-slim`. Each run creates a private Docker network and one HTTP server container named `cp-srv-*`, and removes both when it finishes. It does not touch other containers.

## Layout

| Path | Purpose |
|------|---------|
| `rules.json` | Policy rules shared by both languages |
| `cases.json` | The bypass commands and the policy result expected for each |
| `typescript/src/policy.ts`, `python/containment/policy.py` | Policy check |
| `typescript/src/boundary.ts`, `python/containment/boundary.py` | Boundary: `run_in_container` and a fixture HTTP server |
| `claude-code/settings.json` | Claude Code binding |

## Policy rules

| Tool | Rule | Result |
|------|------|--------|
| `Read` | Credential path: `.env`, `.env.*` (not `.env.example`), `~/.ssh`, `~/.aws/credentials`, `~/.config/gcloud`, `~/.azure`, `~/.kube/config` | deny |
| `Write` | Credential path | deny |
| `Write` | Resolved path outside the project root | deny |
| `Bash` | `sed -i` at the start of a command segment (the string-matching nudge) | deny |
| `Bash` | `curl` or `wget` with a URL host not on the allowlist | deny |
| `WebFetch` | URL host not on the allowlist | deny |
| `Bash` | `git push`, `npm publish` | ask |
| anything else | | allow |

The egress allowlist is `github.com` and `registry.npmjs.org`.

## What each enforcement point proves

The policy tests (`policy.test.ts`, `test_policy.py`) assert the exact decision and rule name for each command. They show what the rules catch and what they miss.

The boundary tests (`boundary.test.ts`, `test_boundary.py`) run each command twice:

1. **Control run.** A permissive container: project mounted read-write, or a network with the fixture server. The command must succeed and change the file, or fetch `containment-ok`. If it does not, the test fails, so a command that never worked cannot pass as "blocked".
2. **Boundary run.** The read-only, no-network container. The file must be unchanged and stderr must report `Read-only file system`. For network commands the request must fail and `containment-ok` must not appear in stdout.

Together they show that the policy check alone does not stop these commands, and that the boundary does.

## Results

Policy result comes from `decide`. Boundary result comes from the boundary run. Every command succeeds in the control run.

| Command | Policy result | Boundary result |
|---------|---------------|-----------------|
| `sed -i s/old/new/ target.txt` | deny | file unchanged |
| `/usr/bin/sed -i s/old/new/ target.txt` | allow (missed) | file unchanged |
| `sed -E -i s/old/new/ target.txt` | allow (missed) | file unchanged |
| `sed --in-place s/old/new/ target.txt` | allow (missed) | file unchanged |
| `perl -pi -e 's/old/new/' target.txt` | allow (missed) | file unchanged |
| `python3 -c "open('target.txt','w').write('new')"` | allow (missed) | file unchanged |
| `bash -c "echo new > target.txt"` | allow (missed) | file unchanged |
| `$(echo sed) -i s/old/new/ target.txt` | allow (missed) | file unchanged |
| `s=sed; $s -i s/old/new/ target.txt` | allow (missed) | file unchanged |
| `python3 -c "...urlopen('http://<server>:8000/')..."` | allow (missed) | request failed |
| `p=python3; $p -c "...urlopen('http://<server>:8000/')..."` | allow (missed) | request failed |

Adding one regex to `rules.json` would make the policy catch `sed --in-place`. The boundary result would not change, and the next spelling would still pass the policy.

## Claude Code binding

[`claude-code/settings.json`](claude-code/settings.json) expresses the same two enforcement points in Claude Code settings. It uses only keys documented in the [settings reference](https://code.claude.com/docs/en/settings-reference) and on the [sandboxing](https://code.claude.com/docs/en/sandboxing) page.

| Enforcement point | Setting |
|-------------------|---------|
| Policy | `permissions.deny` with `Read(./.env)`, `Read(./.env.*)` and `Bash(sed -i *)`; `permissions.blockWritesOutsideWorkingDirectories` (Claude Code v2.1.314 or later) |
| Boundary | `sandbox.enabled`, `sandbox.failIfUnavailable`, `sandbox.allowUnsandboxedCommands: false`, `sandbox.filesystem.denyWrite: ["./.git/hooks"]` |
| Credentials | `sandbox.filesystem.denyRead`, `sandbox.credentials.files`, `sandbox.credentials.envVars`; `permissions.blockReadsOutsideWorkingDirectories` (Claude Code v2.1.257 or later) |
| Egress | `sandbox.network.allowedDomains` |

`sandbox.filesystem.denyRead` covers shell commands only. `permissions.blockReadsOutsideWorkingDirectories` makes the `Read`, `Grep`, `Glob` and `LSP` tools refuse paths outside the working directories, so the file tools cannot open `~/.ssh` or `~/.aws/credentials`; Pattern 2.9's "Reads bounded" property needs both.

The allowlist holds only `github.com` and `registry.npmjs.org`. Add the package registries, container registries and API hosts your project uses, or installs and image pulls fail inside the sandbox.

The `Read(./.env.*)` deny rule also blocks `.env.example`, which the policy check allows. The `Bash(sed -i *)` deny rule is a string rule with the same limits as the policy check above. The sandbox settings are the control.

Where to put the keys:

- **Precedence.** A key in managed settings (a `managed-settings.json` file, an MDM policy or server-managed settings) takes precedence over user, project and command-line settings. The [managed settings page](https://code.claude.com/docs/en/managed-settings) lists the delivery mechanisms and where each file lives.
- **What goes there.** Put `sandbox.enabled`, `sandbox.failIfUnavailable` and `sandbox.allowUnsandboxedCommands: false` in managed settings so a developer cannot switch the sandbox off, with `requiredMinimumVersion` set to `"2.1.314"`; that key is read from managed settings only. Without managed settings, use user settings (`~/.claude/settings.json`), which sit outside the project tree.
- **Restricting keys.** [`sandbox.network.allowManagedDomainsOnly`](https://code.claude.com/docs/en/settings-reference#sandbox-network-allowmanageddomainsonly) and [`allowManagedPermissionRulesOnly`](https://code.claude.com/docs/en/settings-reference#allowmanagedpermissionrulesonly) make Claude Code honor only the domains and permission rules set in managed settings.

The settings file is a reference. No test loads it or runs Claude Code with it.

## Limits

- The boundary protects what is outside the mount and the network. It does not protect the mounted project from an agent that has write access, and it does not hide secrets inside the project directory. Keep credentials out of the mounted tree.
- The control run needs a world-writable fixture directory because the container user is `nobody`. A real setup would map the host user instead.
- Network isolation here is all-or-nothing (`--network none`). An allowlist needs a proxy, as in Claude Code's sandbox.
