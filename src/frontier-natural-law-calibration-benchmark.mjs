import { createSeededRandom, sha256 } from './reality-compiler-kernel.mjs';

export const RCL_FRONTIER_CALIBRATION_VERSION = '0.1.0-alpha.1';
export const RCL_FRONTIER_CALIBRATION_FORMAT = 'rcl.frontier-natural-law-calibration-benchmark.v0.1';

function round(value, digits = 9) {
  const scale = 10 ** digits;
  return Math.round(Number(value) * scale) / scale;
}

function mean(values) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function variance(values, m = mean(values)) {
  if (values.length <= 1) return 0;
  return values.reduce((s, x) => s + (x - m) ** 2, 0) / (values.length - 1);
}

function pooledSd(a, b) {
  if (a.length <= 1 || b.length <= 1) return 0;
  const va = variance(a);
  const vb = variance(b);
  const numerator = (a.length - 1) * va + (b.length - 1) * vb;
  const denominator = a.length + b.length - 2;
  return denominator > 0 ? Math.sqrt(numerator / denominator) : 0;
}

function evaluate(active, control, thresholds) {
  const ma = mean(active);
  const mc = mean(control);
  const delta = ma - mc;
  const sd = pooledSd(active, control);
  const standardizedEffect = sd > 1e-12 ? delta / sd : 0;
  const detected = delta >= thresholds.minMeanDelta && standardizedEffect >= thresholds.minStandardizedEffect;
  return {
    activeMean: round(ma),
    controlMean: round(mc),
    meanDelta: round(delta),
    pooledSd: round(sd),
    standardizedEffect: round(standardizedEffect),
    detected,
  };
}

function synthesizeDataset(rng, n, injectedEffect, noiseSigma) {
  const control = [];
  const active = [];
  for (let i = 0; i < n; i += 1) {
    control.push(rng.gaussian(0, noiseSigma));
    active.push(rng.gaussian(injectedEffect, noiseSigma));
  }
  return { active, control };
}

export function runFrontierNaturalLawCalibrationBenchmark(laneIds = [], options = {}) {
  const ids = [...new Set(laneIds.map(String))].sort();
  const seed = Number(options.seed ?? 20260811);
  const samplesPerGroup = Math.max(24, Number(options.samplesPerGroup ?? 64));
  const noiseSigma = Math.max(0.1, Number(options.noiseSigma ?? 1));
  const injectedEffect = Math.max(0.2, Number(options.injectedEffect ?? 0.9));
  const thresholds = {
    minMeanDelta: Number(options.minMeanDelta ?? 0.35),
    minStandardizedEffect: Number(options.minStandardizedEffect ?? 0.35),
  };
  const rows = [];
  for (let index = 0; index < ids.length; index += 1) {
    const laneId = ids[index];
    const nullRng = createSeededRandom(seed + index * 101 + 1);
    const injectedRng = createSeededRandom(seed + index * 101 + 2);
    const nullData = synthesizeDataset(nullRng, samplesPerGroup, 0, noiseSigma);
    const injectedData = synthesizeDataset(injectedRng, samplesPerGroup, injectedEffect, noiseSigma);
    const nullEval = evaluate(nullData.active, nullData.control, thresholds);
    const injectedEval = evaluate(injectedData.active, injectedData.control, thresholds);
    rows.push({
      laneId,
      nullControl: {
        expected: 'not-detected',
        ...nullEval,
        pass: nullEval.detected === false,
      },
      injectedPositiveControl: {
        expected: 'detected',
        ...injectedEval,
        pass: injectedEval.detected === true,
      },
      labelLeakageGuard: 'evaluator receives only active/control numeric arrays; candidate mechanism semantics do not change thresholds',
      root: sha256({ laneId, nullEval, injectedEval, samplesPerGroup, noiseSigma, injectedEffect, thresholds }),
    });
  }
  const nullControlsPass = rows.every(row => row.nullControl.pass);
  const injectedControlsPass = rows.every(row => row.injectedPositiveControl.pass);
  const calibrationPassed = ids.length > 0 && nullControlsPass && injectedControlsPass;
  const result = {
    format: RCL_FRONTIER_CALIBRATION_FORMAT,
    version: RCL_FRONTIER_CALIBRATION_VERSION,
    seed,
    samplesPerGroup,
    noiseSigma,
    injectedEffect,
    thresholds,
    laneCount: ids.length,
    nullControlsPass,
    injectedControlsPass,
    calibrationPassed,
    boundary: 'synthetic_calibration_only_not_external_effect_evidence',
    externalRealityVerified: false,
    rows,
    root: null,
  };
  result.root = sha256({ ...result, root: undefined });
  return result;
}
