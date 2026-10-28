# Consistent session receipt history

The existing durable writer now supplies queued pages of replayed or
append-acknowledged command receipts. Pages bind their bounds, prior chain root,
current head and state root. Callers can pin the head across pages. Reads retain
idempotency, forecast semantics, writer ownership and the full-prefix journal;
they do not alter stored records or import state snapshots.

Six focused checks pass, including an actual public CLI process, native restart,
reference replay, detached page mutations, no journal byte changes and stale-pin
rejection. The initial combined run also passed all seventeen existing
durable/backup checks. Its history subprocess check incorrectly targeted the old
CLI entry; correcting the check to the package's declared public entry resolved
the failure. No dispatch workaround was added to the old entry.

This is a local capability with source-bound evidence. Page roots are consistency
checksums; caller-held roots remain the trust boundary. TD-017 remains ACTIVE:
history pages do not compact the replay prefix or extend its existing limits.
