#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { evidenceRoot } from '../src/universal-program-stress.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CONTRACT_PATH = path.join(ROOT, 'examples', 'universal-stress', 'k337-k338-compiler-governance-reactive-runtime-contract.v0.1.json');
const EVIDENCE_PATH = path.join(ROOT, 'examples', 'universal-stress', 'evidence', 'k337-k338-compiler-governance-reactive-runtime-v0.1.json');

function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function check(condition, code) {
  if (!condition) throw new Error(code);
}

export function verifyK337K338CompilerGovernanceReactiveCandidate() {
  const contract = JSON.parse(fs.readFileSync(CONTRACT_PATH, 'utf8'));
  const evidence = JSON.parse(fs.readFileSync(EVIDENCE_PATH, 'utf8'));
  const sourcePath = path.join(ROOT, contract.canonical.sourcePath);
  const compilerRbcPath = path.join(ROOT, contract.canonical.compilerRbcPath);
  const { reportRoot, ...evidenceWithoutRoot } = evidence;

  check(contract.format === 'rcl.k337-k338.compiler-governance-reactive-runtime-contract.v0.1', 'RCL_K337_K338_CONTRACT_FORMAT');
  check(contract.frozenBeforeAcquisition === true, 'RCL_K337_K338_CONTRACT_NOT_FROZEN');
  check(evidence.format === 'rcl.k337-k338.compiler-governance-reactive-runtime-evidence.v0.1', 'RCL_K337_K338_EVIDENCE_FORMAT');
  check(evidence.contractRoot === evidenceRoot(contract), 'RCL_K337_K338_CONTRACT_ROOT');
  check(reportRoot === evidenceRoot({ ...evidenceWithoutRoot, generatedAt: undefined }), 'RCL_K337_K338_REPORT_ROOT');
  check(sha256(fs.readFileSync(sourcePath)) === contract.canonical.sourceSha256, 'RCL_K337_K338_SOURCE_DRIFT');
  check(sha256(fs.readFileSync(compilerRbcPath)) === contract.canonical.compilerRbcSha256, 'RCL_K337_K338_COMPILER_DRIFT');
  check(evidence.status === 'PASS', 'RCL_K337_K338_RUNTIME_NOT_PASS');
  check(evidence.summary.successfulRounds === contract.required.rounds, 'RCL_K337_K338_ROUND_COUNT');
  check(evidence.summary.uniqueStateRoots === contract.required.uniqueStateRoots, 'RCL_K337_K338_STATE_ROOT_COUNT');
  check(evidence.summary.uniqueArtifactHashes === 1, 'RCL_K337_K338_ARTIFACT_HASH_COUNT');
  check(evidence.summary.controlsPassed === true, 'RCL_K337_K338_CONTROLS');
  check(evidence.summary.performancePassed === true, 'RCL_K337_K338_PERFORMANCE');
  check(Object.values(evidence.negativeControls).every(Boolean), 'RCL_K337_K338_NEGATIVE_CONTROL');
  check(evidence.negativeControlDetails.missingWarrant.rejectionStage === 'NATIVE_VM_BEFORE_COMMIT', 'RCL_K337_K338_WARRANT_STAGE_DISCLOSURE');
  check(evidence.negativeControlDetails.missingWarrant.errorCode === 'RCL_AUTHORITY_DENIED', 'RCL_K337_K338_WARRANT_ERROR');
  check(evidence.rclGaps.some((gap) => gap.id === 'RCL_GAP_K337_SELFHOST_WARRANT_STATIC_VALIDATION'), 'RCL_K337_K338_STATIC_VALIDATION_GAP');

  return {
    localRuntimeAdmitted: true,
    eligibleCells: contract.eligibleCells,
    runtimeReportRoot: reportRoot,
    contractRoot: evidence.contractRoot,
    sourceSha256: contract.canonical.sourceSha256,
    artifactSha256: evidence.artifacts.bootstrapArtifactSha256,
    stateRoot: evidence.rounds[0].stateRoot,
    rclGap: evidence.rclGaps[0].id,
    aiGenerateAdmission: 'UNVERIFIED',
    githubHostedAdmission: 'UNVERIFIED',
    verdict: 'PASS_LOCAL_RUNTIME_CANDIDATE_AI_GENERATE_AND_GITHUB_REQUIRED',
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const result = verifyK337K338CompilerGovernanceReactiveCandidate();
  console.log(JSON.stringify(result, null, 2));
}
