import { realityRoot } from './canonical.mjs';

export const RCL_CANDIDATE_VERIFIER_VERSION = '0.1.0-candidate.1';
export const RCL_CANDIDATE_VERIFICATION_FORMAT = 'rcl.candidate-verification-receipt.v0.1';

const SHA256_RE = /^[0-9a-f]{64}$/u;
const FORBIDDEN_AUTHORITY_FLAGS = Object.freeze([
  'authorityEscalationPerformed',
  'canonicalPromotionPerformed',
  'rclEvidenceCommitPerformed',
  'worldFactPromoted',
  'rncsRealityCommitPerformed',
  'externalEffectPerformed',
]);

function text(value, code) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(code);
  }
  return value.trim();
}

function normalizeEvidenceRoots(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return { values: [], diagnostics: ['RCL_CANDIDATE_EVIDENCE_ROOT_REQUIRED'] };
  }
  const diagnostics = [];
  const out = [];
  const seen = new Set();
  for (const raw of values) {
    if (typeof raw !== 'string' || !SHA256_RE.test(raw)) {
      diagnostics.push('RCL_CANDIDATE_EVIDENCE_ROOT_INVALID');
      continue;
    }
    if (seen.has(raw)) {
      diagnostics.push('RCL_CANDIDATE_EVIDENCE_ROOT_DUPLICATE');
      continue;
    }
    seen.add(raw);
    out.push(raw);
  }
  return { values: out.sort(), diagnostics };
}

function normalizeAuthorityAssertions(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const assertions = Object.fromEntries(
    FORBIDDEN_AUTHORITY_FLAGS.map((key) => [key, source[key] === true]),
  );
  return Object.freeze(assertions);
}

export function verifyCandidateEnvelope(input = {}) {
  const diagnostics = [];
  let owner = null;
  let expectedOwner = null;
  let capabilityId = null;
  let claimScope = null;
  let authorityDomain = null;
  let effectClass = null;

  try { owner = text(input.owner, 'RCL_CANDIDATE_OWNER_REQUIRED'); }
  catch (error) { diagnostics.push(error.message); }
  try { expectedOwner = text(input.expectedOwner, 'RCL_CANDIDATE_EXPECTED_OWNER_REQUIRED'); }
  catch (error) { diagnostics.push(error.message); }
  try { capabilityId = text(input.capabilityId, 'RCL_CANDIDATE_CAPABILITY_REQUIRED'); }
  catch (error) { diagnostics.push(error.message); }
  try { claimScope = text(input.claimScope, 'RCL_CANDIDATE_CLAIM_SCOPE_REQUIRED'); }
  catch (error) { diagnostics.push(error.message); }
  try { authorityDomain = text(input.authorityDomain, 'RCL_CANDIDATE_AUTHORITY_DOMAIN_REQUIRED'); }
  catch (error) { diagnostics.push(error.message); }
  try { effectClass = text(input.effectClass, 'RCL_CANDIDATE_EFFECT_CLASS_REQUIRED'); }
  catch (error) { diagnostics.push(error.message); }

  if (!Object.prototype.hasOwnProperty.call(input, 'candidate')) {
    diagnostics.push('RCL_CANDIDATE_VALUE_REQUIRED');
  }

  let computedCandidateRoot = null;
  if (Object.prototype.hasOwnProperty.call(input, 'candidate')) {
    try { computedCandidateRoot = realityRoot(input.candidate); }
    catch { diagnostics.push('RCL_CANDIDATE_CANONICALIZATION_FAILED'); }
  }

  const suppliedCandidateRoot = input.candidateRoot;
  if (typeof suppliedCandidateRoot !== 'string' || !SHA256_RE.test(suppliedCandidateRoot)) {
    diagnostics.push('RCL_CANDIDATE_ROOT_REQUIRED');
  } else if (computedCandidateRoot && suppliedCandidateRoot !== computedCandidateRoot) {
    diagnostics.push('RCL_CANDIDATE_ROOT_MISMATCH');
  }

  if (owner && expectedOwner && owner !== expectedOwner) {
    diagnostics.push('RCL_CANDIDATE_OWNER_MISMATCH');
  }

  const evidence = normalizeEvidenceRoots(input.evidenceRoots);
  diagnostics.push(...evidence.diagnostics);

  const authorityAssertions = normalizeAuthorityAssertions(input.authorityAssertions);
  for (const [flag, enabled] of Object.entries(authorityAssertions)) {
    if (enabled) diagnostics.push(`RCL_CANDIDATE_FORBIDDEN_AUTHORITY_FLAG:${flag}`);
  }

  const uniqueDiagnostics = [...new Set(diagnostics)].sort();
  const status = uniqueDiagnostics.length === 0 ? 'VERIFIED_CANDIDATE' : 'REJECTED';
  const core = {
    format: RCL_CANDIDATE_VERIFICATION_FORMAT,
    version: RCL_CANDIDATE_VERIFIER_VERSION,
    status,
    owner,
    expectedOwner,
    capabilityId,
    claimScope,
    authorityDomain,
    effectClass,
    candidateRoot: computedCandidateRoot ?? suppliedCandidateRoot ?? null,
    evidenceRoots: evidence.values,
    diagnostics: uniqueDiagnostics,
    authorityAssertions,
    verificationBoundary: {
      semanticTruthCertified: false,
      aestheticQualityCertified: false,
      scientificTruthCertified: false,
      forecastQualityCertified: false,
      artifactAcceptanceCertified: false,
      authorityEscalationPerformed: false,
      canonicalPromotionPerformed: false,
      rclEvidenceCommitPerformed: false,
      worldFactPromoted: false,
      rncsRealityCommitPerformed: false,
      externalEffectPerformed: false,
    },
  };
  return Object.freeze({ ...core, verificationRoot: realityRoot(core) });
}

export function assertCandidateEnvelope(input = {}) {
  const report = verifyCandidateEnvelope(input);
  if (report.status !== 'VERIFIED_CANDIDATE') {
    const error = new Error(`RCL_CANDIDATE_VERIFICATION_REJECTED:${report.diagnostics.join(',')}`);
    error.code = 'RCL_CANDIDATE_VERIFICATION_REJECTED';
    error.report = report;
    throw error;
  }
  return report;
}
