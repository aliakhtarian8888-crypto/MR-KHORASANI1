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
  assert.match(sw, /2\.8\.3-local-export-store/);
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
  assert.match(source, /localExportStore\.save\(name,blob\)/);
  assert.match(source, /showExportReceipt\(record,downloadRequested\)/);
  assert.match(source, /ACT\.savedExports=/);
});

test('export success is not reported as a completed device download before storage is verified', () => {
  const start = html.indexOf("<script>'use strict';");
  const codeStart = start + '<script>'.length;
  const end = html.indexOf('</script>', codeStart);
  const source = html.slice(codeStart, end);
  assert.doesNotMatch(source, /toast\('فایل اکسل در پوشهٔ دانلود ذخیره شد'\)/);
  assert.doesNotMatch(source, /toast\('فایل PDF در پوشهٔ دانلود ذخیره شد'\)/);
  assert.match(source, /فایل خروجی در حافظهٔ مرورگر ذخیره شد/);
});
