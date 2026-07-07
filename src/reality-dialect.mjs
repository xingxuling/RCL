import { realityRoot } from './canonical.mjs';
import { RCLError } from './errors.mjs';
import { REALITY_DOMAINS } from './foundation.mjs';

export const RCL_DIALECT_REGISTRY_VERSION = '0.13.0-alpha.1';

export class RCLDialectError extends RCLError {
  constructor(code, message, details = {}) {
    super(code, message, details);
    this.name = 'RCLDialectError';
  }
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function normalizeOperation(operation) {
  if (!operation || typeof operation !== 'object') {
    throw new RCLDialectError('RCL_DIALECT_OPERATION_INVALID', 'Dialect operation must be an object', { operation });
  }
  if (typeof operation.name !== 'string' || operation.name.length === 0) {
    throw new RCLDialectError('RCL_DIALECT_OPERATION_NAME', 'Dialect operation requires a non-empty name', { operation });
  }
  return {
    name: operation.name,
    inputs: [...(operation.inputs ?? [])],
    outputs: [...(operation.outputs ?? [])],
    effects: [...(operation.effects ?? [])],
    lowersTo: [...(operation.lowersTo ?? [])],
  };
}

export function normalizeDialect(dialect) {
  if (!dialect || typeof dialect !== 'object') {
    throw new RCLDialectError('RCL_DIALECT_INVALID', 'Dialect must be an object', { dialect });
  }
  if (typeof dialect.id !== 'string' || dialect.id.length === 0) {
    throw new RCLDialectError('RCL_DIALECT_ID', 'Dialect requires a non-empty id', { dialect });
  }
  const operations = (dialect.operations ?? []).map(normalizeOperation);
  const normalized = {
    format: 'rcl.reality-dialect.v0.13',
    id: dialect.id,
    version: dialect.version ?? RCL_DIALECT_REGISTRY_VERSION,
    layer: dialect.layer ?? 'semantic',
    domain: dialect.domain ?? null,
    description: dialect.description ?? '',
    operations,
    lowersTo: [...(dialect.lowersTo ?? [])],
    invariants: [...(dialect.invariants ?? [])],
    root: null,
  };
  normalized.root = realityRoot({ ...normalized, root: undefined });
  return deepFreeze(normalized);
}

export const DEFAULT_REALITY_DIALECTS = deepFreeze([
  {
    id: 'subject',
    layer: 'semantic',
    domain: 'spiritual',
    description: 'Subject identity, facets, responsibility and continuity.',
    operations: [
      { name: 'declare_subject', outputs: ['Subject'], effects: ['Evidence'] },
      { name: 'declare_facet', inputs: ['Subject'], outputs: ['Facet'], effects: ['Observe'] },
    ],
    lowersTo: ['authority', 'knowledge'],
    invariants: ['subject identity must remain traceable across lowering'],
  },
  {
    id: 'authority',
    layer: 'semantic',
    domain: 'execution',
    description: 'Warrants, needs, preserved boundaries and capability-bearing state changes.',
    operations: [
      { name: 'grant_warrant', outputs: ['Capability'], effects: ['Authority'] },
      { name: 'require_need', inputs: ['Capability'], effects: ['Authority'] },
      { name: 'preserve_boundary', inputs: ['Truth'], effects: ['Preserve'] },
      { name: 'alter_reality', inputs: ['Facet'], outputs: ['Facet'], effects: ['AlterReality'] },
    ],
    lowersTo: ['temporal', 'machine'],
    invariants: ['lowering cannot introduce a capability absent from the source authority graph'],
  },
  {
    id: 'knowledge',
    layer: 'semantic',
    domain: 'knowledge',
    description: 'Claims, evidence, revision, confidence, conflicts and forgetting.',
    operations: [
      { name: 'claim', outputs: ['Knowledge'], effects: ['Evidence'] },
      { name: 'revise', inputs: ['Knowledge'], outputs: ['Knowledge'], effects: ['AlterReality', 'Evidence'] },
    ],
    lowersTo: ['temporal', 'machine'],
    invariants: ['claim provenance must survive compilation and replay'],
  },
  {
    id: 'temporal',
    layer: 'control',
    domain: 'meta-spacetime',
    description: 'Logical instants, event order, deadlines, replay and time acceleration boundaries.',
    operations: [
      { name: 'record_event', outputs: ['Event'], effects: ['Evidence'] },
      { name: 'schedule_reaction', inputs: ['Event'], outputs: ['Event'], effects: ['Observe'] },
    ],
    lowersTo: ['machine'],
    invariants: ['same logical input order must replay to the same committed state root'],
  },
  {
    id: 'tensor',
    layer: 'numeric',
    domain: 'quantitative',
    description: 'N-dimensional data, functions, transforms, gradients and device-aware execution.',
    operations: [
      { name: 'tensor', outputs: ['Tensor'], effects: [] },
      { name: 'differentiate', inputs: ['Function'], outputs: ['Gradient'], effects: ['Evidence'] },
      { name: 'vectorize', inputs: ['Function'], outputs: ['Function'], effects: [] },
    ],
    lowersTo: ['machine'],
    invariants: ['units and uncertainty metadata must remain mapped to execution buffers'],
  },
  {
    id: 'scene',
    layer: 'projection',
    domain: 'perceptual',
    description: 'Scene objects, cameras, materials and visual projections of reality state.',
    operations: [
      { name: 'project_scene', inputs: ['RealityTree'], outputs: ['SceneGraph'], effects: ['Observe'] },
      { name: 'render_frame', inputs: ['SceneGraph'], outputs: ['Frame'], effects: ['Evidence'] },
    ],
    lowersTo: ['tensor', 'machine'],
    invariants: ['projection must retain source reality roots'],
  },
  {
    id: 'audio',
    layer: 'projection',
    domain: 'perceptual',
    description: 'Signal graphs, cues, tracks, tempo, timecode and sonic projections.',
    operations: [
      { name: 'signal_node', outputs: ['Signal'], effects: [] },
      { name: 'render_audio', inputs: ['Signal'], outputs: ['AudioBuffer'], effects: ['Evidence'] },
    ],
    lowersTo: ['tensor', 'machine'],
    invariants: ['audio time events must map to logical time'],
  },
  {
    id: 'physical',
    layer: 'simulation',
    domain: 'physical',
    description: 'Dimensional physics, bodies, fields, laws and conserved quantities.',
    operations: [
      { name: 'advance_law', inputs: ['State', 'Time'], outputs: ['State'], effects: ['AlterReality', 'Evidence'] },
      { name: 'conserve', inputs: ['Truth'], effects: ['Preserve'] },
    ],
    lowersTo: ['tensor', 'temporal', 'machine'],
    invariants: ['dimensional quantities cannot lower to naked numbers without mapping metadata'],
  },
  {
    id: 'machine',
    layer: 'execution',
    domain: 'computational',
    description: 'Executable bytecode, native VM, provider calls, host ABI and resource budgets.',
    operations: [
      { name: 'emit_rbc', inputs: ['IR'], outputs: ['Bytecode'], effects: [] },
      { name: 'invoke_provider', inputs: ['Capability'], outputs: ['Receipt'], effects: ['HostCall', 'Evidence'] },
    ],
    lowersTo: [],
    invariants: ['machine execution cannot bypass authority and evidence semantics'],
  },
].map(normalizeDialect));

export class RealityDialectRegistry {
  constructor(dialects = DEFAULT_REALITY_DIALECTS) {
    this.format = 'rcl.reality-dialect-registry.v0.13';
    this.version = RCL_DIALECT_REGISTRY_VERSION;
    this._dialects = new Map();
    for (const dialect of dialects) this.register(dialect);
  }

  register(dialect) {
    const normalized = normalizeDialect(dialect);
    if (this._dialects.has(normalized.id)) {
      throw new RCLDialectError('RCL_DIALECT_DUPLICATE', `Dialect '${normalized.id}' already exists`, { id: normalized.id });
    }
    this._dialects.set(normalized.id, normalized);
    return normalized;
  }

  has(id) { return this._dialects.has(id); }

  get(id) { return this._dialects.get(id) ?? null; }

  require(id) {
    const dialect = this.get(id);
    if (!dialect) throw new RCLDialectError('RCL_DIALECT_MISSING', `Dialect '${id}' is not registered`, { id });
    return dialect;
  }

  list() { return [...this._dialects.values()]; }

  validateOperation(dialectId, operationName) {
    const dialect = this.require(dialectId);
    const operation = dialect.operations.find(item => item.name === operationName);
    if (!operation) {
      throw new RCLDialectError('RCL_DIALECT_OPERATION_MISSING', `Dialect '${dialectId}' has no operation '${operationName}'`, { dialectId, operationName });
    }
    return operation;
  }

  lowerPath(fromId, toId) {
    this.require(fromId); this.require(toId);
    const queue = [[fromId]];
    const seen = new Set([fromId]);
    while (queue.length) {
      const path = queue.shift();
      const current = path[path.length - 1];
      if (current === toId) return path;
      for (const next of this.require(current).lowersTo) {
        if (!this.has(next) || seen.has(next)) continue;
        seen.add(next);
        queue.push([...path, next]);
      }
    }
    return null;
  }

  summary() {
    const dialects = this.list();
    const summary = {
      format: this.format,
      version: this.version,
      dialects: dialects.map(dialect => ({
        id: dialect.id,
        layer: dialect.layer,
        domain: dialect.domain,
        operations: dialect.operations.map(operation => operation.name),
        lowersTo: dialect.lowersTo,
      })),
      foundationDomains: Object.keys(REALITY_DOMAINS ?? {}),
    };
    return Object.freeze({ ...summary, root: realityRoot(summary) });
  }
}

export function createRealityDialectRegistry(dialects = DEFAULT_REALITY_DIALECTS) {
  return new RealityDialectRegistry(dialects);
}

export function buildRealityDialectSummary(dialects = DEFAULT_REALITY_DIALECTS) {
  return createRealityDialectRegistry(dialects).summary();
}
