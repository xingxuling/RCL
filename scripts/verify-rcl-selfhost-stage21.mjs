#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { compileRealityToBytecode, decodeBytecode } from '../src/bytecode.mjs';
import { RCLNativeVMError, runNativeBytecode } from '../src/native-vm.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const rclPath = path.join(root, 'selfhost', 'rcl-runtime-provider-error-path-interpreter-stage21.rcl');
const outputDir = path.join(root, 'output', 'selfhost');
const outputPath = path.join(outputDir, 'stage21-verification.json');
const interpreterArtifactPath = path.join(outputDir, 'stage21-runtime-provider-error-path-interpreter.rbc');
const providerTargetRbcPath = path.join(outputDir, 'stage21-runtime-provider-missing-target.rbc');
const providerReferenceRbcPath = path.join(outputDir, 'stage21-runtime-provider-missing-target-js-reference.rbc');

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

const providerReferenceRbc = encodeManualRbc({
  strings: [
    'RuntimeProviderMissingTarget',
    'stage21:provider-missing-manual-bytecode',
    'echo',
    'echo.text',
    '{"message":"hello-provider"}',
    'provider.reply',
  ],
  instructions: [
    [35, 2, 3, 4],
    [5, 5, 0, 0],
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
const providerTargetRbc = Buffer.from(state['target.provider_rbc_bytes']);
const decodedInterpreter = decodeBytecode(interpreterArtifact);
const decodedProviderTarget = decodeBytecode(providerTargetRbc);
const providerNativeFailure = runNativeFailure(providerTargetRbc);
const interpreterNames = instructionNames(decodedInterpreter);
const providerNames = instructionNames(decodedProviderTarget);

const checks = {
  interpreterRunsInNativeVm: interpreterRun.status === 'ok'
    && state['selfhost.stage_status'] === 'RCL_OWNED_RUNTIME_PROVIDER_ERROR_PATH_SUBSET_VERIFIED',
  rclGeneratedProviderTargetRbcMatchesIndependentReference: providerTargetRbc.equals(providerReferenceRbc)
    && sha256(providerTargetRbc) === sha256(providerReferenceRbc),
  decodedProviderTargetShapeMatches: decodedProviderTarget.program === 'RuntimeProviderMissingTarget'
    && decodedProviderTarget.sourceRoot === 'stage21:provider-missing-manual-bytecode'
    && decodedProviderTarget.instructions.length === 3
    && providerNames[0] === 'CALL_PROVIDER'
    && providerNames[1] === 'STORE_STATE'
    && providerNames[2] === 'HALT',
  nativeVmRejectsProviderTargetWithProviderMissing: providerNativeFailure.ok === true
    && providerNativeFailure.code === 'RCL_NATIVE_PROVIDER_MISSING'
    && providerNativeFailure.message === "Provider 'echo' is not registered for capability 'echo.text'",
  rclInterpreterErrorStateMatchesNativeError: state['runtime.provider_error_code'] === providerNativeFailure.code
    && state['runtime.provider_error_message'] === providerNativeFailure.message
    && state['runtime.provider_final_pc'] === 0
    && state['runtime.provider_stack_count'] === 0
    && state['runtime.provider_state_count'] === 0
    && state['runtime.provider_call_count'] === 0,
  decodedInterpreterContainsProviderMissingRuntime: interpreterNames.includes('CALL')
    && interpreterNames.includes('RETURN')
    && decodedInterpreter.instructions.some(instruction => instruction.builtin === 'SEQUENCE_GET')
    && decodedInterpreter.instructions.some(instruction => instruction.builtin === 'SEQUENCE_APPEND')
    && decodedInterpreter.instructions.some(instruction => instruction.builtin === 'UTF8_BYTES')
    && decodedInterpreter.strings.includes('RCL_NATIVE_PROVIDER_MISSING')
    && decodedInterpreter.strings.includes("Provider '"),
  boundaryHonest: state['selfhost.boundary'] === 'provider_missing_error_path_subset_not_complete_rcl_runtime'
    && state['gate.rcl_owned_runtime_provider_error_path_subset'] === true
    && state['gate.rcl_owned_runtime_complete'] === false
    && state['gate.rcl_owned_runtime_root_hashing_complete'] === false
    && state['gate.native_vm_host_still_required'] === true,
};

const payload = {
  ok: Object.values(checks).every(Boolean),
  format: 'rcl.selfhost.stage21.verification.v1',
  rclFile: path.relative(root, rclPath).replaceAll(path.sep, '/'),
  interpreterArtifactFile: path.relative(root, interpreterArtifactPath).replaceAll(path.sep, '/'),
  providerTargetRbcFile: path.relative(root, providerTargetRbcPath).replaceAll(path.sep, '/'),
  providerReferenceRbcFile: path.relative(root, providerReferenceRbcPath).replaceAll(path.sep, '/'),
  stageStatus: state['selfhost.stage_status'],
  selfHostClaim: state['selfhost.claim'],
  checks,
  interpreterArtifact: {
    program: decodedInterpreter.program,
    bytes: interpreterArtifact.length,
    sha256: sha256(interpreterArtifact),
    instructionCount: decodedInterpreter.instructions.length,
  },
  target: {
    providerMissing: {
      program: decodedProviderTarget.program,
      bytes: providerTargetRbc.length,
      sha256: sha256(providerTargetRbc),
      referenceSha256: sha256(providerReferenceRbc),
      exactReferenceMatch: providerTargetRbc.equals(providerReferenceRbc),
      strings: decodedProviderTarget.strings,
      instructions: decodedProviderTarget.instructions,
      nativeFailure: providerNativeFailure,
    },
  },
  runtimeComparison: {
    rclInterpreter: {
      providerErrorCode: state['runtime.provider_error_code'],
      providerErrorMessage: state['runtime.provider_error_message'],
      providerFinalPc: state['runtime.provider_final_pc'],
      providerStackCount: state['runtime.provider_stack_count'],
      providerStateCount: state['runtime.provider_state_count'],
      providerCallCount: state['runtime.provider_call_count'],
    },
    nativeError: providerNativeFailure,
  },
  boundaries: {
    implementedNow: "A native-running RCL artifact generates a CALL_PROVIDER target bytecode program and interprets the unregistered-provider failure path. The generated RBC matches an independent JS byte encoder, and the RCL-emitted error state matches native/rclvm.exe's RCL_NATIVE_PROVIDER_MISSING code and message.",
    notYetImplemented: 'This covers the unregistered provider error path only. It is not registered-provider failure parity, not provider success parity, not pure RCL SHA-256, not arbitrary canonical serialization, not complete typed/provider/history/root parity, and not a complete RCL-owned runtime.',
    nextTarget: state['selfhost.next_rewrite_target'],
  },
};

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(interpreterArtifactPath, interpreterArtifact);
fs.writeFileSync(providerTargetRbcPath, providerTargetRbc);
fs.writeFileSync(providerReferenceRbcPath, providerReferenceRbc);
fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(JSON.stringify(payload, null, 2));

if (!payload.ok) process.exitCode = 1;
