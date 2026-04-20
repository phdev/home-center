# OpenClaw Prompts

Versioned prompts used by the OpenClaw Telegram bridge.

These are **product artifacts** — they encode how the family-facing bot
behaves — so they live in the repo, get reviewed in PRs, and are kept in
sync with the docs in `docs/`.

| File | Used by | Purpose |
|---|---|---|
| `persona.md` | Telegram bot | Voice, boundaries — the "who" of the assistant |
| `agents.md` | Telegram bot | Response rules, API contract pointer |
| `family-assistant.md` | Skill definition | What the assistant can answer, endpoints, examples |

## Editing rules

- Keep prompts concrete and short. Bullets beat paragraphs.
- Reference worker endpoints by path, never by URL — the bridge substitutes
  the URL from its environment.
- Do **not** put secrets, chat IDs, or machine-specific paths in these files.
- When you change behavior, note it in `docs/home_center_decisions_log.md`
  (see the Compound Step in `CLAUDE.md`).

## Why these are in the product repo

The family-facing bot persona is part of the Home Center product surface.
Developer-agent prompts (Homer CI, code-review agents, etc.) are **not** —
those live outside this repo. If you find a prompt here that only serves a
developer workflow, it's in the wrong place.
