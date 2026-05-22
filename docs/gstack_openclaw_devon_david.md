# Gstack + OpenClaw Named Agents

This document describes a repo-local workflow for using gstack with OpenClaw
named agents Devon and David, with Codex as the execution harness for Home
Center repository work.

Gstack augments the existing Home Center rules. It does not replace
`AGENTS.md`, `CLAUDE.md`, `docs/README.md`, the gbrain docs, AgentCI, or any
Home Center product spec.

## Purpose

Use gstack to make multi-agent work explicit and reviewable:

- Devon can turn broad requests into plans, acceptance criteria, QA passes,
  eval plans, and scoped Codex prompts.
- David can explore visual directions, frontend polish, browser review, and UI
  implementation details.
- Codex can edit the repo, run checks, and prepare commits from a scoped task.
- Gstack provides repeatable command patterns for planning, design, review,
  QA, pair-agent coordination, and guard/freeze checkpoints.

The goal is practical coordination, not a new product runtime.

## Architecture Boundary

Home Center follows this non-negotiable flow:

```text
raw data -> derived state -> UI presentation
```

OpenClaw, gstack, Codex, Devon, and David may assist with planning, QA,
implementation, copy, summaries, explanations, design review, and frontend
polish. They must not decide whether a card appears, change card priority, or
bypass derived-state logic unless that behavior has first passed
`/plan-eng-review` and is explicitly modeled, tested, documented, and approved.

Agent output is optional. Home Center must still render the correct cards with
agent systems disabled.

## Roles

| Role | Responsibility |
| --- | --- |
| OpenClaw | Named-agent environment and conversational coordination layer. |
| gstack | Command workflow layer for plans, guardrails, handoffs, QA, and retros. |
| Devon | PM / QA / eval manager. Owns planning, acceptance criteria, branch readiness, QA summaries, and Codex task scoping. |
| David | Design / frontend implementation agent. Owns visual design, frontend polish, interaction quality, and UI implementation when scoped. |
| Codex | Repo-editing executor and harness. Edits files, runs checks, reports diffs. Codex is not the source of product decisions. |

Devon is not David. Devon may identify UX problems, UI risks, design-readiness
gaps, and architecture/product alignment issues, but Devon should not act as
the primary design exploration agent, generate speculative UI redesigns by
default, create unsolicited visual concepts, bypass David for meaningful
presentation exploration, or treat presentation ideas as approved behavior.
When meaningful visual exploration, kiosk UX refinement, or frontend
presentation work is needed, Devon should intentionally invoke David.

Devon may run on the Mac mini while the Home Center repo lives on a MacBook Pro
available over SSH. Keep tasks repo-local and copy-pasteable so Devon can run
Codex inside the checked-out repo wherever it lives.

## Branch Workflow

Prefer small branches from fresh `main`.

```bash
ssh <macbook-pro-host>
cd ~/path/to/home-center
git checkout main
git pull
git checkout -b chore/gstack-openclaw-devon-david
codex
```

Devon can also launch a remote repo-local Codex session from the Mac mini:

```bash
ssh <macbook-pro-host> 'cd ~/path/to/home-center && git status && codex'
```

Before editing:

```bash
git status --short --branch
```

If unrelated dirty work exists, stop and split or report it. Do not overwrite
local work. Keep generated artifacts separate from implementation commits.
Generated artifact runs must publish atomically: stage the full output set
first, then update visible paths, pointers, and logs only after the staged set is
coherent.

## Practical SSH + Codex Flow

1. Devon receives a task in OpenClaw.
2. Devon checks repo location and dirty state, locally or over SSH.
3. Devon uses gstack to create a plan, QA prompt, design request, or Codex
   prompt.
4. Codex runs in the repo checkout and performs scoped edits.
5. Devon reviews checks, acceptance criteria, and branch readiness.
6. David is pulled in intentionally for design/frontend tasks, meaningful
   presentation exploration, kiosk UX refinement, visual QA, or browser review.

Useful commands:

```bash
ssh <macbook-pro-host>
cd ~/path/to/home-center
git status --short --branch
npm test
npm run build
npm run agentci:gate
codex
```

## Practical Gstack Examples

Use these as natural-language gstack requests inside the agent environment:

These are agent-mode gstack commands/prompts, not repo-local shell commands,
unless gstack is installed and available in PATH. This repo does not currently
include a local `gstack` executable in PATH; the workflow is still valid through
OpenClaw/Codex orchestration.

```text
Load gstack. Run /autoplan for the Home Center school updates QA workflow. Do not implement yet.
```

```text
Load gstack. Run /qa-only against the current branch. Focus on derived-state boundaries.
```

```text
Load gstack. Run /codex to generate a scoped implementation prompt for the current accepted plan.
```

```text
Load gstack. Run /pair-agent so Devon can coordinate David on browser QA for the school updates card.
```

## Devon Commands

Use `/autoplan` when the request is broad, ambiguous, or multi-step and needs a
reviewable plan before implementation.

Use `/plan-eng-review` when a proposed approach touches architecture,
derived-state rules, AgentCI, or shared contracts and needs engineering review.
This review is mandatory before any David or Design Claw output becomes
deterministic card behavior, including visibility, priority, suppression,
ordering, fallback copy, reminder timing, or derived-state flags.

Use `/qa-only` when Devon should inspect a branch, run checks, review diffs,
and produce risks without changing code.

Use `/codex` when Devon needs a scoped implementation prompt for Codex as the
repo-editing executor.

Use `/retro` after QA or implementation to capture what happened, what broke,
what should be remembered, and what should change next time.

## David Commands

Use `/design-shotgun` for multiple visual directions or alternatives. It should
not change product logic.

Use `/design-html` for a selected frontend layout or mockup that stays within
frontend/design files and preserves card contracts.

Use `/design-review` for critique of the current UI against Home Center design
memory, visual hierarchy, responsive behavior, and contract fit.

Use `/browse` when David needs browser inspection or screenshots.

Use `/qa` when David is checking layout, interaction quality, clipping,
responsive behavior, or visual polish.

## Pair, Guard, And Freeze

Use `/pair-agent` when Devon needs to coordinate David on a defined design or
frontend QA slice. Devon owns task framing and acceptance criteria; David owns
design/frontend execution or critique.

Use `/guard` before changing derived-state logic, card selection, reminder
logic, policy boundaries, or any data-to-UI contract.

Use `/freeze` before broad UI refactors, multi-file edits, or risky work where
the branch needs an explicit checkpoint before more changes are allowed.

## Derived-State Guardrails

- Card visibility and priority come from deterministic derived state and card
  contracts, not agent output.
- UI components may improve presentation but must not decide whether a card
  appears.
- New card triggers require a derived-state flag, docs, tests, and acceptance.
- OpenClaw/gstack/Codex/Devon/David output can explain, summarize, or suggest
  after deterministic decisions exist.
- Design artifacts are source material, not approved deterministic behavior.
  A design can propose card ordering or suppression, but `/plan-eng-review`
  must accept the derived-state contract before Codex implements it.
- Any agent-generated decision logic must be modeled, tested, documented, and
  approved before it can affect product behavior.

## Branch Readiness Checklist

- Relevant docs read: `docs/README.md`, state model, derived states, card
  contracts, and agent contracts where applicable.
- Branch is separate from `main`.
- Acceptance criteria are written or confirmed.
- Tests/evals are identified.
- No UI card was introduced without derived-state backing.
- No agent output affects product decisions unless explicitly modeled and
  tested.
- Final QA summary is produced before merge.
