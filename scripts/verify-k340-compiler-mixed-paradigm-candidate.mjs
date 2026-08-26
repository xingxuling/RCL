#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { evidenceRoot } from '../src/universal-program-stress.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CONTRACT_PATH = path.join(ROOT, 'examples', 'universal-stress', 'k340-compiler-mixed-paradigm-runtime-contract.v0.1.json');
const EVIDENCE_PATH = path.join(ROOT, 'examples', 'universal-stress', 'evidence', 'k340-compiler-mixed-paradigm-runtime-v0.1.json');

function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function check(condition, code) { if (!condition) throw new Error(code); }

export function verifyK340CompilerMixedParadigmCandidate(options = {}) {
  const contractPath = path.resolve(options.contractPath ?? CONTRACT_PATH);
  const evidencePath = path.resolve(options.evidencePath ?? EVIDENCE_PATH);
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
  const { reportRoot, ...evidenceWithoutRoot } = evidence;
  const sourcePath = path.join(ROOT, contract.canonical.sourcePath);
  const compilerRbcPath = path.join(ROOT, contract.canonical.compilerRbcPath);

  check(contract.format === 'rcl.k340.compiler-mixed-paradigm-runtime-contract.v0.1', 'RCL_K340_CONTRACT_FORMAT');
  check(contract.frozenBeforeAcquisition === true, 'RCL_K340_CONTRACT_NOT_FROZEN');
  check(evidence.format === 'rcl.k340.compiler-mixed-paradigm-runtime-evidence.v0.1', 'RCL_K340_EVIDENCE_FORMAT');
  check(evidence.contractRoot === evidenceRoot(contract), 'RCL_K340_CONTRACT_ROOT');
  check(reportRoot === evidenceRoot({ ...evidenceWithoutRoot, generatedAt: undefined }), 'RCL_K340_REPORT_ROOT');
  check(sha256(fs.readFileSync(sourcePath)) === contract.canonical.sourceSha256, 'RCL_K340_SOURCE_DRIFT');
  check(sha256(fs.readFileSync(compilerRbcPath)) === contract.canonical.compilerRbcSha256, 'RCL_K340_COMPILER_DRIFT');
  check(evidence.status === 'PASS', 'RCL_K340_RUNTIME_NOT_PASS');
  check(evidence.summary.successfulRounds === contract.required.rounds, 'RCL_K340_ROUND_COUNT');
  check(evidence.summary.uniqueStateRoots === contract.required.uniqueStateRoots, 'RCL_K340_STATE_ROOT_COUNT');
  check(evidence.summary.uniqueArtifactHashes === 1, 'RCL_K340_ARTIFACT_HASH_COUNT');
  check(evidence.summary.controlsPassed === true, 'RCL_K340_CONTROLS');
  check(evidence.summary.performancePassed === true, 'RCL_K340_PERFORMANCE');
  check(Object.values(evidence.negativeControls).every(Boolean), 'RCL_K340_NEGATIVE_CONTROL');
  check(evidence.rounds.every((round) => round.peakCallFrames > 0), 'RCL_K340_RECURSION_NOT_EXECUTED');
  check(evidence.rounds.every((round) => round.transactionRoots[0].afterRoot === round.transactionRoots[1].beforeRoot), 'RCL_K340_ROOT_CONTINUITY');
  check(evidence.rclGaps.some((gap) => gap.id === 'RCL_GAP_K337_SELFHOST_WARRANT_STATIC_VALIDATION'), 'RCL_K340_STATIC_VALIDATION_GAP');

  return {
    status: 'PASS',
    localRuntimeAdmitted: true,
    eligibleCells: contract.eligibleCells,
    runtimeReportRoot: reportRoot,
    contractRoot: evidence.contractRoot,
    sourceSha256: contract.canonical.sourceSha256,
    artifactSha256: evidence.artifacts.bootstrapArtifactSha256,
    stateRoot: evidence.rounds[0].stateRoot,
    paradigms: contract.profile.requiredParadigms,
    aiGenerateAdmission: 'UNVERIFIED',
    githubHostedAdmission: 'UNVERIFIED',
    verdict: 'PASS_LOCAL_RUNTIME_CANDIDATE_AI_GENERATE_AND_GITHUB_REQUIRED',
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) console.log(JSON.stringify(verifyK340CompilerMixedParadigmCandidate(), null, 2));
