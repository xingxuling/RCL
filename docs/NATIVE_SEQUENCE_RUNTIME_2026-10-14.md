# Persistent Sequence concatenation candidate

The optional Windows native runtime removes repeated copying of the accumulated
left side of `sequence_concat`. It retains the existing immutable prefix and
appends the right values using the VM's existing persistent Sequence machinery.
Reads and exports use the existing materialization path. Type guards, overflow
guards, bytecode semantics, authority checks and the compiler source stay intact.

This is a reproducible source overlay on the frozen C runtime, built into a
separate output directory. The default native binaries and all existing K400
anchors are preserved. DWAC selected deep development for this central
bottleneck; its routing result was advisory.

## Actual verification

The candidate passes snapshot equality with the original runtime for shared
prefixes, self-concatenation, empty operands, nested values, Unicode Text,
repeated accumulation and governed projection/commit. Both runtimes reject an
RBC program that feeds a Number to the Sequence concatenation builtin.

The complete, unchanged RCL-authored general compiler reproduces its own
297,797-byte RBC artifact for **twenty successive generations**. Every
generation has artifact SHA256
`b8474f5e2e831d39fdef0cca59c6db95aefef7e3f6b2c6e129895501e9e054ce`
and executes exactly 101,552,310 RCL instructions. The optimization changes
storage work rather than replacing compiler semantics with a host compiler.

| Measurement | Observed time |
| --- | ---: |
| Original runtime, one same-source comparison | 159.059 s |
| Candidate, first paired observation | 6.442 s |
| Candidate, twenty-generation median | 3.902 s |
| Candidate, twenty-generation P95 | 5.285 s |

The single paired observation is approximately **24.7× faster**. This is a
measurement on this Windows host, with mobile acquisition also running; it is
not a general performance guarantee. The twenty-generation run independently
establishes byte stability and records actual process IDs, exits, raw compiler
metrics and stdout/stderr hashes.

## Reproduce

```text
npm run build:native-sequence-runtime
npm run verify:native-sequence-runtime
```

The Windows build requires the configured Zig toolchain. It verifies donor
source SHA256
`0214c1715b5fcd1e275e213ee0ee0897e61f08b73ffef137e62d306761837156`
before applying the single generic builtin overlay. Results are written under
`output/native-sequence-runtime/`, including the separate VM/compiler, generated
C source, build receipt and verification ledger.

- [Overlay](../native/sequence-runtime/concat-case.c)
- [Build script](../scripts/build-native-sequence-runtime.mjs)
- [Verification script](../scripts/verify-native-sequence-runtime.mjs)
- [Recorded build](evidence/native-sequence-runtime/build.json)
- [Twenty-generation evidence](evidence/native-sequence-runtime/evidence.json)
- [Paired exploratory measurement](evidence/native-sequence-runtime/paired-probe.json)
- [Exact acquisition build script](evidence/native-sequence-runtime/acquisition-build-script.mjs.txt)
- [Independent source build](evidence/native-sequence-runtime/fresh-build.json)
- [Independent twenty-generation replay](evidence/native-sequence-runtime/fresh-evidence.json)

The recorded measurements pin that acquisition script. The current build script
uses a separate short Windows cache path after independent source replay exposed
a Zig cache failure. The C overlay and generated runtime source are unchanged;
the fresh build and bytecode checks are repeated with the corrected cache setup.
That separate source build also passes all twenty generations, with a 2.433 s
median and 3.063 s P95; its evidence root is
`a34bde00bc703359379b13de998ac0925b242f4504e05be785556cb855ef67f1`.

Evidence root:
`798b5b42b534655bd315a2794c3f659dc8700242d3286a62bcb30999005d059a`.
This is a Windows runtime candidate and grants no new K400 cell, independent
generation authority, cross-platform acceptance or release maturity. The full
K400 objective remains open and version advancement stays frozen.

## October 28 reproduction paths

The current default VM now develops a two-branch persistent concatenation
representation. This historical one-builtin overlay still uses its exact donor,
now preserved at `native/sequence-runtime/frozen-rclvm.c` with the SHA-256 above.
The build also produces `output/native-sequence-runtime/rclvm-frozen.exe` for the
original comparison. Its verifier reads the already-retained full compiler at
`examples/universal-stress/selfhost-native/general-compiler.rcl`, asserts source
hash `07d7f219025ccaa848081b21e4c2d02125b64db64c35b4a58d3850a55f58e452`,
and bootstrap artifact
`b8474f5e2e831d39fdef0cca59c6db95aefef7e3f6b2c6e129895501e9e054ce`.
The resident overlay builder uses the same frozen donor and keeps its source
bindings explicit. None of the historical evidence files above are rewritten.
The new default-runtime work is recorded separately in
`maintenance/native-persistent-concat-2026-10-28.md`.
