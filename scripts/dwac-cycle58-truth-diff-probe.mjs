#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  reconcileFoundationConformanceTruth,
} from '../src/foundation-conformance-truth.mjs';
import {
  FOUNDATION_DIRECT_IMPLEMENTATION_DOMAINS,
  foundationDirectCapabilityRegistrySnapshot,
} from '../src/foundation-direct-capability-registry.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const truthPath = path.join(ROOT, 'foundation-conformance-truth.json');
const reportPath = path.join(ROOT, 'foundation-conformance.json');
const committed = JSON.parse(await fs.readFile(truthPath, 'utf8'));
await import('./foundation-conformance-base.mjs');
const baseReport = JSON.parse(await fs.readFile(reportPath, 'utf8'));
const generated = reconcileFoundationConformanceTruth(baseReport, {}, {
  implementationDomains: [...FOUNDATION_DIRECT_IMPLEMENTATION_DOMAINS].sort(),
  requiredDirectDomains: [...FOUNDATION_DIRECT_IMPLEMENTATION_DOMAINS].sort(),
  requireDeploymentEvidence: false,
}).canonicalExecutionTruth;

const checks = [
  [60, 'format', committed.format, generated.format],
  [61, 'version', committed.version, generated.version],
  [62, 'status', committed.status, generated.status],
  [63, 'nativeVmMode', committed.nativeVmMode, generated.nativeVmMode],
  [64, 'implementationDomains', committed.implementationDomains, generated.implementationDomains],
  [65, 'verifiedDirectDomains', committed.verifiedDirectDomains, generated.verifiedDirectDomains],
  [66, 'verifiedParityDomains', committed.verifiedParityDomains, generated.verifiedParityDomains],
  [67, 'verifiedExtensionDomains', committed.verifiedExtensionDomains, generated.verifiedExtensionDomains],
  [68, 'verifiedBridgeDomains', committed.verifiedBridgeDomains, generated.verifiedBridgeDomains],
  [69, 'deploymentEvidenceComplete', committed.deploymentEvidenceComplete, generated.deploymentEvidenceComplete],
  [70, 'canonicalVmBinarySha256', committed.canonicalVmBinarySha256, generated.canonicalVmBinarySha256],
  [71, 'canonicalVmSourceRoot', committed.canonicalVmSourceRoot, generated.canonicalVmSourceRoot],
  [72, 'executionAttestationRoot', committed.executionAttestationRoot, generated.executionAttestationRoot],
  [73, 'truthBoundary', committed.truthBoundary, generated.truthBoundary],
  [74, 'truthRoot', committed.truthRoot, generated.truthRoot],
];
for (const [code, field, left, right] of checks) {
  if (JSON.stringify(left) !== JSON.stringify(right)) {
    console.error(JSON.stringify({ status: 'DWAC_CYCLE58_TRUTH_DIFF', field, committed: left, generated: right }, null, 2));
    process.exit(code);
  }
}
if (JSON.stringify(committed) !== JSON.stringify(generated)) {
  process.exit(75);
}
console.log(JSON.stringify({
  ok: true,
  status: 'DWAC_CYCLE58_TRUTH_DIFF_NONE',
  truthRoot: generated.truthRoot,
  capabilityRegistryRoot: foundationDirectCapabilityRegistrySnapshot().registryRoot,
}, null, 2));
