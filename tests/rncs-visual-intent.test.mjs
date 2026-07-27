import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRclRncsVisualIntent,
  rclRncsVisualIntentToSpatialOptions,
  toRncsProposalInput,
  verifyRclRncsVisualIntent,
} from '../src/index.mjs';

const visualInput = {
  sourceAssetId: 'asset:hero',
  sceneId: 'scene:hero',
  animationGraph: {
    graph: {
      initialState: 'idle',
      states: [
        { id: 'idle', clipId: 'clip:idle' },
        { id: 'run', clipId: 'clip:run', speed: 1.25, nodeIds: ['node:root'] },
      ],
    },
    stateId: 'run',
    timeSeconds: 0.5,
    transition: { fromStateId: 'idle', toStateId: 'run', progress: 0.75 },
  },
  animationConstraints: [{
    type: 'look-at',
    nodeId: 'node:root',
    target: [1, 0, 0],
    up: null,
    weight: 1,
  }],
  deformation: {
    nodeId: 'node:root',
    skinId: 'skin:hero',
    morphWeights: [0.25],
  },
};

test('RCL RNCS visual intent is normalized, rooted and convertible to VSR options', () => {
  const intent = createRclRncsVisualIntent(visualInput);
  assert.equal(verifyRclRncsVisualIntent(intent).ok, true);
  assert.equal(intent.animationGraph.graph.states[1].speed, 1.25);
  assert.deepEqual(rclRncsVisualIntentToSpatialOptions(intent), {
    animation: undefined,
    animationLayers: undefined,
    animationGraph: intent.animationGraph,
    animationConstraints: intent.animationConstraints,
    visualIntentRoot: intent.root,
  });
});

test('constraint-only visual intent is valid and deterministic', () => {
  const first = createRclRncsVisualIntent({
    sourceAssetId: 'asset:rig',
    sceneId: 'scene:rig',
    animationConstraints: [{
      type: 'two-bone-ik',
      rootNodeId: 'root',
      midNodeId: 'mid',
      endNodeId: 'end',
      target: [1, 1, 0],
      pole: [0, 0, 1],
    }],
  });
  const second = createRclRncsVisualIntent({
    sourceAssetId: 'asset:rig',
    sceneId: 'scene:rig',
    animationConstraints: [{
      type: 'two-bone-ik',
      rootNodeId: 'root',
      midNodeId: 'mid',
      endNodeId: 'end',
      target: [1, 1, 0],
      pole: [0, 0, 1],
    }],
  });
  assert.equal(verifyRclRncsVisualIntent(first).ok, true);
  assert.equal(first.root, second.root);
  assert.deepEqual(rclRncsVisualIntentToSpatialOptions(first).animationConstraints, first.animationConstraints);
});

test('visual intent input mutation changes its root and fails after tampering', () => {
  const intent = createRclRncsVisualIntent(visualInput);
  const changed = createRclRncsVisualIntent({
    ...visualInput,
    animationGraph: {
      ...visualInput.animationGraph,
      timeSeconds: 0.75,
    },
  });
  assert.notEqual(changed.root, intent.root);
  assert.equal(verifyRclRncsVisualIntent({ ...intent, root: changed.root }).ok, false);
});

test('RCL realized transitions carry visual intent into the RNCS proposal contract', () => {
  const program = {
    name: 'VisualIntentReality',
    programRoot: 'a'.repeat(64),
    languageVersion: '0.94.0-alpha.1',
  };
  const transition = {
    status: 'realized',
    actor: 'founder',
    rule: 'animate_hero',
    ruleKind: 'Transition',
    beforeRoot: 'b'.repeat(64),
    afterRoot: 'c'.repeat(64),
    from: 'idle',
    into: 'run',
    changes: [],
    witnesses: ['visual-intent-input'],
    hostCalls: [],
    authority: { needs: [], activeWarrants: [] },
  };
  const proposal = toRncsProposalInput(program, transition, { visualIntent: visualInput });
  const intent = proposal.extensions.rcl.visual_intent;
  assert.equal(proposal.intent.visual_intent_root, intent.root);
  assert.equal(proposal.inputs[1].root, intent.root);
  assert.ok(proposal.causal_basis.simulation_refs.includes(intent.root));
  assert.equal(proposal.evidence.edges[0].kind, 'visual-intent-input');
  assert.equal(verifyRclRncsVisualIntent(intent).ok, true);
});
