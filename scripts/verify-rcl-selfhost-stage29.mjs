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
const rclPath = path.join(root, 'selfhost', 'rcl-multirule-expression-source-lowering-stage29.rcl');
const outputDir = path.join(root, 'output', 'selfhost');
const outputPath = path.join(outputDir, 'stage29-verification.json');
const interpreterArtifactPath = path.join(outputDir, 'stage29-multirule-expression-source-lowering-interpreter.rbc');
const targetRbcPath = path.join(outputDir, 'stage29-multirule-expression-source-lowered-target.rbc');
const referenceRbcPath = path.join(outputDir, 'stage29-multirule-expression-source-js-reference.rbc');

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

function hasTransactionRecordShape(record, expected) {
  return record?.kind === expected.kind
    && record?.rule === expected.rule
    && record?.mode === expected.mode
    && record?.status === expected.status
    && record?.actor === 'founder'
    && record?.changes?.length === 1
    && record.changes[0].target === expected.target
    && record.changes[0].before === expected.before
    && record.changes[0].after === expected.after
    && record?.authority?.needs?.[0]?.capability === expected.capability
    && record?.authority?.needs?.[0]?.target === 'world'
    && record?.authority?.activeWarrants?.some(warrant =>
      warrant.subject === 'founder'
        && warrant.capability === expected.capability
        && warrant.target === 'world')
    && record?.witnesses?.[0] === expected.witness;
}

const rclSource = fs.readFileSync(rclPath, 'utf8');
const interpreterArtifact = Buffer.from(compileRealityToBytecode(rclSource));
const interpreterRun = runNativeBytecode(interpreterArtifact, { maxBuffer: 128 * 1024 * 1024, timeout: 60_000 });
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
  'RuntimeMultiRuleExpressionSourceLoweringTarget',
  'e4be3c20798ec925987d9aa2bf24e714bc39f82999e280fc206d19fca7fb982c',
  'world.ready',
  'world.score',
  'world.level',
  'founder',
  'world.publish',
  'world',
  'world.promote',
  'publish',
  'rcl:stage29:score',
  'promote',
  'rcl:stage29:level',
];

const expectedNumbers = [1, 0, 2, 3];
const expectedTargetState = {
  'world.ready': true,
  'world.score': 3,
  'world.level': 1,
};

const publishRecord = {
  kind: 'Transition',
  rule: 'publish',
  mode: 'realize',
  status: 'realized',
  target: 'world.score',
  before: 1,
  after: 3,
  capability: 'world.publish',
  witness: 'rcl:stage29:score',
};
const promoteRecord = {
  kind: 'Transition',
  rule: 'promote',
  mode: 'realize',
  status: 'realized',
  target: 'world.level',
  before: 0,
  after: 1,
  capability: 'world.promote',
  witness: 'rcl:stage29:level',
};

const readyFacet = state['compiler.ready_facet'];
const scoreFacet = state['compiler.score_facet'];
const levelFacet = state['compiler.level_facet'];
const subject = state['compiler.subject'];
const ruleOne = state['compiler.rule_one'];
const ruleTwo = state['compiler.rule_two'];
const [jsPublishRule, jsPromoteRule] = compilerProgram.rules;

const checks = {
  nativeVmIsRealWindowsExecutable: process.platform !== 'win32'
    ? fs.existsSync(DEFAULT_NATIVE_VM_PATH)
    : nativeFormat.exists === true && nativeFormat.mz === true && nativeFormat.pe === true,
  interpreterRunsInNativeVm: interpreterRun.status === 'ok'
    && state['selfhost.stage_status'] === 'RCL_OWNED_MULTIRULE_EXPRESSION_SOURCE_LOWERING_SUBSET_VERIFIED',
  rclParsedMultiRuleExpressionSourceShape: state['parser.token_count'] === 131
    && state['parser.program_token'] === 'RuntimeMultiRuleExpressionSourceLoweringTarget'
    && state['parser.subject_start'] === 27
    && state['parser.emergence_one_start'] === 43
    && state['parser.emergence_two_start'] === 82
    && state['parser.foresee_one_start'] === 121
    && state['parser.realize_one_start'] === 123
    && state['parser.foresee_two_start'] === 125
    && state['parser.realize_two_start'] === 127
    && state['compiler.facet_count'] === 3
    && state['compiler.subject_count'] === 1
    && state['compiler.warrant_count'] === 2
    && state['compiler.emergence_count'] === 2
    && state['compiler.directive_count'] === 4
    && readyFacet?.[0] === 'world.ready'
    && scoreFacet?.[0] === 'world.score'
    && scoreFacet?.[2]?.[3] === '1'
    && levelFacet?.[0] === 'world.level'
    && levelFacet?.[2]?.[3] === '0'
    && subject?.[0] === 'founder'
    && subject?.[1] === 'world.publish'
    && subject?.[2] === 'world'
    && subject?.[3] === 'world.promote'
    && subject?.[4] === 'world'
    && ruleOne?.[0] === 'publish'
    && ruleOne?.[2] === 'world.score'
    && ruleOne?.[4] === '1'
    && ruleOne?.[5] === 'world.publish'
    && ruleOne?.[7] === 'world.score'
    && ruleOne?.[10] === '2'
    && ruleOne?.[13] === '3'
    && ruleOne?.[14] === 'rcl:stage29:score'
    && ruleTwo?.[0] === 'promote'
    && ruleTwo?.[2] === 'world.score'
    && ruleTwo?.[4] === '3'
    && ruleTwo?.[5] === 'world.promote'
    && ruleTwo?.[7] === 'world.level'
    && ruleTwo?.[10] === '1'
    && ruleTwo?.[13] === '1'
    && ruleTwo?.[14] === 'rcl:stage29:level'
    && state['compiler.foresee_rule_one'] === 'publish'
    && state['compiler.realize_rule_one'] === 'publish'
    && state['compiler.foresee_rule_two'] === 'promote'
    && state['compiler.realize_rule_two'] === 'promote'
    && state['compiler.rule_source_lowering_supported'] === true,
  rclGeneratedTargetRbcMatchesJsCompiler: targetRbc.equals(referenceRbc)
    && sha256(targetRbc) === sha256(referenceRbc),
  rclParsedExpressionFieldsMatchCompilerShape: state['compiler.program'] === compilerProgram.name
    && state['source.root'] === compilerProgram.programRoot
    && compilerProgram.facets.length === 3
    && compilerProgram.warrants.length === 2
    && compilerProgram.rules.length === 2
    && compilerProgram.directives.length === 4
    && jsPublishRule.name === 'publish'
    && jsPublishRule.when?.operator === '>='
    && jsPublishRule.alters[0].expression?.operator === '+'
    && jsPublishRule.witnesses[0] === 'rcl:stage29:score'
    && jsPromoteRule.name === 'promote'
    && jsPromoteRule.when?.operator === '>='
    && jsPromoteRule.needs[0].capability === 'world.promote'
    && jsPromoteRule.alters[0].target === 'world.level'
    && jsPromoteRule.alters[0].expression?.operator === '+'
    && jsPromoteRule.witnesses[0] === 'rcl:stage29:level'
    && compilerProgram.directives.map(directive => `${directive.kind}:${directive.rule}`).join('|') === 'Foresee:publish|Realize:publish|Foresee:promote|Realize:promote',
  decodedTargetShapeMatches: decodedTarget.program === 'RuntimeMultiRuleExpressionSourceLoweringTarget'
    && decodedTarget.sourceRoot === compilerProgram.programRoot
    && JSON.stringify(decodedTarget.strings) === JSON.stringify(expectedStrings)
    && JSON.stringify(decodedTarget.strings) === JSON.stringify(decodedReference.strings)
    && JSON.stringify(decodedTarget.numbers) === JSON.stringify(expectedNumbers)
    && JSON.stringify(decodedTarget.numbers) === JSON.stringify(decodedReference.numbers)
    && decodedTarget.instructions.length === 81
    && JSON.stringify(decodedTarget.instructions) === JSON.stringify(decodedReference.instructions)
    && targetNames.filter(name => name === 'GRANT_WARRANT').length === 2
    && targetNames.filter(name => name === 'PUSH_NUMBER').length === 14
    && targetNames.filter(name => name === 'GTE').length === 8
    && targetNames.filter(name => name === 'ADD').length === 4
    && targetNames.filter(name => name === 'BEGIN_TX').length === 4
    && targetNames.filter(name => name === 'CHECK_WARRANT').length === 4
    && targetNames.filter(name => name === 'STAGE_STORE').length === 4
    && targetNames.filter(name => name === 'CHECK_PRESERVE').length === 4
    && targetNames.filter(name => name === 'RECORD_WITNESS').length === 4
    && targetNames.filter(name => name === 'COMMIT_TX').length === 4
    && targetNames.at(-1) === 'HALT',
  rclGeneratedTargetRunsInNativeVm: targetNativeRun.status === 'ok'
    && sameJson(targetNativeRun.state, expectedTargetState)
    && sameJson(targetNativeRun.state, targetReferenceRun.state)
    && targetNativeRun.projections.length === 2
    && targetNativeRun.history.length === 2
    && hasTransactionRecordShape(targetNativeRun.history[0], publishRecord)
    && hasTransactionRecordShape(targetNativeRun.history[1], promoteRecord),
  targetNativeAndJsTransactionHistoryMatch: targetReferenceRun.projections.length === 2
    && targetReferenceRun.history.length === 2
    && sameJson(targetNativeRun.projections, targetReferenceRun.projections)
    && sameJson(targetNativeRun.history, targetReferenceRun.history),
  decodedInterpreterContainsMultiRuleExpressionLoweringRuntime: interpreterNames.includes('CALL')
    && interpreterNames.includes('RETURN')
    && decodedInterpreter.instructions.some(instruction => instruction.builtin === 'MAKE_TOKEN')
    && decodedInterpreter.instructions.some(instruction => instruction.builtin === 'NUMBER_FROM_TEXT')
    && decodedInterpreter.instructions.some(instruction => instruction.builtin === 'BYTES_F64LE')
    && decodedInterpreter.strings.includes('RCL_OWNED_MULTIRULE_EXPRESSION_SOURCE_LOWERING_SUBSET_VERIFIED')
    && decodedInterpreter.strings.includes('two_rule_numeric_expression_source_lowering_subset_not_complete_parser_compiler_or_runtime')
    && decodedInterpreter.strings.includes('rcl:stage29:score')
    && decodedInterpreter.strings.includes('rcl:stage29:level'),
  boundaryHonest: state['selfhost.boundary'] === 'two_rule_numeric_expression_source_lowering_subset_not_complete_parser_compiler_or_runtime'
    && state['gate.rcl_owned_rule_expression_source_lowering_subset'] === true
    && state['gate.rcl_owned_multirule_expression_source_lowering_subset'] === true
    && state['gate.rcl_owned_rule_transaction_bytecode_subset'] === true
    && state['gate.rcl_owned_target_native_execution_subset'] === true
    && state['gate.rcl_owned_parser_complete'] === false
    && state['gate.rcl_owned_expression_ast_complete'] === false
    && state['gate.rcl_owned_rule_bytecode_lowering_complete'] === false
    && state['gate.rcl_compiler_self_emits_without_stage0'] === false
    && state['gate.rcl_owned_runtime_complete'] === false
    && state['gate.native_vm_host_still_required'] === true,
};

const payload = {
  ok: Object.values(checks).every(Boolean),
  format: 'rcl.selfhost.stage29.verification.v1',
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
    programToken: state['parser.program_token'],
    subjectStart: state['parser.subject_start'],
    emergenceOneStart: state['parser.emergence_one_start'],
    emergenceTwoStart: state['parser.emergence_two_start'],
    foreseeOneStart: state['parser.foresee_one_start'],
    realizeOneStart: state['parser.realize_one_start'],
    foreseeTwoStart: state['parser.foresee_two_start'],
    realizeTwoStart: state['parser.realize_two_start'],
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
    levelFacet,
    subject,
    ruleOne,
    ruleTwo,
    directives: [
      state['compiler.foresee_rule_one'],
      state['compiler.realize_rule_one'],
      state['compiler.foresee_rule_two'],
      state['compiler.realize_rule_two'],
    ],
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
    implementedNow: 'A native-running RCL artifact tokenizes and parses a two-rule numeric expression source program, extracts two warrants, two emergence rules, and four directives, emits multirule PUSH_NUMBER/GTE/ADD transaction bytecode with a number pool, matches the JS compiler byte-for-byte, and the generated target runs in native rclvm.exe with matching two-step projection/history.',
    notYetImplemented: 'This is still a constrained two-rule numeric expression lowering subset. It is not a complete parser, not loop-based general rule lowering, not general expression precedence, not pure RCL compiler fixed point, and not a complete RCL-owned runtime.',
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
