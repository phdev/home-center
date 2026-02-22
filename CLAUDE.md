# CLAUDE.md — Project Memory

## Git Workflow

- **Always push and merge into `main`** for every change.
- GitHub Pages deploys automatically from `main` via GitHub Actions (`.github/workflows/deploy.yml`).

### Push & Merge Process (Direct to Main via PAT)

Bypass pull requests entirely using two sequential pushes:

1. Commit changes on the `claude/` feature branch.
2. Push the feature branch to origin:
   ```
   git push -u origin claude/<branch-name>
   ```
3. Push the feature branch directly onto `main` via PAT-authenticated URL:
   ```
   git push https://x-access-token:<PAT>@github.com/phdev/accel-driv.git claude/<branch-name>:main
   ```
   - `x-access-token` is the username GitHub expects for PAT-based HTTPS auth.
   - The refspec `branch:main` fast-forwards `main` to the feature branch tip.
   - No PR, no merge commit, no review step.
   - GitHub Pages deploys immediately after push succeeds.

**PAT is stored outside the repo (never committed).** Use the token provided at session start.

### Retry Policy

- If push fails due to network errors, retry up to 4 times with exponential backoff (2s, 4s, 8s, 16s).

## Project Overview

- Vite-based project deployed to GitHub Pages.
- Build output goes to `./dist`.
- Node LTS with npm for dependency management.
