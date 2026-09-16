#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  FOUNDATION_NATIVE_BATCH_A,
  compileFoundationNativeBatchA,
  normalizeFoundationNativeBatchARequest,
  runFoundationNativeBatchA,
  runFoundationNativeHost,
} from '../src/foundation-native-bridge.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const nativeDir = path.join(root, 'native');
const hostPath = path.join(nativeDir, process.platform === 'win32' ? 'rclfoundation.exe' : 'rclfoundation');
const compilerPath = path.join(nativeDir, process.platform === 'win32' ? 'rclc.exe' : 'rclc');
const publicDir = path.join(root, 'public');
const proofPath = path.join(publicDir, 'rcl-foundation-batch-a-native-bridge-proof.json');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}
function isSha256(value) {
  return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value);
}
function fail(message, details = {}) {
  console.error(JSON.stringify({
    ok: false,
    status: 'RCL_VERCEL_FOUNDATION_BATCH_A_NATIVE_BRIDGE_FAILED',
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

if (process.platform !== 'linux') {
  fail('Hosted Foundation Batch A Native Provider proof requires the canonical Linux deployment environment', {
    platform: process.platform,
    arch: process.arch,
  });
}

try {
  fs.rmSync(hostPath, { force: true });
  fs.rmSync(compilerPath, { force: true });
  fs.rmSync(proofPath, { force: true });

  const build = spawnSync('make', ['rclc', 'rclfoundation'], {
    cwd: nativeDir,
    encoding: 'utf8',
    timeout: 120_000,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (build.error || build.status !== 0) {
    fail('Canonical Foundation Batch A Native Provider host materialization failed closed', {
      code: build.error?.code ?? null,
      error: build.error?.message ?? null,
      exitCode: build.status ?? null,
      signal: build.signal ?? null,
      stdout: build.stdout ?? '',
      stderr: build.stderr ?? '',
    });
  }
  for (const requiredPath of [hostPath, compilerPath]) {
    if (!fs.existsSync(requiredPath)) fail('Native build completed without a required executable artifact', { requiredPath });
    fs.chmodSync(requiredPath, 0o755);
  }

  const request = normalizeFoundationNativeBatchARequest();
  const compilation = compileFoundationNativeBatchA(request, {
    compilerPath,
    compilerTimeout: 120_000,
  });

  let providerDisabledRejected = false;
  let providerDisabledCode = null;
  try {
    runFoundationNativeHost(compilation.bytecode, {
      hostPath,
      disableProvider: true,
      timeout: 30_000,
      temporaryBytecodeName: 'foundation-batch-a-negative.rbc',
    });
  } catch (error) {
    providerDisabledRejected = true;
    providerDisabledCode = error?.code ?? error?.name ?? 'unknown';
  }
  if (!providerDisabledRejected) fail('Batch A proof did not fail closed when its Native Provider was disabled');

  const proof = runFoundationNativeBatchA(request, {
    compilerPath,
    hostPath,
    verifyReplay: true,
    timeout: 30_000,
    compilerTimeout: 120_000,
  });
  const expected = FOUNDATION_NATIVE_BATCH_A.map(item => ({ ...item }));
  if (
    proof?.status !== 'pass'
    || proof?.mode !== 'bridge'
    || proof?.selfhostByteIdentical !== true
    || proof?.replayVerified !== true
    || proof?.providerHost?.providerId !== 'rcl.foundation.batch-a'
    || proof?.providerHost?.providerAbi !== 1
    || proof?.providerHost?.providerCallCount !== expected.length
    || !Array.isArray(proof?.results)
    || proof.results.length !== expected.length
  ) {
    fail('Hosted Batch A result did not satisfy the existing Native Provider Bridge contract', {
      status: proof?.status ?? null,
      mode: proof?.mode ?? null,
      selfhostByteIdentical: proof?.selfhostByteIdentical ?? false,
      replayVerified: proof?.replayVerified ?? false,
      providerHost: proof?.providerHost ?? null,
      resultCount: proof?.results?.length ?? null,
    });
  }

  for (let index = 0; index < expected.length; index += 1) {
    const spec = expected[index];
    const result = proof.results[index];
    const beforeExpected = index === 0 ? proof.request?.causalParents?.[0] : proof.results[index - 1]?.stateDelta?.afterRoot;
    if (
      result?.domain !== spec.domain
      || result?.proposal?.mode !== 'bridge'
      || result?.proposal?.capability !== spec.capability
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
      || result.stateDelta.beforeRoot !== beforeExpected
    ) {
      fail('A Batch A domain result broke capability, authority/evidence, replay, or causal-chain semantics', {
        index,
        expected: spec,
        result,
        beforeExpected,
      });
    }
  }

  const counterfactual = runFoundationNativeBatchA({
    input: {
      speechAct: 'inspect',
      utterance: 'Inspect the bounded reality without creating it.',
    },
  }, {
    compilerPath,
    hostPath,
    verifyReplay: true,
    timeout: 30_000,
    compilerTimeout: 120_000,
  });
  const behaviorMutationVerified = Boolean(
    counterfactual?.status === 'pass'
    && counterfactual?.finalCandidate?.selectedAction !== proof?.finalCandidate?.selectedAction
    && counterfactual?.finalStateRoot !== proof?.finalStateRoot
  );
  if (!behaviorMutationVerified) {
    fail('Full Batch A bridge proof did not preserve behavior sensitivity under a counterfactual input', {
      originalAction: proof?.finalCandidate?.selectedAction ?? null,
      counterfactualAction: counterfactual?.finalCandidate?.selectedAction ?? null,
      originalRoot: proof?.finalStateRoot ?? null,
      counterfactualRoot: counterfactual?.finalStateRoot ?? null,
    });
  }

  const sources = sourceEvidence();
  const artifact = {
    ok: true,
    format: 'taowind.rcl-vercel-foundation-batch-a-native-bridge-proof.v0.1',
    version: '0.1.0',
    status: 'native-bridge-verified',
    verified: true,
    domains: expected.map(item => item.domain),
    providerId: proof.providerHost.providerId,
    providerAbi: proof.providerHost.providerAbi,
    providerCallCount: proof.providerHost.providerCallCount,
    hostBinarySha256: sha256(fs.readFileSync(hostPath)),
    compilerBinarySha256: sha256(fs.readFileSync(compilerPath)),
    hostSourceRoot: sources.root,
    hostSourceFiles: sources.files,
    nativeSourceRoot: proof.nativeSourceRoot ?? null,
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
      originalAction: proof.finalCandidate?.selectedAction ?? null,
      counterfactualAction: counterfactual.finalCandidate?.selectedAction ?? null,
      originalRoot: proof.finalStateRoot,
      counterfactualRoot: counterfactual.finalStateRoot,
    },
    truthBoundary: {
      executionMode: 'native-provider-bridge',
      declaredDomainDirectLoweringVerified: false,
      deploymentHealthBound: false,
      claim: 'This proves the complete existing Foundation Batch A provider set through the current real C RclVmProviderV1 bridge; it does not claim those declared domain syntaxes are directly lowered into generic native bytecode.',
    },
  };
  if (![artifact.sourceRoot, artifact.bytecodeRoot, artifact.finalStateRoot].every(isSha256)) {
    fail('Batch A proof is missing a required content-addressed execution root', { artifact });
  }

  fs.mkdirSync(publicDir, { recursive: true });
  fs.writeFileSync(proofPath, `${JSON.stringify(artifact, null, 2)}\n`);
  console.log(JSON.stringify({
    ok: true,
    status: 'RCL_VERCEL_FOUNDATION_BATCH_A_NATIVE_BRIDGE_VERIFIED',
    domains: artifact.domains,
    executionMode: artifact.truthBoundary.executionMode,
    hostBinarySha256: artifact.hostBinarySha256,
    compilerBinarySha256: artifact.compilerBinarySha256,
    hostSourceRoot: artifact.hostSourceRoot,
    bytecodeRoot: artifact.bytecodeRoot,
    deterministicReceiptRoot: artifact.deterministicReceiptRoot,
    finalStateRoot: artifact.finalStateRoot,
    providerCallCount: artifact.providerCallCount,
    replayVerified: true,
    selfhostByteIdentical: true,
    providerDisabledRejected: true,
    behaviorMutationVerified: true,
    deploymentHealthBound: false,
  }, null, 2));
} catch (error) {
  fail(error?.message ?? String(error), {
    code: error?.code ?? null,
    details: error?.details ?? null,
    stack: error?.stack ?? null,
  });
}
