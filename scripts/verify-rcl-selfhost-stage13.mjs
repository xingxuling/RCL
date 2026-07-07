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
const rclPath = path.join(root, 'selfhost', 'rcl-runtime-control-flow-interpreter-stage13.rcl');
const outputDir = path.join(root, 'output', 'selfhost');
const outputPath = path.join(outputDir, 'stage13-verification.json');
const interpreterArtifactPath = path.join(outputDir, 'stage13-runtime-control-flow-interpreter.rbc');
const targetRbcPath = path.join(outputDir, 'stage13-runtime-control-flow-target.rbc');
const jsReferenceTargetRbcPath = path.join(outputDir, 'stage13-runtime-control-flow-target-js-reference.rbc');

const targetSource = `reality RuntimeControlFlowTarget {
  facet world.count : Number = 1 + 2
  facet world.status : Text = choose(false, "ready", "blocked")
  facet world.flag : Truth = choose(true, true, false)
}
`;

function sha256(buffer) {
  return crypto.createHash('sha256').update(Buffer.from(buffer)).digest('hex');
}

function instructionNames(decoded) {
  return decoded.instructions.map(instruction => instruction.name);
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
const targetInstructionNames = instructionNames(decodedTarget);

const checks = {
  interpreterRunsInNativeVm: interpreterRun.status === 'ok'
    && state['selfhost.stage_status'] === 'RCL_OWNED_RUNTIME_CONTROL_FLOW_ARITHMETIC_SUBSET_VERIFIED',
  rclGeneratedTargetRbcMatchesJsCompiler: targetRbc.equals(jsReferenceTargetRbc)
    && sha256(targetRbc) === sha256(jsReferenceTargetRbc),
  decodedTargetShapeMatches: decodedTarget.format === 'rcl.bytecode.v1'
    && decodedTarget.program === 'RuntimeControlFlowTarget'
    && decodedTarget.sourceRoot === targetCompiled.programRoot
    && decodedTarget.instructions.length === 17
    && JSON.stringify(decodedTarget.instructions) === JSON.stringify(decodedJsReferenceTarget.instructions)
    && JSON.stringify(decodedTarget.numbers) === JSON.stringify([1, 2]),
  targetActuallyUsesArithmeticAndControlFlow: targetInstructionNames.includes('PUSH_NUMBER')
    && targetInstructionNames.includes('ADD')
    && targetInstructionNames.includes('JUMP_IF_FALSE')
    && targetInstructionNames.includes('JUMP')
    && targetInstructionNames.includes('STORE_STATE')
    && targetInstructionNames.at(-1) === 'HALT',
  rclInterpreterStateMatchesNativeRuntime: state['runtime.world_count'] === 3
    && state['runtime.world_status'] === 'blocked'
    && state['runtime.world_flag'] === true
    && state['runtime.stack_count'] === 0
    && targetNativeRun.status === 'ok'
    && targetNativeRun.state['world.count'] === state['runtime.world_count']
    && targetNativeRun.state['world.status'] === state['runtime.world_status']
    && targetNativeRun.state['world.flag'] === state['runtime.world_flag'],
  rclInterpreterStateMatchesJsRuntime: targetJsRun.state['world.count'] === state['runtime.world_count']
    && targetJsRun.state['world.status'] === state['runtime.world_status']
    && targetJsRun.state['world.flag'] === state['runtime.world_flag'],
  decodedInterpreterContainsRuntimeLoopAndBranching: decodedInterpreter.instructions.some(instruction => instruction.name === 'CALL')
    && decodedInterpreter.instructions.some(instruction => instruction.name === 'RETURN')
    && decodedInterpreter.instructions.some(instruction => instruction.name === 'ADD')
    && decodedInterpreter.instructions.some(instruction => instruction.name === 'JUMP_IF_FALSE')
    && decodedInterpreter.instructions.some(instruction => instruction.builtin === 'SEQUENCE_GET')
    && decodedInterpreter.instructions.some(instruction => instruction.builtin === 'SEQUENCE_APPEND'),
  boundaryHonest: state['selfhost.boundary'] === 'push_add_jump_store_halt_runtime_subset_not_complete_rcl_runtime'
    && state['gate.rcl_owned_runtime_subset'] === true
    && state['gate.rcl_owned_runtime_control_flow_subset'] === true
    && state['gate.rcl_owned_runtime_complete'] === false
    && state['gate.native_vm_host_still_required'] === true,
};

const payload = {
  ok: Object.values(checks).every(Boolean),
  format: 'rcl.selfhost.stage13.verification.v1',
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
      worldCount: state['runtime.world_count'],
      worldStatus: state['runtime.world_status'],
      worldFlag: state['runtime.world_flag'],
      stackCount: state['runtime.stack_count'],
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
    implementedNow: 'A native-running RCL artifact interprets bytecode for PUSH_NUMBER, PUSH_BOOL, PUSH_STRING, ADD, JUMP, JUMP_IF_FALSE, STORE_STATE, and HALT with native-style stack popping, and its interpreted state matches direct native and JS runtime execution of the same target program.',
    notYetImplemented: 'The RCL runtime interpreter does not yet cover load-state dependencies, comparisons, boolean operators, authorization, transactions, projections, typed values, providers, history, calls/returns, or the full current RCL runtime surface.',
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
