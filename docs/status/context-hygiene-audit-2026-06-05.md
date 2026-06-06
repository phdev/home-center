# Context Hygiene Audit — 2026-06-05

## Commands

```sh
npx repomix --token-count-tree
npx @packmind/cli lint .
curl -X POST https://context-evaluator.ai/api/evaluate \
  -H 'Content-Type: application/json' \
  -d '{"repositoryUrl":"https://github.com/phdev/home-center","options":{"provider":"codex"}}'
```

Packmind CLI returned:

```text
No packmind.json config found. Run `packmind-cli install <some-package>` first to set up linting.
```

The public Context-Evaluator accepted the GitHub repo and completed job
`27affd2f-6965-496a-a793-209ed21404b3`.

## Repomix Findings

- Total packed context: 905,332 tokens across 473 files.
- Biggest files:
  1. `public/knowledge-assets/world-map-equirectangular.svg` — 158,766 tokens.
  2. `worker/src/index.js` — 51,871 tokens.
  3. `public/knowledge-assets/us-map-states.svg` — 42,562 tokens.
  4. `pi/wake_word_service.py` — 24,359 tokens.
  5. `voice-service/voice_service.py` — 24,261 tokens.
- Always-loaded context worth watching:
  - `CLAUDE.md` — 10,834 tokens.
  - `docs/` — 61,020 tokens.
  - `openclaw/eval/` — 39,089 tokens.

## Context-Evaluator Findings Addressed

- Added project-structure guidance to `school-updates/CLAUDE.md`.
- Added project-structure guidance to `openclaw/prompts/agents.md`.
- Replaced the concrete school-updates Worker URL with a placeholder.
- Added credential handling guidance for school-updates OAuth files.
- Replaced the concrete Pi gesture IP in `CLAUDE.md` with a placeholder.

## Local Drift Addressed

Local grep found stale derived-state guidance that Context-Evaluator did not
flag. Updated docs now agree that:

- New derived-state logic belongs in `src/core/derivations/`.
- `src/state/deriveState.js` is a compatibility export.
- New card selection belongs in `src/core/interventions/engine.js`.
- `src/ui/cards/*` is the target for engine-card renderers, while legacy
  `src/cards/*` wrappers remain during migration.
