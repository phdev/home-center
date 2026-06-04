# Bounded Privacy Pass: Action Taxonomy

Date: 2026-06-04
Scope: data-egress and sensitivity dimension for the Suggested Actions taxonomy
in `docs/design/home-center-build-spec.md`.

This is not a full security audit. It covers which action rows read external
accounts, touch kids' data, or create effects outside the browser/dashboard,
then checks whether the current guard model is appropriate.

## Executive Finding

The taxonomy is acceptable for the current portfolio build if the existing
Worker `AUTH_TOKEN` gate remains enabled in production and the action rows keep
their current advisory/auto/confirm split.

No new blocking implementation issue was found in this bounded pass. The main
privacy risk is not a missing destructive-action guard; it is over-broad source
visibility in read paths. `home_today` and the dashboard data APIs can aggregate
calendar, takeout, lunch, timers, and tasks, so they should be treated as
sensitive household-state reads even when they do not mutate anything.

## System Boundaries Reviewed

- Worker global bearer-token gate: `worker/src/index.js`.
- Needs Action completion: `worker/src/index.js` `handleNeedsActionDone`.
- Birthday source and gift overrides: CalDAV read plus KV override.
- Takeout suggestions and decisions: KV-backed records seeded by Gmail-derived
  restaurant extraction.
- School lunch menu and decisions: read-only menu KV plus per-child choice KV.
- MCP tools: `openclaw/mcp/home-center-client.js` and `openclaw/mcp/server.js`.
- Suggested Action rendering: `src/core/howie/actions.js`.

## Data-Egress / Sensitivity Matrix

| Row | Action | Reads External Accounts | Kids' Data | Leaves House / Shared-Device Effect | Guard Review |
| --- | --- | --- | --- | --- | --- |
| 1 | Birthday gift | CalDAV birthday source; LLM gift idea generation may receive recipient name/relation/days until birthday. | Possible child birthday if the birthday row is a child. | No automatic purchase or message. KV gift override only. | Advisory is correct. Do not add shopping, messaging, or ordering without Confirm. Keep gift prompts limited to recipient facts and constraints, not full household profile. |
| 2 | Lock In Dinner | Gmail-derived restaurant facts are upstream input; Worker stores bounded vendor names and recency metadata. | No direct kids' data in current row. | No external order is placed. Voice "done" marks a home/takeout decision in KV only. | Advisory is correct. The Gmail extraction job should continue storing only restaurant summary facts, not raw email bodies. |
| 3 | Mark complete | No new external read; operates on current Needs Action index. | Can mutate child-adjacent state when completing school/gift/lunch-adjacent items. | No message/order/device effect, but it changes household state shown to the family. | Auto is acceptable only for low-risk state transitions already surfaced as Needs Action. It must not be reused for calendar moves, purchases, external messages, or TV/device control. |
| 4 | Calendar conflict | Calendar read through CalDAV. | May expose family schedule and kid event titles. | Potential future reschedule would affect external calendar state. Current implementation summarizes/conflict-detects only. | Confirm is required and correct. Current "never auto-move" rule should remain a hard boundary. |
| 5 | Wake-up log | Voice transcript/local state; no external account required. | Directly stores kid wake times and feeds derived bedtime. | No external effect. | Auto is acceptable because it records a stated household fact, but transcript handling should stay normalized and should not persist raw audio. |
| 6 | Sync on bedtime | Derived from wake log and configured child bedtime settings. | Direct child schedule/bedtime data. | Dashboard announcement only. | Advisory is correct. No external egress is needed; LLM copy softening may receive child names/times, so keep prompt output constrained and non-retentive. |
| 7 | Clean up time | Derived from earliest bedtime. | Indirect child bedtime data. | Dashboard presentation only. | No guard needed while it remains derived presentation. If it becomes a timer/alarm or notification outside the dashboard, promote to Auto or Confirm based on channel. |
| 8 | School lunch decision | RBUSD menu scrape/KV read; no private external account for menu. | Per-child lunch choice stored in KV. | No external lunch order or school submission. | Advisory is correct. Keep menu ingestion read-only and local decision storage separate from any school-facing action. |

## MCP and Agent Surface Review

The MCP server exposes two relevant classes of capabilities:

- Read tools/resources: `calendar_read`, `home_today`, `knowledge_query`.
- Side-effect tools: `set_timer`, `tv_power`.

Review result:

- `tv_power` requires `confirm=true` in the MCP input schema and client before
  calling the Pi CEC endpoint. This is the right guard for a shared physical
  device.
- `set_timer` is side-effecting but bounded to local timer state with validated
  `name` and positive `totalSeconds`. It is acceptable without Confirm in the
  current guard model.
- `home_today` should be documented and treated as sensitive read access,
  because it aggregates household schedule/task/food state. It is read-only,
  but not privacy-neutral.
- Worker API auth is centralized: when `AUTH_TOKEN` is set, all paths except
  `/api/health` require `Authorization: Bearer <token>`. This is the key
  production control for both browser and MCP read surfaces.

## Bounded Findings

### Finding 1: `home_today` Is Sensitive Read Access

Severity: medium

The MCP resource/tool is read-only, but it aggregates calendar, timers, takeout,
school lunch, and task state. Any future integration guide should treat this as
household-sensitive access rather than a harmless status endpoint.

Disposition: documented here; no code change required in this sprint because
Worker bearer-token auth already gates it in production.

### Finding 2: Auto Completion Must Stay Narrow

Severity: medium

`Mark complete` can mutate school dismissals, gift status, and takeout decision
state. That is acceptable for the current taxonomy because it only completes
already-surfaced Needs Action rows. The same "Auto" path must not expand to
calendar edits, purchases, outbound messages, or device actions.

Disposition: taxonomy guard accepted; future action types need an explicit
guard review before joining `handleNeedsActionDone`.

### Finding 3: External-Account Inputs Should Stay Minimized

Severity: low

Birthday and calendar rows read CalDAV, while takeout suggestions are derived
from Gmail. Current stored takeout state is minimized to vendor/recency facts,
which is the right shape. Gift ideas currently use only recipient facts and
constraints, not external social accounts.

Disposition: accepted. Keep Gmail/CalDAV raw payloads out of Suggested Action
state and eval artifacts.

## Pre-Land Review

Reviewed against the requested bounded privacy dimensions:

- Reads external accounts: rows 1, 2, and 4. Row 8 reads a public/menu source.
- Touches kids' data: rows 1 when the birthday is a child, 5, 6, 7, and 8.
- Leaves the house or changes shared physical state: none of the taxonomy rows
  directly do this today; MCP `tv_power` is the relevant adjacent shared-device
  action and requires explicit confirmation.
- Destructive/external actions: no current taxonomy row purchases, sends email,
  posts messages, submits school forms, or moves calendar events.

Conclusion: no blocking privacy issue for the current scoped build. Carry
forward the `home_today` sensitive-read caveat and keep Confirm mandatory for
any future calendar write, purchase, external message, or shared-device action.
