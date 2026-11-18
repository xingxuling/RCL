# Identifier category admission, 2026-11-17

The native character predicates previously examined only the first scalar of a Text, and accepted almost every non-ASCII value as an identifier character. This admitted emoji, punctuation, combining marks, Unicode numbers at name start and multi-character inputs that the reference runtime rejected.

The reference lexer/runtime and native VM now share a generated, pinned Unicode 17.0 General_Category L/N classification profile, `rcl.identifier-categories.unicode-17.0.v1`: start is underscore or Letter; continuation also permits Number. Every predicate requires one Unicode scalar; `is_digit` remains ASCII 0-9. Classification no longer follows the target host's ICU version. Regeneration deliberately requires a Unicode-17-capable Node and emits the reference table, native header and embedded build-support header together; `--check` verifies exact reproduction.

This preserves the existing BMP-only source-name profile: supplementary Letter scalars are valid inputs to the public character predicates, but supplementary source names still reject in both compilers. It does not change Text indexing/slicing or introduce Unicode normalization, combining-mark names or a new language release.

The Windows distribution was rebuilt and its exact source/artifact manifest reverified (source SHA-256 `00954ae45288d33a0c0bb39f196575060a55ac2cd95c3251fdba46e3997fdc91`). Source materialization stages and hashes the new header, restores it from embedded support when absent, and invalidates cached builds when its bytes change. The Makefile and portable build/provenance inputs include this dependency. Frozen sequence-runtime variants and existing Linux/WASI binaries are separate historical artifacts at this checkpoint.

Verification:

- All 1,114,112 codepoints agree with the Unicode-17 reference engine for both predicates, including rejection of lone surrogates. Generated outputs reproduce exactly; native VM execution agrees at every category interval boundary and its neighbors.
- Character, lexical and build/cache/ABI checks pass, including invalid-output retention, BMP names, multi-character inputs and an actual DLL link/load.
- The language suite and stable v2 checks passed. Six candidate-session checks initially rejected the expanded manifest path set; the session binding now includes the header and all eleven candidate v3 checks pass, including independent CLI processes, backup/replay and tamper rejection.
- All 233 checked-in examples were examined: 195 admitted sources have exact native/reference bytecode parity, 38 remain reference-unsupported, zero native failures. Duplicate source/bytecode pairs reused 73 within-run results across 122 actual native compilation attempts; this is not 195 independent process executions.
- Native C0=C1=C2 is `b3820e387e8c73c5e2870666866f29ac34df9f7c4bc1845da558dfab57a11561` (419,109 bytes). The version contract passes; registered K400 executions were not rerun. No Actions, push or publication occurred.

Native/reference whitespace parity from the preceding checkpoint remains covered. Full Unicode Text-indexing equivalence, every source syntax context, cross-platform runtime identity and formal language maturity remain outside these checks.

## Portable distribution follow-up

The subsequent bounded portable run rebuilt the canonical Linux VM/compiler, WASI VM and WASI compiler. `scripts/verify-identifier-portable.mjs` executes 92 character-predicate facets under an actual WSL2 Linux process and Node WASI Preview 1, independently verifies v2 state roots, compares three admitted source compilations byte for byte per environment and checks five invalid names per environment with prior output retained. Both environments produce state root `41a1ba11258067b99c4a9370b841282cb79ba4ef16496d2ed08236012dc80a59`. Captured binary/target/compiler identities are in `identifier-portable-2026-11-17.json`; build manifests intentionally retain their build-only status, while this separate report supplies the scoped runtime evidence. Frozen sequence-runtime artifacts are unchanged. This is not an Android/physical-device, full portable-suite, cross-platform numeric-domain or K400 rerun claim.
