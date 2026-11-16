'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

test('browser export store is loaded before the accounting application script and cached offline', () => {
  assert.match(html, /<script src="mrk-export-store\.js"><\/script><script>'use strict';/);
  assert.match(sw, /mrk-export-store\.js/);
  assert.match(sw, /2\.9\.1-native-file-transfer/);
});

test('the complete inline accounting application script parses as valid JavaScript', () => {
  const startTag = "<script>'use strict';";
  const start = html.indexOf(startTag);
  assert.notEqual(start, -1, 'main application script must exist');
  const codeStart = start + '<script>'.length;
  const end = html.indexOf('</script>', codeStart);
  assert.notEqual(end, -1, 'main application script must close');
  const source = html.slice(codeStart, end);
  assert.doesNotThrow(() => new vm.Script(source, { filename: 'index-inline-app.js' }));
  assert.match(source, /localExportStore\.save\(clean,blob\)/);
  assert.match(source, /showExportReceipt\(record\)/);
  assert.match(source, /ACT\.savedExports=/);
});

test('export success is not reported as a completed device download before storage is verified', () => {
  const start = html.indexOf("<script>'use strict';");
  const codeStart = start + '<script>'.length;
  const end = html.indexOf('</script>', codeStart);
  const source = html.slice(codeStart, end);
  assert.doesNotMatch(source, /toast\('فایل اکسل در پوشهٔ دانلود ذخیره شد'\)/);
  assert.doesNotMatch(source, /toast\('فایل PDF در پوشهٔ دانلود ذخیره شد'\)/);
  assert.match(source, /در مسیر انتخاب‌شده ذخیره شد/);
});

test('all inventory, cheque and production import/export tools are exposed in the live app', () => {
  const start = html.indexOf("<script>'use strict';");
  const codeStart = start + '<script>'.length;
  const end = html.indexOf('</script>', codeStart);
  const source = html.slice(codeStart, end);
  assert.match(source, /function importOperationalScope/);
  assert.match(source, /function exportExcelScope/);
  assert.match(source, /function excelTransferPanel/);
  assert.match(source, /ACT\.cardexSearch=/);
  assert.match(source, /ACT\.cardexExport=/);
  assert.match(source, /function chequeRegisterPage/);
  assert.match(source, /ACT\.chequeRegExport=/);
  assert.match(source, /buildChequeRegisterRows/);
  assert.match(source, /cardexGoodsSearch/);
  assert.match(source, /cardexPartySearch/);
  assert.match(source, /if\(k==='chequeEntries'\)/);
  assert.match(source, /if\(k==='warehouseOpsInput'\)/);
});

test('saving an export does not silently start a second device download before the user chooses a destination', () => {
  const start = html.indexOf("<script>'use strict';");
  const source = html.slice(start + '<script>'.length, html.indexOf('</script>', start + '<script>'.length));
  assert.doesNotMatch(source, /const downloadRequested=requestBlobDownload\(finalName,blob\)/);
  assert.match(source, /function saveRecordToDevice\(record\)/);
  assert.match(source, /showExportReceipt\(record\)/);
});

test('native export save waits for Android SAF completion instead of treating bridge dispatch as a saved file', () => {
  const start = html.indexOf("<script>'use strict';");
  const source = html.slice(start + '<script>'.length, html.indexOf('</script>', start + '<script>'.length));
  assert.match(source, /window\.MRKNativeFileResult/);
  assert.match(source, /AndroidBridge\.saveFile\(requestId,/);
  assert.match(source, /ذخیره شد/);
  assert.match(source, /nativeSaveRequests/);
});

test('automatic Excel names include the exact Persian date, section and device time', () => {
  const start = html.indexOf("<script>'use strict';");
  const source = html.slice(start + '<script>'.length, html.indexOf('</script>', start + '<script>'.length));
  const declaration = source.match(/const fname=\(t,ext\)=>\{[\s\S]*?\};/);
  assert.ok(declaration, 'filename generator must exist');
  const fixedDate = class extends Date {
    getHours() { return 21; }
    getMinutes() { return 8; }
    getSeconds() { return 5; }
  };
  const digits = '۰۱۲۳۴۵۶۷۸۹';
  const fileName = vm.runInNewContext(declaration[0] + '; fname("اشخاص", "xlsx")', {
    UI: { user: { name: 'علی' } },
    today: () => '1405/08/25',
    fa: value => String(value).replace(/\d/g, digit => digits[Number(digit)]),
    MONTHS: ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'],
    p2: value => String(value).padStart(2, '0'),
    Date: fixedDate
  });
  assert.equal(fileName, 'اشخاص_علی_۲۵ آبان ۱۴۰۵_ساعت-۲۱-۰۸-۰۵.xlsx');
});

test('file import passes the selected section explicitly and explains unsupported legacy XLS files', () => {
  const start = html.indexOf("<script>'use strict';");
  const source = html.slice(start + '<script>'.length, html.indexOf('</script>', start + '<script>'.length));
  assert.match(source, /async function onFile\(file,kind\)/);
  assert.match(source, /onFile\(f,kind\)/);
  assert.match(source, /فرمت XLS قدیمی پشتیبانی نمی‌شود/);
});
