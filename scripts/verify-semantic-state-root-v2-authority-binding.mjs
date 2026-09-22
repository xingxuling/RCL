#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  RCL_CANONICAL_F64_FORMAT,
  RCL_CANONICAL_F64_VERSION,
  RCL_SEMANTIC_STATE_ROOT_V2_ALGORITHM,
} from '../src/canonical-f64.mjs';
import {
  RCL_NATIVE_STATE_ROOT_ALGORITHM,
  RCL_NATIVE_STATE_ROOT_ALGORITHMS,
} from '../src/semantic-state-root.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const readJson = relative => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const component = readJson('COMPONENT-VERSIONS.json');
const contract = readJson('VERSION-CONTRACT.json');
const evidence = readJson('evidence/RCL_GAP_AI010_NATIVE_V2_INTEGRATION_CANDIDATE_v0.1.json');

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function validate(componentSnapshot, contractSnapshot, evidenceSnapshot) {
  const errors = [];
  const compRoot = componentSnapshot?.components?.semanticStateRoot ?? {};
  const contractRoot = contractSnapshot?.claims?.nativeSemanticAuthorityRoot ?? {};
  const compCandidate = (compRoot.candidates ?? []).find(item => item?.algorithm === RCL_SEMANTIC_STATE_ROOT_V2_ALGORITHM);
  const contractCandidate = (contractRoot.candidateAlgorithms ?? []).find(item => item?.algorithm === RCL_SEMANTIC_STATE_ROOT_V2_ALGORITHM);
  const boundary = contractSnapshot?.boundary ?? {};
  const authorityBoundary = evidenceSnapshot?.authorityBoundary ?? {};

  const require = (condition, message) => { if (!condition) errors.push(message); };
  require(RCL_NATIVE_STATE_ROOT_ALGORITHM === 'rcl.semantic-state-root.v1', 'source default semantic-root algorithm drifted from v1');
  require(compRoot.algorithm === RCL_NATIVE_STATE_ROOT_ALGORITHM, 'component contract default algorithm does not match source default');
  require(contractRoot.algorithm === RCL_NATIVE_STATE_ROOT_ALGORITHM, 'VERSION-CONTRACT default algorithm does not match source default');
  require(RCL_NATIVE_STATE_ROOT_ALGORITHMS.includes(RCL_SEMANTIC_STATE_ROOT_V2_ALGORITHM), 'ordinary verifier does not admit the v2 candidate algorithm');
  require(Boolean(compCandidate), 'component contract does not bind the v2 candidate algorithm');
  require(Boolean(contractCandidate), 'VERSION-CONTRACT does not bind the v2 candidate algorithm');

  for (const [label, candidate] of [['component', compCandidate], ['contract', contractCandidate]]) {
    if (!candidate) continue;
    require(candidate.authoritativeDefault === false, `${label} candidate must not become authoritative default`);
    require(candidate.format === RCL_CANONICAL_F64_FORMAT, `${label} candidate format drift`);
    require(candidate.version === RCL_CANONICAL_F64_VERSION, `${label} candidate version drift`);
    require(candidate.numberEncoding === 'IEEE754_BINARY64_HEX_16_LOWERCASE', `${label} candidate number encoding drift`);
    require(candidate.negativeZeroPolicy === 'NORMALIZE_TO_POSITIVE_ZERO', `${label} candidate negative-zero policy drift`);
    require(candidate.canonicalPromotionPerformed === false, `${label} candidate must not claim canonical promotion`);
    require(candidate.windowsCandidateReplayPerformed === false, `${label} candidate must not claim Windows candidate replay`);
    require(candidate.hostedCiAuthorityPerformed === false, `${label} candidate must not claim hosted-CI authority`);
    require(candidate.historicalRootMigrationPerformed === false, `${label} candidate must not claim historical root migration`);
  }
  require(compCandidate?.status === 'candidate', 'component v2 status must remain candidate');
  require(contractCandidate?.status === 'candidate-authority-bound', 'VERSION-CONTRACT v2 status must be candidate-authority-bound');
  require(contractCandidate?.downstreamAcceptanceClaimed === false, 'downstream acceptance must remain unclaimed');

  require(evidenceSnapshot?.algorithm?.candidate === RCL_SEMANTIC_STATE_ROOT_V2_ALGORITHM, 'candidate evidence algorithm drift');
  require(evidenceSnapshot?.algorithm?.defaultNativeAlgorithmUnchanged === RCL_NATIVE_STATE_ROOT_ALGORITHM, 'candidate evidence no longer preserves v1 default');
  require(evidenceSnapshot?.algorithm?.numberEncoding === 'IEEE754_BINARY64_HEX_16_LOWERCASE', 'candidate evidence number encoding drift');
  require(evidenceSnapshot?.algorithm?.negativeZero === 'NORMALIZE_TO_POSITIVE_ZERO', 'candidate evidence negative-zero policy drift');
  require(authorityBoundary.canonicalPromotionPerformed === false, 'candidate evidence unexpectedly claims canonical promotion');
  require(authorityBoundary.windowsCandidateReplayPerformed === false, 'candidate evidence unexpectedly claims Windows replay');
  require(authorityBoundary.hostedCiAuthorityPerformed === false, 'candidate evidence unexpectedly claims hosted-CI authority');
  require(authorityBoundary.historicalRootMigrationPerformed === false, 'candidate evidence unexpectedly claims historical migration');

  require(boundary.semanticStateRootV2CandidateAuthorityBound === true, 'VERSION-CONTRACT boundary does not expose v2 candidate authority binding');
  require(boundary.semanticStateRootV2CandidatePromoted === false, 'VERSION-CONTRACT boundary overclaims v2 promotion');
  require(boundary.semanticStateRootV2WindowsCandidateReplayVerified === false, 'VERSION-CONTRACT boundary overclaims Windows v2 replay');
  require(boundary.semanticStateRootV2HostedCiAuthorityVerified === false, 'VERSION-CONTRACT boundary overclaims hosted-CI authority');
  require(boundary.semanticStateRootV2HistoricalMigrationPerformed === false, 'VERSION-CONTRACT boundary overclaims historical migration');
  require(boundary.semanticStateRootV2DownstreamAcceptanceClaimed === false, 'VERSION-CONTRACT boundary overclaims downstream acceptance');
  return errors;
}

const errors = validate(component, contract, evidence);
const controls = [];
function negativeControl(name, mutate) {
  const c = clone(component);
  const v = clone(contract);
  const e = clone(evidence);
  mutate(c, v, e);
  const rejected = validate(c, v, e).length > 0;
  controls.push({ name, rejected });
  if (!rejected) errors.push(`negative control was not rejected: ${name}`);
}
negativeControl('candidate-cannot-replace-v1-default', (c, v) => {
  c.components.semanticStateRoot.algorithm = RCL_SEMANTIC_STATE_ROOT_V2_ALGORITHM;
  v.claims.nativeSemanticAuthorityRoot.algorithm = RCL_SEMANTIC_STATE_ROOT_V2_ALGORITHM;
});
negativeControl('canonical-promotion-overclaim-fails-closed', (_c, v) => {
  v.claims.nativeSemanticAuthorityRoot.candidateAlgorithms[0].canonicalPromotionPerformed = true;
  v.boundary.semanticStateRootV2CandidatePromoted = true;
});
negativeControl('windows-replay-overclaim-fails-closed', (_c, v) => {
  v.claims.nativeSemanticAuthorityRoot.candidateAlgorithms[0].windowsCandidateReplayPerformed = true;
  v.boundary.semanticStateRootV2WindowsCandidateReplayVerified = true;
});
negativeControl('hosted-ci-overclaim-fails-closed', (_c, v) => {
  v.claims.nativeSemanticAuthorityRoot.candidateAlgorithms[0].hostedCiAuthorityPerformed = true;
  v.boundary.semanticStateRootV2HostedCiAuthorityVerified = true;
});
negativeControl('downstream-acceptance-overclaim-fails-closed', (_c, v) => {
  v.claims.nativeSemanticAuthorityRoot.candidateAlgorithms[0].downstreamAcceptanceClaimed = true;
  v.boundary.semanticStateRootV2DownstreamAcceptanceClaimed = true;
});
negativeControl('historical-evidence-promotion-drift-fails-closed', (_c, _v, e) => {
  e.authorityBoundary.canonicalPromotionPerformed = true;
});

const report = {
  ok: errors.length === 0,
  status: errors.length === 0
    ? 'RCL_SEMANTIC_STATE_ROOT_V2_CANDIDATE_AUTHORITY_BOUND'
    : 'RCL_SEMANTIC_STATE_ROOT_V2_CANDIDATE_AUTHORITY_BINDING_FAILED',
  defaultAlgorithm: RCL_NATIVE_STATE_ROOT_ALGORITHM,
  candidateAlgorithm: RCL_SEMANTIC_STATE_ROOT_V2_ALGORITHM,
  candidateFormat: RCL_CANONICAL_F64_FORMAT,
  candidateVersion: RCL_CANONICAL_F64_VERSION,
  negativeControls: controls,
  truthBoundary: {
    candidateAuthorityBound: errors.length === 0,
    canonicalDefaultRemainsV1: true,
    canonicalV2PromotionClaimed: false,
    windowsCandidateReplayClaimed: false,
    hostedCiAuthorityClaimed: false,
    historicalRootMigrationClaimed: false,
    downstreamAcceptanceClaimed: false,
    wholeLanguageRuntimeSelfHostingClaimed: false,
  },
  errors,
};
console.log(JSON.stringify(report, null, 2));
if (errors.length > 0) process.exit(252);
