import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { realityRoot } from './canonical.mjs';
import { runNativeBytecode } from './native-vm.mjs';
import {
  RCLResourceIsolationKernel,
  RCLResourceIsolationError,
  createResourceIsolationKernel,
} from './resource-isolation-kernel.mjs';

export const RCL_RESOURCE_WAL_VERSION = '0.28.0-alpha.1';
export const RCL_RESOURCE_WAL_FORMAT = 'rcl.resource-wal.v1';

export class RCLResourceWalError extends Error {
  constructor(code, message, diagnostics = []) {
    super(message);
    this.name = 'RCLResourceWalError';
    this.code = code;
    this.diagnostics = diagnostics;
  }
}

function nowIso() { return new Date().toISOString(); }

function clone(value) {
  if (value === undefined) return undefined;
  return structuredClone(value);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function safeJson(value) {
  return JSON.stringify(value ?? null);
}

function makeWalRecord(type, payload = {}, sequence = 0) {
  const withoutRoot = {
    format: `${RCL_RESOURCE_WAL_FORMAT}.record`,
    walVersion: RCL_RESOURCE_WAL_VERSION,
    sequence,
    type,
    at: nowIso(),
    payload: clone(payload),
  };
  return Object.freeze({ ...withoutRoot, root: realityRoot(withoutRoot) });
}

function makeReport(formatSuffix, payload = {}) {
  const withoutRoot = {
    format: `${RCL_RESOURCE_WAL_FORMAT}.${formatSuffix}`,
    walVersion: RCL_RESOURCE_WAL_VERSION,
    ...payload,
  };
  return Object.freeze({ ...withoutRoot, root: realityRoot(withoutRoot) });
}

export function defaultResourceWalPath(baseDir = process.cwd()) {
  return path.join(baseDir, '.rcl-resource-runtime', 'resource.wal.jsonl');
}

export function readResourceWal(walPath) {
  if (!walPath || !fs.existsSync(walPath)) return [];
  const text = fs.readFileSync(walPath, 'utf8').trim();
  if (!text) return [];
  return text.split(/\r?\n/).filter(Boolean).map((line, index) => {
    try {
      return JSON.parse(line);
    } catch (error) {
      throw new RCLResourceWalError('RCL_RESOURCE_WAL_PARSE_FAILED', `Cannot parse WAL line ${index + 1}`, [{ walPath, line: index + 1, message: error.message }]);
    }
  });
}

export function recoverResourceKernelFromWal(walPath, options = {}) {
  const records = readResourceWal(walPath);
  const snapshots = records.filter(record => record.type === 'checkpoint.snapshot' && record.payload?.snapshot);
  const lastSnapshotRecord = snapshots.at(-1) ?? null;
  const kernel = lastSnapshotRecord
    ? RCLResourceIsolationKernel.fromSnapshot(lastSnapshotRecord.payload.snapshot)
    : createResourceIsolationKernel(options.kernelOptions ?? {});
  return makeReport('recovery', {
    walPath,
    recordCount: records.length,
    checkpointCount: snapshots.length,
    recovered: Boolean(lastSnapshotRecord),
    recoveredSequence: lastSnapshotRecord?.sequence ?? null,
    kernel: kernel.snapshot({ includeEventLog: false }),
  });
}

export class RCLResourceWalRuntime {
  constructor(options = {}) {
    this.walPath = options.walPath ?? defaultResourceWalPath(options.baseDir ?? process.cwd());
    this.kernel = options.kernel ?? createResourceIsolationKernel(options.kernelOptions ?? {});
    this.snapshotEvery = Number.isInteger(options.snapshotEvery) && options.snapshotEvery > 0 ? options.snapshotEvery : 1;
    this.operationCountSinceCheckpoint = 0;
    ensureDir(path.dirname(this.walPath));
    const existing = readResourceWal(this.walPath);
    this.sequence = existing.length > 0 ? Math.max(...existing.map(record => record.sequence ?? 0)) : 0;
    if (options.recover === true && existing.length > 0) {
      const recovery = recoverResourceKernelFromWal(this.walPath, options);
      this.kernel = RCLResourceIsolationKernel.fromSnapshot(recovery.kernel);
    }
    if (options.recordBoot !== false) {
      this.append('runtime.booted', { kernel: this.kernel.snapshot({ includeEventLog: false }) });
    }
  }

  append(type, payload = {}) {
    this.sequence += 1;
    const record = makeWalRecord(type, payload, this.sequence);
    fs.appendFileSync(this.walPath, `${JSON.stringify(record)}\n`, 'utf8');
    return record;
  }

  checkpoint(reason = 'checkpoint') {
    const snapshot = this.kernel.snapshot({ includeEventLog: true });
    this.operationCountSinceCheckpoint = 0;
    return this.append('checkpoint.snapshot', { reason, snapshot });
  }

  maybeCheckpoint(reason) {
    this.operationCountSinceCheckpoint += 1;
    if (this.operationCountSinceCheckpoint >= this.snapshotEvery) return this.checkpoint(reason);
    return null;
  }

  recordOperation(type, input, fn) {
    const started = this.append(`${type}.started`, { input: clone(input) });
    try {
      const result = fn();
      const succeeded = this.append(`${type}.succeeded`, { startedRoot: started.root, result: clone(result) });
      const checkpoint = this.maybeCheckpoint(`${type}.succeeded`);
      return { result, wal: { started, succeeded, checkpoint } };
    } catch (error) {
      const failed = this.append(`${type}.failed`, {
        startedRoot: started.root,
        error: { name: error?.name ?? 'Error', code: error?.code ?? 'RCL_RESOURCE_WAL_OPERATION_FAILED', message: error?.message ?? String(error), diagnostics: clone(error?.diagnostics ?? []) },
      });
      this.maybeCheckpoint(`${type}.failed`);
      throw Object.assign(error, { walRecord: failed });
    }
  }

  async recordAsyncOperation(type, input, fn) {
    const started = this.append(`${type}.started`, { input: clone(input) });
    try {
      const result = await fn();
      const succeeded = this.append(`${type}.succeeded`, { startedRoot: started.root, result: clone(result) });
      const checkpoint = this.maybeCheckpoint(`${type}.succeeded`);
      return { result, wal: { started, succeeded, checkpoint } };
    } catch (error) {
      const failed = this.append(`${type}.failed`, {
        startedRoot: started.root,
        error: { name: error?.name ?? 'Error', code: error?.code ?? 'RCL_RESOURCE_WAL_ASYNC_OPERATION_FAILED', message: error?.message ?? String(error), diagnostics: clone(error?.diagnostics ?? []) },
      });
      this.maybeCheckpoint(`${type}.failed`);
      throw Object.assign(error, { walRecord: failed });
    }
  }

  createDomain(options = {}) {
    return this.recordOperation('domain.create', options, () => this.kernel.createDomain(options)).result;
  }

  issueCapabilityTicket(options = {}) {
    return this.recordOperation('ticket.issue', options, () => this.kernel.issueCapabilityTicket(options)).result;
  }

  createMemoryRegion(options = {}) {
    return this.recordOperation('region.create', options, () => this.kernel.createMemoryRegion(options)).result;
  }

  allocateRegionObject(options = {}) {
    return this.recordOperation('region.object.allocate', options, () => this.kernel.allocateRegionObject(options)).result;
  }

  releaseRegionObject(objectId, options = {}) {
    return this.recordOperation('region.object.release', { objectId, options }, () => this.kernel.releaseRegionObject(objectId, options)).result;
  }

  closeMemoryRegion(regionId, options = {}) {
    return this.recordOperation('region.close', { regionId, options }, () => this.kernel.closeMemoryRegion(regionId, options)).result;
  }

  createIsolatedVmInstance(options = {}) {
    return this.recordOperation('vm.create', options, () => this.kernel.createIsolatedVmInstance(options)).result;
  }

  async runIsolatedVmInstance(vmId, runner, options = {}) {
    return (await this.recordAsyncOperation('vm.run', { vmId, options }, () => this.kernel.runIsolatedVmInstance(vmId, runner, options))).result;
  }

  closeIsolatedVmInstance(vmId, options = {}) {
    return this.recordOperation('vm.close', { vmId, options }, () => this.kernel.closeIsolatedVmInstance(vmId, options)).result;
  }

  crashDomain(domainId = 'default', reason = 'domain crashed') {
    return this.recordOperation('domain.crash', { domainId, reason }, () => this.kernel.crashDomain(domainId, reason)).result;
  }

  cancelDomain(domainId = 'default', reason = 'cancel requested') {
    return this.recordOperation('domain.cancel', { domainId, reason }, () => this.kernel.cancelDomain(domainId, reason)).result;
  }

  detectLeaks(options = {}) {
    return this.recordOperation('leaks.detect', options, () => this.kernel.detectLeaks(options)).result;
  }

  async runIsolatedNativeVm(options = {}) {
    const ticketId = options.ticketId;
    if (!ticketId) throw new RCLResourceWalError('RCL_RESOURCE_WAL_NATIVE_TICKET_MISSING', 'Native VM wrapper requires a capability ticket', [{ options }]);
    const vm = this.createIsolatedVmInstance({
      domainId: options.domainId ?? 'default',
      actor: options.actor ?? 'anonymous',
      ticketId,
      providerId: options.providerId ?? 'vm',
      capability: options.capability ?? 'run',
      target: options.target ?? 'rcl-native',
      runtime: 'rcl-native',
      bytecodePath: options.bytecodePath ?? null,
      memoryBytes: options.memoryBytes,
      metadata: { wrapper: 'resource-wal-native-vm', ...(options.metadata ?? {}) },
    });
    const runner = options.runner ?? (({ vm: vmSnapshot }) => {
      if (!vmSnapshot.bytecodePath) throw new RCLResourceWalError('RCL_RESOURCE_WAL_NATIVE_BYTECODE_MISSING', 'Native VM wrapper requires bytecodePath when no runner is supplied', [{ vmId: vmSnapshot.id }]);
      return runNativeBytecode(vmSnapshot.bytecodePath, options.nativeOptions ?? {});
    });
    const receipt = await this.runIsolatedVmInstance(vm.id, runner, { fuelCost: options.fuelCost ?? 1, throwOnCrash: options.throwOnCrash === true });
    return makeReport('native-vm-wrapper', { vm, receipt, walPath: this.walPath });
  }

  recover() {
    return recoverResourceKernelFromWal(this.walPath);
  }

  summarizeWal() {
    const records = readResourceWal(this.walPath);
    const typeCounts = Object.fromEntries([...new Set(records.map(record => record.type))].sort().map(type => [type, records.filter(record => record.type === type).length]));
    return makeReport('summary', { walPath: this.walPath, recordCount: records.length, typeCounts, lastSequence: records.at(-1)?.sequence ?? null });
  }
}

export function createResourceWalRuntime(options = {}) {
  return new RCLResourceWalRuntime(options);
}

export async function runResourceWalDemo(options = {}) {
  const baseDir = options.baseDir ?? fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-resource-wal-demo-'));
  const walPath = options.walPath ?? path.join(baseDir, 'resource.wal.jsonl');
  const runtime = createResourceWalRuntime({
    walPath,
    snapshotEvery: 1,
    kernelOptions: {
      defaultQuota: { maxHandles: 4, maxRegions: 2, maxRegionObjects: 4, maxVmInstances: 2, memoryBytes: 4096, regionBytes: 2048, fuel: 8, timeoutMs: 500 },
      domains: [
        { id: 'lab', policy: { subjects: { builder: ['vm.run@rcl-native'] } }, metadata: { purpose: 'wal-crash-replay-demo' } },
        { id: 'peer', policy: { subjects: { builder: ['vm.run@rcl-native'] } }, metadata: { purpose: 'wal-peer-domain' } },
      ],
    },
  });
  const region = runtime.createMemoryRegion({ domainId: 'lab', actor: 'builder', name: 'wal_scratch', bytes: 512 });
  const object = runtime.allocateRegionObject({ regionId: region.id, kind: 'rbc-frame', bytes: 128 });
  const ticket = runtime.issueCapabilityTicket({ domainId: 'lab', actor: 'builder', providerId: 'vm', capability: 'run', target: 'rcl-native', maxUses: 1 });
  const native = await runtime.runIsolatedNativeVm({
    domainId: 'lab',
    actor: 'builder',
    ticketId: ticket.id,
    bytecodePath: 'build/demo.rbc',
    memoryBytes: 256,
    runner: ({ vm }) => ({ status: 'proxy-native-ok', vmId: vm.id, bytecodePath: vm.bytecodePath }),
  });
  const leaksBeforeCleanup = runtime.detectLeaks({ domainId: 'lab' });
  const closedObject = runtime.releaseRegionObject(object.id, { reason: 'demo-cleanup' });
  const closedRegion = runtime.closeMemoryRegion(region.id, { reason: 'demo-cleanup' });
  const closedVm = runtime.closeIsolatedVmInstance(native.vm.id, { reason: 'demo-cleanup' });
  const finalCheckpoint = runtime.checkpoint('demo-final');
  const recovery = runtime.recover();
  const summary = runtime.summarizeWal();
  return makeReport('demo', {
    baseDir,
    walPath,
    region,
    object,
    ticket,
    native,
    leaksBeforeCleanup,
    closedObject,
    closedRegion,
    closedVm,
    finalCheckpoint,
    recovery,
    summary,
  });
}
