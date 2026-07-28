import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRclRncsRuntimeBinding,
  toRncsProposalInput,
  verifyRclRncsRuntimeBinding,
} from '../src/index.mjs';
import { realityRoot } from '../src/canonical.mjs';

function runtimeBinding() {
  const payload = {
    format: 'rncs.authority-presentation-binding.v0.1',
    version: '0.1.0',
    worldId: 'world:rcl-runtime-binding',
    tick: 12,
    stepHz: 60,
    stateRoot: 'fnv1a64:state-12',
    previousStateRoot: 'fnv1a64:state-11',
    authorityFrame: {
      format: 'rsr.authoritative-state-frame.v0.7',
      protocol: 'rsr.authoritative-state.v0.7',
      frameRoot: 'fnv1a64:frame-12',
      sourceStateRoot: 'fnv1a64:state-12',
      previousStateRoot: 'fnv1a64:state-11',
      objectIds: ['avatar'],
      bodyRoots: ['fnv1a64:body-avatar-12'],
    },
    temporalPacket: {
      format: 'vsr.temporal-state-packet.v0.6',
      protocol: 'vsr.temporal-presentation.v0.6',
      packetRoot: 'sha256:packet-12',
      sourceStateRoot: 'fnv1a64:state-12',
      sourcePacketRoot: 'fnv1a64:frame-12',
      objectIds: ['avatar'],
      authorityBodyRoots: ['fnv1a64:body-avatar-12'],
    },
  };
  return { ...payload, bindingRoot: realityRoot(payload) };
}

test('RCL accepts the RNCS authority-presentation binding and preserves its roots', () => {
  const binding = createRclRncsRuntimeBinding(runtimeBinding());
  assert.equal(verifyRclRncsRuntimeBinding(binding).ok, true);
  assert.equal(binding.authorityFrame.sourceStateRoot, binding.stateRoot);
  assert.equal(binding.temporalPacket.sourcePacketRoot, binding.authorityFrame.frameRoot);
});

test('RCL runtime binding becomes a rooted proposal input and evidence edge', () => {
  const transition = {
    status: 'realized',
    actor: 'founder',
    rule: 'advance_spatial_candidate',
    ruleKind: 'Transition',
    beforeRoot: 'b'.repeat(64),
    afterRoot: 'c'.repeat(64),
    from: 'idle',
    into: 'running',
    changes: [],
    witnesses: ['rsr-vsr-binding'],
    authority: { needs: [], activeWarrants: [] },
  };
  const proposal = toRncsProposalInput({
    name: 'RuntimeBindingReality',
    programRoot: 'a'.repeat(64),
    languageVersion: '0.94.0-alpha.1',
  }, transition, { runtimeBinding: runtimeBinding() });
  const binding = proposal.extensions.rcl.runtime_binding;
  assert.equal(binding.bindingRoot, proposal.intent.runtime_binding_root);
  assert.equal(proposal.inputs.at(-1).kind, 'rncs-authority-presentation-binding');
  assert.equal(proposal.inputs.at(-1).root, binding.bindingRoot);
  assert.ok(proposal.causal_basis.simulation_refs.includes(binding.bindingRoot));
  assert.equal(proposal.evidence.edges.at(-1).kind, 'rncs-authority-presentation-binding');
});

test('RCL rejects a runtime binding with a forged temporal source root', () => {
  const forged = runtimeBinding();
  forged.temporalPacket.sourceStateRoot = 'fnv1a64:forged';
  forged.bindingRoot = realityRoot({ ...forged, temporalPacket: forged.temporalPacket });
  assert.equal(verifyRclRncsRuntimeBinding(forged).ok, false);
});
