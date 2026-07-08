import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  RCL_MCP_SERVER_NAME,
  handleRclMcpRequest,
  listRclMcpTools,
  startRclMcpServer,
} from '../src/rcl-mcp-server.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('RCL MCP server advertises core RCL and RNCS tools', () => {
  const tools = listRclMcpTools();
  const names = tools.map(tool => tool.name).sort();
  assert.deepEqual(names, [
    'rcl_compile_source',
    'rcl_selfhost_inventory',
    'rcl_status',
    'rncs_fusion_verify',
    'rncs_read_module',
  ]);
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
