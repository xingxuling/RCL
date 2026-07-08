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
const rclPath = path.join(root, 'selfhost', 'rcl-multisubject-warrant-stage34.rcl');
const outputDir = path.join(root, 'output', 'selfhost');
const outputPath = path.join(outputDir, 'stage34-verification.json');
const interpreterArtifactPath = path.join(outputDir, 'stage34-multisubject-warrant-interpreter.rbc');
const targetRbcPath = path.join(outputDir, 'stage34-multisubject-warrant-target.rbc');
const referenceRbcPath = path.join(outputDir, 'stage34-multisubject-warrant-js-reference.rbc');

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

// Stage 34 specific checks
const checks = {
  nativeVmIsRealWindowsExecutable: process.platform !== 'win32'
    ? fs.existsSync(DEFAULT_NATIVE_VM_PATH)
    : nativeFormat.exists === true && nativeFormat.mz === true && nativeFormat.pe === true,
  interpreterRunsInNativeVm: interpreterRun.status === 'ok'
    && state['selfhost.stage_status'] === 'STAGE34_RCL_OWNED_MULTISUBJECT_WARRANT_PARSER_SUBSET_VERIFIED',
  stage34HeaderCorrect: state['selfhost.stage'] === 'stage34_rcl_owned_multisubject_warrant_parser_subset'
    && state['selfhost.claim'] === 'rcl_preserves_subject_ownership_across_multiple_subject_warrant_blocks'
    && state['selfhost.boundary'] === 'multisubject_warrant_parser_subset_not_complete_parser_compiler_or_runtime'
    && state['selfhost.next_rewrite_target'] === 'rcl_owned_parser_completion_and_compiler_self_emission',
  gateFlagsCorrect: state['gate.full_self_hosting'] === false
    && state['gate.rcl_owned_general_expression_parser_subset'] === true
    && state['gate.rcl_owned_rule_lowering_loop'] === true
    && state['gate.rcl_owned_facet_warrant_parser_subset'] === true
    && state['gate.rcl_owned_general_rule_directive_scaling_subset'] === true
    && state['gate.rcl_owned_multisubject_warrant_parser_subset'] === true
    && state['gate.rcl_owned_runtime_complete'] === false,
  sourceTargetCorrect: state['compiler.program'] === 'Stage34Target'
    && state['source.root'] === compilerProgram.programRoot,
  sourceHasExpressions: sourceText.includes('world.score >= 1')
    && sourceText.includes('world.score + 2')
    && sourceText.includes('world.score >= 3')
    && sourceText.includes('world.level >= 1')
    && sourceText.includes('world.score >= 4')
    && sourceText.includes('world.score >= 5')
    && sourceText.includes('world.score >= 6')
    && sourceText.includes('world.certified : Truth = false')
    && sourceText.includes('warrant world.certify on world')
    && sourceText.includes('warrant world.seal on world')
    && sourceText.includes('subject auditor')
    && sourceText.includes('warrant world.audit on world')
    && sourceText.includes('rcl:stage34:audit'),
  tokenizerWorks: state['parser.token_count'] > 0
    && state['parser.program_token'] === 'Stage34Target',
  compilerParsesSource: compilerProgram.name === 'Stage34Target'
    && compilerProgram.facets.length === 4
    && compilerProgram.warrants.length === 5
    && compilerProgram.warrants[4].subject === 'auditor'
    && compilerProgram.warrants[4].capability === 'world.audit'
    && compilerProgram.rules.length === 5
    && compilerProgram.rules[0].name === 'publish'
    && compilerProgram.rules[1].name === 'promote'
    && compilerProgram.rules[2].name === 'certify'
    && compilerProgram.rules[3].name === 'seal'
    && compilerProgram.rules[4].name === 'audit'
    && compilerProgram.directives.length === 10,
  targetRbcGenerated: targetRbc.length > 0
    && decodedTarget.program === 'Stage34Target'
    && decodedTarget.sourceRoot === compilerProgram.programRoot,
  targetRbcMatchesJsReference: targetRbc.equals(referenceRbc)
    && sha256(targetRbc) === sha256(referenceRbc),
  targetRunsInNativeVm: targetNativeRun.status === 'ok'
    && targetNativeRun.state['world.ready'] === true
    && targetNativeRun.state['world.score'] === 6
    && targetNativeRun.state['world.level'] === 1
    && targetNativeRun.state['world.certified'] === false,
  targetHasCorrectInstructionCount: decodedTarget.instructions.length === 194
    && state['target.rbc_instruction_count'] === 194,
  targetHasCorrectStringPool: decodedTarget.strings.includes('Stage34Target')
    && decodedTarget.strings.includes(compilerProgram.programRoot)
    && decodedTarget.strings.includes('world.ready')
    && decodedTarget.strings.includes('world.score')
    && decodedTarget.strings.includes('world.level')
    && decodedTarget.strings.includes('world.certified')
    && decodedTarget.strings.includes('founder')
    && decodedTarget.strings.includes('world.publish')
    && decodedTarget.strings.includes('world')
    && decodedTarget.strings.includes('world.certify')
    && decodedTarget.strings.includes('world.seal')
    && decodedTarget.strings.includes('auditor')
    && decodedTarget.strings.includes('world.audit')
    && decodedTarget.strings.includes('publish')
    && decodedTarget.strings.includes('promote')
    && decodedTarget.strings.includes('certify')
    && decodedTarget.strings.includes('seal')
    && decodedTarget.strings.includes('audit')
    && decodedTarget.strings.includes('rcl:stage34:score')
    && decodedTarget.strings.includes('rcl:stage34:level')
    && decodedTarget.strings.includes('rcl:stage34:certify')
    && decodedTarget.strings.includes('rcl:stage34:seal')
    && decodedTarget.strings.includes('rcl:stage34:audit'),
  targetHasCorrectNumberPool: decodedTarget.numbers.includes(1)
    && decodedTarget.numbers.includes(0)
    && decodedTarget.numbers.includes(2)
    && decodedTarget.numbers.includes(3)
    && decodedTarget.numbers.includes(4)
    && decodedTarget.numbers.includes(5)
    && decodedTarget.numbers.includes(6),
  targetHasCorrectOpcodes: targetNames.includes('PUSH_NUMBER')
    && targetNames.includes('PUSH_BOOL')
    && targetNames.includes('LOAD_STATE')
    && targetNames.includes('STORE_STATE')
    && targetNames.includes('ADD')
    && targetNames.includes('GTE')
    && targetNames.includes('HALT'),
  multisubjectWarrantParserEvidence: state['compiler.facet_count'] === 4
    && state['compiler.subject_count'] === 2
    && state['compiler.warrant_count'] === 5
    && state['compiler.emergence_count'] === 5
    && state['compiler.directive_count'] === 10
    && state['compiler.multisubject_warrant_parser_supported'] === true
    && decodedTarget.instructions.slice(0, 13).filter(instruction => instruction.name === 'GRANT_WARRANT').length === 5
    && decodedTarget.instructions[12]?.name === 'GRANT_WARRANT'
    && decodedTarget.strings[decodedTarget.instructions[12]?.a] === 'auditor'
    && decodedTarget.strings[decodedTarget.instructions[12]?.b] === 'world.audit'
    && decodedTarget.instructions[6]?.name === 'PUSH_BOOL'
    && decodedTarget.instructions[6]?.a === 0
    && decodedTarget.instructions.filter(instruction => instruction.name === 'BEGIN_TX').length === 10
    && decodedTarget.instructions.filter(instruction => instruction.name === 'RECORD_WITNESS').length === 10
    && decodedTarget.instructions.filter(instruction => instruction.name === 'ADD').length === 10,
  boundaryHonest: state['selfhost.boundary'] === 'multisubject_warrant_parser_subset_not_complete_parser_compiler_or_runtime'
    && state['gate.rcl_owned_general_expression_parser_subset'] === true
    && state['gate.rcl_owned_rule_lowering_loop'] === true
    && state['gate.rcl_owned_facet_warrant_parser_subset'] === true
    && state['gate.rcl_owned_general_rule_directive_scaling_subset'] === true
    && state['gate.rcl_owned_multisubject_warrant_parser_subset'] === true
    && state['gate.rcl_owned_runtime_complete'] === false,
};

const payload = {
  ok: Object.values(checks).every(Boolean),
  format: 'rcl.selfhost.stage34.verification.v1',
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
    facetCount: compilerProgram.facets.length,
    facetPaths: compilerProgram.facets.map(f => f.path),
    subjectCount: state['compiler.subject_count'],
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
    implementedNow: 'RCL parses multiple subject blocks, preserves subject ownership on each warrant, emits five subject-aware GRANT_WARRANT instructions, and scales the recursive bytecode emission loop to five rules and ten directive invocations. The generated target RBC matches the JS compiler byte-for-byte.',
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
