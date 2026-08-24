import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import process from 'node:process';
import { sha256 } from './reality-compiler-kernel.mjs';
import {
  buildFrontierExternalObservationContract,
  runFrontierExternalObservationPipeline,
} from './frontier-external-observation-contract.mjs';

export const RCL_FRONTIER_KNOWN_EXTERNAL_HOST_CONTROL_VERSION = '0.1.0-alpha.1';
export const RCL_FRONTIER_KNOWN_EXTERNAL_HOST_CONTROL_FORMAT = 'rcl.frontier-known-external-host-control.v0.1';

function round(value, digits = 9) {
  const scale = 10 ** digits;
  return Math.round(Number(value) * scale) / scale;
}

function stableSchedule(rows, seed) {
  return rows
    .map((row, index) => ({ row, rank: sha256(`${seed}:${index}:${row.symbolCondition}:${row.geometryCondition}:${row.replicate}`) }))
    .sort((a, b) => a.rank.localeCompare(b.rank))
    .map(item => item.row);
}

const SLEEPER = new Int32Array(new SharedArrayBuffer(4));

function measureWait(delayMs, repeats = 1) {
  const measurements = [];
  for (let repeat = 0; repeat < repeats; repeat += 1) {
    const start = process.hrtime.bigint();
    Atomics.wait(SLEEPER, 0, 0, delayMs);
    const end = process.hrtime.bigint();
    measurements.push(Number(end - start) / 1e6);
  }
  const responseMs = measurements.reduce((a, b) => a + b, 0) / measurements.length;
  return { responseMs: round(responseMs, 6), witness: measurements.length };
}

function delayForCell(symbolActive, geometryActive, options = {}) {
  const base = Number(options.baseDelayMs ?? 1);
  const symbol = symbolActive ? Number(options.symbolDelayMs ?? 2) : 0;
  const geometry = geometryActive ? Number(options.geometryDelayMs ?? 3) : 0;
  const interaction = symbolActive && geometryActive ? Number(options.interactionDelayMs ?? 8) : 0;
  return Math.max(0, base + symbol + geometry + interaction);
}

export function acquireKnownExternalHostTimingContract(options = {}) {
  const seed = Number(options.seed ?? 20260811);
  const samplesPerCell = Math.max(8, Math.trunc(Number(options.samplesPerCell ?? 12)));
  const repeats = Math.max(1, Math.trunc(Number(options.repeats ?? 2)));
  const schedule = [];
  for (const symbolCondition of ['control', 'active']) {
    for (const geometryCondition of ['control', 'active']) {
      for (let replicate = 0; replicate < samplesPerCell; replicate += 1) {
        schedule.push({ symbolCondition, geometryCondition, replicate });
      }
    }
  }
  const randomized = stableSchedule(schedule, seed);
  Atomics.wait(SLEEPER, 0, 0, 2);
  const rows = [];
  let witnessAccumulator = 0;
  const acquisitionStart = new Date().toISOString();
  for (let index = 0; index < randomized.length; index += 1) {
    const condition = randomized[index];
    const symbolActive = condition.symbolCondition === 'active';
    const geometryActive = condition.geometryCondition === 'active';
    const delayMs = delayForCell(symbolActive, geometryActive, options);
    const measured = measureWait(delayMs, repeats);
    witnessAccumulator ^= measured.witness;
    rows.push({
      observationId: `host_${String(index + 1).padStart(4, '0')}`,
      timestamp: new Date().toISOString(),
      instrumentId: 'node-process.hrtime.bigint',
      session: index % 8,
      symbolCondition: condition.symbolCondition,
      geometryCondition: condition.geometryCondition,
      response: measured.responseMs,
      qualityFlags: [],
    });
  }
  const acquisitionEnd = new Date().toISOString();
  const hostFingerprint = sha256({
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    cpus: os.cpus().map(cpu => ({ model: cpu.model, speed: cpu.speed })),
  });
  const contract = buildFrontierExternalObservationContract({
    id: String(options.id ?? 'known_external_host_timing_interaction_v0_1'),
    purpose: 'Measure a known engineered 2x2 host-compute timing interaction using the real monotonic host clock, then route those observations through the frontier external-observation blind pipeline.',
    provenance: {
      sourceType: 'software_control',
      sourceUri: `host://node/${process.version}/${process.platform}/${process.arch}`,
      collector: 'RCL Frontier Known External Host Control v0.1',
      acquiredAt: acquisitionStart,
      licenseOrPermission: 'local-process-measurement-authorized',
      acquisitionMethod: `randomized 2x2 Atomics.wait timing measured by process.hrtime.bigint; repeats=${repeats}; acquisitionEnd=${acquisitionEnd}; hostFingerprint=${hostFingerprint}; witness=${witnessAccumulator}`,
    },
    calibration: {
      status: 'valid',
      referenceId: 'node-process.hrtime.bigint-monotonic-clock',
      measuredAt: acquisitionStart,
      method: 'monotonic high-resolution process clock; warmup executed before acquisition',
      tolerance: 0.001,
      notes: 'Timing measurements validate the data path using an ordinary engineered software effect; they are not a physics-instrument calibration.',
    },
    rows,
  });
  return {
    format: RCL_FRONTIER_KNOWN_EXTERNAL_HOST_CONTROL_FORMAT,
    version: RCL_FRONTIER_KNOWN_EXTERNAL_HOST_CONTROL_VERSION,
    contract,
    acquisition: {
      seed,
      samplesPerCell,
      repeats,
      interactionDelayMs: Number(options.interactionDelayMs ?? 8),
      hostFingerprint,
      witnessAccumulator,
      acquisitionStart,
      acquisitionEnd,
    },
    externalRealityVerified: false,
    root: sha256({ contract: contract.root, hostFingerprint, witnessAccumulator, acquisitionStart, acquisitionEnd }),
  };
}

export function runKnownExternalHostTimingControl(options = {}) {
  const acquired = acquireKnownExternalHostTimingContract(options);
  const pipeline = runFrontierExternalObservationPipeline(acquired.contract, { randomizationSeed: Number(options.randomizationSeed ?? 7731) });
  return {
    format: 'rcl.frontier-known-external-host-control-result.v0.1',
    version: RCL_FRONTIER_KNOWN_EXTERNAL_HOST_CONTROL_VERSION,
    ok: pipeline.ok === true && pipeline.score.detected === true,
    detected: pipeline.score.detected,
    modelWinner: pipeline.score.modelSelection?.winner ?? null,
    bicMargin: pipeline.score.modelSelection?.bicMargin ?? null,
    interactionDelta: pipeline.score.metrics?.interactionDelta ?? null,
    standardizedInteraction: pipeline.score.metrics?.standardizedInteraction ?? null,
    contractRoot: acquired.contract.root,
    rawDataRoot: acquired.contract.rawDataRoot,
    pipelineRoot: pipeline.root,
    hostFingerprint: acquired.acquisition.hostFingerprint,
    acquisitionStart: acquired.acquisition.acquisitionStart,
    acquisitionEnd: acquired.acquisition.acquisitionEnd,
    evidenceClass: 'real_host_measurement_known_engineered_software_control',
    boundary: 'external_host_measurement_validates_real_data_path_not_unknown_natural_law',
    externalRealityVerified: false,
    root: sha256({ acquired: acquired.root, pipeline: pipeline.root }),
    acquired,
    pipeline,
  };
}

export function runKnownExternalHostAdditiveControl(options = {}) {
  const acquired = acquireKnownExternalHostTimingContract({
    ...options,
    id: 'known_external_host_timing_additive_v0_1',
    interactionDelayMs: 0,
    symbolDelayMs: Number(options.symbolDelayMs ?? 4),
    geometryDelayMs: Number(options.geometryDelayMs ?? 6),
  });
  const pipeline = runFrontierExternalObservationPipeline(acquired.contract, { randomizationSeed: Number(options.randomizationSeed ?? 7731) });
  return {
    ok: pipeline.ok === true && pipeline.score.detected === false,
    detected: pipeline.score.detected,
    modelWinner: pipeline.score.modelSelection?.winner ?? null,
    contractRoot: acquired.contract.root,
    pipelineRoot: pipeline.root,
    evidenceClass: 'real_host_measurement_additive_negative_control',
    boundary: 'known_additive_host_control_should_not_be_promoted_to_interaction',
    externalRealityVerified: false,
    root: sha256({ acquired: acquired.root, pipeline: pipeline.root }),
    acquired,
    pipeline,
  };
}

export function runKnownExternalHostControlSuite(options = {}) {
  const positive = runKnownExternalHostTimingControl(options);
  const additive = runKnownExternalHostAdditiveControl(options);
  const result = {
    format: 'rcl.frontier-known-external-host-control-suite.v0.1',
    version: RCL_FRONTIER_KNOWN_EXTERNAL_HOST_CONTROL_VERSION,
    positiveDetected: positive.detected === true,
    additiveRejected: additive.detected === false,
    positiveModelWinner: positive.modelWinner,
    additiveModelWinner: additive.modelWinner,
    hostFingerprint: positive.hostFingerprint,
    realMeasurementsCollected: true,
    externalRealityVerified: false,
    boundary: 'first_real_host_known_effect_dataset_through_frontier_contract_not_unknown_law_evidence',
    root: null,
  };
  result.ok = result.positiveDetected && result.additiveRejected;
  result.verdict = result.ok
    ? 'PASS / real host timing measurements crossed provenance, calibration, immutable contract, blinding, scoring and reveal gates.'
    : 'CANDIDATE / real host acquisition completed but one known-effect control failed the blind classifier.';
  result.root = sha256({ positive: positive.root, additive: additive.root, summary: { ...result, root: undefined } });
  return { ...result, positive, additive };
}

export function writeKnownExternalHostControlReports(outputDir = 'output/frontier-known-external-host-control-v0.1', options = {}) {
  const dir = path.resolve(outputDir);
  fs.mkdirSync(dir, { recursive: true });
  const suite = runKnownExternalHostControlSuite(options);
  fs.writeFileSync(path.join(dir, 'host-control-suite.json'), `${JSON.stringify({
    format: suite.format,
    version: suite.version,
    ok: suite.ok,
    verdict: suite.verdict,
    positiveDetected: suite.positiveDetected,
    additiveRejected: suite.additiveRejected,
    positiveModelWinner: suite.positiveModelWinner,
    additiveModelWinner: suite.additiveModelWinner,
    hostFingerprint: suite.hostFingerprint,
    realMeasurementsCollected: suite.realMeasurementsCollected,
    externalRealityVerified: suite.externalRealityVerified,
    boundary: suite.boundary,
    root: suite.root,
  }, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'positive-contract.json'), `${JSON.stringify(suite.positive.acquired.contract, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'positive-blind-score.json'), `${JSON.stringify(suite.positive.pipeline.score, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'positive-reveal.json'), `${JSON.stringify(suite.positive.pipeline.reveal, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'additive-contract.json'), `${JSON.stringify(suite.additive.acquired.contract, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'additive-blind-score.json'), `${JSON.stringify(suite.additive.pipeline.score, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'README.md'), [
    '# RCL Known External Host Control v0.1',
    '',
    `Verdict: **${suite.verdict}**`,
    `Positive interaction detected: **${suite.positiveDetected}**`,
    `Additive control rejected: **${suite.additiveRejected}**`,
    `Host fingerprint: \`${suite.hostFingerprint}\``,
    'External reality verified: **false**',
    '',
    'These are real host timing measurements of ordinary engineered software effects. They validate the external-data path, not any unknown natural law.',
  ].join('\n') + '\n');
  return { ok: suite.ok, outputDir: dir, root: suite.root, externalRealityVerified: false };
}
