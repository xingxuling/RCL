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
const rclPath = path.join(root, 'selfhost', 'rcl-runtime-bytecode-interpreter-stage12.rcl');
const outputDir = path.join(root, 'output', 'selfhost');
const outputPath = path.join(outputDir, 'stage12-verification.json');
const interpreterArtifactPath = path.join(outputDir, 'stage12-runtime-interpreter.rbc');
const targetRbcPath = path.join(outputDir, 'stage12-runtime-target.rbc');
const jsReferenceTargetRbcPath = path.join(outputDir, 'stage12-runtime-target-js-reference.rbc');

const targetSource = `reality RuntimeInterpreterTarget {
  facet world.ready : Truth = true
  facet world.name : Text = "RCL"
}
`;

function sha256(buffer) {
  return crypto.createHash('sha256').update(Buffer.from(buffer)).digest('hex');
}

const rclSource = fs.readFileSync(rclPath, 'utf8');
const interpreterArtifact = Buffer.from(compileRealityToBytecode(rclSource));
const interpreterRun = runNativeBytecode(interpreterArtifact);
const state = interpreterRun.state;
const targetRbc = Buffer.from(state['target.rbc_bytes']);
const jsReferenceTargetRbc = Buffer.from(compileRealityToBytecode(targetSource));
const decodedInterpreter = decodeBytecode(interpreterArtifact);
const decodedTarget = decodeBytecode(targetRbc);
const decodedJsReferenceTarget = decodeBytecode(jsReferenceTargetRbc);
const targetNativeRun = runNativeBytecode(targetRbc);
const targetJsRun = await runReality(targetSource);
const targetCompiled = compileReality(targetSource);

const checks = {
  interpreterRunsInNativeVm: interpreterRun.status === 'ok'
    && state['selfhost.stage_status'] === 'RCL_OWNED_RUNTIME_BYTECODE_INTERPRETER_SUBSET_VERIFIED',
  rclGeneratedTargetRbcMatchesJsCompiler: targetRbc.equals(jsReferenceTargetRbc)
    && sha256(targetRbc) === sha256(jsReferenceTargetRbc),
  decodedTargetShapeMatches: decodedTarget.format === 'rcl.bytecode.v1'
    && decodedTarget.program === 'RuntimeInterpreterTarget'
    && decodedTarget.sourceRoot === targetCompiled.programRoot
    && decodedTarget.instructions.length === 5
    && JSON.stringify(decodedTarget.instructions) === JSON.stringify(decodedJsReferenceTarget.instructions),
  rclInterpreterStateMatchesNativeRuntime: state['runtime.world_ready'] === true
    && state['runtime.world_name'] === 'RCL'
    && targetNativeRun.status === 'ok'
    && targetNativeRun.state['world.ready'] === state['runtime.world_ready']
    && targetNativeRun.state['world.name'] === state['runtime.world_name'],
  rclInterpreterStateMatchesJsRuntime: targetJsRun.state['world.ready'] === state['runtime.world_ready']
    && targetJsRun.state['world.name'] === state['runtime.world_name'],
  decodedInterpreterContainsRuntimeLoop: decodedInterpreter.instructions.some(instruction => instruction.name === 'CALL')
    && decodedInterpreter.instructions.some(instruction => instruction.name === 'RETURN')
    && decodedInterpreter.instructions.some(instruction => instruction.builtin === 'SEQUENCE_GET')
    && decodedInterpreter.instructions.some(instruction => instruction.builtin === 'SEQUENCE_APPEND'),
  boundaryHonest: state['selfhost.boundary'] === 'push_store_halt_runtime_subset_not_complete_rcl_runtime'
    && state['gate.rcl_owned_runtime_subset'] === true
    && state['gate.rcl_owned_runtime_complete'] === false
    && state['gate.native_vm_host_still_required'] === true,
};

const payload = {
  ok: Object.values(checks).every(Boolean),
  format: 'rcl.selfhost.stage12.verification.v1',
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
    instructionPlan: {
      ops: state['target.rbc_instruction_ops'],
      a: state['target.rbc_instruction_a_values'],
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
      worldName: state['runtime.world_name'],
      stateKeys: state['runtime.state_keys'],
      stateValues: state['runtime.state_values'],
      finalPc: state['runtime.final_pc'],
    },
    nativeDirect: {
      status: targetNativeRun.status,
      state: targetNativeRun.state,
      instructions: targetNativeRun.metrics.instructions,
    },
    jsReference: {
      state: targetJsRun.state,
      historyLength: targetJsRun.history.length,
    },
  },
  boundaries: {
    implementedNow: 'A native-running RCL artifact interprets a real bytecode instruction subset for PUSH_BOOL, PUSH_STRING, STORE_STATE, and HALT, and its interpreted state matches direct native and JS runtime execution of the same target program.',
    notYetImplemented: 'The RCL runtime interpreter does not yet cover control flow, arithmetic, authorization, transactions, projections, typed values, providers, history, or the full current RCL runtime surface.',
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
