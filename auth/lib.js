// Same-origin auth shim for neves.cloud/{repo} projects.
//
// Centralizes the GitHub OAuth popup flow on this origin (neves.cloud) so
// every sibling project reads from one shared localStorage entry instead of
// running its own popup. Storage shape matches pip-auth so this and pip-auth
// can co-exist on the same page without conflict.
//
// - storage key:     '__neevs_auth'        (shape: { token, username, avatarUrl })
// - channel:         '__neevs_auth_v1'     (cross-tab + cross-project notifications)
// - callback origin: 'https://auth.neevs.io'  (where the GitHub OAuth app redirects)
//
// Consumers:
//   import { getSession, requireSession, signIn, signOut, onChange } from '/auth/lib.js';

const STORAGE_KEY = '__neevs_auth';
const CHANNEL_NAME = '__neevs_auth_v1';
const CLIENT_ID = 'Ov23li3dnFMUNHbu1SjZ';
const CALLBACK_ORIGIN = 'https://auth.neevs.io';
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

export async function signIn({ scope = 'read:user', extraScopes = [], app = '' } = {}) {
  const fullScope = [...scope.split(/\s+/).filter(Boolean), ...extraScopes].join(' ');
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', CLIENT_ID);
  url.searchParams.set('redirect_uri', CALLBACK_ORIGIN + '/');
  url.searchParams.set('state', app ? `${crypto.randomUUID()}|${app}` : crypto.randomUUID());
  url.searchParams.set('scope', fullScope);

  const w = 500, h = 600;
  const left = window.screenX + (window.innerWidth - w) / 2;
  const top = window.screenY + (window.innerHeight - h) / 2;

  return new Promise((resolve, reject) => {
    const popup = window.open(
      url.toString(), 'github-oauth',
      `width=${w},height=${h},left=${left},top=${top},popup=yes`,
    );
    if (!popup) { reject(new Error('Popup blocked. Allow popups for this site.')); return; }

    try { localStorage.removeItem('gh-auth-result'); } catch {}

    const cleanup = () => {
      clearInterval(poll);
      window.removeEventListener('message', onMsg);
    };
    const settle = (auth) => {
      cleanup();
      if (!auth) { reject(new Error('Authentication failed')); return; }
      const session = { token: auth.token, username: auth.login, avatarUrl: auth.avatar_url };
      writeStored(session);
      resolve(session);
    };
    const onMsg = (e) => {
      if (e.origin !== CALLBACK_ORIGIN) return;
      if (e.data?.type === 'gh-auth') settle(e.data.auth);
    };
    window.addEventListener('message', onMsg);

    // Safari nullifies window.opener on cross-origin redirect, so the popup's
    // postMessage doesn't reach us; auth.neevs.io also writes to
    // localStorage['gh-auth-result'] as a fallback that we poll for here.
    const poll = setInterval(() => {
      try {
        const stored = localStorage.getItem('gh-auth-result');
        if (stored) {
          localStorage.removeItem('gh-auth-result');
          settle(JSON.parse(stored).auth);
          return;
        }
        if (popup.closed) { cleanup(); reject(new Error('OAuth flow cancelled')); }
      } catch {
        cleanup(); reject(new Error('OAuth flow cancelled'));
      }
    }, 500);
  });
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
