# Candidate v3 durable admission: implementation gates

Status: PARTIAL CANDIDATE. A distinct v3 writer now supports commit, replay,
retry, versioned backup and offline history verification. The v2 journal and its
historical roots are unchanged. Broader compatibility and negative-control
gates below remain open.

The current writer binds its genesis to the source, bytecode, initial state root,
and v2 algorithm; command records bind the command, result, prior head and state
roots. A v3 implementation must use a distinct genesis and journal format, record
the v3 algorithm on every transition, and reject an algorithm or format change
within one history. Opening a v2 journal as v3 or a v3 journal as v2 must fail
without rewriting either journal. No automatic upgrade can recover spelling
omitted from old v2 state projections.

Result validation and native/reference replay must use the selected state-root
algorithm for state and transition roots. Journal, command and result identities
need explicit versioned domains and must bind the exact inputs, projected AST
literal text, source identity and expected revision. Existing v1/v2 retry and
replay behavior must remain separately verified. A failed or interrupted append
must retain the current writer-poisoning and prefix-recovery guarantees.

History pages and backups cannot be declared supported merely because a v3
writer can append. Their formats, verification rules and CLI selection need
explicit v3 support, including multi-page continuity, trusted anchors, raw AST
tampering, rejected downgrade, restart and independent backup restore. Until
those paths pass actual native daemon and reference replay checks, they must
fail closed for the candidate format rather than emitting v2 claims.

Acceptance requires runnable tests of real create, forecast, commit, reopen,
idempotent retry, history verification and restore, plus negative controls for
changed spelling, changed roots, mixed formats, truncated histories and legacy
compatibility. Local Windows results do not imply hosted CI or other platforms.
