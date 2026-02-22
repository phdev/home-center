# CLAUDE.md — Project Memory

## Git Workflow

- **Always push and merge into `main`** for every change.
- After completing work on a feature branch, merge it into `main` and push `main` to origin.
- GitHub Pages deploys automatically from `main` via GitHub Actions (`.github/workflows/deploy.yml`).

### Push & Merge Process (with PAT)

1. Commit changes on the feature branch.
2. Switch to `main` and merge the feature branch:
   ```
   git checkout main
   git merge <feature-branch>
   ```
3. Push `main` to origin:
   ```
   git push origin main
   ```
4. The remote uses a PAT-authenticated proxy — pushes go through the local proxy at the configured origin URL. No extra auth steps needed beyond what's configured in the remote.

### Retry Policy

- If push fails due to network errors, retry up to 4 times with exponential backoff (2s, 4s, 8s, 16s).

## Project Overview

- Vite-based project deployed to GitHub Pages.
- Build output goes to `./dist`.
- Node LTS with npm for dependency management.
