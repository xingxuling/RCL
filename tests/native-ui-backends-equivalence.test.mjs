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
const FIXED_SOURCE = fs.readFileSync(path.join(ROOT, 'examples/selfhost-core/native-ui-fixed.rcl'), 'utf8');
const NAVIGATION_SOURCE = fs.readFileSync(path.join(ROOT, 'examples/native-ui/navigation.rcl'), 'utf8');
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

test('fixed-size layout lowers from one canonical root to Web CSS and Android LayoutParams', () => {
  const web = compileRclWebApplication(FIXED_SOURCE, { schema: 'rcl.native-ui.web-target.v0.1' });
  const android = compileRclAndroidApplication(FIXED_SOURCE, {
    schema: 'rcl.native-ui.android-target.v0.1',
    applicationId: 'com.taowind.rcl.fixedui',
  });
  assert.equal(web.uiProgramRoot, android.uiProgramRoot);
  const html = emitStandaloneRclWebHtml(web);
  const java = emitNativeAndroidActivity(android);
  assert.match(html, /\[data-rcl-node="Panel"\]\{[^}]*width:320px;[^}]*height:180px/u);
  assert.match(java, /LinearLayout\.LayoutParams params_Root_Panel = new LinearLayout\.LayoutParams\(320, 180\)/u);
});

test('navigation lowers from one canonical root to Web visibility and Android native View visibility', () => {
  const events = [
    { nodeId: 'OpenSettings', type: 'activate' },
    { nodeId: 'BackHome', type: 'activate' },
  ];
  const web = compileRclWebApplication(NAVIGATION_SOURCE, { schema: 'rcl.native-ui.web-target.v0.1' });
  const android = compileRclAndroidApplication(NAVIGATION_SOURCE, {
    schema: 'rcl.native-ui.android-target.v0.1',
    applicationId: 'com.taowind.rcl.navigationui',
  });
  assert.equal(web.uiProgramRoot, android.uiProgramRoot);
  assert.deepEqual(web.ui.extensionPoints.navigation, android.ui.extensionPoints.navigation);
  const html = emitStandaloneRclWebHtml(web);
  const java = emitNativeAndroidActivity(android);
  assert.match(html, /data-rcl-route="home"/u);
  assert.match(html, /data-rcl-route="settings"/u);
  assert.match(html, /el\.hidden=el\.dataset\.rclRoute!==currentRoute/u);
  assert.match(java, /private String currentRoute = "home"/u);
  assert.match(java, /View\.VISIBLE : View\.GONE/u);
  assert.match(java, /String proposedRoute = currentRoute/u);

  const webTrace = traceNativeUiWebApplication(web, events);
  const androidTrace = traceNativeUiAndroidApplication(android, events);
  assert.deepEqual(webTrace.events, androidTrace.events);
  assert.deepEqual(webTrace.initialNavigation, { currentRoute: 'home', target: 'HomeScreen' });
  assert.deepEqual(webTrace.finalNavigation, { currentRoute: 'home', target: 'HomeScreen' });
  assert.deepEqual(webTrace.initialNavigation, androidTrace.initialNavigation);
  assert.deepEqual(webTrace.finalNavigation, androidTrace.finalNavigation);
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
