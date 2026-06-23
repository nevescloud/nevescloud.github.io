# nevescloud.github.io

Org landing site for **neves.cloud** (Cloudflare in front, GitHub Pages origin).

## Branches — source vs. published

- **`main`** = source of truth. Authored files **plus** repo meta (`CLAUDE.md`, `README.md`, `.gitignore`, `deploy.sh`). You only ever edit here. `main` is **not** served, so a stray file committed here never goes live.
- **`gh-pages`** = published output. The files the site actually serves, *minus* the meta above. **Derived, never hand-edited** — so the two branches can't drift.

There is no build step: files are served verbatim (`index.html` fetches `data/projects.json` at runtime). `gh-pages` is `main`'s tracked tree minus `deploy.sh`'s `META` list.

## Deploy

```sh
./deploy.sh        # publishes main → gh-pages (commit main first)
```

It wipes and repopulates the `.worktree/gh-pages` worktree from `main`'s tracked tree, drops the meta files, and commits + pushes `gh-pages`. The commit message records the source `main` SHA, so every published snapshot ties back to its source.

- **Worktree:** `.worktree/gh-pages` (gitignored, local-only). Fresh clone → `deploy.sh` creates it, or `git worktree add .worktree/gh-pages gh-pages`.
- **Pages config** (`gh api repos/nevescloud/nevescloud.github.io/pages`): source `gh-pages:/`, cname `neves.cloud`.

Mirrors the `me` repo's gh-pages-worktree deploy (publish from `gh-pages`, never `main`).
