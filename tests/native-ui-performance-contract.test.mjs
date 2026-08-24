import test from 'node:test';
import assert from 'node:assert/strict';

import { evaluateBrowserPerformanceContract } from '../src/ui/ui-performance-contract.mjs';

const contract = {
  schema: 'rcl.native-ui.browser-performance-contract.v0.1',
  workload: { minimumIterations: 50, eventsPerIteration: 3 },
  acceptance: { maxRclPerSequenceMs: 1.5, maxHostBrowserProcessElapsedMs: 5000 },
};

test('browser performance contract passes only when every fixed budget passes', () => {
  const verdict = evaluateBrowserPerformanceContract(contract, {
    iterations: 50,
    eventsPerIteration: 3,
    rclDurationMs: 50,
    hostBrowserProcessElapsedMs: 900,
  });
  assert.equal(verdict.status, 'PASS');
  assert.equal(verdict.metrics.rclPerSequenceMs, 1);
  assert.ok(Object.values(verdict.checks).every(Boolean));
});

test('browser performance contract fails closed on workload or latency drift', () => {
  const verdict = evaluateBrowserPerformanceContract(contract, {
    iterations: 49,
    eventsPerIteration: 2,
    rclDurationMs: 100,
    hostBrowserProcessElapsedMs: 6000,
  });
  assert.equal(verdict.status, 'FAIL');
  assert.deepEqual(verdict.checks, {
    iterations: false,
    eventsPerIteration: false,
    rclPerSequenceMs: false,
    hostBrowserProcessElapsedMs: false,
  });
});

test('browser performance contract rejects malformed measurements', () => {
  assert.throws(() => evaluateBrowserPerformanceContract(contract, {
    iterations: 0,
    eventsPerIteration: 3,
    rclDurationMs: 1,
    hostBrowserProcessElapsedMs: 1,
  }), /RCL_UI_BROWSER_PERFORMANCE_MEASUREMENT_INVALID/u);
});
