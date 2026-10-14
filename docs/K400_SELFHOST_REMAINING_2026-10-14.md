# Remaining full-compiler environment work

This is a source audit and development queue, not additional K400 admission.
Android K099, HTTP server K119 and embedded K299 now have independently verified
full-compiler indexes. The [cold-handler continuation](K400_COLD_SELFHOST_2026-10-14.md)
also closes K139. The complete collector now records 371 PASS and 29 UNTESTED. Mobile's separate nineteen-environment campaign is
still partial; completed individual receipts do not supply its eighteen new
coordinates prematurely.

## Reuse the actual owners

| Open self-hosting cell | Existing owner to adapt | Missing implementation / evidence |
| --- | --- | --- |
| K159 database | `portable-database-target` | Real SQLite/compiler job binding and transaction controls for dynamic compiler artifacts |
| K259 distributed | `ready-replica-target` | Actual independent worker compilation, artifact agreement and failure recovery |
| K319 dataflow | `portable-dataflow-target` / worker threads | Dynamic resident compiler generations inside the actual worker graph |
| K199 game, K219 science, K239 AI, K279 realtime, K359 automation, K379 simulation, K399 RNCS | Their existing source-bound native controllers and profile-specific transport owners | Full compiler compilation/execution must occur through the selected real controller; a renamed Windows process does not provide these coordinates |
| K179 GPU | Separate GPU Text interpreter and native persistent Sequence donor | Device-side compiler capability and resource management; no CPU compiler execution substitution |

The new resident compiler's actual RCL/compiler-input/output contract is reusable.
Keep the acquisition-bound existing owners intact; add sibling adapters and their
own frozen contracts, fresh proposal-only contexts and explicit transport checks.
The full-compiler admission budget remains 20 generations, ten sealed programs,
three unchanged effective repairs, 300 million instructions, compilation P95
under 50 seconds and execution P95 under five seconds.

## GPU gap verified in source

The current GPU Text provider accepts `set(range(35)) | {44, 47}` and therefore
excludes provider opcode 35. Its supported builtin table excludes
`number_from_text` (11), while the actual complete compiler source invokes it.
That source also computes `sha256_text` for program roots and uses byte encoding.
These primitives need a device-owned implementation with independent byte parity.

The kernel allocates values monotonically with `VALUE_LIMIT = 262144` and
`INSTRUCTION_BUDGET = 2000000`; Text uses an append-only 8 MiB arena. The actual
complete compiler needs 101897504 instructions per generation. Increasing the
budget alone does not address allocation lifetime. Current Sequence append is a
linked persistent tail; concatenation walks and copies the right-hand spine, and
lookup walks the structure. Generic memory reuse and a suitable persistent
Sequence representation must precede a credible full compiler claim.

A separate successor should preserve the pinned GPU Text receipts and reuse its
transport/device identity, Ryu output formatting and proven instruction semantics.
Investigate bounded kernel continuation for long-running work rather than one
unbounded GPU dispatch. Device-owned compilation, complete generations, sealed
native byte/state parity and the unchanged performance gates must be measured
before K179 can pass. No completion or throughput claim follows from this audit.
