#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { compileReality } from '../src/compiler.mjs';
import { compileRealityToBytecode, decodeBytecode } from '../src/bytecode.mjs';
import { runNativeCompiler } from '../src/native-vm.mjs';
import { createNativeUiRuntime } from '../src/ui/ui-event.mjs';
import {
  compileRclWebApplication,
  emitStandaloneRclWebHtml,
  traceNativeUiWebApplication,
} from '../src/web-application-compiler.mjs';
import {
  compileRclAndroidApplication,
  emitNativeAndroidActivity,
  traceNativeUiAndroidApplication,
} from '../src/android-application-compiler.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const compilerSource = `${read('selfhost/compiler-core.rcl')}\n${read('selfhost/compiler-main.rcl')}`;
const navigationSource = read('examples/native-ui/navigation.rcl');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-native-ui-navigation-'));
const minimumInstructionHeadroom = 180_000_000;
const declaredFixedPointBudgetMs = 240_000;

try {
  const compilerSourcePath = path.join(tempDir, 'compiler.rcl');
  const c0Path = path.join(tempDir, 'compiler-c0.rbc');
  const c1Path = path.join(tempDir, 'compiler-c1.rbc');
  const c2Path = path.join(tempDir, 'compiler-c2.rbc');
  const c0 = compileRealityToBytecode(compilerSource);
  fs.writeFileSync(compilerSourcePath, compilerSource);
  fs.writeFileSync(c0Path, c0);

  const runCompiler = (compiler, sourcePath, outputPath) => {
    const startedAt = performance.now();
    const result = runNativeCompiler(compiler, sourcePath, outputPath, {
      outputState: 'compiler.output',
      timeout: 120_000,
      maxBuffer: 64 * 1024 * 1024,
    });
    return { ...result, elapsedMs: performance.now() - startedAt };
  };
  const compileFixture = (id, source) => {
    const sourcePath = path.join(tempDir, `${id}.rcl`);
    const outputPath = path.join(tempDir, `${id}.rbc`);
    fs.writeFileSync(sourcePath, source);
    const oracle = compileRealityToBytecode(source);
    const native = runCompiler(c1Path, sourcePath, outputPath);
    if (!native.bytecode.equals(oracle)) throw new Error(`RCL_UI_NAVIGATION_DIFFERENTIAL:${id}`);
    return { oracle, native, program: compileReality(source) };
  };
  const rejectFixture = (id, source) => {
    let jsFailure = null;
    try { compileRealityToBytecode(source); }
    catch (error) { jsFailure = { name: error.name, message: error.message }; }
    if (!jsFailure) throw new Error(`RCL_UI_NAVIGATION_JS_ACCEPTED:${id}`);
    const sourcePath = path.join(tempDir, `invalid-${id}.rcl`);
    const outputPath = path.join(tempDir, `invalid-${id}.rbc`);
    fs.writeFileSync(sourcePath, source);
    let selfhostFailure = null;
    try { runCompiler(c1Path, sourcePath, outputPath); }
    catch (error) { selfhostFailure = { code: error.code ?? 'ERROR', message: error.message }; }
    if (!selfhostFailure) throw new Error(`RCL_UI_NAVIGATION_SELFHOST_ACCEPTED:${id}`);
    return { id, jsRejects: true, selfhostRejects: true, jsFailure, selfhostFailure };
  };

  const c1 = runCompiler(c0Path, compilerSourcePath, c1Path);
  const c2 = runCompiler(c1Path, compilerSourcePath, c2Path);
  if (!c1.bytecode.equals(c0) || !c2.bytecode.equals(c1.bytecode)) {
    throw new Error('RCL_UI_NAVIGATION_FIXED_POINT_MISMATCH');
  }
  const fixedPointElapsedMs = c1.elapsedMs + c2.elapsedMs;
  for (const stage of [c1, c2]) {
    if (stage.instructionBudget - stage.executedInstructions < minimumInstructionHeadroom) {
      throw new Error('RCL_UI_NAVIGATION_INSTRUCTION_HEADROOM');
    }
  }
  if (fixedPointElapsedMs >= declaredFixedPointBudgetMs) throw new Error('RCL_UI_NAVIGATION_TIME_BUDGET');

  const fixture = compileFixture('navigation', navigationSource);
  const ui = fixture.program.nativeUis[0];
  const runtime = createNativeUiRuntime(ui);
  runtime.lifecycle('create');
  const initialNavigation = runtime.projection().navigation;
  const forward = runtime.dispatch('OpenSettings', 'activate');
  const afterForward = runtime.projection().navigation;
  const back = runtime.dispatch('BackHome', 'activate');
  const finalNavigation = runtime.projection().navigation;
  if (initialNavigation.currentRoute !== 'home' || afterForward.currentRoute !== 'settings'
      || finalNavigation.currentRoute !== 'home' || runtime.state.visits !== 1
      || forward.beforeRoute !== 'home' || forward.afterRoute !== 'settings'
      || back.beforeRoute !== 'settings' || back.afterRoute !== 'home') {
    throw new Error('RCL_UI_NAVIGATION_RUNTIME_SEMANTICS');
  }

  const mutationSpecs = [
    ['initial-route', navigationSource.replace('initial home', 'initial settings')],
    ['route-identity', navigationSource.replaceAll('settings', 'preferences')],
    ['route-target-swap', navigationSource
      .replace('route home -> HomeScreen', 'route home -> SettingsScreen')
      .replace('route settings -> SettingsScreen', 'route settings -> HomeScreen')],
  ];
  const mutationEvidence = mutationSpecs.map(([id, source]) => {
    const changed = compileFixture(`mutation-${id}`, source);
    const changedUiRoot = changed.program.nativeUis[0].semanticRoot;
    if (changedUiRoot === ui.semanticRoot) throw new Error(`RCL_UI_NAVIGATION_MUTATION_ROOT:${id}`);
    return {
      id,
      uiProgramRoot: changedUiRoot,
      realityProgramRoot: changed.program.programRoot,
      rbcSha256: sha256(changed.oracle),
      jsSelfhostByteIdentical: true,
      changesUiProgramRoot: true,
    };
  });

  const withoutNavigation = navigationSource.replace(/\s+navigation \{[\s\S]*?\n\s+\}\n\n\s+view Root/u, '\n    view Root');
  const mixedAuthority = navigationSource
    .replace('reality NavigationUI {', `reality NavigationUI {
  facet app.published : Truth = false
  subject user { warrant app.publish on app }
  emergence publish { cause user when app.published == false needs app.publish on app alter app.published <- true preserve app.published == true witness "ui:publish" }`)
    .replace('navigate settings', 'navigate settings realize publish');
  const invalidSpecs = [
    ['missing-navigation', withoutNavigation],
    ['duplicate-route', navigationSource.replace('route settings -> SettingsScreen', 'route home -> SettingsScreen')],
    ['duplicate-target', navigationSource.replace('route settings -> SettingsScreen', 'route settings -> HomeScreen')],
    ['unknown-target', navigationSource.replace('route settings -> SettingsScreen', 'route settings -> MissingScreen')],
    ['unknown-route', navigationSource.replace('navigate settings', 'navigate missing')],
    ['multiple-navigation', navigationSource.replace('navigate settings', 'navigate settings navigate home')],
    ['mixed-reality-authority', mixedAuthority],
  ];
  const invalidEvidence = invalidSpecs.map(([id, source]) => rejectFixture(id, source));

  const events = [
    { nodeId: 'OpenSettings', type: 'activate' },
    { nodeId: 'BackHome', type: 'activate' },
  ];
  const web = compileRclWebApplication(navigationSource, { schema: 'rcl.native-ui.web-target.v0.1' });
  const android = compileRclAndroidApplication(navigationSource, {
    schema: 'rcl.native-ui.android-target.v0.1',
    applicationId: 'com.taowind.rcl.navigationui',
  });
  const html = emitStandaloneRclWebHtml(web);
  const java = emitNativeAndroidActivity(android);
  const webTrace = traceNativeUiWebApplication(web, events);
  const androidTrace = traceNativeUiAndroidApplication(android, events);
  const webMapsRoutes = html.includes('data-rcl-route="home"')
    && html.includes('data-rcl-route="settings"')
    && html.includes('el.hidden=el.dataset.rclRoute!==currentRoute');
  const androidMapsRoutes = java.includes('private String currentRoute = "home"')
    && java.includes('View.VISIBLE : View.GONE')
    && java.includes('String proposedRoute = currentRoute');
  if (web.uiProgramRoot !== android.uiProgramRoot || web.uiProgramRoot !== ui.semanticRoot
      || JSON.stringify(webTrace.events) !== JSON.stringify(androidTrace.events)
      || !webMapsRoutes || !androidMapsRoutes) {
    throw new Error('RCL_UI_NAVIGATION_DUAL_BACKEND');
  }

  const unsupportedDeviceAdaptation = navigationSource.replace('ui Navigator {', 'ui Navigator { device compact');
  const failClosedDeviceAdaptation = rejectFixture('device-adaptation-extension', unsupportedDeviceAdaptation);

  const report = {
    format: 'rcl.native-ui.selfhost-navigation-evidence.v0.1',
    date: '2026-08-24',
    status: 'CANDIDATE_CANONICAL_NAVIGATION_SELFHOST_SLICE_VERIFIED',
    compiler: {
      sourceSha256: sha256(compilerSource),
      sourceBytes: Buffer.byteLength(compilerSource),
      artifactSha256: sha256(c0),
      artifactBytes: c0.length,
      instructionBudgetPerRun: c1.instructionBudget,
      minimumInstructionHeadroom,
      c0ToC1ExecutedInstructions: c1.executedInstructions,
      c1ToC2ExecutedInstructions: c2.executedInstructions,
      c0ToC1InstructionHeadroom: c1.instructionBudget - c1.executedInstructions,
      c1ToC2InstructionHeadroom: c2.instructionBudget - c2.executedInstructions,
      declaredFixedPointBudgetMs,
      fixedPointElapsedMs,
      withinFixedPointBudget: true,
      c0ToC1: { elapsedMs: c1.elapsedMs, outputSha256: sha256(c1.bytecode), byteIdentical: true, peakStackDepth: c1.peakStackDepth, peakCallFrames: c1.peakCallFrames },
      c1ToC2: { elapsedMs: c2.elapsedMs, outputSha256: sha256(c2.bytecode), byteIdentical: true, peakStackDepth: c2.peakStackDepth, peakCallFrames: c2.peakCallFrames },
    },
    navigationFixture: {
      source: 'examples/native-ui/navigation.rcl',
      sourceSha256: sha256(navigationSource),
      uiProgramRoot: ui.semanticRoot,
      realityProgramRoot: fixture.program.programRoot,
      rbcSha256: sha256(fixture.oracle),
      rbcBytes: fixture.oracle.length,
      decodedSourceRoot: decodeBytecode(fixture.oracle).sourceRoot,
      jsSelfhostByteIdentical: true,
      nativeElapsedMs: fixture.native.elapsedMs,
      navigation: ui.extensionPoints.navigation,
    },
    runtimeEvidence: {
      stateAndNavigationCommitAtomically: true,
      initialNavigation,
      afterForward,
      finalNavigation,
      finalState: runtime.snapshot(),
      trace: runtime.trace,
      directRealityCommitOwnedByUi: false,
    },
    mutationEvidence,
    invalidEvidence,
    dualBackendEvidence: {
      sharedUiProgramRoot: web.uiProgramRoot,
      webLoweringRoot: web.loweringRoot,
      androidLoweringRoot: android.loweringRoot,
      semanticTracesMatch: true,
      webMapsRoutes,
      androidMapsRoutes,
      initialNavigation: webTrace.initialNavigation,
      finalNavigation: webTrace.finalNavigation,
    },
    failClosedBoundary: {
      feature: 'device adaptation declarations',
      ...failClosedDeviceAdaptation,
    },
    failedPrototypes: [
      { id: 'navigation-selfhost-uncompressed-helpers', result: 'FAIL', evidence: 'JS bootstrap OOM near 4GB heap' },
      { id: 'navigation-selfhost-zero-new-reckons-with-linear-token-buffer', result: 'FAIL', evidence: 'JS bootstrap OOM near 4GB heap' },
      { id: 'chunked-tokenizer-127', result: 'PASS', evidence: 'JS and native fixed point complete without raising Node heap' },
    ],
    gates: {
      fixedPoint: 'PASS',
      jsDifferential: 'PASS',
      nativeExecution: 'PASS',
      navigationSchemaAndValidation: 'PASS',
      atomicRuntimeNavigation: 'PASS',
      authorityBoundary: 'PASS',
      webLowering: 'PASS',
      androidLowering: 'PASS',
      aiGenerate: 'UNVERIFIED',
    },
    boundary: 'This verifies canonical in-app navigation parsing, semantic identity, self-host differential parity, atomic UI-local route transitions, fail-closed authority separation, and structural Web/Android lowering from one UI root. It is not browser performance evidence, Android-device evidence, AI_GENERATE evidence, K400 promotion, or U5 evidence. Device adaptation and accessibility remain separate generations.',
  };
  const outputPath = path.join(ROOT, 'examples', 'native-ui', 'evidence', 'selfhost-navigation-result.json');
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally {
  const resolvedTemp = path.resolve(tempDir);
  const resolvedOsTemp = path.resolve(os.tmpdir());
  if (!resolvedTemp.startsWith(`${resolvedOsTemp}${path.sep}`)) throw new Error('RCL_UI_NAVIGATION_TEMP_SCOPE');
  fs.rmSync(resolvedTemp, { recursive: true, force: true });
}
