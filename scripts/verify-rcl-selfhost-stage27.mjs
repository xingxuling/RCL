#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { compileReality } from '../src/compiler.mjs';
import { compileRealityToBytecode, decodeBytecode } from '../src/bytecode.mjs';
import { runReality } from '../src/runtime.mjs';
import { DEFAULT_NATIVE_VM_PATH, runNativeBytecode } from '../src/native-vm.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const rclPath = path.join(root, 'selfhost', 'rcl-rule-emergence-source-lowering-stage27.rcl');
const outputDir = path.join(root, 'output', 'selfhost');
const outputPath = path.join(outputDir, 'stage27-verification.json');
const interpreterArtifactPath = path.join(outputDir, 'stage27-rule-emergence-source-lowering-interpreter.rbc');
const targetRbcPath = path.join(outputDir, 'stage27-rule-emergence-source-lowered-target.rbc');
const referenceRbcPath = path.join(outputDir, 'stage27-rule-emergence-source-js-reference.rbc');

function sha256(buffer) {
  return crypto.createHash('sha256').update(Buffer.from(buffer)).digest('hex');
}

function sha256File(filePath) {
  return fs.existsSync(filePath)
    ? crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
    : null;
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

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalJson(value[key])]));
  }
  return value;
}

function sameJson(left, right) {
  return JSON.stringify(canonicalJson(left)) === JSON.stringify(canonicalJson(right));
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
    && record?.witnesses?.[0] === 'rcl:stage27:published';
}

const rclSource = fs.readFileSync(rclPath, 'utf8');
const interpreterArtifact = Buffer.from(compileRealityToBytecode(rclSource));
const interpreterRun = runNativeBytecode(interpreterArtifact, { maxBuffer: 96 * 1024 * 1024, timeout: 60_000 });
const state = interpreterRun.state;
const sourceText = state['source.full'];
const compilerProgram = compileReality(sourceText);
const referenceRbc = Buffer.from(compileRealityToBytecode(sourceText));
const targetRbc = Buffer.from(state['target.rbc_bytes']);
const decodedInterpreter = decodeBytecode(interpreterArtifact);
const decodedTarget = decodeBytecode(targetRbc);
const decodedReference = decodeBytecode(referenceRbc);
const targetNativeRun = runNativeBytecode(targetRbc, { maxBuffer: 32 * 1024 * 1024 });
const targetReferenceRun = await runReality(compilerProgram);
const interpreterNames = instructionNames(decodedInterpreter);
const targetNames = instructionNames(decodedTarget);
const nativeFormat = nativeExeFormat(DEFAULT_NATIVE_VM_PATH);

const expectedStrings = [
  'RuntimeRuleSourceLoweringTarget',
  'f5674dfb60b01df609f181eea2370994db01b04baa423f504640021aff3274f3',
  'world.ready',
  'draft',
  'world.status',
  'founder',
  'world.publish',
  'world',
  'publish',
  'published',
  'rcl:stage27:published',
];

const expectedTargetState = {
  'world.ready': true,
  'world.status': 'published',
};

const readyFacet = state['compiler.ready_facet'];
const statusFacet = state['compiler.status_facet'];
const subject = state['compiler.subject'];
const rule = state['compiler.rule'];

const checks = {
  nativeVmIsRealWindowsExecutable: process.platform !== 'win32'
    ? fs.existsSync(DEFAULT_NATIVE_VM_PATH)
    : nativeFormat.exists === true && nativeFormat.mz === true && nativeFormat.pe === true,
  interpreterRunsInNativeVm: interpreterRun.status === 'ok'
    && state['selfhost.stage_status'] === 'RCL_OWNED_RULE_EMERGENCE_SOURCE_LOWERING_SUBSET_VERIFIED',
  rclParsedRuleSourceShape: state['parser.token_count'] === 67
    && state['parser.first_token'] === 'reality'
    && state['parser.program_token'] === 'RuntimeRuleSourceLoweringTarget'
    && state['parser.subject_start'] === 19
    && state['parser.emergence_start'] === 29
    && state['parser.foresee_start'] === 61
    && state['parser.realize_start'] === 63
    && state['compiler.facet_count'] === 2
    && state['compiler.subject_count'] === 1
    && state['compiler.warrant_count'] === 1
    && state['compiler.emergence_count'] === 1
    && state['compiler.directive_count'] === 2
    && readyFacet?.[0] === 'world.ready'
    && readyFacet?.[2]?.[0] === 'LiteralExpr'
    && readyFacet?.[2]?.[3] === 'true'
    && statusFacet?.[0] === 'world.status'
    && statusFacet?.[2]?.[3] === 'draft'
    && subject?.[0] === 'founder'
    && subject?.[1] === 'world.publish'
    && subject?.[2] === 'world'
    && rule?.[0] === 'publish'
    && rule?.[1] === 'founder'
    && rule?.[2] === 'world.ready'
    && rule?.[3] === 'world.publish'
    && rule?.[4] === 'world'
    && rule?.[5] === 'world.status'
    && rule?.[6] === 'published'
    && rule?.[7] === 'world.status'
    && rule?.[8] === '=='
    && rule?.[9] === 'published'
    && rule?.[10] === 'rcl:stage27:published'
    && state['compiler.foresee_rule'] === 'publish'
    && state['compiler.realize_rule'] === 'publish'
    && state['compiler.rule_source_lowering_supported'] === true,
  rclGeneratedTargetRbcMatchesJsCompiler: targetRbc.equals(referenceRbc)
    && sha256(targetRbc) === sha256(referenceRbc),
  rclParsedSourceFieldsMatchCompilerShape: state['compiler.program'] === compilerProgram.name
    && state['source.root'] === compilerProgram.programRoot
    && compilerProgram.facets.length === 2
    && compilerProgram.warrants.length === 1
    && compilerProgram.rules.length === 1
    && compilerProgram.directives.length === 2
    && compilerProgram.rules[0].name === 'publish'
    && compilerProgram.rules[0].cause === 'founder'
    && compilerProgram.rules[0].needs[0].capability === 'world.publish'
    && compilerProgram.rules[0].alters[0].target === 'world.status'
    && compilerProgram.rules[0].witnesses[0] === 'rcl:stage27:published'
    && compilerProgram.directives[0].kind === 'Foresee'
    && compilerProgram.directives[1].kind === 'Realize',
  decodedTargetShapeMatches: decodedTarget.program === 'RuntimeRuleSourceLoweringTarget'
    && decodedTarget.sourceRoot === compilerProgram.programRoot
    && JSON.stringify(decodedTarget.strings) === JSON.stringify(expectedStrings)
    && JSON.stringify(decodedTarget.strings) === JSON.stringify(decodedReference.strings)
    && decodedTarget.numbers.length === 0
    && decodedTarget.instructions.length === 34
    && JSON.stringify(decodedTarget.instructions) === JSON.stringify(decodedReference.instructions)
    && targetNames.includes('GRANT_WARRANT')
    && targetNames.filter(name => name === 'BEGIN_TX').length === 2
    && targetNames.filter(name => name === 'CHECK_WARRANT').length === 2
    && targetNames.filter(name => name === 'STAGE_STORE').length === 2
    && targetNames.filter(name => name === 'CHECK_PRESERVE').length === 2
    && targetNames.filter(name => name === 'RECORD_WITNESS').length === 2
    && targetNames.filter(name => name === 'COMMIT_TX').length === 2
    && targetNames.at(-1) === 'HALT',
  rclGeneratedTargetRunsInNativeVm: targetNativeRun.status === 'ok'
    && sameJson(targetNativeRun.state, expectedTargetState)
    && sameJson(targetNativeRun.state, targetReferenceRun.state)
    && targetNativeRun.projections.length === 1
    && targetNativeRun.history.length === 1
    && hasTransactionRecordShape(targetNativeRun.projections[0], 'Projection', 'foresee', 'projected')
    && hasTransactionRecordShape(targetNativeRun.history[0], 'Transition', 'realize', 'realized'),
  targetNativeAndJsTransactionHistoryMatch: targetReferenceRun.projections.length === 1
    && targetReferenceRun.history.length === 1
    && hasTransactionRecordShape(targetReferenceRun.projections[0], 'Projection', 'foresee', 'projected')
    && hasTransactionRecordShape(targetReferenceRun.history[0], 'Transition', 'realize', 'realized')
    && sameJson(targetNativeRun.projections, targetReferenceRun.projections)
    && sameJson(targetNativeRun.history, targetReferenceRun.history),
  decodedInterpreterContainsRuleSourceLoweringRuntime: interpreterNames.includes('CALL')
    && interpreterNames.includes('RETURN')
    && decodedInterpreter.instructions.some(instruction => instruction.builtin === 'MAKE_TOKEN')
    && decodedInterpreter.instructions.some(instruction => instruction.builtin === 'EXPECT_TOKEN')
    && decodedInterpreter.instructions.some(instruction => instruction.builtin === 'SEQUENCE_APPEND')
    && decodedInterpreter.instructions.some(instruction => instruction.builtin === 'BYTES_U8')
    && decodedInterpreter.instructions.some(instruction => instruction.builtin === 'BYTES_I32LE')
    && decodedInterpreter.strings.includes('RCL_OWNED_RULE_EMERGENCE_SOURCE_LOWERING_SUBSET_VERIFIED')
    && decodedInterpreter.strings.includes('single_rule_emergence_source_lowering_subset_not_complete_parser_compiler_or_runtime')
    && decodedInterpreter.strings.includes('emergence')
    && decodedInterpreter.strings.includes('foresee')
    && decodedInterpreter.strings.includes('realize'),
  boundaryHonest: state['selfhost.boundary'] === 'single_rule_emergence_source_lowering_subset_not_complete_parser_compiler_or_runtime'
    && state['gate.rcl_owned_rule_emergence_source_lowering_subset'] === true
    && state['gate.rcl_owned_rule_transaction_bytecode_subset'] === true
    && state['gate.rcl_owned_target_native_execution_subset'] === true
    && state['gate.rcl_owned_parser_complete'] === false
    && state['gate.rcl_owned_expression_ast_complete'] === false
    && state['gate.rcl_owned_rule_bytecode_lowering_complete'] === false
    && state['gate.rcl_compiler_self_emits_without_stage0'] === false
    && state['gate.rcl_owned_runtime_complete'] === false
    && state['gate.rcl_owned_runtime_root_hashing_complete'] === false
    && state['gate.native_vm_host_still_required'] === true,
};

const payload = {
  ok: Object.values(checks).every(Boolean),
  format: 'rcl.selfhost.stage27.verification.v1',
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
  parser: {
    tokenCount: state['parser.token_count'],
    firstToken: state['parser.first_token'],
    programToken: state['parser.program_token'],
    subjectStart: state['parser.subject_start'],
    emergenceStart: state['parser.emergence_start'],
    foreseeStart: state['parser.foresee_start'],
    realizeStart: state['parser.realize_start'],
    eofKind: state['parser.eof_kind'],
  },
  compiler: {
    sourceRoot: compilerProgram.programRoot,
    program: compilerProgram.name,
    facetCount: state['compiler.facet_count'],
    subjectCount: state['compiler.subject_count'],
    warrantCount: state['compiler.warrant_count'],
    emergenceCount: state['compiler.emergence_count'],
    directiveCount: state['compiler.directive_count'],
    readyFacet,
    statusFacet,
    subject,
    rule,
    foreseeRule: state['compiler.foresee_rule'],
    realizeRule: state['compiler.realize_rule'],
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
    nativeRun: {
      status: targetNativeRun.status,
      state: targetNativeRun.state,
      projections: targetNativeRun.projections,
      history: targetNativeRun.history,
      metrics: targetNativeRun.metrics,
    },
  },
  reference: {
    program: decodedReference.program,
    sourceRoot: decodedReference.sourceRoot,
    bytes: referenceRbc.length,
    strings: decodedReference.strings,
    instructions: decodedReference.instructions,
    runtimeState: targetReferenceRun.state,
    projections: targetReferenceRun.projections,
    history: targetReferenceRun.history,
  },
  boundaries: {
    implementedNow: 'A native-running RCL artifact tokenizes and parses a single subject/warrant/emergence/foresee/realize source program, extracts the rule transaction fields, emits GRANT_WARRANT/BEGIN_TX/CHECK_WARRANT/STAGE_STORE/CHECK_PRESERVE/RECORD_WITNESS/COMMIT_TX bytecode, matches the JS compiler byte-for-byte, and the generated target runs in native rclvm.exe with matching projection/history.',
    notYetImplemented: 'This is still a constrained single-rule emergence lowering subset. It is not a complete parser, not arbitrary rule/expression bytecode lowering, not pure RCL compiler fixed point, and not a complete RCL-owned runtime.',
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
