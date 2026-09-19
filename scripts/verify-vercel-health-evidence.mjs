#!/usr/bin/env node
import { nativeVmDeploymentStatus } from '../api/health.mjs';
import {
  FOUNDATION_NATIVE_BRIDGE_SPECS as BRIDGE_SPECS,
  foundationNativeBridgeCapabilityRegistrySnapshot,
} from '../src/foundation-native-bridge-capability-registry.mjs';

function fail(message, details = {}) {
  console.error(JSON.stringify({
    ok: false,
    status: 'RCL_VERCEL_HEALTH_EVIDENCE_FAILED',
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
  const bridgeRegistry = foundationNativeBridgeCapabilityRegistrySnapshot();
  if (status.bundled !== true || status.executable !== true || status.attestationBundled !== true) {
    fail('Native VM deployment artifact is not fully bundled before health evidence verification', { status });
  }
  if (status.replayEvidenceBound !== true || status.foundationParityBound !== true || status.evidenceBound !== true) {
    fail('Deployment health does not fail-closed bind replay and direct Foundation parity evidence', { status });
  }
  if (
    status.foundationNativeBridgeRegistryRoot !== bridgeRegistry.registryRoot
    || status.foundationNativeBridgeSpecCount !== BRIDGE_SPECS.length
  ) {
    fail('Native deployment health is not bound to the executable canonical Provider bridge registry.', {
      deploymentRegistryRoot: status.foundationNativeBridgeRegistryRoot,
      canonicalRegistryRoot: bridgeRegistry.registryRoot,
      deploymentSpecCount: status.foundationNativeBridgeSpecCount,
      canonicalSpecCount: BRIDGE_SPECS.length,
    });
  }
  if (
    status.perceptionParityBound !== true
    || status.physicalParityBound !== true
    || status.neuralParityBound !== true
    || status.geneticParityBound !== true
    || status.livingParityBound !== true
  ) {
    fail('Deployment health did not bind all five proven direct Foundation proof domains', { status });
  }
  if (JSON.stringify(status.foundationParityDomains) !== JSON.stringify(['perception', 'physical', 'neural', 'genetic', 'living'])) {
    fail('Deployment health exposes an unexpected direct Foundation parity domain set', {
      foundationParityDomains: status.foundationParityDomains,
    });
  }
  for (const domain of ['perception', 'physical', 'neural', 'genetic', 'living']) {
    if (status.foundationParityProofs?.[domain]?.executionBinarySha256 !== status.binarySha256) {
      fail(`${domain} direct proof is not bound to the deployed canonical VM binary hash`, { domain, status });
    }
  }

  const expectedBridgeDomains = BRIDGE_SPECS.map(spec => spec.domain);
  if (
    status.foundationNativeBridgeFederationBound !== true
    || status.foundationNativeBridgeBound !== true
    || status.extendedEvidenceBound !== true
    || JSON.stringify(status.foundationNativeBridgeDomains) !== JSON.stringify(expectedBridgeDomains)
  ) {
    fail('Deployment health did not separately bind the complete proven Foundation Native Provider federation', { status });
  }

  const federation = status.foundationNativeBridgeFederation;
  if (
    federation?.format !== 'taowind.rcl-vercel-foundation-native-provider-federation.v0.1'
    || federation?.status !== 'deployment-bound'
    || federation?.verified !== true
    || JSON.stringify(federation?.domains) !== JSON.stringify(expectedBridgeDomains)
    || federation?.canonicalVmSourceRoot !== status.sourceRoot
    || federation?.declaredDomainDirectLoweringVerified !== false
  ) {
    fail('Deployment health lost the strict Native Provider federation truth boundary', {
      federation,
      expectedBridgeDomains,
      sourceRoot: status.sourceRoot,
    });
  }
  for (const value of [
    federation.hostBinarySha256,
    federation.compilerBinarySha256,
    federation.hostSourceRoot,
    federation.canonicalVmSourceRoot,
    federation.conformanceContractRoot,
    federation.federationRoot,
  ]) {
    if (!isSha256(value)) fail('Native Provider federation health evidence is missing a required content-addressed root', { value, federation });
  }

  const proofsByBatch = new Map();
  let sharedHostBinarySha256 = null;
  let sharedHostSourceRoot = null;
  let sharedCompilerBinarySha256 = null;
  for (const spec of BRIDGE_SPECS) {
    const proof = status.foundationNativeBridgeProofs?.[spec.domain];
    if (
      proof?.batchId !== spec.batchId
      || proof?.domain !== spec.domain
      || proof?.capability !== spec.capability
      || proof?.mode !== 'native-provider-bridge'
      || proof?.status !== 'native-bridge-verified'
      || proof?.verified !== true
      || proof?.providerId !== spec.providerId
      || proof?.providerAbi !== 1
      || proof?.providerCallCount !== spec.providerCallCount
      || proof?.canonicalVmSourceRoot !== status.sourceRoot
      || proof?.selfhostByteIdentical !== true
      || proof?.replayVerified !== true
      || proof?.providerDisabledRejected !== true
      || proof?.behaviorMutationVerified !== true
      || proof?.declaredDomainDirectLoweringVerified !== false
    ) {
      fail(`Health evidence lost ${spec.domain} Native Provider Bridge provenance, replay, negative control, or strict direct-lowering truth boundary`, {
        spec,
        proof,
        sourceRoot: status.sourceRoot,
      });
    }
    for (const value of [
      proof.hostBinarySha256,
      proof.compilerBinarySha256,
      proof.hostSourceRoot,
      proof.canonicalVmSourceRoot,
      proof.bytecodeRoot,
      proof.deterministicReceiptRoot,
      proof.batchFinalStateRoot,
      proof.beforeRoot,
      proof.finalStateRoot,
    ]) {
      if (!isSha256(value)) fail(`${spec.domain} bridge health evidence is missing a required content-addressed root`, { spec, proof });
    }

    sharedHostBinarySha256 ??= proof.hostBinarySha256;
    sharedHostSourceRoot ??= proof.hostSourceRoot;
    sharedCompilerBinarySha256 ??= proof.compilerBinarySha256;
    if (
      proof.hostBinarySha256 !== sharedHostBinarySha256
      || proof.hostSourceRoot !== sharedHostSourceRoot
      || proof.compilerBinarySha256 !== sharedCompilerBinarySha256
      || proof.hostBinarySha256 !== federation.hostBinarySha256
      || proof.hostSourceRoot !== federation.hostSourceRoot
      || proof.compilerBinarySha256 !== federation.compilerBinarySha256
    ) {
      fail('Native Provider domains are not bound to one common current host/compiler/source execution', {
        spec,
        proof,
        federation,
      });
    }
    if (!proofsByBatch.has(spec.batchId)) proofsByBatch.set(spec.batchId, []);
    proofsByBatch.get(spec.batchId).push(proof);
  }

  const bridgeBatchRoots = {};
  for (const [batchId, proofs] of proofsByBatch.entries()) {
    const first = proofs[0];
    for (const proof of proofs) {
      if (
        proof.providerId !== first.providerId
        || proof.providerCallCount !== first.providerCallCount
        || proof.bytecodeRoot !== first.bytecodeRoot
        || proof.deterministicReceiptRoot !== first.deterministicReceiptRoot
        || proof.batchFinalStateRoot !== first.batchFinalStateRoot
      ) {
        fail('A Native Provider batch is not bound to one bytecode/receipt/final-state execution', {
          batchId,
          first,
          proof,
        });
      }
    }
    for (let index = 1; index < proofs.length; index += 1) {
      if (proofs[index].beforeRoot !== proofs[index - 1].finalStateRoot) {
        fail('Native Provider batch health evidence lost causal state-root chaining between domains', {
          batchId,
          previous: proofs[index - 1],
          current: proofs[index],
        });
      }
    }
    const federationBatch = federation.providerBatches?.[batchId];
    if (
      federationBatch?.providerId !== first.providerId
      || federationBatch?.providerAbi !== 1
      || federationBatch?.providerCallCount !== first.providerCallCount
      || JSON.stringify(federationBatch?.domains) !== JSON.stringify(proofs.map(proof => proof.domain))
      || federationBatch?.bytecodeRoot !== first.bytecodeRoot
      || federationBatch?.deterministicReceiptRoot !== first.deterministicReceiptRoot
      || federationBatch?.finalStateRoot !== first.batchFinalStateRoot
    ) {
      fail('Federation batch summary diverges from its per-domain bridge proofs', {
        batchId,
        federationBatch,
        proofs,
      });
    }
    bridgeBatchRoots[batchId] = {
      bytecodeRoot: first.bytecodeRoot,
      deterministicReceiptRoot: first.deterministicReceiptRoot,
      finalStateRoot: first.batchFinalStateRoot,
    };
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

  const genetic = status.geneticEvidence;
  if (
    genetic?.generationCount !== 2
    || genetic?.stageCount !== 4
    || genetic?.finalSeed !== 5
    || genetic?.finalTrait !== 15
    || status.foundationParityProofs?.genetic?.loweredCount !== 4
  ) {
    fail('Health evidence lost the proven Genetic ordered mutation/expression semantics', {
      genetic,
      geneticProof: status.foundationParityProofs?.genetic ?? null,
    });
  }

  const living = status.livingEvidence;
  if (
    living?.boundedSteps !== 2
    || living?.stageCount !== 6
    || living?.unchangedSenseNegativeEvidenceBound !== true
    || living?.finalFoodSense !== 4
    || living?.finalEnergy !== 9
    || living?.finalHealth !== 3
    || status.foundationParityProofs?.living?.loweredCount !== 6
  ) {
    fail('Health evidence lost the proven Living sense/cycle semantics or unchanged-sense negative evidence', {
      living,
      livingProof: status.foundationParityProofs?.living ?? null,
    });
  }

  console.log(JSON.stringify({
    ok: true,
    status: 'RCL_VERCEL_HEALTH_EVIDENCE_VERIFIED',
    binarySha256: status.binarySha256,
    evidenceBound: status.evidenceBound,
    extendedEvidenceBound: status.extendedEvidenceBound,
    foundationParityDomains: status.foundationParityDomains,
    foundationNativeBridgeRegistryRoot: status.foundationNativeBridgeRegistryRoot,
    foundationNativeBridgeDomains: status.foundationNativeBridgeDomains,
    bridgeProviderCount: proofsByBatch.size,
    bridgeDomainCount: expectedBridgeDomains.length,
    bridgeHostBinarySha256: sharedHostBinarySha256,
    bridgeHostSourceRoot: sharedHostSourceRoot,
    bridgeCompilerBinarySha256: sharedCompilerBinarySha256,
    bridgeFederationRoot: federation.federationRoot,
    bridgeConformanceContractRoot: federation.conformanceContractRoot,
    bridgeBatchRoots,
    perceptionDomainReceiptRoot: status.foundationParityProofs.perception.domainReceiptRoot,
    physicalDomainReceiptRoot: status.foundationParityProofs.physical.domainReceiptRoot,
    neuralDomainReceiptRoot: status.foundationParityProofs.neural.domainReceiptRoot,
    geneticDomainReceiptRoot: status.foundationParityProofs.genetic.domainReceiptRoot,
    livingDomainReceiptRoot: status.foundationParityProofs.living.domainReceiptRoot,
    physicalQuantityExtremumCount: status.physicalQuantityEvidence.quantityExtremumCount,
    neuralLoweredTransactionCount: status.foundationParityProofs.neural.loweredCount,
    geneticLoweredStageCount: status.foundationParityProofs.genetic.loweredCount,
    livingLoweredStageCount: status.foundationParityProofs.living.loweredCount,
  }, null, 2));
} catch (error) {
  fail(error?.message ?? String(error), {
    code: error?.code ?? null,
    stack: error?.stack ?? null,
  });
}
