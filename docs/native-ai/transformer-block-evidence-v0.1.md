# K08-I Transformer Block Evidence v0.1

## Target ruling

Admit the first RCL-owned decoder Transformer Block as an `ENGINE_E4_DECODER_BLOCK_CANDIDATE_GITHUB_REPLAY_BOUND` capability.

This ruling does **not** admit Tiny LM, multi-head attention, Tensor AdamW execution, accelerator lowering, distributed training or K400 promotion.

## Product / architecture boundary

RCL owns the model topology, causal visibility invariant and capability boundary. The existing generic Tensor SSA and reverse-mode Autodiff organs execute the numerical graph.

The admitted vertical slice is:

`RMSNorm -> Q/K/V linear -> scaled dot-product causal attention -> Softmax -> output projection -> residual -> RMSNorm -> SiLU-composed FFN -> residual -> scalar differential loss -> reverse-mode Autodiff`

No Transformer-, GPT-, attention-model- or decoder-special VM/Tensor opcode is introduced.

The first admitted fixture is intentionally bounded to `sequenceLength=3`, `hiddenSize=2`, `feedForwardSize=3`, `headCount=1`, f64 CPU execution. Single-head admission proves the decoder-block semantic composition only; multi-head composition remains explicitly unclaimed.

## Impacted modules

- `examples/native-ai/transformer-block-genome.rcl`
- `examples/native-ai/transformer-block-contract.v0.1.json`
- `tests/k08-transformer-block.test.mjs`
- `.github/workflows/k08-transformer-block.yml`

No existing compiler, VM or Tensor backend production source was modified in this campaign.

## Hosted evidence

Accepted GitHub Actions run: `32839361085`

- Ubuntu job: `97775227517` — success
- Windows job: `97775227665` — success
- Evidence implementation commit: `723628b8337b498cae0227e9b92650363ab3557e`

Both jobs passed native compiler/VM build and all six K08-I tests.

## Acceptance evidence

| Gate | Result |
|---|---|
| RCL self-host compiler | PASS |
| Self-host / bootstrap RBC byte parity | PASS |
| Native semantic state root | PASS |
| Causal visibility invariant | PASS |
| Generic Tensor forward execution | PASS |
| Independent forward oracle | PASS, max asserted drift `<= 1e-12` |
| Causal future probability suppression | PASS, asserted `< 1e-7` in the fixture |
| Reverse-mode Autodiff | PASS |
| Gradient connectivity | PASS for `wq`, `wk`, `wv`, `wo`, `w1`, `w2` |
| Finite-difference gradient probes | PASS, first element of every parameter asserted `<= 2e-5` drift |
| Gradient accumulation | PASS; merge path exercised |
| Deterministic replay | PASS, three identical loss/gradient roots |
| Invalid causal-mask shape | FAIL CLOSED with `RCL_TENSOR_BROADCAST_INVALID` |
| Model-special operation injection | FAIL CLOSED with `RCL_TENSOR_OPERATION_UNSUPPORTED` |
| Model-special executable operations | `0` |

## General primitives exercised

- `matmul`
- `transpose`
- `add`
- `sub`
- `mul`
- `div`
- `reshape`
- `broadcast`
- `mean`
- `sqrt`
- `activation(kind=sigmoid)`
- `softmax`

SiLU is composed from `x * sigmoid(x)`. RMSNorm is composed from generic square/mean/add/sqrt/broadcast/div operations rather than requiring a Transformer-specific reverse rule. The causal mask is ordinary Tensor data, not a model-special opcode.

## Failure / repair log

The first hosted run `32839221894` reached 5/6 passing tests on Ubuntu. The sole failure was an anti-specialization assertion that incorrectly matched the *evidence string* `NO_TRANSFORMER_SPECIAL...` in the RCL semantic source. It did not expose an executable special opcode. The evidence wording was normalized to `NO_MODEL_SPECIALIZED_TENSOR_OR_VM_OPCODE`; no numerical or execution semantics changed. The second hosted run passed on both operating systems.

## Known gaps

1. Graph construction is still performed by a JavaScript evidence/lowering organ; self-hosted RCL ownership of the complete Tensor/Autodiff graph construction remains open.
2. Multi-head attention is not admitted.
3. Cross-entropy and token/embedding language-model lifecycle are not admitted by this candidate.
4. The ENGINE-E3 Optimizer Genome is semantically admitted separately, but this Transformer slice does not yet connect Tensor gradients to a Tensor AdamW execution organ.
5. GPU/NPU and DistributedTensor are not admitted.

## Next integration order

`Tensor AdamW bridge or bounded SGD training -> token/embedding + cross-entropy -> Tiny Decoder LM -> autoregressive generation -> multi-head / scale-up -> accelerator`

## Rollback

The campaign is additive-only. Rollback is a revert/removal of the four K08-I files. No existing compiler/VM/Tensor backend behavior needs restoration.
