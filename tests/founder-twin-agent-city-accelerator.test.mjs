import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  runFounderTwinAgentCityAcceleratorDemo,
  runFounderTwinAgentCityAccelerator,
  buildFounderTwinAgentCityAcceleratorSpec,
  renderFounderTwinAgentCityAcceleratorRcl,
  renderFounderTwinWorkMethodMarkdown,
  writeFounderTwinAgentCityAcceleratorReports,
} from '../src/founder-twin-agent-city-accelerator.mjs';

test('v0.83 establishes evidence-constrained Founder Twin above the agent city', () => {
  const bundle = runFounderTwinAgentCityAcceleratorDemo();
  assert.equal(bundle.ok, true);
  assert.equal(bundle.result.version, '0.83.0-alpha.1');
  assert.equal(bundle.result.founderTwinEstablished, true);
  assert.equal(bundle.result.founderPrimaryName, '杜衡界');
  assert.equal(bundle.result.founderLegalName, '杜浩麟');
  assert.equal(bundle.result.coreTriadEnabled, true);
  assert.equal(bundle.result.triadCount, 3);
  assert.equal(bundle.result.founderTwinIsSimulationOnly, true);
  assert.equal(bundle.result.canReplaceUserCompletely, false);
});

test('v0.83 compiles triad and nine-core mirror into a decision kernel', () => {
  const bundle = runFounderTwinAgentCityAcceleratorDemo();
  assert.equal(bundle.result.nineCoreMirrorCount, 9);
  assert.equal(bundle.result.founderFewShotSamples, 27);
  assert.equal(bundle.decisionKernel.triad.map(t => t.name).join(' -> '), '结构识别 -> 接口调度 -> 主权编译');
  assert.ok(bundle.decisionKernel.decisionLoop.includes('COMPILE_SOVEREIGN_ACTION'));
  assert.ok(bundle.nineCoreMirror.cores.every(core => core.outputContract.length > 10));
});

test('v0.83 aligns city work packages by founder utility', () => {
  const bundle = runFounderTwinAgentCityAcceleratorDemo();
  assert.equal(bundle.result.cityCabinetCount, 7);
  assert.equal(bundle.result.cityDepartmentCount, 49);
  assert.equal(bundle.result.cityRoleCellCount, 343);
  assert.ok(bundle.result.averageFounderAlignment > 0.62);
  assert.ok(bundle.result.promotedFounderWorkloadCount >= 1);
  assert.ok(bundle.alignment.workloadReordered[0].founderUtilityScore >= bundle.alignment.workloadReordered.at(-1).founderUtilityScore);
  assert.ok(bundle.alignment.cabinetDirectives.every(d => d.mustReportBackToFounderTwin));
});

test('v0.83 increases planning acceleration without claiming real-time or full replacement', () => {
  const bundle = runFounderTwinAgentCityAcceleratorDemo();
  assert.ok(bundle.result.baseCityAccelerationFactor >= 50);
  assert.ok(bundle.result.founderAlignedAccelerationFactor > bundle.result.baseCityAccelerationFactor);
  assert.ok(bundle.result.founderDecisionCompressionRatio > 0.5);
  assert.ok(bundle.result.modelWorkReductionEstimate > 0.9);
  assert.equal(bundle.result.canReplaceOuterModelCompletely, false);
  assert.equal(bundle.result.noRemoteMutation, true);
  assert.equal(bundle.acceleration.interpretation.includes('Planning and decision acceleration'), true);
});

test('v0.83 keeps evidence and human authority boundaries', () => {
  const bundle = runFounderTwinAgentCityAcceleratorDemo();
  assert.equal(bundle.verdict.humanFinalAuthorityKept, true);
  assert.equal(bundle.verdict.canReplaceUserCompletely, false);
  assert.equal(bundle.evidenceLedger.recordCount, 7);
  assert.equal(typeof bundle.evidenceLedger.canonicalRoot, 'string');
  assert.equal(bundle.evidenceLedger.canonicalRoot.length, 64);
  assert.ok(bundle.evidenceLedger.records.every(r => r.boundary.includes('not a claim')));
});

test('v0.83 writes reports, RCL handoff and founder work method', () => {
  const outDir = path.join(os.tmpdir(), `rcl-founder-twin-${Date.now()}`);
  fs.rmSync(outDir, { recursive: true, force: true });
  const report = writeFounderTwinAgentCityAcceleratorReports(outDir, buildFounderTwinAgentCityAcceleratorSpec());
  assert.equal(report.ok, true);
  for (const file of [
    'founder-twin-result.json',
    'founder-twin-bundle.json',
    'founder-profile.md',
    'decision-kernel.md',
    'city-alignment.md',
    'acceleration-ledger.md',
    'founder-verdict.md',
    'evidence-ledger.md',
    'founder-twin-work-method.md',
    'founder-twin-agent-city.rcl',
    'canonical-root.txt',
  ]) {
    assert.ok(fs.existsSync(path.join(outDir, file)), file);
  }
  const rcl = renderFounderTwinAgentCityAcceleratorRcl();
  assert.match(rcl, /FounderTwinAgentCityAcceleratorV083/);
  assert.match(rcl, /OBSERVE_STRUCTURE/);
  assert.match(rcl, /COMPILE_SOVEREIGN_ACTION/);
  const method = renderFounderTwinWorkMethodMarkdown();
  assert.match(method, /结构识别/);
  assert.match(method, /Founder Twin 不是杜衡界本人/);
});
