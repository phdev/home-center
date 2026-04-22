# Design Claw

A dedicated, lightweight "design claw" for Home Center. It generates one
UI concept per day, remembers what worked and what didn't, and delivers
a short digest to Telegram.

This evolves the earlier one-shot [Design Explorer](./design_explorer.md)
into a persistent, compounding workflow. The explorer still exists for
ad-hoc "give me three alternatives" runs; the daily claw is the
steady-state workflow.

## What this is

- **One concept per day.** Rotates through `design_inputs/daily_topics.json`,
  pulls in `design_inputs/dashboard.json` (or another screen snapshot),
  and asks `gpt-5.4-mini` for a single structured concept.
- **Persistent memory.** Principles, preferences, accepted patterns,
  rejected patterns, and open questions live as plain JSON in
  `design_memory/` and compound over time through feedback.
- **Feedback ingestion.** Natural-language feedback → structured update
  → merged into memory, with dedup and an append-only iteration log.
- **Telegram digest.** A short plain-text message (title, concept,
  why, tradeoff, prototype-first) sent via the Telegram Bot API. No
  webhook, no bot framework, no OpenClaw.
- **Weekly review.** Synthesizes the week's concepts + memory into a
  strategic review markdown.

## What this is not

- **Not runtime UI.** No Home Center codepath imports any of this. No
  component visibility depends on it.
- **Not OpenClaw.** Telegram delivery uses the Bot API directly via
  `urllib` — no dependency on the OpenClaw bridge, and no reuse of its
  chat IDs or token.
- **Not autonomous.** No daemon, no polling, no webhook server. Run it
  manually, or schedule `make design-daily && make design-send` with
  launchd.
- **Not a visual-design tool.** Colors, fonts, and microcopy are
  explicitly out of scope in the prompts.

## Environment variables

| Var | Used by | Required for |
|---|---|---|
| `OPENAI_API_KEY` | `run_daily_design_claw.py`, `parse_design_feedback.py`, `run_design_review.py`, `run_design_explorer.py` | any LLM call |
| `TELEGRAM_BOT_TOKEN` | `send_telegram_digest.py` | Telegram delivery |
| `TELEGRAM_CHAT_ID` | `send_telegram_digest.py` | Telegram delivery |
| `DESIGN_CLAW_MODEL` | all text LLM calls (via `_design_claw.MODEL`) | optional — defaults to `gpt-5.4-mini`. Set to try a newer model without editing code. |
| `DESIGN_CLAW_IMAGE_MODEL` | polish-pass image generation (`render_polish.py`) | optional — defaults to `gpt-image-1`. Set to swap the Images 2.0 model. |

The Telegram bot + chat ID are **independent of the OpenClaw family-bot
credentials**. Use a different bot (or the same bot with a different
chat — e.g. a personal DM) so design pings don't land in the family
group.

## Daily generation

```bash
OPENAI_API_KEY=sk-... python scripts/run_daily_design_claw.py
# or, with HTML + PNG mockup:
OPENAI_API_KEY=sk-... python scripts/run_daily_design_claw.py --render
# or, the full pipeline (scheduled launchd job uses this):
make design-daily
```

Flow:

1. Pick today's topic from `design_inputs/daily_topics.json`. Default
   rotation is deterministic: day-of-year modulo the topic list length.
   Override with `--topic-id <id>`.
2. Load the screen snapshot (`design_inputs/<screen>.json`, falling
   back to `dashboard.json`).
3. Load all of `design_memory/` and render a compact summary for the
   prompt.
4. Call the OpenAI Responses API with `claws/design_daily.md` + the
   three payloads.
5. Parse the fenced JSON concept. Save:
   - `design_outputs/daily/<date>-<screen>.md` (human-readable)
   - `design_outputs/daily/<date>-<screen>.json` (machine-readable)
   - `design_outputs/.last_daily.json` (state pointer for `send`)
   - an entry in `design_memory/iteration_log.jsonl`.
6. **If `--render` is passed** (default for `run_daily_design_and_send.py`):
   - A second Responses call with `claws/design_html_renderer.md` +
     the just-written JSON produces a high-fidelity HTML mockup.
   - Headless Chromium (Playwright) screenshots it at 1920×1080 to
     `design_outputs/daily/<date>-<screen>.png` (**structural** mockup).
   - Render failures log a warning but do not fail the daily.
7. **Polish pass** (runs after structural when `--render` is set and
   `--no-polish` is not):
   - `scripts/render_polish.py` calls OpenAI Images 2.0
     (`gpt-image-1` by default) via `images.edit`, passing the
     structural PNG as a reference so the polished output preserves
     the same regions/hierarchy.
   - Saves `design_outputs/daily/<date>-<screen>-polish.png`.
   - Polish failures log a warning. Telegram delivery gracefully falls
     back to the single-photo path when the polish PNG is missing.
8. **Telegram delivery** (`send_telegram_digest.py`):
   - Both images present → `sendMediaGroup` album of 2, caption on
     structural + full text digest as follow-up `sendMessage`.
   - Structural only → `sendPhoto` + `sendMessage`.
   - Neither → single `sendMessage` with the full digest.

## Telegram delivery

```bash
TELEGRAM_BOT_TOKEN=... TELEGRAM_CHAT_ID=... python scripts/send_telegram_digest.py
# or
make design-send
```

Reads the most recent daily JSON (via `.last_daily.json`, falling back
to the newest file in `design_outputs/daily/`), builds a plain-text
digest, and POSTs to `/bot<token>/sendMessage`. **If a matching
`<stem>.png` exists** (produced by `--render`), the sender switches
to `sendPhoto` with a shorter caption so the mockup lands as the
primary artifact. `--dry-run` prints what would be sent without
hitting Telegram.

## Combined run

```bash
python scripts/run_daily_design_and_send.py
```

Runs daily generation then Telegram delivery in one process. This is
the single command you'd schedule.

## Feedback via Telegram (listener)

After setup on the Mac Mini, **replying to David in Telegram is a valid
feedback channel**. A companion launchd job
(`com.homecenter.design-claw-listener`) polls `getUpdates` every five
minutes; when it sees new text messages from the configured chat it:

1. Batches them into one feedback blob (messages arriving within the
   same poll window get concatenated — so a burst of replies becomes
   one memory update, not five).
2. Passes the blob through `claws/design_feedback_parser.md` to get
   structured `accepted_patterns` / `rejected_patterns` /
   `principle_updates` / `preference_updates` / `open_questions`.
3. Merges via the same `update_design_memory.apply_update()` the CLI
   path uses — same dedup, same `iteration_log.jsonl` entry, tagged
   with `source: telegram`.
4. Acks with a one-line summary: `🪶 merged into memory: 1 accepted · 1 principle`.

Messages that start with `/start`, `/help`, `/ack` are ignored (common
Telegram noise). Messages from other chats are ignored for safety.
State (last processed `update_id`) sits at
`design_outputs/.last_telegram_update.json` — if you need a clean
slate, delete it.

## Feedback compounding

```bash
make design-feedback FEEDBACK="Avoid anything that feels like a productivity app"
# or
python scripts/parse_design_feedback.py --feedback "..." --apply
```

Flow:

1. `parse_design_feedback.py` calls the Responses API with
   `claws/design_feedback_parser.md` to normalize the feedback into a
   JSON object with keys `accepted_patterns`, `rejected_patterns`,
   `principle_updates`, `preference_updates`, `open_questions`.
2. `update_design_memory.py` merges the parsed JSON into the right
   files in `design_memory/`, deduping on case-insensitive trimmed
   text, assigning a stable id (slug of the text), and tagging
   `source: feedback` + `added: <today>`.
3. An entry is appended to `design_memory/iteration_log.jsonl`.

You can also pipe a pre-built JSON file straight into the merger:

```bash
python scripts/parse_design_feedback.py --feedback "..." --output /tmp/u.json
python scripts/update_design_memory.py --input /tmp/u.json
```

## Weekly review

```bash
make design-review
# or
python scripts/run_design_review.py --days 7
```

Concatenates the last week of daily markdown artifacts + the current
memory, asks for a strategic synthesis via `claws/design_review.md`,
and saves to `design_outputs/weekly/<date>-review.md`.

## Scheduling (Mac Mini)

The Design Claw is intended to run on the Mac Mini, next to the other
long-running Home Center services. Template + setup script live at:

- `deploy/mac-mini/com.homecenter.design-claw.plist` (template)
- `deploy/mac-mini/setup-design-claw.sh` (render + load)

On the Mac Mini, from a clone of this repo:

```bash
export OPENAI_API_KEY="sk-..."
export TELEGRAM_BOT_TOKEN="<design-bot token from @BotFather>"
export TELEGRAM_CHAT_ID="<your DM chat id>"
bash deploy/mac-mini/setup-design-claw.sh
```

The script installs the `openai` Python package, renders the plist
into `~/Library/LaunchAgents/` with `chmod 600`, and loads the agent.
Daily run fires at 08:15 local; change `StartCalendarInterval` if you
want a different time. `RunAtLoad` is false so installing the agent
doesn't fire an unwanted digest.

**Do not run the Design Claw on your laptop** — laptops sleep and lose
WiFi, so scheduled jobs silently skip. The Mac Mini is always on and
matches the pattern for the other services in this directory.

### Swapping models

Set `DESIGN_CLAW_MODEL` before re-running the setup script:

```bash
export DESIGN_CLAW_MODEL="<new-model-id>"
bash deploy/mac-mini/setup-design-claw.sh
```

The script renders the new model id into the plist's
`EnvironmentVariables` block and reloads the agent. Failure modes are
loud, not silent:

- **Unparseable JSON** or **missing required fields** (`concept_name`,
  `layout_idea`, `why_it_fits`, `tradeoff`, `prototype_first`) → daily
  runner exits 3 and saves raw output to
  `design_outputs/daily/<date>-{raw,schema}-error.txt`. `.last_daily`
  pointer is not updated, so `design-send` will not deliver stale data.
- **Render failure** (model doesn't return `<!doctype html>`) → logged
  as a warning; text concept still saves and Telegram falls back to
  text-only delivery.
- **Model deprecated / unavailable** → OpenAI API returns a clean
  error; the retry wrapper raises on the third attempt; launchd stderr
  gets a single line.

## File map

| Path | Purpose |
|---|---|
| `claws/design_daily.md` | Prompt — one concept per day |
| `claws/design_feedback_parser.md` | Prompt — normalize feedback to JSON |
| `claws/design_review.md` | Prompt — weekly synthesis |
| `claws/design_html_renderer.md` | Prompt — structural HTML mockup from a concept |
| `claws/design_polish_renderer.md` | Prompt — polish pass (Images 2.0) preserving structural regions |
| `scripts/render_concept.py` | Generate HTML + structural PNG for a daily artifact (`--render`) |
| `scripts/render_polish.py` | Generate `<stem>-polish.png` via Images 2.0, using the structural PNG as reference |
| `claws/design_explorer.md` / `design_critic.md` / `pattern_translator.md` | Preserved one-shot explorer prompts |
| `design_inputs/daily_topics.json` | Rotation of daily themes |
| `design_inputs/dashboard.json` | Screen-state snapshot |
| `design_memory/*.json` | Persistent memory (principles, preferences, patterns, questions) |
| `design_memory/iteration_log.jsonl` | Append-only log of claw activity |
| `design_outputs/daily/` | Daily artifacts (`.md` + `.json`) |
| `design_outputs/weekly/` | Weekly review artifacts |
| `design_outputs/.last_daily.json` | State pointer for Telegram send |
| `scripts/_design_claw.py` | Shared helpers (paths, client, memory IO) |
| `scripts/run_daily_design_claw.py` | Generate today's concept |
| `scripts/send_telegram_digest.py` | Send last concept to Telegram |
| `scripts/run_daily_design_and_send.py` | Combined daily + send |
| `scripts/parse_design_feedback.py` | Parse NL feedback → JSON (+ optional --apply) |
| `scripts/update_design_memory.py` | Merge parsed feedback into memory |
| `scripts/run_design_review.py` | Weekly synthesis |
| `scripts/run_design_explorer.py` | Preserved one-shot explorer |
| `deploy/mac-mini/com.homecenter.design-claw.plist` | launchd template — daily digest at 08:15 |
| `deploy/mac-mini/com.homecenter.design-claw-listener.plist` | launchd template — Telegram feedback poller (5 min cadence) |
| `deploy/mac-mini/setup-design-claw.sh` | One-shot setup on the Mac Mini (renders + loads both) |
| `scripts/design_listener.py` | The listener — pulls new DMs, parses, merges, acks |

## Editing memory by hand

The memory files are plain JSON and meant to be edited. Open
`design_memory/principles.json` and change, add, or remove entries as
you see fit. The runner doesn't validate ids — just keep each item's
`text` field populated. Changes take effect on the next claw run.
