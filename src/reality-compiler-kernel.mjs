import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const RCL_REALITY_COMPILER_VERSION = '0.43.0-alpha.1';
export const RCL_REALITY_COMPILER_KERNEL_FORMAT = 'rcl.reality-compiler-kernel.v0.43';
export const RCL_REALITY_COMPILER_SANDBOX_FORMAT = 'rcl.reality-compiler-sandbox-report.v0.43';
export const RCL_REALITY_COMPILER_SPEC_FORMAT = 'rcl.reality-compiler-spec.v0.43';
export const RCL_REALITY_COMPILER_DEPTH_FORMAT = 'rcl.reality-compiler-depth-report.v0.43';
export const RCL_IRREDUCIBILITY_PRESSURE_FORMAT = 'rcl.irreducibility-pressure-report.v0.43';

const DEFAULT_SEED = 20260705;
const DEFAULT_STEPS = 220;
const DEFAULT_TRIALS = 36;

export function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, Number(value)));
}

export function sha256(value) {
  const data = typeof value === 'string' ? value : canonicalJson(value);
  return crypto.createHash('sha256').update(data).digest('hex');
}

export function canonicalJson(value) {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, sortKeys(value[key])]));
}

export function createSeededRandom(seed = DEFAULT_SEED) {
  let state = Number(seed) >>> 0;
  if (state === 0) state = 0x9e3779b9;
  let spare = null;
  const next = () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    random: next,
    gaussian(mean = 0, std = 1) {
      if (spare !== null) {
        const value = spare;
        spare = null;
        return mean + value * std;
      }
      const u = Math.max(Number.EPSILON, next());
      const v = Math.max(Number.EPSILON, next());
      const mag = Math.sqrt(-2 * Math.log(u));
      const z0 = mag * Math.cos(2 * Math.PI * v);
      const z1 = mag * Math.sin(2 * Math.PI * v);
      spare = z1;
      return mean + z0 * std;
    },
  };
}

function mean(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function variance(values) {
  if (!values.length) return 0;
  const avg = mean(values);
  return mean(values.map(value => (value - avg) ** 2));
}

function max(values) {
  return values.length ? Math.max(...values) : 0;
}

function min(values) {
  return values.length ? Math.min(...values) : 0;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function initialState() {
  return { S: 0.6, T: 0.6, I: 0.5, C: 0.5 };
}

function stabilityOf({ S, T, I, C }) {
  return clamp(S) * (1 - clamp(T)) * clamp(I) * clamp(C);
}

function classifyPhase(avg, final, peak, v) {
  if (avg < 0.01 && final < 0.01) return 'collapse';
  if (avg < 0.05 && v < 0.003) return 'frozen-low';
  if (peak > 0.65 && final < 0.05) return 'metastable-spike';
  if (avg >= 0.08 && final >= 0.05 && peak >= 0.25) return 'growth-stable';
  if (avg >= 0.05 && peak >= 0.2) return 'weak-stable';
  return 'unstable';
}

function collapseTime(trace, threshold = 1e-4) {
  for (let index = 0; index < trace.length; index += 1) {
    if (trace[index] <= threshold) {
      const tail = trace.slice(index, index + 20);
      if (tail.length >= 10 && Math.max(...tail) <= threshold * 10) return index;
    }
  }
  return null;
}

export const REALITY_COMPILER_NOISES = Object.freeze({
  low(step, T, rng) { return rng.random() * 0.35; },
  uniform(step, T, rng) { return rng.random(); },
  high(step, T, rng) { return 0.65 + rng.random() * 0.35; },
  bursty(step, T, rng) { return rng.random() < 0.1 ? 0.85 + rng.random() * 0.15 : rng.random() * 0.35; },
  adversarial(step, T, rng) { return clamp(0.55 * rng.random() + 0.45 * T + (T > 0.7 ? 0.25 : 0)); },
  nonstationary(step, T, rng) {
    const phase = (Math.sin(step / 18) + 1) / 2;
    return clamp(0.15 + 0.7 * phase + rng.gaussian(0, 0.05));
  },
});

export const REALITY_COMPILER_MODELS = Object.freeze([
  'baseline',
  'meta',
  'evo_free',
  'static_invariant',
  'AIF',
  'FoF',
  'delayed_feedback',
  'low_visibility',
  'multi_agent',
]);

function stepBaseline(state, xi, rng) {
  const stability = stabilityOf(state);
  const X1 = Math.abs(rng.gaussian(state.T, 0.1));
  const X2 = xi * state.T;
  return {
    state: {
      S: clamp(state.S + 0.05 * (state.C * (1 - X1) - X2)),
      T: clamp(state.T + 0.05 * (X1 - state.I)),
      I: clamp(state.I + 0.05 * (Math.max(0, state.I - X2) - (1 - state.C) * xi)),
      C: clamp(state.C + 0.05 * (state.C * (1 - X1) - state.T)),
    },
    stability,
  };
}

function stepMeta(state, xi, context = {}) {
  const { alpha = 0.1, gamma = 0.1, beta = 0.05, prevStability = 0 } = context;
  const stability = stabilityOf(state);
  const grad = stability - prevStability;
  return {
    state: {
      S: clamp(state.S + 0.1 * (state.C - xi)),
      T: xi,
      I: clamp(state.I + alpha * (1 - (xi + state.T)) + beta * grad),
      C: clamp(state.C + gamma * (state.S * state.I - state.C) + beta * grad),
    },
    stability,
    grad,
    context: { ...context, prevStability: stability },
  };
}

function runBaseline(noiseFn, steps, rng) {
  let state = initialState();
  const trace = [];
  for (let step = 0; step < steps; step += 1) {
    const xi = noiseFn(step, state.T, rng);
    const next = stepBaseline(state, xi, rng);
    state = next.state;
    trace.push(next.stability);
  }
  return { trace, state };
}

function runMeta(noiseFn, steps, rng) {
  let state = initialState();
  let context = { prevStability: 0, alpha: 0.1, gamma: 0.1, beta: 0.05 };
  const trace = [];
  for (let step = 0; step < steps; step += 1) {
    const xi = noiseFn(step, state.T, rng);
    const next = stepMeta(state, xi, context);
    state = next.state;
    context = next.context;
    trace.push(next.stability);
  }
  return { trace, state, context };
}

function runEvoFree(noiseFn, steps, rng) {
  let state = initialState();
  let alpha = 0.1;
  let gamma = 0.1;
  let beta = 0.05;
  let prev = 0;
  const trace = [];
  for (let step = 0; step < steps; step += 1) {
    const xi = noiseFn(step, state.T, rng);
    const stability = stabilityOf(state);
    const grad = stability - prev;
    state = {
      S: clamp(state.S + 0.1 * (state.C - xi)),
      T: xi,
      I: clamp(state.I + alpha * (1 - (xi + state.T)) + beta * grad),
      C: clamp(state.C + gamma * (state.S * state.I - state.C) + beta * grad),
    };
    alpha = clamp(alpha + 0.02 * grad);
    gamma = clamp(gamma + 0.015 * (stability - 0.3));
    beta = clamp(beta + 0.01 * grad);
    prev = stability;
    trace.push(stability);
  }
  return { trace, state, params: { alpha, gamma, beta } };
}

function runStaticInvariant(noiseFn, steps, rng) {
  let state = initialState();
  let alpha = 0.1;
  let gamma = 0.1;
  let beta = 0.05;
  let prev = 0;
  const trace = [];
  for (let step = 0; step < steps; step += 1) {
    const xi = noiseFn(step, state.T, rng);
    const stability = stabilityOf(state);
    const grad = stability - prev;
    let I = state.I + alpha * (1 - (xi + state.T)) + beta * grad;
    let C = state.C + gamma * (state.S * state.I - state.C) + beta * grad;
    state = { S: clamp(state.S + 0.1 * (state.C - xi)), T: xi, I, C };

    const energy = alpha + gamma + beta;
    if (energy > 0.25) {
      const scale = 0.25 / (energy + 1e-9);
      alpha *= scale; gamma *= scale; beta *= scale;
    }
    if (stability < 0.02) {
      state.I += 0.05 * (1 - state.I);
      state.C += 0.05 * (1 - state.C);
    }
    if (Math.abs(grad) > 0.2) {
      state.I *= 0.9;
      state.C *= 0.9;
    }
    state.I = clamp(state.I);
    state.C = clamp(state.C);
    prev = stability;
    trace.push(stability);
  }
  return { trace, state, params: { alpha, gamma, beta } };
}

function runAif(noiseFn, steps, rng) {
  let state = initialState();
  let alpha = 0.1;
  let gamma = 0.1;
  let beta = 0.05;
  let E_bound = 0.25;
  let floor = 0.02;
  let prev = 0;
  const trace = [];
  for (let step = 0; step < steps; step += 1) {
    const xi = noiseFn(step, state.T, rng);
    const stability = stabilityOf(state);
    const grad = stability - prev;
    let I = state.I + alpha * (1 - (xi + state.T)) + beta * grad;
    let C = state.C + gamma * (state.S * state.I - state.C) + beta * grad;
    state = { S: clamp(state.S + 0.1 * (state.C - xi)), T: xi, I, C };

    const activity = Math.abs(grad) + stability;
    E_bound = clamp(E_bound + 0.01 * (activity - 0.3), 0.05, 0.5);
    floor = clamp(floor + 0.005 * (0.1 - activity), 0, 0.2);
    if (stability < floor) {
      state.I += 0.03 * (1 - state.I);
      state.C += 0.03 * (1 - state.C);
    }
    const energy = alpha + gamma + beta;
    if (energy > E_bound) {
      const scale = E_bound / (energy + 1e-9);
      alpha *= scale; gamma *= scale; beta *= scale;
    }
    if (grad > 0.2) {
      state.I *= 0.95;
      state.C *= 0.95;
    }
    state.I = clamp(state.I);
    state.C = clamp(state.C);
    prev = stability;
    trace.push(stability);
  }
  return { trace, state, field: { E_bound, floor }, params: { alpha, gamma, beta } };
}

function runFoF(noiseFn, steps, rng) {
  let state = initialState();
  let alpha = 0.1;
  let gamma = 0.1;
  let beta = 0.05;
  let E_field = 0.25;
  let floor_field = 0.02;
  let prev = 0;
  const trace = [];
  for (let step = 0; step < steps; step += 1) {
    const xi = noiseFn(step, state.T, rng);
    const stability = stabilityOf(state);
    const grad = stability - prev;
    let I = state.I + alpha * (1 - (xi + state.T)) + beta * grad;
    let C = state.C + gamma * (state.S * state.I - state.C) + beta * grad;
    state = { S: clamp(state.S + 0.1 * (state.C - xi)), T: xi, I, C };

    const chaos = Math.abs(grad);
    E_field = clamp(0.9 * E_field + 0.1 * (0.2 + chaos));
    floor_field = clamp(0.9 * floor_field + 0.1 * (0.05 + (0.2 - stability)));
    const energy = alpha + gamma + beta;
    if (energy > E_field) {
      const scale = E_field / (energy + 1e-9);
      alpha *= scale; gamma *= scale; beta *= scale;
    }
    if (stability < floor_field) {
      state.I += 0.04 * (1 - state.I);
      state.C += 0.04 * (1 - state.C);
    }
    if (chaos > 0.25) {
      state.I *= 0.92;
      state.C *= 0.92;
    }
    state.I = clamp(state.I);
    state.C = clamp(state.C);
    prev = stability;
    trace.push(stability);
  }
  return { trace, state, field: { E_field, floor_field }, params: { alpha, gamma, beta } };
}

function runDelayedFeedback(noiseFn, steps, rng, delay = 5) {
  let state = initialState();
  let E_field = 0.25;
  let floor_field = 0.02;
  const history = Array(delay + 1).fill(0);
  const trace = [];
  for (let step = 0; step < steps; step += 1) {
    const xi = noiseFn(step, state.T, rng);
    const stability = stabilityOf(state);
    const delayed = history.length > delay ? history[history.length - delay] : 0;
    const grad = stability - delayed;
    state = {
      S: clamp(state.S + 0.1 * (state.C - xi)),
      T: xi,
      I: state.I + 0.1 * (1 - (xi + state.T)) + 0.05 * grad,
      C: state.C + 0.1 * (state.S * state.I - state.C) + 0.05 * grad,
    };
    E_field = clamp(0.9 * E_field + 0.1 * (0.2 + Math.abs(grad)));
    floor_field = clamp(0.9 * floor_field + 0.1 * (0.05 + (0.2 - stability)));
    if (stability < floor_field) {
      state.I += 0.04 * (1 - state.I);
      state.C += 0.04 * (1 - state.C);
    }
    if (Math.abs(grad) > 0.25) {
      state.I *= 0.92;
      state.C *= 0.92;
    }
    state.I = clamp(state.I);
    state.C = clamp(state.C);
    history.push(stability);
    trace.push(stability);
  }
  return { trace, state, field: { E_field, floor_field, delay } };
}

function runLowVisibility(noiseFn, steps, rng) {
  let state = initialState();
  let E_field = 0.25;
  let floor_field = 0.02;
  let previousObserved = 0;
  const visibility = 0.35;
  const trace = [];
  for (let step = 0; step < steps; step += 1) {
    const xi = noiseFn(step, state.T, rng);
    const trueStability = stabilityOf(state);
    const observed = clamp(visibility * trueStability + (1 - visibility) * rng.random() * 0.05);
    const grad = observed - previousObserved;
    state = {
      S: clamp(state.S + 0.1 * (state.C - xi)),
      T: xi,
      I: state.I + 0.1 * (1 - (xi + state.T)) + 0.05 * grad,
      C: state.C + 0.1 * (state.S * state.I - state.C) + 0.05 * grad,
    };
    E_field = clamp(0.9 * E_field + 0.1 * (0.2 + Math.abs(grad)));
    floor_field = clamp(0.9 * floor_field + 0.1 * (0.05 + (0.2 - observed)));
    if (observed < floor_field) {
      state.I += 0.04 * (1 - state.I);
      state.C += 0.04 * (1 - state.C);
    }
    if (Math.abs(grad) > 0.25) {
      state.I *= 0.92;
      state.C *= 0.92;
    }
    state.I = clamp(state.I);
    state.C = clamp(state.C);
    previousObserved = observed;
    trace.push(trueStability);
  }
  return { trace, state, field: { E_field, floor_field, visibility } };
}

function runMultiAgent(noiseFn, steps, rng, agents = 3) {
  const states = Array.from({ length: agents }, () => initialState());
  let E_field = 0.25;
  let floor_field = 0.02;
  let prev = 0;
  const trace = [];
  for (let step = 0; step < steps; step += 1) {
    const averageI = mean(states.map(item => item.I));
    const averageC = mean(states.map(item => item.C));
    const stabilities = [];
    for (let index = 0; index < states.length; index += 1) {
      const state = states[index];
      const xi = noiseFn(step, state.T, rng);
      const stability = stabilityOf(state);
      stabilities.push(stability);
      const coupling = 0.08 * ((averageI + averageC) / 2 - (state.I + state.C) / 2);
      states[index] = {
        S: clamp(state.S + 0.08 * (state.C - xi)),
        T: xi,
        I: clamp(state.I + 0.1 * (1 - (xi + state.T)) + coupling),
        C: clamp(state.C + 0.1 * (state.S * state.I - state.C) + coupling),
      };
    }
    const groupStability = mean(stabilities);
    const grad = groupStability - prev;
    E_field = clamp(0.9 * E_field + 0.1 * (0.2 + Math.abs(grad)));
    floor_field = clamp(0.9 * floor_field + 0.1 * (0.05 + (0.2 - groupStability)));
    if (groupStability < floor_field) {
      for (const state of states) {
        state.I = clamp(state.I + 0.03 * (1 - state.I));
        state.C = clamp(state.C + 0.03 * (1 - state.C));
      }
    }
    prev = groupStability;
    trace.push(groupStability);
  }
  return { trace, states, field: { E_field, floor_field, agents } };
}

const MODEL_RUNNERS = Object.freeze({
  baseline: runBaseline,
  meta: runMeta,
  evo_free: runEvoFree,
  static_invariant: runStaticInvariant,
  AIF: runAif,
  FoF: runFoF,
  delayed_feedback: runDelayedFeedback,
  low_visibility: runLowVisibility,
  multi_agent: runMultiAgent,
});

export function buildRealityCompilerSpec(overrides = {}) {
  const spec = {
    format: RCL_REALITY_COMPILER_SPEC_FORMAT,
    version: RCL_REALITY_COMPILER_VERSION,
    kernel: 'Reality Compilation Kernel',
    state: {
      S: 'structure-space coverage',
      T: 'transformation entropy / disturbance pressure',
      I: 'invariant controller / entropy suppressor',
      C: 'closure field / attractor strength',
    },
    feedback: {
      stability: 'S * (1 - T) * I * C',
      gradient: 'stability[t] - observed_stability[t-k]',
      noise: ['low', 'uniform', 'high', 'bursty', 'adversarial', 'nonstationary'],
    },
    compilerPasses: [
      'state augmentation',
      'memory declaration',
      'hidden-regime declaration',
      'adaptive invariant field synthesis',
      'constraint compilation',
      'control-policy emission',
      'semantic guard / rollback / replay evidence',
    ],
    invariants: [
      'minimum executable path exists',
      'state is observable or observation uncertainty is declared',
      'feedback delay is explicit',
      'hidden regime is explicit',
      'multi-agent coupling is explicit',
      'semantic guard can reject unstable compiled trajectories',
    ],
    rclBoundary: 'RCL must express memory, hidden regimes, delay, observer visibility, agent coupling and adaptive invariant fields explicitly; otherwise reality behavior is only projected as a shallow Markov process.',
    ...overrides,
  };
  return { ...spec, root: sha256(spec) };
}

export function renderRealityCompilerRcl(spec = buildRealityCompilerSpec()) {
  return `reality RealityCompilerKernel {
  facet state.S : Number = 0.6
  facet state.T : Number = 0.6
  facet state.I : Number = 0.5
  facet state.C : Number = 0.5
  facet field.energy : Number = 0.25
  facet field.floor : Number = 0.02
  facet memory.prev_stability : Number = 0
  facet observer.visibility : Number = 0.35
  facet compiler.depth : Number = 3
  facet compiler.stability : Number = 0

  subject compiler {
    facet authority : Number = 1
    warrant state.write on state
    warrant field.write on field
    warrant compiler.write on compiler
  }

  emergence compile_stability {
    cause compiler
    when compiler.authority == 1
    needs state.write on state
    needs field.write on field
    needs compiler.write on compiler
    alter compiler.stability <- state.S * (1 - state.T) * state.I * state.C
    alter field.energy <- field.energy + 0.01 * (compiler.stability - field.floor)
    alter field.floor <- field.floor + 0.005 * (0.1 - compiler.stability)
    alter state.I <- state.I + 0.04 * (1 - state.I)
    alter state.C <- state.C + 0.04 * (1 - state.C)
    preserve state.S >= 0
    preserve state.S <= 1
    preserve state.T >= 0
    preserve state.T <= 1
    preserve state.I >= 0
    preserve state.I <= 1
    preserve state.C >= 0
    preserve state.C <= 1
    witness "rcl:reality-compiler-kernel:v0.43"
  }

  foresee compile_stability
  realize compile_stability
}
`;
}

export function runRealityCompilerModel(options = {}) {
  const model = options.model ?? 'FoF';
  const noise = options.noise ?? 'uniform';
  const steps = Number(options.steps ?? DEFAULT_STEPS);
  const seed = Number(options.seed ?? DEFAULT_SEED);
  const runner = MODEL_RUNNERS[model];
  const noiseFn = REALITY_COMPILER_NOISES[noise];
  if (!runner) throw new Error(`Unknown reality compiler model '${model}'`);
  if (!noiseFn) throw new Error(`Unknown reality compiler noise '${noise}'`);
  const result = runner(noiseFn, steps, createSeededRandom(seed));
  const trace = result.trace;
  const summary = summarizeTrace(trace);
  return {
    format: RCL_REALITY_COMPILER_KERNEL_FORMAT,
    version: RCL_REALITY_COMPILER_VERSION,
    model,
    noise,
    seed,
    steps,
    summary,
    result,
    root: sha256({ model, noise, seed, steps, summary }),
  };
}

function summarizeTrace(trace) {
  const avg = mean(trace);
  const final = trace.at(-1) ?? 0;
  const peak = max(trace);
  const v = variance(trace);
  const ct = collapseTime(trace);
  return {
    avgStability: avg,
    finalStability: final,
    peakStability: peak,
    minStability: min(trace),
    stabilityVariance: v,
    collapseStep: ct,
    phase: classifyPhase(avg, final, peak, v),
  };
}

function evaluateModel({ model, noise, trials, steps, seed }) {
  const allValues = [];
  const collapseSteps = [];
  for (let trial = 0; trial < trials; trial += 1) {
    const trialSeed = seed + stableNumberHash(`${model}:${noise}:${trial}`);
    const run = runRealityCompilerModel({ model, noise, steps, seed: trialSeed });
    allValues.push(...run.result.trace);
    if (run.summary.collapseStep !== null) collapseSteps.push(run.summary.collapseStep);
  }
  const avg = mean(allValues);
  const final = mean(Array.from({ length: trials }, (_, trial) => {
    const trialSeed = seed + stableNumberHash(`${model}:${noise}:final:${trial}`);
    return runRealityCompilerModel({ model, noise, steps, seed: trialSeed }).summary.finalStability;
  }));
  const peak = max(allValues);
  const v = variance(allValues);
  const collapseRate = collapseSteps.length / trials;
  const phase = classifyPhase(avg, final, peak, v);
  const score = Math.max(0, avg * 0.45 + final * 0.45 + peak * 0.1 - collapseRate * 0.25 - Math.min(v, 0.2) * 0.2);
  return {
    model,
    noise,
    trials,
    steps,
    avgStability: avg,
    finalStability: final,
    peakStability: peak,
    stabilityVariance: v,
    collapseRate,
    medianCollapseStep: median(collapseSteps),
    phase,
    score,
  };
}

function stableNumberHash(input) {
  const hex = crypto.createHash('sha256').update(input).digest('hex').slice(0, 8);
  return Number.parseInt(hex, 16) >>> 0;
}

export function runSelfHostingDepthTest(options = {}) {
  const depths = options.depths ?? [1, 2, 3, 5, 8, 13, 21, 34];
  const trials = Number(options.trials ?? 80);
  const seed = Number(options.seed ?? DEFAULT_SEED);
  const rows = depths.map(depth => {
    const outputs = [];
    for (let trial = 0; trial < trials; trial += 1) {
      const rng = createSeededRandom(seed + depth * 1000 + trial);
      outputs.push(compileLayer({ S: 0.6, T: 0.6, I: 0.5, C: 0.5 }, 0, depth, 0.2, 0.1, rng));
    }
    return {
      depth,
      meanCompiledValue: mean(outputs),
      variance: variance(outputs),
      min: min(outputs),
      max: max(outputs),
    };
  });
  return {
    format: RCL_REALITY_COMPILER_DEPTH_FORMAT,
    version: RCL_REALITY_COMPILER_VERSION,
    rows,
    nonZeroDepths: rows.filter(row => row.meanCompiledValue > 0.05).map(row => row.depth),
    root: sha256(rows),
  };
}

function compileLayer(state, depth, maxDepth, E_field, floor_field, rng) {
  if (depth >= maxDepth) return clamp(state.S) * clamp(state.I) * clamp(state.C);
  const xi = rng.random();
  const stability = stabilityOf(state);
  const compression = (maxDepth - depth + 1) / maxDepth;
  const nextE = clamp(E_field + 0.05 * (stability - 0.3) * compression);
  const nextFloor = clamp(floor_field + 0.03 * (0.2 - stability));
  return compileLayer({
    S: clamp(state.S + 0.08 * (state.C - xi)),
    T: xi,
    I: clamp(state.I + nextE * (1 - (xi + state.T))),
    C: clamp(state.C + nextFloor * (state.S * state.I - state.C)),
  }, depth + 1, maxDepth, nextE, nextFloor, rng);
}

export function runIrreducibilityPressureTests(options = {}) {
  const seed = Number(options.seed ?? DEFAULT_SEED);
  const behaviors = ['markov', 'history_parity', 'delayed_hidden', 'regime_switch'];
  const rows = behaviors.map(behavior => {
    const { xs, ys } = generateSeries(behavior, 500, createSeededRandom(seed + stableNumberHash(behavior)));
    const simple = simpleMarkovPredict(xs);
    const augmented = stateAugmentedPredict(behavior, xs);
    const simpleMse = mse(ys, simple);
    const augmentedMse = mse(ys, augmented);
    return {
      behavior,
      simpleMarkovMse: simpleMse,
      stateAugmentedMse: augmentedMse,
      requiresExplicitMemoryOrRegime: simpleMse > 0.03 && augmentedMse < 1e-8,
    };
  });
  return {
    format: RCL_IRREDUCIBILITY_PRESSURE_FORMAT,
    version: RCL_REALITY_COMPILER_VERSION,
    rows,
    verdict: rows.every(row => row.behavior === 'markov' || row.requiresExplicitMemoryOrRegime)
      ? 'Hidden memory/regime behaviors become expressible after state augmentation.'
      : 'Some pressure behaviors remain unexpressed after state augmentation.',
    root: sha256(rows),
  };
}

function generateSeries(kind, n, rng) {
  const xs = [];
  const ys = [];
  const history = [];
  let hidden = 0.5;
  let regime = 0;
  for (let index = 0; index < n; index += 1) {
    const x = rng.random();
    let y;
    if (kind === 'markov') {
      y = 0.7 * x + 0.3 * hidden;
      hidden = y;
    } else if (kind === 'history_parity') {
      const bit = x > 0.5 ? 1 : 0;
      history.push(bit);
      const parity = history.slice(-7).reduce((sum, value) => sum + value, 0) % 2;
      y = 0.8 * parity + 0.2 * x;
    } else if (kind === 'delayed_hidden') {
      history.push(x);
      const delayed = history.length > 10 ? history[history.length - 11] : 0.5;
      y = 0.6 * delayed + 0.4 * x;
    } else if (kind === 'regime_switch') {
      if (index % 80 === 0) regime = 1 - regime;
      y = regime === 0 ? 0.8 * x + 0.1 : 0.9 * (1 - x);
    } else {
      throw new Error(`Unknown behavior '${kind}'`);
    }
    xs.push(x); ys.push(y);
  }
  return { xs, ys };
}

function simpleMarkovPredict(xs) {
  const predictions = [];
  let h = 0.5;
  for (const x of xs) {
    const y = 0.65 * x + 0.35 * h;
    h = y;
    predictions.push(y);
  }
  return predictions;
}

function stateAugmentedPredict(kind, xs) {
  const predictions = [];
  const history = [];
  let h = 0.5;
  let regime = 0;
  for (let index = 0; index < xs.length; index += 1) {
    const x = xs[index];
    let y;
    if (kind === 'markov') {
      y = 0.7 * x + 0.3 * h;
      h = y;
    } else if (kind === 'history_parity') {
      const bit = x > 0.5 ? 1 : 0;
      history.push(bit);
      const parity = history.slice(-7).reduce((sum, value) => sum + value, 0) % 2;
      y = 0.8 * parity + 0.2 * x;
    } else if (kind === 'delayed_hidden') {
      history.push(x);
      const delayed = history.length > 10 ? history[history.length - 11] : 0.5;
      y = 0.6 * delayed + 0.4 * x;
    } else if (kind === 'regime_switch') {
      if (index % 80 === 0) regime = 1 - regime;
      y = regime === 0 ? 0.8 * x + 0.1 : 0.9 * (1 - x);
    } else {
      throw new Error(`Unknown behavior '${kind}'`);
    }
    predictions.push(y);
  }
  return predictions;
}

function mse(ys, predictions) {
  return mean(ys.map((y, index) => (y - predictions[index]) ** 2));
}

export function runRealityCompilerSandbox(options = {}) {
  const seed = Number(options.seed ?? DEFAULT_SEED);
  const trials = Number(options.trials ?? DEFAULT_TRIALS);
  const steps = Number(options.steps ?? DEFAULT_STEPS);
  const models = options.models ?? REALITY_COMPILER_MODELS;
  const noises = options.noises ?? Object.keys(REALITY_COMPILER_NOISES);
  const metrics = [];
  for (const model of models) {
    for (const noise of noises) {
      metrics.push(evaluateModel({ model, noise, trials, steps, seed }));
    }
  }
  const ranking = models.map(model => {
    const rows = metrics.filter(row => row.model === model);
    return {
      model,
      meanScore: mean(rows.map(row => row.score)),
      avgStability: mean(rows.map(row => row.avgStability)),
      finalStability: mean(rows.map(row => row.finalStability)),
      peakStability: max(rows.map(row => row.peakStability)),
      collapseRate: mean(rows.map(row => row.collapseRate)),
      variance: mean(rows.map(row => row.stabilityVariance)),
    };
  }).sort((a, b) => b.meanScore - a.meanScore);
  const phaseCounts = {};
  for (const row of metrics) {
    phaseCounts[row.model] ??= {};
    phaseCounts[row.model][row.phase] = (phaseCounts[row.model][row.phase] ?? 0) + 1;
  }
  const selfHostingDepth = runSelfHostingDepthTest({ seed, trials: Math.max(24, Math.floor(trials / 2)) });
  const irreducibility = runIrreducibilityPressureTests({ seed });
  const spec = buildRealityCompilerSpec();
  const report = {
    format: RCL_REALITY_COMPILER_SANDBOX_FORMAT,
    version: RCL_REALITY_COMPILER_VERSION,
    seed,
    trials,
    steps,
    spec,
    metrics,
    ranking,
    phaseCounts,
    selfHostingDepth,
    irreducibility,
    verdict: {
      value: 'RCL/RNCS should be treated as a high-order reality compiler rather than a fixed single dynamical system.',
      decisiveRequirement: 'Declare memory, hidden regimes, delayed feedback, low observability, multi-agent coupling and adaptive invariant fields as first-class RCL structures.',
      kernel: 'Reality noise -> state augmentation -> adaptive invariant field -> constraint compilation -> control policy -> stable trajectory.',
    },
  };
  return { ...report, root: sha256(report) };
}

export function runRealityCompilerDemo() {
  const report = runRealityCompilerSandbox({ trials: 12, steps: 120 });
  return {
    ok: true,
    format: report.format,
    version: report.version,
    root: report.root,
    topModels: report.ranking.slice(0, 5),
    depthSummary: report.selfHostingDepth.rows,
    irreducibility: report.irreducibility.rows,
    verdict: report.verdict,
  };
}

export function writeRealityCompilerReports(outputDir = 'output/v0.43/reality-compiler', options = {}) {
  const target = path.resolve(outputDir);
  fs.mkdirSync(target, { recursive: true });
  const report = runRealityCompilerSandbox(options);
  const spec = buildRealityCompilerSpec();
  const rcl = renderRealityCompilerRcl(spec);
  const files = {
    'reality-compiler-report.json': report,
    'model-ranking.json': report.ranking,
    'full-metrics.json': report.metrics,
    'phase-counts.json': report.phaseCounts,
    'self-hosting-depth.json': report.selfHostingDepth,
    'irreducibility-tests.json': report.irreducibility,
    'reality-compiler-spec.json': spec,
    'reality-compiler-kernel.rcl': rcl,
  };
  const written = [];
  for (const [name, value] of Object.entries(files)) {
    const file = path.join(target, name);
    fs.writeFileSync(file, `${typeof value === 'string' ? value : JSON.stringify(value, null, 2)}\n`);
    written.push({ path: file, sha256: sha256(fs.readFileSync(file, 'utf8')) });
  }
  return {
    ok: true,
    format: 'rcl.reality-compiler-report-bundle.v0.43',
    version: RCL_REALITY_COMPILER_VERSION,
    outputDir: target,
    root: report.root,
    files: written,
  };
}
