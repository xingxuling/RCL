# K18 AMD OpenCL full-graph and training-step residency evidence v0.1

## Current ruling

`PASS_LOCAL_AND_HOSTED_AND_POSTMERGE_OPENCL_TENSOR_TRAINING_GRAPH_RESIDENCY_CANDIDATE`

K18 extends the RCL-owned ordered generic Tensor graph with a bounded
`matmul -> add -> additive masked-softmax` graph reused for three forward
steps. Each graph node allocates one ephemeral OpenCL output resource and
reuses it across all steps. Intermediate readback is forbidden; the final
node performs exactly one readback after the final step. RCL owns Tensor,
graph, operation, mask, numeric and step semantics. The AMD OpenCL provider
owns only auxiliary `cl_mem` allocation, argument binding and ordered
dispatch. Reverse-mode Autodiff and AdamW remain RCL CPU/reference semantics
and are intentionally outside this candidate.

This is real local AMD execution with exact BF16 CPU differential and
deterministic replay, plus exact-head hosted and merged-main workflow replay.
It is not GPU training, GPU-native Autodiff/AdamW, production Transformer
training, throughput, VRAM, portability or K400 promotion.

## Local evidence

- Device: AMD `gfx1152`, platform `AMD Accelerated Parallel Processing`,
  OpenCL `2.0 AMD-APP (3661.0)`, driver `3661.0 (PAL,LC)`.
- Fixture: three-node `[1,2]` graph (`matmul -> add -> additive
  masked-softmax`), three repeated forward steps, BF16 storage, FP32
  arithmetic and BF16 round-to-nearest-even output.
- Exact output bits: `3f00 3f00`; execution root:
  `564c6e5bd85b47a3b1ad776fc26060d732e5b1d5948bb0afbf815a674299369b`.
- CPU differential and deterministic replay passed. Intermediate readback is
  `0`; final readback is `1`.
- Each of the three node resources reports residency across all three steps
  and reuse across all three steps. Telemetry records 9 dispatches, 7
  allocations/releases, 4 Tensor binds, 4 host-to-device transfers and one
  device-to-host transfer; `trainingStepResidency=true` and
  `resourceReuseAcrossSteps=true`.
- Local K18, K17, K16 and K15 suites are each `3/3 PASS`; Python syntax,
  Rust formatting, locked cargo check, Node syntax and `git diff --check`
  passed. Provider fallback is forbidden.
- Negative controls fail closed for unknown operation
  (`RCL_K18_GRAPH_OPERATION`), zero steps (`RCL_K18_GRAPH_STEPS`),
  intermediate readback (`RCL_K18_GRAPH_READBACK`) and shape drift
  (`RCL_K18_GRAPH_SHAPE`). The bounded contract allows at most 8 nodes and
  16 steps.

## No Silent RCL Bypass ruling

| Field | Ruling |
|---|---|
| Task | K18 bounded full-graph/training-step resource residency |
| Missing capability | Reuse a generic ordered Tensor graph's device resources across repeated steps while preserving RCL Tensor identity and final-readback gates |
| Prior workaround | K17 retained an ordered mixed graph, but only for one forward execution and did not prove resource reuse across repeated steps |
| Donor | Existing RCL Tensor/graph semantics, K13 arena, K14 Tensor residency, K15 graph residency and K16 masked-softmax lowering |
| Gap type | Backend / lowering / graph-residency integration gap |
| Generality | Cross-model generic Tensor forward graphs |
| Candidate absorption | RCL-owned K18 contract/genome, explicit per-node resource lifetime, bounded step count, one final readback, exact BF16 differential and fail-closed operation/shape/readback gates |
| K400 impact | K233 performance and future scale evidence only; matrix remains `23/400` |

## Evidence boundary

| Gate | Ruling |
|---|---|
| EXPRESS | CANDIDATE |
| COMPILE | PASS_LOCAL |
| LOWER | PASS_LOCAL_CANDIDATE |
| EXECUTE | PASS_LOCAL_REAL_AMD |
| CORRECT | PASS_LOCAL_EXACT_BF16_BITS_AND_CPU_DIFFERENTIAL |
| ROBUST | PASS_LOCAL_FAIL_CLOSED_OPERATION_STEP_SHAPE_AND_READBACK |
| PERFORMANCE | DEVICE_RESIDENCY_AND_TRANSFER_TELEMETRY_ONLY_NO_THROUGHPUT_OR_VRAM_CLAIM |
| AI_GENERATE | NOT_APPLICABLE |
| EVIDENCE | CANDIDATE_HOSTED_AND_POSTMERGE_K18_SCOPE |

Only `OPENCL_AMD_FULL_GRAPH_RESIDENCY_CANDIDATE`,
`OPENCL_AMD_TRAINING_STEP_RESOURCE_REUSE_CANDIDATE` and
`OPENCL_AMD_GRAPH_ADD_CANDIDATE` are granted. GPU training, GPU-native
Autodiff/AdamW, full-graph training semantics, parallel execution, throughput,
VRAM reduction, portability, RCL-10M/RCL-1B and K400 completion remain closed.

## Hosted and post-merge boundary

Implementation commit `251613f3b78efb255e778eaf307d25a1a082cf8f` passed exact
head K18 on Ubuntu and Windows in PR #138 (`33896733771`, jobs
`101101018227` and `101101018475`); its K08 AMD, K09-K17, Authority,
Canonical and Universal regression runs were also successful. PR #138 merged
as `main@87a300130fc52559b005c15d88d5743a5f55d671`.

After the follow-up AI001 merge, K18 post-merge replay passed on
`main@b7e4c70839cb5ef896807a77b5e5f88082155be0`: K18 run `33899325135`
passed Ubuntu job `101109415949` and Windows job `101109415327`, with K09-K17
and Authority green. That historical replay recorded three self-Akashic scan
failures and a separate Windows K01 budget failure; neither involved K18.
AI002 repair #139 then fixed the bounded self-Akashic scan ordering/cap and
passed the current repository gates on final head
`3fdc95509999f071f15d8764d9a90c014759a3ef`: K18 workflow `33900738676`,
Canonical `33900738417` and Universal `33900738302` all succeeded. The
self-Akashic suite is now `4/4 PASS`, with a bounded 2,000-file scan ordered
as `src`, `docs`, `tests`, `examples`; the earlier failures are therefore
historical, not current-main failures. Evidence-only PR #141 subsequently
merged as `main@14f3aa957d2c4eec787a53099453873073ed480c` with its repository
checks green. Hosted runners prove repository replay or explicit
unavailable-backend fail-closed behavior; they do not inherit the local AMD
device receipt.

## Authority files

- `examples/native-ai/gpu-opencl-tensor-training-graph-residency-contract.v0.1.json`
- `examples/native-ai/gpu-opencl-tensor-training-graph-residency-genome.rcl`
- `native/tensor-engine/amd_opencl_bf16_provider.py`
- `native/tensor-engine/src/bin/rcl-opencl-tensor-residency.rs`
- `tests/k18-opencl-tensor-training-graph-residency.test.mjs`
- `examples/native-ai/evidence/gpu-opencl-tensor-training-graph-residency-v0.1/k18-opencl-tensor-training-graph-residency-local-evidence.json`

Reproduction: `npm run test:k18-opencl-tensor-training-graph-residency`.
