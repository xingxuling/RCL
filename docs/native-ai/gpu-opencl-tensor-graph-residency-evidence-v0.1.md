# K15 AMD OpenCL ordered Tensor graph residency evidence v0.1

## Current ruling

`PASS_LOCAL_AND_HOSTED_AND_POSTMERGE_OPENCL_TENSOR_GRAPH_RESIDENCY_CANDIDATE`

RCL owns the ordered graph, Tensor `storageIdentity` and deterministic
`valueRoot`, input shape/dtype, resource order and readback policy. The AMD
OpenCL provider remains an auxiliary organ that lowers those declarations to
`cl_mem` objects and the existing BF16 matmul kernel. K15 proves a bounded
two-node graph can keep an intermediate output on the device until one final
readback. It does not claim canonical Tensor output residency, full-model
residency, training-step residency, throughput, VRAM reduction, portability or
GPU training.

## Local evidence

- The real AMD OpenCL device `gfx1152` executed two ordered rank-2 BF16 matmul
  nodes. The first node produced a `[1,2]` ephemeral resource and the second
  consumed it to produce `[1,1]`.
- The final output was the exact BF16 bit `4040` (`3.0`), with execution root
  `76fc4bb4c8a4df61ef5853982a53b89c7b387699cd29e69fb28ea129681a4a3c`.
- The provider reported zero intermediate readbacks and exactly one final
  readback. Two ephemeral output resources were allocated and released; the
  three RCL-owned input Tensors uploaded once and were released before close.
- Allocation telemetry was five buffers / 22 bytes / five releases. Transfer
  telemetry was three host-to-device uploads and one device-to-host readback.
- The negative suite rejected an intermediate readback with
  `RCL_OPENCL_TENSOR_GRAPH_READBACK` and a use-before-produce resource with
  `RCL_OPENCL_TENSOR_GRAPH_RESOURCE`. Provider fallback remains forbidden.
- K15 passed `3/3`; the Rust bridge built with locked release dependencies and
  the provider passed Python syntax compilation. K14 Tensor residency and K13
  buffer-arena suites remain required regressions.
- Hosted PR #119 exact-head replay passed K15 on Ubuntu/Windows and the K09-K14
  regression chain plus Authority. Post-merge `main@d2efae8` passed the same
  K15-scope checks. The repository-wide Canonical and Universal checks failed
  only on the pre-existing K337/K338/K340 compiler RBC drift; those failures
  are recorded in the JSON receipt and do not involve K15.
- License audit: no dependency, external source or donor code was added.

## No Silent RCL Bypass ruling

| Field | Ruling |
|---|---|
| Task | K15 bounded ordered OpenCL Tensor graph residency |
| Missing capability | retain an intermediate accelerator output between ordered kernels without materializing a host Tensor |
| Prior workaround | serialize every matmul output and re-upload it as a new host value |
| Donor | K09 persistent provider session, K13 allocation arena and K14 Tensor value residency |
| Gap type | memory / backend / graph lowering gap |
| Generality | cross-model accelerator execution |
| Candidate absorption | RCL-owned ordered graph/resource contract with ephemeral provider resources and explicit final readback |
| K400 impact | K233 performance and future scale evidence only; matrix remains `23/400` |

## Evidence boundary

| Gate | Ruling |
|---|---|
| EXPRESS | CANDIDATE |
| COMPILE | PASS_LOCAL |
| LOWER | PASS_LOCAL_CANDIDATE |
| EXECUTE | PASS_LOCAL_REAL_AMD |
| CORRECT | PASS_LOCAL_EXACT_OUTPUT_BITS |
| ROBUST | PASS_LOCAL_FAIL_CLOSED_GRAPH_ORDER_AND_READBACK |
| PERFORMANCE | ALLOCATION_AND_TRANSFER_COUNTS_ONLY_NO_WALL_TIME_OR_THROUGHPUT_CLAIM |
| AI_GENERATE | NOT_APPLICABLE |
| EVIDENCE | CANDIDATE_HOSTED_AND_POSTMERGE_K15_SCOPE_WITH_PREEXISTING_K337_K338_K340_DRIFT |

The candidate grants only
`OPENCL_AMD_ORDERED_TENSOR_GRAPH_RESIDENCY_CANDIDATE` and
`OPENCL_AMD_INTERMEDIATE_DEVICE_RESOURCE_CANDIDATE`. The ephemeral output is
not a canonical RCL Tensor value and cannot be used as a durable checkpoint or
training state. `GPU_TRAINING`, output/full-graph/training-step residency,
parallel execution, wall-time/throughput, VRAM, portability, RCL-10M, RCL-1B
and K400 promotion remain explicitly ungranted until independently evidenced.

Authority files:

- `examples/native-ai/gpu-opencl-tensor-graph-residency-contract.v0.1.json`
- `examples/native-ai/gpu-opencl-tensor-graph-residency-genome.rcl`
- `native/tensor-engine/src/bin/rcl-opencl-tensor-residency.rs`
- `native/tensor-engine/amd_opencl_bf16_provider.py`
- `examples/native-ai/evidence/gpu-opencl-tensor-graph-residency-v0.1/k15-opencl-tensor-graph-residency-local-evidence.json`

Reproduction: `npm run test:k15-opencl-tensor-graph-residency`,
`npm run test:k14-opencl-tensor-residency` and
`npm run test:k13-opencl-buffer-arena`.
