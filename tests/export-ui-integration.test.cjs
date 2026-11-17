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
  assert.match(sw, /2\.9\.4-separated-entry/);
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

test('Excel exports initiate one immediate device-delivery request from the export button', () => {
  const start = html.indexOf("<script>'use strict';");
  const source = html.slice(start + '<script>'.length, html.indexOf('</script>', start + '<script>'.length));
  const saveStart = source.indexOf('function saveBlob(');
  const saveEnd = source.indexOf('\nasync function openSavedExports()', saveStart);
  const saveBody = source.slice(saveStart, saveEnd);
  assert.match(saveBody, /requestBlobDownload\(clean,blob\)/);
  assert.match(saveBody, /\.xlsx\$\/i\.test\(clean\)/);
  assert.match(source, /function saveRecordToDevice\(record\)/);
  assert.match(source, /ACT\.savedExports=/);
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

test('opening balance workbench lists all existing parties and goods without deleting master names',()=>{
 const start=html.indexOf("<script>'use strict';");
 const source=html.slice(start+'<script>'.length,html.indexOf('</script>',start+'<script>'.length));
 assert.match(source,/function openingBalancesPage\(\)/);
 assert.match(source,/S\.parties\.map\(p=>/);
 assert.match(source,/S\.goods\.map\(g=>/);
 assert.match(source,/ACT\.saveOpeningBalances=/);
 assert.match(source,/p\.open=x\.amount;p\.side=x\.side/);
 assert.match(source,/g\.q1=x\.q;g\.c1=x\.cost/);
 assert.match(source,/مانده اول دوره شخص - '\+p\.name/);
 assert.match(source,/موجودی اول دوره کالا - '\+g\.name/);
});
test('admin password field can be shown while stored passwords remain unreadable',()=>{
 const start=html.indexOf("<script>'use strict';");
 const source=html.slice(start+'<script>'.length,html.indexOf('</script>',start+'<script>'.length));
 assert.match(source,/data-a="toggleUserPassword"/);
 assert.match(source,/ACT\.toggleUserPassword=/);
 assert.match(source,/رمز فعلی کاربران.*قابل بازیابی یا نمایش نیست/);
});
test('admin user report includes guest sessions and a separate guest QR asset',()=>{
 const start=html.indexOf("<script>'use strict';");
 const source=html.slice(start+'<script>'.length,html.indexOf('</script>',start+'<script>'.length));
 assert.match(source,/گزارش یکپارچه کاربران و مهمان‌ها/);
 assert.match(source,/data-a="loadGuestAudit"/);
 assert.match(source,/function guestQrSvg\(\)/);
 assert.ok(source.includes('guest-entry-qr.png'));
 assert.match(source,/\?g=1/);
});
test('QR guest link automatically issues a guest session without a user password',()=>{
 const source=fs.readFileSync(path.join(root,'guest-runtime.js'),'utf8');
 assert.match(source,/autoStartGuest: query\.get\('guest'\) === '1' \|\| query\.get\('g'\) === '1'/);
 const start=html.indexOf("<script>'use strict';");
 const inline=html.slice(start+'<script>'.length,html.indexOf('</script>',start+'<script>'.length));
 assert.match(inline,/readEntry\(location\)\?\.autoStartGuest/);
});

test('opening balance workbench preserves master names and posts named opening journal lines',()=>{
 const start=html.indexOf("<script>'use strict';");
 const source=html.slice(start+'<script>'.length,html.indexOf('</script>',start+'<script>'.length));
 assert.match(source,/function openingBalancesPage\(\)/);
 assert.match(source,/ACT\.saveOpeningBalances=/);
 assert.match(source,/S\.parties\.map\(p=>/);
 assert.match(source,/S\.goods\.map\(g=>/);
 assert.match(source,/p\.open=x\.amount;p\.side=x\.side/);
 assert.match(source,/g\.q1=x\.q;g\.c1=x\.cost/);
 assert.match(source,/مانده اول دوره شخص - '\+p\.name/);
 assert.match(source,/موجودی اول دوره کالا - '\+g\.name/);
});
test('admin password visibility is a reveal toggle and stored passwords are not retrievable',()=>{
 const start=html.indexOf("<script>'use strict';");
 const source=html.slice(start+'<script>'.length,html.indexOf('</script>',start+'<script>'.length));
 assert.match(source,/data-a="toggleUserPassword"/);
 assert.match(source,/ACT\.toggleUserPassword=/);
 assert.match(source,/رمز فعلی کاربران.*قابل بازیابی یا نمایش نیست/);
});
test('admin user settings show guest audit records and point to the browser-only QR asset',()=>{
 const start=html.indexOf("<script>'use strict';");
 const source=html.slice(start+'<script>'.length,html.indexOf('</script>',start+'<script>'.length));
 assert.match(source,/گزارش یکپارچه کاربران و مهمان‌ها/);
 assert.match(source,/data-a="loadGuestAudit"/);
 assert.match(source,/function guestQrSvg\(\)/);
 assert.ok(source.includes('guest-entry-qr.png'));
 assert.match(source,/\?g=1/);
});
test('guest QR entry automatically starts a short-lived guest session without credentials',()=>{
 const source=fs.readFileSync(path.join(root,'guest-runtime.js'),'utf8');
 assert.match(source,/autoStartGuest: query\.get\('guest'\) === '1' \|\| query\.get\('g'\) === '1'/);
 const start=html.indexOf("<script>'use strict';");
 const inline=html.slice(start+'<script>'.length,html.indexOf('</script>',start+'<script>'.length));
 assert.match(inline,/readEntry\(location\)\?\.autoStartGuest/);
});

test('roles page renders a user-by-section checkbox access matrix and persists individual grants to the company API',()=>{
 const start=html.indexOf("<script>'use strict';");
 const source=html.slice(start+'<script>'.length,html.indexOf('</script>',start+'<script>'.length));
 assert.match(source,/function permissionMatrixPage\(\)/);
 assert.match(source,/UI\.remoteUsers/);
 assert.match(source,/PERMS\.map/);
 assert.match(source,/data-user-perm/);
 assert.match(source,/data-user-id/);
 assert.match(source,/ACT\.setUserPermission=async/);
 assert.match(source,/MRKCloud\.manageUsers\(\{action:'update',companyId:UI\.companyId,userId,permissionKeys/);
});
test("permission matrix updates the selected user's permissions without mutating shared role defaults",()=>{
 const start=html.indexOf("<script>'use strict';");
 const source=html.slice(start+'<script>'.length,html.indexOf('</script>',start+'<script>'.length));
 assert.match(source,/const next=checked\?\[\.\.\.current,key\]:current\.filter/);
 assert.doesNotMatch(source,/ACT\.setUserPermission[\s\S]{0,500}S\.roles\[/);
});

test('permission matrix prevents a user from being left with an empty permission set',()=>{
 const start=html.indexOf("<script>'use strict';");
 const source=html.slice(start+'<script>'.length,html.indexOf('</script>',start+'<script>'.length));
 assert.match(source,/if\(!checked&&next\.length===0\)return toast\('برای هر کاربر دست‌کم یک دسترسی باید باقی بماند'\)/);
});


test('Excel export starts device delivery immediately from the original user action and still archives the file locally', () => {
  const start = html.indexOf("<script>'use strict';");
  const source = html.slice(start + '<script>'.length, html.indexOf('</script>', start + '<script>'.length));
  const saveStart = source.indexOf('function saveBlob(');
  const saveEnd = source.indexOf('\nasync function openSavedExports()', saveStart);
  const saveBody = source.slice(saveStart, saveEnd);
  assert.match(saveBody, /directDownload/);
  assert.match(saveBody, /requestBlobDownload\(clean,blob\)/);
  assert.ok(saveBody.indexOf('requestBlobDownload(clean,blob)') < saveBody.indexOf('localExportStore.save(clean,blob)'),
    'device picker or download must be invoked before IndexedDB awaits');
  assert.match(saveBody, /\.xlsx\$\/i\.test\(clean\)/);
});

test('Excel exports use the direct device-delivery path by default, not only the temporary file list', () => {
  const start = html.indexOf("<script>'use strict';");
  const source = html.slice(start + '<script>'.length, html.indexOf('</script>', start + '<script>'.length));
  assert.match(source, /saveBlob\(fname\('خروجی '\+label,'xlsx'\),xlsxBlob\(filtered,label\),\{directDownload:true\}\)/);
  assert.match(source, /function exportBaseData\(k\)/);
  assert.match(source, /ACT\.dataExcelExport=/);
});

test('device-save action uses Android SAF first, Web Share as the mobile-wrapper fallback, then a browser download link', () => {
  const start = html.indexOf("<script>'use strict';");
  const source = html.slice(start + '<script>'.length, html.indexOf('</script>', start + '<script>'.length));
  const begin = source.indexOf('function requestBlobDownload(');
  const end = source.indexOf('\nasync function saveRecordToDevice', begin);
  const body = source.slice(begin, end);
  assert.match(body, /AndroidBridge\.saveFile/);
  assert.match(body, /window\.showSaveFilePicker/);
  assert.match(body, /navigator\.share/);
  assert.match(body, /navigator\.canShare/);
  assert.match(body, /URL\.createObjectURL/);
  assert.ok(body.indexOf('navigator.share') < body.indexOf('URL.createObjectURL'),
    'the Android share sheet must be tried before the last-resort browser download');
});

test('saved exports remain accessible from the current session when IndexedDB cannot be opened', () => {
  const start = html.indexOf("<script>'use strict';");
  const source = html.slice(start + '<script>'.length, html.indexOf('</script>', start + '<script>'.length));
  const begin = source.indexOf('async function openSavedExports()');
  const end = source.indexOf('\nACT.savedExports=', begin);
  const body = source.slice(begin, end);
  assert.match(body, /exportRecordCache\.values\(\)/);
  assert.match(body, /localExportStore\.list\(\)/);
  assert.doesNotMatch(body, /if\(!localExportStore\)return toast\(/);
});

test('Excel export starts device delivery immediately from the original user action and still archives the file locally', () => {
  const start = html.indexOf("<script>'use strict';");
  const source = html.slice(start + '<script>'.length, html.indexOf('</script>', start + '<script>'.length));
  const saveStart = source.indexOf('function saveBlob(');
  const saveEnd = source.indexOf('\nasync function openSavedExports()', saveStart);
  const saveBody = source.slice(saveStart, saveEnd);
  assert.match(saveBody, /directDownload/);
  assert.match(saveBody, /requestBlobDownload\(clean,blob\)/);
  assert.ok(saveBody.indexOf('requestBlobDownload(clean,blob)') < saveBody.indexOf('localExportStore.save(clean,blob)'),
    'device picker or download must be invoked before IndexedDB awaits');
  assert.match(saveBody, /\.xlsx\$\/i\.test\(clean\)/);
});

test('Excel exports are automatically offered to the device when generated by the export actions', () => {
  const start = html.indexOf("<script>'use strict';");
  const source = html.slice(start + '<script>'.length, html.indexOf('</script>', start + '<script>'.length));
  assert.match(source, /function exportExcelScope\(scope\)/);
  assert.match(source, /saveBlob\(fname\('خروجی '\+label,'xlsx'\),xlsxBlob\(filtered,label\)\)/);
  assert.match(source, /function exportBaseData\(k\)/);
  assert.match(source, /ACT\.dataExcelExport=/);
});

test('device-save action uses Android SAF first, Web Share as the mobile-wrapper fallback, then a browser download link', () => {
  const start = html.indexOf("<script>'use strict';");
  const source = html.slice(start + '<script>'.length, html.indexOf('</script>', start + '<script>'.length));
  const begin = source.indexOf('function requestBlobDownload(');
  const end = source.indexOf('\nasync function saveRecordToDevice', begin);
  const body = source.slice(begin, end);
  assert.match(body, /AndroidBridge\.saveFile/);
  assert.match(body, /window\.showSaveFilePicker/);
  assert.match(body, /navigator\.share/);
  assert.match(body, /navigator\.canShare/);
  assert.match(body, /URL\.createObjectURL/);
  assert.ok(body.indexOf('navigator.share') < body.indexOf('URL.createObjectURL'),
    'the Android share sheet must be tried before the last-resort browser download');
});

test('saved exports remain accessible from the current session when IndexedDB cannot be opened', () => {
  const start = html.indexOf("<script>'use strict';");
  const source = html.slice(start + '<script>'.length, html.indexOf('</script>', start + '<script>'.length));
  const begin = source.indexOf('async function openSavedExports()');
  const end = source.indexOf('\nACT.savedExports=', begin);
  const body = source.slice(begin, end);
  assert.match(body, /exportRecordCache\.values\(\)/);
  assert.match(body, /localExportStore\.list\(\)/);
  assert.doesNotMatch(body, /if\(!localExportStore\)return toast\(/);
});

test('export modal uses readable text on its white background', () => {
  assert.match(html, /\.mbox\{[^}]*color:#17243a/);
  assert.match(html, /\.mbox p,\.mbox \.hint\{color:#526071/);
});
