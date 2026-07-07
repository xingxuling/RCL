#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { tryCompileReality } from '../src/compiler.mjs';
import { compileRealityToBytecode, decodeBytecode } from '../src/bytecode.mjs';
import { runNativeBytecode } from '../src/native-vm.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const rclPath = path.join(root, 'selfhost', 'rcl-runtime-typed-values-interpreter-stage17.rcl');
const outputDir = path.join(root, 'output', 'selfhost');
const outputPath = path.join(outputDir, 'stage17-verification.json');
const interpreterArtifactPath = path.join(outputDir, 'stage17-runtime-typed-values-interpreter.rbc');
const targetRbcPath = path.join(outputDir, 'stage17-runtime-typed-values-target.rbc');
const jsReferenceTargetRbcPath = path.join(outputDir, 'stage17-runtime-typed-values-target-js-reference.rbc');

const targetSource = String.raw`reality RuntimeTypedValuesTarget {
  facet app.session : core.Session = { user: { id: "u-3", payload: "referenced" }, login: Ok("accepted") }
  facet app.login : core.LoginResult<Text, Text> = Err("denied")
  facet app.message : Text = match app.login {
    Ok(value) -> value
    Err(reason) -> reason
  }
  facet app.sessionRef : TypedRef = typed_ref(app.session)
  facet app.sessionRefId : Number = typed_ref_id(app.sessionRef)
  facet app.sessionAgain : core.Session = typed_deref(app.sessionRef)
  facet app.payloadViaRef : Text = app.sessionAgain.user.payload
}
`;

const targetTypeModuleSources = [String.raw`module core
export record User<T> {
  id: Text
  payload: T
}
export union LoginResult<T,E> {
  Ok(T)
  Err(E)
}
export record Session {
  user: User<Text>
  login: LoginResult<Text,Text>
}
`];

function sha256(buffer) {
  return crypto.createHash('sha256').update(Buffer.from(buffer)).digest('hex');
}

function instructionNames(decoded) {
  return decoded.instructions.map(instruction => instruction.name);
}

function compileTypedTargetToBytecode() {
  const compiled = tryCompileReality(targetSource, { typeModuleSources: targetTypeModuleSources });
  if (!compiled.ok) {
    throw new Error(`Stage17 typed target compile failed: ${JSON.stringify(compiled.diagnostics)}`);
  }
  return {
    compiled,
    bytecode: Buffer.from(compileRealityToBytecode(compiled.program)),
  };
}

const rclSource = fs.readFileSync(rclPath, 'utf8');
const interpreterArtifact = Buffer.from(compileRealityToBytecode(rclSource));
const interpreterRun = runNativeBytecode(interpreterArtifact, { maxBuffer: 64 * 1024 * 1024, timeout: 60_000 });
const state = interpreterRun.state;
const targetRbc = Buffer.from(state['target.rbc_bytes']);
const { compiled: targetCompiled, bytecode: jsReferenceTargetRbc } = compileTypedTargetToBytecode();
const decodedInterpreter = decodeBytecode(interpreterArtifact);
const decodedTarget = decodeBytecode(targetRbc);
const decodedJsReferenceTarget = decodeBytecode(jsReferenceTargetRbc);
const targetNativeRun = runNativeBytecode(targetRbc, { maxBuffer: 32 * 1024 * 1024, timeout: 60_000 });
const targetInstructionNames = instructionNames(decodedTarget);
const interpreterInstructionNames = instructionNames(decodedInterpreter);

const requiredTypedOps = [
  'MAKE_TYPED_RECORD',
  'MAKE_TYPED_UNION',
  'GET_TYPED_FIELD',
  'IS_UNION_VARIANT',
  'GET_UNION_PAYLOAD',
  'MAKE_TYPED_REF',
  'DEREF_TYPED_REF',
  'GET_TYPED_REF_ID',
];

const checks = {
  interpreterRunsInNativeVm: interpreterRun.status === 'ok'
    && state['selfhost.stage_status'] === 'RCL_OWNED_RUNTIME_TYPED_VALUES_SUBSET_VERIFIED',
  rclGeneratedTargetRbcMatchesJsTypedCompiler: targetRbc.equals(jsReferenceTargetRbc)
    && sha256(targetRbc) === sha256(jsReferenceTargetRbc),
  decodedTargetShapeMatches: decodedTarget.format === 'rcl.bytecode.v1'
    && decodedTarget.program === 'RuntimeTypedValuesTarget'
    && decodedTarget.sourceRoot === targetCompiled.program.programRoot
    && decodedTarget.instructions.length === 38
    && JSON.stringify(decodedTarget.instructions) === JSON.stringify(decodedJsReferenceTarget.instructions)
    && JSON.stringify(decodedTarget.strings) === JSON.stringify(decodedJsReferenceTarget.strings)
    && JSON.stringify(decodedTarget.numbers) === JSON.stringify([]),
  targetActuallyUsesTypedValuesAndRefs: requiredTypedOps.every(name => targetInstructionNames.includes(name))
    && targetInstructionNames.includes('JUMP')
    && targetInstructionNames.includes('JUMP_IF_FALSE')
    && targetInstructionNames.at(-1) === 'HALT',
  nativeVmDirectlyRunsTypedTarget: targetNativeRun.status === 'ok'
    && targetNativeRun.state['app.message'] === 'denied'
    && targetNativeRun.state['app.payloadViaRef'] === 'referenced'
    && targetNativeRun.state['app.sessionRefId'] === 3
    && targetNativeRun.typedHeap.allocated === 4
    && targetNativeRun.typedHeap.references === 1
    && targetNativeRun.typedHeap.nextObjectId === 5,
  rclInterpreterStateMatchesNativeTypedRuntime: state['runtime.app_message'] === targetNativeRun.state['app.message']
    && state['runtime.app_payload_via_ref'] === targetNativeRun.state['app.payloadViaRef']
    && state['runtime.app_session_ref_id'] === targetNativeRun.state['app.sessionRefId']
    && state['runtime.session_object_id'] === targetNativeRun.state['app.session'].__rclObjectId
    && state['runtime.session_again_object_id'] === targetNativeRun.state['app.sessionAgain'].__rclObjectId
    && state['runtime.session_ref_object_id'] === targetNativeRun.state['app.sessionRef'].__rclRefObjectId
    && state['runtime.login_variant'] === targetNativeRun.state['app.login'].variant
    && state['runtime.typed_object_count'] === targetNativeRun.typedHeap.allocated
    && state['runtime.typed_ref_count'] === targetNativeRun.typedHeap.references
    && state['runtime.next_object_id'] === targetNativeRun.typedHeap.nextObjectId
    && state['runtime.stack_count'] === 0
    && state['runtime.state_count'] === 7,
  decodedInterpreterContainsRclRuntimeMachinery: interpreterInstructionNames.includes('CALL')
    && interpreterInstructionNames.includes('RETURN')
    && decodedInterpreter.instructions.some(instruction => instruction.builtin === 'SEQUENCE_GET')
    && decodedInterpreter.instructions.some(instruction => instruction.builtin === 'SEQUENCE_APPEND')
    && decodedInterpreter.instructions.some(instruction => instruction.builtin === 'SEQUENCE_CONCAT')
    && decodedInterpreter.instructions.some(instruction => instruction.builtin === 'SEMANTIC_ASSERT'),
  boundaryHonest: state['selfhost.boundary'] === 'typed_record_union_ref_runtime_subset_not_complete_rcl_runtime'
    && state['gate.rcl_owned_runtime_subset'] === true
    && state['gate.rcl_owned_runtime_typed_values_subset'] === true
    && state['gate.rcl_owned_runtime_complete'] === false
    && state['gate.js_runtime_still_required'] === true
    && state['gate.native_vm_host_still_required'] === true,
};

const payload = {
  ok: Object.values(checks).every(Boolean),
  format: 'rcl.selfhost.stage17.verification.v1',
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
      message: state['runtime.app_message'],
      payloadViaRef: state['runtime.app_payload_via_ref'],
      sessionRefId: state['runtime.app_session_ref_id'],
      sessionObjectId: state['runtime.session_object_id'],
      sessionAgainObjectId: state['runtime.session_again_object_id'],
      sessionRefObjectId: state['runtime.session_ref_object_id'],
      loginVariant: state['runtime.login_variant'],
      typedObjectCount: state['runtime.typed_object_count'],
      typedRefCount: state['runtime.typed_ref_count'],
      nextObjectId: state['runtime.next_object_id'],
      stackCount: state['runtime.stack_count'],
      stateCount: state['runtime.state_count'],
      stateKeys: state['runtime.state_keys'],
      stateValues: state['runtime.state_values'],
      finalPc: state['runtime.final_pc'],
    },
    nativeDirect: {
      state: targetNativeRun.state,
      typedHeap: targetNativeRun.typedHeap,
      metrics: targetNativeRun.metrics,
    },
  },
  boundaries: {
    implementedNow: 'A native-running RCL artifact emits byte-exact typed target RBC and interprets target bytecode for typed record construction, typed union construction, typed field access, union variant checks, union payload access, typed_ref, typed_deref and typed_ref_id. The RCL interpreter state matches native/rclvm.exe typed runtime semantics for object ids, refs and selected typed fields.',
    notYetImplemented: 'This is still a typed-value/ref subset interpreter, not full RCL-owned runtime parity. Full root/history/error-path parity, provider parity, every opcode combination, and a compiler that self-emits without the JS stage0 remain incomplete.',
    nextTarget: state['selfhost.next_rewrite_target'],
  },
  roots: {
    targetProgramRoot: targetCompiled.program.programRoot,
  },
};

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(interpreterArtifactPath, interpreterArtifact);
fs.writeFileSync(targetRbcPath, targetRbc);
fs.writeFileSync(jsReferenceTargetRbcPath, jsReferenceTargetRbc);
fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(JSON.stringify(payload, null, 2));

if (!payload.ok) process.exitCode = 1;
