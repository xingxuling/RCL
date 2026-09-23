import assert from 'node:assert/strict';
import test from 'node:test';
import { compileReality } from '../src/compiler.mjs';
import { runReality } from '../src/runtime.mjs';
import { lowerDeclaredKnowledgeToCore } from '../src/foundation-knowledge-revision-direct-lowering.mjs';
import { tryCompileFoundationRealityToBytecode } from '../src/foundation-direct-bytecode.mjs';
import { verifyFoundationKnowledgeReceiptParity } from '../src/foundation-knowledge-native-parity.mjs';

const source = [
  'reality KnowledgeReinforcementRevisionDirect {',
  '  facet world.route : Text = "left"',
  '  facet decision.route : Text = "unknown"',
  '  subject actor { }',
  '  knowledge mind {',
  '    claim route : Text = world.route confidence 0.60 evidence "map:old" source "old-map"',
  '  }',
  '  knowledge refresh {',
  '    revise mind.route <- world.route confidence 0.50 evidence "sensor:fresh" source "fresh-map"',
  '  }',
  '  emergence use_route {',
  '    cause actor',
  '    when supported(mind.route, 0.79)',
  '    alter decision.route <- belief(mind.route)',
  '  }',
  '  learn mind',
  '  learn refresh',
  '  realize use_route',
  '}',
  '',
].join('\n');

test('bounded same-value reinforcement revision lowers as two ordered atomic Knowledge transactions', () => {
  const program = compileReality(source);
  const result = lowerDeclaredKnowledgeToCore(program);

  assert.equal(result.summary.knowledgeLoweredDeclarationCount, 2);
  assert.equal(result.summary.consumedDirectiveCount, 2);
  assert.equal(result.summary.boundedKnowledgeRevisionCount, 1);
  assert.equal(result.summary.boundedSameValueReinforcementRevisionCount, 1);
  assert.equal(result.truthBoundary.boundedSameValueReinforcementRevisionSubsetNativeClaimed, true);
  assert.equal(result.truthBoundary.contradictoryRevisionAlternativesRemainProviderBound, true);
  assert.equal(result.truthBoundary.decayRemainsProviderBound, true);
  assert.equal(result.truthBoundary.providerBridgeRemovedGlobally, false);

  assert.equal(result.lowered.length, 2);
  assert.equal(result.lowered[0].knowledgeMutationMode, 'claim-first-write');
  assert.equal(result.lowered[1].knowledgeMutationMode, 'revision-existing-target');
  assert.equal(result.lowered[1].revisionSemantics, 'same-value-reinforcement');
  assert.deepEqual(result.lowered[0].stateTargets, ['mind.route']);
  assert.deepEqual(result.lowered[1].stateTargets, ['mind.route']);
  assert.notEqual(result.lowered[0].formedAtRoot, result.lowered[1].formedAtRoot);

  assert.equal(result.program.directives[0].kind, 'Realize');
  assert.equal(result.program.directives[1].kind, 'Realize');
  assert.equal(result.program.directives[0].rule, result.lowered[0].syntheticRule);
  assert.equal(result.program.directives[1].rule, result.lowered[1].syntheticRule);
});

test('bounded reinforcement revision reaches canonical direct bytecode while omitting the target only once from native initial state', () => {
  const compiled = tryCompileFoundationRealityToBytecode(source);
  assert.equal(compiled.ok, true, JSON.stringify(compiled.diagnostics));
  assert.ok(compiled.bytecode);
  assert.equal(compiled.foundationKnowledgeDirectLowering.summary.boundedKnowledgeRevisionCount, 1);
  assert.equal(compiled.foundationKnowledgeDirectLowering.truthBoundary.boundedSameValueReinforcementRevisionSubsetNativeClaimed, true);
  assert.deepEqual(compiled.foundationKnowledgeNativeInitialization.omittedInitialFacetPaths, ['mind.route']);
  assert.equal(compiled.foundationKnowledgeNativeInitialization.firstWriteRules.length, 2);
  assert.equal(
    compiled.foundationKnowledgeNativeInitialization.truthBoundary.repeatedKnowledgeTargetAllowedOnlyForOrderedRevisionExistingTarget,
    true,
  );
  assert.equal(
    compiled.foundationKnowledgeNativeInitialization.truthBoundary.orderedRevisionExistingTargetCount,
    1,
  );
});

test('receipt parity remains exact across the claim transaction and the later reinforcement revision transaction', async () => {
  const program = compileReality(source);
  const lowering = lowerDeclaredKnowledgeToCore(program);
  const reference = await runReality(program);
  const referenceKnowledge = reference.history.filter(record => (
    record?.kind === 'DomainTransition' && record?.domainKind === 'knowledge'
  ));
  assert.equal(referenceKnowledge.length, 2);

  const nativeLike = referenceKnowledge.map((record, index) => ({
    ...structuredClone(record),
    rule: lowering.lowered[index].syntheticRule,
    witnesses: [...(record.witnesses ?? []), lowering.lowered[index].witness],
  }));
  const report = verifyFoundationKnowledgeReceiptParity(
    lowering,
    referenceKnowledge,
    nativeLike,
  );
  assert.equal(report.ok, true, JSON.stringify(report, null, 2));
  assert.equal(report.entries.length, 2);
  assert.equal(report.entries[0].checks.transitionValuesEquivalent, true);
  assert.equal(report.entries[1].checks.transitionValuesEquivalent, true);
  assert.equal(report.entries[1].checks.boundaryRootsEquivalent, true);

  const drifted = structuredClone(nativeLike);
  drifted[1].changes[0].after.confidence = 0.9;
  const negative = verifyFoundationKnowledgeReceiptParity(
    lowering,
    referenceKnowledge,
    drifted,
  );
  assert.equal(negative.ok, false);
  assert.equal(negative.entries[1].checks.transitionValuesEquivalent, false);
});

test('reinforcement result matches Reference Runtime revision semantics exactly', async () => {
  const result = await runReality(source);
  const route = result.state['mind.route'];
  assert.equal(route.value, 'left');
  assert.ok(Math.abs(route.confidence - 0.8) < 1e-12);
  assert.deepEqual(route.evidence, ['map:old', 'sensor:fresh']);
  assert.equal(route.source, 'fresh-map');
  assert.equal(route.status, 'reinforced');
  assert.equal(route.revision, 2);
  assert.deepEqual(route.alternatives, []);
  assert.equal(result.state['decision.route'], 'left');
});

test('contradictory revisions stay provider-bound rather than laundering alternative-history semantics into the bounded slice', () => {
  const contradictory = source.replace(
    'revise mind.route <- world.route confidence 0.50 evidence "sensor:fresh" source "fresh-map"',
    'revise mind.route <- "right" confidence 0.90 evidence "sensor:fresh" source "fresh-map"',
  );
  const program = compileReality(contradictory);
  const lowered = lowerDeclaredKnowledgeToCore(program);
  assert.equal(lowered.summary.knowledgeLoweredDeclarationCount, 0);
  assert.equal(lowered.truthBoundary.boundedSameValueReinforcementRevisionSubsetNativeClaimed ?? false, false);
  const compiled = tryCompileFoundationRealityToBytecode(program);
  assert.equal(compiled.ok, false);
});

test('same-declaration claim plus revision stays provider-bound because it cannot preserve one-Learn-one-atomic-receipt parity yet', () => {
  const inline = [
    'reality InlineRevisionProviderBound {',
    '  facet world.route : Text = "left"',
    '  knowledge mind {',
    '    claim route : Text = world.route confidence 0.60 evidence "map:old" source "old-map"',
    '    revise mind.route <- world.route confidence 0.50 evidence "sensor:fresh" source "fresh-map"',
    '  }',
    '  learn mind',
    '}',
    '',
  ].join('\n');
  const program = compileReality(inline);
  const lowered = lowerDeclaredKnowledgeToCore(program);
  assert.equal(lowered.summary.knowledgeLoweredDeclarationCount, 0);
  const compiled = tryCompileFoundationRealityToBytecode(program);
  assert.equal(compiled.ok, false);
});
