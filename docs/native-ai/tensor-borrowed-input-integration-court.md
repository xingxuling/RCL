# K08-F Tensor Borrowed-Input Integration Court

## Decision

Admit borrowed Tensor Plan input binding and Windows peak-process-memory measurement as an `ENGINE_E1_TENSOR_BORROWED_INPUT_CANDIDATE_LOCAL_WINDOWS`. GitHub replay is required before adding the replay-bound suffix. Do not promote Tensor, K233 or any K400 cell.

## Canonical ownership

- RCL continues to own Tensor descriptors, Storage identity, Plan SSA dependencies, operation meaning and resource policy.
- Rust remains the CPU execution organ and now borrows live Plan values into the same general kernels.
- The public `ExecutionRequest`/Provider validation path is unchanged.
- No Tensor, MLP, Transformer or workload-special opcode or kernel was added.

## Multicivilization decisions that changed the implementation

| Gate | Concrete effect |
|---|---|
| Founder Twin | Selected the measured per-node clone path ahead of Autodiff because it blocks every future graph workload. |
| 柳清莲 authority gate | Kept RCL semantic ownership and K400 authority unchanged; zero-input nodes remain fail-closed after bypassing the old owned binder. |
| 洞哥 grounding | Required exact-main binaries, alternating samples and child-process Working Set instead of treating logical element counts as RSS. |
| Product / UX | No public language or Provider request change was admitted; existing callers receive only additive telemetry. |
| Engineering / code | Split kernel execution from owned request binding and used scoped borrowed `BoundTensor` views so liveness reclamation remains borrow-safe. |
| Test / security | Covered repeated operands, zero inputs, SSA/liveness regression, resource gates and exact output-root parity; no new dependency or unsafe block was introduced. |
| Release / Integration Court | Local evidence is candidate-only until hosted Ubuntu semantics and Windows process-memory replay pass for the exact implementation commit. |

## Admission evidence

- Rust unit tests, formatting, clippy and portable K08 Tensor/General MLP tests pass.
- The full local repository run completed `867` tests with `864 pass / 1 fail / 2 skip`; the sole failure was a Windows `EPERM` during an unrelated RCLApp temporary-directory rename, and the exact three-test RCLApp file then passed in isolation. This is not recorded as a single-run green full suite.
- The unchanged General MLP Plan binds `54,964` inputs by reference and reports `0` cloned input elements.
- The exact historical storage-clone path would copy `314,521` elements / `2,516,168` bytes cumulatively on that Plan.
- Exact-main/candidate output roots match across every controlled production and stress execution.
- General MLP Plan median fell from `234.698` to `192.423 ms` (`1.220x`).
- Windows child-process peak Working Set medians were both `38,445,056 bytes` on the production Plan; no reduction was observed in this run.
- A 200,000-element-per-input stress fell from `20,234,240` to `18,636,800 bytes` while eliminating the historical `3,200,000`-byte input clone.
- Accepted local evidence root: `9bc62c3b126a9428f6213989d0cb184ff0787cbeec989c51d130cbedad8720fe`.

## Evidence boundary

The production timing and Working Set results are same-host Windows candidate evidence. Peak Working Set includes executable, JSON, allocator and response memory and is not equivalent to K08-E logical Plan-store size. The stress result demonstrates one deliberately clone-heavy boundary; neither result proves a portable or general Tensor memory reduction.

## Rejected claims

- `GENERAL_TENSOR_MEMORY_REDUCTION`
- `PORTABLE_RSS_REDUCTION`
- `VRAM_REDUCTION`
- `BUFFER_REUSE`
- `COMPACT_SELF_HOSTED_LOWERING`
- `PERFORMANCE_PARITY_WITH_JAVASCRIPT`
- `NATIVE_AUTODIFF`
- `K400_PROMOTION_FROM_THIS_CANDIDATE`

## Next evidence gate

Replay the exact implementation on GitHub Ubuntu and Windows. After replay binding, use the already-computed liveness intervals to evaluate semantically safe output-buffer reuse and compact Plan lowering.
