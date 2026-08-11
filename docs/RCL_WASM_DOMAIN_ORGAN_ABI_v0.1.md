# RCL WASM Domain Organ ABI v0.1

- Status: **VERIFIED**
- Evidence root: `97a58a4091d8ebf8103cac95daeea42225d8cb437dc26af0088a031d17f93ee9`
- Logical operation: `wasm-vm::algorithm::graph-traversal`
- Semantic identity: `graph-traversal::bounded-reachability`
- Evidence tier: **rcl.rbc13-wasm-domain-organ-abi.v0.1 / native-candidate**
- Canonical permission: **false**

## Contract

The Organ is identified by the logical operation contract, semantic identity, evidence tier, semantic root, error projection, receipt, and replay rules. C and WASM are replaceable bodies; neither body is allowed to claim canonical permission from registration.

## Value ABI

- Null: tag 0
- Truth: tag 1
- Number: tag 2
- Text: tag 3
- Sequence: tag 4
- Record: tag 5
- TypedRecord: tag 6

Graph input is a bounded typed-record envelope with tag 5, type id 1, a 28-byte little-endian header, and an adjacency matrix byte payload. Graph output is a typed-record envelope with tag 6, type id 2, fixed result fields, and a bounded visited-order payload. General Null, Truth, Number, Text, Sequence, and Record values use length-delimited recursive envelopes.

Memory ownership stays in the WASM linear memory membrane. The host validates pointer, length, alignment, bounds, recursion, nonfinite numbers, duplicate record fields, unsupported tags, and malformed lengths; all failures are closed with structured error codes. The native C body never receives a direct pointer to WASM or private native heap memory.

## Host ABI

- register: descriptor identity, implementation, artifact root, evidence tier, deterministic flag
- load: validate WebAssembly.Module exports memory and invoke; no native heap pointer accepted
- invoke: copy bounded tagged typed-record bytes into linear memory and invoke(ptr,len)
- readArgs: host owns and bounds-checks the linear-memory input record
- returnResult: read fixed output typed-record header and bounded visited order
- structuredError: class/code/details projection with fail-closed ABI errors
- evidenceReceipt: operation identity, semantic identity, artifact root, tier, pointers, duration, canonicalPermission=false
- canonicalPermission: false
- experimentalTier: true

## Evidence

- C body: **VERIFIED**, host root `c325c2963a9821936b0477fc387c0830a903034e0c20f129eb290d915cda38a3`
- WASM body: **VERIFIED**, module root `f01081a8f64d68d9bb03dc6aab92eee783424ba972f5fc28f72c99c2be86583b`
- Cross-body root parity: **true**
- Error class/code/details parity: **true**
- Replay: **VERIFIED**
- ABI negative controls: **true**

This is an experimental ABI witness for one bounded workload. It is not a canonical VM activation or a claim of general WASM support.

Reproduction: `npm run verify:rbc13-wasm-graph-growth-cell`
