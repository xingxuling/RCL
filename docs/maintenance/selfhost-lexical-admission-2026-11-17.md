# Native leading-dot decimal admission

The RCL-authored tokenizer previously classified a leading decimal dot as a path symbol and rejected source forms such as `.5` accepted by the reference lexer. It now recognizes dot followed by a digit as a numeric start and marks that first dot consumed before scanning the remainder.

Focused controls compare exact bytecode for `.5`, `.050`, `-.5`, `1.` and `0.5` and execute their numeric values in the native VM. Additional source controls cover function bodies/calls and UI fixed-size/gap metadata, malformed `..5`, `1.2.3` and `.`, failed-output preservation and later unknown-path positions with LF and CRLF.

The compiler reached native C0 = C1 = C2 at SHA-256 `ede479743a70e36be35cbb26e017e5d1c253b98a9b2b21dc4927ed81e3d61d45` (418,693 bytes). Forty lexical, metadata and semantic-location checks passed. This is bounded decimal-admission evidence, not a complete numeric grammar or cross-platform numeric-root claim. The previously delivered package predates this change.

## Unicode whitespace and native distribution

The native `is_whitespace` builtin now matches the reference single-character ECMAScript whitespace profile, including BOM, NBSP and Unicode spaces. Identifier scanning stops at these characters instead of absorbing them into the previous name. Controls include every admitted whitespace scalar, excluded lookalikes, empty and multi-character input, five Unicode source separators and exact native/reference bytecode parity.

Eleven lexical/Unicode-coordinate checks and 28 v2 stable/v3 candidate state-root and durable-session checks passed. The native compiler still reaches C0=C1=C2 at the hash above. The Windows source-bound distribution was rebuilt with Zig 0.16.0 and independently rechecked using the prebuilt verifier; its source hash is `d9d78b187ee0b0a21ae6102036f2a83d195aee0d94b39d5ae2fdb1ed16b7f68e`. Version-contract verification passed; underlying registered K400 executions were not rerun. Other non-ASCII identifier categories remain an open admission gap at this checkpoint. No Actions or publication occurred.

## Supplementary comment EOF positions

The comment fast path advanced columns by scalar count, so an unclosed block ending in `# 😀𐐀` reported EOF two UTF-16 columns early. It now reuses the existing position counter. Twelve hash/slash-comment EOF controls cover LF/CRLF, multiple supplementary characters, CR and U+2028 inside comments, and failed-output preservation. Thirty-seven lexical and semantic-location controls passed. The new native C0=C1=C2 artifact is `f653b7e5c6eed5ddbbe8619e9a82c0dd803c2f07b76919095c4fb49373e99568` (419,157 bytes). Span offset/length placeholders and other uncovered diagnostics remain open under TD-019; the earlier portable evidence identifies its earlier compiler artifact explicitly.
