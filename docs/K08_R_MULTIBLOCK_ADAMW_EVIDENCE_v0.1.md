# K08-R Multi-Block AdamW Evidence v0.1

## Ruling

`MULTI_BLOCK_ADAMW_CANDIDATE_GITHUB_REPLAY_BOUND`

This milestone admits bounded two-block GQA+RoPE next-token training through the existing generic Tensor Reverse Autodiff + AdamW path on the frozen CPU-f64 profile. It proves that fourteen trainable parameter groups can be updated with fourteen independently bound optimizer states and resumed bit-exactly across a checkpoint boundary.

It does **not** grant BF16 Autodiff training, mixed-precision multi-block training, GPU/CUDA/Vulkan/Metal execution, RCL-10M, DistributedTensor, RCL-1B completion, or K400 promotion.

## Hosted replay chain

Implementation replay `32862241167`, source commit `4a4417d974203de3a383ab62c17909ddb9ae80dc`:

- Ubuntu job `97848821949`: 8/8 PASS
- Windows job `97848821657`: 8/8 PASS

Promoted-contract replay `32862691677`, source commit `9b15118a76510a73a6cbe3e28c8a46b98bfb41e2`:

- Ubuntu job `97850321833`: 8/8 PASS
- Windows job `97850322009`: 8/8 PASS

Final bound-contract replay `32862875004`, source commit `5bd05f5c8e7d50249f1fba5e432cc78350380ddc`:

- Ubuntu job `97850942098`: 8/8 PASS
- Windows job `97850942364`: 8/8 PASS

The hosted replay chain followed three failed diagnostic rounds that exposed and closed two distinct checkpoint authority defects:

1. ordinary JSON decimal materialization was insufficient as continuation authority for f64 parameters and AdamW moments, so exact f64 bit payloads were introduced;
2. resume validation reordered optimizer states lexicographically while fresh training preserved the RCL parameter order, so state order was rebound to the canonical `request.parameters` order.

No acceptance threshold was weakened during repair.

## Frozen model and optimizer profile

- decoder blocks: 2
- sequence length: 3
- vocabulary size: 4
- hidden size: 4
- FF size: 5
- query heads: 2
- KV heads: 1
- head dimension: 2
- position encoding: RoPE
- attention: GQA
- dtype: f64
- device: CPU
- optimizer: AdamW
- trainable parameter groups: 14
- optimizer state groups: 14
- continuation rule: direct N steps must equal checkpoint K + resume N-K exactly

## What is proven

1. The K08-R semantic genome self-hosts with byte-identical RBC and a native semantic-state root.
2. The two-block graph exposes fourteen unique trainable parameter identities.
3. Generic Tensor Reverse Autodiff + AdamW updates all fourteen parameter groups.
4. Every trainable parameter owns one finite, identity-bound AdamW state.
5. The frozen two-block next-token loss decreases under AdamW training.
6. Direct continuation and checkpoint+resume produce exactly identical parameters.
7. Direct continuation and checkpoint+resume produce exactly identical first/second moments, including exact f64 bit payloads.
8. Direct continuation and checkpoint+resume produce the same checkpoint root and final loss.
9. Repeated frozen CPU-f64 training is deterministic.
10. Malformed optimizer-state shape/binding fails closed.
11. No model-special optimizer opcode is introduced; training remains generic Tensor Autodiff + AdamW.
12. The promoted contract and the replay-bound contract both independently reproduce 8/8 PASS on Ubuntu and Windows.

## Canonical continuation authority

Checkpoint continuation authority is not ordinary JSON decimal text. The admitted path carries exact f64 bit payloads for:

- trainable parameter storage through `exactStorageBits`;
- AdamW first moments through `exactFirstMomentBits`;
- AdamW second moments through `exactSecondMomentBits`.

On resume, exact bit payloads are materialized before the next backward/update step.

Optimizer-state ordering is also canonical: state receipts follow the RCL `request.parameters` order rather than caller order or host-language lexical ordering.

## Evidence boundary

The admitted path is intentionally bounded:

`2-block GQA+RoPE Tensor graph -> Reverse Autodiff -> fourteen gradients -> AdamW -> exact checkpoint -> exact resume`

This closes the multi-block optimizer lifecycle for the frozen CPU-f64 model chain. It is not evidence for large-vocabulary, long-context, mixed-precision, accelerator, or distributed training.

## Claims not granted

- BF16 Reverse Autodiff training
- mixed-precision AdamW training
- multi-block BF16 training
- dynamic loss scaling
- GPU / CUDA / Vulkan GPU / Metal
- accelerator memory/performance claims
- production-scale vocabulary/context
- RCL-10M / 100M / 300M / 1B
- DistributedTensor / distributed training
- K400 promotion

## Evidence Ledger

- semantic genome: `examples/native-ai/multiblock-adamw-genome.rcl`
- contract: `examples/native-ai/multiblock-adamw-contract.v0.1.json`
- optimizer organ: `native/tensor-engine/src/bin/rcl-tensor-adamw.rs`
- tests: `tests/k08-multiblock-adamw.test.mjs`
- workflow: `.github/workflows/k08-multiblock-adamw.yml`
- implementation run: `32862241167`
- implementation source commit: `4a4417d974203de3a383ab62c17909ddb9ae80dc`
- implementation Ubuntu job: `97848821949`
- implementation Windows job: `97848821657`
- promoted-contract replay: `32862691677`
- promoted source commit: `9b15118a76510a73a6cbe3e28c8a46b98bfb41e2`
- promoted Ubuntu job: `97850321833`
- promoted Windows job: `97850322009`
- final bound-contract replay: `32862875004`
- final source commit: `5bd05f5c8e7d50249f1fba5e432cc78350380ddc`
- final Ubuntu job: `97850942098`
- final Windows job: `97850942364`

## Next

The next immediate closure is **BF16 Autodiff + FP32 gradient/master-weight AdamW**, followed by multi-block mixed-precision training. Real GPU admission remains a separate hardware-evidence problem.