// In-page operator panel for neves.cloud. Replaces the iframe-via-/dashboard
// pattern: when the visitor is authenticated as the owner, this module
// hosts the pair-request lobby for visitors and brokers Claude through
// ai-bridge — same surface the standalone dashboard offered, just rendered
// in a slide-out drawer on the landing page itself.
//
// Lazy-loaded: index.html only imports this when body.owner is set, so
// public visitors don't pay the bytes.

import { host as transportHost } from 'https://cdn.jsdelivr.net/npm/@nevescloud/stoa@0.1.0/src/index.js';
import { envelopeToolSchema, routerSystemPrompt, validate as validateEnvelope }
  from 'https://cdn.jsdelivr.net/npm/@nevescloud/stoa@0.1.0/src/index.js';

const DEFAULT_BRIDGE_URL = 'http://localhost:7337';
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';

const CSS = `
#operator-panel {
  position: fixed;
  left: 0; top: 0; bottom: 0;
  width: min(420px, 100vw);
  background: color-mix(in srgb, var(--surface) 96%, transparent);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border-right: 1px solid var(--border-default);
  display: flex;
  flex-direction: column;
  z-index: 25;
  box-shadow: 10px 0 30px rgba(0,0,0,0.14);
  animation: op-slide 0.18s var(--ease, ease-out);
}
#operator-panel[hidden] { display: none; }
@keyframes op-slide {
  from { transform: translateX(-20px); opacity: 0; }
  to   { transform: translateX(0); opacity: 1; }
}
.op-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-default);
}
.op-header h2 { font-size: 14px; font-weight: 600; margin: 0; letter-spacing: 0.01em; }
.op-close {
  background: none;
  border: none;
  font-size: 22px;
  line-height: 1;
  color: var(--ink-muted);
  cursor: pointer;
  padding: 0 4px;
}
.op-close:hover { color: var(--ink); }
.op-status-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border-default);
  font-size: var(--t-caption, 12px);
}
.op-pill {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 100px;
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  border: 1px solid var(--border-default);
  color: var(--ink-muted);
}
.op-pill.ok  { color: #2f855a; border-color: color-mix(in srgb, #2f855a 35%, transparent); }
.op-pill.err { color: #c53030; border-color: color-mix(in srgb, #c53030 35%, transparent); }
.op-sessions {
  border-bottom: 1px solid var(--border-default);
  max-height: 32vh;
  overflow-y: auto;
}
.op-empty { font-size: 12px; color: var(--ink-muted); font-style: italic; padding: 12px 16px; margin: 0; }
.op-session {
  display: flex;
  flex-direction: column;
  width: 100%;
  text-align: left;
  background: none;
  border: none;
  padding: 10px 16px;
  cursor: pointer;
  border-left: 3px solid transparent;
  font: inherit;
  color: var(--ink);
  gap: 2px;
}
.op-session:hover { background: color-mix(in srgb, var(--ink) 5%, transparent); }
.op-session.selected { background: color-mix(in srgb, var(--accent) 10%, transparent); border-left-color: var(--accent); }
.op-session.closed { opacity: 0.6; }
.op-session.escalated { border-left-color: #c53030; }
.op-session-id {
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
}
.op-session-state {
  font-size: 10px;
  font-weight: 500;
  color: var(--ink-muted);
  background: color-mix(in srgb, var(--ink) 6%, transparent);
  padding: 1px 6px;
  border-radius: 3px;
}
.op-session-preview {
  font-size: 12px;
  color: var(--ink-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.op-timeline {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 12px 16px;
  min-height: 0;
}
.op-turn { padding: 8px 0; border-bottom: 1px solid var(--border-default); font-size: 12px; }
.op-turn:last-child { border-bottom: none; }
.op-turn-line { display: flex; gap: 6px; margin-bottom: 4px; align-items: baseline; }
.op-ts { color: var(--ink-muted); font-size: 11px; font-variant-numeric: tabular-nums; }
.op-arrow { font-family: ui-monospace, "SF Mono", Menlo, monospace; }
.op-msg { flex: 1; word-break: break-word; color: var(--ink); }
.op-envelope {
  margin: 4px 0 4px 22px;
  padding: 6px 10px;
  background: color-mix(in srgb, var(--ink) 4%, transparent);
  border-radius: 4px;
  font-size: 12px;
}
.op-intent {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-weight: 600;
  color: var(--ink-muted);
  margin-right: 6px;
}
.op-intent.greet    { color: var(--accent); }
.op-intent.answer   { color: #2f855a; }
.op-intent.decline  { color: #b7791f; }
.op-intent.escalate { color: #c53030; }
.op-citation {
  display: block;
  margin-top: 4px;
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 11px;
  color: var(--ink-muted);
}
.op-turn-err {
  margin-left: 22px;
  padding: 6px 10px;
  background: color-mix(in srgb, #c53030 12%, transparent);
  color: #c53030;
  border-radius: 4px;
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 11px;
}
.op-pending { margin-left: 22px; color: var(--ink-muted); font-style: italic; font-size: 12px; }
.op-intervene-row {
  display: flex;
  gap: 8px;
  padding: 10px 16px 14px;
  border-top: 1px solid var(--border-default);
  align-items: flex-end;
}
#op-intervene {
  flex: 1;
  font: inherit;
  font-size: 13px;
  padding: 6px 10px;
  background: var(--surface);
  border: 1px solid var(--border-default);
  border-radius: 4px;
  color: var(--ink);
  resize: none;
  min-height: 36px;
  max-height: 140px;
}
#op-intervene:focus { outline: 2px solid var(--accent); outline-offset: -1px; }
#op-intervene:disabled { opacity: 0.5; }
#op-intervene-send {
  font: inherit;
  font-size: 12px;
  padding: 6px 12px;
  background: var(--surface);
  border: 1px solid var(--border-default);
  border-radius: 4px;
  cursor: pointer;
  color: var(--ink);
}
#op-intervene-send:disabled { opacity: 0.5; cursor: not-allowed; }
@media (max-width: 600px) {
  #operator-panel { width: 100vw; }
}
`;

let stylesInjected = false;
function injectStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const el = document.createElement('style');
  el.textContent = CSS;
  document.head.appendChild(el);
}

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function mountOperatorPanel({
  siteId,
  getManifest,
  bridgeUrl = DEFAULT_BRIDGE_URL,
  model = DEFAULT_MODEL,
  operatorName = null,
  onStateChange = null,
} = {}) {
  if (!siteId) throw new Error('mountOperatorPanel: { siteId } is required');
  if (typeof getManifest !== 'function') throw new Error('mountOperatorPanel: { getManifest } must be a function');

  injectStyles();

  const state = {
    online: false,
    hostHandle: null,
    sessions: new Map(),
    selected: null,
    nextId: 1,
    bridgeOk: null,
  };

  const aside = document.createElement('aside');
  aside.id = 'operator-panel';
  aside.hidden = true;
  aside.innerHTML = `
    <header class="op-header">
      <h2>Operator</h2>
      <button class="op-close" aria-label="Close">&times;</button>
    </header>
    <div class="op-status-row">
      <span class="op-pill" data-role="online">offline</span>
      <span class="op-pill" data-role="bridge">ai-bridge ?</span>
    </div>
    <div class="op-sessions"></div>
    <div class="op-timeline"></div>
    <div class="op-intervene-row">
      <textarea id="op-intervene" placeholder="Reply directly (Cmd/Ctrl+Enter to send)" rows="2" disabled></textarea>
      <button id="op-intervene-send" disabled>Send</button>
    </div>
  `;
  document.body.appendChild(aside);

  const el = {
    panel: aside,
    online: aside.querySelector('[data-role="online"]'),
    bridge: aside.querySelector('[data-role="bridge"]'),
    close: aside.querySelector('.op-close'),
    sessions: aside.querySelector('.op-sessions'),
    timeline: aside.querySelector('.op-timeline'),
    intervene: aside.querySelector('#op-intervene'),
    interveneSend: aside.querySelector('#op-intervene-send'),
  };

  async function pingBridge() {
    try {
      const r = await fetch(bridgeUrl + '/v1/messages', {
        method: 'OPTIONS',
        headers: { 'access-control-request-method': 'POST' },
      });
      return r.ok || r.status === 204 || r.status === 405;
    } catch { return false; }
  }

  async function callClaude(message) {
    const manifest = getManifest() || {};
    const r = await fetch(bridgeUrl + '/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        system: routerSystemPrompt(manifest),
        tools: [envelopeToolSchema()],
        tool_choice: { type: 'tool', name: 'emit_envelope' },
        messages: [{ role: 'user', content: message }],
      }),
    });
    if (!r.ok) {
      const body = await r.text().catch(() => '');
      throw new Error(`ai-bridge ${r.status}: ${body.slice(0, 160)}`);
    }
    const data = await r.json();
    const tu = (data.content || []).find((b) => b.type === 'tool_use' && b.name === 'emit_envelope');
    if (!tu) throw new Error('Claude did not call emit_envelope');
    const v = validateEnvelope(tu.input);
    if (!v.ok) throw new Error(`malformed envelope: ${v.reason}`);
    return tu.input;
  }

  function attachSession(session) {
    const key = `s${state.nextId++}`;
    const rec = {
      key, session, turns: [], state: 'connected', escalated: false,
      operatorIntroSent: false, startedAt: Date.now(),
    };
    state.sessions.set(key, rec);
    if (state.selected == null) state.selected = key;

    const m = getManifest();
    if (m) {
      // Wait for the data channel to actually open before pushing the
      // manifest — sending before `ready` resolves silently drops the
      // frame because dc.readyState is still 'connecting'.
      session.ready.then(() => {
        try { session.send({ kind: 'manifest', manifest: m }); }
        catch (err) { console.warn('[operator]', key, 'manifest send threw', err); }
      }).catch((err) => console.warn('[operator]', key, 'session.ready rejected', err));
    }

    session.onClose(() => { rec.state = 'closed'; render(); });

    session.onMessage(async (msg) => {
      if (msg?.kind !== 'visitor-msg' || typeof msg.text !== 'string') return;
      const turn = { ts: Date.now(), visitorMsg: msg.text, envelope: null, error: null };
      rec.turns.push(turn);
      render();
      try {
        const env = await callClaude(msg.text);
        turn.envelope = env;
        session.send({ kind: 'envelope', envelope: env });
        if (env.intent === 'escalate') rec.escalated = true;
      } catch (err) {
        turn.error = err?.message || String(err);
        const fallback = { intent: 'decline', text: getManifest()?.decline || 'Something went wrong on my side — try again?' };
        try { session.send({ kind: 'envelope', envelope: fallback }); } catch {}
      }
      render();
    });

    render();
  }

  async function goOnline() {
    if (state.hostHandle) return;
    // Open the lobby first so we don't lose the pair-request race against
    // operators that came up earlier; ping ai-bridge in parallel and
    // update the pill when it resolves.
    state.hostHandle = transportHost({ siteId, lobbyNamespace: 'pip-relay' });
    state.hostHandle.onSession(attachSession);
    state.hostHandle.onError((err) => console.warn('[operator] transport error', err));
    state.online = true;
    if (onStateChange) { try { onStateChange({ online: true }); } catch {} }
    render();
    pingBridge().then((ok) => { state.bridgeOk = ok; render(); });
  }

  function goOffline() {
    if (!state.hostHandle) return;
    state.hostHandle.close();
    state.hostHandle = null;
    state.sessions.clear();
    state.selected = null;
    state.online = false;
    if (onStateChange) { try { onStateChange({ online: false }); } catch {} }
    render();
  }

  function sendIntervention() {
    const rec = state.selected ? state.sessions.get(state.selected) : null;
    if (!rec || rec.state !== 'connected') return;
    const text = el.intervene.value.trim();
    if (!text) return;

    // First operator turn in a session: prepend a one-line intro so the
    // visitor knows a human just took over (the rest of their stream up
    // to this point has been Claude). Skip if no operatorName configured.
    if (operatorName && !rec.operatorIntroSent) {
      const intro = { intent: 'answer', text: `\u{1F44B} ${operatorName} here.` };
      rec.turns.push({ ts: Date.now(), visitorMsg: intro.text, envelope: intro, error: null, source: 'operator' });
      try { rec.session.send({ kind: 'envelope', envelope: intro }); } catch {}
      rec.operatorIntroSent = true;
    }

    const env = { intent: 'answer', text };
    rec.turns.push({ ts: Date.now(), visitorMsg: text, envelope: env, error: null, source: 'operator' });
    try { rec.session.send({ kind: 'envelope', envelope: env }); } catch {}
    rec.escalated = false;
    el.intervene.value = '';
    render();
  }

  function renderSessions() {
    const sessions = [...state.sessions.values()];
    if (sessions.length === 0) {
      el.sessions.innerHTML = `<p class="op-empty">${state.online ? 'Waiting for a visitor…' : 'Go online to accept visitors.'}</p>`;
      return;
    }
    el.sessions.innerHTML = sessions.map((rec) => {
      const last = rec.turns[rec.turns.length - 1];
      const preview = last
        ? (last.envelope ? `↗ ${last.envelope.intent}: ${last.envelope.text || ''}` : `… ${last.visitorMsg}`)
        : '(connected)';
      const cls = ['op-session'];
      if (rec.key === state.selected) cls.push('selected');
      if (rec.state === 'closed') cls.push('closed');
      if (rec.escalated) cls.push('escalated');
      return `<button class="${cls.join(' ')}" data-key="${rec.key}">
        <span class="op-session-id">${rec.key}${rec.escalated ? ' !' : ''}<span class="op-session-state">${rec.state}</span></span>
        <span class="op-session-preview">${escHtml(preview)}</span>
      </button>`;
    }).join('');
    el.sessions.querySelectorAll('button[data-key]').forEach((btn) => {
      btn.addEventListener('click', () => { state.selected = btn.dataset.key; render(); });
    });
  }

  function renderTimeline() {
    const rec = state.selected ? state.sessions.get(state.selected) : null;
    if (!rec) {
      el.timeline.innerHTML = '<p class="op-empty">Select a session.</p>';
      return;
    }
    if (rec.turns.length === 0) {
      el.timeline.innerHTML = '<p class="op-empty">Connected. Waiting for a message…</p>';
      return;
    }
    el.timeline.innerHTML = rec.turns.map((t) => {
      const isOp = t.source === 'operator';
      const arrow = isOp ? '✋' : '↘';
      const head = `<div class="op-turn-line"><span class="op-ts">${fmtTime(t.ts)}</span><span class="op-arrow">${arrow}</span><span class="op-msg">${escHtml(t.visitorMsg || '')}</span></div>`;
      let body = '';
      if (t.error) {
        body = `<div class="op-turn-err">${escHtml(t.error)}</div>`;
      } else if (t.envelope) {
        const cit = t.envelope.citation
          ? `<span class="op-citation">${escHtml(t.envelope.citation)}</span>`
          : '';
        body = `<div class="op-envelope"><span class="op-intent ${escHtml(t.envelope.intent)}">${escHtml(t.envelope.intent)}</span>${escHtml(t.envelope.text || '')}${cit}</div>`;
      } else {
        body = '<div class="op-pending">…awaiting Claude</div>';
      }
      return `<div class="op-turn">${head}${body}</div>`;
    }).join('');
    el.timeline.scrollTop = el.timeline.scrollHeight;
  }

  function render() {
    el.online.textContent = state.online ? 'online' : 'offline';
    el.online.className = 'op-pill ' + (state.online ? 'ok' : '');
    el.bridge.textContent =
      state.bridgeOk === null ? 'ai-bridge ?'
      : state.bridgeOk ? 'ai-bridge ok'
      : 'ai-bridge missing';
    el.bridge.className = 'op-pill ' + (state.bridgeOk === null ? '' : state.bridgeOk ? 'ok' : 'err');

    renderSessions();
    renderTimeline();

    const rec = state.selected ? state.sessions.get(state.selected) : null;
    const canIntervene = !!rec && rec.state === 'connected';
    el.intervene.disabled = !canIntervene;
    el.interveneSend.disabled = !canIntervene;
  }

  el.close.addEventListener('click', () => { aside.hidden = true; });
  el.interveneSend.addEventListener('click', sendIntervention);
  el.intervene.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      sendIntervention();
    }
  });

  render();

  return {
    open() { aside.hidden = false; render(); },
    close() { aside.hidden = true; },
    isOpen: () => !aside.hidden,
    isOnline: () => state.online,
    goOnline,
    goOffline,
  };
}
