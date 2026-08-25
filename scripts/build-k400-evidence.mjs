#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

import {
  COVERAGE_MODE,
  STRESS_STATUS,
  UNIVERSAL_STRESS_GATES,
  validateUniversalStressEvidence,
} from '../src/universal-program-stress.mjs';

const root = process.cwd();
const nativeUiPath = 'examples/universal-stress/native-ui-genome-v0.1-evidence.json';
const k02Path = 'examples/universal-stress/k02-direct-evidence-2026-08-08.json';
const k03Path = 'examples/universal-stress/k03-direct-evidence-2026-08-08.json';
const browserPerformanceContractPath = 'examples/native-ui/browser-performance-contract.v0.1.json';
const browserRuntimePath = 'examples/native-ui/evidence/browser-runtime-result.json';
const k08Path = 'examples/native-ai/evidence/k08-b-evidence.json';
const k233ReceiptPath = 'examples/native-ai/evidence/k233-ai-generate/receipt.json';
const k233GithubReplayPath = 'examples/native-ai/evidence/k233-ai-generate/github-replay.json';
const k08TensorMlpPath = 'examples/native-ai/evidence/general-mlp-tensor-v0.1/k08-d-general-mlp-tensor-evidence.json';
const k08TensorMlpGithubReplayPath = 'examples/native-ai/evidence/general-mlp-tensor-v0.1/github-replay.json';
const k08TensorLivenessPath = 'examples/native-ai/evidence/tensor-plan-liveness-v0.1/k08-e-tensor-plan-liveness-evidence.json';
const k08TensorLivenessGithubReplayPath = 'examples/native-ai/evidence/tensor-plan-liveness-v0.1/github-replay.json';
const outputPath = process.argv[2] ?? 'examples/universal-stress/k400-current-evidence.json';

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function directGates(receipt, receiptPath, notes = {}) {
  return Object.fromEntries(UNIVERSAL_STRESS_GATES.map((gate) => [gate, {
    status: receipt.gates?.[gate] ?? STRESS_STATUS.UNVERIFIED,
    evidence: [receiptPath],
    ...(notes[gate] ? { note: notes[gate] } : {}),
  }]));
}

const nativeUi = readJson(nativeUiPath);
const k02 = readJson(k02Path);
const k03 = readJson(k03Path);
const k08 = readJson(k08Path);
const k08TensorMlp = readJson(k08TensorMlpPath);
const k08TensorLiveness = readJson(k08TensorLivenessPath);

const directClaims = [
  {
    id: 'browser::web',
    coverageMode: COVERAGE_MODE.LOWERED_EXECUTION,
    lastVerifiedDate: '2026-08-08',
    knownLimits: k02.limitations,
    relatedKillerTasks: ['K02'],
    requiredGenes: ['web-application-semantics', 'browser-lowering', 'server-api', 'authority-preservation'],
    gates: directGates(k02, k02Path, {
      AI_GENERATE: 'Independent reproducible generation or repair receipts are still missing.',
    }),
    changes: [{
      id: 'complete-web-application-lowering',
      kind: 'candidate-gene',
      scope: ['browser', 'server'],
      generalPrimitive: true,
      justification: 'RCL application state, rules and authority lower to browser and server execution without moving commit authority into presentation code.',
    }],
  },
  {
    id: 'android::mobile',
    coverageMode: COVERAGE_MODE.LOWERED_EXECUTION,
    lastVerifiedDate: '2026-08-08',
    knownLimits: k03.limitations,
    relatedKillerTasks: ['K03'],
    requiredGenes: ['android-application-lowering', 'reactive-state', 'authority-preservation', 'device-runtime-evidence'],
    gates: directGates(k03, k03Path, {
      EXECUTE: 'The historical direct receipt had no Android device or emulator.',
      CORRECT: 'Host replay is not Android-device correctness.',
      PERFORMANCE: 'No Android-device timing receipt exists.',
      AI_GENERATE: 'Independent reproducible generation or repair receipts are still missing.',
    }),
    changes: [{
      id: 'native-android-application-lowering',
      kind: 'candidate-gene',
      scope: ['android', 'browser'],
      generalPrimitive: true,
      justification: 'Platform-neutral application and UI semantics lower through explicit target backends while preserving authority boundaries.',
    }],
  },
  {
    id: 'ai-runtime::machine-learning',
    campaignId: 'K233',
    coverageMode: COVERAGE_MODE.NATIVE_SEMANTIC,
    lastVerifiedDate: k08.verificationDate,
    knownLimits: [
      k08.evidenceBoundary,
      'The result proves a bounded configurable two-Dense-layer General MLP profile. A separate candidate lowers it to a generic Tensor Plan with 5.720x local speedup, but it grants no K233 promotion or Tensor Genome PASS.',
      'Peak native memory is not yet emitted by rclvm and remains an explicit performance-telemetry gap.',
      `K08-E reduces the logical plan value-store peak by ${k08TensorLiveness.planStore.peakPlanStoreReductionFactor.toFixed(3)}x on the K08-D workload; process RSS and general workload speedup remain unverified.`,
      'K233 AI_GENERATE is limited to three independent repair receipts and their bound GitHub-hosted replay; it grants no Tensor, Autodiff, optimizer or accelerator claim.',
    ],
    relatedKillerTasks: ['K08'],
    requiredGenes: ['native-numeric-reckon', 'immutable-sequence-algebra', 'recursive-training-loop', 'evidence-native-model-lifecycle'],
    donorAdvantages: [{
      donor: 'JavaScript reference oracle',
      capability: `faster training execution and richer host telemetry; generic Tensor lowering reduced the measured Native/JS ratio from ${k08TensorMlp.performance.priorNativeToOracleRatio.toFixed(3)}x to ${k08TensorMlp.performance.optimizedTensorToOracleRatio.toFixed(3)}x`,
      status: 'PARTIALLY_ABSORBED_ADVANTAGE',
    }],
    gates: k08.gates,
    changes: [{
      id: 'general-rcl-dense-mlp-learning-profile',
      kind: 'candidate-gene',
      scope: ['ai-runtime'],
      generalPrimitive: true,
      justification: 'Reusable Model, Layer, Parameter, Activation, Loss, Optimizer, Dataset and Checkpoint semantics train structurally distinct 2-2-1 and 3-3-1 tasks through native rclc/RBC/rclvm without a trainer provider or ML-special-case primitive.',
    }],
  },
];

const claimsById = new Map(nativeUi.claims.map((claim) => [claim.id, claim]));
for (const claim of directClaims) claimsById.set(claim.id, claim);

const evidence = {
  schema: 'rcl.universal-stress.evidence.v0.1',
  generation: 'k400-consolidated-v0.1',
  claims: [...claimsById.values()],
  competitiveComparisons: nativeUi.competitiveComparisons ?? [],
  donorComparisons: nativeUi.donorComparisons ?? [],
  novelTaskTrials: nativeUi.novelTaskTrials ?? 0,
  kernelChangesForNovelTasks: nativeUi.kernelChangesForNovelTasks ?? 0,
  sourceReceipts: [nativeUiPath, k02Path, k03Path, k08Path, k233ReceiptPath, k233GithubReplayPath, k08TensorMlpPath, k08TensorMlpGithubReplayPath, k08TensorLivenessPath, k08TensorLivenessGithubReplayPath, browserPerformanceContractPath, browserRuntimePath],
  notes: [
    'This is the consolidated K400 campaign input; it preserves the status and evidence boundaries of each source receipt.',
    'Historical K02 and K03 receipts are not relabeled as current execution evidence.',
    'Missing gates remain BLOCKED and unclaimed matrix cells remain UNTESTED.',
    'K08-B closes K233 through a GitHub-bound 3/3 independent repair receipt; it proves the bounded AI-N2 General MLP profile, not Tensor/Autodiff/Transformer infrastructure.',
    `K08-D is candidate-only evidence: a ${k08TensorMlp.plan.nodes}-node generic Tensor Plan measured ${k08TensorMlp.performance.scalarToTensorSpeedup.toFixed(3)}x local scalar-to-Tensor speedup and a remaining ${k08TensorMlp.performance.optimizedTensorToOracleRatio.toFixed(3)}x JS ratio; it grants no new K233 gate or K400 cell.`,
    `K08-E is candidate-only evidence: last-use reclamation measured a ${k08TensorLiveness.planStore.peakPlanStoreReductionFactor.toFixed(3)}x logical plan-store reduction and ${k08TensorLiveness.controlledPerformance.speedup.toFixed(3)}x controlled speedup on the same plan; it grants no process-RSS, general-speedup, K233 or K400 claim.`,
    ...(nativeUi.notes ?? []),
  ],
};

const validation = validateUniversalStressEvidence(evidence);
if (!validation.ok) throw new Error(`RCL_K400_EVIDENCE_INVALID:${validation.errors.join('|')}`);

fs.mkdirSync(path.dirname(path.join(root, outputPath)), { recursive: true });
fs.writeFileSync(path.join(root, outputPath), `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
  status: 'K400_EVIDENCE_WRITTEN',
  outputPath,
  claimCount: evidence.claims.length,
  sourceReceipts: evidence.sourceReceipts,
}, null, 2));
