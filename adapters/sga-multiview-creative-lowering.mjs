import crypto from 'node:crypto';
import {
  creationProposal,
  isCreationProposal,
  scoreCreation,
} from '../src/creative-proposal-api.mjs';

export const SGA_MULTIVIEW_RESULT_FORMAT = 'sga.multiview-candidate-set.v0.1';
export const SGA_MULTIVIEW_CANDIDATE_FORMAT = 'sga.multiview-candidate.v0.1';
export const SGA_RCL_LOWERING_FORMAT = 'rcl.sga-multiview-creative-lowering.v0.1';

export class SgaCreativeLoweringError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'SgaCreativeLoweringError';
    this.code = code;
    this.details = details;
  }
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
  }
  return value;
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

export function canonicalSha256(value) {
  return crypto.createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');
}

function without(value, key) {
  return Object.fromEntries(Object.entries(value).filter(([name]) => name !== key));
}

function assertCandidateOnly(candidate, index) {
  if (candidate?.format !== SGA_MULTIVIEW_CANDIDATE_FORMAT) {
    throw new SgaCreativeLoweringError('SGA_CANDIDATE_FORMAT', `candidate ${index} has an unsupported format`);
  }
  if (candidate.evaluation_status !== 'UNEVALUATED') {
    throw new SgaCreativeLoweringError('SGA_CANDIDATE_ALREADY_EVALUATED', `candidate ${index} is not UNEVALUATED`);
  }
  for (const key of ['score', 'novelty', 'utility', 'feasibility', 'risk']) {
    if (Object.prototype.hasOwnProperty.call(candidate, key)) {
      throw new SgaCreativeLoweringError(
        'SGA_EVALUATOR_JUDGMENT_LEAK',
        `candidate ${index} contains evaluator-owned field '${key}'`,
      );
    }
  }
  if (
    candidate.authority?.candidate_only !== true
    || candidate.authority?.may_execute !== false
    || candidate.authority?.may_commit !== false
    || candidate.authority?.may_promote !== false
  ) {
    throw new SgaCreativeLoweringError('SGA_AUTHORITY_BOUNDARY', `candidate ${index} violates candidate-only authority`);
  }
  const expectedRoot = canonicalSha256(without(candidate, 'candidate_root'));
  if (candidate.candidate_root !== expectedRoot) {
    throw new SgaCreativeLoweringError('SGA_CANDIDATE_ROOT_MISMATCH', `candidate ${index} root mismatch`, {
      expectedRoot,
      actualRoot: candidate.candidate_root ?? null,
    });
  }
}

export function verifySgaMultiviewCandidateSet(candidateSet) {
  if (!candidateSet || typeof candidateSet !== 'object' || Array.isArray(candidateSet)) {
    throw new SgaCreativeLoweringError('SGA_SET_TYPE', 'candidate set must be an object');
  }
  if (candidateSet.format !== SGA_MULTIVIEW_RESULT_FORMAT) {
    throw new SgaCreativeLoweringError('SGA_SET_FORMAT', 'unsupported SGA candidate-set format');
  }
  if (!Array.isArray(candidateSet.candidates) || candidateSet.candidates.length === 0) {
    throw new SgaCreativeLoweringError('SGA_SET_EMPTY', 'candidate set must contain at least one candidate');
  }
  if (candidateSet.candidate_count !== candidateSet.candidates.length) {
    throw new SgaCreativeLoweringError('SGA_SET_COUNT', 'candidate_count does not match candidates.length');
  }
  const boundary = candidateSet.evaluation_boundary ?? {};
  for (const key of [
    'scores_emitted',
    'aesthetic_judgment_emitted',
    'scientific_verdict_emitted',
    'future_probability_emitted',
    'artifact_acceptance_emitted',
  ]) {
    if (boundary[key] !== false) {
      throw new SgaCreativeLoweringError('SGA_SET_EVALUATION_BOUNDARY', `evaluation boundary '${key}' is not false`);
    }
  }
  if (
    candidateSet.authority?.candidate_only !== true
    || candidateSet.authority?.may_execute !== false
    || candidateSet.authority?.may_commit_rcl_evidence !== false
    || candidateSet.authority?.may_commit_rncs_state !== false
    || candidateSet.authority?.may_promote_world_fact !== false
    || candidateSet.authority?.may_promote_organ !== false
  ) {
    throw new SgaCreativeLoweringError('SGA_SET_AUTHORITY_BOUNDARY', 'candidate set violates candidate-only authority');
  }
  candidateSet.candidates.forEach(assertCandidateOnly);
  const candidateRoots = candidateSet.candidates.map(item => item.candidate_root);
  if (new Set(candidateRoots).size !== candidateRoots.length) {
    throw new SgaCreativeLoweringError('SGA_SET_DUPLICATE_ROOT', 'candidate roots must be distinct');
  }
  const expectedSetRoot = canonicalSha256(without(candidateSet, 'set_root'));
  if (candidateSet.set_root !== expectedSetRoot) {
    throw new SgaCreativeLoweringError('SGA_SET_ROOT_MISMATCH', 'candidate-set root mismatch', {
      expectedSetRoot,
      actualRoot: candidateSet.set_root ?? null,
    });
  }
  return Object.freeze({
    valid: true,
    candidateCount: candidateSet.candidates.length,
    setRoot: candidateSet.set_root,
    sourceRoot: candidateSet.source_root,
    candidateRoots,
  });
}

export function lowerSgaMultiviewToCreationProposals(candidateSet) {
  const verification = verifySgaMultiviewCandidateSet(candidateSet);
  const proposals = candidateSet.candidates.map(candidate => {
    // v0.1 uses canonical JSON Text as the RCL value. This avoids pretending that
    // SGA's arbitrary structural object is already a Canonical RCL typed record.
    const candidateValue = canonicalJson(candidate.candidate_value);
    const basedOn = [
      `sga:set-root:${candidateSet.set_root}`,
      `sga:source-root:${candidateSet.source_root}`,
      `sga:candidate-root:${candidate.candidate_root}`,
      `sga:profile:${candidate.profile_id}`,
      ...(candidate.source_operators ?? []).map(item => `sga:operator:${item}`),
    ];
    return creationProposal('Text', candidateValue, {
      target: candidate.goal ?? '',
      evidence: [
        `sga:candidate-root:${candidate.candidate_root}`,
        `sga:set-root:${candidateSet.set_root}`,
      ],
      basedOn,
      formedAtRoot: candidateSet.source_root ?? null,
    });
  });

  if (!proposals.every(isCreationProposal)) {
    throw new SgaCreativeLoweringError('RCL_PROPOSAL_LOWERING', 'lowering did not produce CreationProposal values');
  }

  return Object.freeze({
    format: SGA_RCL_LOWERING_FORMAT,
    sourceFormat: candidateSet.format,
    sourceRoot: candidateSet.source_root,
    setRoot: candidateSet.set_root,
    candidateRoots: verification.candidateRoots,
    proposalCount: proposals.length,
    proposals,
    authority: Object.freeze({
      candidateOnly: true,
      rclEvidenceCommitPerformed: false,
      rncsCommitPerformed: false,
      selectionPerformed: false,
    }),
  });
}

export function scoreSgaCreationProposal(proposal, evaluatorReceipt) {
  if (!isCreationProposal(proposal)) {
    throw new SgaCreativeLoweringError('RCL_EXPECTED_PROPOSAL', 'scoring requires an RCL CreationProposal');
  }
  if (!evaluatorReceipt || typeof evaluatorReceipt !== 'object' || Array.isArray(evaluatorReceipt)) {
    throw new SgaCreativeLoweringError('EVALUATOR_RECEIPT_REQUIRED', 'evaluator receipt must be an object');
  }
  const evaluatorId = String(evaluatorReceipt.organ_id ?? '').trim();
  if (!evaluatorId) {
    throw new SgaCreativeLoweringError('EVALUATOR_ID_REQUIRED', 'evaluator receipt requires organ_id');
  }
  if (evaluatorId === 'sga' || evaluatorId === 'sga-multiview') {
    throw new SgaCreativeLoweringError(
      'SGA_SELF_EVALUATION_FORBIDDEN',
      'SGA candidate generator may not score its own candidate in this federation surface',
    );
  }
  const evidenceRoot = String(evaluatorReceipt.evidence_root ?? '').trim();
  if (!/^[0-9a-f]{64}$/.test(evidenceRoot)) {
    throw new SgaCreativeLoweringError('EVALUATOR_EVIDENCE_ROOT', 'evaluator receipt requires a SHA-256 evidence_root');
  }
  const scores = evaluatorReceipt.scores ?? {};
  const scoreOptions = {
    evidence: [`evaluator:${evaluatorId}:${evidenceRoot}`],
    basedOn: [`evaluator:${evaluatorId}`],
  };
  for (const key of ['novelty', 'utility', 'feasibility', 'risk']) {
    if (Object.prototype.hasOwnProperty.call(scores, key)) scoreOptions[key] = scores[key];
  }
  return scoreCreation(proposal, scoreOptions);
}
