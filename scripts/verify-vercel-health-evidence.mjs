#!/usr/bin/env node
import { nativeVmDeploymentStatus } from '../api/health.mjs';

const BRIDGE_SPECS = [
  ['quantitative', 'quantitative.evaluate'],
  ['knowledge', 'knowledge.resolve'],
  ['perception', 'perception.observe'],
  ['natural-language-reality', 'natural-language.interpret'],
  ['understanding-reality', 'understanding.model'],
  ['creative-reality', 'creative.generate'],
];

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
  if (status.bundled !== true || status.executable !== true || status.attestationBundled !== true) {
    fail('Native VM deployment artifact is not fully bundled before health evidence verification', { status });
  }
  if (status.replayEvidenceBound !== true || status.foundationParityBound !== true || status.evidenceBound !== true) {
    fail('Deployment health does not fail-closed bind replay and direct Foundation parity evidence', { status });
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

  const expectedBridgeDomains = BRIDGE_SPECS.map(([domain]) => domain);
  if (
    status.foundationNativeBridgeBound !== true
    || status.quantitativeBridgeBound !== true
    || status.knowledgeBridgeBound !== true
    || status.perceptionBridgeBound !== true
    || status.naturalLanguageRealityBridgeBound !== true
    || status.understandingRealityBridgeBound !== true
    || status.creativeRealityBridgeBound !== true
    || status.extendedEvidenceBound !== true
    || JSON.stringify(status.foundationNativeBridgeDomains) !== JSON.stringify(expectedBridgeDomains)
  ) {
    fail('Deployment health did not separately bind the complete proven Foundation Batch A Native Provider Bridge set', { status });
  }

  let sharedHostBinarySha256 = null;
  let sharedHostSourceRoot = null;
  let sharedBytecodeRoot = null;
  let sharedReceiptRoot = null;
  let sharedBatchFinalStateRoot = null;
  for (const [domain, capability] of BRIDGE_SPECS) {
    const proof = status.foundationNativeBridgeProofs?.[domain];
    if (
      proof?.domain !== domain
      || proof?.capability !== capability
      || proof?.mode !== 'native-provider-bridge'
      || proof?.status !== 'native-bridge-verified'
      || proof?.verified !== true
      || proof?.providerId !== 'rcl.foundation.batch-a'
      || proof?.providerAbi !== 1
      || proof?.providerCallCount !== BRIDGE_SPECS.length
      || proof?.canonicalVmSourceRoot !== status.sourceRoot
      || proof?.selfhostByteIdentical !== true
      || proof?.replayVerified !== true
      || proof?.providerDisabledRejected !== true
      || proof?.behaviorMutationVerified !== true
      || proof?.declaredDomainDirectLoweringVerified !== false
    ) {
      fail(`Health evidence lost ${domain} Native Provider Bridge provenance, replay, negative control, or strict direct-lowering truth boundary`, {
        domain,
        capability,
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
      if (!isSha256(value)) fail(`${domain} bridge health evidence is missing a required content-addressed root`, { domain, proof });
    }
    sharedHostBinarySha256 ??= proof.hostBinarySha256;
    sharedHostSourceRoot ??= proof.hostSourceRoot;
    sharedBytecodeRoot ??= proof.bytecodeRoot;
    sharedReceiptRoot ??= proof.deterministicReceiptRoot;
    sharedBatchFinalStateRoot ??= proof.batchFinalStateRoot;
    if (
      proof.hostBinarySha256 !== sharedHostBinarySha256
      || proof.hostSourceRoot !== sharedHostSourceRoot
      || proof.bytecodeRoot !== sharedBytecodeRoot
      || proof.deterministicReceiptRoot !== sharedReceiptRoot
      || proof.batchFinalStateRoot !== sharedBatchFinalStateRoot
    ) {
      fail('Batch A bridge domains are not bound to one common host/source/bytecode/receipt/final-root execution', {
        domain,
        proof,
      });
    }
  }

  const bridgeProofs = BRIDGE_SPECS.map(([domain]) => status.foundationNativeBridgeProofs[domain]);
  for (let index = 1; index < bridgeProofs.length; index += 1) {
    if (bridgeProofs[index].beforeRoot !== bridgeProofs[index - 1].finalStateRoot) {
      fail('Batch A bridge health evidence lost causal state-root chaining between domains', {
        previous: bridgeProofs[index - 1],
        current: bridgeProofs[index],
      });
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
    foundationNativeBridgeDomains: status.foundationNativeBridgeDomains,
    bridgeHostBinarySha256: sharedHostBinarySha256,
    bridgeHostSourceRoot: sharedHostSourceRoot,
    bridgeBytecodeRoot: sharedBytecodeRoot,
    bridgeDeterministicReceiptRoot: sharedReceiptRoot,
    bridgeBatchFinalStateRoot: sharedBatchFinalStateRoot,
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
