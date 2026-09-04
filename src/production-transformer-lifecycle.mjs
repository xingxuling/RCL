import crypto from 'node:crypto';

export const RCL_TRANSFORMER_LIFECYCLE_VERSION = '0.1.0-candidate';
export const RCL_TRANSFORMER_LIFECYCLE_FORMAT = 'rcl.production-transformer-lifecycle.v0.1';

export const TRANSFORMER_PHASES = Object.freeze([
  'SPEC_FROZEN',
  'DATA_ADMITTED',
  'TOKENIZER_FROZEN',
  'TRAINING_READY',
  'TRAINING',
  'CHECKPOINTED',
  'EVALUATED',
  'SERVING_CANDIDATE',
]);

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  }
  return value;
}

function root(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function requireRoot(value, name) {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/u.test(value)) throw new Error(`RCL_TRANSFORMER_${name}_ROOT_INVALID`);
  return value;
}

function requireBool(value, name) {
  if (value !== true) throw new Error(`RCL_TRANSFORMER_${name}_REQUIRED`);
}

function phaseIndex(phase) {
  const index = TRANSFORMER_PHASES.indexOf(phase);
  if (index < 0) throw new Error('RCL_TRANSFORMER_PHASE_INVALID');
  return index;
}

export function createTransformerLifecycle(spec) {
  const core = {
    format: RCL_TRANSFORMER_LIFECYCLE_FORMAT,
    version: RCL_TRANSFORMER_LIFECYCLE_VERSION,
    lifecycleId: String(spec.lifecycleId ?? ''),
    phase: 'SPEC_FROZEN',
    modelSpecRoot: requireRoot(spec.modelSpecRoot, 'MODEL_SPEC'),
    optimizerContractRoot: requireRoot(spec.optimizerContractRoot, 'OPTIMIZER_CONTRACT'),
    numericalProfileRoot: requireRoot(spec.numericalProfileRoot, 'NUMERICAL_PROFILE'),
    providerPlanRoot: requireRoot(spec.providerPlanRoot, 'PROVIDER_PLAN'),
    corpusAdmissionRoot: null,
    tokenizerRoot: null,
    checkpointRoot: null,
    evaluationRoot: null,
    servingEvaluationRoot: null,
    history: [],
    authority: {
      trainingProviderOwnsExecution: true,
      rclOwnsLifecycleSemantics: true,
      canonicalPromotionPerformed: false,
      worldFactPromoted: false,
      actionAuthorityGranted: false,
    },
  };
  if (!core.lifecycleId) throw new Error('RCL_TRANSFORMER_LIFECYCLE_ID_REQUIRED');
  return Object.freeze({ ...core, lifecycleRoot: root(core) });
}

function verifyEvidence(nextPhase, evidence, state) {
  if (!evidence || typeof evidence !== 'object') throw new Error('RCL_TRANSFORMER_EVIDENCE_REQUIRED');
  switch (nextPhase) {
    case 'DATA_ADMITTED':
      requireBool(evidence.admitted, 'CORPUS_ADMISSION');
      requireBool(evidence.licenseReviewed, 'CORPUS_LICENSE_REVIEW');
      requireBool(evidence.privacyReviewed, 'CORPUS_PRIVACY_REVIEW');
      requireBool(evidence.poisonReviewed, 'CORPUS_POISON_REVIEW');
      return { corpusAdmissionRoot: requireRoot(evidence.corpusAdmissionRoot, 'CORPUS_ADMISSION') };
    case 'TOKENIZER_FROZEN':
      if (evidence.corpusAdmissionRoot !== state.corpusAdmissionRoot) throw new Error('RCL_TRANSFORMER_CORPUS_LINEAGE_MISMATCH');
      return { tokenizerRoot: requireRoot(evidence.tokenizerRoot, 'TOKENIZER') };
    case 'TRAINING_READY':
      if (evidence.providerPlanRoot !== state.providerPlanRoot) throw new Error('RCL_TRANSFORMER_PROVIDER_PLAN_MISMATCH');
      requireBool(evidence.resourceBudgetFrozen, 'RESOURCE_BUDGET_FROZEN');
      requireBool(evidence.checkpointPolicyFrozen, 'CHECKPOINT_POLICY_FROZEN');
      requireBool(evidence.evaluationProtocolFrozen, 'EVALUATION_PROTOCOL_FROZEN');
      return {};
    case 'TRAINING':
      requireBool(evidence.externalProviderExecutionStarted, 'EXTERNAL_PROVIDER_EXECUTION');
      if (evidence.rclExecutedTraining === true) throw new Error('RCL_TRANSFORMER_OWNER_THEFT');
      return {};
    case 'CHECKPOINTED':
      requireBool(evidence.atomicCheckpointVerified, 'ATOMIC_CHECKPOINT');
      return { checkpointRoot: requireRoot(evidence.checkpointRoot, 'CHECKPOINT') };
    case 'EVALUATED':
      if (evidence.checkpointRoot !== state.checkpointRoot) throw new Error('RCL_TRANSFORMER_CHECKPOINT_LINEAGE_MISMATCH');
      requireBool(evidence.heldoutProtocolRespected, 'HELDOUT_PROTOCOL');
      if (evidence.contaminated === true) throw new Error('RCL_TRANSFORMER_EVALUATION_CONTAMINATED');
      return { evaluationRoot: requireRoot(evidence.evaluationRoot, 'EVALUATION') };
    case 'SERVING_CANDIDATE':
      if (evidence.evaluationRoot !== state.evaluationRoot) throw new Error('RCL_TRANSFORMER_EVALUATION_LINEAGE_MISMATCH');
      requireBool(evidence.autoregressiveReplayVerified, 'AUTOREGRESSIVE_REPLAY');
      return { servingEvaluationRoot: requireRoot(evidence.servingEvaluationRoot, 'SERVING_EVALUATION') };
    default:
      throw new Error('RCL_TRANSFORMER_TRANSITION_UNSUPPORTED');
  }
}

export function advanceTransformerLifecycle(state, nextPhase, evidence) {
  if (!state || state.format !== RCL_TRANSFORMER_LIFECYCLE_FORMAT) throw new Error('RCL_TRANSFORMER_STATE_INVALID');
  const current = phaseIndex(state.phase);
  const next = phaseIndex(nextPhase);
  if (next !== current + 1) throw new Error('RCL_TRANSFORMER_NON_SEQUENTIAL_TRANSITION');
  const patch = verifyEvidence(nextPhase, evidence, state);
  const receiptCore = {
    lifecycleId: state.lifecycleId,
    from: state.phase,
    to: nextPhase,
    evidenceRoot: root(evidence),
    priorLifecycleRoot: state.lifecycleRoot,
    canonicalPromotionPerformed: false,
  };
  const receipt = Object.freeze({ ...receiptCore, receiptRoot: root(receiptCore) });
  const nextCore = {
    ...state,
    ...patch,
    phase: nextPhase,
    history: [...state.history, receipt],
    lifecycleRoot: undefined,
  };
  delete nextCore.lifecycleRoot;
  return Object.freeze({ ...nextCore, lifecycleRoot: root(nextCore) });
}

export function transformerLifecycleGapReport(state) {
  const index = phaseIndex(state.phase);
  const remaining = TRANSFORMER_PHASES.slice(index + 1);
  return Object.freeze({
    format: 'rcl.production-transformer-lifecycle-gap-report.v0.1',
    lifecycleId: state.lifecycleId,
    phase: state.phase,
    remaining,
    semanticsClosed: true,
    productionEvidenceComplete: state.phase === 'SERVING_CANDIDATE',
    canonicalPromotionPerformed: false,
    providerExecutionRequired: remaining.some(item => ['TRAINING', 'CHECKPOINTED', 'EVALUATED', 'SERVING_CANDIDATE'].includes(item)),
  });
}
