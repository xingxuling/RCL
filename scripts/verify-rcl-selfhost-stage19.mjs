#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { compileReality } from '../src/compiler.mjs';
import { compileRealityToBytecode, decodeBytecode } from '../src/bytecode.mjs';
import { runReality } from '../src/runtime.mjs';
import { runNativeBytecode } from '../src/native-vm.mjs';
import { canonicalReality } from '../src/canonical.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const rclPath = path.join(root, 'selfhost', 'rcl-runtime-root-hashing-builtin-stage19.rcl');
const outputDir = path.join(root, 'output', 'selfhost');
const outputPath = path.join(outputDir, 'stage19-verification.json');
const interpreterArtifactPath = path.join(outputDir, 'stage19-runtime-root-hashing-builtin.rbc');
const targetRbcPath = path.join(outputDir, 'stage19-runtime-root-hashing-target.rbc');
const jsReferenceTargetRbcPath = path.join(outputDir, 'stage19-runtime-root-hashing-target-js-reference.rbc');

const targetSource = `reality RuntimeTransactionTarget {
  facet world.ready : Truth = true
  facet world.status : Text = "draft"
  subject founder {
    warrant world.publish on world
  }
  emergence publish {
    cause founder
    when world.ready
    needs world.publish on world
    alter world.status <- "published"
    preserve world.status == "published"
    witness "rcl:stage15:published"
  }
  foresee publish
  realize publish
}
`;

function sha256(buffer) {
  return crypto.createHash('sha256').update(Buffer.from(buffer)).digest('hex');
}

function sha256Text(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function instructionNames(decoded) {
  return decoded.instructions.map(instruction => instruction.name);
}

function hasTransactionRecordShape(record, expectedKind, expectedMode, expectedStatus) {
  return record?.kind === expectedKind
    && record?.rule === 'publish'
    && record?.mode === expectedMode
    && record?.status === expectedStatus
    && record?.actor === 'founder'
    && record?.changes?.length === 1
    && record.changes[0].target === 'world.status'
    && record.changes[0].before === 'draft'
    && record.changes[0].after === 'published'
    && record?.authority?.needs?.[0]?.capability === 'world.publish'
    && record?.authority?.needs?.[0]?.target === 'world'
    && record?.authority?.activeWarrants?.[0]?.subject === 'founder'
    && record?.authority?.activeWarrants?.[0]?.capability === 'world.publish'
    && record?.authority?.activeWarrants?.[0]?.target === 'world'
    && record?.witnesses?.[0] === 'rcl:stage15:published';
}

const rclSource = fs.readFileSync(rclPath, 'utf8');
const interpreterArtifact = Buffer.from(compileRealityToBytecode(rclSource));
const interpreterRun = runNativeBytecode(interpreterArtifact, { maxBuffer: 32 * 1024 * 1024 });
const state = interpreterRun.state;
const targetRbc = Buffer.from(state['target.rbc_bytes']);
const jsReferenceTargetRbc = Buffer.from(compileRealityToBytecode(targetSource));
const decodedInterpreter = decodeBytecode(interpreterArtifact);
const decodedTarget = decodeBytecode(targetRbc);
const decodedJsReferenceTarget = decodeBytecode(jsReferenceTargetRbc);
const targetNativeRun = runNativeBytecode(targetRbc, { maxBuffer: 32 * 1024 * 1024 });
const targetJsRun = await runReality(targetSource);
const targetCompiled = compileReality(targetSource);
const targetInstructionNames = instructionNames(decodedTarget);
const interpreterInstructionNames = instructionNames(decodedInterpreter);
const nativeProjection = targetNativeRun.projections[0];
const nativeHistory = targetNativeRun.history[0];
const jsProjection = targetJsRun.projections[0];
const jsHistory = targetJsRun.history[0];
const expectedBeforePreimage = canonicalReality({ 'world.ready': true, 'world.status': 'draft' });
const expectedAfterPreimage = canonicalReality({ 'world.ready': true, 'world.status': 'published' });
const rclBeforePreimages = [
  state['runtime.before_root_preimage'],
  state['runtime.projection_before_root_preimage'],
  state['runtime.history_before_root_preimage'],
];
const rclAfterPreimages = [
  state['runtime.after_root_preimage'],
  state['runtime.projection_after_root_preimage'],
  state['runtime.history_after_root_preimage'],
];
const rclBeforeRoots = [
  state['runtime.before_root'],
  state['runtime.projection_before_root'],
  state['runtime.history_before_root'],
];
const rclAfterRoots = [
  state['runtime.after_root'],
  state['runtime.projection_after_root'],
  state['runtime.history_after_root'],
];

const checks = {
  interpreterRunsInNativeVm: interpreterRun.status === 'ok'
    && state['selfhost.stage_status'] === 'RCL_OWNED_RUNTIME_ROOT_HASHING_BUILTIN_SUBSET_VERIFIED',
  rclGeneratedTargetRbcMatchesJsCompiler: targetRbc.equals(jsReferenceTargetRbc)
    && sha256(targetRbc) === sha256(jsReferenceTargetRbc),
  decodedTargetShapeMatches: decodedTarget.format === 'rcl.bytecode.v1'
    && decodedTarget.program === 'RuntimeTransactionTarget'
    && decodedTarget.sourceRoot === targetCompiled.programRoot
    && decodedTarget.instructions.length === 34
    && JSON.stringify(decodedTarget.instructions) === JSON.stringify(decodedJsReferenceTarget.instructions)
    && JSON.stringify(decodedTarget.numbers) === JSON.stringify([]),
  targetActuallyUsesTransactionRuntimeSurface: [
    'GRANT_WARRANT',
    'BEGIN_TX',
    'CHECK_WARRANT',
    'STAGE_STORE',
    'SET_PROJECTED_VIEW',
    'CHECK_PRESERVE',
    'RECORD_WITNESS',
    'COMMIT_TX',
  ].every(name => targetInstructionNames.includes(name))
    && targetInstructionNames.at(-1) === 'HALT',
  rclInterpreterStateMatchesNativeRuntime: state['runtime.world_ready'] === true
    && state['runtime.world_status'] === 'published'
    && state['runtime.projection_count'] === 1
    && state['runtime.history_count'] === 1
    && state['runtime.projection_status'] === 'published'
    && state['runtime.history_status'] === 'published'
    && state['runtime.warrant_count'] === 1
    && state['runtime.preserve_count'] === 2
    && targetNativeRun.status === 'ok'
    && targetNativeRun.state['world.ready'] === state['runtime.world_ready']
    && targetNativeRun.state['world.status'] === state['runtime.world_status']
    && targetNativeRun.projections.length === state['runtime.projection_count']
    && targetNativeRun.history.length === state['runtime.history_count']
    && nativeProjection?.projectedState?.['world.status'] === state['runtime.projection_status']
    && nativeHistory?.changes?.[0]?.after === state['runtime.history_status'],
  rclInterpreterStateMatchesJsRuntime: targetJsRun.state['world.ready'] === state['runtime.world_ready']
    && targetJsRun.state['world.status'] === state['runtime.world_status']
    && targetJsRun.projections.length === state['runtime.projection_count']
    && targetJsRun.history.length === state['runtime.history_count']
    && jsProjection?.projectedState?.['world.status'] === state['runtime.projection_status']
    && jsHistory?.changes?.[0]?.after === state['runtime.history_status'],
  nativeDirectTransactionRecordShapeMatches: hasTransactionRecordShape(
    nativeProjection,
    'Projection',
    'foresee',
    'projected',
  )
    && hasTransactionRecordShape(nativeHistory, 'Transition', 'realize', 'realized')
    && nativeProjection.projectedState['world.ready'] === true
    && nativeProjection.projectedState['world.status'] === 'published',
  jsRuntimeTransactionRecordShapeMatches: hasTransactionRecordShape(
    jsProjection,
    'Projection',
    'foresee',
    'projected',
  )
    && hasTransactionRecordShape(jsHistory, 'Transition', 'realize', 'realized')
    && jsProjection.projectedState['world.ready'] === true
    && jsProjection.projectedState['world.status'] === 'published',
  rclCanonicalPreimagesMatchReferenceCanonicalReality: rclBeforePreimages.every(value => value === expectedBeforePreimage)
    && rclAfterPreimages.every(value => value === expectedAfterPreimage),
  rclPreimageHashesMatchRclEmittedRoots: rclBeforeRoots.every(root => root === sha256Text(expectedBeforePreimage))
    && rclAfterRoots.every(root => root === sha256Text(expectedAfterPreimage)),
  rclRootValuesMatchNativeAndJsHistoryRoots: rclBeforeRoots.every(root => root === nativeProjection.beforeRoot && root === nativeHistory.beforeRoot && root === jsProjection.beforeRoot && root === jsHistory.beforeRoot)
    && rclAfterRoots.every(root => root === nativeProjection.afterRoot && root === nativeHistory.afterRoot && root === jsProjection.afterRoot && root === jsHistory.afterRoot),
  nativeAndJsRootPreimagesMatchProjectedState: canonicalReality(nativeProjection.projectedState) === expectedAfterPreimage
    && canonicalReality(jsProjection.projectedState) === expectedAfterPreimage
    && nativeProjection.beforeRoot === sha256Text(expectedBeforePreimage)
    && nativeProjection.afterRoot === sha256Text(expectedAfterPreimage)
    && nativeHistory.beforeRoot === sha256Text(expectedBeforePreimage)
    && nativeHistory.afterRoot === sha256Text(expectedAfterPreimage),
  decodedInterpreterContainsTransactionRuntime: interpreterInstructionNames.includes('CALL')
    && interpreterInstructionNames.includes('RETURN')
    && interpreterInstructionNames.includes('LOAD_STATE')
    && interpreterInstructionNames.includes('JUMP_IF_FALSE')
    && interpreterInstructionNames.includes('CHECK_PRESERVE')
    && decodedInterpreter.instructions.some(instruction => instruction.builtin === 'SEQUENCE_GET')
    && decodedInterpreter.instructions.some(instruction => instruction.builtin === 'SEQUENCE_APPEND'),
  decodedInterpreterCallsSha256TextBuiltin: decodedInterpreter.instructions.some(instruction => instruction.name === 'CALL_BUILTIN' && instruction.builtin === 'SHA256_TEXT' && instruction.b === 1),
  rclComputedRootsAreNotLiteralOnly: state['runtime.before_root'] === sha256Text(state['runtime.before_root_preimage'])
    && state['runtime.after_root'] === sha256Text(state['runtime.after_root_preimage'])
    && decodedInterpreter.instructions.filter(instruction => instruction.builtin === 'SHA256_TEXT').length >= 2,
  boundaryHonest: state['selfhost.boundary'] === 'single_rule_transaction_root_hashing_builtin_subset_not_complete_pure_rcl_runtime'
    && state['gate.rcl_owned_runtime_subset'] === true
    && state['gate.rcl_owned_runtime_transaction_subset'] === true
    && state['gate.rcl_owned_runtime_history_root_preimage_subset'] === true
    && state['gate.rcl_owned_runtime_root_hashing_builtin_subset'] === true
    && state['gate.rcl_owned_runtime_root_hashing_complete'] === false
    && state['gate.rcl_owned_runtime_complete'] === false
    && state['gate.native_vm_host_still_required'] === true,
};

const payload = {
  ok: Object.values(checks).every(Boolean),
  format: 'rcl.selfhost.stage19.verification.v1',
  rclFile: path.relative(root, rclPath).replaceAll(path.sep, '/'),
  interpreterArtifactFile: path.relative(root, interpreterArtifactPath).replaceAll(path.sep, '/'),
  targetRbcFile: path.relative(root, targetRbcPath).replaceAll(path.sep, '/'),
  jsReferenceTargetRbcFile: path.relative(root, jsReferenceTargetRbcPath).replaceAll(path.sep, '/'),
  stageStatus: state['selfhost.stage_status'],
  selfHostClaim: state['selfhost.claim'],
  checks,
  interpreterArtifact: {
    program: decodedInterpreter.program,
    bytes: interpreterArtifact.length,
    sha256: sha256(interpreterArtifact),
    instructionCount: decodedInterpreter.instructions.length,
  },
  targetBytecode: {
    program: decodedTarget.program,
    bytes: targetRbc.length,
    sha256: sha256(targetRbc),
    jsReferenceSha256: sha256(jsReferenceTargetRbc),
    exactJsReferenceMatch: targetRbc.equals(jsReferenceTargetRbc),
    sourceRoot: decodedTarget.sourceRoot,
    strings: decodedTarget.strings,
    numbers: decodedTarget.numbers,
    instructionPlan: {
      ops: state['target.rbc_instruction_ops'],
      a: state['target.rbc_instruction_a_values'],
      b: state['target.rbc_instruction_b_values'],
      c: state['target.rbc_instruction_c_values'],
    },
    instructions: decodedTarget.instructions.map(instruction => ({
      index: instruction.index,
      op: instruction.op,
      name: instruction.name,
      a: instruction.a,
      b: instruction.b,
      c: instruction.c,
    })),
  },
  runtimeComparison: {
    rclInterpreter: {
      worldReady: state['runtime.world_ready'],
      worldStatus: state['runtime.world_status'],
      projectionCount: state['runtime.projection_count'],
      historyCount: state['runtime.history_count'],
      projectionStatus: state['runtime.projection_status'],
      historyStatus: state['runtime.history_status'],
      warrantCount: state['runtime.warrant_count'],
      preserveCount: state['runtime.preserve_count'],
      beforeRootPreimage: state['runtime.before_root_preimage'],
      afterRootPreimage: state['runtime.after_root_preimage'],
      projectionBeforeRootPreimage: state['runtime.projection_before_root_preimage'],
      projectionAfterRootPreimage: state['runtime.projection_after_root_preimage'],
      historyBeforeRootPreimage: state['runtime.history_before_root_preimage'],
      historyAfterRootPreimage: state['runtime.history_after_root_preimage'],
      beforeRoot: state['runtime.before_root'],
      afterRoot: state['runtime.after_root'],
      projectionBeforeRoot: state['runtime.projection_before_root'],
      projectionAfterRoot: state['runtime.projection_after_root'],
      historyBeforeRoot: state['runtime.history_before_root'],
      historyAfterRoot: state['runtime.history_after_root'],
      stackCount: state['runtime.stack_count'],
      stateKeys: state['runtime.state_keys'],
      stateValues: state['runtime.state_values'],
      finalPc: state['runtime.final_pc'],
    },
    nativeDirect: {
      status: targetNativeRun.status,
      state: targetNativeRun.state,
      projections: targetNativeRun.projections,
      history: targetNativeRun.history,
      instructions: targetNativeRun.metrics.instructions,
      warrants: targetNativeRun.metrics.warrants,
    },
    jsReference: {
      state: targetJsRun.state,
      projections: targetJsRun.projections,
      history: targetJsRun.history,
    },
  },
  boundaries: {
    implementedNow: 'A native-running RCL artifact interprets the Stage-15 authorized transaction subset, emits canonical before/after state preimages, and computes the projection/history root values by calling the SHA256_TEXT bytecode builtin inside the artifact execution path.',
    notYetImplemented: 'SHA256_TEXT is a VM builtin implemented by the JS/native host runtimes, not a pure RCL SHA-256 algorithm or full root runtime. This is not arbitrary canonical serialization, not complete error-path/provider parity, and not a complete RCL-owned runtime.',
    nextTarget: state['selfhost.next_rewrite_target'],
  },
  roots: {
    interpreterStateRoot: interpreterRun.stateRoot,
    interpreterProgramRoot: interpreterRun.programRoot,
    targetProgramRoot: targetCompiled.programRoot,
    expectedBeforePreimage,
    expectedAfterPreimage,
    expectedBeforeRoot: sha256Text(expectedBeforePreimage),
    expectedAfterRoot: sha256Text(expectedAfterPreimage),
    rclBeforePreimages,
    rclAfterPreimages,
    rclBeforeRoots,
    rclAfterRoots,
    native: {
      projectionBeforeRoot: nativeProjection.beforeRoot,
      projectionAfterRoot: nativeProjection.afterRoot,
      historyBeforeRoot: nativeHistory.beforeRoot,
      historyAfterRoot: nativeHistory.afterRoot,
    },
    jsReference: {
      projectionBeforeRoot: jsProjection.beforeRoot,
      projectionAfterRoot: jsProjection.afterRoot,
      historyBeforeRoot: jsHistory.beforeRoot,
      historyAfterRoot: jsHistory.afterRoot,
    },
  },
};

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(interpreterArtifactPath, interpreterArtifact);
fs.writeFileSync(targetRbcPath, targetRbc);
fs.writeFileSync(jsReferenceTargetRbcPath, jsReferenceTargetRbc);
fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(JSON.stringify(payload, null, 2));

if (!payload.ok) process.exitCode = 1;
