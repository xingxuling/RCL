# AI001 — Self-hosted Tensor shape-semantics candidate

Status: `LOCAL_SELFHOST_TYPED_TENSOR_SHAPE_SEMANTICS_CANDIDATE`.

This candidate closes a bounded RCL-owned admission slice for typed Tensor
descriptors and generic shape relationships. It executes the RCL genome through
the self-hosted compiler and native VM, then requires native semantic-root
verification.

RCL owns:

- Tensor descriptor identity, positive dimensions and exact element counts;
- row-major stride identity, dtype policy, layout and device-intent agreement;
- ordered input references and unique Tensor/operation identities;
- right-aligned broadcast shape derivation;
- matrix multiplication shared-dimension and output-shape rules;
- rank-2 transpose, reshape and axis-reduction output-shape rules; and
- root-bound manifest admission before a backend can consume the graph.

The candidate does not claim numerical kernel execution, storage allocation,
alias safety, device placement, GPU execution or canonical promotion. Those
remain backend/runtime or later RCL compiler work and stay explicit in the GAP
register.

## Reproduction

```text
npm run test:selfhost-tensor-shape-semantics
npm run evidence:selfhost-tensor-shape-semantics
```

Authority files:

- `examples/native-ai/tensor-shape-semantics-genome.rcl`
- `examples/native-ai/tensor-shape-semantics-contract.v0.1.json`
- `src/selfhost-tensor-shape-semantics.mjs`
- `tests/selfhost-tensor-shape-semantics.test.mjs`
- `examples/native-ai/evidence/tensor-shape-semantics-v0.1/ai001-tensor-shape-semantics-local-evidence.json`

The evidence is a candidate receipt only. It does not promote `RCL_GAP_AI_001`
to canonical Core or close the remaining Tensor backend and scale gates.

Local evidence receipt root: `f7e9ffdd96412791363ba2cc8e619bb967429f84877ef7bbefe6e72425a919b1`.
The implementation source commit bound by that receipt is
`1ababfaba826a36904fe2ad859634ddee053e8ee`.
