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

  function classifyOperation(value) {
    const type = typeof value === 'string' ? value : String(value && value.type || '');
    const chequeTypes = ['دریافت چک', 'پرداخت چک', 'وصول چک', 'برگشت چک', 'پاس چک پرداختی'];
    if (chequeTypes.includes(type)) return 'cheques';
    if (type === 'انتقال بین انبارها') return 'transfers';
    if (['رسید کالا', 'رسید محصول تولیدی', 'خرید', 'برگشت از فروش'].includes(type)) return 'receipts';
    if (['حواله خروج کالا', 'حواله مصرف مواد تولید', 'فروش', 'برگشت از خرید'].includes(type)) return 'issues';
    if (['دریافت بابت فاکتور', 'پرداخت بابت فاکتور', 'دریافت خارج از فاکتور', 'پرداخت خارج از فاکتور'].includes(type)) return 'treasury';
    return 'operations';
  }

  function uniqueByRecordId(records) {
    const seen = new Set();
    const result = [];
    (Array.isArray(records) ? records : []).forEach(record => {
      if (!record || typeof record !== 'object') return;
      const key = record.id != null && String(record.id) !== ''
        ? 'id:' + String(record.id)
        : 'json:' + JSON.stringify(record);
      if (seen.has(key)) return;
      seen.add(key);
      result.push(record);
    });
    return result;
  }


  function buildCardexLedger(input) {
    const source = input || {};
    const goods = Array.isArray(source.goods) ? source.goods : [];
    const warehouses = Array.isArray(source.warehouses) ? source.warehouses : [];
    const openingRows = Array.isArray(source.openingRows) ? source.openingRows : [];
    const movements = Array.isArray(source.movements) ? source.movements : [];
    const filters = source.filters || {};
    const from = String(filters.from || '');
    const to = String(filters.to || '9999/99/99');
    const goodsQuery = normalizeHeader(filters.goodsQuery || '');
    const partyQuery = normalizeHeader(filters.partyQuery || '');
    const warehouseId = String(filters.warehouseId || '');
    const goodsById = new Map(goods.map(g => [String(g.id), g]));
    const warehousesById = new Map(warehouses.map(w => [String(w.id), w]));
    const allowedGoods = new Set(goods.filter(g => {
      if (!goodsQuery) return true;
      return normalizeHeader([g.code, g.name, g.unit].join(' ')).includes(goodsQuery);
    }).map(g => String(g.id)));
    const allowedWarehouses = new Set(warehouses.filter(w =>
      !warehouseId || String(w.id) === warehouseId
    ).map(w => String(w.id)));
    const balances = new Map();
    const keyOf = (g, w) => String(g) + '|' + String(w);
    const getBalance = (g, w) => {
      const key = keyOf(g, w);
      if (!balances.has(key)) balances.set(key, {goodsId:String(g),warehouseId:String(w),quantity:0,value:0});
      return balances.get(key);
    };
    const validKey = (g, w) => allowedGoods.has(String(g)) && allowedWarehouses.has(String(w));
    openingRows.forEach(x => {
      if (!x || !validKey(x.g, x.w)) return;
      const b = getBalance(x.g, x.w);
      b.quantity += Number(x.q) || 0;
      b.value += Number(x.v) || 0;
    });
    const sorted = movements.filter(x => x && validKey(x.g, x.w) && String(x.date || '') <= to)
      .slice().sort((a,b) => String(a.date||'').localeCompare(String(b.date||'')) ||
        (Number(a.no)||0)-(Number(b.no)||0) || String(a.id||'').localeCompare(String(b.id||'')));
    sorted.filter(x => String(x.date||'') < from).forEach(x => {
      const b = getBalance(x.g, x.w);
      b.quantity += Number(x.q) || 0;
      b.value += Number(x.v) || 0;
    });
    const snapshot = () => [...balances.values()].map(b => ({
      goodsId:b.goodsId, warehouseId:b.warehouseId,
      code:(goodsById.get(b.goodsId)||{}).code || '',
      goodsName:(goodsById.get(b.goodsId)||{}).name || '',
      unit:(goodsById.get(b.goodsId)||{}).unit || '',
      warehouseName:(warehousesById.get(b.warehouseId)||{}).name || '',
      quantity:b.quantity, value:b.value
    })).sort((a,b)=>a.goodsCode.localeCompare(b.goodsCode)||a.goodsName.localeCompare(b.goodsName)||a.warehouseName.localeCompare(b.warehouseName));
    const opening = snapshot();
    const visible = [];
    sorted.filter(x => String(x.date||'') >= from && String(x.date||'') <= to).forEach(x => {
      const b = getBalance(x.g, x.w);
      const q = Number(x.q) || 0, v = Number(x.v) || 0;
      b.quantity += q;
      b.value += v;
      const personText = normalizeHeader(x.partyName || '');
      if (partyQuery && !personText.includes(partyQuery)) return;
      const g = goodsById.get(String(x.g)) || {};
      const w = warehousesById.get(String(x.w)) || {};
      visible.push({
        id:String(x.id||''), date:String(x.date||''), no:x.no==null?'':x.no,
        type:String(x.type||''), description:String(x.description||''),
        goodsId:String(x.g), code:g.code||'', goodsName:g.name||'', unit:g.unit||'',
        partyId:String(x.partyId||''), partyName:String(x.partyName||''),
        warehouseId:String(x.w), warehouseName:w.name||'',
        inQuantity:q>0?q:0, outQuantity:q<0?-q:0,
        inValue:v>0?v:0, outValue:v<0?-v:0,
        quantity:q, value:v, balanceQty:b.quantity, balanceValue:b.value
      });
    });
    return { opening, movements:visible, closing:snapshot() };
  }

  function selectScopeRows(rows, scope) {
    if (!Array.isArray(rows) || !rows.length) return [];
    const header = rows[0];
    const records = rows.slice(1).filter(row => {
      const recordType = String(row && row[0] || '');
      const operationType = String(row && row[3] || '');
      if (scope === 'all' || scope === 'operations') return true;
      if (scope === 'cheques') return recordType === 'carryCheque' || (recordType === 'operation' && classifyOperation(operationType) === 'cheques');
      if (scope === 'receipts' || scope === 'issues' || scope === 'transfers') return recordType === 'operation' && classifyOperation(operationType) === scope;
      if (scope === 'warehouseOps') return recordType === 'operation' && ['receipts','issues','transfers'].includes(classifyOperation(operationType));
      if (scope === 'cardex') return recordType === 'operation' && ['receipts','issues','transfers'].includes(classifyOperation(operationType));
      if (scope === 'warehouses') return recordType === 'warehouse';
      if (scope === 'workers') return recordType === 'worker';
      if (scope === 'boms') return recordType === 'bom';
      if (scope === 'productionOrders') return recordType === 'productionOrder';
      if (scope === 'parties') return recordType === 'party';
      if (scope === 'goods' || scope === 'inventory') return recordType === 'good' || recordType === 'openingStock';
      if (scope === 'sources') return recordType === 'source';
      if (scope === 'coa') return recordType === 'account';
      return recordType === scope;
    });
    return [header, ...records];
  }

  return { latinDigits, normalizeHeader, mapImportRows, buildCardex, buildCardexLedger, classifyOperation, uniqueByRecordId, selectScopeRows };
});
