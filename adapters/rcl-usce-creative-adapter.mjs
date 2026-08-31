#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import {
  createSgaCreativeProviderRuntime,
  invokeSgaThroughRclCreativeProvider,
} from './sga-multiview-provider-v2.mjs';

export const RCL_USCE_CREATIVE_PROVIDER_SCHEMA = 'rcl.usce-creative-provider-handshake.v0.1';
export const RCL_USCE_CREATIVE_RESULT_FORMAT = 'rcl.usce-creative-candidate-result.v0.1';
export const RCL_USCE_CREATIVE_CAPABILITY = 'creative.generate.candidate.v1';

export class RclUsceCreativeAdapterError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'RclUsceCreativeAdapterError';
    this.code = code;
    this.details = details;
  }
}

export function creativeProviderHandshake() {
  return Object.freeze({
    schema_id: RCL_USCE_CREATIVE_PROVIDER_SCHEMA,
    status: 'REACHABLE',
    organ_id: 'rcl',
    capabilities: [RCL_USCE_CREATIVE_CAPABILITY],
    declared_capabilities: [RCL_USCE_CREATIVE_CAPABILITY],
    canonical_semantic_owner: 'rcl',
    implementation_provider: 'sga-multiview',
    authority_boundary: Object.freeze({
      candidate_only: true,
      provider_owns_creative_semantics: false,
      rcl_owns_creative_semantics: true,
      may_score_automatically: false,
      may_select_automatically: false,
      may_commit_rcl_evidence: false,
      may_commit_rncs_state: false,
      may_promote_world_fact: false,
      may_promote_organ: false,
    }),
  });
}

function normalizeCandidateRequest(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new RclUsceCreativeAdapterError('RCL_CREATIVE_REQUEST_INVALID', 'creative request must be an object');
  }
  const goal = String(payload.goal ?? '').trim();
  if (!goal) {
    throw new RclUsceCreativeAdapterError('RCL_CREATIVE_GOAL_REQUIRED', 'goal is required');
  }
  if (!payload.base_structure || typeof payload.base_structure !== 'object' || Array.isArray(payload.base_structure)) {
    throw new RclUsceCreativeAdapterError('RCL_CREATIVE_BASE_STRUCTURE_REQUIRED', 'base_structure must be an object');
  }
  const request = {
    format: 'sga.multiview-request.v0.1',
    goal,
    base_structure: structuredClone(payload.base_structure),
    constraints: structuredClone(payload.constraints ?? []),
    invariants: structuredClone(payload.invariants ?? []),
    known_conflicts: structuredClone(payload.known_conflicts ?? []),
  };
  if (payload.candidate_budget !== undefined) request.candidate_budget = payload.candidate_budget;
  return request;
}

function compactProposal(proposal) {
  if (proposal?.kind !== 'CreationProposal' || Object.hasOwn(proposal, 'score')) {
    throw new RclUsceCreativeAdapterError('RCL_CREATIVE_PROPOSAL_INVALID', 'RCL creative candidate surface must return an unscored CreationProposal');
  }
  return {
    kind: proposal.kind,
    base_type: proposal.baseType,
    value: proposal.value,
    active: proposal.active,
    target: proposal.target,
    status: proposal.status,
    evidence: [...(proposal.evidence ?? [])],
    based_on: [...(proposal.basedOn ?? [])],
    formed_at_root: proposal.formedAtRoot ?? null,
  };
}

export async function invokeCreativeCandidate(payload, options = {}) {
  const request = normalizeCandidateRequest(payload);
  const runtime = options.runtime ?? createSgaCreativeProviderRuntime({
    invokeGenerator: options.invokeGenerator,
    pythonProvider: options.invokeGenerator ? undefined : {
      sgaModuleDir: options.sgaModuleDir ?? process.env.TAOWIND_SGA_MULTIVIEW_MODULE_DIR,
      pythonExecutable: options.pythonExecutable ?? process.env.TAOWIND_PYTHON ?? 'python3',
      timeoutMs: options.providerTimeoutMs ?? 10_000,
    },
    timeoutMs: options.runtimeTimeoutMs ?? 12_000,
  });
  const result = await invokeSgaThroughRclCreativeProvider(runtime, request);
  if (result.authority?.candidateOnly !== true
    || result.authority?.providerOwnsCreativeSemantics !== false
    || result.authority?.rclOwnsCreativeSemantics !== true
    || result.authority?.rclEvidenceCommitPerformed !== false
    || result.authority?.rncsCommitPerformed !== false
    || result.authority?.usceRouteChoicePerformed !== false) {
    throw new RclUsceCreativeAdapterError('RCL_CREATIVE_AUTHORITY_BOUNDARY', 'creative Provider result violated the RCL authority boundary');
  }
  const proposals = result.lowering.proposals.map(compactProposal);
  return Object.freeze({
    format: RCL_USCE_CREATIVE_RESULT_FORMAT,
    status: 'CANDIDATE',
    capability_id: RCL_USCE_CREATIVE_CAPABILITY,
    provider: Object.freeze({
      organ_id: 'rcl',
      implementation_provider: result.providerReceipt.providerId,
      provider_receipt_root: result.providerReceipt.root,
      provider_output_root: result.providerReceipt.outputRoot,
    }),
    candidate_set: Object.freeze({
      source_root: result.verification.sourceRoot,
      set_root: result.verification.setRoot,
      candidate_roots: [...result.verification.candidateRoots],
    }),
    proposals,
    evaluation_status: 'UNEVALUATED',
    scoring_performed: false,
    selection_performed: false,
    canonical_promotion_performed: false,
    rcl_evidence_commit_performed: false,
    rncs_commit_performed: false,
    world_fact_promoted: false,
  });
}

export async function handleCreativeAdapterRequest(request, options = {}) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    throw new RclUsceCreativeAdapterError('RCL_CREATIVE_ADAPTER_REQUEST_INVALID', 'adapter request must be an object');
  }
  if (request.action === 'handshake') return creativeProviderHandshake();
  if (request.action !== 'invoke') {
    throw new RclUsceCreativeAdapterError('RCL_CREATIVE_ADAPTER_ACTION_UNSUPPORTED', `unsupported action '${request.action}'`);
  }
  if (request.capability_id !== RCL_USCE_CREATIVE_CAPABILITY) {
    throw new RclUsceCreativeAdapterError('RCL_CREATIVE_CAPABILITY_UNSUPPORTED', `unsupported capability '${request.capability_id}'`);
  }
  return invokeCreativeCandidate(request.payload, options);
}

async function main() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  let request;
  try {
    request = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const response = await handleCreativeAdapterRequest(request);
    process.stdout.write(`${JSON.stringify(response)}\n`);
  } catch (error) {
    const payload = {
      status: 'REJECTED',
      code: error?.code ?? 'RCL_CREATIVE_ADAPTER_FAILED',
      detail: error?.message ?? String(error),
    };
    process.stdout.write(`${JSON.stringify(payload)}\n`);
    process.exitCode = 1;
  }
}

const direct = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (direct) await main();
