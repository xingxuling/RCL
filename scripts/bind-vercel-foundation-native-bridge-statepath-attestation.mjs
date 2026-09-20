#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FOUNDATION_NATIVE_BRIDGE_SPECS,
  foundationNativeBridgeCapabilityRegistrySnapshot,
} from '../src/foundation-native-bridge-capability-registry.mjs';
import {
  createFoundationNativeBridgeStatePathAttestation,
  expectedFoundationBridgeSemanticResultPath,
} from '../src/foundation-native-bridge-statepath-attestation.mjs';
import { renderFoundationNativeBatchASource } from '../src/foundation-native-bridge.mjs';
import { renderFoundationNativeMetaBatchBSource } from '../src/foundation-native-meta-bridge.mjs';
import { renderFoundationNativeBatchCSource } from '../src/foundation-native-batch-c.mjs';
import { renderFoundationNativeBatchDSource } from '../src/foundation-native-batch-d.mjs';
import { renderFoundationNativeBatchESource } from '../src/foundation-native-batch-e.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const nativeDir = path.join(root, 'native');
const publicDir = path.join(root, 'public');
const manifestPath = path.join(nativeDir, 'rclvm.vercel-attestation.json');
const publicBuildProofPath = path.join(publicDir, 'rcl-native-build-proof.json');
const batchAProofPath = path.join(publicDir, 'rcl-foundation-batch-a-native-bridge-proof.json');
const extensionProofPath = path.join(publicDir, 'rcl-foundation-native-federation-extension-proof.json');
const statePathProofPath = path.join(publicDir, 'rcl-foundation-native-bridge-statepath-attestation.json');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function isSha256(value) {
  return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value);
}

function fail(message, details = {}) {
  console.error(JSON.stringify({
    ok: false,
    status: 'RCL_VERCEL_FOUNDATION_NATIVE_BRIDGE_STATEPATH_BINDING_FAILED',
    message,
    ...details,
  }, null, 2));
  process.exit(1);
}

const renderByBatch = {
  'batch-a': renderFoundationNativeBatchASource,
  'meta-batch-b': renderFoundationNativeMetaBatchBSource,
  'batch-c': renderFoundationNativeBatchCSource,
  'batch-d': renderFoundationNativeBatchDSource,
  'batch-e': renderFoundationNativeBatchESource,
};

try {
  for (const requiredPath of [manifestPath, publicBuildProofPath, batchAProofPath, extensionProofPath]) {
    if (!fs.existsSync(requiredPath)) {
      fail('Required Provider bridge statePath evidence input is missing', { requiredPath });
    }
  }

  const registry = foundationNativeBridgeCapabilityRegistrySnapshot();
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const publicBuildProof = JSON.parse(fs.readFileSync(publicBuildProofPath, 'utf8'));
  const batchAProof = JSON.parse(fs.readFileSync(batchAProofPath, 'utf8'));
  const extensionProof = JSON.parse(fs.readFileSync(extensionProofPath, 'utf8'));
  const federation = manifest?.foundationNativeBridgeFederationProof ?? null;

  if (
    federation?.verified !== true
    || federation?.status !== 'deployment-bound'
    || federation?.providerBridgeRegistryRoot !== registry.registryRoot
    || federation?.providerBridgeSpecCount !== FOUNDATION_NATIVE_BRIDGE_SPECS.length
  ) {
    fail('Provider federation must already be bound to the canonical registry before statePath semantics can be attested', {
      federation,
      registryRoot: registry.registryRoot,
      specCount: FOUNDATION_NATIVE_BRIDGE_SPECS.length,
    });
  }

  if (
    batchAProof?.verified !== true
    || batchAProof?.status !== 'native-bridge-verified'
    || batchAProof?.replayVerified !== true
    || !Array.isArray(batchAProof?.results)
  ) {
    fail('Batch A proof is not strict enough for statePath semantic binding', { batchAProof });
  }
  if (
    extensionProof?.verified !== true
    || extensionProof?.status !== 'native-bridge-federation-verified'
    || !Array.isArray(extensionProof?.batches)
  ) {
    fail('Federation extension proof is not strict enough for statePath semantic binding', { extensionProof });
  }

  const extensionById = Object.fromEntries(extensionProof.batches.map(batch => [batch.id, batch]));
  const renderedByBatch = Object.fromEntries(Object.entries(renderByBatch).map(([batchId, render]) => {
    const rendered = render();
    return [batchId, {
      ...rendered,
      sourceRoot: sha256(rendered.source),
    }];
  }));

  const entries = FOUNDATION_NATIVE_BRIDGE_SPECS.map(spec => {
    const rendered = renderedByBatch[spec.batchId];
    if (!rendered) fail('No canonical source renderer exists for Provider bridge batch', { spec });

    const batch = spec.batchId === 'batch-a' ? batchAProof : extensionById[spec.batchId];
    const result = spec.batchId === 'batch-a'
      ? batchAProof.results.find(item => item?.domain === spec.domain)
      : batch?.results?.find(item => item?.domain === spec.domain);
    const batchSourceRoot = spec.batchId === 'batch-a' ? batchAProof.sourceRoot : batch?.sourceRoot;
    const batchBytecodeRoot = spec.batchId === 'batch-a' ? batchAProof.bytecodeRoot : batch?.bytecodeRoot;
    const batchReceiptRoot = spec.batchId === 'batch-a'
      ? batchAProof.deterministicReceiptRoot
      : batch?.deterministicReceiptRoot;
    const replayVerified = spec.batchId === 'batch-a' ? batchAProof.replayVerified : batch?.replayVerified;

    if (
      !batch
      || !result
      || batchSourceRoot !== rendered.sourceRoot
      || !isSha256(batchBytecodeRoot)
      || !isSha256(batchReceiptRoot)
      || replayVerified !== true
    ) {
      fail('Executed Provider bridge proof is not bound to the exact canonical rendered source and replay receipt', {
        spec,
        observedSourceRoot: batchSourceRoot ?? null,
        expectedSourceRoot: rendered.sourceRoot,
        batchBytecodeRoot: batchBytecodeRoot ?? null,
        batchReceiptRoot: batchReceiptRoot ?? null,
        replayVerified,
      });
    }

    const expectedStateLine = `facet ${spec.statePath} : Text = provider_call(bridge.provider, ${JSON.stringify(spec.capability)},`;
    if (!rendered.source.includes(expectedStateLine)) {
      fail('Canonical rendered source no longer binds capability execution to the registry statePath', {
        spec,
        expectedStateLine,
        sourceRoot: rendered.sourceRoot,
      });
    }

    const semanticResultPath = expectedFoundationBridgeSemanticResultPath(spec.domain);
    const proposalChanges = Array.isArray(result?.proposal?.changes) ? result.proposal.changes : [];
    const stateChanges = Array.isArray(result?.stateDelta?.changes) ? result.stateDelta.changes : [];
    const proposalChange = proposalChanges.find(change => change?.path === semanticResultPath);
    const stateChange = stateChanges.find(change => change?.path === semanticResultPath);
    if (
      result?.domain !== spec.domain
      || result?.proposal?.mode !== 'bridge'
      || result?.proposal?.capability !== spec.capability
      || result?.replayMetadata?.mode !== 'bridge'
      || result?.replayMetadata?.providerId !== spec.providerId
      || result?.replayMetadata?.capability !== spec.capability
      || result?.replayMetadata?.deterministic !== true
      || !proposalChange
      || !stateChange
      || proposalChange.operation !== 'set'
      || stateChange.operation !== 'set'
      || proposalChange.valueRoot !== result?.stateDelta?.afterRoot
      || stateChange.valueRoot !== result?.stateDelta?.afterRoot
      || result?.replayMetadata?.afterRoot !== result?.stateDelta?.afterRoot
      || !isSha256(result?.stateDelta?.beforeRoot)
      || !isSha256(result?.stateDelta?.afterRoot)
    ) {
      fail('Provider result does not preserve the expected statePath-to-domain semantic change contract', {
        spec,
        semanticResultPath,
        result,
      });
    }

    return {
      batchId: spec.batchId,
      providerId: spec.providerId,
      providerCallCount: spec.providerCallCount,
      domain: spec.domain,
      capability: spec.capability,
      statePath: spec.statePath,
      semanticResultPath,
      sourceRoot: rendered.sourceRoot,
      bytecodeRoot: batchBytecodeRoot,
      deterministicReceiptRoot: batchReceiptRoot,
      beforeRoot: result.stateDelta.beforeRoot,
      afterRoot: result.stateDelta.afterRoot,
      sequence: result.replayMetadata.sequence,
      replayVerified: true,
      semanticChangeVerified: true,
    };
  });

  const attestation = createFoundationNativeBridgeStatePathAttestation({ entries });
  manifest.foundationNativeBridgeStatePathAttestation = attestation;
  publicBuildProof.foundationNativeBridgeStatePathAttestation = attestation;

  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  fs.writeFileSync(publicBuildProofPath, `${JSON.stringify(publicBuildProof, null, 2)}\n`);
  fs.writeFileSync(statePathProofPath, `${JSON.stringify(attestation, null, 2)}\n`);

  console.log(JSON.stringify({
    ok: true,
    status: 'RCL_VERCEL_FOUNDATION_NATIVE_BRIDGE_STATEPATH_ATTESTATION_BOUND',
    attestationRoot: attestation.attestationRoot,
    providerBridgeRegistryRoot: attestation.providerBridgeRegistryRoot,
    providerBridgeSpecCount: attestation.providerBridgeSpecCount,
    domains: attestation.entries.map(entry => entry.domain),
    truthBoundary: attestation.truthBoundary,
  }, null, 2));
} catch (error) {
  fail(error?.message ?? String(error), {
    code: error?.code ?? null,
    details: error?.details ?? null,
    stack: error?.stack ?? null,
  });
}
