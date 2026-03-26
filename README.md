# Agentic Patterns

Practical patterns for building software that works as well with AI agents as it does with humans — and recognizing that the gap between those two audiences is wider than most teams think.

## Why This Exists

AI coding agents are becoming standard tools. But most codebases weren't built for them. They were built for humans who can mentally bridge gaps, tolerate partial feedback, rely on intuition to navigate messy directories, and instinctively know which warnings to ignore.

AI agents can't do any of that. They need:

- **Complete feedback** — a test either passes or fails, and the failure tells them exactly where to look
- **Structured context** — information organized so complexity is discoverable, not dumped all at once
- **Enforced discipline** — rules that are impossible to bypass, not just written in a wiki
- **Deterministic environments** — no "it works on my machine," no shared state leaking between tests

These aren't new ideas. Deep modules, progressive disclosure, and evidence-based engineering are decades old. What's new is how critical they become when your coworker is an AI with no memory of your codebase and no intuition to fall back on.

Traditional software engineering optimizes for human developers. **Agentic development** optimizes for AI agents — and it turns out the practices that make codebases agent-friendly also make them better for humans. The discipline is higher, but the payoff is a codebase that any contributor (human or AI) can work in effectively from day one.

## Where These Patterns Come From

These patterns are extracted from a production trading automation platform ([wyntrade-core](docs/references/wyntrade-case-study.md)) built with Claude Code as the primary development tool. That project developed an approach it calls **Stack-First Development**: instead of the traditional unit → integration → acceptance test cycle, it brings up the entire application stack in Docker and tests through API endpoints only. No mocks for system components. No partial-stack integration tests. Full user journeys, end to end.

The patterns here generalize that approach — and the supporting practices around project structure, skills, guardrails, optimization, and documentation rigor — into a framework any team can adopt.

This isn't theory. These patterns are in daily production use. They've been refined through hundreds of agent sessions building real features, fixing real bugs, and passing real tests.

## The Pattern Pyramid

Patterns are organized into five levels, each building on the previous. Adopt them in order — skipping levels creates fragile foundations.

```
            L4: Culture
          Rigor, docs, cleanup
        ┌─────────────────────┐
       L3: Optimization                   Token efficiency, smart routing
      ┌───────────────────────┐
     L2: Behavioral Guardrails             Skills, hooks, constitutional rules
    ┌─────────────────────────┐
   L1: Feedback Loops                        Stack tests, full-loop assertions
  ┌───────────────────────────┐
 L0: Foundation                               Project structure for AI accessibility
└──────────────────────────────────────────────────────────────────────────────────┘
```

### Level Overviews

**[L0: Foundation](docs/L0-foundation.md)** — Structure your codebase so an AI with zero prior context can navigate, understand, and contribute. Deep modules, progressive disclosure, conceptual file organization, and CLAUDE.md as project constitution. The "can a new starter figure this out?" test.

**[L1: Feedback Loops](docs/L1-feedback-loops.md)** — Replace the traditional test pyramid with closed-loop testing. Stack tests bring up the full application stack and test through APIs only — no mocks, no partial integration, no ambiguous results. Full-loop assertion layering catches regressions at primary, secondary, and tertiary levels.

**[L2: Behavioral Guardrails](docs/L2-behavioral-guardrails.md)** — Rules written in prose are suggestions. Skills and hooks are enforcement. Overlay skills on top of base agent capabilities, chain them into a complete development lifecycle, and automate discipline through the tool layer.

**[L3: Optimization](docs/L3-optimization.md)** — Agent efficiency is quality, not just speed. Smart routing redirects shell commands to specialized tools (60-80% token reduction). Intent classification, environment-aware routing, and the Scout Pattern turn exploration into structured context.

**[L4: Culture](docs/L4-culture.md)** — The rigor expected of an agentic bot is higher than you'd ask of a human — and for good reason. Documentation freshness, evidence-based claims, aggressive cleanup, and spec drift detection. Bots don't have intuition to work around stale docs.

## Getting Started

1. **New to agentic development?** Start with [L0: Foundation](docs/L0-foundation.md). The structural changes there are the highest-impact, lowest-effort starting point.
2. **Already using AI coding tools?** Jump to [L1: Feedback Loops](docs/L1-feedback-loops.md) to understand why your tests might be giving your agent incomplete feedback.
3. **Building team practices?** [L2: Behavioral Guardrails](docs/L2-behavioral-guardrails.md) and [L4: Culture](docs/L4-culture.md) together establish the discipline layer.
4. **Want a phased adoption plan?** See the [Migration Guide](docs/cross-cutting/migration-guide.md) for a step-by-step path from traditional to agentic practices.

## Audience

- **Solo developers and small teams** using Claude Code, Cursor, or similar tools — adopt patterns incrementally starting at L0
- **Team leads and architects** establishing agentic development practices across an organization
- **Anyone** curious about what "agentic-friendly" software engineering actually looks like in practice

## What's in This Repo

```
docs/               # Pattern documentation (L0-L4) and guides
examples/           # Working code examples (TypeScript + Python)
  stack-test/       # Minimal stack test setups in both languages
  skills/           # Skill overlay templates
  guardrails/       # Token optimization middleware example
  project-structure/ # Before/after directory layouts
docs/cross-cutting/ # Anti-patterns, migration guide, glossary
docs/references/    # Case study and further reading
```

## Contributing

This is a living pattern library. Contributions welcome:
- **New patterns** that extend or challenge the existing framework
- **Real-world examples** from different domains (the current examples lean toward ecommerce and trading)
- **Corrections** when a pattern doesn't match your experience — document the exception
- **Translations** of concepts to other frameworks and tools

## Background and Further Reading

- [Wyntrade Case Study](docs/references/wyntrade-case-study.md) — the production system these patterns were extracted from
- [Further Reading](docs/references/further-reading.md) — books, articles, videos, and tools that informed this work
- [Glossary](docs/cross-cutting/glossary.md) — terminology reference
