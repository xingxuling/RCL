use super::*;
use serde_json::json;
use std::collections::{HashMap, HashSet};
use std::io::Write;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::time::Instant;

pub const AUTODIFF_REQUEST_FORMAT: &str = "rcl.tensor-autodiff-request.v0.1";
pub const AUTODIFF_RESPONSE_FORMAT: &str = "rcl.tensor-autodiff-result.v0.1";
pub const AUTODIFF_SGD_TRAINING_REQUEST_FORMAT: &str =
    "rcl.tensor-autodiff-sgd-training-request.v0.1";
pub const AUTODIFF_SGD_TRAINING_RESPONSE_FORMAT: &str =
    "rcl.tensor-autodiff-sgd-training-result.v0.1";
pub const BF16_AUTODIFF_PRECISION: &str = "bf16-rne-fp32-accumulation";
const MAX_PARAMETERS: usize = 256;
const MAX_TRAINING_STEPS: usize = 16_384;
const MAX_TRAINING_NODE_STEPS: usize = 2_000_000;

pub type ComputationGraph = ExecutionPlan;
pub type Operation = PlanNode;
pub type TensorValue = PlanTensorResult;

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Parameter {
    pub tensor_id: String,
    pub gradient_identity: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct StopGradient {
    pub tensor_id: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AutodiffRequest {
    pub format: String,
    pub graph: ComputationGraph,
    pub loss: String,
    pub parameters: Vec<Parameter>,
    #[serde(default)]
    pub stop_gradients: Vec<StopGradient>,
    #[serde(default)]
    pub precision: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackwardEdge {
    pub node_id: String,
    pub operation: String,
    pub output: String,
    pub input: String,
    pub input_index: usize,
    pub gradient_identity: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GradientAccumulator {
    pub tensor_count: usize,
    pub accumulation_count: usize,
    pub merge_count: usize,
    pub accumulated_elements: usize,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GradientTensorResult {
    pub parameter: Parameter,
    pub tensor: TensorDescriptor,
    pub storage: DenseStorage,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AutodiffTelemetry {
    pub backend: &'static str,
    pub execution_backend: String,
    pub forward_node_count: usize,
    pub backward_edge_count: usize,
    pub forward_nanos: u128,
    pub backward_nanos: u128,
    pub parameter_count: usize,
    pub gpu_matmul_nodes: usize,
    pub host_cpu_nodes: usize,
    pub gpu_execution_roots: Vec<String>,
    pub gpu_backward_matmul_nodes: usize,
    pub gpu_backward_execution_roots: Vec<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AutodiffResult {
    pub format: &'static str,
    pub status: &'static str,
    pub loss: TensorValue,
    pub gradients: Vec<GradientTensorResult>,
    pub backward_edges: Vec<BackwardEdge>,
    pub accumulator: GradientAccumulator,
    pub telemetry: AutodiffTelemetry,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AutodiffSgdTrainingRequest {
    pub format: String,
    pub autodiff: AutodiffRequest,
    pub steps: usize,
    pub learning_rate: f64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AutodiffSgdTrainingTelemetry {
    pub backend: &'static str,
    pub optimizer_semantics: &'static str,
    pub steps: usize,
    pub training_nanos: u128,
    pub parameter_bytes: usize,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AutodiffSgdTrainingResult {
    pub format: &'static str,
    pub status: &'static str,
    pub initial_loss: f64,
    pub final_loss: f64,
    pub parameters: Vec<TensorValue>,
    pub outputs: Vec<TensorValue>,
    pub telemetry: AutodiffSgdTrainingTelemetry,
}

#[derive(Clone)]
struct Gradient {
    shape: Vec<usize>,
    data: Vec<f64>,
}

#[derive(Clone, Debug)]
enum ExecutionMode {
    CpuReference,
    OpenClAmdHybrid { provider_path: PathBuf },
    OpenClAmdGpuTraining { provider_path: PathBuf },
}

impl ExecutionMode {
    fn device(&self) -> &'static str {
        match self {
            Self::CpuReference => "cpu",
            Self::OpenClAmdHybrid { .. } => "opencl-amd",
            Self::OpenClAmdGpuTraining { .. } => "opencl-amd",
        }
    }

    fn execution_backend(&self) -> String {
        match self {
            Self::CpuReference => "rcl-tensor-bf16-autodiff-adamw-cpu-reference-v0.2".into(),
            Self::OpenClAmdHybrid { .. } => {
                "rcl-tensor-bf16-autodiff-adamw-opencl-amd-hybrid-v0.1".into()
            }
            Self::OpenClAmdGpuTraining { .. } => {
                "rcl-tensor-bf16-autodiff-adamw-opencl-amd-gpu-training-v0.1".into()
            }
        }
    }

    fn provider_path(&self) -> Option<&PathBuf> {
        match self {
            Self::CpuReference => None,
            Self::OpenClAmdHybrid { provider_path }
            | Self::OpenClAmdGpuTraining { provider_path } => Some(provider_path),
        }
    }

    fn gpu_backward(&self) -> bool {
        matches!(self, Self::OpenClAmdGpuTraining { .. })
    }
}

#[derive(Default)]
struct ForwardExecutionTelemetry {
    gpu_matmul_nodes: usize,
    host_cpu_nodes: usize,
    gpu_execution_roots: Vec<String>,
}

fn execution_mode(graph: &ComputationGraph) -> Result<ExecutionMode, EngineError> {
    let backend = graph
        .bindings
        .get("backend")
        .and_then(Value::as_str)
        .unwrap_or("cpu-reference");
    match backend {
        "cpu-reference" => Ok(ExecutionMode::CpuReference),
        "opencl-amd-hybrid" | "opencl-amd-gpu-training" => {
            if graph
                .bindings
                .get("placementPolicy")
                .and_then(Value::as_str)
                != Some("explicit-per-node")
            {
                return Err(EngineError::new(
                    "RCL_ACCELERATOR_PLACEMENT_REQUIRED",
                    "opencl-amd-hybrid requires explicit-per-node placement policy",
                ));
            }
            let provider_path = graph
                .bindings
                .get("providerPath")
                .and_then(Value::as_str)
                .filter(|path| !path.is_empty())
                .map(PathBuf::from)
                .ok_or_else(|| {
                    EngineError::new(
                        "RCL_ACCELERATOR_PROVIDER_REQUIRED",
                        "opencl-amd-hybrid requires an explicit providerPath",
                    )
                })?;
            if backend == "opencl-amd-gpu-training" {
                Ok(ExecutionMode::OpenClAmdGpuTraining { provider_path })
            } else {
                Ok(ExecutionMode::OpenClAmdHybrid { provider_path })
            }
        }
        other => Err(EngineError::new(
            "RCL_ACCELERATOR_BACKEND_UNAVAILABLE",
            format!("unsupported Tensor execution backend {other}"),
        )),
    }
}

fn validate_hybrid_placements(
    graph: &ComputationGraph,
    mode: &ExecutionMode,
) -> Result<(), EngineError> {
    if !matches!(
        mode,
        ExecutionMode::OpenClAmdHybrid { .. } | ExecutionMode::OpenClAmdGpuTraining { .. }
    ) {
        return Ok(());
    }
    for node in &graph.nodes {
        let placement = node
            .attributes
            .get("placement")
            .and_then(Value::as_str)
            .ok_or_else(|| {
                EngineError::new(
                    "RCL_ACCELERATOR_PLACEMENT_REQUIRED",
                    format!("node {} must declare an explicit placement", node.id),
                )
            })?;
        match (node.operation.as_str(), placement) {
            ("matmul", "gpu") => {}
            ("matmul", _) => {
                return Err(EngineError::new(
                    "RCL_ACCELERATOR_GPU_PLACEMENT_REQUIRED",
                    format!("matmul node {} must be placed on the AMD GPU", node.id),
                ));
            }
            (_, "cpu-reference") => {}
            (_, _) => {
                return Err(EngineError::new(
                    "RCL_ACCELERATOR_PLACEMENT_UNSUPPORTED",
                    format!(
                        "node {} has unsupported placement {placement}; only explicit cpu-reference is allowed for non-matmul nodes",
                        node.id
                    ),
                ));
            }
        }
    }
    Ok(())
}

fn provider_error_code(value: &Value) -> &'static str {
    match value.get("code").and_then(Value::as_str) {
        Some("RCL_OPENCL_BACKEND_UNAVAILABLE") => "RCL_OPENCL_BACKEND_UNAVAILABLE",
        Some("RCL_OPENCL_AMD_DEVICE_REQUIRED") => "RCL_OPENCL_AMD_DEVICE_REQUIRED",
        Some("RCL_OPENCL_BF16_BITS") => "RCL_OPENCL_BF16_BITS",
        Some("RCL_OPENCL_BF16_NONFINITE") => "RCL_OPENCL_BF16_NONFINITE",
        Some("RCL_OPENCL_F32_BITS") => "RCL_OPENCL_F32_BITS",
        Some("RCL_OPENCL_F32_NONFINITE") => "RCL_OPENCL_F32_NONFINITE",
        Some("RCL_OPENCL_OPERATION") => "RCL_OPENCL_OPERATION",
        Some("RCL_OPENCL_ADAMW_CONFIG") => "RCL_OPENCL_ADAMW_CONFIG",
        Some("RCL_OPENCL_SHAPE") => "RCL_OPENCL_SHAPE",
        Some("RCL_OPENCL_KERNEL_BUILD") => "RCL_OPENCL_KERNEL_BUILD",
        _ => "RCL_ACCELERATOR_EXECUTION_FAILED",
    }
}

fn opencl_bits(input: &BoundTensor<'_>, label: &str) -> Result<Vec<String>, EngineError> {
    input
        .data
        .iter()
        .map(|value| {
            let narrowed = bf16_input(*value).map_err(|error| {
                EngineError::new(
                    "RCL_ACCELERATOR_INPUT_INVALID",
                    format!("{label}: {}", error.message),
                )
            })?;
            Ok(format!("{:04x}", bf16_bits(narrowed)))
        })
        .collect()
}

fn execute_opencl_matmul(
    node_id: &str,
    provider_path: &PathBuf,
    inputs: &[BoundTensor<'_>],
) -> Result<(ExecutionResult, String), EngineError> {
    require_arity(inputs, 2)?;
    let left = &inputs[0];
    let right = &inputs[1];
    if left.descriptor.shape.len() != 2 || right.descriptor.shape.len() != 2 {
        return Err(EngineError::new(
            "RCL_BF16_MATMUL_RANK",
            format!("GPU matmul node {node_id} requires rank-2 tensors"),
        ));
    }
    let rows = left.descriptor.shape[0];
    let shared = left.descriptor.shape[1];
    let right_shared = right.descriptor.shape[0];
    let columns = right.descriptor.shape[1];
    if shared != right_shared {
        return Err(EngineError::new(
            "RCL_BF16_MATMUL_SHAPE",
            format!("GPU matmul node {node_id} has incompatible inner dimensions"),
        ));
    }
    if !provider_path.is_file() {
        return Err(EngineError::new(
            "RCL_ACCELERATOR_PROVIDER_UNAVAILABLE",
            format!(
                "OpenCL provider path is not a file: {}",
                provider_path.display()
            ),
        ));
    }
    let payload = json!({
        "format": "rcl.opencl-bf16-matmul-request.v0.1",
        "backend": "opencl-amd",
        "rows": rows,
        "columns": columns,
        "shared": shared,
        "leftBits": opencl_bits(left, "left")?,
        "rightBits": opencl_bits(right, "right")?,
        "nodeId": node_id,
    });
    let python = std::env::var("RCL_PYTHON").unwrap_or_else(|_| {
        if cfg!(windows) {
            "python".into()
        } else {
            "python3".into()
        }
    });
    let mut child = Command::new(python)
        .arg(provider_path)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| {
            EngineError::new(
                "RCL_ACCELERATOR_PROVIDER_UNAVAILABLE",
                format!("could not start OpenCL provider: {error}"),
            )
        })?;
    let encoded = serde_json::to_vec(&payload).map_err(|error| {
        EngineError::new(
            "RCL_ACCELERATOR_REQUEST_JSON",
            format!("could not encode OpenCL provider request: {error}"),
        )
    })?;
    let mut stdin = child.stdin.take().ok_or_else(|| {
        EngineError::new(
            "RCL_ACCELERATOR_PROVIDER_UNAVAILABLE",
            "OpenCL provider stdin was unavailable",
        )
    })?;
    stdin.write_all(&encoded).map_err(|error| {
        EngineError::new(
            "RCL_ACCELERATOR_PROVIDER_UNAVAILABLE",
            format!("could not send OpenCL provider request: {error}"),
        )
    })?;
    drop(stdin);
    let output = child.wait_with_output().map_err(|error| {
        EngineError::new(
            "RCL_ACCELERATOR_EXECUTION_FAILED",
            format!("OpenCL provider process failed: {error}"),
        )
    })?;
    if !output.status.success() {
        let error_value = serde_json::from_slice::<Value>(&output.stderr).unwrap_or_else(
            |_| json!({"message": String::from_utf8_lossy(&output.stderr).to_string()}),
        );
        return Err(EngineError::new(
            provider_error_code(&error_value),
            error_value
                .get("message")
                .and_then(Value::as_str)
                .unwrap_or("OpenCL provider failed")
                .to_owned(),
        ));
    }
    let response: Value = serde_json::from_slice(&output.stdout).map_err(|error| {
        EngineError::new(
            "RCL_ACCELERATOR_RESPONSE_JSON",
            format!("OpenCL provider returned invalid JSON: {error}"),
        )
    })?;
    if response.get("format").and_then(Value::as_str) != Some("rcl.opencl-bf16-matmul-result.v0.1")
        || response.get("status").and_then(Value::as_str)
            != Some("PASS_LOCAL_GPU_REFERENCE_CANDIDATE")
        || response.get("backend").and_then(Value::as_str) != Some("opencl-amd")
        || response.get("gpuExecuted").and_then(Value::as_bool) != Some(true)
    {
        return Err(EngineError::new(
            "RCL_ACCELERATOR_RESPONSE_INVALID",
            format!("OpenCL provider did not return an admitted GPU result for node {node_id}"),
        ));
    }
    let execution_root = response
        .get("executionRoot")
        .and_then(Value::as_str)
        .filter(|root| root.len() == 64 && root.chars().all(|value| value.is_ascii_hexdigit()))
        .ok_or_else(|| {
            EngineError::new(
                "RCL_ACCELERATOR_RESPONSE_INVALID",
                format!("OpenCL provider omitted an execution root for node {node_id}"),
            )
        })?
        .to_owned();
    let output_bits = response
        .get("outputBits")
        .and_then(Value::as_array)
        .ok_or_else(|| {
            EngineError::new(
                "RCL_ACCELERATOR_RESPONSE_INVALID",
                "OpenCL provider omitted outputBits",
            )
        })?;
    if output_bits.len() != rows * columns {
        return Err(EngineError::new(
            "RCL_ACCELERATOR_RESPONSE_INVALID",
            format!("OpenCL provider returned the wrong output length for node {node_id}"),
        ));
    }
    let mut values = Vec::with_capacity(output_bits.len());
    for value in output_bits {
        let bits = value.as_str().ok_or_else(|| {
            EngineError::new(
                "RCL_ACCELERATOR_RESPONSE_INVALID",
                "OpenCL outputBits must contain lowercase hexadecimal strings",
            )
        })?;
        if bits.len() != 4 || bits.to_ascii_lowercase() != bits {
            return Err(EngineError::new(
                "RCL_ACCELERATOR_RESPONSE_INVALID",
                "OpenCL outputBits must contain four lowercase hexadecimal digits",
            ));
        }
        let parsed = u16::from_str_radix(bits, 16).map_err(|_| {
            EngineError::new(
                "RCL_ACCELERATOR_RESPONSE_INVALID",
                "OpenCL outputBits contains invalid hexadecimal digits",
            )
        })?;
        if parsed & 0x7f80 == 0x7f80 {
            return Err(EngineError::new(
                "RCL_ACCELERATOR_RESPONSE_INVALID",
                "OpenCL outputBits contains a non-finite BF16 value",
            ));
        }
        values.push(bf16_value(parsed) as f64);
    }
    let shape = vec![rows, columns];
    let storage_identity = output_identity("bf16", &shape, &values);
    Ok((
        ExecutionResult {
            format: RESPONSE_FORMAT,
            status: "ok",
            tensor: TensorDescriptor {
                id: "result".into(),
                shape: shape.clone(),
                dtype: "bf16".into(),
                layout: "row-major".into(),
                device: "opencl-amd".into(),
                gradient_identity: "derived:matmul".into(),
                storage_identity: storage_identity.clone(),
            },
            storage: DenseStorage {
                identity: storage_identity,
                kind: "opencl-host-staging".into(),
                data: values,
            },
            telemetry: Telemetry {
                backend: "rcl-tensor-opencl-amd-bf16-matmul-v0.1",
                kernel: "rcl_bf16_matmul".into(),
                kernel_nanos: 0,
                element_count: rows * columns,
                allocated_bytes: rows * columns * std::mem::size_of::<u16>(),
            },
        },
        execution_root,
    ))
}

fn execute_opencl_json(provider_path: &PathBuf, payload: &Value) -> Result<Value, EngineError> {
    if !provider_path.is_file() {
        return Err(EngineError::new(
            "RCL_ACCELERATOR_PROVIDER_UNAVAILABLE",
            format!(
                "OpenCL provider path is not a file: {}",
                provider_path.display()
            ),
        ));
    }
    let python = std::env::var("RCL_PYTHON").unwrap_or_else(|_| {
        if cfg!(windows) {
            "python".into()
        } else {
            "python3".into()
        }
    });
    let mut child = Command::new(python)
        .arg(provider_path)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| {
            EngineError::new(
                "RCL_ACCELERATOR_PROVIDER_UNAVAILABLE",
                format!("could not start OpenCL provider: {error}"),
            )
        })?;
    let encoded = serde_json::to_vec(payload).map_err(|error| {
        EngineError::new(
            "RCL_ACCELERATOR_REQUEST_JSON",
            format!("could not encode OpenCL provider request: {error}"),
        )
    })?;
    let mut stdin = child.stdin.take().ok_or_else(|| {
        EngineError::new(
            "RCL_ACCELERATOR_PROVIDER_UNAVAILABLE",
            "OpenCL provider stdin was unavailable",
        )
    })?;
    stdin.write_all(&encoded).map_err(|error| {
        EngineError::new(
            "RCL_ACCELERATOR_PROVIDER_UNAVAILABLE",
            format!("could not send OpenCL provider request: {error}"),
        )
    })?;
    drop(stdin);
    let output = child.wait_with_output().map_err(|error| {
        EngineError::new(
            "RCL_ACCELERATOR_EXECUTION_FAILED",
            format!("OpenCL provider process failed: {error}"),
        )
    })?;
    if !output.status.success() {
        let error_value = serde_json::from_slice::<Value>(&output.stderr).unwrap_or_else(
            |_| json!({"message": String::from_utf8_lossy(&output.stderr).to_string()}),
        );
        return Err(EngineError::new(
            provider_error_code(&error_value),
            error_value
                .get("message")
                .and_then(Value::as_str)
                .unwrap_or("OpenCL provider failed")
                .to_owned(),
        ));
    }
    serde_json::from_slice(&output.stdout).map_err(|error| {
        EngineError::new(
            "RCL_ACCELERATOR_RESPONSE_JSON",
            format!("OpenCL provider returned invalid JSON: {error}"),
        )
    })
}

fn opencl_f32_bits(value: f64, label: &str) -> Result<String, EngineError> {
    let narrowed = value as f32;
    if !narrowed.is_finite() {
        return Err(EngineError::new(
            "RCL_ACCELERATOR_INPUT_INVALID",
            format!("{label} contains a non-finite FP32 value"),
        ));
    }
    Ok(format!("{:08x}", narrowed.to_bits()))
}

fn decode_opencl_f32_output(
    response: &Value,
    expected: usize,
    label: &str,
) -> Result<Vec<f64>, EngineError> {
    let output_bits = response
        .get("outputBits")
        .and_then(Value::as_array)
        .ok_or_else(|| {
            EngineError::new(
                "RCL_ACCELERATOR_RESPONSE_INVALID",
                format!("OpenCL provider omitted {label} outputBits"),
            )
        })?;
    if output_bits.len() != expected {
        return Err(EngineError::new(
            "RCL_ACCELERATOR_RESPONSE_INVALID",
            format!("OpenCL provider returned the wrong {label} output length"),
        ));
    }
    output_bits
        .iter()
        .map(|value| {
            let bits = value.as_str().ok_or_else(|| {
                EngineError::new(
                    "RCL_ACCELERATOR_RESPONSE_INVALID",
                    format!("OpenCL {label} outputBits must contain strings"),
                )
            })?;
            if bits.len() != 8 || bits.to_ascii_lowercase() != bits {
                return Err(EngineError::new(
                    "RCL_ACCELERATOR_RESPONSE_INVALID",
                    format!("OpenCL {label} outputBits must contain eight lowercase hex digits"),
                ));
            }
            let parsed = u32::from_str_radix(bits, 16).map_err(|_| {
                EngineError::new(
                    "RCL_ACCELERATOR_RESPONSE_INVALID",
                    format!("OpenCL {label} outputBits contains invalid hexadecimal digits"),
                )
            })?;
            let value = f32::from_bits(parsed);
            if !value.is_finite() {
                return Err(EngineError::new(
                    "RCL_ACCELERATOR_RESPONSE_INVALID",
                    format!("OpenCL {label} outputBits contains a non-finite value"),
                ));
            }
            Ok(value as f64)
        })
        .collect()
}

fn opencl_execution_root(response: &Value, label: &str) -> Result<String, EngineError> {
    response
        .get("executionRoot")
        .and_then(Value::as_str)
        .filter(|root| root.len() == 64 && root.chars().all(|value| value.is_ascii_hexdigit()))
        .map(str::to_owned)
        .ok_or_else(|| {
            EngineError::new(
                "RCL_ACCELERATOR_RESPONSE_INVALID",
                format!("OpenCL provider omitted an execution root for {label}"),
            )
        })
}

fn execute_opencl_matmul_gradient(
    node_id: &str,
    provider_path: &PathBuf,
    left: &BoundTensor<'_>,
    right: &BoundTensor<'_>,
    upstream: &Gradient,
    input_index: usize,
) -> Result<(Gradient, String), EngineError> {
    if left.descriptor.shape.len() != 2 || right.descriptor.shape.len() != 2 {
        return Err(EngineError::new(
            "RCL_BF16_MATMUL_RANK",
            format!("GPU gradient node {node_id} requires rank-2 tensors"),
        ));
    }
    let left_rows = left.descriptor.shape[0];
    let left_columns = left.descriptor.shape[1];
    let right_rows = right.descriptor.shape[0];
    let right_columns = right.descriptor.shape[1];
    if left_columns != right_rows || upstream.shape != vec![left_rows, right_columns] {
        return Err(EngineError::new(
            "RCL_AUTODIFF_MATMUL_SHAPE",
            format!("GPU gradient node {node_id} has incompatible matmul shapes"),
        ));
    }
    let operation = match input_index {
        0 => "left-gradient",
        1 => "right-gradient",
        _ => {
            return Err(EngineError::new(
                "RCL_AUTODIFF_MATMUL_SHAPE",
                "GPU matmul gradient input index must be zero or one",
            ));
        }
    };
    let (rows, columns) = if input_index == 0 {
        (left_rows, left_columns)
    } else {
        (right_rows, right_columns)
    };
    let payload = json!({
        "format": "rcl.opencl-bf16-matmul-gradient-request.v0.1",
        "backend": "opencl-amd",
        "operation": operation,
        "leftRows": left_rows,
        "leftColumns": left_columns,
        "rightRows": right_rows,
        "rightColumns": right_columns,
        "leftBits": opencl_bits(left, "left")?,
        "rightBits": opencl_bits(right, "right")?,
        "upstreamF32Bits": upstream
            .data
            .iter()
            .map(|value| opencl_f32_bits(*value, "upstream gradient"))
            .collect::<Result<Vec<_>, _>>()?,
        "nodeId": node_id,
    });
    let response = execute_opencl_json(provider_path, &payload)?;
    if response.get("format").and_then(Value::as_str)
        != Some("rcl.opencl-bf16-matmul-gradient-result.v0.1")
        || response.get("status").and_then(Value::as_str)
            != Some("PASS_LOCAL_GPU_GRADIENT_REFERENCE_CANDIDATE")
        || response.get("backend").and_then(Value::as_str) != Some("opencl-amd")
        || response.get("gpuExecuted").and_then(Value::as_bool) != Some(true)
    {
        return Err(EngineError::new(
            "RCL_ACCELERATOR_RESPONSE_INVALID",
            format!("OpenCL provider did not return an admitted GPU gradient for node {node_id}"),
        ));
    }
    let root = opencl_execution_root(&response, node_id)?;
    let data = decode_opencl_f32_output(&response, rows * columns, "gradient")?;
    Ok((gradient(&[rows, columns], data)?, root))
}

fn validate_graph(
    graph: &ComputationGraph,
    allow_bf16: bool,
    mode: &ExecutionMode,
) -> Result<HashMap<String, (TensorDescriptor, DenseStorage)>, EngineError> {
    if graph.nodes.is_empty() || graph.nodes.len() > MAX_PLAN_NODES {
        return Err(EngineError::new(
            "RCL_AUTODIFF_GRAPH_NODE_LIMIT",
            format!(
                "Graph node count {} is outside 1..={MAX_PLAN_NODES}",
                graph.nodes.len()
            ),
        ));
    }
    let values = validate_plan_initials_for_device(graph, allow_bf16, mode.device())?;
    validate_hybrid_placements(graph, mode)?;
    let mut node_ids = HashSet::new();
    let mut defined = values.keys().cloned().collect::<HashSet<_>>();
    for node in &graph.nodes {
        if node.id.is_empty() || !node_ids.insert(node.id.as_str()) {
            return Err(EngineError::new(
                "RCL_AUTODIFF_NODE_DUPLICATE",
                format!("Missing or duplicate graph node {}", node.id),
            ));
        }
        if node.output.id.is_empty() || defined.contains(&node.output.id) {
            return Err(EngineError::new(
                "RCL_AUTODIFF_SSA_VIOLATION",
                format!(
                    "Graph output {} is missing or already defined",
                    node.output.id
                ),
            ));
        }
        if node.output.gradient_identity.is_empty() {
            return Err(EngineError::new(
                "RCL_TENSOR_GRADIENT_IDENTITY",
                format!("Graph output {} has no GradientIdentity", node.output.id),
            ));
        }
        for input in &node.inputs {
            if !defined.contains(input) {
                return Err(EngineError::new(
                    "RCL_AUTODIFF_INPUT_MISSING",
                    format!("Node {} references unavailable tensor {input}", node.id),
                ));
            }
        }
        defined.insert(node.output.id.clone());
    }
    for output in &graph.outputs {
        if !defined.contains(output) {
            return Err(EngineError::new(
                "RCL_AUTODIFF_OUTPUT_MISSING",
                format!("Graph output {output} is unavailable"),
            ));
        }
    }
    Ok(values)
}

fn forward_tape(
    graph: &ComputationGraph,
    bf16: bool,
    mode: &ExecutionMode,
) -> Result<
    (
        HashMap<String, (TensorDescriptor, DenseStorage)>,
        ForwardExecutionTelemetry,
    ),
    EngineError,
> {
    if matches!(
        mode,
        ExecutionMode::OpenClAmdHybrid { .. } | ExecutionMode::OpenClAmdGpuTraining { .. }
    ) && !bf16
    {
        return Err(EngineError::new(
            "RCL_ACCELERATOR_PRECISION_UNSUPPORTED",
            "opencl-amd-hybrid requires the canonical BF16 precision policy",
        ));
    }
    let mut values = validate_graph(graph, bf16, mode)?;
    let mut execution = ForwardExecutionTelemetry::default();
    let mut allocated = values
        .values()
        .map(|(_, storage)| storage.data.len())
        .sum::<usize>();
    for node in &graph.nodes {
        let mut result = {
            let inputs = node
                .inputs
                .iter()
                .map(|input| {
                    let (descriptor, storage) = values.get(input).ok_or_else(|| {
                        EngineError::new(
                            "RCL_AUTODIFF_INPUT_MISSING",
                            format!("Node {} references unavailable tensor {input}", node.id),
                        )
                    })?;
                    Ok(BoundTensor {
                        descriptor,
                        data: storage.data.as_slice(),
                    })
                })
                .collect::<Result<Vec<_>, EngineError>>()?;
            if bf16 {
                match mode {
                    ExecutionMode::CpuReference => {
                        execute_bound_bf16(&node.operation, &node.attributes, &inputs)?
                    }
                    ExecutionMode::OpenClAmdHybrid { provider_path }
                    | ExecutionMode::OpenClAmdGpuTraining { provider_path } => {
                        if node.attributes.get("placement").and_then(Value::as_str) == Some("gpu") {
                            let (result, root) =
                                execute_opencl_matmul(&node.id, provider_path, &inputs)?;
                            execution.gpu_matmul_nodes += 1;
                            execution.gpu_execution_roots.push(root);
                            result
                        } else {
                            execution.host_cpu_nodes += 1;
                            execute_bound_bf16_host(&node.operation, &node.attributes, &inputs)?
                        }
                    }
                }
            } else {
                execute_bound(&node.operation, &node.attributes, &inputs)?
            }
        };
        if result.tensor.shape != node.output.shape
            || result.tensor.dtype != node.output.dtype
            || result.tensor.layout != node.output.layout
            || result.tensor.device != node.output.device
        {
            return Err(EngineError::new(
                "RCL_AUTODIFF_OUTPUT_DESCRIPTOR",
                format!(
                    "Node {} does not match declared output {}",
                    node.id, node.output.id
                ),
            ));
        }
        result.tensor.id = node.output.id.clone();
        result.tensor.gradient_identity = node.output.gradient_identity.clone();
        allocated = allocated
            .checked_add(result.storage.data.len())
            .ok_or_else(|| EngineError::new("RCL_AUTODIFF_MEMORY_LIMIT", "Tape size overflowed"))?;
        if allocated > MAX_PLAN_ALLOCATED_ELEMENTS {
            return Err(EngineError::new(
                "RCL_AUTODIFF_MEMORY_LIMIT",
                format!(
                    "Autodiff tape has {allocated} elements; limit is {MAX_PLAN_ALLOCATED_ELEMENTS}"
                ),
            ));
        }
        values.insert(node.output.id.clone(), (result.tensor, result.storage));
    }
    Ok((values, execution))
}

fn gradient(shape: &[usize], data: Vec<f64>) -> Result<Gradient, EngineError> {
    if product(shape)? != data.len() || data.iter().any(|value| !value.is_finite()) {
        return Err(EngineError::new(
            "RCL_AUTODIFF_NONFINITE_GRADIENT",
            "Gradient shape mismatch or non-finite value",
        ));
    }
    Ok(Gradient {
        shape: shape.to_vec(),
        data,
    })
}

fn reduce_to_shape(value: &Gradient, target: &[usize]) -> Result<Gradient, EngineError> {
    if output_shape_for_broadcast(target, &value.shape)? != value.shape {
        return Err(EngineError::new(
            "RCL_AUTODIFF_BROADCAST_GRADIENT",
            format!("Cannot reduce gradient {:?} to {target:?}", value.shape),
        ));
    }
    let mut data = vec![0.0; product(target)?];
    for (index, cell) in value.data.iter().enumerate() {
        data[broadcast_offset(index, &value.shape, target)] += cell;
    }
    gradient(target, data)
}

fn elementwise_binary<F>(
    left: &Gradient,
    right: &Gradient,
    shape: &[usize],
    operation: F,
) -> Result<Gradient, EngineError>
where
    F: Fn(f64, f64) -> f64,
{
    gradient(
        shape,
        (0..product(shape)?)
            .map(|index| {
                operation(
                    left.data[broadcast_offset(index, shape, &left.shape)],
                    right.data[broadcast_offset(index, shape, &right.shape)],
                )
            })
            .collect(),
    )
}

fn tensor_gradient(
    value: &(TensorDescriptor, DenseStorage),
    bf16: bool,
) -> Result<Gradient, EngineError> {
    let data = if bf16 {
        value
            .1
            .data
            .iter()
            .map(|cell| bf16_input(*cell).map(f64::from))
            .collect::<Result<Vec<_>, _>>()?
    } else {
        value.1.data.clone()
    };
    Ok(Gradient {
        shape: value.0.shape.clone(),
        data,
    })
}

fn transpose_gradient(value: &Gradient, permutation: &[usize]) -> Result<Gradient, EngineError> {
    let rank = value.shape.len();
    if permutation.len() != rank {
        return Err(EngineError::new(
            "RCL_AUTODIFF_TRANSPOSE_PERMUTATION",
            "Transpose gradient rank mismatch",
        ));
    }
    let mut inverse = vec![0; rank];
    let mut seen = vec![false; rank];
    for (output_axis, input_axis) in permutation.iter().copied().enumerate() {
        if input_axis >= rank || seen[input_axis] {
            return Err(EngineError::new(
                "RCL_AUTODIFF_TRANSPOSE_PERMUTATION",
                "Invalid transpose permutation",
            ));
        }
        seen[input_axis] = true;
        inverse[input_axis] = output_axis;
    }
    let output_shape = inverse
        .iter()
        .map(|axis| value.shape[*axis])
        .collect::<Vec<_>>();
    let output_strides = row_major_strides(&output_shape);
    let input_strides = row_major_strides(&value.shape);
    let mut data = vec![0.0; value.data.len()];
    for (output_index, cell) in data.iter_mut().enumerate() {
        let mut input_index = 0;
        for output_axis in 0..rank {
            let coordinate =
                (output_index / output_strides[output_axis]) % output_shape[output_axis];
            input_index += coordinate * input_strides[inverse[output_axis]];
        }
        *cell = value.data[input_index];
    }
    gradient(&output_shape, data)
}

fn matmul_gradient(
    left: &Gradient,
    right: &Gradient,
    fp32_accumulation: bool,
) -> Result<Gradient, EngineError> {
    if left.shape.len() != 2 || right.shape.len() != 2 || left.shape[1] != right.shape[0] {
        return Err(EngineError::new(
            "RCL_AUTODIFF_MATMUL_SHAPE",
            "Autodiff matmul requires compatible rank-2 tensors",
        ));
    }
    let (m, k, n) = (left.shape[0], left.shape[1], right.shape[1]);
    let mut data = vec![0.0; m * n];
    for i in 0..m {
        for inner in 0..k {
            for j in 0..n {
                let cell = i * n + j;
                if fp32_accumulation {
                    let product =
                        (left.data[i * k + inner] as f32) * (right.data[inner * n + j] as f32);
                    data[cell] = (data[cell] as f32 + product) as f64;
                } else {
                    data[cell] += left.data[i * k + inner] * right.data[inner * n + j];
                }
            }
        }
    }
    gradient(&[m, n], data)
}

fn transpose_2d(value: &Gradient) -> Result<Gradient, EngineError> {
    if value.shape.len() != 2 {
        return Err(EngineError::new(
            "RCL_AUTODIFF_MATMUL_SHAPE",
            "Matmul transpose requires rank 2",
        ));
    }
    let (rows, columns) = (value.shape[0], value.shape[1]);
    let mut data = vec![0.0; value.data.len()];
    for row in 0..rows {
        for column in 0..columns {
            data[column * rows + row] = value.data[row * columns + column];
        }
    }
    gradient(&[columns, rows], data)
}

#[derive(Default)]
struct BackwardExecutionTelemetry {
    gpu_matmul_nodes: usize,
    gpu_execution_roots: Vec<String>,
}

fn reduction_gradient(
    output_gradient: &Gradient,
    input_shape: &[usize],
    axis: usize,
    scale: f64,
) -> Result<Gradient, EngineError> {
    if axis >= input_shape.len() {
        return Err(EngineError::new(
            "RCL_AUTODIFF_REDUCTION_AXIS",
            "Reduction axis is outside the input rank",
        ));
    }
    let expected = input_shape
        .iter()
        .enumerate()
        .filter_map(|(index, size)| (index != axis).then_some(*size))
        .collect::<Vec<_>>();
    if output_gradient.shape != expected {
        return Err(EngineError::new(
            "RCL_AUTODIFF_REDUCTION_SHAPE",
            "Reduction output gradient has an invalid shape",
        ));
    }
    let input_strides = row_major_strides(input_shape);
    let output_strides = row_major_strides(&expected);
    let mut data = vec![0.0; product(input_shape)?];
    for (input_index, cell) in data.iter_mut().enumerate() {
        let mut output_index = 0;
        let mut output_axis = 0;
        for input_axis in 0..input_shape.len() {
            if input_axis == axis {
                continue;
            }
            let coordinate = (input_index / input_strides[input_axis]) % input_shape[input_axis];
            output_index += coordinate * output_strides[output_axis];
            output_axis += 1;
        }
        *cell = output_gradient.data[output_index] * scale;
    }
    gradient(input_shape, data)
}

fn node_input_gradients(
    node: &Operation,
    output_gradient: &Gradient,
    tape: &HashMap<String, (TensorDescriptor, DenseStorage)>,
    mode: &ExecutionMode,
    bf16: bool,
    execution: &mut BackwardExecutionTelemetry,
) -> Result<Vec<Gradient>, EngineError> {
    let inputs = node
        .inputs
        .iter()
        .map(|id| {
            tape.get(id)
                .ok_or_else(|| {
                    EngineError::new(
                        "RCL_AUTODIFF_INPUT_MISSING",
                        format!("Backward node {} is missing input {id}", node.id),
                    )
                })
                .and_then(|value| tensor_gradient(value, bf16))
        })
        .collect::<Result<Vec<_>, _>>()?;
    let output = tape
        .get(&node.output.id)
        .ok_or_else(|| {
            EngineError::new(
                "RCL_AUTODIFF_OUTPUT_MISSING",
                format!(
                    "Backward node {} is missing output {}",
                    node.id, node.output.id
                ),
            )
        })
        .and_then(|value| tensor_gradient(value, bf16))?;
    let direct = |value: Gradient, shape: &[usize]| reduce_to_shape(&value, shape);
    match node.operation.as_str() {
        "add" => Ok(vec![
            direct(output_gradient.clone(), &inputs[0].shape)?,
            direct(output_gradient.clone(), &inputs[1].shape)?,
        ]),
        "sub" => Ok(vec![
            direct(output_gradient.clone(), &inputs[0].shape)?,
            direct(
                gradient(
                    &output_gradient.shape,
                    output_gradient.data.iter().map(|value| -*value).collect(),
                )?,
                &inputs[1].shape,
            )?,
        ]),
        "mul" => Ok(vec![
            direct(
                elementwise_binary(output_gradient, &inputs[1], &output.shape, |a, b| a * b)?,
                &inputs[0].shape,
            )?,
            direct(
                elementwise_binary(output_gradient, &inputs[0], &output.shape, |a, b| a * b)?,
                &inputs[1].shape,
            )?,
        ]),
        "div" => {
            let left =
                elementwise_binary(output_gradient, &inputs[1], &output.shape, |a, b| a / b)?;
            let right = gradient(
                &output.shape,
                (0..product(&output.shape)?)
                    .map(|index| {
                        let grad = output_gradient.data[index];
                        let numerator = inputs[0].data
                            [broadcast_offset(index, &output.shape, &inputs[0].shape)];
                        let denominator = inputs[1].data
                            [broadcast_offset(index, &output.shape, &inputs[1].shape)];
                        -grad * numerator / (denominator * denominator)
                    })
                    .collect(),
            )?;
            Ok(vec![
                direct(left, &inputs[0].shape)?,
                direct(right, &inputs[1].shape)?,
            ])
        }
        "abs" => Ok(vec![gradient(
            &inputs[0].shape,
            inputs[0]
                .data
                .iter()
                .zip(&output_gradient.data)
                .map(|(input, grad)| grad * input.signum())
                .collect(),
        )?]),
        "exp" => Ok(vec![elementwise_binary(
            output_gradient,
            &output,
            &output.shape,
            |a, b| a * b,
        )?]),
        "log" => Ok(vec![elementwise_binary(
            output_gradient,
            &inputs[0],
            &inputs[0].shape,
            |a, b| a / b,
        )?]),
        "sqrt" => Ok(vec![elementwise_binary(
            output_gradient,
            &output,
            &output.shape,
            |a, b| a / (2.0 * b),
        )?]),
        "reshape" => Ok(vec![gradient(
            &inputs[0].shape,
            output_gradient.data.clone(),
        )?]),
        "broadcast" => Ok(vec![reduce_to_shape(output_gradient, &inputs[0].shape)?]),
        "transpose" => Ok(vec![transpose_gradient(
            output_gradient,
            &attribute_permutation(&node.attributes)?,
        )?]),
        "matmul" | "matmul-reference" => {
            if mode.gpu_backward()
                && node.operation == "matmul"
                && node.attributes.get("placement").and_then(Value::as_str) == Some("gpu")
            {
                let provider_path = mode.provider_path().ok_or_else(|| {
                    EngineError::new(
                        "RCL_ACCELERATOR_PROVIDER_REQUIRED",
                        "GPU backward requires an explicit provider path",
                    )
                })?;
                let left_descriptor = tape.get(&node.inputs[0]).ok_or_else(|| {
                    EngineError::new(
                        "RCL_AUTODIFF_INPUT_MISSING",
                        format!(
                            "Backward node {} is missing input {}",
                            node.id, node.inputs[0]
                        ),
                    )
                })?;
                let right_descriptor = tape.get(&node.inputs[1]).ok_or_else(|| {
                    EngineError::new(
                        "RCL_AUTODIFF_INPUT_MISSING",
                        format!(
                            "Backward node {} is missing input {}",
                            node.id, node.inputs[1]
                        ),
                    )
                })?;
                let left = BoundTensor {
                    descriptor: &left_descriptor.0,
                    data: left_descriptor.1.data.as_slice(),
                };
                let right = BoundTensor {
                    descriptor: &right_descriptor.0,
                    data: right_descriptor.1.data.as_slice(),
                };
                let (left_gradient, left_root) = execute_opencl_matmul_gradient(
                    &node.id,
                    provider_path,
                    &left,
                    &right,
                    output_gradient,
                    0,
                )?;
                let (right_gradient, right_root) = execute_opencl_matmul_gradient(
                    &node.id,
                    provider_path,
                    &left,
                    &right,
                    output_gradient,
                    1,
                )?;
                execution.gpu_matmul_nodes += 2;
                execution.gpu_execution_roots.push(left_root);
                execution.gpu_execution_roots.push(right_root);
                Ok(vec![left_gradient, right_gradient])
            } else {
                Ok(vec![
                    matmul_gradient(output_gradient, &transpose_2d(&inputs[1])?, bf16)?,
                    matmul_gradient(&transpose_2d(&inputs[0])?, output_gradient, bf16)?,
                ])
            }
        }
        "sum" | "mean" => {
            let axis = attribute_usize(&node.attributes, "axis")?;
            let scale = if node.operation == "mean" {
                1.0 / inputs[0].shape[axis] as f64
            } else {
                1.0
            };
            Ok(vec![reduction_gradient(
                output_gradient,
                &inputs[0].shape,
                axis,
                scale,
            )?])
        }
        "softmax" => {
            let width = *output.shape.last().ok_or_else(|| {
                EngineError::new("RCL_AUTODIFF_SOFTMAX_RANK", "Softmax requires rank >= 1")
            })?;
            let mut data = vec![0.0; output.data.len()];
            for row in 0..output.data.len() / width {
                let start = row * width;
                let dot = (0..width)
                    .map(|index| output_gradient.data[start + index] * output.data[start + index])
                    .sum::<f64>();
                for index in 0..width {
                    data[start + index] =
                        output.data[start + index] * (output_gradient.data[start + index] - dot);
                }
            }
            Ok(vec![gradient(&inputs[0].shape, data)?])
        }
        "activation" => {
            let kind = node
                .attributes
                .get("kind")
                .and_then(Value::as_str)
                .ok_or_else(|| {
                    EngineError::new("RCL_TENSOR_ATTRIBUTE", "Missing activation kind")
                })?;
            let data = inputs[0]
                .data
                .iter()
                .zip(output.data.iter())
                .zip(output_gradient.data.iter())
                .map(|((input, activated), grad)| {
                    let derivative = match kind {
                        "softsign01" => 0.5 / (1.0 + input.abs()).powi(2),
                        "relu" => f64::from(*input > 0.0),
                        "tanh" => 1.0 - activated * activated,
                        "sigmoid" => activated * (1.0 - activated),
                        _ => 0.0,
                    };
                    grad * derivative
                })
                .collect();
            if !["softsign01", "relu", "tanh", "sigmoid"].contains(&kind) {
                return Err(EngineError::new(
                    "RCL_TENSOR_ACTIVATION_UNSUPPORTED",
                    format!("Unsupported activation {kind}"),
                ));
            }
            Ok(vec![gradient(&inputs[0].shape, data)?])
        }
        "stop-gradient" => Ok(Vec::new()),
        operation => Err(EngineError::new(
            "RCL_AUTODIFF_OPERATION_UNSUPPORTED",
            format!("Operation {operation} has no canonical reverse rule"),
        )),
    }
}

fn accumulate(
    gradients: &mut HashMap<String, Gradient>,
    id: &str,
    incoming: Gradient,
    accumulator: &mut GradientAccumulator,
    fp32: bool,
) -> Result<(), EngineError> {
    accumulator.accumulation_count += 1;
    accumulator.accumulated_elements = accumulator
        .accumulated_elements
        .checked_add(incoming.data.len())
        .ok_or_else(|| {
            EngineError::new(
                "RCL_AUTODIFF_MEMORY_LIMIT",
                "Gradient accounting overflowed",
            )
        })?;
    if let Some(existing) = gradients.get_mut(id) {
        if existing.shape != incoming.shape {
            return Err(EngineError::new(
                "RCL_AUTODIFF_ACCUMULATOR_SHAPE",
                format!("GradientAccumulator shape mismatch for {id}"),
            ));
        }
        for (cell, value) in existing.data.iter_mut().zip(incoming.data) {
            *cell = if fp32 {
                (*cell as f32 + value as f32) as f64
            } else {
                *cell + value
            };
        }
        accumulator.merge_count += 1;
    } else {
        gradients.insert(id.into(), incoming);
    }
    accumulator.tensor_count = gradients.len();
    Ok(())
}

fn round_gradient_fp32(mut value: Gradient) -> Result<Gradient, EngineError> {
    for cell in &mut value.data {
        let narrowed = *cell as f32;
        if !narrowed.is_finite() {
            return Err(EngineError::new(
                "RCL_AUTODIFF_FP32_GRADIENT_NONFINITE",
                "BF16 Autodiff produced a non-finite FP32 gradient",
            ));
        }
        *cell = narrowed as f64;
    }
    Ok(value)
}

pub fn backward(request: &AutodiffRequest) -> Result<AutodiffResult, EngineError> {
    if request.format != AUTODIFF_REQUEST_FORMAT {
        return Err(EngineError::new(
            "RCL_AUTODIFF_FORMAT",
            format!("Unsupported autodiff format {}", request.format),
        ));
    }
    if request.parameters.is_empty() || request.parameters.len() > MAX_PARAMETERS {
        return Err(EngineError::new(
            "RCL_AUTODIFF_PARAMETER_LIMIT",
            format!("Parameter count must be within 1..={MAX_PARAMETERS}"),
        ));
    }
    let bf16 = match request.precision.as_deref() {
        None => false,
        Some(BF16_AUTODIFF_PRECISION) => true,
        Some(precision) => {
            return Err(EngineError::new(
                "RCL_AUTODIFF_PRECISION_UNSUPPORTED",
                format!("Unsupported Autodiff precision policy {precision}"),
            ));
        }
    };
    let mode = execution_mode(&request.graph)?;
    let forward_started = Instant::now();
    let (tape, forward_execution) = forward_tape(&request.graph, bf16, &mode)?;
    let forward_nanos = forward_started.elapsed().as_nanos();
    let loss_value = tape.get(&request.loss).ok_or_else(|| {
        EngineError::new(
            "RCL_AUTODIFF_LOSS_MISSING",
            format!("Loss tensor {} is unavailable", request.loss),
        )
    })?;
    if loss_value.1.data.len() != 1 {
        return Err(EngineError::new(
            "RCL_AUTODIFF_LOSS_NOT_SCALAR",
            format!(
                "Loss tensor {} must contain exactly one element",
                request.loss
            ),
        ));
    }
    let stop = request
        .stop_gradients
        .iter()
        .map(|item| item.tensor_id.as_str())
        .collect::<HashSet<_>>();
    if stop.iter().any(|id| !tape.contains_key(*id)) {
        return Err(EngineError::new(
            "RCL_AUTODIFF_STOP_GRADIENT_MISSING",
            "StopGradient references an unavailable TensorValue",
        ));
    }
    let mut parameter_ids = HashSet::new();
    let mut gradient_identities = HashSet::new();
    for parameter in &request.parameters {
        if !parameter_ids.insert(parameter.tensor_id.as_str())
            || parameter.gradient_identity.is_empty()
            || !gradient_identities.insert(parameter.gradient_identity.as_str())
        {
            return Err(EngineError::new(
                "RCL_AUTODIFF_PARAMETER_DUPLICATE",
                "Parameters and GradientIdentity values must be unique and non-empty",
            ));
        }
        let descriptor = request
            .graph
            .tensors
            .iter()
            .find(|tensor| tensor.id == parameter.tensor_id)
            .ok_or_else(|| {
                EngineError::new(
                    "RCL_AUTODIFF_PARAMETER_NOT_INITIAL",
                    format!(
                        "Parameter {} must be an initial graph tensor",
                        parameter.tensor_id
                    ),
                )
            })?;
        if descriptor.gradient_identity != parameter.gradient_identity {
            return Err(EngineError::new(
                "RCL_AUTODIFF_GRADIENT_IDENTITY",
                format!(
                    "GradientIdentity mismatch for parameter {}",
                    parameter.tensor_id
                ),
            ));
        }
        if stop.contains(parameter.tensor_id.as_str()) {
            return Err(EngineError::new(
                "RCL_AUTODIFF_PARAMETER_STOPPED",
                format!(
                    "Parameter {} cannot also be StopGradient",
                    parameter.tensor_id
                ),
            ));
        }
    }

    let backward_started = Instant::now();
    let mut gradients = HashMap::new();
    gradients.insert(
        request.loss.clone(),
        gradient(&loss_value.0.shape, vec![1.0])?,
    );
    let mut edges = Vec::new();
    let mut backward_execution = BackwardExecutionTelemetry::default();
    let mut accumulator = GradientAccumulator {
        tensor_count: 1,
        accumulation_count: 0,
        merge_count: 0,
        accumulated_elements: 1,
    };
    for node in request.graph.nodes.iter().rev() {
        let Some(output_gradient) = gradients.get(&node.output.id).cloned() else {
            continue;
        };
        if stop.contains(node.output.id.as_str()) || node.operation == "stop-gradient" {
            continue;
        }
        let input_gradients = node_input_gradients(
            node,
            &output_gradient,
            &tape,
            &mode,
            bf16,
            &mut backward_execution,
        )?;
        for (input_index, incoming) in input_gradients.into_iter().enumerate() {
            let input = &node.inputs[input_index];
            if stop.contains(input.as_str()) {
                continue;
            }
            let identity = tape
                .get(input)
                .map(|value| value.0.gradient_identity.clone())
                .unwrap_or_default();
            let incoming = if bf16 {
                round_gradient_fp32(incoming)?
            } else {
                incoming
            };
            accumulate(&mut gradients, input, incoming, &mut accumulator, bf16)?;
            edges.push(BackwardEdge {
                node_id: node.id.clone(),
                operation: node.operation.clone(),
                output: node.output.id.clone(),
                input: input.clone(),
                input_index,
                gradient_identity: identity,
            });
        }
    }
    let backward_nanos = backward_started.elapsed().as_nanos();
    let mut results = Vec::with_capacity(request.parameters.len());
    for parameter in &request.parameters {
        let value = tape.get(&parameter.tensor_id).unwrap();
        let derivative = gradients.get(&parameter.tensor_id).ok_or_else(|| {
            EngineError::new(
                "RCL_AUTODIFF_PARAMETER_DISCONNECTED",
                format!(
                    "Parameter {} is not connected to loss {}",
                    parameter.tensor_id, request.loss
                ),
            )
        })?;
        let gradient_data = if bf16 {
            round_gradient_fp32(derivative.clone())?.data
        } else {
            derivative.data.clone()
        };
        let storage_identity = output_identity(
            if bf16 { "f32" } else { "f64" },
            &derivative.shape,
            &gradient_data,
        );
        results.push(GradientTensorResult {
            parameter: parameter.clone(),
            tensor: TensorDescriptor {
                id: format!("gradient:{}", parameter.tensor_id),
                shape: derivative.shape.clone(),
                dtype: if bf16 {
                    "f32".into()
                } else {
                    value.0.dtype.clone()
                },
                layout: value.0.layout.clone(),
                device: value.0.device.clone(),
                gradient_identity: format!(
                    "gradient:{}:loss:{}",
                    parameter.gradient_identity, loss_value.0.gradient_identity
                ),
                storage_identity: storage_identity.clone(),
            },
            storage: DenseStorage {
                identity: storage_identity,
                kind: "cpu-dense".into(),
                data: gradient_data,
            },
        });
    }
    Ok(AutodiffResult {
        format: AUTODIFF_RESPONSE_FORMAT,
        status: "ok",
        loss: TensorValue {
            tensor: loss_value.0.clone(),
            storage: loss_value.1.clone(),
        },
        gradients: results,
        backward_edges: edges.clone(),
        accumulator,
        telemetry: AutodiffTelemetry {
            backend: "rcl-tensor-autodiff-rust-v0.1",
            execution_backend: mode.execution_backend(),
            forward_node_count: request.graph.nodes.len(),
            backward_edge_count: edges.len(),
            forward_nanos,
            backward_nanos,
            parameter_count: request.parameters.len(),
            gpu_matmul_nodes: forward_execution.gpu_matmul_nodes,
            host_cpu_nodes: forward_execution.host_cpu_nodes,
            gpu_execution_roots: forward_execution.gpu_execution_roots,
            gpu_backward_matmul_nodes: backward_execution.gpu_matmul_nodes,
            gpu_backward_execution_roots: backward_execution.gpu_execution_roots,
        },
    })
}

fn update_parameters(
    request: &mut AutodiffRequest,
    result: &AutodiffResult,
    learning_rate: f64,
) -> Result<(), EngineError> {
    let gradients = result
        .gradients
        .iter()
        .map(|gradient| {
            (
                gradient.parameter.tensor_id.as_str(),
                gradient.storage.data.as_slice(),
            )
        })
        .collect::<HashMap<_, _>>();
    let mut parameter_storage_ids = HashSet::new();
    for parameter in &request.parameters {
        let tensor_index = request
            .graph
            .tensors
            .iter()
            .position(|tensor| tensor.id == parameter.tensor_id)
            .unwrap();
        let old_storage_identity = request.graph.tensors[tensor_index].storage_identity.clone();
        if !parameter_storage_ids.insert(old_storage_identity.clone()) {
            return Err(EngineError::new(
                "RCL_AUTODIFF_PARAMETER_STORAGE_ALIAS",
                "Parameters cannot share mutable training storage",
            ));
        }
        let storage_index = request
            .graph
            .storages
            .iter()
            .position(|storage| storage.identity == old_storage_identity)
            .ok_or_else(|| {
                EngineError::new(
                    "RCL_TENSOR_STORAGE_MISSING",
                    format!("Parameter storage {old_storage_identity} is unavailable"),
                )
            })?;
        let derivative = gradients.get(parameter.tensor_id.as_str()).unwrap();
        if derivative.len() != request.graph.storages[storage_index].data.len() {
            return Err(EngineError::new(
                "RCL_AUTODIFF_PARAMETER_SHAPE",
                format!(
                    "Gradient shape differs for parameter {}",
                    parameter.tensor_id
                ),
            ));
        }
        let updated = request.graph.storages[storage_index]
            .data
            .iter()
            .zip(*derivative)
            .map(|(value, gradient)| value - learning_rate * gradient)
            .collect::<Vec<_>>();
        if updated.iter().any(|value| !value.is_finite()) {
            return Err(EngineError::new(
                "RCL_AUTODIFF_NONFINITE_PARAMETER",
                format!(
                    "Parameter update produced non-finite values for {}",
                    parameter.tensor_id
                ),
            ));
        }
        let descriptor = &request.graph.tensors[tensor_index];
        let new_identity = output_identity(&descriptor.dtype, &descriptor.shape, &updated);
        request.graph.storages[storage_index].identity = new_identity.clone();
        request.graph.storages[storage_index].data = updated;
        request.graph.tensors[tensor_index].storage_identity = new_identity;
        request
            .graph
            .exact_storage_bits
            .remove(&old_storage_identity);
    }
    Ok(())
}

pub fn train_sgd(
    training: &AutodiffSgdTrainingRequest,
) -> Result<AutodiffSgdTrainingResult, EngineError> {
    if training.format != AUTODIFF_SGD_TRAINING_REQUEST_FORMAT {
        return Err(EngineError::new(
            "RCL_AUTODIFF_TRAINING_FORMAT",
            format!("Unsupported training format {}", training.format),
        ));
    }
    if training.steps == 0 || training.steps > MAX_TRAINING_STEPS {
        return Err(EngineError::new(
            "RCL_AUTODIFF_TRAINING_STEP_LIMIT",
            format!("Training steps must be within 1..={MAX_TRAINING_STEPS}"),
        ));
    }
    let node_steps = training
        .autodiff
        .graph
        .nodes
        .len()
        .checked_mul(training.steps)
        .ok_or_else(|| {
            EngineError::new(
                "RCL_AUTODIFF_TRAINING_WORK_LIMIT",
                "Training node-step accounting overflowed",
            )
        })?;
    if node_steps > MAX_TRAINING_NODE_STEPS {
        return Err(EngineError::new(
            "RCL_AUTODIFF_TRAINING_WORK_LIMIT",
            format!(
                "Training requests at most {MAX_TRAINING_NODE_STEPS} node-steps, received {node_steps}"
            ),
        ));
    }
    if !training.learning_rate.is_finite() || training.learning_rate <= 0.0 {
        return Err(EngineError::new(
            "RCL_AUTODIFF_LEARNING_RATE",
            "Learning rate must be finite and positive",
        ));
    }
    let started = Instant::now();
    let mut request = training.autodiff.clone();
    // Exact checkpoint bits are part of the canonical initial value. Materialize them
    // into the mutable training storage before the first update; otherwise validation
    // would see the exact value while SGD updated the decimal transport approximation.
    let canonical_initials = validate_plan_initials(&request.graph, false)?;
    for tensor in &request.graph.tensors {
        let canonical_storage = &canonical_initials.get(&tensor.id).unwrap().1;
        let mutable_storage = request
            .graph
            .storages
            .iter_mut()
            .find(|storage| storage.identity == tensor.storage_identity)
            .unwrap();
        mutable_storage.data.clone_from(&canonical_storage.data);
    }
    let initial = backward(&request)?;
    for _ in 0..training.steps {
        let result = backward(&request)?;
        update_parameters(&mut request, &result, training.learning_rate)?;
    }
    let final_result = backward(&request)?;
    let forward = execute_plan(&request.graph)?;
    let parameters = request
        .parameters
        .iter()
        .map(|parameter| {
            let tensor = request
                .graph
                .tensors
                .iter()
                .find(|tensor| tensor.id == parameter.tensor_id)
                .unwrap()
                .clone();
            let storage = request
                .graph
                .storages
                .iter()
                .find(|storage| storage.identity == tensor.storage_identity)
                .unwrap()
                .clone();
            TensorValue { tensor, storage }
        })
        .collect::<Vec<_>>();
    let parameter_bytes = parameters
        .iter()
        .map(|value| value.storage.data.len() * std::mem::size_of::<f64>())
        .sum();
    Ok(AutodiffSgdTrainingResult {
        format: AUTODIFF_SGD_TRAINING_RESPONSE_FORMAT,
        status: "ok",
        initial_loss: initial.loss.storage.data[0],
        final_loss: final_result.loss.storage.data[0],
        parameters,
        outputs: forward.outputs,
        telemetry: AutodiffSgdTrainingTelemetry {
            backend: "rcl-tensor-autodiff-rust-v0.1",
            optimizer_semantics: "rcl.batch-sgd.v0.1",
            steps: training.steps,
            training_nanos: started.elapsed().as_nanos(),
            parameter_bytes,
        },
    })
}
