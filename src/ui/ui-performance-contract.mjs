import { evidenceRoot } from '../universal-program-stress.mjs';

export const NATIVE_UI_BROWSER_PERFORMANCE_SCHEMA = 'rcl.native-ui.browser-performance-contract.v0.1';

export function evaluateBrowserPerformanceContract(contract, measurement) {
  if (contract?.schema !== NATIVE_UI_BROWSER_PERFORMANCE_SCHEMA) {
    throw new Error(`RCL_UI_BROWSER_PERFORMANCE_SCHEMA:${contract?.schema ?? 'missing'}`);
  }
  const iterations = Number(measurement?.iterations);
  const eventsPerIteration = Number(measurement?.eventsPerIteration);
  const rclDurationMs = Number(measurement?.rclDurationMs);
  const hostBrowserProcessElapsedMs = Number(measurement?.hostBrowserProcessElapsedMs);
  if (![iterations, eventsPerIteration, rclDurationMs, hostBrowserProcessElapsedMs].every(Number.isFinite) || iterations <= 0) {
    throw new Error('RCL_UI_BROWSER_PERFORMANCE_MEASUREMENT_INVALID');
  }
  const rclPerSequenceMs = rclDurationMs / iterations;
  const checks = {
    iterations: iterations >= contract.workload.minimumIterations,
    eventsPerIteration: eventsPerIteration === contract.workload.eventsPerIteration,
    rclPerSequenceMs: rclPerSequenceMs <= contract.acceptance.maxRclPerSequenceMs,
    hostBrowserProcessElapsedMs: hostBrowserProcessElapsedMs <= contract.acceptance.maxHostBrowserProcessElapsedMs,
  };
  return {
    schema: 'rcl.native-ui.browser-performance-verdict.v0.1',
    contractRoot: evidenceRoot(contract),
    status: Object.values(checks).every(Boolean) ? 'PASS' : 'FAIL',
    checks,
    metrics: { iterations, eventsPerIteration, rclDurationMs, rclPerSequenceMs, hostBrowserProcessElapsedMs },
    acceptance: structuredClone(contract.acceptance),
  };
}
