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
  assert.match(source, /mrkhorasani8888@gmail\.com/);
  assert.match(source, /www\.aliakhtarian8888@gmail\.com/);
  assert.match(source, /mrkhorasani@gmail\.com/);
  assert.match(source, /function normalizeBackupEmail/);
  const normalize = source.match(/function normalizeBackupEmail\\(value\\)\\{[^}]+\\}/)?.[0];
  assert.ok(normalize, 'backup email migration helper must exist');
  assert.equal(vm.runInNewContext(normalize + '; normalizeBackupEmail("www.aliakhtarian8888@gmail.com")'), 'mrkhorasani8888@gmail.com');
  assert.equal(vm.runInNewContext(normalize + '; normalizeBackupEmail("mrkhorasani@gmail.com")'), 'mrkhorasani8888@gmail.com');
  assert.equal(vm.runInNewContext(normalize + '; normalizeBackupEmail("custom@example.com")'), 'custom@example.com');
});

test('manager export list supports authenticated cloud list/download/delete and local recovery by id', () => {
  const source = appSource();
  const begin = source.indexOf('async function openSavedExports()');
  const end = source.indexOf('\nACT.savedExports=', begin);
  const body = source.slice(begin, end);
  assert.match(source, /MRKCloud\.uploadManagerExport/);
  assert.match(source, /MRKCloud\.listManagerExports/);
  assert.match(source, /MRKCloud\.downloadManagerExport/);
  assert.match(source, /MRKCloud\.deleteManagerExport/);
  assert.match(source, /async function resolveLocalExportRecord\\(id\\)/);
  assert.match(body, /resolveLocalExportRecord\\(id\\)/);
  assert.match(body, /addEventListener\(['"]click['"]/);
  assert.match(body, /data-export-action="cloud-upload"/);
  assert.match(body, /data-export-action="cloud-download"/);
  assert.match(body, /data-export-action="cloud-delete"/);
  assert.match(source, /'OWNER','ADMIN'/);
  assert.match(body, /mrk-manager-exports/);
});

test('manager export storage helper is loaded and cached for offline app startup', () => {
  assert.match(html, /<script src="mrk-manager-export-storage\.js"><\/script><script src="supabase-client\.js"><\/script>/);
  assert.match(sw, /mrk-manager-export-storage\.js/);
  assert.match(release, /mrk-manager-export-storage\.js/);
});

test('backup email address is shown in the backup settings field and the system export UI exposes the private bucket path', () => {
  const source = appSource();
  assert.ok(source.includes('id="s_mail" dir="ltr" value="${esc(S.email||'));
  assert.match(source, /فضای ذخیره‌سازی مدیر سیستم/);
  assert.match(source, /mrk-manager-exports/);
  assert.match(source, /companyId\}\/exports/);
});
