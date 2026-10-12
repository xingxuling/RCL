# K400 expansion campaign, 2026-10-13

Goal: at least **200/400** verified cells. Current checkpoint: **28 PASS, 372 UNTESTED**, verdict INCOMPLETE, maturity U3. Version promotion remains frozen. The initial baseline was 24 cells; historical receipts keep their original scope and authority.

## Reuse and implementation

REUSE the current RCL-authored compiler artifact, native C VM, semantic-root-v2 checker and K400 evaluator. ADAPT the existing recursive algorithm source into a fresh frozen portable profile. KEEP_SEPARATE the historical campaigns and their hosted replay receipts. No new hosted CI has been requested.

The new wasm32-WASI backend compiles the same `native/rclvm.c`. The adapters provide SHA-256 through Zig's standard library and seekable transaction-capture files through WASI libc. They contain no algorithm-specific lowering or evaluator. The checked `native/wasi/rclvm.wasm` and relative build manifest allow replay from another checkout without the developer's ignored build directory. Rebuild with Zig 0.16.0 using `node scripts/build-native-wasi.mjs`; replay the checked module using:

```text
node scripts/run-native-wasi.mjs native/wasi/rclvm.wasm program.rbc
node scripts/run-k400-portable-algorithm-campaign.mjs
node scripts/verify-k400-expansion-receipts.mjs
npm run evidence:k400
```

[Node WASI](https://nodejs.org/api/wasi.html) supplies the Preview 1 host interface. This is a real WebAssembly target execution profile; it claims no secure sandbox, browser execution or Linux execution. The runner uses a fresh temporary directory for each invocation. Build evidence is distinct from runtime evidence.

## Algorithm/CLI checkpoint

Only K001/K002 and K041/K042 are admitted by `algorithm-contract.json`, `algorithm-runtime.json` and `algorithm-independent-proposals.json` under `examples/universal-stress/expansion-wave1/`. RCL owns GCD, Fibonacci, square summation and boundary handling. Native C and WASI return matching independently recomputed semantic roots.

The contract and three mutated candidate hashes were frozen before independent requests. Three fresh proposal-only contexts repaired effective mutations; the evaluator applied the exact returned edits and replayed the repaired source on both backends. The human authorized these contexts. No tools, memory, filesystem or network access was requested from them; hardened OS isolation is not claimed. Two earlier prompt-format acquisitions were rejected and receive no credit.

Twenty rounds per backend meet the pre-fixed compile/execute p95 budgets. Ten additional parametric cases have independent iterative numerical oracles. These cases were selected after generation and withheld from proposal contexts; they are not pre-sealed holdouts or a claim of corpus generalization. Malformed source, corrupt RBC and semantic mutations are detected. Admission independently checks source/binary bindings, recorded output roots, numerical results, measured timings, exact edits and eligible coordinates.

Additional targeted checks verify Unicode, binary64 values, nested sequences and transaction capture across native/WASI; they also reject rehashed incorrect results, concealed slow timings and expanded scopes. These tests do not themselves add K400 cells.

## Next capability gaps

Expand reusable relational, simulation/scientific, governed and agent profiles using fresh frozen contracts and independent generation. Additional environments require actual adapters and observed target execution. Docker's Linux engine is currently unavailable, and registered user WSL distributions point to missing disks; no Linux credit is granted. Android/browser/device, distributed, GPU and external effects keep separate runtime requirements.
