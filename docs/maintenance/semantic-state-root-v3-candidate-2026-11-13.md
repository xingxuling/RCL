# AST literal-aware semantic state root candidate

`rcl.semantic-state-root.v3-candidate` is an explicit opt-in candidate for the
native one-shot VM and non-durable native/reference sessions. The default stays
`rcl.semantic-state-root.v2`. A v3 AST public projection carries `literalText`;
the existing v2 typed canonical JSON encoding is hashed with the UTF-8 domain
`rcl.semantic-state-root.v3-candidate`, one zero byte, and the canonical bytes.
This gives distinct roots from v2 even when no AST occurs. It preserves existing
numeric, Unicode and typed-value policies of the v2 encoder.

An actual Windows native VM and reference runtime agree for direct AST values,
nested Sequences and ParseStates, Unicode text, realized transitions and
non-durable forecasts/commits. Independent JSON rehash and altered-text rejection
pass. A v2 AST projection lacking raw spelling cannot be upgraded into v3; the
candidate rejects it instead of guessing. Legacy v2 sample output and root are
unchanged. The opt-in `rejectProjectedAst` check accepts a v3 projection only
when the spelling field is present.

Direct hashing of an in-memory root AstNode also retains its private spelling;
`1` and `01` produce different v3 roots. An untagged top-level JSON object can
be indistinguishable from a facet map with the same shape, so callers must not
interpret its hash alone as evidence that an old standalone AST projection was
lossless. Place external ASTs in a state map with `literalText` present and
verify their provenance separately.

The candidate conservatively recognizes the existing public AstNode shape; an
untyped user record with that same shape and no spelling field can be rejected.
Marked typed records with the same field names are accepted by the v3 root
calculation. The optional `rejectProjectedAst` guard remains conservative and
may still reject such records; it does not authenticate untrusted type markers.
The additional field and root authenticate the supplied public representation,
not its publisher, program source, complete semantic equivalence of every RCL
type, or historical evidence. Untrusted JSON can claim a spelling; verify the
producer and its source separately. Generic external copies of v2 ASTs remain
lossy. The implementation does not change the default root, journal format,
existing v2 roots, language maturity, package version, or release status.

To try the candidate on a source program without creating a durable journal:

```js
import { createNativeRealitySession, RCL_SEMANTIC_STATE_ROOT_V3_CANDIDATE } from '@taowind/rcl-reality-forge';

const session = await createNativeRealitySession(source, {
  stateRootAlgorithm: RCL_SEMANTIC_STATE_ROOT_V3_CANDIDATE,
  rejectProjectedAst: true,
});
try {
  const before = session.snapshot();
  const result = await session.invoke({ rule: 'update' });
  console.log(before.stateRoot, result.afterRoot, result.state);
} finally {
  await session.close();
}
```

The source must declare the `update` rule; callers may use another declared
rule. When an AstNode is present, its projected `literalText` is part of the
candidate root. Choose v3 explicitly for each new session. Existing v2 roots
and v2-only journal verification do not gain this property retroactively.

The Windows binaries were rebuilt with the existing local Zig 0.16.0 and their
prebuilt manifest regenerated. Focused v3, prior v2-root, reference AST, session
and protocol regression groups passed 49 checks locally. This is not Linux or
Android acceptance and no hosted Actions ran. No automatic migration of v2
journals is implied.

An initial opt-in candidate journal path now supports native/reference commit,
reopen, replay and idempotent retry with distinct v3 genesis and command formats.
An adversarial local check changes the stored AST spelling, recomputes the
candidate state root and enclosing result and journal roots, and confirms that
native replay rejects the forged result. This is replay evidence, not publisher
authentication or proof against every possible alteration.
It rejects a v2-mode reopen and retains v2 as the default. Candidate backups have
a distinct manifest format, require explicit v3 selection for verification, and
pass native/reference replay, an anchored restore and asset-tampering rejection.
Candidate history pages use a distinct format and verify state roots, record
continuity and trusted head anchors. Local checks cover two-page realized and
forecast history, tampered literal text, page reordering and a rehashed format
downgrade. Offline verification does not execute commands or authenticate the
publisher. This is a local candidate, not a complete
durable-journal release or a migration of prior history.

A separate local compatibility check also attempts the opposite direction: a
v2 journal cannot be opened in v3 mode. Its source, bytecode and journal bytes
remain unchanged after rejection, and the v2 journal can subsequently reopen at
its previously pinned head.

The session CLI accepts `--state-root-v3-candidate` on native session operations,
including `init`, `invoke`, `history`, `backup` and `backup-verify`. Supply it on
each such invocation; v2 remains the default. It can be combined with
`--reject-projected-ast` in either order. `history-verify` reads the versioned
page format directly and does not accept this native-execution flag. A local
separate-process CLI check covers creation, invocation, history verification and
backup replay.

On 2026-11-17, `npm pack --dry-run --json` listed the candidate runtime modules,
Windows VM and daemon, and `examples/sessions/ast-root-v3-candidate.mjs` in a
3,522-entry package manifest. A subsequent actual package from source commit
`c48c18b122d6a277cc71dc0849c2c64aee875570` was installed offline into a
separate local directory with lifecycle scripts disabled. The installed package's
native session example executed, and its CLI created, invoked and replayed a v3
candidate journal with native and reference verification. The archive contained
66,680,658 bytes and had SHA-256
`1b8b379a7924770594af86b52e9d390eba26e2c5f1ddc9466430646980efd336`.
The installation directory was within the local workspace; this does not prove
publication or execution on another platform. The package excludes the source
test suite, so these installed flows are distinct from the checkout test suite.
An additional installed-CLI flow used a real Sequence containing an AstNode:
the `1` to `01` update changed the root, a page verified against the recorded
head, and an independent candidate backup passed native and reference replay.
These checks used the same local Windows package and do not establish external
publisher authentication or cross-platform acceptance.
