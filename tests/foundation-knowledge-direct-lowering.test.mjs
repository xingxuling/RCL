import assert from 'node:assert/strict';
import test from 'node:test';
import { compileReality } from '../src/compiler.mjs';
import { realityRoot } from '../src/canonical.mjs';
import { lowerDeclaredKnowledgeToCore } from '../src/foundation-knowledge-direct-lowering.mjs';
import { tryCompileFoundationRealityToBytecode } from '../src/foundation-direct-bytecode.mjs';

const source = [
  'reality KnowledgeDeclaredDirect {',
  '  facet world.signal : Truth = true',
  '  facet world.score : Number = 7',
  '  facet decision.allowed : Truth = false',
  '  facet decision.score : Number = 0',
  '  subject actor { }',
  '  knowledge mind {',
  '    claim trusted : Truth = world.signal confidence 0.90 evidence "sensor:signal-v1" source "sensor:signal"',
  '    claim score : Number = world.score confidence 0.80 evidence "sensor:score-v1" source "sensor:score"',
  '  }',
  '  emergence apply_knowledge {',
  '    cause actor',
  '    when known(mind.trusted, 0.80)',
  '    alter decision.allowed <- belief(mind.trusted)',
  '    alter decision.score <- belief(mind.score)',
  '  }',
  '  learn mind',
  '  realize apply_knowledge',
  '}',
  '',
].join('\n');

function fields(record) {
  return Object.fromEntries(record.fields.map(item => [item.name, item.value]));
}

test('Learn consumes a bounded primitive claim set into one deterministic atomic core transaction', () => {
  const program = compileReality(source);
  const result = lowerDeclaredKnowledgeToCore(program);
  assert.equal(result.summary.knowledgeLoweredDeclarationCount, 1);
  assert.equal(result.summary.consumedDirectiveCount, 1);
  assert.equal(result.summary.syntheticRuleCount, 1);
  assert.equal(result.summary.remainingKnowledgeCount, 0);
  assert.equal(result.summary.nativeKnowledgeRecordCount, 2);
  assert.equal(result.program.knowledges.length, 0);
  assert.equal(result.program.directives[0].kind, 'Realize');
  assert.equal(result.program.directives[1].rule, 'apply_knowledge');
  assert.equal(result.lowered[0].domain, 'knowledge');
  assert.equal(result.lowered[0].claimCount, 2);
  assert.deepEqual(result.lowered[0].claimPaths, ['mind.trusted', 'mind.score']);
  assert.deepEqual(result.lowered[0].stateTargets, ['mind.trusted', 'mind.score']);
  assert.equal(result.lowered[0].formedAtRoots.length, 2);
  const synthetic = result.program.rules.find(item => item.name === result.lowered[0].syntheticRule);
  assert.deepEqual(synthetic.alters.map(item => item.target), ['mind.trusted', 'mind.score']);
});

test('bounded multi-claim Knowledge records retain the exact sequential reference formedAtRoot for each claim', () => {
  const program = compileReality(source);
  const result = lowerDeclaredKnowledgeToCore(program);
  const initialRoot = realityRoot({
    'world.signal': true,
    'world.score': 7,
    'decision.allowed': false,
    'decision.score': 0,
  });
  const roots = Object.fromEntries(result.lowered[0].formedAtRoots.map(item => [item.path, item.root]));
  assert.equal(roots['mind.trusted'], initialRoot);
  assert.match(roots['mind.score'], /^[0-9a-f]{64}$/);
  assert.notEqual(roots['mind.score'], initialRoot);

  const trustedFacet = result.program.facets.find(item => item.path === 'mind.trusted');
  const scoreFacet = result.program.facets.find(item => item.path === 'mind.score');
  for (const knowledgeFacet of [trustedFacet, scoreFacet]) {
    assert.equal(knowledgeFacet.deferred, false);
    assert.equal(knowledgeFacet.value.kind, 'RecordConstructExpr');
    assert.equal(knowledgeFacet.value.canonicalType, 'taowind.rcl.native.Knowledge.v0.1');
    const record = fields(knowledgeFacet.value);
    assert.equal(record.kind.value, 'Knowledge');
    assert.equal(record.scope.value, 'local');
    assert.equal(record.status.value, 'provisional');
    assert.equal(record.revision.value, 1);
    assert.equal(record.formedAtRoot.value, roots[knowledgeFacet.path]);
    assert.equal(record.evidence.name, 'sequence_append');
    assert.equal(record.dependencies.name, 'empty_sequence');
    assert.equal(record.alternatives.name, 'empty_sequence');
  }
  assert.equal(fields(trustedFacet.value).baseType.value, 'Truth');
  assert.equal(fields(trustedFacet.value).confidence.value, 0.9);
  assert.equal(fields(trustedFacet.value).source.value, 'sensor:signal');
  assert.equal(fields(scoreFacet.value).baseType.value, 'Number');
  assert.equal(fields(scoreFacet.value).confidence.value, 0.8);
  assert.equal(fields(scoreFacet.value).source.value, 'sensor:score');
});

test('Knowledge observability builtins are lowered across multiple knowledge paths to generic typed-record operations', () => {
  const program = compileReality(source);
  const result = lowerDeclaredKnowledgeToCore(program);
  const apply = result.program.rules.find(item => item.name === 'apply_knowledge');
  assert.equal(apply.when.kind, 'BinaryExpr');
  assert.equal(apply.when.operator, 'and');
  assert.equal(apply.alters[0].expression.kind, 'FieldAccessExpr');
  assert.equal(apply.alters[0].expression.field, 'value');
  assert.equal(apply.alters[1].expression.kind, 'FieldAccessExpr');
  assert.equal(apply.alters[1].expression.field, 'value');
});

test('declared bounded multi-claim Knowledge reaches canonical generic native bytecode without requiring the Provider bridge', () => {
  const compiled = tryCompileFoundationRealityToBytecode(source);
  assert.equal(compiled.ok, true, JSON.stringify(compiled.diagnostics));
  assert.ok(compiled.bytecode);
  assert.equal(compiled.foundationKnowledgeDirectLowering.summary.knowledgeLoweredDeclarationCount, 1);
  assert.equal(compiled.foundationKnowledgeDirectLowering.summary.nativeKnowledgeRecordCount, 2);
  assert.equal(compiled.foundationKnowledgeDirectLowering.truthBoundary.boundedPrimitiveMultiClaimKnowledgeSubsetOnly, true);
  assert.equal(compiled.foundationKnowledgeDirectLowering.truthBoundary.maxBoundedClaimCount, 4);
  assert.equal(compiled.foundationKnowledgeDirectLowering.truthBoundary.referenceSequentialClaimFormationRootsMustBePreserved, true);
  assert.equal(compiled.foundationKnowledgeDirectLowering.truthBoundary.providerBridgeRemovedGlobally, false);
  assert.deepEqual(compiled.foundationKnowledgeNativeInitialization.omittedInitialFacetPaths, ['mind.trusted', 'mind.score']);
});

test('multi-Learn Knowledge stays visible and fails closed to the Provider path', () => {
  const unsupported = `${source.replace('  realize apply_knowledge\n', '  learn mind\n  realize apply_knowledge\n')}`;
  const program = compileReality(unsupported);
  const result = lowerDeclaredKnowledgeToCore(program);
  assert.equal(result.summary.knowledgeLoweredDeclarationCount, 0);
  assert.equal(result.summary.remainingKnowledgeCount, 1);
  assert.ok(result.diagnostics.some(item => item.code === 'RCL_FOUNDATION_KNOWLEDGE_DIRECT_LOWERING_PROVIDER_REQUIRED'));
  const compiled = tryCompileFoundationRealityToBytecode(program);
  assert.equal(compiled.ok, false);
  assert.ok(compiled.diagnostics.some(item => item.code === 'RCL_NATIVE_DOMAIN_PROVIDER_REQUIRED' || item.code === 'RCL_NATIVE_FACET_UNSUPPORTED'));
});
