# Native Provider Host Call Evidence Ledger v0.1

| Gate | Status | Evidence |
|---|---|---|
| Existing Provider ABI | REUSE | registered native provider already executes explicit `provider_call(...)` |
| Rule-level lowering | CANDIDATE | one Text literal request, `realize` only |
| Authority order | PASS_LOCAL | bytecode test requires `CHECK_WARRANT` before `CALL_PROVIDER` before `COMMIT_TX` |
| Native success | PASS_LOCAL | real rebuilt `provider_demo.exe` executes the response, change source, warrant, witness and rooted host-call record |
| Missing warrant | PASS_LOCAL | compiler rejects `RCL_WARRANT_MISSING` before RBC emission |
| Missing provider | PASS_LOCAL | native executable exits 1 with `RCL_NATIVE_PROVIDER_MISSING` and no stdout result |
| Provider receipt | CANDIDATE | native transition binds provider, capability, request JSON and request root |
| Foresee/simulation | BLOCKED | explicit fail-closed diagnostic |
| Dynamic request | BLOCKED | only one Text literal request is admitted; dynamic and non-Text shapes fail closed |
| Focused regression | PASS_LOCAL | 4/4 candidate tests; Stage0 source-truth rebind also passes |
| Full regression | PASS_LOCAL | 855/855, 0 failed, 0 skipped; 592559.0687 ms; real Zig 0.16.0 native rebuild in pretest |
| Self-host compiler parity | BLOCKED_SEMANTIC_DRIFT | checked-in `selfhost/compiler.rbc` emits RBC 1.1 with unchanged state and empty `hostCalls` for the candidate example |
| Example parity routing | PASS_BOUNDARY | rule-level host-call examples are classified `RCL_SELFHOST_RULE_HOST_CALL_UNSUPPORTED` instead of being falsely treated as eligible byte-parity inputs |
| K400 promotion | BLOCKED | nine non-compensatory gates were not run |

The first full run exposed one transient Windows directory rename `EPERM` and the expected stale Stage0 source hash. The RCLApp test passed on isolated rerun, Stage0 was rebound to the current `src/bytecode.mjs` hash, and the final full run passed 855/855. The interrupted post-audit run is not counted as evidence.
