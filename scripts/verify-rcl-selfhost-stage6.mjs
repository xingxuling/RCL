#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { compileReality } from '../src/compiler.mjs';
import { compileRealityToBytecode, decodeBytecode } from '../src/bytecode.mjs';
import { parseReality } from '../src/parser.mjs';
import { runReality } from '../src/runtime.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const rclPath = path.join(root, 'selfhost', 'rcl-compiler-source-artifact-stage6.rcl');
const outputDir = path.join(root, 'output', 'selfhost');
const outputPath = path.join(outputDir, 'stage6-verification.json');
const rbcPath = path.join(outputDir, 'stage6-rcl-owned-compiler-source.rbc');
const jsReferencePath = path.join(outputDir, 'stage6-js-reference-compiler-source.rbc');

function sha256(buffer) {
  return crypto.createHash('sha256').update(Buffer.from(buffer)).digest('hex');
}

const rclSource = fs.readFileSync(rclPath, 'utf8');
const compiled = compileReality(rclSource);
const run = await runReality(compiled);
const state = run.state;
const materializedSource = state['source.compiler'];
const materializedCompiled = compileReality(materializedSource);
const materializedAst = parseReality(materializedSource);
const rclBytecode = Buffer.from(state['compiler.rbc_bytes']);
const jsReference = Buffer.from(compileRealityToBytecode(materializedSource));
const decodedRcl = decodeBytecode(rclBytecode);
const decodedJs = decodeBytecode(jsReference);

const checks = {
  rclCompilesAndRuns: state['selfhost.stage_status'] === 'RCL_OWNED_COMPILER_SOURCE_ARTIFACT_SUBSET_VERIFIED',
  materializedSourceIsParseable: materializedAst.name === state['source.program'],
  sourceRootMatchesCompiler: state['source.root'] === decodedRcl.sourceRoot
    && state['source.root'] === decodedJs.sourceRoot
    && state['source.root'] === materializedCompiled.programRoot,
  rclBytecodeMatchesJsReference: rclBytecode.equals(jsReference),
  bytecodeShaMatches: sha256(rclBytecode) === sha256(jsReference),
  decodedHeaderMatches: decodedRcl.format === 'rcl.bytecode.v1'
    && decodedRcl.flags === 0
    && decodedRcl.version.major === 1
    && decodedRcl.version.minor === 1
    && decodedRcl.program === 'RCLCompilerStage9FixedPoint'
    && decodedRcl.sourceRoot === state['source.root'],
  decodedPoolsMatch: decodedRcl.strings.length === 9
    && decodedRcl.numbers.length === 0
    && JSON.stringify(decodedRcl.strings) === JSON.stringify(decodedJs.strings),
  decodedInstructionsMatch: decodedRcl.instructions.length === 9
    && JSON.stringify(decodedRcl.instructions) === JSON.stringify(decodedJs.instructions)
    && decodedRcl.instructions.some(instruction => instruction.name === 'HALT')
    && decodedRcl.instructions.at(-1)?.name === 'RETURN',
  boundaryRecorded: state['selfhost.boundary'] === 'compiler_source_to_artifact_subset_no_full_native_fixedpoint'
    && state['gate.full_self_hosting'] === false
    && state['gate.rcl_owned_compiler_source_to_artifact_subset'] === true
    && state['gate.rcl_owned_rule_bytecode_lowering_complete'] === false
    && state['gate.native_windows_fixedpoint'] === false
    && state['gate.js_runtime_still_required'] === true,
};

const payload = {
  ok: Object.values(checks).every(Boolean),
  format: 'rcl.selfhost.stage6.verification.v1',
  rclFile: path.relative(root, rclPath).replaceAll(path.sep, '/'),
  rbcFile: path.relative(root, rbcPath).replaceAll(path.sep, '/'),
  jsReferenceFile: path.relative(root, jsReferencePath).replaceAll(path.sep, '/'),
  stageStatus: state['selfhost.stage_status'],
  selfHostClaim: state['selfhost.claim'],
  checks,
  bytecode: {
    size: rclBytecode.length,
    sha256: sha256(rclBytecode),
    jsReferenceSha256: sha256(jsReference),
    exactJsReferenceMatch: rclBytecode.equals(jsReference),
    strings: decodedRcl.strings,
    instructions: decodedRcl.instructions.map(item => ({
      index: item.index,
      op: item.op,
      name: item.name,
      a: item.a,
      b: item.b,
      c: item.c,
    })),
  },
  boundaries: {
    implementedNow: 'RCL source encodes the materialized compiler-source projection into an RBC artifact that is byte-identical to the JS reference compiler for that source.',
    notYetImplemented: 'This is still a compiler-source artifact subset: rule bytecode lowering, full compiler source ingestion, native fixed-point execution, and JS runtime removal remain unfinished.',
    nextTarget: state['selfhost.next_rewrite_target'],
  },
  stateRoot: run.stateRoot,
  programRoot: run.programRoot,
};

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(rbcPath, rclBytecode);
fs.writeFileSync(jsReferencePath, jsReference);
fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(JSON.stringify(payload, null, 2));
