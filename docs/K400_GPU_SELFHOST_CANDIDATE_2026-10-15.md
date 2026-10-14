# GPU complete compiler candidate — K179 remains open

This candidate adds a public `createGpuCompilerTarget` API and a separate
resumable OpenCL RBC interpreter. The actual supplied complete compiler runs on
the AMD FP64 GPU; the host uploads input bytes, dispatches kernels, reads device
values and verifies transport bindings. There is no CPU compiler or VM fallback.
Existing compiler sources, portable GPU owners and registered K400 profiles stay
byte-identical.

The first complete device self-compilation emitted the original 297,957-byte
compiler exactly, SHA256
`55b32b42ca5ad13ec08e421511da3bc8d6af640f5fcf0268d5879c02a7c4ba48`,
after 101,897,504 actual RBC instructions. Its measured kernel time was
226,970.473 ms. This is correct fixed-point diagnostic evidence, but it exceeds
the original 50,000 ms compile budget. It is not K179 acceptance evidence.
The captured baseline identifies its actual kernel; later kernels require their
own verification and do not inherit this result.

The first delivered candidate kernel
`29aa25c68c6d5dd051674c9b41a736cccfbc09704fc81c9b45a3a8cba2a86dc7`
also completed the full fixed point with the same 101,897,504 instruction count,
510 execution batches plus one device flatten dispatch, and identical compiler
bytes. Its actual kernel time was 219,381.518 ms; this still fails the original
performance gate. See `docs/evidence/gpu-selfhost/final-fixedpoint.json`.

The device implementation adds retained values with reclamation, immutable
Sequence append/concat trees and device flattening, cached Unicode indexing,
tail calls equivalent to the native continuation rule, binary byte emission,
device SHA256 and decimal parsing. Per-batch program counter, call frames,
stack, state and heap persist on the device. Bounded local stack and allocator
metadata caches retain global spill state between dispatches. It executes one
GPU work item and makes no parallel throughput claim.

The public API captures compiler/source/program bytes before awaiting; checks
artifact, source, nonce, device, kernel, process and context bindings; validates
emitted RBC before atomic publication; rejects concurrent dispatch; and observes
child exit on cancellation. Success and failed jobs allocate fresh VM arenas.
An explicit reset creates a new process/context. The `compiler_input.source`
provider is limited to immutable source input; no external provider effects are
authorized. Host semantic roots are independently computed from device-produced
state and transaction values and are labeled as host hashes.

Focused checks compare emitted bytes, state and transaction roots with existing
native/reference oracles. They cover Unicode temporary-view lifetime, byte
encoders, SHA256, supported decimals, immutable sequences, transactions, tail
calls, malformed/corrupt input, wrong roots, snapshots, backpressure, reset,
cancellation and fresh recovery. These are runtime checks, not the original
twenty-generation / ten-sealed-program / three-fresh-repair K400 acquisition.

The decimal parser reuses unmodified Apache-2.0 source from
[Ryu at the pinned commit](https://github.com/ulfjack/ryu/tree/4c0618b0e44f7ef027ebae05d2cc7812048f7c8f).
GitHub Git Trees blob IDs and sizes were checked against the local provenance.
An OpenCL adaptation is separately generated and hashed. Its current ceiling is
17 significant decimal digits and bounded decimal syntax; unsupported formats
and finite nonzero subnormals reject visibly. General `strtod` compatibility is
not claimed.

DWAC's actual pinned four-mode router selected `DEEP_DEVELOPMENT` for this
remaining bottleneck. That advisory receipt did not generate or authorize code.
The local Laya classification returned `ABSTAIN`; source audits and runtime
observations own the conclusion. Both receipts are retained under
`docs/evidence/gpu-selfhost/`.

Run `npm run build:gpu-compiler-runtime` to regenerate the kernel and
`npm run test:selfhost-gpu-candidate` for the focused live-device checks. Set
`RCL_GPU_PYTHON` to the configured Python interpreter if needed. AMD OpenCL with
FP64 is required. No hosted Actions or version promotion was requested.

K400 stays **399 PASS / 1 UNTESTED, U3, INCOMPLETE**. K179 still needs the
original performance budget plus twenty actual full generations, ten sealed
programs, three newly isolated proposal trials and all remaining gates.
