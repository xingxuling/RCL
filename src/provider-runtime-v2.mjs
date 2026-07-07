import { realityRoot } from './canonical.mjs';
import { RCLResourceIsolationError } from './resource-isolation-kernel.mjs';

export const PROVIDER_RUNTIME_V2_VERSION = '0.27.0-alpha.1';
export const PROVIDER_RUNTIME_V2_FORMAT = 'rcl.provider-runtime.v2';

const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_.-]*$/;

export class ProviderRuntimeV2Error extends Error {
  constructor(code, message, diagnostics = []) {
    super(message);
    this.name = 'ProviderRuntimeV2Error';
    this.code = code;
    this.diagnostics = diagnostics;
  }
}

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

function minDefined(...values) {
  const finite = values.filter(value => Number.isFinite(value));
  return finite.length ? Math.min(...finite) : undefined;
}

function connectAbortSignals(targetController, ...signals) {
  const cleanup = [];
  for (const signal of signals.filter(Boolean)) {
    if (signal.aborted) {
      targetController.abort(signal.reason);
      continue;
    }
    const onAbort = () => targetController.abort(signal.reason);
    signal.addEventListener('abort', onAbort, { once: true });
    cleanup.push(() => signal.removeEventListener('abort', onAbort));
  }
  return () => cleanup.splice(0).forEach(fn => fn());
}

function assertIdentifier(value, label) {
  if (typeof value !== 'string' || !IDENTIFIER_PATTERN.test(value)) {
    throw new ProviderRuntimeV2Error('RCL_PROVIDER_V2_IDENTIFIER_INVALID', `${label} must be a stable identifier`, [{ label, value }]);
  }
  return value;
}

function normalizeMode(mode) {
  const value = mode ?? 'realize';
  if (!['realize', 'foresee'].includes(value)) {
    throw new ProviderRuntimeV2Error('RCL_PROVIDER_V2_MODE_INVALID', `Unknown provider mode '${value}'`, [{ mode: value }]);
  }
  return value;
}

function normalizeTarget(target = '*') {
  if (typeof target !== 'string' || target.length === 0) {
    throw new ProviderRuntimeV2Error('RCL_PROVIDER_V2_TARGET_INVALID', 'Provider target must be a non-empty string', [{ target }]);
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

function normalizeCapability(providerId, declaration) {
  const value = typeof declaration === 'string' ? { capability: declaration } : { ...declaration };
  const capability = assertIdentifier(value.capability, 'provider capability');
  const target = normalizeTarget(value.target ?? providerId);
  const modes = value.modes ? [...value.modes] : ['realize'];
  for (const mode of modes) normalizeMode(mode);
  return Object.freeze({
    capability,
    target,
    modes: Object.freeze(modes),
    effects: Object.freeze([...(value.effects ?? [])]),
    timeoutMs: Number.isFinite(value.timeoutMs) ? value.timeoutMs : undefined,
    maxConcurrent: Number.isInteger(value.maxConcurrent) && value.maxConcurrent > 0 ? value.maxConcurrent : undefined,
    requestBytesLimit: Number.isInteger(value.requestBytesLimit) && value.requestBytesLimit >= 0 ? value.requestBytesLimit : undefined,
    responseBytesLimit: Number.isInteger(value.responseBytesLimit) && value.responseBytesLimit >= 0 ? value.responseBytesLimit : undefined,
  });
}

function normalizeProvider(definition) {
  const id = assertIdentifier(definition.id, 'provider id');
  const handler = definition.invoke ?? definition.handler;
  const simulator = definition.simulate;
  if (typeof handler !== 'function' && typeof simulator !== 'function') {
    throw new ProviderRuntimeV2Error('RCL_PROVIDER_V2_HANDLER_MISSING', `Provider '${id}' must expose invoke/handler or simulate`, [{ providerId: id }]);
  }
  const capabilities = (definition.capabilities ?? []).map(item => normalizeCapability(id, item));
  if (capabilities.length === 0) {
    throw new ProviderRuntimeV2Error('RCL_PROVIDER_V2_CAPABILITIES_EMPTY', `Provider '${id}' must declare at least one capability`, [{ providerId: id }]);
  }
  return Object.freeze({
    id,
    version: definition.version ?? '0.0.0-local',
    description: definition.description ?? null,
    capabilities: Object.freeze(capabilities),
    invoke: handler,
    simulate: simulator,
    defaultTimeoutMs: Number.isFinite(definition.timeoutMs) ? definition.timeoutMs : undefined,
    defaultMaxConcurrent: Number.isInteger(definition.maxConcurrent) && definition.maxConcurrent > 0 ? definition.maxConcurrent : undefined,
    requestBytesLimit: Number.isInteger(definition.requestBytesLimit) && definition.requestBytesLimit >= 0 ? definition.requestBytesLimit : undefined,
    responseBytesLimit: Number.isInteger(definition.responseBytesLimit) && definition.responseBytesLimit >= 0 ? definition.responseBytesLimit : undefined,
  });
}

function normalizePolicy(policy = {}) {
  const subjects = Object.fromEntries(Object.entries(policy.subjects ?? {}).map(([subject, specs]) => [subject, [...specs].map(normalizeSpec)]));
  return Object.freeze({
    format: 'rcl.provider-runtime.policy.v2',
    defaultAllow: policy.defaultAllow === true,
    allowProviderOffersWithoutPolicy: policy.allowProviderOffersWithoutPolicy === true,
    allowed: Object.freeze([...(policy.allowed ?? policy.allow ?? [])].map(normalizeSpec)),
    subjects: Object.freeze(subjects),
    trustedAuthority: policy.trustedAuthority === true,
  });
}

function policySpecsFor(policy, actor) {
  return [...policy.allowed, ...(policy.subjects[actor] ?? [])];
}

function findOffer(provider, capability, target, mode) {
  const fullCapability = `${provider.id}.${capability}`;
  return provider.capabilities.find(offer => {
    const offeredFull = offer.capability.includes('.') ? offer.capability : `${provider.id}.${offer.capability}`;
    const capabilityOk = capabilityMatches(offer.capability, capability) || capabilityMatches(offeredFull, fullCapability);
    const targetOk = scopeMatches(offer.target, target);
    return capabilityOk && targetOk && offer.modes.includes(mode);
  }) ?? null;
}

function authDiagnostics(policy, actor, providerId, capability, target, authorityNeeds = []) {
  if (policy.defaultAllow) return [];
  const specs = policySpecsFor(policy, actor);
  const fullCapability = capability.includes('.') ? capability : `${providerId}.${capability}`;
  const capabilityAllowed = specs.some(spec => specMatches(spec, fullCapability, target) || specMatches(spec, capability, target));
  const diagnostics = [];
  if (!capabilityAllowed && !policy.allowProviderOffersWithoutPolicy) {
    diagnostics.push({
      code: 'RCL_PROVIDER_V2_CAPABILITY_DENIED',
      actor,
      providerId,
      capability: fullCapability,
      target,
    });
  }
  if (!policy.trustedAuthority) {
    for (const need of authorityNeeds ?? []) {
      const requiredCapability = need.capability ?? '*';
      const requiredTarget = need.target ?? '*';
      const needAllowed = specs.some(spec => specMatches(spec, requiredCapability, requiredTarget));
      if (!needAllowed) diagnostics.push({
        code: 'RCL_PROVIDER_V2_AUTHORITY_NEED_DENIED',
        actor,
        capability: requiredCapability,
        target: requiredTarget,
      });
    }
  }
  return diagnostics;
}

function makeReceipt(payload) {
  const withoutRoot = {
    format: `${PROVIDER_RUNTIME_V2_FORMAT}.receipt`,
    runtimeVersion: PROVIDER_RUNTIME_V2_VERSION,
    ...payload,
  };
  return Object.freeze({ ...withoutRoot, root: realityRoot(withoutRoot) });
}

export class AsyncSemaphore {
  constructor(limit) {
    if (!Number.isInteger(limit) || limit < 1) throw new ProviderRuntimeV2Error('RCL_PROVIDER_V2_CONCURRENCY_INVALID', 'Semaphore limit must be a positive integer', [{ limit }]);
    this.limit = limit;
    this.active = 0;
    this.queue = [];
  }

  async run(fn) {
    if (this.active >= this.limit) {
      await new Promise(resolve => this.queue.push(resolve));
    }
    this.active += 1;
    try {
      return await fn();
    } finally {
      this.active -= 1;
      const next = this.queue.shift();
      if (next) next();
    }
  }

  snapshot() {
    return { limit: this.limit, active: this.active, queued: this.queue.length };
  }
}

export class ProviderRuntimeV2 {
  constructor(options = {}) {
    this.format = PROVIDER_RUNTIME_V2_FORMAT;
    this.version = PROVIDER_RUNTIME_V2_VERSION;
    this.policy = normalizePolicy(options.policy ?? {});
    this.defaultTimeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : 5000;
    this.defaultRequestBytesLimit = Number.isInteger(options.requestBytesLimit) ? options.requestBytesLimit : 64 * 1024;
    this.defaultResponseBytesLimit = Number.isInteger(options.responseBytesLimit) ? options.responseBytesLimit : 64 * 1024;
    this.resourceKernel = options.resourceKernel ?? null;
    this.defaultIsolationDomainId = options.defaultIsolationDomainId ?? options.domainId ?? null;
    this.providers = new Map();
    this.eventLog = [];
    this.globalSemaphore = new AsyncSemaphore(Number.isInteger(options.maxConcurrent) && options.maxConcurrent > 0 ? options.maxConcurrent : 8);
    this.offerSemaphores = new Map();
    for (const provider of options.providers ?? []) this.registerProvider(provider);
  }

  registerProvider(definition) {
    const provider = normalizeProvider(definition);
    if (this.providers.has(provider.id)) {
      throw new ProviderRuntimeV2Error('RCL_PROVIDER_V2_DUPLICATE', `Provider '${provider.id}' is already registered`, [{ providerId: provider.id }]);
    }
    this.providers.set(provider.id, provider);
    return provider;
  }

  listProviders() {
    const providers = [...this.providers.values()].map(provider => ({
      id: provider.id,
      version: provider.version,
      description: provider.description,
      capabilities: provider.capabilities.map(item => ({ ...item })),
    }));
    const report = {
      format: `${PROVIDER_RUNTIME_V2_FORMAT}.list`,
      runtimeVersion: PROVIDER_RUNTIME_V2_VERSION,
      providerCount: providers.length,
      providers,
      eventCount: this.eventLog.length,
      concurrency: this.globalSemaphore.snapshot(),
      resourceIsolation: this.resourceKernel ? {
        enabled: true,
        defaultIsolationDomainId: this.defaultIsolationDomainId,
        domains: this.resourceKernel.listDomains?.() ?? null,
      } : { enabled: false },
    };
    return Object.freeze({ ...report, root: realityRoot(report) });
  }

  getEventLog() {
    return Object.freeze(this.eventLog.map(item => clone(item)));
  }

  clearEventLog() {
    const cleared = this.eventLog.length;
    this.eventLog.length = 0;
    return { status: 'cleared', cleared };
  }

  offerSemaphore(providerId, capability, target, limit) {
    const key = `${providerId}:${capability}@${target}`;
    if (!this.offerSemaphores.has(key)) this.offerSemaphores.set(key, new AsyncSemaphore(limit));
    return this.offerSemaphores.get(key);
  }

  async safeInvoke(request) {
    const startedAt = nowIso();
    const requestId = request.requestId ?? realityRoot({ t: startedAt, request });
    const providerId = request.providerId ?? request.host;
    const mode = normalizeMode(request.mode);
    const actor = request.actor ?? 'anonymous';
    const target = normalizeTarget(request.target ?? providerId ?? '*');
    const capability = request.capability;
    const input = clone(request.input ?? request.args ?? request.request ?? null);
    const authorityNeeds = clone(request.authorityNeeds ?? request.needs ?? request.authority?.needs ?? []);
    const isolationDomainId = request.isolationDomainId ?? request.domainId ?? this.defaultIsolationDomainId;
    const capabilityTicketId = request.capabilityTicketId ?? request.ticketId ?? request.capabilityTicket?.id ?? null;
    const provider = providerId ? this.providers.get(providerId) : null;
    const base = {
      requestId,
      providerId,
      capability,
      target,
      actor,
      rule: request.rule ?? null,
      mode,
      startedAt,
      inputRoot: realityRoot(input ?? null),
      inputBytes: byteLength(input ?? null),
      authorityNeeds,
      isolationDomainId: isolationDomainId ?? null,
      capabilityTicketId,
    };

    const reject = (code, message, diagnostics = []) => {
      const finishedAt = nowIso();
      const receipt = makeReceipt({
        ...base,
        status: 'rejected',
        code,
        message,
        diagnostics,
        finishedAt,
        durationMs: Date.parse(finishedAt) - Date.parse(startedAt),
      });
      this.eventLog.push(receipt);
      return receipt;
    };

    if (!provider) return reject('RCL_PROVIDER_V2_PROVIDER_MISSING', `Provider '${providerId}' is not registered`, [{ providerId }]);
    if (typeof capability !== 'string' || capability.length === 0) return reject('RCL_PROVIDER_V2_CAPABILITY_MISSING', 'Provider capability is required', []);

    const offer = findOffer(provider, capability, target, mode);
    if (!offer) {
      return reject('RCL_PROVIDER_V2_OFFER_MISSING', `Provider '${providerId}' does not offer '${capability}' on '${target}' in mode '${mode}'`, [{ providerId, capability, target, mode }]);
    }

    const authProblems = authDiagnostics(this.policy, actor, providerId, capability, target, authorityNeeds);
    if (authProblems.length) return reject('RCL_PROVIDER_V2_AUTHORITY_DENIED', 'Provider invocation is outside the runtime policy', authProblems);

    const domainQuota = isolationDomainId && this.resourceKernel ? this.resourceKernel.domainSnapshot(isolationDomainId).quota : null;
    const requestLimit = minDefined(offer.requestBytesLimit, provider.requestBytesLimit, this.defaultRequestBytesLimit, domainQuota?.requestBytes);
    if (byteLength(input ?? null) > requestLimit) {
      return reject('RCL_PROVIDER_V2_REQUEST_TOO_LARGE', `Provider request exceeds ${requestLimit} bytes`, [{ bytes: byteLength(input ?? null), limit: requestLimit }]);
    }

    const timeoutMs = minDefined(request.timeoutMs, offer.timeoutMs, provider.defaultTimeoutMs, this.defaultTimeoutMs, domainQuota?.timeoutMs);
    const responseLimit = minDefined(offer.responseBytesLimit, provider.responseBytesLimit, this.defaultResponseBytesLimit, domainQuota?.responseBytes);
    const capabilityLimit = offer.maxConcurrent ?? provider.defaultMaxConcurrent ?? this.globalSemaphore.limit;
    const offerSemaphore = this.offerSemaphore(providerId, offer.capability, offer.target, capabilityLimit);

    const handler = mode === 'foresee' ? provider.simulate : provider.invoke;
    if (typeof handler !== 'function') return reject('RCL_PROVIDER_V2_SIMULATOR_MISSING', `Foresee mode requires a simulator for provider '${providerId}'`, [{ providerId, capability, target }]);

    let resourceHandle = null;
    if (this.resourceKernel && isolationDomainId) {
      try {
        resourceHandle = this.resourceKernel.acquireResource({
          domainId: isolationDomainId,
          actor,
          providerId,
          capability,
          target,
          kind: 'provider-call',
          ticketId: capabilityTicketId,
          requestBytes: byteLength(input ?? null),
          responseBudgetBytes: responseLimit,
          metadata: { requestId, mode, rule: request.rule ?? null },
        });
      } catch (error) {
        const code = error instanceof RCLResourceIsolationError ? error.code : 'RCL_RESOURCE_UNKNOWN';
        const diagnostics = error instanceof RCLResourceIsolationError ? error.diagnostics : [{ message: error?.message ?? String(error) }];
        return reject('RCL_PROVIDER_V2_RESOURCE_DENIED', 'Provider invocation is outside the resource isolation boundary', [{ code, message: error?.message ?? String(error), diagnostics }]);
      }
    }

    return this.globalSemaphore.run(() => offerSemaphore.run(async () => {
      const controller = new AbortController();
      const disconnectAbortSignals = connectAbortSignals(controller, this.resourceKernel && isolationDomainId ? this.resourceKernel.getDomainSignal(isolationDomainId) : null);
      let timeoutId;
      const timeout = new Promise((_, rejectTimeout) => {
        timeoutId = setTimeout(() => {
          controller.abort();
          rejectTimeout(new ProviderRuntimeV2Error('RCL_PROVIDER_V2_TIMEOUT', `Provider '${providerId}.${capability}' timed out after ${timeoutMs}ms`, [{ providerId, capability, timeoutMs }]));
        }, timeoutMs);
      });
      try {
        const output = await Promise.race([
          handler(clone(input), Object.freeze({
            requestId,
            providerId,
            capability,
            target,
            mode,
            actor,
            rule: request.rule ?? null,
            authorityNeeds: clone(authorityNeeds),
            signal: controller.signal,
            state: clone(request.state ?? null),
            isolationDomainId: isolationDomainId ?? null,
            capabilityTicketId,
            resourceHandle: clone(resourceHandle),
            quota: domainQuota ? clone(domainQuota) : null,
          })),
          timeout,
        ]);
        clearTimeout(timeoutId);
        disconnectAbortSignals();
        if (controller.signal.aborted) {
          const reason = controller.signal.reason;
          return reject(reason?.code ?? 'RCL_PROVIDER_V2_ABORTED', reason?.message ?? 'Provider invocation was aborted', [{ reason: reason?.message ?? String(reason), isolationDomainId }]);
        }
        if (byteLength(output ?? null) > responseLimit) {
          return reject('RCL_PROVIDER_V2_RESPONSE_TOO_LARGE', `Provider response exceeds ${responseLimit} bytes`, [{ bytes: byteLength(output ?? null), limit: responseLimit }]);
        }
        const finishedAt = nowIso();
        const receipt = makeReceipt({
          ...base,
          status: 'succeeded',
          code: 'RCL_PROVIDER_V2_OK',
          offer: { capability: offer.capability, target: offer.target, modes: [...offer.modes], effects: [...offer.effects] },
          resourceIsolation: resourceHandle ? { domainId: isolationDomainId, handleId: resourceHandle.id, ticketId: capabilityTicketId } : null,
          output: clone(output),
          outputRoot: realityRoot(output ?? null),
          outputBytes: byteLength(output ?? null),
          finishedAt,
          durationMs: Date.parse(finishedAt) - Date.parse(startedAt),
        });
        this.eventLog.push(receipt);
        return receipt;
      } catch (error) {
        clearTimeout(timeoutId);
        disconnectAbortSignals();
        const code = error instanceof ProviderRuntimeV2Error || error instanceof RCLResourceIsolationError ? error.code : 'RCL_PROVIDER_V2_HANDLER_FAILED';
        const diagnostics = error instanceof ProviderRuntimeV2Error || error instanceof RCLResourceIsolationError ? error.diagnostics : [{ message: error?.message ?? String(error) }];
        return reject(code, error?.message ?? String(error), diagnostics);
      } finally {
        if (resourceHandle) {
          try { this.resourceKernel.releaseResource(resourceHandle.id, { reason: 'provider-invocation-finished' }); }
          catch { /* release is best-effort after receipt creation */ }
        }
      }
    }));
  }

  async invoke(request) {
    const receipt = await this.safeInvoke(request);
    if (receipt.status !== 'succeeded') {
      throw new ProviderRuntimeV2Error(receipt.code, receipt.message, [{ receipt }]);
    }
    return receipt;
  }

  hostAdapter(providerId, options = {}) {
    const runtime = this;
    const target = options.target ?? providerId;
    return Object.freeze({
      async invoke(request) {
        const receipt = await runtime.invoke({
          providerId,
          capability: request.capability,
          target,
          actor: request.actor,
          rule: request.rule,
          mode: 'realize',
          input: { args: clone(request.args ?? []), state: clone(request.state ?? null), fullCapability: request.fullCapability },
          authorityNeeds: request.authorityNeeds ?? request.needs ?? [],
          state: request.state,
          timeoutMs: options.timeoutMs,
          isolationDomainId: options.isolationDomainId ?? options.domainId ?? request.isolationDomainId ?? request.domainId,
          capabilityTicketId: options.capabilityTicketId ?? options.ticketId ?? request.capabilityTicketId ?? request.ticketId,
        });
        return receipt.output;
      },
      async simulate(request) {
        const receipt = await runtime.invoke({
          providerId,
          capability: request.capability,
          target,
          actor: request.actor,
          rule: request.rule,
          mode: 'foresee',
          input: { args: clone(request.args ?? []), state: clone(request.state ?? null), fullCapability: request.fullCapability },
          authorityNeeds: request.authorityNeeds ?? request.needs ?? [],
          state: request.state,
          timeoutMs: options.timeoutMs,
          isolationDomainId: options.isolationDomainId ?? options.domainId ?? request.isolationDomainId ?? request.domainId,
          capabilityTicketId: options.capabilityTicketId ?? options.ticketId ?? request.capabilityTicketId ?? request.ticketId,
        });
        return receipt.output;
      },
    });
  }
}

export function createProviderRuntimeV2(options = {}) {
  return new ProviderRuntimeV2(options);
}

export async function runProviderV2Demo() {
  const runtime = createProviderRuntimeV2({
    timeoutMs: 500,
    policy: {
      subjects: {
        builder: ['console.emit@console', 'computer.invoke@console'],
      },
    },
    providers: [{
      id: 'console',
      version: '2.0.0-demo',
      capabilities: [{ capability: 'emit', target: 'console', modes: ['realize', 'foresee'], effects: ['HostCall', 'Evidence'], maxConcurrent: 1 }],
      async invoke(input) { return `v2:${input.args[0]}`; },
      async simulate(input) { return `sim:${input.args[0]}`; },
    }],
  });
  const report = {
    format: `${PROVIDER_RUNTIME_V2_FORMAT}.demo`,
    runtimeVersion: PROVIDER_RUNTIME_V2_VERSION,
    providers: runtime.listProviders(),
    success: await runtime.safeInvoke({
      providerId: 'console', capability: 'emit', target: 'console', actor: 'builder', rule: 'publish', mode: 'realize',
      input: { args: ['hello-v2'] }, authorityNeeds: [{ capability: 'computer.invoke', target: 'console' }],
    }),
    denied: await runtime.safeInvoke({
      providerId: 'console', capability: 'emit', target: 'console', actor: 'intruder', rule: 'publish', mode: 'realize',
      input: { args: ['blocked'] }, authorityNeeds: [{ capability: 'computer.invoke', target: 'console' }],
    }),
  };
  return Object.freeze({ ...report, root: realityRoot(report), eventLog: runtime.getEventLog() });
}
