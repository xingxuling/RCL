# K08-O GQA Evidence v0.1

## Ruling

`GQA_GENOME_CANDIDATE_GITHUB_REPLAY_BOUND`

This evidence admits bounded CPU-f64 multi-head / grouped-query attention composition on the existing RCL Tensor + Reverse Autodiff + RoPE substrate. It does not grant multi-block scale, RCL-10M, accelerator execution, distributed training, or RCL-1B completion.

## Hosted replay

Implementation run `32847865516`:

- source commit: `bd6feb5c32ece78e97655360caef52e01ece7963`
- Ubuntu job `97801676252`: 8/8 PASS
- Windows job `97801676519`: 8/8 PASS

Promoted-contract replay `32848050472`:

- source commit: `9600bc963fc3ca808b78445af9105c1f0c10ee33`
- Ubuntu job `97802252376`: 8/8 PASS
- Windows job `97802252014`: 8/8 PASS

## Frozen executable profile

- sequence length: 3
- hidden width: 4
- query heads: 2
- KV heads: 1
- head dimension: 2
- queries per KV head: 2
- dtype/device: CPU f64
- RoPE: K08-N rooted position frame applied independently inside each Q/K head

The same profile validator also admits the target RCL-1B head geometry:

- Q heads: 16
- KV heads: 4
- head dimension: 128
- hidden width: 2048
- queries per KV head: 4

This is a structural compatibility claim only; it is not a 1B execution claim.

## Evidence results

1. RCL GQA semantic genome self-hosts with byte-identical bootstrap/native RBC and strict native semantic-state-root verification.
2. 2Q/1KV forward agrees with an independent JavaScript oracle.
3. Both Q heads consume the same K/V storage path under the frozen GQA mapping.
4. RoPE is applied separately to each Q head and the shared K head before score matmul.
5. Causal softmax is computed independently for every query head.
6. `wq`, `wk`, `wv`, `wo` all receive finite reverse-mode gradients.
7. Selected analytic gradients agree with central finite difference.
8. Valid MHA/GQA/RCL-1B geometry is admitted while invalid head counts, incompatible hidden width, and odd head dimensions fail closed.
9. Model-special Tensor operation injection is rejected.

## Lowering boundary

The accepted path introduces no `gqa-special`, `multihead-special`, or Transformer-only VM opcode.

Head extraction and merge use generic selector/embedder matrices:

`hidden -> matmul(selector) -> head`

`head -> matmul(embedder) -> hidden`

Per-head attention remains generic:

`Q/K projection -> RoPE(matmul/mul/add) -> QK^T -> scale -> causal mask -> softmax -> V -> embedder -> add -> Wo`

This is intentionally not the final performance representation. Future 3D/4D packed-head Tensor kernels may replace selector/embedder execution as an optimized backend organ, provided differential parity with this canonical composition is retained.

## Boundary retained

Not granted by this evidence:

- packed 3D/4D head Tensor semantics
- fused attention
- FlashAttention
- multi-block decoder training
- final 16Q/4KV large-model runtime performance
- BF16/FP16
- GPU/NPU
- DistributedTensor
- RCL-10M / 100M / 300M / 1B
- K400 promotion
