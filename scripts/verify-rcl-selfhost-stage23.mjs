#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { compileReality } from '../src/compiler.mjs';
import { compileRealityToBytecode, decodeBytecode } from '../src/bytecode.mjs';
import { DEFAULT_NATIVE_VM_PATH, RCLNativeVMError, runNativeBytecode } from '../src/native-vm.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const rclPath = path.join(root, 'selfhost', 'rcl-builtin-provider-source-lowering-stage23.rcl');
const outputDir = path.join(root, 'output', 'selfhost');
const outputPath = path.join(outputDir, 'stage23-verification.json');
const interpreterArtifactPath = path.join(outputDir, 'stage23-builtin-provider-source-lowering-interpreter.rbc');
const targetRbcPath = path.join(outputDir, 'stage23-builtin-provider-source-lowered-target.rbc');
const referenceRbcPath = path.join(outputDir, 'stage23-builtin-provider-source-js-reference.rbc');

function sha256(buffer) {
  return crypto.createHash('sha256').update(Buffer.from(buffer)).digest('hex');
}

function sha256File(filePath) {
  return fs.existsSync(filePath)
    ? crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
    : null;
}

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

function nativeExeFormat(filePath) {
  if (!fs.existsSync(filePath)) return { exists: false, mz: false, pe: false };
  const buffer = fs.readFileSync(filePath);
  const peOffset = buffer.length >= 0x40 ? buffer.readUInt32LE(0x3c) : -1;
  const peSignature = peOffset >= 0 && peOffset + 4 <= buffer.length
    ? buffer.toString('ascii', peOffset, peOffset + 4)
    : '';
  return {
    exists: true,
    bytes: buffer.length,
    mz: buffer.length >= 2 && buffer.toString('ascii', 0, 2) === 'MZ',
    pe: peSignature === 'PE\u0000\u0000',
    peOffset,
    sha256: sha256(buffer),
  };
}

function instructionNames(decoded) {
  return decoded.instructions.map(instruction => instruction.name);
}

const rclSource = fs.readFileSync(rclPath, 'utf8');
const interpreterArtifact = Buffer.from(compileRealityToBytecode(rclSource));
const interpreterRun = runNativeBytecode(interpreterArtifact, { maxBuffer: 64 * 1024 * 1024 });
const state = interpreterRun.state;
const sourceText = state['source.full'];
const compilerProgram = compileReality(sourceText);
const referenceRbc = Buffer.from(compileRealityToBytecode(sourceText));
const targetRbc = Buffer.from(state['target.rbc_bytes']);
const decodedInterpreter = decodeBytecode(interpreterArtifact);
const decodedTarget = decodeBytecode(targetRbc);
const decodedReference = decodeBytecode(referenceRbc);
const targetNativeFailure = runNativeFailure(targetRbc);
const interpreterNames = instructionNames(decodedInterpreter);
const targetNames = instructionNames(decodedTarget);
const nativeFormat = nativeExeFormat(DEFAULT_NATIVE_VM_PATH);
const builtinInstruction = decodedTarget.instructions.find(instruction => instruction.name === 'CALL_BUILTIN');
const providerInstruction = decodedTarget.instructions.find(instruction => instruction.name === 'CALL_PROVIDER');

const checks = {
  nativeVmIsRealWindowsExecutable: process.platform !== 'win32'
    ? fs.existsSync(DEFAULT_NATIVE_VM_PATH)
    : nativeFormat.exists === true && nativeFormat.mz === true && nativeFormat.pe === true,
  interpreterRunsInNativeVm: interpreterRun.status === 'ok'
    && state['selfhost.stage_status'] === 'RCL_OWNED_BUILTIN_PROVIDER_SOURCE_LOWERING_SUBSET_VERIFIED',
  rclGeneratedTargetRbcMatchesJsCompiler: targetRbc.equals(referenceRbc)
    && sha256(targetRbc) === sha256(referenceRbc),
  rclExtractedSourceFieldsMatchCompilerShape: state['compiler.program'] === compilerProgram.name
    && state['source.root'] === compilerProgram.programRoot
    && state['compiler.builtin_facet_path'] === 'metrics.request_size'
    && state['compiler.builtin_name'] === 'length'
    && state['compiler.builtin_text'] === 'request'
    && state['compiler.provider_facet_path'] === 'provider.reply'
    && state['compiler.provider_id'] === 'echo'
    && state['compiler.provider_capability'] === 'echo.text'
    && state['compiler.provider_request'] === 'request',
  decodedTargetShapeMatches: decodedTarget.program === 'RuntimeBuiltinProviderSourceLoweringTarget'
    && decodedTarget.sourceRoot === compilerProgram.programRoot
    && decodedTarget.strings.length === 7
    && decodedTarget.numbers.length === 0
    && decodedTarget.instructions.length === 6
    && targetNames[0] === 'PUSH_STRING'
    && targetNames[1] === 'CALL_BUILTIN'
    && targetNames[2] === 'STORE_STATE'
    && targetNames[3] === 'CALL_PROVIDER'
    && targetNames[4] === 'STORE_STATE'
    && targetNames[5] === 'HALT'
    && builtinInstruction?.builtin === 'LENGTH'
    && providerInstruction?.a === 4
    && providerInstruction?.b === 5
    && providerInstruction?.c === 2
    && JSON.stringify(decodedTarget.strings) === JSON.stringify(decodedReference.strings),
  nativeVmRejectsTargetWithProviderMissingAfterBuiltinPrefix: targetNativeFailure.ok === true
    && targetNativeFailure.code === 'RCL_NATIVE_PROVIDER_MISSING'
    && targetNativeFailure.message === "Provider 'echo' is not registered for capability 'echo.text'",
  decodedInterpreterContainsBuiltinProviderSourceLoweringRuntime: interpreterNames.includes('CALL')
    && interpreterNames.includes('RETURN')
    && decodedInterpreter.instructions.some(instruction => instruction.builtin === 'SPLIT_BEFORE')
    && decodedInterpreter.instructions.some(instruction => instruction.builtin === 'SPLIT_AFTER')
    && decodedInterpreter.instructions.some(instruction => instruction.builtin === 'UTF8_BYTES')
    && decodedInterpreter.instructions.some(instruction => instruction.builtin === 'SEQUENCE_GET')
    && decodedInterpreter.instructions.some(instruction => instruction.builtin === 'SEQUENCE_APPEND')
    && decodedInterpreter.strings.includes('length("')
    && decodedInterpreter.strings.includes('provider_call("')
    && decodedInterpreter.strings.includes('RCL_OWNED_BUILTIN_PROVIDER_SOURCE_LOWERING_SUBSET_VERIFIED'),
  boundaryHonest: state['selfhost.boundary'] === 'builtin_and_provider_source_lowering_subset_not_complete_compiler_or_runtime'
    && state['gate.rcl_owned_builtin_provider_source_lowering_subset'] === true
    && state['gate.rcl_owned_parser_complete'] === false
    && state['gate.rcl_owned_rule_bytecode_lowering_complete'] === false
    && state['gate.rcl_compiler_self_emits_without_stage0'] === false
    && state['gate.rcl_owned_runtime_complete'] === false
    && state['gate.rcl_owned_runtime_root_hashing_complete'] === false
    && state['gate.native_vm_host_still_required'] === true,
};

const payload = {
  ok: Object.values(checks).every(Boolean),
  format: 'rcl.selfhost.stage23.verification.v1',
  rclFile: path.relative(root, rclPath).replaceAll(path.sep, '/'),
  interpreterArtifactFile: path.relative(root, interpreterArtifactPath).replaceAll(path.sep, '/'),
  targetRbcFile: path.relative(root, targetRbcPath).replaceAll(path.sep, '/'),
  referenceRbcFile: path.relative(root, referenceRbcPath).replaceAll(path.sep, '/'),
  stageStatus: state['selfhost.stage_status'],
  selfHostClaim: state['selfhost.claim'],
  checks,
  nativeVm: {
    path: path.relative(root, DEFAULT_NATIVE_VM_PATH).replaceAll(path.sep, '/'),
    defaultPath: DEFAULT_NATIVE_VM_PATH,
    sha256: sha256File(DEFAULT_NATIVE_VM_PATH),
    executableFormat: nativeFormat,
  },
  compiler: {
    sourceRoot: compilerProgram.programRoot,
    program: compilerProgram.name,
    builtinFacetPath: state['compiler.builtin_facet_path'],
    builtinName: state['compiler.builtin_name'],
    builtinText: state['compiler.builtin_text'],
    providerFacetPath: state['compiler.provider_facet_path'],
    providerId: state['compiler.provider_id'],
    providerCapability: state['compiler.provider_capability'],
    providerRequest: state['compiler.provider_request'],
  },
  interpreterArtifact: {
    program: decodedInterpreter.program,
    bytes: interpreterArtifact.length,
    sha256: sha256(interpreterArtifact),
    instructionCount: decodedInterpreter.instructions.length,
  },
  target: {
    program: decodedTarget.program,
    sourceRoot: decodedTarget.sourceRoot,
    bytes: targetRbc.length,
    sha256: sha256(targetRbc),
    referenceSha256: sha256(referenceRbc),
    exactReferenceMatch: targetRbc.equals(referenceRbc),
    strings: decodedTarget.strings,
    instructions: decodedTarget.instructions,
    nativeFailure: targetNativeFailure,
  },
  reference: {
    program: decodedReference.program,
    sourceRoot: decodedReference.sourceRoot,
    bytes: referenceRbc.length,
    strings: decodedReference.strings,
    instructions: decodedReference.instructions,
  },
  boundaries: {
    implementedNow: 'A native-running RCL artifact extracts one builtin facet and one provider_call facet from source text, emits a bytecode program containing PUSH_STRING, CALL_BUILTIN LENGTH, STORE_STATE, CALL_PROVIDER, STORE_STATE and HALT, and that program is byte-identical to the JS compiler output.',
    notYetImplemented: 'This is still a constrained source-text lowering subset. It is not a complete lexer/parser, not general expression lowering, not rule/emergence lowering from source, not pure RCL compiler fixed point, and not a complete RCL-owned runtime.',
    nextTarget: state['selfhost.next_rewrite_target'],
  },
};

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(interpreterArtifactPath, interpreterArtifact);
fs.writeFileSync(targetRbcPath, targetRbc);
fs.writeFileSync(referenceRbcPath, referenceRbc);
fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(JSON.stringify(payload, null, 2));

if (!payload.ok) process.exitCode = 1;
