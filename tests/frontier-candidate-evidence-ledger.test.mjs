import test from 'node:test';
import assert from 'node:assert/strict';
import {
  appendCandidateEvidenceEvent,
  runUnknownKnowledgeEvidenceLoop,
  validateCandidateEvidenceLedger,
} from '../src/frontier-candidate-evidence-ledger.mjs';

function candidate(id, promoted, score = 0.8) {
  return {
    id,
    title: id,
    promoted,
    root: `candidate_root_${id}`,
    scores: { candidateKnowledgeScore: score },
    lockEvaluation: { score: promoted ? 0.9 : 0.2 },
    predictions: [{ id: `${id}_prediction`, claim: 'bounded test prediction' }],
    structure: { sourceClass: 'test_fixture', explicitFalsifiers: ['fixture falsifier'] },
  };
}

function compilerBundle(rows) {
  return {
    result: {
      root: 'compiler_result_root',
      promotedCount: rows.filter((x) => x.promoted).length,
      rejectedCount: rows.filter((x) => !x.promoted).length,
      candidates: rows,
    },
    candidates: rows,
  };
}

function courtFixture(overrides = {}) {
  const judgment = {
    laneId: 'spell_symbolic_control_protocol',
    evidenceRung: 1,
    status: 'SURVIVES_SANDBOX_ONLY_PENDING_EXTERNAL_EVIDENCE',
    researchDisposition: 'CONTINUE_TO_EXTERNAL_ACQUISITION',
    decisiveReason: null,
    root: 'court_judgment_root_spell',
    ...overrides,
  };
  return {
    judgments: [judgment],
    evidenceLeaders: ['spell_symbolic_control_protocol'],
    engineeringLeaders: ['spell_symbolic_control_protocol'],
    truthWinner: null,
    root: 'court_root_fixture',
  };
}

const emptyPortfolio = { specs: [], root: 'portfolio_root_fixture' };

test('compiler-promoted unknown candidate enters experiment-spec queue but not evidence rung 1', () => {
  const rows = [candidate('new_unknown_candidate', true)];
  const loop = runUnknownKnowledgeEvidenceLoop({
    compilerBundle: compilerBundle(rows),
    portfolio: emptyPortfolio,
    court: courtFixture(),
  });
  assert.equal(loop.validation.ok, true);
  assert.deepEqual(loop.result.promotedAwaitingExperimentSpec, ['new_unknown_candidate']);
  assert.equal(loop.ledger.entries[0].evidenceRung, 0);
  assert.equal(loop.ledger.entries[0].courtManaged, false);
  assert.equal(loop.ledger.entries[0].researchDisposition, 'COMPILE_EXPERIMENT_SPEC');
});

test('canonical promoted candidate may bind to Evidence Court but compiler score cannot substitute for Court rung', () => {
  const rows = [candidate('spell_symbolic_control_protocol', true, 0.99)];
  const loop = runUnknownKnowledgeEvidenceLoop({
    compilerBundle: compilerBundle(rows),
    portfolio: emptyPortfolio,
    court: courtFixture(),
  });
  const entry = loop.ledger.entries[0];
  assert.equal(loop.validation.ok, true);
  assert.equal(entry.courtManaged, true);
  assert.equal(entry.evidenceRung, 1);
  assert.equal(entry.events.length, 2);
  assert.equal(entry.compilerScore, 0.99);
  assert.notEqual(entry.compilerScore, entry.evidenceRung);
});

test('compiler-rejected candidate cannot enter Court even when a lane binding is supplied', () => {
  const rows = [candidate('rejected_candidate', false)];
  const loop = runUnknownKnowledgeEvidenceLoop({
    compilerBundle: compilerBundle(rows),
    portfolio: emptyPortfolio,
    court: courtFixture(),
    candidateLaneBindings: { rejected_candidate: 'spell_symbolic_control_protocol' },
  });
  const entry = loop.ledger.entries[0];
  assert.equal(loop.validation.ok, true);
  assert.equal(entry.courtManaged, false);
  assert.equal(entry.evidenceRung, 0);
  assert.equal(entry.status, 'REJECTED_BY_UNKNOWN_KNOWLEDGE_COMPILER_GATE');
  assert.deepEqual(loop.result.compilerRejected, ['rejected_candidate']);
});

test('append-only evidence event changes ledger root and remains valid', () => {
  const rows = [candidate('new_unknown_candidate', true)];
  const loop = runUnknownKnowledgeEvidenceLoop({
    compilerBundle: compilerBundle(rows),
    portfolio: emptyPortfolio,
    court: courtFixture(),
  });
  const beforeRoot = loop.ledger.root;
  const appended = appendCandidateEvidenceEvent(loop.ledger, 'new_unknown_candidate', {
    type: 'sandbox_design_note',
    evidenceClass: 'protocol_design_only',
    payloadRoot: 'payload_root_1',
    note: 'design note',
  });
  assert.notEqual(appended.root, beforeRoot);
  assert.equal(appended.revision, 1);
  assert.equal(validateCandidateEvidenceLedger(appended).ok, true);
});

test('tampering with an entry after root binding is rejected', () => {
  const rows = [candidate('new_unknown_candidate', true)];
  const loop = runUnknownKnowledgeEvidenceLoop({
    compilerBundle: compilerBundle(rows),
    portfolio: emptyPortfolio,
    court: courtFixture(),
  });
  const tampered = structuredClone(loop.ledger);
  tampered.entries[0].status = 'MAGIC_IS_TRUE';
  const validation = validateCandidateEvidenceLedger(tampered);
  assert.equal(validation.ok, false);
  assert.equal(validation.failures.some((x) => x.startsWith('entry_root_mismatch:')), true);
});

test('evidence boundary remains false through compiler-to-ledger-to-court bridge', () => {
  const rows = [candidate('spell_symbolic_control_protocol', true)];
  const loop = runUnknownKnowledgeEvidenceLoop({
    compilerBundle: compilerBundle(rows),
    portfolio: emptyPortfolio,
    court: courtFixture(),
  });
  assert.equal(loop.result.externalRealityVerified, false);
  assert.equal(loop.result.newNaturalLawVerified, false);
  assert.equal(loop.result.magicVerified, false);
  assert.equal(loop.ledger.externalRealityVerified, false);
  assert.equal(loop.ledger.newNaturalLawVerified, false);
  assert.equal(loop.ledger.magicVerified, false);
});
