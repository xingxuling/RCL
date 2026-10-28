# Atomic canonical UI state restoration

The canonical UI runtime now stages every declared restore value before updating
local state. A later type failure or snapshot read exception leaves the complete
prior state and lifecycle trace unchanged. Each selected snapshot field is read
once, and the committed value is exactly the value that passed validation.
Successful restoration preserves the public state object's identity and ignores
undeclared restore fields as before.

Two partial-write defects were reproduced before the change. Four focused checks
and sixteen existing runtime/style/layout/backend semantic checks pass afterward.
The snapshot single-read check also covers an accessor that returns a different
type on a second read. Finite-number checks and partial valid snapshots retain
their previous contract.

This change affects the canonical JavaScript UI runtime and semantic-trace
consumers. It does not claim new generated Android Bundle restore behavior,
browser persistent storage, or real-device acceptance. No language version or
research-preview status changed; no hosted Actions ran.
