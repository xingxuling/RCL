import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRbc13UniversalGrowthCell } from '../src/rbc13-universal-growth-cell.mjs';

test('A12 records a distinct graph traversal candidate and fails closed without wasm-vm support', () => {
  const report = buildRbc13UniversalGrowthCell();
  assert.equal(report.workload.id, 'graph-traversal::bounded-reachability');
  assert.equal(report.growthProof.mainSuccessIsExistingFourOperation, false);
  assert.equal(report.native.status, 'VERIFIED');
  assert.equal(report.native.result.reachable, true);
  assert.equal(report.native.result.unreachable, false);
  assert.equal(report.native.replayVerified, true);
  assert.equal(report.executionClassification, 'experimental-native-semantic');
  assert.equal(report.status, 'BLOCKED');
  assert.equal(report.universalGrowthEligible, false);
  assert.equal(report.blockerClass, 'wasm-vm-runtime-and-abi-unsupported');
  assert.equal(report.wasmVmSupport.host.rclWasmVmAdapterPresent, false);
  assert.equal(report.wasmVmSupport.memoryValueAbi.status, 'BLOCKED');
  assert.equal(report.wasmVmSupport.semanticRoot.status, 'BLOCKED');
  assert.equal(report.growthCellReceipt, null);
});
