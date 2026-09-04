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

Local evidence receipt root: `abda0f6e083dbb3a5737c64f24e22b80a5f2ae62caa990787908d18fc1255c84`.
The implementation source commit bound by that receipt is
`ff96b1809c75ce47a8a15f18b50b757f00f96a32`.
