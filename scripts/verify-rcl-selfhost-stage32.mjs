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
const rclPath = path.join(root, 'selfhost', 'rcl-facet-warrant-parser-stage32.rcl');
const outputDir = path.join(root, 'output', 'selfhost');
const outputPath = path.join(outputDir, 'stage32-verification.json');
const interpreterArtifactPath = path.join(outputDir, 'stage32-facet-warrant-parser-interpreter.rbc');
const targetRbcPath = path.join(outputDir, 'stage32-facet-warrant-parser-target.rbc');
const referenceRbcPath = path.join(outputDir, 'stage32-facet-warrant-parser-js-reference.rbc');

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

// Stage 32 specific checks
const checks = {
  nativeVmIsRealWindowsExecutable: process.platform !== 'win32'
    ? fs.existsSync(DEFAULT_NATIVE_VM_PATH)
    : nativeFormat.exists === true && nativeFormat.mz === true && nativeFormat.pe === true,
  interpreterRunsInNativeVm: interpreterRun.status === 'ok'
    && state['selfhost.stage_status'] === 'STAGE32_RCL_OWNED_FACET_WARRANT_PARSER_SUBSET_VERIFIED',
  stage32HeaderCorrect: state['selfhost.stage'] === 'stage32_rcl_owned_facet_warrant_parser_subset'
    && state['selfhost.claim'] === 'rcl_parses_facet_and_warrant_sequences_and_emits_base_bytecode_loop'
    && state['selfhost.boundary'] === 'facet_warrant_parser_subset_not_complete_parser_compiler_or_runtime'
    && state['selfhost.next_rewrite_target'] === 'rcl_owned_general_rule_bytecode_emission_and_parser_completion',
  gateFlagsCorrect: state['gate.full_self_hosting'] === false
    && state['gate.rcl_owned_general_expression_parser_subset'] === true
    && state['gate.rcl_owned_rule_lowering_loop'] === true
    && state['gate.rcl_owned_facet_warrant_parser_subset'] === true
    && state['gate.rcl_owned_runtime_complete'] === false,
  sourceTargetCorrect: state['compiler.program'] === 'Stage32Target'
    && state['source.root'] === compilerProgram.programRoot,
  sourceHasExpressions: sourceText.includes('world.score >= 1')
    && sourceText.includes('world.score + 2')
    && sourceText.includes('world.score >= 3')
    && sourceText.includes('world.level >= 1')
    && sourceText.includes('world.score >= 4')
    && sourceText.includes('world.certified : Truth = false')
    && sourceText.includes('warrant world.certify on world'),
  tokenizerWorks: state['parser.token_count'] > 0
    && state['parser.program_token'] === 'Stage32Target',
  compilerParsesSource: compilerProgram.name === 'Stage32Target'
    && compilerProgram.facets.length === 4
    && compilerProgram.warrants.length === 3
    && compilerProgram.rules.length === 3
    && compilerProgram.rules[0].name === 'publish'
    && compilerProgram.rules[1].name === 'promote'
    && compilerProgram.rules[2].name === 'certify'
    && compilerProgram.directives.length === 6,
  targetRbcGenerated: targetRbc.length > 0
    && decodedTarget.program === 'Stage32Target'
    && decodedTarget.sourceRoot === compilerProgram.programRoot,
  targetRbcMatchesJsReference: targetRbc.equals(referenceRbc)
    && sha256(targetRbc) === sha256(referenceRbc),
  targetRunsInNativeVm: targetNativeRun.status === 'ok'
    && targetNativeRun.state['world.ready'] === true
    && targetNativeRun.state['world.score'] === 4
    && targetNativeRun.state['world.level'] === 1
    && targetNativeRun.state['world.certified'] === false,
  targetHasCorrectInstructionCount: decodedTarget.instructions.length === 120
    && state['target.rbc_instruction_count'] === 120,
  targetHasCorrectStringPool: decodedTarget.strings.includes('Stage32Target')
    && decodedTarget.strings.includes(compilerProgram.programRoot)
    && decodedTarget.strings.includes('world.ready')
    && decodedTarget.strings.includes('world.score')
    && decodedTarget.strings.includes('world.level')
    && decodedTarget.strings.includes('world.certified')
    && decodedTarget.strings.includes('founder')
    && decodedTarget.strings.includes('world.publish')
    && decodedTarget.strings.includes('world')
    && decodedTarget.strings.includes('world.certify')
    && decodedTarget.strings.includes('publish')
    && decodedTarget.strings.includes('promote')
    && decodedTarget.strings.includes('certify')
    && decodedTarget.strings.includes('rcl:stage32:score')
    && decodedTarget.strings.includes('rcl:stage32:level')
    && decodedTarget.strings.includes('rcl:stage32:certify'),
  targetHasCorrectNumberPool: decodedTarget.numbers.includes(1)
    && decodedTarget.numbers.includes(0)
    && decodedTarget.numbers.includes(2)
    && decodedTarget.numbers.includes(3)
    && decodedTarget.numbers.includes(4),
  targetHasCorrectOpcodes: targetNames.includes('PUSH_NUMBER')
    && targetNames.includes('PUSH_BOOL')
    && targetNames.includes('LOAD_STATE')
    && targetNames.includes('STORE_STATE')
    && targetNames.includes('ADD')
    && targetNames.includes('GTE')
    && targetNames.includes('HALT'),
  facetWarrantParserEvidence: state['compiler.facet_count'] === 4
    && state['compiler.warrant_count'] === 3
    && state['compiler.directive_count'] === 6
    && state['compiler.facet_warrant_parser_supported'] === true
    && decodedTarget.instructions.slice(0, 11).filter(instruction => instruction.name === 'GRANT_WARRANT').length === 3
    && decodedTarget.instructions[6]?.name === 'PUSH_BOOL'
    && decodedTarget.instructions[6]?.a === 0
    && decodedTarget.instructions.filter(instruction => instruction.name === 'BEGIN_TX').length === 6
    && decodedTarget.instructions.filter(instruction => instruction.name === 'RECORD_WITNESS').length === 6,
  boundaryHonest: state['selfhost.boundary'] === 'facet_warrant_parser_subset_not_complete_parser_compiler_or_runtime'
    && state['gate.rcl_owned_general_expression_parser_subset'] === true
    && state['gate.rcl_owned_rule_lowering_loop'] === true
    && state['gate.rcl_owned_facet_warrant_parser_subset'] === true
    && state['gate.rcl_owned_runtime_complete'] === false,
};

const payload = {
  ok: Object.values(checks).every(Boolean),
  format: 'rcl.selfhost.stage32.verification.v1',
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
  },
  compiler: {
    program: compilerProgram.name,
    facetCount: compilerProgram.facets.length,
    facetPaths: compilerProgram.facets.map(f => f.path),
    warrantCount: compilerProgram.warrants.length,
    warrants: compilerProgram.warrants,
    ruleCount: compilerProgram.rules.length,
    ruleNames: compilerProgram.rules.map(r => r.name),
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
    implementedNow: 'RCL builds parsed facet, warrant, rule and directive sequences, emits initial facet/warrant bytecode from those sequences, then lowers six rule invocations through a recursive bytecode emission loop. The generated target RBC matches the JS compiler byte-for-byte.',
    notYetImplemented: 'This is still a subset. Parser completion, complete compiler self-emission without stage0, complete runtime, and full native self-hosting remain outside this stage.',
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
