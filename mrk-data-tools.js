(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MRKDataTools = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const DIGITS = '۰۱۲۳۴۵۶۷۸۹';
  const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
  function latinDigits(value) {
    return String(value == null ? '' : value)
      .replace(/[۰-۹]/g, c => String(DIGITS.indexOf(c)))
      .replace(/[٠-٩]/g, c => String(ARABIC_DIGITS.indexOf(c)));
  }
  function normalizeHeader(value) {
    return latinDigits(value)
      .replace(/[يى]/g, 'ی').replace(/ك/g, 'ک')
      .replace(/[\u200c\u200e\u200f\ufeff\u064b-\u065f]/g, '')
      .toLowerCase().replace(/[()\[\]{}:：،,؛;_\-–—./\\]/g, ' ')
      .replace(/\s+/g, ' ').trim();
  }
  function mapImportRows(inputRows, expectedHeaders, aliases = {}) {
    const rows = (Array.isArray(inputRows) ? inputRows : []).filter(row =>
      Array.isArray(row) && row.some(cell => String(cell == null ? '' : cell).trim() !== '')
    );
    if (!rows.length) return { headerIndex: -1, rows: [], mapping: [], matched: 0, mode: 'empty' };
    const expected = expectedHeaders.map((header, index) => {
      const names = [header, ...(aliases[header] || [])].map(normalizeHeader).filter(Boolean);
      return { header, index, names: [...new Set(names)] };
    });
    const scoreRow = row => {
      const cells = row.map(normalizeHeader);
      return expected.reduce((score, item) => score + (cells.some(cell => cell && item.names.includes(cell)) ? 1 : 0), 0);
    };
    let headerIndex = -1, bestScore = 0;
    for (let i = 0; i < Math.min(rows.length, 12); i++) {
      const score = scoreRow(rows[i]);
      if (score > bestScore) { bestScore = score; headerIndex = i; }
    }
    const minimumHeaderMatches = Math.max(1, Math.ceil(expected.length * 0.5));
    const hasHeader = headerIndex >= 0 && bestScore >= minimumHeaderMatches;
    const ambiguousHeader = headerIndex >= 0 && bestScore > 0 && !hasHeader;
    const sourceHeaders = headerIndex >= 0 ? rows[headerIndex].map(normalizeHeader) : [];
    const mapping = expected.map(item => {
      if (!hasHeader && !ambiguousHeader) return { header: item.header, sourceIndex: item.index, matched: false };
      const sourceIndex = sourceHeaders.findIndex(cell => item.names.includes(cell));
      return { header: item.header, sourceIndex, matched: sourceIndex >= 0 };
    });
    const dataStart = hasHeader ? headerIndex + 1 : 0;
    const mappedRows = ambiguousHeader ? [] : rows.slice(dataStart).map(row => mapping.map(m => m.sourceIndex >= 0 ? (row[m.sourceIndex] == null ? '' : row[m.sourceIndex]) : ''))
      .filter(row => row.some(cell => String(cell == null ? '' : cell).trim() !== ''));
    return {
      headerIndex,
      rows: mappedRows,
      mapping,
      matched: mapping.filter(m => m.matched).length,
      mode: ambiguousHeader ? 'ambiguous-header' : hasHeader ? 'header-mapped' : 'positional'
    };
  }
  function buildCardex(openingRows, movements, from, to, goodsFilter = '', warehouseFilter = '') {
    const map = new Map();
    const entry = (g, w) => {
      const key = String(g) + '|' + String(w);
      if (!map.has(key)) map.set(key, { goodsId: String(g), warehouseId: String(w), openQty: 0, openValue: 0, inQty: 0, inValue: 0, outQty: 0, outValue: 0, closeQty: 0, closeValue: 0 });
      return map.get(key);
    };
    (openingRows || []).forEach(x => {
      const e = entry(x.g, x.w);
      e.openQty += Number(x.q || 0);
      e.openValue += Number(x.v || 0);
    });
    (movements || []).forEach(x => {
      const date = String(x.date || '');
      if (date < String(from || '')) {
        const e = entry(x.g, x.w); e.openQty += Number(x.q || 0); e.openValue += Number(x.v || 0);
        return;
      }
      if (date > String(to || '')) return;
      const e = entry(x.g, x.w), q = Number(x.q || 0), v = Number(x.v || 0);
      if (q > 0) { e.inQty += q; e.inValue += Math.max(v, 0); }
      if (q < 0) { e.outQty += -q; e.outValue += Math.max(-v, 0); }
    });
    return [...map.values()]
      .filter(x => (!goodsFilter || x.goodsId === String(goodsFilter)) && (!warehouseFilter || x.warehouseId === String(warehouseFilter)))
      .map(x => ({ ...x, closeQty: x.openQty + x.inQty - x.outQty, closeValue: x.openValue + x.inValue - x.outValue }))
      .sort((a, b) => a.goodsId.localeCompare(b.goodsId) || a.warehouseId.localeCompare(b.warehouseId));
  }
  return { latinDigits, normalizeHeader, mapImportRows, buildCardex };
});
