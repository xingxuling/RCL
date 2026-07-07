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
const rclPath = path.join(root, 'selfhost', 'rcl-runtime-state-logic-interpreter-stage14.rcl');
const outputDir = path.join(root, 'output', 'selfhost');
const outputPath = path.join(outputDir, 'stage14-verification.json');
const interpreterArtifactPath = path.join(outputDir, 'stage14-runtime-state-logic-interpreter.rbc');
const targetRbcPath = path.join(outputDir, 'stage14-runtime-state-logic-target.rbc');
const jsReferenceTargetRbcPath = path.join(outputDir, 'stage14-runtime-state-logic-target-js-reference.rbc');

const targetSource = `reality RuntimeStateLogicTarget {
  facet world.base : Number = 4
  facet world.next : Number = world.base + 2
  facet world.same : Truth = world.next == 6
  facet world.ready : Truth = world.same and world.next >= 6 and not false
  facet world.alternate : Truth = false or world.ready
  facet world.status : Text = choose(world.alternate, "ready", "blocked")
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
const interpreterInstructionNames = instructionNames(decodedInterpreter);

const checks = {
  interpreterRunsInNativeVm: interpreterRun.status === 'ok'
    && state['selfhost.stage_status'] === 'RCL_OWNED_RUNTIME_STATE_LOGIC_SUBSET_VERIFIED',
  rclGeneratedTargetRbcMatchesJsCompiler: targetRbc.equals(jsReferenceTargetRbc)
    && sha256(targetRbc) === sha256(jsReferenceTargetRbc),
  decodedTargetShapeMatches: decodedTarget.format === 'rcl.bytecode.v1'
    && decodedTarget.program === 'RuntimeStateLogicTarget'
    && decodedTarget.sourceRoot === targetCompiled.programRoot
    && decodedTarget.instructions.length === 30
    && JSON.stringify(decodedTarget.instructions) === JSON.stringify(decodedJsReferenceTarget.instructions)
    && JSON.stringify(decodedTarget.numbers) === JSON.stringify([4, 2, 6]),
  targetActuallyUsesStateDependenciesAndLogic: targetInstructionNames.includes('LOAD_STATE')
    && targetInstructionNames.includes('EQ')
    && targetInstructionNames.includes('GTE')
    && targetInstructionNames.includes('AND')
    && targetInstructionNames.includes('OR')
    && targetInstructionNames.includes('NOT')
    && targetInstructionNames.includes('JUMP_IF_FALSE')
    && targetInstructionNames.at(-1) === 'HALT',
  rclInterpreterStateMatchesNativeRuntime: state['runtime.world_base'] === 4
    && state['runtime.world_next'] === 6
    && state['runtime.world_same'] === true
    && state['runtime.world_ready'] === true
    && state['runtime.world_alternate'] === true
    && state['runtime.world_status'] === 'ready'
    && state['runtime.stack_count'] === 0
    && targetNativeRun.status === 'ok'
    && targetNativeRun.state['world.base'] === state['runtime.world_base']
    && targetNativeRun.state['world.next'] === state['runtime.world_next']
    && targetNativeRun.state['world.same'] === state['runtime.world_same']
    && targetNativeRun.state['world.ready'] === state['runtime.world_ready']
    && targetNativeRun.state['world.alternate'] === state['runtime.world_alternate']
    && targetNativeRun.state['world.status'] === state['runtime.world_status'],
  rclInterpreterStateMatchesJsRuntime: targetJsRun.state['world.base'] === state['runtime.world_base']
    && targetJsRun.state['world.next'] === state['runtime.world_next']
    && targetJsRun.state['world.same'] === state['runtime.world_same']
    && targetJsRun.state['world.ready'] === state['runtime.world_ready']
    && targetJsRun.state['world.alternate'] === state['runtime.world_alternate']
    && targetJsRun.state['world.status'] === state['runtime.world_status'],
  decodedInterpreterContainsStateLogicRuntime: interpreterInstructionNames.includes('CALL')
    && interpreterInstructionNames.includes('RETURN')
    && interpreterInstructionNames.includes('LOAD_STATE')
    && interpreterInstructionNames.includes('EQ')
    && interpreterInstructionNames.includes('GTE')
    && interpreterInstructionNames.includes('AND')
    && interpreterInstructionNames.includes('OR')
    && interpreterInstructionNames.includes('NOT')
    && decodedInterpreter.instructions.some(instruction => instruction.builtin === 'SEQUENCE_GET')
    && decodedInterpreter.instructions.some(instruction => instruction.builtin === 'SEQUENCE_APPEND'),
  boundaryHonest: state['selfhost.boundary'] === 'load_state_comparison_boolean_logic_subset_not_complete_rcl_runtime'
    && state['gate.rcl_owned_runtime_subset'] === true
    && state['gate.rcl_owned_runtime_state_logic_subset'] === true
    && state['gate.rcl_owned_runtime_complete'] === false
    && state['gate.native_vm_host_still_required'] === true,
};

const payload = {
  ok: Object.values(checks).every(Boolean),
  format: 'rcl.selfhost.stage14.verification.v1',
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
      worldBase: state['runtime.world_base'],
      worldNext: state['runtime.world_next'],
      worldSame: state['runtime.world_same'],
      worldReady: state['runtime.world_ready'],
      worldAlternate: state['runtime.world_alternate'],
      worldStatus: state['runtime.world_status'],
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
    implementedNow: 'A native-running RCL artifact interprets bytecode for LOAD_STATE, numeric comparison, boolean logic, stack-popping state stores, jumps, and literals. It executes dependent facets and matches direct native and JS runtime state for the same target program.',
    notYetImplemented: 'The RCL runtime interpreter does not yet cover authorization, transactions, projections, typed values, providers, history, calls/returns for target programs, builtins beyond sequence/byte encoders, or the full current RCL runtime surface.',
    nextTarget: state['selfhost.next_rewrite_target'],
  },
  roots: {
    interpreterSourceRoot: interpreterRun.sourceRoot,
    targetSourceRoot: targetCompiled.programRoot,
  },
};

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(interpreterArtifactPath, interpreterArtifact);
fs.writeFileSync(targetRbcPath, targetRbc);
fs.writeFileSync(jsReferenceTargetRbcPath, jsReferenceTargetRbc);
fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(JSON.stringify(payload, null, 2));

if (!payload.ok) process.exitCode = 1;
