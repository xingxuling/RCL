use rcl_tensor_engine::{
    AutodiffRequest, AutodiffResult, BF16_AUTODIFF_PRECISION, EngineError, Parameter, backward,
};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::collections::HashSet;
use std::env;
use std::fs;
use std::io::{self, Read};
use std::path::PathBuf;
use std::process::{Command, Stdio};

const REQUEST_FORMAT: &str = "rcl.bf16-autodiff-adamw-request.v0.2";
const HYBRID_BACKEND: &str = "opencl-amd-hybrid";
const GPU_TRAINING_BACKEND: &str = "opencl-amd-gpu-training";
const RESULT_FORMAT: &str = "rcl.bf16-autodiff-adamw-result.v0.2";
const POLICY: &str = "rcl.bf16-rne-fp32-accumulation-adamw.v0.2";
const BACKEND: &str = "cpu-reference";
const MAX_STEPS: usize = 16_384;
const MAX_PARAMETERS: usize = 256;

#[derive(Debug)]
struct TrainError {
    code: &'static str,
    message: String,
}

impl TrainError {
    fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }
}

impl From<EngineError> for TrainError {
    fn from(error: EngineError) -> Self {
        Self::new(error.code, error.message)
    }
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct AdamWConfig {
    learning_rate: f32,
    beta1: f32,
    beta2: f32,
    epsilon: f32,
    weight_decay: f32,
    gradient_clip: f32,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct OptimizerState {
    tensor_id: String,
    step: usize,
    first_moment: Vec<f32>,
    second_moment: Vec<f32>,
    #[serde(default)]
    exact_first_moment_bits: Vec<String>,
    #[serde(default)]
    exact_second_moment_bits: Vec<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Request {
    format: String,
    backend: String,
    steps: usize,
    autodiff: AutodiffRequest,
    config: AdamWConfig,
    #[serde(default)]
    optimizer_states: Vec<OptimizerState>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct Bf16TensorReceipt {
    shape: Vec<usize>,
    dtype: &'static str,
    accumulation_dtype: &'static str,
    bits_hex: Vec<String>,
    data: Vec<f32>,
    storage_root: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct Fp32TensorReceipt {
    shape: Vec<usize>,
    dtype: &'static str,
    bits_hex: Vec<String>,
    data: Vec<f32>,
    storage_root: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ParameterReceipt {
    tensor_id: String,
    master_weight: Fp32TensorReceipt,
    compute_weight: Bf16TensorReceipt,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct GradientReceipt {
    tensor_id: String,
    gradient: Fp32TensorReceipt,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct Telemetry {
    backend: &'static str,
    execution_backend: String,
    policy: &'static str,
    forward_compute_dtype: &'static str,
    activation_compute_dtype: &'static str,
    accumulation_dtype: &'static str,
    gradient_dtype: &'static str,
    master_weight_dtype: &'static str,
    optimizer_state_dtype: &'static str,
    cast_backward_policy: &'static str,
    steps: usize,
    parameter_count: usize,
    parameter_elements: usize,
    optimizer_state_elements: usize,
    backward_edge_count: usize,
    gpu_matmul_nodes: usize,
    host_cpu_nodes: usize,
    gpu_execution_roots: Vec<String>,
    gpu_backward_matmul_nodes: usize,
    gpu_backward_execution_roots: Vec<String>,
    gpu_optimizer_elements: usize,
    gpu_optimizer_execution_roots: Vec<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ResultReceipt {
    format: &'static str,
    status: &'static str,
    initial_loss: f32,
    final_loss: f32,
    initial_gradients: Vec<GradientReceipt>,
    final_gradients: Vec<GradientReceipt>,
    parameters: Vec<ParameterReceipt>,
    optimizer_states: Vec<OptimizerState>,
    parameter_order: Vec<String>,
    autodiff_precision: &'static str,
    checkpoint_root: String,
    telemetry: Telemetry,
    gpu_claim: bool,
}

fn validate_config(config: &AdamWConfig) -> Result<(), TrainError> {
    if !config.learning_rate.is_finite() || config.learning_rate <= 0.0 {
        return Err(TrainError::new(
            "RCL_BF16_AD_LEARNING_RATE",
            "learningRate must be finite and positive",
        ));
    }
    if !config.beta1.is_finite() || !(0.0..1.0).contains(&config.beta1) {
        return Err(TrainError::new(
            "RCL_BF16_AD_BETA1",
            "beta1 must be in [0,1)",
        ));
    }
    if !config.beta2.is_finite() || !(0.0..1.0).contains(&config.beta2) {
        return Err(TrainError::new(
            "RCL_BF16_AD_BETA2",
            "beta2 must be in [0,1)",
        ));
    }
    if !config.epsilon.is_finite() || config.epsilon <= 0.0 {
        return Err(TrainError::new(
            "RCL_BF16_AD_EPSILON",
            "epsilon must be finite and positive",
        ));
    }
    if !config.weight_decay.is_finite() || config.weight_decay < 0.0 {
        return Err(TrainError::new(
            "RCL_BF16_AD_WEIGHT_DECAY",
            "weightDecay must be finite and non-negative",
        ));
    }
    if !config.gradient_clip.is_finite() || config.gradient_clip <= 0.0 {
        return Err(TrainError::new(
            "RCL_BF16_AD_GRADIENT_CLIP",
            "gradientClip must be finite and positive",
        ));
    }
    Ok(())
}

fn exact_f32_bits(values: &[f32]) -> Vec<String> {
    values
        .iter()
        .map(|value| format!("{:08x}", value.to_bits()))
        .collect()
}

fn decode_f32_bits(
    values: &[String],
    expected: usize,
    label: &str,
) -> Result<Vec<f32>, TrainError> {
    if values.len() != expected {
        return Err(TrainError::new(
            "RCL_BF16_AD_EXACT_LENGTH",
            format!(
                "exact FP32 bits for {label} require {expected} values, received {}",
                values.len()
            ),
        ));
    }
    values.iter().map(|bits| {
        if bits.len() != 8 {
            return Err(TrainError::new("RCL_BF16_AD_EXACT_BITS", format!("exact FP32 bits for {label} must contain 8 lowercase hex digits, received {bits}")));
        }
        let parsed = u32::from_str_radix(bits, 16).map_err(|_| TrainError::new("RCL_BF16_AD_EXACT_BITS", format!("invalid exact FP32 bits for {label}: {bits}")))?;
        if format!("{parsed:08x}") != *bits {
            return Err(TrainError::new("RCL_BF16_AD_EXACT_BITS", format!("exact FP32 bits for {label} are not canonical lowercase hex: {bits}")));
        }
        let value = f32::from_bits(parsed);
        if !value.is_finite() {
            return Err(TrainError::new("RCL_BF16_AD_NONFINITE", format!("exact FP32 bits for {label} decode to a non-finite value")));
        }
        Ok(value)
    }).collect()
}

fn f32_to_bf16_bits(value: f32) -> Result<u16, TrainError> {
    if !value.is_finite() {
        return Err(TrainError::new(
            "RCL_BF16_AD_NONFINITE",
            "BF16 conversion rejects non-finite values",
        ));
    }
    let bits = value.to_bits();
    let lsb = (bits >> 16) & 1;
    let rounded = bits.wrapping_add(0x7fff + lsb);
    let result = (rounded >> 16) as u16;
    if !f32::from_bits((result as u32) << 16).is_finite() {
        return Err(TrainError::new(
            "RCL_BF16_AD_NONFINITE",
            "BF16 conversion produced a non-finite value",
        ));
    }
    Ok(result)
}

fn bf16_bits_to_f32(bits: u16) -> f32 {
    f32::from_bits((bits as u32) << 16)
}

fn storage_root(dtype: &str, policy: &str, shape: &[usize], bits: &[u8]) -> String {
    let mut hash = Sha256::new();
    hash.update(b"rcl.tensor.storage.v0.2\0");
    hash.update(dtype.as_bytes());
    hash.update(policy.as_bytes());
    hash.update((shape.len() as u64).to_le_bytes());
    for dimension in shape {
        hash.update((*dimension as u64).to_le_bytes());
    }
    hash.update(bits);
    format!("sha256:{}", hex::encode(hash.finalize()))
}

fn f32_receipt(shape: Vec<usize>, values: Vec<f32>, role: &str) -> Fp32TensorReceipt {
    let bytes = values
        .iter()
        .flat_map(|value| value.to_bits().to_le_bytes())
        .collect::<Vec<_>>();
    Fp32TensorReceipt {
        shape: shape.clone(),
        dtype: "f32",
        bits_hex: exact_f32_bits(&values),
        data: values,
        storage_root: storage_root("f32", role, &shape, &bytes),
    }
}

fn bf16_receipt(shape: Vec<usize>, values: &[f32]) -> Result<Bf16TensorReceipt, TrainError> {
    let bits = values
        .iter()
        .map(|value| f32_to_bf16_bits(*value))
        .collect::<Result<Vec<_>, _>>()?;
    let bytes = bits
        .iter()
        .flat_map(|value| value.to_le_bytes())
        .collect::<Vec<_>>();
    Ok(Bf16TensorReceipt {
        shape: shape.clone(),
        dtype: "bf16",
        accumulation_dtype: "f32",
        bits_hex: bits.iter().map(|value| format!("{value:04x}")).collect(),
        data: bits.iter().map(|value| bf16_bits_to_f32(*value)).collect(),
        storage_root: storage_root("bf16", POLICY, &shape, &bytes),
    })
}

fn parameter_descriptor(
    request: &Request,
    tensor_id: &str,
) -> Result<(String, Vec<usize>), TrainError> {
    let tensor = request
        .autodiff
        .graph
        .tensors
        .iter()
        .find(|tensor| tensor.id == tensor_id)
        .ok_or_else(|| {
            TrainError::new(
                "RCL_BF16_AD_PARAMETER_MISSING",
                format!("parameter {tensor_id} is not an initial graph tensor"),
            )
        })?;
    let expected_device = match request.backend.as_str() {
        BACKEND => "cpu",
        HYBRID_BACKEND | GPU_TRAINING_BACKEND => "opencl-amd",
        other => {
            return Err(TrainError::new(
                "RCL_ACCELERATOR_BACKEND_UNAVAILABLE",
                format!("unsupported training backend {other}"),
            ));
        }
    };
    if tensor.dtype != "bf16" || tensor.layout != "row-major" || tensor.device != expected_device {
        return Err(TrainError::new(
            "RCL_BF16_AD_DESCRIPTOR",
            format!("parameter {tensor_id} is outside bf16/row-major/{expected_device} profile"),
        ));
    }
    Ok((tensor.storage_identity.clone(), tensor.shape.clone()))
}

fn parameter_order(request: &Request) -> Result<Vec<(Parameter, String, Vec<usize>)>, TrainError> {
    if request.autodiff.parameters.is_empty() || request.autodiff.parameters.len() > MAX_PARAMETERS
    {
        return Err(TrainError::new(
            "RCL_BF16_AD_PARAMETER_LIMIT",
            format!("parameter count must be within 1..={MAX_PARAMETERS}"),
        ));
    }
    let mut ids = HashSet::new();
    let mut gradient_ids = HashSet::new();
    let mut storage_ids = HashSet::new();
    request
        .autodiff
        .parameters
        .iter()
        .map(|parameter| {
            if !ids.insert(parameter.tensor_id.clone())
                || !gradient_ids.insert(parameter.gradient_identity.clone())
            {
                return Err(TrainError::new(
                    "RCL_BF16_AD_PARAMETER_DUPLICATE",
                    "parameter and GradientIdentity order must be unique",
                ));
            }
            let (storage, shape) = parameter_descriptor(request, &parameter.tensor_id)?;
            if !storage_ids.insert(storage.clone()) {
                return Err(TrainError::new(
                    "RCL_BF16_AD_PARAMETER_ALIAS",
                    "parameters cannot share mutable storage",
                ));
            }
            if !request
                .autodiff
                .graph
                .exact_f32_storage_bits
                .contains_key(&storage)
            {
                return Err(TrainError::new(
                    "RCL_BF16_AD_EXACT_MASTER_REQUIRED",
                    format!("exact FP32 master bits are required for {storage}"),
                ));
            }
            Ok((parameter.clone(), storage, shape))
        })
        .collect()
}

fn initial_master(
    request: &Request,
    order: &[(Parameter, String, Vec<usize>)],
) -> Result<Vec<Vec<f32>>, TrainError> {
    order
        .iter()
        .map(|(parameter, storage, shape)| {
            decode_f32_bits(
                request
                    .autodiff
                    .graph
                    .exact_f32_storage_bits
                    .get(storage)
                    .unwrap(),
                shape.iter().product(),
                &format!("{}.masterWeight", parameter.tensor_id),
            )
        })
        .collect()
}

fn validate_or_initialize_states(
    request: &Request,
    order: &[(Parameter, String, Vec<usize>)],
) -> Result<Vec<OptimizerState>, TrainError> {
    if request.optimizer_states.is_empty() {
        return Ok(order
            .iter()
            .map(|(parameter, _, shape)| OptimizerState {
                tensor_id: parameter.tensor_id.clone(),
                step: 0,
                first_moment: vec![0.0; shape.iter().product()],
                second_moment: vec![0.0; shape.iter().product()],
                exact_first_moment_bits: Vec::new(),
                exact_second_moment_bits: Vec::new(),
            })
            .collect());
    }
    if request.optimizer_states.len() != order.len() {
        return Err(TrainError::new(
            "RCL_BF16_AD_STATE_COUNT",
            "optimizerStates must contain exactly one state per canonical parameter",
        ));
    }
    let mut result = Vec::with_capacity(order.len());
    let mut step = None;
    for ((parameter, _, shape), supplied) in order.iter().zip(&request.optimizer_states) {
        if supplied.tensor_id != parameter.tensor_id {
            return Err(TrainError::new(
                "RCL_BF16_AD_STATE_ORDER",
                "optimizerStates must follow canonical parameter order",
            ));
        }
        if step.is_none() {
            step = Some(supplied.step);
        }
        if step != Some(supplied.step) {
            return Err(TrainError::new(
                "RCL_BF16_AD_STATE_STEP",
                "all optimizer states must share one step",
            ));
        }
        let expected = shape.iter().product();
        if supplied.first_moment.len() != expected || supplied.second_moment.len() != expected {
            return Err(TrainError::new(
                "RCL_BF16_AD_STATE_SHAPE",
                format!("optimizer state shape mismatch for {}", supplied.tensor_id),
            ));
        }
        if supplied.exact_first_moment_bits.is_empty()
            || supplied.exact_second_moment_bits.is_empty()
        {
            return Err(TrainError::new(
                "RCL_BF16_AD_EXACT_STATE_REQUIRED",
                format!(
                    "exact FP32 moments are required for {} resume",
                    supplied.tensor_id
                ),
            ));
        }
        let first = decode_f32_bits(
            &supplied.exact_first_moment_bits,
            expected,
            &format!("{}.firstMoment", supplied.tensor_id),
        )?;
        let second = decode_f32_bits(
            &supplied.exact_second_moment_bits,
            expected,
            &format!("{}.secondMoment", supplied.tensor_id),
        )?;
        result.push(OptimizerState {
            tensor_id: supplied.tensor_id.clone(),
            step: supplied.step,
            first_moment: first,
            second_moment: second,
            exact_first_moment_bits: supplied.exact_first_moment_bits.clone(),
            exact_second_moment_bits: supplied.exact_second_moment_bits.clone(),
        });
    }
    Ok(result)
}

fn sync_master(
    request: &mut Request,
    order: &[(Parameter, String, Vec<usize>)],
    master: &[Vec<f32>],
) {
    for ((_, storage, _), values) in order.iter().zip(master) {
        let target = request
            .autodiff
            .graph
            .storages
            .iter_mut()
            .find(|item| item.identity == *storage)
            .unwrap();
        target.data = values.iter().map(|value| *value as f64).collect();
        request
            .autodiff
            .graph
            .exact_f32_storage_bits
            .insert(storage.clone(), exact_f32_bits(values));
    }
}

fn gradients(
    result: &AutodiffResult,
    order: &[(Parameter, String, Vec<usize>)],
) -> Result<Vec<Vec<f32>>, TrainError> {
    if result.gradients.len() != order.len() {
        return Err(TrainError::new(
            "RCL_BF16_AD_GRADIENT_COUNT",
            "Autodiff did not return one gradient per canonical parameter",
        ));
    }
    order
        .iter()
        .zip(&result.gradients)
        .map(|((parameter, _, shape), gradient)| {
            if gradient.parameter.tensor_id != parameter.tensor_id || gradient.tensor.dtype != "f32"
            {
                return Err(TrainError::new(
                    "RCL_BF16_AD_GRADIENT_BINDING",
                    format!("gradient binding mismatch for {}", parameter.tensor_id),
                ));
            }
            if gradient.storage.data.len() != shape.iter().product::<usize>() {
                return Err(TrainError::new(
                    "RCL_BF16_AD_GRADIENT_SHAPE",
                    format!("gradient shape mismatch for {}", parameter.tensor_id),
                ));
            }
            gradient
                .storage
                .data
                .iter()
                .map(|value| {
                    let narrowed = *value as f32;
                    if narrowed.is_finite() {
                        Ok(narrowed)
                    } else {
                        Err(TrainError::new(
                            "RCL_BF16_AD_NONFINITE",
                            "gradient is non-finite",
                        ))
                    }
                })
                .collect()
        })
        .collect()
}

fn f32_pow(base: f32, exponent: usize) -> f32 {
    let mut result = 1.0f32;
    for _ in 0..exponent {
        result *= base;
    }
    result
}

fn adamw_step(
    master: &mut [Vec<f32>],
    gradients: &[Vec<f32>],
    states: &mut [OptimizerState],
    config: &AdamWConfig,
) -> Result<(), TrainError> {
    for ((weights, gradient), state) in master.iter_mut().zip(gradients).zip(states.iter_mut()) {
        let next_step = state.step.checked_add(1).ok_or_else(|| {
            TrainError::new("RCL_BF16_AD_STEP_OVERFLOW", "optimizer step overflowed")
        })?;
        let bias1 = 1.0 - f32_pow(config.beta1, next_step);
        let bias2 = 1.0 - f32_pow(config.beta2, next_step);
        let decay = 1.0 - config.learning_rate * config.weight_decay;
        for index in 0..weights.len() {
            let grad = gradient[index]
                .max(-config.gradient_clip)
                .min(config.gradient_clip);
            let beta1_complement = 1.0f32 - config.beta1;
            let beta2_complement = 1.0f32 - config.beta2;
            let first_product = config.beta1 * state.first_moment[index];
            let gradient_first_product = beta1_complement * grad;
            let next_m = first_product + gradient_first_product;
            let second_product = config.beta2 * state.second_moment[index];
            let gradient_second_product = beta2_complement * grad * grad;
            let next_v = second_product + gradient_second_product;
            let bias_corrected_first = next_m / bias1;
            let bias_corrected_second = next_v / bias2;
            let direction = bias_corrected_first / (bias_corrected_second.sqrt() + config.epsilon);
            let decayed_weight = weights[index] * decay;
            let gradient_step = config.learning_rate * direction;
            let next_weight = decayed_weight - gradient_step;
            if !next_m.is_finite() || !next_v.is_finite() || !next_weight.is_finite() {
                return Err(TrainError::new(
                    "RCL_BF16_AD_UPDATE_NONFINITE",
                    "AdamW produced a non-finite FP32 update",
                ));
            }
            state.first_moment[index] = next_m;
            state.second_moment[index] = next_v;
            weights[index] = next_weight;
        }
        state.step = next_step;
        state.exact_first_moment_bits = exact_f32_bits(&state.first_moment);
        state.exact_second_moment_bits = exact_f32_bits(&state.second_moment);
    }
    Ok(())
}

#[derive(Default)]
struct GpuOptimizerTelemetry {
    elements: usize,
    execution_roots: Vec<String>,
}

fn provider_error_code(value: &Value) -> &'static str {
    match value.get("code").and_then(Value::as_str) {
        Some("RCL_OPENCL_BACKEND_UNAVAILABLE") => "RCL_OPENCL_BACKEND_UNAVAILABLE",
        Some("RCL_OPENCL_AMD_DEVICE_REQUIRED") => "RCL_OPENCL_AMD_DEVICE_REQUIRED",
        Some("RCL_OPENCL_F32_BITS") => "RCL_OPENCL_F32_BITS",
        Some("RCL_OPENCL_F32_NONFINITE") => "RCL_OPENCL_F32_NONFINITE",
        Some("RCL_OPENCL_ADAMW_CONFIG") => "RCL_OPENCL_ADAMW_CONFIG",
        Some("RCL_OPENCL_SHAPE") => "RCL_OPENCL_SHAPE",
        _ => "RCL_ACCELERATOR_EXECUTION_FAILED",
    }
}

fn gpu_provider_path(request: &AutodiffRequest) -> Result<PathBuf, TrainError> {
    let value = request
        .graph
        .bindings
        .get("providerPath")
        .and_then(Value::as_str)
        .filter(|path| !path.is_empty())
        .ok_or_else(|| {
            TrainError::new(
                "RCL_ACCELERATOR_PROVIDER_REQUIRED",
                "GPU AdamW requires an explicit providerPath",
            )
        })?;
    let path = PathBuf::from(value);
    if !path.is_file() {
        return Err(TrainError::new(
            "RCL_ACCELERATOR_PROVIDER_UNAVAILABLE",
            format!("GPU AdamW provider path is not a file: {}", path.display()),
        ));
    }
    Ok(path)
}

fn decode_gpu_f32_output(
    response: &Value,
    key: &str,
    expected: usize,
) -> Result<Vec<f32>, TrainError> {
    let values = response.get(key).and_then(Value::as_array).ok_or_else(|| {
        TrainError::new(
            "RCL_ACCELERATOR_RESPONSE_INVALID",
            format!("GPU AdamW response omitted {key}"),
        )
    })?;
    if values.len() != expected {
        return Err(TrainError::new(
            "RCL_ACCELERATOR_RESPONSE_INVALID",
            format!("GPU AdamW response {key} length mismatch"),
        ));
    }
    values
        .iter()
        .map(|value| {
            let bits = value.as_str().ok_or_else(|| {
                TrainError::new(
                    "RCL_ACCELERATOR_RESPONSE_INVALID",
                    format!("GPU AdamW response {key} must contain strings"),
                )
            })?;
            if bits.len() != 8 || bits.to_ascii_lowercase() != bits {
                return Err(TrainError::new(
                    "RCL_ACCELERATOR_RESPONSE_INVALID",
                    format!("GPU AdamW response {key} must contain lowercase FP32 bits"),
                ));
            }
            let parsed = u32::from_str_radix(bits, 16).map_err(|_| {
                TrainError::new(
                    "RCL_ACCELERATOR_RESPONSE_INVALID",
                    format!("GPU AdamW response {key} contains invalid FP32 bits"),
                )
            })?;
            let decoded = f32::from_bits(parsed);
            if !decoded.is_finite() {
                return Err(TrainError::new(
                    "RCL_ACCELERATOR_RESPONSE_INVALID",
                    format!("GPU AdamW response {key} contains a non-finite value"),
                ));
            }
            Ok(decoded)
        })
        .collect()
}

fn execute_gpu_adamw(
    provider_path: &PathBuf,
    master: &[f32],
    gradient: &[f32],
    state: &OptimizerState,
    config: &AdamWConfig,
) -> Result<(Vec<f32>, Vec<f32>, Vec<f32>, String), TrainError> {
    if master.len() != gradient.len()
        || master.len() != state.first_moment.len()
        || master.len() != state.second_moment.len()
    {
        return Err(TrainError::new(
            "RCL_ACCELERATOR_INPUT_INVALID",
            "GPU AdamW inputs have inconsistent lengths",
        ));
    }
    let next_step = state
        .step
        .checked_add(1)
        .ok_or_else(|| TrainError::new("RCL_BF16_AD_STEP_OVERFLOW", "optimizer step overflowed"))?;
    let bias1 = 1.0 - f32_pow(config.beta1, next_step);
    let bias2 = 1.0 - f32_pow(config.beta2, next_step);
    let decay = 1.0 - config.learning_rate * config.weight_decay;
    let payload = json!({
        "format": "rcl.opencl-adamw-update-request.v0.1",
        "backend": "opencl-amd",
        "length": master.len(),
        "step": next_step,
        "masterBits": exact_f32_bits(master),
        "gradientBits": exact_f32_bits(gradient),
        "firstMomentBits": exact_f32_bits(&state.first_moment),
        "secondMomentBits": exact_f32_bits(&state.second_moment),
        "beta1": config.beta1,
        "beta2": config.beta2,
        "bias1": bias1,
        "bias2": bias2,
        "learningRate": config.learning_rate,
        "decay": decay,
        "epsilon": config.epsilon,
        "gradientClip": config.gradient_clip,
    });
    let python = env::var("RCL_PYTHON").unwrap_or_else(|_| {
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
            TrainError::new(
                "RCL_ACCELERATOR_PROVIDER_UNAVAILABLE",
                format!("could not start OpenCL provider: {error}"),
            )
        })?;
    let encoded = serde_json::to_vec(&payload).map_err(|error| {
        TrainError::new(
            "RCL_ACCELERATOR_REQUEST_JSON",
            format!("could not encode GPU AdamW request: {error}"),
        )
    })?;
    let mut stdin = child.stdin.take().ok_or_else(|| {
        TrainError::new(
            "RCL_ACCELERATOR_PROVIDER_UNAVAILABLE",
            "OpenCL provider stdin was unavailable",
        )
    })?;
    use std::io::Write;
    stdin.write_all(&encoded).map_err(|error| {
        TrainError::new(
            "RCL_ACCELERATOR_PROVIDER_UNAVAILABLE",
            format!("could not send GPU AdamW request: {error}"),
        )
    })?;
    drop(stdin);
    let output = child.wait_with_output().map_err(|error| {
        TrainError::new(
            "RCL_ACCELERATOR_EXECUTION_FAILED",
            format!("OpenCL provider process failed: {error}"),
        )
    })?;
    if !output.status.success() {
        let error_value = serde_json::from_slice::<Value>(&output.stderr).unwrap_or_else(
            |_| json!({"message": String::from_utf8_lossy(&output.stderr).to_string()}),
        );
        return Err(TrainError::new(
            provider_error_code(&error_value),
            error_value
                .get("message")
                .and_then(Value::as_str)
                .unwrap_or("OpenCL provider failed")
                .to_owned(),
        ));
    }
    let response: Value = serde_json::from_slice(&output.stdout).map_err(|error| {
        TrainError::new(
            "RCL_ACCELERATOR_RESPONSE_JSON",
            format!("OpenCL provider returned invalid GPU AdamW JSON: {error}"),
        )
    })?;
    if response.get("format").and_then(Value::as_str) != Some("rcl.opencl-adamw-update-result.v0.1")
        || response.get("status").and_then(Value::as_str)
            != Some("PASS_LOCAL_GPU_ADAMW_REFERENCE_CANDIDATE")
        || response.get("backend").and_then(Value::as_str) != Some("opencl-amd")
        || response.get("gpuExecuted").and_then(Value::as_bool) != Some(true)
    {
        return Err(TrainError::new(
            "RCL_ACCELERATOR_RESPONSE_INVALID",
            "OpenCL provider did not return an admitted GPU AdamW result",
        ));
    }
    let root = response
        .get("executionRoot")
        .and_then(Value::as_str)
        .filter(|value| value.len() == 64 && value.chars().all(|item| item.is_ascii_hexdigit()))
        .map(str::to_owned)
        .ok_or_else(|| {
            TrainError::new(
                "RCL_ACCELERATOR_RESPONSE_INVALID",
                "OpenCL provider omitted a GPU AdamW execution root",
            )
        })?;
    Ok((
        decode_gpu_f32_output(&response, "masterBits", master.len())?,
        decode_gpu_f32_output(&response, "firstMomentBits", master.len())?,
        decode_gpu_f32_output(&response, "secondMomentBits", master.len())?,
        root,
    ))
}

fn adamw_step_gpu(
    master: &mut [Vec<f32>],
    gradients: &[Vec<f32>],
    states: &mut [OptimizerState],
    config: &AdamWConfig,
    provider_path: &PathBuf,
    telemetry: &mut GpuOptimizerTelemetry,
) -> Result<(), TrainError> {
    for ((weights, gradient), state) in master.iter_mut().zip(gradients).zip(states.iter_mut()) {
        let (next_master, next_first, next_second, root) =
            execute_gpu_adamw(provider_path, weights, gradient, state, config)?;
        telemetry.elements = telemetry
            .elements
            .checked_add(weights.len())
            .ok_or_else(|| {
                TrainError::new(
                    "RCL_BF16_AD_MEMORY_LIMIT",
                    "GPU optimizer accounting overflowed",
                )
            })?;
        telemetry.execution_roots.push(root);
        weights.copy_from_slice(&next_master);
        state.first_moment = next_first;
        state.second_moment = next_second;
        state.step = state.step.checked_add(1).ok_or_else(|| {
            TrainError::new("RCL_BF16_AD_STEP_OVERFLOW", "optimizer step overflowed")
        })?;
        state.exact_first_moment_bits = exact_f32_bits(&state.first_moment);
        state.exact_second_moment_bits = exact_f32_bits(&state.second_moment);
    }
    Ok(())
}

fn checkpoint_root(
    config: &AdamWConfig,
    order: &[(Parameter, String, Vec<usize>)],
    master: &[Vec<f32>],
    states: &[OptimizerState],
) -> String {
    let config_bits = [
        config.learning_rate,
        config.beta1,
        config.beta2,
        config.epsilon,
        config.weight_decay,
        config.gradient_clip,
    ]
    .iter()
    .map(|value| format!("{:08x}", value.to_bits()))
    .collect::<Vec<_>>();
    let payload = json!({
        "format": RESULT_FORMAT,
        "policy": POLICY,
        "parameterOrder": order.iter().map(|(parameter, storage, _)| json!({"tensorId": parameter.tensor_id, "storageIdentity": storage})).collect::<Vec<_>>(),
        "configBits": config_bits,
        "masterWeightBits": master.iter().map(|values| exact_f32_bits(values)).collect::<Vec<_>>(),
        "optimizerStateBits": states.iter().map(|state| json!({"tensorId": state.tensor_id, "step": state.step, "firstMomentBits": state.exact_first_moment_bits, "secondMomentBits": state.exact_second_moment_bits})).collect::<Vec<_>>(),
    });
    format!(
        "sha256:{}",
        hex::encode(Sha256::digest(serde_json::to_vec(&payload).unwrap()))
    )
}

fn make_parameters(
    order: &[(Parameter, String, Vec<usize>)],
    master: &[Vec<f32>],
) -> Result<Vec<ParameterReceipt>, TrainError> {
    order
        .iter()
        .zip(master)
        .map(|((parameter, _, shape), values)| {
            Ok(ParameterReceipt {
                tensor_id: parameter.tensor_id.clone(),
                master_weight: f32_receipt(shape.clone(), values.clone(), "masterWeight"),
                compute_weight: bf16_receipt(shape.clone(), values)?,
            })
        })
        .collect()
}

fn train(mut request: Request) -> Result<ResultReceipt, TrainError> {
    if request.format != REQUEST_FORMAT {
        return Err(TrainError::new(
            "RCL_BF16_AD_FORMAT",
            format!("unsupported request format {}", request.format),
        ));
    }
    if request.backend != BACKEND
        && request.backend != HYBRID_BACKEND
        && request.backend != GPU_TRAINING_BACKEND
    {
        return Err(TrainError::new(
            "RCL_ACCELERATOR_BACKEND_UNAVAILABLE",
            format!(
                "backend {} is unavailable; silent CPU fallback is forbidden",
                request.backend
            ),
        ));
    }
    let graph_backend = request
        .autodiff
        .graph
        .bindings
        .get("backend")
        .and_then(|value| value.as_str())
        .unwrap_or(BACKEND);
    let expected_graph_backend = match request.backend.as_str() {
        HYBRID_BACKEND => HYBRID_BACKEND,
        GPU_TRAINING_BACKEND => GPU_TRAINING_BACKEND,
        _ => BACKEND,
    };
    if graph_backend != expected_graph_backend {
        return Err(TrainError::new(
            "RCL_ACCELERATOR_BACKEND_GRAPH_MISMATCH",
            format!(
                "training backend {} does not match graph backend {}",
                request.backend, graph_backend
            ),
        ));
    }
    if request.steps == 0 || request.steps > MAX_STEPS {
        return Err(TrainError::new(
            "RCL_BF16_AD_STEP_LIMIT",
            format!("steps must be within 1..={MAX_STEPS}"),
        ));
    }
    if request.autodiff.precision.as_deref() != Some(BF16_AUTODIFF_PRECISION) {
        return Err(TrainError::new(
            "RCL_BF16_AD_PRECISION_REQUIRED",
            "request must explicitly select bf16-rne-fp32-accumulation",
        ));
    }
    validate_config(&request.config)?;
    if request.autodiff.graph.nodes.iter().any(|node| {
        let operation = node.operation.to_ascii_lowercase();
        operation.contains("special")
            || operation.contains("transformer")
            || operation.contains("lm")
    }) {
        return Err(TrainError::new(
            "RCL_BF16_AD_MODEL_SPECIAL_OPERATION",
            "model-special operations are forbidden",
        ));
    }
    let order = parameter_order(&request)?;
    let mut master = initial_master(&request, &order)?;
    let mut states = validate_or_initialize_states(&request, &order)?;
    let gpu_provider = if request.backend == GPU_TRAINING_BACKEND {
        Some(gpu_provider_path(&request.autodiff)?)
    } else {
        None
    };
    let mut gpu_optimizer_telemetry = GpuOptimizerTelemetry::default();
    sync_master(&mut request, &order, &master);
    let initial_result = backward(&request.autodiff)?;
    let initial_gradients = gradients(&initial_result, &order)?;
    for _ in 0..request.steps {
        sync_master(&mut request, &order, &master);
        let step_result = backward(&request.autodiff)?;
        let step_gradients = gradients(&step_result, &order)?;
        if let Some(provider_path) = gpu_provider.as_ref() {
            adamw_step_gpu(
                &mut master,
                &step_gradients,
                &mut states,
                &request.config,
                provider_path,
                &mut gpu_optimizer_telemetry,
            )?;
        } else {
            adamw_step(&mut master, &step_gradients, &mut states, &request.config)?;
        }
    }
    sync_master(&mut request, &order, &master);
    let final_result = backward(&request.autodiff)?;
    let final_gradients = gradients(&final_result, &order)?;
    let backward_edge_count = final_result.backward_edges.len();
    let parameter_elements = master.iter().map(Vec::len).sum::<usize>();
    let optimizer_state_elements = states
        .iter()
        .map(|state| state.first_moment.len() + state.second_moment.len())
        .sum::<usize>();
    let parameters = make_parameters(&order, &master)?;
    let checkpoint = checkpoint_root(&request.config, &order, &master, &states);
    Ok(ResultReceipt {
        format: RESULT_FORMAT,
        status: "ok",
        initial_loss: initial_result.loss.storage.data[0] as f32,
        final_loss: final_result.loss.storage.data[0] as f32,
        initial_gradients: order
            .iter()
            .zip(initial_gradients)
            .map(|((parameter, _, shape), values)| GradientReceipt {
                tensor_id: parameter.tensor_id.clone(),
                gradient: f32_receipt(
                    shape.clone(),
                    values,
                    &format!("{}.gradient.initial", parameter.tensor_id),
                ),
            })
            .collect(),
        final_gradients: order
            .iter()
            .zip(final_gradients)
            .map(|((parameter, _, shape), values)| GradientReceipt {
                tensor_id: parameter.tensor_id.clone(),
                gradient: f32_receipt(
                    shape.clone(),
                    values,
                    &format!("{}.gradient.final", parameter.tensor_id),
                ),
            })
            .collect(),
        parameters,
        optimizer_states: states,
        parameter_order: order
            .iter()
            .map(|(parameter, _, _)| parameter.tensor_id.clone())
            .collect(),
        autodiff_precision: BF16_AUTODIFF_PRECISION,
        checkpoint_root: checkpoint,
        telemetry: Telemetry {
            backend: if request.backend == HYBRID_BACKEND {
                "rcl-tensor-bf16-autodiff-adamw-opencl-amd-hybrid-v0.1"
            } else if request.backend == GPU_TRAINING_BACKEND {
                "rcl-tensor-bf16-autodiff-adamw-opencl-amd-gpu-training-v0.1"
            } else {
                "rcl-tensor-bf16-autodiff-adamw-cpu-reference-v0.2"
            },
            execution_backend: final_result.telemetry.execution_backend.clone(),
            policy: POLICY,
            forward_compute_dtype: "bf16",
            activation_compute_dtype: "bf16",
            accumulation_dtype: "f32",
            gradient_dtype: "f32",
            master_weight_dtype: "f32",
            optimizer_state_dtype: "f32",
            cast_backward_policy: "straight-through-fp32",
            steps: request.steps,
            parameter_count: order.len(),
            parameter_elements,
            optimizer_state_elements,
            backward_edge_count,
            gpu_matmul_nodes: final_result.telemetry.gpu_matmul_nodes,
            host_cpu_nodes: final_result.telemetry.host_cpu_nodes,
            gpu_execution_roots: final_result.telemetry.gpu_execution_roots.clone(),
            gpu_backward_matmul_nodes: final_result.telemetry.gpu_backward_matmul_nodes,
            gpu_backward_execution_roots: final_result
                .telemetry
                .gpu_backward_execution_roots
                .clone(),
            gpu_optimizer_elements: gpu_optimizer_telemetry.elements,
            gpu_optimizer_execution_roots: gpu_optimizer_telemetry.execution_roots,
        },
        gpu_claim: false,
    })
}

fn read_request(argument: Option<&String>) -> Result<String, TrainError> {
    match argument {
        Some(path) if path != "-" => fs::read_to_string(path)
            .map_err(|error| TrainError::new("RCL_BF16_AD_REQUEST_IO", error.to_string())),
        _ => {
            let mut input = String::new();
            io::stdin()
                .read_to_string(&mut input)
                .map_err(|error| TrainError::new("RCL_BF16_AD_REQUEST_IO", error.to_string()))?;
            Ok(input)
        }
    }
}

fn fail(error: TrainError) -> ! {
    eprintln!(
        "{}",
        json!({"status":"error", "code":error.code, "message":error.message})
    );
    std::process::exit(1)
}

fn main() {
    let arguments = env::args().collect::<Vec<_>>();
    let input = read_request(arguments.get(1)).unwrap_or_else(|error| fail(error));
    let request = serde_json::from_str::<Request>(&input).unwrap_or_else(|error| {
        fail(TrainError::new(
            "RCL_BF16_AD_REQUEST_JSON",
            error.to_string(),
        ))
    });
    let result = train(request).unwrap_or_else(|error| fail(error));
    println!("{}", serde_json::to_string(&result).unwrap());
}
