# Native-core compiler self-hosting across four environments

K059/K039/K019/K079 cover Windows, Linux WSL2, Node WASI and actual Chromium.
Each environment runs the complete RCL-authored native-core compiler for twenty
successive self-compilation generations, then compiles and executes ten sealed
programs. Three fresh independent repair proposals are replayed unchanged in
every environment. The program family is compiler self-hosting; the native VM
and operating system are not claimed to be self-hosted.

The first frozen acquisition correctly failed its Unicode case. Its RCL lexer
counted a non-BMP character as one source-column unit, while the reference source
map counts two UTF-16 units. Source locations are part of the program root, so
identical instructions alone were insufficient to pass byte parity. The failed
contract and its [non-admission record](../examples/universal-stress/selfhost-native/non-admission.json)
are retained with zero credit.

A separate RCL compiler variant changes the generic string-position walker to
add two units for a four-byte Unicode scalar. String values and native Text
semantics are preserved. The original compiler artifact and existing runtime
anchors remain unchanged. Five regression cases cover supplementary scalars,
multiple scalars, escaped and actual newlines, and following declarations.

The repaired compiler has **297,957 bytes**, SHA256
`55b32b42ca5ad13ec08e421511da3bc8d6af640f5fcf0268d5879c02a7c4ba48`.
All eighty formal generations reproduce these exact bytes. Each generation
executes 101,897,504 RCL instructions. Linux and WASI use separate builds of the
generic persistent Sequence runtime. Chromium compiles inside its actual WASM
realm with the same source-owned compiler; no Node-WASI browser fallback is used.

| Environment | Full compiler compile P95 | Sealed program execute P95 |
| --- | ---: | ---: |
| Windows | 2.947 s | 131.0 ms |
| Linux WSL2 | 3.417 s | 358.5 ms |
| Node WASI | 12.392 s | 250.4 ms |
| Chromium | 6.843 s | 57.4 ms |

The ten sealed programs cover arithmetic, comparison boundaries, short circuit,
recursive GCD, Unicode Text, persistent sequences, conditional warrants and
projection/commit. Artifact bytes match independent reference serialization;
native state and transactions match independent oracles. Native Text scalar
length is explicitly checked independently for the Unicode program. Malformed
source and corrupt compiler RBC are rejected. Measurements are bound to actual
process/browser traces and the selected runtime artifacts.

The repaired source was frozen before three fresh model contexts received only
mutated candidates, semantic requirements and public RBC opcode definitions.
Canonical source, exact oracle edits and sealed cases were withheld. Separate
model contexts are claimed; operating-system isolation is not claimed. Their
unchanged proposals restore canonical source and reproduce the fixed point.

Seventeen targeted source-column/admission checks pass. Forged compiler input,
generation output, process exit, stdout binding, sealed state, proposal,
ineffective mutation and missing gate are rejected even after rehashing.

Actual compiler/VM command paths are checked against the recorded absolute
acquisition root, while each referenced artifact is independently hashed in the
current checkout. Relocating the source tree preserves receipt identity without
substituting process commands. All four environments were reacquired after this
policy change. Exact previous receipts and policy bytes remain in the
[historical archive](../examples/universal-stress/selfhost-columns/acquisition-before-path-binding/non-admission.json)
with zero current credit. Forged command and acquisition-root bindings are rejected.

## Evidence and reproduction

- [Frozen revised contract](../examples/universal-stress/selfhost-columns/general-compiler-columns-contract.json)
- [Four-environment admission](../examples/universal-stress/selfhost-columns/general-compiler-columns-runtime.json)
- [RCL compiler variant](../selfhost/variants/utf16-columns/compiler.rcl)
- [Compiler artifact](../selfhost/variants/utf16-columns/compiler.rbc)
- [Independent proposals](../examples/universal-stress/selfhost-columns/general-compiler-columns-proposals.json)
- [Generic Sequence overlay](../native/sequence-runtime/concat-case.c)
- [Admission checks](../tests/k400-selfhost-column-admission.test.mjs)

Contract root: `513244af651a3b9a37198a28393c0f653a407f94c7bdf8687bd941d10c17a9f0`.
Admission root: `8ad109ec2bf2cd845e2aa8f801ec0d3013b57e406d9354a362a83951518adaee`.

```text
node scripts/k400-selfhost-column-engine.mjs run windows
node scripts/k400-selfhost-column-admission.mjs
node --test tests/k400-selfhost-column-admission.test.mjs tests/selfhost-unicode-columns.test.mjs
npm run evidence:k400
```

A relocated tracked-source snapshot passes 37 focused tests, `doctor`, and
the complete 364/400 K400 admission rebuild with the same report root. Separately
rebuilt Linux/WASI candidates reproduce forty full compiler generations and
twenty sealed program results. Their executable bytes differ from the frozen
bundles; executable reproducible-build identity is not claimed. The source-only
[delivery receipt](evidence/k400-selfhost-columns/source-delivery.json),
[build receipt](evidence/k400-selfhost-columns/fresh-portable-build.json) and
[actual replay](evidence/k400-selfhost-columns/fresh-portable-replay.json) retain
these separate evidence boundaries. The pinned Zig toolchain is external; ignored
tool directories are not copied into the snapshot.

The profile grants four bounded coordinates only. Remaining self-hosting
contexts, GPU Text/compiler support and unfinished mobile acquisition remain
open. No hosted Actions run is requested; version advancement remains frozen.
