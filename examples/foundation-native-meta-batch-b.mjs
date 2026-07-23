import fs from 'node:fs';
import {
  runFoundationNativeMetaBatchB,
} from '../src/foundation-native-meta-bridge.mjs';

const request = JSON.parse(fs.readFileSync(
  new URL('./foundation-native-meta-batch-b-request.json', import.meta.url),
  'utf8',
));
const result = runFoundationNativeMetaBatchB(request);

console.log(JSON.stringify({
  format: result.format,
  status: result.status,
  mode: result.mode,
  nativeVm: result.nativeVm,
  providerHost: result.providerHost,
  transitions: result.results.map(item => ({
    domain: item.domain,
    selectedAction: item.proposal.selectedAction,
    parameters: item.proposal.parameters,
    beforeRoot: item.stateDelta.beforeRoot,
    afterRoot: item.stateDelta.afterRoot,
  })),
  finalStateRoot: result.finalStateRoot,
  deterministicReceiptRoot: result.deterministicReceiptRoot,
  replayVerified: result.replayVerified,
  metrics: result.metrics,
}, null, 2));
