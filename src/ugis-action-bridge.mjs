import { realityRoot } from './canonical.mjs';

export const UGIS_ACTION_IR_FORMAT = 'ugis.action-ir.v0.1';
export const UGIS_ACTION_IR_VERSION = '0.1.0';
export const RCL_UGIS_ACTION_BRIDGE_FORMAT = 'rcl.ugis-action-bridge.v0.1';
export const RCL_UGIS_ACTION_BRIDGE_VERSION = '0.1.0';

const REQUIRED_SAFE_CONSTRAINTS = Object.freeze([
  'competition-resolution-only',
  'no-anatomical-targeting',
  'no-harm-optimization',
]);

export function verifyUgisActionIr(action) {
  if (!action || typeof action !== 'object' || Array.isArray(action)) {
    return { ok: false, reason: 'UGIS Action IR must be an object' };
  }
  try {
    const payload = actionPayloadWithoutRoot(action);
    const expectedRoot = realityRoot(payload);
    const constraints = Array.isArray(action.constraints) ? action.constraints : [];
    const phases = action.timeline?.phases;
    const checks = {
      format: action.format === UGIS_ACTION_IR_FORMAT,
      version: action.version === UGIS_ACTION_IR_VERSION,
      root: typeof action.root === 'string' && action.root === expectedRoot,
      actor: nonEmpty(action.subjects?.actor),
      opponent: nonEmpty(action.subjects?.opponent),
      route: nonEmpty(action.source?.route_id),
      fixedPointMagnitude: Number.isInteger(action.intent?.locomotion?.magnitude_milli),
      fixedPointTimeline: Array.isArray(phases)
        && phases.length > 0
        && phases.every(phase => Number.isInteger(phase.start_milli) && Number.isInteger(phase.end_milli)),
      competitionOnly: action.intent?.resolution?.competition_only === true,
      safeConstraints: REQUIRED_SAFE_CONSTRAINTS.every(item => constraints.includes(item)),
    };
    return {
      ok: Object.values(checks).every(Boolean),
      checks,
      expectedRoot,
      actualRoot: action.root ?? null,
    };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

export function createRclUgisActionBridge(action, options = {}) {
  const verification = verifyUgisActionIr(action);
  if (!verification.ok) {
    throw new TypeError(`cannot bridge invalid UGIS Action IR: ${verification.reason ?? 'verification failed'}`);
  }
  const host = nonEmpty(options.host ?? 'threejs', 'host');
  const actorNode = nonEmpty(options.actorNode ?? action.subjects.actor, 'actorNode');
  const targetNode = nonEmpty(options.targetNode ?? action.subjects.opponent, 'targetNode');
  const capability = `${host}.applyActionIntent`;
  const providerInput = createProviderInput(action, { actorNode, targetNode });
  const payload = {
    format: RCL_UGIS_ACTION_BRIDGE_FORMAT,
    version: RCL_UGIS_ACTION_BRIDGE_VERSION,
    semantic_owner: 'UGIS',
    rcl_role: 'reality-transition-provider-envelope',
    source_action_root: action.root,
    subject: action.subjects.actor,
    opponent: action.subjects.opponent,
    authority: {
      subject: action.subjects.actor,
      capability,
      target: actorNode,
    },
    preserves: [...action.constraints],
    host_call: {
      host,
      operation: 'applyActionIntent',
      capability,
      target: actorNode,
      input: providerInput,
    },
    evidence: [
      { kind: 'ugis-action-root', reference: action.root, required: true },
    ],
  };
  return Object.freeze({ ...payload, root: realityRoot(payload) });
}

export function verifyRclUgisActionBridge(bridge) {
  if (!bridge || typeof bridge !== 'object' || Array.isArray(bridge)) {
    return { ok: false, reason: 'RCL UGIS action bridge must be an object' };
  }
  try {
    const { root, ...payload } = bridge;
    const expectedRoot = realityRoot(payload);
    const checks = {
      format: bridge.format === RCL_UGIS_ACTION_BRIDGE_FORMAT,
      version: bridge.version === RCL_UGIS_ACTION_BRIDGE_VERSION,
      root: root === expectedRoot,
      semanticOwner: bridge.semantic_owner === 'UGIS',
      role: bridge.rcl_role === 'reality-transition-provider-envelope',
      sourceRoot: nonEmpty(bridge.source_action_root),
      evidenceLink: Array.isArray(bridge.evidence)
        && bridge.evidence.some(node => node.reference === bridge.source_action_root),
      hostCall: nonEmpty(bridge.host_call?.capability),
    };
    return { ok: Object.values(checks).every(Boolean), checks, expectedRoot, actualRoot: root ?? null };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

export function rclUgisActionBridgeToProviderCall(bridge) {
  const verification = verifyRclUgisActionBridge(bridge);
  if (!verification.ok) {
    throw new TypeError('cannot lower invalid RCL UGIS action bridge');
  }
  return Object.freeze({
    host: bridge.host_call.host,
    operation: bridge.host_call.operation,
    capability: bridge.host_call.capability,
    target: bridge.host_call.target,
    input: bridge.host_call.input,
    evidenceRoot: bridge.root,
    sourceActionRoot: bridge.source_action_root,
  });
}

function createProviderInput(action, { actorNode, targetNode }) {
  return {
    actionRoot: action.root,
    actorNode,
    targetNode,
    facing: action.intent.facing,
    locomotion: action.intent.locomotion,
    measure: action.intent.measure,
    line: action.intent.line,
    contact: action.intent.contact,
    resolution: action.intent.resolution,
    timeline: action.timeline,
    animationTags: [...(action.provider_hints?.animation_tags ?? [])],
    rootMotionPolicy: action.provider_hints?.root_motion_policy ?? null,
    constraints: [...action.constraints],
  };
}

function actionPayloadWithoutRoot(action) {
  const { root: _root, ...payload } = action;
  return payload;
}

function nonEmpty(value, label = 'value') {
  if (typeof value !== 'string' || value.length === 0) {
    if (label === 'value') return false;
    throw new TypeError(`${label} must be a non-empty string`);
  }
  return value;
}
