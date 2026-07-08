#!/usr/bin/env node
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { compileRealityToBytecode, decodeBytecode } from './bytecode.mjs';
import { runNativeBytecode } from './native-vm.mjs';
import { bootstrapCompilerStage5 } from './bootstrap.mjs';
import {
  BUNDLED_RNCS_CONTROL_PLANE_DIR,
  RCL_RNCS_FUSION_VERSION,
  resolveRclRncsControlPlaneDir,
  runRclRncsFusion,
} from './rncs-rcl-fusion.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PACKAGE_JSON_PATH = path.join(ROOT, 'package.json');
const DEFAULT_WORKBUDDY_RNCS_ROOT = path.resolve(
  ROOT,
  '..',
  'rncs-aetherworld',
  'RNCS_Aetherworld_Unified_v0.19.7-alpha.1_AetherEarth',
);
const RCL_TEXT_EXTENSIONS = new Set(['.rcl', '.mjs', '.js', '.json', '.md', '.txt', '.toml', '.rcltype']);
const SKIPPED_SCAN_DIRS = new Set(['.git', 'node_modules', 'build', 'output', 'dist', '.zig-cache', 'zig-cache']);

export const RCL_MCP_SERVER_NAME = 'rcl-rncs-mcp';
export const RCL_MCP_SERVER_VERSION = '0.1.0';
export const RCL_MCP_PROTOCOL_VERSION = '2025-06-18';
export const DEFAULT_RCL_MCP_PORT = 8765;
export const DEFAULT_RCL_MCP_PATH = '/mcp';

const MCP_INSTRUCTIONS = [
  'RCL/RNCS MCP exposes read-only verification and compilation tools for the local RCL repository.',
  'Prefer rncs_fusion_verify before making claims about RNCS integration.',
  'Self-hosting status is inventory-level unless a separate verification script is explicitly run outside this MCP server.',
].join(' ');

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readPackageJson() {
  return readJson(PACKAGE_JSON_PATH);
}

function readGitCommit() {
  const headPath = path.join(ROOT, '.git', 'HEAD');
  if (!fs.existsSync(headPath)) return null;
  const head = fs.readFileSync(headPath, 'utf8').trim();
  if (!head.startsWith('ref: ')) return head;
  const ref = head.slice(5);
  const refPath = path.join(ROOT, '.git', ...ref.split('/'));
  return fs.existsSync(refPath) ? fs.readFileSync(refPath, 'utf8').trim() : null;
}

function compactFusionResult(fusion, options = {}) {
  const result = fusion.result;
  const payload = {
    ok: fusion.ok,
    version: result.version,
    root: result.root,
    controlPlane: result.controlPlane,
    controlPlaneDir: result.controlPlaneDir,
    rncsFusionVersion: RCL_RNCS_FUSION_VERSION,
    rclModuleCount: result.rclModuleCount,
    semanticModuleCount: result.semanticModuleCount,
    edgeCount: result.edgeCount,
    allReady: result.allReady,
    allDeterministic: result.allDeterministic,
    allReferenceParity: result.allReferenceParity,
    evidenceCurrent: result.evidenceSummary.current,
    missingEdgeEvidence: result.evidenceSummary.missingEdgeEvidence,
    runtimeBundleReady: result.runtimeBundle.ready,
    runtimeBundleEvidenceParity: result.evidenceSummary.runtimeBundleEvidenceParity,
    stateRoot: result.stateRoot,
  };
  if (options.includeModules) payload.modules = result.modules;
  if (options.includeEdges) {
    payload.edges = result.edges.map(edge => ({
      from: edge.from,
      to: edge.to,
      targetHash: edge.targetHash,
      byteLength: edge.byteLength,
      irCount: edge.irCount,
      ready: edge.ready,
      deterministic: edge.deterministic,
      referenceParity: edge.referenceParity,
      evidenceParity: edge.evidence.byteParity,
    }));
  }
  if (options.includeRclSurface) payload.rclSurface = fusion.rclSurface;
  return payload;
}

function jsonTextResult(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return {
    content: [{ type: 'text', text }],
    structuredContent: typeof value === 'string' ? { text: value } : value,
  };
}

function bool(value, fallback = false) {
  return value === undefined ? fallback : value === true;
}

function numberInRange(value, fallback, min, max) {
  const number = Number(value ?? fallback);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(number)));
}

function resolveRncsRoot(args = {}) {
  return path.resolve(args.rncsRoot ?? process.env.RCL_RNCS_ROOT ?? DEFAULT_WORKBUDDY_RNCS_ROOT);
}

function resolveInside(baseDir, relativePath, label = 'path') {
  const base = path.resolve(baseDir);
  const target = path.resolve(base, String(relativePath ?? ''));
  if (target !== base && !target.startsWith(`${base}${path.sep}`)) {
    throw new Error(`${label} escapes allowed root: ${relativePath}`);
  }
  return target;
}

function isSafeTextFile(filePath) {
  return RCL_TEXT_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function readTextFileLimited(filePath, maxBytes = 256 * 1024) {
  const stats = fs.statSync(filePath);
  if (!stats.isFile()) throw new Error(`Not a file: ${filePath}`);
  if (stats.size > maxBytes) throw new Error(`File is too large; max ${maxBytes} bytes.`);
  if (!isSafeTextFile(filePath)) throw new Error(`Unsupported text extension: ${path.extname(filePath)}`);
  return fs.readFileSync(filePath, 'utf8');
}

function relativeFile(baseDir, filePath) {
  return path.relative(baseDir, filePath).replaceAll(path.sep, '/');
}

function listFiles(baseDir, options = {}) {
  const root = path.resolve(baseDir);
  const limit = numberInRange(options.limit, 100, 1, 1000);
  const maxDepth = numberInRange(options.maxDepth, 4, 0, 20);
  const extensions = options.extensions ? new Set(options.extensions) : null;
  const files = [];
  function walk(dir, depth) {
    if (files.length >= limit || depth > maxDepth) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (files.length >= limit) return;
      if (entry.isDirectory()) {
        if (!SKIPPED_SCAN_DIRS.has(entry.name)) walk(path.join(dir, entry.name), depth + 1);
      } else if (entry.isFile()) {
        const filePath = path.join(dir, entry.name);
        if (!extensions || extensions.has(path.extname(filePath).toLowerCase())) files.push(filePath);
      }
    }
  }
  if (fs.existsSync(root)) walk(root, 0);
  return files;
}

function fileSummary(baseDir, filePath) {
  const source = fs.readFileSync(filePath);
  return {
    file: relativeFile(baseDir, filePath),
    byteLength: source.length,
    sha256: sha256(source),
  };
}

function sourceSummary(source) {
  const buffer = Buffer.from(source, 'utf8');
  return {
    byteLength: buffer.length,
    lineCount: source.trim() ? source.trim().split(/\r?\n/).length : 0,
    sha256: sha256(buffer),
  };
}

function compileSourceSummary(source, args = {}) {
  const bytecode = compileRealityToBytecode(source);
  const decoded = decodeBytecode(bytecode);
  const payload = {
    ok: true,
    byteLength: bytecode.length,
    bytecodeSha256: sha256(bytecode),
    program: decoded.program,
    sourceRoot: decoded.sourceRoot,
    stringCount: decoded.strings.length,
    numberCount: decoded.numbers.length,
    instructionCount: decoded.instructions.length,
  };
  if (bool(args.runNative)) {
    const timeout = numberInRange(args.timeoutMs, 5000, 1000, 30000);
    const native = runNativeBytecode(bytecode, { timeout });
    payload.nativeRun = {
      status: native.status,
      state: native.state,
      projections: native.projections,
      historyLength: native.history?.length ?? 0,
    };
  }
  if (bool(args.includeBytecodeHex)) payload.bytecodeHex = bytecode.toString('hex');
  return payload;
}

function rclStatus() {
  const pkg = readPackageJson();
  const fusion = runRclRncsFusion();
  const nativeVmPath = path.join(ROOT, 'native', process.platform === 'win32' ? 'rclvm.exe' : 'rclvm');
  const tools = listRclMcpTools();
  return {
    package: { name: pkg.name, version: pkg.version, description: pkg.description },
    repo: { root: ROOT, commit: readGitCommit() },
    nativeVm: { path: nativeVmPath, exists: fs.existsSync(nativeVmPath) },
    rncsFusion: compactFusionResult(fusion),
    mcp: {
      name: RCL_MCP_SERVER_NAME,
      version: RCL_MCP_SERVER_VERSION,
      protocolVersion: RCL_MCP_PROTOCOL_VERSION,
      endpointPath: DEFAULT_RCL_MCP_PATH,
      toolCount: tools.length,
      rclToolCount: tools.filter(tool => tool.name.startsWith('rcl_')).length,
      rncsToolCount: tools.filter(tool => tool.name.startsWith('rncs_')).length,
    },
  };
}

function rclPackageMetadata() {
  const pkg = readPackageJson();
  return {
    name: pkg.name,
    version: pkg.version,
    description: pkg.description,
    license: pkg.license,
    type: pkg.type,
    exports: pkg.exports,
    bin: pkg.bin,
    engine: pkg.engines,
    scriptCount: Object.keys(pkg.scripts ?? {}).length,
    scripts: pkg.scripts,
  };
}

function rclNativeVmStatus() {
  const vmPath = path.join(ROOT, 'native', process.platform === 'win32' ? 'rclvm.exe' : 'rclvm');
  const exists = fs.existsSync(vmPath);
  const status = { path: vmPath, exists };
  if (exists) {
    const stats = fs.statSync(vmPath);
    status.byteLength = stats.size;
    status.sha256 = sha256(fs.readFileSync(vmPath));
    status.modifiedAt = stats.mtime.toISOString();
  }
  return status;
}

function rncsFusionVerify(args = {}) {
  const fusion = runRclRncsFusion({
    controlPlaneDir: args.controlPlaneDir ? path.resolve(String(args.controlPlaneDir)) : undefined,
  });
  return compactFusionResult(fusion, {
    includeModules: bool(args.includeModules),
    includeEdges: bool(args.includeEdges),
    includeRclSurface: bool(args.includeRclSurface),
  });
}

function rncsReadModule(args = {}) {
  const name = String(args.name ?? '');
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) throw new Error('Module name must contain only letters, numbers, underscores, or hyphens.');
  const includeSource = bool(args.includeSource, true);
  const controlPlaneDir = args.controlPlaneDir ? path.resolve(String(args.controlPlaneDir)) : resolveRclRncsControlPlaneDir();
  const filePath = path.join(controlPlaneDir, 'rcl', `${name}.rcl`);
  if (!fs.existsSync(filePath)) throw new Error(`RNCS RCL module not found: ${name}`);
  const source = fs.readFileSync(filePath, 'utf8');
  return {
    name,
    file: path.relative(controlPlaneDir, filePath).replaceAll(path.sep, '/'),
    controlPlaneDir,
    byteLength: Buffer.byteLength(source, 'utf8'),
    lineCount: source.trim() ? source.trim().split(/\r?\n/).length : 0,
    sourceSha256: sha256(Buffer.from(source, 'utf8')),
    source: includeSource ? source : undefined,
  };
}

function rclCompileSource(args = {}) {
  const source = String(args.source ?? '');
  const maxSourceBytes = 128 * 1024;
  if (!source.trim()) throw new Error('source is required.');
  if (Buffer.byteLength(source, 'utf8') > maxSourceBytes) throw new Error(`source is too large; max ${maxSourceBytes} bytes.`);
  return compileSourceSummary(source, args);
}

function rclCompileFile(args = {}) {
  const filePath = resolveInside(ROOT, args.file, 'file');
  const source = readTextFileLimited(filePath, 256 * 1024);
  return {
    file: relativeFile(ROOT, filePath),
    source: sourceSummary(source),
    compile: compileSourceSummary(source, args),
  };
}

function rclRunNativeSource(args = {}) {
  return rclCompileSource({ ...args, runNative: true });
}

function rclRunNativeFile(args = {}) {
  return rclCompileFile({ ...args, runNative: true });
}

function disassembleSource(source, args = {}) {
  const bytecode = compileRealityToBytecode(source);
  const decoded = decodeBytecode(bytecode);
  const limit = numberInRange(args.limitInstructions, 50, 1, 500);
  return {
    ok: true,
    byteLength: bytecode.length,
    bytecodeSha256: sha256(bytecode),
    program: decoded.program,
    sourceRoot: decoded.sourceRoot,
    stringCount: decoded.strings.length,
    numberCount: decoded.numbers.length,
    instructionCount: decoded.instructions.length,
    strings: bool(args.includePools) ? decoded.strings : undefined,
    numbers: bool(args.includePools) ? decoded.numbers : undefined,
    instructions: decoded.instructions.slice(0, limit),
    truncated: decoded.instructions.length > limit,
  };
}

function rclDisassembleSource(args = {}) {
  const source = String(args.source ?? '');
  if (!source.trim()) throw new Error('source is required.');
  return disassembleSource(source, args);
}

function rclDisassembleFile(args = {}) {
  const filePath = resolveInside(ROOT, args.file, 'file');
  const source = readTextFileLimited(filePath, 256 * 1024);
  return { file: relativeFile(ROOT, filePath), ...disassembleSource(source, args) };
}

function rclHashSource(args = {}) {
  const source = String(args.source ?? '');
  return { source: sourceSummary(source) };
}

function rclListExamples(args = {}) {
  const examplesDir = path.join(ROOT, 'examples');
  const files = listFiles(examplesDir, {
    extensions: new Set(['.rcl']),
    limit: numberInRange(args.limit, 100, 1, 500),
    maxDepth: numberInRange(args.maxDepth, 6, 0, 12),
  });
  return {
    examplesDir,
    count: files.length,
    examples: files.map(file => fileSummary(examplesDir, file)),
  };
}

function rclReadExample(args = {}) {
  const examplesDir = path.join(ROOT, 'examples');
  const filePath = resolveInside(examplesDir, args.file, 'example file');
  const source = readTextFileLimited(filePath, 256 * 1024);
  return {
    file: relativeFile(examplesDir, filePath),
    ...sourceSummary(source),
    source,
  };
}

function rclReadRepoFile(args = {}) {
  const filePath = resolveInside(ROOT, args.file, 'repo file');
  if (relativeFile(ROOT, filePath).startsWith('.git/')) throw new Error('Reading .git files through MCP is not allowed.');
  const maxBytes = numberInRange(args.maxBytes, 64 * 1024, 1, 512 * 1024);
  const source = readTextFileLimited(filePath, maxBytes);
  return {
    file: relativeFile(ROOT, filePath),
    ...sourceSummary(source),
    source,
  };
}

function rclSearchRepo(args = {}) {
  const query = String(args.query ?? '');
  if (query.length < 2) throw new Error('query must be at least 2 characters.');
  const limit = numberInRange(args.limit, 50, 1, 200);
  const files = listFiles(ROOT, {
    extensions: RCL_TEXT_EXTENSIONS,
    limit: 2000,
    maxDepth: numberInRange(args.maxDepth, 5, 0, 12),
  });
  const matches = [];
  for (const file of files) {
    if (matches.length >= limit) break;
    const source = fs.readFileSync(file, 'utf8');
    const lines = source.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      if (lines[index].includes(query)) {
        matches.push({ file: relativeFile(ROOT, file), line: index + 1, text: lines[index].slice(0, 500) });
        if (matches.length >= limit) break;
      }
    }
  }
  return { query, count: matches.length, matches };
}

function rclListBootstrapCompilers() {
  const bootstrapDir = path.join(ROOT, 'bootstrap');
  const files = listFiles(bootstrapDir, { extensions: new Set(['.rcl']), limit: 50, maxDepth: 1 });
  return {
    bootstrapDir,
    count: files.length,
    compilers: files.map(file => fileSummary(bootstrapDir, file)),
  };
}

function rclReadBootstrapCompiler(args = {}) {
  const stage = String(args.stage ?? '');
  const fileName = stage === 'seed' ? 'compiler-seed.rcl' : `compiler-stage${Number(stage)}.rcl`;
  if (stage !== 'seed' && !Number.isInteger(Number(stage))) throw new Error('stage must be "seed" or a number.');
  const filePath = resolveInside(path.join(ROOT, 'bootstrap'), fileName, 'bootstrap compiler');
  const source = readTextFileLimited(filePath, 512 * 1024);
  return { file: relativeFile(path.join(ROOT, 'bootstrap'), filePath), ...sourceSummary(source), source };
}

function rclBootstrapStage5Smoke(args = {}) {
  const result = bootstrapCompilerStage5({ write: false, nativeRuntime: args.nativeRuntime });
  return {
    ok: true,
    stage: result.stage,
    targetBytes: result.targetBytecode.length,
    deterministic: result.deterministic,
    referenceParity: result.referenceParity,
    irCount: result.ir.length,
    targetState: result.targetRun.state,
    boundary: result.boundary,
  };
}

function rclReadSelfhostSource(args = {}) {
  const selfhostDir = path.join(ROOT, 'selfhost');
  const filePath = resolveInside(selfhostDir, args.file, 'selfhost file');
  const source = readTextFileLimited(filePath, 512 * 1024);
  return { file: relativeFile(selfhostDir, filePath), ...sourceSummary(source), source };
}

function rclRncsFusionSurface(args = {}) {
  const fusion = runRclRncsFusion({
    controlPlaneDir: args.controlPlaneDir ? path.resolve(String(args.controlPlaneDir)) : undefined,
  });
  return {
    ok: fusion.ok,
    result: compactFusionResult(fusion, { includeEdges: bool(args.includeEdges) }),
    rclSurface: fusion.rclSurface,
  };
}

function selfhostInventory() {
  const scriptsDir = path.join(ROOT, 'scripts');
  const selfhostDir = path.join(ROOT, 'selfhost');
  const stageScripts = fs.readdirSync(scriptsDir)
    .map(name => /^verify-rcl-selfhost-stage(\d+)\.mjs$/.exec(name))
    .filter(Boolean)
    .map(match => Number(match[1]))
    .sort((left, right) => left - right);
  const selfhostFiles = fs.readdirSync(selfhostDir)
    .filter(name => name.endsWith('.rcl'))
    .sort();
  return {
    repoRoot: ROOT,
    maxStageScript: stageScripts.at(-1) ?? null,
    stageScripts,
    selfhostRclFileCount: selfhostFiles.length,
    selfhostRclFiles: selfhostFiles,
    boundary: 'Inventory only: this MCP tool does not claim full self-hosting. Run stage verification scripts separately for executable proof.',
  };
}

function rncsListModules(args = {}) {
  const controlPlaneDir = args.controlPlaneDir ? path.resolve(String(args.controlPlaneDir)) : resolveRclRncsControlPlaneDir();
  const rclDir = path.join(controlPlaneDir, 'rcl');
  const files = listFiles(rclDir, { extensions: new Set(['.rcl']), limit: 100, maxDepth: 1 });
  return {
    controlPlaneDir,
    count: files.length,
    modules: files.map(file => ({
      name: path.basename(file, '.rcl'),
      ...fileSummary(controlPlaneDir, file),
    })),
  };
}

function rncsControlPlaneEvidence(args = {}) {
  const controlPlaneDir = args.controlPlaneDir ? path.resolve(String(args.controlPlaneDir)) : resolveRclRncsControlPlaneDir();
  const evidencePath = path.join(controlPlaneDir, 'evidence', 'latest', 'control-plane.json');
  const evidence = readJson(evidencePath);
  return {
    file: relativeFile(controlPlaneDir, evidencePath),
    format: evidence.format,
    stage: evidence.stage,
    moduleCount: Object.keys(evidence.modules ?? {}).length,
    edgeCount: evidence.edges?.length ?? 0,
    allReady: evidence.allReady,
    allDeterministic: evidence.allDeterministic,
    allReferenceParity: evidence.allReferenceParity,
    stateRoot: evidence.stateRoot,
    runtimeBundle: evidence.runtimeBundle,
    modules: bool(args.includeModules) ? evidence.modules : undefined,
    edges: bool(args.includeEdges) ? evidence.edges : undefined,
  };
}

function rncsEdgeEvidence(args = {}) {
  const from = String(args.from ?? '');
  const to = String(args.to ?? '');
  if (!from || !to) throw new Error('from and to are required.');
  const controlPlaneDir = args.controlPlaneDir ? path.resolve(String(args.controlPlaneDir)) : resolveRclRncsControlPlaneDir();
  const evidence = readJson(path.join(controlPlaneDir, 'evidence', 'latest', 'control-plane.json'));
  const edge = (evidence.edges ?? []).find(item => item.from === from && item.to === to);
  if (!edge) throw new Error(`RNCS edge not found: ${from}->${to}`);
  const bytecodePath = path.join(controlPlaneDir, 'evidence', 'latest', `${from}-${to}.rbc`);
  return {
    edge: {
      from,
      to,
      targetHash: edge.targetHash,
      byteLength: edge.byteLength,
      deterministic: edge.deterministic,
      referenceParity: edge.referenceParity,
      irCount: edge.irCount,
      compilerVm: edge.compilerVm,
      targetState: bool(args.includeState) ? edge.targetState : undefined,
      dependencyState: bool(args.includeState) ? edge.dependencyState : undefined,
      moduleState: bool(args.includeState) ? edge.moduleState : undefined,
    },
    bytecode: fs.existsSync(bytecodePath) ? fileSummary(controlPlaneDir, bytecodePath) : null,
  };
}

function rncsRuntimeBundleStatus(args = {}) {
  const controlPlaneDir = args.controlPlaneDir ? path.resolve(String(args.controlPlaneDir)) : resolveRclRncsControlPlaneDir();
  const evidence = readJson(path.join(controlPlaneDir, 'evidence', 'latest', 'control-plane.json'));
  const bytecodePath = path.join(controlPlaneDir, 'evidence', 'latest', 'runtime-bundle.rbc');
  return {
    controlPlaneDir,
    runtimeBundle: evidence.runtimeBundle,
    bytecode: fs.existsSync(bytecodePath) ? fileSummary(controlPlaneDir, bytecodePath) : null,
  };
}

function rncsFullRepoStatus(args = {}) {
  const rncsRoot = resolveRncsRoot(args);
  const packagePath = path.join(rncsRoot, 'package.json');
  const changelogPath = path.join(rncsRoot, 'CHANGELOG.md');
  const status = {
    rncsRoot,
    exists: fs.existsSync(rncsRoot),
    package: fs.existsSync(packagePath) ? readJson(packagePath) : null,
    changelog: fs.existsSync(changelogPath) ? fileSummary(rncsRoot, changelogPath) : null,
    rsr: rncsRuntimeStatus('rsr', { rncsRoot }),
    vsr: rncsRuntimeStatus('vsr', { rncsRoot }),
  };
  return status;
}

function rncsRuntimePaths(kind, args = {}) {
  const rncsRoot = resolveRncsRoot(args);
  const runtimeDir = kind === 'vsr'
    ? path.join(rncsRoot, 'packages', 'world', 'visual-state-runtime')
    : path.join(rncsRoot, 'packages', 'world', 'reality-simulation-runtime');
  const gatewayRuntimePath = path.join(rncsRoot, 'packages', 'control', 'reality-one-gateway', 'runtimes', `${kind}.runtime.json`);
  const bridgePath = path.join(rncsRoot, 'packages', 'control', 'reality-one-gateway', 'src', 'bridges', `${kind}.bridge.mjs`);
  return { rncsRoot, runtimeDir, packagePath: path.join(runtimeDir, 'package.json'), gatewayRuntimePath, bridgePath };
}

function rncsRuntimeStatus(kind, args = {}) {
  const paths = rncsRuntimePaths(kind, args);
  const pkg = fs.existsSync(paths.packagePath) ? readJson(paths.packagePath) : null;
  const manifest = fs.existsSync(paths.gatewayRuntimePath) ? readJson(paths.gatewayRuntimePath) : null;
  const srcDir = kind === 'vsr'
    ? path.join(paths.runtimeDir, 'packages', 'spatial-reality-3d', 'src')
    : path.join(paths.runtimeDir, 'packages', 'spatial-embodiment', 'src');
  return {
    kind,
    rncsRoot: paths.rncsRoot,
    runtimeDir: paths.runtimeDir,
    package: pkg ? {
      name: pkg.name,
      version: pkg.version,
      description: pkg.description,
      scriptCount: Object.keys(pkg.scripts ?? {}).length,
      exports: pkg.exports,
    } : null,
    gatewayRuntime: manifest,
    bridge: fs.existsSync(paths.bridgePath) ? fileSummary(paths.rncsRoot, paths.bridgePath) : null,
    primarySource: fs.existsSync(srcDir) ? listFiles(srcDir, { extensions: new Set(['.ts', '.mjs', '.js']), limit: 20, maxDepth: 3 }).map(file => fileSummary(paths.rncsRoot, file)) : [],
  };
}

function rncsReadGatewayRuntime(args = {}) {
  const kind = String(args.kind ?? '').toLowerCase();
  if (!['rsr', 'vsr'].includes(kind)) throw new Error('kind must be "rsr" or "vsr".');
  const paths = rncsRuntimePaths(kind, args);
  const manifest = readJson(paths.gatewayRuntimePath);
  return {
    kind,
    file: relativeFile(paths.rncsRoot, paths.gatewayRuntimePath),
    manifest,
  };
}

function rncsVsrStatus(args = {}) {
  return rncsRuntimeStatus('vsr', args);
}

function rncsRsrStatus(args = {}) {
  return rncsRuntimeStatus('rsr', args);
}

function rncsVsrListExamples(args = {}) {
  const paths = rncsRuntimePaths('vsr', args);
  const examplesDir = path.join(paths.runtimeDir, 'examples');
  const outputDir = path.join(paths.runtimeDir, 'outputs');
  return {
    runtimeDir: paths.runtimeDir,
    examples: fs.existsSync(examplesDir) ? listFiles(examplesDir, { extensions: new Set(['.json']), limit: numberInRange(args.limit, 80, 1, 300), maxDepth: 4 }).map(file => fileSummary(paths.rncsRoot, file)) : [],
    outputs: fs.existsSync(outputDir) ? listFiles(outputDir, { extensions: new Set(['.json']), limit: numberInRange(args.outputLimit, 30, 1, 200), maxDepth: 4 }).map(file => fileSummary(paths.rncsRoot, file)) : [],
  };
}

function rncsRsrListSchemas(args = {}) {
  const paths = rncsRuntimePaths('rsr', args);
  const schemasDir = path.join(paths.runtimeDir, 'schemas');
  const distSchemasDir = path.join(paths.runtimeDir, 'dist', 'schemas');
  const targetDir = fs.existsSync(schemasDir) ? schemasDir : distSchemasDir;
  return {
    runtimeDir: paths.runtimeDir,
    schemasDir: targetDir,
    schemas: fs.existsSync(targetDir) ? listFiles(targetDir, { extensions: new Set(['.json']), limit: numberInRange(args.limit, 100, 1, 300), maxDepth: 2 }).map(file => fileSummary(paths.rncsRoot, file)) : [],
  };
}

export function listRclMcpTools() {
  return [
    {
      name: 'rcl_status',
      description: 'Summarize the local RCL repository, native VM, and current RNCS fusion verification state.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true },
    },
    {
      name: 'rcl_package_metadata',
      description: 'Read RCL package metadata, bins, scripts, exports, and engine constraints.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true },
    },
    {
      name: 'rcl_native_vm_status',
      description: 'Report native/rclvm binary presence, size, hash, and modification time.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true },
    },
    {
      name: 'rcl_list_examples',
      description: 'List RCL example .rcl files with hashes.',
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'number' },
          maxDepth: { type: 'number' },
        },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
    },
    {
      name: 'rcl_read_example',
      description: 'Read a file under examples/ by relative path.',
      inputSchema: {
        type: 'object',
        properties: { file: { type: 'string' } },
        required: ['file'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
    },
    {
      name: 'rncs_fusion_verify',
      description: 'Run the RCL/RNCS fusion verifier and report current module, edge, deterministic, native runtime, and evidence parity status.',
      inputSchema: {
        type: 'object',
        properties: {
          includeModules: { type: 'boolean', description: 'Include the RNCS module manifest in the result.' },
          includeEdges: { type: 'boolean', description: 'Include per-edge hashes, byte lengths, and evidence parity.' },
          includeRclSurface: { type: 'boolean', description: 'Include the generated RCL surface summary.' },
          controlPlaneDir: { type: 'string', description: 'Optional absolute or relative RNCS control-plane directory override.' },
        },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
    },
    {
      name: 'rncs_list_modules',
      description: 'List vendored RNCS control-plane RCL modules and source hashes.',
      inputSchema: {
        type: 'object',
        properties: { controlPlaneDir: { type: 'string' } },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
    },
    {
      name: 'rncs_read_module',
      description: 'Read a vendored RNCS RCL module such as core, rfe, gateway, aether_earth, runtime-base, or runtime-bundle.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'RNCS RCL module name without .rcl extension.' },
          includeSource: { type: 'boolean', description: 'Return full source text. Defaults to true.' },
          controlPlaneDir: { type: 'string', description: 'Optional RNCS control-plane directory override.' },
        },
        required: ['name'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
    },
    {
      name: 'rncs_control_plane_evidence',
      description: 'Read RNCS control-plane evidence JSON summary, optionally including modules or edges.',
      inputSchema: {
        type: 'object',
        properties: {
          includeModules: { type: 'boolean' },
          includeEdges: { type: 'boolean' },
          controlPlaneDir: { type: 'string' },
        },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
    },
    {
      name: 'rncs_edge_evidence',
      description: 'Read one RNCS control-plane edge evidence entry and its .rbc file hash.',
      inputSchema: {
        type: 'object',
        properties: {
          from: { type: 'string' },
          to: { type: 'string' },
          includeState: { type: 'boolean' },
          controlPlaneDir: { type: 'string' },
        },
        required: ['from', 'to'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
    },
    {
      name: 'rncs_runtime_bundle_status',
      description: 'Read RNCS runtime-bundle evidence and bytecode hash.',
      inputSchema: {
        type: 'object',
        properties: { controlPlaneDir: { type: 'string' } },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
    },
    {
      name: 'rcl_compile_source',
      description: 'Compile an RCL source string to RBC bytecode and optionally run it with the native RCL VM.',
      inputSchema: {
        type: 'object',
        properties: {
          source: { type: 'string', description: 'RCL source text to compile.' },
          runNative: { type: 'boolean', description: 'Run the compiled RBC with native/rclvm.exe. Defaults to false.' },
          timeoutMs: { type: 'number', description: 'Native VM timeout in milliseconds, clamped to 1000-30000.' },
        },
        required: ['source'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
    },
    {
      name: 'rcl_compile_file',
      description: 'Compile a repository file to RBC and optionally run it natively.',
      inputSchema: {
        type: 'object',
        properties: {
          file: { type: 'string' },
          runNative: { type: 'boolean' },
          timeoutMs: { type: 'number' },
          includeBytecodeHex: { type: 'boolean' },
        },
        required: ['file'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
    },
    {
      name: 'rcl_run_native_source',
      description: 'Compile an RCL source string and run it with the native VM.',
      inputSchema: {
        type: 'object',
        properties: {
          source: { type: 'string' },
          timeoutMs: { type: 'number' },
        },
        required: ['source'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
    },
    {
      name: 'rcl_run_native_file',
      description: 'Compile a repository RCL file and run it with the native VM.',
      inputSchema: {
        type: 'object',
        properties: {
          file: { type: 'string' },
          timeoutMs: { type: 'number' },
        },
        required: ['file'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
    },
    {
      name: 'rcl_disassemble_source',
      description: 'Compile source and return decoded RBC instruction metadata.',
      inputSchema: {
        type: 'object',
        properties: {
          source: { type: 'string' },
          limitInstructions: { type: 'number' },
          includePools: { type: 'boolean' },
        },
        required: ['source'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
    },
    {
      name: 'rcl_disassemble_file',
      description: 'Compile a repository file and return decoded RBC instruction metadata.',
      inputSchema: {
        type: 'object',
        properties: {
          file: { type: 'string' },
          limitInstructions: { type: 'number' },
          includePools: { type: 'boolean' },
        },
        required: ['file'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
    },
    {
      name: 'rcl_hash_source',
      description: 'Return byte length, line count, and sha256 for a source string.',
      inputSchema: {
        type: 'object',
        properties: { source: { type: 'string' } },
        required: ['source'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
    },
    {
      name: 'rcl_read_repo_file',
      description: 'Read a safe text file inside the RCL repository.',
      inputSchema: {
        type: 'object',
        properties: {
          file: { type: 'string' },
          maxBytes: { type: 'number' },
        },
        required: ['file'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
    },
    {
      name: 'rcl_search_repo',
      description: 'Search safe text files inside the RCL repository for a literal string.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          limit: { type: 'number' },
          maxDepth: { type: 'number' },
        },
        required: ['query'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
    },
    {
      name: 'rcl_list_bootstrap_compilers',
      description: 'List bootstrap compiler .rcl files and hashes.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true },
    },
    {
      name: 'rcl_read_bootstrap_compiler',
      description: 'Read compiler-seed.rcl or compiler-stageN.rcl source.',
      inputSchema: {
        type: 'object',
        properties: { stage: { type: 'string' } },
        required: ['stage'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
    },
    {
      name: 'rcl_bootstrap_stage5_smoke',
      description: 'Run the Stage5 compiler smoke proof: deterministic RCL-emitted RBC with reference parity.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true },
    },
    {
      name: 'rcl_selfhost_inventory',
      description: 'List available RCL self-hosting stage scripts and selfhost .rcl files without running them.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true },
    },
    {
      name: 'rcl_read_selfhost_source',
      description: 'Read a selfhost/*.rcl source file.',
      inputSchema: {
        type: 'object',
        properties: { file: { type: 'string' } },
        required: ['file'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
    },
    {
      name: 'rcl_rncs_fusion_surface',
      description: 'Return the generated RCL surface proving current RNCS fusion status.',
      inputSchema: {
        type: 'object',
        properties: {
          includeEdges: { type: 'boolean' },
          controlPlaneDir: { type: 'string' },
        },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
    },
    {
      name: 'rncs_full_repo_status',
      description: 'Summarize the full WorkBuddy RNCS repo, including VSR and RSR package/runtime status.',
      inputSchema: {
        type: 'object',
        properties: { rncsRoot: { type: 'string' } },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
    },
    {
      name: 'rncs_vsr_status',
      description: 'Report VSR package, gateway runtime manifest, bridge, and primary source status.',
      inputSchema: {
        type: 'object',
        properties: { rncsRoot: { type: 'string' } },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
    },
    {
      name: 'rncs_rsr_status',
      description: 'Report RSR package, gateway runtime manifest, bridge, and primary source status.',
      inputSchema: {
        type: 'object',
        properties: { rncsRoot: { type: 'string' } },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
    },
    {
      name: 'rncs_vsr_list_examples',
      description: 'List VSR example and output JSON files.',
      inputSchema: {
        type: 'object',
        properties: {
          rncsRoot: { type: 'string' },
          limit: { type: 'number' },
          outputLimit: { type: 'number' },
        },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
    },
    {
      name: 'rncs_rsr_list_schemas',
      description: 'List RSR schema JSON files from source or dist schemas.',
      inputSchema: {
        type: 'object',
        properties: {
          rncsRoot: { type: 'string' },
          limit: { type: 'number' },
        },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
    },
    {
      name: 'rncs_read_gateway_runtime',
      description: 'Read the RNCS gateway runtime manifest for VSR or RSR.',
      inputSchema: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: ['vsr', 'rsr'] },
          rncsRoot: { type: 'string' },
        },
        required: ['kind'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
    },
  ];
}

const TOOL_HANDLERS = Object.freeze({
  rcl_status: () => rclStatus(),
  rcl_package_metadata: () => rclPackageMetadata(),
  rcl_native_vm_status: () => rclNativeVmStatus(),
  rcl_list_examples: rclListExamples,
  rcl_read_example: rclReadExample,
  rncs_fusion_verify: rncsFusionVerify,
  rncs_list_modules: rncsListModules,
  rncs_read_module: rncsReadModule,
  rncs_control_plane_evidence: rncsControlPlaneEvidence,
  rncs_edge_evidence: rncsEdgeEvidence,
  rncs_runtime_bundle_status: rncsRuntimeBundleStatus,
  rcl_compile_source: rclCompileSource,
  rcl_compile_file: rclCompileFile,
  rcl_run_native_source: rclRunNativeSource,
  rcl_run_native_file: rclRunNativeFile,
  rcl_disassemble_source: rclDisassembleSource,
  rcl_disassemble_file: rclDisassembleFile,
  rcl_hash_source: rclHashSource,
  rcl_read_repo_file: rclReadRepoFile,
  rcl_search_repo: rclSearchRepo,
  rcl_list_bootstrap_compilers: () => rclListBootstrapCompilers(),
  rcl_read_bootstrap_compiler: rclReadBootstrapCompiler,
  rcl_bootstrap_stage5_smoke: rclBootstrapStage5Smoke,
  rcl_selfhost_inventory: () => selfhostInventory(),
  rcl_read_selfhost_source: rclReadSelfhostSource,
  rcl_rncs_fusion_surface: rclRncsFusionSurface,
  rncs_full_repo_status: rncsFullRepoStatus,
  rncs_vsr_status: rncsVsrStatus,
  rncs_rsr_status: rncsRsrStatus,
  rncs_vsr_list_examples: rncsVsrListExamples,
  rncs_rsr_list_schemas: rncsRsrListSchemas,
  rncs_read_gateway_runtime: rncsReadGatewayRuntime,
});

function jsonRpcResult(id, result) {
  return { jsonrpc: '2.0', id, result };
}

function jsonRpcError(id, code, message, data) {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message, data } };
}

export async function handleRclMcpMessage(message) {
  const id = Object.hasOwn(message, 'id') ? message.id : undefined;
  try {
    if (message.jsonrpc !== '2.0') return jsonRpcError(id, -32600, 'Invalid JSON-RPC version');
    if (!message.method) return jsonRpcError(id, -32600, 'Missing method');

    if (message.method === 'notifications/initialized') return undefined;
    if (message.method === 'initialize') {
      return jsonRpcResult(id, {
        protocolVersion: RCL_MCP_PROTOCOL_VERSION,
        capabilities: {
          tools: { listChanged: false },
          resources: {},
        },
        serverInfo: {
          name: RCL_MCP_SERVER_NAME,
          version: RCL_MCP_SERVER_VERSION,
        },
        instructions: MCP_INSTRUCTIONS,
      });
    }
    if (message.method === 'ping') return jsonRpcResult(id, {});
    if (message.method === 'tools/list') return jsonRpcResult(id, { tools: listRclMcpTools() });
    if (message.method === 'resources/list') return jsonRpcResult(id, { resources: [] });
    if (message.method === 'tools/call') {
      const name = String(message.params?.name ?? '');
      const handler = TOOL_HANDLERS[name];
      if (!handler) return jsonRpcError(id, -32602, `Unknown tool: ${name}`);
      const value = await handler(message.params?.arguments ?? {});
      return jsonRpcResult(id, jsonTextResult(value));
    }
    return jsonRpcError(id, -32601, `Method not found: ${message.method}`);
  } catch (error) {
    return jsonRpcError(id, -32000, error.message ?? String(error), { name: error.name });
  }
}

export async function handleRclMcpRequest(payload) {
  if (Array.isArray(payload)) {
    const responses = (await Promise.all(payload.map(item => handleRclMcpMessage(item)))).filter(Boolean);
    return responses.length ? responses : undefined;
  }
  return handleRclMcpMessage(payload);
}

function readRequestBody(request, maxBytes = 2 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let bytes = 0;
    request.on('data', chunk => {
      bytes += chunk.length;
      if (bytes > maxBytes) {
        reject(new Error(`Request body too large; max ${maxBytes} bytes.`));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    request.on('error', reject);
  });
}

function writeJson(response, status, value, sessionId) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type,mcp-session-id',
    'mcp-session-id': sessionId,
  });
  response.end(value === undefined ? '' : `${JSON.stringify(value)}\n`);
}

export function createRclMcpHttpServer(options = {}) {
  const endpointPath = options.path ?? DEFAULT_RCL_MCP_PATH;
  const sessionId = options.sessionId ?? `rcl-${crypto.randomUUID()}`;
  return http.createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    if (request.method === 'OPTIONS') {
      writeJson(response, 204, undefined, sessionId);
      return;
    }
    if (request.method === 'GET' && url.pathname === '/health') {
      writeJson(response, 200, { ok: true, name: RCL_MCP_SERVER_NAME, endpoint: endpointPath }, sessionId);
      return;
    }
    if (url.pathname !== endpointPath) {
      writeJson(response, 404, { error: 'not_found', endpoint: endpointPath }, sessionId);
      return;
    }
    if (request.method === 'GET') {
      writeJson(response, 200, {
        ok: true,
        name: RCL_MCP_SERVER_NAME,
        version: RCL_MCP_SERVER_VERSION,
        message: 'POST JSON-RPC 2.0 MCP requests to this endpoint.',
      }, sessionId);
      return;
    }
    if (request.method !== 'POST') {
      writeJson(response, 405, { error: 'method_not_allowed' }, sessionId);
      return;
    }
    try {
      const text = await readRequestBody(request);
      const payload = JSON.parse(text);
      const result = await handleRclMcpRequest(payload);
      if (result === undefined) {
        writeJson(response, 202, undefined, request.headers['mcp-session-id'] ?? sessionId);
      } else {
        writeJson(response, 200, result, request.headers['mcp-session-id'] ?? sessionId);
      }
    } catch (error) {
      writeJson(response, 400, jsonRpcError(null, -32700, error.message ?? String(error)), sessionId);
    }
  });
}

export function startRclMcpServer(options = {}) {
  const port = numberInRange(options.port, DEFAULT_RCL_MCP_PORT, 0, 65535);
  const host = options.host ?? '127.0.0.1';
  const server = createRclMcpHttpServer(options);
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      const address = server.address();
      resolve({
        server,
        host,
        port: typeof address === 'object' && address ? address.port : port,
        path: options.path ?? DEFAULT_RCL_MCP_PATH,
      });
    });
  });
}

function parseCliArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--host') options.host = argv[++index];
    else if (arg === '--port') options.port = Number(argv[++index]);
    else if (arg === '--path') options.path = argv[++index];
  }
  return options;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const options = parseCliArgs(process.argv.slice(2));
  const started = await startRclMcpServer(options);
  const url = `http://${started.host}:${started.port}${started.path}`;
  console.log(JSON.stringify({
    ok: true,
    name: RCL_MCP_SERVER_NAME,
    version: RCL_MCP_SERVER_VERSION,
    url,
    bundledControlPlaneDir: BUNDLED_RNCS_CONTROL_PLANE_DIR,
    note: 'Expose this /mcp URL over HTTPS before adding it as a ChatGPT connector.',
  }, null, 2));
}
