# Foundation ABI Migration Guide v0.1

Canonical manifest root: `34e508fe3b6587e630cc32a075edbad87323c7359434b2a2aaf01cf7e250f7e1`

## Consumer Contract

1. Pin Foundation Contract version `0.1.0` and verify the manifest root at startup.
2. Emit `taowind.rcl-foundation-runtime-result.v0.1` with proposal, constraints, stateDelta, evidence, confidence, authorityRequired and replayMetadata.
3. Declare each module as native, bridge, projection, asset or none. Only native and verified bridge count as real integration.
4. Bind provider receipts, authority decisions, invariants, causal parents and evidence before world mutation.
5. Replay the same seed, input and provider results and compare Reality Root before enabling the adapter in production.

## RNCS

- Populate `foundation_governance` on every new proposal.
- Keep compatibility readers for envelopes without the field, but do not allow them through the new commit path without normalization.
- Treat `FOUNDATION_4R_GATE_FAILED` as a hard commit rejection, not a warning.

## GameBrain

- Submit external language through `GameBrain.submitUtterance()`.
- Read the five ordered runtime results from `actor.cognition.substrate.foundationCognition.lastRun`.
- The old post-decision reality-matrix language summary is deprecated compatibility projection.

## Everbloom

- Set `GAMEBRAIN_MODULE_PATH` to the GameBrain ESM entry or install `@taowind/worldseed-gamebrain`.
- Keep `interpretNaturalLanguageReality()` only as the bounded provider fallback.
- Do not claim five-plane conformance when `snapshot.engine.mode` is `mock`.

## Aether Earth Android

- Keep `foundation.contract_root` in `world-foundation.rcl` synchronized with the canonical manifest.
- Recompile `world-foundation.rbc` whenever the RCL source changes.
- Use `FoundationProviderBridge.Policy` values in the world loop; do not reintroduce duplicated Java constants.
- Run `npm run verify:aether-earth:android-foundation` without Android SDK, then run Gradle unit tests and APK assembly in an Android SDK environment.

## Deprecation And Rollback

- Preserve old API entrypoints during v0.1; adapters carry the new fields.
- Warn when a compatibility fallback is selected and expose the runtime mode in health output.
- Roll back producer before consumer schema, and restore source plus compiled assets as one unit.
- Never relabel projection or asset as bridge during migration.
