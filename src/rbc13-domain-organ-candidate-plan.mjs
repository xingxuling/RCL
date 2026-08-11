import {
  createDomainOperationOrgan,
  promoteDifferentialToDomainOrganCandidate,
} from './domain-operation-organ.mjs';
import {
  RBC13_ADMITTED_DOMAIN_OPERATION_KEYS,
  runRbc13DomainOperationDifferential,
} from './rbc13-domain-operation-differential.mjs';

export const RBC13_DOMAIN_ORGAN_CANDIDATE_PLAN_FORMAT =
  'taowind.rcl-rbc13-domain-organ-candidate-plan.v0.1';

const IMPLEMENTATIONS = Object.freeze({
  'core.echo': Object.freeze({
    domain: 'core', operation: 'echo',
    id: 'candidate.native.core.echo.v0.1',
  }),
  'quantity.make': Object.freeze({
    domain: 'quantity', operation: 'make',
    id: 'candidate.native.quantity.make.v0.1',
  }),
  'quantitative.measure': Object.freeze({
    domain: 'quantitative', operation: 'measure',
    id: 'candidate.native.quantitative.measure.v0.1',
  }),
  'knowledge.claim': Object.freeze({
    domain: 'knowledge', operation: 'claim',
    id: 'candidate.native.knowledge.claim.v0.1',
  }),
});

export async function buildRbc13DomainOrganCandidatePlan(operationKey, options = {}) {
  if (!RBC13_ADMITTED_DOMAIN_OPERATION_KEYS.includes(operationKey)) {
    throw new TypeError(`Unsupported admitted domain operation '${operationKey}'`);
  }
  const implementation = IMPLEMENTATIONS[operationKey];
  const differential = await runRbc13DomainOperationDifferential(operationKey, options);
  if (!differential.passed || !differential.promotionEligible) {
    const error = new Error(`Operation '${operationKey}' did not clear its differential candidate gate`);
    error.code = 'RCL_RBC13_DOMAIN_DIFFERENTIAL_GATE';
    error.details = {
      passed: differential.passed,
      promotionEligible: differential.promotionEligible,
      score: differential.evidenceScore,
      differentialRoot: differential.differentialRoot,
    };
    throw error;
  }

  const base = createDomainOperationOrgan({
    domain: implementation.domain,
    operation: implementation.operation,
    capability: differential.capability,
    semanticIdentity: operationKey,
    evidenceTier: 'quarantined',
    deterministic: true,
    implementation: {
      kind: 'rbc13-opcode45-c-organ',
      id: implementation.id,
      artifactRoot: null,
    },
    authorityRequirements: ['pure-internal-domain-operation'],
    evidenceRequirements: ['operation-scoped-independent-differential'],
    effectClasses: ['internal-domain-evaluation'],
  });

  const promoted = promoteDifferentialToDomainOrganCandidate({
    operation: base,
    differentialReport: differential.report,
    implementation: {
      kind: 'rbc13-opcode45-c-organ',
      id: implementation.id,
      artifactRoot: null,
    },
  });

  return Object.freeze({
    format: RBC13_DOMAIN_ORGAN_CANDIDATE_PLAN_FORMAT,
    operationKey,
    differential,
    candidate: promoted.candidate,
    promotion: promoted.report,
    implementationSource: 'native/rcl_domain_admitted_organs.c',
    candidateVmMaterializer: 'scripts/materialize-rbc13-domain-vm-public-api.mjs',
    nativePromotionPending: true,
    artifactBindingPending: true,
    canonicalAdmission: false,
    boundary:
      'This plan proves operation-scoped differential eligibility and binds it to a named candidate implementation. The implementation still lacks a deterministic artifact root and Native Promotion receipt.',
  });
}

export async function buildAllRbc13DomainOrganCandidatePlans(options = {}) {
  const plans = [];
  for (const operationKey of RBC13_ADMITTED_DOMAIN_OPERATION_KEYS) {
    plans.push(await buildRbc13DomainOrganCandidatePlan(operationKey, options));
  }
  return Object.freeze(plans);
}
