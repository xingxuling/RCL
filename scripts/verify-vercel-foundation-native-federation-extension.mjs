#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FOUNDATION_NATIVE_META_BATCH_B,
  normalizeFoundationNativeMetaBatchBRequest,
  runFoundationNativeMetaBatchB,
} from '../src/foundation-native-meta-bridge.mjs';
import {
  FOUNDATION_NATIVE_BATCH_C,
  normalizeFoundationNativeBatchCRequest,
  runFoundationNativeBatchC,
} from '../src/foundation-native-batch-c.mjs';
import {
  FOUNDATION_NATIVE_BATCH_D,
  normalizeFoundationNativeBatchDRequest,
  runFoundationNativeBatchD,
} from '../src/foundation-native-batch-d.mjs';
import {
  FOUNDATION_NATIVE_BATCH_E,
  normalizeFoundationNativeBatchERequest,
  runFoundationNativeBatchE,
} from '../src/foundation-native-batch-e.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const nativeDir = path.join(root, 'native');
const publicDir = path.join(root, 'public');
const hostPath = path.join(nativeDir, process.platform === 'win32' ? 'rclfoundation.exe' : 'rclfoundation');
const compilerPath = path.join(nativeDir, process.platform === 'win32' ? 'rclc.exe' : 'rclc');
const batchAProofPath = path.join(publicDir, 'rcl-foundation-batch-a-native-bridge-proof.json');
const proofPath = path.join(publicDir, 'rcl-foundation-native-federation-extension-proof.json');

const BATCHES = [
  {
    id: 'meta-batch-b',
    providerId: 'rcl.foundation.meta-batch-b',
    entries: FOUNDATION_NATIVE_META_BATCH_B,
    normalize: normalizeFoundationNativeMetaBatchBRequest,
    run: runFoundationNativeMetaBatchB,
  },
  {
    id: 'batch-c',
    providerId: 'rcl.foundation.batch-c',
    entries: FOUNDATION_NATIVE_BATCH_C,
    normalize: normalizeFoundationNativeBatchCRequest,
    run: runFoundationNativeBatchC,
  },
  {
    id: 'batch-d',
    providerId: 'rcl.foundation.batch-d',
    entries: FOUNDATION_NATIVE_BATCH_D,
    normalize: normalizeFoundationNativeBatchDRequest,
    run: runFoundationNativeBatchD,
  },
  {
    id: 'batch-e',
    providerId: 'rcl.foundation.batch-e',
    entries: FOUNDATION_NATIVE_BATCH_E,
    normalize: normalizeFoundationNativeBatchERequest,
    run: runFoundationNativeBatchE,
  },
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
    status: 'RCL_VERCEL_FOUNDATION_NATIVE_FEDERATION_EXTENSION_FAILED',
    message,
    ...details,
  }, null, 2));
  process.exit(1);
}
function sourceEvidence() {
  const files = ['rclvm.c', 'rclvm.h', 'foundation_provider.c', 'rclc.c', 'Makefile'];
  const hashes = Object.fromEntries(files.map(name => [name, sha256(fs.readFileSync(path.join(nativeDir, name)))]));
  return { files: hashes, root: sha256(Buffer.from(JSON.stringify(hashes))) };
}
function counterfactualRequest(request) {
  return {
    ...request,
    input: {
      ...(request?.input ?? {}),
      speechAct: 'inspect',
    },
  };
}

if (process.platform !== 'linux') {
  fail('Hosted Foundation Native Provider federation proof requires the canonical Linux deployment environment', {
    platform: process.platform,
    arch: process.arch,
  });
}

try {
  for (const requiredPath of [hostPath, compilerPath, batchAProofPath]) {
    if (!fs.existsSync(requiredPath)) fail('Required already-materialized federation input is missing', { requiredPath });
  }
  fs.rmSync(proofPath, { force: true });

  const hostBinarySha256 = sha256(fs.readFileSync(hostPath));
  const compilerBinarySha256 = sha256(fs.readFileSync(compilerPath));
  const sources = sourceEvidence();
  const batchAProofBytes = fs.readFileSync(batchAProofPath);
  const batchAProof = JSON.parse(batchAProofBytes.toString('utf8'));
  if (
    batchAProof?.status !== 'native-bridge-verified'
    || batchAProof?.verified !== true
    || batchAProof?.hostBinarySha256 !== hostBinarySha256
    || batchAProof?.compilerBinarySha256 !== compilerBinarySha256
    || batchAProof?.hostSourceRoot !== sources.root
  ) {
    fail('Existing Batch A proof is not bound to the exact same current C host/compiler/source material', {
      hostBinarySha256,
      compilerBinarySha256,
      hostSourceRoot: sources.root,
      batchAProof: {
        status: batchAProof?.status ?? null,
        verified: batchAProof?.verified ?? false,
        hostBinarySha256: batchAProof?.hostBinarySha256 ?? null,
        compilerBinarySha256: batchAProof?.compilerBinarySha256 ?? null,
        hostSourceRoot: batchAProof?.hostSourceRoot ?? null,
      },
    });
  }

  const batches = [];
  let totalProviderCallCount = 0;
  for (const spec of BATCHES) {
    const request = spec.normalize();
    let providerDisabledRejected = false;
    let providerDisabledCode = null;
    try {
      spec.run(request, {
        compilerPath,
        hostPath,
        verifyReplay: false,
        disableProvider: true,
        timeout: 30_000,
        compilerTimeout: 120_000,
      });
    } catch (error) {
      providerDisabledRejected = true;
      providerDisabledCode = error?.code ?? error?.name ?? 'unknown';
    }
    if (!providerDisabledRejected) {
      fail(`${spec.id} did not fail closed when its Native Provider was disabled`);
    }

    const proof = spec.run(request, {
      compilerPath,
      hostPath,
      verifyReplay: true,
      timeout: 30_000,
      compilerTimeout: 120_000,
    });
    const expected = spec.entries.map(item => ({ ...item }));
    if (
      proof?.status !== 'pass'
      || proof?.mode !== 'bridge'
      || proof?.selfhostByteIdentical !== true
      || proof?.replayVerified !== true
      || proof?.providerHost?.providerId !== spec.providerId
      || proof?.providerHost?.providerAbi !== 1
      || proof?.providerHost?.providerCallCount !== expected.length
      || !Array.isArray(proof?.results)
      || proof.results.length !== expected.length
    ) {
      fail(`${spec.id} did not satisfy the existing Native Provider Bridge contract`, {
        status: proof?.status ?? null,
        mode: proof?.mode ?? null,
        selfhostByteIdentical: proof?.selfhostByteIdentical ?? false,
        replayVerified: proof?.replayVerified ?? false,
        providerHost: proof?.providerHost ?? null,
        resultCount: proof?.results?.length ?? null,
      });
    }

    for (let index = 0; index < expected.length; index += 1) {
      const entry = expected[index];
      const result = proof.results[index];
      const beforeExpected = index === 0
        ? proof.request?.causalParents?.[0]
        : proof.results[index - 1]?.stateDelta?.afterRoot;
      if (
        result?.domain !== entry.domain
        || result?.proposal?.mode !== 'bridge'
        || result?.proposal?.capability !== entry.capability
        || result?.replayMetadata?.mode !== 'bridge'
        || result?.replayMetadata?.providerId !== spec.providerId
        || result?.replayMetadata?.deterministic !== true
        || result?.replayMetadata?.aifDecision !== 'stable'
        || !Array.isArray(result?.authorityRequired)
        || result.authorityRequired.length === 0
        || !Array.isArray(result?.evidence)
        || result.evidence.length === 0
        || !isSha256(result?.stateDelta?.beforeRoot)
        || !isSha256(result?.stateDelta?.afterRoot)
        || result.stateDelta.beforeRoot !== beforeExpected
      ) {
        fail(`${spec.id} broke capability, authority/evidence, replay, or causal state-root semantics`, {
          index,
          expected: entry,
          result,
          beforeExpected,
        });
      }
    }

    const counterfactual = spec.run(counterfactualRequest(request), {
      compilerPath,
      hostPath,
      verifyReplay: true,
      timeout: 30_000,
      compilerTimeout: 120_000,
    });
    const behaviorMutationVerified = Boolean(
      counterfactual?.status === 'pass'
      && counterfactual?.finalStateRoot !== proof?.finalStateRoot
      && proof.results.every((result, index) => (
        result?.proposal?.selectedAction
        !== counterfactual?.results?.[index]?.proposal?.selectedAction
      ))
    );
    if (!behaviorMutationVerified) {
      fail(`${spec.id} did not preserve behavior sensitivity under an inspect counterfactual`, {
        originalActions: proof.results.map(result => result?.proposal?.selectedAction ?? null),
        counterfactualActions: counterfactual?.results?.map(result => result?.proposal?.selectedAction ?? null) ?? null,
        originalRoot: proof?.finalStateRoot ?? null,
        counterfactualRoot: counterfactual?.finalStateRoot ?? null,
      });
    }

    for (const value of [proof.sourceRoot, proof.bytecodeRoot, proof.deterministicReceiptRoot, proof.finalStateRoot]) {
      if (!isSha256(value)) fail(`${spec.id} is missing a required content-addressed execution root`, { value, proof });
    }

    batches.push({
      id: spec.id,
      providerId: proof.providerHost.providerId,
      providerAbi: proof.providerHost.providerAbi,
      providerCallCount: proof.providerHost.providerCallCount,
      domains: expected.map(item => item.domain),
      capabilities: expected.map(item => item.capability),
      sourceRoot: proof.sourceRoot,
      bytecodeRoot: proof.bytecodeRoot,
      bytecodeVersion: proof.bytecodeVersion,
      selfhostByteIdentical: true,
      deterministicReceiptRoot: proof.deterministicReceiptRoot,
      replayVerified: true,
      finalStateRoot: proof.finalStateRoot,
      results: proof.results,
      negativeControl: {
        providerDisabledRejected: true,
        code: providerDisabledCode,
      },
      behaviorMutation: {
        verified: true,
        originalRoot: proof.finalStateRoot,
        counterfactualRoot: counterfactual.finalStateRoot,
        originalActions: proof.results.map(result => result?.proposal?.selectedAction ?? null),
        counterfactualActions: counterfactual.results.map(result => result?.proposal?.selectedAction ?? null),
      },
    });
    totalProviderCallCount += proof.providerHost.providerCallCount;
  }

  const artifact = {
    ok: true,
    format: 'taowind.rcl-vercel-foundation-native-provider-federation-extension-proof.v0.1',
    version: '0.1.0',
    status: 'native-bridge-federation-verified',
    verified: true,
    executionMode: 'native-provider-bridge',
    hostBinarySha256,
    compilerBinarySha256,
    hostSourceRoot: sources.root,
    hostSourceFiles: sources.files,
    batchAProofSha256: sha256(batchAProofBytes),
    batchAProviderId: batchAProof.providerId,
    batches,
    domains: batches.flatMap(batch => batch.domains),
    totalProviderCallCount,
    truthBoundary: {
      declaredDomainDirectLoweringVerified: false,
      deploymentHealthBound: false,
      claim: 'This extends hosted real-C evidence from Batch A to Meta Batch B and Batches C/D/E using the exact same current RclVmProviderV1 host/compiler/source material. It proves provider-bridge execution, not declared-domain direct lowering.',
    },
  };
  if (artifact.domains.length !== 10 || artifact.totalProviderCallCount !== 10) {
    fail('Federation extension did not cover the expected ten provider-domain calls', { artifact });
  }

  fs.mkdirSync(publicDir, { recursive: true });
  fs.writeFileSync(proofPath, `${JSON.stringify(artifact, null, 2)}\n`);
  console.log(JSON.stringify({
    ok: true,
    status: 'RCL_VERCEL_FOUNDATION_NATIVE_FEDERATION_EXTENSION_VERIFIED',
    providers: batches.map(batch => batch.providerId),
    domains: artifact.domains,
    totalProviderCallCount: artifact.totalProviderCallCount,
    hostBinarySha256,
    compilerBinarySha256,
    hostSourceRoot: artifact.hostSourceRoot,
    allReplayVerified: batches.every(batch => batch.replayVerified),
    allSelfhostByteIdentical: batches.every(batch => batch.selfhostByteIdentical),
    allProviderDisabledRejected: batches.every(batch => batch.negativeControl.providerDisabledRejected),
    allBehaviorMutationVerified: batches.every(batch => batch.behaviorMutation.verified),
    deploymentHealthBound: false,
  }, null, 2));
} catch (error) {
  fail(error?.message ?? String(error), {
    code: error?.code ?? null,
    details: error?.details ?? null,
    stack: error?.stack ?? null,
  });
}
