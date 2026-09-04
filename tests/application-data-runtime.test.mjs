import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  beginApplicationDataRequest,
  cancelApplicationDataRequest,
  createApplicationDataMutation,
  createApplicationDataResource,
  createApplicationDataSnapshot,
  createApplicationDataSyncPlan,
  executeApplicationDataRequest,
  persistApplicationDataSnapshot,
  readApplicationDataCache,
  recoverApplicationDataSnapshot,
  settleApplicationDataMutation,
  settleApplicationDataRequest,
  settleApplicationDataSync,
  setApplicationDataConnectivity,
} from '../src/index.mjs';
import { realityRoot } from '../src/canonical.mjs';
import { createResourceWalRuntime } from '../src/resource-wal-runtime.mjs';

function rooted(core) {
  return { ...core, root: realityRoot(core) };
}

function rootedDataReceipt({ requestId, providerId = 'api', capability = 'read', output }) {
  return rooted({
    format: 'test.provider-receipt.v0.1',
    requestId,
    providerId,
    capability,
    status: 'succeeded',
    output,
    outputRoot: realityRoot(output),
  });
}

function rootedFailureReceipt({ requestId, mutationId, providerId = 'api', capability = 'read', code = 'TEST_PROVIDER_REJECTED' }) {
  const core = {
    format: 'test.provider-receipt.v0.1',
    requestId,
    providerId,
    capability,
    status: 'rejected',
    code,
    message: code,
  };
  if (mutationId !== undefined) core.mutationId = mutationId;
  return rooted(core);
}

function resource(overrides = {}) {
  return createApplicationDataResource({
    resourceId: 'todos',
    queryKey: 'todos:list',
    providerId: 'api',
    target: 'todo-service',
    actor: 'user',
    initialData: [{ id: 1, title: 'first' }],
    ...overrides,
  });
}

test('application data resource and transitions retain valid content roots', () => {
  const initial = resource();
  assert.equal(initial.status, 'ready');
  const begun = beginApplicationDataRequest(initial, { requestId: 'read-1', input: { page: 1 } });
  assert.equal(begun.state.status, 'loading');
  assert.equal(begun.state.activeRequestId, 'read-1');
  assert.equal(begun.state.root, realityRoot({ ...begun.state, root: undefined }));
  const settled = settleApplicationDataRequest(begun.state, rootedDataReceipt({
    requestId: 'read-1',
    output: [{ id: 2, title: 'second' }],
  }));
  assert.equal(settled.status, 'ready');
  assert.deepEqual(settled.data, [{ id: 2, title: 'second' }]);
  assert.equal(settled.dataRoot, realityRoot(settled.data));
  assert.equal(settled.root, realityRoot({ ...settled, root: undefined }));
});

test('stale and cancelled provider responses fail closed', () => {
  const first = beginApplicationDataRequest(resource(), { requestId: 'read-1' });
  const second = beginApplicationDataRequest(first.state, { requestId: 'read-2' });
  assert.throws(
    () => settleApplicationDataRequest(second.state, rootedDataReceipt({ requestId: 'read-1', output: { stale: true } })),
    /RCL_APPLICATION_DATA_REQUEST_ID_MISMATCH/u,
  );

  const cancelled = cancelApplicationDataRequest(first.state, 'read-1', 'user navigated away');
  assert.equal(cancelled.state.status, 'stale');
  assert.equal(cancelled.state.activeRequestId, null);
  assert.throws(
    () => settleApplicationDataRequest(cancelled.state, rootedDataReceipt({ requestId: 'read-1', output: { late: true } })),
    /RCL_APPLICATION_DATA_REQUEST_NOT_ACTIVE/u,
  );
});

test('offline cache is visible under serve-cache and provider execution is blocked', () => {
  const offline = setApplicationDataConnectivity(resource({ offlinePolicy: 'serve-cache' }), false, 'network unavailable');
  const cache = readApplicationDataCache(offline);
  assert.equal(cache.status, 'CACHE_HIT');
  assert.equal(cache.stale, true);
  assert.deepEqual(cache.data, [{ id: 1, title: 'first' }]);
  assert.throws(() => beginApplicationDataRequest(offline, { requestId: 'offline-read' }), /RCL_APPLICATION_DATA_OFFLINE_PROVIDER_BLOCKED/u);

  const failClosed = setApplicationDataConnectivity(resource({ offlinePolicy: 'fail-closed' }), false);
  assert.throws(() => readApplicationDataCache(failClosed), /RCL_APPLICATION_DATA_CACHE_BLOCKED_OFFLINE_POLICY/u);
});

test('optimistic mutations settle only against the bound provider and expose conflicts', () => {
  const proposed = createApplicationDataMutation(resource(), {
    mutationId: 'mutation-1',
    nextData: [{ id: 1, title: 'edited' }],
  });
  assert.equal(proposed.state.status, 'dirty');
  assert.deepEqual(proposed.state.data, [{ id: 1, title: 'edited' }]);
  assert.throws(
    () => settleApplicationDataMutation(proposed.state, rootedFailureReceipt({
      mutationId: 'mutation-1',
      providerId: 'other-api',
      capability: 'write',
      code: 'WRONG_PROVIDER',
    })),
    /RCL_APPLICATION_DATA_MUTATION_PROVIDER_BINDING_MISMATCH/u,
  );
  const conflicted = settleApplicationDataMutation(proposed.state, rootedFailureReceipt({
    mutationId: 'mutation-1',
    providerId: 'api',
    capability: 'write',
    code: 'REMOTE_VERSION_CONFLICT',
  }));
  assert.equal(conflicted.status, 'conflict');
  assert.equal(conflicted.sync.status, 'conflict');
  assert.equal(conflicted.error.code, 'REMOTE_VERSION_CONFLICT');
});

test('sync consumes only known mutations and records accepted receipts', () => {
  const proposed = createApplicationDataMutation(resource(), {
    mutationId: 'mutation-1',
    nextData: [{ id: 1, title: 'edited' }],
  });
  const planned = createApplicationDataSyncPlan(proposed.state, { requestId: 'sync-1' });
  assert.equal(planned.state.status, 'syncing');
  const unknown = rooted({
    format: 'test.provider-receipt.v0.1',
    requestId: 'sync-1',
    providerId: 'api',
    capability: 'sync',
    status: 'succeeded',
    output: { acceptedMutationIds: ['not-pending'] },
    outputRoot: realityRoot({ acceptedMutationIds: ['not-pending'] }),
  });
  assert.throws(() => settleApplicationDataSync(planned.state, unknown), /RCL_APPLICATION_DATA_SYNC_MUTATION_UNKNOWN/u);

  const settled = settleApplicationDataSync(planned.state, rooted({
    format: 'test.provider-receipt.v0.1',
    requestId: 'sync-1',
    providerId: 'api',
    capability: 'sync',
    status: 'succeeded',
    output: {
      acceptedMutationIds: ['mutation-1'],
      data: [{ id: 1, title: 'edited' }],
      remoteRevision: 3,
    },
    outputRoot: realityRoot({
      acceptedMutationIds: ['mutation-1'],
      data: [{ id: 1, title: 'edited' }],
      remoteRevision: 3,
    }),
  }));
  assert.equal(settled.status, 'ready');
  assert.deepEqual(settled.pendingMutations, []);
  assert.equal(settled.remoteRevision, 3);
  assert.equal(settled.sync.status, 'synced');
});

test('snapshot persistence and recovery remain rooted at the host WAL boundary', () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-application-data-test-'));
  const walPath = path.join(baseDir, 'resource.wal.jsonl');
  const wal = createResourceWalRuntime({ walPath, recordBoot: false });
  const snapshot = createApplicationDataSnapshot(resource());
  const persisted = persistApplicationDataSnapshot(snapshot, wal);
  assert.equal(persisted.status, 'PERSISTED_TO_HOST_WAL');
  assert.equal(persisted.durableCommitPerformed, false);
  const recovered = recoverApplicationDataSnapshot(walPath, 'todos');
  assert.ok(recovered);
  assert.equal(recovered.status, 'RECOVERED_FROM_HOST_WAL');
  assert.equal(recovered.state.root, snapshot.stateRoot);
  assert.equal(recovered.snapshotRoot, snapshot.snapshotRoot);
  assert.equal(recovered.recoveryRoot, realityRoot({ ...recovered, recoveryRoot: undefined }));
});

test('async provider adapter preserves RCL lifecycle while leaving execution to the provider', async () => {
  const providerRuntime = {
    async safeInvoke(request) {
      return rootedDataReceipt({
        requestId: request.requestId,
        providerId: request.providerId,
        capability: request.capability,
        output: { rows: [{ id: 7 }], input: request.input },
      });
    },
  };
  const result = await executeApplicationDataRequest(resource(), providerRuntime, {
    requestId: 'read-async',
    input: { filter: 'open' },
  });
  assert.equal(result.state.status, 'ready');
  assert.equal(result.state.data.rows[0].id, 7);
  assert.equal(result.state.lastProviderReceiptRoot, result.receipt.root);
  assert.equal(result.state.canonicalCommitPerformed, false);
});

test('provider exceptions become rooted rejected states instead of escaping the RCL lifecycle', async () => {
  const result = await executeApplicationDataRequest(resource(), {
    async safeInvoke() {
      const error = new Error('provider disconnected');
      error.code = 'PROVIDER_DISCONNECTED';
      throw error;
    },
  }, { requestId: 'read-provider-error' });
  assert.equal(result.state.status, 'stale');
  assert.equal(result.state.error.code, 'PROVIDER_DISCONNECTED');
  assert.equal(result.state.lastProviderReceiptRoot, result.receipt.root);
});
