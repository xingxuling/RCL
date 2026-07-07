#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileReality } from '../src/compiler.mjs';
import { lexReality } from '../src/lexer.mjs';
import { runReality } from '../src/runtime.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const rclPath = path.join(root, 'selfhost', 'rcl-lexer-parser-facet-stage1.rcl');
const outputPath = path.join(root, 'output', 'selfhost', 'stage1-verification.json');

function asStageToken(token) {
  return {
    type: token.tokenType,
    value: token.text,
    line: token.span?.line,
    column: token.span?.column,
  };
}

function tokenCore(token) {
  return {
    type: token.type,
    value: token.value,
    line: token.line,
    column: token.column,
  };
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function literalValue(node) {
  return node?.value?.value;
}

const rclSource = fs.readFileSync(rclPath, 'utf8');
const compiled = compileReality(rclSource);
const run = await runReality(compiled);
const state = run.state;

const sourceText = state['source.text'];
const rclTokens = state['stage1.tokens'].map(asStageToken);
const jsTokens = lexReality(sourceText).map(tokenCore);
const ast = state['stage1.ast'];

const expectedAst = [
  { path: 'world.value', valueType: 'Number', literalType: 'Number', literalValue: 7 },
  { path: 'world.flag', valueType: 'Truth', literalType: 'Truth', literalValue: true },
  { path: 'world.name', valueType: 'Text', literalType: 'Text', literalValue: 'Aster' },
];

const astSummary = ast.map(node => ({
  kind: node.kind,
  path: node.path,
  valueType: node.valueType,
  literalType: node.value?.valueType,
  literalValue: literalValue(node),
  span: node.span,
}));

const expectedTokenCount = Number(state['stage1.expected_token_count']);
const expectedAstCount = Number(state['stage1.expected_ast_count']);

const checks = {
  rclCompilesAndRuns: state['selfhost.stage_status'] === 'RCL_OWNED_FACET_SUBSET_VERIFIED',
  stageClaimHonest: state['gate.full_self_hosting'] === false && state['gate.js_runtime_still_required'] === true,
  tokenCountMatchesExpected: rclTokens.length === expectedTokenCount,
  tokenCountMatchesJs: rclTokens.length === jsTokens.length,
  tokenTypeTextPositionMatchesJs: sameJson(rclTokens, jsTokens),
  parseConsumedBeforeEof: Number(state['stage1.next']) === 24,
  astCountMatchesExpected: ast.length === expectedAstCount,
  astMatchesExpected: sameJson(
    astSummary.map(({ path, valueType, literalType, literalValue }) => ({ path, valueType, literalType, literalValue })),
    expectedAst,
  ),
  boundaryRecorded: state['selfhost.boundary'] === 'facet_declarations_only_js_runtime_still_hosts_execution',
};

const payload = {
  ok: Object.values(checks).every(Boolean),
  format: 'rcl.selfhost.stage1.verification.v1',
  rclFile: path.relative(root, rclPath).replaceAll(path.sep, '/'),
  stageStatus: state['selfhost.stage_status'],
  selfHostClaim: state['selfhost.claim'],
  checks,
  tokenComparison: {
    rclCount: rclTokens.length,
    jsCount: jsTokens.length,
    exactMatch: checks.tokenTypeTextPositionMatchesJs,
    firstFive: rclTokens.slice(0, 5),
    lastToken: rclTokens.at(-1),
  },
  astSummary,
  boundaries: {
    implementedNow: 'RCL source executes a recursive lexer and a three-facet parser subset on the existing JS runtime.',
    notYetImplemented: 'Full parser, semantic lowering, bytecode emission, runtime self-hosting, and native fixed-point execution remain outside this stage.',
    nextTarget: state['selfhost.next_rewrite_target'],
  },
  stateRoot: run.stateRoot,
  programRoot: run.programRoot,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(JSON.stringify(payload, null, 2));
