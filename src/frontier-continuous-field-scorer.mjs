import { createSeededRandom, sha256 } from './reality-compiler-kernel.mjs';

export const RCL_FRONTIER_CONTINUOUS_FIELD_VERSION = '0.1.0-alpha.1';
export const RCL_FRONTIER_CONTINUOUS_FIELD_PAYLOAD_FORMAT = 'rcl.frontier-continuous-field-timeseries-payload.v0.1';
export const RCL_FRONTIER_CONTINUOUS_FIELD_SCORE_FORMAT = 'rcl.frontier-continuous-field-score.v0.1';

function round(value, digits = 9) {
  const scale = 10 ** digits;
  return Math.round(Number(value) * scale) / scale;
}

function mean(xs) {
  return xs.length ? xs.reduce((sum, x) => sum + Number(x), 0) / xs.length : 0;
}

function variance(xs, m = mean(xs)) {
  if (xs.length <= 1) return 0;
  return xs.reduce((sum, x) => sum + (Number(x) - m) ** 2, 0) / (xs.length - 1);
}

function covariance(a, b) {
  const n = Math.min(a.length, b.length);
  if (n <= 1) return 0;
  const aa = a.slice(0, n);
  const bb = b.slice(0, n);
  const ma = mean(aa);
  const mb = mean(bb);
  return aa.reduce((sum, x, i) => sum + (Number(x) - ma) * (Number(bb[i]) - mb), 0) / (n - 1);
}

function correlation(a, b) {
  const n = Math.min(a.length, b.length);
  if (n <= 2) return 0;
  const aa = a.slice(0, n);
  const bb = b.slice(0, n);
  const va = variance(aa);
  const vb = variance(bb);
  const denom = Math.sqrt(Math.max(0, va * vb));
  if (denom <= 1e-12) return 0;
  return Math.max(-1, Math.min(1, covariance(aa, bb) / denom));
}

function fisherZ(r) {
  const x = Math.max(-0.999999, Math.min(0.999999, Number(r)));
  return 0.5 * Math.log((1 + x) / (1 - x));
}

function residualizeAgainst(signal, nuisance) {
  const n = Math.min(signal.length, nuisance.length);
  if (!n) return [];
  const y = signal.slice(0, n).map(Number);
  const x = nuisance.slice(0, n).map(Number);
  const vx = variance(x);
  if (vx <= 1e-12) {
    const my = mean(y);
    return y.map((value) => value - my);
  }
  const beta = covariance(x, y) / vx;
  const intercept = mean(y) - beta * mean(x);
  return y.map((value, i) => value - (intercept + beta * x[i]));
}

function laggedCorrelation(source, receiver, lagSamples) {
  const lag = Math.trunc(Number(lagSamples));
  if (lag >= 0) {
    const n = Math.min(source.length, receiver.length - lag);
    if (n <= 4) return 0;
    return correlation(source.slice(0, n), receiver.slice(lag, lag + n));
  }
  const offset = Math.abs(lag);
  const n = Math.min(source.length - offset, receiver.length);
  if (n <= 4) return 0;
  return correlation(source.slice(offset, offset + n), receiver.slice(0, n));
}

function linearFit(x, y) {
  const n = Math.min(x.length, y.length);
  if (n <= 2) return { intercept: 0, beta: 0, r2: 0, residualSd: 0, correlation: 0 };
  const xx = x.slice(0, n).map(Number);
  const yy = y.slice(0, n).map(Number);
  const vx = variance(xx);
  const beta = vx > 1e-12 ? covariance(xx, yy) / vx : 0;
  const intercept = mean(yy) - beta * mean(xx);
  const fitted = xx.map((value) => intercept + beta * value);
  const residuals = yy.map((value, i) => value - fitted[i]);
  const residualSd = Math.sqrt(Math.max(0, variance(residuals)));
  const vy = variance(yy);
  const residualVar = variance(residuals);
  const r2 = vy > 1e-12 ? Math.max(0, Math.min(1, 1 - residualVar / vy)) : 0;
  return { intercept, beta, r2, residualSd, correlation: correlation(xx, yy) };
}

function stableShuffle(values, seed) {
  const rng = createSeededRandom(seed);
  const out = [...values];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function kernelPredictor(session, kernel) {
  const distance = Number(session.distance);
  const phase = Number(session.clockPhaseRad);
  const shield = Number(session.shieldCondition);
  const distanceTerm = Math.exp(-Math.max(0, distance) / Number(kernel.distanceScale));
  const phaseTerm = Math.cos(phase);
  const shieldTerm = shield === 1 ? Number(kernel.shieldTransmission) : 1;
  return distanceTerm * phaseTerm * shieldTerm;
}

export function buildContinuousFieldPayload(input = {}) {
  const sessions = (Array.isArray(input.sessions) ? input.sessions : []).map((session, index) => ({
    sessionId: String(session.sessionId ?? `session_${String(index + 1).padStart(3, '0')}`),
    distance: Number(session.distance),
    clockPhaseRad: Number(session.clockPhaseRad),
    shieldCondition: Number(session.shieldCondition),
    sampleRateHz: Number(session.sampleRateHz),
    source: Array.isArray(session.source) ? session.source.map(Number) : [],
    receiver: Array.isArray(session.receiver) ? session.receiver.map(Number) : [],
    environment: Array.isArray(session.environment) ? session.environment.map(Number) : [],
    qualityFlags: Array.isArray(session.qualityFlags) ? session.qualityFlags.map(String).sort() : [],
  }));
  const payload = {
    format: RCL_FRONTIER_CONTINUOUS_FIELD_PAYLOAD_FORMAT,
    version: RCL_FRONTIER_CONTINUOUS_FIELD_VERSION,
    id: String(input.id ?? 'continuous_field_payload_v0_1'),
    sessions,
    analysisPlan: {
      targetLagSamples: Math.trunc(Number(input.analysisPlan?.targetLagSamples ?? 3)),
      distanceScale: Number(input.analysisPlan?.distanceScale ?? 4),
      shieldTransmission: Number(input.analysisPlan?.shieldTransmission ?? 0.35),
      residualizeEnvironment: input.analysisPlan?.residualizeEnvironment !== false,
      permutationCount: Math.max(99, Math.trunc(Number(input.analysisPlan?.permutationCount ?? 199))),
      permutationSeed: Math.trunc(Number(input.analysisPlan?.permutationSeed ?? 20260811)),
      declaredBeforeScoring: input.analysisPlan?.declaredBeforeScoring !== false,
      lagSearchForbidden: true,
      phaseSearchForbidden: true,
      distanceScaleSearchForbidden: true,
    },
    provenance: input.provenance && typeof input.provenance === 'object' ? { ...input.provenance } : {},
    externalRealityVerified: false,
    newNaturalLawVerified: false,
    magicVerified: false,
    root: null,
  };
  payload.root = sha256({ ...payload, root: undefined });
  return payload;
}

export function validateContinuousFieldPayload(payload = {}, grammar = null) {
  const failures = [];
  if (payload.format !== RCL_FRONTIER_CONTINUOUS_FIELD_PAYLOAD_FORMAT) failures.push('unsupported_continuous_field_payload_format');
  if (payload.analysisPlan?.declaredBeforeScoring !== true) failures.push('analysis_plan_must_be_declared_before_scoring');
  if (payload.analysisPlan?.lagSearchForbidden !== true) failures.push('lag_search_must_be_forbidden');
  if (payload.analysisPlan?.phaseSearchForbidden !== true) failures.push('phase_search_must_be_forbidden');
  if (payload.analysisPlan?.distanceScaleSearchForbidden !== true) failures.push('distance_scale_search_must_be_forbidden');
  if (!Number.isInteger(payload.analysisPlan?.targetLagSamples)) failures.push('invalid_target_lag');
  if (!(Number(payload.analysisPlan?.distanceScale) > 0)) failures.push('invalid_distance_scale');
  if (!(Number(payload.analysisPlan?.shieldTransmission) >= 0 && Number(payload.analysisPlan?.shieldTransmission) <= 1)) failures.push('invalid_shield_transmission');
  if (!Array.isArray(payload.sessions) || payload.sessions.length < 12) failures.push('insufficient_sessions');

  const ids = new Set();
  const distanceSet = new Set();
  const phaseSet = new Set();
  const shieldSet = new Set();
  for (const session of payload.sessions ?? []) {
    if (!session.sessionId || ids.has(session.sessionId)) failures.push('duplicate_or_missing_session_id');
    ids.add(session.sessionId);
    if (!Number.isFinite(session.distance) || session.distance < 0) failures.push(`invalid_distance:${session.sessionId}`);
    if (!Number.isFinite(session.clockPhaseRad)) failures.push(`invalid_phase:${session.sessionId}`);
    if (![0, 1].includes(Number(session.shieldCondition))) failures.push(`invalid_shield_condition:${session.sessionId}`);
    if (!(Number(session.sampleRateHz) > 0)) failures.push(`invalid_sample_rate:${session.sessionId}`);
    const lengths = [session.source?.length ?? 0, session.receiver?.length ?? 0, session.environment?.length ?? 0];
    if (Math.min(...lengths) < 64 || new Set(lengths).size !== 1) failures.push(`invalid_or_short_timeseries:${session.sessionId}`);
    if ([...(session.source ?? []), ...(session.receiver ?? []), ...(session.environment ?? [])].some((x) => !Number.isFinite(Number(x)))) failures.push(`non_finite_timeseries_value:${session.sessionId}`);
    distanceSet.add(round(session.distance, 6));
    phaseSet.add(round(session.clockPhaseRad, 6));
    shieldSet.add(Number(session.shieldCondition));
  }
  if (distanceSet.size < 3) failures.push('insufficient_distance_coverage');
  if (phaseSet.size < 4) failures.push('insufficient_phase_coverage');
  if (shieldSet.size < 2) failures.push('insufficient_shield_coverage');

  if (grammar) {
    if (grammar.family !== 'continuous_field') failures.push('grammar_family_mismatch');
    const factors = [...new Set((grammar.factors ?? []).map(String))].sort();
    const required = ['clock_phase', 'distance', 'shield_condition'];
    if (factors.join('|') !== required.join('|')) failures.push('grammar_factor_membership_mismatch');
  }
  const recomputedRoot = payload.format === RCL_FRONTIER_CONTINUOUS_FIELD_PAYLOAD_FORMAT
    ? sha256({ ...payload, root: undefined })
    : null;
  if (payload.root && payload.root !== recomputedRoot) failures.push('continuous_field_payload_root_mismatch');
  const result = {
    ok: failures.length === 0,
    failures: [...new Set(failures)].sort(),
    sessionCount: payload.sessions?.length ?? 0,
    distanceLevels: distanceSet.size,
    phaseLevels: phaseSet.size,
    shieldLevels: shieldSet.size,
    externalRealityVerified: false,
    root: null,
  };
  result.root = sha256({ ...result, root: undefined });
  return result;
}

export function scoreContinuousFieldPayload(payload = {}, grammar = null, options = {}) {
  const validation = validateContinuousFieldPayload(payload, grammar);
  if (!validation.ok) {
    return {
      format: RCL_FRONTIER_CONTINUOUS_FIELD_SCORE_FORMAT,
      version: RCL_FRONTIER_CONTINUOUS_FIELD_VERSION,
      ok: false,
      validation,
      externalRealityVerified: false,
      newNaturalLawVerified: false,
      magicVerified: false,
      root: sha256({ validation: validation.root, error: 'invalid_continuous_field_payload' }),
    };
  }

  const plan = payload.analysisPlan;
  const kernel = {
    distanceScale: Number(plan.distanceScale),
    shieldTransmission: Number(plan.shieldTransmission),
  };
  const sessionMetrics = payload.sessions.map((session) => {
    const source = plan.residualizeEnvironment ? residualizeAgainst(session.source, session.environment) : session.source;
    const receiver = plan.residualizeEnvironment ? residualizeAgainst(session.receiver, session.environment) : session.receiver;
    const targetCorrelation = laggedCorrelation(source, receiver, plan.targetLagSamples);
    const zeroLagCorrelation = laggedCorrelation(source, receiver, 0);
    return {
      sessionId: session.sessionId,
      distance: round(session.distance, 6),
      clockPhaseRad: round(session.clockPhaseRad, 9),
      shieldCondition: session.shieldCondition,
      kernelPredictor: round(kernelPredictor(session, kernel), 9),
      targetLagCorrelation: round(targetCorrelation, 9),
      targetLagFisherZ: round(fisherZ(targetCorrelation), 9),
      zeroLagCorrelation: round(zeroLagCorrelation, 9),
    };
  });

  const predictors = sessionMetrics.map((row) => row.kernelPredictor);
  const responses = sessionMetrics.map((row) => row.targetLagFisherZ);
  const fit = linearFit(predictors, responses);
  const observedStatistic = Math.abs(fit.correlation);
  const permutationCount = Math.max(99, Math.trunc(Number(options.permutationCount ?? plan.permutationCount)));
  let exceedances = 0;
  for (let i = 0; i < permutationCount; i += 1) {
    const permuted = stableShuffle(predictors, Number(plan.permutationSeed) + i * 7919 + 17);
    const permutedStatistic = Math.abs(correlation(permuted, responses));
    if (permutedStatistic >= observedStatistic - 1e-12) exceedances += 1;
  }
  const empiricalP = (1 + exceedances) / (1 + permutationCount);
  const thresholds = {
    minAbsKernelCorrelation: Number(options.minAbsKernelCorrelation ?? 0.60),
    minR2: Number(options.minR2 ?? 0.35),
    minAbsKernelBeta: Number(options.minAbsKernelBeta ?? 0.20),
    maxEmpiricalP: Number(options.maxEmpiricalP ?? 0.02),
  };
  const detected = observedStatistic >= thresholds.minAbsKernelCorrelation
    && Number(fit.r2) >= thresholds.minR2
    && Math.abs(Number(fit.beta)) >= thresholds.minAbsKernelBeta
    && empiricalP <= thresholds.maxEmpiricalP;

  const score = {
    format: RCL_FRONTIER_CONTINUOUS_FIELD_SCORE_FORMAT,
    version: RCL_FRONTIER_CONTINUOUS_FIELD_VERSION,
    ok: true,
    route: 'preregistered_continuous_field_kernel_v0_1',
    targetLagSamples: plan.targetLagSamples,
    kernel,
    sessionMetrics,
    model: {
      intercept: round(fit.intercept),
      kernelBeta: round(fit.beta),
      kernelCorrelation: round(fit.correlation),
      r2: round(fit.r2),
      residualSd: round(fit.residualSd),
    },
    permutation: {
      count: permutationCount,
      exceedances,
      empiricalP: round(empiricalP, 9),
      seed: plan.permutationSeed,
    },
    thresholds,
    detected,
    lagSearchUsed: false,
    phaseSearchUsed: false,
    distanceScaleSearchUsed: false,
    externalRealityVerified: false,
    newNaturalLawVerified: false,
    magicVerified: false,
    root: null,
  };
  score.root = sha256({ ...score, root: undefined });
  return score;
}
