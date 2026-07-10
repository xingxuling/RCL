import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import {
  RCL_CIVILIZATION_TECH_TREE_RESULT_FORMAT,
  RCL_TECHNOLOGY_NODE_FORMAT,
  RCL_TECHNOLOGY_TREE_FORMAT,
  evaluateCivilizationTechnologyTreeCompiler,
  runCivilizationTechnologyTreeCompiler,
  renderCivilizationTechnologyTreeRcl,
  writeCivilizationTechnologyTreeReports,
} from '../src/civilization-technology-tree-compiler.mjs';

const cwd = fileURLToPath(new URL('..', import.meta.url));
function tempDir(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `rcl-${name}-`));
}

test('v0.62 compiles v0.61 notebooks into civilization technology nodes', () => {
  const evaluation = evaluateCivilizationTechnologyTreeCompiler();
  assert.equal(evaluation.result.format, RCL_CIVILIZATION_TECH_TREE_RESULT_FORMAT);
  assert.equal(evaluation.result.civilizationTechnologyTreeEstablished, true);
  assert.ok(evaluation.nodes.length >= 8);
  assert.ok(evaluation.nodes.every(node => node.format === RCL_TECHNOLOGY_NODE_FORMAT));
  assert.ok(evaluation.nodes.every(node => node.established && node.evidenceLineage.replayHash));
});

test('v0.62 builds dependency graph, roadmap and capability map', () => {
  const bundle = runCivilizationTechnologyTreeCompiler();
  assert.equal(bundle.technologyTree.format, RCL_TECHNOLOGY_TREE_FORMAT);
  assert.equal(bundle.civilizationTechnologyTreeEstablished, true);
  assert.ok(bundle.dependencyGraph.acyclic);
  assert.ok(bundle.dependencyGraph.edgeCount >= 6);
  assert.ok(bundle.roadmap.phaseCount >= 5);
  assert.ok(bundle.capabilityMap.domainCount >= 4);
  assert.equal(bundle.treeScores.averageTreeScore, 1);
});

test('v0.62 renders RCL surface and technical documents', () => {
  const bundle = runCivilizationTechnologyTreeCompiler();
  assert.ok(bundle.documents.length >= 9);
  assert.match(bundle.documents[0].markdown, /Civilization Technology Tree/);
  assert.match(bundle.documents[0].markdown, /Dependency Graph/);
  const rcl = renderCivilizationTechnologyTreeRcl();
  assert.match(rcl, /reality CivilizationTechnologyTreeCompiler/);
  assert.match(rcl, /validation.established : Truth = true/);
});

test('v0.62 CLI writes technology tree reports', () => {
  const dir = tempDir('civilization-tech-tree');
  const reports = writeCivilizationTechnologyTreeReports(dir);
  assert.equal(reports.ok, true);
  assert.equal(fs.existsSync(path.join(dir, 'civilization-technology-tree-result.json')), true);
  assert.equal(fs.existsSync(path.join(dir, 'technology-nodes.json')), true);
  assert.equal(fs.existsSync(path.join(dir, 'dependency-graph.json')), true);
  assert.ok(fs.readdirSync(path.join(dir, 'technology-tree-docs')).length >= 9);
  const demoOut = execFileSync('node', ['src/cli.mjs', 'civilization-tech-tree-demo'], { cwd, encoding: 'utf8' });
  const demo = JSON.parse(demoOut);
  assert.equal(demo.ok, true);
  assert.equal(demo.civilizationTechnologyTreeEstablished, true);
});
