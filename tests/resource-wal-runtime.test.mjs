import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createResourceIsolationKernel,
  RCLResourceIsolationKernel,
  createResourceWalRuntime,
  readResourceWal,
  recoverResourceKernelFromWal,
} from '../src/index.mjs';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function tempDir() {
  return mkdtempSync(path.join(tmpdir(), 'rcl-wal-test-'));
}

test('Resource Isolation Kernel snapshots and rehydrates domains, regions and active VMs', () => {
  const kernel = createResourceIsolationKernel({
    defaultQuota: { maxHandles: 2, maxRegions: 1, maxVmInstances: 1, memoryBytes: 1024, regionBytes: 512, fuel: 4 },
    domains: [{ id: 'lab', policy: { subjects: { builder: ['vm.run@rcl-native'] } } }],
  });
  const region = kernel.createMemoryRegion({ domainId: 'lab', actor: 'builder', name: 'scratch', bytes: 256 });
  const object = kernel.allocateRegionObject({ regionId: region.id, kind: 'frame', bytes: 128 });
  const ticket = kernel.issueCapabilityTicket({ domainId: 'lab', actor: 'builder', providerId: 'vm', capability: 'run', target: 'rcl-native' });
  const vm = kernel.createIsolatedVmInstance({ domainId: 'lab', actor: 'builder', ticketId: ticket.id, memoryBytes: 128 });
  const snapshot = kernel.snapshot();
  const recovered = RCLResourceIsolationKernel.fromSnapshot(snapshot);
  assert.equal(recovered.domainSnapshot('lab').usage.regions, 1);
  assert.equal(recovered.domainSnapshot('lab').usage.regionObjects, 1);
  assert.equal(recovered.domainSnapshot('lab').usage.activeVmInstances, 1);
  assert.equal(recovered.listMemoryRegions('lab').regions[0].id, region.id);
  assert.equal(recovered.listRegionObjects('lab').objects[0].id, object.id);
  assert.equal(recovered.listIsolatedVmInstances('lab').vms[0].id, vm.id);
});

test('Resource WAL Runtime persists checkpoints and recovers the last lifecycle state', async () => {
  const dir = tempDir();
  try {
    const walPath = path.join(dir, 'resource.wal.jsonl');
    const runtime = createResourceWalRuntime({
      walPath,
      snapshotEvery: 1,
      kernelOptions: {
        defaultQuota: { maxHandles: 2, maxRegions: 1, maxVmInstances: 1, memoryBytes: 1024, regionBytes: 512, fuel: 4 },
        domains: [{ id: 'lab', policy: { subjects: { builder: ['vm.run@rcl-native'] } } }],
      },
    });
    const region = runtime.createMemoryRegion({ domainId: 'lab', actor: 'builder', name: 'scratch', bytes: 256 });
    const object = runtime.allocateRegionObject({ regionId: region.id, kind: 'frame', bytes: 128 });
    const ticket = runtime.issueCapabilityTicket({ domainId: 'lab', actor: 'builder', providerId: 'vm', capability: 'run', target: 'rcl-native' });
    const vm = runtime.createIsolatedVmInstance({ domainId: 'lab', actor: 'builder', ticketId: ticket.id, memoryBytes: 128 });
    const crash = await runtime.runIsolatedVmInstance(vm.id, async () => { throw new Error('synthetic replay fault'); });
    assert.equal(crash.status, 'crashed');
    runtime.releaseRegionObject(object.id, { reason: 'test-cleanup' });
    runtime.closeMemoryRegion(region.id, { reason: 'test-cleanup' });

    const records = readResourceWal(walPath);
    assert.ok(records.some(record => record.type === 'vm.run.succeeded'));
    assert.ok(records.some(record => record.type === 'checkpoint.snapshot'));
    const recovery = recoverResourceKernelFromWal(walPath);
    assert.equal(recovery.recovered, true);
    assert.equal(recovery.kernel.domains.find(domain => domain.id === 'lab').usage.crashedVmInstances, 1);
    assert.equal(recovery.kernel.domains.find(domain => domain.id === 'lab').usage.regions, 0);
    assert.equal(recovery.kernel.vmInstances[0].status, 'crashed');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('Resource WAL Runtime wraps isolated native VM execution without requiring direct native access in tests', async () => {
  const dir = tempDir();
  try {
    const runtime = createResourceWalRuntime({
      walPath: path.join(dir, 'resource.wal.jsonl'),
      snapshotEvery: 1,
      kernelOptions: {
        defaultQuota: { maxHandles: 1, maxVmInstances: 1, memoryBytes: 1024, fuel: 3 },
        domains: [{ id: 'lab', policy: { subjects: { builder: ['vm.run@rcl-native'] } } }],
      },
    });
    const ticket = runtime.issueCapabilityTicket({ domainId: 'lab', actor: 'builder', providerId: 'vm', capability: 'run', target: 'rcl-native' });
    const native = await runtime.runIsolatedNativeVm({
      domainId: 'lab',
      actor: 'builder',
      ticketId: ticket.id,
      bytecodePath: 'build/hello.rbc',
      memoryBytes: 128,
      runner: ({ vm }) => ({ status: 'proxy-native-ok', bytecodePath: vm.bytecodePath }),
    });
    assert.equal(native.receipt.status, 'succeeded');
    assert.equal(native.receipt.output.status, 'proxy-native-ok');
    assert.equal(runtime.kernel.domainSnapshot('lab').usage.activeVmInstances, 1);
    runtime.closeIsolatedVmInstance(native.vm.id, { reason: 'test-complete' });
    assert.equal(runtime.kernel.listActiveHandles('lab').handleCount, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('Resource WAL CLI demo emits WAL summary and recoverable kernel state', () => {
  const dir = tempDir();
  try {
    const run = spawnSync(process.execPath, ['src/cli.mjs', 'resource-wal-demo', dir], { cwd: PACKAGE_ROOT, encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    const payload = JSON.parse(run.stdout);
    assert.equal(payload.format, 'rcl.resource-wal.v1.demo');
    assert.equal(payload.native.receipt.status, 'succeeded');
    assert.equal(payload.recovery.recovered, true);
    assert.equal(payload.recovery.kernel.domains.find(domain => domain.id === 'lab').usage.handles, 0);
    assert.ok(payload.summary.recordCount > 10);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
