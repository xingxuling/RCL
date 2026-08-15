import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const matrixScript = path.join(root, 'scripts', 'run-language-benchmark-matrix.mjs');
const manifest = path.join(root, 'examples', 'dominance-arena', 'compiler-workload-matrix.v0.1.json');

test('language workload matrix runs real RCL, rustc and CPython providers without hiding losses', () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-language-matrix-'));
  try {
    const result = spawnSync(process.execPath, [matrixScript, manifest, outputDir], {
      cwd: root,
      encoding: 'utf8',
      timeout: 300_000,
      maxBuffer: 8 * 1024 * 1024,
      windowsHide: true,
    });
    assert.equal(result.error, undefined, result.error?.message);
    assert.equal(result.status, 0, result.stderr);
    const reportPath = path.join(outputDir, 'compiler-workload-matrix-report.json');
    assert.ok(fs.existsSync(reportPath));
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    assert.equal(report.schema, 'rcl.compiler-workload-matrix.report.v0.1');
    assert.equal(report.workloadCount, 4);
    assert.equal(report.capabilityGaps.length, 3);
    assert.ok(report.capabilityGaps.every(gap => gap.status === 'BLOCKED'));
    assert.equal(report.workloadResults.every(workload => workload.providers.every(provider => provider.status === 'PASS')), true);
    assert.equal(report.workloadResults.every(workload => workload.providers.every(provider => provider.evidence.inputRoot === workload.workloadInputRoot)), true);
    assert.equal(report.workloadResults.some(workload => workload.dominance.comparisons.some(comparison => comparison.status === 'FAIL')), true);
    assert.equal(report.workloadResults.some(workload => workload.dominance.comparisons.some(comparison => comparison.status === 'PASS')), true);
    assert.match(report.reportRoot, /^[0-9a-f]{64}$/);
  } finally {
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
});
