import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { compileNativeUiProgram } from '../src/ui/ui-compiler.mjs';
import { createNativeUiRuntime } from '../src/ui/ui-event.mjs';
import { compileRclWebApplication, emitStandaloneRclWebHtml } from '../src/web-application-compiler.mjs';
import { compileRclAndroidApplication, emitNativeAndroidActivity } from '../src/android-application-compiler.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const source = fs.readFileSync(path.join(ROOT, 'examples/native-ui/counter.rcl'), 'utf8');
const evidencePath = path.join(ROOT, 'examples/native-ui/evidence/performance-result.json');
const events = [
  { nodeId: 'IncrementButton', type: 'activate' },
  { nodeId: 'IncrementButton', type: 'activate' },
  { nodeId: 'ResetButton', type: 'activate' },
];

function summary(values) {
  const ordered = [...values].sort((a, b) => a - b);
  const percentile = (fraction) => ordered[Math.min(ordered.length - 1, Math.floor(ordered.length * fraction))];
  return {
    samples: ordered.length,
    minMs: ordered[0],
    medianMs: percentile(0.5),
    p95Ms: percentile(0.95),
    maxMs: ordered.at(-1),
  };
}

function timedSamples(count, operation) {
  const values = [];
  for (let index = 0; index < count; index += 1) {
    const started = performance.now();
    operation();
    values.push(performance.now() - started);
  }
  return summary(values);
}

function runRclCounter(ui) {
  const runtime = createNativeUiRuntime(ui);
  runtime.lifecycle('create');
  runtime.lifecycle('activate');
  runtime.lifecycle('resume');
  for (const event of events) runtime.dispatch(event.nodeId, event.type, event.payload ?? {});
  if (runtime.state.count !== 0 || runtime.projection().rendered.CounterText.value !== '计数：0') {
    throw new Error('RCL_UI_BENCHMARK_RCL_CORRECTNESS');
  }
}

let referenceSink = 0;
function runReferenceCounter() {
  const state = { count: 0 };
  const trace = [];
  const dispatch = (kind) => {
    const before = { ...state };
    state.count = kind === 'increment' ? state.count + 1 : 0;
    trace.push({ beforeState: before, afterState: { ...state }, renderedValue: `计数：${state.count}` });
  };
  dispatch('increment');
  dispatch('increment');
  dispatch('reset');
  if (state.count !== 0 || trace.at(-1).renderedValue !== '计数：0') throw new Error('RCL_UI_BENCHMARK_REFERENCE_CORRECTNESS');
  referenceSink += trace.length + trace[1].afterState.count;
}

const ui = compileNativeUiProgram(source);
for (let index = 0; index < 100; index += 1) {
  runRclCounter(ui);
  runReferenceCounter();
}

const compile = timedSamples(30, () => compileNativeUiProgram(source));
const webLower = timedSamples(30, () => compileRclWebApplication(source, { schema: 'rcl.native-ui.web-target.v0.1', evidenceEvents: events }));
const androidLower = timedSamples(30, () => compileRclAndroidApplication(source, { schema: 'rcl.native-ui.android-target.v0.1', applicationId: 'com.taowind.rcl.nativeui' }));
const runtimeSequencesPerSample = 1_000;
const rclRuntime = timedSamples(30, () => {
  for (let index = 0; index < runtimeSequencesPerSample; index += 1) runRclCounter(ui);
});
const referenceRuntime = timedSamples(30, () => {
  for (let index = 0; index < runtimeSequencesPerSample; index += 1) runReferenceCounter();
});
const web = compileRclWebApplication(source, { schema: 'rcl.native-ui.web-target.v0.1', evidenceEvents: events });
const android = compileRclAndroidApplication(source, { schema: 'rcl.native-ui.android-target.v0.1', applicationId: 'com.taowind.rcl.nativeui' });
const html = emitStandaloneRclWebHtml(web);
const java = emitNativeAndroidActivity(android);
const result = {
  format: 'rcl.native-ui.performance-evidence.v0.1',
  date: '2026-08-23',
  machineScope: 'current Windows host; Node process; warm cache',
  nodeVersion: process.version,
  uiProgramRoot: ui.semanticRoot,
  workload: { program: 'counter.rcl', eventSequence: events, semanticTransitionsPerSample: events.length },
  compile,
  lowering: { web: webLower, android: androidLower },
  runtime: {
    rclCanonical: rclRuntime,
    plainJavaScriptReference: referenceRuntime,
    sequencesPerSample: runtimeSequencesPerSample,
    rclMedianPerSequenceMs: rclRuntime.medianMs / runtimeSequencesPerSample,
    referenceMedianPerSequenceMs: referenceRuntime.medianMs / runtimeSequencesPerSample,
    medianSlowdown: referenceRuntime.medianMs > 0 ? rclRuntime.medianMs / referenceRuntime.medianMs : null,
    interpretation: 'generic rooted state/binding/event/trace runtime versus a task-specific hand-written JavaScript counter',
    referenceSink,
  },
  artifacts: {
    webHtmlBytes: Buffer.byteLength(html),
    androidActivityJavaBytes: Buffer.byteLength(java),
    apkBytes: fs.existsSync(path.join(ROOT, 'output/native-ui-genome-v0.1/android/app/build/outputs/apk/debug/app-debug.apk'))
      ? fs.statSync(path.join(ROOT, 'output/native-ui-genome-v0.1/android/app/build/outputs/apk/debug/app-debug.apk')).size
      : null,
  },
  verdict: 'MEASURED_CANDIDATE_NOT_PERFORMANCE_PARITY',
  caveats: [
    'microbenchmark results are local-machine observations, not production claims',
    'the JavaScript reference is task-specific and does not provide canonical roots, bindings, traces, validation or dual-backend lowering',
    'browser and Android device performance require their own receipts'
  ]
};
fs.writeFileSync(evidencePath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(result, null, 2));
