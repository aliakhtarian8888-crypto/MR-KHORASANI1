'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const release = fs.readFileSync(path.join(root, 'scripts', 'package_release_targets.py'), 'utf8');
const workflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'android-apk.yml'), 'utf8');

function appSource() {
  const start = html.indexOf("<script>'use strict';");
  assert.notEqual(start, -1, 'main application script must exist');
  const codeStart = start + '<script>'.length;
  return html.slice(codeStart, html.indexOf('</script>', codeStart));
}

test('goods list displays only warehouses where the current product has non-zero stock', () => {
  const source = appSource();
  const begin = source.indexOf('function goodListHtml()');
  const end = source.indexOf('\nconst stockOf0', begin);
  const body = source.slice(begin, end);
  assert.match(body, /warehouseList\(\)\.filter\(w=>Math\.abs\(num\(stockOf0\(g\.id,w\.id\)\)\)>1e-9\)/);
  assert.match(body, /بدون موجودی/);
});

test('warehouse inventory report suppresses zero-quantity warehouse details without changing item totals', () => {
  const source = appSource();
  const begin = source.indexOf("REP.iv=R('موجودی انبارها'");
  const end = source.indexOf('\nREP.inv=', begin);
  const body = source.slice(begin, end);
  assert.match(body, /موجودی انبارها/);
  assert.match(body, /Math\.abs\(num\(a\.q\)\)>1e-9/);
  assert.match(body, /جمع تعداد/);
  assert.match(body, /جمع ارزش/);
});

test('backup email migrates only the known previous defaults to the requested address', () => {
  const source = appSource();
  assert.ok(source.includes('mrkhorasani8888@gmail.com'));
  assert.ok(source.includes('www.aliakhtarian8888@gmail.com'));
  assert.ok(source.includes('mrkhorasani@gmail.com'));
  const normalizeStart = source.indexOf('function normalizeBackupEmail(value)');
  const normalizeEnd = source.indexOf('}', normalizeStart);
  const normalize = normalizeStart >= 0 ? source.slice(normalizeStart, normalizeEnd + 1) : '';
  assert.ok(normalize, 'backup email migration helper must exist');
  assert.equal(vm.runInNewContext(normalize + '; normalizeBackupEmail("www.aliakhtarian8888@gmail.com")'), 'mrkhorasani8888@gmail.com');
  assert.equal(vm.runInNewContext(normalize + '; normalizeBackupEmail("mrkhorasani@gmail.com")'), 'mrkhorasani8888@gmail.com');
  assert.equal(vm.runInNewContext(normalize + '; normalizeBackupEmail("custom@example.com")'), 'custom@example.com');
});

test('manager export list supports authenticated cloud list/download/delete and local recovery by id', () => {
  const source = appSource();
  const begin = source.indexOf('async function openSavedExports()');
  const end = source.indexOf('ACT.savedExports=', begin);
  const body = source.slice(begin, end);
  assert.ok(source.includes('MRKCloud.uploadManagerExport'));
  assert.ok(source.includes('MRKCloud.listManagerExports'));
  assert.ok(source.includes('MRKCloud.downloadManagerExport'));
  assert.ok(source.includes('MRKCloud.deleteManagerExport'));
  assert.ok(source.includes('async function resolveLocalExportRecord(id)'));
  assert.ok(source.includes('resolveLocalExportRecord(id)'));
  assert.ok(body.includes('bindSavedExportActionButtons(m,isManager,localRows)'));
  assert.ok(body.includes('data-export-action="cloud-upload"'));
  assert.ok(body.includes('data-export-action="cloud-download"'));
  assert.ok(body.includes('data-export-action="cloud-delete"'));
  assert.ok(source.includes("['OWNER','ADMIN']"));
  assert.ok(source.includes("const MANAGER_EXPORT_BUCKET='mrk-manager-exports'"));
});

test('manager export storage helper is loaded and cached for offline app startup', () => {
  assert.match(html, /<script src="mrk-manager-export-storage\.js"><\/script><script src="supabase-client\.js"><\/script>/);
  assert.match(sw, /mrk-manager-export-storage\.js/);
  assert.match(release, /mrk-manager-export-storage\.js/);
});

test('backup email address is shown and the private manager storage address is disclosed', () => {
  const source = appSource();
  assert.ok(source.includes('id="s_mail" dir="ltr" value="${esc(S.email||'));
  assert.ok(source.includes('فضای ذخیره‌سازی مدیر سیستم'));
  assert.ok(source.includes('mrk-manager-exports'));
  assert.ok(source.includes("esc(UI.companyId)+'/exports/"));
});


test('transaction item stock details show only non-zero warehouses and preserve the total across every warehouse', () => {
  const source = appSource();
  const begin = source.indexOf('function stockTxt(g)');
  const end = source.indexOf('function stockValueOf', begin);
  const body = source.slice(begin, end);
  assert.match(body, /warehouseList\(\)\.filter\(w=>Math\.abs\(num\(stockOf\(g,w\.id\)\)\)>1e-9\)/);
  assert.match(body, /بدون موجودی در هیچ انباری/);
  assert.match(body, /warehouseList\(\)\.reduce\(\(sum,w\)=>sum\+stockOf\(g,w\.id\),0\)/);
});

test('warehouse inventory report uses the current warehouse quantity for its unit cost', () => {
  const source = appSource();
  const begin = source.indexOf("REP.iv=R('موجودی انبارها'");
  const end = source.indexOf('REP.inv=', begin);
  const body = source.slice(begin, end);
  assert.ok(body.includes('Math.abs(num(a.q))>1e-9?Math.round(num(a.v)/num(a.q)):0'));
});

test('saved-export action buttons receive direct non-bubbling click handlers', () => {
  const source = appSource();
  assert.match(source, /function bindSavedExportActionButtons\(modal,isManager,localRows\)/);
  assert.match(source, /modal\.querySelectorAll\('\[data-export-action\]'\)/);
  assert.match(source, /button\.addEventListener\('click'/);
  assert.match(source, /event\.stopPropagation\(\)/);
  assert.match(source, /performSavedExportAction\(button,modal,isManager,localRows\)/);
  assert.match(source, /bindSavedExportActionButtons\(m,isManager,localRows\)/);
});

test('manager saved-export modal provides a real bulk upload action for old local exports', () => {
  const source = appSource();
  const begin = source.indexOf('async function performSavedExportAction');
  const end = source.indexOf('async function openSavedExports()', begin);
  const actionBody = source.slice(begin, end);
  assert.match(actionBody, /cloud-upload-all/);
  assert.match(actionBody, /uploadManagerExportRecord\(/);
  assert.match(source, /data-export-action="cloud-upload-all"/);
  assert.match(source, /cloudUploadError/);
  assert.match(source, /mrk-manager-exports/);
});
