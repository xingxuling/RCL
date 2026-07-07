#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { compileReality } from '../src/compiler.mjs';
import { compileRealityToBytecode, decodeBytecode } from '../src/bytecode.mjs';
import { runReality } from '../src/runtime.mjs';
import { RCLNativeVMError, runNativeBytecode } from '../src/native-vm.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const rclPath = path.join(root, 'selfhost', 'rcl-runtime-calls-builtins-provider-interpreter-stage16.rcl');
const outputDir = path.join(root, 'output', 'selfhost');
const outputPath = path.join(outputDir, 'stage16-verification.json');
const interpreterArtifactPath = path.join(outputDir, 'stage16-runtime-calls-builtins-provider-interpreter.rbc');
const targetRbcPath = path.join(outputDir, 'stage16-runtime-calls-builtins-provider-target.rbc');
const jsReferenceTargetRbcPath = path.join(outputDir, 'stage16-runtime-calls-builtins-provider-target-js-reference.rbc');

const targetSource = String.raw`reality RuntimeCallsBuiltinsProviderTarget {
  facet text.raw : Text = "  hello-provider  "
  reckon normalize(value : Text) -> Text = upper_text(trim(value))
  facet text.normalized : Text = normalize(text.raw)
  facet text.length : Number = length(text.normalized)
  facet provider.reply : Text = provider_call("echo", "echo.text", "{\"message\":\"hello-provider\"}")
  facet provider.ok : Truth = contains(provider.reply, "hello-provider")
}
`;

function sha256(buffer) {
  return crypto.createHash('sha256').update(Buffer.from(buffer)).digest('hex');
}

function instructionNames(decoded) {
  return decoded.instructions.map(instruction => instruction.name);
}

function runDefaultNativeProviderBoundary(targetRbc) {
  try {
    const run = runNativeBytecode(targetRbc, { maxBuffer: 32 * 1024 * 1024 });
    return { ok: false, unexpectedlyRan: true, run };
  } catch (error) {
    if (error instanceof RCLNativeVMError) {
      return {
        ok: error.code === 'RCL_NATIVE_PROVIDER_MISSING',
        unexpectedlyRan: false,
        code: error.code,
        message: error.message,
      };
    }
    throw error;
  }
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
const targetCompiled = compileReality(targetSource);
const targetInstructionNames = instructionNames(decodedTarget);
const interpreterInstructionNames = instructionNames(decodedInterpreter);
const targetNativeDefaultBoundary = runDefaultNativeProviderBoundary(targetRbc);
const targetJsRun = await runReality(targetSource, {
  providers: {
    echo: (_capability, request) => `{"provider":"echo","request":${request}}`,
  },
});

const checks = {
  interpreterRunsInNativeVm: interpreterRun.status === 'ok'
    && state['selfhost.stage_status'] === 'RCL_OWNED_RUNTIME_CALLS_BUILTINS_PROVIDER_SUBSET_VERIFIED',
  rclGeneratedTargetRbcMatchesJsCompiler: targetRbc.equals(jsReferenceTargetRbc)
    && sha256(targetRbc) === sha256(jsReferenceTargetRbc),
  decodedTargetShapeMatches: decodedTarget.format === 'rcl.bytecode.v1'
    && decodedTarget.program === 'RuntimeCallsBuiltinsProviderTarget'
    && decodedTarget.sourceRoot === targetCompiled.programRoot
    && decodedTarget.instructions.length === 19
    && JSON.stringify(decodedTarget.instructions) === JSON.stringify(decodedJsReferenceTarget.instructions)
    && JSON.stringify(decodedTarget.numbers) === JSON.stringify([]),
  targetActuallyUsesCallsBuiltinsAndProvider: targetInstructionNames.includes('CALL')
    && targetInstructionNames.includes('LOAD_LOCAL')
    && targetInstructionNames.includes('RETURN')
    && targetInstructionNames.includes('CALL_BUILTIN')
    && targetInstructionNames.includes('CALL_PROVIDER')
    && decodedTarget.instructions.filter(instruction => instruction.name === 'CALL_BUILTIN').length === 4
    && targetInstructionNames.at(14) === 'HALT',
  rclInterpreterStateMatchesJsRuntimeWithProvider: state['runtime.text_raw'] === targetJsRun.state['text.raw']
    && state['runtime.text_normalized'] === targetJsRun.state['text.normalized']
    && state['runtime.text_length'] === targetJsRun.state['text.length']
    && state['runtime.provider_reply'] === targetJsRun.state['provider.reply']
    && state['runtime.provider_ok'] === targetJsRun.state['provider.ok']
    && state['runtime.stack_count'] === 0
    && state['runtime.call_depth'] === 0
    && state['runtime.provider_count'] === 1
    && state['runtime.builtin_count'] === 4
    && state['runtime.call_count'] === 1,
  defaultNativeVmRejectsUnregisteredProvider: targetNativeDefaultBoundary.ok === true
    && targetNativeDefaultBoundary.code === 'RCL_NATIVE_PROVIDER_MISSING',
  decodedInterpreterContainsCallFrameAndBuiltinRuntime: interpreterInstructionNames.includes('CALL')
    && interpreterInstructionNames.includes('RETURN')
    && interpreterInstructionNames.includes('LOAD_STATE')
    && decodedInterpreter.instructions.some(instruction => instruction.builtin === 'SEQUENCE_GET')
    && decodedInterpreter.instructions.some(instruction => instruction.builtin === 'SEQUENCE_APPEND')
    && decodedInterpreter.instructions.some(instruction => instruction.builtin === 'TRIM')
    && decodedInterpreter.instructions.some(instruction => instruction.builtin === 'UPPER_TEXT')
    && decodedInterpreter.instructions.some(instruction => instruction.builtin === 'CONTAINS'),
  boundaryHonest: state['selfhost.boundary'] === 'reckoning_call_builtin_provider_call_subset_not_complete_rcl_runtime'
    && state['gate.rcl_owned_runtime_subset'] === true
    && state['gate.rcl_owned_runtime_calls_builtins_provider_subset'] === true
    && state['gate.rcl_owned_runtime_complete'] === false
    && state['gate.native_vm_host_still_required'] === true,
};

const payload = {
  ok: Object.values(checks).every(Boolean),
  format: 'rcl.selfhost.stage16.verification.v1',
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
      builtin: instruction.builtin,
    })),
  },
  runtimeComparison: {
    rclInterpreter: {
      textRaw: state['runtime.text_raw'],
      textNormalized: state['runtime.text_normalized'],
      textLength: state['runtime.text_length'],
      providerReply: state['runtime.provider_reply'],
      providerOk: state['runtime.provider_ok'],
      providerCount: state['runtime.provider_count'],
      builtinCount: state['runtime.builtin_count'],
      callCount: state['runtime.call_count'],
      stackCount: state['runtime.stack_count'],
      callDepth: state['runtime.call_depth'],
      stateKeys: state['runtime.state_keys'],
      stateValues: state['runtime.state_values'],
      finalPc: state['runtime.final_pc'],
    },
    jsReference: {
      state: targetJsRun.state,
      historyLength: targetJsRun.history.length,
      projectionLength: targetJsRun.projections.length,
    },
    nativeDefaultProviderBoundary: targetNativeDefaultBoundary,
  },
  boundaries: {
    implementedNow: 'A native-running RCL artifact interprets target bytecode for a reckoning CALL/RETURN frame, LOAD_LOCAL, CALL_BUILTIN for TRIM, UPPER_TEXT, LENGTH and CONTAINS, plus a deterministic echo CALL_PROVIDER subset. The target RBC is byte-identical to the JS compiler output, and interpreted state matches the JS runtime with an explicit echo provider.',
    notYetImplemented: 'Provider execution is still interpreted inside the RCL artifact as a deterministic echo subset; ordinary native/rclvm.exe still rejects CALL_PROVIDER without a registered provider. This is not full host-call runtime parity, not full typed-value runtime coverage, not full root/history parity, and not a complete RCL-owned runtime.',
    nextTarget: state['selfhost.next_rewrite_target'],
  },
  roots: {
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
