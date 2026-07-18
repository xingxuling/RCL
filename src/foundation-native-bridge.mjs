import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { compileRealityToBytecode, decodeBytecode } from './bytecode.mjs';
import {
  FOUNDATION_MANIFEST_ROOT,
  validateFoundationRuntimeResult,
} from './foundation-contract.mjs';
import { compileSourceSelfHosted } from './selfhost-compiler.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

export const FOUNDATION_NATIVE_BATCH_A_FORMAT = 'taowind.rcl-foundation-native-batch-a.v0.1';
export const FOUNDATION_NATIVE_BATCH_A_REQUEST_FORMAT = 'taowind.rcl-foundation-native-batch-a.request.v0.1';
export const FOUNDATION_NATIVE_HOST_FORMAT = 'taowind.rcl-foundation-native-host.v0.1';
export const FOUNDATION_NATIVE_PROVIDER_ID = 'rcl.foundation.batch-a';
export const DEFAULT_FOUNDATION_NATIVE_HOST_PATH = path.join(
  ROOT,
  'native',
  process.platform === 'win32' ? 'rclfoundation.exe' : 'rclfoundation',
);

export const FOUNDATION_NATIVE_BATCH_A = Object.freeze([
  Object.freeze({ domain: 'quantitative', capability: 'quantitative.evaluate', statePath: 'bridge.quantitative' }),
  Object.freeze({ domain: 'knowledge', capability: 'knowledge.resolve', statePath: 'bridge.knowledge' }),
  Object.freeze({ domain: 'perception', capability: 'perception.observe', statePath: 'bridge.perception' }),
  Object.freeze({ domain: 'natural-language-reality', capability: 'natural-language.interpret', statePath: 'bridge.natural_language' }),
  Object.freeze({ domain: 'understanding-reality', capability: 'understanding.model', statePath: 'bridge.understanding' }),
  Object.freeze({ domain: 'creative-reality', capability: 'creative.generate', statePath: 'bridge.creative' }),
]);

export class FoundationNativeBridgeError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'FoundationNativeBridgeError';
    this.code = code;
    this.details = details;
  }
}

function canonicalize(value, pathLabel = 'value') {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError(`${pathLabel} contains a non-finite number`);
    return value;
  }
  if (Array.isArray(value)) return value.map((item, index) => canonicalize(item, `${pathLabel}[${index}]`));
  if (value && typeof value === 'object') {
    const result = {};
    for (const key of Object.keys(value).sort()) {
      if (value[key] === undefined) throw new TypeError(`${pathLabel}.${key} is undefined`);
      result[key] = canonicalize(value[key], `${pathLabel}.${key}`);
    }
    return result;
  }
  throw new TypeError(`${pathLabel} contains unsupported ${typeof value} data`);
}

function canonicalStringify(value) {
  return JSON.stringify(canonicalize(value));
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function elapsedMs(start) {
  return Number(process.hrtime.bigint() - start) / 1_000_000;
}

function parseJson(text, fallback) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function rclText(value) {
  return JSON.stringify(value);
}

export function normalizeFoundationNativeBatchARequest(request = {}) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    throw new TypeError('Foundation Native Batch A request must be an object');
  }
  const input = structuredClone(request.input ?? {
    speechAct: 'create',
    utterance: 'Create one bounded, evidenced reality candidate.',
  });
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Foundation Native Batch A input must be an object');
  }
  const inputRoot = sha256(canonicalStringify(input));
  return canonicalize({
    format: FOUNDATION_NATIVE_BATCH_A_REQUEST_FORMAT,
    version: '0.1.0',
    authorized: request.authorized ?? true,
    aifDecision: request.aifDecision ?? 'stable',
    causalParents: request.causalParents === undefined
      ? [inputRoot]
      : structuredClone(request.causalParents),
    evidence: request.evidence === undefined
      ? [{ type: 'input-root', root: inputRoot }]
      : structuredClone(request.evidence),
    input,
    seed: request.seed ?? 'foundation-native-batch-a-v1',
  }, 'request');
}

export function renderFoundationNativeBatchASource(request = {}) {
  const normalized = normalizeFoundationNativeBatchARequest(request);
  const baseRequest = canonicalStringify(normalized);
  const parentPrefix = `${baseRequest.slice(0, -1)},\"parent\":`;
  const lines = [
    'reality FoundationNativeBatchABridge {',
    `  facet bridge.provider : Text = ${rclText(FOUNDATION_NATIVE_PROVIDER_ID)}`,
    `  facet bridge.request : Text = ${rclText(baseRequest)}`,
  ];

  FOUNDATION_NATIVE_BATCH_A.forEach((entry, index) => {
    let requestPath = 'bridge.request';
    if (index > 0) {
      const previous = FOUNDATION_NATIVE_BATCH_A[index - 1];
      requestPath = `bridge.request_${index + 1}`;
      lines.push(
        `  facet ${requestPath} : Text = ${rclText(parentPrefix)} + ${previous.statePath} + ${rclText('}')}`,
      );
    }
    lines.push(
      `  facet ${entry.statePath} : Text = provider_call(bridge.provider, ${rclText(entry.capability)}, ${requestPath})`,
    );
  });
  lines.push('}');
  return {
    format: FOUNDATION_NATIVE_BATCH_A_REQUEST_FORMAT,
    request: normalized,
    requestRoot: sha256(baseRequest),
    source: `${lines.join('\n')}\n`,
  };
}

export function compileFoundationNativeBatchA(request = {}, options = {}) {
  const rendered = renderFoundationNativeBatchASource(request);

  const oracleStarted = process.hrtime.bigint();
  const oracleBytecode = Buffer.from(compileRealityToBytecode(rendered.source));
  const oracleCompileMs = elapsedMs(oracleStarted);

  const selfhostStarted = process.hrtime.bigint();
  const selfHostedBytecode = Buffer.from(compileSourceSelfHosted(rendered.source, {
    compilerArtifactPath: options.compilerArtifactPath,
    compilerPath: options.compilerPath,
    timeout: options.compilerTimeout ?? 120_000,
    maxBuffer: options.compilerMaxBuffer ?? 64 * 1024 * 1024,
  }));
  const selfhostCompileMs = elapsedMs(selfhostStarted);

  if (!selfHostedBytecode.equals(oracleBytecode)) {
    throw new FoundationNativeBridgeError(
      'RCL_FOUNDATION_SELFHOST_DIVERGENCE',
      'The self-hosted compiler did not emit byte-identical Foundation bridge RBC',
      {
        oracleRoot: sha256(oracleBytecode),
        selfhostRoot: sha256(selfHostedBytecode),
      },
    );
  }
  const decoded = decodeBytecode(selfHostedBytecode);
  if (decoded.version.major !== 1 || decoded.version.minor !== 2) {
    throw new FoundationNativeBridgeError(
      'RCL_FOUNDATION_BYTECODE_VERSION',
      `Foundation Native Batch A requires RBC 1.2, received ${decoded.version.major}.${decoded.version.minor}`,
    );
  }
  const providerInstructions = decoded.instructions.filter(instruction => instruction.name === 'CALL_PROVIDER');
  if (providerInstructions.length !== FOUNDATION_NATIVE_BATCH_A.length || providerInstructions.some(item => item.flags !== 1)) {
    throw new FoundationNativeBridgeError(
      'RCL_FOUNDATION_PROVIDER_LOWERING',
      'Foundation Native Batch A must lower six dynamic provider calls',
      { providerInstructions },
    );
  }

  return Object.freeze({
    ...rendered,
    bytecode: selfHostedBytecode,
    bytecodeRoot: sha256(selfHostedBytecode),
    bytecodeVersion: `${decoded.version.major}.${decoded.version.minor}`,
    sourceRoot: sha256(rendered.source),
    selfhostByteIdentical: true,
    providerInstructionCount: providerInstructions.length,
    compileMetrics: Object.freeze({
      compileMs: oracleCompileMs + selfhostCompileMs,
      oracleCompileMs,
      selfhostCompileMs,
      sourceBytes: Buffer.byteLength(rendered.source),
      bytecodeBytes: selfHostedBytecode.length,
    }),
  });
}

function bridgeErrorFromProcess(result, hostPath) {
  const text = `${result.stderr ?? ''}`.trim() || `${result.stdout ?? ''}`.trim();
  const payload = parseJson(text, {
    code: 'RCL_FOUNDATION_NATIVE_PROCESS',
    message: text || `Foundation Native host exited with ${result.status}`,
  });
  const nestedCode = `${payload.message ?? ''}`.match(/\b(RCL_FOUNDATION_[A-Z0-9_]+)\b/)?.[1];
  return new FoundationNativeBridgeError(
    nestedCode ?? payload.code ?? 'RCL_FOUNDATION_NATIVE_PROCESS',
    payload.message ?? 'Foundation Native host execution failed',
    {
      hostPath,
      status: result.status,
      nativeCode: payload.code,
      stdout: result.stdout,
      stderr: result.stderr,
    },
  );
}

export function runFoundationNativeHost(bytecodeOrPath, options = {}) {
  const hostPath = options.hostPath ?? DEFAULT_FOUNDATION_NATIVE_HOST_PATH;
  if (!fs.existsSync(hostPath)) {
    throw new FoundationNativeBridgeError(
      'RCL_FOUNDATION_NATIVE_HOST_MISSING',
      `Foundation Native host is missing at ${hostPath}`,
    );
  }
  let bytecodePath = bytecodeOrPath;
  let temporaryDirectory = null;
  if (Buffer.isBuffer(bytecodeOrPath) || bytecodeOrPath instanceof Uint8Array) {
    temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-foundation-native-'));
    bytecodePath = path.join(temporaryDirectory, 'foundation-batch-a.rbc');
    fs.writeFileSync(bytecodePath, bytecodeOrPath);
  } else if (typeof bytecodeOrPath !== 'string' || bytecodeOrPath.length === 0) {
    throw new TypeError('runFoundationNativeHost expects RBC bytes or a non-empty path');
  }

  const rssBefore = process.memoryUsage().rss;
  const started = process.hrtime.bigint();
  try {
    const result = spawnSync(hostPath, [bytecodePath], {
      encoding: 'utf8',
      timeout: options.timeout ?? 30_000,
      maxBuffer: options.maxBuffer ?? 64 * 1024 * 1024,
      env: {
        ...process.env,
        ...options.env,
        ...(options.disableProvider ? { RCL_FOUNDATION_DISABLE_PROVIDER: '1' } : {}),
      },
    });
    const runtimeMs = elapsedMs(started);
    const rssAfter = process.memoryUsage().rss;
    if (result.error) {
      throw new FoundationNativeBridgeError(
        'RCL_FOUNDATION_NATIVE_PROCESS',
        result.error.message,
        { result, hostPath },
      );
    }
    if (result.status !== 0) throw bridgeErrorFromProcess(result, hostPath);
    const payload = parseJson(result.stdout, null);
    if (!payload || payload.format !== FOUNDATION_NATIVE_HOST_FORMAT || payload.native?.status !== 'ok') {
      throw new FoundationNativeBridgeError(
        'RCL_FOUNDATION_NATIVE_OUTPUT',
        'Foundation Native host returned an invalid execution envelope',
        { stdout: result.stdout, stderr: result.stderr },
      );
    }
    return {
      payload,
      runtimeMs,
      processRssDeltaBytes: Math.max(0, rssAfter - rssBefore),
      stdoutBytes: Buffer.byteLength(result.stdout),
    };
  } finally {
    if (temporaryDirectory) fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

export function verifyFoundationNativeBatchAExecution(hostPayload, request) {
  if (hostPayload?.format !== FOUNDATION_NATIVE_HOST_FORMAT || hostPayload.native?.status !== 'ok') {
    throw new FoundationNativeBridgeError('RCL_FOUNDATION_NATIVE_OUTPUT', 'Invalid Foundation Native host payload');
  }
  if (
    hostPayload.providerHost?.providerId !== FOUNDATION_NATIVE_PROVIDER_ID
    || hostPayload.providerHost?.providerAbi !== 1
    || hostPayload.providerHost?.providerCallCount !== FOUNDATION_NATIVE_BATCH_A.length
  ) {
    throw new FoundationNativeBridgeError(
      'RCL_FOUNDATION_PROVIDER_RECEIPT',
      'Native provider registration or call-count receipt is invalid',
      { providerHost: hostPayload.providerHost },
    );
  }

  const results = [];
  FOUNDATION_NATIVE_BATCH_A.forEach((entry, index) => {
    const raw = hostPayload.native.state?.[entry.statePath];
    if (typeof raw !== 'string') {
      throw new FoundationNativeBridgeError(
        'RCL_FOUNDATION_RESULT_MISSING',
        `Native VM state is missing ${entry.statePath}`,
      );
    }
    const result = parseJson(raw, null);
    try {
      validateFoundationRuntimeResult(result);
    } catch (error) {
      throw new FoundationNativeBridgeError(
        'RCL_FOUNDATION_RESULT_INVALID',
        `${entry.domain} returned an invalid Foundation runtime result: ${error.message}`,
      );
    }
    if (
      result.domain !== entry.domain
      || result.proposal?.mode !== 'bridge'
      || result.proposal?.capability !== entry.capability
      || result.replayMetadata?.mode !== 'bridge'
      || result.replayMetadata?.providerId !== FOUNDATION_NATIVE_PROVIDER_ID
      || result.replayMetadata?.capability !== entry.capability
      || result.replayMetadata?.sequence !== index + 1
      || result.replayMetadata?.deterministic !== true
      || result.replayMetadata?.aifDecision !== 'stable'
      || result.authorityRequired.length === 0
      || result.evidence.length === 0
    ) {
      throw new FoundationNativeBridgeError(
        'RCL_FOUNDATION_RESULT_CONTRACT',
        `${entry.domain} violated the Native Provider Bridge contract`,
        { result },
      );
    }
    const expectedParent = index === 0
      ? request.causalParents[0]
      : results[index - 1].stateDelta.afterRoot;
    if (
      result.stateDelta.beforeRoot !== expectedParent
      || result.replayMetadata.beforeRoot !== expectedParent
      || result.replayMetadata.causalParents?.[0] !== expectedParent
      || result.replayMetadata.afterRoot !== result.stateDelta.afterRoot
      || !/^[a-f0-9]{64}$/.test(result.stateDelta.afterRoot)
    ) {
      throw new FoundationNativeBridgeError(
        'RCL_FOUNDATION_CAUSAL_CHAIN',
        `${entry.domain} did not preserve the preceding causal root`,
        { expectedParent, result },
      );
    }
    results.push(result);
  });
  return Object.freeze(results);
}

function deterministicExecutionReceipt(compilation, hostPayload, results) {
  return canonicalize({
    contractRoot: FOUNDATION_MANIFEST_ROOT,
    requestRoot: compilation.requestRoot,
    sourceRoot: compilation.sourceRoot,
    bytecodeRoot: compilation.bytecodeRoot,
    bytecodeVersion: compilation.bytecodeVersion,
    nativeVm: hostPayload.native.vm,
    nativeSourceRoot: hostPayload.native.sourceRoot,
    providerHost: hostPayload.providerHost,
    nativeMetrics: hostPayload.native.metrics,
    results,
  });
}

export function runFoundationNativeBatchA(request = {}, options = {}) {
  const compilation = compileFoundationNativeBatchA(request, options);
  const first = runFoundationNativeHost(compilation.bytecode, options);
  const results = verifyFoundationNativeBatchAExecution(first.payload, compilation.request);
  const receipt = deterministicExecutionReceipt(compilation, first.payload, results);
  const receiptRoot = sha256(canonicalStringify(receipt));

  const replay = options.verifyReplay === false
    ? null
    : runFoundationNativeHost(compilation.bytecode, options);
  if (replay) {
    const replayResults = verifyFoundationNativeBatchAExecution(replay.payload, compilation.request);
    const replayReceiptRoot = sha256(canonicalStringify(
      deterministicExecutionReceipt(compilation, replay.payload, replayResults),
    ));
    if (replayReceiptRoot !== receiptRoot) {
      throw new FoundationNativeBridgeError(
        'RCL_FOUNDATION_REPLAY_DIVERGENCE',
        'Native Provider Bridge replay produced a different deterministic receipt root',
        { receiptRoot, replayReceiptRoot },
      );
    }
  }

  const resultBytes = Buffer.byteLength(canonicalStringify(results));
  const sourceBytes = compilation.compileMetrics.sourceBytes;
  const bytecodeBytes = compilation.compileMetrics.bytecodeBytes;
  const metrics = Object.freeze({
    ...compilation.compileMetrics,
    runtimeMs: first.runtimeMs,
    replayMs: replay?.runtimeMs ?? null,
    processRssDeltaBytes: first.processRssDeltaBytes,
    estimatedWorkingSetBytes: sourceBytes + bytecodeBytes + first.stdoutBytes + resultBytes,
    eventCount: first.payload.native.metrics.instructions,
    resultCount: results.length,
    nativeInstructionCount: first.payload.native.metrics.instructions,
    providerCallCount: first.payload.providerHost.providerCallCount,
    cacheHitRate: first.payload.providerHost.cacheHitRate,
    resultBytes,
    compressionRatio: Number((sourceBytes / bytecodeBytes).toFixed(6)),
  });

  return Object.freeze({
    format: FOUNDATION_NATIVE_BATCH_A_FORMAT,
    status: 'pass',
    mode: 'bridge',
    contractRoot: FOUNDATION_MANIFEST_ROOT,
    request: compilation.request,
    requestRoot: compilation.requestRoot,
    source: compilation.source,
    sourceRoot: compilation.sourceRoot,
    bytecodeRoot: compilation.bytecodeRoot,
    bytecodeVersion: compilation.bytecodeVersion,
    selfhostByteIdentical: compilation.selfhostByteIdentical,
    nativeVm: first.payload.native.vm,
    nativeSourceRoot: first.payload.native.sourceRoot,
    providerHost: first.payload.providerHost,
    results,
    finalCandidate: results.at(-1).proposal,
    finalStateRoot: results.at(-1).stateDelta.afterRoot,
    deterministicReceiptRoot: receiptRoot,
    replayVerified: Boolean(replay),
    metrics,
  });
}
