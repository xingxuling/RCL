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
const rclPath = path.join(root, 'selfhost', 'rcl-arithmetic-operator-stage37.rcl');
const outputDir = path.join(root, 'output', 'selfhost');
const outputPath = path.join(outputDir, 'stage37-verification.json');
const interpreterArtifactPath = path.join(outputDir, 'stage37-arithmetic-operator-interpreter.rbc');
const targetRbcPath = path.join(outputDir, 'stage37-arithmetic-operator-target.rbc');
const referenceRbcPath = path.join(outputDir, 'stage37-arithmetic-operator-js-reference.rbc');

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
const pushStringIndexes = opcodeIndexes(decodedTarget, 'PUSH_STRING');
const pushBoolIndexes = opcodeIndexes(decodedTarget, 'PUSH_BOOL');

const checks = {
  nativeVmIsRealWindowsExecutable: process.platform !== 'win32'
    ? fs.existsSync(DEFAULT_NATIVE_VM_PATH)
    : nativeFormat.exists === true && nativeFormat.mz === true && nativeFormat.pe === true,
  interpreterRunsInNativeVm: interpreterRun.status === 'ok'
    && state['selfhost.stage_status'] === 'STAGE37_RCL_OWNED_ARITHMETIC_OPERATOR_LOWERING_SUBSET_VERIFIED',
  stage37HeaderCorrect: state['selfhost.stage'] === 'stage37_rcl_owned_arithmetic_operator_lowering_subset'
    && state['selfhost.claim'] === 'rcl_lowers_arithmetic_alteration_operators_to_bytecode'
    && state['selfhost.boundary'] === 'arithmetic_operator_lowering_subset_not_complete_expression_ast_parser_compiler_or_runtime'
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
    && state['gate.rcl_owned_runtime_complete'] === false,
  sourceTargetCorrect: state['compiler.program'] === 'Stage37Target'
    && state['source.root'] === compilerProgram.programRoot,
  sourceHasArithmeticOperators: sourceText.includes('world.score + 2')
    && sourceText.includes('world.level * 2')
    && sourceText.includes('world.score - 3')
    && sourceText.includes('world.score / 2')
    && sourceText.includes('world.ready == true')
    && sourceText.includes('rcl:stage37:add')
    && sourceText.includes('rcl:stage37:mul')
    && sourceText.includes('rcl:stage37:sub')
    && sourceText.includes('rcl:stage37:div')
    && sourceText.includes('rcl:stage37:eq-truth'),
  tokenizerWorks: state['parser.token_count'] === 296
    && state['parser.program_token'] === 'Stage37Target',
  compilerParsesSource: compilerProgram.name === 'Stage37Target'
    && compilerProgram.facets.length === 5
    && compilerProgram.warrants.length === 5
    && compilerProgram.warrants[4].subject === 'auditor'
    && compilerProgram.rules.length === 5
    && compilerProgram.rules[0].alters[0].expression.operator === '+'
    && compilerProgram.rules[1].alters[0].expression.operator === '*'
    && compilerProgram.rules[2].alters[0].expression.operator === '-'
    && compilerProgram.rules[3].alters[0].expression.operator === '/'
    && compilerProgram.rules[4].alters[0].expression.operator === '+'
    && compilerProgram.rules[2].when.operator === '<='
    && compilerProgram.rules[2].preserves[0].operator === '>'
    && compilerProgram.rules[3].when.operator === '<'
    && compilerProgram.rules[3].preserves[0].operator === '<='
    && compilerProgram.directives.length === 10,
  targetRbcGenerated: targetRbc.length > 0
    && decodedTarget.program === 'Stage37Target'
    && decodedTarget.sourceRoot === compilerProgram.programRoot,
  targetRbcMatchesJsReference: targetRbc.equals(referenceRbc)
    && sha256(targetRbc) === sha256(referenceRbc),
  targetRunsInNativeVm: targetNativeRun.status === 'ok'
    && targetNativeRun.state['world.ready'] === true
    && targetNativeRun.state['world.status'] === 'armed'
    && targetNativeRun.state['world.score'] === 4.5
    && targetNativeRun.state['world.level'] === 2
    && targetNativeRun.state['world.certified'] === false,
  targetHasCorrectInstructionCount: decodedTarget.instructions.length === 196
    && state['target.rbc_instruction_count'] === 196,
  targetHasCorrectStringPool: decodedTarget.strings.length === 27
    && decodedTarget.strings[0] === 'Stage37Target'
    && decodedTarget.strings[1] === compilerProgram.programRoot
    && decodedTarget.strings[16] === 'publish'
    && decodedTarget.strings[17] === 'sleep'
    && decodedTarget.strings[18] === 'rcl:stage37:add'
    && decodedTarget.strings[20] === 'rcl:stage37:mul'
    && decodedTarget.strings[22] === 'rcl:stage37:sub'
    && decodedTarget.strings[24] === 'rcl:stage37:div'
    && decodedTarget.strings[26] === 'rcl:stage37:eq-truth',
  targetHasCorrectNumberPool: JSON.stringify(decodedTarget.numbers) === JSON.stringify([8, 1, 2, 10, 3, 6, 4]),
  targetHasCorrectOpcodes: targetNames.includes('ADD')
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
  arithmeticOperatorLoweringEvidence: state['compiler.arithmetic_operator_lowering_supported'] === true
    && JSON.stringify(arithmeticIndexes.add) === JSON.stringify([23, 41, 167, 185])
    && JSON.stringify(arithmeticIndexes.sub) === JSON.stringify([95, 113])
    && JSON.stringify(arithmeticIndexes.mul) === JSON.stringify([59, 77])
    && JSON.stringify(arithmeticIndexes.div) === JSON.stringify([131, 149])
    && opcodeCount(decodedTarget, 'ADD') === 4
    && opcodeCount(decodedTarget, 'SUB') === 2
    && opcodeCount(decodedTarget, 'MUL') === 2
    && opcodeCount(decodedTarget, 'DIV') === 2
    && JSON.stringify(comparisonIndexes.eq) === JSON.stringify([17, 35, 161, 172, 179, 190])
    && JSON.stringify(comparisonIndexes.neq) === JSON.stringify([28, 46])
    && JSON.stringify(comparisonIndexes.lt) === JSON.stringify([125, 143])
    && JSON.stringify(comparisonIndexes.lte) === JSON.stringify([89, 107, 136, 154])
    && JSON.stringify(comparisonIndexes.gt) === JSON.stringify([100, 118])
    && JSON.stringify(comparisonIndexes.gte) === JSON.stringify([53, 64, 71, 82])
    && JSON.stringify(pushStringIndexes) === JSON.stringify([2, 16, 27, 34, 45])
    && JSON.stringify(pushBoolIndexes) === JSON.stringify([0, 8, 160, 171, 178, 189])
    && decodedTarget.instructions[23]?.name === 'ADD'
    && decodedTarget.instructions[59]?.name === 'MUL'
    && decodedTarget.instructions[95]?.name === 'SUB'
    && decodedTarget.instructions[131]?.name === 'DIV',
  boundaryHonest: state['selfhost.boundary'] === 'arithmetic_operator_lowering_subset_not_complete_expression_ast_parser_compiler_or_runtime'
    && state['gate.rcl_owned_comparison_operator_lowering_subset'] === true
    && state['gate.rcl_owned_arithmetic_operator_lowering_subset'] === true
    && state['gate.rcl_owned_expression_ast_complete'] === false
    && state['gate.rcl_owned_parser_complete'] === false
    && state['gate.rcl_owned_runtime_complete'] === false,
};

const payload = {
  ok: Object.values(checks).every(Boolean),
  format: 'rcl.selfhost.stage37.verification.v1',
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
    implementedNow: 'RCL maps alter-expression arithmetic operators +, -, * and / to ADD, SUB, MUL and DIV bytecode for this self-host compiler subset, while preserving the Stage36 primitive comparison lowering subset.',
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
