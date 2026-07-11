import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_DEBUG_REPLAY_SOURCE,
  DEFAULT_DEBUG_REPLAY_TYPE_MODULES,
  RCL_IDE_BRIDGE_VERSION,
  RCL_LSP_INDEX_FORMAT,
  RCL_LSP_QUERY_REPORT_FORMAT,
  RCL_DAP_BRIDGE_FORMAT,
  RCL_IDE_BRIDGE_REPORT_FORMAT,
  buildLspIndex,
  queryLspIndex,
  runDebugSession,
  buildDapBridge,
  buildIdeBridge,
  writeLspIndexReports,
  writeIdeBridgeReports,
  runLspDemo,
  runDapDemo,
} from '../src/index.mjs';

const PACKAGE_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function tmpdir(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `rcl-${name}-`));
}

const DEBUG_CONFIG = {
  stopOnEntry: true,
  breakpoints: [
    { id: 'bp-session', kind: 'facet', facet: 'app.session' },
    { id: 'bp-login-ref-semantic', kind: 'semantic-node', semanticNodeId: 'facet:app.loginRef' },
  ],
  watchExpressions: [
    { id: 'watch-session', kind: 'facet', facet: 'app.session' },
  ],
};

test('P4.3 LSP Index builds source-map-backed symbols, hovers, definitions and semantic tokens', () => {
  const result = buildLspIndex({ source: DEFAULT_DEBUG_REPLAY_SOURCE, typeModuleSources: DEFAULT_DEBUG_REPLAY_TYPE_MODULES, sourceFile: 'examples/debug-replay/src/app.rcl' });
  assert.equal(result.ok, true);
  const index = result.lspIndex;
  assert.equal(index.format, RCL_LSP_INDEX_FORMAT);
  assert.equal(index.version, RCL_IDE_BRIDGE_VERSION);
  assert.equal(index.capabilities.hoverProvider, true);
  assert.equal(index.capabilities.definitionProvider, true);
  assert.equal(index.capabilities.semanticTokensProvider, true);
  assert.ok(index.documentSymbols.some(symbol => symbol.name === 'app.session'));
  assert.ok(index.workspaceSymbols.some(symbol => symbol.name === 'app.payloadViaRef'));
  assert.ok(index.semanticTokens.data.length > 0);
  assert.equal(index.hoverIndex['app.session'].contents.kind, 'markdown');
  assert.equal(index.definitionIndex['app.loginRef'].uri.startsWith('file://') || index.definitionIndex['app.loginRef'].uri.startsWith('rcl://'), true);
  assert.ok(index.indexRoot);
});

test('P4.3 LSP Query reports are deterministic and cover hover, definition, symbols, diagnostics and completion', () => {
  const { lspIndex } = buildLspIndex({ source: DEFAULT_DEBUG_REPLAY_SOURCE, typeModuleSources: DEFAULT_DEBUG_REPLAY_TYPE_MODULES });
  const hoverA = queryLspIndex(lspIndex, { kind: 'hover', facet: 'app.session' });
  const hoverB = queryLspIndex(JSON.parse(JSON.stringify(lspIndex)), { kind: 'hover', facet: 'app.session' });
  assert.equal(hoverA.format, RCL_LSP_QUERY_REPORT_FORMAT);
  assert.equal(hoverA.ok, true);
  assert.equal(hoverA.queryRoot, hoverB.queryRoot);
  const definition = queryLspIndex(lspIndex, { kind: 'definition', semanticNodeId: 'facet:app.loginRef' });
  assert.equal(definition.ok, true);
  const symbols = queryLspIndex(lspIndex, { kind: 'documentSymbols' });
  assert.equal(symbols.result.length, lspIndex.documentSymbols.length);
  const diagnostics = queryLspIndex(lspIndex, { kind: 'diagnostics' });
  assert.deepEqual(diagnostics.result, []);
  const completion = queryLspIndex(lspIndex, { kind: 'completion', prefix: 'app.' });
  assert.ok(completion.result.some(item => item.label === 'app.session'));
});

test('P4.3 LSP Index emits diagnostic-only reports for invalid source', () => {
  const result = buildLspIndex({ source: 'reality Bad { facet x : Missing = 1 }', typeModuleSources: {} });
  assert.equal(result.ok, false);
  assert.equal(result.lspIndex.format, RCL_LSP_INDEX_FORMAT);
  assert.equal(result.lspIndex.capabilities.diagnosticsProvider, true);
  assert.equal(result.lspIndex.capabilities.hoverProvider, false);
  assert.ok(result.lspIndex.diagnostics.length >= 1);
  const diagnosticReport = queryLspIndex(result.lspIndex, { kind: 'diagnostics' });
  assert.ok(diagnosticReport.result.some(item => item.code === 'RCL_TYPE_REFERENCE_MISSING'));
});

test('P4.3 DAP Bridge exposes trace-backed initialize, breakpoints, stack, scopes, variables and step plan', () => {
  const sessionResult = runDebugSession({ source: DEFAULT_DEBUG_REPLAY_SOURCE, typeModuleSources: DEFAULT_DEBUG_REPLAY_TYPE_MODULES, debugConfig: DEBUG_CONFIG }, { debugConfig: DEBUG_CONFIG });
  assert.equal(sessionResult.ok, true);
  const bridge = buildDapBridge(sessionResult.session);
  assert.equal(bridge.format, RCL_DAP_BRIDGE_FORMAT);
  assert.equal(bridge.version, RCL_IDE_BRIDGE_VERSION);
  assert.equal(bridge.capabilities.adapterID, 'rcl-dap-bridge-seed');
  assert.ok(bridge.stackFrames.length > 0);
  assert.ok(bridge.breakpoints.length >= 2);
  assert.ok(bridge.variables.some(item => item.name === 'app.session'));
  assert.ok(bridge.messages.some(item => item.command === 'stackTrace'));
  assert.ok(bridge.stepRequestPlan.some(item => item.command === 'next'));
  assert.ok(bridge.bridgeRoot);
});

test('P4.3 IDE Bridge links LSP, DAP, profiler, replay and debug UI roots', () => {
  const result = buildIdeBridge({ source: DEFAULT_DEBUG_REPLAY_SOURCE, typeModuleSources: DEFAULT_DEBUG_REPLAY_TYPE_MODULES, debugConfig: DEBUG_CONFIG }, { debugConfig: DEBUG_CONFIG });
  assert.equal(result.ok, true);
  assert.equal(result.ideBridgeReport.format, RCL_IDE_BRIDGE_REPORT_FORMAT);
  assert.equal(result.ideBridgeReport.lspIndexRoot, result.lspIndex.indexRoot);
  assert.equal(result.ideBridgeReport.dapBridgeRoot, result.dapBridge.bridgeRoot);
  assert.equal(result.ideBridgeReport.debugUiProtocolRoot, result.debugUiProtocol.protocolRoot);
  assert.equal(result.ideBridgeReport.profilerRoot, result.profiler.profilerRoot);
  assert.equal(result.ideBridgeReport.replayBundleRoot, result.replayBundle.bundleRoot);
  assert.equal(result.ideBridgeReport.capabilities.liveLspServer, false);
  assert.equal(result.ideBridgeReport.capabilities.liveDapServer, false);
});

test('P4.3 lsp-index and lsp-query CLI write verifiable JSON reports', () => {
  const out = tmpdir('lsp-index');
  const queryOut = tmpdir('lsp-query');
  const sourcePath = path.join(PACKAGE_ROOT, 'examples', 'debug-replay', 'src', 'app.rcl');
  const typePath = path.join(PACKAGE_ROOT, 'examples', 'debug-replay', 'types');
  const run = spawnSync(process.execPath, [path.join(PACKAGE_ROOT, 'src', 'cli.mjs'), 'lsp-index', sourcePath, typePath, out], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  const payload = JSON.parse(run.stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.format, RCL_LSP_INDEX_FORMAT);
  assert.equal(fs.existsSync(path.join(out, 'lsp-index.json')), true);
  assert.equal(fs.existsSync(path.join(out, 'lsp-document-symbols.json')), true);
  const query = spawnSync(process.execPath, [path.join(PACKAGE_ROOT, 'src', 'cli.mjs'), 'lsp-query', path.join(out, 'lsp-index.json'), 'hover:app.session', queryOut], { encoding: 'utf8' });
  assert.equal(query.status, 0, query.stderr);
  const queryPayload = JSON.parse(query.stdout);
  assert.equal(queryPayload.format, RCL_LSP_QUERY_REPORT_FORMAT);
  assert.equal(queryPayload.ok, true);
  assert.equal(fs.existsSync(path.join(queryOut, 'lsp-query-report.json')), true);
});

test('P4.3 dap-bridge CLI writes DAP-shaped bridge and message transcript', () => {
  const sessionOut = tmpdir('debug-session-for-dap');
  const dapOut = tmpdir('dap-bridge');
  const sourcePath = path.join(PACKAGE_ROOT, 'examples', 'debug-replay', 'src', 'app.rcl');
  const typePath = path.join(PACKAGE_ROOT, 'examples', 'debug-replay', 'types');
  const configPath = path.join(PACKAGE_ROOT, 'examples', 'debug-session', 'debug-config.json');
  const session = spawnSync(process.execPath, [path.join(PACKAGE_ROOT, 'src', 'cli.mjs'), 'debug-session-run', sourcePath, typePath, sessionOut, configPath], { encoding: 'utf8' });
  assert.equal(session.status, 0, session.stderr);
  const run = spawnSync(process.execPath, [path.join(PACKAGE_ROOT, 'src', 'cli.mjs'), 'dap-bridge', path.join(sessionOut, 'debug-session.json'), dapOut], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  const payload = JSON.parse(run.stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.format, RCL_DAP_BRIDGE_FORMAT);
  assert.equal(fs.existsSync(path.join(dapOut, 'dap-bridge.json')), true);
  assert.equal(fs.existsSync(path.join(dapOut, 'dap-messages.json')), true);
  assert.ok(payload.stackFrameCount > 0);
});

test('P4.3 ide-bridge CLI writes linked LSP/DAP/debug evidence reports', () => {
  const out = tmpdir('ide-bridge');
  const sourcePath = path.join(PACKAGE_ROOT, 'examples', 'debug-replay', 'src', 'app.rcl');
  const typePath = path.join(PACKAGE_ROOT, 'examples', 'debug-replay', 'types');
  const configPath = path.join(PACKAGE_ROOT, 'examples', 'debug-session', 'debug-config.json');
  const run = spawnSync(process.execPath, [path.join(PACKAGE_ROOT, 'src', 'cli.mjs'), 'ide-bridge', sourcePath, typePath, out, configPath], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  const payload = JSON.parse(run.stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.format, RCL_IDE_BRIDGE_REPORT_FORMAT);
  for (const file of ['lsp-index.json', 'dap-bridge.json', 'debug-ui-protocol.json', 'profiler-report.json', 'replay-input-bundle.json', 'ide-bridge-report.json']) {
    assert.equal(fs.existsSync(path.join(out, file)), true, file);
  }
  assert.ok(payload.lspIndexRoot);
  assert.ok(payload.dapBridgeRoot);
  assert.ok(payload.ideBridgeRoot);
});

test('P4.3 lsp-demo and dap-demo return compact bridge evidence', () => {
  const lspDemo = runLspDemo();
  assert.equal(lspDemo.ok, true);
  assert.equal(lspDemo.version, RCL_IDE_BRIDGE_VERSION);
  assert.equal(lspDemo.format, RCL_LSP_INDEX_FORMAT);
  assert.ok(lspDemo.symbolCount > 0);
  assert.ok(lspDemo.semanticTokenCount > 0);
  const dapDemo = runDapDemo();
  assert.equal(dapDemo.ok, true);
  assert.equal(dapDemo.format, RCL_DAP_BRIDGE_FORMAT);
  assert.ok(dapDemo.stackFrameCount > 0);
  assert.ok(dapDemo.messageCount >= 8);
});
