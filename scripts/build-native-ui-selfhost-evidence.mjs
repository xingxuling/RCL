#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { compileReality } from '../src/compiler.mjs';
import { compileRealityToBytecode, decodeBytecode } from '../src/bytecode.mjs';
import { runNativeCompiler } from '../src/native-vm.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const compilerSource = `${read('selfhost/compiler-core.rcl')}\n${read('selfhost/compiler-main.rcl')}`;
const minimalSource = read('examples/selfhost-core/native-ui-minimal.rcl');
const expandedSource = read('examples/native-ui/counter.rcl');
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
  const c0 = compileRealityToBytecode(compilerSource);
  fs.writeFileSync(compilerSourcePath, compilerSource);
  fs.writeFileSync(c0Path, c0);
  fs.writeFileSync(minimalPath, minimalSource);
  fs.writeFileSync(expandedPath, expandedSource);

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
  const unsupportedEventParameter = `reality ParameterizedUI {
    ui App {
      state value : Text = ""
      view Root {
        input Field {
          bind value <- value
          on input(value : Text) { set value <- value }
        }
      }
    }
  }`;
  compileRealityToBytecode(unsupportedEventParameter);
  const unsupportedSourcePath = path.join(tempDir, 'unsupported-event-parameter.rcl');
  const unsupportedOutputPath = path.join(tempDir, 'unsupported-event-parameter.rbc');
  fs.writeFileSync(unsupportedSourcePath, unsupportedEventParameter);
  let unsupportedFailure = null;
  try { runCompiler(c1Path, unsupportedSourcePath, unsupportedOutputPath); }
  catch (error) { unsupportedFailure = { code: error.code ?? 'ERROR', message: error.message }; }
  if (!unsupportedFailure) throw new Error('RCL_UI_SELFHOST_UNSUPPORTED_EVENT_PARAMETER_MUST_FAIL_CLOSED');

  const report = {
    format: 'rcl.native-ui.selfhost-counter-evidence.v0.2',
    date: '2026-08-23',
    status: 'CANDIDATE_COUNTER_UI_SELFHOST_SLICE_VERIFIED',
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
    failClosedBoundary: {
      feature: 'typed UI event parameters',
      jsReferenceAccepts: true,
      selfhostRejects: true,
      failure: unsupportedFailure,
    },
    gates: {
      fixedPoint: 'PASS',
      jsDifferential: 'PASS',
      nativeExecution: 'PASS',
      counterNativeUiParity: 'PASS',
      aiGenerate: 'UNVERIFIED',
    },
    boundary: 'This verifies the exact Counter state, derived expression, lifecycle, theme, style, recursive view, binding, layout, accessibility and local-event semantic slice. Unsupported Native UI grammar remains fail-closed; this is not repository-wide Native UI parity, Android-device evidence or canonical promotion.',
  };
  const outputPath = path.join(ROOT, 'examples', 'native-ui', 'evidence', 'selfhost-counter-result.json');
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally {
  const resolvedTemp = path.resolve(tempDir);
  const resolvedOsTemp = path.resolve(os.tmpdir());
  if (!resolvedTemp.startsWith(`${resolvedOsTemp}${path.sep}`)) throw new Error('RCL_UI_SELFHOST_TEMP_SCOPE');
  fs.rmSync(resolvedTemp, { recursive: true, force: true });
}
