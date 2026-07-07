#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { compileReality } from '../src/compiler.mjs';
import { compileRealityToBytecode, decodeBytecode } from '../src/bytecode.mjs';
import { runReality } from '../src/runtime.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const rclPath = path.join(root, 'selfhost', 'rcl-rule-bytecode-stage7.rcl');
const outputDir = path.join(root, 'output', 'selfhost');
const outputPath = path.join(outputDir, 'stage7-verification.json');
const rbcPath = path.join(outputDir, 'stage7-rcl-owned-rule-bytecode.rbc');
const jsReferencePath = path.join(outputDir, 'stage7-js-reference-rule-bytecode.rbc');

function sha256(buffer) {
  return crypto.createHash('sha256').update(Buffer.from(buffer)).digest('hex');
}

function countOp(instructions, name) {
  return instructions.filter(instruction => instruction.name === name).length;
}

const rclSource = fs.readFileSync(rclPath, 'utf8');
const compiled = compileReality(rclSource);
const run = await runReality(compiled);
const state = run.state;
const targetSource = state['source.target'];
const targetCompiled = compileReality(targetSource);
const targetRun = await runReality(targetCompiled);
const rclBytecode = Buffer.from(state['compiler.rbc_bytes']);
const jsReference = Buffer.from(compileRealityToBytecode(targetSource));
const decodedRcl = decodeBytecode(rclBytecode);
const decodedJs = decodeBytecode(jsReference);

const checks = {
  rclCompilesAndRuns: state['selfhost.stage_status'] === 'RCL_OWNED_RULE_BYTECODE_SUBSET_VERIFIED',
  targetRuntimeRealizesRule: targetRun.state['world.ready'] === true
    && targetRun.state['world.status'] === 'published'
    && targetRun.history.some(item => item.rule === 'publish' && item.status === 'realized')
    && targetRun.executionReality.evidence.includes('rcl:stage7:published'),
  sourceRootMatchesCompiler: state['source.root'] === targetCompiled.programRoot
    && state['source.root'] === decodedRcl.sourceRoot
    && state['source.root'] === decodedJs.sourceRoot,
  rclBytecodeMatchesJsReference: rclBytecode.equals(jsReference),
  bytecodeShaMatches: sha256(rclBytecode) === sha256(jsReference),
  decodedHeaderMatches: decodedRcl.format === 'rcl.bytecode.v1'
    && decodedRcl.flags === 0
    && decodedRcl.version.major === 1
    && decodedRcl.version.minor === 1
    && decodedRcl.program === 'RuleBytecodeTarget'
    && decodedRcl.sourceRoot === state['source.root'],
  decodedPoolsMatch: decodedRcl.strings.length === 11
    && decodedRcl.numbers.length === 0
    && JSON.stringify(decodedRcl.strings) === JSON.stringify(decodedJs.strings),
  decodedInstructionsMatch: decodedRcl.instructions.length === 20
    && JSON.stringify(decodedRcl.instructions) === JSON.stringify(decodedJs.instructions)
    && countOp(decodedRcl.instructions, 'BEGIN_TX') === 1
    && countOp(decodedRcl.instructions, 'CHECK_WARRANT') === 1
    && countOp(decodedRcl.instructions, 'STAGE_STORE') === 1
    && countOp(decodedRcl.instructions, 'CHECK_PRESERVE') === 1
    && countOp(decodedRcl.instructions, 'RECORD_WITNESS') === 1
    && countOp(decodedRcl.instructions, 'COMMIT_TX') === 1
    && decodedRcl.instructions.at(-1)?.name === 'HALT',
  boundaryRecorded: state['selfhost.boundary'] === 'single_emergence_rule_bytecode_subset_not_full_rule_lowering'
    && state['gate.full_self_hosting'] === false
    && state['gate.rcl_owned_rule_bytecode_subset'] === true
    && state['gate.rcl_owned_rule_bytecode_lowering_complete'] === false
    && state['gate.native_windows_fixedpoint'] === false
    && state['gate.js_runtime_still_required'] === true,
};

const payload = {
  ok: Object.values(checks).every(Boolean),
  format: 'rcl.selfhost.stage7.verification.v1',
  rclFile: path.relative(root, rclPath).replaceAll(path.sep, '/'),
  rbcFile: path.relative(root, rbcPath).replaceAll(path.sep, '/'),
  jsReferenceFile: path.relative(root, jsReferencePath).replaceAll(path.sep, '/'),
  stageStatus: state['selfhost.stage_status'],
  selfHostClaim: state['selfhost.claim'],
  checks,
  runtimeTarget: {
    state: {
      ready: targetRun.state['world.ready'],
      status: targetRun.state['world.status'],
    },
    evidence: targetRun.executionReality.evidence,
  },
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
    implementedNow: 'RCL source encodes a realized emergence rule bytecode subset with authorization, staged alteration, preserve check, witness recording, and transaction commit; the RBC is byte-identical to the JS reference compiler.',
    notYetImplemented: 'This is one constrained emergence-rule bytecode shape, not generalized rule lowering for the whole language; native fixed-point execution remains unclaimed even though the Windows native VM artifact is now present.',
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
