# Current RCL Status: v0.94.0-alpha.1

- Canonical source: `xingxuling/RCL@main`.
- Verified ceiling: Stage40 native-core RCL self-hosting.
- The repository contains the native-core compiler/VM path and fixed-point artifacts described in the main README.
- The current native VM emits `rcl.semantic-state-root.v1`; the JavaScript boundary independently recomputes the canonical semantic state root, rejects algorithm/root mismatch, and supports strict evidence enforcement through `requireNativeStateRoot: true`.
- Whole-language runtime self-hosting is not claimed. Six Foundation domains, the three Meta Batch B planes, the `physical` -> `embodiment` Batch C chain, the `energy` -> `elemental` -> `neural` Batch D chain, and the `metacomputation` -> `computation` Batch E chain now execute through RBC 1.2 and five `RclVmProviderV1` Native Provider bridges; uncovered and declared-domain runtime remains JavaScript.
- The bridge is explicitly reported as `bridge`, not native Foundation syntax. Its executable is `native/rclfoundation.exe`.
- RCL RNCS Visual Intent v0.1 now provides a rooted bridge input for animation graphs, blend layers, masks, look-at/two-bone IK constraints, skin selection and morph weights; it is an input contract and not a rendering claim.
- RCL RNCS Runtime Binding v0.1 now consumes the RNCS authority-presentation receipt, verifies the state/frame/packet root links and carries the binding into RCL proposals, causal references and evidence edges; it remains a migration consumer and does not execute RSR or VSR itself.
- Downstream copies in RNCS and zhinao are tracked as migration consumers, not as byte-identical sources.
- Machine-readable contract: `VERSION-CONTRACT.json`.
- Verification entrypoint: `npm run verify:version-contract`; the semantic-authority gate is `node --test tests/native-semantic-state-root-native.test.mjs`; the bridge gates are `npm run test:foundation-native-batch-a`, `npm run test:foundation-native-meta-batch-b`, `npm run test:foundation-native-batch-c`, `npm run test:foundation-native-batch-d`, `npm run test:foundation-native-batch-e`, and `npm run conformance:foundation`.

``CONTEXT.md`` is retained as historical handoff material; its prior “Current” heading has been renamed to avoid presenting v0.86 as the current release.

## Experimental capability metabolism layer

- `Capability Metabolism v0.1` adds a bounded external-capability manifest, semantic-kernel extraction, generated RCL declarations, declared-equivalence evidence, absorption-stage scoring and cross-domain compound-organ synthesis.
- The layer deliberately reports `native-candidate` rather than native status. Native promotion still requires independent source/runtime differential execution, RBC lowering and native-VM parity evidence.
- Verification entrypoints: `node --test --test-concurrency=1 tests/capability-metabolism.test.mjs` and `node examples/capability-metabolism-demo.mjs`.
