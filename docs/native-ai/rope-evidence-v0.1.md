# K08-N RoPE Evidence v0.1

Status: `ROPE_GENOME_CANDIDATE_GITHUB_REPLAY_BOUND`

## Target ruling

Admit pairwise Rotary Position Embedding semantics and their generic Tensor lowering for the RCL-1B model path. RoPE is not introduced as a Transformer-special VM/Tensor operation.

## Canonical semantics

- Canonical owner: RCL.
- Pairing: adjacent even/odd head dimensions.
- Angle: `theta(position,pair)=position/base^(2*pair/headDimension)`.
- Default base: `10000`.
- Head dimension must be positive and even.
- Position zero is identity.
- Each 2D pair rotation preserves squared norm.
- Tensor lowering: `x*cos + matmul(x, fixedPairRotationMatrix)*sin`.

The native f64 position-frame organ materializes trigonometric tables. The model graph itself uses only existing generic Tensor `matmul`, `mul`, and `add`, so existing reverse-mode Autodiff differentiates through RoPE without a new backward rule.

## Hosted evidence

Run `32847032779`, source commit `d6404e53c4ed64ca49e47be0757d7e8d4a95b71d`:

- Ubuntu `97799011477`: 7/7 PASS.
- Windows `97799011150`: 7/7 PASS.

## Evidence coverage

1. `rope-genome.rcl` self-host/bootstrap RBC byte parity and strict native semantic-state-root verification.
2. Rooted position frame agrees with an independent JavaScript implementation of the angle formula; position zero has exact cos=1/sin=0 identity.
3. Generic Tensor `matmul/mul/add` lowering matches direct pairwise RoPE and preserves each pair norm.
4. Reverse-mode gradient through the generic RoPE graph agrees with central finite difference (`< 2e-9` bound in the frozen fixture).
5. RoPE Q/K values compose into attention score calculation using generic Tensor operations.
6. Odd head dimension, zero sequence length, invalid base and position-range overflow fail closed.
7. Injecting a `rope-special` Tensor operation fails with `RCL_TENSOR_OPERATION_UNSUPPORTED`.

## Position-frame identity

`frameRoot` is derived from the semantic frame descriptor (sequence length, head dimension, exact base f64 bits, position offset, pairing and angle/lowering identity), rather than claiming bit-identical transcendental outputs across every future backend. Numerical table outputs are checked by bounded differential evidence.

## Claims granted

- `ROPE_POSITIONAL_SEMANTICS`
- `ROOTED_ROPE_POSITION_FRAME`
- `GENERIC_TENSOR_ROPE_LOWERING`

## Claims explicitly closed

- multi-head attention
- GQA
- multi-block LM scale
- RCL-10M
- BF16/GPU/distributed execution
- RCL-1B completion
- K400 promotion

## Next absorption

Generalize the one-head decoder into parametric multi-head/GQA composition. RoPE should be applied independently inside Q/K head dimensions while the same position-frame semantics remain unchanged.