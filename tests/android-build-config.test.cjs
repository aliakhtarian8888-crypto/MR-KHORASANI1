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
  assert.ok(settings.includes('include(":app")'));
  assert.ok(build.includes("version '8.7.3'"));
  assert.ok(app.includes('compileSdk 35'));
  assert.ok(app.includes('minSdk 23'));
  assert.ok(app.includes('targetSdk 35'));
});

test('Android package bundles the current web application instead of depending on a remote website', () => {
  const app = read('android/app/build.gradle');
  const activity = read('android/app/src/main/java/com/mrkhorasani/app/MainActivity.java');
  assert.ok(app.includes("from('../../')"));
  assert.ok(activity.includes('WebViewAssetLoader'));
  assert.ok(activity.includes('/assets/index.html'));
});

test('native export bridge uses the Android document picker and writes the selected file', () => {
  const activity = read('android/app/src/main/java/com/mrkhorasani/app/MainActivity.java');
  const html = read('index.html');
  assert.ok(activity.includes('ACTION_CREATE_DOCUMENT'));
  assert.ok(activity.includes('onActivityResult'));
  assert.ok(html.includes('AndroidBridge.saveFile'));
});

test('GitHub workflow runs tests before building and uploads the debug APK', () => {
  const workflow = read('.github/workflows/android-apk.yml');
  assert.ok(workflow.includes('node --test tests/*.test.cjs'));
  assert.ok(workflow.includes('assembleDebug'));
  assert.ok(workflow.includes('upload-artifact'));
  assert.ok(workflow.indexOf('node --test') < workflow.indexOf('assembleDebug'));
});
