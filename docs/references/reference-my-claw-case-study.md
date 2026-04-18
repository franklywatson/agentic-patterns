# Reference my-claw Project — Design Rinsing in Practice

**Project:** my-claw — Multi-agent war room command center with voice, Telegram, and WebSocket interfaces

**Tech Stack:** Python 3.11+, Pipecat (real-time frame-processing pipeline), litellm (provider-agnostic LLM gateway), FastAPI, SQLite

**Scale:** 5-agent architecture with 3-tier routing, voice integration via Deepgram STT + Cartesia TTS, 278 unit tests + 11 integration tests + Docker stack tests + browser stack tests

This case study demonstrates design rinsing — the structured practice of extracting distilled architectural understanding from external sources and translating it into a project's design. The my-claw project evolved through three distinct rinsing phases, each building on the last. That compounding — where each rinsing phase leveraged and extended the previous — is itself an example of [compound engineering](https://github.com/EveryInc/compound-engineering-plugin): each unit of work making subsequent units easier.

---

## The Design Rinsing Lineage

![my-claw Design Rinsing Lineage](../diagrams/reference-my-claw-lineage.png)

### Phase 1: Transcript to Architecture

The genesis of my-claw was design rinsing a YouTube transcript into working architecture. Alex Krantz's UC Berkeley talk ["Principles for Autonomous System Design"](https://youtu.be/sxX8BMscce0) analyzes Open Claw's architecture and derives design principles for autonomous systems. The transcript was rinsed to extract the core concepts — not the specific code, but the architectural reasoning behind multi-agent coordination, dynamic tool discovery, and the matryoshka-doll model of nested autonomy loops.

**Condensed summary of the source material:** Krantz frames autonomous system design as progressing through phases of increasing "loopiness" — from single-token prediction, to multi-turn conversation, to scoped agents with static orchestration, to fully autonomous agents with dynamic tool discovery. Open Claw exemplifies this last phase: it owns its environment, can modify itself, and makes autonomous decisions about which tools to use. The key architectural insight is that all these systems boil down to LLM calls — the only difference is the context provided. A "harness" is fundamentally a package that bundles context and ensures the LLM has what it needs. The design goal for Open Claw: actual doing requires closing the control loop (viewing results of actions and deciding next actions) and navigating ambiguity without getting stuck. This framing — harness as context bundler, autonomy as closed-loop control, self-modification as the frontier — was the generative seed for my-claw's architecture.

**What was extracted:**

- Room-based agent coordination (the "war room" metaphor with specialist agents)
- Frame-processing pipeline as the communication substrate between agents
- Graduated autonomy (the matryoshka model translated into trust tiers)
- Harness as context bundler (agent system prompts bundle identity, skills, memory, project context)

**What was discarded:**

- Open Claw's specific implementation (TypeScript, Discord interface)
- Self-modification capabilities (too complex for initial version)
- The specific tool surface (my-claw needed different tools)

### Phase 2: Multi-Source Codebase Rinsing

With the core architecture established, the second phase rinsed two external codebases to evolve my-claw's agent design.

**Claw-Code (Rust)** — The [ultraworkers/claw-code](https://github.com/ultraworkers/claw-code) project is a Rust reimplementation of a multi-agent coding coordination system with three-part architecture: OmX (workflow layer), clawhip (event router), and OmO (multi-agent coordination with planning, handoffs, and verification loops). From claw-code, my-claw extracted:

- **Token-based routing**: Claw-Code's approach to routing work to the right agent via token scoring translated directly into my-claw's `RouterProcessor` with `responsibility_tokens` — each agent declares keywords describing its domain, and the router scores incoming requests against those tokens.

- **Multi-agent coordination**: Claw-Code's multi-agent system with role-based dispatch influenced my-claw's 5-agent architecture (Main, Comms, Content, Ops, Research) with the 3-tier router (broadcast → name prefix → token scoring → fallback).

- **Behavioral constitution**: Claw-Code's approach to constraining agents through directives influenced my-claw's `skills/` directory where behavioral guidelines are loaded into agent system prompts at runtime.

What was not copied: Claw-Code's Rust implementation, its Discord-driven coordination model, its 9-lane development approach, its mock parity harness. The extraction was at the pattern level — how to route, how to coordinate, how to constrain — not the implementation level.

**Andrej Karpathy's LLM Coding Principles (Markdown)** — The [andrej-karpathy-skills](https://github.com/forrestchang/andrej-karpathy-skills) project codifies Karpathy's observations about LLM coding pitfalls into four behavioral principles. My-claw adapted all four as runtime-injected agent skills:

| Karpathy Skill | my-claw Adaptation | Translation |
|---|---|---|
| Think Before Coding | `think-before-acting.md` | Extended with trust-tier awareness: applies especially at advisory/supervised tiers; at autonomous tier, act first but note reasoning |
| Simplicity First | `simplicity-first.md` | Nearly identical, trimmed for runtime context injection |
| Surgical Changes | `surgical-execution.md` | Nearly identical, trimmed for runtime context injection |
| Goal-Driven Execution | `goal-driven.md` | Nearly identical, trimmed for runtime context injection |

The key translation: Karpathy's principles were originally designed for a human steering an LLM coding assistant. In my-claw, they are injected into **autonomous agents' system prompts at runtime** — the agents self-regulate using these principles. The trust-tier addition in `think-before-acting.md` connects behavioral guidelines to my-claw's graduated autonomy system (advisory/supervised/autonomous), a my-claw-specific adaptation that the original Karpathy principles didn't need.

### Phase 3: Agentic Patterns Infusion

The third phase rinsed the agentic-patterns repository itself — both this documentation and the reference trading bot's codebase — to establish my-claw's development approach.

**From agentic-patterns docs:** L0-L4 patterns were rinsed to shape how my-claw structures its own development:

- **L0 Foundation**: CLAUDE.md as constitution (my-claw adopted a 398-line CLAUDE.md with constitutional mandates), deep modules (each agent is a self-contained module), progressive disclosure (docs/architecture.md for detailed design)

- **L1 Closed Loop Design**: Stack tests adopted directly — my-claw has 11 full-loop integration tests (ST1-ST11), Docker stack tests (ST-D1-ST-D10), and browser stack tests (ST-B1-ST-B8), all hitting real services with zero mocks

- **L2 Behavioral Guardrails**: Skills overlay pattern adopted — my-claw's `skills/` directory follows the same overlay architecture described in L2 Pattern 2.1

**From the trading bot reference project:** The stack test design was the primary extraction — StackTestUtils pattern, sequential test ordering, health endpoint test mode, test fixture bootstrapping. The specific testing infrastructure wasn't copied (different language, different framework) but the testing philosophy translated: real dependencies, full-loop assertions, sequential ordering, atomic user journeys.

---

## my-claw Architecture (Rinsed Design)

![Design Rinsing Convergence](../diagrams/reference-my-claw-convergence.png)

The resulting architecture shows clear lineage from each rinsing phase:

```
User Input (voice/text/telegram)
    ↓
[Transports: Browser WebSocket / Telegram Bot]
    ↓
RouterProcessor (3-tier: broadcast → @prefix → token scoring → fallback)    ← from claw-code
    ↓
[Agent x 5: main, comms, content, ops, research]                           ← from Krantz talk
    ↓                                                                         + behavioral skills from karpathy
ResponseMultiplexer → routes back to originating interface
    ↓
User receives response (+ audio via Cartesia TTS if enabled)
```

**Frame processing pipeline** (from Pipecat, conceptually rinsed from the Krantz talk's "harness as context bundler"):

```python
# Custom frames for inter-agent communication
@dataclass
class AgentTextFrame(TextFrame):
    target_agent: str = ""
    original_transcription: str = ""

@dataclass
class RoutingDecisionFrame(Frame):
    targets: list[str] = field(default_factory=list)
    method: str = ""  # "broadcast" | "prefix" | "auto" | "fallback"
```

**Token-based routing** (from claw-code):

```python
def route_text(text: str, agents: dict[str, str]) -> tuple[list[str], str]:
    # Tier 1: broadcast keywords
    if tokens & BROADCAST_KEYWORDS:
        return list(agents.keys()), "broadcast"
    # Tier 2: name prefix
    for prefix in AGENT_PREFIXES:
        if lower.startswith(prefix):
            return [prefix[1:]], "prefix"
    # Tier 3: token scoring (from claw-code's responsibility_tokens)
    for name, responsibility in agents.items():
        s = score_tokens(text, responsibility)
        if s > best_score:
            best_score = s
            best_agent = name
    # Fallback: main agent (triage)
    return ["main"], "fallback"
```

**Behavioral skills at runtime** (from karpathy-skills):

```python
# Skills are loaded into agent system prompts at runtime
def _build_messages(self, frame: AgentTextFrame) -> list[dict]:
    system_content = self._config.role_prompt
    # ... identity, user profile ...
    constitution = load_all_skills()  # All 4 karpathy-derived skills
    if constitution:
        system_content += f"\n\n---\n{constitution}"
    # ... project memory ...
    messages.append({"role": "system", "content": system_content})
```

**Graduated autonomy** (from Krantz talk's matryoshka model):

Trust tiers — advisory (requires approval), supervised (logs but proceeds), autonomous (no oversight) — with auto-promotion after consecutive successes and auto-demotion after failures. This translates the nested-loop autonomy model from the talk into a runtime enforcement mechanism.

---

## Testing (from Trading Bot + Agentic Patterns)

The testing infrastructure demonstrates rinsing at the practice level — the trading bot's stack test philosophy translated to Python:

| Trading Bot Pattern | my-claw Translation |
|---|---|
| StackTestUtils class | Per-test session management with real services |
| Sequential test ordering | ST1-ST11 ordered by dependency (startup → auth → routing → voice) |
| Real dependencies | Zero mocks in integration tests; real Deepgram, Cartesia, litellm APIs |
| Full-loop assertions | Tests verify entire user journeys, not individual functions |
| Docker stack tests | ST-D1-ST-D10 against Docker container |
| Browser stack tests | ST-B1-ST-B8 via Playwright against running container |
| Health endpoint test mode | Container readiness checks before domain tests |

---

## Cross-Level Integration

**How Phase 1 enables Phase 2:** The room-based architecture from the Krantz talk created the conceptual space where claw-code's multi-agent coordination patterns could be applied. Without the "war room" metaphor, token-based routing has no context.

**How Phase 2 enables Phase 3:** The behavioral skills from karpathy gave agents internal discipline, which made agentic-patterns' guardrail concepts applicable. Skills that agents self-regulate with map directly to L2's skill overlay pattern.

**How each phase compounds:** Phase 1 produced architecture. Phase 2 produced agent design that fits that architecture. Phase 3 produced development practices that sustain both. Each phase builds on the extracted patterns of the previous, not replacing them but extending — the definition of compound engineering applied to design rinsing.

---

## Key Takeaways

1. **Design rinsing extracts patterns, not code** — Every rinse produced adaptation, not copying. The Rust token-scoring system became Python token-scoring. The Karpathy human-LLM principles became autonomous agent self-regulation. The trading bot's JavaScript StackTestUtils became Python integration testing.

2. **Cross-domain sources produce novel combinations** — No single source produced my-claw's architecture. It emerged from rinsing a Berkeley talk, a Rust coding framework, a Markdown behavioral specification, a Node.js trading bot, and this pattern library. The combination is unique to my-claw; none of the sources resembles the result individually.

3. **Unstructured sources are valid rinse targets** — The YouTube transcript (Phase 1) was the most generative source, producing the core architectural metaphor. Codebases produce specific patterns; transcripts and talks produce mental models. Both are valuable.

4. **Translation is the critical step** — Extraction without translation is just reading. The trust-tier adaptation in `think-before-acting.md`, the Pipecat frame-processing implementation of the "harness as context bundler" concept, and the Python testing infrastructure adapted from JavaScript patterns — these translations are where the design value is created.

5. **Design rinsing compounds** — Each phase leveraged the previous phase's extracted patterns. This compounding effect means later rinsing phases produce more value because they build on a richer foundation.

---

## References

- [Alex Krantz — Principles for Autonomous System Design](https://youtu.be/sxX8BMscce0) — Phase 1 source: UC Berkeley talk analyzing Open Claw architecture
- [Claw-Code](https://github.com/ultraworkers/claw-code) — Phase 2 source: Rust multi-agent coordination system
- [Andrej Karpathy's LLM Coding Principles](https://github.com/forrestchang/andrej-karpathy-skills) — Phase 2 source: behavioral specification
- [Agentic Patterns](../L1-feedback-loops.md) — Phase 3 source: this repository
- [Reference Telegram Trading Bot Case Study](reference-telegram-trading-bot-case-study.md) — Phase 3 source: stack test design reference
- [Compound Engineering Plugin](https://github.com/EveryInc/compound-engineering-plugin) — Each rinsing phase compounds on the previous

---

**Previous:** [Reference Telegram Trading Bot Case Study](reference-telegram-trading-bot-case-study.md) | [Back to Overview](../../README.md)
