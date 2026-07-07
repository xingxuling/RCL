import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { bootstrapCompilerStage6, DEFAULT_WHOLE_LANGUAGE_PARSER_TARGET_PATH } from '../src/index.mjs';

const expectedCounts = {
  declaration_count: 15,
  facet_count: 2,
  subject_count: 1,
  reckon_count: 1,
  host_count: 1,
  dialect_count: 1,
  effect_count: 2,
  capability_policy_count: 1,
  store_count: 1,
  emergence_count: 1,
  foresee_count: 1,
  realize_count: 1,
  verify_count: 1,
  snapshot_count: 1,
};

test('Stage-6 RCL parser absorbs the complete current top-level RCL surface', () => {
  const result = bootstrapCompilerStage6();
  assert.equal(result.stage, 'whole-language-parser-absorption-v0.16');
  assert.equal(result.program, 'WholeLanguageParserTarget');
  assert.equal(result.scope, 'parser absorption for full current RCL top-level surface');
  assert.equal(result.deterministicParse, true);
  assert.deepEqual(result.counts, expectedCounts);
  assert.deepEqual(result.declarations, [
    'Dialect:release',
    'Effect:AlterReality',
    'Effect:HostCall',
    'CapabilityPolicy:safe_release',
    'Store:absorption_reality',
    'Facet:world',
    'Facet:world',
    'Reckon:ready',
    'Host:console',
    'Subject:founder',
    'Emergence:publish',
    'Foresee:publish',
    'Realize:publish',
    'Verify:safe_release',
    'Snapshot:absorption_reality',
  ]);
  assert.match(result.root, /^[0-9a-f]{64}$/);
});

test('Stage-6 parser can parse the whole-language target from explicit source text', () => {
  const source = fs.readFileSync(DEFAULT_WHOLE_LANGUAGE_PARSER_TARGET_PATH, 'utf8');
  const result = bootstrapCompilerStage6({ source });
  assert.equal(result.program, 'WholeLanguageParserTarget');
  assert.equal(result.tokenCount > 100, true);
  assert.equal(result.declarationCount, 15);
  assert.equal(result.compilerRun.state['compiler.whole_parser_supported'], true);
});

test('rcl bootstrap6 CLI reports deterministic whole-language parser absorption', () => {
  const out = execFileSync('node', ['src/cli.mjs', 'bootstrap6'], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
  });
  const report = JSON.parse(out);
  assert.equal(report.stage, 'whole-language-parser-absorption-v0.16');
  assert.equal(report.program, 'WholeLanguageParserTarget');
  assert.equal(report.declarationCount, 15);
  assert.deepEqual(report.counts, expectedCounts);
  assert.equal(report.deterministicParse, true);
  assert.ok(report.acceptedConstructs.includes('CapabilityPolicy'));
  assert.ok(report.acceptedConstructs.includes('Emergence'));
});
