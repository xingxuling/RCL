use serde::{Deserialize, Serialize};
use serde_json::json;
use sha2::{Digest, Sha256};
use std::env;
use std::fs;
use std::io::{self, Read};

const REQUEST_FORMAT: &str = "rcl.bf16-autodiff-adamw-request.v0.1";
const RESULT_FORMAT: &str = "rcl.bf16-autodiff-adamw-result.v0.1";
const POLICY: &str = "rcl.bf16-autodiff-fp32-master-adamw.v0.1";
const BACKEND: &str = "cpu-reference";
const MAX_ELEMENTS: usize = 1_048_576;
const MAX_STEPS: usize = 16_384;

#[derive(Debug)]
struct MpTrainError {
    code: &'static str,
    message: String,
}

impl MpTrainError {
    fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self { code, message: message.into() }
    }
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct TensorInput {
    shape: Vec<usize>,
    data: Vec<f64>,
    #[serde(default)]
    exact_f32_bits: Vec<String>,
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
    step: usize,
    first_moment: Vec<f32>,
    second_moment: Vec<f32>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    exact_first_moment_bits: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    exact_second_moment_bits: Vec<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Request {
    format: String,
    backend: String,
    steps: usize,
    input: TensorInput,
    target: TensorInput,
    master_weight: TensorInput,
    optimizer: AdamWConfig,
    #[serde(default)]
    optimizer_state: Option<OptimizerState>,
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
struct Telemetry {
    backend: &'static str,
    policy: &'static str,
    forward_compute_dtype: &'static str,
    accumulation_dtype: &'static str,
    gradient_dtype: &'static str,
    master_weight_dtype: &'static str,
    optimizer_state_dtype: &'static str,
    cast_gradient_policy: &'static str,
    steps: usize,
    parameter_elements: usize,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ResultReceipt {
    format: &'static str,
    status: &'static str,
    initial_loss: f32,
    final_loss: f32,
    initial_prediction: Bf16TensorReceipt,
    initial_gradient: Fp32TensorReceipt,
    final_prediction: Bf16TensorReceipt,
    final_gradient: Fp32TensorReceipt,
    master_weight: Fp32TensorReceipt,
    compute_weight: Bf16TensorReceipt,
    optimizer_state: OptimizerState,
    checkpoint_root: String,
    telemetry: Telemetry,
    gpu_claim: bool,
}

#[derive(Clone)]
struct ForwardPass {
    prediction_bits: Vec<u16>,
    prediction: Vec<f32>,
    residual: Vec<f32>,
    loss: f32,
    quantized_input: Vec<f32>,
    quantized_weight: Vec<f32>,
}

fn checked_product(shape: &[usize]) -> Result<usize, MpTrainError> {
    if shape.is_empty() || shape.len() > 2 || shape.contains(&0) {
        return Err(MpTrainError::new(
            "RCL_BF16_AD_SHAPE",
            format!("bounded K08-S profile requires rank-1 or rank-2 positive shape, received {shape:?}"),
        ));
    }
    let count = shape.iter().try_fold(1usize, |total, value| total.checked_mul(*value))
        .ok_or_else(|| MpTrainError::new("RCL_BF16_AD_SHAPE_OVERFLOW", "shape element count overflowed"))?;
    if count > MAX_ELEMENTS {
        return Err(MpTrainError::new(
            "RCL_BF16_AD_ELEMENT_LIMIT",
            format!("{count} elements exceed the K08-S limit {MAX_ELEMENTS}"),
        ));
    }
    Ok(count)
}

fn validate_config(config: &AdamWConfig) -> Result<(), MpTrainError> {
    if !config.learning_rate.is_finite() || config.learning_rate <= 0.0 {
        return Err(MpTrainError::new("RCL_BF16_AD_LEARNING_RATE", "learningRate must be finite and positive"));
    }
    if !config.beta1.is_finite() || config.beta1 < 0.0 || config.beta1 >= 1.0 {
        return Err(MpTrainError::new("RCL_BF16_AD_BETA1", "beta1 must be in [0,1)"));
    }
    if !config.beta2.is_finite() || config.beta2 < 0.0 || config.beta2 >= 1.0 {
        return Err(MpTrainError::new("RCL_BF16_AD_BETA2", "beta2 must be in [0,1)"));
    }
    if !config.epsilon.is_finite() || config.epsilon <= 0.0 {
        return Err(MpTrainError::new("RCL_BF16_AD_EPSILON", "epsilon must be finite and positive"));
    }
    if !config.weight_decay.is_finite() || config.weight_decay < 0.0 {
        return Err(MpTrainError::new("RCL_BF16_AD_WEIGHT_DECAY", "weightDecay must be finite and non-negative"));
    }
    if !config.gradient_clip.is_finite() || config.gradient_clip <= 0.0 {
        return Err(MpTrainError::new("RCL_BF16_AD_GRADIENT_CLIP", "gradientClip must be finite and positive"));
    }
    Ok(())
}

fn f32_to_bf16_bits(value: f32) -> u16 {
    let bits = value.to_bits();
    let lsb = (bits >> 16) & 1;
    let rounded = bits.wrapping_add(0x7fff + lsb);
    (rounded >> 16) as u16
}

fn bf16_bits_to_f32(bits: u16) -> f32 {
    f32::from_bits((bits as u32) << 16)
}

fn bf16_quantize(value: f32) -> Result<(u16, f32), MpTrainError> {
    if !value.is_finite() {
        return Err(MpTrainError::new("RCL_BF16_AD_NONFINITE", "BF16 conversion rejects non-finite values"));
    }
    let bits = f32_to_bf16_bits(value);
    let decoded = bf16_bits_to_f32(bits);
    if !decoded.is_finite() {
        return Err(MpTrainError::new("RCL_BF16_AD_NONFINITE", "BF16 conversion produced a non-finite value"));
    }
    Ok((bits, decoded))
}

fn decode_f32_bits(values: &[String], expected: usize, label: &str) -> Result<Vec<f32>, MpTrainError> {
    if values.len() != expected {
        return Err(MpTrainError::new(
            "RCL_BF16_AD_EXACT_LENGTH",
            format!("exact f32 bits for {label} require {expected} values, received {}", values.len()),
        ));
    }
    values.iter().map(|bits| {
        if bits.len() != 8 {
            return Err(MpTrainError::new(
                "RCL_BF16_AD_EXACT_BITS",
                format!("exact f32 bits for {label} must contain 8 hex digits, received {bits}"),
            ));
        }
        let parsed = u32::from_str_radix(bits, 16).map_err(|_| {
            MpTrainError::new("RCL_BF16_AD_EXACT_BITS", format!("invalid exact f32 bits for {label}: {bits}"))
        })?;
        let value = f32::from_bits(parsed);
        if !value.is_finite() {
            return Err(MpTrainError::new(
                "RCL_BF16_AD_NONFINITE",
                format!("exact f32 bits for {label} decode to a non-finite value"),
            ));
        }
        Ok(value)
    }).collect()
}

fn materialize_input(input: &TensorInput, label: &str) -> Result<Vec<f32>, MpTrainError> {
    let expected = checked_product(&input.shape)?;
    if input.data.len() != expected {
        return Err(MpTrainError::new(
            "RCL_BF16_AD_STORAGE_SHAPE",
            format!("{label} shape {:?} requires {expected} values, received {}", input.shape, input.data.len()),
        ));
    }
    if !input.exact_f32_bits.is_empty() {
        return decode_f32_bits(&input.exact_f32_bits, expected, label);
    }
    input.data.iter().map(|value| {
        if !value.is_finite() {
            return Err(MpTrainError::new("RCL_BF16_AD_NONFINITE", format!("{label} contains a non-finite value")));
        }
        let narrowed = *value as f32;
        if !narrowed.is_finite() {
            return Err(MpTrainError::new("RCL_BF16_AD_F32_OVERFLOW", format!("{label} value {value} overflows f32")));
        }
        Ok(narrowed)
    }).collect()
}

fn quantize_vec(values: &[f32]) -> Result<(Vec<u16>, Vec<f32>), MpTrainError> {
    let mut bits = Vec::with_capacity(values.len());
    let mut data = Vec::with_capacity(values.len());
    for value in values {
        let (encoded, decoded) = bf16_quantize(*value)?;
        bits.push(encoded);
        data.push(decoded);
    }
    Ok((bits, data))
}

fn validate_geometry(input: &TensorInput, target: &TensorInput, weight: &TensorInput) -> Result<(usize, usize, usize), MpTrainError> {
    if input.shape.len() != 2 || target.shape.len() != 2 || weight.shape.len() != 2 {
        return Err(MpTrainError::new("RCL_BF16_AD_GEOMETRY", "K08-S matmul-MSE profile requires rank-2 input, target, and masterWeight"));
    }
    let batch = input.shape[0];
    let input_width = input.shape[1];
    let output_width = target.shape[1];
    if target.shape[0] != batch || weight.shape != vec![input_width, output_width] {
        return Err(MpTrainError::new(
            "RCL_BF16_AD_GEOMETRY",
            format!("incompatible input {:?}, target {:?}, weight {:?}", input.shape, target.shape, weight.shape),
        ));
    }
    checked_product(&input.shape)?;
    checked_product(&target.shape)?;
    checked_product(&weight.shape)?;
    Ok((batch, input_width, output_width))
}

fn forward(
    input_master: &[f32],
    target_master: &[f32],
    weight_master: &[f32],
    batch: usize,
    input_width: usize,
    output_width: usize,
) -> Result<ForwardPass, MpTrainError> {
    let (_, input) = quantize_vec(input_master)?;
    let (_, target) = quantize_vec(target_master)?;
    let (_, weight) = quantize_vec(weight_master)?;
    let mut prediction_bits = Vec::with_capacity(batch * output_width);
    let mut prediction = Vec::with_capacity(batch * output_width);
    for row in 0..batch {
        for col in 0..output_width {
            let mut sum = 0.0f32;
            for inner in 0..input_width {
                let product = input[row * input_width + inner] * weight[inner * output_width + col];
                sum = sum + product;
            }
            if !sum.is_finite() {
                return Err(MpTrainError::new("RCL_BF16_AD_ACCUMULATION", "FP32 matmul accumulation became non-finite"));
            }
            let (bits, value) = bf16_quantize(sum)?;
            prediction_bits.push(bits);
            prediction.push(value);
        }
    }
    let mut residual = Vec::with_capacity(prediction.len());
    let mut squared = Vec::with_capacity(prediction.len());
    for index in 0..prediction.len() {
        let (_, delta) = bf16_quantize(prediction[index] - target[index])?;
        let (_, square) = bf16_quantize(delta * delta)?;
        residual.push(delta);
        squared.push(square);
    }
    let mut sum = 0.0f32;
    for value in &squared {
        sum = sum + *value;
    }
    let loss = sum / squared.len() as f32;
    if !loss.is_finite() {
        return Err(MpTrainError::new("RCL_BF16_AD_LOSS", "FP32 reduction produced a non-finite loss"));
    }
    Ok(ForwardPass {
        prediction_bits,
        prediction,
        residual,
        loss,
        quantized_input: input,
        quantized_weight: weight,
    })
}

fn backward_weight(
    pass: &ForwardPass,
    batch: usize,
    input_width: usize,
    output_width: usize,
) -> Result<Vec<f32>, MpTrainError> {
    let scale = 2.0f32 / (batch * output_width) as f32;
    let mut output_gradient = vec![0.0f32; batch * output_width];
    for index in 0..output_gradient.len() {
        output_gradient[index] = pass.residual[index] * scale;
    }
    let mut gradient = vec![0.0f32; input_width * output_width];
    for inner in 0..input_width {
        for col in 0..output_width {
            let mut sum = 0.0f32;
            for row in 0..batch {
                sum = sum + pass.quantized_input[row * input_width + inner] * output_gradient[row * output_width + col];
            }
            if !sum.is_finite() {
                return Err(MpTrainError::new("RCL_BF16_AD_GRADIENT", "FP32 gradient accumulation became non-finite"));
            }
            gradient[inner * output_width + col] = sum;
        }
    }
    Ok(gradient)
}

fn f32_pow(mut base: f32, exponent: usize) -> f32 {
    let mut result = 1.0f32;
    for _ in 0..exponent {
        result = result * base;
    }
    result
}

fn initialize_state(
    supplied: Option<OptimizerState>,
    parameter_count: usize,
) -> Result<OptimizerState, MpTrainError> {
    match supplied {
        None => Ok(OptimizerState {
            step: 0,
            first_moment: vec![0.0; parameter_count],
            second_moment: vec![0.0; parameter_count],
            exact_first_moment_bits: Vec::new(),
            exact_second_moment_bits: Vec::new(),
        }),
        Some(mut state) => {
            if state.first_moment.len() != parameter_count || state.second_moment.len() != parameter_count {
                return Err(MpTrainError::new("RCL_BF16_AD_STATE_SHAPE", "optimizer state shape does not match masterWeight"));
            }
            let has_first = !state.exact_first_moment_bits.is_empty();
            let has_second = !state.exact_second_moment_bits.is_empty();
            if has_first != has_second {
                return Err(MpTrainError::new("RCL_BF16_AD_STATE_EXACT_BINDING", "exact optimizer state requires both first and second moments"));
            }
            if has_first {
                state.first_moment = decode_f32_bits(&state.exact_first_moment_bits, parameter_count, "firstMoment")?;
                state.second_moment = decode_f32_bits(&state.exact_second_moment_bits, parameter_count, "secondMoment")?;
            }
            if state.first_moment.iter().chain(&state.second_moment).any(|value| !value.is_finite()) {
                return Err(MpTrainError::new("RCL_BF16_AD_STATE_NONFINITE", "optimizer state contains non-finite values"));
            }
            Ok(state)
        }
    }
}

fn adamw_step(
    master_weight: &mut [f32],
    gradient: &[f32],
    state: &mut OptimizerState,
    config: &AdamWConfig,
) -> Result<(), MpTrainError> {
    let next_step = state.step.checked_add(1)
        .ok_or_else(|| MpTrainError::new("RCL_BF16_AD_STEP_OVERFLOW", "optimizer step overflowed"))?;
    let bias1 = 1.0f32 - f32_pow(config.beta1, next_step);
    let bias2 = 1.0f32 - f32_pow(config.beta2, next_step);
    let decay = 1.0f32 - config.learning_rate * config.weight_decay;
    for index in 0..master_weight.len() {
        let grad = gradient[index].max(-config.gradient_clip).min(config.gradient_clip);
        let next_m = config.beta1 * state.first_moment[index] + (1.0 - config.beta1) * grad;
        let next_v = config.beta2 * state.second_moment[index] + (1.0 - config.beta2) * grad * grad;
        let m_hat = next_m / bias1;
        let v_hat = next_v / bias2;
        let direction = m_hat / (v_hat.sqrt() + config.epsilon);
        let next_weight = master_weight[index] * decay - config.learning_rate * direction;
        if !next_m.is_finite() || !next_v.is_finite() || !next_weight.is_finite() {
            return Err(MpTrainError::new("RCL_BF16_AD_UPDATE_NONFINITE", "AdamW produced a non-finite FP32 state or master weight"));
        }
        state.first_moment[index] = next_m;
        state.second_moment[index] = next_v;
        master_weight[index] = next_weight;
    }
    state.step = next_step;
    state.exact_first_moment_bits = exact_f32_bits(&state.first_moment);
    state.exact_second_moment_bits = exact_f32_bits(&state.second_moment);
    Ok(())
}

fn exact_f32_bits(values: &[f32]) -> Vec<String> {
    values.iter().map(|value| format!("{:08x}", value.to_bits())).collect()
}

fn bf16_storage_root(shape: &[usize], bits: &[u16]) -> String {
    let mut hash = Sha256::new();
    hash.update(b"rcl.bf16.storage.v0.1\0");
    hash.update(POLICY.as_bytes());
    for dimension in shape {
        hash.update((*dimension as u64).to_le_bytes());
    }
    for value in bits {
        hash.update(value.to_le_bytes());
    }
    format!("sha256:{}", hex::encode(hash.finalize()))
}

fn f32_storage_root(shape: &[usize], data: &[f32], role: &str) -> String {
    let mut hash = Sha256::new();
    hash.update(b"rcl.f32.storage.v0.1\0");
    hash.update(POLICY.as_bytes());
    hash.update(role.as_bytes());
    for dimension in shape {
        hash.update((*dimension as u64).to_le_bytes());
    }
    for value in data {
        hash.update(value.to_bits().to_le_bytes());
    }
    format!("sha256:{}", hex::encode(hash.finalize()))
}

fn bf16_receipt(shape: Vec<usize>, bits: Vec<u16>) -> Bf16TensorReceipt {
    let data = bits.iter().map(|value| bf16_bits_to_f32(*value)).collect::<Vec<_>>();
    Bf16TensorReceipt {
        storage_root: bf16_storage_root(&shape, &bits),
        shape,
        dtype: "bf16",
        accumulation_dtype: "f32",
        bits_hex: bits.iter().map(|value| format!("{value:04x}")).collect(),
        data,
    }
}

fn f32_receipt(shape: Vec<usize>, data: Vec<f32>, role: &str) -> Fp32TensorReceipt {
    Fp32TensorReceipt {
        storage_root: f32_storage_root(&shape, &data, role),
        shape,
        dtype: "f32",
        bits_hex: exact_f32_bits(&data),
        data,
    }
}

fn checkpoint_root(config: &AdamWConfig, weight: &[f32], state: &OptimizerState) -> String {
    let mut hash = Sha256::new();
    hash.update(b"rcl.bf16-autodiff-adamw.checkpoint.v0.1\0");
    hash.update(POLICY.as_bytes());
    for value in [
        config.learning_rate,
        config.beta1,
        config.beta2,
        config.epsilon,
        config.weight_decay,
        config.gradient_clip,
    ] {
        hash.update(value.to_bits().to_le_bytes());
    }
    hash.update((state.step as u64).to_le_bytes());
    for value in weight {
        hash.update(value.to_bits().to_le_bytes());
    }
    for value in &state.first_moment {
        hash.update(value.to_bits().to_le_bytes());
    }
    for value in &state.second_moment {
        hash.update(value.to_bits().to_le_bytes());
    }
    format!("sha256:{}", hex::encode(hash.finalize()))
}

fn execute(request: Request) -> Result<ResultReceipt, MpTrainError> {
    if request.format != REQUEST_FORMAT {
        return Err(MpTrainError::new("RCL_BF16_AD_FORMAT", format!("unsupported request format {}", request.format)));
    }
    if request.backend != BACKEND {
        return Err(MpTrainError::new(
            "RCL_ACCELERATOR_BACKEND_UNAVAILABLE",
            format!("backend {} is unavailable for K08-S; silent CPU fallback is forbidden", request.backend),
        ));
    }
    if request.steps == 0 || request.steps > MAX_STEPS {
        return Err(MpTrainError::new("RCL_BF16_AD_STEP_LIMIT", format!("steps must be within 1..={MAX_STEPS}")));
    }
    validate_config(&request.optimizer)?;
    let (batch, input_width, output_width) = validate_geometry(&request.input, &request.target, &request.master_weight)?;
    let input = materialize_input(&request.input, "input")?;
    let target = materialize_input(&request.target, "target")?;
    let mut master_weight = materialize_input(&request.master_weight, "masterWeight")?;
    let mut state = initialize_state(request.optimizer_state, master_weight.len())?;

    let initial_pass = forward(&input, &target, &master_weight, batch, input_width, output_width)?;
    let initial_gradient = backward_weight(&initial_pass, batch, input_width, output_width)?;
    let initial_prediction = bf16_receipt(request.target.shape.clone(), initial_pass.prediction_bits.clone());

    for _ in 0..request.steps {
        let pass = forward(&input, &target, &master_weight, batch, input_width, output_width)?;
        let gradient = backward_weight(&pass, batch, input_width, output_width)?;
        adamw_step(&mut master_weight, &gradient, &mut state, &request.optimizer)?;
    }

    let final_pass = forward(&input, &target, &master_weight, batch, input_width, output_width)?;
    let final_gradient_data = backward_weight(&final_pass, batch, input_width, output_width)?;
    let final_prediction = bf16_receipt(request.target.shape.clone(), final_pass.prediction_bits.clone());
    let (compute_weight_bits, _) = quantize_vec(&master_weight)?;
    let root = checkpoint_root(&request.optimizer, &master_weight, &state);

    Ok(ResultReceipt {
        format: RESULT_FORMAT,
        status: "ok",
        initial_loss: initial_pass.loss,
        final_loss: final_pass.loss,
        initial_prediction,
        initial_gradient: f32_receipt(request.master_weight.shape.clone(), initial_gradient, "gradient.initial"),
        final_prediction,
        final_gradient: f32_receipt(request.master_weight.shape.clone(), final_gradient_data, "gradient.final"),
        master_weight: f32_receipt(request.master_weight.shape.clone(), master_weight.clone(), "masterWeight"),
        compute_weight: bf16_receipt(request.master_weight.shape.clone(), compute_weight_bits),
        optimizer_state: state,
        checkpoint_root: root,
        telemetry: Telemetry {
            backend: BACKEND,
            policy: POLICY,
            forward_compute_dtype: "bf16",
            accumulation_dtype: "f32",
            gradient_dtype: "f32",
            master_weight_dtype: "f32",
            optimizer_state_dtype: "f32",
            cast_gradient_policy: "straight-through-fp32",
            steps: request.steps,
            parameter_elements: master_weight.len(),
        },
        gpu_claim: false,
    })
}

fn read_input(argument: Option<&String>) -> Result<String, MpTrainError> {
    match argument {
        Some(path) if path != "-" => fs::read_to_string(path)
            .map_err(|error| MpTrainError::new("RCL_BF16_AD_REQUEST_IO", error.to_string())),
        _ => {
            let mut input = String::new();
            io::stdin().read_to_string(&mut input)
                .map_err(|error| MpTrainError::new("RCL_BF16_AD_REQUEST_IO", error.to_string()))?;
            Ok(input)
        }
    }
}

fn fail<T>(error: MpTrainError) -> T {
    eprintln!("{}", json!({"status":"error","code":error.code,"message":error.message}));
    std::process::exit(1)
}

fn main() {
    let arguments = env::args().collect::<Vec<_>>();
    let input = read_input(arguments.get(1)).unwrap_or_else(fail);
    let request = serde_json::from_str::<Request>(&input)
        .unwrap_or_else(|error| fail(MpTrainError::new("RCL_BF16_AD_REQUEST_JSON", error.to_string())));
    let result = execute(request).unwrap_or_else(fail);
    println!("{}", serde_json::to_string(&result).unwrap());
}
