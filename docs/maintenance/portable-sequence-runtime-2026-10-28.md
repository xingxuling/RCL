# Source-bound portable Sequence runtimes

Linux-musl VM/compiler and WASI VM/compiler artifacts were rebuilt from the
current canonical C owner with the existing local Zig toolchain. Their source
manifests now match that owner. The Linux and WASI compiler builders respect
explicit cache directories, avoiding duplicate local toolchain work. Generated
crypto object files remain build byproducts rather than source/package assets.

The reusable `scripts/verify-portable-sequence-runtime.mjs` checks actual existing
target adapters without an environment fallback. Windows, Node WASI Preview 1 and
Linux in `RCL-K400-Alpine` WSL each pass ordered 4096-item materialization,
shared/nested aliases with Unicode/Span/Token values, 50000-link left/right release,
representability overflow rejection and divide-by-zero rejection. Accepted target
bytes match the JavaScript bootstrap and states/roots match the Windows native
baseline; ordered values and release counts are checked independently.

The WASI C host also actually executes two full RCL compiler self-compilation
generations: C0=C1=C2, 368076 bytes,
`00299c1a240e363a28c45e4ffe6107f898cc26c79fe4237cbd4113c6880c08e0`.
This is 17 scoped cross-environment checks, plus four existing portable/WASI
checks. It does not imply arbitrary target support or portable numeric/performance
guarantees.

The historical `build-native-sequence-portable.mjs` had retained its old donor
hash against the evolving default source and failed before building. It now reads
the exact preserved `native/sequence-runtime/frozen-rclvm.c`, like the other old
overlay builders. Its Linux/WASI VM/compiler build succeeds, generated-source
hash remains bound to that donor, and both old VM candidates execute the alias
fixture with the same state/root. Existing historical evidence files are intact.

```powershell
node scripts/verify-portable-sequence-runtime.mjs --target windows --target wasm-vm --target linux --report output/portable-sequence.json
```

The verified Linux environment is this local WSL distribution; this is not a
physical-device, Android, GPU, hardened-WASI-sandbox or K400 admission claim. The
package/language version remains unchanged and no hosted Actions or publication
ran. Exact source/build/runtime bindings are in the adjacent JSON.
