# Semantic state root v2

Algorithm ID: rcl.semantic-state-root.v2. The native VM, runRealityNative,
runNativeBytecode and rcl run default to v2. Historical rcl.semantic-state-root.v1
and rcl.semantic-state-root.v2-candidate remain distinct verification algorithms.
The direct runReality API preserves rcl.reference-state-root.v0.6 by default;
this legacy reference root is not native v1.

## Canonical encoding

Encode the normalized semantic state as compact JSON typed arrays:

| Value | Encoding |
| --- | --- |
| Null | ["null"] |
| Truth | ["truth",true] or ["truth",false] |
| Text | ["text",text] |
| Number | ["number",hex] |
| Sequence | ["sequence",[encoded values]] |
| Record | ["record",[[key,encoded value],...]] |

Number hex is exactly 16 lowercase hexadecimal digits for the IEEE-754 binary64
bit pattern in big-endian order. Normalize negative zero to positive zero.
Reject NaN and infinities. SHA-256 hashes UTF-8 bytes of this compact JSON with no
trailing newline. Decimal JSON is a transport representation, not the Number
canonicalization; native v2 output carries enough precision to reconstruct the
finite double exactly.

Record fields sort by unsigned UTF-8 bytes, including integer-looking keys.
Text and keys require Unicode scalar values. Control characters use canonical
JSON escapes; other scalars remain UTF-8. Nesting beyond 256 levels is rejected.
The codec can encode NUL; the current native Text runtime rejects embedded NUL
in its bytecode string pool to prevent truncation. Both emitted and untrusted
raw bytecode pools reject invalid UTF-8 and NUL before execution.

The outer state is a facet map: all its keys are semantic, including names such
as __rclType and __proto__. Plain nested records also retain metadata-named
fields. Only recognized native layout envelopes erase these seven markers:
__rclKind, __rclType, __rclObjectId, __rclFieldOffsets, __rclPayloadOffsets,
__rclRecord and __rclUnion. Recognized Record/TypedRecord/Union envelopes have a
valid kind marker and string type marker; Ref envelopes have their declared
reference markers. Typed record declarations and raw bytecode reject collisions
with these reserved layout names. Constructor/layout labels are erased by this
semantic profile; ABI type/layout identity is governed separately.

Semantic reference identifiers remain included. Allocation-order-independent
reference graph identity is not claimed. A nested kind=Intent record with an even,
string-keyed flat slots array normalizes slots to a record. Duplicate slots are
rejected. JS and native v2 use this same normalization. Facets named kind and slots in the
outer map remain ordinary semantic values.

User tag-shaped arrays are ordinary Sequences, so user records such as $rclF64
cannot collide with Number nodes. JavaScript rejects unsupported values, cycles,
sparse sequences, accessors, symbol keys and nonplain record prototypes instead
of coercing them or invoking getters.

## Selection and verification

```js
runRealityNative(source, {
  stateRootAlgorithm: 'rcl.semantic-state-root.v2',
  requireNativeStateRoot: true,
});
await runReality(source, { stateRootAlgorithm: 'rcl.semantic-state-root.v2' });
```

Native process selection uses RCL_SEMANTIC_STATE_ROOT_ALGORITHM. Explicit API
selection takes precedence over environment selection. Unknown algorithms fail
before execution. An explicitly requested algorithm must match emitted evidence;
the verifier rejects downgrade, missing state and final-root tampering. Nonfinite
state cannot emit a successful v2 receipt. Native v1 remains selectable for frozen
historical receipts and preserves its historical number serialization.

Final states, projections and transition before/after roots use the selected
algorithm. Each native transition/projection declares stateRootAlgorithm.
The JS boundary recomputes the final state root and checks the declared algorithm
and shape of transition roots. It does not reconstruct arbitrary historical
states from a history list or independently certify each historical digest.
Known-state tests independently compare both before and after roots. The frozen
v0.1 K233 and compiler-profile receipt owners explicitly replay native v1;
Stage18/19 RCL-authored root-preimage models also retain their v1 subset. This
compatibility selection does not downgrade the public native v2 default. Other
component roots (source, artifact, formedAtRoot, caches) keep their own contracts.

## Reproduction and proof scope

- node scripts/build-native-semantic-state-support.mjs --check
- node scripts/build-native-windows.mjs with a verified ZIG compiler
- make -C native clean all on Linux
- node --test --test-concurrency=1 tests/semantic-state-root-v2-stable.test.mjs
- node --test tests/native-semantic-state-root-contract.test.mjs
- node --test tests/native-vm-source-materialization.test.mjs

Windows and Linux execution pass the frozen Number cases, seeded finite binary64
corpus, typed values, Unicode, Intent, facet-map boundaries, default v2 transitions,
historical v1 and tamper/rejection controls. Independent Windows and Node 20 Debian
Linux package installations pass public API/CLI and real MCP process checks.
Both platforms reproduce the native-core compiler fixed point. See verification.json
and acceptance.md for the exact release scope. Hosted CI, physical-device and broad
GPU-production certification are not inferred from these local proofs.
