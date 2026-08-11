# RBC 1.3 Polybody Organ Parity Evidence v0.1

- Status: **VERIFIED** experimental parity witness
- Evidence root: `97a58a4091d8ebf8103cac95daeea42225d8cb437dc26af0088a031d17f93ee9`
- Logical Organ: `wasm-vm::algorithm::graph-traversal`
- Bodies: RCL JavaScript reference / native C / WebAssembly
- Canonical permission: **false**

The three bodies execute independently against the same bounded graph workload. All seven positive, cycle, disconnected, empty, budget, invalid-node, and malformed cases have matching status, result/error projection, semantic roots, and replay roots.

- C body: **VERIFIED**; host root `c325c2963a9821936b0477fc387c0830a903034e0c20f129eb290d915cda38a3`
- WASM body: **VERIFIED**; module root `f01081a8f64d68d9bb03dc6aab92eee783424ba972f5fc28f72c99c2be86583b`
- Cross-body parity: **true**; replay: **VERIFIED**
- ABI negative controls: unsupported-type=true, malformed-length=true, nonfinite-number=true, duplicate-field=true, invalid-pointer=true

This document proves replaceable-body parity for one bounded workload. It does not grant canonical language, universal maturity, autonomous growth Level 3+, or version-contract authority.

Reproduction: `npm run verify:rbc13-wasm-graph-growth-cell`
