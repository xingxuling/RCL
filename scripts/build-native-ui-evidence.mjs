import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileReality } from '../src/compiler.mjs';
import {
  buildRclWebApplication,
  compileRclWebApplication,
  traceNativeUiWebApplication,
} from '../src/web-application-compiler.mjs';
import {
  buildRclAndroidApplication,
  compileRclAndroidApplication,
  traceNativeUiAndroidApplication,
} from '../src/android-application-compiler.mjs';
import { serializeNativeUiProgram } from '../src/ui/ui-ir.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const sourcePath = path.join(ROOT, 'examples/native-ui/counter.rcl');
const webTargetPath = path.join(ROOT, 'examples/native-ui/counter.web-target.json');
const androidTargetPath = path.join(ROOT, 'examples/native-ui/counter.android-target.json');
const evidenceDir = path.join(ROOT, 'examples/native-ui/evidence');
const outputDir = path.join(ROOT, 'output/native-ui-genome-v0.1');
const source = fs.readFileSync(sourcePath, 'utf8');
const events = [
  { nodeId: 'IncrementButton', type: 'activate' },
  { nodeId: 'IncrementButton', type: 'activate' },
  { nodeId: 'ResetButton', type: 'activate' },
];

const writeJson = (file, value) => fs.writeFileSync(path.join(evidenceDir, file), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
fs.mkdirSync(evidenceDir, { recursive: true });
fs.mkdirSync(outputDir, { recursive: true });

const program = compileReality(source);
const ui = program.nativeUis[0];
const web = compileRclWebApplication(source, {
  schema: 'rcl.native-ui.web-target.v0.1',
  title: 'RCL Native UI Counter',
  language: 'zh-CN',
  evidenceEvents: events,
});
const android = compileRclAndroidApplication(source, {
  schema: 'rcl.native-ui.android-target.v0.1',
  applicationId: 'com.taowind.rcl.nativeui',
  activity: 'MainActivity',
  title: 'RCL Native UI Counter',
  minSdk: 26,
  compileSdk: 35,
  targetSdk: 35,
});
const webTrace = traceNativeUiWebApplication(web, events);
const androidTrace = traceNativeUiAndroidApplication(android, events);
const semanticFields = (trace) => ({
  uiProgramRoot: trace.uiProgramRoot,
  initialState: trace.initialState,
  initialRenderedSemanticState: trace.initialRenderedSemanticState,
  events: trace.events,
  finalState: trace.finalState,
  finalRenderedSemanticState: trace.finalRenderedSemanticState,
});
const semanticEquivalent = JSON.stringify(semanticFields(webTrace)) === JSON.stringify(semanticFields(androidTrace));
if (!semanticEquivalent) throw new Error('RCL_UI_BACKEND_SEMANTIC_DIVERGENCE');
if (web.uiProgramRoot !== android.uiProgramRoot || web.uiProgramRoot !== ui.semanticRoot) throw new Error('RCL_UI_BACKEND_ROOT_DIVERGENCE');

fs.writeFileSync(path.join(evidenceDir, 'canonical-ui-ir.json'), serializeNativeUiProgram(ui), 'utf8');
writeJson('web-lowering-report.json', web);
writeJson('android-lowering-report.json', android);
writeJson('semantic-trace-web.json', webTrace);
writeJson('semantic-trace-android.json', androidTrace);

const webBuild = buildRclWebApplication({
  rclPath: sourcePath,
  specPath: webTargetPath,
  outputPath: path.join(outputDir, 'web/counter.html'),
});
const androidBuild = buildRclAndroidApplication({
  rclPath: sourcePath,
  specPath: androidTargetPath,
  outputPath: path.join(outputDir, 'android'),
});
const summary = {
  format: 'rcl.native-ui.evidence-summary.v0.1',
  source: 'examples/native-ui/counter.rcl',
  sourceSha256: crypto.createHash('sha256').update(source).digest('hex'),
  uiProgramRoot: ui.semanticRoot,
  webLoweringRoot: web.loweringRoot,
  androidLoweringRoot: android.loweringRoot,
  semanticEquivalent,
  events,
  finalState: webTrace.finalState,
  webBuild: { status: 'GENERATED', htmlSha256: webBuild.htmlSha256, output: 'output/native-ui-genome-v0.1/web/counter.html' },
  androidBuild: { status: androidBuild.status, coverageMode: androidBuild.coverageMode, output: 'output/native-ui-genome-v0.1/android' },
  androidGradle: 'NOT_EXECUTED_BY_THIS_GENERATOR',
  androidDevice: 'NOT_VERIFIED',
};
writeJson('evidence-summary.json', summary);
console.log(JSON.stringify(summary, null, 2));
