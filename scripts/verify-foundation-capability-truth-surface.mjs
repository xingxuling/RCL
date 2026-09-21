#!/usr/bin/env node
import {
  foundationCapabilityTruthSurface,
  readFoundationCapabilityTruthSnapshot,
} from '../src/foundation-capability-truth-surface.mjs';

function fail(message, details = {}) {
  console.error(JSON.stringify({ ok: false, status: 'RCL_FOUNDATION_CAPABILITY_TRUTH_SURFACE_VERIFICATION_FAILED', message, ...details }, null, 2));
  process.exit(1);
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }

const surface = foundationCapabilityTruthSurface();
if (surface.ok !== true) fail('Canonical runtime capability truth surface did not verify.', { surface });
if (!/^[0-9a-f]{64}$/i.test(surface.truthRoot ?? '')) fail('Runtime capability truth surface does not expose a content-addressed truth root.', { surface });
if (surface.truthRoot !== surface.recomputedTruthRoot) fail('Runtime capability truth root is not self-consistent.', { surface });
if (surface.direct.domainCount !== 8) fail('Runtime direct capability domain count drifted.', { direct: surface.direct });
if (surface.providerBridge.domainCount !== 16 || surface.providerBridge.batchCount !== 5) fail('Runtime Provider bridge topology drifted.', { providerBridge: surface.providerBridge });
if (
  surface.truthBoundary.directImplementationDoesNotImplyDeploymentVerification !== true
  || surface.truthBoundary.providerBridgeDoesNotImplyDirectNativeExecution !== true
  || surface.truthBoundary.allFoundationDomainsDirectNativeClaimed !== false
) fail('Runtime capability truth surface overclaimed execution guarantees.', { truthBoundary: surface.truthBoundary });

const truth = readFoundationCapabilityTruthSnapshot();
const negativeControls = [];
for (const mutation of [
  { id: 'truth-root-mutation', apply(value) { value.truthRoot = '0'.repeat(64); } },
  { id: 'direct-registry-root-mutation', apply(value) { value.direct.registryRoot = '1'.repeat(64); } },
  { id: 'provider-bridge-domain-mutation', apply(value) { value.providerBridge.domains = [...value.providerBridge.domains, 'phantom-domain']; } },
  { id: 'all-domain-native-overclaim', apply(value) { value.truthBoundary.allFoundationDomainsDirectNativeClaimed = true; } },
]) {
  const mutated = clone(truth);
  mutation.apply(mutated);
  const mutatedSurface = foundationCapabilityTruthSurface({ truthOverride: mutated });
  const detected = mutatedSurface.ok === false && mutatedSurface.errors.length > 0;
  negativeControls.push({ id: mutation.id, detected, errorCodes: mutatedSurface.errors.map(error => error.code) });
  if (!detected) fail(`Negative control ${mutation.id} was not detected.`, { mutatedSurface });
}

console.log(JSON.stringify({
  ok: true,
  status: 'RCL_FOUNDATION_CAPABILITY_TRUTH_SURFACE_VERIFIED',
  truthRoot: surface.truthRoot,
  directRegistryRoot: surface.direct.registryRoot,
  directDomainCount: surface.direct.domainCount,
  providerBridgeRegistryRoot: surface.providerBridge.registryRoot,
  providerBridgeDomainCount: surface.providerBridge.domainCount,
  providerBatchCount: surface.providerBridge.batchCount,
  negativeControls,
}, null, 2));
