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

The Telegram bot + chat ID are **independent of the OpenClaw family-bot
credentials**. Use a different bot (or the same bot with a different
chat — e.g. a personal DM) so design pings don't land in the family
group.

## Daily generation

```bash
OPENAI_API_KEY=sk-... python scripts/run_daily_design_claw.py
# or
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

## Telegram delivery

```bash
TELEGRAM_BOT_TOKEN=... TELEGRAM_CHAT_ID=... python scripts/send_telegram_digest.py
# or
make design-send
```

Reads the most recent daily JSON (via `.last_daily.json`, falling back
to the newest file in `design_outputs/daily/`), builds a plain-text
digest (~1 Telegram message), and POSTs to
`/bot<token>/sendMessage`. `--dry-run` prints the digest without
sending.

## Combined run

```bash
python scripts/run_daily_design_and_send.py
```

Runs daily generation then Telegram delivery in one process. This is
the single command you'd schedule.

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

## Scheduling (later, optional)

No scheduler is installed. An example launchd plist sits at
`docs/examples/com.homecenter.design-claw.plist` — **this file is
documentation only**. To wire it up on a Mac Mini later:

1. Render the env vars (the plist uses `__OPENAI_API_KEY__` /
   `__TELEGRAM_BOT_TOKEN__` / `__TELEGRAM_CHAT_ID__` placeholders).
2. Render the working-directory path (`__REPO_DIR__`).
3. Copy the rendered file to `~/Library/LaunchAgents/`.
4. `launchctl load ~/Library/LaunchAgents/com.homecenter.design-claw.plist`.

The plist runs `scripts/run_daily_design_and_send.py` once a day at
08:15 local. Change the `StartCalendarInterval` block if you want a
different time.

## File map

| Path | Purpose |
|---|---|
| `claws/design_daily.md` | Prompt — one concept per day |
| `claws/design_feedback_parser.md` | Prompt — normalize feedback to JSON |
| `claws/design_review.md` | Prompt — weekly synthesis |
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
| `docs/examples/com.homecenter.design-claw.plist` | Template launchd job (not installed) |

## Editing memory by hand

The memory files are plain JSON and meant to be edited. Open
`design_memory/principles.json` and change, add, or remove entries as
you see fit. The runner doesn't validate ids — just keep each item's
`text` field populated. Changes take effect on the next claw run.
