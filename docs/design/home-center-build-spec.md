# Home Center — Build Spec (MCP + Action/Knowledge Coverage)

Purpose: a portfolio-grade production-AI build. Optimize for a legible, well-evaluated,
well-orchestrated system over feature breadth. This spec is the buildable scope for the
MCP server, the Suggested Actions and Knowledge Query taxonomies, their coverage evals,
the Mac-mini benchmark, and a bounded privacy pass.

## Architecture principle (recap)

Deterministic core: `raw data -> normalized -> derived state -> UI cards`. Agents enhance
summaries and suggestions; they do not decide core behavior. Any change to Needs Action
card visibility or priority must pass `/plan-eng-review` and be modeled, tested,
documented, and approved before implementation.

## The trifecta this build completes

- Interface: an MCP server ("one home, many agent surfaces").
- Orchestration: the existing eval-driven tiered model router (`openclaw/router/`).
- Quality: the existing eval harness (`openclaw/eval/`), extended with coverage evals for
  the two taxonomies below.

## MCP Server

- "One home, many agent surfaces": expose Home Center capabilities as MCP tools so any
  agent (Claude Desktop, Claude Code, Cursor, the on-device family OpenClaw, a custom
  agent) can perceive and act on the house through one standard interface.
- Two layers, kept distinct:
  - Capability / HTTP layer (the Cloudflare Worker): what product frontends use (kiosk,
    voice, Telegram, a future mobile app).
  - MCP server: a thin wrapper re-exposing those capabilities as agent tools.
  - A plain mobile app talks to the HTTP API, not MCP. Only an agentic (LLM-powered) app
    consumes the MCP server.
- Tools (4-6, guarded): calendar read; today/household derived-state resource; set timer;
  TV on/off (CEC); knowledge query. Guard destructive actions. Document the auth/token
  flow; never commit a token.
- Reference integrations (first-class, ship 2 polished):
  1. Claude Desktop: copy-pasteable `claude_desktop_config.json` + walkthrough + gif.
  2. Minimal custom agent (~40 lines) running a multi-step task ("check today's calendar;
     if there's an early event, set a wake reminder and turn the TV on at 7").
  - Optional: Claude Code / Cursor config; a small tool-use eval (given a goal, did the
    agent call the right tools in the right order?).
  - Each integration = copy-paste config + "what you'll see" + screenshot/gif.

## Suggested Actions Taxonomy (v1)

Two object types + lifecycle: a Needs Action item (optionally carrying one Suggested
Action) with state machine `created -> advisory | accepted | declined -> completed |
dismissed | expired`. "Mark complete" is one transition.

Trigger categories: clock-time, elapsed-state, date/event, derived-dependency,
voice-initiated.

Guard levels: Advisory (suggest only), Auto (low-risk execute), Confirm (human-approve).
A second dimension, data egress / sensitivity, rides alongside each action (which actions
read external accounts, touch the kids' data, or leave the house) and is where the privacy
pass applies.

| # | Needs Action item | Trigger | Source | Guard | Suggested action | Eval focus |
|---|---|---|---|---|---|---|
| 1 | Birthday gift | Upcoming birthday | Household data (age, gender) | Advisory | Gift idea by age + gender | Age/gender-appropriate; no external egress |
| 2 | Lock In Dinner | 3+ days since last takeout | Your + Ali's email | Advisory | Restaurant not ordered recently | Positive food-order match minus grocery list; correct last-order detection |
| 3 | Mark complete | Voice | Internal state | Auto | (command, not a suggestion) | Fuzzy item-name match; correct state transition |
| 4 | Calendar conflict | A reschedule suggestion overlaps an event | Calendar | Confirm | Resolve the overlap | Conflict detection; never auto-move |
| 5 | Wake-up log | Morning / voice | Voice + state | Auto | Log wake time(s) | Parse 1-2 kids + times; feeds derived bedtime |
| 6 | Sync on bedtime | 4:45pm (home zone); screen on | Derived (wake + 13.5h) | Advisory | One combined announcement of both bedtimes | Per-child math; prompts for wake-up if missing |
| 7 | Clean up time | Earliest bedtime - 1h | Derived | none | none | Correct trigger from earliest bedtime |
| 8 | School lunch decision | 6pm (home zone); TV on | rbusd menu scrape | Advisory | Next-day menu + home/school choice | Correct next-day parse; non-school-day handling |

Decisions locked:
- A (two kids, one house): Cleanup fires at the earliest bedtime - 1h. Bedtime
  announcement is one combined message naming both times. Per-child bedtimes are still
  computed as derived state (wake + 13.5h, per child); the message merges them.
- B (missing input): If no wake-up is logged by 4:45pm, the "Sync on bedtime" item prompts
  for the wake times. Self-healing chain. Richest eval surface (missing-input degradation).
- C (sources): Facebook dropped. Gift suggestions from age + gender only. Takeout detection
  = the most recent positive food-order email minus an extensible grocery-merchant list
  (seeded with Ralph's, Sam's Club, Costco). A positive food-order matcher (delivery
  services + direct restaurant receipts) finds orders; the grocery list filters groceries
  out. Both are the eval's ground truth.
- D (time): Single IANA home timezone (`America/Los_Angeles`), never stored offsets or
  "PST/PDT" literals. All clock triggers and "tomorrow" resolve in the home zone via a
  DST-aware library (Luxon / Temporal / `zoneinfo`). "13.5h past wake-up" is a real elapsed
  duration. PST/PDT appear only as derived display labels. Include DST-transition-day test
  cases (spring-forward, fall-back).

Derived-state chain: `wake-up time -> per-child bedtime (wake + 13.5h) -> cleanup (earliest
bedtime - 1h) -> combined bedtime announcement`. Pure derived state, so these evals are
exact deterministic asserts (no LLM).

Coverage matrix: each row scored on {trigger fires at the right time/condition,
suggested-action content grounded/correct, guard level enforced, degrades gracefully when a
source/input is missing, voice intent parses}. Derived-state rows use deterministic asserts;
grounded rows (gift, restaurant, lunch) use an LLM-judge.

## Knowledge Query Types Taxonomy (v1)

Existing machinery: knowledge bridge (OpenAI -> local Gemma -> Anthropic), visual-contract
shapes (known / diagram / generated / no-image), reference-fidelity check, safety
HARD_SIGNALS. The taxonomy declares, per type, the routing tier, expected image shape, and
eval. Outside the supported types: degrade to a clean "I can't answer that."

| Type | Example | Expected image shape | Routing | Eval focus |
|---|---|---|---|---|
| Factual lookup | "Capital of France?" | no-image / known | local first | Correctness; source fidelity |
| Explanatory / educational | "Explain photosynthesis" | diagram | escalate | Accuracy |
| Visual identify | "What does a red panda look like?" | known (real image) | bridge w/ image source | Correct, safe real image |
| How-to / procedural | "How do I tie a tie?" | diagram / no-image | escalate | Step correctness |
| Local / contextual | "What's on our calendar tomorrow?" | no-image | deterministic derived state, NOT the knowledge model | Routes to data; no hallucination |
| Safety-sensitive | medical / medication | no-image + refer | opus / safety tier | Refuses or escalates correctly |
| Out-of-scope / unknown | adult, ambiguous, unanswerable | no-image | graceful | Safe refusal, no fabrication |

Decisions locked:
- A (audience): No per-asker or reading-level adaptation. A single default answer style
  (family-friendly general register; not tuned to who is asking).
- B (safety): Inappropriate, adult, and unsafe questions are refused. Safety-sensitive
  queries route to the safety/opus tier and refuse-or-refer. Documented refusal policy
  backed by the safety-expansion eval set.
- C (grounding): Ungrounded model answers acceptable for v1. The visual-contract still
  guards image shape and reference-fidelity still guards image sources; text answers are
  not required to cite.
- D (local/contextual boundary): Household questions route to deterministic derived state,
  never the knowledge model, so the system cannot hallucinate household facts. This boundary
  is itself an eval case.

Coverage matrix: each type scored on {correct routing tier, correct visual-contract image
shape, accurate/appropriate answer (LLM-judge), unsafe content refused, out-of-scope refused
gracefully}. Image-shape and routing are deterministic asserts; answer quality and safety use
judges + the safety-expansion set.

## Eval / coverage model

Extend `openclaw/eval/`. Coverage = percent of each taxonomy with passing evals, plus a
graceful-degradation case for the tail. Derived-state rows -> deterministic asserts; grounded
and answer-quality rows -> LLM-judge; safety -> safety-expansion set. The deliverable is a
measurable per-type coverage number, surfaced in an `eval:report` output.

## Open loops and build disposition

1. Drop the Mac mini (collapse toward Pi + Worker): a timeboxed profile-and-decide benchmark,
   not an open-ended port. Profile whether the Pi can run wake + transcription + a small local
   model within a latency budget; decide with data; document the finding (eliminated a tier, or
   the Pi can't hold the budget so the Mac mini earns its slot). Timebox it.
2. Voice robustness: bound to demo-proof for v1 (the demo path and common commands must work
   reliably). Full far-field / noisy-room / accent robustness is deferred.
3. Privacy pass: the data egress / sensitivity dimension of the action taxonomy, plus a bounded
   hardening pass (secrets, scopes, guards on agent actions). Not a standalone security audit.
4. Onboarding flow: deferred (a bounded one-command setup or hosted demo only if adoption
   matters later, not a full cross-household installer).

## Mac-mini elimination benchmark (methodology)

Profile the Pi for the wake + transcription + small-local-model path against a latency budget.
Build the benchmark harness, run it, and document the result either way. Note: `/benchmark`
(browse-perf) is not the right tool; this is a custom latency benchmark.

## Build sequence

1. MCP server (4-6 guarded tools over existing capabilities) + 2 reference integrations.
2. Coverage evals for both taxonomies (extend `openclaw/eval/`).
3. Mac-mini benchmark (profile-and-decide).
4. Bounded privacy pass (egress/sensitivity dimension).
5. Docs/legibility: README clearly presents the architecture, the eval-driven router decision,
   and the eval harness; surface an `eval:report`; architecture diagram; routed-vs-naive
   cost/latency table; generation latency breakdown.

## Success criteria (technical)

- A working MCP server with 2 documented reference integrations a stranger can run.
- Both taxonomies have coverage evals running in CI with a readable report.
- The eval-driven two-tier-simplification decision is visible in the README and a surfaced
  eval report, not buried in a code comment.
- A routed-vs-naive cost/latency table and a generation latency breakdown.
