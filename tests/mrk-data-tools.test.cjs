const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeHeader, mapImportRows, buildCardex } = require('../mrk-data-tools.js');

test('normalizes Persian and Arabic digits and common Persian letter variants', () => {
  assert.equal(normalizeHeader('كُد كالا ۱۲۳'), 'کد کالا 123');
});

test('maps columns when Excel headers are reordered and title rows precede them', () => {
  const result = mapImportRows([
    ['گزارش فروش ماهانه'],
    ['مبلغ', 'نام کالا', 'تاریخ', 'کد کالا'],
    [1500, 'کالای الف', '۱۴۰۵/۰۱/۰۲', 'G-01']
  ], ['کد کالا', 'نام کالا', 'تاریخ', 'مبلغ'], {
    'کد کالا': ['شناسه کالا', 'کد محصول'],
    'مبلغ': ['مبلغ کل', 'جمع مبلغ']
  });
  assert.equal(result.mode, 'header-mapped');
  assert.deepEqual(result.rows, [['G-01', 'کالای الف', '۱۴۰۵/۰۱/۰۲', 1500]]);
  assert.equal(result.matched, 4);
});

test('falls back to the documented column order when no recognizable header exists', () => {
  const result = mapImportRows([['P-01', 'شخص الف', 'مشتری']], ['کد', 'نام', 'نوع']);
  assert.equal(result.mode, 'positional');
  assert.deepEqual(result.rows, [['P-01', 'شخص الف', 'مشتری']]);
});

test('calculates opening, period in/out and closing balances per warehouse', () => {
  const rows = buildCardex(
    [{g:'G1',w:'W1',q:10,v:1000}],
    [
      {date:'1405/01/10',g:'G1',w:'W1',q:5,v:600},
      {date:'1405/01/15',g:'G1',w:'W1',q:-3,v:-360},
      {date:'1405/02/01',g:'G1',w:'W2',q:7,v:700}
    ],
    '1405/01/01', '1405/01/31'
  );
  assert.deepEqual(rows.find(x=>x.warehouseId==='W1'), {
    goodsId:'G1', warehouseId:'W1', openQty:10, openValue:1000,
    inQty:5, inValue:600, outQty:3, outValue:360, closeQty:12, closeValue:1240
  });
  assert.equal(rows.some(x=>x.warehouseId==='W2'), false);
});

test('moves before the selected date into opening balance', () => {
  const rows = buildCardex([], [
    {date:'1405/01/01',g:'G1',w:'W1',q:4,v:400},
    {date:'1405/01/15',g:'G1',w:'W1',q:-1,v:-100}
  ], '1405/01/10', '1405/01/31');
  assert.equal(rows[0].openQty, 4);
  assert.equal(rows[0].outQty, 1);
  assert.equal(rows[0].closeQty, 3);
});

test('refuses ambiguous partial headers instead of guessing a wrong column order', () => {
  const result = mapImportRows([
    ['گزارش موجودی'],
    ['نام کالا', 'تعداد کل', 'یادداشت'],
    ['کالای الف', 12, 'انبار اصلی']
  ], ['کد کالا', 'نام کالا', 'تاریخ', 'مبلغ', 'وضعیت', 'انبار']);
  assert.equal(result.mode, 'ambiguous-header');
  assert.equal(result.rows.length, 0);
  assert.equal(result.matched, 1);
});
