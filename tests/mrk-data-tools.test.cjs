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

test('maps BOM formula columns by header when users reorder them', () => {
  const result = mapImportRows([
    ['فرمول تولید'],
    ['نام ماده اولیه', 'مقدار مصرف در هر بچ', 'کد محصول', 'نام محصول', 'مقدار خروجی هر بچ', 'کد ماده اولیه', 'واحد ماده اولیه'],
    ['آرد', 2.5, 'FG-01', 'نان', 10, 'RM-01', 'کیلوگرم']
  ], ['کد محصول', 'نام محصول', 'مقدار خروجی هر بچ', 'کد ماده اولیه', 'نام ماده اولیه', 'مقدار مصرف در هر بچ', 'واحد ماده اولیه'], {
    'کد محصول': ['کد کالا'],
    'کد ماده اولیه': ['کد مواد']
  });
  assert.equal(result.mode, 'header-mapped');
  assert.deepEqual(result.rows, [['FG-01', 'نان', 10, 'RM-01', 'آرد', 2.5, 'کیلوگرم']]);
});

test('maps production order fields including full JSON payload when columns are reordered', () => {
  const result = mapImportRows([
    ['اطلاعات تولید'],
    ['عملیات مرتبط (JSON)', 'مقدار تولید', 'شماره دستور', 'اطلاعات کامل دستور (JSON)', 'تاریخ', 'کد محصول'],
    ['[]', 25, 'PR-01', '{"id":"o1"}', '۱۴۰۵/۰۱/۰۲', 'FG-01']
  ], ['شناسه دستور', 'شماره دستور', 'تاریخ', 'کد محصول', 'مقدار تولید', 'اطلاعات کامل دستور (JSON)', 'عملیات مرتبط (JSON)'], {
    'شماره دستور': ['شماره سفارش ساخت'],
    'تاریخ': ['تاریخ تولید']
  });
  assert.equal(result.mode, 'header-mapped');
  assert.deepEqual(result.rows[0], ['', 'PR-01', '۱۴۰۵/۰۱/۰۲', 'FG-01', 25, '{"id":"o1"}', '[]']);
});

test('classifies operational records for cheque, stock receipt, issue and transfer exports', () => {
  const { classifyOperation } = require('../mrk-data-tools.js');
  assert.equal(classifyOperation({type:'دریافت چک'}), 'cheques');
  assert.equal(classifyOperation({type:'وصول چک'}), 'cheques');
  assert.equal(classifyOperation({type:'رسید کالا'}), 'receipts');
  assert.equal(classifyOperation({type:'حواله خروج کالا'}), 'issues');
  assert.equal(classifyOperation({type:'انتقال بین انبارها'}), 'transfers');
  assert.equal(classifyOperation({type:'فروش'}), 'issues');
});

test('deduplicates repeated source operations in cardex exports while preserving distinct ids', () => {
  const { uniqueByRecordId } = require('../mrk-data-tools.js');
  const a = {id:'op-1',type:'رسید کالا'};
  const b = {id:'op-2',type:'انتقال بین انبارها'};
  assert.deepEqual(uniqueByRecordId([a,a,b,{...a}]), [a,b]);
});

test('builds a searchable cardex with opening and closing balances per good and warehouse', () => {
  const { buildCardexLedger } = require('../mrk-data-tools.js');
  const result = buildCardexLedger({
    goods: [
      {id:'g1',code:'A-01',name:'آرد',unit:'کیلوگرم'},
      {id:'g2',code:'B-02',name:'شکر',unit:'کیلوگرم'}
    ],
    warehouses: [{id:'w1',name:'اصلی'},{id:'w2',name:'فرعی'}],
    openingRows: [{g:'g1',w:'w1',q:10,v:1000},{g:'g2',w:'w1',q:5,v:500}],
    movements: [
      {id:'m1',date:'1405/01/02',no:1,type:'رسید کالا',g:'g1',w:'w1',q:5,v:600,partyName:'شرکت آلفا'},
      {id:'m2',date:'1405/01/04',no:2,type:'حواله خروج کالا',g:'g1',w:'w1',q:-3,v:-360,partyName:'شرکت بتا'},
      {id:'m3',date:'1405/01/05',no:3,type:'انتقال بین انبارها',g:'g1',w:'w2',q:2,v:240,partyName:''},
      {id:'m4',date:'1405/02/02',no:4,type:'رسید کالا',g:'g1',w:'w1',q:4,v:480,partyName:'شرکت آلفا'}
    ],
    filters: {from:'1405/01/01',to:'1405/01/31',goodsQuery:'A-01',partyQuery:'آلفا'}
  });
  assert.equal(result.movements.length, 1);
  assert.equal(result.movements[0].id, 'm1');
  assert.equal(result.movements[0].balanceQty, 12);
  assert.equal(result.opening[0].quantity, 10);
  assert.equal(result.closing[0].quantity, 14);
});

test('person filter narrows visible cardex lines without changing actual stock balances', () => {
  const { buildCardexLedger } = require('../mrk-data-tools.js');
  const common = {
    goods:[{id:'g1',code:'A',name:'کالا'}],
    warehouses:[{id:'w1',name:'اصلی'}],
    openingRows:[{g:'g1',w:'w1',q:10,v:100}],
    movements:[
      {id:'m1',date:'1405/01/02',g:'g1',w:'w1',q:5,v:50,partyName:'مشتری الف'},
      {id:'m2',date:'1405/01/03',g:'g1',w:'w1',q:-4,v:-40,partyName:'مشتری ب'}
    ],
    filters:{from:'1405/01/01',to:'1405/01/31'}
  };
  const all = buildCardexLedger(common);
  const person = buildCardexLedger({...common,filters:{...common.filters,partyQuery:'مشتری الف'}});
  assert.equal(person.movements.length, 1);
  assert.equal(all.closing[0].quantity, 11);
  assert.equal(person.closing[0].quantity, 11);
});

test('filters unified record export scopes without losing complete JSON payloads', () => {
  const { selectScopeRows } = require('../mrk-data-tools.js');
  const headers=['نوع رکورد','شناسه','تاریخ','نوع عملیات','کد','نام / شرح','وضعیت','مقدار','JSON کامل رکورد'];
  const rows=[headers,
    ['operation','a','1405/01/01','دریافت چک','1','چک الف','active',100,'{"id":"a"}'],
    ['operation','b','1405/01/02','انتقال بین انبارها','2','انتقال','active',5,'{"id":"b"}'],
    ['operation','c','1405/01/03','رسید کالا','3','رسید','active',3,'{"id":"c"}'],
    ['carryCheque','d','','','4','چک افتتاحیه','در جریان',40,'{"id":"d"}']];
  assert.deepEqual(selectScopeRows(rows,'cheques').slice(1).map(r=>r[1]),['a','d']);
  assert.deepEqual(selectScopeRows(rows,'transfers').slice(1).map(r=>r[1]),['b']);
  assert.deepEqual(selectScopeRows(rows,'receipts').slice(1).map(r=>r[1]),['c']);
  assert.equal(selectScopeRows(rows,'cheques')[1][8],'{"id":"a"}');
});

test('searches cardex movements by party code as well as the party name', () => {
  const { buildCardexLedger } = require('../mrk-data-tools.js');
  const result = buildCardexLedger({
    goods:[{id:'g',code:'P-1',name:'کالا'}],
    warehouses:[{id:'w',name:'اصلی'}],
    openingRows:[],
    movements:[{id:'x',date:'1405/01/01',g:'g',w:'w',q:1,v:5,partyName:'شرکت آلفا',partyCode:'C-204'}],
    filters:{from:'1405/01/01',to:'1405/01/31',partyQuery:'C-204'}
  });
  assert.equal(result.movements.length,1);
  assert.equal(result.movements[0].partyName,'شرکت آلفا');
});
