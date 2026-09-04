import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assessRclApplicationFrameworkCatalog,
  buildRclApplicationFramework,
  compileRclApplicationFramework,
  getRclApplicationFramework,
  listRclApplicationFrameworks,
  normalizeRclApplicationFrameworkSpec,
  traceRclApplicationFramework,
  verifyRclApplicationFrameworkBuild,
} from '../src/index.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SOURCE = fs.readFileSync(path.join(ROOT, 'examples/native-ui/counter.rcl'), 'utf8');

test('application framework archaeology exposes bounded ownership classifications', () => {
  const assessment = assessRclApplicationFrameworkCatalog();
  assert.equal(assessment.status, 'CANDIDATE_ONLY');
  assert.equal(assessment.classifications.FRAMEWORK_CANDIDATE, 1);
  assert.ok(assessment.classifications.STD_CANDIDATE >= 1);
  assert.ok(assessment.classifications.PACK_CANDIDATE >= 1);
  assert.ok(assessment.classifications.AUXILIARY_PROVIDER >= 1);
  assert.ok(assessment.classifications.RCL_GAP >= 1);
  assert.deepEqual(assessment.frameworkCandidates, ['rcl.ui.native-app.v0.1']);
  assert.match(assessment.root, /^[0-9a-f]{64}$/u);
});

test('catalog reads are cloned and do not mutate the candidate registry', () => {
  const framework = getRclApplicationFramework('rcl.ui.native-app.v0.1');
  framework.developerValue.push('mutated');
  assert.equal(getRclApplicationFramework('rcl.ui.native-app.v0.1').developerValue.includes('mutated'), false);
  assert.equal(listRclApplicationFrameworks({ classification: 'RCL_GAP' }).every(item => item.classification === 'RCL_GAP'), true);
});

test('native application framework compiles one canonical UI root to selected targets', () => {
  const spec = normalizeRclApplicationFrameworkSpec({
    appId: 'counter',
    title: 'Counter',
    targets: ['web', 'android'],
  });
  const compiled = compileRclApplicationFramework(SOURCE, spec);
  assert.equal(compiled.status, 'CANDIDATE_ONLY');
  assert.equal(compiled.targets.web.schema, 'rcl.native-ui.web-lowering.v0.1');
  assert.equal(compiled.targets.android.schema, 'rcl.native-ui.android-lowering.v0.1');
  assert.equal(compiled.targets.web.uiProgramRoot, compiled.targets.android.uiProgramRoot);
  assert.equal(compiled.uiProgramRoot, compiled.targets.web.uiProgramRoot);
  assert.equal(compiled.targets.android.application.applicationId, 'org.rcl.counter');
  assert.match(compiled.root, /^[0-9a-f]{64}$/u);
});

test('framework trace proves host semantic parity while preserving execution boundaries', () => {
  const compiled = compileRclApplicationFramework(SOURCE, {
    appId: 'counter',
    traceEvents: [
      { nodeId: 'IncrementButton', type: 'activate' },
      { nodeId: 'ResetButton', type: 'activate' },
    ],
  });
  const trace = traceRclApplicationFramework(compiled);
  assert.equal(trace.status, 'PASS');
  assert.equal(trace.semanticParity, true);
  assert.equal(trace.evidenceLevel, 'HOST_SEMANTIC_REPLAY');
  assert.equal(trace.externalRuntimeExecuted, false);
  assert.equal(trace.physicalDeviceExecuted, false);
  assert.equal(trace.traces.web.events.length, 2);
  assert.equal(trace.traces.android.events.length, 2);
  assert.deepEqual(trace.traces.web.finalState, { count: 0 });
  assert.deepEqual(trace.traces.android.finalState, { count: 0 });
  assert.match(trace.root, /^[0-9a-f]{64}$/u);
});

test('framework selection fails closed for unsupported or empty target sets', () => {
  assert.throws(() => normalizeRclApplicationFrameworkSpec({ frameworkId: 'rcl.forge.domain.v0.1' }), /RCL_APPLICATION_FRAMEWORK_UNKNOWN/u);
  assert.throws(() => normalizeRclApplicationFrameworkSpec({ targets: [] }), /RCL_APPLICATION_FRAMEWORK_TARGETS_EMPTY/u);
  assert.throws(() => normalizeRclApplicationFrameworkSpec({ targets: ['ios'] }), /RCL_APPLICATION_FRAMEWORK_TARGET:ios/u);
  assert.throws(() => compileRclApplicationFramework(SOURCE, { targets: ['web'], web: { document: { tag: 'main' } } }), /RCL_UI_BACKEND_MORPHOLOGY_FORBIDDEN:web/u);
});

test('application framework builder writes inspectable multi-target candidate artifacts', () => {
  const outputPath = fs.mkdtempSync(path.join(ROOT, 'output', 'test-application-framework-'));
  const result = buildRclApplicationFramework({
    rclPath: path.join(ROOT, 'examples/native-ui/counter.rcl'),
    outputPath,
  });
  assert.equal(result.status, 'CANDIDATE_ARTIFACTS_GENERATED');
  assert.equal(result.traceStatus, 'PASS');
  for (const relative of [
    'program.rcl',
    'application-framework.json',
    'application-framework-build.json',
    'semantic-trace.json',
    'web/lowering.json',
    'web/index.html',
    'web/server.mjs',
    'android/lowering.json',
    'android/MainActivity.java',
    'README.md',
  ]) assert.equal(fs.existsSync(path.join(outputPath, relative)), true, relative);
  assert.equal(JSON.parse(fs.readFileSync(path.join(outputPath, 'semantic-trace.json'), 'utf8')).externalRuntimeExecuted, false);
  assert.match(fs.readFileSync(path.join(outputPath, 'web', 'index.html'), 'utf8'), /window\.RCLNativeUI/u);
  assert.match(fs.readFileSync(path.join(outputPath, 'android', 'MainActivity.java'), 'utf8'), /extends Activity/u);
  const verified = verifyRclApplicationFrameworkBuild(outputPath);
  assert.equal(verified.status, 'PASS');
  assert.deepEqual(verified.errors, []);
  assert.equal(verified.evidenceLevel, 'STATIC_ARTIFACT_VERIFY');

  const tamperedPath = path.join(outputPath, 'application-framework.json');
  const tampered = JSON.parse(fs.readFileSync(tamperedPath, 'utf8'));
  tampered.targets.web.loweringRoot = '0'.repeat(64);
  fs.writeFileSync(tamperedPath, `${JSON.stringify(tampered, null, 2)}\n`, 'utf8');
  const failed = verifyRclApplicationFrameworkBuild(outputPath);
  assert.equal(failed.status, 'FAIL');
  assert.ok(failed.errors.includes('TARGET_ROOT:web'));
});

test('CLI exposes framework discovery and candidate artifact generation', () => {
  const list = JSON.parse(execFileSync(process.execPath, ['src/cli.mjs', 'application-frameworks'], {
    cwd: ROOT,
    encoding: 'utf8',
  }));
  assert.equal(list.assessment.status, 'CANDIDATE_ONLY');
  assert.deepEqual(list.assessment.frameworkCandidates, ['rcl.ui.native-app.v0.1']);

  const outputPath = fs.mkdtempSync(path.join(ROOT, 'output', 'cli-application-framework-'));
  const built = JSON.parse(execFileSync(process.execPath, [
    'src/cli.mjs',
    'application-framework-build',
    path.join(ROOT, 'examples/native-ui/counter.rcl'),
    outputPath,
  ], {
    cwd: ROOT,
    encoding: 'utf8',
  }));
  assert.equal(built.status, 'CANDIDATE_ARTIFACTS_GENERATED');
  assert.equal(built.traceStatus, 'PASS');
  assert.equal(built.evidenceBoundary.browserSession, 'NOT_RUN');
  assert.equal(fs.existsSync(path.join(outputPath, 'application-framework-build.json')), true);

  const verified = JSON.parse(execFileSync(process.execPath, [
    'src/cli.mjs',
    'application-framework-verify',
    outputPath,
  ], {
    cwd: ROOT,
    encoding: 'utf8',
  }));
  assert.equal(verified.status, 'PASS');
  assert.equal(verified.evidenceLevel, 'STATIC_ARTIFACT_VERIFY');
});
