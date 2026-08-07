import { realityRoot } from './canonical.mjs';

export const RCL_DOMAIN_ORGAN_FORMAT = 'rcl.domain-operation-organ.v0.1';
export const RCL_DOMAIN_ORGAN_REGISTRY_FORMAT = 'rcl.domain-operation-organ-registry.v0.1';
export const RCL_DOMAIN_ORGAN_PROMOTION_FORMAT = 'rcl.domain-operation-organ-promotion.v0.1';

export const RCL_DOMAIN_ORGAN_TIERS = Object.freeze([
  'quarantined',
  'differential-verified',
  'native-candidate',
  'native-verified',
]);

const TIER_RANK = new Map(RCL_DOMAIN_ORGAN_TIERS.map((tier, index) => [tier, index]));

function text(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
  return value.trim();
}

function list(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? [...value] : [value];
}

function tier(value) {
  const normalized = text(value, 'tier');
  if (!TIER_RANK.has(normalized)) throw new TypeError(`Unsupported domain organ tier '${normalized}'`);
  return normalized;
}

function rootOf(value) {
  return realityRoot(value);
}

export function createDomainOperationOrgan(input = {}) {
  const domain = text(input.domain, 'domain');
  const operation = text(input.operation, 'operation');
  const evidenceTier = tier(input.evidenceTier ?? 'quarantined');
  const semanticIdentity = text(input.semanticIdentity ?? `${domain}.${operation}`, 'semanticIdentity');
  const capability = text(input.capability ?? `domain.${domain}.${operation}`, 'capability');
  const implementation = Object.freeze({
    kind: text(input.implementation?.kind ?? 'unbound', 'implementation.kind'),
    id: text(input.implementation?.id ?? `${domain}.${operation}`, 'implementation.id'),
    artifactRoot: input.implementation?.artifactRoot ? String(input.implementation.artifactRoot) : null,
  });
  const contract = {
    format: RCL_DOMAIN_ORGAN_FORMAT,
    version: '0.1.0-alpha.1',
    key: `${domain}.${operation}`,
    domain,
    operation,
    capability,
    semanticIdentity,
    evidenceTier,
    deterministic: input.deterministic !== false,
    authorityRequirements: list(input.authorityRequirements).map(String),
    evidenceRequirements: list(input.evidenceRequirements).map(String),
    effectClasses: list(input.effectClasses).map(String),
    implementation,
    proof: Object.freeze({
      differentialRoot: input.proof?.differentialRoot ? String(input.proof.differentialRoot) : null,
      metabolismRoot: input.proof?.metabolismRoot ? String(input.proof.metabolismRoot) : null,
      nativePromotionRoot: input.proof?.nativePromotionRoot ? String(input.proof.nativePromotionRoot) : null,
    }),
    canonicalAdmission: evidenceTier === 'native-verified' && input.canonicalAdmission === true,
    boundary: input.boundary ?? 'Domain organ contracts are capability-specific and evidence-tiered. Registration alone is not native verification or canonical language admission.',
  };
  return Object.freeze({ ...contract, root: rootOf(contract) });
}

export function createDomainOperationRegistry(organs = []) {
  if (!Array.isArray(organs)) throw new TypeError('organs must be an array');
  const byKey = new Map();
  for (const raw of organs) {
    const organ = raw?.format === RCL_DOMAIN_ORGAN_FORMAT ? raw : createDomainOperationOrgan(raw);
    if (byKey.has(organ.key)) throw new TypeError(`Duplicate domain organ '${organ.key}'`);
    byKey.set(organ.key, organ);
  }
  const entries = [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key));
  const manifest = {
    format: RCL_DOMAIN_ORGAN_REGISTRY_FORMAT,
    version: '0.1.0-alpha.1',
    entryCount: entries.length,
    entries: entries.map(item => ({ key: item.key, root: item.root, evidenceTier: item.evidenceTier, capability: item.capability })),
  };
  const registryRoot = rootOf(manifest);
  return Object.freeze({
    ...manifest,
    root: registryRoot,
    resolve(domain, operation) {
      return byKey.get(`${domain}.${operation}`) ?? null;
    },
    assertInvocable(domain, operation, requiredTier = 'native-verified') {
      const organ = byKey.get(`${domain}.${operation}`);
      if (!organ) {
        const error = new Error(`Domain organ '${domain}.${operation}' is not registered`);
        error.code = 'RCL_DOMAIN_ORGAN_MISSING';
        throw error;
      }
      const required = tier(requiredTier);
      if (TIER_RANK.get(organ.evidenceTier) < TIER_RANK.get(required)) {
        const error = new Error(`Domain organ '${organ.key}' is ${organ.evidenceTier}; ${required} is required`);
        error.code = 'RCL_DOMAIN_ORGAN_EVIDENCE_TIER';
        error.details = { key: organ.key, actual: organ.evidenceTier, required };
        throw error;
      }
      return organ;
    },
  });
}

export function promoteDifferentialToDomainOrganCandidate(input = {}) {
  const operation = input.operation?.format === RCL_DOMAIN_ORGAN_FORMAT
    ? input.operation
    : createDomainOperationOrgan({ ...input.operation, evidenceTier: 'quarantined' });
  const differential = input.differentialReport?.report ?? input.differentialReport;
  if (!differential || differential.passed !== true || differential.promotionEligible !== true || !differential.root) {
    const error = new Error('Passed promotion-eligible differential evidence is required');
    error.code = 'RCL_DOMAIN_ORGAN_DIFFERENTIAL_REQUIRED';
    throw error;
  }
  const capability = String(differential.capability ?? operation.capability);
  const candidate = createDomainOperationOrgan({
    ...operation,
    capability,
    evidenceTier: 'native-candidate',
    implementation: input.implementation ?? { kind: 'rbc13-opcode45-candidate', id: operation.key },
    proof: {
      ...operation.proof,
      differentialRoot: differential.root,
      metabolismRoot: input.metabolismReport?.root ?? operation.proof?.metabolismRoot ?? null,
    },
    canonicalAdmission: false,
    boundary: 'Differential evidence is sufficient to create a native candidate, not to claim native execution. Native Promotion must still bind an implementation artifact and native VM receipt.',
  });
  const report = {
    format: RCL_DOMAIN_ORGAN_PROMOTION_FORMAT,
    status: 'native-candidate',
    operationKey: operation.key,
    candidateRoot: candidate.root,
    differentialRoot: differential.root,
    nativePromotionRequired: true,
  };
  return Object.freeze({ candidate, report: Object.freeze({ ...report, root: rootOf(report) }) });
}

export function admitNativeVerifiedDomainOrgan(input = {}) {
  const candidate = input.candidate;
  const nativePromotion = input.nativePromotionReport;
  if (!candidate || candidate.format !== RCL_DOMAIN_ORGAN_FORMAT || candidate.evidenceTier !== 'native-candidate') {
    throw new TypeError('A native-candidate domain organ is required');
  }
  if (!nativePromotion || nativePromotion.status !== 'native-verified' || nativePromotion.verified !== true || !nativePromotion.root) {
    const error = new Error('A native-verified Native Promotion report is required');
    error.code = 'RCL_DOMAIN_ORGAN_NATIVE_PROMOTION_REQUIRED';
    throw error;
  }
  const verified = createDomainOperationOrgan({
    ...candidate,
    evidenceTier: 'native-verified',
    implementation: {
      ...candidate.implementation,
      artifactRoot: candidate.implementation.artifactRoot ?? nativePromotion.implementationRoot ?? null,
    },
    proof: {
      ...candidate.proof,
      nativePromotionRoot: nativePromotion.root,
    },
    canonicalAdmission: input.canonicalAdmission === true,
    boundary: 'Native verification is case- and artifact-bounded. Canonical admission remains a separate language-governance decision.',
  });
  return verified;
}
