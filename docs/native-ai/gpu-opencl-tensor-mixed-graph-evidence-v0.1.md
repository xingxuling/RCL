# K17 AMD OpenCL mixed Tensor graph evidence v0.1

## Current ruling

`PASS_LOCAL_AND_HOSTED_AND_POSTMERGE_OPENCL_TENSOR_MIXED_GRAPH_CANDIDATE`

K17 extends the existing RCL-owned ordered Tensor graph envelope with one
bounded generic chain: BF16 `matmul` followed by additive masked softmax. The
matmul output remains an ephemeral device resource consumed by the masked
softmax node; exactly one final readback is allowed. RCL owns the graph,
Tensor, masking and numerical meaning. The AMD OpenCL provider owns only the
auxiliary lowering, kernel dispatch and temporary `cl_mem` lifetime.

This is a real local AMD execution plus exact CPU differential and deterministic
replay. It is not full-graph GPU execution, training-step residency, GPU
Autodiff/AdamW, throughput, VRAM, portability, production training or K400
promotion.

## Local evidence

- Device: AMD `gfx1152`, platform `AMD Accelerated Parallel Processing`,
  OpenCL `2.0 AMD-APP (3661.0)`, driver `3661.0 (PAL,LC)`.
- Fixture: `matmul [1,2] -> additive masked-softmax [1,2]`, BF16 storage,
  FP32 stable computation and BF16 round-to-nearest-even output.
- Exact output bits: `3f00 3f00`; execution root:
  `fc1ac696f0e92dd4798d4344bd886dc040eb6d21db177bfb0527d2641c9d1a9f`.
- CPU differential and deterministic replay both passed. The second replay
  reproduced the output and execution root.
- Residency telemetry: zero intermediate readbacks, one final readback, three
  host-to-device transfers, one device-to-host transfer, three Tensor binds,
  five OpenCL allocations/releases and zero resident bytes at close.
- Local K17 protocol suite is `3/3 PASS`; Python syntax, locked Rust check and
  `git diff --check` passed. K08 AMD plus K09-K16 regression suites passed.
- Negative controls fail closed for unknown operations
  (`RCL_K17_GRAPH_OPERATION`), non-additive mask mode
  (`RCL_K17_GRAPH_MASK_MODE`), intermediate readback
  (`RCL_K15_GRAPH_READBACK`) and mask/shape drift
  (`RCL_K15_GRAPH_SHAPE`). Provider fallback is forbidden.

## No Silent RCL Bypass ruling

| Field | Ruling |
|---|---|
| Task | K17 bounded `matmul -> additive masked-softmax` graph lowerer |
| Missing capability | Lower a generic non-matmul attention node while retaining K15 ordered device residency and CPU differential |
| Prior workaround | The K15 graph admitted only matmul nodes; masked softmax remained a separate provider operation |
| Donor | Existing RCL Tensor/masking semantics, K15 ordered graph resources and K16 AMD masked-softmax kernel |
| Gap type | Backend / lowering / graph-residency integration gap |
| Generality | Cross-model attention and Tensor workloads |
| Candidate absorption | RCL-owned mixed graph contract/genome, explicit operation/mask/shape/readback gates, one final readback and deterministic BF16 differential |
| K400 impact | K233 performance and future scale evidence only; matrix remains `23/400` |

## Evidence boundary

| Gate | Ruling |
|---|---|
| EXPRESS | CANDIDATE |
| COMPILE | PASS_LOCAL |
| LOWER | PASS_LOCAL_CANDIDATE |
| EXECUTE | PASS_LOCAL_REAL_AMD |
| CORRECT | PASS_LOCAL_EXACT_BF16_BITS_AND_CPU_DIFFERENTIAL |
| ROBUST | PASS_LOCAL_FAIL_CLOSED_OPERATION_MASK_SHAPE_AND_READBACK |
| PERFORMANCE | DEVICE_RESIDENCY_AND_TRANSFER_TELEMETRY_ONLY_NO_THROUGHPUT_OR_VRAM_CLAIM |
| AI_GENERATE | NOT_APPLICABLE |
| EVIDENCE | CANDIDATE_HOSTED_AND_POSTMERGE_K17_SCOPE |

Only `OPENCL_AMD_ORDERED_TENSOR_MIXED_GRAPH_CANDIDATE` and
`OPENCL_AMD_GRAPH_MASKED_SOFTMAX_CANDIDATE` are granted. Full graph/output or
training-step residency, GPU-native Autodiff/AdamW, GPU training, parallel
execution, throughput, VRAM reduction, portability, RCL-10M/RCL-1B and K400
completion remain closed.

## Hosted and post-merge boundary

Exact head `7717296f38326ea30ba82951adecbf95254e851e` was replayed by PR #130.
The K17 mixed-graph workflow passed on Ubuntu and Windows (`33888428249`),
along with K08 AMD, K09-K16, Authority, Canonical and Universal scopes. The
Universal Windows K01 replay also passed after the earlier transient compiler
timeout was retried (`33888428583`, K01 job `101073863455`).

The PR was merged as `edc166ae9acb50741c490678e66d078fb821ec5a`. Post-merge
main replay passed K17 on Ubuntu and Windows (`33888641562`), K09-K16,
Authority, Canonical and Universal (`33888641683`) on the merged main.
Exact run and job receipts are retained in the JSON evidence file and do not
grant claims broader than this contract.

## Authority files

- `examples/native-ai/gpu-opencl-tensor-mixed-graph-contract.v0.1.json`
- `examples/native-ai/gpu-opencl-tensor-mixed-graph-genome.rcl`
- `native/tensor-engine/amd_opencl_bf16_provider.py`
- `native/tensor-engine/src/bin/rcl-opencl-tensor-residency.rs`
- `tests/k17-opencl-tensor-mixed-graph.test.mjs`
- `examples/native-ai/evidence/gpu-opencl-tensor-mixed-graph-v0.1/k17-opencl-tensor-mixed-graph-local-evidence.json`

Reproduction: `npm run test:k17-opencl-tensor-mixed-graph`.
