# K08-K Tensor AdamW Bridge Evidence v0.1

## Ruling

`ENGINE_E3_TENSOR_ADAMW_BRIDGE_CANDIDATE_GITHUB_REPLAY_BOUND`

This candidate closes the execution gap between the RCL-owned K08-H AdamW semantics and generic Tensor parameters produced by RCL native reverse-mode Autodiff. It does not change Tensor, Autodiff, Transformer or LM semantics.

## Execution path

```text
RCL model / generic Tensor graph
-> native reverse-mode Autodiff
-> parameter GradientIdentity bindings
-> rcl.adamw.v0.1 state/update contract
-> Rust Tensor AdamW execution organ
-> content-addressed Tensor parameter storages
```

The Rust binary is `native/tensor-engine/src/bin/rcl-tensor-adamw.rs`. It accepts `rcl.tensor-autodiff-adamw-training-request.v0.1` and emits parameters, first/second moments, step identity, checkpoint root and final graph outputs.

## Optimizer semantics

The bridge preserves the K08-H reference rules:

- elementwise symmetric gradient clipping;
- first moment `m_t = beta1*m_(t-1) + (1-beta1)*g_t`;
- second moment `v_t = beta2*v_(t-1) + (1-beta2)*g_t^2`;
- bias correction;
- Adam direction `m_hat / (sqrt(v_hat) + epsilon)`;
- decoupled AdamW decay `p*(1-lr*weightDecay) - lr*direction`;
- one optimizer state per Tensor parameter with common step identity.

No MLP, Transformer, GPT or LM-specific optimizer operation exists.

## Positive / differential evidence

The frozen scalar Optimizer Genome fixture is executed through the Tensor bridge with initial parameter `1`, gradient `0.5`, `lr=0.01`, `beta1=0.9`, `beta2=0.999`, `epsilon=1e-8`, `weightDecay=0.1`, `gradientClip=1`.

After two Tensor AdamW steps the focused suite verifies:

- parameter: `0.9780110003998002` within `1e-12`;
- first moment: `0.09499999999999997` within `1e-15`;
- second moment: `0.0004997500000000004` within `1e-15`;
- step: `2`.

These are the values frozen by `optimizer-genome-contract.v0.1.json`.

## Checkpoint / resume evidence

Two uninterrupted Tensor AdamW steps are compared with:

```text
1 step
-> materialize trained Tensor storage + optimizer state
-> reload
-> 1 step
```

The final parameter objects, optimizer states and checkpoint root are exactly identical. No tolerance is used for the resume ruling.

## Tiny Decoder LM bridge evidence

The K08-J decoder LM topology is rebuilt with the same eight trainable Tensor families:

`tokenEmbedding, wq, wk, wv, wo, w1, w2, lmHead`.

The bridge runs 80 AdamW steps on the bounded `ABCABC -> BCABCA` next-token corpus with `lr=0.03`, `weightDecay=0.01`; the focused suite requires and observes:

- final next-token cross-entropy below 75% of initial loss;
- every trainable parameter changes;
- every first/second-moment tensor remains finite;
- every optimizer state reaches step 80;
- a second independent run produces exactly the same checkpoint root, loss values, parameters and optimizer states;
- trained parameters still greedily continue the seed `ABCABC` as token IDs `[0,1,2,0,1,2]`.

This establishes that AdamW is connected to a real decoder-LM training graph rather than only to the scalar fixture.

## Negative / boundary evidence

The suite fails closed for:

- `beta1 == 1` (`RCL_ADAMW_BETA1`);
- optimizer-state shape mismatch (`RCL_ADAMW_STATE_SHAPE`);
- missing/duplicate state bindings, inconsistent steps, non-finite state and invalid hyperparameters in the execution organ;
- parameter storage aliasing;
- unavailable gradients or parameter storage.

The request also retains the Autodiff graph work ceiling and finite-update checks.

## Hosted replay

Admitted implementation replay:

- workflow run: `32842406995`;
- implementation source commit: `3adfe72e00897ea543737b6e6662ab880824c37b`;
- Ubuntu job: `97784604949` — PASS;
- Windows job: `97784604602` — PASS;
- focused tests: `7/7` on both platforms.

## Failure / repair ledger

Initial run `32842289192` failed on both hosts only at the semantic-source state-root assertion. The Tensor AdamW arithmetic, scalar parity, checkpoint/resume, Tiny LM training, generation, determinism and negative controls passed (`6/7` on Ubuntu before repair).

Root cause: exporting the runtime value `1e-8` as a final RCL state facet re-exposed the already registered cross-runtime scientific-number root formatting gap (`RCL_GAP_AI_010`). The repair did **not** disable root verification or alter epsilon. The semantic genome now preserves the epsilon expression identity (`1/100000000`) while using the exact numeric value inside the validity computation without exporting that sub-micro number into the final semantic state. Strict native semantic-root verification then passes.

## Claims granted

- bounded CPU-f64 `TENSOR_ADAMW_BACKEND` candidate;
- Tensor parameter + Autodiff gradient + optimizer-state lifecycle;
- exact bounded checkpoint/resume parity;
- K08-J Tiny LM can train through AdamW rather than Batch SGD.

## Claims not granted

This evidence does not establish tokenizer/BPE, RoPE, multi-head/GQA, multi-block scale, RCL-10M, BF16, GPU/NPU, DistributedTensor, RCL-1B completion, competitive training throughput or K400 promotion.
