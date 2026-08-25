#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

import {
  COVERAGE_MODE,
  STRESS_STATUS,
  UNIVERSAL_STRESS_GATES,
  validateUniversalStressEvidence,
} from '../src/universal-program-stress.mjs';
import { verifyK02AiGenerationReceipt } from './verify-k02-ai-generation-receipt.mjs';

const root = process.cwd();
const nativeUiPath = 'examples/universal-stress/native-ui-genome-v0.1-evidence.json';
const k02Path = 'examples/universal-stress/k02-direct-evidence-2026-08-08.json';
const k03Path = 'examples/universal-stress/k03-direct-evidence-2026-08-08.json';
const browserPerformanceContractPath = 'examples/native-ui/browser-performance-contract.v0.1.json';
const browserRuntimePath = 'examples/native-ui/evidence/browser-runtime-result.json';
const k08Path = 'examples/native-ai/evidence/k08-b-evidence.json';
const k233ReceiptPath = 'examples/native-ai/evidence/k233-ai-generate/receipt.json';
const k233GithubReplayPath = 'examples/native-ai/evidence/k233-ai-generate/github-replay.json';
const k02AiContractPath = 'examples/universal-stress/k02-ai-generation-contract.v0.1.json';
const k02AiReceiptPath = 'examples/universal-stress/evidence/k02-ai-generate/receipt.json';
const k02AiGithubReplayPath = 'examples/universal-stress/evidence/k02-ai-generate/github-replay.json';
const k08TensorMlpPath = 'examples/native-ai/evidence/general-mlp-tensor-v0.1/k08-d-general-mlp-tensor-evidence.json';
const k08TensorMlpGithubReplayPath = 'examples/native-ai/evidence/general-mlp-tensor-v0.1/github-replay.json';
const k08TensorLivenessPath = 'examples/native-ai/evidence/tensor-plan-liveness-v0.1/k08-e-tensor-plan-liveness-evidence.json';
const k08TensorLivenessGithubReplayPath = 'examples/native-ai/evidence/tensor-plan-liveness-v0.1/github-replay.json';
const k08TensorBorrowedInputPath = 'examples/native-ai/evidence/tensor-plan-borrowed-inputs-v0.1/k08-f-tensor-borrowed-input-evidence.json';
const k08TensorBorrowedInputGithubReplayPath = 'examples/native-ai/evidence/tensor-plan-borrowed-inputs-v0.1/github-replay.json';
const k08AutodiffPath = 'examples/native-ai/evidence/native-autodiff-v0.1/k08-g-native-autodiff-evidence.json';
const k08AutodiffGithubReplayPath = 'examples/native-ai/evidence/native-autodiff-v0.1/github-replay.json';
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
const k08TensorBorrowedInput = readJson(k08TensorBorrowedInputPath);
const k08Autodiff = readJson(k08AutodiffPath);
const k02Ai = await verifyK02AiGenerationReceipt();
const k02AiAdmitted = k02Ai.aiGenerateAdmission === 'PASS';

function k02AiGate(fallback) {
  if (!k02AiAdmitted) return fallback;
  return {
    status: STRESS_STATUS.PASS,
    evidence: [k02AiContractPath, k02AiReceiptPath, k02AiGithubReplayPath],
    note: `Three independent repairs passed deterministic RCL Web/Server replay and GitHub run ${k02Ai.githubAuthority.runId}.`,
  };
}

function admittedK02Limits(limits = []) {
  if (!k02AiAdmitted) return limits;
  return limits.filter((limit) => !/AI_GENERATE/iu.test(limit)).concat(
    'AI_GENERATE is limited to the three receipt-bound K02 Web/GUI/reactive repairs; it does not prove arbitrary Web generation.',
  );
}

const directClaims = [
  {
    id: 'browser::web',
    coverageMode: COVERAGE_MODE.LOWERED_EXECUTION,
    lastVerifiedDate: '2026-08-08',
    knownLimits: admittedK02Limits(k02.limitations),
    relatedKillerTasks: ['K02'],
    requiredGenes: ['web-application-semantics', 'browser-lowering', 'server-api', 'authority-preservation'],
    gates: (() => {
      const gates = directGates(k02, k02Path, {
        AI_GENERATE: 'Independent reproducible generation or repair receipts are still missing.',
      });
      gates.AI_GENERATE = k02AiGate(gates.AI_GENERATE);
      return gates;
    })(),
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
      `K08-F measures exact Windows child-process peak Working Set on the unchanged Plan (${k08TensorBorrowedInput.processMemory.production.reductionPercent.toFixed(3)}% local median delta); portable RSS/VRAM telemetry remains open.`,
      `K08-E reduces the logical plan value-store peak by ${k08TensorLiveness.planStore.peakPlanStoreReductionFactor.toFixed(3)}x on the K08-D workload; process RSS and general workload speedup remain unverified.`,
      `K08-G is an ENGINE_E2 candidate: native reverse-mode gradients match finite difference within ${k08Autodiff.primitive.finiteDifferenceMaximumDrift.toExponential(3)}, while optimizer genome, Transformer, Tiny LM and accelerator gates remain open.`,
      'K233 AI_GENERATE is limited to three independent repair receipts and their bound GitHub-hosted replay; it grants no Tensor, Autodiff, optimizer or accelerator claim.',
    ],
    relatedKillerTasks: ['K08'],
    requiredGenes: ['native-numeric-reckon', 'immutable-sequence-algebra', 'recursive-training-loop', 'evidence-native-model-lifecycle', 'reverse-mode-tensor-autodiff-candidate'],
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
for (const id of ['browser::gui', 'browser::reactive']) {
  const claim = structuredClone(claimsById.get(id));
  if (!claim) throw new Error(`RCL_K400_K02_AI_TARGET_MISSING:${id}`);
  claim.gates.AI_GENERATE = k02AiGate(claim.gates.AI_GENERATE);
  claim.knownLimits = admittedK02Limits(claim.knownLimits);
  claimsById.set(id, claim);
}
for (const claim of directClaims) claimsById.set(claim.id, claim);

const evidence = {
  schema: 'rcl.universal-stress.evidence.v0.1',
  generation: 'k400-consolidated-v0.1',
  claims: [...claimsById.values()],
  competitiveComparisons: nativeUi.competitiveComparisons ?? [],
  donorComparisons: nativeUi.donorComparisons ?? [],
  novelTaskTrials: nativeUi.novelTaskTrials ?? 0,
  kernelChangesForNovelTasks: nativeUi.kernelChangesForNovelTasks ?? 0,
  sourceReceipts: [nativeUiPath, k02Path, k03Path, k08Path, k233ReceiptPath, k233GithubReplayPath, k02AiContractPath, k02AiReceiptPath, ...(k02AiAdmitted ? [k02AiGithubReplayPath] : []), k08TensorMlpPath, k08TensorMlpGithubReplayPath, k08TensorLivenessPath, k08TensorLivenessGithubReplayPath, k08TensorBorrowedInputPath, k08TensorBorrowedInputGithubReplayPath, k08AutodiffPath, k08AutodiffGithubReplayPath, browserPerformanceContractPath, browserRuntimePath],
  notes: [
    'This is the consolidated K400 campaign input; it preserves the status and evidence boundaries of each source receipt.',
    'Historical K02 and K03 receipts are not relabeled as current execution evidence.',
    'Missing gates remain BLOCKED and unclaimed matrix cells remain UNTESTED.',
    'K08-B closes K233 through a GitHub-bound 3/3 independent repair receipt; it proves the bounded AI-N2 General MLP profile, not Tensor/Autodiff/Transformer infrastructure.',
    k02AiAdmitted
      ? `K02 closes K063, K064 and K078 AI_GENERATE through 3/3 independent repairs and GitHub run ${k02Ai.githubAuthority.runId}; it proves only the bounded Web/GUI/reactive vertical slice.`
      : 'K02 has a 3/3 local independent repair candidate; K063, K064 and K078 remain BLOCKED until GitHub-hosted replay is bound.',
    `K08-D is candidate-only evidence: a ${k08TensorMlp.plan.nodes}-node generic Tensor Plan measured ${k08TensorMlp.performance.scalarToTensorSpeedup.toFixed(3)}x local scalar-to-Tensor speedup and a remaining ${k08TensorMlp.performance.optimizedTensorToOracleRatio.toFixed(3)}x JS ratio; it grants no new K233 gate or K400 cell.`,
    `K08-E is candidate-only evidence: last-use reclamation measured a ${k08TensorLiveness.planStore.peakPlanStoreReductionFactor.toFixed(3)}x logical plan-store reduction and ${k08TensorLiveness.controlledPerformance.speedup.toFixed(3)}x controlled speedup on the same plan; it grants no process-RSS, general-speedup, K233 or K400 claim.`,
    `K08-F is candidate-only local Windows evidence: ${k08TensorBorrowedInput.productionWorkload.inputBindingCount} Plan inputs are borrowed with zero input-storage clones; exact-main A/B measured ${k08TensorBorrowedInput.controlledPerformance.speedup.toFixed(3)}x runtime speedup and ${k08TensorBorrowedInput.processMemory.production.reductionPercent.toFixed(3)}% peak Working Set median delta on the unchanged Plan. It grants no portable/general memory, K233 or K400 claim.`,
    `K08-G is candidate-only native Autodiff evidence: analytic drift ${k08Autodiff.primitive.analyticManualMaximumDrift}, finite-difference drift ${k08Autodiff.primitive.finiteDifferenceMaximumDrift.toExponential(3)}, XOR/Majority-3 accuracy ${k08Autodiff.generalMlp.tasks.xor.accuracy}/${k08Autodiff.generalMlp.tasks.majority3.accuracy}, and bit-exact 32 == 16+16 checkpoint parity. It grants no new K233 gate or K400 cell.`,
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
