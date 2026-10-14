# GPU complete compiler performance and robustness continuation

K179 remains open. This continuation preserves the complete supplied compiler
source and bytes, the original 300,000,000-instruction ceiling, and the original
50,000 ms full compile budget. The twenty-generation, ten-sealed-program and
three-fresh-repair acquisition still has not been admitted. K400 remains
399 PASS / 1 UNTESTED, U3, INCOMPLETE; language version promotion remains frozen.

The first optimized full device run retains exactly 101,897,504 RBC instructions
and emits the original 297,957 bytes. Its kernel time is 152,943.288 ms,
compared with the previously captured 219,381.518 ms. A subsequent actual public
API full generation, including transport and output publication, measures
141,655.991 ms. Both preserve the original output SHA256
`55b32b42ca5ad13ec08e421511da3bc8d6af640f5fcf0268d5879c02a7c4ba48`.
The latter predates final capacity guards; each receipt records its actual
kernel and source bindings. Neither result satisfies the original budget.

The final public API generation after the capacity guards measures 158,336.406 ms
and again emits exactly the original compiler bytes with the original instruction
count. This final result governs the delivered source; the faster intermediate
measurements do not replace it. The recorded OpenCL cold setup cost is separate,
and the performance gate remains failed.

The reusable runtime changes are:

- Hot error/diagnostic controls use private device state and write back at batch
  boundaries. Consecutive constant/local loads take a generic device fast path,
  counting every original instruction and retaining stack/argument checks.
- Long Text concatenation uses retained immutable rope nodes. GPU consumers
  materialize their bytes once when required; the host requests device
  materialization when reading a final Text. Temporary Unicode views retain
  their cache owners. The first optimized full run uses 3,272,304 bytes of text
  arena, compared with the earlier 7,758,160-byte baseline.
- Deep Sequence equality uses its own bounded device scratch range; ordinary
  scalar comparison avoids carrying that private array. Nested Span comparison
  checks its fields. Runtime capacity guards reject Text and Sequence growth
  before logical-length arithmetic can overflow.
- Device opcode counters must sum to the actual original instruction count.
  The public API rejects an invalid count binding. Cold OpenCL setup time is
  reported separately and no host execution fallback is introduced.
- Decimal syntax is validated on the GPU before the pinned Ryu conversion.
  Incomplete decimal strings and nonzero decimal underflow reject visibly.
  The existing 17-significant-digit/decimal-format ceiling remains explicit.

Focused native comparisons cover long Unicode ropes, device bytes/SHA256,
persistent nested Sequence equality, transactions, nine malformed/underflow
decimal inputs, bounded growth, input snapshots, failed publication, cancellation
with actual process exit, and fresh-context recovery. The tests do not replace
the full K400 gate acquisition.

Experiments without a demonstrated improvement were discarded. Moving the
comparison scratch alone, integer interning, short binary fusion and extra
builtin fast paths retained bytes in medium probes but did not show useful
performance. Mechanical RBC-to-OpenCL lowering ran a small recursive/Unicode
program correctly, but both full monolithic and full chunked driver builds were
stopped after excessive cold compilation. Those lowerers are excluded from the
delivered runtime; no full lowered generation or performance pass is claimed.

The actual DWAC four-mode router again selected `DEEP_DEVELOPMENT`. Laya returned
`ABSTAIN` and tentatively selected completion despite the failed time budget;
that suggestion was not adopted. Source/runtime evidence owns the conclusion.
Receipts are in `docs/evidence/gpu-selfhost-optimization/`.

Run the focused live-device checks with `npm run test:selfhost-gpu-candidate`.
Use `scripts/probe-gpu-selfhost-compiler.mjs` for one actual full supplied
generation. No hosted Actions or version promotion was run.
