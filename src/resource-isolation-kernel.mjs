import { realityRoot } from './canonical.mjs';

export const RCL_RESOURCE_ISOLATION_VERSION = '0.28.0-alpha.1';
export const RCL_RESOURCE_ISOLATION_FORMAT = 'rcl.resource-isolation.v1';

const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_.-]*$/;

export class RCLResourceIsolationError extends Error {
  constructor(code, message, diagnostics = []) {
    super(message);
    this.name = 'RCLResourceIsolationError';
    this.code = code;
    this.diagnostics = diagnostics;
  }
}

function nowMs() { return Date.now(); }
function nowIso() { return new Date().toISOString(); }

function clone(value) {
  if (value === undefined) return undefined;
  return structuredClone(value);
}

function safeJson(value) {
  return JSON.stringify(value ?? null);
}

function byteLength(value) {
  return Buffer.byteLength(safeJson(value), 'utf8');
}

function assertIdentifier(value, label) {
  if (typeof value !== 'string' || !IDENTIFIER_PATTERN.test(value)) {
    throw new RCLResourceIsolationError('RCL_RESOURCE_IDENTIFIER_INVALID', `${label} must be a stable identifier`, [{ label, value }]);
  }
  return value;
}

function normalizeTarget(target = '*') {
  if (typeof target !== 'string' || target.length === 0) {
    throw new RCLResourceIsolationError('RCL_RESOURCE_TARGET_INVALID', 'Resource target must be a non-empty string', [{ target }]);
  }
  return target;
}

function normalizeSpec(spec) {
  if (typeof spec === 'string') {
    const [capability, target = '*'] = spec.includes('@') ? spec.split('@') : [spec, '*'];
    return { capability, target };
  }
  if (spec && typeof spec === 'object') {
    return { capability: spec.capability ?? '*', target: spec.target ?? '*' };
  }
  return { capability: '*', target: '*' };
}

function scopeMatches(granted, required) {
  return granted === '*' || granted === required || required === '*' || required.startsWith(`${granted}.`);
}

function capabilityMatches(granted, required) {
  return granted === '*' || granted === required || required.endsWith(`.${granted}`) || granted.endsWith(`.${required}`);
}

function specMatches(spec, capability, target) {
  const normalized = normalizeSpec(spec);
  return capabilityMatches(normalized.capability, capability) && scopeMatches(normalized.target, target);
}

function positiveInteger(value, fallback) {
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

function positiveMs(value, fallback) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function normalizeQuota(quota = {}) {
  return Object.freeze({
    maxHandles: positiveInteger(quota.maxHandles, 64),
    maxRegions: positiveInteger(quota.maxRegions, 16),
    maxRegionObjects: positiveInteger(quota.maxRegionObjects, 1024),
    maxVmInstances: positiveInteger(quota.maxVmInstances, 4),
    memoryBytes: positiveInteger(quota.memoryBytes, 1024 * 1024),
    regionBytes: positiveInteger(quota.regionBytes, quota.memoryBytes ?? 1024 * 1024),
    requestBytes: positiveInteger(quota.requestBytes, 64 * 1024),
    responseBytes: positiveInteger(quota.responseBytes, 64 * 1024),
    maxConcurrent: Number.isInteger(quota.maxConcurrent) && quota.maxConcurrent > 0 ? quota.maxConcurrent : 4,
    fuel: positiveInteger(quota.fuel, 10000),
    timeoutMs: positiveMs(quota.timeoutMs, 5000),
  });
}

function makeReport(formatSuffix, payload) {
  const withoutRoot = {
    format: `${RCL_RESOURCE_ISOLATION_FORMAT}.${formatSuffix}`,
    kernelVersion: RCL_RESOURCE_ISOLATION_VERSION,
    ...payload,
  };
  return Object.freeze({ ...withoutRoot, root: realityRoot(withoutRoot) });
}

export class ResourceIsolationDomain {
  constructor({ id, quota, policy = {}, metadata = {} }) {
    this.id = assertIdentifier(id, 'isolation domain id');
    this.quota = normalizeQuota(quota);
    this.policy = Object.freeze({
      allowed: Object.freeze([...(policy.allowed ?? policy.allow ?? [])].map(normalizeSpec)),
      subjects: Object.freeze(Object.fromEntries(Object.entries(policy.subjects ?? {}).map(([actor, specs]) => [actor, [...specs].map(normalizeSpec)]))),
    });
    this.metadata = clone(metadata) ?? {};
    this.createdAt = nowIso();
    this.status = 'active';
    this.abortController = new AbortController();
    this.usage = {
      handles: 0,
      regions: 0,
      regionBytes: 0,
      regionObjects: 0,
      memoryBytes: 0,
      requestBytes: 0,
      responseBytes: 0,
      activeInvocations: 0,
      activeVmInstances: 0,
      crashedVmInstances: 0,
      consumedFuel: 0,
    };
  }

  get signal() {
    return this.abortController.signal;
  }

  policySpecsFor(actor) {
    return [...this.policy.allowed, ...(this.policy.subjects[actor] ?? [])];
  }

  snapshot() {
    return Object.freeze({
      id: this.id,
      status: this.status,
      createdAt: this.createdAt,
      quota: { ...this.quota },
      usage: { ...this.usage },
      metadata: clone(this.metadata),
      policy: clone(this.policy),
      root: realityRoot({ id: this.id, status: this.status, quota: this.quota, usage: this.usage, policy: this.policy }),
    });
  }

  cancel(reason = 'domain cancelled') {
    if (this.status !== 'cancelled') {
      this.status = 'cancelled';
      this.cancelReason = String(reason);
      this.cancelledAt = nowIso();
      this.abortController.abort(new RCLResourceIsolationError('RCL_RESOURCE_DOMAIN_CANCELLED', this.cancelReason, [{ domainId: this.id }]));
    }
    return this.snapshot();
  }

  crash(reason = 'domain crashed') {
    if (this.status !== 'crashed') {
      this.status = 'crashed';
      this.crashReason = String(reason);
      this.crashedAt = nowIso();
      this.abortController.abort(new RCLResourceIsolationError('RCL_RESOURCE_DOMAIN_CRASHED', this.crashReason, [{ domainId: this.id }]));
    }
    return this.snapshot();
  }
}

export class RCLResourceIsolationKernel {
  constructor(options = {}) {
    this.format = RCL_RESOURCE_ISOLATION_FORMAT;
    this.version = RCL_RESOURCE_ISOLATION_VERSION;
    this.defaultQuota = normalizeQuota(options.defaultQuota ?? options.quota ?? {});
    this.domains = new Map();
    this.tickets = new Map();
    this.handles = new Map();
    this.regions = new Map();
    this.regionObjects = new Map();
    this.vmInstances = new Map();
    this.eventLog = [];
    for (const domain of options.domains ?? []) this.createDomain(domain);
  }

  createDomain(options = {}) {
    const domain = new ResourceIsolationDomain({
      id: options.id ?? options.domainId ?? 'default',
      quota: { ...this.defaultQuota, ...(options.quota ?? {}) },
      policy: options.policy ?? {},
      metadata: options.metadata ?? {},
    });
    if (this.domains.has(domain.id)) {
      throw new RCLResourceIsolationError('RCL_RESOURCE_DOMAIN_DUPLICATE', `Isolation domain '${domain.id}' already exists`, [{ domainId: domain.id }]);
    }
    this.domains.set(domain.id, domain);
    const event = makeReport('event', { type: 'domain.created', at: nowIso(), domain: domain.snapshot() });
    this.eventLog.push(event);
    return domain.snapshot();
  }

  ensureDomain(domainId = 'default') {
    const id = assertIdentifier(domainId, 'isolation domain id');
    let domain = this.domains.get(id);
    if (!domain) {
      this.createDomain({ id });
      domain = this.domains.get(id);
    }
    return domain;
  }

  domainSnapshot(domainId = 'default') {
    return this.ensureDomain(domainId).snapshot();
  }

  listDomains() {
    const domains = [...this.domains.values()].map(domain => domain.snapshot());
    return makeReport('domains', { domainCount: domains.length, domains });
  }

  issueCapabilityTicket(options = {}) {
    const domain = this.ensureDomain(options.domainId ?? 'default');
    if (domain.status !== 'active') {
      throw new RCLResourceIsolationError('RCL_RESOURCE_DOMAIN_INACTIVE', `Isolation domain '${domain.id}' is not active`, [{ domainId: domain.id, status: domain.status }]);
    }
    const actor = assertIdentifier(options.actor ?? 'anonymous', 'ticket actor');
    const providerId = options.providerId ? assertIdentifier(options.providerId, 'ticket provider') : '*';
    const capability = options.capability ? assertIdentifier(options.capability, 'ticket capability') : '*';
    const target = normalizeTarget(options.target ?? '*');
    const specs = domain.policySpecsFor(actor);
    const fullCapability = providerId !== '*' && !capability.includes('.') ? `${providerId}.${capability}` : capability;
    if (specs.length > 0 && !specs.some(spec => specMatches(spec, fullCapability, target) || specMatches(spec, capability, target))) {
      throw new RCLResourceIsolationError('RCL_RESOURCE_TICKET_POLICY_DENIED', 'Capability ticket is outside domain policy', [{ domainId: domain.id, actor, providerId, capability, target }]);
    }
    const issuedAt = nowMs();
    const ttlMs = positiveMs(options.ttlMs, domain.quota.timeoutMs);
    const maxUses = Number.isInteger(options.maxUses) && options.maxUses > 0 ? options.maxUses : 1;
    const ticket = Object.freeze({
      id: options.ticketId ?? realityRoot({ domainId: domain.id, actor, providerId, capability, target, issuedAt, nonce: Math.random() }),
      domainId: domain.id,
      actor,
      providerId,
      capability,
      target,
      issuedAt: new Date(issuedAt).toISOString(),
      expiresAt: new Date(issuedAt + ttlMs).toISOString(),
      ttlMs,
      maxUses,
      uses: 0,
      metadata: clone(options.metadata ?? {}),
    });
    this.tickets.set(ticket.id, { ...ticket, uses: 0 });
    const event = makeReport('event', { type: 'ticket.issued', at: nowIso(), ticket: { ...ticket, id: ticket.id } });
    this.eventLog.push(event);
    return clone(ticket);
  }

  verifyCapabilityTicket(options = {}) {
    const ticketId = options.ticketId ?? options.id;
    const ticket = ticketId ? this.tickets.get(ticketId) : null;
    if (!ticket) {
      throw new RCLResourceIsolationError('RCL_RESOURCE_TICKET_MISSING', 'Capability ticket is required', [{ ticketId }]);
    }
    const domainId = options.domainId ?? ticket.domainId;
    const domain = this.ensureDomain(domainId);
    const actor = options.actor ?? ticket.actor;
    const providerId = options.providerId ?? ticket.providerId;
    const capability = options.capability ?? ticket.capability;
    const target = options.target ?? ticket.target;
    const now = nowMs();
    const problems = [];
    if (ticket.domainId !== domain.id) problems.push({ code: 'RCL_RESOURCE_TICKET_DOMAIN_MISMATCH', expected: domain.id, actual: ticket.domainId });
    if (domain.status !== 'active') problems.push({ code: 'RCL_RESOURCE_DOMAIN_INACTIVE', domainId: domain.id, status: domain.status });
    if (ticket.actor !== actor) problems.push({ code: 'RCL_RESOURCE_TICKET_ACTOR_MISMATCH', expected: ticket.actor, actual: actor });
    if (ticket.providerId !== '*' && providerId !== '*' && ticket.providerId !== providerId) problems.push({ code: 'RCL_RESOURCE_TICKET_PROVIDER_MISMATCH', expected: ticket.providerId, actual: providerId });
    const fullCapability = providerId && providerId !== '*' && !capability.includes('.') ? `${providerId}.${capability}` : capability;
    if (!specMatches({ capability: ticket.capability, target: ticket.target }, capability, target) && !specMatches({ capability: ticket.capability, target: ticket.target }, fullCapability, target)) {
      problems.push({ code: 'RCL_RESOURCE_TICKET_SCOPE_MISMATCH', ticket: { capability: ticket.capability, target: ticket.target }, requested: { capability, target } });
    }
    if (Date.parse(ticket.expiresAt) <= now) problems.push({ code: 'RCL_RESOURCE_TICKET_EXPIRED', expiresAt: ticket.expiresAt });
    if (ticket.uses >= ticket.maxUses) problems.push({ code: 'RCL_RESOURCE_TICKET_EXHAUSTED', uses: ticket.uses, maxUses: ticket.maxUses });
    if (problems.length > 0) {
      throw new RCLResourceIsolationError('RCL_RESOURCE_TICKET_DENIED', 'Capability ticket cannot authorize this resource action', problems);
    }
    return clone(ticket);
  }

  consumeCapabilityTicket(options = {}) {
    const ticket = this.verifyCapabilityTicket(options);
    const mutable = this.tickets.get(ticket.id);
    mutable.uses += 1;
    return clone(mutable);
  }

  acquireResource(options = {}) {
    const domain = this.ensureDomain(options.domainId ?? 'default');
    const actor = assertIdentifier(options.actor ?? 'anonymous', 'resource actor');
    const providerId = options.providerId ? assertIdentifier(options.providerId, 'resource provider') : '*';
    const capability = options.capability ? assertIdentifier(options.capability, 'resource capability') : '*';
    const target = normalizeTarget(options.target ?? '*');
    const kind = assertIdentifier(options.kind ?? 'resource', 'resource kind');
    const memoryBytes = positiveInteger(options.memoryBytes ?? options.bytes, 0);
    const requestBytes = positiveInteger(options.requestBytes, 0);
    const responseBudgetBytes = positiveInteger(options.responseBudgetBytes, 0);
    if (domain.status !== 'active') {
      throw new RCLResourceIsolationError('RCL_RESOURCE_DOMAIN_INACTIVE', `Isolation domain '${domain.id}' is not active`, [{ domainId: domain.id, status: domain.status }]);
    }
    let ticket = options.ticketId ? this.verifyCapabilityTicket({
      ticketId: options.ticketId,
      domainId: domain.id,
      actor,
      providerId,
      capability,
      target,
    }) : null;
    if (!ticket) {
      throw new RCLResourceIsolationError('RCL_RESOURCE_TICKET_MISSING', 'Resource acquisition requires a capability ticket', [{ domainId: domain.id, actor, providerId, capability, target }]);
    }
    const nextUsage = {
      handles: domain.usage.handles + 1,
      memoryBytes: domain.usage.memoryBytes + memoryBytes,
      requestBytes: domain.usage.requestBytes + requestBytes,
      responseBytes: domain.usage.responseBytes + responseBudgetBytes,
      activeInvocations: domain.usage.activeInvocations + (kind === 'provider-call' ? 1 : 0),
      consumedFuel: domain.usage.consumedFuel,
    };
    const problems = [];
    if (nextUsage.handles > domain.quota.maxHandles) problems.push({ code: 'RCL_RESOURCE_QUOTA_HANDLES', used: nextUsage.handles, limit: domain.quota.maxHandles });
    if (nextUsage.memoryBytes > domain.quota.memoryBytes) problems.push({ code: 'RCL_RESOURCE_QUOTA_MEMORY', used: nextUsage.memoryBytes, limit: domain.quota.memoryBytes });
    if (nextUsage.requestBytes > domain.quota.requestBytes) problems.push({ code: 'RCL_RESOURCE_QUOTA_REQUEST_BYTES', used: nextUsage.requestBytes, limit: domain.quota.requestBytes });
    if (nextUsage.responseBytes > domain.quota.responseBytes) problems.push({ code: 'RCL_RESOURCE_QUOTA_RESPONSE_BYTES', used: nextUsage.responseBytes, limit: domain.quota.responseBytes });
    if (nextUsage.activeInvocations > domain.quota.maxConcurrent) problems.push({ code: 'RCL_RESOURCE_QUOTA_CONCURRENCY', used: nextUsage.activeInvocations, limit: domain.quota.maxConcurrent });
    if (problems.length > 0) {
      throw new RCLResourceIsolationError('RCL_RESOURCE_QUOTA_EXCEEDED', 'Resource acquisition exceeds isolation domain quota', problems);
    }
    ticket = this.consumeCapabilityTicket({
      ticketId: options.ticketId,
      domainId: domain.id,
      actor,
      providerId,
      capability,
      target,
    });
    Object.assign(domain.usage, nextUsage);
    const handle = Object.freeze({
      id: options.handleId ?? realityRoot({ domainId: domain.id, actor, providerId, capability, target, kind, at: nowIso(), nonce: Math.random() }),
      domainId: domain.id,
      actor,
      providerId,
      capability,
      target,
      kind,
      ticketId: ticket.id,
      memoryBytes,
      requestBytes,
      responseBudgetBytes,
      acquiredAt: nowIso(),
      releasedAt: null,
      metadata: clone(options.metadata ?? {}),
    });
    this.handles.set(handle.id, { ...handle });
    const event = makeReport('event', { type: 'resource.acquired', at: nowIso(), handle: clone(handle), domain: domain.snapshot() });
    this.eventLog.push(event);
    return clone(handle);
  }

  releaseResource(handleId, options = {}) {
    const handle = this.handles.get(handleId);
    if (!handle) {
      throw new RCLResourceIsolationError('RCL_RESOURCE_HANDLE_MISSING', `Resource handle '${handleId}' is not active`, [{ handleId }]);
    }
    const domain = this.ensureDomain(handle.domainId);
    domain.usage.handles = Math.max(0, domain.usage.handles - 1);
    domain.usage.memoryBytes = Math.max(0, domain.usage.memoryBytes - handle.memoryBytes);
    domain.usage.requestBytes = Math.max(0, domain.usage.requestBytes - handle.requestBytes);
    domain.usage.responseBytes = Math.max(0, domain.usage.responseBytes - handle.responseBudgetBytes);
    if (handle.kind === 'provider-call') domain.usage.activeInvocations = Math.max(0, domain.usage.activeInvocations - 1);
    const released = Object.freeze({ ...handle, releasedAt: nowIso(), releaseReason: options.reason ?? 'released' });
    this.handles.delete(handleId);
    const event = makeReport('event', { type: 'resource.released', at: nowIso(), handle: clone(released), domain: domain.snapshot() });
    this.eventLog.push(event);
    return clone(released);
  }

  createMemoryRegion(options = {}) {
    const domain = this.ensureDomain(options.domainId ?? 'default');
    const actor = assertIdentifier(options.actor ?? 'anonymous', 'region actor');
    const name = options.name ? assertIdentifier(options.name, 'region name') : null;
    const bytes = positiveInteger(options.bytes ?? options.memoryBytes ?? options.sizeBytes, 0);
    if (domain.status !== 'active') {
      throw new RCLResourceIsolationError('RCL_RESOURCE_DOMAIN_INACTIVE', `Isolation domain '${domain.id}' is not active`, [{ domainId: domain.id, status: domain.status }]);
    }
    const nextUsage = {
      ...domain.usage,
      regions: domain.usage.regions + 1,
      memoryBytes: domain.usage.memoryBytes + bytes,
    };
    const problems = [];
    if (nextUsage.regions > domain.quota.maxRegions) problems.push({ code: 'RCL_RESOURCE_QUOTA_REGIONS', used: nextUsage.regions, limit: domain.quota.maxRegions });
    if (nextUsage.memoryBytes > domain.quota.memoryBytes) problems.push({ code: 'RCL_RESOURCE_QUOTA_MEMORY', used: nextUsage.memoryBytes, limit: domain.quota.memoryBytes });
    if (problems.length > 0) throw new RCLResourceIsolationError('RCL_RESOURCE_QUOTA_EXCEEDED', 'Memory region creation exceeds isolation domain quota', problems);
    const region = Object.freeze({
      id: options.regionId ?? realityRoot({ domainId: domain.id, actor, name, bytes, at: nowIso(), nonce: Math.random() }),
      domainId: domain.id,
      actor,
      name,
      bytes,
      allocatedBytes: 0,
      objectCount: 0,
      status: 'active',
      createdAt: nowIso(),
      closedAt: null,
      metadata: clone(options.metadata ?? {}),
    });
    if (this.regions.has(region.id)) throw new RCLResourceIsolationError('RCL_RESOURCE_REGION_DUPLICATE', `Memory region '${region.id}' already exists`, [{ regionId: region.id }]);
    Object.assign(domain.usage, nextUsage);
    this.regions.set(region.id, { ...region });
    const event = makeReport('event', { type: 'region.created', at: nowIso(), region: clone(region), domain: domain.snapshot() });
    this.eventLog.push(event);
    return clone(region);
  }

  allocateRegionObject(options = {}) {
    const regionId = options.regionId;
    const region = regionId ? this.regions.get(regionId) : null;
    if (!region || region.status !== 'active') {
      throw new RCLResourceIsolationError('RCL_RESOURCE_REGION_MISSING', 'Active memory region is required', [{ regionId }]);
    }
    const domain = this.ensureDomain(region.domainId);
    if (domain.status !== 'active') {
      throw new RCLResourceIsolationError('RCL_RESOURCE_DOMAIN_INACTIVE', `Isolation domain '${domain.id}' is not active`, [{ domainId: domain.id, status: domain.status }]);
    }
    const bytes = positiveInteger(options.bytes ?? options.memoryBytes ?? options.sizeBytes, 0);
    const kind = assertIdentifier(options.kind ?? 'object', 'region object kind');
    const nextRegion = { ...region, allocatedBytes: region.allocatedBytes + bytes, objectCount: region.objectCount + 1 };
    const nextUsage = { ...domain.usage, regionBytes: domain.usage.regionBytes + bytes, regionObjects: domain.usage.regionObjects + 1 };
    const problems = [];
    if (nextRegion.allocatedBytes > region.bytes) problems.push({ code: 'RCL_RESOURCE_REGION_CAPACITY', used: nextRegion.allocatedBytes, limit: region.bytes, regionId });
    if (nextUsage.regionBytes > domain.quota.regionBytes) problems.push({ code: 'RCL_RESOURCE_QUOTA_REGION_BYTES', used: nextUsage.regionBytes, limit: domain.quota.regionBytes });
    if (nextUsage.regionObjects > domain.quota.maxRegionObjects) problems.push({ code: 'RCL_RESOURCE_QUOTA_REGION_OBJECTS', used: nextUsage.regionObjects, limit: domain.quota.maxRegionObjects });
    if (problems.length > 0) throw new RCLResourceIsolationError('RCL_RESOURCE_QUOTA_EXCEEDED', 'Region object allocation exceeds isolation quota', problems);
    const object = Object.freeze({
      id: options.objectId ?? realityRoot({ regionId, kind, bytes, at: nowIso(), nonce: Math.random() }),
      domainId: domain.id,
      regionId,
      kind,
      bytes,
      status: 'active',
      allocatedAt: nowIso(),
      releasedAt: null,
      metadata: clone(options.metadata ?? {}),
    });
    if (this.regionObjects.has(object.id)) throw new RCLResourceIsolationError('RCL_RESOURCE_OBJECT_DUPLICATE', `Region object '${object.id}' already exists`, [{ objectId: object.id }]);
    this.regions.set(regionId, nextRegion);
    Object.assign(domain.usage, nextUsage);
    this.regionObjects.set(object.id, { ...object });
    const event = makeReport('event', { type: 'region.object.allocated', at: nowIso(), object: clone(object), region: clone(nextRegion), domain: domain.snapshot() });
    this.eventLog.push(event);
    return clone(object);
  }

  releaseRegionObject(objectId, options = {}) {
    const object = this.regionObjects.get(objectId);
    if (!object) throw new RCLResourceIsolationError('RCL_RESOURCE_OBJECT_MISSING', `Region object '${objectId}' is not active`, [{ objectId }]);
    const region = this.regions.get(object.regionId);
    const domain = this.ensureDomain(object.domainId);
    if (region) {
      this.regions.set(region.id, { ...region, allocatedBytes: Math.max(0, region.allocatedBytes - object.bytes), objectCount: Math.max(0, region.objectCount - 1) });
    }
    domain.usage.regionBytes = Math.max(0, domain.usage.regionBytes - object.bytes);
    domain.usage.regionObjects = Math.max(0, domain.usage.regionObjects - 1);
    const released = Object.freeze({ ...object, status: 'released', releasedAt: nowIso(), releaseReason: options.reason ?? 'released' });
    this.regionObjects.delete(objectId);
    const event = makeReport('event', { type: 'region.object.released', at: nowIso(), object: clone(released), domain: domain.snapshot() });
    this.eventLog.push(event);
    return clone(released);
  }

  closeMemoryRegion(regionId, options = {}) {
    const region = this.regions.get(regionId);
    if (!region) throw new RCLResourceIsolationError('RCL_RESOURCE_REGION_MISSING', `Memory region '${regionId}' is not active`, [{ regionId }]);
    const objects = [...this.regionObjects.values()].filter(object => object.regionId === regionId);
    if (objects.length > 0 && options.force !== true) {
      throw new RCLResourceIsolationError('RCL_RESOURCE_REGION_NOT_EMPTY', 'Memory region cannot be closed while objects are active', [{ regionId, objectCount: objects.length }]);
    }
    for (const object of objects) this.releaseRegionObject(object.id, { reason: options.reason ?? 'region-closed' });
    const domain = this.ensureDomain(region.domainId);
    domain.usage.regions = Math.max(0, domain.usage.regions - 1);
    domain.usage.memoryBytes = Math.max(0, domain.usage.memoryBytes - region.bytes);
    const closed = Object.freeze({ ...region, status: 'closed', allocatedBytes: 0, objectCount: 0, closedAt: nowIso(), closeReason: options.reason ?? 'closed' });
    this.regions.delete(regionId);
    const event = makeReport('event', { type: 'region.closed', at: nowIso(), region: clone(closed), domain: domain.snapshot() });
    this.eventLog.push(event);
    return clone(closed);
  }

  listMemoryRegions(domainId = null) {
    const regions = [...this.regions.values()].filter(region => !domainId || region.domainId === domainId).map(clone);
    return makeReport('regions', { domainId, regionCount: regions.length, regions });
  }

  listRegionObjects(domainId = null) {
    const objects = [...this.regionObjects.values()].filter(object => !domainId || object.domainId === domainId).map(clone);
    return makeReport('region-objects', { domainId, objectCount: objects.length, objects });
  }

  createIsolatedVmInstance(options = {}) {
    const domain = this.ensureDomain(options.domainId ?? 'default');
    if (domain.status !== 'active') throw new RCLResourceIsolationError('RCL_RESOURCE_DOMAIN_INACTIVE', `Isolation domain '${domain.id}' is not active`, [{ domainId: domain.id, status: domain.status }]);
    const actor = assertIdentifier(options.actor ?? 'anonymous', 'vm actor');
    const providerId = options.providerId ? assertIdentifier(options.providerId, 'vm provider') : 'vm';
    const capability = options.capability ? assertIdentifier(options.capability, 'vm capability') : 'run';
    const target = normalizeTarget(options.target ?? 'rcl-native');
    const memoryBytes = positiveInteger(options.memoryBytes, 64 * 1024);
    if (domain.usage.activeVmInstances + 1 > domain.quota.maxVmInstances) {
      throw new RCLResourceIsolationError('RCL_RESOURCE_QUOTA_EXCEEDED', 'VM instance creation exceeds isolation quota', [{ code: 'RCL_RESOURCE_QUOTA_VM_INSTANCES', used: domain.usage.activeVmInstances + 1, limit: domain.quota.maxVmInstances }]);
    }
    const handle = this.acquireResource({
      domainId: domain.id,
      actor,
      providerId,
      capability,
      target,
      kind: 'vm-instance',
      ticketId: options.ticketId,
      memoryBytes,
      metadata: { vmRuntime: options.runtime ?? 'rcl-native', bytecodePath: options.bytecodePath ?? null, ...(options.metadata ?? {}) },
    });
    domain.usage.activeVmInstances += 1;
    const vm = Object.freeze({
      id: options.vmId ?? realityRoot({ domainId: domain.id, actor, target, memoryBytes, at: nowIso(), nonce: Math.random() }),
      domainId: domain.id,
      actor,
      target,
      runtime: options.runtime ?? 'rcl-native',
      bytecodePath: options.bytecodePath ?? null,
      status: 'active',
      handleId: handle.id,
      memoryBytes,
      runCount: 0,
      createdAt: nowIso(),
      closedAt: null,
      crashedAt: null,
      metadata: clone(options.metadata ?? {}),
    });
    if (this.vmInstances.has(vm.id)) throw new RCLResourceIsolationError('RCL_RESOURCE_VM_DUPLICATE', `VM instance '${vm.id}' already exists`, [{ vmId: vm.id }]);
    this.vmInstances.set(vm.id, { ...vm });
    const event = makeReport('event', { type: 'vm.created', at: nowIso(), vm: clone(vm), domain: domain.snapshot() });
    this.eventLog.push(event);
    return clone(vm);
  }

  async runIsolatedVmInstance(vmId, runner, options = {}) {
    const vm = this.vmInstances.get(vmId);
    if (!vm || vm.status !== 'active') throw new RCLResourceIsolationError('RCL_RESOURCE_VM_INACTIVE', 'Active VM instance is required', [{ vmId, status: vm?.status }]);
    const domain = this.ensureDomain(vm.domainId);
    const startedAt = nowIso();
    if (domain.status !== 'active') throw new RCLResourceIsolationError('RCL_RESOURCE_DOMAIN_INACTIVE', `Isolation domain '${domain.id}' is not active`, [{ domainId: domain.id, status: domain.status }]);
    try {
      this.spendFuel(domain.id, options.fuelCost ?? 1);
      const output = typeof runner === 'function'
        ? await runner(Object.freeze({ vm: clone(vm), domain: domain.snapshot(), signal: domain.signal }))
        : null;
      const finishedAt = nowIso();
      const nextVm = { ...vm, runCount: vm.runCount + 1, lastRunAt: finishedAt, lastOutputRoot: realityRoot(output ?? null) };
      this.vmInstances.set(vmId, nextVm);
      const receipt = makeReport('vm-run', { status: 'succeeded', vm: clone(nextVm), output: clone(output), outputRoot: realityRoot(output ?? null), startedAt, finishedAt, durationMs: Date.parse(finishedAt) - Date.parse(startedAt) });
      this.eventLog.push(makeReport('event', { type: 'vm.run.succeeded', at: finishedAt, vm: clone(nextVm), receiptRoot: receipt.root }));
      return receipt;
    } catch (error) {
      const finishedAt = nowIso();
      const crashed = { ...vm, status: 'crashed', crashedAt: finishedAt, crash: { code: error?.code ?? 'RCL_RESOURCE_VM_RUN_FAILED', message: error?.message ?? String(error), diagnostics: clone(error?.diagnostics ?? []) } };
      this.vmInstances.set(vmId, crashed);
      domain.usage.activeVmInstances = Math.max(0, domain.usage.activeVmInstances - 1);
      domain.usage.crashedVmInstances += 1;
      try { this.releaseResource(vm.handleId, { reason: 'vm-crashed' }); } catch { /* best effort */ }
      const receipt = makeReport('vm-run', { status: 'crashed', code: crashed.crash.code, message: crashed.crash.message, diagnostics: crashed.crash.diagnostics, vm: clone(crashed), startedAt, finishedAt, durationMs: Date.parse(finishedAt) - Date.parse(startedAt) });
      this.eventLog.push(makeReport('event', { type: 'vm.run.crashed', at: finishedAt, vm: clone(crashed), receiptRoot: receipt.root }));
      if (options.throwOnCrash === true) throw error;
      return receipt;
    }
  }

  closeIsolatedVmInstance(vmId, options = {}) {
    const vm = this.vmInstances.get(vmId);
    if (!vm) throw new RCLResourceIsolationError('RCL_RESOURCE_VM_MISSING', `VM instance '${vmId}' does not exist`, [{ vmId }]);
    const domain = this.ensureDomain(vm.domainId);
    if (vm.status === 'active') {
      domain.usage.activeVmInstances = Math.max(0, domain.usage.activeVmInstances - 1);
      try { this.releaseResource(vm.handleId, { reason: options.reason ?? 'vm-closed' }); } catch { /* best effort */ }
    }
    const closed = Object.freeze({ ...vm, status: 'closed', closedAt: nowIso(), closeReason: options.reason ?? 'closed' });
    this.vmInstances.delete(vmId);
    const event = makeReport('event', { type: 'vm.closed', at: nowIso(), vm: clone(closed), domain: domain.snapshot() });
    this.eventLog.push(event);
    return clone(closed);
  }

  listIsolatedVmInstances(domainId = null) {
    const vms = [...this.vmInstances.values()].filter(vm => !domainId || vm.domainId === domainId).map(clone);
    return makeReport('vm-instances', { domainId, vmCount: vms.length, vms });
  }

  detectLeaks(options = {}) {
    const domainId = options.domainId ?? null;
    const olderThanMs = positiveInteger(options.olderThanMs, 0);
    const cutoff = nowMs() - olderThanMs;
    const oldEnough = value => olderThanMs === 0 || Date.parse(value) <= cutoff;
    const leakedHandles = [...this.handles.values()].filter(handle => (!domainId || handle.domainId === domainId) && oldEnough(handle.acquiredAt)).map(clone);
    const leakedRegions = [...this.regions.values()].filter(region => (!domainId || region.domainId === domainId) && oldEnough(region.createdAt)).map(clone);
    const leakedObjects = [...this.regionObjects.values()].filter(object => (!domainId || object.domainId === domainId) && oldEnough(object.allocatedAt)).map(clone);
    const leakedVms = [...this.vmInstances.values()].filter(vm => (!domainId || vm.domainId === domainId) && vm.status === 'active' && oldEnough(vm.createdAt)).map(clone);
    const report = makeReport('leaks', {
      domainId,
      olderThanMs,
      leakCount: leakedHandles.length + leakedRegions.length + leakedObjects.length + leakedVms.length,
      leakedHandles,
      leakedRegions,
      leakedObjects,
      leakedVms,
    });
    this.eventLog.push(makeReport('event', { type: 'leaks.detected', at: nowIso(), domainId, leakCount: report.leakCount, reportRoot: report.root }));
    return report;
  }

  crashDomain(domainId = 'default', reason = 'domain crashed') {
    const domain = this.ensureDomain(domainId);
    const snapshot = domain.crash(reason);
    for (const vm of [...this.vmInstances.values()].filter(item => item.domainId === domain.id && item.status === 'active')) {
      const crashed = { ...vm, status: 'crashed', crashedAt: nowIso(), crash: { code: 'RCL_RESOURCE_DOMAIN_CRASHED', message: String(reason), diagnostics: [{ domainId: domain.id }] } };
      this.vmInstances.set(vm.id, crashed);
      domain.usage.activeVmInstances = Math.max(0, domain.usage.activeVmInstances - 1);
      domain.usage.crashedVmInstances += 1;
      try { this.releaseResource(vm.handleId, { reason: 'domain-crashed' }); } catch { /* best effort */ }
    }
    for (const handle of [...this.handles.values()].filter(item => item.domainId === domain.id)) this.releaseResource(handle.id, { reason: 'domain-crashed' });
    for (const region of [...this.regions.values()].filter(item => item.domainId === domain.id)) this.closeMemoryRegion(region.id, { force: true, reason: 'domain-crashed' });
    const event = makeReport('event', { type: 'domain.crashed', at: nowIso(), domain: snapshot, reason });
    this.eventLog.push(event);
    return this.domainSnapshot(domain.id);
  }

  spendFuel(domainId = 'default', amount = 1) {
    const domain = this.ensureDomain(domainId);
    const fuel = positiveInteger(amount, 0);
    const next = domain.usage.consumedFuel + fuel;
    if (next > domain.quota.fuel) {
      throw new RCLResourceIsolationError('RCL_RESOURCE_QUOTA_FUEL', 'Isolation domain fuel quota exceeded', [{ domainId: domain.id, used: next, limit: domain.quota.fuel }]);
    }
    domain.usage.consumedFuel = next;
    const event = makeReport('event', { type: 'fuel.spent', at: nowIso(), domainId: domain.id, amount: fuel, usage: { ...domain.usage } });
    this.eventLog.push(event);
    return domain.snapshot();
  }

  cancelDomain(domainId = 'default', reason = 'cancel requested') {
    const domain = this.ensureDomain(domainId);
    const snapshot = domain.cancel(reason);
    for (const vm of [...this.vmInstances.values()].filter(item => item.domainId === domain.id && item.status === 'active')) this.closeIsolatedVmInstance(vm.id, { reason: 'domain-cancelled' });
    for (const handle of [...this.handles.values()].filter(item => item.domainId === domain.id)) {
      this.releaseResource(handle.id, { reason: 'domain-cancelled' });
    }
    for (const region of [...this.regions.values()].filter(item => item.domainId === domain.id)) this.closeMemoryRegion(region.id, { force: true, reason: 'domain-cancelled' });
    const event = makeReport('event', { type: 'domain.cancelled', at: nowIso(), domain: snapshot, reason });
    this.eventLog.push(event);
    return snapshot;
  }

  getDomainSignal(domainId = 'default') {
    return this.ensureDomain(domainId).signal;
  }

  getEventLog() {
    return Object.freeze(this.eventLog.map(item => clone(item)));
  }

  clearEventLog() {
    const cleared = this.eventLog.length;
    this.eventLog.length = 0;
    return { status: 'cleared', cleared };
  }


  snapshot(options = {}) {
    const domains = [...this.domains.values()].map(domain => domain.snapshot());
    const tickets = [...this.tickets.values()].map(clone);
    const handles = [...this.handles.values()].map(clone);
    const regions = [...this.regions.values()].map(clone);
    const regionObjects = [...this.regionObjects.values()].map(clone);
    const vmInstances = [...this.vmInstances.values()].map(clone);
    const eventLog = options.includeEventLog === false ? [] : this.getEventLog();
    return makeReport('snapshot', {
      snapshotVersion: 1,
      createdAt: nowIso(),
      defaultQuota: { ...this.defaultQuota },
      domainCount: domains.length,
      domains,
      tickets,
      handles,
      regions,
      regionObjects,
      vmInstances,
      eventLog,
    });
  }

  rehydrateFromSnapshot(snapshot = {}) {
    const payload = snapshot.snapshotVersion ? snapshot : (snapshot.payload?.snapshot ?? snapshot.payload ?? snapshot);
    this.defaultQuota = normalizeQuota(payload.defaultQuota ?? payload.quota ?? this.defaultQuota ?? {});
    this.domains.clear();
    this.tickets.clear();
    this.handles.clear();
    this.regions.clear();
    this.regionObjects.clear();
    this.vmInstances.clear();
    this.eventLog.length = 0;

    for (const domainSnapshot of payload.domains ?? []) {
      const domain = new ResourceIsolationDomain({
        id: domainSnapshot.id,
        quota: domainSnapshot.quota ?? this.defaultQuota,
        policy: domainSnapshot.policy ?? {},
        metadata: domainSnapshot.metadata ?? {},
      });
      domain.createdAt = domainSnapshot.createdAt ?? domain.createdAt;
      domain.status = domainSnapshot.status ?? 'active';
      domain.usage = { ...domain.usage, ...(domainSnapshot.usage ?? {}) };
      if (domain.status === 'cancelled') {
        domain.cancelReason = domainSnapshot.cancelReason ?? 'recovered cancelled domain';
        domain.cancelledAt = domainSnapshot.cancelledAt ?? nowIso();
        try { domain.abortController.abort(new RCLResourceIsolationError('RCL_RESOURCE_DOMAIN_CANCELLED', domain.cancelReason, [{ domainId: domain.id }])); } catch { /* already aborted */ }
      } else if (domain.status === 'crashed') {
        domain.crashReason = domainSnapshot.crashReason ?? 'recovered crashed domain';
        domain.crashedAt = domainSnapshot.crashedAt ?? nowIso();
        try { domain.abortController.abort(new RCLResourceIsolationError('RCL_RESOURCE_DOMAIN_CRASHED', domain.crashReason, [{ domainId: domain.id }])); } catch { /* already aborted */ }
      }
      this.domains.set(domain.id, domain);
    }
    for (const ticket of payload.tickets ?? []) this.tickets.set(ticket.id, { ...ticket });
    for (const handle of payload.handles ?? []) this.handles.set(handle.id, { ...handle });
    for (const region of payload.regions ?? []) this.regions.set(region.id, { ...region });
    for (const object of payload.regionObjects ?? []) this.regionObjects.set(object.id, { ...object });
    for (const vm of payload.vmInstances ?? []) this.vmInstances.set(vm.id, { ...vm });
    for (const event of payload.eventLog ?? []) this.eventLog.push(clone(event));
    return this.snapshot({ includeEventLog: false });
  }

  static fromSnapshot(snapshot = {}, options = {}) {
    const kernel = new RCLResourceIsolationKernel({ defaultQuota: options.defaultQuota ?? snapshot.defaultQuota ?? {} });
    kernel.rehydrateFromSnapshot(snapshot);
    return kernel;
  }

  listActiveHandles(domainId = null) {
    const handles = [...this.handles.values()].filter(handle => !domainId || handle.domainId === domainId).map(clone);
    return makeReport('handles', { domainId, handleCount: handles.length, handles });
  }
}

export function createResourceIsolationKernel(options = {}) {
  return new RCLResourceIsolationKernel(options);
}

export async function runResourceIsolationDemo() {
  const kernel = createResourceIsolationKernel({
    defaultQuota: { maxHandles: 2, requestBytes: 256, responseBytes: 256, memoryBytes: 1024, maxConcurrent: 1, fuel: 5, timeoutMs: 500 },
    domains: [{
      id: 'demo',
      policy: { subjects: { builder: ['console.emit@console'] } },
      metadata: { purpose: 'resource-isolation-demo' },
    }],
  });
  const ticket = kernel.issueCapabilityTicket({ domainId: 'demo', actor: 'builder', providerId: 'console', capability: 'emit', target: 'console', maxUses: 1 });
  const handle = kernel.acquireResource({ domainId: 'demo', actor: 'builder', providerId: 'console', capability: 'emit', target: 'console', kind: 'provider-call', ticketId: ticket.id, requestBytes: byteLength({ args: ['hello'] }), responseBudgetBytes: 64 });
  const beforeRelease = kernel.domainSnapshot('demo');
  const released = kernel.releaseResource(handle.id, { reason: 'demo-complete' });
  const afterRelease = kernel.domainSnapshot('demo');
  return makeReport('demo', {
    ticket,
    handle,
    beforeRelease,
    released,
    afterRelease,
    activeHandles: kernel.listActiveHandles('demo'),
    eventLog: kernel.getEventLog(),
  });
}

export async function runResourceLifecycleDemo() {
  const kernel = createResourceIsolationKernel({
    defaultQuota: { maxHandles: 4, maxRegions: 2, maxRegionObjects: 4, maxVmInstances: 2, memoryBytes: 2048, regionBytes: 1024, fuel: 8, timeoutMs: 500 },
    domains: [
      { id: 'lab', policy: { subjects: { builder: ['vm.run@rcl-native'] } }, metadata: { purpose: 'lifecycle-crash-boundary-demo' } },
      { id: 'peer', policy: { subjects: { builder: ['vm.run@rcl-native'] } }, metadata: { purpose: 'crash-boundary-peer' } },
    ],
  });
  const region = kernel.createMemoryRegion({ domainId: 'lab', actor: 'builder', name: 'scratch', bytes: 512 });
  const object = kernel.allocateRegionObject({ regionId: region.id, kind: 'rbc-frame', bytes: 128, metadata: { slot: 0 } });
  const leaksBeforeClose = kernel.detectLeaks({ domainId: 'lab' });
  const ticket = kernel.issueCapabilityTicket({ domainId: 'lab', actor: 'builder', providerId: 'vm', capability: 'run', target: 'rcl-native', maxUses: 1 });
  const vm = kernel.createIsolatedVmInstance({ domainId: 'lab', actor: 'builder', ticketId: ticket.id, memoryBytes: 256, bytecodePath: 'build/demo.rbc' });
  const crashReceipt = await kernel.runIsolatedVmInstance(vm.id, async () => { throw new Error('demo isolated VM fault'); });
  const peerBefore = kernel.domainSnapshot('peer');
  const labAfterCrash = kernel.domainSnapshot('lab');
  const closedObject = kernel.releaseRegionObject(object.id, { reason: 'demo-cleanup' });
  const closedRegion = kernel.closeMemoryRegion(region.id, { reason: 'demo-cleanup' });
  const leaksAfterCleanup = kernel.detectLeaks({ domainId: 'lab' });
  return makeReport('lifecycle-demo', {
    region,
    object,
    leaksBeforeClose,
    vm,
    crashReceipt,
    labAfterCrash,
    peerBefore,
    closedObject,
    closedRegion,
    leaksAfterCleanup,
    eventLog: kernel.getEventLog(),
  });
}
