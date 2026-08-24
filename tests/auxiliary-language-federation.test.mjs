import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  buildLanguageFederationEvidence,
  compileRslSurfaceToRcl,
  detectDuplicateSemanticOwners,
  loadLanguageFederationRegistry,
  parseRslSurface,
  renderRslSurface,
  runRslFederationBenchmark,
  validateLanguageFederationRegistry,
} from '../src/auxiliary-language-federation.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const corpus = JSON.parse(fs.readFileSync(path.join(root, 'examples', 'language-federation', 'rsl-corpus.v0.1.json'), 'utf8'));

test('language federation registry is referentially valid and has one owner per canonical claim', () => {
  const registry = loadLanguageFederationRegistry();
  const validation = validateLanguageFederationRegistry(registry);
  assert.equal(validation.valid, true, validation.failures.join('\n'));
  const duplication = detectDuplicateSemanticOwners(registry);
  assert.equal(duplication.status, 'PASS');
  assert.deepEqual(duplication.conflicts, []);
  assert.equal(registry.languages.languages.length, 8);
});

test('duplicate semantic detector fails closed on a second canonical owner', () => {
  const registry = structuredClone(loadLanguageFederationRegistry());
  registry.languages.languages.find((language) => language.id === 'rsl').canonical_owner_of.push('reality-ir');
  const result = detectDuplicateSemanticOwners(registry);
  assert.equal(result.status, 'CONFLICT');
  assert.deepEqual(result.conflicts.find((conflict) => conflict.capability === 'reality-ir').owners, ['rcl', 'rsl']);
});

test('zh-CN and en-US RSL candidate surfaces have different ASTs and identical ASIL/RCL roots', () => {
  const zh = compileRslSurfaceToRcl('建立项目 federation_demo', 'zh-CN');
  const en = compileRslSurfaceToRcl('create project federation_demo', 'en-US');
  assert.equal(zh.status, 'CANDIDATE');
  assert.equal(en.status, 'CANDIDATE');
  assert.notEqual(zh.surfaceAst.type, en.surfaceAst.type);
  assert.notEqual(zh.surfaceAst.root, en.surfaceAst.root);
  assert.equal(zh.meaningRoot, en.meaningRoot);
  assert.equal(zh.rclProgramRoot, en.rclProgramRoot);
  assert.equal(zh.authorityGranted, false);
  assert.equal(zh.realityCommitRequested, false);
  assert.match(zh.rclSource, /foresee propose/);
  assert.doesNotMatch(zh.rclSource, /realize propose/);
});

test('RSL round trips across locale through the ASIL Programming Profile without semantic drift', () => {
  const original = compileRslSurfaceToRcl('建立项目 roundtrip_demo', 'zh-CN');
  const enSurface = renderRslSurface(original.semantic, 'en-US');
  const translated = compileRslSurfaceToRcl(enSurface, 'en-US');
  const zhSurface = renderRslSurface(translated.semantic, 'zh-CN');
  const returned = compileRslSurfaceToRcl(zhSurface, 'zh-CN');
  assert.equal(original.meaningRoot, translated.meaningRoot);
  assert.equal(translated.meaningRoot, returned.meaningRoot);
  assert.equal(original.rclProgramRoot, returned.rclProgramRoot);
});

test('ambiguity and authority-shaped unsupported inputs require clarification and grant no authority', () => {
  for (const entry of corpus.negative_cases) {
    const result = parseRslSurface(entry.surface, entry.locale);
    assert.equal(result.status, 'CLARIFICATION_REQUIRED', entry.id);
    assert.equal(result.authorityGranted, false, entry.id);
  }
});

test('frozen corpus verifies 50 surfaces, round trips, negative cases, evidence and authority preservation', () => {
  const report = runRslFederationBenchmark(corpus);
  assert.equal(report.status, 'PASS');
  assert.equal(report.caseCount, 25);
  assert.equal(report.surfaceCount, 50);
  assert.equal(report.negativeCaseCount, 9);
  assert.ok(report.results.every((entry) => entry.pass && entry.surfaceRootsDiffer));
  assert.ok(report.negatives.every((entry) => entry.pass));
});

test('audit decisions preserve unknown and historical boundaries', () => {
  const registry = loadLanguageFederationRegistry();
  const languages = Object.fromEntries(registry.languages.languages.map((language) => [language.id, language]));
  assert.equal(languages['e-lang-ir'].status, 'SUPERSEDED');
  assert.equal(languages.rsl.status, 'CANDIDATE');
  assert.equal(languages.snll.source_revision.startsWith('UNCOMMITTED_LOCAL_ASSET'), true);
  assert.equal(languages.csl.role, 'structural-domain-auxiliary-language');
  const ialMapping = registry.translators.translators.find((translator) => translator.id === 'ial-to-asil');
  assert.equal(ialMapping.status, 'UNKNOWN');
  assert.equal(ialMapping.lossiness, 'UNKNOWN');
});

test('machine-readable schemas parse and evidence bundle remains candidate-bounded', () => {
  for (const file of ['language.schema.json', 'semantic-profile.schema.json', 'translation-contract.schema.json']) {
    const schema = JSON.parse(fs.readFileSync(path.join(root, 'language-federation', 'schemas', file), 'utf8'));
    assert.equal(schema.type, 'object');
    assert.ok(Array.isArray(schema.required));
  }
  const evidence = buildLanguageFederationEvidence({ corpus });
  assert.equal(evidence.status, 'CANDIDATE');
  assert.equal(evidence.duplicateSemantics.status, 'PASS');
  assert.equal(evidence.benchmark.status, 'PASS');
  assert.ok(evidence.knownUnknowns.includes('IAL-to-ASIL round-trip'));
});
