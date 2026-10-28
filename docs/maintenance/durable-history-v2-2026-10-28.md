# Versioned durable identities and offline history verification

The durable-session owner now creates `rcl.session-journal.v2` genesis records and
`rcl.session-journal-command.v2` receipts. The command payload remains the existing
`rcl.session-command.v1` schema. The v2 command identity includes the root of the
input facet map calculated at its own top level. The result identity combines its
existing semantic payload root, the contextual command identity and a separately
calculated complete state-map root. The language, RBC, native VM and package
version contracts are unchanged.

An actual pre-change native session reproduced the defect: commands containing
`__rclKind = "Record"` and different `__rclType` inputs were accepted as the same
idempotent retry, returning the old input. Layout normalization could also hide
that edit from the wrapped receipt/page hash. The new contextual identities bind
these user input/state keys without changing the canonical native-layout
normalization algorithm. Retries compare the exact normalized input-map identity;
replay separately checks displayed command/state bindings. Forged command, result
command and state metadata now reject even when an outer payload hash is unchanged.

| Stream | New reader/writer behavior |
|---|---|
| New v2 genesis | Accept v2 commands; reject v1 command downgrade |
| Existing v1 genesis/history | Replay existing entries and preserve existing roots/bytes |
| Append to existing v1 history | Append a tagged v2 command without rewriting the prefix |
| Stream after its first v2 command | Reject later v1 commands |
| Legacy ambiguous evidence | Remains limited; no retrospective input authentication claim |

Readers supporting v1 only must be upgraded for the v2 record tags. Existing
trusted raw backup hashes remain useful for byte provenance. Old semantic head
or page pins alone cannot recover previously omitted input evidence. TD-021
records this legacy limitation; TD-017 still covers the unchanged 64 MiB / 10000
command replay limit and future checkpoint/compaction work.

The public SDK additionally exports
`verifyDurableRealitySessionHistoryPage` and
`verifyDurableRealitySessionHistoryPages`. These check page and receipt roots,
command/result/state bindings, transition reconstruction, request uniqueness,
revision coverage and cross-page continuity. A page root, previous root, session,
program, journal head and minimum revision may be pinned explicitly. The CLI
accepts a page, an acknowledged `session history` output, or an array of pages:

```powershell
node src/reality-hub-cli.mjs session history-verify pages.json --expected-root <trusted-head>
```

Pages must represent one captured head. An interior page's copied head field is
not content proof. Status is `CONSISTENT_UNANCHORED` until its content is pinned
or the complete supplied chain links to a pinned terminal command. Empty pages
need their own page pin. Any included v1 entries produce
`LEGACY_IDENTITY_LIMITED`, with `contentAnchored: false`. Only a covered, anchored
v2 range can report `completeHistory: true`; `coversReportedHistory` reports range
coverage separately. Copying an expected pin from the same untrusted file does
not create external trust.

The verifier performs no command replay/source execution, opens no native writer
and grants no authority. A real CLI process verified exported pages while the
original native writer held its lock, with unchanged journal bytes and a usable
writer afterward. The file reader enforces strict UTF-8 and a 128 MiB input limit.

Sixteen new controls and all 76 affected session/CLI/backup/integrity checks pass,
including the real-VM fault harness with the existing local Zig toolchain. The
initial fault-harness run lacked the configured compiler; it was rerun with the
actual installed toolchain, without downloading one. An actual v1 stream from the
before-change reproduction reopens, accepts its exact retry, rejects a changed
retry and appends v2 while preserving every old byte. A separate v2 four-command
demo verifies realized/projected/not-triggered receipts against a pinned head.
Adjacent JSON binds the exact sources, observations and logs.

This is local candidate engineering evidence. It is not publisher authentication,
independent replay proof, journal compaction or formal language promotion. No
hosted Actions, publication or deployment ran.
