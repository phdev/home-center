# Gstack Home Center Examples

Copy these examples into the relevant OpenClaw/gstack/Codex context and replace
placeholder host/path values.

These are agent-mode gstack commands/prompts, not repo-local shell commands,
unless gstack is installed and available in PATH. This repo does not currently
include a local `gstack` executable in PATH; the workflow is still valid through
OpenClaw/Codex orchestration.

## SSH / Codex

Start Codex inside the Home Center repo on the MacBook Pro:

```bash
ssh <macbook-pro-host>
cd ~/path/to/home-center
git status
git checkout main
git pull
git checkout -b chore/gstack-openclaw-devon-david
codex
```

Remote Codex launch from Devon on the Mac mini:

```bash
ssh <macbook-pro-host> 'cd ~/path/to/home-center && git status && codex'
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
