# Compiler value equality: bounded progress

The reference runtime now compares Symbol, SemanticNode, IrNode and ParseState
using the corresponding native VM fields. Nested sequences use the same existing
value comparator; unrecognized objects retain identity semantics. The change does
not alter the native VM, root algorithms or package version.

On Windows, `node --test --test-concurrency=1 tests/reference-compiler-value-equality.test.mjs tests/reference-sequence-equality.test.mjs tests/semantic-state-root-v2-stable.test.mjs` passed 36 checks. The checked native executable was the source-manifest-verified prebuilt Windows VM; no other platform or hosted CI was exercised.

## AstNode reference execution and remaining root limitation

The native AstNode stores the exact literal text. The reference runtime now
retains that text privately through its value copies and uses it for the
accessor and AstNode equality, including inside Sequences and ParseStates. The
public AST projection stays unchanged. Native/reference execution and durable
reopen/replay pass for an actual `1` to `01` update. Generic external JSON or
`structuredClone` does not carry this private spelling; reconstructed AST objects
fall back to the projected value, so this change does not define a lossless
interchange format.

On the current native VM, independently created Number AstNodes with
literal texts `1` and `01`, otherwise identical, serialize to the same public
state and produce the same v2 state root when each is the sole state value.
However, `ast_literal_text` and native equality distinguish the texts. A real
native session can commit that change inside a Sequence with the same before and
after state root, then expose `01` in a subsequent rule. Source and command
roots are separate and can differ or bind the transition; a v2 state root alone
does not distinguish these states.

This demonstrates a bounded gap in what the current state projection and root
distinguish; it does not by itself establish a journal attack or imply that
source roots are equal. Fixing it requires a separately reviewed representation
and root-version/compatibility design. TD-020 remains active for interchange and
other typed value families; the present change does not claim whole-language
parity or that v2 roots fully bind future-observable AST state.

### Optional rejection of lossy AST projections

Callers may opt into `rejectProjectedAst: true` on `runRealityNative`,
`runNativeBytecode`, `verifyNativeSemanticStateRoot` or
`createNativeRealitySession`. Durable-session callers supply it under
`native: { rejectProjectedAst: true }`. The verifier rejects detected AstNode
shapes in the state, transition or projection output with
`RCL_NATIVE_STATE_ROOT_AST_PROJECTION_LOSSY`. A session wraps the evidence
failure as `RCL_SESSION_NATIVE_EVIDENCE_INVALID` and closes the peer. A durable
writer marks an in-flight command uncertain and stops; reopening validates the
previous durable prefix. A real daemon/journal check confirms the rejected
transition is not appended and the prior head can be reopened.
The equivalent CLI flag is `--reject-projected-ast` on session commands that
run native execution or replay, for example `rcl session verify <directory>
--reject-projected-ast`. It is intentionally unavailable to `history-verify`,
which checks supplied projections without running the native program.

This is an opt-in guard, not a repair or proof of complete state coverage. It
conservatively recognizes the public shape and may reject a user object with
the same shape. Absence of a detected AST does not prove that other value types
or projections are lossless. Legacy callers and existing v2 roots remain
unchanged; a versioned lossless representation is still needed.
