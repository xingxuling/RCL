import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  RCL_NATIVE_FRAMEWORK_ATLAS,
  assessRclNativeFrameworkAtlas,
  getRclNativeFramework,
  listRclNativeFrameworks,
} from '../src/index.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test('native framework atlas names the native RCL layers and companion boundaries', () => {
  const assessment = assessRclNativeFrameworkAtlas();
  assert.equal(assessment.status, 'INVENTORY_CANDIDATE_ONLY');
  assert.equal(assessment.count, 11);
  assert.equal(assessment.classifications.NATIVE_CORE_CANDIDATE, 3);
  assert.equal(assessment.classifications.NATIVE_RUNTIME_CANDIDATE, 2);
  assert.equal(assessment.classifications.NATIVE_DOMAIN_CANDIDATE, 1);
  assert.equal(assessment.classifications.FRAMEWORK_CANDIDATE, 1);
  assert.equal(assessment.classifications.PACK_CANDIDATE, 3);
  assert.equal(assessment.classifications.AUXILIARY_PROVIDER, 1);
  assert.deepEqual(
    assessment.nativeFrameworks.map(item => item.friendlyNameEn),
    ['RCL Core', 'RCL Engine', 'RCL Reality', 'RCL Typeforge', 'RCL Weave', 'RCL Trace', 'RCL Atlas'],
  );
  assert.match(assessment.root, /^[0-9a-f]{64}$/u);
});

test('native framework atlas keeps names unique and Weave retains its existing candidate ID', () => {
  const ids = RCL_NATIVE_FRAMEWORK_ATLAS.map(item => item.id);
  const english = RCL_NATIVE_FRAMEWORK_ATLAS.map(item => item.friendlyNameEn);
  const chinese = RCL_NATIVE_FRAMEWORK_ATLAS.map(item => item.friendlyNameZh);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(english).size, english.length);
  assert.equal(new Set(chinese).size, chinese.length);
  assert.equal(RCL_NATIVE_FRAMEWORK_ATLAS.every(item => Array.isArray(item.exampleProducts) && item.exampleProducts.length >= 3), true);
  const weave = getRclNativeFramework('rcl.ui.native-app.v0.1');
  assert.equal(weave.friendlyNameEn, 'RCL Weave');
  assert.equal(weave.friendlyNameZh, '织界');
  assert.equal(weave.idStatus, 'EXISTING_CANDIDATE_ID');
});

test('native and companion layers can be filtered without mutating the atlas', () => {
  const native = listRclNativeFrameworks({ classification: 'NATIVE_CORE_CANDIDATE' });
  assert.deepEqual(native.map(item => item.friendlyNameEn), ['RCL Core', 'RCL Reality', 'RCL Trace']);
  const support = listRclNativeFrameworks({ classification: 'PACK_CANDIDATE' });
  assert.deepEqual(support.map(item => item.friendlyNameEn), ['RCL Launchpad', 'RCL Shipyard', 'RCL Forge']);
  native[0].nativeSemantics.push('mutated');
  assert.equal(getRclNativeFramework('rcl.core.language.v0.1').nativeSemantics.includes('mutated'), false);
  assert.throws(() => listRclNativeFrameworks({ classification: 'UNKNOWN' }), /RCL_NATIVE_FRAMEWORK_ATLAS_CLASSIFICATION:UNKNOWN/u);
});

test('atlas makes the native ownership and downstream lowering boundary explicit', () => {
  const weave = getRclNativeFramework('rcl.ui.native-app.v0.1');
  const gate = getRclNativeFramework('rcl.provider.gate.v0.1');
  const engine = getRclNativeFramework('rcl.core.runtime.v0.1');
  assert.equal(weave.semanticOwner, 'RCL');
  assert.ok(weave.lowersTo.includes('rcl.native-ui.web-lowering.v0.1'));
  assert.ok(weave.doNotAbsorb.includes('React/Compose implementation'));
  assert.match(gate.semanticOwner, /RCL owns request\/authority\/evidence contract/u);
  assert.ok(gate.doNotAbsorb.includes('provider-specific correctness'));
  assert.equal(engine.semanticOwner, 'RCL');
});

test('atlas examples connect framework names to concrete application shapes', () => {
  assert.ok(getRclNativeFramework('rcl.reality.transaction.v0.1').exampleProducts.includes('approval workflow'));
  assert.ok(getRclNativeFramework('rcl.data.typed.v0.1').exampleProducts.includes('CRM/customer model'));
  assert.ok(getRclNativeFramework('rcl.ui.native-app.v0.1').exampleProducts.includes('Web + Android dashboard'));
  assert.ok(getRclNativeFramework('rcl.knowledge.simulation.v0.1').exampleProducts.includes('scientific notebook'));
  assert.ok(getRclNativeFramework('rcl.provider.gate.v0.1').exampleProducts.includes('GPU/hardware capability'));
});

test('CLI exposes the machine-readable native framework atlas', () => {
  const payload = JSON.parse(execFileSync(process.execPath, ['src/cli.mjs', 'framework-atlas'], {
    cwd: ROOT,
    encoding: 'utf8',
  }));
  assert.equal(payload.assessment.format, 'rcl.native-framework-atlas.v0.1');
  assert.equal(payload.assessment.status, 'INVENTORY_CANDIDATE_ONLY');
  assert.ok(payload.frameworks.some(item => item.friendlyNameEn === 'RCL Weave' && item.friendlyNameZh === '织界'));
});
