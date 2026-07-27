# RCL RNCS Visual Intent v0.1

`src/rncs-visual-intent.mjs` defines the canonical input contract for a
visual state runtime to consume RCL-owned animation intent. It is an input
contract, not a claim that RCL itself renders a frame.

The contract carries:

- source asset and optional scene identifiers;
- a single clip, deterministic animation layers, or an animation graph;
- override/additive blending and node masks;
- optional deterministic `look-at` and `two-bone-ik` animation constraints;
- an optional target deformation with one skin and up to four morph weights;
- a content root over the normalized payload.

`toRncsProposalInput()` accepts the contract through `options.visualIntent`.
It places the root in the intent, inputs, causal simulation references,
evidence graph, and `extensions.rcl.visual_intent`. This keeps the visual
request attached to RCL governance without turning it into a committed world
state change.

The RNCS VSR consumer is
`compileSpatialFrameFromVisualIntent(scene, intent, options)`. It verifies the
format and root, applies the requested deformation to a cloned scene, selects
the graph/layer/clip path, applies the declared look-at or two-bone IK constraints,
and seals the intent root into the frame plan. A
world authority or external provider still needs its own authorization and
receipt contract.

## Verification

```bash
node --test --test-concurrency=1 tests/rncs-visual-intent.test.mjs
```

The RCL contract does not claim native Foundation rendering or real hardware
GPU performance. Those are separate RNCS/runtime verification boundaries.
