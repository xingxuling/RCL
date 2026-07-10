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
const rclPath = path.join(root, 'selfhost', 'rcl-dual-need-stage40.rcl');
const outputDir = path.join(root, 'output', 'selfhost');
const outputPath = path.join(outputDir, 'stage40-verification.json');
const interpreterArtifactPath = path.join(outputDir, 'stage40-dual-need-interpreter.rbc');
const targetRbcPath = path.join(outputDir, 'stage40-dual-need-target.rbc');
const referenceRbcPath = path.join(outputDir, 'stage40-dual-need-js-reference.rbc');

const EXPECTED_ROOT = '71e899db3794f862101f898dbf0549a534db488f4320f30d07585d523a25ce14';
const EXPECTED_TARGET_SHA = '4dbfe7408fb24484065b06e7b2d5b421cd2f6773bef28e29cfacd393c724e318';
const EXPECTED_NUMBERS = [8, 1, 2, 10, 3, 6, 4];
const EXPECTED_STRINGS = [
  'Stage40Target',
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
  'world.inspect',
  'publish',
  'sleep',
  'rcl:stage40:add-not-and-dual-need',
  'promote',
  'rcl:stage40:mul-not-or-dual-need',
  'certify',
  'rcl:stage40:sub-not-and-dual-need',
  'seal',
  'rcl:stage40:div-not-or-dual-need',
  'audit',
  'rcl:stage40:eq-not-and-dual-need',
];
const EXPECTED_CHECK_WARRANT_INDEXES = [
  31, 32, 70, 71, 109, 110, 148, 149, 187, 188,
  226, 227, 265, 266, 304, 305, 343, 344, 382, 383,
];
const EXPECTED_RULE_NEEDS = {
  publish: [
    { capability: 'world.publish', target: 'world' },
    { capability: 'world.promote', target: 'world' },
  ],
  promote: [
    { capability: 'world.promote', target: 'world' },
    { capability: 'world.certify', target: 'world' },
  ],
  certify: [
    { capability: 'world.certify', target: 'world' },
    { capability: 'world.seal', target: 'world' },
  ],
  seal: [
    { capability: 'world.seal', target: 'world' },
    { capability: 'world.publish', target: 'world' },
  ],
  audit: [
    { capability: 'world.audit', target: 'world' },
    { capability: 'world.inspect', target: 'world' },
  ],
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

function stableJson(value) {
  return JSON.stringify(value, Object.keys(value ?? {}).sort());
}

function decodedCheckWarrants(decoded) {
  return decoded.instructions
    .filter(instruction => instruction.name === 'CHECK_WARRANT')
    .map(instruction => ({
      index: instruction.index,
      actor: decoded.strings[instruction.a],
      capability: decoded.strings[instruction.b],
      target: decoded.strings[instruction.c],
    }));
}

function expectedCheckWarrants(program) {
  const rulesByName = new Map(program.rules.map(rule => [rule.name, rule]));
  let index = 0;
  return program.directives.flatMap(directive => {
    const rule = rulesByName.get(directive.rule);
    return rule.needs.map(need => ({
      index: EXPECTED_CHECK_WARRANT_INDEXES[index++],
      actor: rule.cause,
      capability: need.capability,
      target: need.target,
    }));
  });
}

function authorityRecordsMatch(records, program) {
  const rulesByName = new Map(program.rules.map(rule => [rule.name, rule]));
  return records.length === program.rules.length
    && records.every(record => {
      const rule = rulesByName.get(record.rule);
      return rule
        && record.authority?.needs?.length === 2
        && JSON.stringify(record.authority.needs) === JSON.stringify(rule.needs);
    });
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
const checkWarrants = decodedCheckWarrants(decodedTarget);
const expectedChecks = expectedCheckWarrants(compilerProgram);
const ruleNeeds = Object.fromEntries(compilerProgram.rules.map(rule => [rule.name, rule.needs]));
const checkWarrantPairs = compilerProgram.directives.map((directive, index) => ({
  directive: directive.kind,
  rule: directive.rule,
  checks: checkWarrants.slice(index * 2, index * 2 + 2),
}));
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
    && state['selfhost.stage_status'] === 'STAGE40_RCL_OWNED_DUAL_NEED_WARRANT_LOWERING_SUBSET_VERIFIED',
  stage40HeaderCorrect: state['selfhost.stage'] === 'stage40_rcl_owned_dual_need_warrant_lowering_subset'
    && state['selfhost.claim'] === 'rcl_lowers_dual_needs_clauses_to_warrant_bytecode'
    && state['selfhost.boundary'] === 'dual_need_warrant_lowering_subset_not_complete_rule_parser_compiler_or_runtime'
    && state['selfhost.next_rewrite_target'] === 'rcl_owned_rule_parser_completion_and_compiler_self_emission',
  gateFlagsCorrect: state['gate.full_self_hosting'] === false
    && state['gate.rcl_owned_unary_not_lowering_subset'] === true
    && state['gate.rcl_owned_dual_need_warrant_lowering_subset'] === true
    && state['gate.rcl_owned_runtime_complete'] === false,
  sourceTargetCorrect: state['compiler.program'] === 'Stage40Target'
    && state['source.root'] === compilerProgram.programRoot
    && compilerProgram.programRoot === EXPECTED_ROOT,
  sourceHasDualNeeds: sourceText.includes('needs world.publish on world needs world.promote on world')
    && sourceText.includes('needs world.audit on world needs world.inspect on world')
    && sourceText.includes('rcl:stage40:add-not-and-dual-need')
    && sourceText.includes('rcl:stage40:eq-not-and-dual-need'),
  tokenizerWorks: state['parser.token_count'] === 460
    && state['parser.program_token'] === 'Stage40Target',
  compilerParsesDualNeeds: compilerProgram.name === 'Stage40Target'
    && compilerProgram.facets.length === 5
    && compilerProgram.warrants.length === 6
    && compilerProgram.rules.length === 5
    && compilerProgram.rules.every(rule => rule.needs.length === 2)
    && JSON.stringify(ruleNeeds) === JSON.stringify(EXPECTED_RULE_NEEDS)
    && compilerProgram.directives.length === 10,
  targetRbcGenerated: targetRbc.length === 7147
    && decodedTarget.program === 'Stage40Target'
    && decodedTarget.sourceRoot === compilerProgram.programRoot,
  targetRbcMatchesJsReference: targetRbc.equals(referenceRbc)
    && sha256(targetRbc) === sha256(referenceRbc)
    && sha256(targetRbc) === EXPECTED_TARGET_SHA,
  targetRunsInNativeVm: targetNativeRun.status === 'ok'
    && stableJson(targetNativeRun.state) === stableJson(targetReferenceRun.state)
    && targetNativeRun.state['world.score'] === 4.5
    && targetNativeRun.state['world.level'] === 2
    && targetNativeRun.state['world.certified'] === false,
  targetHasCorrectInstructionCount: decodedTarget.instructions.length === 407
    && state['target.rbc_instruction_count'] === 407,
  targetHasCorrectStringPool: JSON.stringify(decodedTarget.strings) === JSON.stringify(EXPECTED_STRINGS),
  targetHasCorrectNumberPool: JSON.stringify(decodedTarget.numbers) === JSON.stringify(EXPECTED_NUMBERS),
  dualNeedLoweringEvidence: state['compiler.dual_need_warrant_lowering_supported'] === true
    && opcodeCounts.CHECK_WARRANT === 20
    && JSON.stringify(opcodeIndexes(decodedTarget, 'CHECK_WARRANT')) === JSON.stringify(EXPECTED_CHECK_WARRANT_INDEXES)
    && JSON.stringify(checkWarrants) === JSON.stringify(expectedChecks)
    && checkWarrantPairs.length === 10
    && checkWarrantPairs.every(pair => pair.checks.length === 2 && pair.checks[1].index === pair.checks[0].index + 1),
  dualNeedExecutionEvidence: targetNativeRun.metrics?.instructions === 367
    && authorityRecordsMatch(targetNativeRun.projections, compilerProgram)
    && authorityRecordsMatch(targetNativeRun.history, compilerProgram)
    && authorityRecordsMatch(targetReferenceRun.projections, compilerProgram)
    && authorityRecordsMatch(targetReferenceRun.history, compilerProgram),
  shortCircuitBooleanLoweringEvidence: opcodeCounts.NOT === 80
    && opcodeCounts.JUMP === 20
    && opcodeCounts.JUMP_IF_FALSE === 30
    && opcodeCounts.AND === 0
    && opcodeCounts.OR === 0
    && decodedTarget.instructions[406]?.name === 'HALT',
  boundaryHonest: state['selfhost.boundary'] === 'dual_need_warrant_lowering_subset_not_complete_rule_parser_compiler_or_runtime'
    && state['gate.rcl_owned_dual_need_warrant_lowering_subset'] === true
    && state['gate.rcl_owned_expression_ast_complete'] === false
    && state['gate.rcl_owned_parser_complete'] === false
    && state['gate.rcl_owned_runtime_complete'] === false,
};

const payload = {
  ok: Object.values(checks).every(Boolean),
  format: 'rcl.selfhost.stage40.verification.v1',
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
    warrantCount: compilerProgram.warrants.length,
    warrants: compilerProgram.warrants,
    ruleCount: compilerProgram.rules.length,
    ruleNames: compilerProgram.rules.map(rule => rule.name),
    ruleNeeds,
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
    checkWarrants,
    checkWarrantPairs,
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
    runtimeState: targetReferenceRun.state,
    projections: targetReferenceRun.projections,
    history: targetReferenceRun.history,
  },
  boundaries: {
    implementedNow: 'RCL emits the current short-circuit boolean jump layout plus two consecutive CHECK_WARRANT instructions for every foresee and realize invocation, with exact byte parity and native runtime authority records proving both checks executed.',
    notYetImplemented: 'This remains a dual-needs subset. Complete rule parsing, compiler self-emission without stage0, complete runtime, and full native self-hosting remain outside this stage.',
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
