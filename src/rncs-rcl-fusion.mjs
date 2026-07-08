import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { bootstrapCompilerStage5 } from './bootstrap.mjs';
import { realityRoot } from './canonical.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

export const RCL_RNCS_FUSION_VERSION = '0.94.0-alpha.1';
export const RCL_RNCS_FUSION_RESULT_FORMAT = 'rcl.rncs-fusion-result.v0.94';
export const RCL_RNCS_FUSION_BUNDLE_FORMAT = 'rcl.rncs-fusion-bundle.v0.94';
export const BUNDLED_RNCS_CONTROL_PLANE_DIR = path.join(ROOT, 'examples', 'rncs-rcl-control-plane');
export const DEFAULT_WORKBUDDY_RNCS_CONTROL_PLANE_DIR = path.resolve(
  ROOT,
  '..',
  'rncs-aetherworld',
  'RNCS_Aetherworld_Unified_v0.19.7-alpha.1_AetherEarth',
  'packages',
  'control',
  'rncs-rcl-control-plane',
);

export const RNCS_CONTROL_PLANE_EDGES = Object.freeze([
  ['core', 'rfe'],
  ['rfe', 'aaf'],
  ['aaf', 'branch'],
  ['branch', 'behavior'],
  ['behavior', 'icar'],
  ['icar', 'cnp'],
  ['core', 'laf'],
  ['cnp', 'hnac'],
  ['laf', 'runtime_registry'],
  ['runtime_registry', 'gateway'],
  ['gateway', 'aether_earth'],
]);

export const RNCS_SEMANTIC_MODULES = Object.freeze([
  'core',
  'rfe',
  'aaf',
  'branch',
  'behavior',
  'icar',
  'cnp',
  'laf',
  'hnac',
  'runtime_registry',
  'gateway',
  'aether_earth',
]);

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalJson(value[key])]));
  }
  return value;
}

function canonicalSha256(value) {
  return sha256(Buffer.from(JSON.stringify(canonicalJson(value)), 'utf8'));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function assertFile(filePath, label) {
  if (!fs.existsSync(filePath)) throw new Error(`${label} is missing at ${filePath}`);
}

function relativeTo(baseDir, filePath) {
  return path.relative(baseDir, filePath).replaceAll(path.sep, '/');
}

function selectNamespace(state, namespace) {
  const prefix = `${namespace}::`;
  return Object.fromEntries(Object.entries(state).filter(([key]) => key.startsWith(prefix)));
}

function byteEvidence(controlPlaneDir, fileName, targetBytecode) {
  const evidencePath = path.join(controlPlaneDir, 'evidence', 'latest', fileName);
  const evidence = {
    file: relativeTo(controlPlaneDir, evidencePath),
    exists: fs.existsSync(evidencePath),
    byteParity: false,
  };
  if (!evidence.exists) return evidence;
  const bytes = fs.readFileSync(evidencePath);
  return {
    ...evidence,
    byteLength: bytes.length,
    sha256: sha256(bytes),
    byteParity: Buffer.from(targetBytecode).equals(bytes),
  };
}

export function resolveRclRncsControlPlaneDir(options = {}) {
  if (options.controlPlaneDir) return path.resolve(options.controlPlaneDir);
  if (process.env.RCL_RNCS_CONTROL_PLANE_DIR) return path.resolve(process.env.RCL_RNCS_CONTROL_PLANE_DIR);
  if (fs.existsSync(path.join(BUNDLED_RNCS_CONTROL_PLANE_DIR, 'rncs.module.json'))) return BUNDLED_RNCS_CONTROL_PLANE_DIR;
  return DEFAULT_WORKBUDDY_RNCS_CONTROL_PLANE_DIR;
}

export function readRncsRclModule(controlPlaneDir, name, options = {}) {
  const modulePath = path.join(controlPlaneDir, 'rcl', `${name}.rcl`);
  assertFile(modulePath, `RNCS RCL module ${name}`);
  const source = fs.readFileSync(modulePath, 'utf8').trim();
  if (!options.interfaceOnly) return source;
  return source
    .split(/\r?\n/)
    .filter(line => !/^(import|require)\s/.test(line.trim()))
    .join('\n');
}

export function scanRncsRclModules(options = {}) {
  const controlPlaneDir = resolveRclRncsControlPlaneDir(options);
  const rclDir = path.join(controlPlaneDir, 'rcl');
  assertFile(path.join(controlPlaneDir, 'rncs.module.json'), 'RNCS RCL control-plane manifest');
  if (!fs.existsSync(rclDir)) throw new Error(`RNCS RCL module directory is missing at ${rclDir}`);
  return fs.readdirSync(rclDir)
    .filter(file => file.endsWith('.rcl'))
    .sort((left, right) => left.localeCompare(right))
    .map(file => {
      const filePath = path.join(rclDir, file);
      const source = fs.readFileSync(filePath, 'utf8');
      const name = path.basename(file, '.rcl');
      return {
        name,
        file: relativeTo(controlPlaneDir, filePath),
        byteLength: Buffer.byteLength(source, 'utf8'),
        lineCount: source.trim() ? source.trim().split(/\r?\n/).length : 0,
        sourceSha256: sha256(Buffer.from(source, 'utf8')),
        semanticModule: RNCS_SEMANTIC_MODULES.includes(name),
        runtimeModule: name.startsWith('runtime-'),
      };
    });
}

export function compileRclRncsFusionEdge(from, to, options = {}) {
  const controlPlaneDir = resolveRclRncsControlPlaneDir(options);
  const compiled = bootstrapCompilerStage5({
    coreSource: readRncsRclModule(controlPlaneDir, from, { interfaceOnly: true }),
    appSource: readRncsRclModule(controlPlaneDir, to),
    program: options.program ?? `RNCSControl_${from}_${to}`,
    sourceRoot: options.sourceRoot ?? `rncs:rcl-control:${from}->${to}`,
    nativeRuntime: options.nativeRuntime,
  });
  const targetHash = sha256(compiled.targetBytecode);
  const edge = {
    from,
    to,
    targetHash,
    byteLength: compiled.targetBytecode.length,
    irCount: compiled.ir.length,
    deterministic: compiled.deterministic,
    referenceParity: compiled.referenceParity,
    targetState: compiled.targetRun.state,
    dependencyState: selectNamespace(compiled.targetRun.state, from),
    moduleState: selectNamespace(compiled.targetRun.state, to),
    ready: compiled.targetRun.state[`${to}::module.ready`] === true,
    compilerVm: compiled.compilerRun.vm ?? null,
    evidence: byteEvidence(controlPlaneDir, `${from}-${to}.rbc`, compiled.targetBytecode),
  };
  Object.defineProperty(edge, 'targetBytecode', { value: compiled.targetBytecode, enumerable: false });
  return edge;
}

export function compileRclRncsRuntimeBundle(options = {}) {
  const controlPlaneDir = resolveRclRncsControlPlaneDir(options);
  const compiled = bootstrapCompilerStage5({
    coreSource: readRncsRclModule(controlPlaneDir, 'runtime-base'),
    appSource: readRncsRclModule(controlPlaneDir, 'runtime-bundle'),
    program: options.program ?? 'RNCSControlPlaneAotBundle',
    sourceRoot: options.sourceRoot ?? 'rncs:rcl-control:aot-bundle',
    nativeRuntime: options.nativeRuntime,
  });
  const runtimeBundle = {
    targetHash: sha256(compiled.targetBytecode),
    byteLength: compiled.targetBytecode.length,
    deterministic: compiled.deterministic,
    referenceParity: compiled.referenceParity,
    targetState: compiled.targetRun.state,
    ready: RNCS_SEMANTIC_MODULES.every(name => compiled.targetRun.state[`rncs::${name}.ready`] === true)
      && compiled.targetRun.state['rncs::control.authoritative'] === true
      && compiled.targetRun.state['rncs::control.long_lived_vm'] === true,
    evidence: byteEvidence(controlPlaneDir, 'runtime-bundle.rbc', compiled.targetBytecode),
  };
  Object.defineProperty(runtimeBundle, 'targetBytecode', { value: compiled.targetBytecode, enumerable: false });
  return runtimeBundle;
}

function buildModuleManifest(state) {
  return Object.fromEntries(RNCS_SEMANTIC_MODULES.map(name => [name, {
    name,
    id: state[`${name}::module.id`],
    version: state[`${name}::module.version`],
    ready: state[`${name}::module.ready`] === true,
  }]));
}

function buildEvidenceControlPlane(controlPlaneDir) {
  const evidencePath = path.join(controlPlaneDir, 'evidence', 'latest', 'control-plane.json');
  if (!fs.existsSync(evidencePath)) return null;
  return readJson(evidencePath);
}

function compareEvidenceControlPlane(result, evidenceControlPlane) {
  if (!evidenceControlPlane) return { exists: false, edgeParity: false, moduleParity: false, stateRootParity: false, runtimeBundleParity: false };
  const evidenceEdges = new Map((evidenceControlPlane.edges ?? []).map(edge => [`${edge.from}->${edge.to}`, edge]));
  const edgeParity = result.edges.every(edge => {
    const evidenceEdge = evidenceEdges.get(`${edge.from}->${edge.to}`);
    return evidenceEdge
      && evidenceEdge.targetHash === edge.targetHash
      && evidenceEdge.byteLength === edge.byteLength
      && evidenceEdge.deterministic === edge.deterministic
      && evidenceEdge.referenceParity === edge.referenceParity;
  });
  const moduleParity = JSON.stringify(canonicalJson(result.modules)) === JSON.stringify(canonicalJson(evidenceControlPlane.modules ?? {}));
  const runtimeBundleParity = evidenceControlPlane.runtimeBundle?.targetHash === result.runtimeBundle.targetHash
    && evidenceControlPlane.runtimeBundle?.byteLength === result.runtimeBundle.byteLength;
  return {
    exists: true,
    format: evidenceControlPlane.format,
    stage: evidenceControlPlane.stage,
    edgeParity,
    moduleParity,
    stateRootParity: evidenceControlPlane.stateRoot === result.stateRoot,
    runtimeBundleParity,
  };
}

function summarizeEvidence(edges, runtimeBundle, controlPlaneEvidence) {
  const availableEdges = edges.filter(edge => edge.evidence.exists);
  const missingEdgeEvidence = edges
    .filter(edge => !edge.evidence.exists)
    .map(edge => `${edge.from}->${edge.to}`);
  const staleEdgeEvidence = availableEdges
    .filter(edge => !edge.evidence.byteParity)
    .map(edge => `${edge.from}->${edge.to}`);
  const availableEdgeEvidenceParity = availableEdges.every(edge => edge.evidence.byteParity);
  const current = missingEdgeEvidence.length === 0
    && staleEdgeEvidence.length === 0
    && runtimeBundle.evidence.exists
    && runtimeBundle.evidence.byteParity
    && controlPlaneEvidence.edgeParity
    && controlPlaneEvidence.moduleParity
    && controlPlaneEvidence.stateRootParity
    && controlPlaneEvidence.runtimeBundleParity;
  return {
    current,
    availableEdgeEvidenceCount: availableEdges.length,
    expectedEdgeEvidenceCount: edges.length,
    missingEdgeEvidence,
    staleEdgeEvidence,
    availableEdgeEvidenceParity,
    runtimeBundleEvidenceParity: runtimeBundle.evidence.exists && runtimeBundle.evidence.byteParity,
    controlPlaneJsonParity: {
      edges: controlPlaneEvidence.edgeParity,
      modules: controlPlaneEvidence.moduleParity,
      stateRoot: controlPlaneEvidence.stateRootParity,
      runtimeBundle: controlPlaneEvidence.runtimeBundleParity,
    },
  };
}

export function renderRclRncsFusionRcl(resultOrBundle) {
  const result = resultOrBundle.result ?? resultOrBundle;
  const edgeFacts = result.edges.map(edge => (
    `  facet fusion.edge_${edge.from}_${edge.to}_ready : Truth = ${edge.ready ? 'true' : 'false'}\n`
    + `  facet fusion.edge_${edge.from}_${edge.to}_evidence_parity : Truth = ${edge.evidence.byteParity ? 'true' : 'false'}`
  )).join('\n');
  return `reality RclRncsFusion {
  facet fusion.version : Text = ${JSON.stringify(RCL_RNCS_FUSION_VERSION)}
  facet fusion.control_plane_id : Text = ${JSON.stringify(result.controlPlane.id)}
  facet fusion.control_plane_version : Text = ${JSON.stringify(result.controlPlane.version)}
  facet fusion.module_count : Number = ${result.rclModuleCount}
  facet fusion.semantic_module_count : Number = ${result.semanticModuleCount}
  facet fusion.edge_count : Number = ${result.edgeCount}
  facet fusion.all_ready : Truth = ${result.allReady ? 'true' : 'false'}
  facet fusion.all_deterministic : Truth = ${result.allDeterministic ? 'true' : 'false'}
  facet fusion.all_reference_parity : Truth = ${result.allReferenceParity ? 'true' : 'false'}
  facet fusion.all_edge_evidence_parity : Truth = ${result.allEdgeEvidenceParity ? 'true' : 'false'}
  facet fusion.runtime_bundle_ready : Truth = ${result.runtimeBundle.ready ? 'true' : 'false'}
  facet fusion.runtime_bundle_evidence_parity : Truth = ${result.runtimeBundle.evidence.byteParity ? 'true' : 'false'}
  facet fusion.state_root : Text = ${JSON.stringify(result.stateRoot)}
  facet fusion.evidence_state_root_parity : Truth = ${result.controlPlaneEvidence.stateRootParity ? 'true' : 'false'}
  facet fusion.established : Truth = ${result.ok ? 'true' : 'false'}
${edgeFacts}
}
`;
}

export function runRclRncsFusion(options = {}) {
  const controlPlaneDir = resolveRclRncsControlPlaneDir(options);
  const manifestPath = path.join(controlPlaneDir, 'rncs.module.json');
  assertFile(manifestPath, 'RNCS RCL control-plane manifest');

  const controlPlaneManifest = readJson(manifestPath);
  const rclModules = scanRncsRclModules({ controlPlaneDir });
  const semanticModuleCount = rclModules.filter(module => module.semanticModule).length;
  const edges = RNCS_CONTROL_PLANE_EDGES.map(([from, to]) => compileRclRncsFusionEdge(from, to, { ...options, controlPlaneDir }));
  const runtimeBundle = compileRclRncsRuntimeBundle({ ...options, controlPlaneDir });
  const state = {
    ...edges[0].dependencyState,
    ...Object.assign({}, ...edges.map(edge => edge.moduleState)),
  };
  const modules = buildModuleManifest(state);
  const allReady = Object.values(modules).every(module => module.ready === true);
  const allDeterministic = edges.every(edge => edge.deterministic) && runtimeBundle.deterministic;
  const allReferenceParity = edges.every(edge => edge.referenceParity) && runtimeBundle.referenceParity;
  const allEdgeEvidenceParity = edges.every(edge => edge.evidence.exists && edge.evidence.byteParity);
  const allEdgeEvidencePresent = edges.every(edge => edge.evidence.exists);
  const stateRoot = canonicalSha256(state);
  const evidenceControlPlaneJson = buildEvidenceControlPlane(controlPlaneDir);
  const baseResult = {
    format: RCL_RNCS_FUSION_RESULT_FORMAT,
    version: RCL_RNCS_FUSION_VERSION,
    controlPlaneDir,
    controlPlane: {
      id: controlPlaneManifest.id,
      name: controlPlaneManifest.name,
      version: controlPlaneManifest.version,
      runtime: controlPlaneManifest.runtime,
      layer: controlPlaneManifest.layer,
    },
    rncsEvidenceFormat: evidenceControlPlaneJson?.format ?? null,
    rclModuleCount: rclModules.length,
    semanticModuleCount,
    runtimeModuleCount: rclModules.filter(module => module.runtimeModule).length,
    edgeCount: edges.length,
    modules,
    rclModules,
    edges,
    runtimeBundle,
    state,
    stateRoot,
    allReady,
    allDeterministic,
    allReferenceParity,
    allEdgeEvidenceParity,
    allEdgeEvidencePresent,
  };
  const controlPlaneEvidence = compareEvidenceControlPlane(baseResult, evidenceControlPlaneJson);
  const evidenceSummary = summarizeEvidence(edges, runtimeBundle, controlPlaneEvidence);
  const ok = controlPlaneManifest.id === 'rncs-rcl-control'
    && semanticModuleCount === RNCS_SEMANTIC_MODULES.length
    && edges.length === RNCS_CONTROL_PLANE_EDGES.length
    && allReady
    && allDeterministic
    && allReferenceParity
    && runtimeBundle.ready
    && evidenceSummary.availableEdgeEvidenceParity;
  const result = {
    ...baseResult,
    controlPlaneEvidence,
    evidenceSummary,
    ok,
    root: realityRoot({
      format: RCL_RNCS_FUSION_RESULT_FORMAT,
      controlPlane: baseResult.controlPlane,
      stateRoot,
      edgeHashes: edges.map(edge => edge.targetHash),
      runtimeBundleHash: runtimeBundle.targetHash,
    }),
  };
  return {
    format: RCL_RNCS_FUSION_BUNDLE_FORMAT,
    ok,
    controlPlaneDir,
    result,
    rclSurface: renderRclRncsFusionRcl(result),
  };
}

export function writeRclRncsFusionReports(outputDir = path.join(ROOT, 'build', 'rncs-rcl-fusion'), options = {}) {
  const bundle = runRclRncsFusion(options);
  fs.mkdirSync(outputDir, { recursive: true });
  const artifacts = {
    result: path.join(outputDir, 'result.json'),
    modules: path.join(outputDir, 'modules.json'),
    edges: path.join(outputDir, 'edges.json'),
    rclSurface: path.join(outputDir, 'rcl-rncs-fusion.rcl'),
  };
  fs.writeFileSync(artifacts.result, `${JSON.stringify(bundle.result, null, 2)}\n`);
  fs.writeFileSync(artifacts.modules, `${JSON.stringify(bundle.result.modules, null, 2)}\n`);
  fs.writeFileSync(artifacts.edges, `${JSON.stringify(bundle.result.edges, null, 2)}\n`);
  fs.writeFileSync(artifacts.rclSurface, bundle.rclSurface);
  return {
    ...bundle,
    outputDir,
    artifacts,
  };
}

export function runRclRncsFusionDemo(options = {}) {
  return writeRclRncsFusionReports(options.outputDir ?? path.join(ROOT, 'build', 'rncs-rcl-fusion'), options);
}
