# Native UI tree admission

The RCL-authored compiler now rejects duplicate node identities across the full
view tree, missing text/action content, actions without activation handlers and
duplicate event handlers. Form validation scopes must name an ancestor container
and carry a true form guard. Modal declarations must retain the existing bounded
contract: one true modal container, directly under an overlay root, with a
nonempty accessible label and a visible binding.

The change uses the current parsed tree and semantic pass; it does not add a
parallel UI model. The local TaoX four-mode router recommended DEEP_DEVELOPMENT
with score 0.905 for this source-audited bottleneck, as advisory planning only.

Twenty-five native/reference controls moved from 3 PASS / 22 FAIL to 25 PASS.
They cover sibling/ancestor/cross-branch identity collisions, form scope and modal
constraints, output retention on rejection and exact bootstrap bytes for admitted
fixtures. Existing multiple-navigation rejection remains covered. The final
artifact reaches C0=C1=C2 at 349965 bytes, SHA-256
`3bc04ad5551c89af5234c05862d9ba844d7b72457e86d64f09c5ea86dfc45860`.
All 156 relevant final-artifact compiler, UI, location, warrant, session and
collector CLI checks pass.

Complete UI schema/type/diagnostic parity is still unclaimed. This work does not
run platform UI acceptance or change source-bound historical K400 evidence,
language versions or release status. No hosted Actions ran.
