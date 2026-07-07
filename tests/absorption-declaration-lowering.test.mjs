import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { bootstrapCompilerStage8, DEFAULT_ABSORPTION_LOWERING_TARGET_PATH } from '../src/index.mjs';

const expectedAbsorptionNodes = [
  'Dialect:release',
  'Effect:AlterReality',
  'Effect:HostCall',
  'Policy:safe_release',
  'PolicyAllowEffect:Warrant',
  'PolicyDenyEffect:HostCall',
  'PolicyAllow:world.publish@world',
  'PolicyAllow:computer.invoke@console',
  'PolicyBudget:max_alterations=3',
  'PolicyBudget:max_host_calls=1',
  'PolicyBudget:max_rules=1',
  'ReplayRequirement:false',
  'Store:absorption_reality',
  'StoreBranch:main',
  'StoreCommit:absorption declarations materialized',
  'Verify:safe_release',
  'Snapshot:absorption_reality',
];

const expectedAbsorptionLoweredIr = [
  'IR:DialectRegister:Dialect:release',
  'IR:EffectDeclare:Effect:AlterReality',
  'IR:EffectDeclare:Effect:HostCall',
  'IR:CapabilityPolicy:Policy:safe_release',
  'IR:VerifierAllowEffect:PolicyAllowEffect:Warrant',
  'IR:VerifierDenyEffect:PolicyDenyEffect:HostCall',
  'IR:VerifierCapability:PolicyAllow:world.publish@world',
  'IR:VerifierCapability:PolicyAllow:computer.invoke@console',
  'IR:VerifierBudget:PolicyBudget:max_alterations=3',
  'IR:VerifierBudget:PolicyBudget:max_host_calls=1',
  'IR:VerifierBudget:PolicyBudget:max_rules=1',
  'IR:VerifierReplayRequirement:ReplayRequirement:false',
  'IR:StoreDeclare:Store:absorption_reality',
  'IR:StoreBranch:StoreBranch:main',
  'IR:StoreCommitMessage:StoreCommit:absorption declarations materialized',
  'IR:VerifierRun:Verify:safe_release',
  'IR:StoreSnapshot:Snapshot:absorption_reality',
];

test('Stage-8 absorbs absorption declaration descriptors and lowering descriptors', () => {
  const result = bootstrapCompilerStage8();
  assert.equal(result.stage, 'absorption-declaration-lowering-v0.18');
  assert.equal(result.program, 'AbsorptionDeclarationLoweringTarget');
  assert.equal(result.deterministicAbsorption, true);
  assert.equal(result.deterministicAbsorptionLowering, true);
  assert.deepEqual(result.absorptionNodes, expectedAbsorptionNodes);
  assert.deepEqual(result.absorptionLoweredIr, expectedAbsorptionLoweredIr);
  assert.equal(result.counts.dialect_lowering_count, 1);
  assert.equal(result.counts.effect_lowering_count, 2);
  assert.equal(result.counts.policy_capability_lowering_count, 2);
  assert.equal(result.counts.policy_budget_lowering_count, 3);
  assert.equal(result.counts.verify_lowering_count, 1);
  assert.equal(result.counts.snapshot_lowering_count, 1);
  assert.match(result.root, /^[0-9a-f]{64}$/);
});

test('Stage-8 can absorb explicit absorption declaration source text', () => {
  const source = fs.readFileSync(DEFAULT_ABSORPTION_LOWERING_TARGET_PATH, 'utf8');
  const result = bootstrapCompilerStage8({ source });
  assert.equal(result.program, 'AbsorptionDeclarationLoweringTarget');
  assert.equal(result.absorptionCount, 17);
  assert.equal(result.absorptionLoweredIrCount, 17);
  assert.equal(result.compilerRun.state['compiler.absorption_lowering_supported'], true);
  assert.ok(result.acceptedAbsorptionConstructs.includes('PolicyAllow'));
  assert.ok(result.acceptedAbsorptionLoweringConstructs.includes('VerifierRun'));
});

test('rcl bootstrap8 CLI reports deterministic absorption declaration lowering', () => {
  const out = execFileSync('node', ['src/cli.mjs', 'bootstrap8'], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
  });
  const report = JSON.parse(out);
  assert.equal(report.stage, 'absorption-declaration-lowering-v0.18');
  assert.equal(report.program, 'AbsorptionDeclarationLoweringTarget');
  assert.equal(report.absorptionCount, 17);
  assert.equal(report.absorptionLoweredIrCount, 17);
  assert.equal(report.deterministicAbsorption, true);
  assert.equal(report.deterministicAbsorptionLowering, true);
  assert.ok(report.acceptedAbsorptionConstructs.includes('Snapshot'));
  assert.ok(report.acceptedAbsorptionLoweringConstructs.includes('StoreSnapshot'));
});
