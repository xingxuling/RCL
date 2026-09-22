import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const FOUNDATION_RUNTIME_TRUTH_CONTRACT_FORMAT = 'taowind.rcl-foundation-runtime-truth-contract.v0.2';
export const FOUNDATION_RUNTIME_TRUTH_CONTRACT_VERSION = '0.2.0';
export const FOUNDATION_RUNTIME_TRUTH_CONTRACT_ROOT_ALGORITHM = 'rcl.foundation-runtime-truth-contract.sha256.v0.2';
export const FOUNDATION_RUNTIME_TRUTH_DEPENDENCY_CLOSURE_ALGORITHM = 'rcl.foundation-runtime-truth-static-relative-esm-closure.sha256.v0.1';

const SOURCE_BINDING_SEEDS = Object.freeze([
  'api/health.mjs',
  'api/runtime-health.mjs',
  'api/capability-truth.mjs',
  'api/bridge-statepath-truth.mjs',
  'api/release-runtime-truth.mjs',
  'src/foundation-capability-registry-truth.json',
  'src/foundation-direct-capability-registry.mjs',
  'src/foundation-native-bridge-capability-registry.mjs',
  'src/foundation-release-deployment-source-parity.mjs',
  'src/foundation-runtime-truth-contract.mjs',
]);

const RUNTIME_TRUTH_SURFACES = Object.freeze([
  { id: 'runtime-health', logicalPath: '/health', source: 'api/runtime-health.mjs' },
  { id: 'capability-truth', logicalPath: '/capability-truth', source: 'api/capability-truth.mjs' },
  { id: 'bridge-statepath-truth', logicalPath: '/bridge-statepath-truth', source: 'api/bridge-statepath-truth.mjs' },
  { id: 'release-runtime-truth', logicalPath: '/release-runtime-truth', source: 'api/release-runtime-truth.mjs' },
  { id: 'native-deployment-health', logicalPath: 'internal:native-deployment-health', source: 'api/health.mjs' },
]);

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  }
  return value;
}

function sha256Bytes(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function sha256Canonical(value) {
  return sha256Bytes(JSON.stringify(canonical(value)));
}

function isSha256(value) {
  return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value);
}

function readJson(rootDir, relativePath) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), 'utf8'));
}

function normalizeRelative(root, absolutePath) {
  const relative = path.relative(root, absolutePath).replaceAll('\\', '/');
  if (!relative || relative === '..' || relative.startsWith('../') || path.isAbsolute(relative)) return null;
  return relative;
}

function extractRelativeModuleSpecifiers(sourceText) {
  const values = new Set();
  const length = sourceText.length;
  const isWord = char => Boolean(char && /[A-Za-z0-9_$]/.test(char));

  function readQuoted(start) {
    const quote = sourceText[start];
    if (quote !== "'" && quote !== '"') return null;
    let value = '';
    let cursor = start + 1;
    while (cursor < length) {
      const char = sourceText[cursor];
      if (char === '\\') {
        if (cursor + 1 < length) {
          value += sourceText[cursor + 1];
          cursor += 2;
          continue;
        }
        return null;
      }
      if (char === quote) return { value, end: cursor + 1 };
      value += char;
      cursor += 1;
    }
    return null;
  }

  function skipLineComment(start) {
    let cursor = start + 2;
    while (cursor < length && sourceText[cursor] !== '\n') cursor += 1;
    return cursor;
  }

  function skipBlockComment(start) {
    const end = sourceText.indexOf('*/', start + 2);
    return end === -1 ? length : end + 2;
  }

  function skipTemplate(start) {
    let cursor = start + 1;
    while (cursor < length) {
      const char = sourceText[cursor];
      if (char === '\\') {
        cursor += 2;
        continue;
      }
      if (char === '`') return cursor + 1;
      cursor += 1;
    }
    return length;
  }

  function skipTrivia(start) {
    let cursor = start;
    while (cursor < length) {
      if (/\s/.test(sourceText[cursor])) {
        cursor += 1;
        continue;
      }
      if (sourceText[cursor] === '/' && sourceText[cursor + 1] === '/') {
        cursor = skipLineComment(cursor);
        continue;
      }
      if (sourceText[cursor] === '/' && sourceText[cursor + 1] === '*') {
        cursor = skipBlockComment(cursor);
        continue;
      }
      break;
    }
    return cursor;
  }

  function wordAt(start, word) {
    return sourceText.startsWith(word, start)
      && !isWord(sourceText[start - 1])
      && !isWord(sourceText[start + word.length]);
  }

  function readStaticImport(start) {
    let cursor = skipTrivia(start + 'import'.length);
    if (sourceText[cursor] === '.') return start + 'import'.length; // import.meta
    if (sourceText[cursor] === '(') {
      cursor = skipTrivia(cursor + 1);
      const quoted = readQuoted(cursor);
      if (quoted?.value?.startsWith('.')) values.add(quoted.value);
      return quoted?.end ?? cursor + 1;
    }
    const immediate = readQuoted(cursor);
    if (immediate) {
      if (immediate.value.startsWith('.')) values.add(immediate.value);
      return immediate.end;
    }
    let scanned = cursor;
    while (scanned < length) {
      if (sourceText[scanned] === ';') return scanned + 1;
      if (sourceText[scanned] === '/' && sourceText[scanned + 1] === '/') {
        scanned = skipLineComment(scanned);
        continue;
      }
      if (sourceText[scanned] === '/' && sourceText[scanned + 1] === '*') {
        scanned = skipBlockComment(scanned);
        continue;
      }
      if (sourceText[scanned] === '`') {
        scanned = skipTemplate(scanned);
        continue;
      }
      if (sourceText[scanned] === "'" || sourceText[scanned] === '"') {
        const quoted = readQuoted(scanned);
        if (quoted) {
          if (quoted.value.startsWith('.')) values.add(quoted.value);
          return quoted.end;
        }
      }
      scanned += 1;
    }
    return scanned;
  }

  function readReExport(start) {
    let cursor = start + 'export'.length;
    while (cursor < length) {
      if (sourceText[cursor] === ';') return cursor + 1;
      if (sourceText[cursor] === '/' && sourceText[cursor + 1] === '/') {
        cursor = skipLineComment(cursor);
        continue;
      }
      if (sourceText[cursor] === '/' && sourceText[cursor + 1] === '*') {
        cursor = skipBlockComment(cursor);
        continue;
      }
      if (sourceText[cursor] === '`') {
        cursor = skipTemplate(cursor);
        continue;
      }
      if (wordAt(cursor, 'from')) {
        const quoted = readQuoted(skipTrivia(cursor + 'from'.length));
        if (quoted?.value?.startsWith('.')) values.add(quoted.value);
        return quoted?.end ?? cursor + 'from'.length;
      }
      if (sourceText[cursor] === "'" || sourceText[cursor] === '"') {
        const quoted = readQuoted(cursor);
        cursor = quoted?.end ?? cursor + 1;
        continue;
      }
      cursor += 1;
    }
    return cursor;
  }

  let cursor = 0;
  while (cursor < length) {
    const char = sourceText[cursor];
    if (char === '/' && sourceText[cursor + 1] === '/') {
      cursor = skipLineComment(cursor);
      continue;
    }
    if (char === '/' && sourceText[cursor + 1] === '*') {
      cursor = skipBlockComment(cursor);
      continue;
    }
    if (char === "'" || char === '"') {
      cursor = readQuoted(cursor)?.end ?? cursor + 1;
      continue;
    }
    if (char === '`') {
      cursor = skipTemplate(cursor);
      continue;
    }
    if (wordAt(cursor, 'import')) {
      cursor = readStaticImport(cursor);
      continue;
    }
    if (wordAt(cursor, 'export')) {
      cursor = readReExport(cursor);
      continue;
    }
    cursor += 1;
  }
  return [...values].sort();
}

function resolveRelativeModule(root, importer, specifier) {
  const importerDir = path.dirname(path.join(root, importer));
  const base = path.resolve(importerDir, specifier);
  const extension = path.extname(base);
  const candidates = extension
    ? [base]
    : [base, `${base}.mjs`, `${base}.js`, `${base}.cjs`, `${base}.json`, path.join(base, 'index.mjs'), path.join(base, 'index.js')];
  for (const candidate of candidates) {
    let stat;
    try { stat = fs.statSync(candidate); } catch { continue; }
    if (!stat.isFile()) continue;
    const relative = normalizeRelative(root, candidate);
    if (relative) return relative;
  }
  return null;
}

function moduleDependencyClosure(rootDir, seeds = SOURCE_BINDING_SEEDS) {
  const root = path.resolve(rootDir);
  const queue = [...new Set(seeds.map(String))].sort();
  const visited = new Set();
  const edges = [];
  const unresolvedRelativeImports = [];
  while (queue.length > 0) {
    const current = queue.shift();
    if (visited.has(current)) continue;
    const absolute = path.join(root, current);
    if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
      unresolvedRelativeImports.push({ from: current, specifier: '<seed>', reason: 'missing-seed' });
      visited.add(current);
      continue;
    }
    visited.add(current);
    if (!/\.(?:mjs|js|cjs)$/i.test(current)) continue;
    const sourceText = fs.readFileSync(absolute, 'utf8');
    for (const specifier of extractRelativeModuleSpecifiers(sourceText)) {
      const resolved = resolveRelativeModule(root, current, specifier);
      if (!resolved) {
        unresolvedRelativeImports.push({ from: current, specifier, reason: 'unresolved-relative-import' });
        continue;
      }
      edges.push({ from: current, specifier, to: resolved });
      if (!visited.has(resolved) && !queue.includes(resolved)) queue.push(resolved);
    }
    queue.sort();
  }
  const paths = [...visited].sort();
  const sortedEdges = edges.sort((left, right) => (
    left.from.localeCompare(right.from)
    || left.to.localeCompare(right.to)
    || left.specifier.localeCompare(right.specifier)
  ));
  const sortedUnresolved = unresolvedRelativeImports.sort((left, right) => (
    left.from.localeCompare(right.from) || left.specifier.localeCompare(right.specifier)
  ));
  const closurePayload = {
    algorithm: FOUNDATION_RUNTIME_TRUTH_DEPENDENCY_CLOSURE_ALGORITHM,
    seedPaths: [...new Set(seeds.map(String))].sort(),
    paths,
    edges: sortedEdges,
    unresolvedRelativeImports: sortedUnresolved,
  };
  return {
    ...closurePayload,
    sourceCount: paths.length,
    edgeCount: sortedEdges.length,
    closureRoot: sha256Canonical(closurePayload),
  };
}

function sourceBindings(rootDir, paths) {
  return paths.map(relativePath => ({
    path: relativePath,
    sha256: sha256Bytes(fs.readFileSync(path.join(rootDir, relativePath))),
  }));
}

function truthBoundary() {
  return {
    packagedRuntimeTruthSourcesBound: true,
    staticRepositoryLocalModuleDependencyClosureBound: true,
    dependencyClosureDoesNotClaimDynamicRuntimeResources: true,
    dependencyClosureDoesNotClaimExternalPackageByteClosure: true,
    deploymentMustReverifyRuntimeTruth: true,
    deploymentEvidenceClaimed: false,
    runtimeSurfaceAvailabilityClaimed: false,
    providerBridgeRemovedGlobally: false,
    allFoundationDomainsDirectNativeClaimed: false,
    completeRuntimeClaimed: false,
    fullSelfHostingClaimed: false,
  };
}

export function foundationRuntimeTruthContractRoot(contract) {
  if (!contract || typeof contract !== 'object' || Array.isArray(contract)) {
    throw new TypeError('Foundation runtime truth contract object is required');
  }
  const { contractRoot: _contractRoot, ...payload } = contract;
  return sha256Canonical(payload);
}

export function createFoundationRuntimeTruthContract(rootDir) {
  const root = path.resolve(rootDir);
  const capabilityTruth = readJson(root, 'src/foundation-capability-registry-truth.json');
  const dependencyClosure = moduleDependencyClosure(root);
  if (dependencyClosure.unresolvedRelativeImports.length > 0) {
    const error = new Error('RCL_RUNTIME_TRUTH_DEPENDENCY_CLOSURE_UNRESOLVED');
    error.details = { unresolvedRelativeImports: dependencyClosure.unresolvedRelativeImports };
    throw error;
  }
  const payload = {
    format: FOUNDATION_RUNTIME_TRUTH_CONTRACT_FORMAT,
    version: FOUNDATION_RUNTIME_TRUTH_CONTRACT_VERSION,
    rootAlgorithm: FOUNDATION_RUNTIME_TRUTH_CONTRACT_ROOT_ALGORITHM,
    capabilityTruth: {
      snapshot: 'src/foundation-capability-registry-truth.json',
      truthRoot: capabilityTruth.truthRoot,
      directRegistryRoot: capabilityTruth?.direct?.registryRoot ?? null,
      directDomains: [...(capabilityTruth?.direct?.domains ?? [])],
      providerBridgeRegistryRoot: capabilityTruth?.providerBridge?.registryRoot ?? null,
      providerBridgeDomains: [...(capabilityTruth?.providerBridge?.domains ?? [])],
      providerBatchCount: capabilityTruth?.providerBridge?.batches?.length ?? 0,
    },
    surfaces: RUNTIME_TRUTH_SURFACES.map(item => ({ ...item })),
    dependencyClosure,
    sourceBindings: sourceBindings(root, dependencyClosure.paths),
    truthBoundary: truthBoundary(),
  };
  return { ...payload, contractRoot: sha256Canonical(payload) };
}

export function verifyFoundationRuntimeTruthContract(contract, { rootDir } = {}) {
  const errors = [];
  if (!rootDir) errors.push('rootDir is required');
  if (!contract || typeof contract !== 'object' || Array.isArray(contract)) {
    return { ok: false, errors: ['contract object is required'] };
  }
  const root = rootDir ? path.resolve(rootDir) : null;
  if (contract.format !== FOUNDATION_RUNTIME_TRUTH_CONTRACT_FORMAT) errors.push('contract format drifted');
  if (contract.version !== FOUNDATION_RUNTIME_TRUTH_CONTRACT_VERSION) errors.push('contract version drifted');
  if (contract.rootAlgorithm !== FOUNDATION_RUNTIME_TRUTH_CONTRACT_ROOT_ALGORITHM) errors.push('contract root algorithm drifted');
  if (!isSha256(contract.contractRoot) || contract.contractRoot !== foundationRuntimeTruthContractRoot(contract)) {
    errors.push('contract root does not match canonical payload');
  }

  if (root) {
    let expected = null;
    try {
      expected = createFoundationRuntimeTruthContract(root);
    } catch (error) {
      errors.push(`unable to materialize expected runtime truth contract: ${error?.message ?? String(error)}`);
    }
    if (expected) {
      if (JSON.stringify(canonical(contract.capabilityTruth)) !== JSON.stringify(canonical(expected.capabilityTruth))) {
        errors.push('capability truth binding drifted');
      }
      if (JSON.stringify(canonical(contract.surfaces)) !== JSON.stringify(canonical(expected.surfaces))) {
        errors.push('runtime truth surface contract drifted');
      }
      if (JSON.stringify(canonical(contract.dependencyClosure)) !== JSON.stringify(canonical(expected.dependencyClosure))) {
        errors.push('runtime truth static module dependency closure drifted');
      }
      if (JSON.stringify(canonical(contract.sourceBindings)) !== JSON.stringify(canonical(expected.sourceBindings))) {
        errors.push('runtime truth source hash binding drifted');
      }
      if (contract.contractRoot !== expected.contractRoot) errors.push('contract root diverged from exact dependency-closed source tree');
    }
  }

  const boundary = contract.truthBoundary ?? {};
  if (boundary.packagedRuntimeTruthSourcesBound !== true) errors.push('packaged runtime truth source binding is not asserted');
  if (boundary.staticRepositoryLocalModuleDependencyClosureBound !== true) errors.push('repository-local static module dependency closure is not asserted');
  if (boundary.dependencyClosureDoesNotClaimDynamicRuntimeResources !== true) errors.push('dynamic runtime resource boundary is missing');
  if (boundary.dependencyClosureDoesNotClaimExternalPackageByteClosure !== true) errors.push('external package byte-closure boundary is missing');
  if (boundary.deploymentMustReverifyRuntimeTruth !== true) errors.push('deployment re-verification boundary is missing');
  if (boundary.deploymentEvidenceClaimed !== false) errors.push('developer release must not fabricate deployment evidence');
  if (boundary.runtimeSurfaceAvailabilityClaimed !== false) errors.push('developer release must not claim hosted endpoint availability');
  if (boundary.providerBridgeRemovedGlobally !== false) errors.push('Provider bridge removal is overclaimed');
  if (boundary.allFoundationDomainsDirectNativeClaimed !== false) errors.push('all-Foundation direct-native coverage is overclaimed');
  if (boundary.completeRuntimeClaimed !== false) errors.push('complete runtime is overclaimed');
  if (boundary.fullSelfHostingClaimed !== false) errors.push('full self-hosting is overclaimed');

  const closure = contract.dependencyClosure ?? {};
  const closurePayload = {
    algorithm: closure.algorithm,
    seedPaths: Array.isArray(closure.seedPaths) ? closure.seedPaths : [],
    paths: Array.isArray(closure.paths) ? closure.paths : [],
    edges: Array.isArray(closure.edges) ? closure.edges : [],
    unresolvedRelativeImports: Array.isArray(closure.unresolvedRelativeImports) ? closure.unresolvedRelativeImports : [],
  };
  if (closure.algorithm !== FOUNDATION_RUNTIME_TRUTH_DEPENDENCY_CLOSURE_ALGORITHM) errors.push('dependency closure algorithm drifted');
  if (!isSha256(closure.closureRoot) || closure.closureRoot !== sha256Canonical(closurePayload)) errors.push('dependency closure root does not match canonical closure payload');
  if (Number(closure.sourceCount) !== closurePayload.paths.length) errors.push('dependency closure source count drifted');
  if (Number(closure.edgeCount) !== closurePayload.edges.length) errors.push('dependency closure edge count drifted');
  if (closurePayload.unresolvedRelativeImports.length !== 0) errors.push('dependency closure contains unresolved repository-local relative imports');

  const boundPaths = new Set((contract.sourceBindings ?? []).map(item => item?.path));
  for (const requiredPath of SOURCE_BINDING_SEEDS) {
    if (!boundPaths.has(requiredPath)) errors.push(`required runtime truth source seed is not bound: ${requiredPath}`);
  }
  for (const dependencyPath of closurePayload.paths) {
    if (!boundPaths.has(dependencyPath)) errors.push(`runtime truth dependency is not content-bound: ${dependencyPath}`);
  }
  for (const edge of closurePayload.edges) {
    if (!boundPaths.has(edge?.from) || !boundPaths.has(edge?.to)) {
      errors.push(`runtime truth dependency edge escapes source bindings: ${edge?.from ?? '<missing>'} -> ${edge?.to ?? '<missing>'}`);
    }
  }
  for (const binding of contract.sourceBindings ?? []) {
    if (!binding?.path || !isSha256(binding?.sha256)) errors.push(`invalid source binding: ${binding?.path ?? '<missing>'}`);
  }
  if ((contract.sourceBindings ?? []).length !== boundPaths.size) errors.push('runtime truth source bindings contain duplicate paths');
  if (boundPaths.size !== closurePayload.paths.length) errors.push('runtime truth source binding set is not exactly the static repository-local dependency closure');
  for (const surface of contract.surfaces ?? []) {
    if (!surface?.id || !surface?.logicalPath || !boundPaths.has(surface?.source)) {
      errors.push(`runtime truth surface is not backed by a bound source: ${surface?.id ?? '<missing>'}`);
    }
  }

  return {
    ok: errors.length === 0,
    status: errors.length === 0
      ? 'RCL_FOUNDATION_RUNTIME_TRUTH_CONTRACT_VERIFIED'
      : 'RCL_FOUNDATION_RUNTIME_TRUTH_CONTRACT_FAILED',
    errors,
    contractRoot: contract.contractRoot ?? null,
    dependencyClosureRoot: closure.closureRoot ?? null,
    sourceBindingCount: Array.isArray(contract.sourceBindings) ? contract.sourceBindings.length : 0,
    dependencyEdgeCount: closurePayload.edges.length,
    surfaceCount: Array.isArray(contract.surfaces) ? contract.surfaces.length : 0,
  };
}

export const FOUNDATION_RUNTIME_TRUTH_SOURCE_BINDINGS = SOURCE_BINDING_SEEDS;
export const FOUNDATION_RUNTIME_TRUTH_SURFACES = RUNTIME_TRUTH_SURFACES;
