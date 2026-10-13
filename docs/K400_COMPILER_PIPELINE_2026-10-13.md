# Compiler workflow game, distributed and media closure

Verified checkpoint: **360 PASS / 0 BLOCKED / 40 UNTESTED (90%)**,
INCOMPLETE, U3. This adds K328, K330 and K335 to the previous 357-cell checkpoint.
The full 400-cell goal stays active; package identity remains 2.0.0 and version
promotion is frozen.

A callable `createPortableCompilerTarget` now records the actual RCL-authored
compiler-RBC process, compiler instruction/byte metrics, generated artifact,
separate native VM process, typed state roots, stdout/stderr hashes, process
exits and failed-source/artifact/root controls. Neither compilation nor execution
falls back to the reference implementation. Reference code checks byte parity
and numerical/transition results independently. This is a local Windows
compiler workflow, without a deployment or full-runtime-self-hosting claim.

The game and media kernels and replicated-counter implementation are reused
unchanged. The family engine is adapted in a separate module with its original
source retained; old engines, frozen contracts, native binaries and receipts
are unchanged. Actual native bound/authority errors from effective mutants
are matched against independently replayed reference failures.

All **60 native rounds, 30 sealed inputs and 9 fresh independent repairs** pass.
Three isolated proposal-only contexts received frozen broken candidates and
intent, withholding canonical source, oracles and holdouts. Eight proposals
restore canonical bytes. The different member test `integer && sender <= 2`
passes every one of the ten extra sealed inputs. OS/security process isolation
is not claimed.

K330 also includes three real loopback HTTP nodes, source-owned component joins,
partition/heal, stale/duplicate delivery and invalid/denied packet controls.
Each observed packet is bound to that node's actual compilation/execution
ledger. Local membership is not cryptographic or cross-host identity.

| Profile | Cell | Compile p95 ms | Execute p95 ms | Receipt root |
|---|---|---:|---:|---|
| media | K335 | 258.8 | 197.8 | `a7b118dfd35f15546acb0d16e4d7392397d570ef8657c83881e6abca20d6a74f` |
| game | K328 | 206.0 | 147.5 | `8897e793b309fb024eed2c005ea43daabb50d73982c38b11ddc829b0256203ef` |
| replicated-counter | K330 | 497.8 | 180.7 | `fa3a5291d45d343015c7179165260137f6fd271a45cb5b5e43502bfff04a3d19` |

Consolidated report root: `c121ac9868f3a1eec98ce2b8a16edd96afcc95b07a6436c4285513eb7af50d5b`.
Registered evidence root: `94dbf1c5925921152b2382bbb7c6c230e4854fe5c9a82fe592a13348a410a125`.

Thirty-nine focused checks pass, including callable native compilation,
separate process identity, wrong-root/closed-pipeline rejection, process/metric
/source/ledger/gate tampering and incomplete alternative-repair or HTTP proof.
No hosted Actions run is requested.

```text
node --test --test-concurrency=1 tests/k400-compiler-pipeline.test.mjs tests/research-readiness.test.mjs tests/universal-program-stress.test.mjs
npm run evidence:k400
```

The staged tracked tree `fe39824fae6e61abcc036d44c00223f586e7c966` was independently exported to
a short fresh source-only directory. It reproduces the same 360-cell report
root and passes all 39 focused checks plus the version-policy check.
