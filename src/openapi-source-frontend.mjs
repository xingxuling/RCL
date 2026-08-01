import { realityRoot } from './canonical.mjs';
import { normalizeExternalCapabilitySpec } from './capability-metabolism.mjs';
import {
  finalizeBundle,
  parseJsonInput,
  pushDiagnostic,
  safeIdentifier,
  uniqueStrings,
  RCLSourceCapabilityFrontendError,
} from './source-capability-common.mjs';

const OPENAPI_METHODS = Object.freeze(['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace']);
const READ_METHODS = new Set(['get', 'head', 'options']);

function resolveLocalRef(document, value) {
  if (!value || typeof value !== 'object' || typeof value.$ref !== 'string') return value;
  if (!value.$ref.startsWith('#/')) return value;
  const parts = value.$ref.slice(2).split('/').map(part => part.replace(/~1/g, '/').replace(/~0/g, '~'));
  let current = document;
  for (const part of parts) current = current?.[part];
  return current ?? value;
}

function openApiSchemaLabel(schema, document) {
  if (schema?.$ref) return safeIdentifier(schema.$ref.split('/').at(-1));
  const resolved = resolveLocalRef(document, schema);
  if (resolved?.$ref) return safeIdentifier(resolved.$ref.split('/').at(-1));
  if (resolved?.title) return safeIdentifier(resolved.title);
  if (resolved?.type) return safeIdentifier(Array.isArray(resolved.type) ? resolved.type.join('_or_') : resolved.type);
  if (resolved?.properties) return 'object';
  return 'any';
}

function collectOpenApiParameters(document, pathItem, operation) {
  const combined = [...(pathItem.parameters ?? []), ...(operation.parameters ?? [])];
  const seen = new Set();
  const parameters = [];
  for (const raw of combined) {
    const parameter = resolveLocalRef(document, raw);
    if (!parameter || typeof parameter !== 'object') continue;
    const key = `${parameter.in}:${parameter.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    parameters.push({
      name: String(parameter.name ?? 'parameter'),
      in: String(parameter.in ?? 'unknown'),
      required: parameter.required === true || parameter.in === 'path',
      schema: openApiSchemaLabel(parameter.schema, document),
    });
  }
  return parameters;
}

function collectOpenApiContentSchemas(document, content = {}) {
  return Object.entries(content ?? {}).map(([mediaType, media]) =>
    `${safeIdentifier(mediaType)}:${openApiSchemaLabel(media?.schema, document)}`);
}

function openApiCapabilitySpec(document, pathName, method, pathItem, operation, sourceRoot, provenance) {
  const info = document.info ?? {};
  const operationName = safeIdentifier(operation.operationId ?? `${method}_${pathName}`);
  const parameters = collectOpenApiParameters(document, pathItem, operation);
  const requestBody = resolveLocalRef(document, operation.requestBody);
  const requestSchemas = collectOpenApiContentSchemas(document, requestBody?.content);
  const responses = operation.responses ?? {};
  const responseSchemas = Object.entries(responses).map(([status, raw]) => {
    const response = resolveLocalRef(document, raw);
    const schemas = collectOpenApiContentSchemas(document, response?.content);
    return `${status}:${schemas.join('|') || 'no_body'}`;
  });
  const readOnly = READ_METHODS.has(method);
  const invariants = uniqueStrings([
    `http method ${method.toUpperCase()}`,
    `http path ${pathName}`,
    ...parameters.filter(parameter => parameter.required)
      .map(parameter => `required ${parameter.in} parameter ${parameter.name}:${parameter.schema}`),
    ...(requestBody?.required ? ['request body required'] : []),
    ...requestSchemas.map(label => `request content ${label}`),
    ...Object.keys(responses).map(status => `declared response ${status}`),
    ...responseSchemas.map(label => `response contract ${label}`),
  ]);
  return normalizeExternalCapabilitySpec({
    id: `openapi_${operationName}`,
    version: '0.1.0',
    source: { ecosystem: 'openapi', construct: 'http_operation', version: String(document.openapi), referenceRoot: sourceRoot },
    operation: {
      name: operationName,
      inputs: uniqueStrings([
        ...parameters.map(parameter => `${parameter.in}_${parameter.name}_${parameter.schema}`),
        ...requestSchemas.map(label => `request_${label}`),
      ]),
      outputs: uniqueStrings(responseSchemas.length > 0 ? responseSchemas : ['HttpResponse']),
    },
    semantics: {
      description: String(operation.summary ?? operation.description ?? `${method.toUpperCase()} ${pathName} from ${info.title ?? 'OpenAPI service'}`),
      effects: [
        {
          name: readOnly ? 'ExternalRead' : 'ExternalMutation',
          deterministic: false,
          replay: 'requires-provider-receipt',
          evidenceRequired: true,
          description: `${method.toUpperCase()} ${pathName}`,
        },
        {
          name: 'ValidateResponse', deterministic: true, replay: 'deterministic-given-response',
          evidenceRequired: true,
          description: 'Validate the provider response against declared response contracts.',
        },
      ],
      invariants,
      failureModes: ['transport_failure', 'http_client_error', 'http_server_error', 'response_schema_violation'],
      resourceModel: uniqueStrings([
        `endpoint:${method.toUpperCase()}:${pathName}`,
        ...(document.servers ?? []).map(server => `server:${server.url}`),
      ]),
      authority: [readOnly ? 'api.read' : 'api.mutate', 'api.invoke'],
    },
    lowering: {
      targets: ['http_provider_call', 'capability_ir'], providerRequired: true,
      provider: `openapi:${safeIdentifier(info.title ?? 'service')}`,
    },
    evidence: { equivalenceCases: [], provenance: uniqueStrings([`openapi:${document.openapi}`, pathName, method, ...provenance]) },
    synthesis: {
      tags: ['api', 'http', method, readOnly ? 'read' : 'mutation'],
      compatibleWith: ['json_schema_root', 'provider_runtime'], conflictsWith: [],
    },
  });
}

export function extractCapabilitiesFromOpenApi(input, options = {}) {
  const document = parseJsonInput(input, 'RCL_SOURCE_OPENAPI_PARSE', 'OpenAPI');
  if (typeof document.openapi !== 'string' || !/^3\./.test(document.openapi)) {
    throw new RCLSourceCapabilityFrontendError(
      'RCL_SOURCE_OPENAPI_VERSION',
      'OpenAPI frontend v0.1 requires an OpenAPI 3.x document',
      { openapi: document.openapi },
    );
  }
  const diagnostics = [];
  const sourceRoot = realityRoot(document);
  const specs = [];
  for (const [pathName, rawPathItem] of Object.entries(document.paths ?? {})) {
    const pathItem = resolveLocalRef(document, rawPathItem);
    if (!pathItem || typeof pathItem !== 'object') continue;
    for (const method of OPENAPI_METHODS) {
      const operation = pathItem[method];
      if (!operation || typeof operation !== 'object') continue;
      specs.push(openApiCapabilitySpec(document, pathName, method, pathItem, operation, sourceRoot, options.provenance ?? []));
    }
  }
  if (specs.length === 0) {
    throw new RCLSourceCapabilityFrontendError('RCL_SOURCE_OPENAPI_OPERATIONS_REQUIRED', 'No OpenAPI operations were found under paths');
  }
  const remoteRefs = JSON.stringify(document).match(/"\$ref"\s*:\s*"(?!#\/)[^"]+"/g) ?? [];
  if (remoteRefs.length > 0) {
    pushDiagnostic(diagnostics, 'warning', 'RCL_SOURCE_OPENAPI_REMOTE_REF',
      'Remote references were preserved but not resolved by frontend v0.1', { count: remoteRefs.length });
  }
  if (document.webhooks) {
    pushDiagnostic(diagnostics, 'info', 'RCL_SOURCE_OPENAPI_WEBHOOKS',
      'Webhook declarations are not emitted as capabilities in frontend v0.1');
  }
  return finalizeBundle({
    frontend: 'openapi', sourceVersion: document.openapi, source: document, specs, diagnostics,
    coverage: {
      pathCount: Object.keys(document.paths ?? {}).length,
      operationCount: specs.length,
      serverCount: (document.servers ?? []).length,
      localReferenceResolution: true,
      remoteReferenceResolution: false,
    },
    boundary: 'OpenAPI frontend v0.1 extracts one capability per OpenAPI 3.x operation from JSON documents. It does not execute HTTP, resolve remote references, expand callbacks or webhooks, or prove full specification conformance.',
  });
}
