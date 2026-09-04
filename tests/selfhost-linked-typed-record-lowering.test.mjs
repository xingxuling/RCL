import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { tryCompileReality } from '../src/compiler.mjs';
import { compileRealityToBytecode } from '../src/bytecode.mjs';
import { runNativeBytecode } from '../src/native-vm.mjs';
import {
  linkedRecordPlanFromTypedCompiler,
  renderRclLinkedRecordLowerer,
} from '../src/selfhost-linked-typed-record-lowering.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const TYPES = [fs.readFileSync(path.join(ROOT, 'examples/native-ai/types/tensor.rcltype'), 'utf8')];

function lower(source, facetPath) {
  const plan = linkedRecordPlanFromTypedCompiler(source, TYPES, facetPath);
  const lowererSource = renderRclLinkedRecordLowerer(plan);
  const lowererArtifact = Buffer.from(compileRealityToBytecode(lowererSource));
  const run = runNativeBytecode(lowererArtifact, { timeout: 60_000, maxBuffer: 32 * 1024 * 1024 });
  const actual = Buffer.from(run.state['target.rbc_bytes']);
  const reference = tryCompileReality(source, { typeModuleSources: TYPES });
  assert.equal(reference.ok, true, JSON.stringify(reference.diagnostics));
  const expected = Buffer.from(compileRealityToBytecode(reference.program));
  return { plan, run, actual, expected, lowererSource };
}

test('AI008 RCL-authored lowerer byte-matches linked Tensor record RBC', () => {
  const source = `reality T {
    facet tensor.a : tensor.Tensor = {
      shape: empty_sequence(), rank: 1, dtype: "f64", layout: "dense",
      strides: empty_sequence(), storageIdentity: "s", device: "cpu", gradientIdentity: "g"
    }
  }`;
  const result = lower(source, 'tensor.a');
  assert.deepEqual(result.actual, result.expected);
  assert.equal(result.plan.canonicalType, 'tensor::Tensor');
  assert.equal(result.plan.fields.length, 8);
  assert.equal(result.plan.boundary, 'LINKED_TYPED_RECORD_PLAN_FROM_EXISTING_TYPE_GRAPH_NOT_RAW_RCLTYPE_SELFHOST_PARSER');
});

test('AI008 same RCL lowerer handles a different linked Tensor-family record shape', () => {
  const source = `reality S {
    facet storage.a : tensor.CpuDenseStorage = {
      identity: "s2", backend: "rust-cpu", elementCount: 9
    }
  }`;
  const result = lower(source, 'storage.a');
  assert.deepEqual(result.actual, result.expected);
  assert.equal(result.plan.canonicalType, 'tensor::CpuDenseStorage');
  assert.equal(result.plan.fields.length, 3);
});

test('AI008 linked-plan formation fails closed for unsupported field expression kinds', () => {
  const source = `reality Bad {
    facet tensor.a : tensor.Tensor = {
      shape: sequence_append(empty_sequence(), 1), rank: 1, dtype: "f64", layout: "dense",
      strides: empty_sequence(), storageIdentity: "s", device: "cpu", gradientIdentity: "g"
    }
  }`;
  assert.throws(
    () => linkedRecordPlanFromTypedCompiler(source, TYPES, 'tensor.a'),
    /RCL_LINKED_RECORD_FIELD_UNSUPPORTED:shape/u,
  );
});
