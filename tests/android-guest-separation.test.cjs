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
  assert.match(html, /async function startGuest/);
  assert.match(html, /if\(isNativeAndroidApp\(\)\)\{start\(\);return\}/);
});
test('guest QR settings are hidden in the native Android application', () => {
  assert.match(html, /if\(isNativeAndroidApp\(\)\)\{const guestTabIndex=tabs\.findIndex/);
});
test('native bridge marks the Android WebView and loads the dedicated app route', () => {
  assert.match(activity, /isNativeApp\(\)/);
  assert.match(activity, /index\.html\?mrk_android=1/);
});
test('browser guest QR is separate and the one-time guest route is still auto-issued', () => {
  assert.ok(html.includes("const GUEST_BROWSER_URL='https://aliakhtarian8888-crypto.github.io/MR-KHORASANI1/guest.html?v=2.9.8'"));
  assert.match(html, /guest-entry-qr\.png/);
  assert.match(html, /guest\.html/);
});
test('Pages deployment publishes the Android APK at the stable QR target', () => {
  assert.match(apkWorkflow, /cp dist\/MR-KHORASANI-2\.9\.8\.apk \"\$SITE\/downloads\/MR-KHORASANI-2\.9\.8\.apk\"/);
  assert.match(apkWorkflow, /name: github-pages/);
  assert.match(apkWorkflow, /deploy-pages:\s+needs: test-and-build\s+if: github\.ref == 'refs\/heads\/main'/);
  assert.match(apkWorkflow, /actions\/deploy-pages/);
});
test('release workflow packages Android APK and browser guest PWA as two distinct ZIPs', () => {
  assert.match(apkWorkflow, /MR-KHORASANI-ANDROID-INSTALL-v2\.9\.8\.zip/);
  assert.match(apkWorkflow, /MR-KHORASANI-GUEST-BROWSER-v2\.9\.8\.zip/);
  assert.match(apkWorkflow, /android-install-qr\.png/);
  assert.match(apkWorkflow, /guest-entry-qr\.png/);
});


test('guest browser URL is the dedicated static guest-entry page and the deployment publishes it', () => {
  const guestPage = path.join(root, 'guest.html');
  assert.ok(fs.existsSync(guestPage), 'dedicated guest entry page must exist at the Pages root');
  assert.ok(html.includes("const GUEST_BROWSER_URL='https://aliakhtarian8888-crypto.github.io/MR-KHORASANI1/guest.html?v=2.9.8'"));
  assert.match(apkWorkflow, /guest-entry-qr\.png[^\n]*guest\.html|guest\.html[^\n]*guest-entry-qr\.png/);
  assert.match(apkWorkflow, /cp .*guest\.html/);
});

test('dedicated guest entry creates a short-lived token and redirects to the application hash route', () => {
  const guestPage = fs.readFileSync(path.join(root, 'guest.html'), 'utf8');
  assert.match(guestPage, /mrk-guest-demo/);
  assert.match(guestPage, /api=issue/);
  assert.match(guestPage, /guest_session=/);
  assert.doesNotMatch(guestPage, /sessionStorage|localStorage/);
  assert.match(guestPage, /location\.replace/);
  assert.match(apkWorkflow, /guest-entry-qr\.png.*MR-KHORASANI1\/guest\.html/);
  assert.doesNotMatch(apkWorkflow, /guest-entry-qr\.png.*MR-KHORASANI1\/\?g=1/);
});


test('guest entry has a versioned Supabase config request and a public-key fallback when the config script cannot load', () => {
  const guestPage = fs.readFileSync(path.join(root, 'guest.html'), 'utf8');
  const config = fs.readFileSync(path.join(root, 'supabase-config.js'), 'utf8');
  assert.ok(guestPage.includes('supabase-config.js?v=2.9.8'));
  assert.ok(guestPage.includes('__MRK_SUPABASE_CONFIG_LOAD_FAILED'));
  const configKey = config.match(/publishableKey:'([^']+)'/)?.[1];
  const fallbackLine = guestPage.split(String.fromCharCode(10)).find(line => line.includes('const fallback='));
  const fallbackKey = fallbackLine?.match(/publishableKey:'([^']+)'/)?.[1];
  assert.ok(configKey, 'published Supabase config must provide a publishable key');
  assert.equal(fallbackKey, configKey, 'guest fallback key must match the active public config key');
  assert.ok(guestPage.includes('window.MRK_SUPABASE={'));
  assert.ok(guestPage.includes('const ENDPOINT=(window.MRK_SUPABASE?.url||'));
});
