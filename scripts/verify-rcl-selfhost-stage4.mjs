#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileReality } from '../src/compiler.mjs';
import { parseReality } from '../src/parser.mjs';
import { runReality } from '../src/runtime.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const rclPath = path.join(root, 'selfhost', 'rcl-absorption-lowering-stage4.rcl');
const outputPath = path.join(root, 'output', 'selfhost', 'stage4-verification.json');

function countKinds(nodes) {
  const counts = {};
  for (const node of nodes) counts[node.kind] = (counts[node.kind] ?? 0) + 1;
  return counts;
}

function countPrefix(items, prefix) {
  return (Array.isArray(items) ? items : []).filter(item => String(item).startsWith(prefix)).length;
}

const rclSource = fs.readFileSync(rclPath, 'utf8');
const runtimeSource = fs.readFileSync(path.join(root, 'src', 'runtime.mjs'), 'utf8');
const compiled = compileReality(rclSource);
const run = await runReality(compiled);
const state = run.state;
const jsAst = parseReality(state['source.full']);
const jsCounts = countKinds(jsAst.body);
const semanticNodes = state['compiler.semantic_nodes'];
const loweredIr = state['compiler.lowered_ir'];
const absorptionNodes = state['compiler.absorption_nodes'];
const absorptionIr = state['compiler.absorption_lowered_ir'];
const ranWithoutStackSizeOverride = !process.execArgv.some(arg => String(arg).includes('stack_size'));

const checks = {
  rclCompilesAndRuns: state['selfhost.stage_status'] === 'RCL_OWNED_ABSORPTION_LOWERING_DEFAULT_STACK_VERIFIED',
  ranWithoutStackSizeOverride,
  runtimeDepthSupportsWholeSurface: runtimeSource.includes('const MAX_RECKON_DEPTH = 4096'),
  runtimeSequenceConcatCloneFixed: runtimeSource.includes('left.map(item => structuredClone(item))'),
  wholeParserSupported: state['compiler.whole_parser_supported'] === true,
  semanticLoweringSupported: state['compiler.semantic_lowering_supported'] === true,
  absorptionLoweringSupported: state['compiler.absorption_lowering_supported'] === true,
  jsParserAcceptsSameSource: jsAst.name === state['compiler.program'],
  declarationCountMatchesJsParser: Number(state['compiler.declaration_count']) === jsAst.body.length,
  jsSurfaceCountsMatch: jsCounts.DialectDecl === Number(state['compiler.dialect_count'])
    && jsCounts.EffectDecl === Number(state['compiler.effect_count'])
    && jsCounts.CapabilityPolicyDecl === Number(state['compiler.capability_policy_count'])
    && jsCounts.StoreDecl === Number(state['compiler.store_count'])
    && jsCounts.FacetDecl === Number(state['compiler.facet_count'])
    && jsCounts.ReckonDecl === Number(state['compiler.reckon_count'])
    && jsCounts.HostDecl === Number(state['compiler.host_count'])
    && jsCounts.SubjectDecl === Number(state['compiler.subject_count'])
    && jsCounts.Emergence === Number(state['compiler.emergence_count'])
    && jsCounts.VerifyCapabilities === 1
    && jsCounts.SnapshotStore === 1,
  semanticNodeCountMatches: Array.isArray(semanticNodes) && semanticNodes.length === 14,
  loweredIrCountMatches: Array.isArray(loweredIr) && loweredIr.length === 14,
  absorptionNodeCountMatches: Number(state['stage4.absorption_node_count']) === 17,
  absorptionIrCountMatches: Number(state['stage4.absorption_ir_count']) === 17,
  absorptionCountsMatch: Number(state['compiler.dialect_lowering_count']) === 1
    && Number(state['compiler.effect_lowering_count']) === 2
    && Number(state['compiler.policy_lowering_count']) === 1
    && Number(state['compiler.policy_capability_lowering_count']) === 2
    && Number(state['compiler.policy_budget_lowering_count']) === 3
    && Number(state['compiler.store_lowering_count']) === 1
    && Number(state['compiler.verify_lowering_count']) === 1
    && Number(state['compiler.snapshot_lowering_count']) === 1
    && countPrefix(absorptionNodes, 'PolicyAllowEffect:') === 1
    && countPrefix(absorptionNodes, 'PolicyDenyEffect:') === 1
    && countPrefix(absorptionNodes, 'ReplayRequirement:') === 1,
  absorptionIrShapeMatches: countPrefix(absorptionIr, 'IR:DialectRegister:') === 1
    && countPrefix(absorptionIr, 'IR:EffectDeclare:') === 2
    && countPrefix(absorptionIr, 'IR:CapabilityPolicy:') === 1
    && countPrefix(absorptionIr, 'IR:VerifierAllowEffect:') === 1
    && countPrefix(absorptionIr, 'IR:VerifierDenyEffect:') === 1
    && countPrefix(absorptionIr, 'IR:VerifierCapability:') === 2
    && countPrefix(absorptionIr, 'IR:VerifierBudget:') === 3
    && countPrefix(absorptionIr, 'IR:VerifierReplayRequirement:') === 1
    && countPrefix(absorptionIr, 'IR:StoreDeclare:') === 1
    && countPrefix(absorptionIr, 'IR:StoreBranch:') === 1
    && countPrefix(absorptionIr, 'IR:StoreCommitMessage:') === 1
    && countPrefix(absorptionIr, 'IR:VerifierRun:') === 1
    && countPrefix(absorptionIr, 'IR:StoreSnapshot:') === 1,
  firstAbsorptionItemsMatch: state['stage4.first_absorption_node'] === 'Dialect:release'
    && state['stage4.first_absorption_ir'] === 'IR:DialectRegister:Dialect:release',
  boundaryRecorded: state['selfhost.boundary'] === 'absorption_semantic_ir_only_no_full_rule_bytecode_or_native_selfhost'
    && state['gate.full_self_hosting'] === false
    && state['gate.rule_bytecode_lowering_complete'] === false
    && state['gate.js_runtime_still_required'] === true
    && state['gate.stack_size_override_required'] === false,
};

const payload = {
  ok: Object.values(checks).every(Boolean),
  format: 'rcl.selfhost.stage4.verification.v1',
  rclFile: path.relative(root, rclPath).replaceAll(path.sep, '/'),
  stageStatus: state['selfhost.stage_status'],
  selfHostClaim: state['selfhost.claim'],
  checks,
  jsParser: {
    program: jsAst.name,
    declarationCount: jsAst.body.length,
    counts: jsCounts,
  },
  absorption: {
    nodes: absorptionNodes,
    loweredIr: absorptionIr,
    counts: {
      dialect: state['compiler.dialect_lowering_count'],
      effect: state['compiler.effect_lowering_count'],
      policy: state['compiler.policy_lowering_count'],
      policyCapability: state['compiler.policy_capability_lowering_count'],
      policyBudget: state['compiler.policy_budget_lowering_count'],
      store: state['compiler.store_lowering_count'],
      verify: state['compiler.verify_lowering_count'],
      snapshot: state['compiler.snapshot_lowering_count'],
    },
  },
  boundaries: {
    implementedNow: 'RCL source lowers dialect, effect, policy, budget, replay, store, verify, and snapshot declarations into absorption semantic IR without a Node stack-size override.',
    notYetImplemented: 'Full rule bytecode lowering, JS runtime rewrite, native fixed-point execution, and fixed-point compiler source materialization remain outside this stage.',
    nextTarget: state['selfhost.next_rewrite_target'],
  },
  runtimeEvidence: {
    execArgv: process.execArgv,
    ranWithoutStackSizeOverride,
  },
  stateRoot: run.stateRoot,
  programRoot: run.programRoot,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(JSON.stringify(payload, null, 2));
