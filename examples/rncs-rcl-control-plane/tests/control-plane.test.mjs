import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildRclControlPlane,
  compileControlPlaneEdge,
  CONTROL_PLANE_EDGES,
  verifyLegacyManifestParity,
  replayCompiledControlPlane,
  compileRuntimeBundle,
  replayRuntimeBundle,
  createEmbeddedRuntimeBundle,
} from '../src/index.mjs';

const packageRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const repoRoot = path.resolve(packageRoot, '../../..');

test('RCL-native RNCS control plane compiles twelve semantic modules through eleven verified edges', () => {
  const result = buildRclControlPlane();
  assert.equal(Object.keys(result.modules).length, 12);
  assert.equal(result.edges.length, 11);
  assert.equal(result.allReady, true);
  assert.equal(result.allDeterministic, true);
  assert.equal(result.allReferenceParity, true);
  assert.equal(result.modules.core.id, 'rncs-core');
  assert.equal(result.modules.cnp.id, 'cnp');
  assert.equal(result.modules.laf.id, 'laf');
  assert.equal(result.modules.hnac.id, '@taowind/hnaf-hnac-host');
  assert.equal(result.modules.gateway.id, 'gateway');
  assert.equal(result.modules.aether_earth.id, 'aether-earth-runtime');
});

test('each RCL control-plane edge is exact Stage-5 RBC and executes in native VM', () => {
  for (const [from, to] of CONTROL_PLANE_EDGES) {
    const edge = compileControlPlaneEdge(from, to);
    assert.equal(edge.deterministic, true);
    assert.equal(edge.referenceParity, true);
    assert.equal(edge.moduleState[`${to}::module.ready`], true);
    assert.match(edge.compilerVm, /0\.6\.0-alpha\.1/);
  }
});

test('RCL module ids and versions preserve parity with existing RNCS manifests', () => {
  const result = verifyLegacyManifestParity(repoRoot);
  assert.equal(result.passed, true, JSON.stringify(result.checks, null, 2));
});

test('compiled RCL control-plane edges replay without the compiler and preserve state', () => {
  const result = buildRclControlPlane();
  const replay = replayCompiledControlPlane(result.compiledEdges);
  assert.equal(replay.edgeCount, 11);
  assert.equal(replay.finalState['cnp::module.ready'], true);
  assert.equal(replay.finalState['core::contract.evidence'], true);
});

test('RCL control-plane state root is deterministic', () => {
  const first = buildRclControlPlane();
  const second = buildRclControlPlane();
  assert.equal(first.stateRoot, second.stateRoot);
  assert.deepEqual(first.edges, second.edges);
});


test('AOT RCL control-plane bundle executes all twelve readiness contracts in one native VM process', () => {
  const bundle = compileRuntimeBundle();
  assert.equal(bundle.deterministic, true);
  assert.equal(bundle.referenceParity, true);
  const run = replayRuntimeBundle(bundle);
  assert.equal(run.state['rncs::core.ready'], true);
  assert.equal(run.state['rncs::rfe.ready'], true);
  assert.equal(run.state['rncs::aaf.ready'], true);
  assert.equal(run.state['rncs::branch.ready'], true);
  assert.equal(run.state['rncs::behavior.ready'], true);
  assert.equal(run.state['rncs::icar.ready'], true);
  assert.equal(run.state['rncs::cnp.ready'], true);
  assert.equal(run.state['rncs::laf.ready'], true);
  assert.equal(run.state['rncs::hnac.ready'], true);
  assert.equal(run.state['rncs::runtime_registry.ready'], true);
  assert.equal(run.state['rncs::gateway.ready'], true);
  assert.equal(run.state['rncs::aether_earth.ready'], true);
  assert.equal(run.state['rncs::control.long_lived_vm'], true);
  assert.equal(run.state['rncs::control.authoritative'], true);
});


test('embedded AOT control plane reuses one long-lived native VM process', async () => {
  const bundle = compileRuntimeBundle();
  const vm = createEmbeddedRuntimeBundle(bundle);
  await vm.ready;
  const pid = vm.process.pid;
  const first = await vm.run({ resetState: true });
  const second = await vm.run();
  assert.equal(vm.process.pid, pid);
  assert.equal(first.result.state['rncs::gateway.ready'], true);
  assert.equal(second.result.state['rncs::control.provider_abi'], true);
  assert.ok(second.daemonElapsedMs < 10);
  await vm.close();
});
