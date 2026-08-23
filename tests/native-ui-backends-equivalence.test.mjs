import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildRclWebApplication,
  compileRclWebApplication,
  emitStandaloneRclWebHtml,
  traceNativeUiWebApplication,
} from '../src/web-application-compiler.mjs';
import {
  buildRclAndroidApplication,
  compileRclAndroidApplication,
  emitNativeAndroidActivity,
  traceNativeUiAndroidApplication,
} from '../src/android-application-compiler.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const RCL_PATH = path.join(ROOT, 'examples/native-ui/counter.rcl');
const SOURCE = fs.readFileSync(RCL_PATH, 'utf8');
const EVENTS = [
  { nodeId: 'IncrementButton', type: 'activate' },
  { nodeId: 'IncrementButton', type: 'activate' },
  { nodeId: 'ResetButton', type: 'activate' },
];

test('Web and Android consume the exact same canonical UI root and semantic trace', () => {
  const web = compileRclWebApplication(SOURCE, { schema: 'rcl.native-ui.web-target.v0.1', evidenceEvents: EVENTS });
  const android = compileRclAndroidApplication(SOURCE, { schema: 'rcl.native-ui.android-target.v0.1', applicationId: 'com.taowind.rcl.nativeui' });
  assert.equal(web.uiProgramRoot, android.uiProgramRoot);
  const webTrace = traceNativeUiWebApplication(web, EVENTS);
  const androidTrace = traceNativeUiAndroidApplication(android, EVENTS);
  assert.deepEqual(webTrace.initialState, androidTrace.initialState);
  assert.deepEqual(webTrace.events, androidTrace.events);
  assert.deepEqual(webTrace.finalState, { count: 0 });
  assert.deepEqual(webTrace.finalRenderedSemanticState, androidTrace.finalRenderedSemanticState);
  assert.deepEqual(webTrace.lifecycle.map((item) => item.stage), ['create', 'activate', 'resume', 'suspend', 'destroy']);
});

test('Web lowering emits DOM/CSS/runtime only after canonical UI and rejects companion morphology', () => {
  const manifest = compileRclWebApplication(SOURCE, { schema: 'rcl.native-ui.web-target.v0.1', evidenceEvents: EVENTS });
  const html = emitStandaloneRclWebHtml(manifest);
  assert.match(html, /data-rcl-node="IncrementButton"/u);
  assert.match(html, /window\.RCLNativeUI/u);
  assert.match(html, /flex-direction:column/u);
  assert.match(html, /visibilitychange/u);
  assert.match(html, /pagehide/u);
  assert.throws(() => compileRclWebApplication(SOURCE, { schema: 'rcl.native-ui.web-target.v0.1', document: { tag: 'main' } }), /MORPHOLOGY_FORBIDDEN/u);
});

test('Android lowering emits native Views/lifecycle from canonical UI and rejects Android-only screen AST', () => {
  const manifest = compileRclAndroidApplication(SOURCE, { schema: 'rcl.native-ui.android-target.v0.1', applicationId: 'com.taowind.rcl.nativeui' });
  const java = emitNativeAndroidActivity(manifest);
  assert.match(java, /RCL_UI_PROGRAM_ROOT/u);
  assert.match(java, /new LinearLayout\(this\)/u);
  assert.match(java, /IncrementButton.*activate/u);
  assert.match(java, /onSaveInstanceState/u);
  assert.match(java, /onStart\(\)/u);
  assert.throws(() => compileRclAndroidApplication(SOURCE, { schema: 'rcl.native-ui.android-target.v0.1', applicationId: 'com.taowind.rcl.nativeui', screen: {} }), /MORPHOLOGY_FORBIDDEN/u);
});

test('both native UI backends generate inspectable standalone project artifacts', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-native-ui-'));
  const web = buildRclWebApplication({ rclPath: RCL_PATH, specPath: null, outputPath: path.join(root, 'web/counter.html') });
  const android = buildRclAndroidApplication({ rclPath: RCL_PATH, specPath: null, outputPath: path.join(root, 'android') });
  assert.equal(fs.existsSync(web.outputPath), true);
  assert.equal(android.status, 'PROJECT_GENERATED');
  assert.equal(android.coverageMode, 'native-semantic-candidate');
  assert.equal(fs.existsSync(android.activitySource), true);
});
