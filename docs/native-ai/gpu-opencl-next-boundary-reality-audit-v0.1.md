# K12 AMD OpenCL Next-Boundary Reality Audit v0.1

## Verdict

`CANDIDATE_AUDIT_ONLY_DEVICE_RESIDENCY_AND_CROSS_NODE_PLANNER_NOT_READY`

This audit selects session-scoped device-buffer residency as the next bounded
GPU execution candidate. Cross-node batching is downstream of that capability
and must not be implemented as an untyped larger K10/K11 request. No K400
cell, GPU-training promotion or throughput result is granted by this audit.

## Audit baseline

The audit is based on the merged main source at
`3058de9ba252061ba24fd544659e1ec8771a97c1`, including K11's final evidence
documentation and the post-merge Canonical run `33143626197`, Universal Stress
run `33143626244` and Authority run `33143626261`, all successful. The K11
candidate remains the accepted baseline:

- RCL owns Tensor descriptors, graph order, BF16 RNE, FP32 accumulation,
  reverse rules, gradients, AdamW state and checkpoint identity.
- The Python AMD OpenCL process is an auxiliary lowerer and transport organ;
  silent CPU fallback remains forbidden.
- K11 batches only `left-gradient` then `right-gradient` for one matmul node.
  It does not batch across nodes or retain device buffers.

## Reality findings

| Boundary | Observed source behavior | Ruling |
|---|---|---|
| Provider persistence | `OpenClProviderSession` keeps one provider process, OpenCL context and program for one training request. | Reusable execution context is present. |
| Memory lifetime | `run_opencl_kernel` creates a kernel and input/output `cl_mem` objects for each child operation, copies host inputs, reads outputs and releases every buffer and kernel before returning. | Device-buffer residency is absent. |
| Canonical storage | RCL `DenseStorage` is a `Vec<f64>`; `BoundTensor` borrows host slices. GPU requests carry serialized BF16/F32 bit arrays and responses are decoded into host gradients/results. | Device handles cannot be inserted into canonical Tensor/Storage state without a new bounded protocol. |
| Current batch transport | K10/K11 send an ordered JSON array of complete child requests. The provider runs each child through its own kernel and buffer set; child roots remain authoritative. | Batch transport is not a planner and does not imply shared buffers. |
| K08 stress graph | The accepted K08 GPU-native graph has 36 forward GPU matmuls, 72 reverse matmul-gradient operations, 14 AdamW groups and more than 40 explicit CPU-reference nodes. | A general planner must respect graph readiness, reverse traversal and host/device boundaries. |
| Current telemetry | K11 records 338 logical requests, 217 transport dispatches and 108 gradient-pair batches plus one AdamW batch. | Dispatch reduction is measured; throughput, VRAM and overlap are not measured. |

## Candidate ordering

### K12-A — session-scoped device-buffer residency

This is the smallest high-leverage next candidate. It should first be limited
to a two-operation read-only reuse slice: upload one canonical input into a
session-scoped provider buffer, execute two ordered matmuls that consume it,
read back each result, then explicitly release the buffer. The slice should
exercise a real AMD device when available and a declared unavailable-device
path otherwise.

The candidate contract must define:

1. buffer identity, shape, dtype, layout, device and storage-root binding;
2. upload, consume, readback, release and error-cleanup operations;
3. session ownership and a bounded byte/handle budget;
4. aliasing, use-after-release, cross-session and descriptor-mismatch errors;
5. authoritative operation roots and deterministic child ordering;
6. exact CPU differential, replay, checkpoint non-interference and fail-closed
   provider/device negatives.

The provider may own the OpenCL `cl_mem` implementation, but RCL must own the
resource identity, admissibility and graph semantics. The first implementation
must not change the canonical `DenseStorage` representation or claim that a
device handle is durable checkpoint state.

### K12-B — cross-node batch planner

This remains `BLOCKED_BY_K12_A`. A planner needs explicit readiness and
resource-use information, not merely a larger `requests` array. It must prove
that operations are independent, preserve RCL forward/reverse order, retain
child roots, and release resources at the last use. No cross-node batching is
admitted by K11 evidence.

### K12-C — batched kernels or parallel execution

Not selected for the next gate. It would change the provider execution model
and requires separate numerical differential, synchronization, device-memory
and performance evidence. K11's ordered transport does not provide any of
those claims.

## No Silent RCL Bypass record

| Field | Record |
|---|---|
| task | K12 next GPU dispatch boundary for the K08-native AI campaign |
| missing capability | RCL-visible, bounded device-buffer resource identity/lifecycle and a graph-aware GPU batch planner |
| workaround today | Host `DenseStorage` bit arrays cross the provider boundary per operation; only process/context/program persist |
| donor advantage | OpenCL `cl_mem` lifetime and the existing K09/K10/K11 persistent session/ordered transport |
| gap type | Runtime protocol + lowering/resource IR + evidence; not a license to move Tensor semantics out of RCL |
| generality | Generic Tensor matmul/gradient/optimizer graphs using an OpenCL-like auxiliary provider |
| candidate absorption | Add a candidate resource contract and provider adapter; evaluate later for RCL profile absorption after lifecycle and differential evidence |
| affected K400 cells | `K233` remains unchanged and receives no accelerator credit; accelerated Tensor/ML profiles remain outside the admitted matrix. The repository-wide K400 count remains 23 PASS / 377 UNTESTED. |

## Gate ruling

| Gate | Ruling |
|---|---|
| EXPRESS | CANDIDATE audit only; no K12 implementation contract admitted yet |
| COMPILE | NOT_RUN |
| LOWER | NOT_RUN |
| EXECUTE | NOT_RUN |
| CORRECT | NOT_RUN |
| ROBUST | NOT_RUN |
| PERFORMANCE | NOT_EVALUATED |
| AI_GENERATE | NOT_APPLICABLE; no generation claim |
| EVIDENCE | CANDIDATE source audit only |

## Claims

Granted: none.

Not granted: device-buffer residency, cross-node batching, batched kernels,
parallel execution, VRAM reduction, throughput, generic GPU portability, GPU
training promotion, RCL-10M, RCL-1B or K400 PASS.

## Next acceptance gate

Create a separate K12 candidate contract/genome and a focused real-provider
test for the two-operation reuse slice. Stop before broad graph integration if
resource roots, cleanup, CPU differential or unavailable-device behavior are
not independently evidenced. Keep `RCL_GAP_GPU_BATCH_PLANNER`,
`RCL_GAP_GPU_DEVICE_BUFFER_RESIDENCY` and
`RCL_GAP_RCL10M_TOKENIZER_DATASET` open until their separate gates pass.
