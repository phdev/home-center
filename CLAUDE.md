# CLAUDE.md — Project Memory

## Git Workflow

- **Always push and merge into `main`** for every change.
- After completing work on a feature branch, merge it into `main` and push `main` to origin.
- GitHub Pages deploys automatically from `main` via GitHub Actions (`.github/workflows/deploy.yml`).

### Push & Merge Process (with PAT)

1. Commit changes on the `claude/` feature branch.
2. Push the feature branch to origin:
   ```
   git push -u origin claude/<branch-name>
   ```
3. Create a PR from the feature branch into `main` using `gh pr create`.
4. Merge the PR into `main` using `gh pr merge --merge --auto` (or `--squash`).
5. The remote uses a PAT-authenticated proxy. Direct pushes to `main` are **not allowed** — always merge via PR.
6. GitHub Pages deploys automatically once changes land on `main`.

### Retry Policy

- If push fails due to network errors, retry up to 4 times with exponential backoff (2s, 4s, 8s, 16s).

## Project Overview

- Vite-based project deployed to GitHub Pages.
- Build output goes to `./dist`.
- Node LTS with npm for dependency management.
