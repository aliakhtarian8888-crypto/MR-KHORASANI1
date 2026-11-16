const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const activity = fs.readFileSync(path.join(root, 'android/app/src/main/java/com/mrkhorasani/app/MainActivity.java'), 'utf8');
const pagesWorkflow = fs.readFileSync(path.join(root, '.github/workflows/android-apk.yml'), 'utf8');
const apkWorkflow = fs.readFileSync(path.join(root, '.github/workflows/android-apk.yml'), 'utf8');

test('native Android starts at organization login and cannot enter the guest session flow', () => {
  assert.match(html, /function isNativeAndroidApp\(\)/);
  assert.match(html, /if\(isNativeAndroidApp\(\)\)\{[\s\S]{0,220}start\(\);return\}/);
  assert.match(html, /async function startGuest\(entryToken\)\{if\(isNativeAndroidApp\(\)\)/);
});
test('guest QR settings are hidden in the native Android application', () => {
  assert.match(html, /if\(isNativeAndroidApp\(\)\)\{const guestTabIndex=tabs\.findIndex/);
});
test('native bridge marks the Android WebView and loads the dedicated app route', () => {
  assert.match(activity, /isNativeApp\(\)/);
  assert.match(activity, /index\.html\?mrk_android=1/);
});
test('browser guest QR is separate and the one-time guest route is still auto-issued', () => {
  assert.match(html, /GUEST_BROWSER_URL\s*=\s*'https:\/\/aliakhtarian8888-crypto\.github\.io\/MR-KHORASANI1\/\?g=1'/);
  assert.match(html, /guest-entry-qr\.png/);
  assert.match(html, /readEntry\(location\)\?\.autoStartGuest/);
});
test('Pages deployment publishes the Android APK at the stable QR target', () => {
  assert.match(apkWorkflow, /cp dist\/MR-KHORASANI-2\.9\.4\.apk \"\$SITE\/downloads\/MR-KHORASANI-2\.9\.4\.apk\"/);
  assert.match(apkWorkflow, /name: github-pages/);
  assert.match(apkWorkflow, /deploy-pages:\s+needs: test-and-build/);
  assert.match(apkWorkflow, /actions\/deploy-pages/);
});
test('release workflow packages Android APK and browser guest PWA as two distinct ZIPs', () => {
  assert.match(apkWorkflow, /MR-KHORASANI-ANDROID-INSTALL-v2\.9\.4\.zip/);
  assert.match(apkWorkflow, /MR-KHORASANI-GUEST-BROWSER-v2\.9\.4\.zip/);
  assert.match(apkWorkflow, /android-install-qr\.png/);
  assert.match(apkWorkflow, /guest-entry-qr\.png/);
});
