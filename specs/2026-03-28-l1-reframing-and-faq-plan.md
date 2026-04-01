# L1 Reframing and FAQ — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reframe L1 from "testing patterns" to "design-led development with closed-loop verification" and add an FAQ doc for SDLC concerns beyond the patterns.

**Architecture:** Documentation-only changes across 8 files. L1 gets a new framing section + title change. Existing patterns 1.1–1.6 get minimal touch-ups. A new FAQ doc covers deployment and operational separation. Cross-references updated across the repo.

**Tech Stack:** Markdown, Excalidraw (for pyramid diagram update)

**Spec:** `specs/2026-03-28-l1-reframing-and-faq-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `docs/L1-feedback-loops.md` | Modify | New title, new intro, new context harvest framing section, touch-ups to Pattern 1.1 and 1.3 |
| `docs/cross-cutting/faq.md` | Create | New FAQ document with two entries |
| `README.md` | Modify | Update L1 description, add FAQ link |
| `CLAUDE.md` | Modify | Update L1 description, add FAQ link to cross-cutting section |
| `docs/L0-foundation.md` | Modify | Update L1 link text in footer (line 428) |
| `docs/L2-behavioral-guardrails.md` | Modify | Update L1 link text in footer (line 341) |
| `docs/cross-cutting/migration-guide.md` | Modify | Update "L1 Feedback Loops" references to new title |
| `docs/cross-cutting/glossary.md` | Modify | Update L1 level label entries |
| `docs/references/further-reading.md` | Modify | Add excalidraw-diagram-skill tool entry |
| `docs/diagrams/pyramid.png` | Modify | Update L1 label (requires Excalidraw edit + re-export) |

---

### Task 1: Rewrite L1 title and intro

**Files:**

- Modify: `docs/L1-feedback-loops.md:1-5`

- [ ] **Step 1: Replace the title and intro (lines 1-5)**

Replace lines 1-5 with:

```markdown
# L1 Closed Loop Design and Verification

**Level 1** in the agentic patterns hierarchy: the level where agents stop guessing and start designing. L0 provides navigable structure — deep modules, progressive disclosure, CLAUDE.md as constitution. L1 is where the agent uses that structure to gather evidence, form hypotheses, propose architectural changes, and validate the result through closed-loop verification.

The "closed loop" is design→implement→verify→confirm, not just test→fix→test. Stack tests are the validation mechanism that closes the loop — they confirm that the design intent was implemented correctly. But the design comes first. Every plan, every bugfix, every investigation begins with harvesting the right context: understanding what the system does, what it should do, and what evidence supports the proposed change.

---

## Context Harvesting — From Understanding to Design

Every agent interaction with the system — a new feature, a bug fix, an architectural investigation — starts with context, not code. The agent harvests targeted information from documentation (intent), code (contract), tests (expected behavior), and logs (what actually happened) to construct a mental model before proposing changes. This section describes the workflow that turns context into design, and design into verified implementation.

### The Design-First Workflow

The workflow for driving an architectural change through the system:

1. **Explain the problem** — Describe what's broken or what needs to change. Be specific: which component, which behavior, which user journey is affected.

2. **Provide evidence** — Give the agent pointers to the relevant context: log excerpts showing the failure, reference code that models the preferred solution, test output that demonstrates the current behavior. The agent needs concrete evidence, not vague descriptions.

3. **State the goal** — Define the desired end state with precision. For example: "Right now the system only stores the order status when the order is sent. We also need confidence that the order was triggered into the upstream ERP and that system has acknowledged receipt."

4. **Invoke the right skill** — Use `systematic-debugging` for investigations (analyzing failures, tracing root causes) or `plan+` for design proposals (new features, architectural changes). The skill structures the agent's analysis and prevents undisciplined exploration.

5. **Iterate on the plan** — The design must include unit and stack test changes that provide end-to-end confidence. Review the plan, challenge assumptions, refine scope. The plan is a contract between human intent and agent execution.

6. **Save the refined plan** — Persist the converged plan to the filesystem after Q&A is complete. Future sessions can reference the plan; the agent can verify implementation against it.

7. **Execute** — Use the `executing-tasks` skill to implement the plan as documented. Run tests, fix issues found, verify against the plan's acceptance criteria.

### Why Context Harvesting Precedes Testing

Stack tests validate design intent. But if the design is wrong, perfect tests just confirm the wrong thing with high confidence. The agent needs to understand the system before changing it.

This is why L0 exists as a prerequisite: deep modules make code contracts discoverable, progressive disclosure makes structure navigable, and CLAUDE.md makes rules explicit. L1 is where the agent activates those foundations — reading the map before charting the course, then verifying the destination was reached.

### Targeted Context, Not Exhaustive Reading

Don't read everything. The agent constructs a mental model from targeted slices:

- **Docs for intent** — What is this module supposed to do? What are the constraints?
- **Code for contract** — What does the interface promise? What types flow in and out?
- **Tests for expected behavior** — What does the system actually do today? What edge cases are covered?
- **Logs for what happened** — What went wrong in this specific instance? What was the observable behavior?

Each source answers a different question. Reading a 500-line file to find one assertion wastes context. Reading the test for that assertion gives the answer in 20 lines.

### From Design to Verification

The following patterns (1.1–1.6) describe the verification mechanisms that close the loop on design intent. Stack tests validate end-to-end user journeys. Full-loop assertions catch missing side effects. Sequential ordering provides diagnostic signal. Together, they confirm that the context harvesting produced the right design, and the implementation delivered it.
```

- [ ] **Step 2: Verify the edit reads correctly**

Read `docs/L1-feedback-loops.md:1-80` and confirm:

- Title is "L1 Closed Loop Design and Verification"
- Context Harvesting section appears before Pattern 1.1
- All four subsections are present
- The `---` separator exists between the framing section and Pattern 1.1

---

### Task 2: Add touch-up to Pattern 1.1 intro

**Files:**

- Modify: `docs/L1-feedback-loops.md` (Pattern 1.1 Solution section)

- [ ] **Step 1: Add design-led framing to Pattern 1.1**

In the Pattern 1.1 Solution section, after the first paragraph (the one starting "Stack tests run the complete Docker stack..."), insert:

```markdown

Stack tests are the primary verification mechanism for the design intent established through context harvesting. When the agent has harvested context, framed a problem, and designed a solution, stack tests validate that the solution works end-to-end — not just that the code compiles or individual functions return correct values, but that the full user journey behaves as designed.
```

- [ ] **Step 2: Verify the addition flows naturally**

Read Pattern 1.1 Solution section. Confirm the new paragraph follows the existing first paragraph and doesn't break the flow into the existing content about atomic user journeys.

---

### Task 3: Add comparative ground truth subsection to Pattern 1.3

**Files:**

- Modify: `docs/L1-feedback-loops.md` (Pattern 1.3, after "Stack Tests as Vertical Slices" subsection, before "Anti-Pattern" subsection)

- [ ] **Step 1: Insert new subsection**

After the "Stack Tests as Vertical Slices" subsection (which ends with the line about dependency bugs) and before the "Anti-Pattern" subsection, insert:

```markdown

### Additive Tests as Comparative Ground Truth

Even with guardrails, skills, and stack tests, agents will sometimes produce undesirable changes that slip through. A skill might have a gap, a hook might not cover a specific mutation, or the agent might introduce subtly wrong internals that pass on the surface but cause problems later. The additive test structure provides a recovery mechanism: use a known-good, passing foundational stack test as executable ground truth to diagnose a failing new test.

**Example scenario:**

1. A `user-order-completion` stack test exists and passes. It verifies: user logs in → navigates to item → places in basket → pays → stack test asserts order state in `/user/orders` list API, email notifications sent, payment processor debit for correct amount.

2. Some time later, you instruct the agent to implement a label-printing capability for order returns. It writes code and a new stack test. The test runs and fails — for odd reasons, and things don't look quite right.

3. Instead of visual debugging, task the agent to do a **comparative analysis**: diff the passing `user-order-completion` test against the failing new test. Focus on logs, code, and tests as they relate to order creation and terminal state assertion expectations.

4. The comparison surfaces convention misalignments: the new test used a different bootstrap user than expected, used the wrong service to create the order, or the terminal state assertions only verify label existence — not label content legibility.

5. The agent fixes the in-progress solution to align with the conventions established by the foundational test.

This pattern — employing a foundational, fully passing stack test against a formative, broken one — gives the agent a structured way to discover what's wrong by comparing against what's right. The additive structure means earlier tests represent stable conventions; later tests inherit and extend those conventions. When inheritance breaks, the diff against the parent test reveals where and why.

```

- [ ] **Step 2: Verify placement**

Read `docs/L1-feedback-loops.md` around Pattern 1.3. Confirm:

- New subsection appears after "Stack Tests as Vertical Slices"
- New subsection appears before "Anti-Pattern"
- Markdown formatting is consistent with surrounding sections

---

### Task 4: Update L1 navigation links across the repo

**Files:**

- Modify: `docs/L0-foundation.md:415,428`
- Modify: `docs/L2-behavioral-guardrails.md:341`
- Modify: `docs/cross-cutting/migration-guide.md` (multiple lines)
- Modify: `docs/cross-cutting/glossary.md` (multiple entries)

- [ ] **Step 1: Update L0-foundation.md**

Line 415 — change:

```
- **L1: Feedback Loops** — Testing at module boundaries validates deep module design
```

to:

```
- **L1: Closed Loop Design** — Testing at module boundaries validates deep module design
```

Line 428 — change:

```
**Next:** [L1: Feedback Loops — Closed-Loop Testing](L1-feedback-loops.md) | [Back to Overview](../README.md)
```

to:

```
**Next:** [L1: Closed Loop Design and Verification](L1-feedback-loops.md) | [Back to Overview](../README.md)
```

- [ ] **Step 2: Update L2-behavioral-guardrails.md**

Line 341 — change:

```
**Previous:** [L1: Feedback Loops — Closed-Loop Testing](L1-feedback-loops.md)
```

to:

```
**Previous:** [L1: Closed Loop Design and Verification](L1-feedback-loops.md)
```

- [ ] **Step 3: Update migration-guide.md**

Use `replace_all` for these specific text changes:

- `L1 Feedback Loops` (in table cells, phase headers, and descriptions) → `L1 Closed Loop Design` where it appears as a standalone title/label
- Line 1454: `[L1 Feedback Loops](../L1-feedback-loops.md) — Stack tests and assertions` → `[L1 Closed Loop Design](../L1-feedback-loops.md) — Design-led verification with closed-loop testing`

Do NOT change "Feedback Loops" where it appears in general prose about feedback mechanisms (those are about the concept, not the document title).

- [ ] **Step 4: Update glossary.md**

All glossary entries with `**Level**: L1 - Feedback Loops` — change to `**Level**: L1 - Closed Loop Design`. This affects entries for: Agentic Testing, Assertion Layering, Conditional Assertion, Container Isolation, Context Engineering, Docker Resource Limits, Dynamic Port Allocation, No-Mock Philosophy, Resource Hygiene, Stack Test, Test Integrity, Token Efficiency, Transient Volume.

Also update the "Cross-References" section at the bottom:

```
- **L1 Feedback Loops**: Stack testing and assertion patterns
```

→

```
- **L1 Closed Loop Design**: Design-led verification and closed-loop testing
```

- [ ] **Step 5: Verify cross-references**

Grep for remaining instances of `L1 Feedback Loops` or `L1: Feedback Loops` across all `.md` files (excluding the specs/ directory). Confirm none remain that should have been updated.

---

### Task 5: Update README.md

**Files:**

- Modify: `README.md:40,51`

- [ ] **Step 1: Update L1 level overview (line 40)**

Change:

```
**[L1: Feedback Loops](docs/L1-feedback-loops.md)** — Replace the traditional test pyramid with closed-loop testing. Stack tests bring up the full application stack and test through APIs only — no mocks, no partial integration, no ambiguous results. Full-loop assertion layering catches regressions at primary, secondary, and tertiary levels.
```

to:

```
**[L1: Closed Loop Design and Verification](docs/L1-feedback-loops.md)** — The level where agents stop guessing and start designing. Context harvesting gathers targeted evidence before implementation. Stack tests validate design intent end-to-end through the full application stack — no mocks, no partial integration, no ambiguous results. Full-loop assertion layering catches regressions at primary, secondary, and tertiary levels.
```

- [ ] **Step 2: Update getting started link text (line 51)**

Change:

```
2. **Already using AI coding tools?** Jump to [L1: Feedback Loops](docs/L1-feedback-loops.md) to understand why your tests might be giving your agent incomplete feedback.
```

to:

```
2. **Already using AI coding tools?** Jump to [L1: Closed Loop Design and Verification](docs/L1-feedback-loops.md) to understand how context harvesting and closed-loop verification improve agent outcomes.
```

---

### Task 6: Update CLAUDE.md

**Files:**

- Modify: `CLAUDE.md:15,66-67`

- [ ] **Step 1: Update repo structure comment (line 15)**

Change:

```
│   ├── L1-feedback-loops.md     # Stack tests, full-loop assertions
```

to:

```
│   ├── L1-feedback-loops.md     # Closed loop design and verification
```

- [ ] **Step 2: Update level documentation section (lines 66-67)**

Change:

```
**Feedback Loops:**
- @docs/L1-feedback-loops.md — Stack tests, full-loop assertions, sequential design
```

to:

```
**Closed Loop Design and Verification:**
- @docs/L1-feedback-loops.md — Context harvesting, stack tests, full-loop assertions, sequential design
```

---

### Task 7: Create FAQ document

**Files:**

- Create: `docs/cross-cutting/faq.md`

- [ ] **Step 1: Write the FAQ document**

Create `docs/cross-cutting/faq.md` with the following content:

```markdown
# Frequently Asked Questions — Beyond the Patterns

Questions about aspects of the software development lifecycle that the pattern library doesn't cover. These are not universal rules — they describe choices that worked for one team on one project. Other teams with different constraints would reasonably choose differently.

---

## These patterns focus on development. What about deployment?

The patterns assume Docker for local development and testing. Production deployment is a separate concern that this pattern library deliberately doesn't prescribe — the right approach depends on your infrastructure, team structure, and scale.

In the reference project, deployment was handled in a separate DevOps repository using Terraform. That repo had:

- **Automation to detect config drift** between the project's `docker-compose.yml` and the production infrastructure definition. The agent could identify differences and propose alignment.
- **Tooling to audit environment variables** across dev and ops repos for consistency.
- **A commit-driven deployment model** — the DevOps repo deep-dived into GitHub commit changes to key application files, then followed a structured process for mapping those changes into infrastructure updates.

This separation worked well for this project's scale. The agentic patterns from L0-L4 applied equally to the DevOps repo — CLAUDE.md, progressive disclosure, evidence-based claims all work in infrastructure code. But the specific tools (Terraform, separate repo, commit-driven model) were choices, not mandates. Teams deploying to Kubernetes, serverless platforms, or managed services would adapt the deployment model to their context. What transfers is the discipline (evidence-based changes, structured context, clear contracts between repos), not the tooling.

---

## How do you separate operational concerns from application code?

In the reference project, scaling, monitoring, observability, and alerting lived in the DevOps repo. The application repo was not polluted with operational concerns — it focused on behavior.

The split looked like this:

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
```

- [ ] **Step 2: Verify the FAQ reads with the right tone**

Read the full FAQ. Confirm:

- Tone is observational ("in the reference project, we chose") not prescriptive ("you should")
- Both entries end with acknowledgment that other approaches are valid
- No overlap with content in migration-guide.md or anti-patterns.md

---

### Task 8: Add FAQ link to README.md and CLAUDE.md

**Files:**

- Modify: `README.md` (What's in This Repo section)
- Modify: `CLAUDE.md` (Cross-Cutting Guides section)

- [ ] **Step 1: Add FAQ to README.md**

In the "What's in This Repo" section, add to the `docs/cross-cutting/` listing:

```
docs/cross-cutting/ # Anti-patterns, migration guide, FAQ, glossary
```

And add a new bullet under "Background and Further Reading":

```
- [FAQ](docs/cross-cutting/faq.md) — deployment, operations, and other SDLC concerns beyond the patterns
```

- [ ] **Step 2: Add FAQ to CLAUDE.md**

In the "Cross-Cutting Guides" section, add:

```
- @docs/cross-cutting/faq.md — Deployment, operations, and SDLC concerns beyond the patterns
```

- [ ] **Step 3: Verify links resolve**

Confirm `docs/cross-cutting/faq.md` exists and both README.md and CLAUDE.md link to it correctly.

---

### Task 9: Add excalidraw-diagram-skill to further-reading.md

**Files:**

- Modify: `docs/references/further-reading.md`

- [ ] **Step 1: Add tool entry**

In the Tools section, add after the existing Excalidraw entries:

```markdown

### Excalidraw Diagram Skill
- **Type:** Tool / Skill
- **Creator:** Cole Medin (coleam00)
- **Summary:** Skill for generating Excalidraw diagram JSON files to visualize workflows, architectures, and concepts directly from agent sessions.
- **Related to:** L0, L1
- **URL:** https://github.com/coleam00/excalidraw-diagram-skill
```

---

### Task 10: Update pyramid diagram

**Files:**

- Modify: `docs/diagrams/pyramid.png` (and its Excalidraw source if one exists)

- [ ] **Step 1: Check for Excalidraw source**

Glob for `docs/diagrams/*.excalidraw` or similar. If found, edit the L1 label from "Feedback Loops" to "Closed Loop Design" and re-export to PNG.

If no Excalidraw source exists, note this in the commit as a known gap — the PNG will need manual update.

- [ ] **Step 2: Verify the diagram**

If updated, confirm the PNG renders correctly with the new label.

---

### Task 11: Final verification

- [ ] **Step 1: Run link validation**

Grep all `.md` files for markdown links pointing to L1-related paths. Verify none are broken:

```bash
grep -rn '\[.*\](.*L1' docs/ README.md CLAUDE.md --include="*.md" | grep -v specs/
```

- [ ] **Step 2: Check for stale title references**

Grep for remaining instances of "L1 Feedback Loops" (as a title, not the concept):

```bash
grep -rn "L1 Feedback Loops\|L1: Feedback Loops\|Closed-Loop Testing" docs/ README.md CLAUDE.md --include="*.md" | grep -v specs/
```

Expected: zero results (all updated).

- [ ] **Step 3: Verify L1 document structure**

Read `docs/L1-feedback-loops.md` start to finish. Confirm:

- Title is "L1 Closed Loop Design and Verification"
- Context Harvesting section appears before Pattern 1.1
- Pattern 1.1 has the design-led touch-up
- Pattern 1.3 has the comparative ground truth subsection
- All other patterns (1.2, 1.4, 1.5, 1.6) are unchanged
- Footer navigation links still work

- [ ] **Step 4: Commit all changes**

```bash
git add docs/L1-feedback-loops.md docs/cross-cutting/faq.md docs/cross-cutting/glossary.md docs/cross-cutting/migration-guide.md docs/L0-foundation.md docs/L2-behavioral-guardrails.md docs/references/further-reading.md README.md CLAUDE.md docs/diagrams/
git commit -m "docs: reframe L1 as closed loop design and verification, add FAQ

- Rename L1 from 'Feedback Loops — Closed-Loop Testing' to 'Closed Loop Design and Verification'
- Add context harvesting framing section before stack test patterns
- Add comparative ground truth subsection to Pattern 1.3
- Create FAQ doc covering deployment and operational separation
- Update cross-references across L0, L2, glossary, migration guide
- Add excalidraw-diagram-skill to further reading"
```
