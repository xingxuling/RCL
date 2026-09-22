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
const proofPath = path.join(publicDir, 'rcl-foundation-cross-domain-neural-history-proof.json');

function sha256(buffer) { return crypto.createHash('sha256').update(buffer).digest('hex'); }
function isSha256(value) { return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value); }
function fail(message, details = {}) {
  console.error(JSON.stringify({
    ok: false,
    status: 'RCL_VERCEL_FOUNDATION_CROSS_DOMAIN_NEURAL_HISTORY_PROOF_FAILED',
    message,
    ...details,
  }, null, 2));
  process.exit(1);
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }

const source = [
  'reality VercelCrossDomainNeuralHistoryNativeProof {',
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
  '      witness "cross-domain-neural:physical"',
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
  '    facet trace : Number = 0',
  '    pathway integrate {',
  '      when brain.stimulus > 0',
  '      transmit brain.response <- brain.response + brain.stimulus * 0.5',
  '      preserve brain.response >= 0 and brain.response <= 1',
  '      witness "cross-domain-neural:integration"',
  '    }',
  '    pathway dormant {',
  '      when brain.stimulus < 0',
  '      learn brain.trace <- brain.trace + 1',
  '      preserve brain.trace >= 0',
  '      witness "cross-domain-neural:dormant"',
  '    }',
  '  }',
  '  advance world.drift steps 1 dt seconds(1)',
  '  observe sight',
  '  propagate brain steps 2',
  '}',
  '',
].join('\n');

try {
  if (!fs.existsSync(target)) fail('Canonical Vercel native VM artifact is missing before three-domain history proof', { target });
  if (!fs.existsSync(manifestPath)) fail('Canonical Vercel native VM attestation is missing before three-domain history proof', { manifestPath });

  const binarySha256 = sha256(fs.readFileSync(target));
  const manifestBefore = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifestBefore?.binarySha256 !== binarySha256 || manifestBefore?.replayProof?.attestationBinarySha256 !== binarySha256) {
    fail('Native deployment attestation drifted before three-domain history replay', {
      binarySha256,
      manifestBinarySha256: manifestBefore?.binarySha256 ?? null,
      replayBinarySha256: manifestBefore?.replayProof?.attestationBinarySha256 ?? null,
    });
  }

  const neuralPrior = manifestBefore?.foundationParityProofs?.neural ?? null;
  if (neuralPrior?.domain !== 'neural' || neuralPrior?.status !== 'native-verified' || neuralPrior?.verified !== true || neuralPrior?.executionBinarySha256 !== binarySha256) {
    fail('Existing canonical Neural real-C proof must remain bound before three-domain history replay', { neuralPrior, binarySha256 });
  }

  const nativeRuntime = { vmPath: target, buildIfMissing: false, timeout: 30_000 };
  const proof = await verifyFoundationDirectNativeParity(source, { nativeRuntime });
  if (proof?.status !== 'native-verified' || proof?.verified !== true) {
    fail('Physical + Perception + Neural specimen did not pass canonical real-C native parity', {
      status: proof?.status ?? null,
      verified: proof?.verified ?? false,
      diagnostics: proof?.diagnostics ?? null,
      gaps: proof?.gaps ?? null,
      parity: proof?.parity ?? null,
    });
  }
  if (
    proof?.parity?.state !== true
    || proof?.parity?.semanticStateRoot !== true
    || proof?.parity?.nativeStateRootVerified !== true
    || proof?.parity?.nativeStateRootParity !== true
    || proof?.parity?.loweringLineage !== true
    || proof?.parity?.domainReceipt !== true
    || proof?.parity?.nativeExecutionAttestation !== true
  ) {
    fail('Three-domain specimen did not close canonical parity gates', { parity: proof?.parity ?? null });
  }

  const domainReceipt = proof?.domainReceipt ?? null;
  const historyParity = verifyFoundationCrossDomainHistoryRootParity(domainReceipt);
  if (historyParity?.required !== true || historyParity?.ok !== true || historyParity?.rootsEqual !== true) {
    fail('Three-domain cross-domain history-root parity did not verify', { historyParity, domainReceipt });
  }
  const expectedDomains = ['physical', 'perception', 'neural'];
  if (historyParity.domainCount !== 3 || expectedDomains.some(domain => !historyParity.domains.includes(domain))) {
    fail('Cross-domain history proof did not exercise Physical + Perception + Neural together', {
      expectedDomains,
      actualDomains: historyParity.domains,
      domainCount: historyParity.domainCount,
    });
  }
  if (!isSha256(historyParity.referenceHistoryRoot) || historyParity.referenceHistoryRoot !== historyParity.nativeHistoryRoot) {
    fail('Three-domain reference/native history roots are not the same content-addressed root', { historyParity });
  }
  if (historyParity?.checks?.referenceContinuityPreserved !== true || historyParity?.checks?.nativeContinuityPreserved !== true) {
    fail('Three-domain history proof did not preserve contiguous before/after roots', { checks: historyParity?.checks ?? null });
  }

  const executionBinarySha256 = proof?.nativeExecutionAttestation?.materialization?.binarySha256 ?? null;
  if (executionBinarySha256 !== binarySha256) {
    fail('Three-domain history proof is not bound to the exact Vercel native VM binary', { binarySha256, executionBinarySha256 });
  }

  const boundaryDrift = clone(domainReceipt);
  const boundaryEntry = boundaryDrift.entries.find(entry => ['perception', 'physical', 'neural'].includes(entry?.domain) && entry?.nativeActive === true);
  if (!boundaryEntry) fail('Three-domain proof did not expose an active entry for boundary negative control');
  boundaryEntry.nativeAfterRoot = boundaryEntry.nativeAfterRoot === '0'.repeat(64) ? '1'.repeat(64) : '0'.repeat(64);
  const boundaryNegative = verifyFoundationCrossDomainHistoryRootParity(boundaryDrift);
  if (boundaryNegative.ok !== false || boundaryNegative.checks?.everyBoundaryAndTransitionExact !== false) {
    fail('Three-domain boundary-root drift negative control did not fail closed', { boundaryNegative });
  }

  const transitionDrift = clone(domainReceipt);
  const neuralTransition = transitionDrift.entries.find(entry => entry?.domain === 'neural' && entry?.nativeActive === true && Array.isArray(entry?.nativeChanges) && entry.nativeChanges.length > 0);
  if (!neuralTransition) fail('Three-domain proof did not expose an active Neural transition for negative control');
  neuralTransition.nativeChanges[0] = { ...neuralTransition.nativeChanges[0], after: '__DWAC_CYCLE88_NEURAL_DRIFT__' };
  const transitionNegative = verifyFoundationCrossDomainHistoryRootParity(transitionDrift);
  if (transitionNegative.ok !== false || transitionNegative.checks?.everyBoundaryAndTransitionExact !== false) {
    fail('Neural transition-value drift negative control did not fail closed', { transitionNegative });
  }

  const orderDrift = clone(domainReceipt);
  orderDrift.nativeOrderPreserved = false;
  const orderNegative = verifyFoundationCrossDomainHistoryRootParity(orderDrift);
  if (orderNegative.ok !== false || orderNegative.checks?.nativeOrderPreserved !== false) {
    fail('Three-domain native ordering drift negative control did not fail closed', { orderNegative });
  }

  const artifact = {
    ok: true,
    format: 'taowind.rcl-vercel-foundation-cross-domain-neural-history-proof.v0.1',
    version: '0.1.0',
    status: 'RCL_FOUNDATION_CROSS_DOMAIN_NEURAL_HISTORY_ROOT_PARITY_VERIFIED',
    verified: true,
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
      neuralTransitionValueDriftFailsClosed: true,
      nativeOrderDriftFailsClosed: true,
    },
    truthBoundary: {
      boundedPhysicalPerceptionNeuralDirectSpecimenOnly: true,
      supportedCrossDomainRootDomains: ['perception', 'physical', 'neural'],
      stagedGeneticHistoryIncluded: false,
      livingStagedHistoryIncluded: false,
      canonicalCrossDomainRuntimeTruthBindingClaimed: false,
      unrelatedRuntimeHistoryIncluded: false,
      fullHistoryParityClaimed: false,
      allFoundationDomainsHistoryParityClaimed: false,
    },
  };
  fs.mkdirSync(publicDir, { recursive: true });
  fs.writeFileSync(proofPath, `${JSON.stringify(artifact, null, 2)}\n`);

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest?.binarySha256 !== binarySha256 || manifest?.replayProof?.attestationBinarySha256 !== binarySha256) {
    fail('Native deployment attestation drifted before three-domain evidence binding', { binarySha256 });
  }
  manifest.foundationCrossDomainNeuralHistoryProof = {
    format: artifact.format,
    version: artifact.version,
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
