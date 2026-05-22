# Clawpatch Audit

Clawpatch is optional background review tooling for Home Center. Use it as a
bounded audit layer beside AgentCI and the existing Vitest suite, not as an
automatic fixer.

## Scope

The tracked config in `.clawpatch/config.json` focuses reviews on:

- `worker/` API and knowledge/image pipeline code
- `src/` dashboard state and UI integration
- `pi/` and `voice-service/` device/voice runtime code
- `openclaw/eval/` evaluator logic, excluding generated result archives
- `scripts/`, docs, and root package metadata

Generated Clawpatch state stays local via `.gitignore`; only the config is
tracked. This avoids committing transient maps, findings, reports, locks, and
patch attempts unless we intentionally promote a specific report later.

## Run

```bash
npm run audit:clawpatch
```

By default the wrapper reviews five feature slices:

```bash
CLAWPATCH_LIMIT=10 npm run audit:clawpatch
```

The wrapper requires a clean worktree, Node.js 22+, Git, and the local Codex CLI
expected by Clawpatch. It runs `doctor`, `map`, `review --limit`, and `report`.

## Fix Policy

Do not run broad automatic fixes. For now:

1. Run review/report only.
2. Inspect each finding manually.
3. Reproduce or validate with focused tests.
4. Fix in normal Home Center commits.
5. Use `clawpatch revalidate --finding <id>` only after a human-readable fix is
   already understood.

The configured validation command is:

```bash
npm test -- worker/src/index.test.js
```
