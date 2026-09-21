import assert from 'node:assert/strict';
import test from 'node:test';
import { compileReality } from '../src/compiler.mjs';
import { realityRoot } from '../src/canonical.mjs';
import { lowerDeclaredKnowledgeToCore } from '../src/foundation-knowledge-direct-lowering.mjs';
import { tryCompileFoundationRealityToBytecode } from '../src/foundation-direct-bytecode.mjs';

const source = [
  'reality KnowledgeDeclaredDirect {',
  '  facet world.signal : Truth = true',
  '  facet decision.allowed : Truth = false',
  '  knowledge mind {',
  '    claim trusted : Truth = world.signal confidence 0.90 evidence "sensor:signal-v1" source "sensor:signal"',
  '  }',
  '  emergence apply_knowledge {',
  '    cause actor',
  '    when known(mind.trusted, 0.80)',
  '    alter decision.allowed <- belief(mind.trusted)',
  '  }',
  '  learn mind',
  '  realize apply_knowledge',
  '}',
  '',
].join('\n');

function fields(record) {
  return Object.fromEntries(record.fields.map(item => [item.name, item.value]));
}

test('Learn consumes one bounded primitive Knowledge claim into one deterministic core transaction', () => {
  const program = compileReality(source);
  const result = lowerDeclaredKnowledgeToCore(program);
  assert.equal(result.summary.knowledgeLoweredDeclarationCount, 1);
  assert.equal(result.summary.consumedDirectiveCount, 1);
  assert.equal(result.summary.syntheticRuleCount, 1);
  assert.equal(result.summary.remainingKnowledgeCount, 0);
  assert.equal(result.summary.nativeKnowledgeRecordCount, 1);
  assert.equal(result.program.knowledges.length, 0);
  assert.equal(result.program.directives[0].kind, 'Realize');
  assert.equal(result.program.directives[1].rule, 'apply_knowledge');
  assert.equal(result.lowered[0].domain, 'knowledge');
  assert.equal(result.lowered[0].claimPath, 'mind.trusted');
});

test('bounded Knowledge record retains epistemic state including exact pre-Learn reality root', () => {
  const program = compileReality(source);
  const result = lowerDeclaredKnowledgeToCore(program);
  const knowledgeFacet = result.program.facets.find(item => item.path === 'mind.trusted');
  assert.equal(knowledgeFacet.deferred, false);
  assert.equal(knowledgeFacet.value.kind, 'RecordConstructExpr');
  assert.equal(knowledgeFacet.value.canonicalType, 'taowind.rcl.native.Knowledge.v0.1');
  const record = fields(knowledgeFacet.value);
  assert.equal(record.kind.value, 'Knowledge');
  assert.equal(record.baseType.value, 'Truth');
  assert.equal(record.confidence.value, 0.9);
  assert.equal(record.source.value, 'sensor:signal');
  assert.equal(record.scope.value, 'local');
  assert.equal(record.status.value, 'provisional');
  assert.equal(record.revision.value, 1);
  assert.equal(record.formedAtRoot.value, realityRoot({ 'world.signal': true, 'decision.allowed': false }));
  assert.equal(record.evidence.name, 'sequence_append');
  assert.equal(record.dependencies.name, 'empty_sequence');
  assert.equal(record.alternatives.name, 'empty_sequence');
});

test('Knowledge observability builtins are lowered to generic typed-record operations', () => {
  const program = compileReality(source);
  const result = lowerDeclaredKnowledgeToCore(program);
  const apply = result.program.rules.find(item => item.name === 'apply_knowledge');
  assert.equal(apply.when.kind, 'BinaryExpr');
  assert.equal(apply.when.operator, 'and');
  assert.equal(apply.alters[0].expression.kind, 'FieldAccessExpr');
  assert.equal(apply.alters[0].expression.field, 'value');
});

test('declared bounded Knowledge reaches canonical generic native bytecode without requiring the Provider bridge', () => {
  const compiled = tryCompileFoundationRealityToBytecode(source);
  assert.equal(compiled.ok, true, JSON.stringify(compiled.diagnostics));
  assert.ok(compiled.bytecode);
  assert.equal(compiled.foundationKnowledgeDirectLowering.summary.knowledgeLoweredDeclarationCount, 1);
  assert.equal(compiled.foundationKnowledgeDirectLowering.summary.nativeKnowledgeRecordCount, 1);
  assert.equal(compiled.foundationKnowledgeDirectLowering.truthBoundary.referenceRuntimeStateParityTargeted, true);
  assert.equal(compiled.foundationKnowledgeDirectLowering.truthBoundary.providerBridgeRemovedGlobally, false);
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
