import assert from 'node:assert/strict';
import test from 'node:test';
import { compileReality } from '../src/compiler.mjs';
import { runReality } from '../src/runtime.mjs';
import { lowerDeclaredKnowledgeToCore } from '../src/foundation-knowledge-derived-direct-lowering.mjs';
import { tryCompileFoundationRealityToBytecode } from '../src/foundation-direct-bytecode.mjs';
import { verifyFoundationKnowledgeReceiptParity } from '../src/foundation-knowledge-native-parity.mjs';

const source = [
  'reality KnowledgeDerivedDependencyDirect {',
  '  facet world.signal : Truth = true',
  '  facet world.score : Number = 7',
  '  facet decision.ready : Truth = false',
  '  subject actor { }',
  '  knowledge mind {',
  '    claim trusted : Truth = world.signal confidence 0.80 evidence "sensor:signal-v1" source "sensor:signal"',
  '    claim score : Number = world.score confidence 0.60 evidence "sensor:score-v1" source "sensor:score"',
  '    derive ready : Truth = world.signal confidence 0.90 evidence "rule:ready-v1" from mind.trusted, mind.score',
  '  }',
  '  emergence apply_knowledge {',
  '    cause actor',
  '    when known(mind.ready, 0.50)',
  '    alter decision.ready <- belief(mind.ready)',
  '  }',
  '  learn mind',
  '  realize apply_knowledge',
  '}',
  '',
].join('\n');

function fields(record) {
  return Object.fromEntries(record.fields.map(item => [item.name, item.value]));
}

function sequenceText(expr) {
  const values = [];
  let current = expr;
  while (current?.kind === 'CallExpr' && current.name === 'sequence_append') {
    values.unshift(current.args[1].value);
    current = current.args[0];
  }
  assert.equal(current?.kind, 'CallExpr');
  assert.equal(current?.name, 'empty_sequence');
  return values;
}

test('bounded derived Knowledge dependencies lower into the same atomic leading Learn transaction', () => {
  const program = compileReality(source);
  const result = lowerDeclaredKnowledgeToCore(program);
  assert.equal(result.summary.knowledgeLoweredDeclarationCount, 1);
  assert.equal(result.summary.nativeKnowledgeRecordCount, 3);
  assert.equal(result.summary.boundedDerivedKnowledgeCount, 1);
  assert.equal(result.truthBoundary.boundedDerivedKnowledgeDependencySubsetNativeClaimed, true);
  assert.equal(result.truthBoundary.revisionsAndDecayRemainProviderBound, true);
  assert.equal(result.truthBoundary.providerBridgeRemovedGlobally, false);

  const item = result.lowered[0];
  assert.equal(item.claimCount, 3);
  assert.equal(item.primitiveClaimCount, 2);
  assert.equal(item.derivedKnowledgeCount, 1);
  assert.equal(item.dependencyEdgeCount, 2);
  assert.deepEqual(item.stateTargets, ['mind.trusted', 'mind.score', 'mind.ready']);
  assert.deepEqual(item.primitiveClaimPaths, ['mind.trusted', 'mind.score']);
  assert.deepEqual(item.derivedKnowledgePaths, ['mind.ready']);
  assert.equal(item.formedAtRoots.length, 3);
  assert.equal(new Set(item.formedAtRoots.map(entry => entry.root)).size, 3);

  const readyFacet = result.program.facets.find(item => item.path === 'mind.ready');
  assert.ok(readyFacet);
  assert.equal(readyFacet.deferred, false);
  const ready = fields(readyFacet.value);
  assert.equal(ready.value.value, true);
  assert.equal(ready.confidence.value, 0.6);
  assert.equal(ready.source.value, 'rcl:inference');
  assert.equal(ready.status.value, 'derived');
  assert.deepEqual(sequenceText(ready.evidence), ['rule:ready-v1', 'sensor:signal-v1', 'sensor:score-v1']);
  assert.deepEqual(sequenceText(ready.dependencies), ['mind.trusted', 'mind.score']);
  assert.equal(ready.revision.value, 1);
});

test('bounded derived dependency path reaches canonical generic native bytecode and keeps all first-write targets out of initial native state', () => {
  const compiled = tryCompileFoundationRealityToBytecode(source);
  assert.equal(compiled.ok, true, JSON.stringify(compiled.diagnostics));
  assert.ok(compiled.bytecode);
  assert.deepEqual(
    compiled.foundationKnowledgeNativeInitialization.omittedInitialFacetPaths,
    ['mind.trusted', 'mind.score', 'mind.ready'],
  );
  assert.equal(compiled.foundationKnowledgeDirectLowering.summary.boundedDerivedKnowledgeCount, 1);
  assert.equal(compiled.foundationKnowledgeDirectLowering.truthBoundary.boundedDerivedKnowledgeDependencySubsetNativeClaimed, true);
});

test('existing receipt-parity contract covers bounded derived Knowledge metadata and fails closed on drift', async () => {
  const program = compileReality(source);
  const compiled = tryCompileFoundationRealityToBytecode(program);
  assert.equal(compiled.ok, true, JSON.stringify(compiled.diagnostics));
  const reference = await runReality(program);
  const item = compiled.foundationKnowledgeDirectLowering.lowered[0];
  const referenceReceipt = reference.history.find(record => (
    record?.kind === 'DomainTransition'
    && record?.domainKind === 'knowledge'
    && record?.name === item.declaration
  ));
  assert.ok(referenceReceipt);
  const nativeReceipt = {
    ...structuredClone(referenceReceipt),
    rule: item.syntheticRule,
    witnesses: [...(referenceReceipt.witnesses ?? []), item.witness],
  };
  const report = verifyFoundationKnowledgeReceiptParity(
    compiled.foundationKnowledgeDirectLowering,
    [referenceReceipt],
    [nativeReceipt],
  );
  assert.equal(report.ok, true, JSON.stringify(report, null, 2));

  const mutated = structuredClone(nativeReceipt);
  const readyChange = mutated.changes.find(change => change.target === 'mind.ready');
  readyChange.after.confidence = 0.9;
  const drift = verifyFoundationKnowledgeReceiptParity(
    compiled.foundationKnowledgeDirectLowering,
    [referenceReceipt],
    [mutated],
  );
  assert.equal(drift.ok, false);
  assert.equal(drift.entries[0].checks.transitionValuesEquivalent, false);
});

test('dynamic derived expressions stay provider-bound and fail closed instead of over-claiming native coverage', () => {
  const unsupported = source.replace(
    'derive ready : Truth = world.signal confidence 0.90 evidence "rule:ready-v1" from mind.trusted, mind.score',
    'derive ready : Truth = belief(mind.trusted) confidence 0.90 evidence "rule:ready-v1" from mind.trusted, mind.score',
  );
  const program = compileReality(unsupported);
  const lowered = lowerDeclaredKnowledgeToCore(program);
  assert.equal(lowered.summary.knowledgeLoweredDeclarationCount, 0);
  assert.equal(lowered.truthBoundary.boundedDerivedKnowledgeDependencySubsetNativeClaimed ?? false, false);
  assert.ok(lowered.diagnostics.some(item => item.code === 'RCL_FOUNDATION_KNOWLEDGE_DIRECT_LOWERING_PROVIDER_REQUIRED'));
  const compiled = tryCompileFoundationRealityToBytecode(program);
  assert.equal(compiled.ok, false);
});
