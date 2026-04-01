# L1 Reframing and FAQ — Design Spec

**Date**: 2026-03-28
**Status**: Draft — pending user review

---

## Summary

Two changes to the agentic-patterns repo:

1. **Reframe L1** from "testing patterns" to "design-led development with closed-loop verification" by adding a new framing section on context harvesting before the existing stack test patterns.
2. **Add an FAQ document** covering SDLC aspects (deployment, operations) that the patterns deliberately don't address, framed as team preferences rather than universal rules.

---

## Change 1: L1 Reframing

### Title Change

**Current**: `# L1 Feedback Loops — Closed-Loop Testing`
**New**: `# L1 Closed Loop Design and Verification`

### Intro Rewrite

Replace the current single-paragraph intro with a new intro that positions L1 as the level where agents stop guessing and start designing. L0 provides navigable structure; L1 is where the agent uses that structure to gather evidence, form hypotheses, and propose changes — then validates through closed-loop verification.

Key message: the "closed loop" is design→implement→verify→confirm, not just test→fix→test. Stack tests are the validation mechanism, not the starting point.

### New Framing Section: Context Harvesting

**Location**: Between the rewritten intro and Pattern 1.1 (Stack Tests), separated by `---`

**Title**: `## Context Harvesting — From Understanding to Design`

**Four subsections**:

#### 1. The Design-First Workflow

Describes the full agent workflow for driving architectural change:

1. **Explain the problem** — what's broken or what needs to change
2. **Provide evidence** — pointers to logs, reference code that works, models of the preferred solution, relevant test output
3. **State the goal** — the desired end state (e.g., "right now the system only stores the order status when the order is sent; we also need confidence that the order was triggered into the upstream ERP and that system has acknowledged receipt")
4. **Invoke the right skill** — systematic-debugging for investigations, plan+ for design proposals
5. **Iterate on the plan** — the design must include unit and stack test changes for end-to-end confidence
6. **Save the refined plan** — persist to filesystem after Q&A converges
7. **Execute** — use executing-tasks skill to implement, then run tests and fix issues

#### 2. Why Context Harvesting Precedes Testing

Philosophical argument: stack tests validate design intent, but if the design is wrong, perfect tests just confirm the wrong thing. The agent needs to understand the system before changing it. L0 provides the navigable structure; L1 is where the agent uses that structure to gather evidence, form hypotheses, and propose changes.

#### 3. Targeted Context, Not Exhaustive Reading

Practical guidance: don't read everything. Read docs for intent, code for contract, tests for expected behavior, logs for what actually happened. The agent constructs a mental model from targeted slices, not whole-file dumps.

#### 4. Transition to Verification Patterns

Brief bridge: the following patterns (1.1–1.6) describe the verification mechanisms — stack tests, assertion layering, sequential design — that close the loop on design intent established through context harvesting.

### Existing Pattern Touch-Ups

**Pattern 1.1 (Stack Tests)** intro paragraph gets a light addition: "Stack tests are the primary verification mechanism for the design intent established through context harvesting. When the agent has harvested context, framed a problem, and designed a solution, stack tests validate that the solution works end-to-end."

**Pattern 1.3 (Sequential/Additive Test Design)** gets a new subsection on comparative debugging. This is the mechanism where the additive test structure serves as a troubleshooting failsafe.

Content for the new subsection:

**Additive Tests as Comparative Ground Truth**

Even with guardrails, skills, and stack tests, agents will sometimes produce undesirable changes that slip through. A skill might have a gap, a hook might not cover a specific mutation, or the agent might introduce subtly wrong internals that pass on the surface but cause problems later. The additive test structure provides a recovery mechanism: use a known-good, passing foundational stack test as executable ground truth to diagnose a failing new test.

Example scenario:

1. A `user-order-completion` stack test exists and passes. It verifies: user logs in → navigates to item → places in basket → pays → stack test asserts order state in `/user/orders` API, email notifications, payment processor debit for correct amount.
2. The agent implements a label-printing capability for order returns. It writes code and a new stack test. The test runs and fails — for odd reasons, and things don't look right.
3. Instead of visual debugging, task the agent to do a comparative analysis: diff the passing `user-order-completion` test against the failing new test. Focus on logs, code, and tests as they relate to order creation and terminal state assertion expectations.
4. The comparison surfaces convention misalignments: the new test used a different bootstrap user than expected, used the wrong service to create the order, or the terminal state assertions only verify label existence (not label content legibility).
5. The agent fixes the in-progress solution to align with the conventions established by the foundational test.

This pattern — employing a foundational, fully passing stack test against a formative, broken one — gives the agent a structured way to discover what's wrong by comparing against what's right. The additive structure means earlier tests represent stable conventions; later tests inherit and extend those conventions. When inheritance breaks, the diff against the parent test reveals where and why.

Other patterns (1.1–1.2, 1.4–1.6): no content changes beyond the Pattern 1.1 intro touch-up. Their existing cross-references remain valid.

### Cross-Reference Updates

Files that reference L1's title or description need updating:

- **README.md**: Update L1 entry in Level Overviews to reflect "design-led development with closed-loop verification"
- **CLAUDE.md**: No change needed (links to `docs/L1-feedback-loops.md` by path, not title)
- **L0-foundation.md**: Cross-references to L1 by pattern number (1.1, 1.2) — no change needed
- **L2-behavioral-guardrails.md**: References "L1 Feedback Loops" in text — update phrasing if title is mentioned explicitly
- **L4-standards-measurement.md**: References L1 patterns by number — no change needed
- **migration-guide.md**: References L1 by description — update phrasing if needed
- **anti-patterns.md**: L1 section header — no change needed (references by pattern numbers)
- **glossary.md**: Entry for "Agentic Testing" references L1 — update description
- **further-reading.md**: No change needed (references by level number)

### Diagram Updates

- **docs/diagrams/pyramid.png**: Update L1 label from "Feedback Loops" to reflect new framing. Requires editing the Excalidraw source and re-exporting.
- **Excalidraw diagramming skill reference**: Add link to <https://github.com/coleam00/excalidraw-diagram-skill> in further-reading.md under Tools section.

---

## Change 2: FAQ Document

### Location

`docs/cross-cutting/faq.md`

### Linked From

- **README.md**: Add to "What's in This Repo" section and/or navigation
- **CLAUDE.md**: Add to cross-cutting docs section in master index

### Title

`# Frequently Asked Questions — Beyond the Patterns`

### Tone

Observational, not normative. These are team preferences and choices, not universal rules. "In the reference project, we chose X because Y" — not "You should do X." Other teams with different constraints may reasonably choose differently.

### Entries

#### Q1: These patterns focus on development. What about deployment?

Content:

- The patterns assume Docker for local development and testing. Production deployment is a separate concern that the pattern library doesn't prescribe.
- In the reference project, deployment was handled in a separate DevOps repository using Terraform.
- That repo had automation to help the agent identify differences between the project's `docker-compose.yml` and the production infrastructure definition.
- Simple tooling to sanity-check and audit environment variable and config alignment between dev and ops repos.
- The DevOps repo started by deep-diving into GitHub commit changes to key files, then followed a model for mapping those into the DevOps tooling.
- The agentic patterns from L0-L4 applied equally to the DevOps repo — CLAUDE.md, progressive disclosure, evidence-based claims all work in infrastructure code.
- Other teams: this was a preference for this project's scale and team structure. Teams deploying to Kubernetes, serverless, or managed services would adapt accordingly.

#### Q2: How do you separate operational concerns from application code?

Content:

- In the reference project, scaling, monitoring/observability, and alerting lived in the DevOps repo — not polluting the application repo with operational concerns.
- The application repo owned: Docker stack for local testing, health endpoints exposing service status, structured logging for observability consumers.
- The DevOps repo owned: Terraform modules, Kubernetes configs, monitoring dashboards, alert rules, scaling policies.
- The boundary: application provides health and telemetry; DevOps consumes them.
- This separation kept the application repo focused on behavior (L0-L4 patterns) while the DevOps repo handled how that behavior runs at scale.
- Other teams: the specific split depends on team structure, deployment target, and operational maturity. The principle (separate concerns) is universal; the implementation varies.

---

## Tasks (for implementation plan)

1. Rewrite L1 intro and title
2. Write new "Context Harvesting" framing section (4 subsections)
3. Add light touch-up to Pattern 1.1 intro
4. Add new "Additive Tests as Comparative Ground Truth" subsection to Pattern 1.3
5. Update cross-references in README.md, L2, glossary, migration-guide
6. Update pyramid Excalidraw diagram for new L1 label
7. Add excalidraw-diagram-skill link to further-reading.md
8. Create `docs/cross-cutting/faq.md` with two entries
9. Add FAQ link to README.md and CLAUDE.md
10. Update case study if it references L1 title explicitly
11. Run link validation across affected files
