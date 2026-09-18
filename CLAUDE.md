# nevescloud.github.io

Apex redirect + legacy-path stubs for **neves.cloud** (Cloudflare in front, GitHub Pages origin).

Consolidated 2026-07-23: the apex no longer hosts a showcase — **jonasneves.com is the single front door** (bio + selected work; `jonasneves/jonasneves.github.io`). neves.cloud remains a utility *namespace*: apps live on subdomains (`reader.`, `auth.`, `mcp.` — Cloudflare Workers/Pages, not this repo). This repo serves only:

- `index.html` — apex → jonasneves.com. **Unconditional, and script-free.** The e-ink UA branch that used to fork here (Kindle/Kobo/… → `neves.cloud/reader`) read to Safe Browsing as a conditional cross-domain redirect and flagged the whole domain *Deceptive pages* — measured 2026-09-17: Search Console `sc-domain:neves.cloud` 1 issue, **no sample URLs, no manual action** (so: automated classifier, nothing human to argue with), while `reader.neves.cloud`, `jonasneves.com` and `kandue.app` all came back clean, which is what pins the flag on the apex's own root. `/reader` had been answering **404 from its Cloudflare route** the entire time, so the branch served nobody. Do not reintroduce a user-agent branch here: e-ink readers use `reader.neves.cloud`, the address the reader's own setup screen gives out.
- `404.html` + `redirects.js` + `<slug>/index.html` stubs — legacy deep links forward to their current homes — cuko + wires to `jonasneves.com/<slug>/`. `/canvasflow/` **does** need its stub again: the project renamed to `nevescloud/kandue` on 2026-09-05, so `/canvasflow/*` falls through to here. **The stubs now point straight at `https://kandue.app/`** (the site moved there 2026-09-07): pointing them at `/kandue/` instead would send these users through a second redirect, and that hop currently lands on cleartext `http://`. Keep the stub and the map line — every extension build through 1.8.1 hard-codes `/canvasflow/uninstall.html`, and that URL only moves when an install auto-updates. Three deep paths get their own 200 stubs rather than riding `404.html`: `uninstall.html`, `feedback.html`, `privacy.html`. The fallback does redirect them, but it redirects *from a page that says "Not found"*, and these three are the uninstall exit form and the two URLs the live store listing still points at until its dashboard fields are repasted. Retire them once the listing moves and the 1.8.1 install base has aged out. `/kandue/*` is **non-retirable** — 1.9.0 hard-codes it the way 1.8.1 hard-codes `/canvasflow/`, and unlike these stubs nothing can observe when the last install stops requesting it. It now carries its own `index.html`/`uninstall.html`/`feedback.html` stubs plus a `redirects.js` line, and those are load-bearing, not tidiness: **without** them the path falls through to GitHub's own canonicalisation, because `nevescloud/kandue` is a project site on this same Pages host whose CNAME is `kandue.app` with `https_enforced: false` — so Pages answers 301 to **cleartext `http://kandue.app/…`**, and Cloudflare's Always Use HTTPS only bounces it back afterwards, one unencrypted request too late. Serving the path from here means it never reaches that canonicalisation. The three stubs are exactly the paths `kandue/scripts/check-urls.sh` lists as in-field; anything deeper rides `redirects.js`.
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
