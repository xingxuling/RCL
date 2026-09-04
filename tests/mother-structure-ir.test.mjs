import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MOTHER_STRUCTURE_CORPUS_FORMAT,
  MOTHER_STRUCTURE_IR_FORMAT,
  MOTHER_STRUCTURE_STATUS,
  buildMotherStructureCorpus,
  buildMotherStructureIR,
  buildMotherStructureIRFromSource,
  verifyMotherStructureCorpus,
  verifyMotherStructureIR,
} from '../src/index.mjs';

const hash = character => character.repeat(64);

function completeTransitionSource(name = 'MotherCandidate') {
  return `reality ${name} {
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
}

test('builds a candidate-only governed transition IR without leaking identifiers into the graph', () => {
  const source = completeTransitionSource();
  const ir = buildMotherStructureIRFromSource(source, {
    sourcePath: 'fixture/transition.rcl',
    sourceSha256: hash('a'),
    scope: 'K400',
  });
  const verification = verifyMotherStructureIR(ir);
  assert.equal(verification.ok, true, verification.errors.join('; '));
  assert.equal(ir.format, MOTHER_STRUCTURE_IR_FORMAT);
  assert.equal(ir.status, MOTHER_STRUCTURE_STATUS);

  const transition = ir.structures.find(row => row.structureId === 'rcl.rule.authorized_transition');
  assert.ok(transition);
  assert.equal(transition.slots.hasCause, true);
  assert.equal(transition.slots.needs, 1);
  assert.equal(transition.slots.alters, 1);
  assert.equal(transition.slots.preserves, 1);
  assert.equal(transition.slots.witnesses, 1);
  assert.deepEqual(
    transition.fingerprints.relationClasses,
    ['foresees', 'guarded_by', 'has_cause', 'has_effect', 'preserves', 'realizes', 'requires', 'scoped_to', 'targets', 'witnessed_by'].filter(value => value !== 'foresees' && value !== 'realizes'),
  );
  const graphText = JSON.stringify(transition.graph);
  assert.equal(graphText.includes('promote'), false);
  assert.equal(graphText.includes('founder'), false);
  assert.equal(graphText.includes('world'), false);
  assert.equal(ir.authorityBoundary.promotion, 'NOT_AUTOMATIC');
});

test('extracts facet, warrant, host, resonance, and paired foresee/realize structures', () => {
  const source = `reality MixedCandidate {
    facet signal.ready : Truth = true
    subject source {
      facet received : Number = 0
      warrant signal.read on signal while signal.ready == true
    }
    subject target { facet value : Number = 0 }
    host local { offers signal.read -> Number }
    resonance transfer {
      from source
      into target
      when signal.ready == true
      needs signal.read on signal
      alter target.value <- target.value + 1
      preserve target.value >= 0
      witness "resonance candidate"
    }
    foresee transfer
    realize transfer
  }`;
  const ir = buildMotherStructureIR(source, { sourcePath: 'fixture/mixed.rcl', scope: 'native-ui' });
  const ids = ir.structures.map(row => row.structureId);
  assert.equal(ids.filter(id => id === 'rcl.facet.declaration').length, 3);
  assert.equal(ids.includes('rcl.authority.subject_warrant'), true);
  assert.equal(ids.includes('rcl.provider.host_offer'), true);
  assert.equal(ids.includes('rcl.rule.authorized_transition'), true);
  assert.equal(ids.includes('rcl.rule.foresee_realize'), true);
  const warrant = ir.structures.find(row => row.structureId === 'rcl.authority.subject_warrant');
  assert.equal(warrant.slots.warrantCount, 1);
  assert.equal(warrant.slots.conditionalCount, 1);
});

test('keeps incomplete rules as transitions and records unresolved directives', () => {
  const ir = buildMotherStructureIR(`reality IncompleteCandidate {
    emergence draft { cause actor when true }
    foresee missing_rule
  }`, { sourcePath: 'fixture/incomplete.rcl', scope: 'K400' });
  assert.equal(ir.structures.some(row => row.structureId === 'rcl.rule.authorized_transition'), false);
  assert.equal(ir.structures.some(row => row.structureId === 'rcl.rule.transition'), true);
  assert.deepEqual(ir.coverage.unresolvedDirectives, [{ kind: 'Foresee' }]);
  assert.equal(ir.coverage.noAutomaticPromotion, true);
});

test('projects native UI semantics as bounded pack candidates', () => {
  const ir = buildMotherStructureIR(`reality UiCandidate {
    ui Shell {
      state count : Number = 0
      derived label : Text = "count" + count
      lifecycle { create restore count }
      navigation { initial home route home -> Home }
      adaptation { default compact profile compact min_width 0 max_width 599 }
      view Root {
        layout vertical { width fill height intrinsic gap 1 padding 1 align stretch distribute start }
        text Value { bind value <- label }
        action Increment {
          label "increment"
          on activate { set count <- count + 1 }
        }
      }
    }
  }`, { sourcePath: 'fixture/ui.rcl', scope: 'native-ui' });
  const ids = new Set(ir.structures.map(row => row.structureId));
  for (const id of [
    'rcl.ui.state_declaration',
    'rcl.ui.derived_state',
    'rcl.ui.view_tree',
    'rcl.ui.state_binding_event',
    'rcl.ui.lifecycle_restore',
    'rcl.ui.navigation_routes',
    'rcl.ui.device_adaptation',
  ]) assert.equal(ids.has(id), true, `missing ${id}`);
  assert.equal(ir.structures.find(row => row.structureId === 'rcl.ui.state_binding_event').slots.setStateCount, 1);
});

test('aggregates recurrence conservatively and emits DWAC-compatible candidate input', () => {
  const sources = [
    ['K400', 'a', 'k400-transition.rcl'],
    ['native-ui', 'b', 'native-transition.rcl'],
    ['package', 'c', 'package-transition.rcl'],
  ].map(([scope, character, sourcePath], index) => buildMotherStructureIR(completeTransitionSource(`Candidate${index}`), {
    sourcePath,
    sourceSha256: hash(character),
    scope,
  }));
  const corpus = buildMotherStructureCorpus(sources);
  const verification = verifyMotherStructureCorpus(corpus);
  assert.equal(verification.ok, true, verification.errors.join('; '));
  assert.equal(corpus.format, MOTHER_STRUCTURE_CORPUS_FORMAT);
  const framework = corpus.structures.find(row => row.structureId === 'rcl.rule.authorized_transition');
  assert.equal(framework.recurrence.occurrenceCount, 3);
  assert.equal(framework.recurrence.scopeCount, 3);
  assert.equal(framework.classification, 'FRAMEWORK_CANDIDATE');
  assert.equal(framework.promotion, 'NOT_AUTOMATIC');
  const standard = corpus.structures.find(row => row.structureId === 'rcl.facet.declaration');
  assert.equal(standard.classification, 'STD_CANDIDATE');
  assert.equal(corpus.dwacInput.length, corpus.summary.observationCount);
  assert.equal(corpus.dwacInput[0].system_id.startsWith('mother.'), true);
  assert.equal(corpus.dwacInput[0].source.canonical_status, 'CANDIDATE');
  assert.equal(corpus.dwacInput[0].relations[0].claim_kind, 'SOURCE_ASSERTION');
  assert.equal(corpus.authorityBoundary.finalDecision, 'NOT_DECIDED');
});

test('excludes candidate/evidence lineage from independent recurrence', () => {
  const primary = buildMotherStructureIR(completeTransitionSource('Primary'), {
    sourcePath: 'primary.rcl', sourceSha256: hash('p'), scope: 'K400', lineage: 'primary-or-example-source',
  });
  const repairOne = buildMotherStructureIR(completeTransitionSource('RepairOne'), {
    sourcePath: 'evidence/repair-1.rcl', sourceSha256: hash('1'), scope: 'K400', lineage: 'candidate-or-evidence-lineage',
  });
  const repairTwo = buildMotherStructureIR(completeTransitionSource('RepairTwo'), {
    sourcePath: 'evidence/repair-2.rcl', sourceSha256: hash('2'), scope: 'native-ui', lineage: 'candidate-or-evidence-lineage',
  });
  const corpus = buildMotherStructureCorpus([primary, repairOne, repairTwo]);
  const row = corpus.structures.find(item => item.structureId === 'rcl.rule.authorized_transition');
  assert.equal(row.recurrence.occurrenceCount, 3);
  assert.equal(row.recurrence.uniqueSourceCount, 3);
  assert.equal(row.recurrence.independentSourceCount, 1);
  assert.equal(row.recurrence.scopeCount, 2);
  assert.equal(row.classification, 'EXAMPLE');
});

test('is deterministic and rejects malformed or promoted inputs', () => {
  const options = { sourcePath: 'fixture/deterministic.rcl', sourceSha256: hash('d'), scope: 'K400' };
  const first = buildMotherStructureIR(completeTransitionSource('Deterministic'), options);
  const second = buildMotherStructureIR(completeTransitionSource('Deterministic'), options);
  assert.deepEqual(first, second);
  assert.throws(() => buildMotherStructureIR({ kind: 'RealityProgram', name: 'MissingBody' }), /body array/);
  const promoted = { ...first, status: 'FRAMEWORK' };
  assert.equal(verifyMotherStructureIR(promoted).ok, false);
});

test('keeps an explicitly marked gap as a candidate without asserting a formal RCL_GAP', () => {
  const corpus = buildMotherStructureCorpus([{
    structureId: 'rcl.gap.async_effect_protocol',
    status: MOTHER_STRUCTURE_STATUS,
    gapCandidate: true,
    graph: {
      symbols: [{ id: 'gap', label: 'missing_capability', classes: ['candidate'] }],
      relations: [],
    },
    sourcePath: 'fixture/gap.rcl',
    sourceSha256: hash('g'),
    scope: 'K400',
  }]);
  const row = corpus.structures[0];
  assert.equal(row.classification, 'RCL_GAP_CANDIDATE');
  assert.equal(row.promotion, 'NOT_ELIGIBLE');
  assert.equal(row.formalRclGap.eligible, false);
});
