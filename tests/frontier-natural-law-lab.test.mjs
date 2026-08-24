import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  runFrontierNaturalLawLab,
  runFrontierNaturalLawLabDemo,
  writeFrontierNaturalLawLabReports,
  RCL_FRONTIER_NATURAL_LAW_LAB_RESULT_FORMAT,
} from '../src/frontier-natural-law-lab.mjs';

const bundle = runFrontierNaturalLawLab({ sandbox: { trials: 2, steps: 30 } });

test('frontier natural law lab closes Phase0 without external reality claim', () => {
  assert.equal(bundle.result.format, RCL_FRONTIER_NATURAL_LAW_LAB_RESULT_FORMAT);
  assert.equal(bundle.result.established, true);
  assert.equal(bundle.result.externalRealityVerified, false);
  assert.ok(bundle.result.promotedFocusMechanismCount >= 5);
  assert.equal(bundle.result.protocolCoverage, 1);
  assert.equal(bundle.result.prototypeCoverage, 1);
});

test('all promoted focus mechanisms receive math targets, protocols and prototypes', () => {
  assert.ok(bundle.lanes.length >= 5);
  for (const lane of bundle.lanes) {
    assert.ok(lane.mathematicalTarget.object);
    assert.ok(lane.mathematicalTarget.nullModel);
    assert.ok(lane.mathematicalTarget.decisiveResidual);
    assert.ok(lane.experimentProtocolId);
    assert.ok(lane.prototypeId);
    assert.equal(lane.externalRealityVerified, false);
  }
  assert.ok(bundle.lanes.some(lane => lane.id === 'spell_symbolic_control_protocol'));
  assert.ok(bundle.lanes.some(lane => lane.id === 'mana_crystal_reservoir'));
  assert.ok(bundle.lanes.some(lane => lane.id === 'alchemical_transmutation_lattice'));
});

test('ranking is deterministic and exposes a bounded top-three agenda', () => {
  const a = runFrontierNaturalLawLabDemo({ sandbox: { trials: 2, steps: 30 } });
  const b = runFrontierNaturalLawLabDemo({ sandbox: { trials: 2, steps: 30 } });
  assert.deepEqual(a.topThreeResearchLanes, b.topThreeResearchLanes);
  assert.equal(a.root, b.root);
  assert.equal(a.externalRealityVerified, false);
  assert.equal(a.topThreeResearchLanes.length, 3);
});

test('report writer emits evidence bundle, lanes, RCL and focused protocols', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-frontier-natural-law-lab-'));
  const report = writeFrontierNaturalLawLabReports(dir, { sandbox: { trials: 2, steps: 30 } });
  assert.equal(report.ok, true);
  assert.ok(fs.existsSync(path.join(dir, 'frontier-natural-law-lab-result.json')));
  assert.ok(fs.existsSync(path.join(dir, 'frontier-natural-law-research-lanes.json')));
  assert.ok(fs.existsSync(path.join(dir, 'frontier-natural-law-lab.rcl')));
  assert.ok(fs.existsSync(path.join(dir, 'README.md')));
  assert.ok(fs.readdirSync(path.join(dir, 'protocols')).length >= 5);
});
