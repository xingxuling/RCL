import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  createProviderRuntimeV2,
  createResourceIsolationKernel,
  RCLResourceIsolationError,
} from '../src/index.mjs';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function createConsoleProvider() {
  return {
    id: 'console',
    capabilities: [{ capability: 'emit', target: 'console', modes: ['realize'], responseBytesLimit: 128 }],
    async invoke(input, context) {
      assert.equal(context.isolationDomainId, 'demo');
      assert.equal(context.resourceHandle.kind, 'provider-call');
      return `isolated:${input.args[0]}`;
    },
  };
}

test('Resource Isolation Kernel issues tickets, acquires handles and releases resources deterministically', () => {
  const kernel = createResourceIsolationKernel({
    defaultQuota: { maxHandles: 1, memoryBytes: 128, requestBytes: 64, responseBytes: 64, maxConcurrent: 1, fuel: 3 },
    domains: [{ id: 'demo', policy: { subjects: { builder: ['console.emit@console'] } } }],
  });
  const ticket = kernel.issueCapabilityTicket({ domainId: 'demo', actor: 'builder', providerId: 'console', capability: 'emit', target: 'console' });
  assert.equal(ticket.domainId, 'demo');
  assert.match(ticket.id, /^[0-9a-f]{64}$/);
  const handle = kernel.acquireResource({ domainId: 'demo', actor: 'builder', providerId: 'console', capability: 'emit', target: 'console', kind: 'provider-call', ticketId: ticket.id, requestBytes: 16, responseBudgetBytes: 16 });
  assert.equal(kernel.domainSnapshot('demo').usage.handles, 1);
  assert.equal(kernel.domainSnapshot('demo').usage.activeInvocations, 1);
  const released = kernel.releaseResource(handle.id);
  assert.equal(released.releaseReason, 'released');
  assert.equal(kernel.domainSnapshot('demo').usage.handles, 0);
  assert.equal(kernel.listActiveHandles('demo').handleCount, 0);
});

test('Resource Isolation Kernel rejects out-of-policy tickets and quota overflow without consuming valid tickets', () => {
  const kernel = createResourceIsolationKernel({
    defaultQuota: { maxHandles: 1, memoryBytes: 8, requestBytes: 32, responseBytes: 32, maxConcurrent: 1 },
    domains: [{ id: 'demo', policy: { subjects: { builder: ['console.emit@console'] } } }],
  });
  assert.throws(() => kernel.issueCapabilityTicket({ domainId: 'demo', actor: 'builder', providerId: 'net', capability: 'fetch', target: 'internet' }), error => {
    assert.ok(error instanceof RCLResourceIsolationError);
    assert.equal(error.code, 'RCL_RESOURCE_TICKET_POLICY_DENIED');
    return true;
  });
  const ticket = kernel.issueCapabilityTicket({ domainId: 'demo', actor: 'builder', providerId: 'console', capability: 'emit', target: 'console' });
  assert.throws(() => kernel.acquireResource({ domainId: 'demo', actor: 'builder', providerId: 'console', capability: 'emit', target: 'console', kind: 'provider-call', ticketId: ticket.id, memoryBytes: 128 }), error => {
    assert.ok(error instanceof RCLResourceIsolationError);
    assert.equal(error.code, 'RCL_RESOURCE_QUOTA_EXCEEDED');
    assert.ok(error.diagnostics.some(item => item.code === 'RCL_RESOURCE_QUOTA_MEMORY'));
    return true;
  });
  const handle = kernel.acquireResource({ domainId: 'demo', actor: 'builder', providerId: 'console', capability: 'emit', target: 'console', kind: 'provider-call', ticketId: ticket.id, memoryBytes: 1 });
  assert.equal(handle.ticketId, ticket.id);
});

test('Provider Runtime v2 binds resource handles and capability tickets to isolated invocations', async () => {
  const kernel = createResourceIsolationKernel({
    defaultQuota: { maxHandles: 1, requestBytes: 128, responseBytes: 128, maxConcurrent: 1, timeoutMs: 1000 },
    domains: [{ id: 'demo', policy: { subjects: { builder: ['console.emit@console'] } } }],
  });
  const ticket = kernel.issueCapabilityTicket({ domainId: 'demo', actor: 'builder', providerId: 'console', capability: 'emit', target: 'console' });
  const runtime = createProviderRuntimeV2({
    resourceKernel: kernel,
    policy: { subjects: { builder: ['console.emit@console'] } },
    providers: [createConsoleProvider()],
  });
  const receipt = await runtime.safeInvoke({ providerId: 'console', capability: 'emit', target: 'console', actor: 'builder', input: { args: ['ok'] }, isolationDomainId: 'demo', capabilityTicketId: ticket.id });
  assert.equal(receipt.status, 'succeeded');
  assert.equal(receipt.output, 'isolated:ok');
  assert.equal(receipt.resourceIsolation.domainId, 'demo');
  assert.equal(kernel.domainSnapshot('demo').usage.handles, 0);
  assert.equal(kernel.listActiveHandles('demo').handleCount, 0);
});

test('Provider Runtime v2 rejects isolated invocations without tickets or when domain concurrency quota is exhausted', async () => {
  const kernel = createResourceIsolationKernel({
    defaultQuota: { maxHandles: 2, requestBytes: 128, responseBytes: 1000000, maxConcurrent: 1, timeoutMs: 1000 },
    domains: [{ id: 'demo', policy: { subjects: { builder: ['slow.work@slow'] } } }],
  });
  const runtime = createProviderRuntimeV2({
    resourceKernel: kernel,
    policy: { subjects: { builder: ['slow.work@slow'] } },
    providers: [{
      id: 'slow',
      capabilities: [{ capability: 'work', target: 'slow', modes: ['realize'] }],
      async invoke(input) {
        await new Promise(resolve => setTimeout(resolve, input.delayMs));
        return 'done';
      },
    }],
  });
  const missing = await runtime.safeInvoke({ providerId: 'slow', capability: 'work', target: 'slow', actor: 'builder', input: { delayMs: 1 }, isolationDomainId: 'demo' });
  assert.equal(missing.status, 'rejected');
  assert.equal(missing.code, 'RCL_PROVIDER_V2_RESOURCE_DENIED');
  assert.equal(missing.diagnostics[0].code, 'RCL_RESOURCE_TICKET_MISSING');

  const firstTicket = kernel.issueCapabilityTicket({ domainId: 'demo', actor: 'builder', providerId: 'slow', capability: 'work', target: 'slow' });
  const secondTicket = kernel.issueCapabilityTicket({ domainId: 'demo', actor: 'builder', providerId: 'slow', capability: 'work', target: 'slow' });
  const first = runtime.safeInvoke({ providerId: 'slow', capability: 'work', target: 'slow', actor: 'builder', input: { delayMs: 40 }, isolationDomainId: 'demo', capabilityTicketId: firstTicket.id });
  await new Promise(resolve => setTimeout(resolve, 5));
  const second = await runtime.safeInvoke({ providerId: 'slow', capability: 'work', target: 'slow', actor: 'builder', input: { delayMs: 1 }, isolationDomainId: 'demo', capabilityTicketId: secondTicket.id });
  assert.equal(second.status, 'rejected');
  assert.equal(second.diagnostics[0].diagnostics[0].code, 'RCL_RESOURCE_QUOTA_CONCURRENCY');
  assert.equal((await first).status, 'succeeded');
});

test('Provider Runtime v2 propagates isolation domain cancellation through abort signals', async () => {
  const kernel = createResourceIsolationKernel({
    defaultQuota: { maxHandles: 1, requestBytes: 128, responseBytes: 128, maxConcurrent: 1, timeoutMs: 1000 },
    domains: [{ id: 'demo', policy: { subjects: { builder: ['slow.wait@slow'] } } }],
  });
  const ticket = kernel.issueCapabilityTicket({ domainId: 'demo', actor: 'builder', providerId: 'slow', capability: 'wait', target: 'slow' });
  const runtime = createProviderRuntimeV2({
    resourceKernel: kernel,
    policy: { subjects: { builder: ['slow.wait@slow'] } },
    providers: [{
      id: 'slow',
      capabilities: [{ capability: 'wait', target: 'slow', modes: ['realize'] }],
      async invoke(_input, context) {
        return await new Promise((resolve, reject) => {
          const timer = setTimeout(() => resolve('late'), 200);
          context.signal.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(context.signal.reason);
          }, { once: true });
        });
      },
    }],
  });
  const pending = runtime.safeInvoke({ providerId: 'slow', capability: 'wait', target: 'slow', actor: 'builder', input: {}, isolationDomainId: 'demo', capabilityTicketId: ticket.id });
  await new Promise(resolve => setTimeout(resolve, 10));
  kernel.cancelDomain('demo', 'test cancellation');
  const receipt = await pending;
  assert.equal(receipt.status, 'rejected');
  assert.equal(receipt.code, 'RCL_RESOURCE_DOMAIN_CANCELLED');
  assert.ok(receipt.message.includes('test cancellation'));
  assert.equal(kernel.domainSnapshot('demo').status, 'cancelled');
  assert.equal(kernel.listActiveHandles('demo').handleCount, 0);
});

test('Resource isolation CLI demo emits a full ticket-handle-release evidence chain', () => {
  const run = spawnSync(process.execPath, ['src/cli.mjs', 'resource-isolation-demo'], { cwd: PACKAGE_ROOT, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  const payload = JSON.parse(run.stdout);
  assert.equal(payload.format, 'rcl.resource-isolation.v1.demo');
  assert.equal(payload.beforeRelease.usage.handles, 1);
  assert.equal(payload.afterRelease.usage.handles, 0);
  assert.equal(payload.activeHandles.handleCount, 0);
});

test('Resource Isolation Kernel manages region memory lifecycle and detects leaks before cleanup', () => {
  const kernel = createResourceIsolationKernel({
    defaultQuota: { maxRegions: 1, maxRegionObjects: 2, memoryBytes: 512, regionBytes: 256 },
    domains: [{ id: 'demo' }],
  });
  const region = kernel.createMemoryRegion({ domainId: 'demo', actor: 'builder', name: 'scratch', bytes: 256 });
  const object = kernel.allocateRegionObject({ regionId: region.id, kind: 'frame', bytes: 128 });
  assert.equal(kernel.domainSnapshot('demo').usage.regions, 1);
  assert.equal(kernel.domainSnapshot('demo').usage.regionBytes, 128);
  const leakReport = kernel.detectLeaks({ domainId: 'demo' });
  assert.equal(leakReport.leakedRegions.length, 1);
  assert.equal(leakReport.leakedObjects.length, 1);
  assert.throws(() => kernel.closeMemoryRegion(region.id), error => {
    assert.ok(error instanceof RCLResourceIsolationError);
    assert.equal(error.code, 'RCL_RESOURCE_REGION_NOT_EMPTY');
    return true;
  });
  const released = kernel.releaseRegionObject(object.id);
  assert.equal(released.status, 'released');
  const closed = kernel.closeMemoryRegion(region.id);
  assert.equal(closed.status, 'closed');
  assert.equal(kernel.domainSnapshot('demo').usage.regions, 0);
  assert.equal(kernel.domainSnapshot('demo').usage.regionBytes, 0);
  assert.equal(kernel.detectLeaks({ domainId: 'demo' }).leakCount, 0);
});

test('Resource Isolation Kernel runs and closes isolated VM instances with resource handles', async () => {
  const kernel = createResourceIsolationKernel({
    defaultQuota: { maxHandles: 2, maxVmInstances: 1, memoryBytes: 1024, fuel: 4 },
    domains: [{ id: 'demo', policy: { subjects: { builder: ['vm.run@rcl-native'] } } }],
  });
  const ticket = kernel.issueCapabilityTicket({ domainId: 'demo', actor: 'builder', providerId: 'vm', capability: 'run', target: 'rcl-native', maxUses: 1 });
  const vm = kernel.createIsolatedVmInstance({ domainId: 'demo', actor: 'builder', ticketId: ticket.id, memoryBytes: 256, bytecodePath: 'build/hello.rbc' });
  assert.equal(kernel.domainSnapshot('demo').usage.activeVmInstances, 1);
  assert.equal(kernel.listActiveHandles('demo').handleCount, 1);
  const receipt = await kernel.runIsolatedVmInstance(vm.id, async ({ vm: vmSnapshot }) => ({ ok: true, vmId: vmSnapshot.id }));
  assert.equal(receipt.status, 'succeeded');
  assert.equal(receipt.output.vmId, vm.id);
  const closed = kernel.closeIsolatedVmInstance(vm.id);
  assert.equal(closed.status, 'closed');
  assert.equal(kernel.domainSnapshot('demo').usage.activeVmInstances, 0);
  assert.equal(kernel.listActiveHandles('demo').handleCount, 0);
});

test('Resource Isolation Kernel contains VM crashes inside their isolation domain', async () => {
  const kernel = createResourceIsolationKernel({
    defaultQuota: { maxHandles: 4, maxVmInstances: 2, memoryBytes: 2048, fuel: 4 },
    domains: [
      { id: 'faulty', policy: { subjects: { builder: ['vm.run@rcl-native'] } } },
      { id: 'healthy', policy: { subjects: { builder: ['vm.run@rcl-native'] } } },
    ],
  });
  const faultyTicket = kernel.issueCapabilityTicket({ domainId: 'faulty', actor: 'builder', providerId: 'vm', capability: 'run', target: 'rcl-native' });
  const healthyTicket = kernel.issueCapabilityTicket({ domainId: 'healthy', actor: 'builder', providerId: 'vm', capability: 'run', target: 'rcl-native' });
  const faulty = kernel.createIsolatedVmInstance({ domainId: 'faulty', actor: 'builder', ticketId: faultyTicket.id, memoryBytes: 128 });
  const healthy = kernel.createIsolatedVmInstance({ domainId: 'healthy', actor: 'builder', ticketId: healthyTicket.id, memoryBytes: 128 });
  const crash = await kernel.runIsolatedVmInstance(faulty.id, async () => { throw new Error('synthetic VM fault'); });
  assert.equal(crash.status, 'crashed');
  assert.equal(kernel.domainSnapshot('faulty').usage.activeVmInstances, 0);
  assert.equal(kernel.domainSnapshot('faulty').usage.crashedVmInstances, 1);
  assert.equal(kernel.domainSnapshot('healthy').status, 'active');
  assert.equal(kernel.domainSnapshot('healthy').usage.activeVmInstances, 1);
  const healthyRun = await kernel.runIsolatedVmInstance(healthy.id, async () => 'still-running');
  assert.equal(healthyRun.status, 'succeeded');
});

test('Resource lifecycle CLI demo emits leak detection, VM crash boundary and cleanup evidence', () => {
  const run = spawnSync(process.execPath, ['src/cli.mjs', 'resource-lifecycle-demo'], { cwd: PACKAGE_ROOT, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  const payload = JSON.parse(run.stdout);
  assert.equal(payload.format, 'rcl.resource-isolation.v1.lifecycle-demo');
  assert.equal(payload.leaksBeforeClose.leakCount >= 2, true);
  assert.equal(payload.crashReceipt.status, 'crashed');
  assert.equal(payload.peerBefore.status, 'active');
  assert.equal(payload.leaksAfterCleanup.leakCount, 0);
});
