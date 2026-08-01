import { realityRoot } from './canonical.mjs';
import {
  RCL_CAPABILITY_SPEC_FORMAT,
  normalizeExternalCapabilitySpec,
} from './capability-metabolism.mjs';

export const RCL_SOURCE_CAPABILITY_FRONTENDS_VERSION = '0.1.0-alpha.1';
export const RCL_SOURCE_CAPABILITY_BUNDLE_FORMAT = 'rcl.source-capability-bundle.v0.1';
export const RCL_SOURCE_CAPABILITY_FRONTEND_KINDS = Object.freeze([
  'json-schema',
  'openapi',
  'sql-ddl',
]);

export class RCLSourceCapabilityFrontendError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'RCLSourceCapabilityFrontendError';
    this.code = code;
    this.details = details;
  }
}

export function assertObject(value, code, message) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new RCLSourceCapabilityFrontendError(code, message, { value });
  }
  return value;
}

export function safeIdentifier(value, fallback = 'source_capability') {
  const normalized = String(value ?? '')
    .trim()
    .replace(/[^A-Za-z0-9_]+/g, '_')
    .replace(/^([^A-Za-z_])/, '_$1')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
  return normalized || fallback;
}

export function uniqueStrings(values = []) {
  return [...new Set(values.map(value => String(value).trim()).filter(Boolean))];
}

export function parseJsonInput(input, code, label) {
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
      throw new RCLSourceCapabilityFrontendError(
        code,
        `${label} frontend v0.1 accepts JSON objects or JSON text, not YAML`,
        { prefix: trimmed.slice(0, 80) },
      );
    }
    try {
      return JSON.parse(trimmed);
    } catch (error) {
      throw new RCLSourceCapabilityFrontendError(code, `${label} JSON could not be parsed`, {
        message: error.message,
      });
    }
  }
  return assertObject(input, code, `${label} input must be an object or JSON object string`);
}

export function pushDiagnostic(diagnostics, level, code, message, details = {}) {
  diagnostics.push(Object.freeze({ level, code, message, details }));
}

export function finalizeBundle({ frontend, sourceVersion, source, specs, diagnostics, coverage, boundary }) {
  const normalizedSpecs = specs.map(spec => (
    spec?.format === RCL_CAPABILITY_SPEC_FORMAT ? spec : normalizeExternalCapabilitySpec(spec)
  ));
  const sourceRoot = realityRoot(source);
  const body = {
    format: RCL_SOURCE_CAPABILITY_BUNDLE_FORMAT,
    version: RCL_SOURCE_CAPABILITY_FRONTENDS_VERSION,
    frontend,
    sourceVersion: String(sourceVersion ?? 'unknown'),
    sourceRoot,
    capabilityCount: normalizedSpecs.length,
    capabilityRoots: normalizedSpecs.map(spec => spec.root),
    capabilities: normalizedSpecs,
    diagnostics,
    coverage,
    boundary,
  };
  return Object.freeze({ ...body, root: realityRoot({
    ...body,
    capabilities: normalizedSpecs.map(spec => spec.root),
  }) });
}
