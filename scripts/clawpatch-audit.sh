#!/usr/bin/env bash
set -euo pipefail

limit="${CLAWPATCH_LIMIT:-5}"
package="${CLAWPATCH_PACKAGE:-clawpatch@0.1.0}"

node_major="$(node -p 'Number(process.versions.node.split(".")[0])')"
if [ "$node_major" -lt 22 ]; then
  echo "Clawpatch requires Node.js 22+. Current Node: $(node --version)" >&2
  exit 1
fi

if ! command -v codex >/dev/null 2>&1; then
  echo "Clawpatch requires the local Codex CLI on PATH; install or expose codex before running audits." >&2
  exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Working tree has uncommitted changes. Commit or stash before running Clawpatch audit." >&2
  exit 1
fi

echo "Running Clawpatch doctor..."
npx --yes "$package" doctor

echo "Mapping Home Center feature slices..."
npx --yes "$package" map

echo "Reviewing up to ${limit} feature slice(s)..."
npx --yes "$package" review --limit "$limit"

echo "Writing Clawpatch report..."
npx --yes "$package" report

echo "Done. Review generated local state under .clawpatch/."
