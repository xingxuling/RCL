use rcl_tensor_engine::{EngineError, OpenClProviderSession, SESSION_TENSOR_RESIDENCY_MODE};
use serde::Deserialize;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};
use std::env;
use std::fs;
use std::io::{self, Read};
use std::path::PathBuf;

const REQUEST_FORMAT: &str = "rcl.k14.opencl-amd-tensor-residency-probe-request.v0.1";
const RESULT_FORMAT: &str = "rcl.k14.opencl-amd-tensor-residency-probe-result.v0.1";
const GRAPH_REQUEST_FORMAT: &str = "rcl.k15.opencl-amd-tensor-graph-residency-probe-request.v0.1";
const GRAPH_RESULT_FORMAT: &str = "rcl.k15.opencl-amd-tensor-graph-residency-probe-result.v0.1";
const BACKEND: &str = "opencl-amd";
const MAX_TENSORS: usize = 64;
const MAX_OPERATIONS: usize = 128;
const MAX_GRAPH_NODES: usize = 8;
const MAX_DIMENSION: usize = 64;

#[derive(Debug)]
struct ProbeError {
    code: String,
    message: String,
}

impl ProbeError {
    fn new(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
        }
    }
}

impl From<EngineError> for ProbeError {
    fn from(error: EngineError) -> Self {
        Self::new(error.code, error.message)
    }
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct TensorSpec {
    tensor_id: String,
    storage_identity: String,
    dtype: String,
    shape: Vec<usize>,
    bits: Vec<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct OperationSpec {
    operation: String,
    #[serde(default)]
    tensor_id: Option<String>,
    #[serde(default)]
    left_tensor_id: Option<String>,
    #[serde(default)]
    right_tensor_id: Option<String>,
    #[serde(default)]
    output_tensor_id: Option<String>,
    #[serde(default)]
    node_id: Option<String>,
    #[serde(default)]
    replace: bool,
    #[serde(default)]
    previous_value_root: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Request {
    format: String,
    backend: String,
    provider_path: String,
    tensors: Vec<TensorSpec>,
    operations: Vec<OperationSpec>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct GraphNodeSpec {
    node_id: String,
    output_resource: String,
    #[serde(default)]
    left_tensor_id: Option<String>,
    #[serde(default)]
    left_resource: Option<String>,
    #[serde(default)]
    right_tensor_id: Option<String>,
    #[serde(default)]
    right_resource: Option<String>,
    rows: usize,
    columns: usize,
    shared: usize,
    #[serde(default)]
    readback: bool,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct GraphRequest {
    format: String,
    backend: String,
    provider_path: String,
    tensors: Vec<TensorSpec>,
    nodes: Vec<GraphNodeSpec>,
}

fn read_request(argument: Option<&String>) -> Result<String, ProbeError> {
    match argument {
        Some(path) if path != "-" => fs::read_to_string(path)
            .map_err(|error| ProbeError::new("RCL_K14_REQUEST_IO", error.to_string())),
        _ => {
            let mut input = String::new();
            io::stdin()
                .read_to_string(&mut input)
                .map_err(|error| ProbeError::new("RCL_K14_REQUEST_IO", error.to_string()))?;
            Ok(input)
        }
    }
}

fn validate_bits(spec: &TensorSpec) -> Result<(), ProbeError> {
    if spec.bits.len() != spec.shape.iter().product::<usize>() {
        return Err(ProbeError::new(
            "RCL_K14_TENSOR_SHAPE",
            format!(
                "Tensor {} has {} bits for shape {:?}",
                spec.tensor_id,
                spec.bits.len(),
                spec.shape
            ),
        ));
    }
    for bits in &spec.bits {
        if bits.len() != 4 || bits.to_ascii_lowercase() != *bits {
            return Err(ProbeError::new(
                "RCL_K14_TENSOR_BITS",
                format!(
                    "Tensor {} bits must be lowercase BF16 hexadecimal",
                    spec.tensor_id
                ),
            ));
        }
        let parsed = u16::from_str_radix(bits, 16).map_err(|_| {
            ProbeError::new(
                "RCL_K14_TENSOR_BITS",
                format!("Tensor {} contains invalid BF16 bits", spec.tensor_id),
            )
        })?;
        if parsed & 0x7f80 == 0x7f80 {
            return Err(ProbeError::new(
                "RCL_K14_TENSOR_BITS",
                format!("Tensor {} contains non-finite BF16 bits", spec.tensor_id),
            ));
        }
    }
    Ok(())
}

fn value_root(spec: &TensorSpec) -> String {
    let mut digest = Sha256::new();
    digest.update(b"rcl.tensor.value-residency.v0.1\0");
    digest.update(spec.dtype.as_bytes());
    digest.update([0]);
    digest.update((spec.shape.len() as u64).to_le_bytes());
    for dimension in &spec.shape {
        digest.update((*dimension as u64).to_le_bytes());
    }
    for bits in &spec.bits {
        digest.update(bits.as_bytes());
        digest.update([0]);
    }
    format!("sha256:{}", hex::encode(digest.finalize()))
}

fn identity(value: Option<&String>, label: &str) -> Result<String, ProbeError> {
    let value = value.ok_or_else(|| {
        ProbeError::new("RCL_K14_BINDING_REQUIRED", format!("{label} is required"))
    })?;
    if value.is_empty() || value.len() > 256 {
        return Err(ProbeError::new(
            "RCL_K14_BINDING_IDENTITY",
            format!("{label} must be a non-empty identity"),
        ));
    }
    Ok(value.clone())
}

fn tensor_map(request: &Request) -> Result<HashMap<String, TensorSpec>, ProbeError> {
    if request.tensors.is_empty() || request.tensors.len() > MAX_TENSORS {
        return Err(ProbeError::new(
            "RCL_K14_TENSOR_LIMIT",
            format!("tensors must contain 1..={MAX_TENSORS} items"),
        ));
    }
    let mut ids = HashSet::new();
    let mut storage_ids = HashSet::new();
    let mut result = HashMap::new();
    for spec in &request.tensors {
        if spec.tensor_id.is_empty() || !ids.insert(spec.tensor_id.clone()) {
            return Err(ProbeError::new(
                "RCL_K14_TENSOR_IDENTITY",
                "tensorId values must be unique and non-empty",
            ));
        }
        if spec.storage_identity.is_empty() || !storage_ids.insert(spec.storage_identity.clone()) {
            return Err(ProbeError::new(
                "RCL_K14_TENSOR_IDENTITY",
                "storageIdentity values must be unique and non-empty",
            ));
        }
        if spec.dtype != "bf16"
            || spec.shape.len() != 2
            || spec
                .shape
                .iter()
                .any(|value| *value == 0 || *value > MAX_DIMENSION)
        {
            return Err(ProbeError::new(
                "RCL_K14_TENSOR_DESCRIPTOR",
                format!(
                    "Tensor {} must be a bounded rank-2 bf16 value",
                    spec.tensor_id
                ),
            ));
        }
        validate_bits(spec)?;
        result.insert(spec.tensor_id.clone(), spec.clone());
    }
    Ok(result)
}

fn graph_tensor_map(request: &GraphRequest) -> Result<HashMap<String, TensorSpec>, ProbeError> {
    if request.tensors.is_empty() || request.tensors.len() > MAX_TENSORS {
        return Err(ProbeError::new(
            "RCL_K15_TENSOR_LIMIT",
            format!("tensors must contain 1..={MAX_TENSORS} items"),
        ));
    }
    let mut ids = HashSet::new();
    let mut storage_ids = HashSet::new();
    let mut result = HashMap::new();
    for spec in &request.tensors {
        if spec.tensor_id.is_empty() || !ids.insert(spec.tensor_id.clone()) {
            return Err(ProbeError::new(
                "RCL_K15_TENSOR_IDENTITY",
                "tensorId values must be unique and non-empty",
            ));
        }
        if spec.storage_identity.is_empty() || !storage_ids.insert(spec.storage_identity.clone()) {
            return Err(ProbeError::new(
                "RCL_K15_TENSOR_IDENTITY",
                "storageIdentity values must be unique and non-empty",
            ));
        }
        if spec.dtype != "bf16"
            || spec.shape.len() != 2
            || spec
                .shape
                .iter()
                .any(|value| *value == 0 || *value > MAX_DIMENSION)
        {
            return Err(ProbeError::new(
                "RCL_K15_TENSOR_DESCRIPTOR",
                format!(
                    "Tensor {} must be a bounded rank-2 bf16 value",
                    spec.tensor_id
                ),
            ));
        }
        validate_bits(spec)?;
        result.insert(spec.tensor_id.clone(), spec.clone());
    }
    Ok(result)
}

fn bind_payload(
    spec: &TensorSpec,
    root: &str,
    operation: &OperationSpec,
    already_bound: bool,
) -> Value {
    let mut payload = json!({
        "format": "rcl.opencl-amd-tensor-residency-request.v0.1",
        "backend": BACKEND,
        "operation": "bind",
        "tensorIdentity": spec.storage_identity,
        "valueRoot": root,
        "dtype": spec.dtype,
        "shape": spec.shape,
        "access": "read-only",
    });
    if !already_bound || operation.replace {
        payload["bits"] = json!(spec.bits);
    }
    if operation.replace {
        payload["replace"] = Value::Bool(true);
        if let Some(previous) = &operation.previous_value_root {
            payload["previousValueRoot"] = Value::String(previous.clone());
        }
    }
    payload
}

fn graph_node_identity(value: &str, label: &str) -> Result<String, ProbeError> {
    if value.is_empty() || value.len() > 256 {
        return Err(ProbeError::new(
            "RCL_K15_GRAPH_IDENTITY",
            format!("{label} must be a non-empty identity"),
        ));
    }
    Ok(value.to_owned())
}

fn graph_input_payload(
    node: &GraphNodeSpec,
    side: &str,
    tensors: &HashMap<String, TensorSpec>,
    prior_shapes: &HashMap<String, Vec<usize>>,
    used_tensor_ids: &mut Vec<String>,
    payload: &mut Value,
) -> Result<Vec<usize>, ProbeError> {
    let tensor_id = if side == "left" {
        node.left_tensor_id.as_ref()
    } else {
        node.right_tensor_id.as_ref()
    };
    let resource_id = if side == "left" {
        node.left_resource.as_ref()
    } else {
        node.right_resource.as_ref()
    };
    if tensor_id.is_some() == resource_id.is_some() {
        return Err(ProbeError::new(
            "RCL_K15_GRAPH_INPUT",
            format!("{side} input must select exactly one Tensor or resource"),
        ));
    }
    if let Some(tensor_id) = tensor_id {
        let tensor_id = graph_node_identity(tensor_id, &format!("{side}TensorId"))?;
        let spec = tensors.get(&tensor_id).ok_or_else(|| {
            ProbeError::new(
                "RCL_K15_GRAPH_INPUT",
                format!("unknown {side} Tensor {tensor_id}"),
            )
        })?;
        if !used_tensor_ids.iter().any(|value| value == &tensor_id) {
            used_tensor_ids.push(tensor_id.clone());
        }
        let identity_field = format!("{side}TensorIdentity");
        let root_field = format!("{side}ValueRoot");
        payload[identity_field] = Value::String(spec.storage_identity.clone());
        payload[root_field] = Value::String(value_root(spec));
        return Ok(spec.shape.clone());
    }
    let resource_id = graph_node_identity(
        resource_id.expect("resource id presence checked"),
        &format!("{side}Resource"),
    )?;
    let shape = prior_shapes.get(&resource_id).ok_or_else(|| {
        ProbeError::new(
            "RCL_K15_GRAPH_RESOURCE",
            format!("{side} resource {resource_id} is not available at this graph point"),
        )
    })?;
    payload[format!("{side}Resource")] = Value::String(resource_id);
    Ok(shape.clone())
}

fn graph_payload(
    request: &GraphRequest,
    tensors: &HashMap<String, TensorSpec>,
    used_tensor_ids: &mut Vec<String>,
) -> Result<Value, ProbeError> {
    if request.nodes.len() < 2 || request.nodes.len() > MAX_GRAPH_NODES {
        return Err(ProbeError::new(
            "RCL_K15_GRAPH_LIMIT",
            format!("nodes must contain 2..={MAX_GRAPH_NODES} items"),
        ));
    }
    let mut node_ids = HashSet::new();
    let mut output_resources = HashSet::new();
    let mut prior_shapes = HashMap::<String, Vec<usize>>::new();
    let mut nodes = Vec::with_capacity(request.nodes.len());
    for (index, node) in request.nodes.iter().enumerate() {
        let node_id = graph_node_identity(&node.node_id, "nodeId")?;
        if !node_ids.insert(node_id.clone()) {
            return Err(ProbeError::new(
                "RCL_K15_GRAPH_IDENTITY",
                format!("graph nodeId {node_id} is duplicated"),
            ));
        }
        let output_resource = graph_node_identity(&node.output_resource, "outputResource")?;
        if !output_resources.insert(output_resource.clone()) {
            return Err(ProbeError::new(
                "RCL_K15_GRAPH_RESOURCE",
                format!("graph outputResource {output_resource} is duplicated"),
            ));
        }
        if index + 1 == request.nodes.len() {
            if !node.readback {
                return Err(ProbeError::new(
                    "RCL_K15_GRAPH_READBACK",
                    "the final graph node requires an explicit readback",
                ));
            }
        } else if node.readback {
            return Err(ProbeError::new(
                "RCL_K15_GRAPH_READBACK",
                "only the final graph node may request a readback",
            ));
        }
        let dimensions = [node.rows, node.columns, node.shared];
        if dimensions
            .iter()
            .any(|value| *value == 0 || *value > MAX_DIMENSION)
        {
            return Err(ProbeError::new(
                "RCL_K15_GRAPH_SHAPE",
                format!("graph node {node_id} dimensions must be within 1..={MAX_DIMENSION}"),
            ));
        }
        let mut payload = json!({
            "nodeId": node_id,
            "outputResource": output_resource.clone(),
            "rows": node.rows,
            "columns": node.columns,
            "shared": node.shared,
            "readback": node.readback,
        });
        let left_shape = graph_input_payload(
            node,
            "left",
            tensors,
            &prior_shapes,
            used_tensor_ids,
            &mut payload,
        )?;
        let right_shape = graph_input_payload(
            node,
            "right",
            tensors,
            &prior_shapes,
            used_tensor_ids,
            &mut payload,
        )?;
        if left_shape != vec![node.rows, node.shared]
            || right_shape != vec![node.shared, node.columns]
        {
            return Err(ProbeError::new(
                "RCL_K15_GRAPH_SHAPE",
                format!("graph node {node_id} input shapes do not match its dimensions"),
            ));
        }
        prior_shapes.insert(output_resource, vec![node.rows, node.columns]);
        nodes.push(payload);
    }
    Ok(json!({
        "format": "rcl.opencl-amd-tensor-residency-request.v0.1",
        "backend": BACKEND,
        "operation": "graph",
        "nodes": nodes,
    }))
}

fn run_graph(request: GraphRequest) -> Result<Value, ProbeError> {
    if request.format != GRAPH_REQUEST_FORMAT {
        return Err(ProbeError::new(
            "RCL_K15_REQUEST_FORMAT",
            format!("unsupported request format {}", request.format),
        ));
    }
    if request.backend != BACKEND {
        return Err(ProbeError::new(
            "RCL_K15_BACKEND",
            "the Tensor graph residency candidate requires opencl-amd",
        ));
    }
    let tensors = graph_tensor_map(&request)?;
    let mut used_tensor_ids = Vec::new();
    let graph = graph_payload(&request, &tensors, &mut used_tensor_ids)?;
    let provider_path = PathBuf::from(&request.provider_path);
    if !provider_path.is_file() {
        return Err(ProbeError::new(
            "RCL_ACCELERATOR_PROVIDER_UNAVAILABLE",
            format!(
                "OpenCL provider path is not a file: {}",
                provider_path.display()
            ),
        ));
    }
    let mut session = OpenClProviderSession::new_with_buffer_allocation_mode(
        &provider_path,
        Some(SESSION_TENSOR_RESIDENCY_MODE),
    )?;
    let mut bound = Vec::with_capacity(used_tensor_ids.len());
    for tensor_id in &used_tensor_ids {
        let spec = tensors
            .get(tensor_id)
            .expect("graph payload validated Tensor id");
        let root = value_root(spec);
        session.execute_tensor_residency(&json!({
            "format": "rcl.opencl-amd-tensor-residency-request.v0.1",
            "backend": BACKEND,
            "operation": "bind",
            "tensorIdentity": spec.storage_identity,
            "valueRoot": root,
            "dtype": spec.dtype,
            "shape": spec.shape,
            "access": "read-only",
            "bits": spec.bits,
        }))?;
        bound.push((spec.storage_identity.clone(), root));
    }
    let graph_receipt = session.execute_tensor_residency(&graph)?;
    for (identity, root) in bound.iter().rev() {
        session.execute_tensor_residency(&json!({
            "format": "rcl.opencl-amd-tensor-residency-request.v0.1",
            "backend": BACKEND,
            "operation": "release",
            "tensorIdentity": identity,
            "valueRoot": root,
        }))?;
    }
    session.close_tensor_residency()?;
    let device = graph_receipt.get("device").cloned().unwrap_or(Value::Null);
    let output_bits = graph_receipt
        .get("outputBits")
        .cloned()
        .unwrap_or(Value::Null);
    Ok(json!({
        "format": GRAPH_RESULT_FORMAT,
        "status": "PASS_LOCAL_OPENCL_TENSOR_GRAPH_RESIDENCY_CANDIDATE",
        "canonicalOwner": "RCL",
        "backend": BACKEND,
        "device": device,
        "graph": graph_receipt,
        "outputBits": output_bits,
        "telemetry": {
            "bufferAllocationCount": session.buffer_allocation_count(),
            "bufferAllocationBytes": session.buffer_allocation_bytes(),
            "bufferReleaseCount": session.buffer_release_count(),
            "tensorValueResidency": session.tensor_value_residency(),
            "residentTensorCount": session.resident_tensor_count(),
            "residentBytes": session.resident_bytes(),
            "maxResidentTensors": session.max_resident_tensors(),
            "maxResidentBytes": session.max_resident_bytes(),
            "tensorBindCount": session.tensor_bind_count(),
            "tensorResidencyHitCount": session.tensor_residency_hit_count(),
            "tensorReplacementCount": session.tensor_replacement_count(),
            "tensorHostToDeviceTransfers": session.tensor_host_to_device_transfers(),
            "tensorDeviceToHostTransfers": session.tensor_device_to_host_transfers(),
            "tensorReleaseCount": session.tensor_release_count(),
        },
        "intermediateReadbackCount": graph_receipt
            .get("intermediateReadbackCount")
            .cloned()
            .unwrap_or(Value::Null),
        "finalReadbackCount": graph_receipt
            .get("finalReadbackCount")
            .cloned()
            .unwrap_or(Value::Null),
        "closed": true,
    }))
}

fn run(request: Request) -> Result<Value, ProbeError> {
    if request.format != REQUEST_FORMAT {
        return Err(ProbeError::new(
            "RCL_K14_REQUEST_FORMAT",
            format!("unsupported request format {}", request.format),
        ));
    }
    if request.backend != BACKEND {
        return Err(ProbeError::new(
            "RCL_K14_BACKEND",
            "the Tensor residency candidate requires opencl-amd",
        ));
    }
    if request.operations.is_empty() || request.operations.len() > MAX_OPERATIONS {
        return Err(ProbeError::new(
            "RCL_K14_OPERATION_LIMIT",
            format!("operations must contain 1..={MAX_OPERATIONS} items"),
        ));
    }
    let tensors = tensor_map(&request)?;
    let provider_path = PathBuf::from(&request.provider_path);
    if !provider_path.is_file() {
        return Err(ProbeError::new(
            "RCL_ACCELERATOR_PROVIDER_UNAVAILABLE",
            format!(
                "OpenCL provider path is not a file: {}",
                provider_path.display()
            ),
        ));
    }
    let mut session = OpenClProviderSession::new_with_buffer_allocation_mode(
        &provider_path,
        Some(SESSION_TENSOR_RESIDENCY_MODE),
    )?;
    let mut bound_roots = HashMap::<String, String>::new();
    let mut receipts = Vec::with_capacity(request.operations.len());
    for operation in &request.operations {
        match operation.operation.as_str() {
            "bind" => {
                let tensor_id = identity(operation.tensor_id.as_ref(), "tensorId")?;
                let spec = tensors.get(&tensor_id).ok_or_else(|| {
                    ProbeError::new(
                        "RCL_K14_BINDING_REQUIRED",
                        format!("unknown Tensor {tensor_id}"),
                    )
                })?;
                let root = value_root(spec);
                let already_bound = bound_roots.get(&tensor_id) == Some(&root);
                let response = session.execute_tensor_residency(&bind_payload(
                    spec,
                    &root,
                    operation,
                    already_bound,
                ))?;
                bound_roots.insert(tensor_id, root);
                receipts.push(response);
            }
            "release" => {
                let tensor_id = identity(operation.tensor_id.as_ref(), "tensorId")?;
                let spec = tensors.get(&tensor_id).ok_or_else(|| {
                    ProbeError::new(
                        "RCL_K14_BINDING_REQUIRED",
                        format!("unknown Tensor {tensor_id}"),
                    )
                })?;
                let root = value_root(spec);
                if bound_roots.get(&tensor_id) != Some(&root) {
                    return Err(ProbeError::new(
                        "RCL_K14_BINDING_REQUIRED",
                        format!("Tensor {tensor_id} must be bound before release"),
                    ));
                }
                let response = session.execute_tensor_residency(&json!({
                    "format": "rcl.opencl-amd-tensor-residency-request.v0.1",
                    "backend": BACKEND,
                    "operation": "release",
                    "tensorIdentity": spec.storage_identity,
                    "valueRoot": root,
                }))?;
                bound_roots.remove(&tensor_id);
                receipts.push(response);
            }
            "matmul" => {
                let left_id = identity(operation.left_tensor_id.as_ref(), "leftTensorId")?;
                let right_id = identity(operation.right_tensor_id.as_ref(), "rightTensorId")?;
                let output_id = identity(operation.output_tensor_id.as_ref(), "outputTensorId")?;
                let left = tensors.get(&left_id).ok_or_else(|| {
                    ProbeError::new(
                        "RCL_K14_BINDING_REQUIRED",
                        format!("unknown Tensor {left_id}"),
                    )
                })?;
                let right = tensors.get(&right_id).ok_or_else(|| {
                    ProbeError::new(
                        "RCL_K14_BINDING_REQUIRED",
                        format!("unknown Tensor {right_id}"),
                    )
                })?;
                let left_root = value_root(left);
                let right_root = value_root(right);
                if bound_roots.get(&left_id) != Some(&left_root)
                    || bound_roots.get(&right_id) != Some(&right_root)
                {
                    return Err(ProbeError::new(
                        "RCL_K14_BINDING_REQUIRED",
                        "matmul inputs must be resident before execution",
                    ));
                }
                let node_id = operation
                    .node_id
                    .clone()
                    .unwrap_or_else(|| output_id.clone());
                let response = session.execute_tensor_residency(&json!({
                    "format": "rcl.opencl-amd-tensor-residency-request.v0.1",
                    "backend": BACKEND,
                    "operation": "matmul",
                    "nodeId": node_id,
                    "leftTensorIdentity": left.storage_identity,
                    "leftValueRoot": left_root,
                    "rightTensorIdentity": right.storage_identity,
                    "rightValueRoot": right_root,
                    "outputTensorIdentity": output_id,
                    "rows": left.shape[0],
                    "columns": right.shape[1],
                    "shared": left.shape[1],
                    "readback": true,
                }))?;
                receipts.push(response);
            }
            other => {
                return Err(ProbeError::new(
                    "RCL_K14_OPERATION",
                    format!("unsupported Tensor residency operation {other}"),
                ));
            }
        }
    }
    session.close_tensor_residency()?;
    let device = receipts
        .iter()
        .find_map(|receipt| receipt.get("device").cloned())
        .unwrap_or(Value::Null);
    Ok(json!({
        "format": RESULT_FORMAT,
        "status": "PASS_LOCAL_OPENCL_TENSOR_VALUE_RESIDENCY_CANDIDATE",
        "canonicalOwner": "RCL",
        "backend": BACKEND,
        "device": device,
        "operations": receipts,
        "telemetry": {
            "bufferAllocationCount": session.buffer_allocation_count(),
            "bufferAllocationBytes": session.buffer_allocation_bytes(),
            "bufferReleaseCount": session.buffer_release_count(),
            "tensorValueResidency": session.tensor_value_residency(),
            "residentTensorCount": session.resident_tensor_count(),
            "residentBytes": session.resident_bytes(),
            "maxResidentTensors": session.max_resident_tensors(),
            "maxResidentBytes": session.max_resident_bytes(),
            "tensorBindCount": session.tensor_bind_count(),
            "tensorResidencyHitCount": session.tensor_residency_hit_count(),
            "tensorReplacementCount": session.tensor_replacement_count(),
            "tensorHostToDeviceTransfers": session.tensor_host_to_device_transfers(),
            "tensorDeviceToHostTransfers": session.tensor_device_to_host_transfers(),
            "tensorReleaseCount": session.tensor_release_count(),
        },
        "closed": true,
    }))
}

fn fail(error: ProbeError) -> ! {
    eprintln!(
        "{}",
        json!({"status":"error", "code":error.code, "message":error.message})
    );
    std::process::exit(1)
}

fn main() {
    let arguments = env::args().collect::<Vec<_>>();
    let input = read_request(arguments.get(1)).unwrap_or_else(|error| fail(error));
    let envelope = serde_json::from_str::<Value>(&input)
        .unwrap_or_else(|error| fail(ProbeError::new("RCL_K14_REQUEST_JSON", error.to_string())));
    let format = envelope
        .get("format")
        .and_then(Value::as_str)
        .unwrap_or_default();
    let result = if format == GRAPH_REQUEST_FORMAT {
        let request = serde_json::from_value::<GraphRequest>(envelope).unwrap_or_else(|error| {
            fail(ProbeError::new("RCL_K15_REQUEST_JSON", error.to_string()))
        });
        run_graph(request)
    } else {
        let request = serde_json::from_value::<Request>(envelope).unwrap_or_else(|error| {
            fail(ProbeError::new("RCL_K14_REQUEST_JSON", error.to_string()))
        });
        run(request)
    }
    .unwrap_or_else(|error| fail(error));
    println!("{}", serde_json::to_string(&result).unwrap());
}
