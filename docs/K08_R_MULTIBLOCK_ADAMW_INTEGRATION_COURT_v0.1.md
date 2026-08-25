# K08-R Multi-Block AdamW Integration Court v0.1

## Target ruling

Admit bounded two-block GQA+RoPE training through generic RCL Tensor Reverse Autodiff + AdamW with exact checkpoint/resume continuity, while leaving every mixed-precision, accelerator, distributed, and scale claim closed.

## Founder Twin

The target is not merely “AdamW can update more tensors.” The target is a governed optimizer lifecycle in which parameter identity, optimizer-state identity, checkpoint authority, resume authority, and replay identity remain stable when a model grows from one block to multiple blocks.

## Gate ruling

**PASS as bounded GitHub-replay candidate.**

Reason:

- all fourteen trainable groups update;
- all fourteen optimizer states remain uniquely identity-bound;
- loss decreases;
- exact f64 continuation survives checkpoint/resume;
- state ordering follows the RCL parameter order;
- malformed state fails closed;
- no model-special optimizer opcode is introduced;
- implementation, promoted-contract, and final bound-contract replays all pass on Ubuntu and Windows.

## Grounding

Implementation replay `32862241167`, source commit `4a4417d974203de3a383ab62c17909ddb9ae80dc`:

- Ubuntu `97848821949`: 8/8 PASS
- Windows `97848821657`: 8/8 PASS

Promoted-contract replay `32862691677`, source commit `9b15118a76510a73a6cbe3e28c8a46b98bfb41e2`:

- Ubuntu `97850321833`: 8/8 PASS
- Windows `97850322009`: 8/8 PASS

Final bound-contract replay `32862875004`, source commit `5bd05f5c8e7d50249f1fba5e432cc78350380ddc`:

- Ubuntu `97850942098`: 8/8 PASS
- Windows `97850942364`: 8/8 PASS

The diagnostic path is itself material evidence. Earlier replays exposed decimal re-materialization and canonical-order defects. Those defects were repaired rather than tolerated; the acceptance rule remained exact equality.

## Product / user value

This milestone changes the model-building frontier materially. A multi-block decoder can now be trained and resumed through one generic optimizer organ without introducing block-specific update logic. That makes later BF16 and accelerator work a lowering/performance problem instead of an unresolved optimizer-lifecycle problem.

## Engineering civilization

Accepted architecture:

`RCL parameter identities -> Tensor graph -> Reverse Autodiff -> identity-bound AdamW states -> exact checkpoint bits -> canonical resume`

Parameter semantics remain owned by RCL. The Rust tensor engine is an execution organ; it does not become canonical owner of model identity or training authority.

## Code civilization

Accepted implementation properties:

- fourteen unique parameter identities in the frozen two-block profile;
- one AdamW state per trainable identity;
- exact f64 bits for parameter continuation authority;
- exact f64 bits for first and second moments;
- resume materializes exact bits before the next optimization step;
- optimizer states are emitted in canonical `request.parameters` order;
- checkpoint root covers optimizer config, parameters, and optimizer states;
- no GQA-, RoPE-, decoder-, or block-special optimizer opcode.

## Test civilization

The bounded acceptance suite proves:

- self-host RBC parity and native semantic root;
- fourteen unique trainable identities;
- all trainable groups update;
- loss decreases;
- all optimizer states are finite and correctly shaped;
- direct 4-step training equals 2-step checkpoint + 2-step resume exactly;
- deterministic repeated replay;
- malformed optimizer state fails closed;
- generic Tensor Autodiff + AdamW ownership is preserved;
- promoted and final replay-bound contracts independently reproduce the same 8/8 hosted result on both supported CI platforms.

Future tests remain mandatory for BF16 backward graphs, FP32 master weights, loss scaling if introduced, larger geometries, real accelerator execution, and distributed training.

## Safety civilization

Fail-closed behavior remains mandatory for:

- state-count mismatch;
- duplicate/missing tensor identities;
- state shape mismatch;
- inconsistent optimizer steps;
- malformed exact f64 payloads;
- non-finite parameter/state/update values;
- mutable parameter storage aliasing.

Checkpoint continuity may not silently fall back from exact-bit authority to ordinary decimal JSON.

## Release civilization

Admit K08-R as:

`MULTI_BLOCK_ADAMW_CANDIDATE_GITHUB_REPLAY_BOUND`

Do not grant:

`BF16_AUTODIFF_TRAINING`, `MULTI_BLOCK_BF16_TRAINING`, `GPU`, `CUDA`, `VULKAN_GPU`, `RCL_10M`, `DISTRIBUTED_TRAINING`, `RCL_1B_COMPLETE`, or `K400_PROMOTION`.

## Evidence Ledger

- semantic genome: `examples/native-ai/multiblock-adamw-genome.rcl`
- contract: `examples/native-ai/multiblock-adamw-contract.v0.1.json`
- optimizer organ: `native/tensor-engine/src/bin/rcl-tensor-adamw.rs`
- tests: `tests/k08-multiblock-adamw.test.mjs`
- workflow: `.github/workflows/k08-multiblock-adamw.yml`
- implementation run: `32862241167`
- implementation source commit: `4a4417d974203de3a383ab62c17909ddb9ae80dc`
- implementation Ubuntu: `97848821949`
- implementation Windows: `97848821657`
- promoted replay: `32862691677`
- promoted source commit: `9b15118a76510a73a6cbe3e28c8a46b98bfb41e2`
- promoted Ubuntu: `97850321833`
- promoted Windows: `97850322009`
- final bound replay: `32862875004`
- final source commit: `5bd05f5c8e7d50249f1fba5e432cc78350380ddc`
- final Ubuntu: `97850942098`
- final Windows: `97850942364`

## Next court

The next admission should target **BF16 Reverse Autodiff with FP32 gradients/master weights**, then bind that path to multi-block AdamW. Real GPU admission remains blocked on independently evidenced hardware execution.