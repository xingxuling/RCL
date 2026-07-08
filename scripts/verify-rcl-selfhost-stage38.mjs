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
const rclPath = path.join(root, 'selfhost', 'rcl-boolean-connective-stage38.rcl');
const outputDir = path.join(root, 'output', 'selfhost');
const outputPath = path.join(outputDir, 'stage38-verification.json');
const interpreterArtifactPath = path.join(outputDir, 'stage38-boolean-connective-interpreter.rbc');
const targetRbcPath = path.join(outputDir, 'stage38-boolean-connective-target.rbc');
const referenceRbcPath = path.join(outputDir, 'stage38-boolean-connective-js-reference.rbc');

const EXPECTED_ROOT = '0000e8518e93fa380b2200a21b3cf37bb51000054fb90c14337b95d4d1c9fa8d';
const EXPECTED_TARGET_SHA = '272a07ab81b67d69da55703c79c879b9eaa6714a6c935e2cd1cae1ca52c3c822';
const EXPECTED_STRINGS = [
  'Stage38Target',
  EXPECTED_ROOT,
  'world.ready',
  'armed',
  'world.status',
  'world.score',
  'world.level',
  'world.certified',
  'founder',
  'world.publish',
  'world',
  'world.promote',
  'world.certify',
  'world.seal',
  'auditor',
  'world.audit',
  'publish',
  'sleep',
  'rcl:stage38:add-and',
  'promote',
  'rcl:stage38:mul-or',
  'certify',
  'rcl:stage38:sub-and',
  'seal',
  'rcl:stage38:div-or',
  'audit',
  'rcl:stage38:eq-and',
];
const EXPECTED_NUMBERS = [8, 1, 2, 10, 3, 6, 4];

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

function opcodeCount(decoded, name) {
  return decoded.instructions.filter(instruction => instruction.name === name).length;
}

function opcodeIndexes(decoded, name) {
  return decoded.instructions
    .filter(instruction => instruction.name === name)
    .map(instruction => instruction.index);
}

function expressionOperator(expr) {
  return expr?.operator ?? null;
}

function stableRecordJson(record) {
  return JSON.stringify(Object.fromEntries(Object.entries(record).sort(([left], [right]) => left.localeCompare(right))));
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
const targetNames = instructionNames(decodedTarget);
const nativeFormat = nativeExeFormat(DEFAULT_NATIVE_VM_PATH);

const arithmeticIndexes = {
  add: opcodeIndexes(decodedTarget, 'ADD'),
  sub: opcodeIndexes(decodedTarget, 'SUB'),
  mul: opcodeIndexes(decodedTarget, 'MUL'),
  div: opcodeIndexes(decodedTarget, 'DIV'),
};
const comparisonIndexes = {
  eq: opcodeIndexes(decodedTarget, 'EQ'),
  neq: opcodeIndexes(decodedTarget, 'NEQ'),
  lt: opcodeIndexes(decodedTarget, 'LT'),
  lte: opcodeIndexes(decodedTarget, 'LTE'),
  gt: opcodeIndexes(decodedTarget, 'GT'),
  gte: opcodeIndexes(decodedTarget, 'GTE'),
};
const booleanIndexes = {
  and: opcodeIndexes(decodedTarget, 'AND'),
  or: opcodeIndexes(decodedTarget, 'OR'),
};
const controlIndexes = {
  jumpIfFalse: opcodeIndexes(decodedTarget, 'JUMP_IF_FALSE'),
  beginTx: opcodeIndexes(decodedTarget, 'BEGIN_TX'),
  checkWarrant: opcodeIndexes(decodedTarget, 'CHECK_WARRANT'),
  stageStore: opcodeIndexes(decodedTarget, 'STAGE_STORE'),
  setProjectedView: opcodeIndexes(decodedTarget, 'SET_PROJECTED_VIEW'),
  checkPreserve: opcodeIndexes(decodedTarget, 'CHECK_PRESERVE'),
  recordWitness: opcodeIndexes(decodedTarget, 'RECORD_WITNESS'),
  commitTx: opcodeIndexes(decodedTarget, 'COMMIT_TX'),
  halt: opcodeIndexes(decodedTarget, 'HALT'),
};
const pushStringIndexes = opcodeIndexes(decodedTarget, 'PUSH_STRING');
const pushBoolIndexes = opcodeIndexes(decodedTarget, 'PUSH_BOOL');
const opcodeCounts = Object.fromEntries([
  'PUSH_BOOL',
  'STORE_STATE',
  'PUSH_STRING',
  'PUSH_NUMBER',
  'GRANT_WARRANT',
  'LOAD_STATE',
  'EQ',
  'AND',
  'OR',
  'JUMP_IF_FALSE',
  'BEGIN_TX',
  'CHECK_WARRANT',
  'ADD',
  'SUB',
  'MUL',
  'DIV',
  'STAGE_STORE',
  'SET_PROJECTED_VIEW',
  'NEQ',
  'CHECK_PRESERVE',
  'RECORD_WITNESS',
  'COMMIT_TX',
  'GTE',
  'LTE',
  'GT',
  'LT',
  'HALT',
].map(name => [name, opcodeCount(decodedTarget, name)]));

const checks = {
  nativeVmIsRealWindowsExecutable: process.platform !== 'win32'
    ? fs.existsSync(DEFAULT_NATIVE_VM_PATH)
    : nativeFormat.exists === true && nativeFormat.mz === true && nativeFormat.pe === true,
  interpreterRunsInNativeVm: interpreterRun.status === 'ok'
    && state['selfhost.stage_status'] === 'STAGE38_RCL_OWNED_BOOLEAN_CONNECTIVE_LOWERING_SUBSET_VERIFIED',
  stage38HeaderCorrect: state['selfhost.stage'] === 'stage38_rcl_owned_boolean_connective_lowering_subset'
    && state['selfhost.claim'] === 'rcl_lowers_boolean_connective_expressions_to_bytecode'
    && state['selfhost.boundary'] === 'boolean_connective_lowering_subset_not_complete_expression_ast_parser_compiler_or_runtime'
    && state['selfhost.next_rewrite_target'] === 'rcl_owned_expression_ast_completion_and_compiler_self_emission',
  gateFlagsCorrect: state['gate.full_self_hosting'] === false
    && state['gate.rcl_owned_general_expression_parser_subset'] === true
    && state['gate.rcl_owned_rule_lowering_loop'] === true
    && state['gate.rcl_owned_facet_warrant_parser_subset'] === true
    && state['gate.rcl_owned_general_rule_directive_scaling_subset'] === true
    && state['gate.rcl_owned_multisubject_warrant_parser_subset'] === true
    && state['gate.rcl_owned_equality_expression_lowering_subset'] === true
    && state['gate.rcl_owned_comparison_operator_lowering_subset'] === true
    && state['gate.rcl_owned_arithmetic_operator_lowering_subset'] === true
    && state['gate.rcl_owned_boolean_connective_lowering_subset'] === true
    && state['gate.rcl_owned_runtime_complete'] === false,
  sourceTargetCorrect: state['compiler.program'] === 'Stage38Target'
    && state['source.root'] === compilerProgram.programRoot
    && compilerProgram.programRoot === EXPECTED_ROOT,
  sourceHasBooleanConnectives: sourceText.includes('world.status == "armed" and world.ready == true')
    && sourceText.includes('world.level >= 2 or world.certified == true')
    && sourceText.includes('world.score <= 4 or world.certified == true')
    && sourceText.includes('rcl:stage38:add-and')
    && sourceText.includes('rcl:stage38:mul-or')
    && sourceText.includes('rcl:stage38:sub-and')
    && sourceText.includes('rcl:stage38:div-or')
    && sourceText.includes('rcl:stage38:eq-and'),
  tokenizerWorks: state['parser.token_count'] === 366
    && state['parser.program_token'] === 'Stage38Target',
  compilerParsesSource: compilerProgram.name === 'Stage38Target'
    && compilerProgram.facets.length === 5
    && compilerProgram.warrants.length === 5
    && compilerProgram.warrants[4].subject === 'auditor'
    && compilerProgram.rules.length === 5
    && compilerProgram.rules.every(rule => expressionOperator(rule.when) === 'and')
    && compilerProgram.rules[0].when.left.operator === '=='
    && compilerProgram.rules[0].when.right.operator === '=='
    && compilerProgram.rules[0].preserves[0].operator === 'and'
    && compilerProgram.rules[0].preserves[0].left.operator === '!='
    && compilerProgram.rules[1].preserves[0].operator === 'or'
    && compilerProgram.rules[1].preserves[0].left.operator === '>='
    && compilerProgram.rules[2].when.left.operator === '<='
    && compilerProgram.rules[2].preserves[0].operator === 'and'
    && compilerProgram.rules[2].preserves[0].left.operator === '>'
    && compilerProgram.rules[3].when.left.operator === '<'
    && compilerProgram.rules[3].preserves[0].operator === 'or'
    && compilerProgram.rules[3].preserves[0].left.operator === '<='
    && compilerProgram.rules[4].when.left.operator === '=='
    && compilerProgram.rules[4].when.right.operator === '=='
    && compilerProgram.rules[4].preserves[0].operator === 'and'
    && compilerProgram.rules[0].alters[0].expression.operator === '+'
    && compilerProgram.rules[1].alters[0].expression.operator === '*'
    && compilerProgram.rules[2].alters[0].expression.operator === '-'
    && compilerProgram.rules[3].alters[0].expression.operator === '/'
    && compilerProgram.rules[4].alters[0].expression.operator === '+'
    && compilerProgram.directives.length === 10,
  targetRbcGenerated: targetRbc.length > 0
    && decodedTarget.program === 'Stage38Target'
    && decodedTarget.sourceRoot === compilerProgram.programRoot,
  targetRbcMatchesJsReference: targetRbc.equals(referenceRbc)
    && sha256(targetRbc) === sha256(referenceRbc)
    && sha256(targetRbc) === EXPECTED_TARGET_SHA,
  targetRunsInNativeVm: targetNativeRun.status === 'ok'
    && targetNativeRun.state['world.ready'] === true
    && targetNativeRun.state['world.status'] === 'armed'
    && targetNativeRun.state['world.score'] === 4.5
    && targetNativeRun.state['world.level'] === 2
    && targetNativeRun.state['world.certified'] === false
    && stableRecordJson(targetNativeRun.state) === stableRecordJson(targetReferenceRun.state),
  targetHasCorrectInstructionCount: decodedTarget.instructions.length === 276
    && state['target.rbc_instruction_count'] === 276,
  targetHasCorrectStringPool: JSON.stringify(decodedTarget.strings) === JSON.stringify(EXPECTED_STRINGS),
  targetHasCorrectNumberPool: JSON.stringify(decodedTarget.numbers) === JSON.stringify(EXPECTED_NUMBERS),
  targetHasCorrectOpcodes: targetNames.includes('AND')
    && targetNames.includes('OR')
    && targetNames.includes('ADD')
    && targetNames.includes('SUB')
    && targetNames.includes('MUL')
    && targetNames.includes('DIV')
    && targetNames.includes('EQ')
    && targetNames.includes('NEQ')
    && targetNames.includes('LT')
    && targetNames.includes('LTE')
    && targetNames.includes('GT')
    && targetNames.includes('GTE')
    && targetNames.includes('PUSH_STRING')
    && targetNames.includes('PUSH_BOOL')
    && targetNames.includes('HALT'),
  booleanConnectiveLoweringEvidence: state['compiler.boolean_connective_lowering_supported'] === true
    && JSON.stringify(booleanIndexes.and) === JSON.stringify([21, 36, 47, 62, 73, 99, 125, 140, 151, 166, 177, 203, 229, 244, 255, 270])
    && JSON.stringify(booleanIndexes.or) === JSON.stringify([88, 114, 192, 218])
    && opcodeCounts.AND === 16
    && opcodeCounts.OR === 4
    && JSON.stringify(arithmeticIndexes.add) === JSON.stringify([27, 53, 235, 261])
    && JSON.stringify(arithmeticIndexes.sub) === JSON.stringify([131, 157])
    && JSON.stringify(arithmeticIndexes.mul) === JSON.stringify([79, 105])
    && JSON.stringify(arithmeticIndexes.div) === JSON.stringify([183, 209])
    && opcodeCounts.ADD === 4
    && opcodeCounts.SUB === 2
    && opcodeCounts.MUL === 2
    && opcodeCounts.DIV === 2
    && JSON.stringify(comparisonIndexes.eq) === JSON.stringify([17, 20, 35, 43, 46, 61, 72, 87, 98, 113, 124, 139, 150, 165, 176, 191, 202, 217, 225, 228, 240, 243, 251, 254, 266, 269])
    && JSON.stringify(comparisonIndexes.neq) === JSON.stringify([32, 58])
    && JSON.stringify(comparisonIndexes.lt) === JSON.stringify([173, 199])
    && JSON.stringify(comparisonIndexes.lte) === JSON.stringify([121, 147, 188, 214])
    && JSON.stringify(comparisonIndexes.gt) === JSON.stringify([136, 162])
    && JSON.stringify(comparisonIndexes.gte) === JSON.stringify([69, 84, 95, 110])
    && JSON.stringify(pushStringIndexes) === JSON.stringify([2, 16, 31, 42, 57, 138, 164, 227, 242, 253, 268])
    && JSON.stringify(pushBoolIndexes) === JSON.stringify([0, 8, 19, 34, 45, 60, 71, 86, 97, 112, 123, 149, 175, 190, 201, 216, 224, 239, 250, 265])
    && decodedTarget.instructions[21]?.name === 'AND'
    && decodedTarget.instructions[88]?.name === 'OR'
    && decodedTarget.instructions[270]?.name === 'AND',
  boundaryHonest: state['selfhost.boundary'] === 'boolean_connective_lowering_subset_not_complete_expression_ast_parser_compiler_or_runtime'
    && state['gate.rcl_owned_comparison_operator_lowering_subset'] === true
    && state['gate.rcl_owned_arithmetic_operator_lowering_subset'] === true
    && state['gate.rcl_owned_boolean_connective_lowering_subset'] === true
    && state['gate.rcl_owned_expression_ast_complete'] === false
    && state['gate.rcl_owned_parser_complete'] === false
    && state['gate.rcl_owned_runtime_complete'] === false,
};

const payload = {
  ok: Object.values(checks).every(Boolean),
  format: 'rcl.selfhost.stage38.verification.v1',
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
    eofKind: state['parser.eof_kind'],
    subjectCount: state['compiler.subject_count'],
    warrantCount: state['compiler.warrant_count'],
  },
  compiler: {
    program: compilerProgram.name,
    programRoot: compilerProgram.programRoot,
    facetCount: compilerProgram.facets.length,
    facetPaths: compilerProgram.facets.map(f => f.path),
    warrantCount: compilerProgram.warrants.length,
    warrants: compilerProgram.warrants,
    ruleCount: compilerProgram.rules.length,
    ruleNames: compilerProgram.rules.map(r => r.name),
    rules: compilerProgram.rules,
    directiveCount: compilerProgram.directives.length,
    directives: compilerProgram.directives,
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
    opcodeCounts,
    arithmeticIndexes,
    comparisonIndexes,
    booleanIndexes,
    controlIndexes,
    pushStringIndexes,
    pushBoolIndexes,
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
    implementedNow: 'RCL maps two-clause boolean connective guard and preserve expressions with and/or to AND and OR bytecode for this self-host compiler subset, while preserving Stage37 arithmetic and Stage36 comparison lowering.',
    notYetImplemented: 'This is still a subset. Complete expression AST coverage, parser completion, complete compiler self-emission without stage0, complete runtime, and full native self-hosting remain outside this stage.',
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
