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
const proofPath = path.join(publicDir, 'rcl-foundation-batch-a-native-bridge-proof.json');
const publicBuildProofPath = path.join(publicDir, 'rcl-native-build-proof.json');

const BRIDGE_DOMAINS = [
  ['quantitative', 'quantitative.evaluate'],
  ['knowledge', 'knowledge.resolve'],
  ['perception', 'perception.observe'],
  ['natural-language-reality', 'natural-language.interpret'],
  ['understanding-reality', 'understanding.model'],
  ['creative-reality', 'creative.generate'],
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
    status: 'RCL_VERCEL_FOUNDATION_BATCH_A_BRIDGE_BINDING_FAILED',
    message,
    ...details,
  }, null, 2));
  process.exit(1);
}

try {
  for (const requiredPath of [target, manifestPath, proofPath]) {
    if (!fs.existsSync(requiredPath)) fail('Required Batch A bridge deployment evidence input is missing', { requiredPath });
  }

  const binarySha256 = sha256(fs.readFileSync(target));
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const proof = JSON.parse(fs.readFileSync(proofPath, 'utf8'));

  if (
    manifest?.format !== 'taowind.rcl-vercel-native-artifact.v0.3'
    || manifest?.binarySha256 !== binarySha256
    || manifest?.replayProof?.attestationBinarySha256 !== binarySha256
    || manifest?.replayProof?.stateRootVerified !== true
    || manifest?.replayProof?.stateRootParity !== true
    || !isSha256(manifest?.sourceMaterialization?.sourceRoot)
  ) {
    fail('Canonical deployment attestation is not valid enough to bind Batch A Native Provider proof', {
      binarySha256,
      manifestFormat: manifest?.format ?? null,
      manifestBinarySha256: manifest?.binarySha256 ?? null,
      sourceRoot: manifest?.sourceMaterialization?.sourceRoot ?? null,
    });
  }

  if (
    proof?.format !== 'taowind.rcl-vercel-foundation-batch-a-native-bridge-proof.v0.1'
    || proof?.status !== 'native-bridge-verified'
    || proof?.verified !== true
    || proof?.providerId !== 'rcl.foundation.batch-a'
    || proof?.providerAbi !== 1
    || proof?.providerCallCount !== BRIDGE_DOMAINS.length
    || proof?.selfhostByteIdentical !== true
    || proof?.replayVerified !== true
    || proof?.negativeControl?.providerDisabledRejected !== true
    || proof?.behaviorMutation?.verified !== true
    || proof?.truthBoundary?.executionMode !== 'native-provider-bridge'
    || proof?.truthBoundary?.declaredDomainDirectLoweringVerified !== false
    || proof?.truthBoundary?.deploymentHealthBound !== false
    || !isSha256(proof?.hostBinarySha256)
    || !isSha256(proof?.compilerBinarySha256)
    || !isSha256(proof?.hostSourceRoot)
    || !isSha256(proof?.sourceRoot)
    || !isSha256(proof?.bytecodeRoot)
    || !isSha256(proof?.deterministicReceiptRoot)
    || !isSha256(proof?.finalStateRoot)
    || !Array.isArray(proof?.results)
    || proof.results.length !== BRIDGE_DOMAINS.length
  ) {
    fail('Standalone Batch A Native Provider proof does not satisfy its strict truth-boundary contract', { proof });
  }

  for (const name of ['rclvm.c', 'rclvm.h', 'foundation_provider.c', 'rclc.c', 'Makefile']) {
    const current = sha256(fs.readFileSync(path.join(nativeDir, name)));
    if (proof?.hostSourceFiles?.[name] !== current) {
      fail('Batch A bridge proof is not derived from the exact current repository native source material', {
        name,
        expected: current,
        actual: proof?.hostSourceFiles?.[name] ?? null,
      });
    }
  }

  const proofs = {};
  BRIDGE_DOMAINS.forEach(([domain, capability], index) => {
    const result = proof.results[index];
    if (
      result?.domain !== domain
      || result?.proposal?.mode !== 'bridge'
      || result?.proposal?.capability !== capability
      || result?.replayMetadata?.mode !== 'bridge'
      || result?.replayMetadata?.providerId !== 'rcl.foundation.batch-a'
      || result?.replayMetadata?.deterministic !== true
      || result?.replayMetadata?.aifDecision !== 'stable'
      || !Array.isArray(result?.authorityRequired)
      || result.authorityRequired.length === 0
      || !Array.isArray(result?.evidence)
      || result.evidence.length === 0
      || !isSha256(result?.stateDelta?.beforeRoot)
      || !isSha256(result?.stateDelta?.afterRoot)
    ) {
      fail('Batch A bridge result cannot be bound because a per-domain contract failed', { domain, capability, result });
    }
    proofs[domain] = {
      format: proof.format,
      version: proof.version,
      domain,
      capability,
      mode: 'native-provider-bridge',
      status: proof.status,
      verified: true,
      providerId: proof.providerId,
      providerAbi: proof.providerAbi,
      providerCallCount: proof.providerCallCount,
      hostBinarySha256: proof.hostBinarySha256,
      compilerBinarySha256: proof.compilerBinarySha256,
      hostSourceRoot: proof.hostSourceRoot,
      canonicalVmSourceRoot: manifest.sourceMaterialization.sourceRoot,
      sourceRoot: proof.sourceRoot,
      bytecodeRoot: proof.bytecodeRoot,
      deterministicReceiptRoot: proof.deterministicReceiptRoot,
      batchFinalStateRoot: proof.finalStateRoot,
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
  });

  manifest.foundationNativeBridgeProofs = proofs;
  manifest.foundationQuantitativeNativeBridgeProof = proofs.quantitative;
  manifest.foundationBatchANativeBridgeProof = {
    format: proof.format,
    domains: BRIDGE_DOMAINS.map(([domain]) => domain),
    providerId: proof.providerId,
    providerAbi: proof.providerAbi,
    providerCallCount: proof.providerCallCount,
    hostBinarySha256: proof.hostBinarySha256,
    compilerBinarySha256: proof.compilerBinarySha256,
    hostSourceRoot: proof.hostSourceRoot,
    canonicalVmSourceRoot: manifest.sourceMaterialization.sourceRoot,
    sourceRoot: proof.sourceRoot,
    bytecodeRoot: proof.bytecodeRoot,
    deterministicReceiptRoot: proof.deterministicReceiptRoot,
    finalStateRoot: proof.finalStateRoot,
    providerDisabledRejected: true,
    behaviorMutationVerified: true,
    declaredDomainDirectLoweringVerified: false,
  };
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const publicBuildProof = fs.existsSync(publicBuildProofPath)
    ? JSON.parse(fs.readFileSync(publicBuildProofPath, 'utf8'))
    : {};
  publicBuildProof.foundationNativeBridgeDomains = BRIDGE_DOMAINS.map(([domain]) => domain);
  publicBuildProof.foundationNativeBridgeProofs = proofs;
  publicBuildProof.foundationBatchANativeBridge = manifest.foundationBatchANativeBridgeProof;
  publicBuildProof.foundationQuantitativeNativeBridge = proofs.quantitative;
  fs.writeFileSync(publicBuildProofPath, `${JSON.stringify(publicBuildProof, null, 2)}\n`);

  console.log(JSON.stringify({
    ok: true,
    status: 'RCL_VERCEL_FOUNDATION_BATCH_A_BRIDGE_DEPLOYMENT_BOUND',
    canonicalVmBinarySha256: binarySha256,
    canonicalVmSourceRoot: manifest.sourceMaterialization.sourceRoot,
    bridgeHostBinarySha256: proof.hostBinarySha256,
    bridgeHostSourceRoot: proof.hostSourceRoot,
    bytecodeRoot: proof.bytecodeRoot,
    deterministicReceiptRoot: proof.deterministicReceiptRoot,
    batchFinalStateRoot: proof.finalStateRoot,
    foundationNativeBridgeDomains: BRIDGE_DOMAINS.map(([domain]) => domain),
    providerCallCount: proof.providerCallCount,
    declaredDomainDirectLoweringVerified: false,
  }, null, 2));
} catch (error) {
  fail(error?.message ?? String(error), {
    code: error?.code ?? null,
    details: error?.details ?? null,
    stack: error?.stack ?? null,
  });
}
