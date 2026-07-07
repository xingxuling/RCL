#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { compileRealityToBytecode, decodeBytecode } from '../src/bytecode.mjs';
import { RCLNativeVMError, runNativeBytecode } from '../src/native-vm.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const rclPath = path.join(root, 'selfhost', 'rcl-runtime-error-path-interpreter-stage20.rcl');
const outputDir = path.join(root, 'output', 'selfhost');
const outputPath = path.join(outputDir, 'stage20-verification.json');
const interpreterArtifactPath = path.join(outputDir, 'stage20-runtime-error-path-interpreter.rbc');
const deniedTargetRbcPath = path.join(outputDir, 'stage20-runtime-authority-denied-target.rbc');
const preserveTargetRbcPath = path.join(outputDir, 'stage20-runtime-preserve-failure-target.rbc');
const deniedReferenceRbcPath = path.join(outputDir, 'stage20-runtime-authority-denied-target-js-reference.rbc');
const preserveReferenceRbcPath = path.join(outputDir, 'stage20-runtime-preserve-failure-target-js-reference.rbc');

function sha256(buffer) {
  return crypto.createHash('sha256').update(Buffer.from(buffer)).digest('hex');
}

function u8(value) {
  return [value & 0xff];
}

function u16le(value) {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value);
  return [...buffer];
}

function u32le(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value);
  return [...buffer];
}

function i32le(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeInt32LE(value);
  return [...buffer];
}

function stringRecord(value) {
  const bytes = Buffer.from(value, 'utf8');
  return [...u32le(bytes.length), ...bytes];
}

function instruction(op, a = 0, b = 0, c = 0) {
  return [...u8(op), ...u8(0), ...u16le(0), ...i32le(a), ...i32le(b), ...i32le(c)];
}

function encodeManualRbc({ strings, instructions }) {
  return Buffer.from([
    ...Buffer.from('RCLB'),
    ...u16le(1),
    ...u16le(1),
    ...u32le(0),
    ...u32le(0),
    ...u32le(1),
    ...u32le(strings.length),
    ...u32le(0),
    ...u32le(instructions.length),
    ...u32le(0),
    ...strings.flatMap(stringRecord),
    ...instructions.flatMap(item => instruction(item[0], item[1], item[2], item[3])),
  ]);
}

const deniedReferenceRbc = encodeManualRbc({
  strings: [
    'RuntimeAuthorityDeniedTarget',
    'stage20:authority-denied-manual-bytecode',
    'world.ready',
    'draft',
    'world.status',
    'intruder',
    'world.publish',
    'world',
    'publish',
    'published',
  ],
  instructions: [
    [2, 1, 0, 0],
    [5, 2, 0, 0],
    [3, 3, 0, 0],
    [5, 4, 0, 0],
    [4, 2, 0, 0],
    [21, 16, 0, 0],
    [23, 1, 8, 5],
    [24, 5, 6, 7],
    [3, 9, 0, 0],
    [25, 4, 0, 0],
    [26, 1, 0, 0],
    [4, 4, 0, 0],
    [3, 9, 0, 0],
    [10, 0, 0, 0],
    [27, 0, 0, 0],
    [29, 0, 0, 0],
    [31, 0, 0, 0],
  ],
});

const preserveReferenceRbc = encodeManualRbc({
  strings: [
    'RuntimePreserveFailureTarget',
    'stage20:preserve-failure-manual-bytecode',
    'world.ready',
    'draft',
    'world.status',
    'operator',
    'world.publish',
    'world',
    'publish',
    'published',
    'impossible',
  ],
  instructions: [
    [2, 1, 0, 0],
    [5, 2, 0, 0],
    [3, 3, 0, 0],
    [5, 4, 0, 0],
    [22, 5, 6, 7],
    [4, 2, 0, 0],
    [21, 17, 0, 0],
    [23, 1, 8, 5],
    [24, 5, 6, 7],
    [3, 9, 0, 0],
    [25, 4, 0, 0],
    [26, 1, 0, 0],
    [4, 4, 0, 0],
    [3, 10, 0, 0],
    [10, 0, 0, 0],
    [27, 0, 0, 0],
    [29, 0, 0, 0],
    [31, 0, 0, 0],
  ],
});

function runNativeFailure(bytecode) {
  try {
    const run = runNativeBytecode(bytecode, { maxBuffer: 32 * 1024 * 1024 });
    return { ok: false, unexpectedlyRan: true, run };
  } catch (error) {
    if (error instanceof RCLNativeVMError) {
      return {
        ok: true,
        unexpectedlyRan: false,
        code: error.code,
        message: error.message,
        status: error.details?.status ?? null,
      };
    }
    throw error;
  }
}

function instructionNames(decoded) {
  return decoded.instructions.map(instruction => instruction.name);
}

const rclSource = fs.readFileSync(rclPath, 'utf8');
const interpreterArtifact = Buffer.from(compileRealityToBytecode(rclSource));
const interpreterRun = runNativeBytecode(interpreterArtifact, { maxBuffer: 64 * 1024 * 1024 });
const state = interpreterRun.state;
const deniedTargetRbc = Buffer.from(state['target.denied_rbc_bytes']);
const preserveTargetRbc = Buffer.from(state['target.preserve_rbc_bytes']);
const decodedInterpreter = decodeBytecode(interpreterArtifact);
const decodedDeniedTarget = decodeBytecode(deniedTargetRbc);
const decodedPreserveTarget = decodeBytecode(preserveTargetRbc);
const deniedNativeFailure = runNativeFailure(deniedTargetRbc);
const preserveNativeFailure = runNativeFailure(preserveTargetRbc);
const interpreterNames = instructionNames(decodedInterpreter);
const deniedNames = instructionNames(decodedDeniedTarget);
const preserveNames = instructionNames(decodedPreserveTarget);

const checks = {
  interpreterRunsInNativeVm: interpreterRun.status === 'ok'
    && state['selfhost.stage_status'] === 'RCL_OWNED_RUNTIME_ERROR_PATH_SUBSET_VERIFIED',
  rclGeneratedDeniedTargetRbcMatchesIndependentReference: deniedTargetRbc.equals(deniedReferenceRbc)
    && sha256(deniedTargetRbc) === sha256(deniedReferenceRbc),
  rclGeneratedPreserveTargetRbcMatchesIndependentReference: preserveTargetRbc.equals(preserveReferenceRbc)
    && sha256(preserveTargetRbc) === sha256(preserveReferenceRbc),
  decodedDeniedTargetShapeMatches: decodedDeniedTarget.program === 'RuntimeAuthorityDeniedTarget'
    && decodedDeniedTarget.sourceRoot === 'stage20:authority-denied-manual-bytecode'
    && decodedDeniedTarget.instructions.length === 17
    && deniedNames.includes('BEGIN_TX')
    && deniedNames.includes('CHECK_WARRANT')
    && !deniedNames.includes('GRANT_WARRANT'),
  decodedPreserveTargetShapeMatches: decodedPreserveTarget.program === 'RuntimePreserveFailureTarget'
    && decodedPreserveTarget.sourceRoot === 'stage20:preserve-failure-manual-bytecode'
    && decodedPreserveTarget.instructions.length === 18
    && preserveNames.includes('GRANT_WARRANT')
    && preserveNames.includes('CHECK_WARRANT')
    && preserveNames.includes('CHECK_PRESERVE'),
  nativeVmRejectsDeniedTargetWithAuthorityDenied: deniedNativeFailure.ok === true
    && deniedNativeFailure.code === 'RCL_AUTHORITY_DENIED'
    && deniedNativeFailure.message.includes('intruder lacks world.publish on world'),
  nativeVmRejectsPreserveTargetWithRealityBoundBroken: preserveNativeFailure.ok === true
    && preserveNativeFailure.code === 'RCL_REALITY_BOUND_BROKEN'
    && preserveNativeFailure.message.includes('preserve clause rejected'),
  rclInterpreterErrorStateMatchesNativeErrors: state['runtime.denied_error_code'] === deniedNativeFailure.code
    && state['runtime.preserve_error_code'] === preserveNativeFailure.code
    && state['runtime.denied_error_message'] === deniedNativeFailure.message
    && state['runtime.preserve_error_message'] === preserveNativeFailure.message
    && state['runtime.denied_world_status'] === 'draft'
    && state['runtime.preserve_world_status'] === 'draft'
    && state['runtime.denied_history_count'] === 0
    && state['runtime.preserve_history_count'] === 0
    && state['runtime.denied_projection_count'] === 0
    && state['runtime.preserve_projection_count'] === 0
    && state['runtime.denied_stack_count'] === 0
    && state['runtime.preserve_stack_count'] === 0,
  decodedInterpreterContainsErrorPathRuntime: interpreterNames.includes('CALL')
    && interpreterNames.includes('RETURN')
    && interpreterNames.includes('JUMP_IF_FALSE')
    && decodedInterpreter.instructions.some(instruction => instruction.builtin === 'SEQUENCE_GET')
    && decodedInterpreter.instructions.some(instruction => instruction.builtin === 'SEQUENCE_APPEND')
    && decodedInterpreter.instructions.some(instruction => instruction.builtin === 'CONTAINS')
    && decodedInterpreter.strings.includes('RCL_AUTHORITY_DENIED')
    && decodedInterpreter.strings.includes('RCL_REALITY_BOUND_BROKEN'),
  boundaryHonest: state['selfhost.boundary'] === 'authority_preserve_error_path_subset_not_complete_rcl_runtime'
    && state['gate.rcl_owned_runtime_error_path_subset'] === true
    && state['gate.rcl_owned_runtime_complete'] === false
    && state['gate.rcl_owned_runtime_root_hashing_complete'] === false
    && state['gate.native_vm_host_still_required'] === true,
};

const payload = {
  ok: Object.values(checks).every(Boolean),
  format: 'rcl.selfhost.stage20.verification.v1',
  rclFile: path.relative(root, rclPath).replaceAll(path.sep, '/'),
  interpreterArtifactFile: path.relative(root, interpreterArtifactPath).replaceAll(path.sep, '/'),
  deniedTargetRbcFile: path.relative(root, deniedTargetRbcPath).replaceAll(path.sep, '/'),
  preserveTargetRbcFile: path.relative(root, preserveTargetRbcPath).replaceAll(path.sep, '/'),
  deniedReferenceRbcFile: path.relative(root, deniedReferenceRbcPath).replaceAll(path.sep, '/'),
  preserveReferenceRbcFile: path.relative(root, preserveReferenceRbcPath).replaceAll(path.sep, '/'),
  stageStatus: state['selfhost.stage_status'],
  selfHostClaim: state['selfhost.claim'],
  checks,
  interpreterArtifact: {
    program: decodedInterpreter.program,
    bytes: interpreterArtifact.length,
    sha256: sha256(interpreterArtifact),
    instructionCount: decodedInterpreter.instructions.length,
  },
  targets: {
    denied: {
      program: decodedDeniedTarget.program,
      bytes: deniedTargetRbc.length,
      sha256: sha256(deniedTargetRbc),
      referenceSha256: sha256(deniedReferenceRbc),
      exactReferenceMatch: deniedTargetRbc.equals(deniedReferenceRbc),
      strings: decodedDeniedTarget.strings,
      instructions: decodedDeniedTarget.instructions,
      nativeFailure: deniedNativeFailure,
    },
    preserve: {
      program: decodedPreserveTarget.program,
      bytes: preserveTargetRbc.length,
      sha256: sha256(preserveTargetRbc),
      referenceSha256: sha256(preserveReferenceRbc),
      exactReferenceMatch: preserveTargetRbc.equals(preserveReferenceRbc),
      strings: decodedPreserveTarget.strings,
      instructions: decodedPreserveTarget.instructions,
      nativeFailure: preserveNativeFailure,
    },
  },
  runtimeComparison: {
    rclInterpreter: {
      deniedErrorCode: state['runtime.denied_error_code'],
      deniedErrorMessage: state['runtime.denied_error_message'],
      deniedFinalPc: state['runtime.denied_final_pc'],
      deniedStackCount: state['runtime.denied_stack_count'],
      deniedWorldStatus: state['runtime.denied_world_status'],
      deniedHistoryCount: state['runtime.denied_history_count'],
      deniedProjectionCount: state['runtime.denied_projection_count'],
      preserveErrorCode: state['runtime.preserve_error_code'],
      preserveErrorMessage: state['runtime.preserve_error_message'],
      preserveFinalPc: state['runtime.preserve_final_pc'],
      preserveStackCount: state['runtime.preserve_stack_count'],
      preserveWorldStatus: state['runtime.preserve_world_status'],
      preserveHistoryCount: state['runtime.preserve_history_count'],
      preserveProjectionCount: state['runtime.preserve_projection_count'],
    },
    nativeErrors: {
      denied: deniedNativeFailure,
      preserve: preserveNativeFailure,
    },
  },
  boundaries: {
    implementedNow: 'A native-running RCL artifact generates two transaction bytecode programs and interprets their failed runtime paths: CHECK_WARRANT without an active warrant yields RCL_AUTHORITY_DENIED, and CHECK_PRESERVE with a false projected predicate yields RCL_REALITY_BOUND_BROKEN. The generated RBC files match an independent JS byte encoder and the RCL-emitted error state matches native/rclvm.exe error codes and messages.',
    notYetImplemented: 'This covers two transaction error-path subsets only. It is not full provider failure parity, not pure RCL SHA-256, not arbitrary canonical serialization, not complete typed/provider/history/root parity, and not a complete RCL-owned runtime.',
    nextTarget: state['selfhost.next_rewrite_target'],
  },
};

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(interpreterArtifactPath, interpreterArtifact);
fs.writeFileSync(deniedTargetRbcPath, deniedTargetRbc);
fs.writeFileSync(preserveTargetRbcPath, preserveTargetRbc);
fs.writeFileSync(deniedReferenceRbcPath, deniedReferenceRbc);
fs.writeFileSync(preserveReferenceRbcPath, preserveReferenceRbc);
fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(JSON.stringify(payload, null, 2));

if (!payload.ok) process.exitCode = 1;
