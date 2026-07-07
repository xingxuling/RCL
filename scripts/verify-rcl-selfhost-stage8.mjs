#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { compileReality } from '../src/compiler.mjs';
import { compileRealityToBytecode, decodeBytecode } from '../src/bytecode.mjs';
import { runReality } from '../src/runtime.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const rclPath = path.join(root, 'selfhost', 'rcl-rule-bytecode-stage8.rcl');
const outputDir = path.join(root, 'output', 'selfhost');
const outputPath = path.join(outputDir, 'stage8-verification.json');
const rbcPath = path.join(outputDir, 'stage8-rcl-owned-rule-bytecode-plan.rbc');
const jsReferencePath = path.join(outputDir, 'stage8-js-reference-rule-bytecode-plan.rbc');

function sha256(buffer) {
  return crypto.createHash('sha256').update(Buffer.from(buffer)).digest('hex');
}

function countOp(instructions, name) {
  return instructions.filter(instruction => instruction.name === name).length;
}

function countOpWithA(instructions, name, a) {
  return instructions.filter(instruction => instruction.name === name && instruction.a === a).length;
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

const rclInstructionPlan = {
  ops: state['compiler.rbc_instruction_ops'],
  a: state['compiler.rbc_instruction_a_values'],
  b: state['compiler.rbc_instruction_b_values'],
  c: state['compiler.rbc_instruction_c_values'],
};
const jsInstructionPlan = {
  ops: decodedJs.instructions.map(instruction => instruction.op),
  a: decodedJs.instructions.map(instruction => instruction.a),
  b: decodedJs.instructions.map(instruction => instruction.b),
  c: decodedJs.instructions.map(instruction => instruction.c),
};

const checks = {
  rclCompilesAndRuns: state['selfhost.stage_status'] === 'RCL_OWNED_RULE_BYTECODE_PLAN_SUBSET_VERIFIED',
  targetRuntimeRealizesRule: targetRun.state['world.ready'] === true
    && targetRun.state['world.status'] === 'published'
    && targetRun.history.some(item => item.rule === 'publish' && item.status === 'realized')
    && targetRun.executionReality.evidence.includes('rcl:stage8:published'),
  sourceRootMatchesCompiler: state['source.root'] === targetCompiled.programRoot
    && state['source.root'] === decodedRcl.sourceRoot
    && state['source.root'] === decodedJs.sourceRoot,
  rclInstructionPlanMatchesJsLowering: JSON.stringify(rclInstructionPlan) === JSON.stringify(jsInstructionPlan),
  rclBytecodeMatchesJsReference: rclBytecode.equals(jsReference),
  bytecodeShaMatches: sha256(rclBytecode) === sha256(jsReference),
  decodedHeaderMatches: decodedRcl.format === 'rcl.bytecode.v1'
    && decodedRcl.flags === 0
    && decodedRcl.version.major === 1
    && decodedRcl.version.minor === 1
    && decodedRcl.program === 'RuleBytecodePlanTarget'
    && decodedRcl.sourceRoot === state['source.root'],
  decodedPoolsMatch: decodedRcl.strings.length === 11
    && decodedRcl.numbers.length === 0
    && JSON.stringify(decodedRcl.strings) === JSON.stringify(decodedJs.strings),
  decodedInstructionsMatch: decodedRcl.instructions.length === 34
    && JSON.stringify(decodedRcl.instructions) === JSON.stringify(decodedJs.instructions)
    && countOp(decodedRcl.instructions, 'JUMP_IF_FALSE') === 2
    && countOp(decodedRcl.instructions, 'BEGIN_TX') === 2
    && countOpWithA(decodedRcl.instructions, 'BEGIN_TX', 0) === 1
    && countOpWithA(decodedRcl.instructions, 'BEGIN_TX', 1) === 1
    && countOp(decodedRcl.instructions, 'CHECK_WARRANT') === 2
    && countOp(decodedRcl.instructions, 'STAGE_STORE') === 2
    && countOp(decodedRcl.instructions, 'SET_PROJECTED_VIEW') === 4
    && countOpWithA(decodedRcl.instructions, 'SET_PROJECTED_VIEW', 1) === 2
    && countOpWithA(decodedRcl.instructions, 'SET_PROJECTED_VIEW', 0) === 2
    && countOp(decodedRcl.instructions, 'CHECK_PRESERVE') === 2
    && countOp(decodedRcl.instructions, 'RECORD_WITNESS') === 2
    && countOp(decodedRcl.instructions, 'COMMIT_TX') === 2
    && decodedRcl.instructions.at(-1)?.name === 'HALT',
  boundaryRecorded: state['selfhost.boundary'] === 'rule_instruction_plan_subset_not_full_general_rule_lowering'
    && state['gate.full_self_hosting'] === false
    && state['gate.rcl_owned_rule_bytecode_plan_subset'] === true
    && state['gate.rcl_owned_rule_bytecode_lowering_complete'] === false
    && state['gate.native_windows_fixedpoint'] === false
    && state['gate.js_runtime_still_required'] === true,
};

const payload = {
  ok: Object.values(checks).every(Boolean),
  format: 'rcl.selfhost.stage8.verification.v1',
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
    history: targetRun.history.map(item => ({
      kind: item.kind,
      rule: item.rule,
      mode: item.mode,
      status: item.status,
      witnesses: item.witnesses,
    })),
    evidence: targetRun.executionReality.evidence,
  },
  bytecode: {
    size: rclBytecode.length,
    sha256: sha256(rclBytecode),
    jsReferenceSha256: sha256(jsReference),
    exactJsReferenceMatch: rclBytecode.equals(jsReference),
    strings: decodedRcl.strings,
    instructionPlan: rclInstructionPlan,
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
    implementedNow: 'RCL source owns a data-driven instruction plan that encodes both foresee and realize emergence-rule bytecode paths; its generated RBC is byte-identical to the JS reference compiler for this broader rule subset.',
    notYetImplemented: 'The RCL source still starts from a constrained instruction plan, not a full AST-to-plan lowering for every rule form; native fixed-point execution remains unclaimed even though the Windows native VM artifact is now present.',
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

if (!payload.ok) process.exitCode = 1;
