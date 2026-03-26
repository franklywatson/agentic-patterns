# Agentic Patterns

A practical library of reusable patterns for building AI agents and agentic systems. These patterns emerged from real-world production experience with Claude Code and other agentic frameworks. Each pattern includes concrete examples, implementation guidance, and production-tested trade-offs. This project is for developers building AI agents who want battle-tested patterns rather than reinventing the wheel.

## The Pattern Pyramid

Patterns are organized into five levels, from foundational structure to organizational culture:

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

**L0: Foundation** - Project structure and code organization patterns that make AI systems effective. Includes directory layouts, naming conventions, and file organization principles that help AI agents navigate and understand codebases efficiently.

**L1: Feedback Loops** - Testing and validation patterns for agentic systems. Covers stack-based testing, full-loop assertions, and validation strategies that ensure AI agents produce correct and verifiable outputs.

**L2: Behavioral Guardrails** - Patterns for shaping agent behavior reliably. Includes skills framework, hooks system, constitutional rules, and other mechanisms that guide AI agents toward desired outcomes while preventing harmful actions.

**L3: Optimization** - Performance and efficiency patterns for production systems. Token efficiency strategies, smart routing, caching, and other optimization techniques that make agentic systems cost-effective at scale.

**L4: Culture** - Organizational patterns for sustaining agentic systems. Documentation practices, code rigor, cleanup processes, and team workflows that keep AI-augmented codebases healthy over time.

## Getting Started

This repository is designed to be read top-to-bottom, but you can also jump to the level most relevant to your current work:

1. **New to agentic systems?** Start with [L0: Foundation](docs/L0-foundation.md) to understand project structure principles.
2. **Building your first agent?** Read [L1: Feedback Loops](docs/L1-feedback-loops.md) for testing strategies and [L2: Behavioral Guardrails](docs/L2-behavioral-guardrails.md) for implementation patterns.
3. **Scaling to production?** [L3: Optimization](docs/L3-optimization.md) covers efficiency and performance patterns.
4. **Leading a team?** [L4: Culture](docs/L4-culture.md) addresses organizational practices and sustainability.

Each level includes concrete examples from real projects, implementation guidance, and documented trade-offs.

## Audience

- **Solo developers**: Start at L0 and work upward. The patterns are designed to be adopted incrementally as your agentic systems grow.
- **Team leads**: Can jump to any level based on current team needs. L4 is particularly relevant for organizations scaling AI development.
- **Researchers**: Use this library as a catalog of production-tested patterns to study and extend.
- **Platform builders**: L2 and L3 provide patterns for building robust agentic frameworks and tools.

## Contributing

This is a pattern library, not a code repository. Contributions should:

1. **Add patterns**: Document new patterns following the existing level structure. Include concrete examples, trade-offs, and production-tested insights.
2. **Add examples**: Provide runnable code examples demonstrating patterns in action.
3. **Improve documentation**: Clarify existing patterns, fix errors, or add missing context.
4. **Challenge assumptions**: If a pattern doesn't work in your context, document the exception and alternative approaches.

See [CONTRIBUTING.md](docs/CONTRIBUTING.md) for detailed guidelines.

## Project Status

Early development. Patterns are being extracted from production systems and documented incrementally. The structure is stable, but content is evolving rapidly.

## Background

These patterns emerged from work on the [Claude Code](https://github.com/anthropics/claude-code) project and related agentic systems. They reflect lessons learned from building AI-augmented development tools and production agents at scale.
