# Native persistent Sequence concatenation

The default native VM now retains both concatenation branches instead of copying
the full prefix at each call. Empty operands reuse the other immutable value;
append and concat check representable element counts before allocation. Ordered
reads materialize the shared tree using an explicit worklist. Count-ordered
iterative release handles deep left/right chains and shared aliases without
recursing through structural concat/append links. Nested Sequence *values* still
use the existing recursive value release; arbitrary nesting depth is not claimed.

This changes the existing private Sequence owner in `native/rclvm.c`. The public
C header, RBC format and language version are unchanged. All eight Windows
distribution artifacts were built using local Zig 0.16.0, and the prebuilt
manifest was independently checked afterward. An actual external executable
linked through the import library and loaded the rebuilt DLL successfully.

Nine targeted checks cover ordered aliases, both semantic-root algorithms,
nested sequences, Span/Token ownership, typed record/reference heap identity,
20,000-item materialization, 100,000-link release, length-only shared logical
sequences, count overflow and failure cleanup. All nine pass under the default
VM and a separate UndefinedBehaviorSanitizer build. The existing runtime/ABI/
attestation/heap/resident groups pass 60 checks with one initially unavailable
toolchain check; setting the actual local toolchain then passes all 12 embedding
and HTTP worker checks, including that DLL check. All 69 session/profile/durable/
concat checks also pass. These groups overlap and are not a unique test total.

The source-allocation probe uses the actual embedded C implementation and public
instance API. Thirty reset/run/capture/free rounds, then destroy, return both the
successful and intentional divide-by-zero fixtures to zero tracked allocations
and bytes. This is source-allocation accounting, excluding C runtime internals.
AddressSanitizer could not link on this Windows toolchain; it is not reported as
passed. Dense materialization can still follow existing process-exit OOM paths.

One warmed paired local observation for 16,384 exact integer items changes from
3782.93 ms to 74.70 ms, with identical source, RBC, instruction count and state
root. Cold/warmup timings remain recorded separately. These are observations on
this host, not portable latency guarantees.

The current general compiler remains byte-identical C0=C1=C2, 362965 bytes,
`d3b195d3931f09035fccc35120775cc40f50c61b3231e09dac1a6d83c3d3cd4d`.
The full example collector retains its 60000-ms budget: 195 exact matches,
38 reference rejections and zero failures across 233 sources, with 122 actual
native compiles and 73 reused aliases. The old optional overlay and resident
builder now read the exact preserved donor `native/sequence-runtime/frozen-rclvm.c`.
The overlay's original three snapshot profiles, two type-negative runs and twenty
fixed-point generations pass again against the pinned historical compiler.
Historical evidence files and K400 admission anchors remain intact.

An initial control exposed pre-existing reference equality debt TD-020:
independently built equal sequences compare false in JavaScript and true in both
the former and current C VM. Ordered storage parity is checked separately from
that native equality assertion. This increment does not claim full equality
parity. Source-bound results and limitations are in the adjacent JSON receipt.

To reproduce the functional checks and local observation:

```powershell
node --test tests/native-persistent-concat.test.mjs
node scripts/verify-native-sequence-concat.mjs --report output/sequence-concat.json
# Set ZIG to an already installed Zig 0.16.0 executable for native builds.
node scripts/build-native-sequence-runtime.mjs
node scripts/verify-native-sequence-runtime.mjs
```

For source-allocation accounting, compile
`native/sequence-runtime/ownership-probe.c` with the same native flags and
`-I native -lbcrypt -lm` (optionally the UBSan flags above). Compile the two
`tests/fixtures/sequence-ownership-*.rcl` files with the existing `bytecode` CLI.
Invoke the probe as `probe.exe success.rbc 30` and
`probe.exe failure.rbc 30 --expect-error`. No hosted Actions ran and no platform,
release or whole-language promotion is inferred.
