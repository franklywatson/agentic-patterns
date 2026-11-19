# Claude Code

@AGENTS.md

By default, Claude Code reads AGENTS.md when no CLAUDE.md, `.claude/CLAUDE.md` or CLAUDE.local.md exists in the
working directory or above it; when one exists it reads the CLAUDE.md files only, so this CLAUDE.md imports it with
the one-line `@AGENTS.md` above ([Pattern 0.4](docs/L0-foundation.md#pattern-04--agent-instruction-file-as-project-constitution),
[Claude Code memory](https://code.claude.com/docs/en/memory#agents-md)). Add Claude Code-specific lines below this one.
