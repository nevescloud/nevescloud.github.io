// Same-origin auth shim for neves.cloud/{repo} projects.
//
// Centralizes GitHub auth on this origin (neves.cloud) so every sibling project
// reads from one shared localStorage entry instead of running its own flow.
// Storage shape matches pip-auth so this and pip-auth can co-exist on the same
// page without conflict.
//
// Auth mechanism: GitHub OAuth **Device Flow** (same as opal) — no redirect_uri,
// no callback surface, no client secret, so GitHub's "redirect_uri not associated"
// error class can't occur. GitHub's two device endpoints send no CORS headers,
// so they route through the proxy.neevs.io CORS shim (a pure passthrough that
// stores nothing); the token returns straight to this browser.
//
// - storage key:    '__neevs_auth'     (shape: { token, username, avatarUrl })
// - channel:        '__neevs_auth_v1'  (cross-tab + cross-project notifications)
// - device proxy:   'https://proxy.neevs.io'  (CORS shim for github.com/login/device/*)
//
// Consumers:
//   import { getSession, requireSession, signIn, signOut, onChange } from '/auth/lib.js';

const STORAGE_KEY = '__neevs_auth';
const CHANNEL_NAME = '__neevs_auth_v1';
const CLIENT_ID = 'Ov23li3dnFMUNHbu1SjZ';
const PROXY_BASE = 'https://proxy.neevs.io';
const GH_API = 'https://api.github.com';

const channel = ('BroadcastChannel' in self) ? new BroadcastChannel(CHANNEL_NAME) : null;

function readStored() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { return null; }
}

function writeStored(v) {
  if (v) localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
  else localStorage.removeItem(STORAGE_KEY);
  channel?.postMessage({ type: 'auth-change', session: v ?? null });
}

export async function getSession({ verify = true } = {}) {
  const stored = readStored();
  if (!stored?.token) return null;
  if (!verify) return stored;
  try {
    const r = await fetch(`${GH_API}/user`, {
      headers: { Authorization: `Bearer ${stored.token}`, Accept: 'application/vnd.github+json' },
    });
    if (r.status === 401) { writeStored(null); return null; }
    if (!r.ok) return null;
    return stored;
  } catch {
    return null;
  }
}

// GitHub OAuth Device Flow (mirrors opal/docs/device-auth.js). Contract is
// unchanged from the old popup flow: resolves { token, username, avatarUrl } and
// writes the shared session, or rejects with a human message on denial / timeout
// / cancel — so existing `await signIn()` callers need no change. `app` is kept
// for signature compat only (device flow carries no OAuth `state`).
export async function signIn({ scope = 'read:user', extraScopes = [], app = '' } = {}) {
  const fullScope = [...scope.split(/\s+/).filter(Boolean), ...extraScopes].join(' ');

  // 1) Ask GitHub (via the CORS shim) for a device + user code.
  const codeRes = await fetch(`${PROXY_BASE}/login/device/code`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, scope: fullScope }),
  });
  if (!codeRes.ok) throw new Error(`Device code request failed (${codeRes.status}).`);
  const cd = await codeRes.json();
  if (cd.error) throw new Error(cd.error_description || cd.error);

  // 2) Show the code so the user can authorize on github.com.
  let cancelled = false;
  const modal = showDeviceModal({
    userCode: cd.user_code,
    verificationUri: cd.verification_uri || 'https://github.com/login/device',
    verificationUriComplete: cd.verification_uri_complete,
    onCancel: () => { cancelled = true; },
  });

  // 3) Poll for the token until the user authorizes or the code expires.
  try {
    let intervalMs = ((cd.interval || 5) + 1) * 1000;
    const deadline = Date.now() + (cd.expires_in || 900) * 1000;
    while (Date.now() < deadline) {
      if (cancelled) throw new Error('Sign-in cancelled.');
      await new Promise((r) => setTimeout(r, intervalMs));
      if (cancelled) throw new Error('Sign-in cancelled.');

      // A transient non-JSON / 5xx tick must not abort the poll — skip and retry
      // until the deadline; only GitHub's explicit error codes terminate.
      let data;
      try {
        const tr = await fetch(`${PROXY_BASE}/login/oauth/access_token`, {
          method: 'POST',
          headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: CLIENT_ID,
            device_code: cd.device_code,
            grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          }),
        });
        if (!tr.ok) continue;
        data = await tr.json();
      } catch { continue; }

      if (data.access_token) {
        const session = await sessionFromToken(data.access_token);
        writeStored(session);
        return session;
      }
      if (data.error === 'authorization_pending') continue;
      if (data.error === 'slow_down') { intervalMs += 5000; continue; }
      throw new Error(data.error_description || data.error || 'Device authorization failed.');
    }
    throw new Error('Sign-in timed out — the code expired.');
  } finally {
    modal.close();
  }
}

// api.github.com sends CORS, so the identity read is direct (no proxy). Retry a
// few times so a transient /user blip doesn't surface as a hard sign-in failure.
async function sessionFromToken(token) {
  let lastErr = null;
  for (let i = 0; i < 3; i++) {
    try {
      const u = await fetch(`${GH_API}/user`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
      });
      if (u.ok) {
        const me = await u.json();
        return { token, username: me.login, avatarUrl: me.avatar_url };
      }
      lastErr = new Error('GitHub /user ' + u.status);
    } catch (e) { lastErr = e; }
    if (i < 2) await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('Signed in, but couldn’t read your GitHub profile — ' + (lastErr?.message || 'try again') + '.');
}

// Self-contained device-code modal — no external CSS, so the shim stays drop-in
// for any consumer page. Returns { close }.
function showDeviceModal({ userCode, verificationUri, verificationUriComplete, onCancel }) {
  const verifyUrl = verificationUriComplete || verificationUri;
  const root = document.createElement('div');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'Sign in to neves.cloud');
  root.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.6);font-family:system-ui,-apple-system,sans-serif';
  root.innerHTML = `
    <div style="background:#0d1117;color:#e6edf3;border:1px solid #30363d;border-radius:12px;padding:28px;max-width:360px;width:90%;text-align:center;box-shadow:0 12px 40px rgba(0,0,0,.5)">
      <div style="font-size:15px;font-weight:600;margin-bottom:4px">Sign in to neves.cloud</div>
      <div style="font-size:13px;color:#8b949e;margin-bottom:18px">Enter this code on GitHub to authorize.</div>
      <div data-code style="font:600 26px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:3px;background:#161b22;border:1px solid #30363d;border-radius:8px;padding:14px;margin-bottom:18px;cursor:pointer" title="Click to copy">${userCode}</div>
      <a data-open href="${verifyUrl}" target="_blank" rel="noopener" style="display:block;background:#238636;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:11px;border-radius:8px;margin-bottom:10px">Open GitHub &amp; authorize</a>
      <div data-status style="font-size:12px;color:#8b949e;min-height:16px">Waiting for authorization…</div>
      <button data-cancel style="margin-top:12px;background:none;border:none;color:#8b949e;font-size:13px;cursor:pointer;text-decoration:underline">Cancel</button>
    </div>`;
  root.querySelector('[data-code]').addEventListener('click', () => {
    navigator.clipboard?.writeText(userCode).then(() => {
      root.querySelector('[data-status]').textContent = 'Code copied. Waiting for authorization…';
    }).catch(() => {});
  });
  root.querySelector('[data-cancel]').addEventListener('click', () => onCancel?.());
  root.addEventListener('click', (e) => { if (e.target === root) onCancel?.(); });
  document.body.appendChild(root);
  return { close: () => root.remove() };
}

export function signOut() {
  writeStored(null);
}

// Fires once synchronously with the current (unverified) session, then on
// every change until the returned unsubscribe is called.
export function onChange(fn) {
  let unsubbed = false;
  try { fn(readStored() ?? null); } catch {}

  if (channel) {
    const onMsg = (e) => {
      if (unsubbed || e.data?.type !== 'auth-change') return;
      try { fn(e.data.session); } catch {}
    };
    channel.addEventListener('message', onMsg);
    return () => { unsubbed = true; channel.removeEventListener('message', onMsg); };
  }

  // Fallback: 'storage' events fire in OTHER same-origin tabs on writes.
  const onStorage = (e) => {
    if (unsubbed || e.key !== STORAGE_KEY) return;
    try { fn(readStored() ?? null); } catch {}
  };
  window.addEventListener('storage', onStorage);
  return () => { unsubbed = true; window.removeEventListener('storage', onStorage); };
}

// Redirects to /auth/?returnTo=<current-url> if no session. Returns a
// never-resolving Promise on redirect so `await requireSession()` callers
// don't keep executing past the navigation.
export async function requireSession({ returnTo } = {}) {
  const session = await getSession();
  if (session) return session;
  const target = returnTo || location.href;
  location.replace('/auth/?returnTo=' + encodeURIComponent(target));
  return new Promise(() => {});
}

// Opt-in: caches /auth/lib.js + /auth/index.html for offline resilience.
// Scope is narrowed to /auth/ so it can't conflict with any root-scope
// worker, current or future.
export async function registerSW() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/auth/sw.js', { scope: '/auth/' });
  } catch (err) {
    console.warn('auth SW register failed:', err);
    return null;
  }
}
