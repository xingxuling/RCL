#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const nativeDir = path.join(root, 'native');
const publicDir = path.join(root, 'public');
const vmPath = path.join(nativeDir, process.platform === 'win32' ? 'rclvm.exe' : 'rclvm');
const hostPath = path.join(nativeDir, process.platform === 'win32' ? 'rclfoundation.exe' : 'rclfoundation');
const manifestPath = path.join(nativeDir, 'rclvm.vercel-attestation.json');
const batchAProofPath = path.join(publicDir, 'rcl-foundation-batch-a-native-bridge-proof.json');
const extensionProofPath = path.join(publicDir, 'rcl-foundation-native-federation-extension-proof.json');
const conformancePath = path.join(root, 'foundation-conformance.json');
const publicBuildProofPath = path.join(publicDir, 'rcl-native-build-proof.json');

const BRIDGE_SPECS = [
  { batchId: 'batch-a', providerId: 'rcl.foundation.batch-a', providerCallCount: 6, domain: 'quantitative', capability: 'quantitative.evaluate' },
  { batchId: 'batch-a', providerId: 'rcl.foundation.batch-a', providerCallCount: 6, domain: 'knowledge', capability: 'knowledge.resolve' },
  { batchId: 'batch-a', providerId: 'rcl.foundation.batch-a', providerCallCount: 6, domain: 'perception', capability: 'perception.observe' },
  { batchId: 'batch-a', providerId: 'rcl.foundation.batch-a', providerCallCount: 6, domain: 'natural-language-reality', capability: 'natural-language.interpret' },
  { batchId: 'batch-a', providerId: 'rcl.foundation.batch-a', providerCallCount: 6, domain: 'understanding-reality', capability: 'understanding.model' },
  { batchId: 'batch-a', providerId: 'rcl.foundation.batch-a', providerCallCount: 6, domain: 'creative-reality', capability: 'creative.generate' },
  { batchId: 'meta-batch-b', providerId: 'rcl.foundation.meta-batch-b', providerCallCount: 3, domain: 'meta-spacetime', capability: 'meta.spacetime.sequence' },
  { batchId: 'meta-batch-b', providerId: 'rcl.foundation.meta-batch-b', providerCallCount: 3, domain: 'meta-acceleration', capability: 'meta.acceleration.bound' },
  { batchId: 'meta-batch-b', providerId: 'rcl.foundation.meta-batch-b', providerCallCount: 3, domain: 'meta-compression', capability: 'meta.compression.restore' },
  { batchId: 'batch-c', providerId: 'rcl.foundation.batch-c', providerCallCount: 2, domain: 'physical', capability: 'physical.simulate-step' },
  { batchId: 'batch-c', providerId: 'rcl.foundation.batch-c', providerCallCount: 2, domain: 'embodiment', capability: 'embodiment.integrate' },
  { batchId: 'batch-d', providerId: 'rcl.foundation.batch-d', providerCallCount: 3, domain: 'energy', capability: 'energy.balance' },
  { batchId: 'batch-d', providerId: 'rcl.foundation.batch-d', providerCallCount: 3, domain: 'elemental', capability: 'elemental.compose' },
  { batchId: 'batch-d', providerId: 'rcl.foundation.batch-d', providerCallCount: 3, domain: 'neural', capability: 'neural.integrate' },
  { batchId: 'batch-e', providerId: 'rcl.foundation.batch-e', providerCallCount: 2, domain: 'metacomputation', capability: 'metacomputation.plan' },
  { batchId: 'batch-e', providerId: 'rcl.foundation.batch-e', providerCallCount: 2, domain: 'computation', capability: 'computation.execute' },
];

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}
function isSha256(value) {
  return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value);
}
function fail(message, details = {}) {
  console.error(JSON.stringify({
    ok: false,
    status: 'RCL_VERCEL_FOUNDATION_NATIVE_FEDERATION_BINDING_FAILED',
    message,
    ...details,
  }, null, 2));
  process.exit(1);
}

try {
  for (const requiredPath of [vmPath, hostPath, manifestPath, batchAProofPath, extensionProofPath, conformancePath]) {
    if (!fs.existsSync(requiredPath)) fail('Required Native Provider federation deployment evidence input is missing', { requiredPath });
  }

  const canonicalVmBinarySha256 = sha256(fs.readFileSync(vmPath));
  const hostBinarySha256 = sha256(fs.readFileSync(hostPath));
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const batchAProofBytes = fs.readFileSync(batchAProofPath);
  const batchAProof = JSON.parse(batchAProofBytes.toString('utf8'));
  const extensionProofBytes = fs.readFileSync(extensionProofPath);
  const extensionProof = JSON.parse(extensionProofBytes.toString('utf8'));
  const conformanceBytes = fs.readFileSync(conformancePath);
  const conformance = JSON.parse(conformanceBytes.toString('utf8'));

  if (
    manifest?.format !== 'taowind.rcl-vercel-native-artifact.v0.3'
    || manifest?.binarySha256 !== canonicalVmBinarySha256
    || manifest?.replayProof?.attestationBinarySha256 !== canonicalVmBinarySha256
    || manifest?.replayProof?.stateRootVerified !== true
    || manifest?.replayProof?.stateRootParity !== true
    || !isSha256(manifest?.sourceMaterialization?.sourceRoot)
  ) {
    fail('Canonical VM deployment attestation is not valid enough to bind the provider federation', {
      canonicalVmBinarySha256,
      manifestFormat: manifest?.format ?? null,
      sourceRoot: manifest?.sourceMaterialization?.sourceRoot ?? null,
    });
  }

  if (
    batchAProof?.format !== 'taowind.rcl-vercel-foundation-batch-a-native-bridge-proof.v0.1'
    || batchAProof?.status !== 'native-bridge-verified'
    || batchAProof?.verified !== true
    || batchAProof?.hostBinarySha256 !== hostBinarySha256
    || batchAProof?.providerId !== 'rcl.foundation.batch-a'
    || batchAProof?.providerAbi !== 1
    || batchAProof?.providerCallCount !== 6
    || batchAProof?.truthBoundary?.declaredDomainDirectLoweringVerified !== false
  ) {
    fail('Batch A bridge proof cannot anchor the provider federation', { batchAProof });
  }

  if (
    extensionProof?.format !== 'taowind.rcl-vercel-foundation-native-provider-federation-extension-proof.v0.1'
    || extensionProof?.status !== 'native-bridge-federation-verified'
    || extensionProof?.verified !== true
    || extensionProof?.executionMode !== 'native-provider-bridge'
    || extensionProof?.hostBinarySha256 !== hostBinarySha256
    || extensionProof?.compilerBinarySha256 !== batchAProof.compilerBinarySha256
    || extensionProof?.hostSourceRoot !== batchAProof.hostSourceRoot
    || extensionProof?.batchAProofSha256 !== sha256(batchAProofBytes)
    || extensionProof?.totalProviderCallCount !== 10
    || extensionProof?.domains?.length !== 10
    || extensionProof?.truthBoundary?.declaredDomainDirectLoweringVerified !== false
    || extensionProof?.truthBoundary?.deploymentHealthBound !== false
  ) {
    fail('Federation extension proof is not bound to the exact Batch A C host/compiler/source execution', { extensionProof });
  }

  if (
    conformance?.format !== 'taowind.foundation-conformance-report.v0.1'
    || conformance?.status !== 'pass'
    || !isSha256(conformance?.contract?.root)
    || !Array.isArray(conformance?.checks)
    || conformance.checks.some(item => item?.passed !== true)
  ) {
    fail('Foundation federation conformance report is not a complete passing evidence set', {
      format: conformance?.format ?? null,
      status: conformance?.status ?? null,
      contractRoot: conformance?.contract?.root ?? null,
      failed: conformance?.checks?.filter(item => item?.passed !== true)?.map(item => item?.id) ?? null,
    });
  }
  const nativeBoundary = conformance.checks.find(item => item?.id === 'native-boundary-explicit');
  if (nativeBoundary?.passed !== true || !conformance?.executionLayers?.nativeVmLimitation) {
    fail('Conformance evidence no longer keeps provider bridge mode separate from declared-domain direct lowering', {
      nativeBoundary,
      nativeVmLimitation: conformance?.executionLayers?.nativeVmLimitation ?? null,
    });
  }

  const layerByBatch = {
    'batch-a': conformance.executionLayers?.nativeProviderBridge,
    'meta-batch-b': conformance.executionLayers?.nativeMetaProviderBridge,
    'batch-c': conformance.executionLayers?.nativeBatchCProviderBridge,
    'batch-d': conformance.executionLayers?.nativeBatchDProviderBridge,
    'batch-e': conformance.executionLayers?.nativeBatchEProviderBridge,
  };
  const extensionById = Object.fromEntries(extensionProof.batches.map(batch => [batch.id, batch]));
  const expectedDomainsByBatch = Object.fromEntries(
    [...new Set(BRIDGE_SPECS.map(spec => spec.batchId))].map(batchId => [
      batchId,
      BRIDGE_SPECS.filter(spec => spec.batchId === batchId).map(spec => spec.domain),
    ]),
  );

  for (const [batchId, expectedDomains] of Object.entries(expectedDomainsByBatch)) {
    const layer = layerByBatch[batchId];
    const expectedProviderId = BRIDGE_SPECS.find(spec => spec.batchId === batchId).providerId;
    if (
      layer?.mode !== 'bridge'
      || layer?.providerId !== expectedProviderId
      || layer?.providerAbi !== 1
      || JSON.stringify(layer?.domains) !== JSON.stringify(expectedDomains)
      || !isSha256(layer?.bytecodeRoot)
      || !isSha256(layer?.deterministicReceiptRoot)
      || !isSha256(layer?.finalStateRoot)
    ) {
      fail('Conformance execution layer no longer matches the expected provider batch contract', {
        batchId,
        expectedProviderId,
        expectedDomains,
        layer,
      });
    }
    if (batchId === 'batch-a') {
      if (
        layer.bytecodeRoot !== batchAProof.bytecodeRoot
        || layer.deterministicReceiptRoot !== batchAProof.deterministicReceiptRoot
        || layer.finalStateRoot !== batchAProof.finalStateRoot
      ) {
        fail('Conformance Batch A roots diverge from the strict Batch A bridge proof', { layer, batchAProof });
      }
    } else {
      const batch = extensionById[batchId];
      if (
        !batch
        || layer.bytecodeRoot !== batch.bytecodeRoot
        || layer.deterministicReceiptRoot !== batch.deterministicReceiptRoot
        || layer.finalStateRoot !== batch.finalStateRoot
        || batch.replayVerified !== true
        || batch.selfhostByteIdentical !== true
        || batch.negativeControl?.providerDisabledRejected !== true
        || batch.behaviorMutation?.verified !== true
      ) {
        fail('Conformance batch roots diverge from the strict federation extension proof', { batchId, layer, batch });
      }
    }
  }

  const existingBatchAProofs = manifest?.foundationNativeBridgeProofs ?? {};
  const proofs = {};
  for (const spec of BRIDGE_SPECS) {
    if (spec.batchId === 'batch-a') {
      const proof = existingBatchAProofs[spec.domain];
      if (
        proof?.domain !== spec.domain
        || proof?.capability !== spec.capability
        || proof?.providerId !== spec.providerId
        || proof?.providerCallCount !== spec.providerCallCount
        || proof?.verified !== true
        || proof?.hostBinarySha256 !== hostBinarySha256
        || proof?.canonicalVmSourceRoot !== manifest.sourceMaterialization.sourceRoot
        || proof?.declaredDomainDirectLoweringVerified !== false
      ) {
        fail('Existing Batch A per-domain deployment proof is not strict enough to join federation evidence', { spec, proof });
      }
      proofs[spec.domain] = { ...proof, batchId: spec.batchId };
      continue;
    }

    const batch = extensionById[spec.batchId];
    const result = batch?.results?.find(item => item?.domain === spec.domain);
    if (
      !batch
      || !result
      || result?.proposal?.capability !== spec.capability
      || result?.replayMetadata?.providerId !== spec.providerId
      || result?.replayMetadata?.deterministic !== true
      || result?.replayMetadata?.aifDecision !== 'stable'
      || !Array.isArray(result?.authorityRequired)
      || result.authorityRequired.length === 0
      || !Array.isArray(result?.evidence)
      || result.evidence.length === 0
      || !isSha256(result?.stateDelta?.beforeRoot)
      || !isSha256(result?.stateDelta?.afterRoot)
    ) {
      fail('Extension batch domain result cannot be promoted into deployment evidence', { spec, batch, result });
    }
    proofs[spec.domain] = {
      format: extensionProof.format,
      version: extensionProof.version,
      batchId: spec.batchId,
      domain: spec.domain,
      capability: spec.capability,
      mode: 'native-provider-bridge',
      status: 'native-bridge-verified',
      verified: true,
      providerId: spec.providerId,
      providerAbi: 1,
      providerCallCount: spec.providerCallCount,
      hostBinarySha256: extensionProof.hostBinarySha256,
      compilerBinarySha256: extensionProof.compilerBinarySha256,
      hostSourceRoot: extensionProof.hostSourceRoot,
      canonicalVmSourceRoot: manifest.sourceMaterialization.sourceRoot,
      sourceRoot: batch.sourceRoot,
      bytecodeRoot: batch.bytecodeRoot,
      deterministicReceiptRoot: batch.deterministicReceiptRoot,
      batchFinalStateRoot: batch.finalStateRoot,
      beforeRoot: result.stateDelta.beforeRoot,
      finalStateRoot: result.stateDelta.afterRoot,
      selfhostByteIdentical: true,
      replayVerified: true,
      providerDisabledRejected: true,
      behaviorMutationVerified: true,
      authorityCount: result.authorityRequired.length,
      evidenceCount: result.evidence.length,
      declaredDomainDirectLoweringVerified: false,
    };
  }

  const providerBatches = Object.fromEntries(Object.entries(expectedDomainsByBatch).map(([batchId, domains]) => {
    const first = proofs[domains[0]];
    return [batchId, {
      providerId: first.providerId,
      providerAbi: first.providerAbi,
      providerCallCount: first.providerCallCount,
      domains,
      bytecodeRoot: first.bytecodeRoot,
      deterministicReceiptRoot: first.deterministicReceiptRoot,
      finalStateRoot: first.batchFinalStateRoot,
    }];
  }));
  const federationCore = {
    format: 'taowind.rcl-vercel-foundation-native-provider-federation.v0.1',
    domains: BRIDGE_SPECS.map(spec => spec.domain),
    providerBatches,
    hostBinarySha256,
    compilerBinarySha256: batchAProof.compilerBinarySha256,
    hostSourceRoot: batchAProof.hostSourceRoot,
    canonicalVmSourceRoot: manifest.sourceMaterialization.sourceRoot,
    conformanceContractRoot: conformance.contract.root,
    conformanceReportSha256: sha256(conformanceBytes),
    batchAProofSha256: sha256(batchAProofBytes),
    extensionProofSha256: sha256(extensionProofBytes),
    declaredDomainDirectLoweringVerified: false,
  };
  const federationProof = {
    ...federationCore,
    federationRoot: sha256(Buffer.from(JSON.stringify(federationCore))),
    verified: true,
    status: 'deployment-bound',
  };

  manifest.foundationNativeBridgeDomains = federationCore.domains;
  manifest.foundationNativeBridgeProofs = proofs;
  manifest.foundationNativeBridgeFederationProof = federationProof;
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const publicBuildProof = fs.existsSync(publicBuildProofPath)
    ? JSON.parse(fs.readFileSync(publicBuildProofPath, 'utf8'))
    : {};
  publicBuildProof.foundationNativeBridgeDomains = federationCore.domains;
  publicBuildProof.foundationNativeBridgeProofs = proofs;
  publicBuildProof.foundationNativeBridgeFederation = federationProof;
  fs.writeFileSync(publicBuildProofPath, `${JSON.stringify(publicBuildProof, null, 2)}\n`);

  console.log(JSON.stringify({
    ok: true,
    status: 'RCL_VERCEL_FOUNDATION_NATIVE_PROVIDER_FEDERATION_DEPLOYMENT_BOUND',
    canonicalVmBinarySha256,
    canonicalVmSourceRoot: manifest.sourceMaterialization.sourceRoot,
    hostBinarySha256,
    hostSourceRoot: batchAProof.hostSourceRoot,
    federationRoot: federationProof.federationRoot,
    conformanceContractRoot: federationProof.conformanceContractRoot,
    foundationNativeBridgeDomains: federationCore.domains,
    providerBatches,
    declaredDomainDirectLoweringVerified: false,
  }, null, 2));
} catch (error) {
  fail(error?.message ?? String(error), {
    code: error?.code ?? null,
    details: error?.details ?? null,
    stack: error?.stack ?? null,
  });
}
