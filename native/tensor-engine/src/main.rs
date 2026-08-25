use rcl_tensor_engine::{
    CAPABILITY, DenseStorage, ExecutionRequest, PROVIDER_ID, REQUEST_FORMAT, TensorDescriptor,
    execute, execute_json,
};
use serde_json::json;
use std::env;
use std::fs;
use std::io::{self, Read};

#[cfg(windows)]
mod rclvm_provider;

fn read_request(argument: Option<&String>) -> Result<String, String> {
    match argument {
        Some(path) if path != "-" => fs::read_to_string(path).map_err(|error| error.to_string()),
        _ => {
            let mut input = String::new();
            io::stdin()
                .read_to_string(&mut input)
                .map_err(|error| error.to_string())?;
            Ok(input)
        }
    }
}

fn main() {
    let arguments: Vec<String> = env::args().collect();
    let command = arguments.get(1).map(String::as_str).unwrap_or("execute");
    match command {
        "execute" => {
            let request = read_request(arguments.get(2)).unwrap_or_else(|message| {
                eprintln!(
                    "{}",
                    json!({"status":"error","code":"RCL_TENSOR_REQUEST_IO","message":message})
                );
                std::process::exit(2);
            });
            match execute_json(&request) {
                Ok(response) => println!("{response}"),
                Err(response) => {
                    eprintln!("{response}");
                    std::process::exit(1);
                }
            }
        }
        "describe" => println!(
            "{}",
            json!({
                "format": "rcl.tensor-cpu-backend-description.v0.1",
                "providerId": PROVIDER_ID,
                "capability": CAPABILITY,
                "backend": "rcl-tensor-cpu-rust-v0.1",
                "dtype": ["f64"],
                "layout": ["row-major"],
                "deviceIntent": ["cpu"],
                "requestFormats": ["rcl.tensor-execution-request.v0.1","rcl.tensor-execution-plan.v0.1","rcl.tensor-execution-plan-file.v0.1","rcl.tensor-autodiff-request.v0.1","rcl.tensor-autodiff-sgd-training-request.v0.1"],
                "operations": ["add","sub","mul","div","abs","exp","log","sqrt","reshape","broadcast","transpose","matmul","sum","mean","max","softmax","layer-norm","rms-norm","activation","stop-gradient"],
                "autodiff": {"mode":"reverse","optimizerBoundary":"batch-sgd-v0.1-only","modelSpecialOperations":[]}
            })
        ),
        "benchmark" => {
            let size = arguments
                .get(2)
                .and_then(|value| value.parse::<usize>().ok())
                .unwrap_or(192);
            let repeats = arguments
                .get(3)
                .and_then(|value| value.parse::<usize>().ok())
                .unwrap_or(7);
            if size == 0 || repeats < 3 {
                eprintln!("benchmark requires size > 0 and repeats >= 3");
                std::process::exit(2);
            }
            let count = size * size;
            let left = (0..count)
                .map(|index| ((index * 17 + 3) % 101) as f64 / 101.0 - 0.5)
                .collect::<Vec<_>>();
            let right = (0..count)
                .map(|index| ((index * 29 + 7) % 103) as f64 / 103.0 - 0.5)
                .collect::<Vec<_>>();
            let tensors = vec![
                TensorDescriptor {
                    id: "a".into(),
                    shape: vec![size, size],
                    dtype: "f64".into(),
                    layout: "row-major".into(),
                    device: "cpu".into(),
                    gradient_identity: "constant:a".into(),
                    storage_identity: "storage:a".into(),
                },
                TensorDescriptor {
                    id: "b".into(),
                    shape: vec![size, size],
                    dtype: "f64".into(),
                    layout: "row-major".into(),
                    device: "cpu".into(),
                    gradient_identity: "constant:b".into(),
                    storage_identity: "storage:b".into(),
                },
            ];
            let storages = vec![
                DenseStorage {
                    identity: "storage:a".into(),
                    kind: "cpu-dense".into(),
                    data: left,
                },
                DenseStorage {
                    identity: "storage:b".into(),
                    kind: "cpu-dense".into(),
                    data: right,
                },
            ];
            let run = |operation: &str| {
                execute(&ExecutionRequest {
                    format: REQUEST_FORMAT.into(),
                    operation: operation.into(),
                    tensors: tensors.clone(),
                    storages: storages.clone(),
                    attributes: json!({}),
                })
                .unwrap()
            };
            let optimized_warmup = run("matmul");
            let reference_warmup = run("matmul-reference");
            if optimized_warmup.storage.data != reference_warmup.storage.data {
                eprintln!("optimized/reference differential parity failed");
                std::process::exit(1);
            }
            let mut optimized = Vec::with_capacity(repeats);
            let mut reference = Vec::with_capacity(repeats);
            for _ in 0..repeats {
                optimized.push(run("matmul").telemetry.kernel_nanos);
                reference.push(run("matmul-reference").telemetry.kernel_nanos);
            }
            optimized.sort_unstable();
            reference.sort_unstable();
            let optimized_median = optimized[repeats / 2];
            let reference_median = reference[repeats / 2];
            println!(
                "{}",
                json!({
                    "format": "rcl.tensor-cpu-benchmark.v0.1",
                    "status": "CANDIDATE_LOCAL_MEASUREMENT",
                    "matrix": [size, size, size],
                    "repeats": repeats,
                    "optimizedMedianNanos": optimized_median,
                    "referenceMedianNanos": reference_median,
                    "optimizedSamplesNanos": optimized,
                    "referenceSamplesNanos": reference,
                    "speedup": reference_median as f64 / optimized_median as f64,
                    "exactDifferentialParity": true,
                    "backend": "rcl-tensor-cpu-rust-v0.1",
                    "boundary": "kernel-only monotonic clock; excludes JSON, process startup, RCL compilation and VM provider dispatch"
                })
            );
        }
        #[cfg(windows)]
        "run-rbc" => {
            let rbc = arguments.get(2).unwrap_or_else(|| {
                eprintln!("run-rbc requires an RBC path");
                std::process::exit(2);
            });
            let dll = arguments
                .get(3)
                .map(std::path::PathBuf::from)
                .map(Ok)
                .unwrap_or_else(rclvm_provider::default_dll_path)
                .unwrap_or_else(|message| {
                    eprintln!("{message}");
                    std::process::exit(2);
                });
            match rclvm_provider::run_rbc(std::path::Path::new(rbc), &dll) {
                Ok(response) => println!("{response}"),
                Err(message) => {
                    eprintln!("{message}");
                    std::process::exit(1);
                }
            }
        }
        _ => {
            eprintln!(
                "Usage: rcl-tensor-engine [execute [request.json|-]|describe|benchmark [size] [repeats]|run-rbc <program.rbc> [rclvm.dll]]"
            );
            std::process::exit(2);
        }
    }
}
