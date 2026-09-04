import { realityRoot } from './canonical.mjs';
import { readResourceWal } from './resource-wal-runtime.mjs';

export const RCL_APPLICATION_DATA_RUNTIME_VERSION = '0.1.0-alpha.1';
export const RCL_APPLICATION_DATA_RESOURCE_FORMAT = 'rcl.application-data-resource.v0.1';
export const RCL_APPLICATION_DATA_REQUEST_FORMAT = 'rcl.application-data-request.v0.1';
export const RCL_APPLICATION_DATA_MUTATION_FORMAT = 'rcl.application-data-mutation.v0.1';
export const RCL_APPLICATION_DATA_SYNC_FORMAT = 'rcl.application-data-sync.v0.1';
export const RCL_APPLICATION_DATA_SNAPSHOT_FORMAT = 'rcl.application-data-snapshot.v0.1';
export const RCL_APPLICATION_DATA_PERSISTENCE_FORMAT = 'rcl.application-data-persistence.v0.1';

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_.-]*$/u;
const ROOT = /^[0-9a-f]{64}$/u;
const DATA_AUTHORITIES = Object.freeze(['application-local', 'provider', 'rncs']);
const OFFLINE_POLICIES = Object.freeze(['serve-cache', 'fail-closed']);
const CONFLICT_POLICIES = Object.freeze(['fail-closed', 'manual']);
const REQUEST_FAILURE_STATUSES = new Set(['rejected', 'failed', 'cancelled', 'aborted']);

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requiredId(value, code) {
  if (typeof value !== 'string' || !IDENTIFIER.test(value)) throw new TypeError(code);
  return value;
}

function requiredText(value, code) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new TypeError(code);
  return value.trim();
}

function optionalRoot(value, code) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' || !ROOT.test(value)) throw new TypeError(code);
  return value;
}

function nonNegativeInteger(value, fallback, code) {
  const normalized = value === undefined || value === null ? fallback : value;
  if (!Number.isSafeInteger(normalized) || normalized < 0) throw new TypeError(code);
  return normalized;
}

function freeze(value) {
  return Object.freeze(value);
}

function rooted(core, key = 'root') {
  const withoutRoot = { ...core };
  delete withoutRoot[key];
  return freeze({ ...withoutRoot, [key]: realityRoot(withoutRoot) });
}

function validateReceipt(receipt) {
  if (!isObject(receipt) || !ROOT.test(receipt.root ?? '')) throw new Error('RCL_APPLICATION_DATA_PROVIDER_RECEIPT_REQUIRED');
  const { root: receiptRoot, ...withoutRoot } = receipt;
  if (receiptRoot !== realityRoot(withoutRoot)) throw new Error('RCL_APPLICATION_DATA_PROVIDER_RECEIPT_ROOT_MISMATCH');
  return receipt;
}

function providerExceptionReceipt(request, error, code = 'RCL_APPLICATION_DATA_PROVIDER_EXCEPTION') {
  return rooted({
    format: 'rcl.application-data-provider-exception.v0.1',
    requestId: request.requestId,
    providerId: request.providerId,
    capability: request.capability,
    status: 'rejected',
    code: error?.code ?? code,
    message: error?.message ?? String(error),
  });
}

function validateOptionalOutputRoot(receipt, code) {
  if (!Object.prototype.hasOwnProperty.call(receipt, 'output')) return;
  if (!ROOT.test(receipt.outputRoot ?? '') || receipt.outputRoot !== realityRoot(receipt.output ?? null)) {
    throw new Error(code);
  }
}

function validateState(state) {
  if (!isObject(state) || state.format !== RCL_APPLICATION_DATA_RESOURCE_FORMAT || !ROOT.test(state.root ?? '')) {
    throw new Error('RCL_APPLICATION_DATA_STATE_INVALID');
  }
  const { root: stateRoot, ...withoutRoot } = state;
  if (stateRoot !== realityRoot(withoutRoot)) throw new Error('RCL_APPLICATION_DATA_STATE_ROOT_MISMATCH');
  return state;
}

function transition(state, patch, type, details = {}) {
  const next = {
    ...state,
    ...clone(patch),
    revision: state.revision + 1,
    lastTransition: {
      type,
      fromStatus: state.status,
      toStatus: patch.status ?? state.status,
      revision: state.revision + 1,
      details: clone(details),
    },
  };
  return rooted(next);
}

function assertProviderReceiptForRequest(request, receipt) {
  validateReceipt(receipt);
  if (receipt.requestId !== request.requestId) throw new Error('RCL_APPLICATION_DATA_REQUEST_ID_MISMATCH');
  if (receipt.providerId !== request.providerId || receipt.capability !== request.capability) {
    throw new Error('RCL_APPLICATION_DATA_PROVIDER_BINDING_MISMATCH');
  }
  if (receipt.status === 'succeeded') {
    if (!ROOT.test(receipt.outputRoot ?? '') || receipt.outputRoot !== realityRoot(receipt.output ?? null)) {
      throw new Error('RCL_APPLICATION_DATA_OUTPUT_ROOT_MISMATCH');
    }
  } else if (!REQUEST_FAILURE_STATUSES.has(receipt.status)) {
    throw new Error('RCL_APPLICATION_DATA_PROVIDER_STATUS_INVALID');
  }
}

export function normalizeApplicationDataResourceSpec(input = {}) {
  if (!isObject(input)) throw new TypeError('RCL_APPLICATION_DATA_SPEC_OBJECT_REQUIRED');
  const resourceId = requiredId(input.resourceId ?? input.id, 'RCL_APPLICATION_DATA_RESOURCE_ID_REQUIRED');
  const queryKey = requiredText(input.queryKey ?? resourceId, 'RCL_APPLICATION_DATA_QUERY_KEY_REQUIRED');
  const dataAuthority = input.dataAuthority ?? 'provider';
  if (!DATA_AUTHORITIES.includes(dataAuthority)) throw new Error(`RCL_APPLICATION_DATA_AUTHORITY_INVALID:${dataAuthority}`);
  const offlinePolicy = input.offlinePolicy ?? 'serve-cache';
  if (!OFFLINE_POLICIES.includes(offlinePolicy)) throw new Error(`RCL_APPLICATION_DATA_OFFLINE_POLICY_INVALID:${offlinePolicy}`);
  const conflictPolicy = input.conflictPolicy ?? 'fail-closed';
  if (!CONFLICT_POLICIES.includes(conflictPolicy)) throw new Error(`RCL_APPLICATION_DATA_CONFLICT_POLICY_INVALID:${conflictPolicy}`);
  const providerId = input.providerId === null || input.providerId === undefined ? null : requiredId(input.providerId, 'RCL_APPLICATION_DATA_PROVIDER_ID_INVALID');
  const capability = input.capability === null || input.capability === undefined ? 'read' : requiredId(input.capability, 'RCL_APPLICATION_DATA_CAPABILITY_INVALID');
  const target = input.target === null || input.target === undefined ? 'application-data' : requiredText(input.target, 'RCL_APPLICATION_DATA_TARGET_INVALID');
  const actor = input.actor === null || input.actor === undefined ? 'application' : requiredId(input.actor, 'RCL_APPLICATION_DATA_ACTOR_INVALID');
  const persistenceKey = input.persistenceKey === null || input.persistenceKey === undefined
    ? resourceId
    : requiredText(input.persistenceKey, 'RCL_APPLICATION_DATA_PERSISTENCE_KEY_INVALID');
  if (input.initialData !== undefined && typeof input.initialData === 'function') throw new TypeError('RCL_APPLICATION_DATA_INITIAL_DATA_INVALID');
  return freeze({
    format: 'rcl.application-data-resource-spec.v0.1',
    version: RCL_APPLICATION_DATA_RUNTIME_VERSION,
    resourceId,
    queryKey,
    providerId,
    capability,
    target,
    actor,
    dataAuthority,
    offlinePolicy,
    conflictPolicy,
    persistenceKey,
    cacheMaxAgeMs: input.cacheMaxAgeMs === null || input.cacheMaxAgeMs === undefined
      ? null
      : nonNegativeInteger(input.cacheMaxAgeMs, 0, 'RCL_APPLICATION_DATA_CACHE_MAX_AGE_INVALID'),
    initialData: clone(input.initialData ?? null),
    semanticOwner: 'rcl',
    providerExecutionOwner: 'provider',
    canonicalWorldOwner: 'rncs',
  });
}

export function createApplicationDataResource(input = {}) {
  const spec = normalizeApplicationDataResourceSpec(input);
  const initialData = clone(spec.initialData);
  const core = {
    format: RCL_APPLICATION_DATA_RESOURCE_FORMAT,
    version: RCL_APPLICATION_DATA_RUNTIME_VERSION,
    resourceId: spec.resourceId,
    queryKey: spec.queryKey,
    providerId: spec.providerId,
    capability: spec.capability,
    target: spec.target,
    actor: spec.actor,
    dataAuthority: spec.dataAuthority,
    offlinePolicy: spec.offlinePolicy,
    conflictPolicy: spec.conflictPolicy,
    persistenceKey: spec.persistenceKey,
    cacheMaxAgeMs: spec.cacheMaxAgeMs,
    status: initialData === null ? 'idle' : 'ready',
    connectivity: 'online',
    data: initialData,
    dataRoot: realityRoot(initialData),
    dataStale: false,
    error: null,
    revision: 0,
    requestSequence: 0,
    activeRequestId: null,
    activeRequest: null,
    activeSync: null,
    localRevision: 0,
    remoteRevision: null,
    pendingMutations: [],
    sync: { status: 'idle', requestId: null, conflict: null, lastReceiptRoot: null },
    lastProviderReceiptRoot: null,
    semanticOwner: 'rcl',
    providerExecutionOwner: 'provider',
    canonicalWorldOwner: 'rncs',
    canonicalCommitPerformed: false,
    worldFactPromoted: false,
    lastTransition: null,
  };
  return rooted(core);
}

export function beginApplicationDataRequest(state, input = {}) {
  validateState(state);
  if (state.connectivity === 'offline' && input.allowOffline !== true) throw new Error('RCL_APPLICATION_DATA_OFFLINE_PROVIDER_BLOCKED');
  const providerId = input.providerId ?? state.providerId;
  if (!providerId) throw new Error('RCL_APPLICATION_DATA_PROVIDER_REQUIRED');
  const capability = input.capability ?? state.capability;
  const target = input.target ?? state.target;
  const actor = input.actor ?? state.actor;
  const sequence = state.requestSequence + 1;
  const requestInput = clone(Object.prototype.hasOwnProperty.call(input, 'input') ? input.input : input.query ?? null);
  const requestId = input.requestId === undefined
    ? realityRoot({ resourceId: state.resourceId, queryKey: state.queryKey, sequence, input: requestInput })
    : requiredText(input.requestId, 'RCL_APPLICATION_DATA_REQUEST_ID_REQUIRED');
  const requestCore = {
    format: RCL_APPLICATION_DATA_REQUEST_FORMAT,
    version: RCL_APPLICATION_DATA_RUNTIME_VERSION,
    resourceId: state.resourceId,
    queryKey: state.queryKey,
    requestId,
    sequence,
    input: requestInput,
    inputRoot: realityRoot(requestInput),
    providerId: requiredId(providerId, 'RCL_APPLICATION_DATA_PROVIDER_ID_INVALID'),
    capability: requiredId(capability, 'RCL_APPLICATION_DATA_CAPABILITY_INVALID'),
    target: requiredText(target, 'RCL_APPLICATION_DATA_TARGET_INVALID'),
    actor: requiredId(actor, 'RCL_APPLICATION_DATA_ACTOR_INVALID'),
    authorityNeeds: clone(input.authorityNeeds ?? []),
    cancellation: { supported: true, requested: false },
    semanticOwner: 'rcl',
    executionOwner: 'provider',
    providerExecutionRequired: true,
    canonicalCommitPerformed: false,
  };
  const request = rooted(requestCore, 'requestRoot');
  const next = transition(state, {
    status: 'loading',
    error: null,
    dataStale: state.data !== null,
    requestSequence: sequence,
    activeRequestId: request.requestId,
    activeRequest: request,
    sync: { ...state.sync, status: state.sync.status === 'conflict' ? 'idle' : state.sync.status },
  }, 'request.started', { requestId: request.requestId, sequence });
  return freeze({ state: next, request });
}

export function cancelApplicationDataRequest(state, requestId, reason = 'cancel requested') {
  validateState(state);
  if (!state.activeRequest || state.activeRequestId !== requestId) throw new Error('RCL_APPLICATION_DATA_REQUEST_NOT_ACTIVE');
  const cancellation = {
    supported: true,
    requested: true,
    reason: requiredText(reason, 'RCL_APPLICATION_DATA_CANCEL_REASON_REQUIRED'),
  };
  const request = rooted({ ...state.activeRequest, cancellation }, 'requestRoot');
  const next = transition(state, {
    status: state.data === null ? 'cancelled' : 'stale',
    dataStale: state.data !== null,
    activeRequestId: null,
    activeRequest: null,
    error: { code: 'RCL_APPLICATION_DATA_CANCELLED', message: cancellation.reason, requestId },
    lastProviderReceiptRoot: null,
  }, 'request.cancelled', { requestId, reason: cancellation.reason });
  return freeze({ state: next, request });
}

export function settleApplicationDataRequest(state, receipt) {
  validateState(state);
  if (!state.activeRequest) throw new Error('RCL_APPLICATION_DATA_REQUEST_NOT_ACTIVE');
  assertProviderReceiptForRequest(state.activeRequest, receipt);
  if (state.activeRequestId !== receipt.requestId) throw new Error('RCL_APPLICATION_DATA_STALE_RESPONSE');
  if (receipt.status === 'succeeded') {
    const data = clone(receipt.output ?? null);
    const nextStatus = state.pendingMutations.length > 0 ? 'dirty' : 'ready';
    return transition(state, {
      status: nextStatus,
      connectivity: 'online',
      data,
      dataRoot: realityRoot(data),
      dataStale: false,
      error: null,
      activeRequestId: null,
      activeRequest: null,
      remoteRevision: receipt.remoteRevision ?? state.remoteRevision,
      lastProviderReceiptRoot: receipt.root,
    }, 'request.succeeded', { requestId: receipt.requestId, providerReceiptRoot: receipt.root });
  }
  return transition(state, {
    status: state.data === null ? 'error' : 'stale',
    dataStale: state.data !== null,
    activeRequestId: null,
    activeRequest: null,
    error: {
      code: receipt.code ?? 'RCL_APPLICATION_DATA_PROVIDER_FAILED',
      message: receipt.message ?? `Provider request ${receipt.status}`,
      providerReceiptRoot: receipt.root,
    },
    lastProviderReceiptRoot: receipt.root,
  }, 'request.failed', { requestId: receipt.requestId, providerReceiptRoot: receipt.root, providerStatus: receipt.status });
}

export function setApplicationDataConnectivity(state, online, reason = null) {
  validateState(state);
  if (typeof online !== 'boolean') throw new TypeError('RCL_APPLICATION_DATA_CONNECTIVITY_BOOLEAN_REQUIRED');
  if (online === (state.connectivity === 'online')) return state;
  const message = reason === null ? null : requiredText(reason, 'RCL_APPLICATION_DATA_CONNECTIVITY_REASON_REQUIRED');
  if (!online) {
    return transition(state, {
      connectivity: 'offline',
      status: state.data === null ? 'offline' : 'stale',
      dataStale: state.data !== null,
      activeRequestId: null,
      activeRequest: null,
      error: message ? { code: 'RCL_APPLICATION_DATA_OFFLINE', message } : null,
    }, 'connectivity.offline', { reason: message });
  }
  return transition(state, {
    connectivity: 'online',
    status: state.data === null ? 'idle' : 'stale',
    dataStale: state.data !== null,
    error: null,
  }, 'connectivity.online', { reason: message });
}

export function readApplicationDataCache(state) {
  validateState(state);
  if (state.connectivity === 'offline' && state.offlinePolicy === 'fail-closed') {
    throw new Error('RCL_APPLICATION_DATA_CACHE_BLOCKED_OFFLINE_POLICY');
  }
  const core = {
    format: 'rcl.application-data-cache-read.v0.1',
    version: RCL_APPLICATION_DATA_RUNTIME_VERSION,
    resourceId: state.resourceId,
    status: state.data === null ? 'CACHE_MISS' : 'CACHE_HIT',
    connectivity: state.connectivity,
    data: clone(state.data),
    dataRoot: state.dataRoot,
    stale: state.dataStale || state.connectivity === 'offline',
    offlinePolicy: state.offlinePolicy,
    semanticOwner: 'rcl',
    providerExecutionPerformed: false,
  };
  return rooted(core, 'cacheReadRoot');
}

export function createApplicationDataMutation(state, input = {}) {
  validateState(state);
  if (!Object.prototype.hasOwnProperty.call(input, 'nextData')) throw new TypeError('RCL_APPLICATION_DATA_NEXT_DATA_REQUIRED');
  const mutationId = input.mutationId === undefined
    ? realityRoot({ resourceId: state.resourceId, localRevision: state.localRevision + 1, nextData: input.nextData })
    : requiredText(input.mutationId, 'RCL_APPLICATION_DATA_MUTATION_ID_REQUIRED');
  if (state.pendingMutations.some(mutation => mutation.mutationId === mutationId)) throw new Error('RCL_APPLICATION_DATA_MUTATION_DUPLICATE');
  const nextData = clone(input.nextData);
  const mutationProviderId = input.providerId ?? state.providerId;
  const mutationCapability = input.capability ?? 'write';
  const mutationTarget = input.target ?? state.target;
  const mutationActor = input.actor ?? state.actor;
  const mutationCore = {
    format: RCL_APPLICATION_DATA_MUTATION_FORMAT,
    version: RCL_APPLICATION_DATA_RUNTIME_VERSION,
    resourceId: state.resourceId,
    mutationId,
    baseStateRoot: state.root,
    baseLocalRevision: state.localRevision,
    nextData,
    nextDataRoot: realityRoot(nextData),
    providerId: mutationProviderId === null || mutationProviderId === undefined ? null : requiredId(mutationProviderId, 'RCL_APPLICATION_DATA_PROVIDER_ID_INVALID'),
    capability: requiredId(mutationCapability, 'RCL_APPLICATION_DATA_CAPABILITY_INVALID'),
    target: requiredText(mutationTarget, 'RCL_APPLICATION_DATA_TARGET_INVALID'),
    actor: requiredId(mutationActor, 'RCL_APPLICATION_DATA_ACTOR_INVALID'),
    optimistic: input.optimistic !== false,
    semanticOwner: 'rcl',
    executionOwner: 'provider',
    providerExecutionRequired: mutationProviderId !== null && mutationProviderId !== undefined,
    canonicalCommitPerformed: false,
  };
  const mutation = rooted(mutationCore, 'mutationRoot');
  const pending = [...state.pendingMutations, {
    mutationId: mutation.mutationId,
    mutationRoot: mutation.mutationRoot,
    baseLocalRevision: mutation.baseLocalRevision,
    nextDataRoot: mutation.nextDataRoot,
    providerId: mutation.providerId,
    capability: mutation.capability,
    target: mutation.target,
  }];
  const next = transition(state, {
    status: 'dirty',
    data: mutation.optimistic ? nextData : state.data,
    dataRoot: mutation.optimistic ? mutation.nextDataRoot : state.dataRoot,
    dataStale: false,
    localRevision: state.localRevision + 1,
    pendingMutations: pending,
    error: null,
  }, 'mutation.proposed', { mutationId, mutationRoot: mutation.mutationRoot });
  return freeze({ state: next, mutation });
}

export function settleApplicationDataMutation(state, receipt) {
  validateState(state);
  validateReceipt(receipt);
  const mutationId = requiredText(receipt.mutationId, 'RCL_APPLICATION_DATA_MUTATION_ID_REQUIRED');
  const pending = state.pendingMutations.find(mutation => mutation.mutationId === mutationId);
  if (!pending) throw new Error('RCL_APPLICATION_DATA_MUTATION_NOT_PENDING');
  if (receipt.providerId !== pending.providerId || receipt.capability !== pending.capability) {
    throw new Error('RCL_APPLICATION_DATA_MUTATION_PROVIDER_BINDING_MISMATCH');
  }
  if (!REQUEST_FAILURE_STATUSES.has(receipt.status) && receipt.status !== 'succeeded') throw new Error('RCL_APPLICATION_DATA_MUTATION_STATUS_INVALID');
  if (receipt.status === 'succeeded') {
    const remaining = state.pendingMutations.filter(mutation => mutation.mutationId !== mutationId);
    return transition(state, {
      status: remaining.length > 0 ? 'dirty' : 'ready',
      pendingMutations: remaining,
      sync: remaining.length > 0 ? state.sync : { ...state.sync, status: 'synced', conflict: null },
      error: null,
      lastProviderReceiptRoot: receipt.root,
    }, 'mutation.succeeded', { mutationId, providerReceiptRoot: receipt.root });
  }
  return transition(state, {
    status: 'conflict',
    sync: { ...state.sync, status: 'conflict', conflict: { mutationId, providerReceiptRoot: receipt.root } },
    error: { code: receipt.code ?? 'RCL_APPLICATION_DATA_MUTATION_FAILED', message: receipt.message ?? 'Mutation was rejected', providerReceiptRoot: receipt.root },
    lastProviderReceiptRoot: receipt.root,
  }, 'mutation.failed', { mutationId, providerReceiptRoot: receipt.root });
}

export function createApplicationDataSyncPlan(state, input = {}) {
  validateState(state);
  if (state.connectivity !== 'online') throw new Error('RCL_APPLICATION_DATA_SYNC_OFFLINE');
  if (state.activeSync) throw new Error('RCL_APPLICATION_DATA_SYNC_ALREADY_ACTIVE');
  const providerId = input.providerId ?? state.providerId;
  if (!providerId) throw new Error('RCL_APPLICATION_DATA_PROVIDER_REQUIRED');
  const syncInput = clone(input.input ?? null);
  const requestId = input.requestId === undefined
    ? realityRoot({ resourceId: state.resourceId, localRevision: state.localRevision, remoteRevision: state.remoteRevision, pendingMutations: state.pendingMutations, input: syncInput })
    : requiredText(input.requestId, 'RCL_APPLICATION_DATA_SYNC_REQUEST_ID_REQUIRED');
  const planCore = {
    format: RCL_APPLICATION_DATA_SYNC_FORMAT,
    version: RCL_APPLICATION_DATA_RUNTIME_VERSION,
    resourceId: state.resourceId,
    requestId,
    baseStateRoot: state.root,
    baseLocalRevision: state.localRevision,
    remoteRevision: state.remoteRevision,
    pendingMutationIds: state.pendingMutations.map(mutation => mutation.mutationId),
    input: syncInput,
    inputRoot: realityRoot(syncInput),
    providerId: requiredId(providerId, 'RCL_APPLICATION_DATA_PROVIDER_ID_INVALID'),
    capability: requiredId(input.capability ?? 'sync', 'RCL_APPLICATION_DATA_CAPABILITY_INVALID'),
    target: requiredText(input.target ?? state.target, 'RCL_APPLICATION_DATA_TARGET_INVALID'),
    actor: requiredId(input.actor ?? state.actor, 'RCL_APPLICATION_DATA_ACTOR_INVALID'),
    conflictPolicy: input.conflictPolicy ?? state.conflictPolicy,
    semanticOwner: 'rcl',
    executionOwner: 'provider',
    providerExecutionRequired: true,
    canonicalCommitPerformed: false,
  };
  if (!CONFLICT_POLICIES.includes(planCore.conflictPolicy)) throw new Error('RCL_APPLICATION_DATA_CONFLICT_POLICY_INVALID');
  const plan = rooted(planCore, 'syncRoot');
  const next = transition(state, {
    status: 'syncing',
    activeSync: plan,
    sync: { status: 'syncing', requestId: plan.requestId, conflict: null, lastReceiptRoot: state.sync.lastReceiptRoot },
    error: null,
  }, 'sync.started', { requestId: plan.requestId, syncRoot: plan.syncRoot });
  return freeze({ state: next, syncPlan: plan });
}

export function settleApplicationDataSync(state, receipt) {
  validateState(state);
  if (!state.activeSync || state.sync.requestId !== receipt?.requestId) throw new Error('RCL_APPLICATION_DATA_SYNC_NOT_ACTIVE');
  validateReceipt(receipt);
  const plan = state.activeSync;
  if (receipt.providerId !== plan.providerId || receipt.capability !== plan.capability) throw new Error('RCL_APPLICATION_DATA_SYNC_PROVIDER_BINDING_MISMATCH');
  if (receipt.status !== 'succeeded' && !REQUEST_FAILURE_STATUSES.has(receipt.status)) throw new Error('RCL_APPLICATION_DATA_SYNC_STATUS_INVALID');
  if (receipt.status === 'succeeded') validateOptionalOutputRoot(receipt, 'RCL_APPLICATION_DATA_SYNC_OUTPUT_ROOT_MISMATCH');
  if (receipt.status !== 'succeeded') {
    return transition(state, {
      status: 'conflict',
      activeSync: null,
      sync: { status: 'conflict', requestId: null, conflict: { code: receipt.code ?? 'RCL_APPLICATION_DATA_SYNC_FAILED', providerReceiptRoot: receipt.root }, lastReceiptRoot: receipt.root },
      error: { code: receipt.code ?? 'RCL_APPLICATION_DATA_SYNC_FAILED', message: receipt.message ?? 'Sync was rejected', providerReceiptRoot: receipt.root },
      lastProviderReceiptRoot: receipt.root,
    }, 'sync.failed', { requestId: receipt.requestId, providerReceiptRoot: receipt.root });
  }
  const output = isObject(receipt.output) ? receipt.output : {};
  const conflicts = Array.isArray(output.conflicts) ? clone(output.conflicts) : [];
  if (output.conflict === true || conflicts.length > 0) {
    return transition(state, {
      status: 'conflict',
      activeSync: null,
      sync: { status: 'conflict', requestId: null, conflict: { conflicts, providerReceiptRoot: receipt.root }, lastReceiptRoot: receipt.root },
      error: { code: 'RCL_APPLICATION_DATA_SYNC_CONFLICT', message: 'Provider reported a sync conflict', providerReceiptRoot: receipt.root },
      lastProviderReceiptRoot: receipt.root,
    }, 'sync.conflict', { requestId: receipt.requestId, providerReceiptRoot: receipt.root });
  }
  const acceptedIds = Array.isArray(output.acceptedMutationIds)
    ? new Set(output.acceptedMutationIds)
    : new Set();
  if ([...acceptedIds].some(id => !state.pendingMutations.some(mutation => mutation.mutationId === id))) {
    throw new Error('RCL_APPLICATION_DATA_SYNC_MUTATION_UNKNOWN');
  }
  const remaining = state.pendingMutations.filter(mutation => !acceptedIds.has(mutation.mutationId));
  const data = Object.prototype.hasOwnProperty.call(output, 'data') ? clone(output.data) : state.data;
  return transition(state, {
    status: remaining.length > 0 ? 'dirty' : 'ready',
    data,
    dataRoot: realityRoot(data),
    dataStale: false,
    activeSync: null,
    pendingMutations: remaining,
    remoteRevision: output.remoteRevision ?? state.remoteRevision,
    sync: { status: remaining.length > 0 ? 'dirty' : 'synced', requestId: null, conflict: null, lastReceiptRoot: receipt.root },
    error: null,
    lastProviderReceiptRoot: receipt.root,
  }, 'sync.succeeded', { requestId: receipt.requestId, providerReceiptRoot: receipt.root, acceptedMutationCount: acceptedIds.size });
}

export function createApplicationDataSnapshot(state) {
  validateState(state);
  const core = {
    format: RCL_APPLICATION_DATA_SNAPSHOT_FORMAT,
    version: RCL_APPLICATION_DATA_RUNTIME_VERSION,
    resourceId: state.resourceId,
    state: clone(state),
    stateRoot: state.root,
    persistenceKey: state.persistenceKey,
    semanticOwner: 'rcl',
    storageExecutionOwner: 'host-wal-or-provider',
    durableCommitPerformed: false,
  };
  return rooted(core, 'snapshotRoot');
}

export function restoreApplicationDataSnapshot(snapshot) {
  if (!isObject(snapshot) || snapshot.format !== RCL_APPLICATION_DATA_SNAPSHOT_FORMAT || !ROOT.test(snapshot.snapshotRoot ?? '')) {
    throw new Error('RCL_APPLICATION_DATA_SNAPSHOT_INVALID');
  }
  const { snapshotRoot, ...withoutRoot } = snapshot;
  if (snapshotRoot !== realityRoot(withoutRoot)) throw new Error('RCL_APPLICATION_DATA_SNAPSHOT_ROOT_MISMATCH');
  validateState(snapshot.state);
  if (snapshot.stateRoot !== snapshot.state.root || snapshot.resourceId !== snapshot.state.resourceId) throw new Error('RCL_APPLICATION_DATA_SNAPSHOT_LINEAGE_MISMATCH');
  return clone(snapshot.state);
}

export function persistApplicationDataSnapshot(snapshot, walRuntime) {
  if (!walRuntime || typeof walRuntime.append !== 'function') throw new Error('RCL_APPLICATION_DATA_WAL_RUNTIME_REQUIRED');
  const state = restoreApplicationDataSnapshot(snapshot);
  const record = walRuntime.append('application.data.snapshot', { snapshot });
  return rooted({
    format: RCL_APPLICATION_DATA_PERSISTENCE_FORMAT,
    version: RCL_APPLICATION_DATA_RUNTIME_VERSION,
    resourceId: state.resourceId,
    snapshotRoot: snapshot.snapshotRoot,
    persistenceKey: state.persistenceKey,
    status: 'PERSISTED_TO_HOST_WAL',
    walRecordRoot: record.root,
    durableCommitPerformed: false,
    providerExecutionRequired: false,
    semanticOwner: 'rcl',
  }, 'persistenceRoot');
}

export function recoverApplicationDataSnapshot(walPath, resourceId = null) {
  const records = readResourceWal(walPath);
  const matches = records.filter(record => record.type === 'application.data.snapshot' && record.payload?.snapshot);
  const record = [...matches].reverse().find(item => resourceId === null || item.payload.snapshot.resourceId === resourceId);
  if (!record) return null;
  const state = restoreApplicationDataSnapshot(record.payload.snapshot);
  return rooted({
    format: 'rcl.application-data-recovery.v0.1',
    version: RCL_APPLICATION_DATA_RUNTIME_VERSION,
    resourceId: state.resourceId,
    snapshotRoot: record.payload.snapshot.snapshotRoot,
    walRecordRoot: record.root,
    state,
    status: 'RECOVERED_FROM_HOST_WAL',
    durableCommitPerformed: false,
    semanticOwner: 'rcl',
  }, 'recoveryRoot');
}

export async function executeApplicationDataRequest(state, providerRuntime, input = {}) {
  if (!providerRuntime || typeof providerRuntime.safeInvoke !== 'function') throw new Error('RCL_APPLICATION_DATA_PROVIDER_RUNTIME_REQUIRED');
  const begun = beginApplicationDataRequest(state, input);
  const providerRequest = {
    requestId: begun.request.requestId,
    providerId: begun.request.providerId,
    capability: begun.request.capability,
    target: begun.request.target,
    actor: begun.request.actor,
    input: begun.request.input,
    authorityNeeds: begun.request.authorityNeeds,
    state: state.data,
  };
  let receipt;
  try {
    receipt = await providerRuntime.safeInvoke(providerRequest);
  } catch (error) {
    receipt = providerExceptionReceipt(begun.request, error);
  }
  const settled = settleApplicationDataRequest(begun.state, receipt);
  return freeze({ state: settled, receipt });
}

export class ApplicationDataRuntime {
  constructor(spec = {}, options = {}) {
    this.state = options.state ? validateState(clone(options.state)) : createApplicationDataResource(spec);
    this.providerRuntime = options.providerRuntime ?? null;
    this.walRuntime = options.walRuntime ?? null;
  }

  snapshot() { return clone(this.state); }

  begin(input = {}) {
    const result = beginApplicationDataRequest(this.state, input);
    this.state = result.state;
    return result;
  }

  async fetch(input = {}) {
    const result = await executeApplicationDataRequest(this.state, this.providerRuntime, input);
    this.state = result.state;
    return result;
  }

  cancel(requestId, reason) {
    const result = cancelApplicationDataRequest(this.state, requestId, reason);
    this.state = result.state;
    return result;
  }

  setOnline(online, reason = null) {
    this.state = setApplicationDataConnectivity(this.state, online, reason);
    return this.snapshot();
  }

  mutate(input = {}) {
    const result = createApplicationDataMutation(this.state, input);
    this.state = result.state;
    return result;
  }

  async sync(input = {}) {
    if (!this.providerRuntime || typeof this.providerRuntime.safeInvoke !== 'function') throw new Error('RCL_APPLICATION_DATA_PROVIDER_RUNTIME_REQUIRED');
    const begun = createApplicationDataSyncPlan(this.state, input);
    this.state = begun.state;
    const providerRequest = {
      requestId: begun.syncPlan.requestId,
      providerId: begun.syncPlan.providerId,
      capability: begun.syncPlan.capability,
      target: begun.syncPlan.target,
      actor: begun.syncPlan.actor,
      input: begun.syncPlan.input,
      state: this.state.data,
    };
    let receipt;
    try {
      receipt = await this.providerRuntime.safeInvoke(providerRequest);
    } catch (error) {
      receipt = providerExceptionReceipt(begun.syncPlan, error, 'RCL_APPLICATION_DATA_SYNC_PROVIDER_EXCEPTION');
    }
    this.state = settleApplicationDataSync(this.state, receipt);
    return freeze({ state: this.snapshot(), syncPlan: begun.syncPlan, receipt });
  }

  persist() {
    if (!this.walRuntime) throw new Error('RCL_APPLICATION_DATA_WAL_RUNTIME_REQUIRED');
    return persistApplicationDataSnapshot(createApplicationDataSnapshot(this.state), this.walRuntime);
  }
}

export function createApplicationDataRuntime(spec = {}, options = {}) {
  return new ApplicationDataRuntime(spec, options);
}
