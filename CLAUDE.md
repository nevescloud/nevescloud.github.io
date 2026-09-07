# nevescloud.github.io

Apex redirect + legacy-path stubs for **neves.cloud** (Cloudflare in front, GitHub Pages origin).

Consolidated 2026-07-23: the apex no longer hosts a showcase — **jonasneves.com is the single front door** (bio + selected work; `jonasneves/jonasneves.github.io`). neves.cloud remains a utility *namespace*: apps live on subdomains (`reader.`, `auth.`, `mcp.` — Cloudflare Workers/Pages, not this repo). This repo serves only:

- `index.html` — apex → jonasneves.com, with the e-ink UA branch kept intact (Kindle/Kobo/etc → `neves.cloud/reader`, Cloudflare-routed).
- `404.html` + `redirects.js` + `<slug>/index.html` stubs — legacy deep links forward to their current homes — cuko + wires to `jonasneves.com/<slug>/`. `/canvasflow/` **does** need its stub again: the project renamed to `nevescloud/kandue` on 2026-09-05, so `/canvasflow/*` falls through to here. **The stubs now point straight at `https://kandue.app/`** (the site moved there 2026-09-07): pointing them at `/kandue/` instead would send these users through a second redirect, and that hop currently lands on cleartext `http://`. Keep the stub and the map line — every extension build through 1.8.1 hard-codes `/canvasflow/uninstall.html`, and that URL only moves when an install auto-updates. Three deep paths get their own 200 stubs rather than riding `404.html`: `uninstall.html`, `feedback.html`, `privacy.html`. The fallback does redirect them, but it redirects *from a page that says "Not found"*, and these three are the uninstall exit form and the two URLs the live store listing still points at until its dashboard fields are repasted. Retire them once the listing moves and the 1.8.1 install base has aged out. Note `/kandue/*` is a *separate* and **non-retirable** redirect — 1.9.0 hard-codes it the way 1.8.1 hard-codes `/canvasflow/`, and unlike these stubs nothing can observe when the last install stops requesting it.
- `icon.svg` — the apex favicon, and therefore the mark **every `*.neves.cloud` MCP connector shows in Claude's connector list** (Claude resolves a connector's icon from the registrable domain, not its own subdomain). One file, all connectors, so a change here is never cosmetic. Shape constraints, the measured ink box, the 16px legibility floor, and the editing trap that fails silently are in the file's own comment — read it before touching the art. `icon-apple.png` is rendered from it and nothing references it; regenerate the two together or the touch icon silently keeps the retired mark, as it did from 2026-06-18 to 2026-09-05.

## Branches — source vs. published

- **`main`** = source of truth; edit here only. Authored files **plus** repo meta (`CLAUDE.md`, `README.md`, `.gitignore`, `deploy.sh`). Not served, so a stray commit never goes live.
- **`gh-pages`** = published output: `main`'s tracked tree minus `deploy.sh`'s `META` list. **Derived, never hand-edited** — so the branches can't drift.

No build step: files served verbatim.

## Deploy

```sh
./deploy.sh        # publishes main → gh-pages (commit main first)
```

Repopulates the `.worktree/gh-pages` worktree from `main`'s tracked tree, drops the meta files, commits + pushes `gh-pages`. The commit message records the source `main` SHA, tying every snapshot back to its source.

- **Worktree:** `.worktree/gh-pages` (gitignored, local-only). Fresh clone → `deploy.sh` creates it, or `git worktree add .worktree/gh-pages gh-pages`.
- **Pages config** (`gh api repos/nevescloud/nevescloud.github.io/pages`): source `gh-pages:/`, cname `neves.cloud`.

Mirrors the `me` repo's gh-pages-worktree deploy (publish from `gh-pages`, never `main`).
