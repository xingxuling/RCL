import { realityRoot } from './canonical.mjs';
import { metabolizeExternalCapability } from './capability-metabolism.mjs';
import {
  RCL_SOURCE_CAPABILITY_FRONTENDS_VERSION,
  RCL_SOURCE_CAPABILITY_BUNDLE_FORMAT,
  RCL_SOURCE_CAPABILITY_FRONTEND_KINDS,
  RCLSourceCapabilityFrontendError,
  parseJsonInput,
} from './source-capability-common.mjs';
import { extractCapabilitiesFromJsonSchema } from './json-schema-source-frontend.mjs';
import { extractCapabilitiesFromOpenApi } from './openapi-source-frontend.mjs';
import { extractCapabilitiesFromSqlDdl } from './sql-ddl-source-frontend.mjs';

export {
  RCL_SOURCE_CAPABILITY_FRONTENDS_VERSION,
  RCL_SOURCE_CAPABILITY_BUNDLE_FORMAT,
  RCL_SOURCE_CAPABILITY_FRONTEND_KINDS,
  RCLSourceCapabilityFrontendError,
  extractCapabilitiesFromJsonSchema,
  extractCapabilitiesFromOpenApi,
  extractCapabilitiesFromSqlDdl,
};

export function detectSourceCapabilityKind(input, options = {}) {
  if (options.kind) {
    if (!RCL_SOURCE_CAPABILITY_FRONTEND_KINDS.includes(options.kind)) {
      throw new RCLSourceCapabilityFrontendError(
        'RCL_SOURCE_FRONTEND_KIND',
        `Unsupported source capability kind '${options.kind}'`,
        { supported: RCL_SOURCE_CAPABILITY_FRONTEND_KINDS },
      );
    }
    return options.kind;
  }
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    if (typeof input.openapi === 'string') return 'openapi';
    if (input.$schema || input.$id || input.$defs || input.properties || input.type) return 'json-schema';
  }
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (/\bCREATE\s+(?:(?:GLOBAL|LOCAL)\s+)?(?:(?:TEMPORARY|TEMP|UNLOGGED)\s+)?TABLE\b/i.test(trimmed)) return 'sql-ddl';
    if (trimmed.startsWith('{')) {
      const parsed = parseJsonInput(trimmed, 'RCL_SOURCE_DETECT_JSON', 'Source capability');
      return detectSourceCapabilityKind(parsed, options);
    }
  }
  throw new RCLSourceCapabilityFrontendError(
    'RCL_SOURCE_FRONTEND_UNDETECTED',
    'Could not detect a supported JSON Schema, OpenAPI or SQL DDL source',
  );
}

export function extractSourceCapabilities(input, options = {}) {
  const kind = detectSourceCapabilityKind(input, options);
  if (kind === 'json-schema') return extractCapabilitiesFromJsonSchema(input, options);
  if (kind === 'openapi') return extractCapabilitiesFromOpenApi(input, options);
  return extractCapabilitiesFromSqlDdl(input, options);
}

export function metabolizeSourceCapabilityBundle(input, options = {}) {
  const bundle = input?.format === RCL_SOURCE_CAPABILITY_BUNDLE_FORMAT
    ? input
    : extractSourceCapabilities(input, options.frontendOptions ?? options);
  const metabolize = options.metabolize ?? metabolizeExternalCapability;
  if (typeof metabolize !== 'function') {
    throw new RCLSourceCapabilityFrontendError(
      'RCL_SOURCE_METABOLIZER_REQUIRED',
      'Source capability metabolism requires a metabolize function',
    );
  }
  const reports = bundle.capabilities.map(spec => metabolize(spec, {
    subject: options.subject ?? `source_frontend_${bundle.frontend}`,
  }));
  const stageCounts = {};
  for (const report of reports) {
    const stage = report?.assessment?.stage ?? 'unknown';
    stageCounts[stage] = (stageCounts[stage] ?? 0) + 1;
  }
  const body = {
    format: 'rcl.source-capability-metabolism-batch.v0.1',
    version: RCL_SOURCE_CAPABILITY_FRONTENDS_VERSION,
    frontend: bundle.frontend,
    sourceRoot: bundle.sourceRoot,
    bundleRoot: bundle.root,
    capabilityCount: bundle.capabilityCount,
    reportRoots: reports.map(report => report.root),
    reports,
    stageCounts,
    boundary: 'Source extraction and semantic metabolism do not establish independent differential equivalence or native verification. Those require the later absorption gates.',
  };
  return Object.freeze({ ...body, root: realityRoot({
    ...body,
    reports: reports.map(report => report.root),
  }) });
}
