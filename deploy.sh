#!/usr/bin/env bash
# Publish the served site from `main` to the `gh-pages` branch.
#
# Source of truth is `main`. `gh-pages` is a DERIVED subset — the files the
# site actually serves, minus repo meta. Never hand-edit `gh-pages`; run this.
# The worktree lives at .worktree/gh-pages (gitignored, local-only).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WT="$ROOT/.worktree/gh-pages"

# meta files that live on `main` only and must not be published
META=(README.md CLAUDE.md .gitignore deploy.sh)

cd "$ROOT"
git diff --quiet && git diff --cached --quiet || { echo "main has uncommitted changes — commit first"; exit 1; }

[ -d "$WT" ] || git worktree add "$WT" gh-pages
SRC="$(git rev-parse --short main)"

# wipe tracked content (keep .git), then repopulate from main's tracked tree
git -C "$WT" rm -rfq --ignore-unmatch . >/dev/null 2>&1 || true
git archive main | tar -x -C "$WT"
for f in "${META[@]}"; do rm -f "$WT/$f"; done

git -C "$WT" add -A
# `**/.*` in the global gitignore makes `add -A` skip dotfiles; .nojekyll must ship
[ -f "$WT/.nojekyll" ] && git -C "$WT" add -f .nojekyll
if git -C "$WT" diff --cached --quiet; then
  echo "gh-pages already matches main ($SRC) — nothing to publish"
  exit 0
fi
git -C "$WT" commit -q -m "Publish $SRC"
git -C "$WT" push -q origin gh-pages
echo "published main@$SRC → gh-pages (neves.cloud)"
