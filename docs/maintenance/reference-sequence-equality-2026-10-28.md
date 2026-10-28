# Reference Sequence value equality

The reference runtime now compares Sequence elements structurally through the
existing equality operator owner in `src/quantity.mjs`. Scalars retain strict
equality, quantities retain their existing dimension/numeric-value policy, and
Span/Token fields compare as they already do in the native VM. An explicit
worklist handles nested/shared arrays without recursive JavaScript calls. Unknown
domain objects keep identity semantics; this is not generic JSON equality.

The original independent `[1, 2, 1, 2]` discrepancy now passes state, history and
semantic-root parity. The native concat test includes its original equality
expression in full parity again. A guarded native/reference transaction and an
actual durable native writer with reference verification, reopen, journal replay
and idempotent retry pass. Nine missing controls were reproduced before edits;
all fourteen new controls and the full 144-check affected language, numeric/root,
durable and concat group now pass. The 20,000-level helper stress is reference
only; it does not assert equivalent native nesting limits.

TD-020 remains ACTIVE for other value families. A separate exact control still
finds independently constructed equal AstNode values false in the reference
runtime and true in C. Raw literal spelling, ParseState/IR metadata and typed
reference identity need their own explicit contracts. This change does not add
those semantics or alter native C, RBC/compiler artifacts, version contracts,
historical evidence or K400 admission. Adjacent JSON binds the sources and checks.

```powershell
node --test tests/reference-sequence-equality.test.mjs tests/native-persistent-concat.test.mjs
```

No hosted Actions, publication or deployment ran.
