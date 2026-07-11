import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import {
  DEFAULT_ESOTERIC_MECHANISM_SPEC,
  normalizeEsotericMechanismSpec,
  evaluateEsotericMechanism,
  runEsotericMechanismCompiler,
  renderEsotericTechnicalDocument,
  renderEsotericMechanismRcl,
  writeEsotericMechanismReports,
  RCL_ESOTERIC_MECHANISM_SPEC_FORMAT,
  RCL_ESOTERIC_MECHANISM_RESULT_FORMAT,
} from '../src/esoteric-mechanism-compiler.mjs';

const cwd = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bundle = runEsotericMechanismCompiler();

function tempDir(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `rcl-${name}-`));
}

test('v0.55 normalizes esoteric mechanism spec with concepts and negative controls', () => {
  const spec = normalizeEsotericMechanismSpec(DEFAULT_ESOTERIC_MECHANISM_SPEC);
  assert.equal(spec.format, RCL_ESOTERIC_MECHANISM_SPEC_FORMAT);
  assert.ok(spec.concepts.length >= 10);
  assert.ok(spec.requiredNegativeControls.includes('costless_world_rewrite_spell'));
  assert.ok(spec.thresholds.minPromotedCount >= 6);
});

test('v0.55 compiles esoteric concepts into mechanism candidates and rejects negative controls', () => {
  assert.equal(bundle.result.format, RCL_ESOTERIC_MECHANISM_RESULT_FORMAT);
  assert.equal(bundle.result.esotericMechanismEstablished, true);
  assert.ok(bundle.result.promotedCount >= 6);
  assert.ok(bundle.result.documentCount >= 6);
  assert.ok(bundle.result.averagePromotedScore >= 0.60);
  assert.equal(bundle.result.negativeControlsRejected, true);
  assert.ok(bundle.result.rejectedMechanismIds.includes('costless_world_rewrite_spell'));
  assert.ok(bundle.result.rejectedMechanismIds.includes('infinite_qi_perpetual_core'));
  assert.ok(bundle.result.promotedMechanismIds.includes('qi_environmental_biofield_coupling'));
  assert.ok(bundle.result.promotedMechanismIds.includes('formation_spatial_constraint_array'));
});

test('v0.55 mechanism rows and documents expose bilingual key dimensions', () => {
  const spec = normalizeEsotericMechanismSpec();
  const concept = spec.concepts.find(row => row.id === 'spell_symbolic_control_protocol');
  const row = evaluateEsotericMechanism(concept, spec);
  assert.equal(row.promoted, true);
  assert.ok(row.dimensions.energyClosureScore >= 0.30);
  assert.ok(row.dimensions.informationChannelScore >= 0.45);
  assert.ok(row.dimensions.symbolicControlScore >= 0.58);
  assert.ok(row.dimensions.falsifiabilityTraceScore >= 0.62);
  const aether = bundle.rows.find(item => item.id === 'aether_substrate_information_medium');
  const doc = renderEsotericTechnicalDocument(aether, bundle.spec);
  assert.match(doc.markdown, /Aether substrate information medium/);
  assert.match(doc.markdown, /以太底层信息媒介/);
  assert.match(doc.markdown, /Energy Closure（能量闭合）/);
  assert.match(doc.markdown, /Falsifiers（反证条件）/);
});

test('v0.55 renders RCL, writes reports, and exposes CLI commands', () => {
  const rcl = renderEsotericMechanismRcl();
  assert.match(rcl, /reality EsotericMechanismCompiler/);
  assert.match(rcl, /validation.established : Truth = true/);
  const dir = tempDir('esoteric-mechanism');
  const reports = writeEsotericMechanismReports(dir);
  assert.equal(reports.ok, true);
  assert.equal(fs.existsSync(path.join(dir, 'esoteric-mechanism-result.json')), true);
  assert.ok(fs.readdirSync(path.join(dir, 'technical-docs')).length >= 6);
  const demoOut = execFileSync('node', ['src/cli.mjs', 'esoteric-mechanism-demo'], { cwd, encoding: 'utf8' });
  const demo = JSON.parse(demoOut);
  assert.equal(demo.ok, true);
  assert.equal(demo.esotericMechanismEstablished, true);
});
