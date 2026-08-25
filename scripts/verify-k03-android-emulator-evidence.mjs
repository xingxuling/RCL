#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { compileRclAndroidApplication } from '../src/android-application-compiler.mjs';
import { evidenceRoot } from '../src/universal-program-stress.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DEFAULT_EVIDENCE_PATH = path.join(ROOT, 'examples', 'universal-stress', 'evidence', 'k03-android-emulator-v0.1.json');

export function verifyK03AndroidEmulatorEvidence(options = {}) {
  const evidencePath = path.resolve(options.evidencePath ?? DEFAULT_EVIDENCE_PATH);
  const report = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
  const source = fs.readFileSync(path.join(ROOT, report.source.rclPath), 'utf8');
  const spec = JSON.parse(fs.readFileSync(path.join(ROOT, report.source.specPath), 'utf8'));
  const manifest = compileRclAndroidApplication(source, spec);
  const expectedRoot = evidenceRoot({ ...report, generatedAt: undefined, reportRoot: undefined });
  if (report.format !== 'rcl.k03.android-emulator-evidence.v0.1') throw new Error('RCL_K03_EMULATOR_EVIDENCE_FORMAT');
  if (report.reportRoot !== expectedRoot) throw new Error('RCL_K03_EMULATOR_EVIDENCE_ROOT');
  if (report.source.manifestRoot !== manifest.manifestRoot || report.source.runtimeManifestRoot !== manifest.manifestRoot) {
    throw new Error('RCL_K03_EMULATOR_SOURCE_DRIFT');
  }
  const rounds = report.runtime?.transactionRounds ?? [];
  const admitted = report.status === 'PASS'
    && report.build?.status === 'PASS'
    && /^[0-9a-f]{64}$/u.test(report.build?.apkSha256 ?? '')
    && String(report.device?.serial ?? '').startsWith('emulator-')
    && Number.isInteger(report.device?.apiLevel)
    && report.runtime?.install === 'PASS'
    && report.runtime?.coldLaunch === 'PASS'
    && report.runtime?.initialState === 'PASS'
    && report.runtime?.emptyInputGuard === 'PASS'
    && report.runtime?.lifecycleRestoreAfterRotation === 'PASS'
    && rounds.length === 5
    && rounds.every((round) => round.incrementPass === true && round.resetPass === true)
    && report.performance?.status === 'PASS'
    && report.performance?.samples?.length === 5
    && report.performance.p95Ms <= report.performance.interactionBudgetMs
    && report.runtime.startupTotalMs <= report.performance.startupBudgetMs
    && report.gates?.EXECUTE === 'PASS'
    && report.gates?.CORRECT === 'PASS'
    && report.gates?.PERFORMANCE === 'PASS';
  return {
    admitted,
    status: admitted ? 'PASS_REAL_ANDROID_EMULATOR_EVIDENCE' : 'FAIL_ANDROID_EMULATOR_EVIDENCE',
    reportRoot: report.reportRoot,
    verifiedAt: report.generatedAt,
    evidencePath,
    device: report.device,
    performance: report.performance,
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const result = verifyK03AndroidEmulatorEvidence();
  console.log(JSON.stringify(result, null, 2));
  if (!result.admitted) process.exitCode = 1;
}
