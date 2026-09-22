#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyFoundationDirectNativeParity } from '../src/foundation-direct-native-parity.mjs';
import { verifyFoundationCrossDomainHistoryRootParity } from '../src/foundation-cross-domain-history-root-parity.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const nativeDir = path.join(root, 'native');
const target = path.join(nativeDir, process.platform === 'win32' ? 'rclvm.exe' : 'rclvm');
const manifestPath = path.join(nativeDir, 'rclvm.vercel-attestation.json');
const publicDir = path.join(root, 'public');
const proofPath = path.join(publicDir, 'rcl-foundation-cross-domain-history-proof.json');

function sha256(buffer) { return crypto.createHash('sha256').update(buffer).digest('hex'); }
function isSha256(value) { return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value); }
function fail(message, details = {}) {
  console.error(JSON.stringify({
    ok: false,
    status: 'RCL_VERCEL_FOUNDATION_CROSS_DOMAIN_HISTORY_PROOF_FAILED',
    message,
    ...details,
  }, null, 2));
  process.exit(1);
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }

const source = [
  'reality VercelCrossDomainHistoryNativeProof {',
  '  physical world {',
  '    body stone {',
  '      facet position : Length = meters(10)',
  '      facet velocity : Velocity = meters_per_second(1)',
  '    }',
  '    field drift_field {',
  '      facet acceleration : Acceleration = meters_per_second2(0)',
  '    }',
  '    law drift {',
  '      step dt : Time',
  '      when world.stone.position > meters(0)',
  '      evolve world.stone.position <- world.stone.position + world.stone.velocity * dt',
  '      evolve world.stone.velocity <- world.stone.velocity + world.drift_field.acceleration * dt',
  '      conserve world.stone.position >= meters(0)',
  '      witness "cross-domain:physical"',
  '    }',
  '  }',
  '  perception sight {',
  '    observer operator',
  '    source world',
  '    channel position : Length = world.stone.position',
  '    preserve sight.position >= meters(0)',
  '  }',
  '  neural brain {',
  '    facet stimulus : Number = 1',
  '    facet response : Number = 0',
  '    pathway integrate {',
  '      when brain.stimulus > 0',
  '      transmit brain.response <- brain.response + brain.stimulus * 0.5',
  '      preserve brain.response >= 0 and brain.response <= 1',
  '      witness "cross-domain:neural"',
  '    }',
  '  }',
  '  advance world.drift steps 1 dt seconds(1)',
  '  observe sight',
  '  propagate brain steps 1',
  '}',
  '',
].join('\n');

try {
  if (!fs.existsSync(target)) fail('Canonical Vercel native VM artifact is missing before cross-domain history proof', { target });
  if (!fs.existsSync(manifestPath)) fail('Canonical Vercel native VM attestation is missing before cross-domain history proof', { manifestPath });
  const binarySha256 = sha256(fs.readFileSync(target));
  const nativeRuntime = { vmPath: target, buildIfMissing: false, timeout: 30_000 };
  const proof = await verifyFoundationDirectNativeParity(source, { nativeRuntime });
  if (proof?.status !== 'native-verified' || proof?.verified !== true) {
    fail('Cross-domain specimen did not pass canonical real-C native parity', {
      status: proof?.status ?? null,
      verified: proof?.verified ?? false,
      diagnostics: proof?.diagnostics ?? null,
      gaps: proof?.gaps ?? null,
      parity: proof?.parity ?? null,
    });
  }
  if (proof?.parity?.state !== true || proof?.parity?.semanticStateRoot !== true
      || proof?.parity?.nativeStateRootVerified !== true || proof?.parity?.nativeStateRootParity !== true
      || proof?.parity?.loweringLineage !== true || proof?.parity?.domainReceipt !== true
      || proof?.parity?.nativeExecutionAttestation !== true) {
    fail('Cross-domain specimen did not close the existing canonical parity gates', { parity: proof?.parity ?? null });
  }

  const domainReceipt = proof?.domainReceipt ?? null;
  const historyParity = verifyFoundationCrossDomainHistoryRootParity(domainReceipt);
  if (historyParity?.required !== true || historyParity?.ok !== true || historyParity?.rootsEqual !== true) {
    fail('Bounded cross-domain history-root parity did not verify', { historyParity, domainReceipt });
  }
  const expectedDomains = ['physical', 'perception', 'neural'];
  if (!expectedDomains.every(domain => historyParity.domains.includes(domain)) || historyParity.domainCount < 3) {
    fail('Cross-domain history proof did not include the intended Physical + Perception + Neural domains', { domains: historyParity.domains });
  }
  if (!isSha256(historyParity.referenceHistoryRoot) || historyParity.referenceHistoryRoot !== historyParity.nativeHistoryRoot) {
    fail('Cross-domain reference/native history roots are not the same content-addressed root', { historyParity });
  }
  if (historyParity?.checks?.referenceContinuityPreserved !== true || historyParity?.checks?.nativeContinuityPreserved !== true) {
    fail('Cross-domain history proof did not preserve contiguous before/after roots', { checks: historyParity?.checks ?? null });
  }

  const executionBinarySha256 = proof?.nativeExecutionAttestation?.materialization?.binarySha256 ?? null;
  if (executionBinarySha256 !== binarySha256) {
    fail('Cross-domain history proof is not bound to the exact Vercel native VM binary', { binarySha256, executionBinarySha256 });
  }

  const boundaryDrift = clone(domainReceipt);
  const boundaryEntry = boundaryDrift.entries.find(entry => ['perception', 'physical', 'neural'].includes(entry?.domain) && entry?.nativeActive === true);
  if (!boundaryEntry) fail('Cross-domain proof did not expose an active entry for negative control');
  boundaryEntry.nativeAfterRoot = boundaryEntry.nativeAfterRoot === '0'.repeat(64) ? '1'.repeat(64) : '0'.repeat(64);
  const boundaryNegative = verifyFoundationCrossDomainHistoryRootParity(boundaryDrift);
  if (boundaryNegative.ok !== false || boundaryNegative.checks?.everyBoundaryAndTransitionExact !== false) {
    fail('Boundary-root drift negative control did not fail closed', { boundaryNegative });
  }

  const transitionDrift = clone(domainReceipt);
  const transitionEntry = transitionDrift.entries.find(entry => ['perception', 'physical', 'neural'].includes(entry?.domain) && Array.isArray(entry?.nativeChanges) && entry.nativeChanges.length > 0);
  if (!transitionEntry) fail('Cross-domain proof did not expose a transition for negative control');
  transitionEntry.nativeChanges[0] = { ...transitionEntry.nativeChanges[0], after: '__DWAC_CYCLE88_DRIFT__' };
  const transitionNegative = verifyFoundationCrossDomainHistoryRootParity(transitionDrift);
  if (transitionNegative.ok !== false || transitionNegative.checks?.everyBoundaryAndTransitionExact !== false) {
    fail('Transition-value drift negative control did not fail closed', { transitionNegative });
  }

  const orderDrift = clone(domainReceipt);
  orderDrift.nativeOrderPreserved = false;
  const orderNegative = verifyFoundationCrossDomainHistoryRootParity(orderDrift);
  if (orderNegative.ok !== false || orderNegative.checks?.nativeOrderPreserved !== false) {
    fail('Native ordering drift negative control did not fail closed', { orderNegative });
  }

  const neuralEntryDrift = clone(domainReceipt);
  neuralEntryDrift.entries = neuralEntryDrift.entries.filter(entry => entry?.domain !== 'neural');
  const neuralEntryNegative = verifyFoundationCrossDomainHistoryRootParity(neuralEntryDrift);
  if (neuralEntryNegative.domains.includes('neural') || neuralEntryNegative.domainCount >= 3) {
    fail('Removing Neural history did not remove the three-domain claim', { neuralEntryNegative });
  }

  const artifact = {
    ok: true,
    format: 'taowind.rcl-vercel-foundation-cross-domain-history-proof.v0.2',
    status: 'RCL_FOUNDATION_CROSS_DOMAIN_HISTORY_ROOT_PARITY_VERIFIED',
    binarySha256,
    executionAttestationRoot: proof?.nativeExecutionAttestation?.attestationRoot ?? null,
    directParity: {
      status: proof.status,
      verified: proof.verified === true,
      parity: proof.parity,
      foundationDomainReceiptRoot: proof?.roots?.foundationDomainReceiptRoot ?? null,
      foundationCompositeReceiptRoot: proof?.roots?.foundationCompositeReceiptRoot ?? null,
    },
    crossDomainHistory: historyParity,
    negativeControls: {
      boundaryRootDriftFailsClosed: true,
      transitionValueDriftFailsClosed: true,
      nativeOrderDriftFailsClosed: true,
      neuralDomainRemovalDropsThreeDomainClaim: true,
    },
    truthBoundary: {
      boundedPhysicalPerceptionNeuralSpecimenOnly: true,
      supportedCrossDomainRootDomains: ['perception', 'physical', 'neural'],
      stagedGeneticHistoryIncluded: false,
      livingStagedHistoryIncluded: false,
      unrelatedRuntimeHistoryIncluded: false,
      fullHistoryParityClaimed: false,
      allFoundationDomainsHistoryParityClaimed: false,
    },
  };
  fs.mkdirSync(publicDir, { recursive: true });
  fs.writeFileSync(proofPath, `${JSON.stringify(artifact, null, 2)}\n`);

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest?.binarySha256 !== binarySha256 || manifest?.replayProof?.attestationBinarySha256 !== binarySha256) {
    fail('Native deployment attestation drifted before cross-domain evidence binding', {
      binarySha256,
      manifestBinarySha256: manifest?.binarySha256 ?? null,
      replayBinarySha256: manifest?.replayProof?.attestationBinarySha256 ?? null,
    });
  }
  manifest.foundationCrossDomainHistoryProof = {
    format: artifact.format,
    status: artifact.status,
    verified: true,
    domains: historyParity.domains,
    domainCount: historyParity.domainCount,
    entryCount: historyParity.entryCount,
    rootAlgorithm: historyParity.rootAlgorithm,
    referenceHistoryRoot: historyParity.referenceHistoryRoot,
    nativeHistoryRoot: historyParity.nativeHistoryRoot,
    executionAttestationRoot: artifact.executionAttestationRoot,
    binarySha256,
    truthBoundary: artifact.truthBoundary,
  };
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(JSON.stringify({
    ok: true,
    status: artifact.status,
    domains: historyParity.domains,
    domainCount: historyParity.domainCount,
    entryCount: historyParity.entryCount,
    historyRoot: historyParity.referenceHistoryRoot,
    binarySha256,
    executionAttestationRoot: artifact.executionAttestationRoot,
    negativeControls: artifact.negativeControls,
    truthBoundary: artifact.truthBoundary,
  }, null, 2));
} catch (error) {
  fail(error?.message ?? String(error), {
    code: error?.code ?? null,
    details: error?.details ?? null,
    stack: error?.stack ?? null,
  });
}
