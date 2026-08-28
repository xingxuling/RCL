# K10 AMD OpenCL batched dispatch evidence v0.1

## Ruling

`PASS_LOCAL_OPENCL_BATCHED_ADAMW_DISPATCH_CANDIDATE_PENDING_HOSTED`

RCL remains the canonical owner of Tensor, BF16, autodiff and AdamW semantics. The AMD OpenCL provider is an auxiliary lowering and transport organ. K10 adds a bounded ordered batch message to the K09 persistent session and integrates it only at the independent AdamW-update boundary. The provider still creates request-local kernel and input/output buffers; no device-buffer residency or parallel-kernel claim is made.

## Local evidence

- Real AMD OpenCL `gfx1152` session smoke passed: one individual `1x1` BF16 matmul and one two-operation batch both returned `4000` (`2.0`); every batch child root matched the individual root.
- A 65-operation request failed closed with `RCL_OPENCL_BATCH`; the declared maximum is 64.
- The two-block GQA+RoPE GPU-native backward/AdamW differential passed `3/3`; CPU loss, parameters, optimizer states and checkpoint root remained exact.
- One-step telemetry preserved `338` logical provider requests while reducing transport dispatches to `325` with one `adamw-update-v0.1` batch. This is dispatch accounting, not throughput evidence.
- Rust Tensor unit tests passed `7/7`; K08 Tensor passed `16` tests with one declared skip and no failures; the five affected K08 GPU suites passed `3/3` each; K09 persistent dispatch passed `1/1`.

## Evidence boundary

| Gate | Ruling |
|---|---|
| EXPRESS | CANDIDATE |
| COMPILE | PASS_LOCAL |
| LOWER | PASS_LOCAL_CANDIDATE |
| EXECUTE | PASS_LOCAL |
| CORRECT | PASS_LOCAL |
| ROBUST | PASS_LOCAL |
| PERFORMANCE | NOT_EVALUATED |
| AI_GENERATE | NOT_APPLICABLE |
| EVIDENCE | CANDIDATE |

The candidate grants only `OPENCL_AMD_BATCHED_ADAMW_DISPATCH_CANDIDATE`. It does not grant batched BF16 kernels, device-buffer residency, parallel execution, training throughput, generic portability, GPU training promotion, RCL-10M, RCL-1B or K400 PASS. The real RCL-10M corpus/tokenizer gate remains `BLOCKED_USER_CORPUS`.

Authority files:

- `examples/native-ai/gpu-opencl-batched-dispatch-contract.v0.1.json`
- `examples/native-ai/gpu-opencl-batched-dispatch-genome.rcl`
- `examples/native-ai/evidence/gpu-opencl-batched-dispatch-v0.1/k10-opencl-batched-dispatch-local-evidence.json`

Reproduction: `npm run test:k10-opencl-batched-dispatch` and `npm run test:k08-gpu-gqa-rope-native-backward-adamw`.
