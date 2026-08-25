import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildRclAndroidApplication,
  compileRclAndroidApplication,
  emitNativeAndroidActivity,
  simulateRclAndroidApplication,
} from '../src/android-application-compiler.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SOURCE = fs.readFileSync(path.join(ROOT, 'examples/universal-stress/k03-native-android-app.rcl'), 'utf8');
const SPEC = JSON.parse(fs.readFileSync(path.join(ROOT, 'examples/universal-stress/k03-native-android-app.android.json'), 'utf8'));

test('K03 compiler produces an authority-bound native Android runtime manifest', () => {
  const manifest = compileRclAndroidApplication(SOURCE, SPEC);
  assert.equal(manifest.schema, 'rcl.android-runtime-manifest.v0.1');
  assert.equal(manifest.program, 'K03NativeAndroidApp');
  assert.equal(manifest.application.applicationId, 'com.taowind.rcl.k03');
  assert.equal(manifest.rules.length, 2);
  assert.deepEqual(manifest.warrants, [{ subject: 'user', capability: 'app.write', target: 'app' }]);
  assert.match(manifest.manifestRoot, /^[0-9a-f]{64}$/u);
});

test('K03 compiler emits a native Activity with state observation, authority and lifecycle restoration', () => {
  const java = emitNativeAndroidActivity(compileRclAndroidApplication(SOURCE, SPEC));
  assert.match(java, /extends Activity/u);
  assert.match(java, /TextWatcher/u);
  assert.match(java, /RCL_ANDROID_AUTHORITY_DENIED/u);
  assert.match(java, /RCL_ANDROID_PRESERVE_FAILED:increment/u);
  assert.match(java, /onSaveInstanceState/u);
  assert.match(java, /restoreState/u);
  assert.match(java, /if \(Math\.rint\(result\) == result\) return Long\.valueOf/u);
  assert.doesNotMatch(java, /\? Long\.valueOf\(\(long\) result\) : Double\.valueOf/u);
});

test('K03 host semantic replay commits increment and reset through the same RCL transaction rules', () => {
  const manifest = compileRclAndroidApplication(SOURCE, SPEC);
  const result = simulateRclAndroidApplication(manifest, [
    { type: 'observe', path: 'app.input', value: 'first' },
    { type: 'realize', name: 'increment' },
    { type: 'realize', name: 'reset' },
  ]);
  assert.deepEqual(result.state, { 'app.count': 0, 'app.input': '', 'app.last_action': 'reset' });
  assert.equal(result.history.filter((item) => item.status === 'realized').length, 2);
});

test('K03 preserve failure closes without a partial state commit', () => {
  const manifest = compileRclAndroidApplication(SOURCE, SPEC);
  const candidate = structuredClone(manifest);
  candidate.rules[0].preserves = [{
    kind: 'binary',
    operator: '>=',
    left: { kind: 'path', path: 'app.count' },
    right: { kind: 'literal', value: 2 },
  }];
  assert.throws(
    () => simulateRclAndroidApplication(candidate, [
      { type: 'observe', path: 'app.input', value: 'blocked' },
      { type: 'realize', name: 'increment' },
    ]),
    /RCL_ANDROID_PRESERVE_FAILED:increment/u,
  );
});

test('K03 rejects a UI binding that is not declared by RCL state', () => {
  const invalid = structuredClone(SPEC);
  invalid.screen.children[1].textState = 'app.missing';
  assert.throws(() => compileRclAndroidApplication(SOURCE, invalid), /RCL_ANDROID_UNKNOWN_STATE/u);
});

test('K03 emits a complete Gradle Android project seed', () => {
  const outputPath = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k03-project-'));
  const result = buildRclAndroidApplication({
    rclPath: path.join(ROOT, 'examples/universal-stress/k03-native-android-app.rcl'),
    specPath: path.join(ROOT, 'examples/universal-stress/k03-native-android-app.android.json'),
    outputPath,
  });
  assert.equal(result.status, 'PROJECT_GENERATED');
  for (const relative of [
    'settings.gradle',
    'build.gradle',
    'app/build.gradle',
    'app/src/main/AndroidManifest.xml',
    'app/src/main/java/com/taowind/rcl/k03/MainActivity.java',
    'app/src/main/assets/program.rbc',
    'rcl.android-runtime-manifest.json',
  ]) assert.equal(fs.existsSync(path.join(outputPath, relative)), true, relative);
});
