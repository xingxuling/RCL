import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import {
  RCL_MCP_SERVER_NAME,
  handleRclMcpRequest,
  listRclMcpTools,
  startRclMcpServer,
} from '../src/rcl-mcp-server.mjs';
import mcpHandler from '../api/mcp.mjs';
import healthHandler from '../api/health.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('RCL MCP server advertises core RCL and RNCS tools', () => {
  const tools = listRclMcpTools();
  const names = tools.map(tool => tool.name).sort();
  const rclTools = names.filter(name => name.startsWith('rcl_'));
  const rncsTools = names.filter(name => name.startsWith('rncs_'));
  assert.ok(names.length >= 25, `expected at least 25 MCP tools, got ${names.length}`);
  assert.ok(rclTools.length > rncsTools.length, `expected RCL to expose the most tools; RCL=${rclTools.length}, RNCS=${rncsTools.length}`);
  assert.ok(names.includes('rncs_vsr_status'));
  assert.ok(names.includes('rncs_rsr_status'));
  assert.ok(names.includes('rcl_bootstrap_stage5_smoke'));
  assert.ok(names.includes('rcl_disassemble_source'));
  assert.ok(tools.every(tool => tool.inputSchema?.type === 'object'));
});

test('RCL MCP JSON-RPC initialize, tools/list, and tools/call work', async () => {
  const initialize = await handleRclMcpRequest({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
  assert.equal(initialize.result.serverInfo.name, RCL_MCP_SERVER_NAME);
  assert.equal(initialize.result.capabilities.tools.listChanged, false);

  const listed = await handleRclMcpRequest({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
  assert.ok(listed.result.tools.some(tool => tool.name === 'rncs_fusion_verify'));

  const fusion = await handleRclMcpRequest({
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: { name: 'rncs_fusion_verify', arguments: { includeEdges: true } },
  });
  assert.equal(fusion.result.structuredContent.ok, true);
  assert.equal(fusion.result.structuredContent.edgeCount, 11);
  assert.equal(fusion.result.structuredContent.evidenceCurrent, true);
  assert.equal(fusion.result.structuredContent.edges.length, 11);

  const module = await handleRclMcpRequest({
    jsonrpc: '2.0',
    id: 4,
    method: 'tools/call',
    params: { name: 'rncs_read_module', arguments: { name: 'aether_earth', includeSource: false } },
  });
  assert.equal(module.result.structuredContent.name, 'aether_earth');
  assert.equal(module.result.structuredContent.source, undefined);

  const vsr = await handleRclMcpRequest({
    jsonrpc: '2.0',
    id: 7,
    method: 'tools/call',
    params: { name: 'rncs_vsr_status', arguments: {} },
  });
  assert.equal(vsr.result.structuredContent.kind, 'vsr');
  assert.equal(vsr.result.structuredContent.package.name, '@taowind/visual-state-runtime');
  assert.equal(vsr.result.structuredContent.gatewayRuntime.runtime_id, 'rncs.vsr');

  const rsr = await handleRclMcpRequest({
    jsonrpc: '2.0',
    id: 8,
    method: 'tools/call',
    params: { name: 'rncs_rsr_status', arguments: {} },
  });
  assert.equal(rsr.result.structuredContent.kind, 'rsr');
  assert.equal(rsr.result.structuredContent.package.name, '@taowind/reality-simulation-runtime');
  assert.equal(rsr.result.structuredContent.gatewayRuntime.runtime_id, 'rncs.rsr');
});

test('RCL MCP compile tool compiles and native-runs RCL source', async () => {
  const source = fs.readFileSync(path.join(ROOT, 'examples', 'hello-reality.rcl'), 'utf8');
  const compiled = await handleRclMcpRequest({
    jsonrpc: '2.0',
    id: 5,
    method: 'tools/call',
    params: { name: 'rcl_compile_source', arguments: { source, runNative: true, timeoutMs: 5000 } },
  });
  assert.equal(compiled.result.structuredContent.ok, true);
  assert.ok(compiled.result.structuredContent.byteLength > 36);
  assert.equal(compiled.result.structuredContent.nativeRun.status, 'ok');
  assert.equal(compiled.result.structuredContent.nativeRun.state['world.greeting'], 'Hello, reality.');

  const examples = await handleRclMcpRequest({
    jsonrpc: '2.0',
    id: 9,
    method: 'tools/call',
    params: { name: 'rcl_list_examples', arguments: { limit: 10 } },
  });
  assert.ok(examples.result.structuredContent.count >= 1);

  const disassembled = await handleRclMcpRequest({
    jsonrpc: '2.0',
    id: 10,
    method: 'tools/call',
    params: { name: 'rcl_disassemble_source', arguments: { source, limitInstructions: 4 } },
  });
  assert.equal(disassembled.result.structuredContent.ok, true);
  assert.ok(disassembled.result.structuredContent.instructions.length <= 4);
});

test('RCL MCP HTTP server accepts JSON-RPC POST requests', async () => {
  const started = await startRclMcpServer({ port: 0 });
  try {
    const response = await fetch(`http://${started.host}:${started.port}${started.path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 6, method: 'tools/list', params: {} }),
    });
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.ok(payload.result.tools.some(tool => tool.name === 'rcl_status'));
  } finally {
    await new Promise(resolve => started.server.close(resolve));
  }
});

test('Vercel API handlers expose health and MCP POST endpoints', async () => {
  const server = http.createServer((request, response) => {
    if (request.url?.startsWith('/health')) return healthHandler(request, response);
    return mcpHandler(request, response);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try {
    const health = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(health.status, 200);
    const healthPayload = await health.json();
    assert.equal(healthPayload.toolCount, 32);

    const response = await fetch(`http://127.0.0.1:${port}/api/mcp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 11, method: 'tools/list', params: {} }),
    });
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.result.tools.length, 32);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
