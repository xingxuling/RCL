import { createProviderRuntimeV2, createResourceIsolationKernel } from '../src/index.mjs';

const kernel = createResourceIsolationKernel({
  defaultQuota: { maxHandles: 1, requestBytes: 1024, responseBytes: 1024, maxConcurrent: 1, timeoutMs: 500 },
  domains: [{ id: 'demo', policy: { subjects: { builder: ['console.emit@console'] } } }],
});

const ticket = kernel.issueCapabilityTicket({
  domainId: 'demo',
  actor: 'builder',
  providerId: 'console',
  capability: 'emit',
  target: 'console',
});

const runtime = createProviderRuntimeV2({
  resourceKernel: kernel,
  policy: { subjects: { builder: ['console.emit@console'] } },
  providers: [{
    id: 'console',
    capabilities: [{ capability: 'emit', target: 'console', modes: ['realize'], effects: ['HostCall', 'Evidence'] }],
    async invoke(input, context) {
      return {
        message: `resource-bound:${input.args[0]}`,
        domain: context.isolationDomainId,
        handleKind: context.resourceHandle.kind,
      };
    },
  }],
});

const success = await runtime.safeInvoke({
  providerId: 'console',
  capability: 'emit',
  target: 'console',
  actor: 'builder',
  input: { args: ['hello'] },
  isolationDomainId: 'demo',
  capabilityTicketId: ticket.id,
});

const denied = await runtime.safeInvoke({
  providerId: 'console',
  capability: 'emit',
  target: 'console',
  actor: 'builder',
  input: { args: ['no-ticket'] },
  isolationDomainId: 'demo',
});

console.log(JSON.stringify({
  format: 'rcl.provider-runtime.v2.resource-isolation.demo',
  success,
  denied,
  domain: kernel.domainSnapshot('demo'),
  activeHandles: kernel.listActiveHandles('demo'),
  providerEvents: runtime.getEventLog(),
  resourceEvents: kernel.getEventLog(),
}, null, 2));
