#!/usr/bin/env node
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { compileRealityToBytecode, decodeBytecode } from './bytecode.mjs';
import { runNativeBytecode } from './native-vm.mjs';
import {
  BUNDLED_RNCS_CONTROL_PLANE_DIR,
  RCL_RNCS_FUSION_VERSION,
  resolveRclRncsControlPlaneDir,
  runRclRncsFusion,
} from './rncs-rcl-fusion.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PACKAGE_JSON_PATH = path.join(ROOT, 'package.json');

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

function rclStatus() {
  const pkg = readPackageJson();
  const fusion = runRclRncsFusion();
  const nativeVmPath = path.join(ROOT, 'native', process.platform === 'win32' ? 'rclvm.exe' : 'rclvm');
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
    },
  };
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
  return payload;
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

export function listRclMcpTools() {
  return [
    {
      name: 'rcl_status',
      description: 'Summarize the local RCL repository, native VM, and current RNCS fusion verification state.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
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
      name: 'rcl_selfhost_inventory',
      description: 'List available RCL self-hosting stage scripts and selfhost .rcl files without running them.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true },
    },
  ];
}

const TOOL_HANDLERS = Object.freeze({
  rcl_status: () => rclStatus(),
  rncs_fusion_verify: rncsFusionVerify,
  rncs_read_module: rncsReadModule,
  rcl_compile_source: rclCompileSource,
  rcl_selfhost_inventory: () => selfhostInventory(),
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
