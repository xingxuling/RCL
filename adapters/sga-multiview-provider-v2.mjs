import { spawnSync } from 'node:child_process';
import { createProviderRuntimeV2 } from '../src/provider-runtime-v2.mjs';
import {
  lowerSgaMultiviewToCreationProposals,
  verifySgaMultiviewCandidateSet,
} from './sga-multiview-creative-lowering.mjs';

export const SGA_MULTIVIEW_PROVIDER_ID = 'sga-multiview';
export const SGA_MULTIVIEW_PROVIDER_CAPABILITY = 'candidate.multiview.generate.v1';
export const SGA_MULTIVIEW_PROVIDER_TARGET = 'creative-reality';
export const RCL_CREATIVE_PROVIDER_ACTOR = 'rcl-creative';

export class SgaProviderBridgeError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'SgaProviderBridgeError';
    this.code = code;
    this.details = details;
  }
}

export function createPythonSgaMultiviewInvoker(options = {}) {
  const defaultPython = process.platform === 'win32' ? 'python' : 'python3';
  const python = options.pythonExecutable ?? options.python ?? defaultPython;
  const moduleDir = options.sgaModuleDir ?? options.moduleDir;
  if (typeof moduleDir !== 'string' || moduleDir.length === 0) {
    throw new SgaProviderBridgeError('SGA_PYTHON_MODULE_DIR_REQUIRED', 'sgaModuleDir is required for the Python SGA provider');
  }
  const timeoutMs = Number.isFinite(options.timeoutMs) ? Number(options.timeoutMs) : 10_000;
  const script = [
    'import json, sys',
    'from sga_multiview_candidate_generator import generate_multiview_candidates',
    'request = json.load(sys.stdin)',
    'result = generate_multiview_candidates(request)',
    'json.dump(result, sys.stdout, ensure_ascii=False, separators=(",", ":"))',
  ].join('\n');

  return async request => {
    const result = spawnSync(python, ['-B', '-c', script], {
      encoding: 'utf8',
      input: JSON.stringify(request),
      timeout: timeoutMs,
      maxBuffer: 8 * 1024 * 1024,
      env: {
        ...process.env,
        PYTHONDONTWRITEBYTECODE: '1',
        PYTHONPATH: [moduleDir, process.env.PYTHONPATH].filter(Boolean).join(process.platform === 'win32' ? ';' : ':'),
      },
    });
    if (result.error) {
      throw new SgaProviderBridgeError('SGA_PYTHON_PROCESS_ERROR', result.error.message, { python, moduleDir });
    }
    if (result.status !== 0) {
      throw new SgaProviderBridgeError('SGA_PYTHON_PROCESS_FAILED', 'Python SGA provider returned a non-zero exit status', {
        status: result.status,
        signal: result.signal ?? null,
        stderr: result.stderr,
      });
    }
    let payload;
    try {
      payload = JSON.parse(result.stdout);
    } catch (error) {
      throw new SgaProviderBridgeError('SGA_PYTHON_OUTPUT_INVALID', 'Python SGA provider did not return valid JSON', {
        message: error.message,
        stdout: result.stdout,
      });
    }
    verifySgaMultiviewCandidateSet(payload);
    return payload;
  };
}

export function createSgaMultiviewProviderDefinition(invokeGenerator, options = {}) {
  if (typeof invokeGenerator !== 'function') {
    throw new SgaProviderBridgeError('SGA_PROVIDER_INVOKER_REQUIRED', 'invokeGenerator must be a function');
  }
  return {
    id: SGA_MULTIVIEW_PROVIDER_ID,
    version: options.version ?? '0.1.0-alpha.1',
    description: 'SGA candidate-only heterogeneous structural candidate generator behind RCL Creative Reality.',
    capabilities: [{
      capability: SGA_MULTIVIEW_PROVIDER_CAPABILITY,
      target: SGA_MULTIVIEW_PROVIDER_TARGET,
      modes: ['realize'],
      effects: ['CandidateOnly'],
      timeoutMs: options.timeoutMs ?? 10_000,
      maxConcurrent: options.maxConcurrent ?? 1,
      requestBytesLimit: options.requestBytesLimit ?? 64 * 1024,
      responseBytesLimit: options.responseBytesLimit ?? 256 * 1024,
    }],
    async invoke(input) {
      const output = await invokeGenerator(input);
      verifySgaMultiviewCandidateSet(output);
      return output;
    },
  };
}

export function createSgaCreativeProviderRuntime(options = {}) {
  const invokeGenerator = options.invokeGenerator
    ?? createPythonSgaMultiviewInvoker(options.pythonProvider ?? options);
  const provider = createSgaMultiviewProviderDefinition(invokeGenerator, options.provider ?? {});
  return createProviderRuntimeV2({
    timeoutMs: options.timeoutMs ?? 12_000,
    requestBytesLimit: options.requestBytesLimit ?? 64 * 1024,
    responseBytesLimit: options.responseBytesLimit ?? 256 * 1024,
    maxConcurrent: options.maxConcurrent ?? 2,
    policy: {
      defaultAllow: false,
      allowProviderOffersWithoutPolicy: false,
      subjects: {
        [RCL_CREATIVE_PROVIDER_ACTOR]: [
          `${SGA_MULTIVIEW_PROVIDER_ID}.${SGA_MULTIVIEW_PROVIDER_CAPABILITY}@${SGA_MULTIVIEW_PROVIDER_TARGET}`,
        ],
      },
    },
    providers: [provider],
  });
}

export async function invokeSgaThroughRclCreativeProvider(runtime, request, options = {}) {
  const receipt = await runtime.invoke({
    providerId: SGA_MULTIVIEW_PROVIDER_ID,
    capability: SGA_MULTIVIEW_PROVIDER_CAPABILITY,
    target: SGA_MULTIVIEW_PROVIDER_TARGET,
    actor: options.actor ?? RCL_CREATIVE_PROVIDER_ACTOR,
    rule: options.rule ?? 'generate-candidate-proposals',
    mode: 'realize',
    input: request,
    authorityNeeds: [],
  });
  const verification = verifySgaMultiviewCandidateSet(receipt.output);
  const lowering = lowerSgaMultiviewToCreationProposals(receipt.output);
  return Object.freeze({
    format: 'rcl.sga-creative-provider-invocation.v0.1',
    providerReceipt: receipt,
    verification,
    lowering,
    authority: Object.freeze({
      providerOwnsCreativeSemantics: false,
      rclOwnsCreativeSemantics: true,
      candidateOnly: true,
      rclEvidenceCommitPerformed: false,
      rncsCommitPerformed: false,
      usceRouteChoicePerformed: false,
    }),
  });
}
