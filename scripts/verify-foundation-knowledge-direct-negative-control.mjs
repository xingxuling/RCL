#!/usr/bin/env node
import { compileReality } from '../src/compiler.mjs';
import { lowerDeclaredKnowledgeToCore } from '../src/foundation-knowledge-direct-lowering.mjs';
import { tryCompileFoundationRealityToBytecode } from '../src/foundation-direct-bytecode.mjs';

function fail(message, details = {}) {
  console.error(JSON.stringify({ ok: false, status: 'RCL_FOUNDATION_KNOWLEDGE_NEGATIVE_CONTROL_FAILED', message, ...details }, null, 2));
  process.exit(1);
}

const unsupportedSources = [
  {
    id: 'multiple-learn-directives',
    source: [
      'reality KnowledgeMultiLearnNegative {',
      '  facet world.signal : Truth = true',
      '  knowledge mind {',
      '    claim trusted : Truth = world.signal confidence 0.9 source "sensor:signal"',
      '  }',
      '  learn mind',
      '  learn mind',
      '}',
      '',
    ].join('\n'),
  },
  {
    id: 'missing-source-identity',
    source: [
      'reality KnowledgeMissingSourceNegative {',
      '  facet world.signal : Truth = true',
      '  knowledge mind {',
      '    claim trusted : Truth = world.signal confidence 0.9',
      '  }',
      '  learn mind',
      '}',
      '',
    ].join('\n'),
  },
];

const results = [];
for (const item of unsupportedSources) {
  const program = compileReality(item.source);
  const lowering = lowerDeclaredKnowledgeToCore(program);
  const compiled = tryCompileFoundationRealityToBytecode(program);
  const rejected = lowering.summary.knowledgeLoweredDeclarationCount === 0
    && lowering.summary.remainingKnowledgeCount >= 1
    && lowering.diagnostics.some(entry => entry.code === 'RCL_FOUNDATION_KNOWLEDGE_DIRECT_LOWERING_PROVIDER_REQUIRED')
    && compiled.ok === false;
  results.push({ id: item.id, rejected, diagnostics: compiled.diagnostics?.map(entry => entry.code) ?? [] });
  if (!rejected) fail(`Negative control ${item.id} did not fail closed to the Provider path`, { lowering, compiled });
}

console.log(JSON.stringify({
  ok: true,
  status: 'RCL_FOUNDATION_KNOWLEDGE_NEGATIVE_CONTROLS_VERIFIED',
  results,
  truthBoundary: {
    unsupportedKnowledgeProgramsRemainProviderBound: true,
    boundedSubsetDoesNotRemoveKnowledgeProviderBridge: true,
    noUnsupportedProgramIsRelabeledDirectNative: true,
  },
}, null, 2));
