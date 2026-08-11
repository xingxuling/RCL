import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildRbc13WasmGraphGrowthCell,
} from '../src/rbc13-wasm-graph-growth-cell.mjs';
import {
  decodeRbc13WasmValue,
  encodeRbc13WasmValue,
  wasmAbiNegativeControls,
} from '../src/rbc13-wasm-organ-abi.mjs';

test('RBC13 WASM graph growth cell verifies JS/C/WASM parity and replay', () => {
  const report = buildRbc13WasmGraphGrowthCell();
  assert.equal(report.status, 'VERIFIED');
  assert.equal(report.nativeC.status, 'VERIFIED');
  assert.equal(report.wasm.status, 'VERIFIED');
  assert.equal(report.replay.status, 'VERIFIED');
  assert.equal(report.replay.crossBodyFirstReplayParity, true);
  assert.equal(report.cases.length, 7);
  assert.ok(report.cases.every(item => item.semanticRootParity && item.resultOrErrorParity && item.statusParity));
  assert.equal(report.hostAbi.canonicalPermission, false);
  assert.equal(report.wasmAbi.failClosed, true);
});

test('WASM value membrane round-trips bounded values and rejects ABI negatives', () => {
  const encoded = encodeRbc13WasmValue({ text: 'ok', truth: true, nested: [null, 2.5] });
  assert.deepEqual(decodeRbc13WasmValue(encoded).value, { text: 'ok', truth: true, nested: [null, 2.5] });
  assert.deepEqual(wasmAbiNegativeControls().map(item => item.detected), [true, true, true, true, true]);
});

