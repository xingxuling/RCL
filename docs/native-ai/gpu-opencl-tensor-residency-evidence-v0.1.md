# K14 AMD OpenCL Tensor value residency evidence v0.1

## Ruling

`PASS_LOCAL_OPENCL_TENSOR_VALUE_RESIDENCY_CANDIDATE`

RCL owns `storageIdentity`, the deterministic value-root recipe, binding order,
replacement/stale-value policy and the resource/close checks. The AMD OpenCL
provider remains an auxiliary organ that owns only `cl_mem` lifetime and the
generic BF16 matmul kernel. K14 proves a bounded read-only input value can stay
resident across child matmul requests. It does not claim output residency,
full-graph residency, training-step residency, wall-time, throughput or VRAM
improvement.

## Local evidence

- Real AMD OpenCL `gfx1152` executed the RCL probe with two rank-2 BF16 inputs
  and two matmul requests. The first bind of each input uploaded once; repeated
  exact `storageIdentity + valueRoot` binds were reported as `elided`.
- The two matmuls returned the exact same BF16 output bits (`4130`) while the
  provider performed two host-to-device input transfers and two explicit
  device-to-host output readbacks.
- The session allocated four OpenCL buffers in total: two resident inputs and
  two transient outputs (`12` bytes); all four were released, and the close
  receipt reported zero resident buffers and zero resident bytes.
- A changed value root for an existing identity returned
  `RCL_OPENCL_TENSOR_VALUE_STALE` without overwriting the resident value.
  An unsupported mode returned
  `RCL_OPENCL_BUFFER_ALLOCATION_MODE_UNSUPPORTED`. Provider fallback remains
  forbidden.
- K14 passed `3/3`; Rust Tensor passed `7/7`; K08 Tensor passed `16` with one
  declared skip; K13 and prior GPU dispatch regressions remain green.
- Strict Clippy was not rerun for this candidate; no Clippy PASS is claimed.
- License audit: no dependency, external source or donor code was added.

## No Silent RCL Bypass ruling

| Field | Ruling |
|---|---|
| Task | K14 bounded read-only OpenCL Tensor input residency |
| Missing capability | retain a Tensor value across child kernels while proving identity and avoiding repeat uploads |
| Prior workaround | serialize every matmul input as host BF16 bits and upload on every operation |
| Donor | internal K09 persistent session and K13 bounded allocation arena |
| Gap type | memory / backend / performance gap |
| Generality | cross-model accelerator execution |
| Candidate absorption | opt-in RCL value-root binding, explicit resident references, stale rejection and close receipt |
| K400 impact | K233 performance and future scale evidence only; matrix remains `23/400` |

## Evidence boundary

| Gate | Ruling |
|---|---|
| EXPRESS | CANDIDATE |
| COMPILE | PASS_LOCAL |
| LOWER | PASS_LOCAL_CANDIDATE |
| EXECUTE | PASS_LOCAL_REAL_AMD |
| CORRECT | PASS_LOCAL_EXACT_OUTPUT_BITS |
| ROBUST | PASS_LOCAL_FAIL_CLOSED_STALE_IDENTITY |
| PERFORMANCE | TRANSFER_COUNT_ONLY_NO_WALL_TIME_OR_THROUGHPUT_CLAIM |
| AI_GENERATE | NOT_APPLICABLE |
| EVIDENCE | CANDIDATE_LOCAL_HOSTED_PENDING |

The candidate grants only
`OPENCL_AMD_READ_ONLY_TENSOR_INPUT_RESIDENCY_CANDIDATE` and
`OPENCL_AMD_INPUT_TRANSFER_ELISION_CANDIDATE`. It does not grant output or
full-graph Tensor residency, training-step reuse, parallel execution,
wall-time/throughput improvement, VRAM reduction, generic portability, GPU
training promotion, RCL-10M, RCL-1B or K400 PASS. Hosted replay and post-merge
verification are still pending for this candidate.

Authority files:

- `examples/native-ai/gpu-opencl-tensor-residency-contract.v0.1.json`
- `examples/native-ai/gpu-opencl-tensor-residency-genome.rcl`
- `native/tensor-engine/src/bin/rcl-opencl-tensor-residency.rs`
- `examples/native-ai/evidence/gpu-opencl-tensor-residency-v0.1/k14-opencl-tensor-residency-local-evidence.json`

Reproduction: `npm run test:k14-opencl-tensor-residency` and
`npm run test:k13-opencl-buffer-arena`.
