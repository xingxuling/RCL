#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const nativeDir = path.join(root, 'native');
const publicDir = path.join(root, 'public');
const target = path.join(nativeDir, process.platform === 'win32' ? 'rclvm.exe' : 'rclvm');
const manifestPath = path.join(nativeDir, 'rclvm.vercel-attestation.json');
const proofPath = path.join(publicDir, 'rcl-foundation-quantitative-direct-native-proof.json');
const publicBuildProofPath = path.join(publicDir, 'rcl-native-build-proof.json');

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}
function isSha256(value) {
  return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value);
}
function fail(message, details = {}) {
  console.error(JSON.stringify({
    ok: false,
    status: 'RCL_VERCEL_FOUNDATION_QUANTITATIVE_DIRECT_BINDING_FAILED',
    message,
    ...details,
  }, null, 2));
  process.exit(1);
}

try {
  for (const requiredPath of [target, manifestPath, proofPath]) {
    if (!fs.existsSync(requiredPath)) {
      fail('Required Quantitative direct deployment evidence input is missing', { requiredPath });
    }
  }

  const binarySha256 = sha256(fs.readFileSync(target));
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const proofBytes = fs.readFileSync(proofPath);
  const proofSha256 = sha256(proofBytes);
  const proof = JSON.parse(proofBytes.toString('utf8'));

  if (manifest?.format !== 'taowind.rcl-vercel-native-artifact.v0.3') {
    fail('Deployment attestation is not the expected multi-domain format', {
      format: manifest?.format ?? null,
    });
  }
  if (
    manifest?.binarySha256 !== binarySha256
    || manifest?.replayProof?.attestationBinarySha256 !== binarySha256
    || manifest?.replayProof?.stateRootVerified !== true
    || manifest?.replayProof?.stateRootParity !== true
    || !isSha256(manifest?.replayProof?.attestationRoot)
    || !isSha256(manifest?.sourceMaterialization?.sourceRoot)
  ) {
    fail('Deployment replay/source evidence is not bound to the exact current canonical binary', {
      binarySha256,
      replayProof: manifest?.replayProof ?? null,
      sourceMaterialization: manifest?.sourceMaterialization ?? null,
    });
  }

  const measurement = proof?.finalState?.['sensor.temperature'];
  const healthy = proof?.finalState?.['sensor.healthy'];
  const summary = proof?.lowering?.summary;
  const loweringTruth = proof?.lowering?.truthBoundary;
  const proofTruth = proof?.truthBoundary;

  if (
    proof?.ok !== true
    || proof?.format !== 'taowind.rcl-vercel-foundation-quantitative-direct-native-proof.v0.1'
    || proof?.domain !== 'quantitative'
    || proof?.status !== 'native-direct-verified'
    || proof?.verified !== true
    || proof?.executionMode !== 'declared-domain-direct-lowering'
    || proof?.binarySha256 !== binarySha256
    || !isSha256(proof?.nativeStateRoot)
    || proof?.stateRootVerified !== true
    || proof?.stateRootParity !== true
    || proof?.transactionWitnessObserved !== true
    || summary?.quantitativeLoweredDeclarationCount !== 1
    || summary?.consumedDirectiveCount !== 1
    || summary?.syntheticRuleCount !== 1
    || summary?.remainingQuantitativeCount !== 0
    || summary?.measurementRecordCount !== 1
    || loweringTruth?.declaredQuantitativeDirectLoweringImplemented !== true
    || loweringTruth?.declaredQuantitativeDirectLoweringVerified !== false
    || loweringTruth?.measurementValueUncertaintyConfidenceUnitScaleRetained !== true
    || loweringTruth?.measurementEvidenceRetainedAsCanonicalJsonText !== true
    || loweringTruth?.measurementCalibrationIdentityRetained !== true
    || loweringTruth?.measurementAccessorsLoweredToTypedRecordFields !== true
    || loweringTruth?.quantitativeDomainReceiptParityClaimed !== false
    || loweringTruth?.referenceRuntimeParityClaimed !== false
    || loweringTruth?.providerBridgeRemovedGlobally !== false
    || loweringTruth?.allFoundationDomainsNativeClaimed !== false
    || proofTruth?.declaredDomainDirectLoweringVerified !== true
    || proofTruth?.domain !== 'quantitative'
    || proofTruth?.providerBridgeUsedForThisProof !== false
    || proofTruth?.referenceRuntimeParityClaimed !== false
    || proofTruth?.domainReceiptParityClaimed !== false
    || proofTruth?.deploymentHealthBound !== false
    || proofTruth?.providerBridgeRemovedGlobally !== false
    || proofTruth?.allFoundationDomainsNativeClaimed !== false
  ) {
    fail('Standalone Quantitative direct proof does not satisfy the strict deployment binding contract', {
      proof,
    });
  }

  if (
    measurement?.kind !== 'Measurement'
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
    || measurement?.hasUnit !== true
    || measurement?.hasCalibration !== true
    || healthy !== true
  ) {
    fail('Standalone Quantitative direct proof lost its measured/derived final-state semantics', {
      measurement,
      healthy,
    });
  }

  const boundProof = {
    format: proof.format,
    domain: proof.domain,
    status: proof.status,
    verified: true,
    executionMode: proof.executionMode,
    proofSha256,
    binarySha256,
    executionBinarySha256: binarySha256,
    canonicalVmSourceRoot: manifest.sourceMaterialization.sourceRoot,
    nativeStateRoot: proof.nativeStateRoot,
    stateRootVerified: true,
    stateRootParity: true,
    transactionWitnessObserved: true,
    loweringSummary: summary,
    loweringTruthBoundary: loweringTruth,
    finalState: proof.finalState,
    truthBoundary: {
      ...proofTruth,
      deploymentHealthBound: true,
    },
  };

  manifest.foundationDirectExtensionProofs = {
    ...(manifest.foundationDirectExtensionProofs ?? {}),
    quantitative: boundProof,
  };
  manifest.foundationQuantitativeDirectProof = boundProof;
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const publicBuildProof = fs.existsSync(publicBuildProofPath)
    ? JSON.parse(fs.readFileSync(publicBuildProofPath, 'utf8'))
    : {};
  publicBuildProof.format = manifest.format;
  publicBuildProof.binarySha256 = binarySha256;
  publicBuildProof.foundationDirectExtensionDomains = ['quantitative'];
  publicBuildProof.foundationDirectExtensionProofs = {
    ...(publicBuildProof.foundationDirectExtensionProofs ?? {}),
    quantitative: boundProof,
  };
  publicBuildProof.foundationQuantitativeDirect = {
    domain: 'quantitative',
    status: boundProof.status,
    verified: true,
    proofSha256,
    nativeStateRoot: boundProof.nativeStateRoot,
    executionBinarySha256: binarySha256,
    canonicalVmSourceRoot: boundProof.canonicalVmSourceRoot,
    transactionWitnessObserved: true,
    deploymentHealthBound: true,
  };
  fs.writeFileSync(publicBuildProofPath, `${JSON.stringify(publicBuildProof, null, 2)}\n`);

  console.log(JSON.stringify({
    ok: true,
    status: 'RCL_VERCEL_FOUNDATION_QUANTITATIVE_DIRECT_DEPLOYMENT_BOUND',
    binarySha256,
    canonicalVmSourceRoot: boundProof.canonicalVmSourceRoot,
    proofSha256,
    nativeStateRoot: boundProof.nativeStateRoot,
    foundationDirectExtensionDomains: publicBuildProof.foundationDirectExtensionDomains,
    transactionWitnessObserved: boundProof.transactionWitnessObserved,
  }, null, 2));
} catch (error) {
  fail(error?.message ?? String(error), {
    code: error?.code ?? null,
    stack: error?.stack ?? null,
  });
}
