import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  runSelfHostedTensorShapeSemantics,
} from './selfhost-tensor-shape-semantics.mjs';
import {
  runSelfHostedAutodiffGraphGovernance,
} from './selfhost-autodiff-graph-governance.mjs';
import {
  buildEngine,
  executeRequest,
} from '../scripts/run-k08-native-autodiff.mjs';
import { canonicalJson, evidenceRoot } from './universal-program-stress.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

export const SELFHOST_AUTODIFF_GRAPH_EXECUTION_FORMAT = 'rcl.selfhost.autodiff-graph-execution.v0.1';
export const SELFHOST_AUTODIFF_GRAPH_EXECUTION_OWNER = 'rcl-tensor-autodiff-rust-v0.1';

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function integer(value, field) {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(`RCL_AI002_INTEGER_REQUIRED:${field}`);
  return value;
}

function positiveShape(value, field) {
  if (!Array.isArray(value) || value.length > 8 || value.some((item) => !Number.isSafeInteger(item) || item < 1)) {
    throw new TypeError(`RCL_AI002_SHAPE_INVALID:${field}`);
  }
  return value.map(Number);
}

function rowMajorStrides(shape) {
  return shape.map((_, index) => shape.slice(index + 1).reduce((product, dimension) => product * dimension, 1));
}

function product(shape) {
  return shape.reduce((total, dimension) => total * dimension, 1);
}

function normalizeTensor(value, field, { valuesRequired = false } = {}) {
  if (!isObject(value)) throw new TypeError(`RCL_AI002_TENSOR_REQUIRED:${field}`);
  const shape = positiveShape(value.shape ?? [], `${field}.shape`);
  const expectedCount = product(shape);
  const values = value.values === undefined
    ? undefined
    : Array.isArray(value.values) && value.values.every((item) => Number.isFinite(Number(item)))
      ? value.values.map(Number)
      : null;
  if (valuesRequired && values === undefined) throw new TypeError(`RCL_AI002_VALUES_REQUIRED:${field}`);
  if (values === null || (values && values.length !== expectedCount)) {
    throw new TypeError(`RCL_AI002_VALUES_SHAPE:${field}`);
  }
  const strides = value.strides === undefined
    ? rowMajorStrides(shape)
    : Array.isArray(value.strides) && value.strides.every((item) => Number.isSafeInteger(item) && item >= 0)
      ? value.strides.map(Number)
      : null;
  if (!strides || strides.length !== shape.length) throw new TypeError(`RCL_AI002_STRIDES_INVALID:${field}`);
  return {
    id: String(value.id ?? ''),
    shape,
    strides,
    dtype: String(value.dtype ?? 'f64'),
    layout: String(value.layout ?? 'row-major'),
    device: String(value.device ?? 'cpu'),
    storageIdentity: String(value.storageIdentity ?? value.storage ?? `storage:${String(value.id ?? '')}`),
    elementCount: integer(value.elementCount ?? expectedCount, `${field}.elementCount`),
    gradientIdentity: String(value.gradientIdentity ?? `constant:${String(value.id ?? '')}`),
    values,
  };
}

function normalizeOperation(value, index) {
  if (!isObject(value)) throw new TypeError(`RCL_AI002_OPERATION_REQUIRED:operations[${index}]`);
  const output = normalizeTensor(value.output, `operations[${index}].output`);
  const axis = integer(value.axis ?? 0, `operations[${index}].axis`);
  const kind = String(value.kind ?? value.operation ?? '');
  const attributes = isObject(value.attributes) ? structuredClone(value.attributes) : {};
  if ((kind === 'sum' || kind === 'mean' || kind === 'max') && attributes.axis === undefined) attributes.axis = axis;
  return {
    id: String(value.id ?? ''),
    kind,
    inputs: Array.isArray(value.inputs) ? value.inputs.map((item) => String(item)) : [],
    output,
    axis,
    attributes,
  };
}

function normalizeRequest(input = {}) {
  if (!isObject(input)) throw new TypeError('RCL_AI002_REQUEST_OBJECT_REQUIRED');
  const rawTensors = Array.isArray(input.tensors) ? input.tensors : [];
  const tensors = rawTensors.map((tensor, index) => normalizeTensor(tensor, `tensors[${index}]`, { valuesRequired: true }));
  const operations = Array.isArray(input.operations)
    ? input.operations.map(normalizeOperation)
    : [];
  const rawParameters = Array.isArray(input.parameters) ? input.parameters : [];
  const parameters = rawParameters.map((parameter) => {
    const tensorId = String(parameter?.tensorId ?? parameter?.id ?? parameter ?? '');
    return {
      tensorId,
      gradientIdentity: String(parameter?.gradientIdentity ?? `parameter:${tensorId}`),
    };
  });
  const parameterIds = new Set(parameters.map((parameter) => parameter.tensorId));
  for (const tensor of tensors) {
    if (parameterIds.has(tensor.id) && tensor.gradientIdentity === `constant:${tensor.id}`) {
      tensor.gradientIdentity = `parameter:${tensor.id}`;
    }
  }
  return {
    format: String(input.format ?? 'rcl.autodiff-graph-execution-request.v0.1'),
    dtypePolicy: Array.isArray(input.dtypePolicy) ? input.dtypePolicy.map(String) : ['f64', 'f32', 'bf16'],
    tensors,
    operations,
    parameters,
    stopGradients: Array.isArray(input.stopGradients)
      ? input.stopGradients.map((value) => String(value?.tensorId ?? value?.id ?? value))
      : [],
    loss: String(input.loss ?? ''),
    modelSourceSha256: String(input.modelSourceSha256 ?? ''),
    contractRoot: String(input.contractRoot ?? ''),
    executionOwner: String(input.executionOwner ?? SELFHOST_AUTODIFF_GRAPH_EXECUTION_OWNER),
  };
}

function descriptor(tensor) {
  const { values: _values, gradientIdentity: _gradientIdentity, ...result } = tensor;
  return result;
}

function providerDescriptor(tensor) {
  const { values: _values, elementCount: _elementCount, strides: _strides, ...result } = tensor;
  return result;
}

function providerOutputDescriptor(tensor) {
  const {
    values: _values,
    elementCount: _elementCount,
    strides: _strides,
    storageIdentity: _storageIdentity,
    ...result
  } = tensor;
  return result;
}

function shapeRequest(request) {
  return {
    format: 'rcl.tensor-shape-semantics.v0.1',
    dtypePolicy: request.dtypePolicy,
    tensors: request.tensors.map(descriptor),
    operations: request.operations.map((operation) => ({
      id: operation.id,
      kind: operation.kind,
      inputs: operation.inputs,
      output: descriptor(operation.output),
      axis: operation.axis,
    })),
    outputs: [request.loss],
    modelSourceSha256: request.modelSourceSha256,
    contractRoot: request.contractRoot,
  };
}

function governanceRequest(request) {
  return {
    parameters: request.parameters.map((parameter) => ({
      id: parameter.tensorId,
      gradientIdentity: parameter.gradientIdentity,
    })),
    operations: request.operations.map((operation) => ({
      id: operation.id,
      kind: operation.kind,
      inputs: operation.inputs,
      output: operation.output.id,
    })),
    stopGradients: request.stopGradients,
    loss: request.loss,
  };
}

function storageAdmission(request) {
  const errors = [];
  const tensorIds = new Set();
  const storageIds = new Set();
  for (const tensor of request.tensors) {
    if (!tensor.id || tensorIds.has(tensor.id)) errors.push(`tensor-id:${tensor.id}`);
    tensorIds.add(tensor.id);
    if (!tensor.storageIdentity || storageIds.has(tensor.storageIdentity)) errors.push(`storage-id:${tensor.storageIdentity}`);
    storageIds.add(tensor.storageIdentity);
    if (tensor.elementCount !== product(tensor.shape)) errors.push(`element-count:${tensor.id}`);
    if (tensor.values?.length !== tensor.elementCount) errors.push(`values:${tensor.id}`);
    if (tensor.dtype !== 'f64' || tensor.layout !== 'row-major' || tensor.device !== 'cpu') {
      errors.push(`provider-profile:${tensor.id}`);
    }
  }
  const tensorMap = new Map(request.tensors.map((tensor) => [tensor.id, tensor]));
  for (const parameter of request.parameters) {
    const tensor = tensorMap.get(parameter.tensorId);
    if (!tensor) errors.push(`parameter-missing:${parameter.tensorId}`);
    if (parameter.gradientIdentity !== `parameter:${parameter.tensorId}`) errors.push(`parameter-gradient-identity:${parameter.tensorId}`);
    if (tensor && tensor.gradientIdentity !== parameter.gradientIdentity) errors.push(`tensor-gradient-identity:${parameter.tensorId}`);
  }
  return { accepted: errors.length === 0, errors };
}

function edgeKey(edge) {
  return [edge.nodeId, edge.operation, edge.output, edge.input, edge.inputIndex];
}

function expectedEdges(governance) {
  return (governance.semantic.backwardEdges ?? []).map((edge) => [
    `node:${edge[1]}`,
    edge[2],
    edge[3],
    edge[4],
    edge[5],
  ]);
}

function providerRequest(request, shapeReport, governanceReport) {
  return {
    format: 'rcl.tensor-autodiff-request.v0.1',
    graph: {
      format: 'rcl.tensor-execution-plan.v0.1',
      bindings: {
        semanticOwner: 'RCL',
        shapeSemanticsRoot: shapeReport.native.semanticStateRoot,
        graphGovernanceRoot: governanceReport.native.semanticStateRoot,
      },
      tensors: request.tensors.map(providerDescriptor),
      storages: request.tensors.map((tensor) => ({
        identity: tensor.storageIdentity,
        kind: 'cpu-dense',
        data: tensor.values,
      })),
      nodes: request.operations.map((operation) => ({
        id: `node:${operation.id}`,
        operation: operation.kind,
        inputs: operation.inputs,
        output: {
          ...providerOutputDescriptor(operation.output),
        },
        attributes: operation.attributes,
      })),
      outputs: [request.loss],
    },
    loss: request.loss,
    parameters: request.parameters,
    stopGradients: request.stopGradients.map((tensorId) => ({ tensorId })),
  };
}

function safeRun(fn) {
  try {
    return { value: fn(), error: null };
  } catch (error) {
    return {
      value: null,
      error: {
        code: String(error?.message ?? 'RCL_AI002_SELFHOST_FAILURE').split(':')[0],
        message: String(error?.message ?? error),
      },
    };
  }
}

function baseReport(request, shape, governance, storage) {
  return {
    format: SELFHOST_AUTODIFF_GRAPH_EXECUTION_FORMAT,
    request: {
      format: request.format,
      loss: request.loss,
      tensorCount: request.tensors.length,
      operationCount: request.operations.length,
      parameterCount: request.parameters.length,
      stopGradientCount: request.stopGradients.length,
    },
    admission: {
      shape: shape.value
        ? {
            accepted: shape.value.evaluation.accepted,
            reportRoot: shape.value.reportRoot,
            nativeStateRoot: shape.value.native.semanticStateRoot,
          }
        : { accepted: false, error: shape.error },
      graph: governance.value
        ? {
            accepted: governance.value.evaluation.graphValid,
            reportRoot: governance.value.reportRoot,
            nativeStateRoot: governance.value.native.semanticStateRoot,
          }
        : { accepted: false, error: governance.error },
      storage,
    },
  };
}

export function runSelfHostedAutodiffGraphExecution(input = {}, options = {}) {
  const request = normalizeRequest(input);
  const storage = storageAdmission(request);
  const shape = safeRun(() => runSelfHostedTensorShapeSemantics(shapeRequest(request), {
    modelSourceSha256: request.modelSourceSha256,
    contractRoot: request.contractRoot,
  }, {
    requireNativeStateRoot: true,
    compileTimeout: options.compileTimeout,
    timeout: options.timeout,
  }));
  const governance = safeRun(() => runSelfHostedAutodiffGraphGovernance(governanceRequest(request), {
    requireNativeStateRoot: true,
    timeout: options.timeout,
  }));
  const report = baseReport(request, shape, governance, storage);
  const semanticAccepted = shape.value?.evaluation.accepted === true
    && governance.value?.evaluation.graphValid === true
    && storage.accepted
    && request.executionOwner === SELFHOST_AUTODIFF_GRAPH_EXECUTION_OWNER;
  report.admission.accepted = semanticAccepted;
  report.boundary = 'RCL_OWNS_TYPED_SHAPE_AND_REVERSE_GRAPH_ADMISSION; RUST_CPU_F64_OWNS_NUMERICAL_KERNEL_EXECUTION; NO_IMPLICIT_PROVIDER_FALLBACK';
  report.execution = {
    owner: request.executionOwner,
    status: 'not-run',
    attempted: false,
    edgeParity: false,
    gradientShapeValid: false,
  };
  if (!semanticAccepted) {
    report.execution.reason = 'admission-rejected-or-unsupported-provider-profile';
  } else if (options.executeProvider === false) {
    report.execution.status = 'skipped';
    report.execution.reason = 'provider-execution-disabled-by-caller';
  } else {
    const provider = safeRun(() => {
      buildEngine();
      const response = executeRequest(providerRequest(request, shape.value, governance.value));
      const expected = expectedEdges(governance.value);
      const actual = (response.backwardEdges ?? []).map(edgeKey);
      const parameterShapes = new Map(request.tensors.map((tensor) => [tensor.id, tensor.shape]));
      const gradientShapeValid = (response.gradients ?? []).every((gradient) =>
        canonicalJson(gradient.tensor?.shape ?? []) === canonicalJson(parameterShapes.get(gradient.parameter?.tensorId) ?? null));
      return {
        response,
        expected,
        actual,
        edgeParity: canonicalJson(actual) === canonicalJson(expected),
        gradientShapeValid,
      };
    });
    if (provider.error) {
      report.execution = {
        ...report.execution,
        status: 'provider-failed',
        attempted: true,
        error: provider.error,
      };
    } else {
      report.execution = {
        owner: request.executionOwner,
        status: provider.value.response.status === 'ok' && provider.value.edgeParity && provider.value.gradientShapeValid
          ? 'executed'
          : 'rejected',
        attempted: true,
        loss: provider.value.response.loss?.storage?.data?.[0],
        lossTensor: provider.value.response.loss?.tensor,
        gradients: provider.value.response.gradients,
        backwardEdges: provider.value.response.backwardEdges,
        accumulator: provider.value.response.accumulator,
        edgeParity: provider.value.edgeParity,
        gradientShapeValid: provider.value.gradientShapeValid,
        planRoot: evidenceRoot({
          expectedEdges: provider.value.expected,
          graphRoot: governance.value.graphRoot,
          shapeRoot: shape.value.native.semanticStateRoot,
        }),
      };
    }
  }
  report.reportRoot = evidenceRoot({ ...report, reportRoot: undefined });
  return Object.freeze(report);
}

export function autodiffGraphExecutionCanonical(report) {
  if (!report || report.format !== SELFHOST_AUTODIFF_GRAPH_EXECUTION_FORMAT) throw new Error('RCL_AI002_REPORT_INVALID');
  return canonicalJson({
    request: report.request,
    admission: report.admission,
    boundary: report.boundary,
    execution: report.execution,
  });
}

export { normalizeRequest, providerRequest, storageAdmission, sha256 };
