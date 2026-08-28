# K11 AMD OpenCL gradient pair batch evidence v0.1

## Ruling

`PASS_LOCAL_AND_HOSTED_OPENCL_GRADIENT_PAIR_BATCH_CANDIDATE`

RCL remains the canonical owner of Tensor, BF16, autodiff and AdamW semantics. The AMD OpenCL provider is an auxiliary lowering and transport organ. K11 reuses the K10 bounded ordered batch message for exactly the two reverse-matmul gradient children of one GPU matmul node: `left-gradient` followed by `right-gradient`. It does not batch across nodes, change reverse traversal order, create batched kernels or retain device buffers.

## Local evidence

- Real AMD OpenCL `gfx1152` session smoke passed: individual left gradient returned `40c00000` (`6.0`), individual right gradient returned `40400000` (`3.0`), and the ordered pair returned the same child output bits and execution roots.
- The K08 GPU-native multi-block GQA+RoPE backward/AdamW differential passed `3/3`; CPU loss, parameters, optimizer states and checkpoint root remained exact.
- One-step telemetry preserved `338` logical provider requests while reducing transport dispatches to `217`; it recorded `108` gradient-pair batches plus one AdamW batch (`109` total). This is dispatch accounting, not throughput evidence.
- Rust Tensor unit tests passed `7/7`; K08 Tensor passed `16` tests with one declared skip and no failures; the affected GPU suites and K10/K09 regressions passed.

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

The candidate grants only `OPENCL_AMD_GRADIENT_PAIR_BATCHED_DISPATCH_CANDIDATE`. It does not grant cross-node batching, batched BF16 kernels, device-buffer residency, parallel execution, training throughput, generic portability, GPU training promotion, RCL-10M, RCL-1B or K400 PASS. The real RCL-10M corpus/tokenizer gate remains `BLOCKED_USER_CORPUS`.

Authority files:

- `examples/native-ai/gpu-opencl-gradient-pair-batch-contract.v0.1.json`
- `examples/native-ai/gpu-opencl-gradient-pair-batch-genome.rcl`
- `examples/native-ai/evidence/gpu-opencl-gradient-pair-batch-v0.1/k11-opencl-gradient-pair-batch-local-evidence.json`

Hosted replay for exact head `5838471265383762c858a6c4630e217c0e7eed28` passed:
K11 run `33140897123`, K10 regression `33140897173`, K09 regression
`33140897078`, Universal Stress `33140897113` (focused job `98751302182` and
Windows K01 job `98751302347`), Canonical Verification `33140897161` and
Authority `33140897104`. Post-merge main verification remains pending.

Reproduction: `npm run test:k11-opencl-gradient-pair-batch` and `npm run test:k08-gpu-gqa-rope-native-backward-adamw`.
