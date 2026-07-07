import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import {
  compileReality,
  materializeRclAbsorptionKernel,
  resolveRclCapabilityPolicy,
  createRclDeclaredDialectRegistry,
} from '../src/index.mjs';

const source = fs.readFileSync(new URL('../examples/rcl-native-absorption-kernel.rcl', import.meta.url), 'utf8');

test('RCL user can declare dialect, effects, policy and store entirely in .rcl', () => {
  const program = compileReality(source);
  assert.equal(program.name, 'RclUserOnlyAbsorption');
  assert.equal(program.dialects.length, 1);
  assert.equal(program.dialects[0].id, 'release');
  assert.equal(program.effectDeclarations.length, 2);
  assert.equal(program.capabilityPolicies.length, 1);
  assert.equal(program.stores.length, 1);
  assert.deepEqual(program.absorptionDirectives.map(item => item.kind), ['VerifyCapabilities', 'SnapshotStore']);
});

test('RCL-declared policy can be resolved into verifier policy without JS user code', () => {
  const resolved = resolveRclCapabilityPolicy(source);
  assert.equal(resolved.name, 'safe_release');
  assert.deepEqual(resolved.policy.allowedEffects, ['Warrant', 'Authority', 'AlterReality', 'Preserve', 'Evidence']);
  assert.deepEqual(resolved.policy.deniedEffects, ['HostCall']);
  assert.deepEqual(resolved.policy.capabilities, [{ capability: 'world.publish', target: 'world' }]);
  assert.equal(resolved.policy.budget.maxAlterations, 2);
  assert.equal(resolved.policy.requireDeterministicReplay, true);
});

test('RCL-declared dialect joins registry and lowers to machine', () => {
  const registry = createRclDeclaredDialectRegistry(source);
  assert.equal(registry.has('release'), true);
  assert.deepEqual(registry.lowerPath('release', 'machine'), ['release', 'machine']);
  assert.equal(registry.validateOperation('release', 'declare_release').effects[0], 'Evidence');
});

test('RCL absorb command materializes verification and content-addressed store from .rcl only', () => {
  const report = materializeRclAbsorptionKernel(source);
  assert.equal(report.verification.status, 'verified');
  assert.equal(report.policy, 'safe_release');
  assert.equal(report.branch, 'main');
  assert.equal(report.userSurface.dialectDeclarations, 1);
  assert.equal(report.userSurface.capabilityPolicies, 1);
  assert.match(report.commit, /^[0-9a-f]{64}$/);

  const cliOutput = execFileSync('node', ['src/cli.mjs', 'absorb', 'examples/rcl-native-absorption-kernel.rcl'], {
    cwd: new URL('..', import.meta.url), encoding: 'utf8'
  });
  const cliReport = JSON.parse(cliOutput);
  assert.equal(cliReport.root, report.root);
  assert.equal(cliReport.verification.status, 'verified');
});
