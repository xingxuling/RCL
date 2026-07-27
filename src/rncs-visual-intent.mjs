import { realityRoot } from './canonical.mjs';

export const RCL_RNCS_VISUAL_INTENT_FORMAT =
  'taowind.rcl-rncs-visual-intent.v0.1';
export const RCL_RNCS_VISUAL_INTENT_VERSION = '0.1.0';
export const RCL_RNCS_VISUAL_INTENT_BLEND_MODES = Object.freeze([
  'override',
  'additive',
]);

export function createRclRncsVisualIntent(input = {}) {
  const payload = {
    format: RCL_RNCS_VISUAL_INTENT_FORMAT,
    version: RCL_RNCS_VISUAL_INTENT_VERSION,
    ...normalizeRclRncsVisualIntent(input),
  };
  return Object.freeze({ ...payload, root: realityRoot(payload) });
}

export function normalizeRclRncsVisualIntent(input = {}) {
  assertObject(input, 'visual intent');
  const sourceAssetId = nonEmptyString(input.sourceAssetId, 'sourceAssetId');
  const sceneId = input.sceneId == null
    ? null
    : nonEmptyString(input.sceneId, 'sceneId');
  const nodeIds = input.nodeIds == null
    ? []
    : stringArray(input.nodeIds, 'nodeIds');
  const animation = input.animation == null
    ? null
    : normalizeAnimation(input.animation);
  const animationLayers = input.animationLayers == null
    ? null
    : normalizeAnimationLayers(input.animationLayers);
  const animationGraph = input.animationGraph == null
    ? null
    : normalizeAnimationGraph(input.animationGraph);
  const deformation = input.deformation == null
    ? null
    : normalizeDeformation(input.deformation);

  if (!animation && !animationLayers && !animationGraph) {
    throw new TypeError(
      'visual intent requires animation, animationLayers, or animationGraph',
    );
  }

  return {
    sourceAssetId,
    sceneId,
    nodeIds,
    animation,
    animationLayers,
    animationGraph,
    deformation,
  };
}

export function verifyRclRncsVisualIntent(intent) {
  if (!intent || typeof intent !== 'object' || Array.isArray(intent)) {
    return { ok: false, reason: 'visual intent must be an object' };
  }
  try {
    const normalized = normalizeRclRncsVisualIntent(intent);
    const payload = {
      format: RCL_RNCS_VISUAL_INTENT_FORMAT,
      version: RCL_RNCS_VISUAL_INTENT_VERSION,
      ...normalized,
    };
    const expectedRoot = realityRoot(payload);
    const checks = {
      format: intent.format === RCL_RNCS_VISUAL_INTENT_FORMAT,
      version: intent.version === RCL_RNCS_VISUAL_INTENT_VERSION,
      root: typeof intent.root === 'string' && intent.root === expectedRoot,
      sourceAsset: typeof intent.sourceAssetId === 'string',
      deterministicInputs: Boolean(
        normalized.animation
        || normalized.animationLayers
        || normalized.animationGraph,
      ),
    };
    return {
      ok: Object.values(checks).every(Boolean),
      checks,
      expectedRoot,
      actualRoot: intent.root ?? null,
    };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

export function rclRncsVisualIntentToSpatialOptions(intent) {
  const verification = verifyRclRncsVisualIntent(intent);
  if (!verification.ok) {
    throw new TypeError('cannot convert an invalid RCL RNCS visual intent');
  }
  return {
    animation: intent.animation ?? undefined,
    animationLayers: intent.animationLayers ?? undefined,
    animationGraph: intent.animationGraph ?? undefined,
    visualIntentRoot: intent.root,
  };
}

function normalizeAnimation(value) {
  assertObject(value, 'animation');
  return {
    clipId: nonEmptyString(value.clipId, 'animation.clipId'),
    timeSeconds: finiteNonNegative(value.timeSeconds, 'animation.timeSeconds'),
    loop: value.loop == null ? true : booleanValue(value.loop, 'animation.loop'),
  };
}

function normalizeAnimationLayers(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new TypeError('animationLayers must be a non-empty array');
  }
  return value.map((layer, index) => {
    assertObject(layer, `animationLayers[${index}]`);
    const mode = layer.mode ?? 'override';
    if (!RCL_RNCS_VISUAL_INTENT_BLEND_MODES.includes(mode)) {
      throw new RangeError(`animationLayers[${index}].mode is invalid`);
    }
    return {
      clipId: nonEmptyString(layer.clipId, `animationLayers[${index}].clipId`),
      timeSeconds: finiteNonNegative(
        layer.timeSeconds,
        `animationLayers[${index}].timeSeconds`,
      ),
      weight: boundedNumber(
        layer.weight ?? 1,
        0,
        1,
        `animationLayers[${index}].weight`,
      ),
      loop: layer.loop == null
        ? true
        : booleanValue(layer.loop, `animationLayers[${index}].loop`),
      mode,
      nodeIds: layer.nodeIds == null
        ? null
        : stringArray(layer.nodeIds, `animationLayers[${index}].nodeIds`),
    };
  });
}

function normalizeAnimationGraph(value) {
  assertObject(value, 'animationGraph');
  assertObject(value.graph, 'animationGraph.graph');
  const states = value.graph.states;
  if (!Array.isArray(states) || states.length === 0) {
    throw new TypeError('animationGraph.graph.states must be a non-empty array');
  }
  const normalizedStates = states.map((state, index) => {
    assertObject(state, `animationGraph.graph.states[${index}]`);
    return {
      id: nonEmptyString(state.id, `animationGraph.graph.states[${index}].id`),
      clipId: nonEmptyString(
        state.clipId,
        `animationGraph.graph.states[${index}].clipId`,
      ),
      speed: boundedNumber(
        state.speed ?? 1,
        0.000001,
        Number.POSITIVE_INFINITY,
        `animationGraph.graph.states[${index}].speed`,
      ),
      loop: state.loop == null
        ? true
        : booleanValue(state.loop, `animationGraph.graph.states[${index}].loop`),
      nodeIds: state.nodeIds == null
        ? null
        : stringArray(state.nodeIds, `animationGraph.graph.states[${index}].nodeIds`),
    };
  });
  const stateIds = new Set(normalizedStates.map(state => state.id));
  const initialState = nonEmptyString(
    value.graph.initialState,
    'animationGraph.graph.initialState',
  );
  if (!stateIds.has(initialState)) {
    throw new RangeError('animationGraph.graph.initialState must reference a state');
  }
  const stateId = value.stateId == null
    ? null
    : nonEmptyString(value.stateId, 'animationGraph.stateId');
  if (stateId && !stateIds.has(stateId)) {
    throw new RangeError('animationGraph.stateId must reference a state');
  }
  const transition = value.transition == null
    ? null
    : normalizeTransition(value.transition, stateIds);
  return {
    graph: {
      initialState,
      states: normalizedStates,
    },
    stateId,
    timeSeconds: finiteNonNegative(value.timeSeconds, 'animationGraph.timeSeconds'),
    transition,
  };
}

function normalizeTransition(value, stateIds) {
  assertObject(value, 'animationGraph.transition');
  const fromStateId = nonEmptyString(
    value.fromStateId,
    'animationGraph.transition.fromStateId',
  );
  const toStateId = nonEmptyString(
    value.toStateId,
    'animationGraph.transition.toStateId',
  );
  if (!stateIds.has(fromStateId) || !stateIds.has(toStateId)) {
    throw new RangeError('animationGraph.transition must reference known states');
  }
  return {
    fromStateId,
    toStateId,
    progress: boundedNumber(
      value.progress,
      0,
      1,
      'animationGraph.transition.progress',
    ),
  };
}

function normalizeDeformation(value) {
  assertObject(value, 'deformation');
  const nodeId = nonEmptyString(value.nodeId, 'deformation.nodeId');
  const skinId = value.skinId == null
    ? null
    : nonEmptyString(value.skinId, 'deformation.skinId');
  const morphWeights = value.morphWeights == null
    ? null
    : value.morphWeights.map((weight, index) => boundedNumber(
      weight,
      -1,
      1,
      `deformation.morphWeights[${index}]`,
    ));
  if (morphWeights && morphWeights.length > 4) {
    throw new RangeError('deformation.morphWeights supports at most four targets');
  }
  if (!skinId && !morphWeights) {
    throw new TypeError('deformation requires skinId or morphWeights');
  }
  return { nodeId, skinId, morphWeights };
}

function assertObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
}

function nonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${label} must be a non-empty string`);
  }
  return value;
}

function stringArray(value, label) {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array`);
  return value.map((item, index) => nonEmptyString(item, `${label}[${index}]`));
}

function booleanValue(value, label) {
  if (typeof value !== 'boolean') throw new TypeError(`${label} must be boolean`);
  return value;
}

function finiteNonNegative(value, label) {
  return boundedNumber(value, 0, Number.POSITIVE_INFINITY, label);
}

function boundedNumber(value, min, max, label) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${label} must be a finite number between ${min} and ${max}`);
  }
  return value;
}
