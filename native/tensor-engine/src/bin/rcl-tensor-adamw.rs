use rcl_tensor_engine::{
    AutodiffRequest, DenseStorage, PlanTensorResult, TensorDescriptor, backward, execute_plan,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};
use std::env;
use std::fs;
use std::io::{self, Read};

const REQUEST_FORMAT: &str = "rcl.tensor-autodiff-adamw-training-request.v0.1";
const RESPONSE_FORMAT: &str = "rcl.tensor-autodiff-adamw-training-result.v0.1";
const MAX_TRAINING_STEPS: usize = 16_384;
const MAX_TRAINING_NODE_STEPS: usize = 2_000_000;

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct AdamWConfig {
    learning_rate: f64,
    beta1: f64,
    beta2: f64,
    epsilon: f64,
    weight_decay: f64,
    gradient_clip: f64,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ParameterOptimizerState {
    tensor_id: String,
    step: usize,
    first_moment: Vec<f64>,
    second_moment: Vec<f64>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    exact_first_moment_bits: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    exact_second_moment_bits: Vec<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct AdamWTrainingRequest {
    format: String,
    autodiff: AutodiffRequest,
    steps: usize,
    config: AdamWConfig,
    #[serde(default)]
    optimizer_states: Vec<ParameterOptimizerState>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct AdamWTelemetry {
    backend: &'static str,
    optimizer_semantics: &'static str,
    steps: usize,
    parameter_count: usize,
    parameter_elements: usize,
    optimizer_state_elements: usize,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct AdamWTrainingResult {
    format: &'static str,
    status: &'static str,
    initial_loss: f64,
    final_loss: f64,
    parameters: Vec<PlanTensorResult>,
    outputs: Vec<PlanTensorResult>,
    optimizer_states: Vec<ParameterOptimizerState>,
    checkpoint_root: String,
    telemetry: AdamWTelemetry,
}

#[derive(Debug)]
struct BridgeError {
    code: &'static str,
    message: String,
}

impl BridgeError {
    fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self { code, message: message.into() }
    }
}

fn validate_config(config: &AdamWConfig) -> Result<(), BridgeError> {
    if !config.learning_rate.is_finite() || config.learning_rate <= 0.0 {
        return Err(BridgeError::new("RCL_ADAMW_LEARNING_RATE", "learningRate must be finite and positive"));
    }
    if !config.beta1.is_finite() || config.beta1 < 0.0 || config.beta1 >= 1.0 {
        return Err(BridgeError::new("RCL_ADAMW_BETA1", "beta1 must be in [0, 1)"));
    }
    if !config.beta2.is_finite() || config.beta2 < 0.0 || config.beta2 >= 1.0 {
        return Err(BridgeError::new("RCL_ADAMW_BETA2", "beta2 must be in [0, 1)"));
    }
    if !config.epsilon.is_finite() || config.epsilon <= 0.0 {
        return Err(BridgeError::new("RCL_ADAMW_EPSILON", "epsilon must be finite and positive"));
    }
    if !config.weight_decay.is_finite() || config.weight_decay < 0.0 {
        return Err(BridgeError::new("RCL_ADAMW_WEIGHT_DECAY", "weightDecay must be finite and non-negative"));
    }
    if !config.gradient_clip.is_finite() || config.gradient_clip <= 0.0 {
        return Err(BridgeError::new("RCL_ADAMW_GRADIENT_CLIP", "gradientClip must be finite and positive"));
    }
    Ok(())
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

fn exact_f64_bits(values: &[f64]) -> Vec<String> {
    values.iter().map(|value| format!("{:016x}", value.to_bits())).collect()
}

fn decode_exact_f64_bits(
    values: &[String],
    expected_len: usize,
    length_code: &'static str,
    bits_code: &'static str,
    nonfinite_code: &'static str,
    label: &str,
) -> Result<Vec<f64>, BridgeError> {
    if values.len() != expected_len {
        return Err(BridgeError::new(
            length_code,
            format!("exact f64 bits length mismatch for {label}: expected {expected_len}, received {}", values.len()),
        ));
    }
    values
        .iter()
        .map(|bits| {
            if bits.len() != 16 {
                return Err(BridgeError::new(
                    bits_code,
                    format!("exact f64 bits must contain 16 hex digits for {label}, received {bits}"),
                ));
            }
            let parsed = u64::from_str_radix(bits, 16).map_err(|_| {
                BridgeError::new(bits_code, format!("invalid exact f64 bits for {label}: {bits}"))
            })?;
            let value = f64::from_bits(parsed);
            if !value.is_finite() {
                return Err(BridgeError::new(
                    nonfinite_code,
                    format!("exact f64 bits for {label} decode to non-finite value"),
                ));
            }
            Ok(value)
        })
        .collect()
}

fn materialize_exact_storage_bits(request: &mut AutodiffRequest) -> Result<(), BridgeError> {
    let exact = request.graph.exact_storage_bits.clone();
    for (storage_identity, bit_values) in exact {
        let storage = request
            .graph
            .storages
            .iter_mut()
            .find(|storage| storage.identity == storage_identity)
            .ok_or_else(|| BridgeError::new(
                "RCL_ADAMW_EXACT_STORAGE_MISSING",
                format!("exact storage bits reference unavailable storage {storage_identity}"),
            ))?;
        storage.data = decode_exact_f64_bits(
            &bit_values,
            storage.data.len(),
            "RCL_ADAMW_EXACT_STORAGE_LENGTH",
            "RCL_ADAMW_EXACT_STORAGE_BITS",
            "RCL_ADAMW_NONFINITE_PARAMETER",
            &storage_identity,
        )?;
    }
    Ok(())
}

fn parameter_descriptor<'a>(request: &'a AutodiffRequest, tensor_id: &str) -> Result<&'a TensorDescriptor, BridgeError> {
    request
        .graph
        .tensors
        .iter()
        .find(|tensor| tensor.id == tensor_id)
        .ok_or_else(|| BridgeError::new(
            "RCL_ADAMW_PARAMETER_NOT_INITIAL",
            format!("parameter {tensor_id} is not an initial graph tensor"),
        ))
}

fn parameter_storage<'a>(request: &'a AutodiffRequest, descriptor: &TensorDescriptor) -> Result<&'a DenseStorage, BridgeError> {
    request
        .graph
        .storages
        .iter()
        .find(|storage| storage.identity == descriptor.storage_identity)
        .ok_or_else(|| BridgeError::new(
            "RCL_ADAMW_PARAMETER_STORAGE_MISSING",
            format!("parameter storage {} is unavailable", descriptor.storage_identity),
        ))
}

fn initialize_or_validate_states(
    request: &AutodiffRequest,
    supplied: &[ParameterOptimizerState],
) -> Result<Vec<ParameterOptimizerState>, BridgeError> {
    if supplied.is_empty() {
        return request
            .parameters
            .iter()
            .map(|parameter| {
                let descriptor = parameter_descriptor(request, &parameter.tensor_id)?;
                let storage = parameter_storage(request, descriptor)?;
                Ok(ParameterOptimizerState {
                    tensor_id: parameter.tensor_id.clone(),
                    step: 0,
                    first_moment: vec![0.0; storage.data.len()],
                    second_moment: vec![0.0; storage.data.len()],
                    exact_first_moment_bits: Vec::new(),
                    exact_second_moment_bits: Vec::new(),
                })
            })
            .collect();
    }

    if supplied.len() != request.parameters.len() {
        return Err(BridgeError::new(
            "RCL_ADAMW_STATE_COUNT",
            "optimizerStates must contain exactly one state per trainable parameter",
        ));
    }
    let expected = request.parameters.iter().map(|parameter| parameter.tensor_id.as_str()).collect::<HashSet<_>>();
    let actual = supplied.iter().map(|state| state.tensor_id.as_str()).collect::<HashSet<_>>();
    if expected != actual || actual.len() != supplied.len() {
        return Err(BridgeError::new(
            "RCL_ADAMW_STATE_BINDING",
            "optimizerStates must bind uniquely to the trainable parameter set",
        ));
    }
    let common_step = supplied[0].step;
    let mut result = Vec::with_capacity(supplied.len());
    for supplied_state in supplied {
        if supplied_state.step != common_step {
            return Err(BridgeError::new(
                "RCL_ADAMW_STATE_STEP_MISMATCH",
                "all parameter optimizer states must share the same step",
            ));
        }
        let descriptor = parameter_descriptor(request, &supplied_state.tensor_id)?;
        let storage = parameter_storage(request, descriptor)?;
        let mut state = supplied_state.clone();
        if state.first_moment.len() != storage.data.len() || state.second_moment.len() != storage.data.len() {
            return Err(BridgeError::new(
                "RCL_ADAMW_STATE_SHAPE",
                format!("optimizer state shape mismatch for {}", state.tensor_id),
            ));
        }
        let has_exact_first = !state.exact_first_moment_bits.is_empty();
        let has_exact_second = !state.exact_second_moment_bits.is_empty();
        if has_exact_first != has_exact_second {
            return Err(BridgeError::new(
                "RCL_ADAMW_STATE_EXACT_BINDING",
                format!("exact optimizer-state bits must provide both moments for {}", state.tensor_id),
            ));
        }
        if has_exact_first {
            state.first_moment = decode_exact_f64_bits(
                &state.exact_first_moment_bits,
                storage.data.len(),
                "RCL_ADAMW_STATE_EXACT_LENGTH",
                "RCL_ADAMW_STATE_EXACT_BITS",
                "RCL_ADAMW_STATE_NONFINITE",
                &format!("{}.firstMoment", state.tensor_id),
            )?;
            state.second_moment = decode_exact_f64_bits(
                &state.exact_second_moment_bits,
                storage.data.len(),
                "RCL_ADAMW_STATE_EXACT_LENGTH",
                "RCL_ADAMW_STATE_EXACT_BITS",
                "RCL_ADAMW_STATE_NONFINITE",
                &format!("{}.secondMoment", state.tensor_id),
            )?;
        }
        if state.first_moment.iter().chain(&state.second_moment).any(|value| !value.is_finite()) {
            return Err(BridgeError::new(
                "RCL_ADAMW_STATE_NONFINITE",
                format!("optimizer state contains non-finite values for {}", state.tensor_id),
            ));
        }
        result.push(state);
    }
    result.sort_by(|left, right| left.tensor_id.cmp(&right.tensor_id));
    Ok(result)
}

fn apply_adamw_step(
    request: &mut AutodiffRequest,
    states: &mut [ParameterOptimizerState],
    config: &AdamWConfig,
) -> Result<(), BridgeError> {
    let result = backward(request).map_err(|error| BridgeError::new(error.code, error.message))?;
    let gradients = result
        .gradients
        .iter()
        .map(|gradient| (gradient.parameter.tensor_id.as_str(), gradient.storage.data.as_slice()))
        .collect::<HashMap<_, _>>();

    let mut mutable_storage_ids = HashSet::new();
    for state in states.iter_mut() {
        let tensor_index = request
            .graph
            .tensors
            .iter()
            .position(|tensor| tensor.id == state.tensor_id)
            .ok_or_else(|| BridgeError::new(
                "RCL_ADAMW_PARAMETER_NOT_INITIAL",
                format!("parameter {} is unavailable", state.tensor_id),
            ))?;
        let descriptor = request.graph.tensors[tensor_index].clone();
        let old_storage_identity = descriptor.storage_identity.clone();
        if !mutable_storage_ids.insert(old_storage_identity.clone()) {
            return Err(BridgeError::new(
                "RCL_ADAMW_PARAMETER_STORAGE_ALIAS",
                "trainable parameters cannot share mutable storage",
            ));
        }
        let storage_index = request
            .graph
            .storages
            .iter()
            .position(|storage| storage.identity == old_storage_identity)
            .ok_or_else(|| BridgeError::new(
                "RCL_ADAMW_PARAMETER_STORAGE_MISSING",
                format!("parameter storage {old_storage_identity} is unavailable"),
            ))?;
        let gradient = gradients.get(state.tensor_id.as_str()).ok_or_else(|| BridgeError::new(
            "RCL_ADAMW_GRADIENT_MISSING",
            format!("gradient is unavailable for parameter {}", state.tensor_id),
        ))?;
        if gradient.len() != request.graph.storages[storage_index].data.len() {
            return Err(BridgeError::new(
                "RCL_ADAMW_GRADIENT_SHAPE",
                format!("gradient shape differs for parameter {}", state.tensor_id),
            ));
        }

        let next_step = state.step.checked_add(1).ok_or_else(|| {
            BridgeError::new("RCL_ADAMW_STEP_OVERFLOW", "optimizer step overflowed usize")
        })?;
        let bias1 = 1.0 - config.beta1.powi(next_step as i32);
        let bias2 = 1.0 - config.beta2.powi(next_step as i32);
        let decay_factor = 1.0 - config.learning_rate * config.weight_decay;
        let mut updated = Vec::with_capacity(gradient.len());

        for (index, raw_gradient) in gradient.iter().copied().enumerate() {
            let clipped = raw_gradient.max(-config.gradient_clip).min(config.gradient_clip);
            let next_m = config.beta1 * state.first_moment[index] + (1.0 - config.beta1) * clipped;
            let next_v = config.beta2 * state.second_moment[index] + (1.0 - config.beta2) * clipped * clipped;
            let m_hat = next_m / bias1;
            let v_hat = next_v / bias2;
            let direction = m_hat / (v_hat.sqrt() + config.epsilon);
            let parameter = request.graph.storages[storage_index].data[index];
            let next_parameter = parameter * decay_factor - config.learning_rate * direction;
            if !next_m.is_finite() || !next_v.is_finite() || !next_parameter.is_finite() {
                return Err(BridgeError::new(
                    "RCL_ADAMW_NONFINITE_UPDATE",
                    format!("AdamW produced a non-finite update for {}", state.tensor_id),
                ));
            }
            state.first_moment[index] = next_m;
            state.second_moment[index] = next_v;
            updated.push(next_parameter);
        }
        state.step = next_step;
        state.exact_first_moment_bits = exact_f64_bits(&state.first_moment);
        state.exact_second_moment_bits = exact_f64_bits(&state.second_moment);

        let new_identity = output_identity(&descriptor.dtype, &descriptor.shape, &updated);
        request.graph.storages[storage_index].identity = new_identity.clone();
        request.graph.storages[storage_index].data = updated;
        request.graph.tensors[tensor_index].storage_identity = new_identity;
        request.graph.exact_storage_bits.remove(&old_storage_identity);
    }
    Ok(())
}

fn collect_parameters(request: &AutodiffRequest) -> Result<Vec<PlanTensorResult>, BridgeError> {
    request
        .parameters
        .iter()
        .map(|parameter| {
            let tensor = parameter_descriptor(request, &parameter.tensor_id)?.clone();
            let storage = parameter_storage(request, &tensor)?.clone();
            Ok(PlanTensorResult { tensor, storage })
        })
        .collect()
}

fn checkpoint_root(
    config: &AdamWConfig,
    parameters: &[PlanTensorResult],
    states: &[ParameterOptimizerState],
) -> String {
    let payload = json!({
        "optimizer": "rcl.adamw.v0.1",
        "config": config,
        "parameters": parameters,
        "optimizerStates": states,
    });
    format!("sha256:{}", hex::encode(Sha256::digest(serde_json::to_vec(&payload).unwrap())))
}

fn train(mut training: AdamWTrainingRequest) -> Result<AdamWTrainingResult, BridgeError> {
    if training.format != REQUEST_FORMAT {
        return Err(BridgeError::new(
            "RCL_ADAMW_FORMAT",
            format!("unsupported request format {}", training.format),
        ));
    }
    validate_config(&training.config)?;
    if training.steps == 0 || training.steps > MAX_TRAINING_STEPS {
        return Err(BridgeError::new(
            "RCL_ADAMW_TRAINING_STEP_LIMIT",
            format!("training steps must be within 1..={MAX_TRAINING_STEPS}"),
        ));
    }
    let node_steps = training.autodiff.graph.nodes.len().checked_mul(training.steps).ok_or_else(|| {
        BridgeError::new("RCL_ADAMW_TRAINING_WORK_LIMIT", "training node-step accounting overflowed")
    })?;
    if node_steps > MAX_TRAINING_NODE_STEPS {
        return Err(BridgeError::new(
            "RCL_ADAMW_TRAINING_WORK_LIMIT",
            format!("training requests at most {MAX_TRAINING_NODE_STEPS} node-steps, received {node_steps}"),
        ));
    }

    materialize_exact_storage_bits(&mut training.autodiff)?;
    let mut states = initialize_or_validate_states(&training.autodiff, &training.optimizer_states)?;
    let initial = backward(&training.autodiff).map_err(|error| BridgeError::new(error.code, error.message))?;
    for _ in 0..training.steps {
        apply_adamw_step(&mut training.autodiff, &mut states, &training.config)?;
    }
    let final_result = backward(&training.autodiff).map_err(|error| BridgeError::new(error.code, error.message))?;
    let forward = execute_plan(&training.autodiff.graph).map_err(|error| BridgeError::new(error.code, error.message))?;
    let parameters = collect_parameters(&training.autodiff)?;
    let parameter_elements = parameters.iter().map(|value| value.storage.data.len()).sum::<usize>();
    let optimizer_state_elements = states
        .iter()
        .map(|state| state.first_moment.len() + state.second_moment.len())
        .sum::<usize>();
    let root = checkpoint_root(&training.config, &parameters, &states);

    Ok(AdamWTrainingResult {
        format: RESPONSE_FORMAT,
        status: "ok",
        initial_loss: initial.loss.storage.data[0],
        final_loss: final_result.loss.storage.data[0],
        parameters,
        outputs: forward.outputs,
        optimizer_states: states,
        checkpoint_root: root,
        telemetry: AdamWTelemetry {
            backend: "rcl-tensor-adamw-rust-v0.1",
            optimizer_semantics: "rcl.adamw.v0.1",
            steps: training.steps,
            parameter_count: training.autodiff.parameters.len(),
            parameter_elements,
            optimizer_state_elements,
        },
    })
}

fn read_request(argument: Option<&String>) -> Result<String, BridgeError> {
    match argument {
        Some(path) if path != "-" => fs::read_to_string(path)
            .map_err(|error| BridgeError::new("RCL_ADAMW_REQUEST_IO", error.to_string())),
        _ => {
            let mut input = String::new();
            io::stdin()
                .read_to_string(&mut input)
                .map_err(|error| BridgeError::new("RCL_ADAMW_REQUEST_IO", error.to_string()))?;
            Ok(input)
        }
    }
}

fn fail(error: BridgeError) -> ! {
    eprintln!("{}", json!({"status":"error","code":error.code,"message":error.message}));
    std::process::exit(1)
}

fn main() {
    let arguments = env::args().collect::<Vec<_>>();
    let input = read_request(arguments.get(1)).unwrap_or_else(|error| fail(error));
    let request = serde_json::from_str::<AdamWTrainingRequest>(&input).unwrap_or_else(|error| {
        fail(BridgeError::new("RCL_ADAMW_REQUEST_JSON", error.to_string()))
    });
    let result = train(request).unwrap_or_else(|error| fail(error));
    println!("{}", serde_json::to_string(&result).unwrap());
}
