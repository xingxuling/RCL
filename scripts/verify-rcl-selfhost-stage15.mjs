#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { compileReality } from '../src/compiler.mjs';
import { compileRealityToBytecode, decodeBytecode } from '../src/bytecode.mjs';
import { runReality } from '../src/runtime.mjs';
import { runNativeBytecode } from '../src/native-vm.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const rclPath = path.join(root, 'selfhost', 'rcl-runtime-transaction-interpreter-stage15.rcl');
const outputDir = path.join(root, 'output', 'selfhost');
const outputPath = path.join(outputDir, 'stage15-verification.json');
const interpreterArtifactPath = path.join(outputDir, 'stage15-runtime-transaction-interpreter.rbc');
const targetRbcPath = path.join(outputDir, 'stage15-runtime-transaction-target.rbc');
const jsReferenceTargetRbcPath = path.join(outputDir, 'stage15-runtime-transaction-target-js-reference.rbc');

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

const checks = {
  interpreterRunsInNativeVm: interpreterRun.status === 'ok'
    && state['selfhost.stage_status'] === 'RCL_OWNED_RUNTIME_TRANSACTION_SUBSET_VERIFIED',
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
    && targetNativeRun.projections[0]?.projectedState?.['world.status'] === state['runtime.projection_status']
    && targetNativeRun.history[0]?.changes?.[0]?.after === state['runtime.history_status'],
  rclInterpreterStateMatchesJsRuntime: targetJsRun.state['world.ready'] === state['runtime.world_ready']
    && targetJsRun.state['world.status'] === state['runtime.world_status']
    && targetJsRun.projections.length === state['runtime.projection_count']
    && targetJsRun.history.length === state['runtime.history_count']
    && targetJsRun.projections[0]?.projectedState?.['world.status'] === state['runtime.projection_status']
    && targetJsRun.history[0]?.changes?.[0]?.after === state['runtime.history_status'],
  nativeDirectTransactionRecordShapeMatches: hasTransactionRecordShape(
    targetNativeRun.projections[0],
    'Projection',
    'foresee',
    'projected',
  )
    && hasTransactionRecordShape(targetNativeRun.history[0], 'Transition', 'realize', 'realized')
    && targetNativeRun.projections[0].projectedState['world.ready'] === true
    && targetNativeRun.projections[0].projectedState['world.status'] === 'published',
  jsRuntimeTransactionRecordShapeMatches: hasTransactionRecordShape(
    targetJsRun.projections[0],
    'Projection',
    'foresee',
    'projected',
  )
    && hasTransactionRecordShape(targetJsRun.history[0], 'Transition', 'realize', 'realized')
    && targetJsRun.projections[0].projectedState['world.ready'] === true
    && targetJsRun.projections[0].projectedState['world.status'] === 'published',
  decodedInterpreterContainsTransactionRuntime: interpreterInstructionNames.includes('CALL')
    && interpreterInstructionNames.includes('RETURN')
    && interpreterInstructionNames.includes('LOAD_STATE')
    && interpreterInstructionNames.includes('JUMP_IF_FALSE')
    && interpreterInstructionNames.includes('CHECK_PRESERVE')
    && decodedInterpreter.instructions.some(instruction => instruction.builtin === 'SEQUENCE_GET')
    && decodedInterpreter.instructions.some(instruction => instruction.builtin === 'SEQUENCE_APPEND'),
  boundaryHonest: state['selfhost.boundary'] === 'single_rule_transaction_projection_history_subset_not_complete_rcl_runtime'
    && state['gate.rcl_owned_runtime_subset'] === true
    && state['gate.rcl_owned_runtime_transaction_subset'] === true
    && state['gate.rcl_owned_runtime_complete'] === false
    && state['gate.native_vm_host_still_required'] === true,
};

const payload = {
  ok: Object.values(checks).every(Boolean),
  format: 'rcl.selfhost.stage15.verification.v1',
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
    implementedNow: 'A native-running RCL artifact interprets bytecode for a single authorized transaction path: initial state, warrant grant, transaction begin, warrant check, staged store, projected view preserve check, witness record, projection commit, realized history commit, and final state mutation.',
    notYetImplemented: 'The RCL runtime interpreter is still a single-rule transaction subset. It does not yet cover arbitrary rule lowering, typed value breadth, providers, host calls, functions/calls in target programs, complete root parity, error paths, or the full current RCL runtime surface.',
    nextTarget: state['selfhost.next_rewrite_target'],
  },
  roots: {
    interpreterStateRoot: interpreterRun.stateRoot,
    interpreterProgramRoot: interpreterRun.programRoot,
    targetProgramRoot: targetCompiled.programRoot,
  },
};

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(interpreterArtifactPath, interpreterArtifact);
fs.writeFileSync(targetRbcPath, targetRbc);
fs.writeFileSync(jsReferenceTargetRbcPath, jsReferenceTargetRbc);
fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(JSON.stringify(payload, null, 2));

if (!payload.ok) process.exitCode = 1;
