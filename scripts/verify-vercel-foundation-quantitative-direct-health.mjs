#!/usr/bin/env node
import { nativeVmDeploymentStatus } from '../api/health.mjs';

function fail(message, details = {}) {
  console.error(JSON.stringify({
    ok: false,
    status: 'RCL_VERCEL_FOUNDATION_QUANTITATIVE_DIRECT_HEALTH_FAILED',
    message,
    ...details,
  }, null, 2));
  process.exit(1);
}
function isSha256(value) {
  return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value);
}

try {
  const status = nativeVmDeploymentStatus();
  const proof = status.quantitativeDirectEvidence;
  const measurement = proof?.finalState?.['sensor.temperature'];

  if (
    status.replayEvidenceBound !== true
    || status.quantitativeDirectLoweringBound !== true
    || status.directExtensionEvidenceBound !== true
    || status.extendedEvidenceBound !== true
  ) {
    fail('Deployment health did not fail-closed bind the proven Quantitative direct execution', { status });
  }
  if (JSON.stringify(status.foundationDirectExtensionDomains) !== JSON.stringify(['quantitative'])) {
    fail('Deployment health exposes an unexpected direct-extension domain set', {
      foundationDirectExtensionDomains: status.foundationDirectExtensionDomains,
    });
  }
  if (
    proof?.domain !== 'quantitative'
    || proof?.status !== 'native-direct-verified'
    || proof?.verified !== true
    || proof?.executionMode !== 'declared-domain-direct-lowering'
    || !isSha256(proof?.proofSha256)
    || !isSha256(proof?.nativeStateRoot)
    || proof?.stateRootVerified !== true
    || proof?.stateRootParity !== true
    || proof?.transactionWitnessObserved !== true
    || proof?.executionBinarySha256 !== status.binarySha256
    || proof?.canonicalVmSourceRoot !== status.sourceRoot
    || proof?.truthBoundary?.declaredDomainDirectLoweringVerified !== true
    || proof?.truthBoundary?.providerBridgeUsedForThisProof !== false
    || proof?.truthBoundary?.referenceRuntimeParityClaimed !== false
    || proof?.truthBoundary?.domainReceiptParityClaimed !== false
    || proof?.truthBoundary?.deploymentHealthBound !== true
    || proof?.truthBoundary?.providerBridgeRemovedGlobally !== false
    || proof?.truthBoundary?.allFoundationDomainsNativeClaimed !== false
  ) {
    fail('Deployment health lost the strict Quantitative direct-lowering truth boundary', {
      proof,
      binarySha256: status.binarySha256,
      sourceRoot: status.sourceRoot,
    });
  }

  if (
    proof?.loweringSummary?.quantitativeLoweredDeclarationCount !== 1
    || proof?.loweringSummary?.consumedDirectiveCount !== 1
    || proof?.loweringSummary?.syntheticRuleCount !== 1
    || proof?.loweringSummary?.remainingQuantitativeCount !== 0
    || proof?.loweringSummary?.measurementRecordCount !== 1
    || measurement?.kind !== 'Measurement'
    || measurement?.baseType !== 'Temperature'
    || measurement?.value?.kind !== 'Quantity'
    || measurement?.value?.type !== 'Temperature'
    || measurement?.value?.value !== 8
    || measurement?.value?.unit !== '°C'
    || measurement?.uncertainty?.kind !== 'Quantity'
    || measurement?.uncertainty?.type !== 'Temperature'
    || measurement?.uncertainty?.value !== 0.2
    || measurement?.uncertainty?.unit !== '°C'
    || measurement?.confidence !== 0.98
    || measurement?.unit !== '°C'
    || measurement?.scale !== 'interval'
    || measurement?.evidence !== '["sensor:ambient-v1"]'
    || measurement?.calibratedBy !== 'calibration:ambient-v1'
    || proof?.finalState?.['sensor.healthy'] !== true
  ) {
    fail('Deployment health lost the proven Quantitative measured/derived semantics', {
      proof,
      measurement,
    });
  }

  const bridge = status.quantitativeBridgeEvidence;
  if (
    status.quantitativeBridgeBound !== true
    || bridge?.mode !== 'native-provider-bridge'
    || bridge?.declaredDomainDirectLoweringVerified !== false
  ) {
    fail('Quantitative direct evidence incorrectly replaced or overclaimed the independent Provider bridge evidence', {
      bridge,
      quantitativeBridgeBound: status.quantitativeBridgeBound,
    });
  }

  console.log(JSON.stringify({
    ok: true,
    status: 'RCL_VERCEL_FOUNDATION_QUANTITATIVE_DIRECT_HEALTH_VERIFIED',
    binarySha256: status.binarySha256,
    sourceRoot: status.sourceRoot,
    proofSha256: proof.proofSha256,
    nativeStateRoot: proof.nativeStateRoot,
    foundationDirectExtensionDomains: status.foundationDirectExtensionDomains,
    quantitativeDirectLoweringBound: status.quantitativeDirectLoweringBound,
    quantitativeBridgeBound: status.quantitativeBridgeBound,
    extendedEvidenceBound: status.extendedEvidenceBound,
    measurement: {
      baseType: measurement.baseType,
      value: measurement.value,
      uncertainty: measurement.uncertainty,
      confidence: measurement.confidence,
      unit: measurement.unit,
      scale: measurement.scale,
      evidence: measurement.evidence,
      calibratedBy: measurement.calibratedBy,
    },
    healthy: proof.finalState['sensor.healthy'],
  }, null, 2));
} catch (error) {
  fail(error?.message ?? String(error), {
    code: error?.code ?? null,
    stack: error?.stack ?? null,
  });
}
