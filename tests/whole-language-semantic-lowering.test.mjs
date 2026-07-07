import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { bootstrapCompilerStage7, DEFAULT_WHOLE_LANGUAGE_SEMANTIC_TARGET_PATH } from '../src/index.mjs';

const expectedSemanticNodes = [
  'Subject:founder',
  'Warrant:founder:world.publish@world',
  'Warrant:founder:computer.invoke@console',
  'Rule:publish',
  'Cause:publish:founder',
  'Need:publish:world.publish@world',
  'Need:publish:computer.invoke@console',
  'Alter:publish:world.status',
  'Alter:publish:world.score',
  'Alter:publish:world.receipt',
  'HostCall:publish:console.emit->world.receipt',
  'Preserve:publish:world.score',
  'Foresee:publish',
  'Realize:publish',
];

const expectedLoweredIr = [
  'IR:Semantic:Subject:founder',
  'IR:AuthorityGrant:Warrant:founder:world.publish@world',
  'IR:AuthorityGrant:Warrant:founder:computer.invoke@console',
  'IR:Semantic:Rule:publish',
  'IR:Semantic:Cause:publish:founder',
  'IR:AuthorityCheck:Need:publish:world.publish@world',
  'IR:AuthorityCheck:Need:publish:computer.invoke@console',
  'IR:AlterStore:Alter:publish:world.status',
  'IR:AlterStore:Alter:publish:world.score',
  'IR:AlterStore:Alter:publish:world.receipt',
  'IR:ProviderCall:HostCall:publish:console.emit->world.receipt',
  'IR:PreserveCheck:Preserve:publish:world.score',
  'IR:ProjectionSchedule:Foresee:publish',
  'IR:CommitSchedule:Realize:publish',
];

test('Stage-7 absorbs core whole-language semantic descriptors and lowering descriptors', () => {
  const result = bootstrapCompilerStage7();
  assert.equal(result.stage, 'whole-language-semantic-lowering-absorption-v0.17');
  assert.equal(result.program, 'WholeLanguageSemanticTarget');
  assert.equal(result.deterministicSemantic, true);
  assert.equal(result.deterministicLowering, true);
  assert.deepEqual(result.semanticNodes, expectedSemanticNodes);
  assert.deepEqual(result.loweredIr, expectedLoweredIr);
  assert.equal(result.counts.warrant_semantic_count, 2);
  assert.equal(result.counts.need_semantic_count, 2);
  assert.equal(result.counts.alter_semantic_count, 3);
  assert.equal(result.counts.preserve_semantic_count, 1);
  assert.equal(result.counts.hostcall_semantic_count, 1);
  assert.match(result.root, /^[0-9a-f]{64}$/);
});

test('Stage-7 can absorb explicit whole-language semantic source text', () => {
  const source = fs.readFileSync(DEFAULT_WHOLE_LANGUAGE_SEMANTIC_TARGET_PATH, 'utf8');
  const result = bootstrapCompilerStage7({ source });
  assert.equal(result.program, 'WholeLanguageSemanticTarget');
  assert.equal(result.tokenCount > 200, true);
  assert.equal(result.semanticCount, 14);
  assert.equal(result.loweredIrCount, 14);
  assert.equal(result.compilerRun.state['compiler.semantic_lowering_supported'], true);
});

test('rcl bootstrap7 CLI reports deterministic semantic/lowering absorption', () => {
  const out = execFileSync('node', ['src/cli.mjs', 'bootstrap7'], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
  });
  const report = JSON.parse(out);
  assert.equal(report.stage, 'whole-language-semantic-lowering-absorption-v0.17');
  assert.equal(report.program, 'WholeLanguageSemanticTarget');
  assert.equal(report.semanticCount, 14);
  assert.equal(report.loweredIrCount, 14);
  assert.equal(report.deterministicSemantic, true);
  assert.equal(report.deterministicLowering, true);
  assert.ok(report.acceptedSemanticConstructs.includes('HostCall'));
  assert.ok(report.acceptedLoweringConstructs.includes('ProviderCall'));
});
