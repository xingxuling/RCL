import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MOTHER_STRUCTURE_STATUS,
  buildMotherStructureCorpus,
  buildMotherStructureIR,
  runMotherStructureIntegrationCourt,
  verifyMotherStructureIntegrationCourt,
} from '../src/index.mjs';

const COMPLETE_SOURCE = name => `reality ${name} {
  facet world.ready : Truth = true
  facet world.score : Number = 4
  subject founder {
    facet score : Number = 1
    warrant world.raise on world
  }
  emergence promote {
    cause founder
    when world.ready == true and world.score >= 4
    needs world.raise on world
    alter world.score <- world.score + 2
    preserve world.score >= 4
    witness "candidate transition"
  }
  foresee promote
  realize promote
}`;

function candidateCorpus() {
  const sources = [
    ['K400', 'a', 'k400.rcl'],
    ['native-ui', 'b', 'native-ui.rcl'],
    ['package', 'c', 'package.rcl'],
  ].map(([scope, character, sourcePath], index) => buildMotherStructureIR(COMPLETE_SOURCE(`Court${index}`), {
    sourcePath,
    sourceSha256: character.repeat(64),
    scope,
    lineage: 'primary-or-example-source',
  }));
  return buildMotherStructureCorpus([
    ...sources,
    {
      records: [
        {
          structureId: 'rcl.ui.view_tree',
          status: MOTHER_STRUCTURE_STATUS,
          graph: { symbols: [{ id: 'ui', label: 'ui' }], relations: [] },
          sourcePath: 'native-ui/view.json',
          sourceSha256: 'd'.repeat(64),
          scope: 'native-ui',
        },
        {
          structureId: 'implementation.integrity_manifest',
          status: MOTHER_STRUCTURE_STATUS,
          graph: { symbols: [{ id: 'manifest', label: 'manifest' }], relations: [] },
          sourcePath: 'package/manifest.json',
          sourceSha256: 'e'.repeat(64),
          scope: 'package',
        },
        {
          structureId: 'rcl.reckon.function_contract',
          status: MOTHER_STRUCTURE_STATUS,
          graph: { symbols: [{ id: 'reckon', label: 'reckon' }], relations: [] },
          sourcePath: 'example/reckon.rcl',
          sourceSha256: 'f'.repeat(64),
          scope: 'K400',
        },
        {
          structureId: 'rcl.gap.async_effect_protocol',
          status: MOTHER_STRUCTURE_STATUS,
          gapCandidate: true,
          graph: { symbols: [{ id: 'gap', label: 'gap', classes: ['candidate'] }], relations: [] },
          sourcePath: 'gap/async-effect.rcl',
          sourceSha256: 'g'.repeat(64),
          scope: 'K400',
        },
      ],
    },
  ]);
}

function k400Evidence() {
  return {
    schema: 'rcl.universal-stress.evidence.v0.1',
    generation: 'integration-court-fixture',
    claims: [{
      id: 'compiler-runtime::self-hosting',
      coverageMode: 'native-semantic',
      gates: Object.fromEntries([
        'EXPRESS', 'COMPILE', 'LOWER', 'EXECUTE', 'CORRECT', 'ROBUST', 'PERFORMANCE', 'AI_GENERATE', 'EVIDENCE',
      ].map(gate => [gate, { status: 'PASS', evidence: [`fixture:${gate}`] }])),
    }],
  };
}

test('Integration Court retains structural candidates while failing closed on promotion', () => {
  const corpus = candidateCorpus();
  const report = runMotherStructureIntegrationCourt({ corpus, k400Evidence: k400Evidence() });
  const verification = verifyMotherStructureIntegrationCourt(report);
  assert.equal(verification.ok, true, verification.errors.join('; '));
  assert.equal(report.verdict, 'CANDIDATE_ONLY_HOLD');
  assert.equal(report.summary.localChecksPass, true);
  assert.equal(report.k400.status, 'INCOMPLETE');
  assert.equal(report.k400.completion.verdict, 'INCOMPLETE');
  assert.equal(report.authorityBoundary.noRegistryWrites, true);
  assert.equal(report.authorityBoundary.promotion, 'NOT_AUTOMATIC');

  const framework = report.decisions.find(row => row.structureId === 'rcl.rule.authorized_transition');
  assert.equal(framework.sourceClassification, 'FRAMEWORK_CANDIDATE');
  assert.equal(framework.decision, 'RETAIN_AS_FRAMEWORK_CANDIDATE');
  assert.equal(framework.courtStatus, 'PASS_LOCAL');
  assert.equal(framework.structuralSuite.positive.passed, true);
  assert.equal(framework.structuralSuite.negative.passed, true);
  assert.equal(framework.structuralSuite.regression.passed, true);
  assert.equal(framework.structuralSuite.renameInvariance.passed, true);

  for (const structureId of [
    'rcl.facet.declaration',
    'rcl.authority.subject_warrant',
    'rcl.rule.foresee_realize',
  ]) {
    const row = report.decisions.find(item => item.structureId === structureId);
    assert.equal(row.sourceClassification, 'STD_CANDIDATE', structureId);
    assert.equal(row.decision, 'RETAIN_AS_STD_CANDIDATE', structureId);
    assert.equal(row.structuralSuite.negative.passed, true, structureId);
    assert.equal(row.structuralSuite.renameInvariance.passed, true, structureId);
  }
});

test('Integration Court preserves Pack, Example, RCL_GAP candidate and Auxiliary boundaries', () => {
  const report = runMotherStructureIntegrationCourt({ corpus: candidateCorpus(), k400Evidence: k400Evidence() });
  const expected = new Map([
    ['rcl.ui.view_tree', ['PACK', 'RETAIN_AS_PACK']],
    ['implementation.integrity_manifest', ['AUXILIARY_LANGUAGE_PROVIDER', 'RETAIN_AS_AUXILIARY_LANGUAGE_PROVIDER']],
    ['rcl.reckon.function_contract', ['EXAMPLE', 'RETAIN_AS_EXAMPLE']],
    ['rcl.gap.async_effect_protocol', ['RCL_GAP_CANDIDATE', 'HOLD_AS_RCL_GAP_CANDIDATE']],
  ]);
  for (const [structureId, [classification, decision]] of expected) {
    const row = report.decisions.find(item => item.structureId === structureId);
    assert.equal(row.sourceClassification, classification, structureId);
    assert.equal(row.decision, decision, structureId);
    assert.equal(row.courtStatus, 'PASS_LOCAL', structureId);
    assert.equal(row.formalRclGap.eligible, false, structureId);
  }
});

test('Integration Court catches a missing target instead of manufacturing a candidate', () => {
  const report = runMotherStructureIntegrationCourt({
    corpus: candidateCorpus(),
    targetStructureIds: ['rcl.rule.authorized_transition', 'rcl.unknown.target'],
  });
  const missing = report.decisions.find(row => row.structureId === 'rcl.unknown.target');
  assert.equal(missing.courtStatus, 'FAIL_LOCAL');
  assert.equal(missing.decision, 'HOLD_FAIL_CLOSED');
  assert.equal(report.verdict, 'HOLD_FAIL_CLOSED');
});

test('Integration Court keeps invalid K400 evidence separate from local structural evidence', () => {
  const report = runMotherStructureIntegrationCourt({
    corpus: candidateCorpus(),
    k400Evidence: { schema: 'wrong', generation: 'fixture', claims: [] },
  });
  assert.equal(report.k400.status, 'INVALID');
  assert.equal(report.k400.schemaValid, false);
  assert.equal(report.summary.localChecksPass, true);
  assert.equal(report.verdict, 'CANDIDATE_ONLY_HOLD');
  assert.equal(verifyMotherStructureIntegrationCourt(report).ok, true);
});

test('Integration Court does not mutate the input corpus', () => {
  const corpus = candidateCorpus();
  const before = JSON.stringify(corpus);
  runMotherStructureIntegrationCourt({ corpus, k400Evidence: k400Evidence() });
  assert.equal(JSON.stringify(corpus), before);
});
