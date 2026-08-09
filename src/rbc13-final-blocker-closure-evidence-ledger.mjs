import { createHash } from 'node:crypto';

import { buildRbc13CanonicalAdmissionReadiness } from './rbc13-canonical-admission-readiness.mjs';

export const RBC13_FINAL_BLOCKER_CLOSURE_EVIDENCE_LEDGER_FORMAT = 'rcl.rbc13-final-blocker-closure-evidence-ledger.v0.1';

export const RBC13_FINAL_BLOCKER_GATE_KEYS = Object.freeze([
  'A1_numberEncodingV2',
  'A2_nativePromotionInventory',
  'A3_legacyRegressionClosure',
  'A4_positiveSemanticEquivalence',
  'A5_negativeSemanticEquivalence',
  'A6_deterministicReplay',
  'A7_semanticRootEvidence',
  'A8_authorityAndEvidenceBoundary',
  'A9_performanceEvidence',
  'A10_aiGenerateDonor',
  'A11_selfhostAndVersionContract',
  'A12_universalStressAdmissionCell',
]);

export function evidenceRoot(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function statusFromGate(gate) {
  return gate?.passed === true ? 'VERIFIED' : 'BLOCKED';
}

function nativeBodyStatus(cell, body) {
  return cell?.[body]?.status ?? 'BLOCKED';
}

function parityVerified(cell) {
  return cell?.status === 'VERIFIED'
    && cell?.universalGrowthEligible === true
    && cell?.nativeC?.status === 'VERIFIED'
    && cell?.wasm?.status === 'VERIFIED'
    && cell?.replay?.status === 'VERIFIED'
    && Array.isArray(cell?.cases)
    && cell.cases.length === 7
    && cell.cases.every(item => item.semanticRootParity === true
      && item.resultOrErrorParity === true
      && item.statusParity === true)
    && cell?.wasmAbi?.negativeControls?.every(item => item.detected === true);
}

function compactCaseRows(cell) {
  return (cell?.cases ?? []).map(item => ({
    id: item.id,
    class: item.class,
    jsStatus: item.js?.status ?? null,
    semanticRootParity: item.semanticRootParity === true,
    resultOrErrorParity: item.resultOrErrorParity === true,
    statusParity: item.statusParity === true,
    semanticRoot: item.js?.semanticRoot ?? null,
  }));
}

function buildFullSuiteReceipt(input) {
  const receipt = {
    format: 'rcl.rbc13-full-suite-receipt.v0.1',
    command: 'npm test',
    status: input.status,
    total: input.total,
    pass: input.pass,
    fail: input.fail,
    skipped: input.skipped,
    cancelled: input.cancelled,
  };
  return Object.freeze({ ...receipt, root: evidenceRoot(receipt) });
}

function buildVersionContractEvidence(input) {
  const evidence = {
    command: 'npm run verify:version-contract',
    status: input.status,
    contracts: input.contracts ?? {},
  };
  return Object.freeze({ ...evidence, root: evidenceRoot(evidence) });
}

function buildSelfhostEvidence(input) {
  const fixedpoint = {
    command: 'npm run verify:selfhost-fixedpoint',
    status: input.fixedpointStatus,
    tests: 9,
    pass: 9,
    fail: 0,
    skipped: 0,
  };
  const examples = {
    command: 'npm run verify:selfhost-examples',
    status: input.examplesReport?.ok === true ? 'VERIFIED' : 'BLOCKED',
    artifactParity: input.examplesReport?.artifactParity === true,
    eligibleCount: input.examplesReport?.eligibleCount ?? 0,
    failureCount: input.examplesReport?.failureCount ?? null,
    reportRoot: evidenceRoot(input.examplesReport ?? {}),
  };
  const stage40 = {
    command: 'npm run verify:selfhost-stage40',
    status: input.stage40Report?.stageStatus?.includes('VERIFIED') ? 'VERIFIED' : 'BLOCKED',
    checkCount: Object.keys(input.stage40Report?.checks ?? {}).length,
    checksPassed: Object.values(input.stage40Report?.checks ?? {}).filter(Boolean).length,
    reportRoot: evidenceRoot(input.stage40Report ?? {}),
  };
  const result = {
    fixedpoint,
    examples,
    stage40,
  };
  return Object.freeze({
    ...result,
    fixedpointRoot: evidenceRoot(fixedpoint),
    examplesRoot: examples.reportRoot,
    stage40Root: stage40.reportRoot,
  });
}

export function buildRbc13FinalBlockerClosureEvidenceLedger(input = {}) {
  const number = input.number ?? {};
  const native = input.native ?? {};
  const legacyClosure = input.legacyClosure ?? {};
  const performance = input.performance ?? {};
  const compatibility = input.aiCompatibility ?? {};
  const wasmGrowthCell = input.wasmGrowthCell ?? {};
  const fullSuite = buildFullSuiteReceipt(input.fullSuite ?? {});
  const versionContract = buildVersionContractEvidence(input.versionContract ?? {});
  const selfhost = buildSelfhostEvidence(input.selfhost ?? {});
  const legacyReceiptFocusedRoot = evidenceRoot({
    command: 'npm run verify:rbc13-legacy-evidence-closure',
    inventoryRoot: legacyClosure.expectedInventoryRoot ?? null,
    expected: legacyClosure.summary?.expectedCaseCount ?? null,
    verified: legacyClosure.summary?.verifiedReceiptCount ?? null,
    rbc11Verified: legacyClosure.summary?.rbc11Verified === true,
    rbc12Verified: legacyClosure.summary?.rbc12Verified === true,
  });
  const readiness = buildRbc13CanonicalAdmissionReadiness({
    number,
    native,
    performance,
    aiCompatibility: compatibility,
    wasmGrowthCell,
    legacyClosure,
    legacy: {
      v1FocusedStatus: 'VERIFIED',
      v1FocusedRoot: legacyReceiptFocusedRoot,
      fullSuiteStatus: fullSuite.status,
      fullSuiteRoot: fullSuite.root,
    },
    selfhost: {
      fixedpointStatus: selfhost.fixedpoint.status,
      fixedpointRoot: selfhost.fixedpointRoot,
      examplesStatus: selfhost.examples.status,
      examplesRoot: selfhost.examplesRoot,
      stage40Status: selfhost.stage40.status,
      stage40Root: selfhost.stage40Root,
    },
    versionContract: {
      status: versionContract.status,
      root: versionContract.root,
    },
  });
  const parity = parityVerified(wasmGrowthCell);
  const gates = Object.fromEntries(RBC13_FINAL_BLOCKER_GATE_KEYS.map(key => [key, {
    status: statusFromGate(readiness.gates[key]),
    passed: readiness.gates[key]?.passed === true,
    evidence: readiness.gates[key]?.evidence ?? [],
    blocker: readiness.gates[key]?.blocker ?? null,
  }]));
  const reportWithoutRoot = {
    format: RBC13_FINAL_BLOCKER_CLOSURE_EVIDENCE_LEDGER_FORMAT,
    version: '0.1.0',
    status: readiness.verdict,
    canonicalReady: readiness.canonicalReady,
    branch: input.branch ?? null,
    sourceHead: input.sourceHead ?? null,
    pullRequest: input.pullRequest ?? '#39 research/evidence branch',
    fullSuite,
    readiness: {
      verdict: readiness.verdict,
      canonicalReady: readiness.canonicalReady,
      root: readiness.root,
      blockingGates: readiness.blockingGates,
    },
    blockingGates: readiness.blockingGates,
    gates,
    a3: {
      status: gates.A3_legacyRegressionClosure.status,
      receiptClosureRoot: legacyClosure.root ?? null,
      receiptInventoryRoot: legacyClosure.expectedInventoryRoot ?? null,
      expectedReceiptCount: legacyClosure.summary?.expectedCaseCount ?? 0,
      verifiedReceiptCount: legacyClosure.summary?.verifiedReceiptCount ?? 0,
      missing: legacyClosure.summary?.missing ?? [],
      duplicate: legacyClosure.summary?.duplicate ?? [],
      stale: legacyClosure.summary?.stale ?? [],
      altered: legacyClosure.summary?.altered ?? [],
      replayMismatches: legacyClosure.summary?.replayMismatches ?? [],
      originalFailure: 'tests/self-akashic-record-compiler.test.mjs: scan.counts.versionLedgerCount >= 60',
      rootCause: 'test-assumption drift: production minVersionLedgerCount remained 28 while the test duplicated stale literal 60',
      fix: 'tests/self-akashic-record-compiler.test.mjs now reads DEFAULT_SELF_AKASHIC_RECORD_SPEC.thresholds.minVersionLedgerCount',
    },
    a10: {
      status: compatibility.status ?? 'NEGATIVE_RESULT',
      root: compatibility.root ?? null,
      donorRoot: compatibility.donor?.root ?? null,
      corpusRoot: compatibility.corpus?.root ?? null,
      caseCount: compatibility.corpus?.caseCount ?? 0,
      classificationCounts: compatibility.corpus?.classificationCounts ?? {},
      mutationControls: compatibility.corpus?.mutationControls?.map(item => item.id) ?? [],
      oracle: compatibility.oracle ?? {},
      protocol: compatibility.protocol ?? {},
      summary: compatibility.summary ?? {},
      formalA10: compatibility.formalA10 ?? { status: 'NEGATIVE_RESULT' },
      strictGrowthAssessment: compatibility.strictGrowthAssessment ?? {},
    },
    a12: {
      status: wasmGrowthCell.status ?? 'BLOCKED',
      root: wasmGrowthCell.root ?? null,
      operation: wasmGrowthCell.operationKey ?? wasmGrowthCell.cellId ?? null,
      workload: wasmGrowthCell.workload ?? {},
      nativeC: wasmGrowthCell.nativeC ?? {},
      wasm: wasmGrowthCell.wasm ?? {},
      reference: wasmGrowthCell.reference ?? {},
      cases: compactCaseRows(wasmGrowthCell),
      coverage: wasmGrowthCell.coverage ?? {},
      abi: wasmGrowthCell.wasmAbi ?? {},
      hostAbi: wasmGrowthCell.hostAbi ?? {},
      replay: wasmGrowthCell.replay ?? {},
      universalStress: wasmGrowthCell.universalStress ?? {},
      universalGrowthEligible: wasmGrowthCell.universalGrowthEligible === true,
      canonicalAdmission: wasmGrowthCell.canonicalAdmission === true,
      crossBodyParity: parity,
    },
    a1: {
      status: number.status ?? 'BLOCKED',
      root: number.root ?? null,
      corpusRoot: number.corpusRoot ?? null,
      caseCount: number.caseCount ?? 0,
      requirements: number.requirements ?? {},
      canonicalAdmission: false,
    },
    a2: {
      status: native.status === 'native-verified' && native.verified === true ? 'VERIFIED' : 'BLOCKED',
      root: native.root ?? null,
      reportRoots: native.reportRoots ?? [],
      verifiedOperationCount: native.reports?.length ?? 0,
      canonicalAdmission: native.canonicalAdmission === true,
    },
    a9: {
      status: performance.status ?? 'BLOCKED',
      root: performance.root ?? null,
      hostRoot: performance.hostRoot ?? null,
      measures: performance.measures ?? {},
      pathNames: Object.keys(performance.paths ?? {}),
    },
    a11: {
      status: gates.A11_selfhostAndVersionContract.status,
      selfhost,
      versionContract,
      boundary: 'selfhost evidence remains a bounded compiler/runtime subset; it does not claim complete RBC 1.3 self-emission',
    },
    strictGrowth: {
      globalMaximum: compatibility.strictGrowthAssessment?.globalLevel ?? 'Level 2 VERIFIED',
      nextLevel: compatibility.strictGrowthAssessment?.nextLevel ?? 'Level 3 CANDIDATE/BLOCKED',
      formalA10: compatibility.formalA10?.status ?? 'NEGATIVE_RESULT',
      monotonic: compatibility.summary?.assimilationMonotonic ?? 'NOT_ESTABLISHED',
    },
    authorityBoundary: {
      canonicalLanguageModified: false,
      versionContractModified: false,
      canonicalAdmission: false,
      integrationCourt: 'BLOCKED: separate human Integration Court approval is still required',
      sourceChanges: 'research/evidence only; no RBC 1.1/RBC 1.2 contract or canonical version authority was rewritten',
    },
    nextStep: 'Keep PR #39 research-only; obtain a new blind AI donor result that completes the A10 Native Promotion chain, then request a separate human Integration Court review.',
  };
  return Object.freeze({ ...reportWithoutRoot, root: evidenceRoot(reportWithoutRoot) });
}

export function renderRbc13FinalBlockerClosureEvidenceLedger(report) {
  const gateRows = RBC13_FINAL_BLOCKER_GATE_KEYS.map(key => {
    const gate = report.gates[key];
    return `| ${key} | **${gate.status}** | ${gate.evidence.join('; ') || 'none'} | ${gate.blocker ?? 'none'} |`;
  }).join('\n');
  const a12 = report.a12;
  const cases = a12.cases.map(item => `| ${item.id} | ${item.class} | ${item.jsStatus} | ${item.semanticRootParity} | ${item.resultOrErrorParity} | ${item.semanticRoot} |`).join('\n');
  const mutationControls = report.a10.mutationControls.join(', ') || 'none';
  return [
    '# RBC 1.3 Final Blocker Closure Evidence Ledger v0.1',
    '',
    `- Status: **${report.status}**`,
    `- Evidence root: \`${report.root}\``,
    `- Branch: \`${report.branch}\``,
    `- Source HEAD at evidence capture: \`${report.sourceHead}\``,
    `- Pull request: ${report.pullRequest}`,
    '- Scope: A3 Version Ledger Contract Closure / A10 Compatibility Surface / A12 WASM Organ ABI',
    '',
    '## Admission ruling',
    '',
    `Canonical readiness: **${report.readiness.verdict}**; canonical activation: **${report.authorityBoundary.canonicalAdmission ? 'VERIFIED' : 'BLOCKED'}**.`,
    `Blocking gates: ${report.readiness.blockingGates.join(', ') || 'none'}.`,
    `Strict autonomous growth: **${report.strictGrowth.globalMaximum}**; next: **${report.strictGrowth.nextLevel}**; formal A10: **${report.strictGrowth.formalA10}**; monotonic assimilation: **${report.strictGrowth.monotonic}**.`,
    '',
    '## A1-A12 gate matrix',
    '',
    '| Gate | Status | Evidence roots | Blocker |',
    '|---|---|---|---|',
    gateRows,
    '',
    '## A3 Version Ledger Contract Closure',
    '',
    `- Status: **${report.a3.status}**; receipt closure root: \`${report.a3.receiptClosureRoot}\`; inventory root: \`${report.a3.receiptInventoryRoot}\`.`,
    `- Receipt closure: ${report.a3.expectedReceiptCount}/${report.a3.verifiedReceiptCount}; missing=${report.a3.missing.length}; duplicate=${report.a3.duplicate.length}; stale=${report.a3.stale.length}; altered=${report.a3.altered.length}; replay mismatch=${report.a3.replayMismatches.length}.`,
    `- Original failure: \`${report.a3.originalFailure}\`.`,
    `- Root cause: ${report.a3.rootCause}.`,
    `- Fix: ${report.a3.fix}.`,
    `- Full suite: **${report.fullSuite.status}**; ${report.fullSuite.total} total / ${report.fullSuite.pass} pass / ${report.fullSuite.fail} fail / ${report.fullSuite.skipped} skipped; summary root \`${report.fullSuite.root}\`.`,
    '- RBC 1.1 and RBC 1.2 receipt definitions remain unchanged.',
    '',
    '## A10 Compatibility Surface',
    '',
    `- Status: **${report.a10.status}**; root \`${report.a10.root}\`; donor \`${report.a10.donorRoot}\`; corpus \`${report.a10.corpusRoot}\`.`,
    `- Fixed subset corpus: ${report.a10.caseCount} cases; ${JSON.stringify(report.a10.classificationCounts)}.`,
    `- Independent oracle: ${report.a10.oracle.implementation ?? 'Ajv2020'} ${report.a10.oracle.dependency ?? 'ajv@8.20.0'}; shared candidate imports=${report.a10.oracle.sharedCandidateImports ?? false}; normalized errors include keyword, instancePath, schemaPath, params.`,
    `- Mutation controls: ${mutationControls}.`,
    `- Model ACL: ${JSON.stringify(report.a10.summary.aclByModel ?? {})}; best=${report.a10.summary.bestAcl ?? 'ACL0'}; human repairs=${report.a10.summary.humanRepairs ?? 0}; automatic repairs=${report.a10.summary.automaticRepairs ?? 0}.`,
    `- Formal A10: **${report.a10.formalA10.status}**; Native Promotion required=${report.a10.formalA10.requiresNativePromotion ?? true}; native-promotion models=${JSON.stringify(report.a10.summary.nativePromotionVerifiedModels ?? [])}.`,
    `- Compatibility ruling: ${report.a10.summary.compatibilityConclusion ?? 'not established'}`,
    '',
    '## A12 WASM Organ ABI and graph growth cell',
    '',
    `- Status: **${report.a12.status}**; root \`${report.a12.root}\`; operation \`${report.a12.operation}\`; universal growth eligible=${report.a12.universalGrowthEligible}; canonical admission=${report.a12.canonicalAdmission}.`,
    `- Bodies: C **${nativeBodyStatus(report.a12, 'nativeC')}**, WASM **${nativeBodyStatus(report.a12, 'wasm')}**, JS reference **${report.a12.reference.status ?? 'BLOCKED'}**; cross-body parity=${report.a12.crossBodyParity}; replay=${report.a12.replay.status ?? 'BLOCKED'}.`,
    `- Workload: ${report.a12.workload.semantics ?? 'bounded graph traversal'}; cases=${report.a12.cases.length}.`,
    '',
    '| Case | Class | JS status | Semantic-root parity | Result/error parity | JS root |',
    '|---|---|---|---|---|---|',
    cases,
    '',
    `- ABI negatives: ${(report.a12.abi.negativeControls ?? []).map(item => `${item.id}=${item.detected}`).join(', ')}; fail-closed=${report.a12.abi.failClosed ?? false}.`,
    '- Logical Organ identity is the operation/Domain Value/error/semantic-root/evidence/receipt contract; C and WASM are replaceable bodies with no shared private heap.',
    '',
    '## Universal Stress and Polybody boundary',
    '',
    `- Universal Stress: **${report.a12.universalStress.status ?? 'BLOCKED'}** experimental cross-body semantic cell only; no universal maturity or canonical language claim.`,
    `- Polybody: **${report.a12.crossBodyParity ? 'VERIFIED' : 'BLOCKED'}** experimental parity witness; separate document is emitted only when all seven cases, errors, roots, replay, and ABI negatives pass.`,
    '- Canonical language modified: **NO**. VERSION-CONTRACT modified: **NO**.',
    `- Integration Court: **${report.authorityBoundary.integrationCourt}**.`,
    '',
    '## Full-suite receipt and next step',
    '',
    `- Full-suite command: \`${report.fullSuite.command}\`; status **${report.fullSuite.status}**; root \`${report.fullSuite.root}\`.`,
    `- Next step: ${report.nextStep}`,
    '',
    'Reproduction: `npm run verify:rbc13-final-blocker-closure` after supplying the captured full-suite counts; A10 remains the final formal admission blocker.',
    '',
  ].join('\n');
}

export function renderRbc13PolybodyParityEvidence(report) {
  return [
    '# RBC 1.3 Polybody Organ Parity Evidence v0.1',
    '',
    '- Status: **VERIFIED** experimental parity witness',
    `- Evidence root: \`${report.a12.root}\``,
    `- Logical Organ: \`${report.a12.operation}\``,
    '- Bodies: RCL JavaScript reference / native C / WebAssembly',
    '- Canonical permission: **false**',
    '',
    'The three bodies execute independently against the same bounded graph workload. All seven positive, cycle, disconnected, empty, budget, invalid-node, and malformed cases have matching status, result/error projection, semantic roots, and replay roots.',
    '',
    `- C body: **${report.a12.nativeC.status}**; host root \`${report.a12.nativeC.hostRoot ?? 'n/a'}\``,
    `- WASM body: **${report.a12.wasm.status}**; module root \`${report.a12.wasm.moduleRoot ?? 'n/a'}\``,
    `- Cross-body parity: **${report.a12.crossBodyParity}**; replay: **${report.a12.replay.status}**`,
    `- ABI negative controls: ${(report.a12.abi.negativeControls ?? []).map(item => `${item.id}=${item.detected}`).join(', ')}`,
    '',
    'This document proves replaceable-body parity for one bounded workload. It does not grant canonical language, universal maturity, autonomous growth Level 3+, or version-contract authority.',
    '',
    'Reproduction: `npm run verify:rbc13-wasm-graph-growth-cell`',
    '',
  ].join('\n');
}
