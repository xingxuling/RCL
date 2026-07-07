#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileReality } from '../src/compiler.mjs';
import { parseReality } from '../src/parser.mjs';
import { runReality } from '../src/runtime.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const rclPath = path.join(root, 'selfhost', 'rcl-whole-language-semantic-stage3.rcl');
const outputPath = path.join(root, 'output', 'selfhost', 'stage3-verification.json');

function countKinds(nodes) {
  const counts = {};
  for (const node of nodes) counts[node.kind] = (counts[node.kind] ?? 0) + 1;
  return counts;
}

function countPrefix(items, prefix) {
  return items.filter(item => String(item).startsWith(prefix)).length;
}

const rclSource = fs.readFileSync(rclPath, 'utf8');
const runtimeSource = fs.readFileSync(path.join(root, 'src', 'runtime.mjs'), 'utf8');
const compiled = compileReality(rclSource);
const run = await runReality(compiled);
const state = run.state;
const jsAst = parseReality(state['source.full']);
const jsCounts = countKinds(jsAst.body);

const checks = {
  rclCompilesAndRuns: state['selfhost.stage_status'] === 'RCL_OWNED_WHOLE_LANGUAGE_SEMANTIC_SURFACE_VERIFIED',
  runtimeDepthSupportsWholeSurface: runtimeSource.includes('const MAX_RECKON_DEPTH = 4096'),
  wholeParserSupported: state['compiler.whole_parser_supported'] === true,
  semanticLoweringSupported: state['compiler.semantic_lowering_supported'] === true,
  jsParserAcceptsSameSource: jsAst.name === state['compiler.program'],
  declarationCountMatchesJsParser: Number(state['compiler.declaration_count']) === jsAst.body.length,
  jsSurfaceCountsMatch: jsCounts.FacetDecl === Number(state['compiler.facet_count'])
    && jsCounts.ReckonDecl === Number(state['compiler.reckon_count'])
    && jsCounts.HostDecl === Number(state['compiler.host_count'])
    && jsCounts.SubjectDecl === Number(state['compiler.subject_count'])
    && jsCounts.Emergence === Number(state['compiler.emergence_count'])
    && jsCounts.DialectDecl === Number(state['compiler.dialect_count'])
    && jsCounts.EffectDecl === Number(state['compiler.effect_count'])
    && jsCounts.CapabilityPolicyDecl === Number(state['compiler.capability_policy_count'])
    && jsCounts.StoreDecl === Number(state['compiler.store_count']),
  semanticNodeCountMatches: Number(state['stage3.semantic_node_count']) === 14,
  loweredIrCountMatches: Number(state['stage3.lowered_ir_count']) === 14,
  ruleSemanticCountsMatch: Number(state['compiler.warrant_semantic_count']) === 2
    && Number(state['compiler.need_semantic_count']) === 2
    && Number(state['compiler.alter_semantic_count']) === 3
    && Number(state['compiler.preserve_semantic_count']) === 1
    && Number(state['compiler.hostcall_semantic_count']) === 1,
  loweredIrShapeMatches: countPrefix(state['compiler.lowered_ir'], 'IR:AuthorityCheck:') === 2
    && countPrefix(state['compiler.lowered_ir'], 'IR:AlterStore:') === 3
    && countPrefix(state['compiler.lowered_ir'], 'IR:ProviderCall:') === 1
    && countPrefix(state['compiler.lowered_ir'], 'IR:ProjectionSchedule:') === 1
    && countPrefix(state['compiler.lowered_ir'], 'IR:CommitSchedule:') === 1,
  boundaryRecorded: state['selfhost.boundary'] === 'whole_language_surface_and_rule_ir_only_no_full_bytecode_for_rules'
    && state['gate.full_self_hosting'] === false
    && state['gate.rule_bytecode_lowering_complete'] === false
    && state['gate.js_runtime_still_required'] === true,
};

const payload = {
  ok: Object.values(checks).every(Boolean),
  format: 'rcl.selfhost.stage3.verification.v1',
  rclFile: path.relative(root, rclPath).replaceAll(path.sep, '/'),
  stageStatus: state['selfhost.stage_status'],
  selfHostClaim: state['selfhost.claim'],
  checks,
  jsParser: {
    program: jsAst.name,
    declarationCount: jsAst.body.length,
    counts: jsCounts,
  },
  rclSurface: {
    declarations: state['compiler.declarations'],
    semanticNodes: state['compiler.semantic_nodes'],
    loweredIr: state['compiler.lowered_ir'],
  },
  boundaries: {
    implementedNow: 'RCL source parses a whole-language surface and lowers rule authority, alters, host calls, preserves, foresee, and realize directives into semantic IR strings.',
    notYetImplemented: 'Absorption lowering still needs default-stack runtime work, full bytecode lowering for rules is incomplete, and runtime/native self-hosting remains JS/native reference code.',
    nextTarget: state['selfhost.next_rewrite_target'],
  },
  stateRoot: run.stateRoot,
  programRoot: run.programRoot,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(JSON.stringify(payload, null, 2));
