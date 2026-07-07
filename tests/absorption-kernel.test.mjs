import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compileReality,
  runReality,
  createRealityDialectRegistry,
  analyzeProgramEffects,
  createEffectSignature,
  verifyProgramCapabilities,
  assertProgramCapabilities,
  RCLCapabilityError,
  createContentAddressedRealityStore,
  RCLRealityStoreError,
} from '../src/index.mjs';

const source = `
reality AbsorptionKernel {
  facet world.status : Text = "draft"
  facet world.score : Number = 0
  subject founder {
    warrant world.publish on world
  }
  emergence publish {
    cause founder
    when world.status == "draft"
    needs world.publish on world
    alter world.status <- "published"
    alter world.score <- world.score + 1
    preserve world.score >= 0
    witness "rcl:absorption-kernel:published"
  }
  foresee publish
  realize publish
}`;

test('Reality Dialect Registry exposes lowering paths from meaning to machine', () => {
  const registry = createRealityDialectRegistry();
  assert.equal(registry.has('subject'), true);
  assert.equal(registry.has('authority'), true);
  assert.equal(registry.has('machine'), true);
  assert.deepEqual(registry.lowerPath('subject', 'machine'), ['subject', 'authority', 'machine']);
  assert.equal(registry.validateOperation('authority', 'alter_reality').effects.includes('AlterReality'), true);
  const summary = registry.summary();
  assert.match(summary.root, /^[0-9a-f]{64}$/);
});

test('Effect / Authority Type System derives replayable effects from existing RCL IR', () => {
  const program = compileReality(source);
  const profile = analyzeProgramEffects(program);
  assert.equal(profile.program, 'AbsorptionKernel');
  assert.equal(profile.counts.Warrant, 1);
  assert.equal(profile.counts.Authority, 1);
  assert.equal(profile.counts.AlterReality, 2);
  assert.equal(profile.counts.Preserve, 1);
  assert.equal(profile.counts.Evidence, 1);
  assert.ok(profile.effects.every(effect => /^[0-9a-f]{64}$/.test(effect.root)));
  const signature = createEffectSignature(program);
  assert.equal(signature.effectRoots.length, profile.effects.length);
  assert.match(signature.root, /^[0-9a-f]{64}$/);
});

test('Capability Verifier accepts bounded authority and rejects nondeterministic host effects', () => {
  const report = assertProgramCapabilities(source, {
    capabilities: ['world.publish@world'],
    allowedEffects: ['Warrant', 'Authority', 'AlterReality', 'Preserve', 'Evidence'],
    budget: { maxAlterations: 2, maxHostCalls: 0, maxRules: 1 },
    requireDeterministicReplay: true,
  });
  assert.equal(report.status, 'verified');

  const hostSource = `
  reality HostBoundary {
    facet machine.receipt : Text = "none"
    subject builder { warrant computer.invoke on console }
    host console { offers emit -> Text }
    emergence publish {
      cause builder
      when true
      needs computer.invoke on console
      call console.emit("hello") -> machine.receipt
    }
    realize publish
  }`;

  assert.throws(() => assertProgramCapabilities(hostSource, {
    capabilities: ['computer.invoke@console'],
    deniedEffects: ['HostCall'],
    requireDeterministicReplay: true,
  }), RCLCapabilityError);

  const rejected = verifyProgramCapabilities(hostSource, {
    capabilities: ['computer.invoke@console'],
    deniedEffects: ['HostCall'],
    requireDeterministicReplay: true,
  });
  assert.equal(rejected.status, 'rejected');
  assert.ok(rejected.diagnostics.some(item => item.code === 'RCL_CAPABILITY_EFFECT_DENIED'));
  assert.ok(rejected.diagnostics.some(item => item.code === 'RCL_NONDETERMINISTIC_EFFECT'));
});

test('Content-Addressed Reality Store commits states, events and evidence with deterministic roots', async () => {
  const result = await runReality(source);
  const store = createContentAddressedRealityStore();
  const evidenceRoot = store.putEvidence({ witness: result.history[0].witnesses[0] });
  const eventRoot = store.putEvent({
    type: 'transition.realized',
    subject: result.history[0].actor,
    payload: result.history[0],
    evidence: [evidenceRoot],
  });
  const firstCommit = store.snapshotState(result.projections[0].projectedState, {
    message: 'foresee publish projection',
    events: [eventRoot],
    evidence: [evidenceRoot],
  });
  const secondCommit = store.snapshotState(result.state, {
    message: 'realize publish transition',
    parent: firstCommit,
    events: [eventRoot],
    evidence: [evidenceRoot],
  });
  store.createBranch('main', firstCommit);
  const update = store.updateBranch('main', secondCommit, { expected: firstCommit });
  assert.equal(update.previous, firstCommit);
  assert.equal(store.getBranch('main'), secondCommit);
  assert.equal(store.get(secondCommit).parents[0], firstCommit);
  assert.match(store.summary().root, /^[0-9a-f]{64}$/);
  assert.throws(() => store.updateBranch('main', firstCommit, { expected: 'bad-root' }), RCLRealityStoreError);
});
