# K08-B Native AI Integration Court

**Court state:** `ADMIT_AI_N2_CANDIDATE_GITHUB_REPLAY_REQUIRED`

**Canonical owner:** RCL

**Execution path:** `.rcl -> native rclc/compiler.rbc -> RBC -> native rclvm`

**Independent AI receipt:** `3/3 LOCAL CANDIDATE`, not yet repository-authoritative

## Decision

Admit the bounded two-Dense-layer General MLP profile as an RCL-owned AI-N2 candidate. Do not promote K233 or start Tensor Genome promotion until the saved independent-generator edits pass the GitHub-hosted replay step.

The admitted semantics are:

- tagged `Model`, `Layer`, `Parameter`, `Activation`, `Loss`, `Optimizer`, `Dataset` and `Checkpoint` values;
- shape and dataset validation;
- generic-width dense forward propagation;
- generic-width analytic backpropagation for the bounded two-layer profile;
- Batch SGD;
- exact checkpoint resume;
- inference and binary supervised evaluation.

No Tensor, arbitrary computation graph, Autodiff, Adam/AdamW, Transformer, accelerator or distributed claim is admitted.

## Multi-civilization gates and their engineering effect

| Gate | Question | Concrete effect |
|---|---|---|
| Founder Twin | Does this extend the long-term AI mother stack rather than one demo? | Required explicit reusable model/data/optimizer/checkpoint constructors and two different topologies. |
| 柳清莲 Gate | Who may promote evidence? | Kept `AI_GENERATE` at `CANDIDATE`; the implementation session cannot self-sign PASS. |
| 洞哥 Grounding | Did RCL really execute the learning math? | Required native compiler, native VM, zero provider opcodes, three state-root-identical replays and JS oracle isolation. |
| Product | Is there a reusable user-facing capability? | One General MLP profile trains XOR and Majority-3 through the same primitives. |
| UX | Can another engineer reproduce the result? | Added stable package commands, focused tests and readable rooted receipts. |
| Engineering | Is the boundary maintainable? | Kept Tensor/accelerator work out of the current core and added no VM opcode. |
| Code | Is topology encoded as data rather than branches? | Layer widths, weights, biases and activations live in tagged RCL values; no `xor_special` or topology opcode exists. |
| Test | Can errors fail closed? | Added invalid-shape, invalid-dataset, deterministic, resume, differential and second-task checks. |
| Security | Can the generator alter the authority repo or tests? | Independent Codex sessions run ephemeral/read-only and return only Schema-bounded exact edits. |
| Release | Can CI replay without model credentials? | Saved candidates and rooted receipts replay through native RCL without network or AI access. |
| Integration Court | Is promotion non-compensatory? | AI-N2 candidate admitted; K233 stays blocked until GitHub replay. |
| Evidence Ledger | Can every claim be traced? | Roots bind source, contract, datasets, model definitions, checkpoints, native state and three generator sessions. |

## Donor and ownership decision

- JavaScript remains a differential oracle only. It supplied no native parameters.
- Codex CLI acted only as the independent repair generator for `AI_GENERATE`; it owns no model, gradient, optimizer or execution semantics.
- Optimized CPU Tensor libraries remain future execution organs after Tensor semantics stabilize.
- The measured JavaScript speed advantage remains `UNABSORBED_ADVANTAGE`; it is not hidden by the native semantic PASS.

## License audit

No package dependency, copied donor implementation or external dataset was added. Both datasets are truth-table fixtures authored in this repository. Independent generator candidates restored the byte-identical repository-owned K08-A source and introduced no third-party code.

## Promotion gates

1. GitHub-hosted `verify:k233-ai-generate` succeeds for the exact candidate commit.
2. K08-B native campaign succeeds on the same commit.
3. Full repository regression remains green.
4. The GitHub run URL, run ID and commit SHA are bound into the final receipt.
5. K400 evidence is regenerated only after gates 1-4.
