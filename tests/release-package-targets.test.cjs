'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const root = path.join(__dirname, '..');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'mrk-release-packages-'));
const fakeApk = path.join(output, 'test.apk');
const fixtureDir = path.join(output, 'fixture');
fs.mkdirSync(fixtureDir);
fs.writeFileSync(path.join(fixtureDir, 'AndroidManifest.xml'), 'test-manifest');
fs.writeFileSync(path.join(fixtureDir, 'classes.dex'), crypto.randomBytes(110_000));
execFileSync('zip', ['-qr', fakeApk, '.'], { cwd: fixtureDir });
execFileSync(process.env.PYTHON || 'python3', [
  path.join(root, 'scripts', 'package_release_targets.py'), '--output', output, '--apk', fakeApk,
], { cwd: root, stdio: 'pipe' });
const guestZip = path.join(output, 'MR-KHORASANI-GUEST-BROWSER-v2.9.9.zip');
const androidZip = path.join(output, 'MR-KHORASANI-ANDROID-INSTALL-v2.9.9.zip');
const list = file => execFileSync('unzip', ['-Z1', file], { encoding: 'utf8' }).trim().split(/\r?\n/);
const read = (file, entry) => execFileSync('unzip', ['-p', file, entry], { encoding: 'utf8' });
const readBuffer = (file, entry) => execFileSync('unzip', ['-p', file, entry]);
const pngSize = buffer => ({ width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) });
test('guest browser ZIP contains PWA, short-lived guest entry flow and only the guest QR', () => {
  const entries = list(guestZip);
  for (const name of ['index.html', 'guest.html', '.nojekyll', 'manifest.webmanifest', 'sw.js', 'guest-runtime.js', 'guest-entry-qr.png', 'README-GUEST-BROWSER-FA.txt']) assert.ok(entries.includes(name), `missing ${name}`);
  assert.ok(!entries.includes('android-install-qr.png'));
  const html = read(guestZip, 'index.html');
  assert.match(html, /GUEST_BROWSER_URL/);
  const guestPage = read(guestZip, 'guest.html');
  assert.match(guestPage, /mrk-guest-demo/);
  assert.match(guestPage, /api=issue/);
  assert.match(guestPage, /guest_session=/);
  assert.match(guestPage, /location\.replace/);
  assert.doesNotMatch(guestPage, /sessionStorage|localStorage/);
  assert.match(html, /GUEST_BROWSER_URL.*guest\.html/);
  const manifest = JSON.parse(read(guestZip, 'manifest.webmanifest'));
  assert.equal(manifest.version, '2.9.9');
});
test('Android installer ZIP contains a built APK and only the Android-install QR', () => {
  const entries = list(androidZip);
  assert.ok(entries.includes('MR-KHORASANI-2.9.9.apk'));
  assert.ok(entries.includes('android-install-qr.png'));
  assert.ok(entries.includes('README-ANDROID-INSTALL-FA.txt'));
  assert.ok(!entries.includes('index.html'));
  assert.ok(!entries.includes('guest-entry-qr.png'));
  const apk = readBuffer(androidZip, 'MR-KHORASANI-2.9.9.apk');
  assert.equal(apk.subarray(0, 2).toString(), 'PK');
});
test('the QR images are valid square PNGs', () => {
  for (const [file, name] of [[guestZip, 'guest-entry-qr.png'], [androidZip, 'android-install-qr.png']]) {
    const image = readBuffer(file, name);
    assert.equal(image.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    const size = pngSize(image);
    assert.equal(size.width, size.height);
    assert.ok(size.width >= 400);
  }
});
test('both ZIPs pass integrity checks and stay below the 5 MB delivery limit', () => {
  for (const file of [guestZip, androidZip]) {
    assert.ok(fs.statSync(file).size < 5 * 1024 * 1024);
    assert.ok(execFileSync('unzip', ['-t', file], { encoding: 'utf8' }).includes('No errors detected'));
  }
});
