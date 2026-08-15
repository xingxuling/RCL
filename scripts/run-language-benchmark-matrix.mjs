#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { evidenceRoot, STRESS_STATUS } from '../src/universal-program-stress.mjs';
import {
  buildProviderEvidenceComparisons,
  evaluateDominanceArena,
} from '../src/rcl-dominance-arena.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const [, , manifestArg = 'examples/dominance-arena/compiler-workload-matrix.v0.1.json', outputArg = 'output/dominance-arena/compiler-workload-matrix-v0.1'] = process.argv;
const manifestPath = path.resolve(root, manifestArg);
const outputDir = path.resolve(root, outputArg);
const runnerPath = path.join(root, 'scripts', 'run-dominance-arena-microbench.mjs');

function fail(message) {
  throw new Error(`RCL_LANGUAGE_MATRIX:${message}`);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function mean(values) {
  const numbers = values.filter(finiteNumber);
  return numbers.length ? Number((numbers.reduce((sum, value) => sum + value, 0) / numbers.length).toFixed(3)) : null;
}

function normalizeManifest(raw) {
  if (!raw || raw.schema !== 'rcl.compiler-workload-matrix.manifest.v0.1') fail(`unsupported manifest schema ${raw?.schema ?? 'missing'}`);
  if (!Array.isArray(raw.providers) || raw.providers.length < 2) fail('at least two providers are required');
  if (!Array.isArray(raw.workloads) || raw.workloads.length === 0) fail('at least one workload is required');
  const providerIds = new Set(raw.providers.map(provider => provider.id));
  if (providerIds.size !== raw.providers.length || raw.providers.some(provider => !provider.id || !provider.mode || !provider.role)) fail('provider ids, modes and roles must be unique and declared');
  const candidate = raw.providers.find(provider => provider.role === 'candidate');
  const references = raw.providers.filter(provider => provider.role === 'reference');
  if (!candidate || references.length === 0) fail('candidate and reference providers are required');
  return {
    ...raw,
    metricSpecs: (raw.metrics ?? []).map(metric => ({ ...metric })),
    requiredMetrics: (raw.metrics ?? []).filter(metric => metric.required !== false).map(metric => metric.id),
    candidate,
    references,
  };
}

function runChild(provider, workloadPath, sourcePath, evidencePath) {
  const result = spawnSync(process.execPath, [
    runnerPath,
    provider.mode,
    workloadPath,
    sourcePath,
    evidencePath,
  ], {
    cwd: root,
    encoding: 'utf8',
    timeout: 240_000,
    maxBuffer: 8 * 1024 * 1024,
    windowsHide: true,
  });
  let evidence = null;
  if (fs.existsSync(evidencePath)) {
    try { evidence = readJson(evidencePath); } catch (error) {
      evidence = {
        schema: 'rcl.compiler-microbench.evidence.v0.1',
        status: STRESS_STATUS.FAIL,
        failure: { code: 'MATRIX_EVIDENCE_INVALID', message: error.message },
      };
    }
  }
  if (!evidence) {
    const blocked = result.error?.code === 'ETIMEDOUT' || result.error?.code === 'ENOENT';
    evidence = {
      schema: 'rcl.compiler-microbench.evidence.v0.1',
      status: blocked ? STRESS_STATUS.BLOCKED : STRESS_STATUS.FAIL,
      failure: {
        code: result.error?.code ?? 'MATRIX_RUNNER_NO_EVIDENCE',
        message: result.error?.message ?? result.stderr?.trim() ?? `runner exited with ${result.status}`,
      },
    };
  } else if (result.status !== 0 && evidence.status === STRESS_STATUS.PASS) {
    evidence = {
      ...evidence,
      status: STRESS_STATUS.FAIL,
      failure: {
        code: 'MATRIX_RUNNER_EXIT_WITH_PASS_EVIDENCE',
        message: `runner exited with ${result.status} after writing PASS evidence`,
      },
    };
  }
  return {
    id: provider.id,
    role: provider.role,
    mode: provider.mode,
    label: provider.label ?? provider.id,
    status: evidence.status,
    evidenceStatus: evidence.status,
    evidence,
    receipt: {
      processExit: result.status,
      stdoutTail: String(result.stdout ?? '').slice(-2000),
      stderrTail: String(result.stderr ?? '').slice(-2000),
      error: result.error?.message ?? null,
    },
  };
}

function comparisonContract(manifest, references) {
  const metrics = Object.fromEntries(manifest.requiredMetrics.map(id => [id, {
    candidatePath: `metrics.${id}`,
    referencePath: `metrics.${id}`,
  }]));
  return {
    candidateId: manifest.candidate.id,
    referenceIds: references.map(provider => provider.id),
    candidateInputRootPath: 'inputRoot',
    referenceInputRootPath: 'inputRoot',
    metrics,
    note: 'Only raw metrics from successful providers sharing the exact workload inputRoot are comparable.',
  };
}

function selectWorkloadProviders(manifest, workloadEntry) {
  const allowed = Array.isArray(workloadEntry.providers) ? new Set(workloadEntry.providers) : null;
  const providers = manifest.providers.filter(provider => !allowed || allowed.has(provider.id) || allowed.has(provider.mode));
  if (!providers.some(provider => provider.id === manifest.candidate.id)) fail(`candidate provider is not selected for ${workloadEntry.id}`);
  if (!providers.some(provider => provider.role === 'reference')) fail(`no reference provider is selected for ${workloadEntry.id}`);
  return providers;
}

function providerAverages(results, providers) {
  return Object.fromEntries(providers.map(provider => {
    const rows = results
      .map(workload => workload.providers.find(item => item.id === provider.id))
      .filter(item => item?.status === STRESS_STATUS.PASS);
    return [provider.id, {
      label: provider.label ?? provider.id,
      passCount: rows.length,
      correctness: mean(rows.map(item => item.evidence.metrics?.correctness)),
      compileBuildSpeed: mean(rows.map(item => item.evidence.metrics?.compileBuildSpeed)),
      runtimeMs: mean(rows.map(item => item.evidence.metrics?.runtimeMs)),
      artifactFootprintBytes: mean(rows.map(item => item.evidence.metrics?.artifactFootprintBytes)),
      note: 'Descriptive mean across PASS workloads; never used as a dominance score.',
    }];
  }));
}

function matrixStatus(workloadResults) {
  if (workloadResults.some(item => item.dominance.status === STRESS_STATUS.FAIL)) return STRESS_STATUS.FAIL;
  if (workloadResults.some(item => item.dominance.status !== STRESS_STATUS.PASS)) return STRESS_STATUS.UNVERIFIED;
  return STRESS_STATUS.PASS;
}

try {
  const manifest = normalizeManifest(readJson(manifestPath));
  const sourceRevisionResult = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', timeout: 10_000, windowsHide: true });
  const sourceRevision = sourceRevisionResult.status === 0 ? sourceRevisionResult.stdout.trim() : null;
  const workloadResults = [];
  for (const workloadEntry of manifest.workloads) {
    if (!workloadEntry.id || !workloadEntry.workload || !workloadEntry.sources) fail('every workload requires id, workload and sources');
    const workloadPath = path.resolve(root, workloadEntry.workload);
    const workloadBytes = fs.readFileSync(workloadPath);
    const workload = JSON.parse(workloadBytes.toString('utf8'));
    const workloadOutputDir = path.join(outputDir, workloadEntry.id);
    fs.mkdirSync(workloadOutputDir, { recursive: true });
    const selectedProviders = selectWorkloadProviders(manifest, workloadEntry);
    const providers = selectedProviders.map(provider => {
      const source = workloadEntry.sources[provider.mode];
      if (typeof source !== 'string' || source.length === 0) fail(`missing ${provider.mode} source for ${workloadEntry.id}`);
      const sourcePath = path.resolve(root, source);
      const evidencePath = path.join(workloadOutputDir, `${provider.mode}.json`);
      return runChild(provider, workloadPath, sourcePath, evidencePath);
    });
    const candidate = providers.find(provider => provider.id === manifest.candidate.id);
    const references = manifest.references
      .filter(provider => selectedProviders.some(selected => selected.id === provider.id))
      .map(provider => providers.find(item => item.id === provider.id));
    const rawComparisons = buildProviderEvidenceComparisons({
      contract: comparisonContract(manifest, references),
      candidate,
      references,
      requiredMetrics: manifest.requiredMetrics,
      metricSpecs: manifest.metricSpecs,
    });
    const dominance = evaluateDominanceArena({
      comparisons: rawComparisons,
      requiredMetrics: manifest.requiredMetrics,
      metricSpecs: manifest.metricSpecs,
    });
    workloadResults.push({
      id: workloadEntry.id,
      required: workloadEntry.required !== false,
      workloadPath,
      workloadInputRoot: sha256(workloadBytes),
      sources: workloadEntry.sources,
      selectedProviders: selectedProviders.map(provider => provider.id),
      notes: workloadEntry.notes ?? [],
      providers,
      dominance,
    });
  }
  const reportWithoutRoot = {
    schema: 'rcl.compiler-workload-matrix.report.v0.1',
    manifestPath,
    manifestId: manifest.id,
    sourceRevision: {
      value: sourceRevision,
      status: sourceRevision ? STRESS_STATUS.PASS : STRESS_STATUS.UNVERIFIED,
    },
    metrics: manifest.metricSpecs,
    workloadCount: workloadResults.length,
    workloadResults,
    providerAverages: providerAverages(workloadResults, manifest.providers),
    capabilityGaps: (manifest.capabilityGaps ?? []).map(gap => ({
      ...gap,
      evidenceRoot: evidenceRoot(gap),
    })),
    status: matrixStatus(workloadResults),
    boundary: [
      'Workload dominance is non-compensatory and is evaluated per workload.',
      'Provider averages are descriptive only and never promote a losing workload.',
      'File I/O and concurrency are recorded as BLOCKED capability gaps until RCL has real declared execution paths.',
      'This report is not whole-language, ecosystem or commercial-product superiority evidence.',
    ],
  };
  const report = { ...reportWithoutRoot, reportRoot: evidenceRoot(reportWithoutRoot) };
  fs.mkdirSync(outputDir, { recursive: true });
  const reportPath = path.join(outputDir, 'compiler-workload-matrix-report.json');
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({
    status: report.status,
    reportPath,
    reportRoot: report.reportRoot,
    sourceRevision,
    workloadCount: report.workloadCount,
    capabilityGapCount: report.capabilityGaps.length,
  }, null, 2));
} catch (error) {
  console.error(error.stack ?? String(error));
  process.exitCode = 1;
}
