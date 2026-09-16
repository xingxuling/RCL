#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  createFoundationNativeBatchRuntime,
  runFoundationNativeHost,
} from '../src/foundation-native-batch-runtime.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const nativeDir = path.join(root, 'native');
const hostPath = path.join(nativeDir, process.platform === 'win32' ? 'rclfoundation.exe' : 'rclfoundation');
const compilerPath = path.join(nativeDir, process.platform === 'win32' ? 'rclc.exe' : 'rclc');
const publicDir = path.join(root, 'public');
const proofPath = path.join(publicDir, 'rcl-foundation-quantitative-native-bridge-proof.json');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}
function isSha256(value) {
  return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value);
}
function fail(message, details = {}) {
  console.error(JSON.stringify({
    ok: false,
    status: 'RCL_VERCEL_FOUNDATION_QUANTITATIVE_NATIVE_BRIDGE_FAILED',
    message,
    ...details,
  }, null, 2));
  process.exit(1);
}
function sourceEvidence() {
  const files = ['rclvm.c', 'rclvm.h', 'foundation_provider.c', 'rclc.c', 'Makefile'];
  const hashes = Object.fromEntries(files.map(name => [name, sha256(fs.readFileSync(path.join(nativeDir, name)))]));
  return {
    files: hashes,
    root: sha256(Buffer.from(JSON.stringify(hashes))),
  };
}

if (process.platform !== 'linux') {
  fail('Hosted quantitative Native Provider proof requires the canonical Linux deployment environment', {
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
    fail('Canonical quantitative Native Provider host materialization failed closed', {
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

  const runtime = createFoundationNativeBatchRuntime({
    label: 'Hosted Quantitative Slice',
    format: 'taowind.rcl-foundation-quantitative-native-bridge-proof.v0.1',
    requestFormat: 'taowind.rcl-foundation-quantitative-native-bridge.request.v0.1',
    providerId: 'rcl.foundation.batch-a',
    realityName: 'VercelFoundationQuantitativeBridgeProof',
    entries: [{
      domain: 'quantitative',
      capability: 'quantitative.evaluate',
      statePath: 'bridge.quantitative',
    }],
    defaultInput: {
      speechAct: 'create',
      utterance: 'Create one bounded, evidenced reality candidate.',
    },
    defaultSeed: 'vercel-foundation-quantitative-native-bridge-v1',
    bytecodeFilename: 'foundation-quantitative-bridge.rbc',
  });

  const request = runtime.normalizeRequest();
  const compilation = runtime.compile(request, {
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
      temporaryBytecodeName: 'foundation-quantitative-negative.rbc',
    });
  } catch (error) {
    providerDisabledRejected = true;
    providerDisabledCode = error?.code ?? error?.name ?? 'unknown';
  }
  if (!providerDisabledRejected) {
    fail('Quantitative Native Provider proof did not fail closed when its provider was disabled');
  }

  const proof = runtime.run(request, {
    compilerPath,
    hostPath,
    verifyReplay: true,
    timeout: 30_000,
    compilerTimeout: 120_000,
  });
  const result = proof?.results?.[0] ?? null;
  if (
    proof?.status !== 'pass'
    || proof?.mode !== 'bridge'
    || proof?.selfhostByteIdentical !== true
    || proof?.replayVerified !== true
    || proof?.providerHost?.providerId !== 'rcl.foundation.batch-a'
    || proof?.providerHost?.providerAbi !== 1
    || proof?.providerHost?.providerCallCount !== 1
    || result?.domain !== 'quantitative'
    || result?.proposal?.mode !== 'bridge'
    || result?.proposal?.capability !== 'quantitative.evaluate'
    || result?.replayMetadata?.deterministic !== true
    || result?.replayMetadata?.aifDecision !== 'stable'
    || !Array.isArray(result?.authorityRequired)
    || result.authorityRequired.length === 0
    || !Array.isArray(result?.evidence)
    || result.evidence.length === 0
    || !isSha256(result?.stateDelta?.afterRoot)
    || !isSha256(proof?.deterministicReceiptRoot)
  ) {
    fail('Hosted quantitative result did not satisfy the existing Native Provider Bridge contract', {
      status: proof?.status ?? null,
      mode: proof?.mode ?? null,
      selfhostByteIdentical: proof?.selfhostByteIdentical ?? false,
      replayVerified: proof?.replayVerified ?? false,
      providerHost: proof?.providerHost ?? null,
      result,
    });
  }

  const sources = sourceEvidence();
  const hostBinarySha256 = sha256(fs.readFileSync(hostPath));
  const compilerBinarySha256 = sha256(fs.readFileSync(compilerPath));
  const artifact = {
    ok: true,
    format: 'taowind.rcl-vercel-foundation-quantitative-native-bridge-proof.v0.1',
    version: '0.1.0',
    domain: 'quantitative',
    status: 'native-bridge-verified',
    verified: true,
    providerId: proof.providerHost.providerId,
    providerAbi: proof.providerHost.providerAbi,
    providerCallCount: proof.providerHost.providerCallCount,
    hostBinarySha256,
    compilerBinarySha256,
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
    quantitativeResult: result,
    negativeControl: {
      providerDisabledRejected: true,
      code: providerDisabledCode,
    },
    truthBoundary: {
      executionMode: 'native-provider-bridge',
      declaredDomainDirectLoweringVerified: false,
      deploymentHealthBound: false,
      claim: 'This proves deterministic quantitative execution through the existing RclVmProviderV1 C provider path; it does not claim declared quantitative syntax is directly lowered into generic native bytecode.',
    },
  };

  if (![artifact.sourceRoot, artifact.bytecodeRoot, artifact.finalStateRoot].every(isSha256)) {
    fail('Quantitative proof is missing a required content-addressed execution root', { artifact });
  }

  fs.mkdirSync(publicDir, { recursive: true });
  fs.writeFileSync(proofPath, `${JSON.stringify(artifact, null, 2)}\n`);
  console.log(JSON.stringify({
    ok: true,
    status: 'RCL_VERCEL_FOUNDATION_QUANTITATIVE_NATIVE_BRIDGE_VERIFIED',
    domain: artifact.domain,
    executionMode: artifact.truthBoundary.executionMode,
    hostBinarySha256,
    compilerBinarySha256,
    hostSourceRoot: artifact.hostSourceRoot,
    bytecodeRoot: artifact.bytecodeRoot,
    deterministicReceiptRoot: artifact.deterministicReceiptRoot,
    finalStateRoot: artifact.finalStateRoot,
    replayVerified: true,
    selfhostByteIdentical: true,
    providerDisabledRejected: true,
    deploymentHealthBound: false,
  }, null, 2));
} catch (error) {
  fail(error?.message ?? String(error), {
    code: error?.code ?? null,
    details: error?.details ?? null,
    stack: error?.stack ?? null,
  });
}
