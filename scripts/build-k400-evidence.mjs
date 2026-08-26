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
import { verifyK01AiGenerationReceipt } from './verify-k01-ai-generation-receipt.mjs';
import { verifyK03AndroidEmulatorEvidence } from './verify-k03-android-emulator-evidence.mjs';
import { verifyK03AiGenerationReceipt } from './verify-k03-ai-generation-receipt.mjs';
import { verifyK04ServerRuntimeEvidence } from './verify-k04-server-runtime-evidence.mjs';
import { verifyK04ServerAiGenerationReceipt } from './verify-k04-server-ai-generation-receipt.mjs';
import { verifyK327CompilerAiGenerationReceipt } from './verify-k327-compiler-ai-generation-receipt.mjs';
import { verifyK340CompilerMixedParadigmReceipt } from './verify-k340-compiler-mixed-paradigm-receipt.mjs';
import { verifyK337K338CompilerGovernanceReactiveReceipt } from './verify-k337-k338-compiler-governance-reactive-receipt.mjs';
import { verifyK321K322CompilerAlgorithmCliReceipt } from './verify-k321-k322-compiler-algorithm-cli-receipt.mjs';

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
const k01AiContractPath = 'examples/universal-stress/k01-ai-generation-contract.v0.2.json';
const k01AiReceiptPath = 'examples/universal-stress/evidence/k01-ai-generate/receipt.json';
const k01AiGithubReplayPath = 'examples/universal-stress/evidence/k01-ai-generate/github-replay.json';
const k03EmulatorPath = 'examples/universal-stress/evidence/k03-android-emulator-v0.1.json';
const k03AiContractPath = 'examples/universal-stress/k03-ai-generation-contract.v0.1.json';
const k03AiReceiptPath = 'examples/universal-stress/evidence/k03-ai-generate/receipt.json';
const k03AiGithubReplayPath = 'examples/universal-stress/evidence/k03-ai-generate/github-replay.json';
const k04ServerRuntimeContractPath = 'examples/universal-stress/k04-server-runtime-contract.v0.1.json';
const k04ServerRuntimePath = 'examples/universal-stress/evidence/k04-server-runtime-v0.1.json';
const k04ServerAiContractPath = 'examples/universal-stress/k04-server-ai-generation-contract.v0.1.json';
const k04ServerAiReceiptPath = 'examples/universal-stress/evidence/k04-server-ai-generate/receipt.json';
const k04ServerAiGithubReplayPath = 'examples/universal-stress/evidence/k04-server-ai-generate/github-replay.json';
const k327CompilerAiContractPath = 'examples/universal-stress/k327-compiler-ai-generation-contract.v0.1.json';
const k327CompilerAiReceiptPath = 'examples/universal-stress/evidence/k327-compiler-ai-generate/receipt.json';
const k327CompilerAiGithubReplayPath = 'examples/universal-stress/evidence/k327-compiler-ai-generate/github-replay.json';
const k340RuntimeContractPath = 'examples/universal-stress/k340-compiler-mixed-paradigm-runtime-contract.v0.1.json';
const k340RuntimePath = 'examples/universal-stress/evidence/k340-compiler-mixed-paradigm-runtime-v0.1.json';
const k340AiContractPath = 'examples/universal-stress/k340-compiler-mixed-paradigm-ai-generation-contract.v0.1.json';
const k340AiReceiptPath = 'examples/universal-stress/evidence/k340-compiler-mixed-paradigm-ai-generate/receipt.json';
const k340AiGithubReplayPath = 'examples/universal-stress/evidence/k340-compiler-mixed-paradigm-ai-generate/github-replay.json';
const k337K338RuntimeContractPath = 'examples/universal-stress/k337-k338-compiler-governance-reactive-runtime-contract.v0.1.json';
const k337K338RuntimePath = 'examples/universal-stress/evidence/k337-k338-compiler-governance-reactive-runtime-v0.1.json';
const k337K338AiContractPath = 'examples/universal-stress/k337-k338-compiler-governance-reactive-ai-generation-contract.v0.1.json';
const k337K338AiReceiptPath = 'examples/universal-stress/evidence/k337-k338-compiler-governance-reactive-ai-generate/receipt.json';
const k337K338AiGithubReplayPath = 'examples/universal-stress/evidence/k337-k338-compiler-governance-reactive-ai-generate/github-replay.json';
const k321K322RuntimeContractPath = 'examples/universal-stress/k321-k322-compiler-algorithm-cli-runtime-contract.v0.1.json';
const k321K322RuntimePath = 'examples/universal-stress/evidence/k321-k322-compiler-algorithm-cli-runtime-v0.1.json';
const k321K322AiContractPath = 'examples/universal-stress/k321-k322-compiler-algorithm-cli-ai-generation-contract.v0.1.json';
const k321K322AiReceiptPath = 'examples/universal-stress/evidence/k321-k322-compiler-algorithm-cli-ai-generate/receipt.json';
const k321K322AiGithubReplayPath = 'examples/universal-stress/evidence/k321-k322-compiler-algorithm-cli-ai-generate/github-replay.json';
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
const k01Ai = verifyK01AiGenerationReceipt();
const k01AiAdmitted = k01Ai.aiGenerateAdmission === 'PASS';
const k03Emulator = verifyK03AndroidEmulatorEvidence();
if (!k03Emulator.admitted) throw new Error('RCL_K400_K03_EMULATOR_EVIDENCE_NOT_ADMITTED');
const k03Ai = verifyK03AiGenerationReceipt();
const k03AiAdmitted = k03Ai.aiGenerateAdmission === 'PASS';
const k04ServerRuntime = await verifyK04ServerRuntimeEvidence();
if (!k04ServerRuntime.admitted) throw new Error('RCL_K400_K04_SERVER_RUNTIME_EVIDENCE_NOT_ADMITTED');
const k04ServerAi = await verifyK04ServerAiGenerationReceipt();
const k04ServerAiAdmitted = k04ServerAi.aiGenerateAdmission === 'PASS';
const k327CompilerAi = verifyK327CompilerAiGenerationReceipt();
const k327CompilerAiAdmitted = k327CompilerAi.aiGenerateAdmission === 'PASS';
const k340Ai = verifyK340CompilerMixedParadigmReceipt();
const k340AiAdmitted = k340Ai.aiGenerateAdmission === 'PASS';
const k337K338Ai = verifyK337K338CompilerGovernanceReactiveReceipt();
const k337K338AiAdmitted = k337K338Ai.aiGenerateAdmission === 'PASS';
const k321K322 = verifyK321K322CompilerAlgorithmCliReceipt();
const k321K322Admitted = k321K322.aiGenerateAdmission === 'PASS';

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
    ...(k02AiAdmitted ? {
      lastVerifiedSha: k02Ai.githubAuthority.sourceCommit,
      lastVerifiedDate: k02Ai.githubAuthority.verifiedAt.slice(0, 10),
    } : { lastVerifiedDate: '2026-08-08' }),
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

if (k04ServerAiAdmitted) {
  const serverGateNotes = {
    EXECUTE: `Twenty fresh ephemeral Node loopback servers passed; runtime receipt ${k04ServerRuntime.reportRoot}.`,
    CORRECT: 'State, observe, add and reset transactions replayed through the generated HTTP surface.',
    ROBUST: 'Unknown state and unknown rule routes were rejected in every frozen replay.',
    PERFORMANCE: `Transaction p95 ${k04ServerRuntime.performance.transactionP95Ms.toFixed(3)} ms <= ${k04ServerRuntime.performance.transactionP95BudgetMs} ms; full replay p95 ${k04ServerRuntime.performance.startupProxyP95Ms.toFixed(3)} ms <= ${k04ServerRuntime.performance.startupProxyP95BudgetMs} ms.`,
    AI_GENERATE: `Three independent Server repairs restored canonical bytes; GitHub run ${k04ServerAi.githubAuthority.runId}.`,
    EVIDENCE: `Rooted runtime, independent-generator and hosted-authority receipts bind K124/K138 only.`,
  };
  for (const dimension of ['web', 'reactive']) {
    const gates = directGates(k02, k02Path);
    for (const gate of ['EXECUTE', 'CORRECT', 'ROBUST', 'PERFORMANCE', 'EVIDENCE']) gates[gate] = {
      status: STRESS_STATUS.PASS,
      evidence: [k04ServerRuntimeContractPath, k04ServerRuntimePath],
      note: serverGateNotes[gate],
    };
    gates.AI_GENERATE = {
      status: STRESS_STATUS.PASS,
      evidence: [k04ServerAiContractPath, k04ServerAiReceiptPath, k04ServerAiGithubReplayPath, k04ServerRuntimePath],
      note: serverGateNotes.AI_GENERATE,
    };
    directClaims.push({
      id: `server::${dimension}`,
      coverageMode: COVERAGE_MODE.LOWERED_EXECUTION,
      lastVerifiedSha: k04ServerAi.githubAuthority.sourceCommit,
      lastVerifiedDate: k04ServerAi.githubAuthority.verifiedAt.slice(0, 10),
      knownLimits: [
        'Evidence is limited to one generated Node HTTP server on 127.0.0.1 with ephemeral ports and the frozen K02 state/rule profile.',
        'Public-network deployment, distributed service semantics, production scale, arbitrary Server generation and general framework parity remain unverified.',
        'RCL owns application state, transition and authority semantics; Node remains a generated execution runtime.',
      ],
      relatedKillerTasks: ['K02'],
      requiredGenes: ['web-application-semantics', 'server-api-lowering', 'reactive-state', 'authority-preservation', 'loopback-runtime-evidence'],
      gates,
      changes: [{
        id: 'generated-loopback-server-runtime',
        kind: 'candidate-gene',
        scope: ['server', 'browser'],
        generalPrimitive: true,
        justification: 'RCL-owned state, rules and warrants lower into an HTTP state/observe/rule surface while unknown routes fail closed.',
      }],
    });
  }
}

if (k321K322Admitted) {
  const commonEvidence = [
    'examples/universal-stress/k321-k322-compiler-algorithm-cli.rcl',
    k321K322RuntimeContractPath,
    k321K322RuntimePath,
  ];
  const gates = Object.fromEntries(UNIVERSAL_STRESS_GATES.map((gate) => [gate, {
    status: STRESS_STATUS.PASS,
    evidence: gate === 'AI_GENERATE'
      ? [k321K322AiContractPath, k321K322AiReceiptPath, k321K322AiGithubReplayPath, k321K322RuntimePath]
      : commonEvidence,
    note: gate === 'AI_GENERATE'
      ? `Three independent RCL algorithm repairs restored canonical bytes; GitHub run ${k321K322.githubAuthority.runId} bound Linux and Windows native CLI replay.`
      : `Frozen 20-round native rclc/rclvm CLI profile; runtime receipt ${k321K322.runtimeEvidenceBinding.reportRoot}.`,
  }]));
  for (const [programFamily, coverageMode] of [['algorithm', COVERAGE_MODE.NATIVE_SEMANTIC], ['cli', COVERAGE_MODE.LOWERED_EXECUTION]]) {
    directClaims.push({
      id: `compiler-runtime::${programFamily}`,
      coverageMode,
      lastVerifiedSha: k321K322.githubAuthority.sourceCommit,
      lastVerifiedDate: k321K322.githubAuthority.verifiedAt.slice(0, 10),
      knownLimits: [
        'Evidence is limited to the frozen recursive GCD, Fibonacci and sum-of-squares profile with fixed in-source inputs.',
        'CLI evidence covers native rclc/rclvm process invocation, stdout JSON and fail-closed source/RBC inputs; interactive arguments and shell authority remain unverified.',
        'AI_GENERATE is limited to three receipt-bound semantic repairs and grants no K327/K339 compiler authority.',
      ],
      relatedKillerTasks: [],
      requiredGenes: ['recursive-numeric-algorithms', 'native-compiler-byte-parity', 'native-cli-rooted-state', 'fail-closed-cli-inputs'],
      gates: structuredClone(gates),
      changes: [{
        id: 'native-compiler-runtime-algorithm-cli-profile',
        kind: 'stress-case',
        scope: ['compiler-runtime'],
        generalPrimitive: true,
        justification: 'Existing RCL recursion, arithmetic and state semantics execute through the ordinary native compiler and VM CLI without a task-specific opcode or opaque algorithm provider.',
      }],
    });
  }
}

const claimsById = new Map(nativeUi.claims.map((claim) => [claim.id, claim]));
const selfhostClaim = structuredClone(claimsById.get('compiler-runtime::self-hosting'));
if (!selfhostClaim) throw new Error('RCL_K400_K01_AI_TARGET_MISSING:compiler-runtime::self-hosting');
if (k01AiAdmitted) {
  selfhostClaim.gates.AI_GENERATE = {
    status: STRESS_STATUS.PASS,
    evidence: [k01AiContractPath, k01AiReceiptPath, k01AiGithubReplayPath],
    note: `Three independent compiler-source repairs restored canonical bytes and native fixed point; GitHub run ${k01Ai.githubAuthority.runId} bound Linux replay plus Windows self-hosting.`,
  };
  selfhostClaim.lastVerifiedSha = k01Ai.githubAuthority.sourceCommit;
  selfhostClaim.lastVerifiedDate = k01Ai.githubAuthority.verifiedAt.slice(0, 10);
  selfhostClaim.knownLimits = selfhostClaim.knownLimits.filter((limit) => !/AI_GENERATE/iu.test(limit)).concat(
    'AI_GENERATE is limited to three receipt-bound compiler opcode repairs; it does not prove arbitrary compiler evolution or whole-runtime self-hosting.',
  );
  claimsById.set('compiler-runtime::self-hosting', selfhostClaim);
}
if (k327CompilerAiAdmitted) {
  const compilerClaim = structuredClone(selfhostClaim);
  compilerClaim.id = 'compiler-runtime::compiler';
  compilerClaim.lastVerifiedSha = k327CompilerAi.githubAuthority.sourceCommit;
  compilerClaim.lastVerifiedDate = k327CompilerAi.githubAuthority.verifiedAt.slice(0, 10);
  compilerClaim.relatedKillerTasks = ['K01'];
  compilerClaim.requiredGenes = ['general-rcl-compiler', 'builtin-lowering-table', 'native-compiler-runtime', 'fixed-point-differential'];
  compilerClaim.gates.AI_GENERATE = {
    status: STRESS_STATUS.PASS,
    evidence: [k327CompilerAiContractPath, k327CompilerAiReceiptPath, k327CompilerAiGithubReplayPath, k01AiReceiptPath, k01AiGithubReplayPath],
    note: `Three new independent builtin-lowering repairs restored canonical compiler bytes; GitHub run ${k327CompilerAi.githubAuthority.runId} bound focused replay plus Windows native fixed point.`,
  };
  compilerClaim.knownLimits = [
    'The claim covers the current general RCL compiler and three receipt-bound builtin-lowering repairs; arbitrary compiler evolution remains unverified.',
    'The admitted K01 fixed-point evidence is reused only as compiler runtime evidence; K339 AI_GENERATE authority is not inherited.',
    'Whole-language runtime self-hosting and the remaining K400 cells are not claimed.',
  ];
  claimsById.set(compilerClaim.id, compilerClaim);
}
if (k340AiAdmitted) {
  const sharedEvidence = [k340RuntimeContractPath, k340RuntimePath, k340AiContractPath, k340AiReceiptPath, k340AiGithubReplayPath];
  const gates = Object.fromEntries(UNIVERSAL_STRESS_GATES.map((gate) => [gate, {
    status: STRESS_STATUS.PASS,
    evidence: sharedEvidence,
    note: gate === 'AI_GENERATE'
      ? `Three independent recursive/phase/authority repairs passed; GitHub run ${k340Ai.githubAuthority.runId} bound focused and Windows replay.`
      : `Frozen 20-round native mixed-paradigm receipt ${k340Ai.runtimeEvidenceBinding.reportRoot}.`,
  }]));
  claimsById.set('compiler-runtime::mixed-paradigm', {
    id: 'compiler-runtime::mixed-paradigm',
    coverageMode: COVERAGE_MODE.NATIVE_SEMANTIC,
    lastVerifiedSha: k340Ai.githubAuthority.sourceCommit,
    lastVerifiedDate: k340Ai.githubAuthority.verifiedAt.slice(0, 10),
    knownLimits: [
      'The claim covers one bounded program combining recursive computation, declarative authority, transactional state and a state-triggered rule chain.',
      'The self-host compiler static warrant-validation gap remains open; native rclvm rejects the negative artifact before commit.',
      'Arbitrary mixed-paradigm generation, hostile-OS isolation, competitive parity and unrelated K400 cells remain unverified.',
    ],
    relatedKillerTasks: ['K01'],
    requiredGenes: ['recursive-reckon', 'authority-warrant', 'transaction-preserve', 'semantic-state-root', 'state-triggered-rule-chain'],
    gates,
    changes: [{
      id: 'compiler-mixed-paradigm-profile',
      kind: 'stress-evidence',
      scope: ['compiler-runtime'],
      generalPrimitive: true,
      justification: 'One RCL-owned program executes four existing general paradigms through native compiler/runtime boundaries without a cell-specific opcode.',
    }],
  });
}
if (k337K338AiAdmitted) {
  const sharedEvidence = [k337K338RuntimeContractPath, k337K338RuntimePath, k337K338AiContractPath, k337K338AiReceiptPath, k337K338AiGithubReplayPath];
  const gates = Object.fromEntries(UNIVERSAL_STRESS_GATES.map((gate) => [gate, {
    status: STRESS_STATUS.PASS,
    evidence: sharedEvidence,
    note: gate === 'AI_GENERATE'
      ? `Three independent authority/reactive/preserve repairs passed; GitHub run ${k337K338Ai.githubAuthority.runId} bound focused and Windows replay.`
      : `Frozen 20-round native compiler-governance receipt ${k337K338Ai.runtimeEvidenceBinding.reportRoot}.`,
  }]));
  for (const dimension of ['security-sensitive', 'reactive']) {
    claimsById.set(`compiler-runtime::${dimension}`, {
      id: `compiler-runtime::${dimension}`,
      coverageMode: COVERAGE_MODE.NATIVE_SEMANTIC,
      lastVerifiedSha: k337K338Ai.githubAuthority.sourceCommit,
      lastVerifiedDate: k337K338Ai.githubAuthority.verifiedAt.slice(0, 10),
      knownLimits: [
        'The evidence covers one bounded two-transaction compiler-governance profile, not arbitrary compiler security or autonomous reactive systems.',
        'The self-host compiler does not yet statically reject a missing cause-subject warrant; the native VM rejects it with RCL_AUTHORITY_DENIED before commit.',
        'Hostile operating-system isolation, cryptographic signer custody, production compiler promotion and unrelated K400 cells remain unverified.',
      ],
      relatedKillerTasks: ['K01'],
      requiredGenes: ['authority-warrant', 'transaction-preserve', 'semantic-state-root', 'state-triggered-rule-chain', 'native-compiler-runtime'],
      gates: structuredClone(gates),
      changes: [{
        id: 'compiler-governance-reactive-profile',
        kind: 'stress-evidence',
        scope: ['compiler-runtime'],
        generalPrimitive: true,
        justification: 'Existing RCL warrant, transaction, invariant and state-trigger semantics execute through the native compiler runtime without a cell-specific opcode.',
      }],
    });
  }
}
for (const id of ['browser::gui', 'browser::reactive']) {
  const claim = structuredClone(claimsById.get(id));
  if (!claim) throw new Error(`RCL_K400_K02_AI_TARGET_MISSING:${id}`);
  claim.gates.AI_GENERATE = k02AiGate(claim.gates.AI_GENERATE);
  claim.knownLimits = admittedK02Limits(claim.knownLimits);
  if (k02AiAdmitted) {
    claim.lastVerifiedSha = k02Ai.githubAuthority.sourceCommit;
    claim.lastVerifiedDate = k02Ai.githubAuthority.verifiedAt.slice(0, 10);
  }
  claimsById.set(id, claim);
}
for (const claim of directClaims) claimsById.set(claim.id, claim);
for (const id of ['android::gui', 'android::mobile', 'android::reactive']) {
  const claim = structuredClone(claimsById.get(id));
  if (!claim) throw new Error(`RCL_K400_K03_EMULATOR_TARGET_MISSING:${id}`);
  for (const gate of ['EXECUTE', 'CORRECT', 'PERFORMANCE']) {
    claim.gates[gate] = {
      status: STRESS_STATUS.PASS,
      evidence: [k03EmulatorPath],
      note: gate === 'PERFORMANCE'
        ? `API ${k03Emulator.device.apiLevel} emulator ADB/UIAutomator end-to-end p95 ${k03Emulator.performance.p95Ms.toFixed(3)} ms <= ${k03Emulator.performance.interactionBudgetMs} ms.`
        : `Installed and exercised the frozen K03 transaction UI on ${k03Emulator.device.avdName}; receipt ${k03Emulator.reportRoot}.`,
    };
  }
  if (k03AiAdmitted) {
    claim.gates.AI_GENERATE = {
      status: STRESS_STATUS.PASS,
      evidence: [k03AiContractPath, k03AiReceiptPath, k03AiGithubReplayPath, k03EmulatorPath],
      note: `Three independent Android repairs restored canonical bytes and replayed with emulator receipt; GitHub run ${k03Ai.githubAuthority.runId}.`,
    };
    claim.lastVerifiedSha = k03Ai.githubAuthority.sourceCommit;
    claim.knownLimits = claim.knownLimits.filter((limit) => !/AI_GENERATE/iu.test(limit)).concat(
      'AI_GENERATE is limited to three receipt-bound K03 transaction/binding/lifecycle repairs; it does not prove arbitrary Android application generation.',
    );
  }
  claim.lastVerifiedDate = k03Emulator.verifiedAt.slice(0, 10);
  claim.knownLimits = claim.knownLimits.filter((limit) => !/(no Android SDK|no device|device execution|device\/emulator interaction|device timing|performance are unverified)/iu.test(limit)).concat(
    'Android runtime evidence is limited to one local API 35 x86_64 AVD and the frozen K03 transaction UI; physical-device, fleet and frame-rendering parity remain unverified.',
  );
  claimsById.set(id, claim);
}

const evidence = {
  schema: 'rcl.universal-stress.evidence.v0.1',
  generation: 'k400-consolidated-v0.1',
  claims: [...claimsById.values()],
  competitiveComparisons: nativeUi.competitiveComparisons ?? [],
  donorComparisons: nativeUi.donorComparisons ?? [],
  novelTaskTrials: nativeUi.novelTaskTrials ?? 0,
  kernelChangesForNovelTasks: nativeUi.kernelChangesForNovelTasks ?? 0,
  sourceReceipts: [nativeUiPath, k02Path, k03Path, k03EmulatorPath, k03AiContractPath, k03AiReceiptPath, ...(k03AiAdmitted ? [k03AiGithubReplayPath] : []), k04ServerRuntimeContractPath, k04ServerRuntimePath, k04ServerAiContractPath, k04ServerAiReceiptPath, ...(k04ServerAiAdmitted ? [k04ServerAiGithubReplayPath] : []), k327CompilerAiContractPath, k327CompilerAiReceiptPath, ...(k327CompilerAiAdmitted ? [k327CompilerAiGithubReplayPath] : []), k321K322RuntimeContractPath, k321K322RuntimePath, k321K322AiContractPath, k321K322AiReceiptPath, ...(k321K322Admitted ? [k321K322AiGithubReplayPath] : []), k337K338RuntimeContractPath, k337K338RuntimePath, k337K338AiContractPath, k337K338AiReceiptPath, ...(k337K338AiAdmitted ? [k337K338AiGithubReplayPath] : []), k340RuntimeContractPath, k340RuntimePath, k340AiContractPath, k340AiReceiptPath, ...(k340AiAdmitted ? [k340AiGithubReplayPath] : []), k08Path, k233ReceiptPath, k233GithubReplayPath, k02AiContractPath, k02AiReceiptPath, ...(k02AiAdmitted ? [k02AiGithubReplayPath] : []), k01AiContractPath, k01AiReceiptPath, ...(k01AiAdmitted ? [k01AiGithubReplayPath] : []), k08TensorMlpPath, k08TensorMlpGithubReplayPath, k08TensorLivenessPath, k08TensorLivenessGithubReplayPath, k08TensorBorrowedInputPath, k08TensorBorrowedInputGithubReplayPath, k08AutodiffPath, k08AutodiffGithubReplayPath, browserPerformanceContractPath, browserRuntimePath],
  notes: [
    'This is the consolidated K400 campaign input; it preserves the status and evidence boundaries of each source receipt.',
    'Historical K02 and K03 receipts are not relabeled as current execution evidence.',
    'Missing gates remain BLOCKED and unclaimed matrix cells remain UNTESTED.',
    'K08-B closes K233 through a GitHub-bound 3/3 independent repair receipt; it proves the bounded AI-N2 General MLP profile, not Tensor/Autodiff/Transformer infrastructure.',
    k02AiAdmitted
      ? `K02 closes K063, K064 and K078 AI_GENERATE through 3/3 independent repairs and GitHub run ${k02Ai.githubAuthority.runId}; it proves only the bounded Web/GUI/reactive vertical slice.`
      : 'K02 has a 3/3 local independent repair candidate; K063, K064 and K078 remain BLOCKED until GitHub-hosted replay is bound.',
    k01AiAdmitted
      ? `K01 closes K339 AI_GENERATE through 3/3 independent compiler-source repairs, shared native fixed point and GitHub Linux/Windows run ${k01Ai.githubAuthority.runId}.`
      : 'K01 has a 3/3 local independent compiler repair candidate and shared native fixed point; K339 remains BLOCKED until GitHub Linux/Windows replay is bound.',
    k03AiAdmitted
      ? `K03 real emulator receipt ${k03Emulator.reportRoot} closes EXECUTE, CORRECT and PERFORMANCE for K083, K085 and K098; their independent AI_GENERATE receipt is separately admitted.`
      : `K03 real emulator receipt ${k03Emulator.reportRoot} closes EXECUTE, CORRECT and PERFORMANCE for K083, K085 and K098 on the frozen transaction UI; Android AI_GENERATE remains independently blocked.`,
    k03AiAdmitted
      ? `K03 closes K083, K085 and K098 AI_GENERATE through 3/3 independent Android repairs, emulator receipt binding and GitHub run ${k03Ai.githubAuthority.runId}.`
      : 'K03 has a 3/3 local independent Android repair candidate bound to the real emulator receipt; Android cells remain BLOCKED until GitHub replay is bound.',
    k04ServerAiAdmitted
      ? `K04 closes K124 and K138 through 20/20 loopback runtime rounds, 3/3 independent Server repairs and GitHub run ${k04ServerAi.githubAuthority.runId}.`
      : 'K04 has 20/20 rooted loopback runtime rounds and a 3/3 local independent Server repair candidate; K124 and K138 remain UNTESTED until GitHub-hosted replay is bound.',
    k327CompilerAiAdmitted
      ? `K327 closes compiler-runtime::compiler through 3/3 new independent builtin-lowering repairs, separately admitted fixed-point reuse and GitHub Linux/Windows run ${k327CompilerAi.githubAuthority.runId}.`
      : 'K327 has a 3/3 local independent compiler builtin-lowering repair candidate; it remains UNTESTED until GitHub focused and Windows replay are bound.',
    k340AiAdmitted
      ? `K340 closes compiler-runtime::mixed-paradigm through 20/20 four-paradigm native rounds, 3/3 independent repairs and GitHub run ${k340Ai.githubAuthority.runId}.`
      : 'K340 has 20/20 rooted four-paradigm native rounds and a 3/3 local independent repair candidate; it remains UNTESTED until GitHub focused and Windows replay are bound.',
    k337K338AiAdmitted
      ? `K337/K338 close compiler-runtime::security-sensitive and compiler-runtime::reactive through 20/20 native transactions, 3/3 independent repairs and GitHub run ${k337K338Ai.githubAuthority.runId}.`
      : 'K337/K338 have 20/20 rooted native transactions and a 3/3 local independent repair candidate; both remain UNTESTED until GitHub focused and Windows replay are bound.',
    k321K322Admitted
      ? `K321/K322 close compiler-runtime::algorithm and compiler-runtime::cli through 20 native rounds, 3/3 independent repairs and GitHub Linux/Windows run ${k321K322.githubAuthority.runId}.`
      : 'K321/K322 have 20/20 native algorithm CLI rounds and a 3/3 local independent repair candidate; both remain UNTESTED until GitHub focused and Windows replay are bound.',
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
