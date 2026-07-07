import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  runUniverseKnowledgeRuntimeDemo,
  runUniverseKnowledgeRuntime,
  buildUniverseKnowledgeRuntimeSpec,
  writeUniverseKnowledgeRuntimeReports,
} from '../src/universe-knowledge-runtime.mjs';

test('v0.76 demo establishes universe knowledge runtime', () => {
  const bundle = runUniverseKnowledgeRuntimeDemo();
  assert.equal(bundle.ok, true);
  assert.equal(bundle.result.universeKnowledgeRuntimeEstablished, true);
  assert.equal(bundle.result.knowledgeObjectCount, 8);
  assert.equal(bundle.result.futureReleasePlanCount, 8);
  assert.equal(bundle.result.superAppKnowledgeBrainReady, true);
});

test('v0.76 knowledge objects have state, hooks, evidence and governance', () => {
  const bundle = runUniverseKnowledgeRuntime(buildUniverseKnowledgeRuntimeSpec());
  for (const obj of bundle.knowledgeObjects) {
    assert.equal(obj.format, 'rcl.universe-knowledge-object.v0.76');
    assert.ok(obj.evidenceRoot.length >= 32);
    assert.ok(obj.state.runtimeReadiness >= 0.8);
    assert.equal(obj.translationSurface.ready, true);
    assert.equal(obj.governancePolicy.humanFinalAuthority, true);
    assert.ok(obj.hooks.verificationHook);
  }
});

test('v0.76 future roadmap starts with query engine and contains super app path', () => {
  const bundle = runUniverseKnowledgeRuntimeDemo();
  assert.equal(bundle.futurePlan.releases[0].version, 'v0.77');
  assert.ok(bundle.futurePlan.releases.some((r) => r.module.includes('Super App')));
  assert.equal(bundle.result.queryEngineHandoffReady, true);
});

test('v0.76 report writer creates runtime artifacts and docs', () => {
  const outDir = path.resolve('output/test-v0.76-universe-knowledge-runtime');
  fs.rmSync(outDir, { recursive: true, force: true });
  const report = writeUniverseKnowledgeRuntimeReports(outDir, {});
  assert.equal(report.ok, true);
  assert.ok(fs.existsSync(path.join(outDir, 'universe-knowledge-runtime-result.json')));
  assert.ok(fs.existsSync(path.join(outDir, 'future-roadmap.md')));
  assert.ok(fs.existsSync(path.join(outDir, 'knowledge-object-docs')));
});
