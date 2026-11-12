/* MRK guest-session isolation. Guest demo data is tab-scoped and never synced to company snapshots. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MRKGuest = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const STATE_PREFIX = 'mrk-guest-state-v2:';
  const SESSION_KEY = 'mrk-guest-session-v2';
  const TEMP_PREFIX = 'mrk-guest-temp-v2:';
  const REDACT = /(^|_)(phone|mobile|email|address|national.?id|passport|password|passwd|token|secret|iban|sheba|card.?number|card.?no|bank.?account|account.?number|account.?no|acct|username|full.?name|party.?name|party|customer|supplier|person|employee|worker|beneficiary|recipient|contact|tax.?id|economic.?code|name|desc|description|memo|note|notes|comment|narrative|free.?text)(_|$)/i;
  const SAFE_AUDIT_KEYS = new Set(['document_no','invoice_no','reference_no','business_date','item_code','warehouse_code','field_key','action_key','page_key']);
  function scrubText(value) {
    return String(value).replace(/[۰-۹٠-٩]/g, ch => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(ch) >= 0 ? '۰۱۲۳۴۵۶۷۸۹'.indexOf(ch) : '٠١٢٣٤٥٦٧٨٩'.indexOf(ch))).replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[حذف ایمیل]').replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, '[حذف شماره]').replace(/\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/gi, '[حذف شناسه بانکی]');
  }

  function safeStorage(storage) {
    return storage && typeof storage.getItem === 'function' &&
      typeof storage.setItem === 'function' && typeof storage.removeItem === 'function'
      ? storage : null;
  }

  function readEntry(locationLike) {
    const search = String(locationLike && locationLike.search || '');
    const hash = String(locationLike && locationLike.hash || '').replace(/^#/, '');
    const params = new URLSearchParams(hash);
    const token = params.get('guest_session') || '';
    const isGuestEntry = !!token;
    const query = new URLSearchParams(search);
    query.delete('guest');
    const cleanSearch = query.toString();
    const cleanUrl = (locationLike && locationLike.pathname || '') + (cleanSearch ? '?' + cleanSearch : '');
    return {isGuestEntry, token, cleanUrl};
  }

  function sanitizeAuditDetail(value, depth = 0) {
    if (depth > 5) return '[عمق بیش از حد]';
    if (value == null || typeof value === 'boolean' || typeof value === 'number') return value;
    if (typeof value === 'string') return scrubText(value).slice(0, 180);
    if (Array.isArray(value)) return value.slice(0, 25).map(v => typeof v === 'string' ? '[متن آزاد حذف شد]' : sanitizeAuditDetail(v, depth + 1));
    if (typeof value !== 'object') return String(value).slice(0, 120);
    const out = {};
    for (const [key, val] of Object.entries(value).slice(0, 50)) {
      const normalized = key.replace(/[A-Z]/g, m => '_' + m).toLowerCase();
      if (REDACT.test(normalized)) out[key] = '[حذف اطلاعات هویتی]';
      else if (SAFE_AUDIT_KEYS.has(normalized) && typeof val === 'string') out[key] = val.replace(/[^\p{L}\p{N}._\/-]/gu, '').slice(0, 64);
      else out[key] = sanitizeAuditDetail(val, depth + 1);
    }
    let json = '';
    try { json = JSON.stringify(out); } catch { return {}; }
    if (json.length > 3200) return {summary: json.slice(0, 3000), truncated: true};
    return out;
  }

  function create(options = {}) {
    const sessionStorage = safeStorage(options.sessionStorage);
    // localStorage is deliberately never read or written by this module.
    let sessionId = String(options.sessionId || 'pending').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80) || 'pending';
    let stateKey = STATE_PREFIX + sessionId;
    const endpoint = String(options.endpoint || '');
    const publishableKey = String(options.publishableKey || '');
    const fetchImpl = options.fetchImpl || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
    let token = String(options.token || '');
    let stopped = false;
    let volatileState = null;

    // Guest business data stays in this browser tab's sessionStorage only.
    // It is never written to localStorage, IndexedDB, Supabase business tables,
    // company snapshots, or the Android app's storage namespace.
    function loadState() {
      if (stopped || !sessionStorage) return null;
      try {
        const raw = sessionStorage.getItem(stateKey);
        if (!raw) return null;
        const value = JSON.parse(raw);
        return value && typeof value === 'object' ? value : null;
      } catch { return null; }
    }
    function saveState(state) {
      if (stopped || !sessionStorage || !state || typeof state !== 'object') return false;
      try {
        sessionStorage.setItem(stateKey, JSON.stringify(state));
        return true;
      } catch { return false; }
    }
    function clearState() {
      try { sessionStorage?.removeItem(stateKey); } catch {}
    }
    function purgeStoredBusinessData() {
      // Keep only this tab's current guest workspace; remove abandoned sessions and legacy temp keys.
      try {
        if (!sessionStorage) return;
        for (let i=sessionStorage.length-1;i>=0;i--) {
          const key=sessionStorage.key(i);
          if (!key) continue;
          if (key.startsWith(STATE_PREFIX) && key !== stateKey) sessionStorage.removeItem(key);
          if (key.startsWith(TEMP_PREFIX)) sessionStorage.removeItem(key);
        }
      } catch {}
    }
    function saveSession(meta = {}) {
      if (stopped || !sessionStorage || !token) return false;
      try {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({
          token, sessionId, expiresAt: Number(meta.expiresAt || 0),
          username: 'مهمان'
        }));
        return true;
      } catch { return false; }
    }
    function readSavedSession() {
      if (!sessionStorage) return null;
      try {
        const s = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
        if (!s || !s.token || !s.sessionId) return null;
        sessionId = String(s.sessionId).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80) || 'pending';
        stateKey = STATE_PREFIX + sessionId;
        if (s.expiresAt && Date.now() > s.expiresAt) { clearAll(); return null; }
        token = String(s.token);
        return {...s};
      } catch { return null; }
    }
    function setToken(v) { token = String(v || ''); stopped = false; }
    function getToken() { return token; }

    async function request(action, payload = {}, requestOptions = {}) {
      if (stopped) throw new Error('نشست مهمان پایان یافته است؛ QR را دوباره اسکن کنید.');
      if (!endpoint || !fetchImpl) throw new Error('اتصال سرویس مهمان تنظیم نشده است.');
      const headers = {'Content-Type':'application/json'};
      if (publishableKey) headers.apikey = publishableKey;
      if (token) headers['x-guest-session'] = token;
      const response = await fetchImpl(endpoint, {
        method:'POST', headers,
        body:JSON.stringify({action, ...payload}),
        keepalive:!!requestOptions.keepalive
      });
      let body = null;
      try { body = await response.json(); } catch { body = {}; }
      if (!response.ok || body?.ok === false) throw new Error(body?.error || `خطای سرویس مهمان (${response.status})`);
      return body;
    }
    async function resume() { return request('resume'); }
    let eventQueue = Promise.resolve();
    let pendingEvents = [];
    let eventTimer = null;
    function flushEvents(requestOptions = {}) {
      if (eventTimer) { clearTimeout(eventTimer); eventTimer = null; }
      if (!pendingEvents.length) return eventQueue;
      const batch = pendingEvents.splice(0, 20);
      const queued = eventQueue.then(() => request('event', {events:batch}, requestOptions));
      eventQueue = queued.catch(() => false);
      if (pendingEvents.length) eventTimer = setTimeout(() => flushEvents().catch(() => false), 1800);
      return queued;
    }
    function event(data = {}, requestOptions = {}) {
      if (!token || stopped) return Promise.resolve(false);
      pendingEvents.push(sanitizeAuditDetail(data));
      if (requestOptions.immediate || pendingEvents.length >= 20) return flushEvents(requestOptions);
      if (!eventTimer) eventTimer = setTimeout(() => flushEvents().catch(() => false), 900);
      return Promise.resolve({ok:true, queued:true});
    }
    async function heartbeat() { if (!token || stopped) return false; return request('heartbeat'); }
    async function logout(reason = 'manual') {
      if (!token || stopped) { clearAll(); return false; }
      try {
        if (pendingEvents.length) await flushEvents({keepalive:true});
        await eventQueue;
        await request('logout', {reason});
      } finally { clearAll(); }
      return true;
    }
    function storageKey(name) { return TEMP_PREFIX + sessionId + ':' + String(name || 'data').replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 100); }
    function clearAll() {
      if (eventTimer) { clearTimeout(eventTimer); eventTimer = null; }
      pendingEvents = [];
      clearState();
      try {
        if (sessionStorage) {
          sessionStorage.removeItem(SESSION_KEY);
          const prefix = TEMP_PREFIX + sessionId + ':';
          for (let i=sessionStorage.length-1;i>=0;i--) {
            const key=sessionStorage.key(i);
            if (key && key.startsWith(prefix)) sessionStorage.removeItem(key);
          }
        }
      } catch {}
      token = '';
      stopped = true;
    }
    function storageNamespace() { return stateKey; }
    function canSyncToCompany() { return false; }
    function usesMainLocalStorage() { return false; }

    return {
      loadState, saveState, clearState, purgeStoredBusinessData, saveSession, readSavedSession, clearAll,
      setToken, getToken, request, resume, event, flushEvents, heartbeat, logout,
      storageNamespace, storageKey, canSyncToCompany, usesMainLocalStorage,
      sanitizeAuditDetail
    };
  }

  return {create, readEntry, sanitizeAuditDetail, constants:{STATE_PREFIX, SESSION_KEY, TEMP_PREFIX}};
});