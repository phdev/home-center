# Gstack Home Center Examples

Copy these examples into the relevant OpenClaw/gstack/Codex context and replace
placeholder host/path values.

These are agent-mode gstack commands/prompts, not repo-local shell commands,
unless gstack is installed and available in PATH. This repo does not currently
include a local `gstack` executable in PATH; the workflow is still valid through
OpenClaw/Codex orchestration.

## Local Codex + GitHub Sync

Start Codex inside the local Home Center clone on the Mac mini:

```bash
cd ~/home-center
git status --short --branch
git checkout main
git pull --ff-only
git checkout -b chore/gstack-openclaw-devon-david
codex
```

When changes are accepted, commit and push from the Mac mini. Other machines,
including the MacBook Pro, sync through GitHub pull. Do not use
machine-to-machine SSH for Codex work.

```bash
git status --short --branch
git add <files>
git commit -m "<clear message>"
git push origin <branch>
```

## Devon Examples

```text
Load gstack. Run /autoplan for the Home Center school updates QA workflow. Do not implement yet.
```

```text
Load gstack. Run /qa-only against the current branch. Focus on derived-state boundaries.
```

```text
Load gstack. Run /plan-eng-review for the bedtime reminder flow.
```

```text
Load gstack. Run /codex to generate a scoped implementation prompt for the current accepted plan.
```

```text
Load gstack. Run /retro after QA completes.
```

## David Examples

```text
Load gstack. Run /design-shotgun for the Home Center response page. Generate 3 alternatives but do not change logic.
```

```text
Load gstack. Run /design-html for the selected dashboard layout. Stay within frontend files.
```

```text
Load gstack. Run /design-review against the current Home Center UI.
```

## Pair-Agent Example

```text
Load gstack. Run /pair-agent so Devon can coordinate David on browser QA for the school updates card.
```

## Guard / Freeze Examples

```text
Load gstack. Run /guard before changing derived-state logic.
```

```text
Load gstack. Run /freeze before broad UI refactors or multi-file edits.
```

## Check Examples

Use existing repo commands:

```bash
npm test
npm run build
npm run agentci:gate
```

Do not install gstack automatically from this repo.
