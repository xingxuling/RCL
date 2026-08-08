# RCL Canonical Number Encoding v2

Status: `VERIFIED` as an isolated candidate encoding; `BLOCKED` for canonical activation.

## Decision

`rcl.canonical-number.v2` encodes the declared RCL `Number` domain as a finite IEEE-754 binary64 value. The canonical payload is the raw 64-bit value in big-endian byte order, rendered as `0x` followed by exactly 16 lower-case hexadecimal digits. The token is a textual transport form for an eight-byte canonical representation; it is not a decimal pretty-printer.

The implementation is intentionally explicit in both JavaScript and C:

- `src/canonical-number-v2.mjs` uses `DataView` and rejects non-finite values.
- `native/rcl_canonical_number_v2.c` and `native/rcl_canonical_number_v2_host.c` use integer bit extraction and do not depend on locale or libc floating-point formatting.
- `-0` is normalized to the `+0` bit pattern `0x0000000000000000`.
- `NaN`, `+Infinity`, and `-Infinity` are language-level illegal for this encoding and fail closed with `RCL_CANONICAL_NUMBER_V2_NONFINITE`.

This policy gives one encoding per declared numeric value, makes the sign-zero choice explicit, and leaves no runtime-specific decision about special values.

## Evidence

The fixed corpus contains 1,000 cases and the generated corpus contains 10,000 finite cases. Seeds are committed in `examples/rbc13-number-encoding-v2-corpus.json`:

| Evidence | Result |
| --- | --- |
| JS/C cases | 11,000 |
| JS/C mismatches | 0 |
| round trips | 11,000 |
| non-finite rejects | 3 |
| uniqueness mismatches | 0 |
| fixed root | `5fc7d77acb2f6873cfe660d9598febc78f387c97fb5d2f4cc350f2dd3534a860` |
| generated root | `c49c766a201b69b1f98a12cb0f18ffb52931e51cd3404f2b67058316249e1f63` |
| corpus root | `a7071d47b65ad721ff3098b977fc607106ac96bb0ffb5910c3ce998f44894da7` |
| report root | `c8b8f68438fd0c161999f5e9ca17666a3e282a29e5d3dcfce13dc77691f14a9a` |

The 10,999 uniqueness groups are expected: the explicit `+0` and `-0` inputs share one canonical representation under the chosen policy. The C host was compiled with the locally available MSVC 19.50 toolchain.

The report's `caseLedger` contains all 11,000 rows. Each row records source representation, input bits, normalized canonical bits, JavaScript token, C token, match, round-trip result, and the isolated v2 semantic root for `{ number: value }`. The C host also evaluates the three non-finite bit patterns and emits `ERROR` for each.

Reproduce with:

```text
npm run verify:rbc13-number-encoding-v2
```

## Version isolation and roots

The existing `rcl.semantic-state-root.v1` implementation and historical receipts were not edited. The previous v1 audit remains a separate result: 7/10 parity on the old extended sample and three known decimal-serialization mismatches. That result is not silently reinterpreted as v2.

`src/semantic-state-root-v2.mjs` defines a separate `rcl.semantic-state-root.v2` candidate grammar whose numeric token is bound to this encoding. It is not selected by the current runtime. `src/semantic-state-root-migration-v2.mjs` only creates an explicit migration receipt from a verified v1 receipt; it does not rewrite, alias, or claim equality between v1 and v2 roots.

## Boundary

This evidence proves cross-language candidate encoding, corpus parity, round-trip behavior, and version isolation. It does not change `VERSION-CONTRACT.json`, `COMPONENT-VERSIONS.json`, the canonical semantic root, the canonical RBC version, or the formal native VM ABI. A future Rust or other runtime must implement the same finite binary64 and sign-zero contract and reproduce the corpus roots before it can be considered equivalent.
