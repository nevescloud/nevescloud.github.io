# nevescloud.github.io

Org landing site for **neves.cloud** (Cloudflare in front, GitHub Pages origin).

## Branches — source vs. published

- **`main`** = source of truth; edit here only. Authored files **plus** repo meta (`CLAUDE.md`, `README.md`, `.gitignore`, `deploy.sh`). Not served, so a stray commit never goes live.
- **`gh-pages`** = published output: `main`'s tracked tree minus `deploy.sh`'s `META` list. **Derived, never hand-edited** — so the branches can't drift.

No build step: files served verbatim (`index.html` fetches `data/projects.json` at runtime).

## Deploy

```sh
./deploy.sh        # publishes main → gh-pages (commit main first)
```

Repopulates the `.worktree/gh-pages` worktree from `main`'s tracked tree, drops the meta files, commits + pushes `gh-pages`. The commit message records the source `main` SHA, tying every snapshot back to its source.

- **Worktree:** `.worktree/gh-pages` (gitignored, local-only). Fresh clone → `deploy.sh` creates it, or `git worktree add .worktree/gh-pages gh-pages`.
- **Pages config** (`gh api repos/nevescloud/nevescloud.github.io/pages`): source `gh-pages:/`, cname `neves.cloud`.

Mirrors the `me` repo's gh-pages-worktree deploy (publish from `gh-pages`, never `main`).
