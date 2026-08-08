import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyAiAssimilationLevel, RBC13_AI_ASSIMILATION_LEVELS } from '../src/rbc13-ai-assimilation-threshold.mjs';

test('A10 threshold levels are monotonic and require independent evidence for L3/L4', () => {
  assert.deepEqual(RBC13_AI_ASSIMILATION_LEVELS, ['L0', 'L1', 'L2', 'L3', 'L4']);
  assert.equal(classifyAiAssimilationLevel({ contract: false }), 'L0');
  assert.equal(classifyAiAssimilationLevel({ contract: true, extraction: false }), 'L1');
  assert.equal(classifyAiAssimilationLevel({ contract: true, extraction: true, corpus: true, candidate: true }), 'L2');
  assert.equal(classifyAiAssimilationLevel({ contract: true, extraction: true, corpus: true, candidate: true, differential: true }), 'L3');
  assert.equal(classifyAiAssimilationLevel({ contract: true, extraction: true, corpus: true, candidate: true, differential: true, nativeCandidate: true, promotion: true }), 'L4');
});
