use serde::{Deserialize, Serialize};
use serde_json::json;
use sha2::{Digest, Sha256};
use std::env;
use std::fs;
use std::io::{self, Read};

const REQUEST_FORMAT: &str = "rcl.rope-position-frame-request.v0.1";
const RESPONSE_FORMAT: &str = "rcl.rope-position-frame.v0.1";

#[derive(Debug)]
struct RopeError {
    code: &'static str,
    message: String,
}

impl RopeError {
    fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self { code, message: message.into() }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Request {
    format: String,
    sequence_length: u32,
    head_dimension: u32,
    #[serde(default = "default_base")]
    base: f64,
    #[serde(default)]
    position_offset: u32,
    #[serde(default)]
    max_position_exclusive: Option<u32>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct Frame {
    format: &'static str,
    status: &'static str,
    sequence_length: u32,
    head_dimension: u32,
    base: f64,
    position_offset: u32,
    pair_count: u32,
    frame_root: String,
    cos: Vec<f64>,
    sin: Vec<f64>,
    rotation_matrix: Vec<f64>,
}

fn default_base() -> f64 { 10_000.0 }

fn sha256_hex(bytes: impl AsRef<[u8]>) -> String {
    hex::encode(Sha256::digest(bytes.as_ref()))
}

fn validate(request: &Request) -> Result<(), RopeError> {
    if request.format != REQUEST_FORMAT {
        return Err(RopeError::new("RCL_ROPE_REQUEST_FORMAT", format!("unsupported request format {}", request.format)));
    }
    if request.sequence_length == 0 {
        return Err(RopeError::new("RCL_ROPE_SEQUENCE_LENGTH", "sequenceLength must be positive"));
    }
    if request.head_dimension == 0 || request.head_dimension % 2 != 0 {
        return Err(RopeError::new("RCL_ROPE_HEAD_DIMENSION", "headDimension must be positive and even"));
    }
    if !request.base.is_finite() || request.base <= 1.0 {
        return Err(RopeError::new("RCL_ROPE_BASE", "base must be finite and greater than 1"));
    }
    let end = request.position_offset.checked_add(request.sequence_length)
        .ok_or_else(|| RopeError::new("RCL_ROPE_POSITION_OVERFLOW", "position range overflow"))?;
    if let Some(maximum) = request.max_position_exclusive {
        if maximum == 0 || end > maximum {
            return Err(RopeError::new(
                "RCL_ROPE_POSITION_OVERFLOW",
                format!("position range [{}, {}) exceeds maxPositionExclusive {maximum}", request.position_offset, end),
            ));
        }
    }
    Ok(())
}

fn semantic_frame_root(request: &Request) -> String {
    let descriptor = format!(
        "rcl.rope-position-frame.v0.1|seq={}|dim={}|baseBits={:016x}|offset={}|pairing=adjacent-even-odd|angle=position/base^(2*pair/dim)|rotation=x*cos+rotatePair(x)*sin",
        request.sequence_length,
        request.head_dimension,
        request.base.to_bits(),
        request.position_offset,
    );
    format!("sha256:{}", sha256_hex(descriptor))
}

fn make_frame(request: Request) -> Result<Frame, RopeError> {
    validate(&request)?;
    let sequence = request.sequence_length as usize;
    let dimension = request.head_dimension as usize;
    let pair_count = dimension / 2;
    let mut cos = vec![0.0; sequence * dimension];
    let mut sin = vec![0.0; sequence * dimension];

    for row in 0..sequence {
        let position = (request.position_offset as usize + row) as f64;
        for pair in 0..pair_count {
            let exponent = (2.0 * pair as f64) / dimension as f64;
            let inverse_frequency = 1.0 / request.base.powf(exponent);
            let theta = position * inverse_frequency;
            let cosine = theta.cos();
            let sine = theta.sin();
            let even = row * dimension + pair * 2;
            cos[even] = cosine;
            cos[even + 1] = cosine;
            sin[even] = sine;
            sin[even + 1] = sine;
        }
    }

    // Row-vector convention: [x0,x1] * [[0,1],[-1,0]] = [-x1,x0].
    let mut rotation_matrix = vec![0.0; dimension * dimension];
    for pair in 0..pair_count {
        let even = pair * 2;
        let odd = even + 1;
        rotation_matrix[even * dimension + odd] = 1.0;
        rotation_matrix[odd * dimension + even] = -1.0;
    }

    Ok(Frame {
        format: RESPONSE_FORMAT,
        status: "ok",
        sequence_length: request.sequence_length,
        head_dimension: request.head_dimension,
        base: request.base,
        position_offset: request.position_offset,
        pair_count: pair_count as u32,
        frame_root: semantic_frame_root(&request),
        cos,
        sin,
        rotation_matrix,
    })
}

fn read_request(argument: Option<&String>) -> Result<String, RopeError> {
    match argument {
        Some(path) if path != "-" => fs::read_to_string(path)
            .map_err(|error| RopeError::new("RCL_ROPE_REQUEST_IO", error.to_string())),
        _ => {
            let mut input = String::new();
            io::stdin().read_to_string(&mut input)
                .map_err(|error| RopeError::new("RCL_ROPE_REQUEST_IO", error.to_string()))?;
            Ok(input)
        }
    }
}

fn fail<T>(error: RopeError) -> T {
    eprintln!("{}", json!({"status":"error","code":error.code,"message":error.message}));
    std::process::exit(1)
}

fn main() {
    let args = env::args().collect::<Vec<_>>();
    let input = read_request(args.get(1)).unwrap_or_else(fail);
    let request = serde_json::from_str::<Request>(&input)
        .unwrap_or_else(|error| fail(RopeError::new("RCL_ROPE_REQUEST_JSON", error.to_string())));
    let frame = make_frame(request).unwrap_or_else(fail);
    println!("{}", serde_json::to_string(&frame).unwrap());
}
