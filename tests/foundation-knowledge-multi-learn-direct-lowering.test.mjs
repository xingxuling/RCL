import assert from 'node:assert/strict';
import test from 'node:test';
import { compileReality } from '../src/compiler.mjs';
import { lowerDeclaredKnowledgeToCore } from '../src/foundation-knowledge-direct-lowering.mjs';
import { tryCompileFoundationRealityToBytecode } from '../src/foundation-direct-bytecode.mjs';

const source = [
  'reality KnowledgeBoundedMultiLearn {',
  '  facet world.signal : Truth = true',
  '  facet world.score : Number = 7',
  '  facet world.label : Text = "ready"',
  '  facet decision.allowed : Truth = false',
  '  facet decision.label : Text = "unset"',
  '  subject actor { }',
  '  knowledge mind {',
  '    claim trusted : Truth = world.signal confidence 0.90 evidence "sensor:signal-v1" source "sensor:signal"',
  '    claim score : Number = world.score confidence 0.80 evidence "sensor:score-v1" source "sensor:score"',
  '  }',
  '  knowledge context {',
  '    claim label : Text = world.label confidence 0.85 evidence "sensor:label-v1" source "sensor:label"',
  '  }',
  '  emergence apply_knowledge {',
  '    cause actor',
  '    when known(mind.trusted, 0.80)',
  '    alter decision.allowed <- belief(mind.trusted)',
  '    alter decision.label <- belief(context.label)',
  '  }',
  '  learn mind',
  '  learn context',
  '  realize apply_knowledge',
  '}',
  '',
].join('\n');

const duplicateLearnSource = source.replace('  learn context\n', '  learn mind\n');
const threeLearnSource = source
  .replace(
    '  emergence apply_knowledge {',
    [
      '  knowledge extra {',
      '    claim flag : Truth = world.signal confidence 0.70 evidence "sensor:extra-v1" source "sensor:extra"',
      '  }',
      '  emergence apply_knowledge {',
    ].join('\n'),
  )
  .replace('  realize apply_knowledge\n', '  learn extra\n  realize apply_knowledge\n');

function assertSha256(value) {
  assert.match(value, /^[0-9a-f]{64}$/);
}

test('two distinct leading Learn directives lower into two ordered atomic native transactions', () => {
  const program = compileReality(source);
  const result = lowerDeclaredKnowledgeToCore(program);

  assert.equal(result.summary.knowledgeLoweredDeclarationCount, 2);
  assert.equal(result.summary.consumedDirectiveCount, 2);
  assert.equal(result.summary.syntheticRuleCount, 2);
  assert.equal(result.summary.nativeKnowledgeRecordCount, 3);
  assert.equal(result.summary.remainingKnowledgeCount, 0);
  assert.equal(result.truthBoundary.boundedContiguousMultiLearnKnowledgeSubsetOnly, true);
  assert.equal(result.truthBoundary.maxBoundedLearnDirectiveCount, 2);
  assert.equal(result.truthBoundary.multipleLearnDirectivesRemainSeparateOrderedAtomicTransactions, true);
  assert.deepEqual(result.lowered.map(item => item.directiveIndex), [0, 1]);
  assert.deepEqual(result.lowered.map(item => item.declaration), ['mind', 'context']);
  assert.deepEqual(result.lowered[0].stateTargets, ['mind.trusted', 'mind.score']);
  assert.deepEqual(result.lowered[1].stateTargets, ['context.label']);
  assert.equal(result.program.directives[0].kind, 'Realize');
  assert.equal(result.program.directives[1].kind, 'Realize');
  assert.equal(result.program.directives[2].rule, 'apply_knowledge');

  const roots = result.lowered.flatMap(item => item.formedAtRoots.map(entry => entry.root));
  assert.equal(roots.length, 3);
  roots.forEach(assertSha256);
  assert.equal(new Set(roots).size, 3);
});

test('bounded multi-Learn reaches generic native bytecode with ordered first-write omission evidence', () => {
  const compiled = tryCompileFoundationRealityToBytecode(source);
  assert.equal(compiled.ok, true, JSON.stringify(compiled.diagnostics));
  assert.equal(compiled.foundationKnowledgeDirectLowering.summary.knowledgeLoweredDeclarationCount, 2);
  assert.deepEqual(
    compiled.foundationKnowledgeNativeInitialization.omittedInitialFacetPaths,
    ['mind.trusted', 'mind.score', 'context.label'],
  );
  assert.equal(compiled.foundationKnowledgeNativeInitialization.firstWriteRules.length, 2);
  assert.equal(compiled.foundationKnowledgeNativeInitialization.truthBoundary.maxBoundedLearnDirectiveCount, 2);
  assert.equal(
    compiled.foundationKnowledgeNativeInitialization.truthBoundary.omittedFacetsAreCreatedByOrderedLeadingNativeTransactions,
    true,
  );
});

test('duplicate Learn declarations fail closed instead of replaying the same declaration twice', () => {
  const program = compileReality(duplicateLearnSource);
  const result = lowerDeclaredKnowledgeToCore(program);
  assert.equal(result.summary.knowledgeLoweredDeclarationCount, 0);
  assert.ok(result.diagnostics.some(item => item.code === 'RCL_FOUNDATION_KNOWLEDGE_DIRECT_LOWERING_PROVIDER_REQUIRED'));
  const compiled = tryCompileFoundationRealityToBytecode(program);
  assert.equal(compiled.ok, false);
});

test('three Learn directives exceed the bounded autonomy surface and stay Provider-bound', () => {
  const program = compileReality(threeLearnSource);
  const result = lowerDeclaredKnowledgeToCore(program);
  assert.equal(result.summary.knowledgeLoweredDeclarationCount, 0);
  assert.equal(result.truthBoundary.maxBoundedLearnDirectiveCount, 2);
  assert.ok(result.diagnostics.some(item => item.code === 'RCL_FOUNDATION_KNOWLEDGE_DIRECT_LOWERING_PROVIDER_REQUIRED'));
  const compiled = tryCompileFoundationRealityToBytecode(program);
  assert.equal(compiled.ok, false);
});
