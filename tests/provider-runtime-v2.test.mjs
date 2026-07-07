import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  runReality,
  createProviderRuntimeV2,
  ProviderRuntimeV2Error,
} from '../src/index.mjs';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function computerBridgeSource(directive = 'realize publish') {
  return `
  reality ProviderRuntimeV2Bridge {
    facet machine.receipt : Text = "none"
    subject builder { warrant computer.invoke on console }
    host console { offers emit -> Text }
    emergence publish {
      cause builder
      when machine.receipt == "none"
      needs computer.invoke on console
      call console.emit("hello-v2") -> machine.receipt
      preserve length(machine.receipt) > 0
      witness "provider-runtime-v2:console.emit"
    }
    ${directive}
  }`;
}

function createConsoleRuntime(policy = { subjects: { builder: ['console.emit@console', 'computer.invoke@console'] } }) {
  return createProviderRuntimeV2({
    timeoutMs: 1000,
    policy,
    providers: [{
      id: 'console',
      version: '2.0.0-test',
      capabilities: [{ capability: 'emit', target: 'console', modes: ['realize', 'foresee'], effects: ['HostCall', 'Evidence'], maxConcurrent: 1 }],
      async invoke(input, context) {
        return `invoke:${context.capability}:${input.args[0]}`;
      },
      async simulate(input, context) {
        return `simulate:${context.capability}:${input.args[0]}`;
      },
    }],
  });
}

test('Provider Runtime v2 permits async calls only when provider offer and actor policy both match', async () => {
  const runtime = createConsoleRuntime();
  const ok = await runtime.safeInvoke({
    providerId: 'console', capability: 'emit', target: 'console', actor: 'builder', rule: 'publish', mode: 'realize',
    input: { args: ['direct'] }, authorityNeeds: [{ capability: 'computer.invoke', target: 'console' }],
  });
  assert.equal(ok.status, 'succeeded');
  assert.equal(ok.output, 'invoke:emit:direct');
  assert.equal(ok.offer.effects.includes('HostCall'), true);
  assert.match(ok.root, /^[0-9a-f]{64}$/);

  const denied = await runtime.safeInvoke({
    providerId: 'console', capability: 'emit', target: 'console', actor: 'intruder', rule: 'publish', mode: 'realize',
    input: { args: ['blocked'] }, authorityNeeds: [{ capability: 'computer.invoke', target: 'console' }],
  });
  assert.equal(denied.status, 'rejected');
  assert.equal(denied.code, 'RCL_PROVIDER_V2_AUTHORITY_DENIED');
  assert.ok(denied.diagnostics.some(item => item.code === 'RCL_PROVIDER_V2_CAPABILITY_DENIED'));
  assert.equal(runtime.getEventLog().length, 2);
});

test('Provider Runtime v2 host adapter integrates with RCL host calls and records receipts', async () => {
  const providerRuntime = createConsoleRuntime();
  const result = await runReality(computerBridgeSource(), {
    hostAdapters: {
      console: providerRuntime.hostAdapter('console'),
    },
  });
  assert.equal(result.state['machine.receipt'], 'invoke:emit:hello-v2');
  assert.equal(result.history[0].hostCalls[0].authorityNeeds[0].capability, 'computer.invoke');
  const [receipt] = providerRuntime.getEventLog();
  assert.equal(receipt.status, 'succeeded');
  assert.equal(receipt.actor, 'builder');
  assert.equal(receipt.authorityNeeds[0].target, 'console');
  assert.equal(receipt.output, 'invoke:emit:hello-v2');
});

test('Provider Runtime v2 blocks RCL host calls when the runtime policy omits the rule need', async () => {
  const providerRuntime = createConsoleRuntime({ subjects: { builder: ['console.emit@console'] } });
  await assert.rejects(() => runReality(computerBridgeSource(), {
    hostAdapters: {
      console: providerRuntime.hostAdapter('console'),
    },
  }), error => {
    assert.ok(error instanceof ProviderRuntimeV2Error);
    assert.equal(error.code, 'RCL_PROVIDER_V2_AUTHORITY_DENIED');
    assert.ok(error.diagnostics[0].receipt.diagnostics.some(item => item.code === 'RCL_PROVIDER_V2_AUTHORITY_NEED_DENIED'));
    return true;
  });
});

test('Provider Runtime v2 foreseeing uses simulator receipts instead of real invocations', async () => {
  const providerRuntime = createConsoleRuntime();
  const result = await runReality(computerBridgeSource('foresee publish'), {
    hostAdapters: {
      console: providerRuntime.hostAdapter('console'),
    },
  });
  assert.equal(result.state['machine.receipt'], 'none');
  assert.equal(result.projections[0].projectedState['machine.receipt'], 'simulate:emit:hello-v2');
  const [receipt] = providerRuntime.getEventLog();
  assert.equal(receipt.mode, 'foresee');
  assert.equal(receipt.output, 'simulate:emit:hello-v2');
});

test('Provider Runtime v2 converts timeouts and byte budgets into rejected receipts', async () => {
  const runtime = createProviderRuntimeV2({
    timeoutMs: 30,
    requestBytesLimit: 32,
    responseBytesLimit: 32,
    policy: { subjects: { builder: ['slow.wait@slow'] } },
    providers: [{
      id: 'slow',
      capabilities: [{ capability: 'wait', target: 'slow', modes: ['realize'], timeoutMs: 20 }],
      async invoke(_input, context) {
        await new Promise(resolve => setTimeout(resolve, 200));
        return context.signal.aborted ? 'aborted' : 'late';
      },
    }],
  });
  const timeout = await runtime.safeInvoke({ providerId: 'slow', capability: 'wait', target: 'slow', actor: 'builder', input: { ok: true } });
  assert.equal(timeout.status, 'rejected');
  assert.equal(timeout.code, 'RCL_PROVIDER_V2_TIMEOUT');

  const tooLarge = await runtime.safeInvoke({ providerId: 'slow', capability: 'wait', target: 'slow', actor: 'builder', input: { text: 'x'.repeat(100) } });
  assert.equal(tooLarge.status, 'rejected');
  assert.equal(tooLarge.code, 'RCL_PROVIDER_V2_REQUEST_TOO_LARGE');
});


test('Provider Runtime v2 queues concurrent calls through capability-local semaphores', async () => {
  let active = 0;
  let maxActive = 0;
  const runtime = createProviderRuntimeV2({
    maxConcurrent: 4,
    policy: { subjects: { builder: ['queue.work@queue'] } },
    providers: [{
      id: 'queue',
      capabilities: [{ capability: 'work', target: 'queue', modes: ['realize'], maxConcurrent: 1 }],
      async invoke(input) {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise(resolve => setTimeout(resolve, 15));
        active -= 1;
        return `done:${input.index}`;
      },
    }],
  });
  const results = await Promise.all([0, 1, 2].map(index => runtime.safeInvoke({
    providerId: 'queue', capability: 'work', target: 'queue', actor: 'builder', input: { index },
  })));
  assert.deepEqual(results.map(item => item.status), ['succeeded', 'succeeded', 'succeeded']);
  assert.equal(maxActive, 1);
});

test('Provider Runtime v2 CLI demo emits success and denied receipts', () => {
  const run = spawnSync(process.execPath, ['src/cli.mjs', 'provider-v2-demo'], { cwd: PACKAGE_ROOT, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  const payload = JSON.parse(run.stdout);
  assert.equal(payload.success.status, 'succeeded');
  assert.equal(payload.denied.status, 'rejected');
  assert.equal(payload.eventLog.length, 2);
});
