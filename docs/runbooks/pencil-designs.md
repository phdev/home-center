# Pencil Designs Runbook

Home Center Pencil designs live in `~/Documents/home-center.pen`. Use the
Pencil MCP tools for `.pen` files; do not inspect the encrypted file directly.

## Required Workflow

When creating or modifying a Pencil design:

1. Update the live Pencil file through MCP.
2. Add the design to `src/TVPreview.jsx` in `PENCIL_PAGES` with `{ slug, label, nodeId }`.
3. Add the design to `scripts/update-pencil-screenshots.mjs` with matching `{ slug, nodeId }`.
4. Run `node scripts/update-pencil-screenshots.mjs` to refresh `public/pencil-screenshots/`.
5. If the design maps to a live page, add it to `LIVE_VIEWS` in `src/TVPreview.jsx`.
6. For TV dashboard or kiosk design requests, update Pencil first, then implementation, then build, deploy to the Pi, and verify the served bundle unless explicitly blocked.

Every Pencil design must be viewable in TV Preview at
`/home-center/tv-preview/` on the dev server.

## Current Designs

| Design | Node ID | Slug |
|---|---|---|
| Family TV Dashboard | `8pkH2` | `family-tv-dashboard` |
| Full Calendar Page | `85GSD` | `full-calendar-page` |
| Weekly Calendar Page | `ZPJSg` | `weekly-calendar-design` |
| Daily Calendar Page | `jRHG1` | `daily-calendar-design` |
| Full Weather Page | `VD32B` | `full-weather-page` |
| Full Photos Page | `ZOFqi` | `full-photos-page` |
| LLM Response Page | `dMUil` | `full-llm-response-page` |
| Knowledge Response Page | `J66tW4` | `full-knowledge-page` |
| History Page | `Tbtje` | `full-history-page` |
| Transcription Overlay | `DeP7G` | `transcription-overlay` |
| Voice Transcription Overlay | `Jf7Tx` | `voice-transcription-overlay` |
| OpenClaw UI Additions | `aMgUJ` | `openclaw-ui-additions` |

## Key Files

| File | Purpose |
|---|---|
| `src/TVPreview.jsx` | TV Preview page, `PENCIL_PAGES`, and `LIVE_VIEWS` |
| `scripts/update-pencil-screenshots.mjs` | Static screenshot generator |
| `public/pencil-screenshots/` | Generated PNGs served by TV Preview |
| `src/components/WakeOverlay.jsx` | Live transcription wake glow |
| `src/components/LiveCaption.jsx` | Live transcription caption pill |

The active Pencil MCP renderer can preview `Jf7Tx`, but the standalone
screenshot script may skip it if the saved `.pen` file does not expose that
node to the CLI MCP process.
