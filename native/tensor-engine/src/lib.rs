use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};
use std::time::Instant;

pub const REQUEST_FORMAT: &str = "rcl.tensor-execution-request.v0.1";
pub const RESPONSE_FORMAT: &str = "rcl.tensor-execution-result.v0.1";
pub const PROVIDER_ID: &str = "rcl.tensor.cpu";
pub const CAPABILITY: &str = "tensor.execute";
const MAX_TENSORS: usize = 8;
const MAX_RANK: usize = 8;
const MAX_ELEMENTS: usize = 16_777_216;

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

pub fn execute(request: &ExecutionRequest) -> Result<ExecutionResult, EngineError> {
    let inputs = bind(request)?;
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
    let (shape, data) = match request.operation.as_str() {
        "add" | "sub" | "mul" | "div" => elementwise(&inputs, &request.operation)?,
        "exp" | "log" | "sqrt" => {
            require_arity(&inputs, 1)?;
            unary(&inputs[0], &request.operation)?
        }
        "matmul" => matmul_optimized(&inputs)?,
        "matmul-reference" => matmul_reference(&inputs)?,
        "sum" | "mean" | "max" => {
            require_arity(&inputs, 1)?;
            reduction(
                &inputs[0],
                &request.operation,
                attribute_usize(&request.attributes, "axis")?,
            )?
        }
        "softmax" | "layer-norm" | "rms-norm" => {
            require_arity(&inputs, 1)?;
            let epsilon = request
                .attributes
                .get("epsilon")
                .and_then(Value::as_f64)
                .unwrap_or(1e-5);
            normalized(&inputs[0], &request.operation, epsilon)?
        }
        _ => {
            return Err(EngineError::new(
                "RCL_TENSOR_OPERATION_UNSUPPORTED",
                format!("Unsupported operation {}", request.operation),
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
    let semantic_operation = if request.operation == "matmul-reference" {
        "matmul"
    } else {
        request.operation.as_str()
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
            kernel: request.operation.clone(),
            kernel_nanos,
            element_count,
            allocated_bytes: element_count * std::mem::size_of::<f64>(),
        },
    })
}

pub fn execute_json(request_json: &str) -> Result<String, String> {
    let request: ExecutionRequest = serde_json::from_str(request_json).map_err(|error| {
        serde_json::to_string(
            &json!({"status":"error","code":"RCL_TENSOR_REQUEST_JSON","message":error.to_string()}),
        )
        .unwrap()
    })?;
    execute(&request)
        .map(|result| serde_json::to_string(&result).unwrap())
        .map_err(|error| {
            serde_json::to_string(
                &json!({"status":"error","code":error.code,"message":error.message}),
            )
            .unwrap()
        })
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
}
