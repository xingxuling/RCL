use serde::{Deserialize, Serialize};
use serde_json::json;
use sha2::{Digest, Sha256};
use std::env;
use std::fs;
use std::io::{self, Read};

const REQUEST_FORMAT: &str = "rcl.mixed-precision-request.v0.1";
const RESULT_FORMAT: &str = "rcl.mixed-precision-result.v0.1";
const BACKEND: &str = "cpu-reference";
const POLICY: &str = "bf16-input-f32-accumulation-bf16-output-rne";
const MAX_ELEMENTS: usize = 16_777_216;

#[derive(Debug)]
struct MpError {
    code: &'static str,
    message: String,
}

impl MpError {
    fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self { code, message: message.into() }
    }
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct TensorInput {
    shape: Vec<usize>,
    data: Vec<f64>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Request {
    format: String,
    backend: String,
    operation: String,
    #[serde(default)]
    values: Option<Vec<f64>>,
    #[serde(default)]
    shape: Option<Vec<usize>>,
    #[serde(default)]
    left: Option<TensorInput>,
    #[serde(default)]
    right: Option<TensorInput>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct TensorResult {
    shape: Vec<usize>,
    dtype: &'static str,
    accumulation_dtype: &'static str,
    bits_hex: Vec<String>,
    data: Vec<f64>,
    storage_root: String,
}

fn product(shape: &[usize]) -> Result<usize, MpError> {
    if shape.is_empty() {
        return Ok(1);
    }
    if shape.len() > 8 || shape.contains(&0) {
        return Err(MpError::new("RCL_MP_SHAPE_INVALID", format!("invalid shape {shape:?}")));
    }
    let count = shape.iter().try_fold(1usize, |total, value| total.checked_mul(*value))
        .ok_or_else(|| MpError::new("RCL_MP_SHAPE_OVERFLOW", "shape overflow"))?;
    if count > MAX_ELEMENTS {
        return Err(MpError::new("RCL_MP_ELEMENT_LIMIT", format!("{count} elements exceed {MAX_ELEMENTS}")));
    }
    Ok(count)
}

fn validate_tensor(tensor: &TensorInput) -> Result<(), MpError> {
    let count = product(&tensor.shape)?;
    if count != tensor.data.len() {
        return Err(MpError::new(
            "RCL_MP_STORAGE_SHAPE_MISMATCH",
            format!("shape {:?} requires {count} values, received {}", tensor.shape, tensor.data.len()),
        ));
    }
    if tensor.data.iter().any(|value| !value.is_finite()) {
        return Err(MpError::new("RCL_MP_NON_FINITE", "reference mixed-precision profile rejects non-finite input"));
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

fn quantize_one(value: f64) -> Result<(u16, f32), MpError> {
    if !value.is_finite() {
        return Err(MpError::new("RCL_MP_NON_FINITE", "reference mixed-precision profile rejects non-finite input"));
    }
    let narrowed = value as f32;
    if !narrowed.is_finite() {
        return Err(MpError::new("RCL_MP_F32_OVERFLOW", format!("value {value} overflows f32")));
    }
    let bits = f32_to_bf16_bits(narrowed);
    Ok((bits, bf16_bits_to_f32(bits)))
}

fn quantize(values: &[f64]) -> Result<(Vec<u16>, Vec<f32>), MpError> {
    let mut bits = Vec::with_capacity(values.len());
    let mut data = Vec::with_capacity(values.len());
    for value in values {
        let (encoded, decoded) = quantize_one(*value)?;
        bits.push(encoded);
        data.push(decoded);
    }
    Ok((bits, data))
}

fn storage_root(shape: &[usize], bits: &[u16]) -> String {
    let mut hash = Sha256::new();
    hash.update(b"rcl.bf16.storage.v0.1\0");
    hash.update(POLICY.as_bytes());
    hash.update(b"\0");
    hash.update((shape.len() as u64).to_le_bytes());
    for dimension in shape {
        hash.update((*dimension as u64).to_le_bytes());
    }
    for value in bits {
        hash.update(value.to_le_bytes());
    }
    format!("sha256:{}", hex::encode(hash.finalize()))
}

fn tensor_result(shape: Vec<usize>, bits: Vec<u16>) -> TensorResult {
    let data = bits.iter().map(|value| bf16_bits_to_f32(*value) as f64).collect::<Vec<_>>();
    let root = storage_root(&shape, &bits);
    TensorResult {
        shape,
        dtype: "bf16",
        accumulation_dtype: "f32",
        bits_hex: bits.iter().map(|value| format!("{value:04x}")).collect(),
        data,
        storage_root: root,
    }
}

fn execute_quantize(request: &Request) -> Result<TensorResult, MpError> {
    let values = request.values.as_ref().ok_or_else(|| MpError::new("RCL_MP_VALUES_REQUIRED", "quantize requires values"))?;
    let shape = request.shape.clone().unwrap_or_else(|| vec![values.len()]);
    if product(&shape)? != values.len() {
        return Err(MpError::new("RCL_MP_STORAGE_SHAPE_MISMATCH", "quantize shape does not match value count"));
    }
    let (bits, _) = quantize(values)?;
    Ok(tensor_result(shape, bits))
}

fn execute_matmul(left: &TensorInput, right: &TensorInput) -> Result<TensorResult, MpError> {
    validate_tensor(left)?;
    validate_tensor(right)?;
    if left.shape.len() != 2 || right.shape.len() != 2 || left.shape[1] != right.shape[0] {
        return Err(MpError::new("RCL_MP_MATMUL_SHAPE", format!("cannot matmul {:?} by {:?}", left.shape, right.shape)));
    }
    let m = left.shape[0];
    let k = left.shape[1];
    let n = right.shape[1];
    let (_, a) = quantize(&left.data)?;
    let (_, b) = quantize(&right.data)?;
    let mut output_bits = Vec::with_capacity(m * n);
    for row in 0..m {
        for col in 0..n {
            let mut sum = 0.0f32;
            for inner in 0..k {
                let product = a[row * k + inner] * b[inner * n + col];
                sum += product;
            }
            if !sum.is_finite() {
                return Err(MpError::new("RCL_MP_ACCUMULATION_NON_FINITE", "f32 matmul accumulation became non-finite"));
            }
            output_bits.push(f32_to_bf16_bits(sum));
        }
    }
    Ok(tensor_result(vec![m, n], output_bits))
}

fn execute_elementwise(operation: &str, left: &TensorInput, right: &TensorInput) -> Result<TensorResult, MpError> {
    validate_tensor(left)?;
    validate_tensor(right)?;
    if left.shape != right.shape {
        return Err(MpError::new("RCL_MP_ELEMENTWISE_SHAPE", format!("shape mismatch {:?} vs {:?}", left.shape, right.shape)));
    }
    let (_, a) = quantize(&left.data)?;
    let (_, b) = quantize(&right.data)?;
    let mut bits = Vec::with_capacity(a.len());
    for index in 0..a.len() {
        let value = match operation {
            "add" => a[index] + b[index],
            "mul" => a[index] * b[index],
            _ => unreachable!(),
        };
        if !value.is_finite() {
            return Err(MpError::new("RCL_MP_ACCUMULATION_NON_FINITE", "elementwise result became non-finite"));
        }
        bits.push(f32_to_bf16_bits(value));
    }
    Ok(tensor_result(left.shape.clone(), bits))
}

fn execute(request: Request) -> Result<serde_json::Value, MpError> {
    if request.format != REQUEST_FORMAT {
        return Err(MpError::new("RCL_MP_REQUEST_FORMAT", format!("unsupported format {}", request.format)));
    }
    if request.backend != BACKEND {
        return Err(MpError::new(
            "RCL_ACCELERATOR_BACKEND_UNAVAILABLE",
            format!("backend {} is not available in the CPU reference organ; silent fallback is forbidden", request.backend),
        ));
    }
    let tensor = match request.operation.as_str() {
        "quantize" => execute_quantize(&request)?,
        "matmul" => execute_matmul(
            request.left.as_ref().ok_or_else(|| MpError::new("RCL_MP_LEFT_REQUIRED", "matmul requires left"))?,
            request.right.as_ref().ok_or_else(|| MpError::new("RCL_MP_RIGHT_REQUIRED", "matmul requires right"))?,
        )?,
        "add" | "mul" => execute_elementwise(
            &request.operation,
            request.left.as_ref().ok_or_else(|| MpError::new("RCL_MP_LEFT_REQUIRED", "elementwise operation requires left"))?,
            request.right.as_ref().ok_or_else(|| MpError::new("RCL_MP_RIGHT_REQUIRED", "elementwise operation requires right"))?,
        )?,
        operation => return Err(MpError::new("RCL_MP_OPERATION", format!("unsupported operation {operation}"))),
    };
    Ok(json!({
        "format": RESULT_FORMAT,
        "status": "ok",
        "backend": BACKEND,
        "policy": POLICY,
        "operation": request.operation,
        "tensor": tensor,
        "gpuClaim": false
    }))
}

fn read_input(argument: Option<&String>) -> Result<String, MpError> {
    match argument {
        Some(path) if path != "-" => fs::read_to_string(path).map_err(|error| MpError::new("RCL_MP_REQUEST_IO", error.to_string())),
        _ => {
            let mut input = String::new();
            io::stdin().read_to_string(&mut input).map_err(|error| MpError::new("RCL_MP_REQUEST_IO", error.to_string()))?;
            Ok(input)
        }
    }
}

fn fail<T>(error: MpError) -> T {
    eprintln!("{}", json!({"status":"error","code":error.code,"message":error.message}));
    std::process::exit(1)
}

fn main() {
    let arguments = env::args().collect::<Vec<_>>();
    let input = read_input(arguments.get(1)).unwrap_or_else(fail);
    let request = serde_json::from_str::<Request>(&input)
        .unwrap_or_else(|error| fail(MpError::new("RCL_MP_REQUEST_JSON", error.to_string())));
    let result = execute(request).unwrap_or_else(fail);
    println!("{}", serde_json::to_string(&result).unwrap());
}
