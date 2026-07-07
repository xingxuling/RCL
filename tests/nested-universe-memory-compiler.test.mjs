import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  RCL_NESTED_UNIVERSE_MEMORY_COMPILER_VERSION,
  RCL_NESTED_UNIVERSE_SPEC_FORMAT,
  RCL_NESTED_UNIVERSE_RESULT_FORMAT,
  DEFAULT_NESTED_UNIVERSE_MEMORY,
  normalizeNestedUniverseMemorySpec,
  deriveNestedUniverseTransforms,
  evaluateNestedLayerContainment,
  evaluateMemoryAnchorSet,
  evaluateIdentityBridge,
  evaluateAgePhaseLock,
  compileNestedUniverseMemory,
  buildNestedUniverseMemorySpec,
  renderNestedUniverseMemoryRcl,
  runNestedUniverseMemoryTest,
  writeNestedUniverseMemoryReports,
  compileReality,
} from '../src/index.mjs';

const cwd = fileURLToPath(new URL('..', import.meta.url));

function tempDir(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `rcl-${name}-`));
}

test('v0.46.1 exposes nested universe compiler constants and default memory spec', () => {
  assert.equal(RCL_NESTED_UNIVERSE_MEMORY_COMPILER_VERSION, '0.46.1-alpha.1');
  const spec = normalizeNestedUniverseMemorySpec(DEFAULT_NESTED_UNIVERSE_MEMORY);
  assert.equal(spec.format, RCL_NESTED_UNIVERSE_SPEC_FORMAT);
  assert.deepEqual(spec.observedOrder, ['surface_universe', 'outer_universe', 'inner_universe']);
  assert.equal(spec.relationModel, 'egg_shell_core_containment');
});

test('v0.46.1 solves outer/surface temporal bridge for the supplied memory', () => {
  const transforms = deriveNestedUniverseTransforms(DEFAULT_NESTED_UNIVERSE_MEMORY);
  assert.equal(transforms.currentOffset, 40);
  assert.equal(transforms.linkOffset, 40);
  assert.equal(transforms.surfaceElapsed, 4);
  assert.equal(transforms.outerElapsed, 4);
  assert.equal(transforms.scores.temporalBridge, 1);
  assert.equal(transforms.temporalMapping, 'outer_year = surface_year + 40');
  assert.equal(transforms.agePhaseMapping, 'outer_age 14→18; surface_age 19→23');
  assert.equal(transforms.scores.agePhaseLock, 1);
});


test('v0.46.1 locks corrected age phase: outer 2062 age 14 to surface 2022 age 19', () => {
  const agePhase = evaluateAgePhaseLock(DEFAULT_NESTED_UNIVERSE_MEMORY);
  assert.equal(agePhase.outerAgeAtEvent, 14);
  assert.equal(agePhase.surfaceAgeAtEvent, 19);
  assert.equal(agePhase.outerAgeAtCurrent, 18);
  assert.equal(agePhase.surfaceAgeAtCurrent, 23);
  assert.equal(agePhase.ageProgressionDelta, 0);
  assert.equal(agePhase.score, 1);
  assert.match(agePhase.interpretation, /2062 outer age 14/);
});

test('v0.46.1 validates containment order and avoids branch semantics', () => {
  const containment = evaluateNestedLayerContainment(DEFAULT_NESTED_UNIVERSE_MEMORY);
  assert.equal(containment.hasThreeLayers, true);
  assert.equal(containment.orderOk, true);
  assert.equal(containment.modelOk, true);
  assert.equal(containment.branchAvoidance, true);
  assert.equal(containment.score, 1);
});

test('v0.46.1 scores memory anchor set and identity bridge without claiming proof', () => {
  const anchors = evaluateMemoryAnchorSet(DEFAULT_NESTED_UNIVERSE_MEMORY);
  const identity = evaluateIdentityBridge(DEFAULT_NESTED_UNIVERSE_MEMORY);
  assert.equal(anchors.score, 1);
  assert.ok(identity.score >= 0.82);
  assert.match(identity.interpretation, /identity-signature/);
});

test('v0.46.1 compiles the supplied memory into a bounded positive verdict', () => {
  const { result } = compileNestedUniverseMemory(DEFAULT_NESTED_UNIVERSE_MEMORY);
  assert.equal(result.format, RCL_NESTED_UNIVERSE_RESULT_FORMAT);
  assert.equal(result.conclusionHolds, true);
  assert.ok(result.structuralCoherenceScore >= 0.8);
  assert.equal(result.externalRealityVerified, false);
  assert.equal(result.externalEvidenceScore, null);
  assert.match(result.verdict, /三层嵌套宇宙/);
  assert.ok(result.predictedEvents.length >= 5);
});

test('v0.46.1 renders a compilable RCL projection and writes reports', () => {
  const spec = buildNestedUniverseMemorySpec(DEFAULT_NESTED_UNIVERSE_MEMORY);
  assert.equal(spec.format, RCL_NESTED_UNIVERSE_SPEC_FORMAT);
  assert.equal(spec.validation.conclusionHolds, true);
  assert.match(spec.root, /^[0-9a-f]{64}$/);
  const rcl = renderNestedUniverseMemoryRcl(spec);
  assert.match(rcl, /reality NestedUniverseMemoryCompiler/);
  assert.match(rcl, /relation\.containment/);
  const compiled = compileReality(rcl);
  assert.match(compiled.programRoot, /^[0-9a-f]{64}$/);
  const dir = tempDir('nested-universe');
  const bundle = writeNestedUniverseMemoryReports(dir, DEFAULT_NESTED_UNIVERSE_MEMORY);
  assert.equal(bundle.ok, true);
  assert.equal(fs.existsSync(path.join(dir, 'nested-universe-memory-bundle.json')), true);
  assert.equal(fs.existsSync(path.join(dir, 'nested-universe-memory-compiler.rcl')), true);
  assert.equal(fs.existsSync(path.join(dir, 'nested-universe-memory-summary.md')), true);
});

test('v0.46.1 provides CLI demo, run and spec commands', () => {
  const demoOut = execFileSync('node', ['src/cli.mjs', 'nested-universe-demo'], { cwd, encoding: 'utf8' });
  assert.equal(JSON.parse(demoOut).ok, true);
  const runDir = tempDir('nested-universe-cli');
  const runOut = execFileSync('node', ['src/cli.mjs', 'nested-universe-run', 'examples/nested-universe/duhaolin-memory-link.json', runDir], { cwd, encoding: 'utf8' });
  assert.equal(JSON.parse(runOut).ok, true);
  assert.equal(fs.existsSync(path.join(runDir, 'nested-universe-memory-bundle.json')), true);
  const specDir = tempDir('nested-universe-spec');
  const specOut = execFileSync('node', ['src/cli.mjs', 'nested-universe-spec', specDir], { cwd, encoding: 'utf8' });
  assert.equal(JSON.parse(specOut).ok, true);
  assert.equal(fs.existsSync(path.join(specDir, 'nested-universe-memory-spec.json')), true);
});


test('v0.46.1 detects broken age-phase progression even when dates still align', () => {
  const broken = structuredClone(DEFAULT_NESTED_UNIVERSE_MEMORY);
  broken.memoryEvent.outerSubjectAgeAtEvent = 16;
  const { result } = compileNestedUniverseMemory(broken);
  assert.equal(result.transforms.currentOffset, 40);
  assert.equal(result.transforms.linkOffset, 40);
  assert.ok(result.agePhase.score < 1);
  assert.ok(result.rows.find(row => row.id === 'age_phase_lock').score < 1);
});

test('v0.46.1 fails gracefully when the temporal bridge is broken', () => {
  const broken = structuredClone(DEFAULT_NESTED_UNIVERSE_MEMORY);
  broken.layers.outer_universe.currentEarthYear = 2099;
  broken.memoryEvent.outerYear = 2062;
  const { result } = compileNestedUniverseMemory(broken);
  assert.equal(result.transforms.currentOffset, 73);
  assert.equal(result.transforms.linkOffset, 40);
  assert.ok(result.transforms.scores.temporalBridge < 0.6);
  assert.ok(result.structuralCoherenceScore < 0.9);
});
