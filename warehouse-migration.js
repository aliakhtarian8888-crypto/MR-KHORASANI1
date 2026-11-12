/* Safe migration for legacy warehouse values. No external dependencies. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MRKWarehouseMigration = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function norm(value) {
    return String(value == null ? '' : value).trim().replace(/\s+/g, ' ').toLocaleLowerCase('fa-IR');
  }

  function normalizeState(input, defaultWarehouses) {
    const state = input && typeof input === 'object' ? JSON.parse(JSON.stringify(input)) : {};
    const defaults = Array.isArray(defaultWarehouses) ? defaultWarehouses : [];
    const original = Array.isArray(state.warehouses) && state.warehouses.length
      ? state.warehouses : defaults.map(w => ({ ...w }));
    const defaultByName = new Map(defaults.map(w => [norm(w.name), w]));
    const defaultById = new Map(defaults.map(w => [String(w.id), w]));
    const usedIds = new Set();
    const usedAccounts = new Set((Array.isArray(state.accounts) ? state.accounts : [])
      .map(a => String(a && a.code || '')).filter(Boolean));
    let nextAccount = Math.max(1602, ...[...usedAccounts].map(x => /^\d+$/.test(x) ? Number(x) : 0));
    const aliases = new Map();
    const warehouses = [];

    function remember(alias, id) {
      const key = norm(alias);
      if (key && !aliases.has(key)) aliases.set(key, String(id));
      const exact = String(alias == null ? '' : alias).trim();
      if (exact && !aliases.has(exact)) aliases.set(exact, String(id));
    }

    function uniqueId(candidate) {
      let id = String(candidate == null ? '' : candidate).trim();
      if (!id) id = String(warehouses.length + 1);
      if (!usedIds.has(id)) { usedIds.add(id); return id; }
      let n = 1;
      while (usedIds.has('legacy-' + n)) n++;
      id = 'legacy-' + n;
      usedIds.add(id);
      return id;
    }

    function accountFor(id, rawAccount, defaultMatch) {
      const existing = String(rawAccount == null ? '' : rawAccount).trim();
      if (existing) { usedAccounts.add(existing); return existing; }
      if (defaultMatch && defaultMatch.acc) {
        const a = String(defaultMatch.acc);
        usedAccounts.add(a);
        return a;
      }
      if (id === '1') { usedAccounts.add('1601'); return '1601'; }
      if (id === '2') { usedAccounts.add('1602'); return '1602'; }
      do { nextAccount++; } while (usedAccounts.has(String(nextAccount)));
      const a = String(nextAccount);
      usedAccounts.add(a);
      return a;
    }

    original.forEach((raw, index) => {
      const isString = typeof raw === 'string';
      const obj = isString ? { name: raw } : (raw && typeof raw === 'object' ? { ...raw } : { name: '' });
      const name = String(obj.name || (isString ? raw : '') || ('انبار ' + (index + 1))).trim();
      const matchedDefault = defaultByName.get(norm(name)) || null;
      const originalId = isString ? null : obj.id;
      const candidateId = originalId != null && String(originalId).trim()
        ? String(originalId) : (matchedDefault ? String(matchedDefault.id) : String(index + 1));
      const id = uniqueId(candidateId);
      obj.id = id;
      obj.name = name;
      obj.acc = accountFor(id, obj.acc, matchedDefault || defaultById.get(id));
      warehouses.push(obj);
      if (originalId != null) remember(originalId, id);
      remember(name, id);
      remember(id, id);
    });

    // Add only genuinely missing standard warehouses; legacy string entries with standard names
    // have already been matched to their canonical IDs above.
    defaults.forEach(def => {
      const id = String(def.id);
      const hasId = warehouses.some(w => String(w.id) === id);
      const hasName = warehouses.some(w => norm(w.name) === norm(def.name));
      if (!hasId && !hasName) {
        const copy = { ...def, id, name: String(def.name), acc: String(def.acc || accountFor(id, '', def)) };
        if (usedIds.has(id)) copy.id = uniqueId('default-' + id);
        else usedIds.add(id);
        usedAccounts.add(copy.acc);
        warehouses.push(copy);
        remember(def.name, copy.id);
        remember(id, copy.id);
      }
    });

    function remapRef(value) {
      if (typeof value !== 'string') return value;
      return aliases.get(norm(value)) || aliases.get(value.trim()) || value;
    }
    function walk(value, parentKey) {
      if (!value || typeof value !== 'object') return;
      if (Array.isArray(value)) { value.forEach(v => walk(v, parentKey)); return; }
      Object.keys(value).forEach(key => {
        const child = value[key];
        if (/warehouse|^wh$/i.test(key) && typeof child === 'string') value[key] = remapRef(child);
        else walk(child, key);
      });
    }

    // Opening balances are keyed by warehouse ID rather than by a named property.
    if (Array.isArray(state.goods)) {
      state.goods.forEach(g => {
        if (!g || typeof g !== 'object') return;
        const opening = g.opening && typeof g.opening === 'object' ? g.opening : {};
        const moved = {};
        Object.entries(opening).forEach(([key, value]) => {
          const target = remapRef(String(key));
          if (Object.prototype.hasOwnProperty.call(moved, target) && moved[target] && value && typeof moved[target] === 'object' && typeof value === 'object') {
            const a = moved[target], b = value;
            moved[target] = { ...a, ...b, q: Number(a.q || 0) + Number(b.q || 0), c: Number(a.c || 0) + Number(b.c || 0) };
          } else moved[target] = value;
        });
        g.opening = moved;
      });
    }

    state.warehouses = warehouses;
    if (state.settings && typeof state.settings === 'object') walk(state.settings, 'settings');
    if (Array.isArray(state.ops)) walk(state.ops, 'ops');
    if (Array.isArray(state.productionOrders)) walk(state.productionOrders, 'productionOrders');
    if (Array.isArray(state.boms)) walk(state.boms, 'boms');
    return state;
  }

  return { normalizeState };
});