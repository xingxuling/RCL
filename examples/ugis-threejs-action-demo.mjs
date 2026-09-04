import { readFile } from 'node:fs/promises';

import {
  createRclUgisActionBridge,
  rclUgisActionBridgeToProviderCall,
} from '../src/ugis-action-bridge.mjs';
import {
  executeThreeJsActionPlan,
  planThreeJsActionProviderCall,
  verifyThreeJsActionReceipt,
} from '../src/threejs-action-provider.mjs';

const action = JSON.parse(await readFile(
  new URL('../tests/fixtures/ugis-action-ir-hold-measure.json', import.meta.url),
  'utf8',
));

const bridge = createRclUgisActionBridge(action, {
  actorNode: 'scene:fighter-a',
  targetNode: 'scene:fighter-b',
});
const providerCall = rclUgisActionBridgeToProviderCall(bridge);
const plan = planThreeJsActionProviderCall(providerCall);

const events = [];
const adapter = {
  async faceTarget(op) {
    events.push({ kind: op.op, actor: op.actor_node, target: op.target_node });
  },
  async applyRootMotion(op) {
    events.push({
      kind: op.op,
      direction: op.direction,
      magnitude_milli: op.magnitude_milli,
      reference_frame: op.reference_frame,
    });
  },
  async playAnimationTags(op) {
    events.push({ kind: op.op, tags: op.tags, timeline: op.timeline });
  },
  async emitCompetitionCue(op) {
    events.push({
      kind: op.op,
      resolution_mode: op.resolution_mode,
      line_mode: op.line_mode,
      contact_mode: op.contact_mode,
    });
  },
};

const receipt = await executeThreeJsActionPlan(plan, adapter);
console.log(JSON.stringify({
  action_root: action.root,
  bridge_root: bridge.root,
  plan_root: plan.root,
  receipt_root: receipt.root,
  receipt_ok: verifyThreeJsActionReceipt(receipt, plan).ok,
  events,
}, null, 2));
