import fs from 'node:fs';
import { runFoundationNativeBatchA } from '../src/foundation-native-bridge.mjs';

const request = JSON.parse(fs.readFileSync(
  new URL('./foundation-native-batch-a-request.json', import.meta.url),
  'utf8',
));
const result = runFoundationNativeBatchA(request);

console.log(JSON.stringify({
  format: result.format,
  status: result.status,
  mode: result.mode,
  nativeVm: result.nativeVm,
  providerHost: result.providerHost,
  domains: result.results.map(item => item.domain),
  finalCandidate: result.finalCandidate,
  finalStateRoot: result.finalStateRoot,
  deterministicReceiptRoot: result.deterministicReceiptRoot,
  replayVerified: result.replayVerified,
  metrics: result.metrics,
}, null, 2));
