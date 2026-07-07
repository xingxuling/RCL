import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  runUniversalSemanticTranslatorDemo,
  runUniversalSemanticTranslator,
  buildUniversalSemanticTranslatorSpec,
  writeUniversalSemanticTranslatorReports,
} from '../src/universal-semantic-translator.mjs';

test('v0.75 demo establishes universal semantic translator', () => {
  const bundle = runUniversalSemanticTranslatorDemo();
  assert.equal(bundle.ok, true);
  assert.equal(bundle.result.universalSemanticTranslatorEstablished, true);
  assert.equal(bundle.result.semanticIrCount, 8);
  assert.equal(bundle.result.outputModeCount, 4);
  assert.equal(bundle.result.superAppMouthLayerReady, true);
});

test('v0.75 emits natural language documents with evidence roots', () => {
  const bundle = runUniversalSemanticTranslator(buildUniversalSemanticTranslatorSpec());
  assert.ok(bundle.documents.length >= 8);
  for (const doc of bundle.documents) {
    assert.equal(doc.format, 'rcl.natural-language-document.v0.75');
    assert.ok(doc.markdown.includes('证据') || doc.markdown.includes('Evidence'));
    assert.ok(doc.documentRoot.length >= 32);
  }
});

test('v0.75 supports custom mixed semantic inputs', () => {
  const bundle = runUniversalSemanticTranslator({
    semanticInputs: [
      { id: 'code', kind: 'source_code', language: 'JavaScript', content: 'export function x() { return 1; }' },
      { id: 'exp', kind: 'experiment_protocol', language: 'Experiment IR', content: 'Hypothesis, controls, metrics and failure conditions.' },
      { id: 'gov', kind: 'governance_policy', language: 'Governance IR', content: 'Human authority, risk budget and release gate.' },
      { id: 'prod', kind: 'product_entry', language: 'Product IR', content: 'Goal intake, plan card and evidence panel.' },
      { id: 'uk', kind: 'unknown_knowledge', language: 'Candidate IR', content: 'Falsifiable candidate mechanism with blind prediction.' },
      { id: 'tree', kind: 'civilization_technology_tree', language: 'Tech Tree', content: 'Technology nodes and dependencies.' },
      { id: 'rcl', kind: 'rcl_structure', language: 'RCL', content: 'reality demo { objective: explain }' },
      { id: 'nl', kind: 'natural_language', language: 'Chinese', content: '输出自然语言说明。' },
    ],
  });
  assert.equal(bundle.ok, true);
  assert.equal(bundle.semanticIrs.length, 8);
  assert.ok(bundle.result.sourceTypeCount >= 6);
});

test('v0.75 report writer creates files', () => {
  const outDir = path.resolve('output/test-v0.75-universal-semantic-translator');
  fs.rmSync(outDir, { recursive: true, force: true });
  const report = writeUniversalSemanticTranslatorReports(outDir, {});
  assert.equal(report.ok, true);
  assert.ok(fs.existsSync(path.join(outDir, 'universal-semantic-translator-result.json')));
  assert.ok(fs.existsSync(path.join(outDir, 'natural-language-docs')));
});
