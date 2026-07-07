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
const rclPath = path.join(root, 'selfhost', 'rcl-rule-expression-source-lowering-stage28.rcl');
const outputDir = path.join(root, 'output', 'selfhost');
const outputPath = path.join(outputDir, 'stage28-verification.json');
const interpreterArtifactPath = path.join(outputDir, 'stage28-rule-expression-source-lowering-interpreter.rbc');
const targetRbcPath = path.join(outputDir, 'stage28-rule-expression-source-lowered-target.rbc');
const referenceRbcPath = path.join(outputDir, 'stage28-rule-expression-source-js-reference.rbc');

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
    && record.changes[0].target === 'world.score'
    && record.changes[0].before === 1
    && record.changes[0].after === 3
    && record?.authority?.needs?.[0]?.capability === 'world.publish'
    && record?.authority?.needs?.[0]?.target === 'world'
    && record?.authority?.activeWarrants?.[0]?.subject === 'founder'
    && record?.authority?.activeWarrants?.[0]?.capability === 'world.publish'
    && record?.authority?.activeWarrants?.[0]?.target === 'world'
    && record?.witnesses?.[0] === 'rcl:stage28:score';
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
  'RuntimeRuleExpressionSourceLoweringTarget',
  'ff6acd2e9be41d5ba47d2b00423d2ba7e497e29f0e14fdb3a73c0b9436379f67',
  'world.ready',
  'world.score',
  'founder',
  'world.publish',
  'world',
  'publish',
  'rcl:stage28:score',
];

const expectedNumbers = [1, 2, 3];
const expectedTargetState = {
  'world.ready': true,
  'world.score': 3,
};

const readyFacet = state['compiler.ready_facet'];
const scoreFacet = state['compiler.score_facet'];
const subject = state['compiler.subject'];
const rule = state['compiler.rule'];
const jsRule = compilerProgram.rules[0];

const checks = {
  nativeVmIsRealWindowsExecutable: process.platform !== 'win32'
    ? fs.existsSync(DEFAULT_NATIVE_VM_PATH)
    : nativeFormat.exists === true && nativeFormat.mz === true && nativeFormat.pe === true,
  interpreterRunsInNativeVm: interpreterRun.status === 'ok'
    && state['selfhost.stage_status'] === 'RCL_OWNED_RULE_EXPRESSION_SOURCE_LOWERING_SUBSET_VERIFIED',
  rclParsedRuleExpressionSourceShape: state['parser.token_count'] === 74
    && state['parser.first_token'] === 'reality'
    && state['parser.program_token'] === 'RuntimeRuleExpressionSourceLoweringTarget'
    && state['parser.subject_start'] === 19
    && state['parser.emergence_start'] === 29
    && state['parser.foresee_start'] === 68
    && state['parser.realize_start'] === 70
    && state['compiler.facet_count'] === 2
    && state['compiler.subject_count'] === 1
    && state['compiler.warrant_count'] === 1
    && state['compiler.emergence_count'] === 1
    && state['compiler.directive_count'] === 2
    && readyFacet?.[0] === 'world.ready'
    && readyFacet?.[2]?.[0] === 'LiteralExpr'
    && readyFacet?.[2]?.[3] === 'true'
    && scoreFacet?.[0] === 'world.score'
    && scoreFacet?.[1] === 'Number'
    && scoreFacet?.[2]?.[2] === 'Number'
    && scoreFacet?.[2]?.[3] === '1'
    && subject?.[0] === 'founder'
    && subject?.[1] === 'world.publish'
    && subject?.[2] === 'world'
    && rule?.[0] === 'publish'
    && rule?.[1] === 'founder'
    && rule?.[2] === 'world.score'
    && rule?.[3] === '>='
    && rule?.[4] === '1'
    && rule?.[5] === 'world.publish'
    && rule?.[6] === 'world'
    && rule?.[7] === 'world.score'
    && rule?.[8] === 'world.score'
    && rule?.[9] === '+'
    && rule?.[10] === '2'
    && rule?.[11] === 'world.score'
    && rule?.[12] === '>='
    && rule?.[13] === '3'
    && rule?.[14] === 'rcl:stage28:score'
    && state['compiler.foresee_rule'] === 'publish'
    && state['compiler.realize_rule'] === 'publish'
    && state['compiler.rule_source_lowering_supported'] === true,
  rclGeneratedTargetRbcMatchesJsCompiler: targetRbc.equals(referenceRbc)
    && sha256(targetRbc) === sha256(referenceRbc),
  rclParsedExpressionFieldsMatchCompilerShape: state['compiler.program'] === compilerProgram.name
    && state['source.root'] === compilerProgram.programRoot
    && compilerProgram.facets.length === 2
    && compilerProgram.warrants.length === 1
    && compilerProgram.rules.length === 1
    && compilerProgram.directives.length === 2
    && jsRule.name === 'publish'
    && jsRule.cause === 'founder'
    && jsRule.when?.kind === 'BinaryExpr'
    && jsRule.when.operator === '>='
    && jsRule.when.left?.path === 'world.score'
    && jsRule.when.right?.value === 1
    && jsRule.needs[0].capability === 'world.publish'
    && jsRule.needs[0].target === 'world'
    && jsRule.alters[0].target === 'world.score'
    && jsRule.alters[0].expression?.kind === 'BinaryExpr'
    && jsRule.alters[0].expression.operator === '+'
    && jsRule.alters[0].expression.left?.path === 'world.score'
    && jsRule.alters[0].expression.right?.value === 2
    && jsRule.preserves[0]?.kind === 'BinaryExpr'
    && jsRule.preserves[0].operator === '>='
    && jsRule.preserves[0].left?.path === 'world.score'
    && jsRule.preserves[0].right?.value === 3
    && jsRule.witnesses[0] === 'rcl:stage28:score'
    && compilerProgram.directives[0].kind === 'Foresee'
    && compilerProgram.directives[1].kind === 'Realize',
  decodedTargetShapeMatches: decodedTarget.program === 'RuntimeRuleExpressionSourceLoweringTarget'
    && decodedTarget.sourceRoot === compilerProgram.programRoot
    && JSON.stringify(decodedTarget.strings) === JSON.stringify(expectedStrings)
    && JSON.stringify(decodedTarget.strings) === JSON.stringify(decodedReference.strings)
    && JSON.stringify(decodedTarget.numbers) === JSON.stringify(expectedNumbers)
    && JSON.stringify(decodedTarget.numbers) === JSON.stringify(decodedReference.numbers)
    && decodedTarget.instructions.length === 42
    && JSON.stringify(decodedTarget.instructions) === JSON.stringify(decodedReference.instructions)
    && targetNames.includes('GRANT_WARRANT')
    && targetNames.filter(name => name === 'PUSH_NUMBER').length === 7
    && targetNames.filter(name => name === 'GTE').length === 4
    && targetNames.filter(name => name === 'ADD').length === 2
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
  decodedInterpreterContainsRuleExpressionLoweringRuntime: interpreterNames.includes('CALL')
    && interpreterNames.includes('RETURN')
    && decodedInterpreter.instructions.some(instruction => instruction.builtin === 'MAKE_TOKEN')
    && decodedInterpreter.instructions.some(instruction => instruction.builtin === 'EXPECT_TOKEN')
    && decodedInterpreter.instructions.some(instruction => instruction.builtin === 'NUMBER_FROM_TEXT')
    && decodedInterpreter.instructions.some(instruction => instruction.builtin === 'BYTES_F64LE')
    && decodedInterpreter.instructions.some(instruction => instruction.builtin === 'BYTES_I32LE')
    && decodedInterpreter.strings.includes('RCL_OWNED_RULE_EXPRESSION_SOURCE_LOWERING_SUBSET_VERIFIED')
    && decodedInterpreter.strings.includes('single_rule_numeric_expression_source_lowering_subset_not_complete_parser_compiler_or_runtime')
    && decodedInterpreter.strings.includes('world.score')
    && decodedInterpreter.strings.includes('rcl:stage28:score'),
  boundaryHonest: state['selfhost.boundary'] === 'single_rule_numeric_expression_source_lowering_subset_not_complete_parser_compiler_or_runtime'
    && state['gate.rcl_owned_rule_expression_source_lowering_subset'] === true
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
  format: 'rcl.selfhost.stage28.verification.v1',
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
    scoreFacet,
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
    numbers: decodedTarget.numbers,
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
    numbers: decodedReference.numbers,
    instructions: decodedReference.instructions,
    runtimeState: targetReferenceRun.state,
    projections: targetReferenceRun.projections,
    history: targetReferenceRun.history,
  },
  boundaries: {
    implementedNow: 'A native-running RCL artifact tokenizes and parses a single numeric rule expression source program, extracts when/alter/preserve binary expression fields, emits PUSH_NUMBER/GTE/ADD transaction bytecode with a number pool, matches the JS compiler byte-for-byte, and the generated target runs in native rclvm.exe with matching projection/history.',
    notYetImplemented: 'This is still a constrained single-rule numeric expression lowering subset. It is not a complete parser, not general expression precedence or multiple-rule bytecode lowering, not pure RCL compiler fixed point, and not a complete RCL-owned runtime.',
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
