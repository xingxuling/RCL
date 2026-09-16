#!/usr/bin/env node
import { nativeVmDeploymentStatus } from '../api/health.mjs';

function fail(message, details = {}) {
  console.error(JSON.stringify({
    ok: false,
    status: 'RCL_VERCEL_HEALTH_EVIDENCE_FAILED',
    message,
    ...details,
  }, null, 2));
  process.exit(1);
}

try {
  const status = nativeVmDeploymentStatus();
  if (status.bundled !== true || status.executable !== true || status.attestationBundled !== true) {
    fail('Native VM deployment artifact is not fully bundled before health evidence verification', { status });
  }
  if (status.replayEvidenceBound !== true || status.foundationParityBound !== true || status.evidenceBound !== true) {
    fail('Deployment health does not fail-closed bind replay and Foundation parity evidence', { status });
  }
  if (status.perceptionParityBound !== true || status.physicalParityBound !== true) {
    fail('Deployment health did not bind both Perception and Physical Foundation proof domains', { status });
  }
  if (JSON.stringify(status.foundationParityDomains) !== JSON.stringify(['perception', 'physical'])) {
    fail('Deployment health exposes an unexpected Foundation proof domain set', {
      foundationParityDomains: status.foundationParityDomains,
    });
  }
  if (status.foundationParityProofs?.perception?.executionBinarySha256 !== status.binarySha256) {
    fail('Perception proof is not bound to the deployed binary hash', { status });
  }
  if (status.foundationParityProofs?.physical?.executionBinarySha256 !== status.binarySha256) {
    fail('Physical proof is not bound to the deployed binary hash', { status });
  }
  const position = status.physicalQuantityEvidence?.finalPosition;
  const velocity = status.physicalQuantityEvidence?.finalVelocity;
  if (position?.kind !== 'Quantity' || position?.type !== 'Length' || position?.value !== 12 || position?.unit !== 'm') {
    fail('Health evidence lost the proven Physical final Length quantity', { position });
  }
  if (velocity?.kind !== 'Quantity' || velocity?.type !== 'Velocity' || velocity?.value !== 1 || velocity?.unit !== 'm/s') {
    fail('Health evidence lost the proven Physical final Velocity quantity', { velocity });
  }
  if (Number(status.physicalQuantityEvidence?.quantityExtremumCount ?? 0) < 4) {
    fail('Health evidence does not retain the proven dimensioned extrema lowering count', {
      physicalQuantityEvidence: status.physicalQuantityEvidence,
    });
  }

  console.log(JSON.stringify({
    ok: true,
    status: 'RCL_VERCEL_HEALTH_EVIDENCE_VERIFIED',
    binarySha256: status.binarySha256,
    evidenceBound: status.evidenceBound,
    foundationParityDomains: status.foundationParityDomains,
    perceptionDomainReceiptRoot: status.foundationParityProofs.perception.domainReceiptRoot,
    physicalDomainReceiptRoot: status.foundationParityProofs.physical.domainReceiptRoot,
    physicalQuantityExtremumCount: status.physicalQuantityEvidence.quantityExtremumCount,
    finalPosition: position,
    finalVelocity: velocity,
  }, null, 2));
} catch (error) {
  fail(error?.message ?? String(error), {
    code: error?.code ?? null,
    stack: error?.stack ?? null,
  });
}
