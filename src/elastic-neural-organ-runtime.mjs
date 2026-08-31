import { realityRoot } from './canonical.mjs';

export const RCL_ELASTIC_NEURAL_ORGAN_VERSION = '0.1.0-candidate.1';
export const RCL_ELASTIC_NEURAL_ORGAN_MANIFEST_FORMAT = 'rcl.elastic-neural-organ-manifest.v0.1';
export const RCL_ELASTIC_NEURAL_ORGAN_TRANSITION_FORMAT = 'rcl.elastic-neural-organ-transition.v0.1';

const SHA256_RE = /^[0-9a-f]{64}$/u;
const STATES = new Set(['UNLOADED', 'STAGED', 'ACTIVE', 'SUSPENDED', 'QUARANTINED']);
const ALLOWED = Object.freeze({
  UNLOADED: new Set(['STAGED', 'QUARANTINED']),
  STAGED: new Set(['ACTIVE', 'UNLOADED', 'QUARANTINED']),
  ACTIVE: new Set(['SUSPENDED', 'UNLOADED', 'QUARANTINED']),
  SUSPENDED: new Set(['ACTIVE', 'UNLOADED', 'QUARANTINED']),
  QUARANTINED: new Set(['UNLOADED']),
});
function text(value, code) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new TypeError(code);
  return value.trim();
}
function sha(value, code) {
  if (typeof value !== 'string' || !SHA256_RE.test(value)) throw new TypeError(code);
  return value;
}
function uniqueStrings(values, code) {
  if (!Array.isArray(values) || values.some((value) => typeof value !== 'string' || value.length === 0)) throw new TypeError(code);
  if (new Set(values).size !== values.length) throw new TypeError(`${code}_DUPLICATE`);
  return [...values].sort();
}
function roots(values, code) { return uniqueStrings(values, code).map((value) => sha(value, code)); }
function budget(value = {}) {
  const out = {};
  for (const key of ['cpu', 'ramBytes', 'vramBytes', 'networkBytesPerSecond']) {
    const numeric = Number(value[key] ?? 0);
    if (!Number.isFinite(numeric) || numeric < 0) throw new TypeError(`RCL_ELASTIC_RESOURCE_BUDGET_INVALID:${key}`);
    out[key] = numeric;
  }
  return out;
}

export function createElasticNeuralOrganManifest(input = {}) {
  const core = {
    format: RCL_ELASTIC_NEURAL_ORGAN_MANIFEST_FORMAT,
    version: RCL_ELASTIC_NEURAL_ORGAN_VERSION,
    organId: text(input.organId, 'RCL_ELASTIC_ORGAN_ID_REQUIRED'),
    identityRoot: sha(input.identityRoot, 'RCL_ELASTIC_IDENTITY_ROOT_INVALID'),
    semanticOwner: text(input.semanticOwner, 'RCL_ELASTIC_SEMANTIC_OWNER_REQUIRED'),
    artifactRoots: roots(input.artifactRoots ?? [], 'RCL_ELASTIC_ARTIFACT_ROOT_INVALID'),
    dependencyRoots: roots(input.dependencyRoots ?? [], 'RCL_ELASTIC_DEPENDENCY_ROOT_INVALID'),
    capabilities: uniqueStrings(input.capabilities ?? [], 'RCL_ELASTIC_CAPABILITIES_INVALID'),
    resourceBudget: budget(input.resourceBudget),
    ownership: {
      lifecycleGovernance: 'rcl',
      semanticCapability: text(input.semanticOwner, 'RCL_ELASTIC_SEMANTIC_OWNER_REQUIRED'),
      subjectIdentityTransferred: false,
      worldTruthTransferred: false,
    },
  };
  if (core.artifactRoots.length === 0) throw new Error('RCL_ELASTIC_ARTIFACT_ROOT_REQUIRED');
  if (core.capabilities.length === 0) throw new Error('RCL_ELASTIC_CAPABILITY_REQUIRED');
  return Object.freeze({ ...core, manifestRoot: realityRoot(core) });
}

export class ElasticNeuralOrganLifecycle {
  constructor(manifest) {
    if (!manifest || manifest.format !== RCL_ELASTIC_NEURAL_ORGAN_MANIFEST_FORMAT) throw new TypeError('RCL_ELASTIC_MANIFEST_REQUIRED');
    this.manifest = manifest;
    this.state = 'UNLOADED';
    this.epoch = 0;
    this.history = [];
  }

  plan(targetState) {
    if (!STATES.has(targetState)) throw new Error('RCL_ELASTIC_TARGET_STATE_INVALID');
    if (!ALLOWED[this.state].has(targetState)) throw new Error(`RCL_ELASTIC_TRANSITION_INVALID:${this.state}->${targetState}`);
    const core = {
      format: 'rcl.elastic-neural-organ-transition-plan.v0.1',
      organId: this.manifest.organId,
      manifestRoot: this.manifest.manifestRoot,
      identityRoot: this.manifest.identityRoot,
      fromState: this.state,
      toState: targetState,
      epoch: this.epoch + 1,
      providerExecutionRequired: true,
      authorityEscalationPerformed: false,
      canonicalPromotionPerformed: false,
      rclEvidenceCommitPerformed: false,
      worldFactPromoted: false,
    };
    return Object.freeze({ ...core, planRoot: realityRoot(core) });
  }

  settle(plan, providerReceipt = {}) {
    if (!plan || plan.manifestRoot !== this.manifest.manifestRoot || plan.identityRoot !== this.manifest.identityRoot) throw new Error('RCL_ELASTIC_PLAN_IDENTITY_DRIFT');
    if (plan.fromState !== this.state || plan.epoch !== this.epoch + 1) throw new Error('RCL_ELASTIC_PLAN_STALE');
    if (!ALLOWED[this.state].has(plan.toState)) throw new Error('RCL_ELASTIC_PLAN_TRANSITION_INVALID');
    if (providerReceipt.planRoot !== plan.planRoot || providerReceipt.manifestRoot !== this.manifest.manifestRoot) throw new Error('RCL_ELASTIC_PROVIDER_RECEIPT_ROOT_MISMATCH');
    if (providerReceipt.status !== 'SUCCESS') throw new Error('RCL_ELASTIC_PROVIDER_EXECUTION_NOT_SUCCESSFUL');
    if (providerReceipt.atomic !== true) throw new Error('RCL_ELASTIC_PROVIDER_ATOMICITY_REQUIRED');
    if (providerReceipt.canonicalPromotionPerformed === true || providerReceipt.rclEvidenceCommitPerformed === true || providerReceipt.worldFactPromoted === true) {
      throw new Error('RCL_ELASTIC_PROVIDER_RECEIPT_AUTHORITY_ESCALATION');
    }
    const used = budget(providerReceipt.resourceUsage);
    for (const key of Object.keys(used)) {
      const limit = this.manifest.resourceBudget[key];
      if (limit > 0 && used[key] > limit) throw new Error(`RCL_ELASTIC_RESOURCE_BUDGET_EXCEEDED:${key}`);
    }
    const previousState = this.state;
    this.state = plan.toState;
    this.epoch = plan.epoch;
    const core = {
      format: RCL_ELASTIC_NEURAL_ORGAN_TRANSITION_FORMAT,
      version: RCL_ELASTIC_NEURAL_ORGAN_VERSION,
      organId: this.manifest.organId,
      manifestRoot: this.manifest.manifestRoot,
      identityRoot: this.manifest.identityRoot,
      fromState: previousState,
      toState: this.state,
      epoch: this.epoch,
      providerReceiptRoot: sha(providerReceipt.receiptRoot, 'RCL_ELASTIC_PROVIDER_RECEIPT_ROOT_INVALID'),
      resourceUsage: used,
      semanticOwner: this.manifest.semanticOwner,
      identityPreserved: true,
      semanticOwnershipTransferred: false,
      subjectIdentityTransferred: false,
      canonicalPromotionPerformed: false,
      rclEvidenceCommitPerformed: false,
      worldFactPromoted: false,
    };
    const receipt = Object.freeze({ ...core, transitionRoot: realityRoot(core) });
    this.history.push(receipt);
    return receipt;
  }
}
