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
const rclPath = path.join(root, 'selfhost', 'rcl-unary-not-stage39.rcl');
const outputDir = path.join(root, 'output', 'selfhost');
const outputPath = path.join(outputDir, 'stage39-verification.json');
const interpreterArtifactPath = path.join(outputDir, 'stage39-unary-not-interpreter.rbc');
const targetRbcPath = path.join(outputDir, 'stage39-unary-not-target.rbc');
const referenceRbcPath = path.join(outputDir, 'stage39-unary-not-js-reference.rbc');

const EXPECTED_ROOT = '6961b0ffd5019d30b8aa4d22368200a5bdb1f17e7cb5ffd40a31dcf1947d436b';
const EXPECTED_TARGET_SHA = '32fb9710be02209584c4ecdd3a270c4d13bd9e717633da6b77a5ca886d06a9d4';
const EXPECTED_NUMBERS = [8, 1, 2, 10, 3, 6, 4];
const EXPECTED_STRINGS = [
  'Stage39Target',
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
  'rcl:stage39:add-not-and',
  'promote',
  'rcl:stage39:mul-not-or',
  'certify',
  'rcl:stage39:sub-not-and',
  'seal',
  'rcl:stage39:div-not-or',
  'audit',
  'rcl:stage39:eq-not-and',
];

const EXPECTED_INDEXES = {
  not: [18, 23, 24, 25, 39, 44, 45, 46, 56, 61, 62, 63, 77, 82, 83, 84, 94, 99, 100, 101, 115, 122, 123, 124, 132, 137, 138, 139, 153, 160, 161, 162, 170, 175, 176, 177, 191, 196, 197, 198, 208, 213, 214, 215, 229, 234, 235, 236, 246, 251, 252, 253, 267, 274, 275, 276, 284, 289, 290, 291, 305, 312, 313, 314, 322, 327, 328, 329, 343, 348, 349, 350, 360, 365, 366, 367, 381, 386, 387, 388],
  and: [],
  or: [],
  jump: [26, 47, 64, 85, 102, 118, 140, 156, 178, 199, 216, 237, 254, 270, 292, 308, 330, 351, 368, 389],
  jumpIfFalse: [19, 28, 40, 57, 66, 78, 95, 104, 116, 133, 142, 154, 171, 180, 192, 209, 218, 230, 247, 256, 268, 285, 294, 306, 323, 332, 344, 361, 370, 382],
  checkWarrant: [30, 68, 106, 144, 182, 220, 258, 296, 334, 372],
  add: [33, 71, 337, 375],
  sub: [185, 223],
  mul: [109, 147],
  div: [261, 299],
  eq: [22, 38, 43, 60, 76, 81, 98, 121, 136, 159, 174, 212, 250, 273, 288, 311, 321, 342, 359, 380],
  neq: [17, 55, 195, 233, 326, 347, 364, 385],
  lt: [93, 114, 131, 152],
  lte: [190, 228],
  gt: [169, 207, 266, 304],
  gte: [245, 283],
  pushString: [2, 16, 37, 54, 75, 194, 232, 325, 346, 363, 384],
  pushBool: [0, 8, 21, 27, 42, 48, 59, 65, 80, 86, 97, 103, 117, 120, 135, 141, 155, 158, 173, 179, 200, 211, 217, 238, 249, 255, 269, 272, 287, 293, 307, 310, 320, 331, 341, 352, 358, 369, 379, 390],
};

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

function opcodeIndexes(decoded, name) {
  return decoded.instructions
    .filter(instruction => instruction.name === name)
    .map(instruction => instruction.index);
}

function opcodeCount(decoded, name) {
  return opcodeIndexes(decoded, name).length;
}

function stableRecordJson(record) {
  return JSON.stringify(Object.fromEntries(Object.entries(record).sort(([left], [right]) => left.localeCompare(right))));
}

function isUnaryNotComparison(expr, operator) {
  return expr?.kind === 'UnaryExpr'
    && expr.operator === 'not'
    && expr.expression?.kind === 'BinaryExpr'
    && expr.expression.operator === operator;
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
const nativeFormat = nativeExeFormat(DEFAULT_NATIVE_VM_PATH);

const unaryIndexes = { not: opcodeIndexes(decodedTarget, 'NOT') };
const booleanIndexes = {
  and: opcodeIndexes(decodedTarget, 'AND'),
  or: opcodeIndexes(decodedTarget, 'OR'),
};
const controlIndexes = {
  jump: opcodeIndexes(decodedTarget, 'JUMP'),
  jumpIfFalse: opcodeIndexes(decodedTarget, 'JUMP_IF_FALSE'),
  checkWarrant: opcodeIndexes(decodedTarget, 'CHECK_WARRANT'),
};
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
const pushStringIndexes = opcodeIndexes(decodedTarget, 'PUSH_STRING');
const pushBoolIndexes = opcodeIndexes(decodedTarget, 'PUSH_BOOL');
const opcodeCounts = Object.fromEntries([
  'PUSH_BOOL', 'STORE_STATE', 'PUSH_STRING', 'PUSH_NUMBER', 'GRANT_WARRANT', 'LOAD_STATE',
  'EQ', 'NEQ', 'LT', 'LTE', 'GT', 'GTE', 'AND', 'OR', 'NOT',
  'JUMP', 'JUMP_IF_FALSE', 'BEGIN_TX', 'CHECK_WARRANT', 'ADD', 'SUB', 'MUL', 'DIV',
  'STAGE_STORE', 'SET_PROJECTED_VIEW', 'CHECK_PRESERVE', 'RECORD_WITNESS', 'COMMIT_TX', 'HALT',
].map(name => [name, opcodeCount(decodedTarget, name)]));

const checks = {
  nativeVmIsRealWindowsExecutable: process.platform !== 'win32'
    ? fs.existsSync(DEFAULT_NATIVE_VM_PATH)
    : nativeFormat.exists === true && nativeFormat.mz === true && nativeFormat.pe === true,
  interpreterRunsInNativeVm: interpreterRun.status === 'ok'
    && state['selfhost.stage_status'] === 'STAGE39_RCL_OWNED_UNARY_NOT_LOWERING_SUBSET_VERIFIED',
  stage39HeaderCorrect: state['selfhost.stage'] === 'stage39_rcl_owned_unary_not_lowering_subset'
    && state['selfhost.claim'] === 'rcl_lowers_unary_not_expressions_to_bytecode'
    && state['selfhost.boundary'] === 'unary_not_lowering_subset_not_complete_expression_ast_parser_compiler_or_runtime'
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
    && state['gate.rcl_owned_unary_not_lowering_subset'] === true
    && state['gate.rcl_owned_runtime_complete'] === false,
  sourceTargetCorrect: state['compiler.program'] === 'Stage39Target'
    && state['source.root'] === compilerProgram.programRoot
    && compilerProgram.programRoot === EXPECTED_ROOT,
  sourceHasUnaryNotExpressions: sourceText.includes('when not (world.status != "armed") and not (world.certified == true)')
    && sourceText.includes('preserve not (world.level < 2) or not (world.certified == true)')
    && sourceText.includes('rcl:stage39:add-not-and')
    && sourceText.includes('rcl:stage39:eq-not-and'),
  tokenizerWorks: state['parser.token_count'] === 424
    && state['parser.program_token'] === 'Stage39Target',
  compilerParsesSource: compilerProgram.name === 'Stage39Target'
    && compilerProgram.facets.length === 5
    && compilerProgram.warrants.length === 5
    && compilerProgram.warrants[4].subject === 'auditor'
    && compilerProgram.rules.length === 5
    && compilerProgram.rules.every(rule => rule.when.operator === 'and')
    && compilerProgram.rules[0].preserves[0].operator === 'and'
    && compilerProgram.rules[1].preserves[0].operator === 'or'
    && compilerProgram.rules[2].preserves[0].operator === 'and'
    && compilerProgram.rules[3].preserves[0].operator === 'or'
    && compilerProgram.rules[4].preserves[0].operator === 'and'
    && isUnaryNotComparison(compilerProgram.rules[0].when.left, '!=')
    && isUnaryNotComparison(compilerProgram.rules[0].when.right, '==')
    && isUnaryNotComparison(compilerProgram.rules[1].when.left, '<')
    && isUnaryNotComparison(compilerProgram.rules[2].when.left, '>')
    && isUnaryNotComparison(compilerProgram.rules[3].when.left, '>=')
    && isUnaryNotComparison(compilerProgram.rules[4].when.right, '!=')
    && isUnaryNotComparison(compilerProgram.rules[3].preserves[0].left, '>')
    && compilerProgram.rules[0].alters[0].expression.operator === '+'
    && compilerProgram.rules[1].alters[0].expression.operator === '*'
    && compilerProgram.rules[2].alters[0].expression.operator === '-'
    && compilerProgram.rules[3].alters[0].expression.operator === '/'
    && compilerProgram.rules[4].alters[0].expression.operator === '+'
    && compilerProgram.directives.length === 10,
  targetRbcGenerated: targetRbc.length === 6904
    && decodedTarget.program === 'Stage39Target'
    && decodedTarget.sourceRoot === compilerProgram.programRoot,
  targetRbcMatchesJsReference: targetRbc.equals(referenceRbc)
    && sha256(targetRbc) === sha256(referenceRbc)
    && sha256(targetRbc) === EXPECTED_TARGET_SHA,
  targetRunsInNativeVm: targetNativeRun.status === 'ok'
    && stableRecordJson(targetNativeRun.state) === stableRecordJson(targetReferenceRun.state)
    && targetNativeRun.state['world.score'] === 4.5
    && targetNativeRun.state['world.level'] === 2
    && targetNativeRun.state['world.certified'] === false,
  targetHasCorrectInstructionCount: decodedTarget.instructions.length === 396
    && state['target.rbc_instruction_count'] === 396,
  targetHasCorrectStringPool: JSON.stringify(decodedTarget.strings) === JSON.stringify(EXPECTED_STRINGS),
  targetHasCorrectNumberPool: JSON.stringify(decodedTarget.numbers) === JSON.stringify(EXPECTED_NUMBERS),
  unaryNotLoweringEvidence: state['compiler.unary_not_lowering_supported'] === true
    && JSON.stringify(unaryIndexes.not) === JSON.stringify(EXPECTED_INDEXES.not)
    && JSON.stringify(booleanIndexes.and) === JSON.stringify(EXPECTED_INDEXES.and)
    && JSON.stringify(booleanIndexes.or) === JSON.stringify(EXPECTED_INDEXES.or)
    && JSON.stringify(controlIndexes.jump) === JSON.stringify(EXPECTED_INDEXES.jump)
    && JSON.stringify(controlIndexes.jumpIfFalse) === JSON.stringify(EXPECTED_INDEXES.jumpIfFalse)
    && JSON.stringify(controlIndexes.checkWarrant) === JSON.stringify(EXPECTED_INDEXES.checkWarrant)
    && JSON.stringify(arithmeticIndexes.add) === JSON.stringify(EXPECTED_INDEXES.add)
    && JSON.stringify(arithmeticIndexes.sub) === JSON.stringify(EXPECTED_INDEXES.sub)
    && JSON.stringify(arithmeticIndexes.mul) === JSON.stringify(EXPECTED_INDEXES.mul)
    && JSON.stringify(arithmeticIndexes.div) === JSON.stringify(EXPECTED_INDEXES.div)
    && JSON.stringify(comparisonIndexes.eq) === JSON.stringify(EXPECTED_INDEXES.eq)
    && JSON.stringify(comparisonIndexes.neq) === JSON.stringify(EXPECTED_INDEXES.neq)
    && JSON.stringify(comparisonIndexes.lt) === JSON.stringify(EXPECTED_INDEXES.lt)
    && JSON.stringify(comparisonIndexes.lte) === JSON.stringify(EXPECTED_INDEXES.lte)
    && JSON.stringify(comparisonIndexes.gt) === JSON.stringify(EXPECTED_INDEXES.gt)
    && JSON.stringify(comparisonIndexes.gte) === JSON.stringify(EXPECTED_INDEXES.gte)
    && JSON.stringify(pushStringIndexes) === JSON.stringify(EXPECTED_INDEXES.pushString)
    && JSON.stringify(pushBoolIndexes) === JSON.stringify(EXPECTED_INDEXES.pushBool)
    && opcodeCounts.NOT === 80
    && opcodeCounts.AND === 0
    && opcodeCounts.OR === 0
    && opcodeCounts.JUMP === 20
    && opcodeCounts.JUMP_IF_FALSE === 30
    && decodedTarget.instructions[18]?.name === 'NOT'
    && decodedTarget.instructions[395]?.name === 'HALT',
  boundaryHonest: state['selfhost.boundary'] === 'unary_not_lowering_subset_not_complete_expression_ast_parser_compiler_or_runtime'
    && state['gate.rcl_owned_boolean_connective_lowering_subset'] === true
    && state['gate.rcl_owned_unary_not_lowering_subset'] === true
    && state['gate.rcl_owned_expression_ast_complete'] === false
    && state['gate.rcl_owned_parser_complete'] === false
    && state['gate.rcl_owned_runtime_complete'] === false,
};

const payload = {
  ok: Object.values(checks).every(Boolean),
  format: 'rcl.selfhost.stage39.verification.v1',
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
    unaryIndexes,
    booleanIndexes,
    controlIndexes,
    arithmeticIndexes,
    comparisonIndexes,
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
    implementedNow: 'RCL maps unary-not comparison expressions and their and/or composition to the current JS-compatible short-circuit jump layout, while preserving Stage38 boolean and Stage37 arithmetic lowering.',
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
