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
import { compileRclWebApplication, emitStandaloneRclWebHtml } from '../src/web-application-compiler.mjs';
import { compileRclAndroidApplication, emitNativeAndroidActivity } from '../src/android-application-compiler.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const compilerSource = `${read('selfhost/compiler-core.rcl')}\n${read('selfhost/compiler-main.rcl')}`;
const minimalSource = read('examples/selfhost-core/native-ui-minimal.rcl');
const expandedSource = read('examples/native-ui/counter.rcl');
const parameterizedSource = read('examples/selfhost-core/native-ui-parameterized.rcl');
const governedSource = read('examples/selfhost-core/native-ui-governed.rcl');
const fixedSource = read('examples/selfhost-core/native-ui-fixed.rcl');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-native-ui-selfhost-'));
const minimumInstructionHeadroom = 180_000_000;

try {
  const compilerSourcePath = path.join(tempDir, 'compiler.rcl');
  const c0Path = path.join(tempDir, 'compiler-c0.rbc');
  const c1Path = path.join(tempDir, 'compiler-c1.rbc');
  const c2Path = path.join(tempDir, 'compiler-c2.rbc');
  const minimalPath = path.join(tempDir, 'native-ui-minimal.rcl');
  const minimalOutputPath = path.join(tempDir, 'native-ui-minimal.rbc');
  const expandedPath = path.join(tempDir, 'native-ui-expanded.rcl');
  const expandedOutputPath = path.join(tempDir, 'native-ui-expanded.rbc');
  const parameterizedPath = path.join(tempDir, 'native-ui-parameterized.rcl');
  const parameterizedOutputPath = path.join(tempDir, 'native-ui-parameterized.rbc');
  const governedPath = path.join(tempDir, 'native-ui-governed.rcl');
  const governedOutputPath = path.join(tempDir, 'native-ui-governed.rbc');
  const fixedPath = path.join(tempDir, 'native-ui-fixed.rcl');
  const fixedOutputPath = path.join(tempDir, 'native-ui-fixed.rbc');
  const c0 = compileRealityToBytecode(compilerSource);
  fs.writeFileSync(compilerSourcePath, compilerSource);
  fs.writeFileSync(c0Path, c0);
  fs.writeFileSync(minimalPath, minimalSource);
  fs.writeFileSync(expandedPath, expandedSource);
  fs.writeFileSync(parameterizedPath, parameterizedSource);
  fs.writeFileSync(governedPath, governedSource);
  fs.writeFileSync(fixedPath, fixedSource);

  const runCompiler = (compiler, source, output) => {
    const startedAt = performance.now();
    const result = runNativeCompiler(compiler, source, output, {
      outputState: 'compiler.output',
      timeout: 120_000,
      maxBuffer: 64 * 1024 * 1024,
    });
    return { ...result, elapsedMs: performance.now() - startedAt };
  };

  const c1 = runCompiler(c0Path, compilerSourcePath, c1Path);
  const c2 = runCompiler(c1Path, compilerSourcePath, c2Path);
  if (!c1.bytecode.equals(c0) || !c2.bytecode.equals(c1.bytecode)) throw new Error('RCL_UI_SELFHOST_FIXED_POINT_MISMATCH');
  if (c1.instructionBudget - c1.executedInstructions < minimumInstructionHeadroom
      || c2.instructionBudget - c2.executedInstructions < minimumInstructionHeadroom) {
    throw new Error('RCL_UI_SELFHOST_INSTRUCTION_HEADROOM');
  }
  const fixedPointElapsedMs = c1.elapsedMs + c2.elapsedMs;
  const declaredFixedPointBudgetMs = 240_000;
  if (fixedPointElapsedMs >= declaredFixedPointBudgetMs) throw new Error('RCL_UI_SELFHOST_FIXED_POINT_TIME_BUDGET');

  const jsMinimal = compileRealityToBytecode(minimalSource);
  const nativeMinimal = runCompiler(c1Path, minimalPath, minimalOutputPath);
  if (!nativeMinimal.bytecode.equals(jsMinimal)) throw new Error('RCL_UI_SELFHOST_MINIMAL_DIFFERENTIAL_MISMATCH');
  const minimalProgram = compileReality(minimalSource);

  const jsExpanded = compileRealityToBytecode(expandedSource);
  const nativeExpanded = runCompiler(c1Path, expandedPath, expandedOutputPath);
  if (!nativeExpanded.bytecode.equals(jsExpanded)) throw new Error('RCL_UI_SELFHOST_COUNTER_DIFFERENTIAL_MISMATCH');
  const expandedProgram = compileReality(expandedSource);
  const mutationSpecs = [
    ['derived-text', '"计数：" + count', '"数量：" + count'],
    ['layout-gap', 'gap 12', 'gap 13'],
    ['theme-color', '"#172033" inherit', '"#172034" inherit'],
    ['event-increment', 'count + 1', 'count + 2'],
  ];
  const mutations = mutationSpecs.map(([id, before, after]) => {
    if (!expandedSource.includes(before)) throw new Error(`RCL_UI_SELFHOST_MUTATION_ANCHOR:${id}`);
    const source = expandedSource.replace(before, after);
    const sourcePath = path.join(tempDir, `${id}.rcl`);
    const outputPath = path.join(tempDir, `${id}.rbc`);
    fs.writeFileSync(sourcePath, source);
    const oracle = compileRealityToBytecode(source);
    const native = runCompiler(c1Path, sourcePath, outputPath);
    if (!native.bytecode.equals(oracle)) throw new Error(`RCL_UI_SELFHOST_MUTATION_DIFFERENTIAL:${id}`);
    const sourceRoot = decodeBytecode(oracle).sourceRoot;
    if (sourceRoot === expandedProgram.programRoot) throw new Error(`RCL_UI_SELFHOST_MUTATION_ROOT:${id}`);
    return { id, sourceRoot, rbcSha256: sha256(oracle), jsSelfhostByteIdentical: true };
  });
  const jsParameterized = compileRealityToBytecode(parameterizedSource);
  const nativeParameterized = runCompiler(c1Path, parameterizedPath, parameterizedOutputPath);
  if (!nativeParameterized.bytecode.equals(jsParameterized)) throw new Error('RCL_UI_SELFHOST_PARAMETERIZED_DIFFERENTIAL_MISMATCH');
  const parameterizedProgram = compileReality(parameterizedSource);
  const inferredParameterizedSource = parameterizedSource.replace('on input(value : Text)', 'on input(value)');
  const inferredParameterizedPath = path.join(tempDir, 'native-ui-parameterized-inferred.rcl');
  const inferredParameterizedOutputPath = path.join(tempDir, 'native-ui-parameterized-inferred.rbc');
  fs.writeFileSync(inferredParameterizedPath, inferredParameterizedSource);
  const jsInferredParameterized = compileRealityToBytecode(inferredParameterizedSource);
  const nativeInferredParameterized = runCompiler(c1Path, inferredParameterizedPath, inferredParameterizedOutputPath);
  if (!nativeInferredParameterized.bytecode.equals(jsInferredParameterized)
      || !jsInferredParameterized.equals(jsParameterized)) {
    throw new Error('RCL_UI_SELFHOST_PARAMETER_INFERENCE_DIFFERENTIAL_MISMATCH');
  }

  const invalidParameterSpecs = [
    ['wrong-standard-type', 'on input(value : Text)', 'on input(value : Number)'],
    ['unknown-standard-parameter', 'on input(value : Text)', 'on input(other : Text)'],
    ['duplicate-parameter', 'on input(value : Text)', 'on input(value : Text, value : Text)'],
  ];
  const invalidParameterEvidence = invalidParameterSpecs.map(([id, before, after]) => {
    const source = parameterizedSource.replace(before, after);
    let jsRejects = false;
    try { compileRealityToBytecode(source); } catch { jsRejects = true; }
    if (!jsRejects) throw new Error(`RCL_UI_SELFHOST_INVALID_PARAMETER_JS_ACCEPTED:${id}`);
    const sourcePath = path.join(tempDir, `invalid-${id}.rcl`);
    const outputPath = path.join(tempDir, `invalid-${id}.rbc`);
    fs.writeFileSync(sourcePath, source);
    let failure = null;
    try { runCompiler(c1Path, sourcePath, outputPath); }
    catch (error) { failure = { code: error.code ?? 'ERROR', message: error.message }; }
    if (!failure) throw new Error(`RCL_UI_SELFHOST_INVALID_PARAMETER_ACCEPTED:${id}`);
    return { id, jsRejects: true, selfhostRejects: true, failure };
  });

  const jsGoverned = compileRealityToBytecode(governedSource);
  const nativeGoverned = runCompiler(c1Path, governedPath, governedOutputPath);
  if (!nativeGoverned.bytecode.equals(jsGoverned)) throw new Error('RCL_UI_SELFHOST_GOVERNED_DIFFERENTIAL_MISMATCH');
  const governedProgram = compileReality(governedSource);
  const governedUi = governedProgram.nativeUis[0];
  const governedEvent = governedUi.eventGraph.events[0];
  if (governedEvent.authority !== 'reality-transaction') throw new Error('RCL_UI_SELFHOST_GOVERNED_AUTHORITY');

  const renamedRuleSource = governedSource
    .replace('emergence publish {', 'emergence publish_v2 {')
    .replace('realize publish', 'realize publish_v2');
  const renamedRulePath = path.join(tempDir, 'native-ui-governed-renamed.rcl');
  const renamedRuleOutputPath = path.join(tempDir, 'native-ui-governed-renamed.rbc');
  fs.writeFileSync(renamedRulePath, renamedRuleSource);
  const jsRenamedRule = compileRealityToBytecode(renamedRuleSource);
  const nativeRenamedRule = runCompiler(c1Path, renamedRulePath, renamedRuleOutputPath);
  if (!nativeRenamedRule.bytecode.equals(jsRenamedRule)) throw new Error('RCL_UI_SELFHOST_GOVERNED_MUTATION_DIFFERENTIAL');
  const renamedRuleProgram = compileReality(renamedRuleSource);
  if (renamedRuleProgram.nativeUis[0].semanticRoot === governedUi.semanticRoot) {
    throw new Error('RCL_UI_SELFHOST_GOVERNED_MUTATION_ROOT');
  }

  const invalidGovernedSpecs = [
    ['unknown-rule', governedSource.replace('realize publish', 'realize missing_rule')],
    ['mixed-authority', governedSource
      .replace('ui Console {', 'ui Console { state local : Truth = false')
      .replace('realize publish', 'set local <- true realize publish')],
  ];
  const invalidGovernedEvidence = invalidGovernedSpecs.map(([id, source]) => {
    let jsRejects = false;
    try { compileRealityToBytecode(source); } catch { jsRejects = true; }
    if (!jsRejects) throw new Error(`RCL_UI_SELFHOST_INVALID_GOVERNED_JS_ACCEPTED:${id}`);
    const sourcePath = path.join(tempDir, `invalid-governed-${id}.rcl`);
    const outputPath = path.join(tempDir, `invalid-governed-${id}.rbc`);
    fs.writeFileSync(sourcePath, source);
    let failure = null;
    try { runCompiler(c1Path, sourcePath, outputPath); }
    catch (error) { failure = { code: error.code ?? 'ERROR', message: error.message }; }
    if (!failure) throw new Error(`RCL_UI_SELFHOST_INVALID_GOVERNED_ACCEPTED:${id}`);
    return { id, jsRejects: true, selfhostRejects: true, failure };
  });

  const deniedRuntime = createNativeUiRuntime(governedUi);
  deniedRuntime.lifecycle('create');
  let missingGatewayFailure = null;
  try { deniedRuntime.dispatch('PublishButton', 'activate'); }
  catch (error) { missingGatewayFailure = { name: error.name, message: error.message }; }
  if (!missingGatewayFailure?.message.includes('RCL_UI_REALITY_GATEWAY_REQUIRED')) {
    throw new Error('RCL_UI_SELFHOST_GOVERNED_GATEWAY_MUST_FAIL_CLOSED');
  }
  const candidates = [];
  const governedRuntime = createNativeUiRuntime(governedUi, { realityGateway: (candidate) => candidates.push(candidate) });
  governedRuntime.lifecycle('create');
  governedRuntime.dispatch('PublishButton', 'activate');
  if (candidates.length !== 1 || candidates[0].kind !== 'CandidateReality' || candidates[0].rule !== 'publish') {
    throw new Error('RCL_UI_SELFHOST_GOVERNED_CANDIDATE_REALITY');
  }

  const jsFixed = compileRealityToBytecode(fixedSource);
  const nativeFixed = runCompiler(c1Path, fixedPath, fixedOutputPath);
  if (!nativeFixed.bytecode.equals(jsFixed)) throw new Error('RCL_UI_SELFHOST_FIXED_DIFFERENTIAL_MISMATCH');
  const fixedProgram = compileReality(fixedSource);
  const fixedUi = fixedProgram.nativeUis[0];
  const fixedPanel = fixedUi.viewTree.children[0];
  if (fixedPanel.layout.width.value !== 320 || fixedPanel.layout.height.value !== 180) {
    throw new Error('RCL_UI_SELFHOST_FIXED_LAYOUT_VALUES');
  }

  const changedFixedSource = fixedSource.replace('width fixed 320', 'width fixed 321');
  const changedFixedPath = path.join(tempDir, 'native-ui-fixed-changed.rcl');
  const changedFixedOutputPath = path.join(tempDir, 'native-ui-fixed-changed.rbc');
  fs.writeFileSync(changedFixedPath, changedFixedSource);
  const jsChangedFixed = compileRealityToBytecode(changedFixedSource);
  const nativeChangedFixed = runCompiler(c1Path, changedFixedPath, changedFixedOutputPath);
  if (!nativeChangedFixed.bytecode.equals(jsChangedFixed)) throw new Error('RCL_UI_SELFHOST_FIXED_MUTATION_DIFFERENTIAL');
  const changedFixedProgram = compileReality(changedFixedSource);
  if (changedFixedProgram.nativeUis[0].semanticRoot === fixedUi.semanticRoot) {
    throw new Error('RCL_UI_SELFHOST_FIXED_MUTATION_ROOT');
  }

  const normalizedFixedSource = fixedSource.replace('width fixed 320', 'width fixed 320.0');
  const normalizedFixedPath = path.join(tempDir, 'native-ui-fixed-normalized.rcl');
  const normalizedFixedOutputPath = path.join(tempDir, 'native-ui-fixed-normalized.rbc');
  fs.writeFileSync(normalizedFixedPath, normalizedFixedSource);
  const jsNormalizedFixed = compileRealityToBytecode(normalizedFixedSource);
  const nativeNormalizedFixed = runCompiler(c1Path, normalizedFixedPath, normalizedFixedOutputPath);
  if (!jsNormalizedFixed.equals(jsFixed) || !nativeNormalizedFixed.bytecode.equals(jsFixed)) {
    throw new Error('RCL_UI_SELFHOST_FIXED_NUMBER_NORMALIZATION');
  }

  const invalidFixedSpecs = [
    ['negative-fixed-size', fixedSource.replace('width fixed 320', 'width fixed -1')],
    ['truth-fixed-size', fixedSource.replace('width fixed 320', 'width fixed true')],
    ['unknown-size-mode', fixedSource.replace('width fixed 320', 'width elastic')],
    ['nonliteral-fixed-size', fixedSource.replace('height fixed 180', 'height fixed app.size')],
  ];
  const invalidFixedEvidence = invalidFixedSpecs.map(([id, source]) => {
    let jsRejects = false;
    try { compileRealityToBytecode(source); } catch { jsRejects = true; }
    if (!jsRejects) throw new Error(`RCL_UI_SELFHOST_INVALID_FIXED_JS_ACCEPTED:${id}`);
    const sourcePath = path.join(tempDir, `invalid-fixed-${id}.rcl`);
    const outputPath = path.join(tempDir, `invalid-fixed-${id}.rbc`);
    fs.writeFileSync(sourcePath, source);
    let failure = null;
    try { runCompiler(c1Path, sourcePath, outputPath); }
    catch (error) { failure = { code: error.code ?? 'ERROR', message: error.message }; }
    if (!failure) throw new Error(`RCL_UI_SELFHOST_INVALID_FIXED_ACCEPTED:${id}`);
    return { id, jsRejects: true, selfhostRejects: true, failure };
  });

  const fixedWeb = compileRclWebApplication(fixedSource, { schema: 'rcl.native-ui.web-target.v0.1' });
  const fixedAndroid = compileRclAndroidApplication(fixedSource, {
    schema: 'rcl.native-ui.android-target.v0.1',
    applicationId: 'com.taowind.rcl.fixedui',
  });
  const fixedHtml = emitStandaloneRclWebHtml(fixedWeb);
  const fixedJava = emitNativeAndroidActivity(fixedAndroid);
  const webMapsFixedSize = fixedHtml.includes('width:320px;height:180px');
  const androidMapsFixedSize = fixedJava.includes('new LinearLayout.LayoutParams(320, 180)');
  if (fixedWeb.uiProgramRoot !== fixedAndroid.uiProgramRoot || fixedWeb.uiProgramRoot !== fixedUi.semanticRoot
      || !webMapsFixedSize || !androidMapsFixedSize) {
    throw new Error('RCL_UI_SELFHOST_FIXED_DUAL_BACKEND');
  }

  const unsupportedExtension = fixedSource.replace('ui Frame {', 'ui Frame { resource logo = "logo.png"');
  let unsupportedJsFailure = null;
  try { compileRealityToBytecode(unsupportedExtension); }
  catch (error) { unsupportedJsFailure = { name: error.name, message: error.message }; }
  if (!unsupportedJsFailure) throw new Error('RCL_UI_SELFHOST_RESOURCE_EXTENSION_JS_MUST_FAIL_CLOSED');
  const unsupportedSourcePath = path.join(tempDir, 'unsupported-resource-extension-ui.rcl');
  const unsupportedOutputPath = path.join(tempDir, 'unsupported-resource-extension-ui.rbc');
  fs.writeFileSync(unsupportedSourcePath, unsupportedExtension);
  let unsupportedFailure = null;
  try { runCompiler(c1Path, unsupportedSourcePath, unsupportedOutputPath); }
  catch (error) { unsupportedFailure = { code: error.code ?? 'ERROR', message: error.message }; }
  if (!unsupportedFailure) throw new Error('RCL_UI_SELFHOST_RESOURCE_EXTENSION_MUST_FAIL_CLOSED');

  const report = {
    format: 'rcl.native-ui.selfhost-fixed-evidence.v0.5',
    date: '2026-08-24',
    status: 'CANDIDATE_FIXED_SIZE_UI_SELFHOST_SLICE_VERIFIED',
    compiler: {
      sourceSha256: sha256(compilerSource),
      sourceBytes: Buffer.byteLength(compilerSource),
      artifactSha256: sha256(c0),
      artifactBytes: c0.length,
      instructionBudgetPerRun: 300_000_000,
      minimumInstructionHeadroom,
      c0ToC1ExecutedInstructions: c1.executedInstructions,
      c1ToC2ExecutedInstructions: c2.executedInstructions,
      c0ToC1InstructionHeadroom: c1.instructionBudget - c1.executedInstructions,
      c1ToC2InstructionHeadroom: c2.instructionBudget - c2.executedInstructions,
      declaredFixedPointBudgetMs,
      fixedPointElapsedMs,
      withinFixedPointBudget: true,
      c0ToC1: {
        elapsedMs: c1.elapsedMs,
        outputSha256: sha256(c1.bytecode),
        byteIdentical: true,
        peakStackDepth: c1.peakStackDepth,
        peakCallFrames: c1.peakCallFrames,
      },
      c1ToC2: {
        elapsedMs: c2.elapsedMs,
        outputSha256: sha256(c2.bytecode),
        byteIdentical: true,
        peakStackDepth: c2.peakStackDepth,
        peakCallFrames: c2.peakCallFrames,
      },
    },
    minimalFixture: {
      source: 'examples/selfhost-core/native-ui-minimal.rcl',
      sourceSha256: sha256(minimalSource),
      uiProgramRoot: minimalProgram.nativeUis[0].semanticRoot,
      realityProgramRoot: minimalProgram.programRoot,
      rbcSha256: sha256(jsMinimal),
      rbcBytes: jsMinimal.length,
      decodedSourceRoot: decodeBytecode(jsMinimal).sourceRoot,
      jsSelfhostByteIdentical: true,
      nativeElapsedMs: nativeMinimal.elapsedMs,
    },
    counterFixture: {
      source: 'examples/native-ui/counter.rcl',
      sourceSha256: sha256(expandedSource),
      uiProgramRoot: expandedProgram.nativeUis[0].semanticRoot,
      realityProgramRoot: expandedProgram.programRoot,
      rbcSha256: sha256(jsExpanded),
      rbcBytes: jsExpanded.length,
      decodedSourceRoot: decodeBytecode(jsExpanded).sourceRoot,
      jsSelfhostByteIdentical: true,
      nativeElapsedMs: nativeExpanded.elapsedMs,
    },
    mutationEvidence: mutations,
    parameterizedFixture: {
      source: 'examples/selfhost-core/native-ui-parameterized.rcl',
      sourceSha256: sha256(parameterizedSource),
      uiProgramRoot: parameterizedProgram.nativeUis[0].semanticRoot,
      realityProgramRoot: parameterizedProgram.programRoot,
      rbcSha256: sha256(jsParameterized),
      rbcBytes: jsParameterized.length,
      decodedSourceRoot: decodeBytecode(jsParameterized).sourceRoot,
      explicitJsSelfhostByteIdentical: true,
      inferredSignatureNormalizesIdentically: true,
      nativeElapsedMs: nativeParameterized.elapsedMs,
      inferredNativeElapsedMs: nativeInferredParameterized.elapsedMs,
    },
    invalidParameterEvidence,
    governedFixture: {
      source: 'examples/selfhost-core/native-ui-governed.rcl',
      sourceSha256: sha256(governedSource),
      uiProgramRoot: governedUi.semanticRoot,
      realityProgramRoot: governedProgram.programRoot,
      rbcSha256: sha256(jsGoverned),
      rbcBytes: jsGoverned.length,
      decodedSourceRoot: decodeBytecode(jsGoverned).sourceRoot,
      jsSelfhostByteIdentical: true,
      authority: governedEvent.authority,
      statement: governedEvent.statements[0],
      nativeElapsedMs: nativeGoverned.elapsedMs,
    },
    governedMutationEvidence: {
      id: 'realized-rule-rename',
      uiProgramRoot: renamedRuleProgram.nativeUis[0].semanticRoot,
      realityProgramRoot: renamedRuleProgram.programRoot,
      rbcSha256: sha256(jsRenamedRule),
      jsSelfhostByteIdentical: true,
      changesUiProgramRoot: true,
    },
    invalidGovernedEvidence,
    authorityBoundary: {
      missingGatewayRejects: true,
      missingGatewayFailure,
      gatewayEmitsCandidateReality: true,
      candidate: candidates[0],
      directRealityCommitOwnedByUi: false,
    },
    fixedFixture: {
      source: 'examples/selfhost-core/native-ui-fixed.rcl',
      sourceSha256: sha256(fixedSource),
      uiProgramRoot: fixedUi.semanticRoot,
      realityProgramRoot: fixedProgram.programRoot,
      rbcSha256: sha256(jsFixed),
      rbcBytes: jsFixed.length,
      decodedSourceRoot: decodeBytecode(jsFixed).sourceRoot,
      jsSelfhostByteIdentical: true,
      width: fixedPanel.layout.width,
      height: fixedPanel.layout.height,
      nativeElapsedMs: nativeFixed.elapsedMs,
    },
    fixedMutationEvidence: {
      id: 'fixed-width-change',
      uiProgramRoot: changedFixedProgram.nativeUis[0].semanticRoot,
      realityProgramRoot: changedFixedProgram.programRoot,
      rbcSha256: sha256(jsChangedFixed),
      jsSelfhostByteIdentical: true,
      changesUiProgramRoot: true,
    },
    fixedNormalizationEvidence: {
      id: 'equivalent-number-spelling',
      sourceSpelling: '320.0',
      normalizesTo: 320,
      rbcSha256: sha256(jsNormalizedFixed),
      matchesCanonicalFixture: true,
      jsSelfhostByteIdentical: true,
    },
    invalidFixedEvidence,
    fixedDualBackendEvidence: {
      sharedUiProgramRoot: fixedWeb.uiProgramRoot,
      webLoweringRoot: fixedWeb.loweringRoot,
      androidLoweringRoot: fixedAndroid.loweringRoot,
      webMapsFixedSize,
      androidMapsFixedSize,
    },
    failClosedBoundary: {
      feature: 'resource extension declarations',
      jsReferenceAccepts: false,
      jsReferenceRejects: true,
      jsFailure: unsupportedJsFailure,
      selfhostRejects: true,
      failure: unsupportedFailure,
    },
    gates: {
      fixedPoint: 'PASS',
      jsDifferential: 'PASS',
      nativeExecution: 'PASS',
      counterNativeUiParity: 'PASS',
      parameterizedUiParity: 'PASS',
      governedUiParity: 'PASS',
      authorityBoundary: 'PASS',
      fixedSizingParity: 'PASS',
      fixedDualBackend: 'PASS',
      aiGenerate: 'UNVERIFIED',
    },
    boundary: 'This verifies the Counter, parameterized and governed slices plus fixed width/height compilation, number normalization, invalid-size rejection and dual Web/Android lowering from one UI root. The self-host compiler does not own direct reality commit authority. Navigation, resources and device-adaptation extensions remain absent and fail closed in both compilers; this is not Android-device evidence or canonical promotion.',
  };
  const outputPath = path.join(ROOT, 'examples', 'native-ui', 'evidence', 'selfhost-fixed-result.json');
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally {
  const resolvedTemp = path.resolve(tempDir);
  const resolvedOsTemp = path.resolve(os.tmpdir());
  if (!resolvedTemp.startsWith(`${resolvedOsTemp}${path.sep}`)) throw new Error('RCL_UI_SELFHOST_TEMP_SCOPE');
  fs.rmSync(resolvedTemp, { recursive: true, force: true });
}
