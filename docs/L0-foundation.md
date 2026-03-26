# L0: Foundation — Project Structure for AI Accessibility

Your codebase is the biggest influence on AI's output. Structure it so an AI with zero prior context can navigate, understand, and contribute effectively.

## Pattern 0.1 — Deep Modules

**Problem**: Shallow modules expose too much surface area. When a module exports 20+ functions, types leak across boundaries, and the AI must track many interconnections simultaneously. Each export creates a potential coupling point. The agent wastes context understanding implementation details that should be hidden.

**Solution**: A deep module has a simple interface with lots of implementation hidden behind it. The AI sees the seam — a clean, small set of exports — and delegates implementation details to the interior. Based on John Ousterhout's "A Philosophy of Software Design" and Matt Pocock's graybox module concept: modules where tests lock down behavior, the public interface is carefully controlled, and the interior is delegatable to AI.

**In Practice**:
- Export 3-5 functions maximum per module
- Put complex logic behind a simple facade
- Let tests specify behavior, not implementation
- Keep types focused — avoid "kitchen sink" interfaces

```typescript
// Deep module — clean interface, complexity hidden
// ecommerce/fulfillment/index.ts
export interface FulfillmentConfig {
  sourceWarehouse: WarehouseId;
  targetRegion: RegionId;
  confirmations: number;
}

export async function fulfillOrder(config: FulfillmentConfig, items: OrderItem[]): Promise<FulfillmentResult>
export async function getFulfillmentStatus(orderId: string): Promise<FulfillmentStatus>
export function getSupportedRegions(): readonly RegionId[]
```

```typescript
// Shallow module — leaking internals, 20+ exports
// ecommerce/fulfillment/index.ts
export function fulfillOrder(...) { }
export function getFulfillmentStatus(...) { }
export function getSupportedRegions() { }
export function validateConfig(...) { }           // internal
export function parseWarehouseId(...) { }              // internal
export function serializeOrder(...) { }               // internal
export function deserializeOrder(...) { }              // internal
export function calculateShipping(...) { }               // internal
export function estimateTax(...) { }                // internal
export function formatAddress(...) { }              // internal
export function parseAddress(...) { }               // internal
// ... 10 more internal utilities
```

**Anti-Pattern**: Creating "utils" files that export 20+ helper functions. If you can't describe what a module does in one sentence, it's too shallow.

**Cross-References**: See [L2: Skills Framework](L2-behavioral-guardrails.md) for how skills enforce deep module boundaries during implementation. [L4: Culture](L4-culture.md) covers maintaining depth through aggressive cleanup.

---

## Pattern 0.2 — Progressive Disclosure

**Problem**: A flat directory with 50 files forces the AI to read everything to understand relationships. Deep nesting hides important files behind many clicks. Both extremes waste context — the agent can't discover structure incrementally.

**Solution**: Directory structure mirrors mental models. AI discovers complexity gradually: README → CLAUDE.md → module interfaces → implementation. Each layer gives enough context to decide whether to go deeper.

**In Practice**:
- Put entry points at the root: `README.md`, `CLAUDE.md`
- Group related files into directories by domain
- Keep depth to 3-4 levels maximum
- Each directory should have a clear purpose

```
Good — progressive disclosure
project/
├── README.md                    # Overview, entry point
├── CLAUDE.md                    # Agent contract
├── ecommerce/                   # Domain module
│   ├── index.ts                 # Public interface
│   ├── fulfillment/             # Sub-domain
│   │   ├── index.ts
│   │   └── shipping.ts
│   └── catalog/                 # Sub-domain
│       └── index.ts
└── testing/                     # Cross-cutting concern
    └── stack-test.ts
```

```
Bad — flat 50-file directory
project/
├── README.md
├── fulfillment_shipstation.ts
├── fulfillment_fedex.ts
├── catalog_shopify.ts
├── catalog_woocommerce.ts
├── catalog_bigcommerce.ts
├── ecommerce_inventory.ts
├── ecommerce_tax.ts
├── ecommerce_pricing.ts
├── ecommerce_checkout.ts
├── ecommerce_monitoring.ts
├── ecommerce_recovery.ts
... (40 more files)
```

**Anti-Pattern**: "Treasure hunt" structures where understanding one file requires reading 10 others scattered across the tree.

**Cross-References**: [Pattern 0.3](#pattern-03--conceptual-file-organization) expands on grouping by domain. [L4: New Starter Standard](L4-culture.md) tests whether disclosure works for zero-context agents.

---

## Pattern 0.3 — Conceptual File Organization

**Problem**: Grouping by technical layer (`services/`, `handlers/`, `utils/`, `types/`) separates related concepts. The AI can't find all ecommerce code in one place — it's scattered across directories. File paths become meaningless navigation hints.

**Solution**: Group by domain or capability. AI uses file paths as navigation hints. Co-locate related code by what it does, not what language construct it uses.

**In Practice**:
- `ecommerce/fulfillment/` not `services/fulfillment/`
- `ecommerce/types.ts` inside the domain, not a global `types/` dir
- One domain per directory, cross-cutting concerns at root level

```
Before — technical layering
src/
├── services/
│   ├── checkout.ts
│   ├── fulfillment.ts
│   └── monitoring.ts
├── handlers/
│   ├── orderHandler.ts
│   └── fulfillmentHandler.ts
├── utils/
│   ├── tax.ts
│   └── shipping.ts
└── types/
    ├── checkout.ts
    └── fulfillment.ts
```

```
After — conceptual organization
src/
├── ecommerce/
│   ├── index.ts                 # Public interface
│   ├── checkout.ts              # Implementation
│   ├── monitor.ts               # Monitoring logic
│   ├── types.ts                 # Domain types
│   └── utils/                   # Ecommerce-specific utilities
│       ├── tax.ts
│       └── shipping.ts
├── fulfillment/
│   ├── index.ts
│   ├── shipstation.ts
│   └── types.ts
└── monitoring/                  # Cross-cutting
    └── index.ts
```

**Anti-Pattern**: Creating `shared/` or `common/` directories that become dumping grounds for unrelated code. If code is shared between two domains, question whether those domains are properly separated.

**Cross-References**: [Pattern 0.1](#pattern-01--deep-modules) shows how deep modules reinforce conceptual organization. [L1: Stack Tests](L1-feedback-loops.md) demonstrates testing at domain boundaries.

---

## Pattern 0.4 — CLAUDE.md as Project Constitution

**Problem**: An agent entering a project needs to know: what is this, how is it structured, what must I never do, what patterns must I follow. Scattering this across READMEs, CONTRIBUTING files, and wiki pages forces the agent to hunt for rules it may violate before finding them.

**Solution**: CLAUDE.md is the single source of truth — a contract, not a tutorial. It answers the essential questions in one place. Hard limit: **150 lines maximum**. Beyond that, link to external docs.

**In Practice**:
```markdown
# Project — Agent Contract

## Project Description
One-sentence summary of what this project does.

## Repository Structure
Tree diagram showing major directories and their purposes.

## Constitutional Rules (Never Violate)
1. No mocking core system components
2. Evidence-based claims only
3. Zero-defect tolerance

## Level Documentation
- @docs/L0-foundation.md
- @docs/L1-feedback-loops.md
```

Every referenced doc must be reachable from CLAUDE.md — it serves as the master index. An agent discovers any project document by starting here and following `@filename.md` links.

**Anti-Pattern**: Writing tutorials or extensive guides in CLAUDE.md. Every line beyond 150 displaces context the agent needs for the actual task. Link to docs instead.

**Cross-References**: [Pattern 0.6](#pattern-06--ai-as-new-starter-standard) tests whether CLAUDE.md succeeds. [L4: Documentation as Contract](L4-culture.md) covers keeping docs in sync with code.

---

## Pattern 0.5 — Git Worktree-Based Development

**Problem**: Multiple agents working on the same codebase create conflicts. Switching branches leaves artifacts. Experiments risk the main branch. Context carries over between sessions, creating hidden state.

**Solution**: Use git worktrees as the default working model. Each task or feature branch gets its own working directory — sharing the same git object store but with separate working trees.

**In Practice**:

Worktree management can be manual, but is most effective when automated through agent skills. The [obra/superpowers](https://github.com/obra/superpowers) framework provides dedicated skills for worktree-driven workflows:

- **[using-git-worktrees](https://github.com/obra/superpowers)** — Automated worktree creation with smart directory selection and safety verification. Agents create isolated worktrees at the start of feature work without manual `git worktree` commands.
- **[brainstorming](https://github.com/obra/superpowers)** — Design and planning happens inside the worktree, so the brainstorming session's design artifacts are isolated from the main branch.
- **[writing-plans](https://github.com/obra/superpowers)** — Implementation plans are written and committed within the worktree. The plan becomes part of the feature branch's history.
- **[executing-plans](https://github.com/obra/superpowers)** — Task-by-task execution within the worktree, with review checkpoints between tasks. Completed work stays isolated until integration.
- **[finishing-a-development-branch](https://github.com/obra/superpowers)** — Handles integration decisions (merge, PR, cleanup) when work in the worktree is complete.

The workflow this enables:

```
Create worktree → Brainstorm design → Write plan → Execute tasks → Review → Integrate
     ↑              ↑                ↑             ↑              ↑          ↑
  automated     isolated to       committed     task-by-task   quality    merge/
  by skill      worktree          in worktree   with commits   gates      PR
```

```bash
# Manual equivalent (agents typically use the skill instead)
git worktree add .worktrees/feature-x feature-x
cd .worktrees/feature-x
# ... make changes, commit, test ...
git worktree remove .worktrees/feature-x
```

Benefits:
- **Parallel isolation**: Multiple agents on separate branches without conflict
- **Clean slate**: No leftover artifacts from previous sessions
- **Non-destructive**: Experiment without risking the main branch
- **Deterministic state**: Worktrees created from a known commit
- **Workflow integration**: Planning, execution, and review all happen within the isolated worktree context

Convention: `.worktrees/<branch-name>/` directory.

**Anti-Pattern**: Working directly on main for feature work. Agents should never modify main without explicit instruction.

**Cross-References**: [L2: Skills](L2-behavioral-guardrails.md) can enforce worktree usage via hooks. [L3: Optimization](L3-optimization.md) benefits from deterministic starting states. See [Further Reading](docs/references/further-reading.md) for the superpowers framework.

---

## Pattern 0.6 — AI-as-New-Starter Standard

**Problem**: Projects accumulate implicit knowledge. "Oh, we always put types in `src/types/`" or "utils files are in `shared/`" — assumptions never written down. Each assumption is a point where an agent will go wrong.

**Solution**: If someone with zero context cannot understand your project from CLAUDE.md + README + file structure alone, the project is not agentic-ready. Every assumption not codified in these entry points creates friction for AI agents.

**In Practice**:
- Test by asking: "Would a new developer understand this from README alone?"
- Put answers in CLAUDE.md, not tribal knowledge
- Let file structure tell the story
- Explicit conventions over implicit ones

**Anti-Pattern**: "They should just read the code." Code shows what exists, not why. AI agents need intent and structure, not just implementation.

**Cross-References**: [Pattern 0.4](#pattern-04--claude-md-as-project-constitution) specifies CLAUDE.md format. [L4: New Starter Standard](L4-culture.md) covers maintaining this over time.

---

## Related Patterns

- **L1: Feedback Loops** — Testing at module boundaries validates deep module design
- **L2: Behavioral Guardrails** — Skills enforce structural conventions during implementation
- **L3: Optimization** — Good structure reduces token overhead for navigation
- **L4: Culture** — Maintains what L0 establishes through rigor and cleanup

## Further Reading

- John Ousterhout, *A Philosophy of Software Design* — Deep modules concept
- Matt Pocock, "Your codebase is NOT ready for AI" — Graybox modules, progressive disclosure
- @docs/references/further-reading.md

---

**Next:** [L1: Feedback Loops — Closed-Loop Testing](L1-feedback-loops.md) | [Back to Overview](../README.md)
