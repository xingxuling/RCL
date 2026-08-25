# K08-Q Mixed Precision Evidence v0.1

## Ruling

`MIXED_PRECISION_REFERENCE_CANDIDATE_GITHUB_REPLAY_BOUND`

This milestone admits bounded canonical BF16 storage/compute semantics with FP32 accumulation through a portable CPU reference organ. It establishes a correctness oracle for later accelerator backends. It does **not** grant GPU execution, CUDA/Vulkan/Metal execution, BF16 Autodiff training, RCL-10M, DistributedTensor, or RCL-1B completion.

## Hosted replay

Implementation run `32850137410`, source commit `8fb85604a15973708fe91f5886672773bfa11825`:

- Ubuntu job `97808869047`: 10/10 PASS
- Windows job `97808868747`: 10/10 PASS

Promoted-contract replay `32852499964`, source commit `bc55205b58bbb25c3da09b778ab44ab2492d43dd`:

- Ubuntu job `97816495373`: 10/10 PASS
- Windows job `97816495343`: 10/10 PASS

Final bound-contract replay `32852655930`, source commit `b73fb4c5b33f72aa4c9d5177ba97d79ebef5dadd`:

- Ubuntu job `97817006839`: 10/10 PASS
- Windows job `97817006577`: 10/10 PASS

## Frozen mixed-precision policy

- parameter compute dtype: BF16
- activation compute dtype: BF16
- MatMul accumulation dtype: FP32
- reduction accumulation dtype: FP32
- Softmax compute dtype: FP32
- normalization compute dtype: FP32
- optimizer state dtype: FP32
- master-weight dtype: FP32
- BF16 conversion: round-to-nearest, ties-to-even
- non-finite reference inputs: fail closed
- accelerator fallback: forbidden

The CPU reference organ is a correctness oracle. It is not an accelerator and may not satisfy any GPU claim.

## What is proven

1. The RCL mixed-precision semantic genome self-hosts with byte-identical bootstrap/native RBC and strict native semantic-state-root verification.
2. Known BF16 values have exact expected 16-bit payloads and dequantized values.
3. BF16 conversion uses round-to-nearest, ties-to-even, including explicit even/odd tie probes.
4. BF16 storage identity is deterministic and roots shape plus exact BF16 bit payload plus policy identity.
5. BF16 MatMul with FP32 accumulation agrees bit-for-bit with an independent JavaScript bit-level oracle in the frozen profile.
6. BF16 add and multiply agree bit-for-bit with the independent oracle.
7. BF16 MatMul drift remains inside the frozen numerical envelope relative to an f64 oracle.
8. Invalid matrix geometry and values that overflow finite f32 representation fail closed.
9. Requests for `cuda`, `vulkan`, or `metal` fail with `RCL_ACCELERATOR_BACKEND_UNAVAILABLE`; they never silently fall back to CPU.
10. The semantic genome retains the RCL-1B target geometry as structural compatibility only; no 1B or hardware execution claim is granted.

## Evidence boundary

The admitted path is intentionally small:

`f64 input fixture -> canonical f32 conversion -> BF16 RNE bits -> BF16 operand values -> FP32 accumulation -> BF16 output bits`

This is sufficient to freeze the numerical contract before hardware-specific lowering. It is not yet a full mixed-precision Tensor graph runtime.

## Hardware honesty

There is currently no accepted real GPU runner in this repository evidence chain. CPU reference execution, software rendering, llvmpipe, or any host without independently evidenced accelerator identity cannot satisfy `GPU`, `CUDA`, `VULKAN_GPU`, or equivalent claims.

Future accelerator admission must preserve this CPU-reference contract through differential evidence and must record the actual device/backend identity.

## Boundary retained

Not granted by this evidence:

- BF16 Reverse Autodiff graph execution
- BF16/FP32 mixed-precision AdamW training
- multi-block BF16 training
- dynamic loss scaling
- fused/packed attention kernels
- GPU / CUDA / Vulkan GPU / Metal accelerator execution
- accelerator memory telemetry
- DistributedTensor
- RCL-10M / 100M / 300M / 1B
- K400 promotion

## Next

Two immediate closure tasks remain before the first RCL-10M attempt:

1. bind multi-block Tensor AdamW replay on the admitted f64 model chain;
2. extend the mixed-precision contract from isolated operations to BF16 forward/backward graph execution with FP32 gradients/master weights.

Real GPU evidence is then a backend admission problem rather than an unresolved numerical-semantics problem.
