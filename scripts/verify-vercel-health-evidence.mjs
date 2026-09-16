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
  if (status.perceptionParityBound !== true || status.physicalParityBound !== true || status.neuralParityBound !== true) {
    fail('Deployment health did not bind Perception, Physical and Neural Foundation proof domains', { status });
  }
  if (JSON.stringify(status.foundationParityDomains) !== JSON.stringify(['perception', 'physical', 'neural'])) {
    fail('Deployment health exposes an unexpected Foundation proof domain set', {
      foundationParityDomains: status.foundationParityDomains,
    });
  }
  for (const domain of ['perception', 'physical', 'neural']) {
    if (status.foundationParityProofs?.[domain]?.executionBinarySha256 !== status.binarySha256) {
      fail(`${domain} proof is not bound to the deployed binary hash`, { domain, status });
    }
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

  const neural = status.neuralEvidence;
  if (
    neural?.boundedSteps !== 2
    || neural?.pathwayCount !== 2
    || neural?.activePathway !== 'brain.integrate'
    || neural?.inactivePathway !== 'brain.dormant'
    || neural?.finalStimulus !== 1
    || neural?.finalResponse !== 1
    || neural?.finalTrace !== 0
  ) {
    fail('Health evidence lost the proven bounded Neural active/inactive pathway semantics', { neural });
  }
  if (status.foundationParityProofs?.neural?.loweredCount !== 4) {
    fail('Health evidence lost the proven Neural direct-lowering transaction count', {
      neuralProof: status.foundationParityProofs?.neural ?? null,
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
    neuralDomainReceiptRoot: status.foundationParityProofs.neural.domainReceiptRoot,
    physicalQuantityExtremumCount: status.physicalQuantityEvidence.quantityExtremumCount,
    neuralLoweredTransactionCount: status.foundationParityProofs.neural.loweredCount,
    finalPosition: position,
    finalVelocity: velocity,
    neuralFinalState: {
      stimulus: neural.finalStimulus,
      response: neural.finalResponse,
      trace: neural.finalTrace,
    },
  }, null, 2));
} catch (error) {
  fail(error?.message ?? String(error), {
    code: error?.code ?? null,
    stack: error?.stack ?? null,
  });
}
