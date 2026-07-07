import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  runIalCivilizationProductOsDemo,
  runIalCivilizationProductOs,
  buildIalCivilizationProductOsSpec,
  renderIalCivilizationProductOsRcl,
  renderFivefoldProductOsWorkMethodMarkdown,
  writeIalCivilizationProductOsReports,
} from '../src/ial-civilization-product-os.mjs';

test('v0.84 establishes fivefold product OS kernel', () => {
  const bundle = runIalCivilizationProductOsDemo();
  assert.equal(bundle.ok, true);
  assert.equal(bundle.result.version, '0.84.0-alpha.1');
  assert.equal(bundle.result.fivefoldProductOsEstablished, true);
  assert.equal(bundle.result.acceptedTransformationCount, 5);
  assert.equal(bundle.result.ialTaskLanguageEstablished, true);
  assert.equal(bundle.result.productGovernmentEstablished, true);
  assert.equal(bundle.result.founderProjectArbiterEstablished, true);
  assert.equal(bundle.result.qinglianGatekeeperEstablished, true);
  assert.equal(bundle.result.windInterfaceSystemEstablished, true);
});

test('v0.84 compiles IAL into executable RCL task language', () => {
  const bundle = runIalCivilizationProductOsDemo();
  assert.ok(bundle.result.executableTaskVerbCount >= 10);
  assert.equal(bundle.result.compiledTaskCount, 5);
  assert.match(bundle.ialTaskLanguage.compiledTasks[0].ialFormula, /RCL_TASK_BLOCK/);
  assert.ok(bundle.ialTaskLanguage.executableVerbs.some(v => v.id === 'B2_GATE'));
  assert.ok(bundle.ialTaskLanguage.macroPrograms.some(p => p.id === 'IAL_PRODUCT_SPRINT'));
});

test('v0.84 turns agent civilization into product development government', () => {
  const bundle = runIalCivilizationProductOsDemo();
  assert.equal(bundle.result.governmentCabinetCount, 7);
  assert.equal(bundle.result.governmentDepartmentCount, 49);
  assert.equal(bundle.result.governmentRoleCellCount, 343);
  assert.equal(bundle.result.projectedWorkerEquivalent, 2401);
  assert.ok(bundle.productGovernment.workloadPackages[0].productPriority >= bundle.productGovernment.workloadPackages.at(-1).productPriority);
});

test('v0.84 Founder Twin arbitrates projects with human authority kept', () => {
  const bundle = runIalCivilizationProductOsDemo();
  assert.equal(bundle.result.projectVerdictCount, 5);
  assert.ok(bundle.result.authorizedProjectCount >= 1);
  assert.equal(bundle.result.humanFinalAuthorityKept, true);
  assert.equal(bundle.result.canReplaceUserCompletely, false);
  assert.equal(bundle.finalVerdict.canReplaceUserCompletely, false);
});

test('v0.84 Qinglian and Wind are protocol/interface systems, not proof claims', () => {
  const bundle = runIalCivilizationProductOsDemo();
  assert.equal(bundle.result.qinglianIsProtocolModelOnly, true);
  assert.equal(bundle.result.canClaimMysticalVerification, false);
  assert.equal(bundle.qinglianGatekeeper.gateCount, 4);
  assert.equal(bundle.qinglianGatekeeper.defaultMode, 'DEFER_FOR_EVIDENCE');
  assert.ok(bundle.windInterfaceSystem.routeCount >= 8);
  assert.equal(bundle.windInterfaceSystem.windIsProductSystemNotIdentityProof, true);
});

test('v0.84 writes reports, work method and RCL program', () => {
  const outDir = path.join(os.tmpdir(), `rcl-v084-fivefold-${Date.now()}`);
  fs.rmSync(outDir, { recursive: true, force: true });
  const report = writeIalCivilizationProductOsReports(outDir, buildIalCivilizationProductOsSpec());
  assert.equal(report.ok, true);
  for (const file of [
    'ial-civilization-product-os-result.json',
    'ial-civilization-product-os-bundle.json',
    'ial-task-language.md',
    'product-development-government.md',
    'founder-project-arbiter.md',
    'qinglian-gatekeeper-protocol.md',
    'wind-interface-system.md',
    'fivefold-product-os-verdict.md',
    'evidence-ledger.md',
    'fivefold-product-os-work-method.md',
    'ial-civilization-product-os.rcl',
    'canonical-root.txt',
  ]) {
    assert.ok(fs.existsSync(path.join(outDir, file)), file);
  }
  const rcl = renderIalCivilizationProductOsRcl();
  assert.match(rcl, /IalCivilizationProductOsV084/);
  assert.match(rcl, /QINGLIAN_GATEKEEPER/);
  assert.match(rcl, /WIND_INTERFACE_SYSTEM/);
  const method = renderFivefoldProductOsWorkMethodMarkdown();
  assert.match(method, /五位一体/);
  assert.match(method, /柳清莲只作门控协议模型/);
});

test('v0.84 supports custom projects without losing safety policy', () => {
  const bundle = runIalCivilizationProductOs({
    projects: [
      { id: 'custom_project', name: 'Custom Project', goal: 'test custom routing', risk: 0.2, usefulness: 0.9 },
    ],
  });
  assert.equal(bundle.result.projectVerdictCount, 1);
  assert.equal(bundle.result.noRealWorldActionByDefault, true);
  assert.equal(bundle.result.canClaimMysticalVerification, false);
});
