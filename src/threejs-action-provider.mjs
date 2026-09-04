import { realityRoot } from './canonical.mjs';

export const RCL_THREEJS_ACTION_PLAN_FORMAT = 'rcl.threejs-action-plan.v0.1';
export const RCL_THREEJS_ACTION_RECEIPT_FORMAT = 'rcl.threejs-action-receipt.v0.1';

export function planThreeJsActionProviderCall(providerCall) {
  assertProviderCall(providerCall);
  const input = providerCall.input;
  const payload = {
    format: RCL_THREEJS_ACTION_PLAN_FORMAT,
    source_action_root: providerCall.sourceActionRoot,
    bridge_evidence_root: providerCall.evidenceRoot,
    actor_node: input.actorNode,
    target_node: input.targetNode,
    operations: [
      {
        op: 'face-target',
        actor_node: input.actorNode,
        target_node: input.targetNode,
      },
      {
        op: 'root-motion-semantic',
        actor_node: input.actorNode,
        reference_frame: input.locomotion.reference_frame,
        direction: input.locomotion.direction,
        magnitude_milli: input.locomotion.magnitude_milli,
      },
      {
        op: 'animation-tags',
        actor_node: input.actorNode,
        tags: [...input.animationTags],
        timeline: input.timeline,
      },
      {
        op: 'competition-cue',
        actor_node: input.actorNode,
        target_node: input.targetNode,
        resolution_mode: input.resolution.mode,
        line_mode: input.line.mode,
        contact_mode: input.contact.mode,
      },
    ],
    preserves: [...input.constraints],
  };
  return Object.freeze({ ...payload, root: realityRoot(payload) });
}

export async function executeThreeJsActionPlan(plan, adapter) {
  verifyPlan(plan);
  if (!adapter || typeof adapter !== 'object') {
    throw new TypeError('Three.js action adapter must be an object');
  }
  const applied = [];
  for (const operation of plan.operations) {
    switch (operation.op) {
      case 'face-target':
        await requireFunction(adapter, 'faceTarget')(operation);
        break;
      case 'root-motion-semantic':
        await requireFunction(adapter, 'applyRootMotion')(operation);
        break;
      case 'animation-tags':
        await requireFunction(adapter, 'playAnimationTags')(operation);
        break;
      case 'competition-cue':
        await requireFunction(adapter, 'emitCompetitionCue')(operation);
        break;
      default:
        throw new RangeError(`unsupported Three.js action operation: ${operation.op}`);
    }
    applied.push(operation.op);
  }
  const payload = {
    format: RCL_THREEJS_ACTION_RECEIPT_FORMAT,
    plan_root: plan.root,
    source_action_root: plan.source_action_root,
    bridge_evidence_root: plan.bridge_evidence_root,
    applied,
    status: 'applied',
  };
  return Object.freeze({ ...payload, root: realityRoot(payload) });
}

export function verifyThreeJsActionReceipt(receipt, plan) {
  if (!receipt || typeof receipt !== 'object' || !plan || typeof plan !== 'object') {
    return { ok: false, reason: 'receipt and plan are required' };
  }
  const { root, ...payload } = receipt;
  const checks = {
    format: receipt.format === RCL_THREEJS_ACTION_RECEIPT_FORMAT,
    root: root === realityRoot(payload),
    plan: receipt.plan_root === plan.root,
    sourceAction: receipt.source_action_root === plan.source_action_root,
    evidence: receipt.bridge_evidence_root === plan.bridge_evidence_root,
    status: receipt.status === 'applied',
  };
  return { ok: Object.values(checks).every(Boolean), checks };
}

function assertProviderCall(call) {
  if (!call || typeof call !== 'object') throw new TypeError('provider call must be an object');
  if (call.host !== 'threejs' || call.capability !== 'threejs.applyActionIntent') {
    throw new TypeError('provider call is not a Three.js UGIS action intent');
  }
  if (!call.input || typeof call.input !== 'object') throw new TypeError('provider call input is required');
  if (!Array.isArray(call.input.constraints)) throw new TypeError('provider call constraints are required');
  for (const required of ['competition-resolution-only', 'no-anatomical-targeting', 'no-harm-optimization']) {
    if (!call.input.constraints.includes(required)) {
      throw new TypeError(`provider call missing required boundary: ${required}`);
    }
  }
}

function verifyPlan(plan) {
  if (!plan || typeof plan !== 'object') throw new TypeError('Three.js action plan must be an object');
  const { root, ...payload } = plan;
  if (plan.format !== RCL_THREEJS_ACTION_PLAN_FORMAT || root !== realityRoot(payload)) {
    throw new TypeError('invalid Three.js action plan');
  }
}

function requireFunction(adapter, name) {
  if (typeof adapter[name] !== 'function') {
    throw new TypeError(`Three.js action adapter requires ${name}()`);
  }
  return adapter[name].bind(adapter);
}
