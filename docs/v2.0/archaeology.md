# Current-source archaeology, 2026-10-10

Remote main was read directly from GitHub and cloned into an isolated checkout.
The baseline is afe83b231754e8ae3adeb8058356e87165f7ad91 (RCL 1.0.0).
Older 0.94 worktrees and memory records are historical, not the current baseline.

Observed implementation gaps:

- src/runtime.mjs runReality initializes a new state and follows a fixed directive
  list. executeRule already owns guarded transactions and can be reused.
- native/rclvmd.c only offers RUN, RUN_RESET, RESET and QUIT. Every RUN begins
  at instruction zero; STORE_STATE writes initial facet values again. It does
  not offer typed external inputs or named-rule invocation.
- src/bytecode.mjs explicitly rejects conditional warrants even though the
  reference runtime evaluates them.
- atomic-checkpoint is bound to model/optimizer roots; resource-wal-runtime
  persists its resource kernel. Neither restores a running RCL program.
- external-effect-protocol tracks settlement in an in-memory Map and explicitly
  does not prove a durable queue. It stays a separate provider boundary.

DWAC was found locally. Its existing FourDevelopmentModeRouter was invoked from
Hengjie-Core/structural_generation/dwac_structural/four_mode_router.py.
It selected NORTH_STAR for audit, DEEP_DEVELOPMENT for the central session
bottleneck and WHOLE_ARTIFACT for release. Laya abstained (confidence 0.3773,
threshold 0.65), so Codex made the development choice from source evidence.
The seven-organ Federation provided discovery and a candidate route plan,
workflow 229a8d72-2253-42b8-9ab9-657fcb49e7c6; it did not execute development.

The v2 acceptance contract is acceptance.md. This document is an audit record,
not proof that those requirements are already implemented or passed.
