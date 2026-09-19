import crypto from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { RCL_MCP_SERVER_NAME, RCL_MCP_SERVER_VERSION, listRclMcpTools } from '../src/rcl-mcp-server.mjs';
import {
  FOUNDATION_NATIVE_BRIDGE_SPECS,
  foundationNativeBridgeCapabilityRegistrySnapshot,
} from '../src/foundation-native-bridge-capability-registry.mjs';

const NATIVE_VM_PATH = fileURLToPath(new URL('../native/rclvm', import.meta.url));
const NATIVE_VM_ATTESTATION_PATH = fileURLToPath(new URL('../native/rclvm.vercel-attestation.json', import.meta.url));

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function isSha256(value) {
  return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value);
}

function coreParityBound(proof, domain, binarySha256) {
  return Boolean(
    proof?.domain === domain
    && proof?.status === 'native-verified'
    && proof?.verified === true
    && Number(proof?.loweredCount ?? 0) >= 1
    && proof?.parity?.state === true
    && proof?.parity?.semanticStateRoot === true
    && proof?.parity?.nativeStateRootVerified === true
    && proof?.parity?.nativeStateRootParity === true
    && proof?.parity?.loweringLineage === true
    && proof?.parity?.domainReceipt === true
    && proof?.parity?.nativeExecutionAttestation === true
    && proof?.executionBinarySha256 === binarySha256
    && isSha256(proof?.foundationDomainReceiptRoot)
    && isSha256(proof?.nativeVmExecutionAttestationRoot)
  );
}

function physicalQuantityEvidenceBound(proof, binarySha256) {
  const position = proof?.finalState?.['world.stone.position'];
  const velocity = proof?.finalState?.['world.stone.velocity'];
  return Boolean(
    coreParityBound(proof, 'physical', binarySha256)
    && proof?.loweredCount === 2
    && Number(proof?.quantityNativeLowering?.summary?.quantityConstructorCount ?? 0) >= 1
    && Number(proof?.quantityNativeLowering?.summary?.quantityBinaryCount ?? 0) >= 1
    && Number(proof?.quantityNativeLowering?.summary?.quantityExtremumCount ?? 0) >= 1
    && proof?.quantityNativeLowering?.truthBoundary?.quantityMetadataRetained === true
    && proof?.quantityNativeLowering?.truthBoundary?.quantityExtremaLoweredViaPureChoose === true
    && proof?.quantityNativeLowering?.truthBoundary?.nativeVmOpcodeExtensionRequired === false
    && position?.kind === 'Quantity'
    && position?.type === 'Length'
    && position?.unit === 'm'
    && position?.value === 12
    && velocity?.kind === 'Quantity'
    && velocity?.type === 'Velocity'
    && velocity?.unit === 'm/s'
    && velocity?.value === 1
  );
}

function neuralEvidenceBound(proof, binarySha256) {
  return Boolean(
    coreParityBound(proof, 'neural', binarySha256)
    && proof?.loweredCount === 4
    && proof?.boundedSteps === 2
    && proof?.pathwayCount === 2
    && proof?.activePathway === 'brain.integrate'
    && proof?.inactivePathway === 'brain.dormant'
    && proof?.finalState?.['brain.stimulus'] === 1
    && proof?.finalState?.['brain.response'] === 1
    && proof?.finalState?.['brain.trace'] === 0
  );
}

function geneticEvidenceBound(proof, binarySha256) {
  return Boolean(
    coreParityBound(proof, 'genetic', binarySha256)
    && proof?.loweredCount === 4
    && proof?.generationCount === 2
    && proof?.stageCount === 4
    && isSha256(proof?.foundationCompositeReceiptRoot)
    && proof?.finalState?.['lineage.seed'] === 5
    && proof?.finalState?.['lineage.trait'] === 15
  );
}

function livingEvidenceBound(proof, binarySha256) {
  return Boolean(
    coreParityBound(proof, 'living', binarySha256)
    && proof?.loweredCount === 6
    && proof?.boundedSteps === 2
    && proof?.stageCount === 6
    && proof?.unchangedSenseNegativeEvidenceBound === true
    && isSha256(proof?.foundationCompositeReceiptRoot)
    && proof?.finalState?.['organism.foodSense'] === 4
    && proof?.finalState?.['organism.energy'] === 9
    && proof?.finalState?.['organism.health'] === 3
  );
}

function quantitativeDirectEvidenceBound(proof, binarySha256, attestation) {
  const measurement = proof?.finalState?.['sensor.temperature'];
  const healthy = proof?.finalState?.['sensor.healthy'];
  const summary = proof?.loweringSummary;
  const loweringTruth = proof?.loweringTruthBoundary;
  const truth = proof?.truthBoundary;
  return Boolean(
    proof?.format === 'taowind.rcl-vercel-foundation-quantitative-direct-native-proof.v0.1'
    && proof?.domain === 'quantitative'
    && proof?.status === 'native-direct-verified'
    && proof?.verified === true
    && proof?.executionMode === 'declared-domain-direct-lowering'
    && isSha256(proof?.proofSha256)
    && proof?.binarySha256 === binarySha256
    && proof?.executionBinarySha256 === binarySha256
    && isSha256(proof?.canonicalVmSourceRoot)
    && proof?.canonicalVmSourceRoot === attestation?.sourceMaterialization?.sourceRoot
    && isSha256(proof?.nativeStateRoot)
    && proof?.stateRootVerified === true
    && proof?.stateRootParity === true
    && proof?.transactionWitnessObserved === true
    && summary?.quantitativeLoweredDeclarationCount === 1
    && summary?.consumedDirectiveCount === 1
    && summary?.syntheticRuleCount === 1
    && summary?.remainingQuantitativeCount === 0
    && summary?.measurementRecordCount === 1
    && loweringTruth?.declaredQuantitativeDirectLoweringImplemented === true
    && loweringTruth?.declaredQuantitativeDirectLoweringVerified === false
    && loweringTruth?.measurementValueUncertaintyConfidenceUnitScaleRetained === true
    && loweringTruth?.measurementEvidenceRetainedAsCanonicalJsonText === true
    && loweringTruth?.measurementCalibrationIdentityRetained === true
    && loweringTruth?.measurementAccessorsLoweredToTypedRecordFields === true
    && loweringTruth?.quantitativeDomainReceiptParityClaimed === false
    && loweringTruth?.referenceRuntimeParityClaimed === false
    && loweringTruth?.providerBridgeRemovedGlobally === false
    && loweringTruth?.allFoundationDomainsNativeClaimed === false
    && truth?.declaredDomainDirectLoweringVerified === true
    && truth?.domain === 'quantitative'
    && truth?.providerBridgeUsedForThisProof === false
    && truth?.referenceRuntimeParityClaimed === false
    && truth?.domainReceiptParityClaimed === false
    && truth?.deploymentHealthBound === true
    && truth?.providerBridgeRemovedGlobally === false
    && truth?.allFoundationDomainsNativeClaimed === false
    && measurement?.kind === 'Measurement'
    && measurement?.baseType === 'Temperature'
    && measurement?.value?.kind === 'Quantity'
    && measurement?.value?.type === 'Temperature'
    && measurement?.value?.value === 8
    && measurement?.value?.unit === '°C'
    && measurement?.uncertainty?.kind === 'Quantity'
    && measurement?.uncertainty?.type === 'Temperature'
    && measurement?.uncertainty?.value === 0.2
    && measurement?.uncertainty?.unit === '°C'
    && measurement?.confidence === 0.98
    && measurement?.unit === '°C'
    && measurement?.scale === 'interval'
    && measurement?.evidence === '["sensor:ambient-v1"]'
    && measurement?.calibratedBy === 'calibration:ambient-v1'
    && measurement?.hasUnit === true
    && measurement?.hasCalibration === true
    && healthy === true
  );
}

function nativeBridgeFederationBound(federation, attestation) {
  const expectedDomains = FOUNDATION_NATIVE_BRIDGE_SPECS.map(spec => spec.domain);
  return Boolean(
    federation?.format === 'taowind.rcl-vercel-foundation-native-provider-federation.v0.1'
    && federation?.status === 'deployment-bound'
    && federation?.verified === true
    && JSON.stringify(federation?.domains) === JSON.stringify(expectedDomains)
    && federation?.canonicalVmSourceRoot === attestation?.sourceMaterialization?.sourceRoot
    && federation?.declaredDomainDirectLoweringVerified === false
    && isSha256(federation?.hostBinarySha256)
    && isSha256(federation?.compilerBinarySha256)
    && isSha256(federation?.hostSourceRoot)
    && isSha256(federation?.conformanceContractRoot)
    && isSha256(federation?.conformanceReportSha256)
    && isSha256(federation?.batchAProofSha256)
    && isSha256(federation?.extensionProofSha256)
    && isSha256(federation?.federationRoot)
  );
}

function nativeBridgeEvidenceBound(proof, spec, attestation, federation) {
  return Boolean(
    proof?.batchId === spec.batchId
    && proof?.domain === spec.domain
    && proof?.capability === spec.capability
    && proof?.mode === 'native-provider-bridge'
    && proof?.status === 'native-bridge-verified'
    && proof?.verified === true
    && proof?.providerId === spec.providerId
    && proof?.providerAbi === 1
    && proof?.providerCallCount === spec.providerCallCount
    && proof?.selfhostByteIdentical === true
    && proof?.replayVerified === true
    && proof?.providerDisabledRejected === true
    && proof?.behaviorMutationVerified === true
    && proof?.declaredDomainDirectLoweringVerified === false
    && Number(proof?.authorityCount ?? 0) >= 1
    && Number(proof?.evidenceCount ?? 0) >= 1
    && proof?.hostBinarySha256 === federation?.hostBinarySha256
    && proof?.compilerBinarySha256 === federation?.compilerBinarySha256
    && proof?.hostSourceRoot === federation?.hostSourceRoot
    && isSha256(proof?.canonicalVmSourceRoot)
    && proof?.canonicalVmSourceRoot === attestation?.sourceMaterialization?.sourceRoot
    && isSha256(proof?.sourceRoot)
    && isSha256(proof?.bytecodeRoot)
    && isSha256(proof?.deterministicReceiptRoot)
    && isSha256(proof?.batchFinalStateRoot)
    && isSha256(proof?.beforeRoot)
    && isSha256(proof?.finalStateRoot)
  );
}

function proofSummary(proof) {
  if (!proof) return null;
  return {
    domain: proof.domain ?? null,
    status: proof.status ?? null,
    verified: proof.verified === true,
    loweredCount: proof.loweredCount ?? null,
    domainReceiptRoot: proof.foundationDomainReceiptRoot ?? null,
    compositeReceiptRoot: proof.foundationCompositeReceiptRoot ?? null,
    nativeVmExecutionAttestationRoot: proof.nativeVmExecutionAttestationRoot ?? null,
    executionBinarySha256: proof.executionBinarySha256 ?? null,
  };
}

function quantitativeDirectSummary(proof) {
  if (!proof) return null;
  return {
    domain: proof.domain ?? null,
    status: proof.status ?? null,
    verified: proof.verified === true,
    executionMode: proof.executionMode ?? null,
    proofSha256: proof.proofSha256 ?? null,
    nativeStateRoot: proof.nativeStateRoot ?? null,
    stateRootVerified: proof.stateRootVerified === true,
    stateRootParity: proof.stateRootParity === true,
    transactionWitnessObserved: proof.transactionWitnessObserved === true,
    executionBinarySha256: proof.executionBinarySha256 ?? null,
    canonicalVmSourceRoot: proof.canonicalVmSourceRoot ?? null,
    loweringSummary: proof.loweringSummary ?? null,
    truthBoundary: proof.truthBoundary ?? null,
    finalState: proof.finalState ?? null,
  };
}

function bridgeProofSummary(proof) {
  if (!proof) return null;
  return {
    batchId: proof.batchId ?? null,
    domain: proof.domain ?? null,
    capability: proof.capability ?? null,
    mode: proof.mode ?? null,
    status: proof.status ?? null,
    verified: proof.verified === true,
    providerId: proof.providerId ?? null,
    providerAbi: proof.providerAbi ?? null,
    providerCallCount: proof.providerCallCount ?? null,
    hostBinarySha256: proof.hostBinarySha256 ?? null,
    compilerBinarySha256: proof.compilerBinarySha256 ?? null,
    hostSourceRoot: proof.hostSourceRoot ?? null,
    canonicalVmSourceRoot: proof.canonicalVmSourceRoot ?? null,
    bytecodeRoot: proof.bytecodeRoot ?? null,
    deterministicReceiptRoot: proof.deterministicReceiptRoot ?? null,
    batchFinalStateRoot: proof.batchFinalStateRoot ?? null,
    beforeRoot: proof.beforeRoot ?? null,
    finalStateRoot: proof.finalStateRoot ?? null,
    selfhostByteIdentical: proof.selfhostByteIdentical === true,
    replayVerified: proof.replayVerified === true,
    providerDisabledRejected: proof.providerDisabledRejected === true,
    behaviorMutationVerified: proof.behaviorMutationVerified === true,
    declaredDomainDirectLoweringVerified: proof.declaredDomainDirectLoweringVerified === true,
  };
}

function federationSummary(federation) {
  if (!federation) return null;
  return {
    format: federation.format ?? null,
    status: federation.status ?? null,
    verified: federation.verified === true,
    domains: Array.isArray(federation.domains) ? [...federation.domains] : [],
    providerBatches: federation.providerBatches ?? null,
    hostBinarySha256: federation.hostBinarySha256 ?? null,
    compilerBinarySha256: federation.compilerBinarySha256 ?? null,
    hostSourceRoot: federation.hostSourceRoot ?? null,
    canonicalVmSourceRoot: federation.canonicalVmSourceRoot ?? null,
    conformanceContractRoot: federation.conformanceContractRoot ?? null,
    federationRoot: federation.federationRoot ?? null,
    declaredDomainDirectLoweringVerified: federation.declaredDomainDirectLoweringVerified === true,
  };
}

export function nativeVmDeploymentStatus() {
  const bridgeRegistry = foundationNativeBridgeCapabilityRegistrySnapshot();
  const bundled = fs.existsSync(NATIVE_VM_PATH);
  const attestationBundled = fs.existsSync(NATIVE_VM_ATTESTATION_PATH);
  let executable = false;
  let binarySha256 = null;
  let attestation = null;

  if (bundled) {
    binarySha256 = sha256(fs.readFileSync(NATIVE_VM_PATH));
    try {
      fs.accessSync(NATIVE_VM_PATH, fs.constants.X_OK);
      executable = true;
    } catch {
      executable = false;
    }
  }

  if (attestationBundled) {
    try {
      attestation = JSON.parse(fs.readFileSync(NATIVE_VM_ATTESTATION_PATH, 'utf8'));
    } catch {
      attestation = null;
    }
  }

  const replayEvidenceBound = Boolean(
    bundled
    && executable
    && attestation
    && attestation.format === 'taowind.rcl-vercel-native-artifact.v0.3'
    && attestation.binarySha256 === binarySha256
    && attestation.replayProof?.stateRootVerified === true
    && attestation.replayProof?.stateRootParity === true
    && attestation.replayProof?.attestationBinarySha256 === binarySha256
    && isSha256(attestation.replayProof?.attestationRoot)
  );

  const perceptionProof = attestation?.foundationParityProofs?.perception ?? attestation?.foundationParityProof ?? null;
  const physicalProof = attestation?.foundationParityProofs?.physical ?? attestation?.foundationPhysicalParityProof ?? null;
  const neuralProof = attestation?.foundationParityProofs?.neural ?? attestation?.foundationNeuralParityProof ?? null;
  const geneticProof = attestation?.foundationParityProofs?.genetic ?? attestation?.foundationGeneticParityProof ?? null;
  const livingProof = attestation?.foundationParityProofs?.living ?? attestation?.foundationLivingParityProof ?? null;
  const quantitativeDirectProof = attestation?.foundationDirectExtensionProofs?.quantitative
    ?? attestation?.foundationQuantitativeDirectProof
    ?? null;

  const perceptionParityBound = Boolean(replayEvidenceBound && coreParityBound(perceptionProof, 'perception', binarySha256));
  const physicalParityBound = Boolean(replayEvidenceBound && physicalQuantityEvidenceBound(physicalProof, binarySha256));
  const neuralParityBound = Boolean(replayEvidenceBound && neuralEvidenceBound(neuralProof, binarySha256));
  const geneticParityBound = Boolean(replayEvidenceBound && geneticEvidenceBound(geneticProof, binarySha256));
  const livingParityBound = Boolean(replayEvidenceBound && livingEvidenceBound(livingProof, binarySha256));
  const quantitativeDirectLoweringBound = Boolean(
    replayEvidenceBound && quantitativeDirectEvidenceBound(quantitativeDirectProof, binarySha256, attestation),
  );
  const foundationParityBound = perceptionParityBound && physicalParityBound && neuralParityBound && geneticParityBound && livingParityBound;
  const foundationParityDomains = [
    ...(perceptionParityBound ? ['perception'] : []),
    ...(physicalParityBound ? ['physical'] : []),
    ...(neuralParityBound ? ['neural'] : []),
    ...(geneticParityBound ? ['genetic'] : []),
    ...(livingParityBound ? ['living'] : []),
  ];
  const foundationDirectExtensionDomains = [
    ...(quantitativeDirectLoweringBound ? ['quantitative'] : []),
  ];

  const federation = attestation?.foundationNativeBridgeFederationProof ?? null;
  const foundationNativeBridgeFederationBound = Boolean(
    replayEvidenceBound && nativeBridgeFederationBound(federation, attestation),
  );
  const bridgeProofs = attestation?.foundationNativeBridgeProofs ?? {};
  const bridgeBounds = Object.fromEntries(FOUNDATION_NATIVE_BRIDGE_SPECS.map(spec => [
    spec.domain,
    Boolean(
      foundationNativeBridgeFederationBound
      && nativeBridgeEvidenceBound(bridgeProofs[spec.domain], spec, attestation, federation)
    ),
  ]));
  const foundationNativeBridgeDomains = FOUNDATION_NATIVE_BRIDGE_SPECS
    .filter(spec => bridgeBounds[spec.domain])
    .map(spec => spec.domain);
  const foundationNativeBridgeBound = foundationNativeBridgeDomains.length === FOUNDATION_NATIVE_BRIDGE_SPECS.length;
  const quantitativeBridgeBound = bridgeBounds.quantitative === true;
  const knowledgeBridgeBound = bridgeBounds.knowledge === true;
  const perceptionBridgeBound = bridgeBounds.perception === true;
  const naturalLanguageRealityBridgeBound = bridgeBounds['natural-language-reality'] === true;
  const understandingRealityBridgeBound = bridgeBounds['understanding-reality'] === true;
  const creativeRealityBridgeBound = bridgeBounds['creative-reality'] === true;
  const evidenceBound = replayEvidenceBound && foundationParityBound;
  const directExtensionEvidenceBound = quantitativeDirectLoweringBound;
  const extendedEvidenceBound = evidenceBound
    && directExtensionEvidenceBound
    && foundationNativeBridgeBound
    && foundationNativeBridgeFederationBound;

  const bridgeSummaries = Object.fromEntries(FOUNDATION_NATIVE_BRIDGE_SPECS.map(spec => [
    spec.domain,
    bridgeProofSummary(bridgeProofs[spec.domain]),
  ]));
  const quantitativeBridgeProof = bridgeProofs.quantitative ?? null;

  return {
    bundled,
    executable,
    attestationBundled,
    replayEvidenceBound,
    foundationParityBound,
    perceptionParityBound,
    physicalParityBound,
    neuralParityBound,
    geneticParityBound,
    livingParityBound,
    quantitativeDirectLoweringBound,
    directExtensionEvidenceBound,
    foundationNativeBridgeFederationBound,
    foundationNativeBridgeBound,
    quantitativeBridgeBound,
    knowledgeBridgeBound,
    perceptionBridgeBound,
    naturalLanguageRealityBridgeBound,
    understandingRealityBridgeBound,
    creativeRealityBridgeBound,
    evidenceBound,
    extendedEvidenceBound,
    binarySha256,
    sourceRoot: attestation?.sourceMaterialization?.sourceRoot ?? null,
    executionAttestationRoot: attestation?.replayProof?.attestationRoot ?? null,
    foundationParityDomains,
    foundationDirectExtensionDomains,
    foundationNativeBridgeRegistryRoot: bridgeRegistry.registryRoot,
    foundationNativeBridgeSpecCount: FOUNDATION_NATIVE_BRIDGE_SPECS.length,
    foundationNativeBridgeDomains,
    foundationNativeBridgeFederation: federationSummary(federation),
    foundationParity: proofSummary(perceptionProof),
    foundationParityProofs: {
      perception: proofSummary(perceptionProof),
      physical: proofSummary(physicalProof),
      neural: proofSummary(neuralProof),
      genetic: proofSummary(geneticProof),
      living: proofSummary(livingProof),
    },
    foundationDirectExtensionProofs: {
      quantitative: quantitativeDirectSummary(quantitativeDirectProof),
    },
    quantitativeDirectEvidence: quantitativeDirectSummary(quantitativeDirectProof),
    foundationNativeBridgeProofs: bridgeSummaries,
    quantitativeBridgeEvidence: quantitativeBridgeProof ? bridgeProofSummary(quantitativeBridgeProof) : null,
    physicalQuantityEvidence: physicalProof ? {
      quantityConstructorCount: physicalProof.quantityNativeLowering?.summary?.quantityConstructorCount ?? null,
      quantityBinaryCount: physicalProof.quantityNativeLowering?.summary?.quantityBinaryCount ?? null,
      quantityExtremumCount: physicalProof.quantityNativeLowering?.summary?.quantityExtremumCount ?? null,
      finalPosition: physicalProof.finalState?.['world.stone.position'] ?? null,
      finalVelocity: physicalProof.finalState?.['world.stone.velocity'] ?? null,
    } : null,
    neuralEvidence: neuralProof ? {
      boundedSteps: neuralProof.boundedSteps ?? null,
      pathwayCount: neuralProof.pathwayCount ?? null,
      activePathway: neuralProof.activePathway ?? null,
      inactivePathway: neuralProof.inactivePathway ?? null,
      finalStimulus: neuralProof.finalState?.['brain.stimulus'] ?? null,
      finalResponse: neuralProof.finalState?.['brain.response'] ?? null,
      finalTrace: neuralProof.finalState?.['brain.trace'] ?? null,
    } : null,
    geneticEvidence: geneticProof ? {
      generationCount: geneticProof.generationCount ?? null,
      stageCount: geneticProof.stageCount ?? null,
      finalSeed: geneticProof.finalState?.['lineage.seed'] ?? null,
      finalTrait: geneticProof.finalState?.['lineage.trait'] ?? null,
    } : null,
    livingEvidence: livingProof ? {
      boundedSteps: livingProof.boundedSteps ?? null,
      stageCount: livingProof.stageCount ?? null,
      unchangedSenseNegativeEvidenceBound: livingProof.unchangedSenseNegativeEvidenceBound === true,
      finalFoodSense: livingProof.finalState?.['organism.foodSense'] ?? null,
      finalEnergy: livingProof.finalState?.['organism.energy'] ?? null,
      finalHealth: livingProof.finalState?.['organism.health'] ?? null,
    } : null,
  };
}

export default function handler(_request, response) {
  const tools = listRclMcpTools();
  response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  response.end(`${JSON.stringify({
    ok: true,
    name: RCL_MCP_SERVER_NAME,
    version: RCL_MCP_SERVER_VERSION,
    endpoint: '/mcp',
    toolCount: tools.length,
    rclToolCount: tools.filter(tool => tool.name.startsWith('rcl_')).length,
    rncsToolCount: tools.filter(tool => tool.name.startsWith('rncs_')).length,
    nativeVmDeployment: nativeVmDeploymentStatus(),
  })}\n`);
}
