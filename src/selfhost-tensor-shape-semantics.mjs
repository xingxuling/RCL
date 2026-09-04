import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { compileSourceSelfHosted } from './selfhost-compiler.mjs';
import { runNativeBytecode } from './native-vm.mjs';
import { canonicalJson, evidenceRoot } from './universal-program-stress.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const SELFHOST_TENSOR_SHAPE_SEMANTICS_PATH = path.join(
  ROOT,
  'examples',
  'native-ai',
  'tensor-shape-semantics-genome.rcl',
);
export const SELFHOST_TENSOR_SHAPE_SEMANTICS_FORMAT = 'rcl.selfhost.tensor-shape-semantics.v0.1';

const TENSORS_MARKER = '  reckon default_tensors() -> Sequence = empty_sequence()';
const OPERATIONS_MARKER = '  reckon default_operations() -> Sequence = empty_sequence()';
const OUTPUTS_MARKER = '  reckon default_outputs() -> Sequence = empty_sequence()';
const DTYPES_MARKER = '  reckon default_dtypes() -> Sequence = sequence_append(sequence_append(sequence_append(empty_sequence(), "f64"), "f32"), "bf16")';
const MODEL_SOURCE_MARKER = '  facet binding.model_source_sha256 : Text = ""';
const CONTRACT_ROOT_MARKER = '  facet binding.contract_root : Text = ""';
const MANIFEST_MARKER = '  facet binding.manifest_canonical : Text = "{}"';
const MANIFEST_ROOT_MARKER = '  facet binding.manifest_root : Text = ""';

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function textLiteral(value) {
  return JSON.stringify(String(value));
}

function integer(value, fallback, field) {
  const candidate = value ?? fallback;
  if (!Number.isSafeInteger(candidate)) throw new Error(`RCL_AI001_INTEGER_REQUIRED:${field}`);
  return candidate;
}

function numberLiteral(value, field) {
  return String(integer(value, 0, field));
}

function sequenceLiteral(values, render) {
  let expression = 'empty_sequence()';
  for (const value of values) expression = `sequence_append(${expression}, ${render(value)})`;
  return expression;
}

function numberSequence(values, field) {
  return sequenceLiteral(values, (value) => numberLiteral(value, field));
}

function normalizeTensor(value = {}, field = 'tensor') {
  const shape = Array.isArray(value.shape) ? value.shape.map((item) => integer(item, 0, `${field}.shape`)) : [];
  const strides = Array.isArray(value.strides) ? value.strides.map((item) => integer(item, 0, `${field}.strides`)) : [];
  return {
    id: String(value.id ?? ''),
    shape,
    strides,
    dtype: String(value.dtype ?? ''),
    layout: String(value.layout ?? ''),
    device: String(value.device ?? ''),
    storageIdentity: String(value.storageIdentity ?? value.storage ?? ''),
    elementCount: integer(value.elementCount, 0, `${field}.elementCount`),
  };
}

function normalizeOperation(value = {}, index) {
  const output = value.output && typeof value.output === 'object' ? value.output : {};
  return {
    id: String(value.id ?? ''),
    kind: String(value.kind ?? value.operation ?? ''),
    inputs: Array.isArray(value.inputs) ? value.inputs.map((item) => String(item)) : [],
    output: normalizeTensor(output, `operations[${index}].output`),
    axis: integer(value.axis, 0, `operations[${index}].axis`),
  };
}

export function normalizeTensorShapeSemantics(input = {}, bindings = {}) {
  const tensors = Array.isArray(input.tensors)
    ? input.tensors.map((tensor, index) => normalizeTensor(tensor, `tensors[${index}]`))
    : [];
  const operations = Array.isArray(input.operations)
    ? input.operations.map((operation, index) => normalizeOperation(operation, index))
    : [];
  const dtypePolicy = Array.isArray(input.dtypePolicy)
    ? input.dtypePolicy.map((dtype) => String(dtype))
    : ['f64', 'f32', 'bf16'];
  const outputs = Array.isArray(input.outputs) ? input.outputs.map((item) => String(item)) : [];
  const operationInventory = new Map();
  for (const operation of operations) operationInventory.set(operation.kind, (operationInventory.get(operation.kind) ?? 0) + 1);
  return Object.freeze({
    format: String(input.format ?? 'rcl.tensor-shape-semantics.v0.1'),
    dtypePolicy,
    tensors,
    operations,
    outputs,
    operationInventory: [...operationInventory.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((left, right) => left.name.localeCompare(right.name)),
    modelSourceSha256: String(bindings.modelSourceSha256 ?? input.modelSourceSha256 ?? ''),
    contractRoot: String(bindings.contractRoot ?? input.contractRoot ?? ''),
  });
}

function tensorExpression(tensor) {
  return `make_tensor(${textLiteral(tensor.id)}, ${numberSequence(tensor.shape, 'shape')}, ${numberSequence(tensor.strides, 'strides')}, ${textLiteral(tensor.dtype)}, ${textLiteral(tensor.layout)}, ${textLiteral(tensor.device)}, ${textLiteral(tensor.storageIdentity)}, ${numberLiteral(tensor.elementCount, 'elementCount')})`;
}

function operationExpression(operation) {
  return `make_operation(${textLiteral(operation.id)}, ${textLiteral(operation.kind)}, ${sequenceLiteral(operation.inputs, textLiteral)}, ${tensorExpression(operation.output)}, ${numberLiteral(operation.axis, 'axis')})`;
}

function readTemplate() {
  const source = fs.readFileSync(SELFHOST_TENSOR_SHAPE_SEMANTICS_PATH, 'utf8');
  for (const marker of [
    TENSORS_MARKER,
    OPERATIONS_MARKER,
    OUTPUTS_MARKER,
    DTYPES_MARKER,
    MODEL_SOURCE_MARKER,
    CONTRACT_ROOT_MARKER,
    MANIFEST_MARKER,
    MANIFEST_ROOT_MARKER,
  ]) {
    if (!source.includes(marker)) throw new Error(`RCL_AI001_TEMPLATE_MARKER_MISSING:${marker}`);
  }
  return source;
}

export function manifestFromTensorShapeSemantics(input = {}, bindings = {}) {
  const semantics = normalizeTensorShapeSemantics(input, bindings);
  const manifest = {
    format: semantics.format,
    dtypePolicy: semantics.dtypePolicy,
    tensors: semantics.tensors,
    operations: semantics.operations,
    outputs: semantics.outputs,
    operationInventory: semantics.operationInventory,
    modelSourceSha256: semantics.modelSourceSha256,
    contractRoot: semantics.contractRoot,
  };
  const manifestCanonical = canonicalJson(manifest);
  return Object.freeze({
    ...semantics,
    manifestCanonical,
    manifestRoot: sha256(manifestCanonical),
  });
}

export function renderSelfHostedTensorShapeSemantics(manifest, options = {}) {
  if (!manifest || !Array.isArray(manifest.tensors) || !Array.isArray(manifest.operations)) {
    throw new Error('RCL_AI001_MANIFEST_REQUIRED');
  }
  const declaredManifestRoot = options.declaredManifestRoot ?? manifest.manifestRoot;
  const defaultDtypes = sequenceLiteral(manifest.dtypePolicy, textLiteral);
  return readTemplate()
    .replace(TENSORS_MARKER, `  reckon default_tensors() -> Sequence = ${sequenceLiteral(manifest.tensors, tensorExpression)}`)
    .replace(OPERATIONS_MARKER, `  reckon default_operations() -> Sequence = ${sequenceLiteral(manifest.operations, operationExpression)}`)
    .replace(OUTPUTS_MARKER, `  reckon default_outputs() -> Sequence = ${sequenceLiteral(manifest.outputs, textLiteral)}`)
    .replace(DTYPES_MARKER, `  reckon default_dtypes() -> Sequence = ${defaultDtypes}`)
    .replace(MODEL_SOURCE_MARKER, `  facet binding.model_source_sha256 : Text = ${textLiteral(manifest.modelSourceSha256)}`)
    .replace(CONTRACT_ROOT_MARKER, `  facet binding.contract_root : Text = ${textLiteral(manifest.contractRoot)}`)
    .replace(MANIFEST_MARKER, `  facet binding.manifest_canonical : Text = ${textLiteral(manifest.manifestCanonical)}`)
    .replace(MANIFEST_ROOT_MARKER, `  facet binding.manifest_root : Text = ${textLiteral(declaredManifestRoot)}`);
}

export function runSelfHostedTensorShapeSemantics(input = {}, bindings = {}, options = {}) {
  const manifest = manifestFromTensorShapeSemantics(input, bindings);
  const source = renderSelfHostedTensorShapeSemantics(manifest, options);
  const bytecode = compileSourceSelfHosted(source, {
    compilerArtifactPath: options.compilerArtifactPath,
    compilerPath: options.compilerPath,
    timeout: options.compileTimeout ?? 120_000,
    maxBuffer: options.maxBuffer ?? 64 * 1024 * 1024,
  });
  const native = runNativeBytecode(bytecode, {
    vmPath: options.vmPath,
    timeout: options.timeout ?? 120_000,
    maxBuffer: options.maxBuffer ?? 64 * 1024 * 1024,
    requireNativeStateRoot: options.requireNativeStateRoot ?? true,
  });
  const state = native.state;
  const report = {
    format: SELFHOST_TENSOR_SHAPE_SEMANTICS_FORMAT,
    manifest,
    sourceSha256: sha256(source),
    semantic: {
      tensorCount: state['tensor.count'],
      operationCount: state['operation.count'],
      outputCount: state['output.count'],
    },
    evaluation: {
      tensorInventoryValid: state['evaluation.tensor_inventory_valid'] === true,
      operationInventoryValid: state['evaluation.operation_inventory_valid'] === true,
      outputsValid: state['evaluation.outputs_valid'] === true,
      manifestRootValid: state['evaluation.manifest_root_valid'] === true,
      accepted: state['evaluation.accepted'] === true,
    },
    lowering: {
      status: state['lowering.status'],
    },
    native: {
      sourceRoot: native.sourceRoot,
      semanticStateRoot: native.semanticStateRoot,
      stateRootVerified: native.stateRootVerified === true,
    },
    boundary: 'RCL_OWNS_TYPED_TENSOR_DESCRIPTOR_SHAPE_LAYOUT_BROADCAST_MATMUL_REDUCTION_ADMISSION; NUMERICAL_STORAGE_KERNEL_DEVICE_PLACEMENT_AND_CANONICAL_PROMOTION_REMAIN_EXTERNAL',
  };
  report.reportRoot = evidenceRoot({ ...report, reportRoot: undefined });
  return Object.freeze(report);
}

export function tensorShapeSemanticsCanonical(report) {
  if (!report || report.format !== SELFHOST_TENSOR_SHAPE_SEMANTICS_FORMAT) throw new Error('RCL_AI001_REPORT_INVALID');
  return canonicalJson({
    manifest: report.manifest,
    semantic: report.semantic,
    evaluation: report.evaluation,
    lowering: report.lowering,
  });
}
