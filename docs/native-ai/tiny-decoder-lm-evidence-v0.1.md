# K08-J Tiny Decoder LM Evidence v0.1

## Target ruling

Admit the first bounded RCL-native decoder language-model vertical slice as:

`ENGINE_E5_TINY_DECODER_LM_CANDIDATE_GITHUB_REPLAY_BOUND`

This is a real language-model training/generation proof, not a large-model scale claim.

## Canonical ownership

RCL owns the semantic contract for:

- token IDs and bounded vocabulary identity
- token embedding path
- causal decoder model topology
- next-token probability semantics
- cross-entropy loss semantics
- reverse-mode gradient intent
- bounded training lifecycle
- autoregressive next-token generation intent

The Rust Tensor/Autodiff engine remains an execution organ. The JavaScript test/evidence harness constructs the current generic Tensor graph; self-hosted model-to-graph lowering remains a recorded gap.

## Admitted model profile

- vocabulary: `3` symbols (`A`, `B`, `C`)
- context length: `6`
- hidden size: `3`
- feed-forward width: `4`
- decoder blocks: `1`
- attention heads: `1`
- dtype: `f64`
- device: CPU
- positional profile: fixed zero reference encoding
- training corpus: `ABCABC`
- next-token targets: `BCABCA`
- optimizer for this vertical slice: `rcl.batch-sgd.v0.1`
- training steps: `80`
- learning rate: `0.08`

Trainable tensors:

`tokenEmbedding, wq, wk, wv, wo, w1, w2, lmHead`

## Full execution chain

`fixed token IDs -> one-hot -> token embedding -> decoder Transformer Block -> LM head -> logits -> Softmax -> Log -> one-hot target selection -> Sum -> Mean -> negative cross-entropy -> reverse-mode Autodiff -> Batch SGD -> trained parameters -> greedy autoregressive generation`

No GPT-, LM-, Transformer- or attention-model-special Tensor/VM opcode is used.

## Cross-entropy construction

Cross-entropy is not introduced as a special model opcode. It is composed from generic primitives:

`softmax -> log -> mul(targetOneHot, logProbabilities) -> sum(vocab axis) -> mean(sequence axis) -> mul(-1)`

This is intentionally evidence that the model family is built from general Tensor semantics rather than a hidden language-model executor.

## Hosted evidence

GitHub Actions run: `32840160638`

- Ubuntu job `97777660616`: success
- Windows job `97777660514`: success
- implementation commit: `a5bed123175a6255f0dd0fbd503d74543ddaac59`
- dedicated tests: `6 / 6` PASS on both operating systems

The Ubuntu hosted log records all six admitted gates passing.

## Acceptance results

| Gate | Result |
|---|---|
| RCL semantic genome self-host compile | PASS |
| self-host / bootstrap RBC byte parity | PASS |
| native semantic state root verification | PASS |
| generic next-token cross-entropy graph | PASS |
| all 8 trainable parameter tensors receive finite gradients | PASS |
| model-special Tensor operation count | `0` |
| bounded native training | PASS |
| loss reduction | PASS: final loss `< 75%` of initial loss |
| final cross-entropy ceiling | PASS: `< 0.55` |
| deterministic full training replay | PASS: exact frozen training root |
| greedy autoregressive generation | PASS: seed `ABCABC` continues as `ABCABC` |
| injected `gpt-special` operation | FAIL CLOSED with unsupported-operation error |

## Interpretation

The result proves that the current RCL stack can construct and execute a bounded decoder language-model lifecycle:

1. represent tokens,
2. embed them,
3. run causal attention and FFN computation,
4. produce next-token logits,
5. compute a genuine cross-entropy objective,
6. differentiate the objective through the complete graph,
7. update model parameters,
8. replay training deterministically,
9. use the trained parameters for autoregressive generation.

Therefore the remaining barrier to larger GPT-like models is no longer basic language-model computability. It is scale and execution engineering.

## Claims not granted

This evidence does not prove:

- a general tokenizer or BPE/SentencePiece-class tokenizer
- learned positional embeddings, RoPE or ALiBi
- multi-head attention
- Tensor-connected AdamW execution
- multi-layer scale beyond the frozen one-block profile
- useful natural-language quality
- large datasets
- GPU/NPU execution
- mixed precision
- DistributedTensor
- billion-parameter training
- K400 completion

## Risks / gaps

1. **Training optimizer bridge**: ENGINE-E3 proves RCL-owned AdamW semantics separately, but the current Tensor Autodiff training executor uses Batch SGD.
2. **Graph lowering ownership**: the semantic genome is RCL-owned, while JavaScript still constructs this evidence graph.
3. **Tokenizer**: the current three-symbol token mapping is intentionally bounded.
4. **Position semantics**: the first profile uses a fixed zero encoding to isolate the LM lifecycle; real sequence scale needs learned/RoPE-like general positional semantics.
5. **Scale**: CPU f64 and one block are verification choices, not production architecture limits.

## Next development order

`Tensor AdamW bridge -> general tokenizer/byte tokenizer -> positional genome (RoPE candidate) -> multi-head attention -> multi-block Tiny LM -> GPU backend -> mixed precision -> DistributedTensor -> scale campaigns`

## Rollback

K08-J is additive. Revert the campaign PR to remove the candidate. Existing compiler, VM, Tensor, Autodiff, Optimizer and K08-I Transformer behavior is not altered.
