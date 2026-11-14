'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

test('Android Gradle project is defined with a compatible AGP and Gradle pair', () => {
  const settings = read('android/settings.gradle');
  const build = read('android/build.gradle');
  const app = read('android/app/build.gradle');
  assert.match(settings, /include\s+['"]:app['"]/);
  assert.match(build, /com\.android\.application.*8\.7\.3/);
  assert.match(app, /compileSdk\s+35/);
  assert.match(app, /minSdk\s+23/);
  assert.match(app, /targetSdk\s+35/);
});

test('Android package bundles the current web application instead of depending on a remote website', () => {
  const app = read('android/app/build.gradle');
  const activity = read('android/app/src/main/java/com/mrkhorasani/app/MainActivity.java');
  assert.match(app, /srcDir\s+['"]\.\.\/\.\./);
  assert.match(activity, /WebViewAssetLoader/);
  assert.match(activity, /appassets\.androidplatform\.net\/assets\/index\.html/);
});

test('native export bridge uses the Android document picker and writes the selected file', () => {
  const activity = read('android/app/src/main/java/com/mrkhorasani/app/MainActivity.java');
  const html = read('index.html');
  assert.match(activity, /ACTION_CREATE_DOCUMENT/);
  assert.match(activity, /onActivityResult/);
  assert.match(html, /AndroidBridge/);
});

test('GitHub workflow runs tests before building and uploads the debug APK', () => {
  const workflow = read('.github/workflows/android-apk.yml');
  assert.match(workflow, /node --test tests\/\*\.test\.cjs/);
  assert.match(workflow, /assembleDebug/);
  assert.match(workflow, /upload-artifact/);
  assert.ok(workflow.indexOf('node --test') < workflow.indexOf('assembleDebug'));
});
