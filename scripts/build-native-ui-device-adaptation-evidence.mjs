#!/usr/bin/env node
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

import { compileReality } from '../src/compiler.mjs';
import { compileRealityToBytecode, decodeBytecode } from '../src/bytecode.mjs';
import { runNativeCompiler } from '../src/native-vm.mjs';
import { createNativeUiRuntime } from '../src/ui/ui-event.mjs';
import { compileRclWebApplication, emitStandaloneRclWebHtml, traceNativeUiWebApplication } from '../src/web-application-compiler.mjs';
import { compileRclAndroidApplication, emitNativeAndroidActivity, traceNativeUiAndroidApplication } from '../src/android-application-compiler.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const readJson = (relative) => JSON.parse(read(relative));
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const compilerSource = `${read('selfhost/compiler-core.rcl')}\n${read('selfhost/compiler-main.rcl')}`;
const adaptationSource = read('examples/native-ui/device-adaptation.rcl');
const officialArtifact = fs.readFileSync(path.join(ROOT, 'selfhost/compiler.rbc'));
const implementationSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-native-ui-device-adaptation-'));
const minimumInstructionHeadroom = 180_000_000;
const declaredFixedPointBudgetMs = 240_000;

try {
  const compilerSourcePath = path.join(tempDir, 'compiler.rcl');
  const c0Path = path.join(tempDir, 'compiler-c0.rbc');
  const c1Path = path.join(tempDir, 'compiler-c1.rbc');
  const c2Path = path.join(tempDir, 'compiler-c2.rbc');
  const c0 = compileRealityToBytecode(compilerSource);
  if (!officialArtifact.equals(c0)) throw new Error('RCL_UI_DEVICE_ADAPTATION_OFFICIAL_ARTIFACT_STALE');
  fs.writeFileSync(compilerSourcePath, compilerSource);
  fs.writeFileSync(c0Path, c0);

  const runCompiler = (compiler, sourcePath, outputPath) => {
    const startedAt = performance.now();
    const result = runNativeCompiler(compiler, sourcePath, outputPath, {
      outputState: 'compiler.output', timeout: 150_000, maxBuffer: 64 * 1024 * 1024,
    });
    return { ...result, elapsedMs: performance.now() - startedAt };
  };
  const c1 = runCompiler(c0Path, compilerSourcePath, c1Path);
  const c2 = runCompiler(c1Path, compilerSourcePath, c2Path);
  if (!c1.bytecode.equals(c0) || !c2.bytecode.equals(c1.bytecode)) throw new Error('RCL_UI_DEVICE_ADAPTATION_FIXED_POINT_MISMATCH');
  const fixedPointElapsedMs = c1.elapsedMs + c2.elapsedMs;
  for (const stage of [c1, c2]) {
    if (stage.instructionBudget - stage.executedInstructions < minimumInstructionHeadroom) throw new Error('RCL_UI_DEVICE_ADAPTATION_INSTRUCTION_HEADROOM');
  }
  if (fixedPointElapsedMs >= declaredFixedPointBudgetMs) throw new Error('RCL_UI_DEVICE_ADAPTATION_TIME_BUDGET');

  const compileFixture = (id, source) => {
    const sourcePath = path.join(tempDir, `${id}.rcl`);
    const outputPath = path.join(tempDir, `${id}.rbc`);
    fs.writeFileSync(sourcePath, source);
    const oracle = compileRealityToBytecode(source);
    const native = runCompiler(c1Path, sourcePath, outputPath);
    if (!native.bytecode.equals(oracle)) throw new Error(`RCL_UI_DEVICE_ADAPTATION_DIFFERENTIAL:${id}`);
    return { oracle, native, program: compileReality(source) };
  };
  const rejectFixture = (id, source) => {
    let jsFailure = null;
    try { compileRealityToBytecode(source); } catch (error) { jsFailure = error.message; }
    if (!jsFailure) throw new Error(`RCL_UI_DEVICE_ADAPTATION_JS_ACCEPTED:${id}`);
    const sourcePath = path.join(tempDir, `invalid-${id}.rcl`);
    const outputPath = path.join(tempDir, `invalid-${id}.rbc`);
    fs.writeFileSync(sourcePath, source);
    let selfhostFailure = null;
    try { runCompiler(c1Path, sourcePath, outputPath); } catch (error) { selfhostFailure = error.message; }
    if (!selfhostFailure) throw new Error(`RCL_UI_DEVICE_ADAPTATION_SELFHOST_ACCEPTED:${id}`);
    return { id, jsRejects: true, selfhostRejects: true, jsFailure, selfhostFailure };
  };

  const fixture = compileFixture('device-adaptation', adaptationSource);
  const ui = fixture.program.nativeUis[0];
  const compact = createNativeUiRuntime(ui, { availableWidth: 320 }).projection().deviceAdaptation;
  const expanded = createNativeUiRuntime(ui, { availableWidth: 840 }).projection().deviceAdaptation;
  if (compact.profile !== 'compact' || compact.layouts.Root.mode !== 'vertical'
      || expanded.profile !== 'expanded' || expanded.layouts.Root.mode !== 'horizontal') {
    throw new Error('RCL_UI_DEVICE_ADAPTATION_RUNTIME_SEMANTICS');
  }

  const mutations = [
    ['profile-boundary', adaptationSource.replace('max_width 599', 'max_width 598')],
    ['layout-mode', adaptationSource.replace('adapt expanded layout horizontal', 'adapt expanded layout vertical')],
  ].map(([id, source]) => {
    const changed = compileFixture(`mutation-${id}`, source);
    if (changed.program.nativeUis[0].semanticRoot === ui.semanticRoot) throw new Error(`RCL_UI_DEVICE_ADAPTATION_MUTATION_ROOT:${id}`);
    return { id, uiProgramRoot: changed.program.nativeUis[0].semanticRoot, rbcSha256: sha256(changed.oracle), jsSelfhostByteIdentical: true };
  });
  const invalidEvidence = [
    ['missing-declaration', adaptationSource.replace(/\s+adaptation \{[\s\S]*?\n\s+\}\n\n\s+view Root/u, '\n    view Root')],
    ['unknown-profile', adaptationSource.replace('adapt expanded layout horizontal', 'adapt missing layout horizontal')],
    ['duplicate-layout', adaptationSource.replace('adapt expanded layout horizontal', 'adapt expanded layout horizontal\n      adapt expanded layout vertical')],
    ['overlapping-profiles', adaptationSource.replace('profile expanded min_width 600', 'profile expanded min_width 599')],
    ['unknown-default', adaptationSource.replace('default compact', 'default missing')],
  ].map(([id, source]) => rejectFixture(id, source));

  const web = compileRclWebApplication(adaptationSource, { schema: 'rcl.native-ui.web-target.v0.1' });
  const android = compileRclAndroidApplication(adaptationSource, { schema: 'rcl.native-ui.android-target.v0.1', applicationId: 'com.taowind.rcl.adaptiveui' });
  const html = emitStandaloneRclWebHtml(web);
  const java = emitNativeAndroidActivity(android);
  const compactWeb = traceNativeUiWebApplication(web, [], { availableWidth: 320 });
  const compactAndroid = traceNativeUiAndroidApplication(android, [], { availableWidth: 320 });
  const expandedWeb = traceNativeUiWebApplication(web, [], { availableWidth: 840 });
  const expandedAndroid = traceNativeUiAndroidApplication(android, [], { availableWidth: 840 });
  if (web.uiProgramRoot !== android.uiProgramRoot || web.uiProgramRoot !== ui.semanticRoot
      || JSON.stringify(compactWeb.initialDeviceAdaptation) !== JSON.stringify(compactAndroid.initialDeviceAdaptation)
      || JSON.stringify(expandedWeb.initialDeviceAdaptation) !== JSON.stringify(expandedAndroid.initialDeviceAdaptation)
      || !html.includes('@media (min-width:600px)') || !java.includes('getConfiguration().screenWidthDp')) {
    throw new Error('RCL_UI_DEVICE_ADAPTATION_DUAL_BACKEND');
  }

  const browserReceipt = readJson('examples/native-ui/evidence/device-adaptation-browser-result.json');
  const androidReceipt = readJson('examples/native-ui/evidence/device-adaptation-android-build-result.json');
  if (browserReceipt.status !== 'PASS' || androidReceipt.status !== 'BUILD_PASS_DEVICE_RUNTIME_UNVERIFIED'
      || browserReceipt.uiProgramRoot !== ui.semanticRoot || androidReceipt.uiProgramRoot !== ui.semanticRoot) {
    throw new Error('RCL_UI_DEVICE_ADAPTATION_HOST_RECEIPT_MISMATCH');
  }

  const report = {
    format: 'rcl.native-ui.selfhost-device-adaptation-evidence.v0.1',
    date: '2026-08-24',
    status: 'CANDIDATE_CANONICAL_DEVICE_ADAPTATION_SELFHOST_SLICE_VERIFIED',
    implementationSha,
    compiler: {
      sourceSha256: sha256(compilerSource), artifactSha256: sha256(c0), artifactBytes: c0.length,
      officialArtifactMatchesC0: true, instructionBudgetPerRun: c1.instructionBudget, minimumInstructionHeadroom,
      c0ToC1ExecutedInstructions: c1.executedInstructions, c1ToC2ExecutedInstructions: c2.executedInstructions,
      c0ToC1InstructionHeadroom: c1.instructionBudget - c1.executedInstructions,
      c1ToC2InstructionHeadroom: c2.instructionBudget - c2.executedInstructions,
      declaredFixedPointBudgetMs, fixedPointElapsedMs, withinFixedPointBudget: true,
      c0ToC1: { elapsedMs: c1.elapsedMs, outputSha256: sha256(c1.bytecode), byteIdentical: true, peakStackDepth: c1.peakStackDepth, peakCallFrames: c1.peakCallFrames },
      c1ToC2: { elapsedMs: c2.elapsedMs, outputSha256: sha256(c2.bytecode), byteIdentical: true, peakStackDepth: c2.peakStackDepth, peakCallFrames: c2.peakCallFrames },
    },
    fixture: { source: 'examples/native-ui/device-adaptation.rcl', sourceSha256: sha256(adaptationSource), uiProgramRoot: ui.semanticRoot, realityProgramRoot: fixture.program.programRoot, rbcSha256: sha256(fixture.oracle), rbcBytes: fixture.oracle.length, decodedSourceRoot: decodeBytecode(fixture.oracle).sourceRoot, jsSelfhostByteIdentical: true },
    runtimeEvidence: { compact, expanded },
    mutations,
    invalidEvidence,
    dualBackendEvidence: { sharedUiProgramRoot: web.uiProgramRoot, webLoweringRoot: web.loweringRoot, androidLoweringRoot: android.loweringRoot, compactTracesMatch: true, expandedTracesMatch: true },
    hostEvidence: { browser: browserReceipt, androidBuild: androidReceipt },
    failedAttempts: [
      { id: 'nested-choose-instruction-length-labels', result: 'FAIL_FIXED', evidence: 'duplicate choose_else label; assembler freshLabel now used with independent regression' },
      { id: 'android-default-java-25', result: 'FAIL_ENVIRONMENT', evidence: 'Gradle 8.10.2 rejected class major 69; declared JBR 21 build passed' },
    ],
    gates: { fixedPoint: 'PASS', jsDifferential: 'PASS', nativeExecution: 'PASS', schemaAndValidation: 'PASS', canonicalRuntime: 'PASS', realBrowserResize: 'PASS', androidBuild: 'PASS', androidDeviceRuntime: 'UNVERIFIED', aiGenerate: 'UNVERIFIED' },
    boundary: 'Canonical width-profile device adaptation is verified through parser, semantic identity, self-host fixed point, runtime projection, real Chrome computed layout and Android APK build. Android installation/configuration behavior, device timing, AI_GENERATE, K400 promotion and U5 remain unverified.',
  };
  const outputPath = path.join(ROOT, 'examples/native-ui/evidence/selfhost-device-adaptation-result.json');
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ status: report.status, outputPath: path.relative(ROOT, outputPath), implementationSha, compiler: report.compiler, uiProgramRoot: ui.semanticRoot, gates: report.gates }, null, 2));
} finally {
  const resolved = path.resolve(tempDir);
  if (!resolved.startsWith(`${path.resolve(os.tmpdir())}${path.sep}`)) throw new Error('RCL_UI_DEVICE_ADAPTATION_TEMP_SCOPE');
  fs.rmSync(resolved, { recursive: true, force: true });
}
