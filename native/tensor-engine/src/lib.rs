use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::time::Instant;

mod autodiff;
pub use autodiff::*;

pub const REQUEST_FORMAT: &str = "rcl.tensor-execution-request.v0.1";
pub const RESPONSE_FORMAT: &str = "rcl.tensor-execution-result.v0.1";
pub const PLAN_REQUEST_FORMAT: &str = "rcl.tensor-execution-plan.v0.1";
pub const PLAN_FILE_REQUEST_FORMAT: &str = "rcl.tensor-execution-plan-file.v0.1";
pub const PLAN_RESPONSE_FORMAT: &str = "rcl.tensor-execution-plan-result.v0.1";
pub const PROVIDER_ID: &str = "rcl.tensor.cpu";
pub const CAPABILITY: &str = "tensor.execute";
const MAX_TENSORS: usize = 8;
const MAX_RANK: usize = 8;
const MAX_ELEMENTS: usize = 16_777_216;
const MAX_PLAN_INITIAL_TENSORS: usize = 256;
const MAX_PLAN_NODES: usize = 32_768;
const MAX_PLAN_OUTPUTS: usize = 64;
const MAX_PLAN_ALLOCATED_ELEMENTS: usize = 16_777_216;
const MAX_PLAN_LIVE_ELEMENTS: usize = 16_777_216;
const MAX_PLAN_FILE_BYTES: u64 = 16 * 1024 * 1024;

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct TensorDescriptor {
    pub id: String,
    pub shape: Vec<usize>,
    pub dtype: String,
    pub layout: String,
    pub device: String,
    pub gradient_identity: String,
    pub storage_identity: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DenseStorage {
    pub identity: String,
    pub kind: String,
    pub data: Vec<f64>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ExecutionRequest {
    pub format: String,
    pub operation: String,
    pub tensors: Vec<TensorDescriptor>,
    pub storages: Vec<DenseStorage>,
    #[serde(default)]
    pub attributes: Value,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PlanOutputDescriptor {
    pub id: String,
    pub shape: Vec<usize>,
    pub dtype: String,
    pub layout: String,
    pub device: String,
    pub gradient_identity: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PlanNode {
    pub id: String,
    pub operation: String,
    pub inputs: Vec<String>,
    pub output: PlanOutputDescriptor,
    #[serde(default)]
    pub attributes: Value,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ExecutionPlan {
    pub format: String,
    #[serde(default)]
    pub bindings: Value,
    pub tensors: Vec<TensorDescriptor>,
    pub storages: Vec<DenseStorage>,
    #[serde(default, skip_serializing_if = "HashMap::is_empty")]
    pub exact_storage_bits: HashMap<String, Vec<String>>,
    pub nodes: Vec<PlanNode>,
    pub outputs: Vec<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PlanFileRequest {
    pub format: String,
    pub path: String,
    pub sha256: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Telemetry {
    pub backend: &'static str,
    pub kernel: String,
    pub kernel_nanos: u128,
    pub element_count: usize,
    pub allocated_bytes: usize,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecutionResult {
    pub format: &'static str,
    pub status: &'static str,
    pub tensor: TensorDescriptor,
    pub storage: DenseStorage,
    pub telemetry: Telemetry,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanTensorResult {
    pub tensor: TensorDescriptor,
    pub storage: DenseStorage,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanTelemetry {
    pub backend: &'static str,
    pub node_count: usize,
    /// Backward-compatible alias for cumulative_allocated_elements.
    pub stored_elements: usize,
    /// Backward-compatible alias for cumulative_allocated_bytes.
    pub allocated_bytes: usize,
    pub cumulative_allocated_elements: usize,
    pub cumulative_allocated_bytes: usize,
    pub live_elements: usize,
    pub live_bytes: usize,
    pub peak_live_elements: usize,
    pub peak_live_bytes: usize,
    pub retained_output_elements: usize,
    pub retained_output_bytes: usize,
    pub reclaimed_tensor_count: usize,
    pub reclaimed_elements: usize,
    pub input_binding_count: usize,
    pub borrowed_input_binding_count: usize,
    pub avoided_input_clone_elements: usize,
    pub avoided_input_clone_bytes: usize,
    pub cloned_input_elements: usize,
    pub cloned_input_bytes: usize,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecutionPlanResult {
    pub format: &'static str,
    pub status: &'static str,
    pub bindings: Value,
    pub outputs: Vec<PlanTensorResult>,
    pub telemetry: PlanTelemetry,
}

#[derive(Clone, Debug, Serialize)]
pub struct EngineError {
    pub code: &'static str,
    pub message: String,
}

impl EngineError {
    fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }
}

fn product(shape: &[usize]) -> Result<usize, EngineError> {
    if shape.len() > MAX_RANK {
        return Err(EngineError::new(
            "RCL_TENSOR_RANK_LIMIT",
            format!("Rank {} exceeds backend limit {MAX_RANK}", shape.len()),
        ));
    }
    if shape.contains(&0) {
        return Err(EngineError::new(
            "RCL_TENSOR_SHAPE_INVALID",
            "Tensor dimensions must be positive",
        ));
    }
    let count = shape
        .iter()
        .try_fold(1usize, |total, value| total.checked_mul(*value))
        .ok_or_else(|| {
            EngineError::new(
                "RCL_TENSOR_SHAPE_OVERFLOW",
                "Tensor element count overflowed usize",
            )
        })?;
    if count > MAX_ELEMENTS {
        return Err(EngineError::new(
            "RCL_TENSOR_ELEMENT_LIMIT",
            format!("Tensor has {count} elements; backend limit is {MAX_ELEMENTS}"),
        ));
    }
    Ok(count)
}

fn row_major_strides(shape: &[usize]) -> Vec<usize> {
    let mut strides = vec![1; shape.len()];
    let mut stride = 1;
    for index in (0..shape.len()).rev() {
        strides[index] = stride;
        stride *= shape[index];
    }
    strides
}

struct BoundTensor<'a> {
    descriptor: &'a TensorDescriptor,
    data: &'a [f64],
}

fn bind<'a>(request: &'a ExecutionRequest) -> Result<Vec<BoundTensor<'a>>, EngineError> {
    if request.format != REQUEST_FORMAT {
        return Err(EngineError::new(
            "RCL_TENSOR_REQUEST_FORMAT",
            format!("Unsupported request format {}", request.format),
        ));
    }
    if request.tensors.is_empty() {
        return Err(EngineError::new(
            "RCL_TENSOR_INPUT_REQUIRED",
            "At least one tensor is required",
        ));
    }
    if request.tensors.len() > MAX_TENSORS {
        return Err(EngineError::new(
            "RCL_TENSOR_INPUT_LIMIT",
            format!(
                "Received {} tensors; backend limit is {MAX_TENSORS}",
                request.tensors.len()
            ),
        ));
    }
    if request
        .tensors
        .iter()
        .any(|tensor| tensor.dtype != request.tensors[0].dtype)
    {
        return Err(EngineError::new(
            "RCL_TENSOR_DTYPE_MISMATCH",
            "All inputs must have the same dtype",
        ));
    }
    if request
        .tensors
        .iter()
        .any(|tensor| tensor.device != request.tensors[0].device)
    {
        return Err(EngineError::new(
            "RCL_TENSOR_DEVICE_MISMATCH",
            "All inputs must have the same device intent",
        ));
    }
    let mut tensor_ids = HashSet::new();
    let mut storage_ids = HashSet::new();
    let mut storage_map = HashMap::new();
    for storage in &request.storages {
        if !storage_ids.insert(storage.identity.as_str()) {
            return Err(EngineError::new(
                "RCL_TENSOR_STORAGE_DUPLICATE",
                format!("Duplicate storage identity {}", storage.identity),
            ));
        }
        if storage.kind != "cpu-dense" {
            return Err(EngineError::new(
                "RCL_TENSOR_STORAGE_KIND",
                format!("Unsupported storage kind {}", storage.kind),
            ));
        }
        storage_map.insert(storage.identity.as_str(), storage.data.as_slice());
    }
    let mut result = Vec::with_capacity(request.tensors.len());
    for tensor in &request.tensors {
        if !tensor_ids.insert(tensor.id.as_str()) {
            return Err(EngineError::new(
                "RCL_TENSOR_ID_DUPLICATE",
                format!("Duplicate tensor id {}", tensor.id),
            ));
        }
        if tensor.dtype != "f64" {
            return Err(EngineError::new(
                "RCL_TENSOR_DTYPE_UNSUPPORTED",
                format!("CPU v0.1 supports f64, received {}", tensor.dtype),
            ));
        }
        if tensor.layout != "row-major" {
            return Err(EngineError::new(
                "RCL_TENSOR_LAYOUT_UNSUPPORTED",
                format!("CPU v0.1 supports row-major, received {}", tensor.layout),
            ));
        }
        if tensor.device != "cpu" {
            return Err(EngineError::new(
                "RCL_TENSOR_DEVICE_MISMATCH",
                format!("CPU backend cannot execute device intent {}", tensor.device),
            ));
        }
        let data = storage_map
            .get(tensor.storage_identity.as_str())
            .ok_or_else(|| {
                EngineError::new(
                    "RCL_TENSOR_STORAGE_MISSING",
                    format!("Storage {} is not present", tensor.storage_identity),
                )
            })?;
        if product(&tensor.shape)? != data.len() {
            return Err(EngineError::new(
                "RCL_TENSOR_STORAGE_SHAPE_MISMATCH",
                format!(
                    "Tensor {} shape requires {} values, storage has {}",
                    tensor.id,
                    product(&tensor.shape)?,
                    data.len()
                ),
            ));
        }
        result.push(BoundTensor {
            descriptor: tensor,
            data,
        });
    }
    Ok(result)
}

fn require_arity<'a>(inputs: &'a [BoundTensor<'a>], count: usize) -> Result<(), EngineError> {
    if inputs.len() != count {
        return Err(EngineError::new(
            "RCL_TENSOR_ARITY",
            format!(
                "Operation requires {count} tensors, received {}",
                inputs.len()
            ),
        ));
    }
    Ok(())
}

fn output_shape_for_broadcast(left: &[usize], right: &[usize]) -> Result<Vec<usize>, EngineError> {
    let rank = left.len().max(right.len());
    let mut output = vec![1; rank];
    for (axis, output_dimension) in output.iter_mut().enumerate() {
        let l = left
            .get(left.len().wrapping_sub(rank - axis))
            .copied()
            .unwrap_or(1);
        let r = right
            .get(right.len().wrapping_sub(rank - axis))
            .copied()
            .unwrap_or(1);
        if l != r && l != 1 && r != 1 {
            return Err(EngineError::new(
                "RCL_TENSOR_BROADCAST_INVALID",
                format!("Cannot broadcast {left:?} with {right:?}"),
            ));
        }
        *output_dimension = l.max(r);
    }
    Ok(output)
}

fn broadcast_offset(linear: usize, output_shape: &[usize], input_shape: &[usize]) -> usize {
    if input_shape.is_empty() {
        return 0;
    }
    let output_strides = row_major_strides(output_shape);
    let input_strides = row_major_strides(input_shape);
    let rank_delta = output_shape.len() - input_shape.len();
    let mut offset = 0;
    for axis in 0..input_shape.len() {
        let coordinate =
            (linear / output_strides[axis + rank_delta]) % output_shape[axis + rank_delta];
        if input_shape[axis] != 1 {
            offset += coordinate * input_strides[axis];
        }
    }
    offset
}

fn elementwise(
    inputs: &[BoundTensor<'_>],
    op: &str,
) -> Result<(Vec<usize>, Vec<f64>), EngineError> {
    require_arity(inputs, 2)?;
    let shape =
        output_shape_for_broadcast(&inputs[0].descriptor.shape, &inputs[1].descriptor.shape)?;
    let count = product(&shape)?;
    let mut output = Vec::with_capacity(count);
    for index in 0..count {
        let left = inputs[0].data[broadcast_offset(index, &shape, &inputs[0].descriptor.shape)];
        let right = inputs[1].data[broadcast_offset(index, &shape, &inputs[1].descriptor.shape)];
        let value = match op {
            "add" => left + right,
            "sub" => left - right,
            "mul" => left * right,
            "div" if right != 0.0 => left / right,
            "div" => {
                return Err(EngineError::new(
                    "RCL_TENSOR_DIVIDE_BY_ZERO",
                    "Elementwise division encountered zero",
                ));
            }
            _ => unreachable!(),
        };
        output.push(value);
    }
    Ok((shape, output))
}

fn unary(input: &BoundTensor<'_>, op: &str) -> Result<(Vec<usize>, Vec<f64>), EngineError> {
    let mut output = Vec::with_capacity(input.data.len());
    for value in input.data {
        output.push(match op {
            "abs" => value.abs(),
            "exp" => value.exp(),
            "log" if *value > 0.0 => value.ln(),
            "log" => {
                return Err(EngineError::new(
                    "RCL_TENSOR_LOG_DOMAIN",
                    "log requires positive values",
                ));
            }
            "sqrt" if *value >= 0.0 => value.sqrt(),
            "sqrt" => {
                return Err(EngineError::new(
                    "RCL_TENSOR_SQRT_DOMAIN",
                    "sqrt requires non-negative values",
                ));
            }
            _ => unreachable!(),
        });
    }
    Ok((input.descriptor.shape.clone(), output))
}

fn transpose(
    input: &BoundTensor<'_>,
    permutation: &[usize],
) -> Result<(Vec<usize>, Vec<f64>), EngineError> {
    let rank = input.descriptor.shape.len();
    if permutation.len() != rank {
        return Err(EngineError::new(
            "RCL_TENSOR_TRANSPOSE_PERMUTATION",
            format!(
                "Permutation rank {} differs from tensor rank {rank}",
                permutation.len()
            ),
        ));
    }
    let mut seen = vec![false; rank];
    for axis in permutation {
        if *axis >= rank || seen[*axis] {
            return Err(EngineError::new(
                "RCL_TENSOR_TRANSPOSE_PERMUTATION",
                format!("Invalid permutation {permutation:?} for rank {rank}"),
            ));
        }
        seen[*axis] = true;
    }
    let output_shape = permutation
        .iter()
        .map(|axis| input.descriptor.shape[*axis])
        .collect::<Vec<_>>();
    let output_count = product(&output_shape)?;
    let output_strides = row_major_strides(&output_shape);
    let input_strides = row_major_strides(&input.descriptor.shape);
    let mut output = vec![0.0; output_count];
    for (output_index, cell) in output.iter_mut().enumerate() {
        let mut input_index = 0;
        for output_axis in 0..rank {
            let coordinate =
                (output_index / output_strides[output_axis]) % output_shape[output_axis];
            input_index += coordinate * input_strides[permutation[output_axis]];
        }
        *cell = input.data[input_index];
    }
    Ok((output_shape, output))
}

fn matmul_reference(inputs: &[BoundTensor<'_>]) -> Result<(Vec<usize>, Vec<f64>), EngineError> {
    require_arity(inputs, 2)?;
    let left = &inputs[0];
    let right = &inputs[1];
    if left.descriptor.shape.len() != 2 || right.descriptor.shape.len() != 2 {
        return Err(EngineError::new(
            "RCL_TENSOR_MATMUL_RANK",
            "v0.1 matmul requires rank-2 tensors",
        ));
    }
    let (m, k) = (left.descriptor.shape[0], left.descriptor.shape[1]);
    let (right_k, n) = (right.descriptor.shape[0], right.descriptor.shape[1]);
    if k != right_k {
        return Err(EngineError::new(
            "RCL_TENSOR_MATMUL_SHAPE",
            format!("Inner dimensions differ: {k} != {right_k}"),
        ));
    }
    let mut output = vec![0.0; m * n];
    for i in 0..m {
        for j in 0..n {
            let mut sum = 0.0;
            for inner in 0..k {
                sum += left.data[i * k + inner] * right.data[inner * n + j];
            }
            output[i * n + j] = sum;
        }
    }
    Ok((vec![m, n], output))
}

fn matmul_optimized(inputs: &[BoundTensor<'_>]) -> Result<(Vec<usize>, Vec<f64>), EngineError> {
    require_arity(inputs, 2)?;
    let left = &inputs[0];
    let right = &inputs[1];
    if left.descriptor.shape.len() != 2 || right.descriptor.shape.len() != 2 {
        return Err(EngineError::new(
            "RCL_TENSOR_MATMUL_RANK",
            "v0.1 matmul requires rank-2 tensors",
        ));
    }
    let (m, k) = (left.descriptor.shape[0], left.descriptor.shape[1]);
    let (right_k, n) = (right.descriptor.shape[0], right.descriptor.shape[1]);
    if k != right_k {
        return Err(EngineError::new(
            "RCL_TENSOR_MATMUL_SHAPE",
            format!("Inner dimensions differ: {k} != {right_k}"),
        ));
    }
    let mut output = vec![0.0; m * n];
    const BLOCK: usize = 64;
    for ii in (0..m).step_by(BLOCK) {
        for kk in (0..k).step_by(BLOCK) {
            for jj in (0..n).step_by(BLOCK) {
                let i_end = (ii + BLOCK).min(m);
                let k_end = (kk + BLOCK).min(k);
                let j_end = (jj + BLOCK).min(n);
                for i in ii..i_end {
                    for inner in kk..k_end {
                        let left_value = left.data[i * k + inner];
                        let right_row = &right.data[inner * n + jj..inner * n + j_end];
                        let output_row = &mut output[i * n + jj..i * n + j_end];
                        for (cell, right_value) in output_row.iter_mut().zip(right_row) {
                            *cell += left_value * right_value;
                        }
                    }
                }
            }
        }
    }
    Ok((vec![m, n], output))
}

fn attribute_usize(attributes: &Value, name: &str) -> Result<usize, EngineError> {
    attributes
        .get(name)
        .and_then(Value::as_u64)
        .and_then(|value| usize::try_from(value).ok())
        .ok_or_else(|| {
            EngineError::new(
                "RCL_TENSOR_ATTRIBUTE",
                format!("Missing or invalid usize attribute {name}"),
            )
        })
}

fn attribute_permutation(attributes: &Value) -> Result<Vec<usize>, EngineError> {
    attributes
        .get("permutation")
        .and_then(Value::as_array)
        .ok_or_else(|| EngineError::new("RCL_TENSOR_ATTRIBUTE", "Missing permutation attribute"))?
        .iter()
        .map(|value| {
            value
                .as_u64()
                .and_then(|axis| usize::try_from(axis).ok())
                .ok_or_else(|| {
                    EngineError::new(
                        "RCL_TENSOR_ATTRIBUTE",
                        "Permutation axes must be usize values",
                    )
                })
        })
        .collect()
}

fn attribute_shape(attributes: &Value) -> Result<Vec<usize>, EngineError> {
    attributes
        .get("shape")
        .and_then(Value::as_array)
        .ok_or_else(|| EngineError::new("RCL_TENSOR_ATTRIBUTE", "Missing shape attribute"))?
        .iter()
        .map(|value| {
            value
                .as_u64()
                .and_then(|dimension| usize::try_from(dimension).ok())
                .ok_or_else(|| {
                    EngineError::new(
                        "RCL_TENSOR_ATTRIBUTE",
                        "Shape dimensions must be usize values",
                    )
                })
        })
        .collect()
}

fn activation(
    input: &BoundTensor<'_>,
    attributes: &Value,
) -> Result<(Vec<usize>, Vec<f64>), EngineError> {
    let kind = attributes
        .get("kind")
        .and_then(Value::as_str)
        .ok_or_else(|| EngineError::new("RCL_TENSOR_ATTRIBUTE", "Missing activation kind"))?;
    let data = input
        .data
        .iter()
        .map(|value| match kind {
            "softsign01" => Ok(0.5 * (value / (1.0 + value.abs()) + 1.0)),
            "relu" => Ok(value.max(0.0)),
            "tanh" => Ok(value.tanh()),
            "sigmoid" => Ok(1.0 / (1.0 + (-value).exp())),
            _ => Err(EngineError::new(
                "RCL_TENSOR_ACTIVATION_UNSUPPORTED",
                format!("Unsupported activation {kind}"),
            )),
        })
        .collect::<Result<Vec<_>, _>>()?;
    Ok((input.descriptor.shape.clone(), data))
}

fn reduction(
    input: &BoundTensor<'_>,
    operation: &str,
    axis: usize,
) -> Result<(Vec<usize>, Vec<f64>), EngineError> {
    if axis >= input.descriptor.shape.len() {
        return Err(EngineError::new(
            "RCL_TENSOR_REDUCTION_AXIS",
            format!(
                "Axis {axis} is outside rank {}",
                input.descriptor.shape.len()
            ),
        ));
    }
    let outer = input.descriptor.shape[..axis].iter().product::<usize>();
    let width = input.descriptor.shape[axis];
    let inner = input.descriptor.shape[axis + 1..].iter().product::<usize>();
    let mut output = vec![0.0; outer * inner];
    for o in 0..outer {
        for i in 0..inner {
            let mut value = if operation == "max" {
                f64::NEG_INFINITY
            } else {
                0.0
            };
            for w in 0..width {
                let candidate = input.data[(o * width + w) * inner + i];
                value = if operation == "max" {
                    value.max(candidate)
                } else {
                    value + candidate
                };
            }
            if operation == "mean" {
                value /= width as f64;
            }
            output[o * inner + i] = value;
        }
    }
    let mut shape = input.descriptor.shape.clone();
    shape.remove(axis);
    Ok((shape, output))
}

fn normalized(
    input: &BoundTensor<'_>,
    operation: &str,
    epsilon: f64,
) -> Result<(Vec<usize>, Vec<f64>), EngineError> {
    if input.descriptor.shape.is_empty() {
        return Err(EngineError::new(
            "RCL_TENSOR_NORMALIZATION_RANK",
            "Normalization requires rank >= 1",
        ));
    }
    if !epsilon.is_finite() || epsilon <= 0.0 {
        return Err(EngineError::new(
            "RCL_TENSOR_EPSILON",
            "epsilon must be finite and positive",
        ));
    }
    let width = *input.descriptor.shape.last().unwrap();
    let rows = input.data.len() / width;
    let mut output = vec![0.0; input.data.len()];
    for row in 0..rows {
        let source = &input.data[row * width..(row + 1) * width];
        let target = &mut output[row * width..(row + 1) * width];
        match operation {
            "softmax" => {
                let maximum = source.iter().copied().fold(f64::NEG_INFINITY, f64::max);
                let mut denominator = 0.0;
                for (out, value) in target.iter_mut().zip(source) {
                    *out = (*value - maximum).exp();
                    denominator += *out;
                }
                for out in target {
                    *out /= denominator;
                }
            }
            "layer-norm" => {
                let mean = source.iter().sum::<f64>() / width as f64;
                let variance = source
                    .iter()
                    .map(|value| (value - mean) * (value - mean))
                    .sum::<f64>()
                    / width as f64;
                let scale = (variance + epsilon).sqrt();
                for (out, value) in target.iter_mut().zip(source) {
                    *out = (*value - mean) / scale;
                }
            }
            "rms-norm" => {
                let mean_square =
                    source.iter().map(|value| value * value).sum::<f64>() / width as f64;
                let scale = (mean_square + epsilon).sqrt();
                for (out, value) in target.iter_mut().zip(source) {
                    *out = *value / scale;
                }
            }
            _ => unreachable!(),
        }
    }
    Ok((input.descriptor.shape.clone(), output))
}

fn output_identity(dtype: &str, shape: &[usize], data: &[f64]) -> String {
    let mut hash = Sha256::new();
    hash.update(dtype.as_bytes());
    for dimension in shape {
        hash.update(dimension.to_le_bytes());
    }
    for value in data {
        hash.update(value.to_bits().to_le_bytes());
    }
    format!("sha256:{}", hex::encode(hash.finalize()))
}

fn execute_bound(
    operation: &str,
    attributes: &Value,
    inputs: &[BoundTensor<'_>],
) -> Result<ExecutionResult, EngineError> {
    if inputs.is_empty() {
        return Err(EngineError::new(
            "RCL_TENSOR_INPUT_REQUIRED",
            "At least one tensor is required",
        ));
    }
    if inputs.len() > MAX_TENSORS {
        return Err(EngineError::new(
            "RCL_TENSOR_INPUT_LIMIT",
            format!(
                "Received {} tensors; backend limit is {MAX_TENSORS}",
                inputs.len()
            ),
        ));
    }
    if inputs
        .iter()
        .any(|input| input.descriptor.dtype != inputs[0].descriptor.dtype)
    {
        return Err(EngineError::new(
            "RCL_TENSOR_DTYPE_MISMATCH",
            "All inputs must have the same dtype",
        ));
    }
    if inputs
        .iter()
        .any(|input| input.descriptor.device != inputs[0].descriptor.device)
    {
        return Err(EngineError::new(
            "RCL_TENSOR_DEVICE_MISMATCH",
            "All inputs must have the same device intent",
        ));
    }
    let start = Instant::now();
    let (shape, data) = match operation {
        "add" | "sub" | "mul" | "div" => elementwise(inputs, operation)?,
        "abs" | "exp" | "log" | "sqrt" => {
            require_arity(inputs, 1)?;
            unary(&inputs[0], operation)?
        }
        "reshape" => {
            require_arity(inputs, 1)?;
            let shape = attribute_shape(attributes)?;
            if product(&shape)? != inputs[0].data.len() {
                return Err(EngineError::new(
                    "RCL_TENSOR_RESHAPE_ELEMENTS",
                    "reshape must preserve the element count",
                ));
            }
            (shape, inputs[0].data.to_vec())
        }
        "broadcast" => {
            require_arity(inputs, 1)?;
            let shape = attribute_shape(attributes)?;
            if output_shape_for_broadcast(&inputs[0].descriptor.shape, &shape)? != shape {
                return Err(EngineError::new(
                    "RCL_TENSOR_BROADCAST_INVALID",
                    format!(
                        "Cannot broadcast {:?} to {shape:?}",
                        inputs[0].descriptor.shape
                    ),
                ));
            }
            let count = product(&shape)?;
            let data = (0..count)
                .map(|index| {
                    inputs[0].data[broadcast_offset(index, &shape, &inputs[0].descriptor.shape)]
                })
                .collect();
            (shape, data)
        }
        "activation" => {
            require_arity(inputs, 1)?;
            activation(&inputs[0], attributes)?
        }
        "stop-gradient" => {
            require_arity(inputs, 1)?;
            (inputs[0].descriptor.shape.clone(), inputs[0].data.to_vec())
        }
        "transpose" => {
            require_arity(inputs, 1)?;
            transpose(&inputs[0], &attribute_permutation(attributes)?)?
        }
        "matmul" => matmul_optimized(inputs)?,
        "matmul-reference" => matmul_reference(inputs)?,
        "sum" | "mean" | "max" => {
            require_arity(inputs, 1)?;
            reduction(&inputs[0], operation, attribute_usize(attributes, "axis")?)?
        }
        "softmax" | "layer-norm" | "rms-norm" => {
            require_arity(inputs, 1)?;
            let epsilon = attributes
                .get("epsilon")
                .and_then(Value::as_f64)
                .unwrap_or(1e-5);
            normalized(&inputs[0], operation, epsilon)?
        }
        _ => {
            return Err(EngineError::new(
                "RCL_TENSOR_OPERATION_UNSUPPORTED",
                format!("Unsupported operation {operation}"),
            ));
        }
    };
    let kernel_nanos = start.elapsed().as_nanos();
    if data.iter().any(|value| !value.is_finite()) {
        return Err(EngineError::new(
            "RCL_TENSOR_NONFINITE_OUTPUT",
            "Kernel produced a non-finite output",
        ));
    }
    let storage_identity = output_identity(&inputs[0].descriptor.dtype, &shape, &data);
    let semantic_operation = if operation == "matmul-reference" {
        "matmul"
    } else {
        operation
    };
    let tensor = TensorDescriptor {
        id: "result".into(),
        shape,
        dtype: inputs[0].descriptor.dtype.clone(),
        layout: "row-major".into(),
        device: inputs[0].descriptor.device.clone(),
        gradient_identity: format!("derived:{semantic_operation}"),
        storage_identity: storage_identity.clone(),
    };
    let element_count = data.len();
    Ok(ExecutionResult {
        format: RESPONSE_FORMAT,
        status: "ok",
        tensor,
        storage: DenseStorage {
            identity: storage_identity,
            kind: "cpu-dense".into(),
            data,
        },
        telemetry: Telemetry {
            backend: "rcl-tensor-cpu-rust-v0.1",
            kernel: operation.into(),
            kernel_nanos,
            element_count,
            allocated_bytes: element_count * std::mem::size_of::<f64>(),
        },
    })
}

pub fn execute(request: &ExecutionRequest) -> Result<ExecutionResult, EngineError> {
    let inputs = bind(request)?;
    execute_bound(&request.operation, &request.attributes, &inputs)
}

fn validate_plan_initials(
    plan: &ExecutionPlan,
) -> Result<HashMap<String, (TensorDescriptor, DenseStorage)>, EngineError> {
    if plan.format != PLAN_REQUEST_FORMAT {
        return Err(EngineError::new(
            "RCL_TENSOR_PLAN_FORMAT",
            format!("Unsupported plan format {}", plan.format),
        ));
    }
    if !plan.bindings.is_object() {
        return Err(EngineError::new(
            "RCL_TENSOR_PLAN_BINDINGS",
            "Plan bindings must be a JSON object",
        ));
    }
    if plan.tensors.is_empty() || plan.tensors.len() > MAX_PLAN_INITIAL_TENSORS {
        return Err(EngineError::new(
            "RCL_TENSOR_PLAN_INITIAL_LIMIT",
            format!(
                "Plan initial tensor count {} is outside 1..={MAX_PLAN_INITIAL_TENSORS}",
                plan.tensors.len()
            ),
        ));
    }
    let mut storage_ids = HashSet::new();
    let mut storage_map = HashMap::new();
    for storage in &plan.storages {
        if storage.identity.is_empty() || !storage_ids.insert(storage.identity.as_str()) {
            return Err(EngineError::new(
                "RCL_TENSOR_STORAGE_DUPLICATE",
                format!("Missing or duplicate storage identity {}", storage.identity),
            ));
        }
        if storage.kind != "cpu-dense" {
            return Err(EngineError::new(
                "RCL_TENSOR_STORAGE_KIND",
                format!("Unsupported storage kind {}", storage.kind),
            ));
        }
        if storage.data.iter().any(|value| !value.is_finite()) {
            return Err(EngineError::new(
                "RCL_TENSOR_NONFINITE_INPUT",
                format!("Storage {} contains a non-finite value", storage.identity),
            ));
        }
        storage_map.insert(storage.identity.clone(), storage.clone());
    }
    for (storage_identity, bit_values) in &plan.exact_storage_bits {
        let storage = storage_map.get_mut(storage_identity).ok_or_else(|| {
            EngineError::new(
                "RCL_TENSOR_EXACT_STORAGE_MISSING",
                format!("Exact bits reference unavailable storage {storage_identity}"),
            )
        })?;
        if bit_values.len() != storage.data.len() {
            return Err(EngineError::new(
                "RCL_TENSOR_EXACT_STORAGE_LENGTH",
                format!("Exact bits for {storage_identity} do not match storage length"),
            ));
        }
        storage.data = bit_values
            .iter()
            .map(|bits| {
                if bits.len() != 16 {
                    return Err(EngineError::new(
                        "RCL_TENSOR_EXACT_STORAGE_BITS",
                        format!(
                            "Exact f64 bits must contain 16 hexadecimal digits, received {bits}"
                        ),
                    ));
                }
                let parsed = u64::from_str_radix(bits, 16).map_err(|_| {
                    EngineError::new(
                        "RCL_TENSOR_EXACT_STORAGE_BITS",
                        format!("Invalid exact f64 bits {bits}"),
                    )
                })?;
                let value = f64::from_bits(parsed);
                if !value.is_finite() {
                    return Err(EngineError::new(
                        "RCL_TENSOR_NONFINITE_INPUT",
                        format!("Exact bits for {storage_identity} decode to a non-finite value"),
                    ));
                }
                Ok(value)
            })
            .collect::<Result<Vec<_>, _>>()?;
    }
    let mut values = HashMap::new();
    for tensor in &plan.tensors {
        if tensor.id.is_empty() || values.contains_key(&tensor.id) {
            return Err(EngineError::new(
                "RCL_TENSOR_ID_DUPLICATE",
                format!("Missing or duplicate tensor id {}", tensor.id),
            ));
        }
        if tensor.dtype != "f64" || tensor.layout != "row-major" || tensor.device != "cpu" {
            return Err(EngineError::new(
                "RCL_TENSOR_PLAN_DESCRIPTOR",
                format!(
                    "Tensor {} is outside the f64/row-major/cpu v0.1 profile",
                    tensor.id
                ),
            ));
        }
        if tensor.gradient_identity.is_empty() {
            return Err(EngineError::new(
                "RCL_TENSOR_GRADIENT_IDENTITY",
                format!("Tensor {} has no Gradient Identity", tensor.id),
            ));
        }
        let storage = storage_map
            .get(tensor.storage_identity.as_str())
            .ok_or_else(|| {
                EngineError::new(
                    "RCL_TENSOR_STORAGE_MISSING",
                    format!("Storage {} is not present", tensor.storage_identity),
                )
            })?;
        if product(&tensor.shape)? != storage.data.len() {
            return Err(EngineError::new(
                "RCL_TENSOR_STORAGE_SHAPE_MISMATCH",
                format!("Tensor {} shape does not match its storage", tensor.id),
            ));
        }
        values.insert(tensor.id.clone(), (tensor.clone(), storage.clone()));
    }
    Ok(values)
}

pub fn execute_plan(plan: &ExecutionPlan) -> Result<ExecutionPlanResult, EngineError> {
    if plan.nodes.is_empty() || plan.nodes.len() > MAX_PLAN_NODES {
        return Err(EngineError::new(
            "RCL_TENSOR_PLAN_NODE_LIMIT",
            format!(
                "Plan node count {} is outside 1..={MAX_PLAN_NODES}",
                plan.nodes.len()
            ),
        ));
    }
    if plan.outputs.is_empty() || plan.outputs.len() > MAX_PLAN_OUTPUTS {
        return Err(EngineError::new(
            "RCL_TENSOR_PLAN_OUTPUT_LIMIT",
            format!(
                "Plan output count {} is outside 1..={MAX_PLAN_OUTPUTS}",
                plan.outputs.len()
            ),
        ));
    }
    let mut values = validate_plan_initials(plan)?;
    let mut cumulative_allocated_elements = values
        .values()
        .map(|(_, storage)| storage.data.len())
        .sum::<usize>();
    if cumulative_allocated_elements > MAX_PLAN_ALLOCATED_ELEMENTS {
        return Err(EngineError::new(
            "RCL_TENSOR_PLAN_MEMORY_LIMIT",
            "Initial plan storage exceeds the element limit",
        ));
    }

    let mut requested_output_ids = HashSet::new();
    for output_id in &plan.outputs {
        if !requested_output_ids.insert(output_id.as_str()) {
            return Err(EngineError::new(
                "RCL_TENSOR_PLAN_OUTPUT_DUPLICATE",
                format!("Duplicate requested output {output_id}"),
            ));
        }
    }

    // Validate the complete SSA graph before execution. This separate definition set is
    // required because dead values may be reclaimed from `values` during execution.
    let mut node_ids = HashSet::new();
    let mut defined_ids = values.keys().cloned().collect::<HashSet<_>>();
    let mut remaining_uses = HashMap::<String, usize>::new();
    for node in &plan.nodes {
        if node.id.is_empty() || !node_ids.insert(node.id.as_str()) {
            return Err(EngineError::new(
                "RCL_TENSOR_PLAN_NODE_DUPLICATE",
                format!("Missing or duplicate node id {}", node.id),
            ));
        }
        if node.output.id.is_empty() || defined_ids.contains(&node.output.id) {
            return Err(EngineError::new(
                "RCL_TENSOR_PLAN_SSA_VIOLATION",
                format!(
                    "Output tensor id {} is missing or already defined",
                    node.output.id
                ),
            ));
        }
        if node.output.gradient_identity.is_empty() {
            return Err(EngineError::new(
                "RCL_TENSOR_GRADIENT_IDENTITY",
                format!("Output tensor {} has no Gradient Identity", node.output.id),
            ));
        }
        for input_id in &node.inputs {
            if !defined_ids.contains(input_id) {
                return Err(EngineError::new(
                    "RCL_TENSOR_PLAN_INPUT_MISSING",
                    format!("Node {} references unavailable tensor {input_id}", node.id),
                ));
            }
            *remaining_uses.entry(input_id.clone()).or_default() += 1;
        }
        defined_ids.insert(node.output.id.clone());
    }
    for output_id in &plan.outputs {
        if !defined_ids.contains(output_id) {
            return Err(EngineError::new(
                "RCL_TENSOR_PLAN_OUTPUT_MISSING",
                format!("Requested output {output_id} is unavailable"),
            ));
        }
    }

    let mut live_elements = cumulative_allocated_elements;
    let mut peak_live_elements = live_elements;
    let mut reclaimed_tensor_count = 0usize;
    let mut reclaimed_elements = 0usize;
    let mut input_binding_count = 0usize;
    let mut avoided_input_clone_elements = 0usize;
    let unused_initials = values
        .keys()
        .filter(|id| {
            !remaining_uses.contains_key(id.as_str()) && !requested_output_ids.contains(id.as_str())
        })
        .cloned()
        .collect::<Vec<_>>();
    for id in unused_initials {
        if let Some((_, storage)) = values.remove(&id) {
            live_elements -= storage.data.len();
            reclaimed_elements += storage.data.len();
            reclaimed_tensor_count += 1;
        }
    }

    for node in &plan.nodes {
        let mut result = {
            let mut inputs = Vec::with_capacity(node.inputs.len());
            let mut unique_input_storage_ids = HashSet::new();
            for input_id in &node.inputs {
                let (tensor, storage) = values.get(input_id).ok_or_else(|| {
                    EngineError::new(
                        "RCL_TENSOR_PLAN_INPUT_MISSING",
                        format!("Node {} references unavailable tensor {input_id}", node.id),
                    )
                })?;
                input_binding_count += 1;
                if unique_input_storage_ids.insert(storage.identity.as_str()) {
                    avoided_input_clone_elements = avoided_input_clone_elements
                        .checked_add(storage.data.len())
                        .ok_or_else(|| {
                            EngineError::new(
                                "RCL_TENSOR_PLAN_MEMORY_LIMIT",
                                "Plan avoided-clone accounting overflowed",
                            )
                        })?;
                }
                inputs.push(BoundTensor {
                    descriptor: tensor,
                    data: storage.data.as_slice(),
                });
            }
            execute_bound(&node.operation, &node.attributes, &inputs)?
        };
        if result.tensor.shape != node.output.shape
            || result.tensor.dtype != node.output.dtype
            || result.tensor.layout != node.output.layout
            || result.tensor.device != node.output.device
        {
            return Err(EngineError::new(
                "RCL_TENSOR_PLAN_OUTPUT_DESCRIPTOR",
                format!(
                    "Node {} result does not match declared output {}",
                    node.id, node.output.id
                ),
            ));
        }
        result.tensor.id = node.output.id.clone();
        result.tensor.gradient_identity = node.output.gradient_identity.clone();
        let output_elements = result.storage.data.len();
        cumulative_allocated_elements = cumulative_allocated_elements
            .checked_add(result.storage.data.len())
            .ok_or_else(|| {
                EngineError::new(
                    "RCL_TENSOR_PLAN_MEMORY_LIMIT",
                    "Plan element accounting overflowed",
                )
            })?;
        if cumulative_allocated_elements > MAX_PLAN_ALLOCATED_ELEMENTS {
            return Err(EngineError::new(
                "RCL_TENSOR_PLAN_MEMORY_LIMIT",
                format!(
                    "Plan cumulatively allocates {cumulative_allocated_elements} elements; limit is {MAX_PLAN_ALLOCATED_ELEMENTS}"
                ),
            ));
        }

        let transient_live_elements =
            live_elements.checked_add(output_elements).ok_or_else(|| {
                EngineError::new(
                    "RCL_TENSOR_PLAN_MEMORY_LIMIT",
                    "Plan live element accounting overflowed",
                )
            })?;
        peak_live_elements = peak_live_elements.max(transient_live_elements);
        if transient_live_elements > MAX_PLAN_LIVE_ELEMENTS {
            return Err(EngineError::new(
                "RCL_TENSOR_PLAN_LIVE_MEMORY_LIMIT",
                format!(
                    "Plan has {transient_live_elements} simultaneously live elements; limit is {MAX_PLAN_LIVE_ELEMENTS}"
                ),
            ));
        }

        let mut reclaim_inputs = Vec::new();
        for input_id in &node.inputs {
            let remaining = remaining_uses.get_mut(input_id).ok_or_else(|| {
                EngineError::new(
                    "RCL_TENSOR_PLAN_LIVENESS_INVALID",
                    format!("Node {} has no liveness entry for {input_id}", node.id),
                )
            })?;
            *remaining = remaining.checked_sub(1).ok_or_else(|| {
                EngineError::new(
                    "RCL_TENSOR_PLAN_LIVENESS_INVALID",
                    format!("Node {} over-consumes tensor {input_id}", node.id),
                )
            })?;
            if *remaining == 0 && !requested_output_ids.contains(input_id.as_str()) {
                reclaim_inputs.push(input_id.clone());
            }
        }
        for input_id in reclaim_inputs {
            if let Some((_, storage)) = values.remove(&input_id) {
                live_elements -= storage.data.len();
                reclaimed_elements += storage.data.len();
                reclaimed_tensor_count += 1;
            }
        }

        if remaining_uses.contains_key(&node.output.id)
            || requested_output_ids.contains(node.output.id.as_str())
        {
            live_elements = live_elements.checked_add(output_elements).ok_or_else(|| {
                EngineError::new(
                    "RCL_TENSOR_PLAN_MEMORY_LIMIT",
                    "Plan live element accounting overflowed",
                )
            })?;
            values.insert(node.output.id.clone(), (result.tensor, result.storage));
        } else {
            reclaimed_elements += output_elements;
            reclaimed_tensor_count += 1;
        }
    }
    let mut outputs = Vec::with_capacity(plan.outputs.len());
    for output_id in &plan.outputs {
        let (tensor, storage) = values.get(output_id).ok_or_else(|| {
            EngineError::new(
                "RCL_TENSOR_PLAN_OUTPUT_MISSING",
                format!("Requested output {output_id} is unavailable"),
            )
        })?;
        outputs.push(PlanTensorResult {
            tensor: tensor.clone(),
            storage: storage.clone(),
        });
    }
    let retained_output_elements = outputs
        .iter()
        .map(|output| output.storage.data.len())
        .sum::<usize>();
    debug_assert_eq!(live_elements, retained_output_elements);
    let element_bytes = std::mem::size_of::<f64>();
    Ok(ExecutionPlanResult {
        format: PLAN_RESPONSE_FORMAT,
        status: "ok",
        bindings: plan.bindings.clone(),
        outputs,
        telemetry: PlanTelemetry {
            backend: "rcl-tensor-cpu-rust-v0.1",
            node_count: plan.nodes.len(),
            stored_elements: cumulative_allocated_elements,
            allocated_bytes: cumulative_allocated_elements * element_bytes,
            cumulative_allocated_elements,
            cumulative_allocated_bytes: cumulative_allocated_elements * element_bytes,
            live_elements,
            live_bytes: live_elements * element_bytes,
            peak_live_elements,
            peak_live_bytes: peak_live_elements * element_bytes,
            retained_output_elements,
            retained_output_bytes: retained_output_elements * element_bytes,
            reclaimed_tensor_count,
            reclaimed_elements,
            input_binding_count,
            borrowed_input_binding_count: input_binding_count,
            avoided_input_clone_elements,
            avoided_input_clone_bytes: avoided_input_clone_elements * element_bytes,
            cloned_input_elements: 0,
            cloned_input_bytes: 0,
        },
    })
}

fn error_json(code: &'static str, message: impl Into<String>) -> String {
    serde_json::to_string(&json!({"status":"error","code":code,"message":message.into()})).unwrap()
}

pub fn execute_json(request_json: &str) -> Result<String, String> {
    let value: Value = serde_json::from_str(request_json)
        .map_err(|error| error_json("RCL_TENSOR_REQUEST_JSON", error.to_string()))?;
    let format = value
        .get("format")
        .and_then(Value::as_str)
        .ok_or_else(|| error_json("RCL_TENSOR_REQUEST_FORMAT", "Request format is required"))?;
    let result = match format {
        REQUEST_FORMAT => {
            let request: ExecutionRequest = serde_json::from_value(value)
                .map_err(|error| error_json("RCL_TENSOR_REQUEST_JSON", error.to_string()))?;
            execute(&request).and_then(|result| {
                serde_json::to_string(&result).map_err(|error| {
                    EngineError::new("RCL_TENSOR_RESPONSE_JSON", error.to_string())
                })
            })
        }
        PLAN_REQUEST_FORMAT => {
            let plan: ExecutionPlan = serde_json::from_value(value)
                .map_err(|error| error_json("RCL_TENSOR_REQUEST_JSON", error.to_string()))?;
            execute_plan(&plan).and_then(|result| {
                serde_json::to_string(&result).map_err(|error| {
                    EngineError::new("RCL_TENSOR_RESPONSE_JSON", error.to_string())
                })
            })
        }
        PLAN_FILE_REQUEST_FORMAT => {
            let request: PlanFileRequest = serde_json::from_value(value)
                .map_err(|error| error_json("RCL_TENSOR_REQUEST_JSON", error.to_string()))?;
            if request.format != PLAN_FILE_REQUEST_FORMAT {
                return Err(error_json(
                    "RCL_TENSOR_PLAN_FILE_FORMAT",
                    "Unsupported plan file request",
                ));
            }
            let metadata = fs::metadata(&request.path)
                .map_err(|error| error_json("RCL_TENSOR_PLAN_FILE_IO", error.to_string()))?;
            if !metadata.is_file() || metadata.len() > MAX_PLAN_FILE_BYTES {
                return Err(error_json(
                    "RCL_TENSOR_PLAN_FILE_LIMIT",
                    format!(
                        "Plan file must be a regular file no larger than {MAX_PLAN_FILE_BYTES} bytes"
                    ),
                ));
            }
            let bytes = fs::read(&request.path)
                .map_err(|error| error_json("RCL_TENSOR_PLAN_FILE_IO", error.to_string()))?;
            let actual = hex::encode(Sha256::digest(&bytes));
            if actual != request.sha256 {
                return Err(error_json(
                    "RCL_TENSOR_PLAN_FILE_HASH",
                    format!(
                        "Plan file hash mismatch: expected {}, received {actual}",
                        request.sha256
                    ),
                ));
            }
            let plan: ExecutionPlan = serde_json::from_slice(&bytes)
                .map_err(|error| error_json("RCL_TENSOR_REQUEST_JSON", error.to_string()))?;
            execute_plan(&plan).and_then(|result| {
                serde_json::to_string(&result).map_err(|error| {
                    EngineError::new("RCL_TENSOR_RESPONSE_JSON", error.to_string())
                })
            })
        }
        AUTODIFF_REQUEST_FORMAT => {
            let request: AutodiffRequest = serde_json::from_value(value)
                .map_err(|error| error_json("RCL_AUTODIFF_REQUEST_JSON", error.to_string()))?;
            backward(&request).and_then(|result| {
                serde_json::to_string(&result).map_err(|error| {
                    EngineError::new("RCL_AUTODIFF_RESPONSE_JSON", error.to_string())
                })
            })
        }
        AUTODIFF_SGD_TRAINING_REQUEST_FORMAT => {
            let request: AutodiffSgdTrainingRequest = serde_json::from_value(value)
                .map_err(|error| error_json("RCL_AUTODIFF_REQUEST_JSON", error.to_string()))?;
            train_sgd(&request).and_then(|result| {
                serde_json::to_string(&result).map_err(|error| {
                    EngineError::new("RCL_AUTODIFF_RESPONSE_JSON", error.to_string())
                })
            })
        }
        _ => {
            return Err(error_json(
                "RCL_TENSOR_REQUEST_FORMAT",
                format!("Unsupported request format {format}"),
            ));
        }
    };
    result.map_err(|error| error_json(error.code, error.message))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tensor(id: &str, shape: Vec<usize>, storage: &str) -> TensorDescriptor {
        TensorDescriptor {
            id: id.into(),
            shape,
            dtype: "f64".into(),
            layout: "row-major".into(),
            device: "cpu".into(),
            gradient_identity: format!("parameter:{id}"),
            storage_identity: storage.into(),
        }
    }

    fn request(
        operation: &str,
        tensors: Vec<TensorDescriptor>,
        storages: Vec<DenseStorage>,
    ) -> ExecutionRequest {
        ExecutionRequest {
            format: REQUEST_FORMAT.into(),
            operation: operation.into(),
            tensors,
            storages,
            attributes: json!({}),
        }
    }

    #[test]
    fn optimized_matmul_matches_reference_exactly_for_integer_fixture() {
        let tensors = vec![tensor("a", vec![2, 3], "a"), tensor("b", vec![3, 2], "b")];
        let storages = vec![
            DenseStorage {
                identity: "a".into(),
                kind: "cpu-dense".into(),
                data: vec![1., 2., 3., 4., 5., 6.],
            },
            DenseStorage {
                identity: "b".into(),
                kind: "cpu-dense".into(),
                data: vec![7., 8., 9., 10., 11., 12.],
            },
        ];
        let optimized = execute(&request("matmul", tensors.clone(), storages.clone())).unwrap();
        let reference = execute(&request("matmul-reference", tensors, storages)).unwrap();
        assert_eq!(optimized.storage.data, vec![58., 64., 139., 154.]);
        assert_eq!(optimized.storage.data, reference.storage.data);
        assert_eq!(optimized.storage.identity, reference.storage.identity);
        assert_eq!(
            optimized.tensor.gradient_identity,
            reference.tensor.gradient_identity
        );
    }

    #[test]
    fn invalid_shape_and_domain_fail_closed() {
        let bad = request(
            "matmul",
            vec![tensor("a", vec![2, 3], "a"), tensor("b", vec![4, 1], "b")],
            vec![
                DenseStorage {
                    identity: "a".into(),
                    kind: "cpu-dense".into(),
                    data: vec![0.; 6],
                },
                DenseStorage {
                    identity: "b".into(),
                    kind: "cpu-dense".into(),
                    data: vec![0.; 4],
                },
            ],
        );
        assert_eq!(execute(&bad).unwrap_err().code, "RCL_TENSOR_MATMUL_SHAPE");
        let negative = request(
            "log",
            vec![tensor("a", vec![1], "a")],
            vec![DenseStorage {
                identity: "a".into(),
                kind: "cpu-dense".into(),
                data: vec![-1.],
            }],
        );
        assert_eq!(
            execute(&negative).unwrap_err().code,
            "RCL_TENSOR_LOG_DOMAIN"
        );
    }

    #[test]
    fn elementwise_reduction_and_normalization_primitives_are_correct() {
        let a = tensor("a", vec![2, 3], "a");
        let row = tensor("row", vec![1, 3], "row");
        let storage_a = DenseStorage {
            identity: "a".into(),
            kind: "cpu-dense".into(),
            data: vec![1., 2., 3., 4., 5., 6.],
        };
        let storage_row = DenseStorage {
            identity: "row".into(),
            kind: "cpu-dense".into(),
            data: vec![10., 20., 30.],
        };
        let add = execute(&request(
            "add",
            vec![a.clone(), row],
            vec![storage_a.clone(), storage_row],
        ))
        .unwrap();
        assert_eq!(add.storage.data, vec![11., 22., 33., 14., 25., 36.]);

        for (operation, expected) in [
            ("sum", vec![6., 15.]),
            ("mean", vec![2., 5.]),
            ("max", vec![3., 6.]),
        ] {
            let mut reduction_request =
                request(operation, vec![a.clone()], vec![storage_a.clone()]);
            reduction_request.attributes = json!({"axis": 1});
            assert_eq!(execute(&reduction_request).unwrap().storage.data, expected);
        }

        let softmax = execute(&request(
            "softmax",
            vec![a.clone()],
            vec![storage_a.clone()],
        ))
        .unwrap();
        for row in softmax.storage.data.chunks(3) {
            assert!((row.iter().sum::<f64>() - 1.0).abs() < 1e-12);
            assert!(row[0] < row[1] && row[1] < row[2]);
        }
        for operation in ["layer-norm", "rms-norm"] {
            let normalized = execute(&request(
                operation,
                vec![a.clone()],
                vec![storage_a.clone()],
            ))
            .unwrap();
            assert_eq!(normalized.tensor.shape, vec![2, 3]);
            assert!(
                normalized
                    .storage
                    .data
                    .iter()
                    .all(|value| value.is_finite())
            );
        }
    }

    #[test]
    fn storage_device_dtype_and_resource_boundaries_fail_closed() {
        let mut f32 = tensor("b", vec![1], "b");
        f32.dtype = "f32".into();
        let mismatch = request(
            "add",
            vec![tensor("a", vec![1], "a"), f32],
            vec![
                DenseStorage {
                    identity: "a".into(),
                    kind: "cpu-dense".into(),
                    data: vec![1.],
                },
                DenseStorage {
                    identity: "b".into(),
                    kind: "cpu-dense".into(),
                    data: vec![1.],
                },
            ],
        );
        assert_eq!(
            execute(&mismatch).unwrap_err().code,
            "RCL_TENSOR_DTYPE_MISMATCH"
        );
        let mut gpu = tensor("a", vec![1], "a");
        gpu.device = "gpu:0".into();
        let device = request(
            "sqrt",
            vec![gpu],
            vec![DenseStorage {
                identity: "a".into(),
                kind: "cpu-dense".into(),
                data: vec![1.],
            }],
        );
        assert_eq!(
            execute(&device).unwrap_err().code,
            "RCL_TENSOR_DEVICE_MISMATCH"
        );
        let oversized = request(
            "sqrt",
            vec![tensor("a", vec![MAX_ELEMENTS + 1], "a")],
            vec![DenseStorage {
                identity: "a".into(),
                kind: "cpu-dense".into(),
                data: vec![],
            }],
        );
        assert_eq!(
            execute(&oversized).unwrap_err().code,
            "RCL_TENSOR_ELEMENT_LIMIT"
        );
    }

    fn plan_output(id: &str, shape: Vec<usize>) -> PlanOutputDescriptor {
        PlanOutputDescriptor {
            id: id.into(),
            shape,
            dtype: "f64".into(),
            layout: "row-major".into(),
            device: "cpu".into(),
            gradient_identity: format!("derived:{id}"),
        }
    }

    #[test]
    fn transpose_and_generic_plan_execute_as_declared_ssa() {
        let plan = ExecutionPlan {
            format: PLAN_REQUEST_FORMAT.into(),
            bindings: json!({"semanticSource":"fixture"}),
            tensors: vec![
                tensor("x", vec![2, 3], "x"),
                tensor("column", vec![2, 1], "column"),
            ],
            storages: vec![
                DenseStorage {
                    identity: "x".into(),
                    kind: "cpu-dense".into(),
                    data: vec![1., 2., 3., 4., 5., 6.],
                },
                DenseStorage {
                    identity: "column".into(),
                    kind: "cpu-dense".into(),
                    data: vec![10., 20.],
                },
            ],
            exact_storage_bits: HashMap::new(),
            nodes: vec![
                PlanNode {
                    id: "transpose-x".into(),
                    operation: "transpose".into(),
                    inputs: vec!["x".into()],
                    output: plan_output("x-t", vec![3, 2]),
                    attributes: json!({"permutation":[1,0]}),
                },
                PlanNode {
                    id: "matmul".into(),
                    operation: "matmul".into(),
                    inputs: vec!["x-t".into(), "column".into()],
                    output: plan_output("result", vec![3, 1]),
                    attributes: json!({}),
                },
            ],
            outputs: vec!["x-t".into(), "result".into()],
        };
        let result = execute_plan(&plan).unwrap();
        assert_eq!(result.outputs[0].storage.data, vec![1., 4., 2., 5., 3., 6.]);
        assert_eq!(result.outputs[1].storage.data, vec![90., 120., 150.]);
        assert_eq!(result.telemetry.node_count, 2);
        assert_eq!(result.telemetry.cumulative_allocated_elements, 17);
        assert_eq!(result.telemetry.peak_live_elements, 14);
        assert_eq!(result.telemetry.live_elements, 9);
        assert_eq!(result.telemetry.retained_output_elements, 9);
        assert_eq!(result.telemetry.reclaimed_tensor_count, 2);
        assert_eq!(result.telemetry.reclaimed_elements, 8);
        assert_eq!(result.telemetry.input_binding_count, 3);
        assert_eq!(result.telemetry.borrowed_input_binding_count, 3);
        assert_eq!(result.telemetry.avoided_input_clone_elements, 14);
        assert_eq!(result.telemetry.avoided_input_clone_bytes, 112);
        assert_eq!(result.telemetry.cloned_input_elements, 0);
        assert_eq!(result.telemetry.cloned_input_bytes, 0);
        assert_eq!(result.bindings["semanticSource"], "fixture");
    }

    #[test]
    fn generic_plan_reclaims_dead_values_but_pins_requested_intermediates() {
        let plan = ExecutionPlan {
            format: PLAN_REQUEST_FORMAT.into(),
            bindings: json!({}),
            tensors: vec![
                tensor("x", vec![2], "x"),
                tensor("unused", vec![1], "unused"),
            ],
            storages: vec![
                DenseStorage {
                    identity: "x".into(),
                    kind: "cpu-dense".into(),
                    data: vec![-2., 3.],
                },
                DenseStorage {
                    identity: "unused".into(),
                    kind: "cpu-dense".into(),
                    data: vec![99.],
                },
            ],
            exact_storage_bits: HashMap::new(),
            nodes: vec![
                PlanNode {
                    id: "double".into(),
                    operation: "add".into(),
                    inputs: vec!["x".into(), "x".into()],
                    output: plan_output("doubled", vec![2]),
                    attributes: json!({}),
                },
                PlanNode {
                    id: "dead".into(),
                    operation: "abs".into(),
                    inputs: vec!["doubled".into()],
                    output: plan_output("dead-output", vec![2]),
                    attributes: json!({}),
                },
            ],
            outputs: vec!["doubled".into()],
        };
        let result = execute_plan(&plan).unwrap();
        assert_eq!(result.outputs[0].storage.data, vec![-4., 6.]);
        assert_eq!(result.telemetry.cumulative_allocated_elements, 7);
        assert_eq!(result.telemetry.peak_live_elements, 4);
        assert_eq!(result.telemetry.live_elements, 2);
        assert_eq!(result.telemetry.retained_output_elements, 2);
        assert_eq!(result.telemetry.reclaimed_tensor_count, 3);
        assert_eq!(result.telemetry.reclaimed_elements, 5);
        assert_eq!(result.telemetry.input_binding_count, 3);
        assert_eq!(result.telemetry.avoided_input_clone_elements, 4);
        assert_eq!(result.telemetry.cloned_input_elements, 0);
    }

    #[test]
    fn generic_plan_rejects_missing_inputs_shape_drift_and_ssa_redefinition() {
        let base = ExecutionPlan {
            format: PLAN_REQUEST_FORMAT.into(),
            bindings: json!({}),
            tensors: vec![tensor("x", vec![1], "x")],
            storages: vec![DenseStorage {
                identity: "x".into(),
                kind: "cpu-dense".into(),
                data: vec![1.],
            }],
            exact_storage_bits: HashMap::new(),
            nodes: vec![PlanNode {
                id: "abs".into(),
                operation: "abs".into(),
                inputs: vec!["missing".into()],
                output: plan_output("out", vec![1]),
                attributes: json!({}),
            }],
            outputs: vec!["out".into()],
        };
        assert_eq!(
            execute_plan(&base).unwrap_err().code,
            "RCL_TENSOR_PLAN_INPUT_MISSING"
        );
        let mut empty_inputs = base.clone();
        empty_inputs.nodes[0].inputs.clear();
        assert_eq!(
            execute_plan(&empty_inputs).unwrap_err().code,
            "RCL_TENSOR_INPUT_REQUIRED"
        );
        let mut shape_drift = base.clone();
        shape_drift.nodes[0].inputs[0] = "x".into();
        shape_drift.nodes[0].output.shape = vec![2];
        assert_eq!(
            execute_plan(&shape_drift).unwrap_err().code,
            "RCL_TENSOR_PLAN_OUTPUT_DESCRIPTOR"
        );
        let mut exact_bits = base.clone();
        exact_bits.nodes[0].inputs[0] = "x".into();
        exact_bits
            .exact_storage_bits
            .insert("x".into(), vec![format!("{:016x}", (-2.0f64).to_bits())]);
        assert_eq!(
            execute_plan(&exact_bits).unwrap().outputs[0].storage.data,
            vec![2.0]
        );
        let mut redefinition = base;
        redefinition.nodes[0].inputs[0] = "x".into();
        redefinition.nodes[0].output.id = "x".into();
        redefinition.outputs[0] = "x".into();
        assert_eq!(
            execute_plan(&redefinition).unwrap_err().code,
            "RCL_TENSOR_PLAN_SSA_VIOLATION"
        );

        let mut reclaimed_redefinition = exact_bits;
        reclaimed_redefinition.nodes.push(PlanNode {
            id: "reuse".into(),
            operation: "abs".into(),
            inputs: vec!["out".into()],
            output: plan_output("out", vec![1]),
            attributes: json!({}),
        });
        assert_eq!(
            execute_plan(&reclaimed_redefinition).unwrap_err().code,
            "RCL_TENSOR_PLAN_SSA_VIOLATION"
        );
    }
}
