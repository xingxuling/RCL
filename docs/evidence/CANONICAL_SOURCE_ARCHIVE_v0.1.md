# Canonical Source Archive v0.1

K01 and K327 AI-generation receipts were generated against a frozen compiler source pair. Later RCL-owned compiler evolution, including the K337 static warrant-validation slice, must not invalidate those historical proofs or silently make them prove the new source.

The archive manifest records the contract roots, exact SHA-256 values, and source Git commits for the historical bytes. Receipt replay first accepts the live canonical files when their hashes still match; after a legitimate source evolution it falls back only to the matching content-addressed archive record. Archive bytes, contract roots, receipt roots, and hosted authority roots remain independently checked.

This is evidence preservation, not a new AI-generation admission. New compiler evolution requires a new contract and new independent hosted authority.
