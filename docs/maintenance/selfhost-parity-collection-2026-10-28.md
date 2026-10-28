# Source-bound native example parity collection

The collector now supports repeated `--source`, `--report`,
`--compiler-timeout-ms` and `--compiler-artifact` options. Its default target
budget remains 60000 ms. Selected or overridden runs default to a separate report
and must still pass exact current bootstrap/artifact byte parity before native
dispatch. Each run uses a private immutable compiler snapshot.

Identical source SHA-256 plus reference-bytecode SHA-256 reuse one actual native
result inside the run. Every alias retains a result row and identifies the source
that was executed. Failures are also reused. This reduces redundant work; it does
not prove independent process repetition. Per-file source/reference/native hashes,
observed elapsed time, explicit timeout profiles and original-budget outcomes are
reported. Longer budgets cannot silently become evidence of the original budget.

The original collector result is preserved: 151 matches, 40 unsupported, 42
failures at 60 seconds. After the typed-control compiler fix, the source-bound
full run reports 153 matches, 40 unsupported and 40 failures across 233 files.
There were 120 actual native compile attempts and 73 reused alias results.
Remaining failures represent seven distinct complete-compiler sources, all timeout
failures. Neither report is an all-examples PASS or new K400 admission.

Four CLI checks pass: real alias/result deduplication, explicit budget profile,
pre-dispatch artifact mismatch rejection and strict argument rejection. The
machine-readable evidence pins the compiler used by this particular full run;
subsequent compiler changes require their own relevant verification.
