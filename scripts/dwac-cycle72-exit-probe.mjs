#!/usr/bin/env node
import fs from 'node:fs';
import { compileReality } from '../src/compiler.mjs';

const source = [
  'reality VercelKnowledgeNativeProof {',
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

let report;
try {
  const program = compileReality(source);
  report = { ok: true, reality: program?.name ?? null, knowledgeCount: program?.knowledges?.length ?? null, directiveCount: program?.directives?.length ?? null };
} catch (error) {
  report = {
    ok: false,
    name: error?.name ?? null,
    code: error?.code ?? null,
    message: error?.message ?? String(error),
    diagnostics: error?.diagnostics ?? error?.details ?? null,
    stack: error?.stack ?? null,
  };
}
fs.mkdirSync('public', { recursive: true });
fs.writeFileSync('public/cycle72-knowledge-compile-debug.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ status: 'CYCLE72_KNOWLEDGE_COMPILE_DIAGNOSTIC_WRITTEN', report }, null, 2));
