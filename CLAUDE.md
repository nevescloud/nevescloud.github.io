# nevescloud.github.io

Org landing site for **neves.cloud** (Cloudflare in front, GitHub Pages origin).

## Deploy — published from `gh-pages`, never `main`

Pages source is the **`gh-pages`** orphan branch, not `main`. `main` holds the source and is **not** served — so a stray file committed to `main` does not go live. Publishing is an explicit act, not "anything under the served path is live the instant it lands on `main`" (that footgun is how raw notes once shipped at `/playground`).

- **Local checkout:** `.worktree/gh-pages` (gitignored). Fresh clone → `git worktree add .worktree/gh-pages gh-pages`.
- **Publish = write into the worktree, then commit + push from it:** `git -C .worktree/gh-pages add -A && git -C .worktree/gh-pages commit -m … && git -C .worktree/gh-pages push`.
- Pages config (`gh api repos/nevescloud/nevescloud.github.io/pages`): source `gh-pages:/`, cname `neves.cloud`.

Mirrors the `me` repo's gh-pages-worktree deploy.
