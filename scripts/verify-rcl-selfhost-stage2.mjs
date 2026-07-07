#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { assembleIrProgram, decodeBytecode } from '../src/bytecode.mjs';
import { compileReality } from '../src/compiler.mjs';
import { runReality } from '../src/runtime.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const rclPath = path.join(root, 'selfhost', 'rcl-semantic-bytecode-stage2.rcl');
const outputDir = path.join(root, 'output', 'selfhost');
const outputPath = path.join(outputDir, 'stage2-verification.json');
const rbcPath = path.join(outputDir, 'stage2-selfhost.rbc');

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function instructionSummary(decoded) {
  return decoded.instructions.map(item => ({
    index: item.index,
    op: item.op,
    name: item.name,
    a: item.a,
    b: item.b,
    c: item.c,
  }));
}

const rclSource = fs.readFileSync(rclPath, 'utf8');
const runtimeSource = fs.readFileSync(path.join(root, 'src', 'runtime.mjs'), 'utf8');
const compiled = compileReality(rclSource);
const run = await runReality(compiled);
const state = run.state;

const rclBytecode = Buffer.from(state['compiler.rbc_bytes']);
const jsBytecode = Buffer.from(assembleIrProgram({
  program: state['source.program'],
  sourceRoot: state['source.root'],
  ir: state['compiler.ir'],
}));
const decoded = decodeBytecode(rclBytecode);

const rclSha = sha256(rclBytecode);
const jsSha = sha256(jsBytecode);

const checks = {
  rclCompilesAndRuns: state['selfhost.stage_status'] === 'RCL_OWNED_SEMANTIC_BYTECODE_SUBSET_VERIFIED',
  runtimeSequenceConcatCloneFixed: runtimeSource.includes('left.map(item => structuredClone(item))'),
  importsAndRequirementsValid: state['compiler.core_imports_valid'] === true
    && state['compiler.app_imports_valid'] === true
    && state['compiler.app_requirements_valid'] === true,
  semanticCountMatches: Number(state['stage2.semantic_count']) === 3,
  irCountMatches: Number(state['stage2.ir_count']) === 3,
  rbcMagicMatches: rclBytecode.subarray(0, 4).toString('ascii') === 'RCLB',
  rbcSizeMatches: rclBytecode.length === 294 && Number(state['compiler.rbc_size']) === 294,
  rclBytecodeMatchesJsAssembler: rclBytecode.equals(jsBytecode),
  bytecodeShaMatches: rclSha === jsSha,
  decodedHeaderMatches: decoded.format === 'rcl.bytecode.v1'
    && decoded.version.major === 1
    && decoded.version.minor === 1
    && decoded.flags === 3
    && decoded.program === state['source.program']
    && decoded.sourceRoot === state['source.root'],
  decodedPoolsMatch: decoded.strings.length === 6 && decoded.numbers.length === 1,
  decodedInstructionShapeMatches: decoded.instructions.length === 7
    && decoded.instructions.at(-1)?.name === 'HALT',
  boundaryRecorded: state['selfhost.boundary'] === 'module_facets_import_require_only_js_runtime_still_hosts_execution'
    && state['gate.full_self_hosting'] === false
    && state['gate.js_runtime_still_required'] === true,
};

const payload = {
  ok: Object.values(checks).every(Boolean),
  format: 'rcl.selfhost.stage2.verification.v1',
  rclFile: path.relative(root, rclPath).replaceAll(path.sep, '/'),
  rbcFile: path.relative(root, rbcPath).replaceAll(path.sep, '/'),
  stageStatus: state['selfhost.stage_status'],
  selfHostClaim: state['selfhost.claim'],
  checks,
  bytecode: {
    size: rclBytecode.length,
    sha256: rclSha,
    jsReferenceSha256: jsSha,
    exactJsAssemblerMatch: rclBytecode.equals(jsBytecode),
    strings: decoded.strings,
    numbers: decoded.numbers,
    instructions: instructionSummary(decoded),
  },
  lowering: {
    symbols: state['compiler.symbols'],
    semantic: state['compiler.semantic'],
    ir: state['compiler.ir'],
  },
  boundaries: {
    implementedNow: 'RCL source executes module-aware parsing, import/require validation, symbol resolution, semantic nodes, IR lowering, and RBC byte encoding for a facet subset.',
    fixedRuntimeBug: 'sequence_concat now clones elements through an arrow wrapper so structuredClone does not receive Array.map index arguments.',
    notYetImplemented: 'Whole-language parser coverage, rule semantics, full bytecode lowering parity, runtime self-hosting, and native fixed-point execution remain outside this stage.',
    nextTarget: state['selfhost.next_rewrite_target'],
  },
  stateRoot: run.stateRoot,
  programRoot: run.programRoot,
};

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(rbcPath, rclBytecode);
fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(JSON.stringify(payload, null, 2));
