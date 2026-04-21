# Design Explorer

An offline design-workflow tool for Home Center. Given a deterministic
snapshot of a screen's state, it asks an LLM to generate three
structurally-different UI alternatives, grounded in Home Center's design
principles.

> **Looking for the daily workflow?** The Design Explorer is the
> one-shot "give me three alternatives" tool. The steady-state workflow
> — one concept per day, persistent memory, Telegram digest — lives in
> [`docs/design_claw.md`](./design_claw.md).

## What this is

- A manual script you run when you want a second opinion on screen
  structure.
- Output is saved as a markdown artifact in `design_outputs/` that you
  read, cherry-pick from, and optionally critique.
- Input is a plain JSON snapshot of a screen's derived state and current
  structure, in `design_inputs/`.

## What this is not

- **Not runtime UI logic.** Nothing the dashboard fetches or renders.
  Cards still mount on deterministic derived-state flags exactly as
  today.
- **Not OpenClaw.** This does not go through the worker's
  `/api/claw/enhance`. It's a standalone developer tool that calls the
  OpenAI Responses API directly.
- **Not autonomous.** No loops, no background services, no cron. You
  run it when you want ideas.
- **Not a visual-design tool.** No colors, fonts, or styling output —
  structure, hierarchy, and interaction only.

## Setup

```bash
pip install openai
export OPENAI_API_KEY=sk-...
```

## Run it

```bash
python scripts/run_design_explorer.py
# or
make design-explore
```

Output lands at `design_outputs/dashboard-exploration-<timestamp>.md`.
The script prints the saved path and the full response.

## Workflow

1. **Update the snapshot.** Edit `design_inputs/dashboard.json` so the
   `derived_state` block and `current_structure` match the situation
   you want to redesign for (e.g. flip `takeoutDecisionPending` and
   `birthdayGiftNeeded` both to `true` to explore multi-flag behavior).
2. **Run the explorer.** `make design-explore` generates three
   alternatives.
3. **Read the output.** Each alternative comes with a layout concept,
   why it beats current structure, downsides, best-fit conditions, and
   implementation notes.
4. **Optionally run the critic.** `claws/design_critic.md` is a prompt
   you can run manually (against the explorer output) to pick a winner
   and synthesize a merged recommendation. There's no dedicated script
   for this yet — paste the prompt + explorer artifact into a chat.
5. **Implement the chosen direction.** Translate the picked structural
   idea into `src/App.jsx` + `src/cards/registry.js`. Derived-state
   flags still gate visibility; this tool only changes which flags map
   to which regions.

## File map

| Path | Purpose |
|---|---|
| `claws/design_explorer.md` | Prompt — three structural alternatives |
| `claws/design_critic.md` | Prompt — pick the best + synthesize |
| `claws/pattern_translator.md` | Prompt — translate an external pattern to Home Center |
| `design_inputs/dashboard.json` | Screen-state snapshot (edit freely) |
| `design_outputs/` | Saved markdown artifacts (gitkeep'd) |
| `scripts/run_design_explorer.py` | Runner — reads prompt + snapshot, calls OpenAI Responses API |
| `Makefile` | `make design-explore` |

## Model

Hardcoded to `gpt-5.4-mini` in `scripts/run_design_explorer.py`. If you
need a different model for an experiment, edit the `MODEL` constant —
don't thread a flag through the script. This is a workshop tool.
