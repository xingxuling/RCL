import assert from 'node:assert/strict';
import test from 'node:test';
import { compileReality } from '../src/compiler.mjs';
import { lowerDeclaredKnowledgeToCore } from '../src/foundation-knowledge-direct-lowering.mjs';
import { tryCompileFoundationRealityToBytecode } from '../src/foundation-direct-bytecode.mjs';

const fourClaimSource = [
  'reality KnowledgeMaxBoundary {',
  '  facet world.signal : Truth = true',
  '  facet world.score : Number = 7',
  '  facet world.label : Text = "alpha"',
  '  facet world.rank : Number = 3',
  '  subject actor { }',
  '  knowledge mind {',
  '    claim trusted : Truth = world.signal confidence 0.90 evidence "sensor:signal-v1" source "sensor:signal"',
  '    claim score : Number = world.score confidence 0.80 evidence "sensor:score-v1" source "sensor:score"',
  '    claim label : Text = world.label confidence 0.70 evidence "sensor:label-v1" source "sensor:label"',
  '    claim rank : Number = world.rank confidence 0.60 evidence "sensor:rank-v1" source "sensor:rank"',
  '  }',
  '  learn mind',
  '}',
  '',
].join('\n');

const fiveClaimSource = [
  'reality KnowledgeOverBoundary {',
  '  facet world.signal : Truth = true',
  '  facet world.score : Number = 7',
  '  facet world.label : Text = "alpha"',
  '  facet world.rank : Number = 3',
  '  facet world.extra : Number = 9',
  '  subject actor { }',
  '  knowledge mind {',
  '    claim trusted : Truth = world.signal confidence 0.90 evidence "sensor:signal-v1" source "sensor:signal"',
  '    claim score : Number = world.score confidence 0.80 evidence "sensor:score-v1" source "sensor:score"',
  '    claim label : Text = world.label confidence 0.70 evidence "sensor:label-v1" source "sensor:label"',
  '    claim rank : Number = world.rank confidence 0.60 evidence "sensor:rank-v1" source "sensor:rank"',
  '    claim extra : Number = world.extra confidence 0.50 evidence "sensor:extra-v1" source "sensor:extra"',
  '  }',
  '  learn mind',
  '}',
  '',
].join('\n');

test('Knowledge direct lowering reaches the declared four-claim maximum as one atomic synthetic transaction', () => {
  const program = compileReality(fourClaimSource);
  const result = lowerDeclaredKnowledgeToCore(program);
  assert.equal(result.summary.knowledgeLoweredDeclarationCount, 1);
  assert.equal(result.summary.consumedDirectiveCount, 1);
  assert.equal(result.summary.syntheticRuleCount, 1);
  assert.equal(result.summary.nativeKnowledgeRecordCount, 4);
  assert.equal(result.lowered.length, 1);
  assert.equal(result.lowered[0].claimCount, 4);
  assert.deepEqual(result.lowered[0].claimPaths, ['mind.trusted', 'mind.score', 'mind.label', 'mind.rank']);
  assert.equal(result.lowered[0].formedAtRoots.length, 4);
  const roots = result.lowered[0].formedAtRoots.map(item => item.root);
  assert.equal(new Set(roots).size, 4);
  assert.equal(result.truthBoundary.maxBoundedClaimCount, 4);
  assert.equal(result.truthBoundary.oneLearnDirectiveMapsToOneAtomicSyntheticTransaction, true);

  const compiled = tryCompileFoundationRealityToBytecode(program);
  assert.equal(compiled.ok, true, JSON.stringify(compiled.diagnostics));
  assert.ok(compiled.bytecode);
  assert.equal(compiled.foundationKnowledgeDirectLowering.summary.nativeKnowledgeRecordCount, 4);
  assert.deepEqual(
    compiled.foundationKnowledgeNativeInitialization.omittedInitialFacetPaths,
    ['mind.trusted', 'mind.score', 'mind.label', 'mind.rank'],
  );
});

test('Knowledge direct lowering fails closed beyond the declared four-claim maximum', () => {
  const program = compileReality(fiveClaimSource);
  const result = lowerDeclaredKnowledgeToCore(program);
  assert.equal(result.summary.knowledgeLoweredDeclarationCount, 0);
  assert.equal(result.summary.nativeKnowledgeRecordCount, 0);
  assert.equal(result.summary.remainingKnowledgeCount, 1);
  assert.ok(result.diagnostics.some(item => item.code === 'RCL_FOUNDATION_KNOWLEDGE_DIRECT_LOWERING_PROVIDER_REQUIRED'));

  const compiled = tryCompileFoundationRealityToBytecode(program);
  assert.equal(compiled.ok, false);
  assert.ok(compiled.diagnostics.some(item => item.code === 'RCL_NATIVE_DOMAIN_PROVIDER_REQUIRED' || item.code === 'RCL_NATIVE_FACET_UNSUPPORTED'));
});
