#!/usr/bin/env node
import { runtimeCapabilityTruthSurface } from '../api/capability-truth.mjs';

function fail(message, details = {}) {
  console.error(JSON.stringify({
    ok: false,
    status: 'RCL_FOUNDATION_ENERGY_RUNTIME_TRUTH_FAILED',
    message,
    ...details,
  }, null, 2));
  process.exit(1);
}
function isSha256(value) {
  return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value);
}
function isEnergyQuantity(value, expected) {
  return value?.kind === 'Quantity'
    && value?.type === 'Energy'
    && value?.unit === 'J'
    && value?.value === expected;
}

try {
  const surface = runtimeCapabilityTruthSurface();
  if (
    surface?.ok !== true
    || surface?.status !== 'RCL_FOUNDATION_RUNTIME_CAPABILITY_TRUTH_VERIFIED'
  ) {
    fail('Runtime capability truth surface did not verify.', { surface });
  }
  for (const value of [
    surface?.truthRoot,
    surface?.direct?.registryRoot,
    surface?.providerBridge?.registryRoot,
  ]) {
    if (!isSha256(value)) {
      fail('Runtime capability truth lost a required content-addressed registry/truth root.', {
        value,
        surface,
      });
    }
  }
  if (!surface?.direct?.domains?.includes('energy')) {
    fail('Executable direct capability registry no longer declares the bounded Energy implementation.', {
      direct: surface?.direct ?? null,
    });
  }
  if (!surface?.providerBridge?.domains?.includes('energy')) {
    fail('Runtime capability truth incorrectly removed the Energy Provider bridge coexistence path.', {
      providerBridge: surface?.providerBridge ?? null,
    });
  }

  const energy = surface?.deploymentEvidence?.energy;
  if (
    energy?.ok !== true
    || energy?.verified !== true
    || energy?.domain !== 'energy'
    || energy?.status !== 'deployment-bound'
    || energy?.loweredDirectiveCount !== 1
    || energy?.loweredFlowCount !== 1
  ) {
    fail('Runtime capability truth did not bind the bounded Energy deployment proof.', { energy });
  }
  for (const value of [
    energy?.binarySha256,
    energy?.executionBinarySha256,
    energy?.nativeVmExecutionAttestationRoot,
    energy?.energyReceiptRoot,
    energy?.deploymentEvidenceRoot,
  ]) {
    if (!isSha256(value)) {
      fail('Energy runtime truth is missing a required content-addressed execution/evidence root.', {
        value,
        energy,
      });
    }
  }
  if (energy.binarySha256 !== energy.executionBinarySha256) {
    fail('Energy runtime truth is not bound to the exact deployed canonical Native VM binary.', { energy });
  }
  if (
    !isEnergyQuantity(energy?.finalState?.['grid.source'], 60)
    || !isEnergyQuantity(energy?.finalState?.['grid.load'], 36)
  ) {
    fail('Energy runtime truth lost the verified bounded transfer final state.', {
      finalState: energy?.finalState ?? null,
    });
  }
  if (
    surface?.truthBoundary?.deploymentEvidenceIsRuntimeSpecific !== true
    || surface?.truthBoundary?.deploymentEvidenceDoesNotRewriteVersionedCapabilityTruth !== true
    || surface?.truthBoundary?.energyProviderBridgeMayCoexistWithBoundedDirectVerification !== true
    || energy?.truthBoundary?.boundedEnergySubsetOnly !== true
    || energy?.truthBoundary?.providerBridgeRemovedGlobally !== false
    || energy?.truthBoundary?.allEnergyProgramsNativeClaimed !== false
    || energy?.truthBoundary?.fullHistoryParityClaimed !== false
  ) {
    fail('Runtime Energy truth boundary drifted or overclaimed direct-native coverage.', {
      surfaceBoundary: surface?.truthBoundary ?? null,
      energyBoundary: energy?.truthBoundary ?? null,
    });
  }

  console.log(JSON.stringify({
    ok: true,
    status: 'RCL_FOUNDATION_ENERGY_RUNTIME_TRUTH_VERIFIED',
    truthRoot: surface.truthRoot,
    directRegistryRoot: surface.direct.registryRoot,
    providerBridgeRegistryRoot: surface.providerBridge.registryRoot,
    energyDeploymentEvidenceRoot: energy.deploymentEvidenceRoot,
    energyReceiptRoot: energy.energyReceiptRoot,
    nativeVmExecutionAttestationRoot: energy.nativeVmExecutionAttestationRoot,
    binarySha256: energy.binarySha256,
  }, null, 2));
} catch (error) {
  fail(error?.message ?? String(error), {
    code: error?.code ?? null,
    stack: error?.stack ?? null,
  });
}
